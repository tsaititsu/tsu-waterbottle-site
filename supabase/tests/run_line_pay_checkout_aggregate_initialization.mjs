import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LINE_PAY_POSTGRES_IMAGE } from './line_pay_postgres_image.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDirectory, '../..')
const taskLabel = 'line-pay-initialize-aggregate-v1'
const containerName = `${taskLabel}-${randomBytes(6).toString('hex')}`
const hostedContainerName = `${containerName}-hosted`
const networkName = `${containerName}-network`
const volumeName = `${containerName}-data`
const localPostgresPassword = randomBytes(32).toString('base64url')
const hostedPostgresPassword = randomBytes(32).toString('base64url')
const image = LINE_PAY_POSTGRES_IMAGE
const baseMigration = join(
  root,
  'supabase/migrations/20260719033404_line_pay_remediation_contracts.sql',
)
const initializationMigration = join(
  root,
  'supabase/migrations/20260728053215_line_pay_checkout_aggregate_initialization.sql',
)
const initializationRecovery = join(
  root,
  'supabase/deployment/line_pay_checkout_aggregate_initialization_recovery.sql',
)
const baselineFiles = [
  'supabase/schema.sql',
  'supabase/bank_transfer_submissions_patch.sql',
  'supabase/newebpay_payments_patch.sql',
  'supabase/payments_service_role_grants.sql',
  'supabase/product_orders_schema_draft.sql',
  'supabase/migrations/20260707_line_pay_provider_schema_draft.sql',
]

function runDocker(args, options = {}) {
  const result = spawnSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
    ...options,
  })

  if (result.error?.code === 'ENOENT') {
    throw new Error('LOCAL_DB_RUNTIME_UNAVAILABLE: docker command not found')
  }

  if (result.status !== 0) {
    throw new Error(
      `LOCAL_DB_COMMAND_FAILED: docker ${args[0]} exited ${result.status}\n${result.stderr || result.stdout}`,
    )
  }

  return result.stdout.trim()
}

function psqlAsInContainer(
  container,
  database,
  user,
  sql,
  label,
  expectFailure = false,
) {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      container,
      'psql',
      '-X',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      user,
      '-d',
      database,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      input: sql,
    },
  )

  if (expectFailure) {
    if (result.status === 0) {
      throw new Error(`${label} unexpectedly succeeded`)
    }
    return `${result.stdout}\n${result.stderr}`
  }

  if (result.status !== 0) {
    throw new Error(`${label} failed\n${result.stderr || result.stdout}`)
  }

  return result.stdout.trim()
}

function psql(database, sql, label) {
  return psqlAsInContainer(
    containerName,
    database,
    'postgres',
    sql,
    label,
  )
}

function psqlFile(database, path) {
  const absolutePath = path.startsWith('/') ? path : join(root, path)
  return psql(database, readFileSync(absolutePath, 'utf8'), path)
}

function psqlFileAsInContainer(container, database, user, path, label = path) {
  const absolutePath = path.startsWith('/') ? path : join(root, path)
  return psqlAsInContainer(
    container,
    database,
    user,
    readFileSync(absolutePath, 'utf8'),
    label,
  )
}

function psqlExpectDenied(database, role, label) {
  const sql = `
    set role ${role};
    select *
    from public.initialize_product_order_line_pay_checkout(
      pg_catalog.jsonb_build_object()
    );
  `
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      containerName,
      'psql',
      '-X',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      database,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      input: sql,
    },
  )
  const output = `${result.stdout}\n${result.stderr}`

  if (
    result.status === 0
    || !/permission denied for function initialize_product_order_line_pay_checkout/i.test(
      output,
    )
  ) {
    throw new Error(`${label} did not fail with the exact function denial`)
  }
}

function prepareDatabase(database) {
  psqlFile(database, 'supabase/tests/line_pay_local_postgres_bootstrap.sql')
  for (const file of baselineFiles) psqlFile(database, file)
  psqlFile(database, baseMigration)
  psqlFile(database, initializationMigration)
}

function waitForPostgres(container) {
  let readyChecks = 0
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = spawnSync(
      'docker',
      [
        'exec',
        container,
        'psql',
        '-X',
        '-A',
        '-t',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-c',
        'select 1',
      ],
      { encoding: 'utf8' },
    )
    readyChecks =
      result.status === 0 && result.stdout.trim() === '1'
        ? readyChecks + 1
        : 0
    if (readyChecks >= 2) return
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250)
  }

  throw new Error(
    `LOCAL_DB_RUNTIME_UNAVAILABLE: PostgreSQL ${container} did not become stably ready`,
  )
}

function prepareBaselineAs(container, database, user) {
  for (const file of baselineFiles) {
    psqlFileAsInContainer(container, database, user, file)
  }
}

function testMigrationLateFailureRollback(database) {
  psqlFile(database, 'supabase/tests/line_pay_local_postgres_bootstrap.sql')
  for (const file of baselineFiles) psqlFile(database, file)
  psqlFile(database, baseMigration)

  const migration = readFileSync(initializationMigration, 'utf8')
  const failingMigration = migration.replace(
    /\ncommit;\s*$/i,
    `
do $late_failure$
begin
  raise exception 'line_pay_initialization_forced_late_migration_failure';
end
$late_failure$;

commit;
`,
  )
  if (failingMigration === migration) {
    throw new Error('late migration failure fixture did not replace commit')
  }

  const failureOutput = psqlAsInContainer(
    containerName,
    database,
    'postgres',
    failingMigration,
    'forced late migration failure',
    true,
  )
  if (!failureOutput.includes('line_pay_initialization_forced_late_migration_failure')) {
    throw new Error('forced late migration failure marker was not observed')
  }

  const rollbackState = JSON.parse(
    psql(
      database,
      `
        copy (
          select pg_catalog.jsonb_build_object(
            'index_absent',
              pg_catalog.to_regclass(
                'public.line_pay_payment_audit_events_checkout_initialized_once_idx'
              ) is null,
            'policy_absent',
              not exists (
                select 1
                from pg_catalog.pg_policy as policy
                join pg_catalog.pg_class as relation
                  on relation.oid = policy.polrelid
                join pg_catalog.pg_namespace as namespace
                  on namespace.oid = relation.relnamespace
                where namespace.nspname = 'public'
                  and relation.relname = 'line_pay_payment_audit_events'
                  and policy.polname =
                    'line_pay_payment_function_owner_checkout_initialized_audit_insert'
              ),
            'helper_absent',
              pg_catalog.to_regprocedure(
                'line_pay_private.record_line_pay_checkout_initialized_audit(uuid,uuid,uuid,text)'
              ) is null,
            'initializer_absent',
              pg_catalog.to_regprocedure(
                'public.initialize_product_order_line_pay_checkout(jsonb)'
              ) is null,
            'unsafe_membership_absent',
              not exists (
                select 1
                from pg_catalog.pg_auth_members as membership
                join pg_catalog.pg_roles as granted_role
                  on granted_role.oid = membership.roleid
                join pg_catalog.pg_roles as member_role
                  on member_role.oid = membership.member
                where granted_role.rolname = 'line_pay_payment_function_owner'
                  and member_role.rolname = current_user
                  and (membership.inherit_option or membership.set_option)
              )
          )
        ) to stdout;
      `,
      'late migration rollback inventory',
    ),
  )
  if (Object.values(rollbackState).some((value) => value !== true)) {
    throw new Error(
      `late migration rollback left residual state: ${JSON.stringify(rollbackState)}`,
    )
  }
}

function testReviewedRecovery(database) {
  psqlFile(database, 'supabase/tests/line_pay_local_postgres_bootstrap.sql')
  for (const file of baselineFiles) psqlFile(database, file)
  psqlFile(database, baseMigration)
  psqlFile(database, initializationMigration)
  psqlFile(database, initializationRecovery)

  const recoveryState = JSON.parse(
    psql(
      database,
      `
        copy (
          select pg_catalog.jsonb_build_object(
            'initializer_absent',
              pg_catalog.to_regprocedure(
                'public.initialize_product_order_line_pay_checkout(jsonb)'
              ) is null,
            'audit_helper_absent',
              pg_catalog.to_regprocedure(
                'line_pay_private.record_line_pay_checkout_initialized_audit(uuid,uuid,uuid,text)'
              ) is null,
            'index_absent',
              pg_catalog.to_regclass(
                'public.line_pay_payment_audit_events_checkout_initialized_once_idx'
              ) is null,
            'policy_absent',
              not exists (
                select 1
                from pg_catalog.pg_policy as policy
                join pg_catalog.pg_class as relation
                  on relation.oid = policy.polrelid
                join pg_catalog.pg_namespace as namespace
                  on namespace.oid = relation.relnamespace
                where namespace.nspname = 'public'
                  and relation.relname = 'line_pay_payment_audit_events'
                  and policy.polname =
                    'line_pay_payment_function_owner_checkout_initialized_audit_insert'
              ),
            'audit_rows_absent',
              not exists (
                select 1
                from public.line_pay_payment_audit_events as audit
                where audit.event_type = 'checkout_initialized'
              )
          )
        ) to stdout;
      `,
      'reviewed recovery postcondition',
    ),
  )
  if (Object.values(recoveryState).some((value) => value !== true)) {
    throw new Error(
      `reviewed recovery left unexpected state: ${JSON.stringify(recoveryState)}`,
    )
  }
}

function testReviewedRecoveryRequiresFailForward(database) {
  const recoveryOutput = psqlAsInContainer(
    containerName,
    database,
    'postgres',
    readFileSync(initializationRecovery, 'utf8'),
    'reviewed recovery after initializer use',
    true,
  )
  if (
    !recoveryOutput.includes(
      'line_pay_initialization_recovery_requires_fail_forward',
    )
  ) {
    throw new Error(
      'reviewed recovery did not fail closed with the exact fail-forward marker',
    )
  }

  const preservedState = JSON.parse(
    psql(
      database,
      `
        copy (
          select pg_catalog.jsonb_build_object(
            'initializer_preserved',
              pg_catalog.to_regprocedure(
                'public.initialize_product_order_line_pay_checkout(jsonb)'
              ) is not null,
            'audit_helper_preserved',
              pg_catalog.to_regprocedure(
                'line_pay_private.record_line_pay_checkout_initialized_audit(uuid,uuid,uuid,text)'
              ) is not null,
            'index_preserved',
              pg_catalog.to_regclass(
                'public.line_pay_payment_audit_events_checkout_initialized_once_idx'
              ) is not null,
            'policy_preserved',
              exists (
                select 1
                from pg_catalog.pg_policy as policy
                join pg_catalog.pg_class as relation
                  on relation.oid = policy.polrelid
                join pg_catalog.pg_namespace as namespace
                  on namespace.oid = relation.relnamespace
                where namespace.nspname = 'public'
                  and relation.relname = 'line_pay_payment_audit_events'
                  and policy.polname =
                    'line_pay_payment_function_owner_checkout_initialized_audit_insert'
              ),
            'audit_evidence_preserved',
              exists (
                select 1
                from public.line_pay_payment_audit_events as audit
                where audit.event_type = 'checkout_initialized'
              )
          )
        ) to stdout;
      `,
      'fail-forward recovery preservation',
    ),
  )
  if (Object.values(preservedState).some((value) => value !== true)) {
    throw new Error(
      `fail-forward recovery changed state: ${JSON.stringify(preservedState)}`,
    )
  }
}

function testPayloadLimitMutationSensitivity(database) {
  psqlFile(database, 'supabase/tests/line_pay_local_postgres_bootstrap.sql')
  for (const file of baselineFiles) psqlFile(database, file)
  psqlFile(database, baseMigration)

  const migration = readFileSync(initializationMigration, 'utf8')
  const mutatedMigration = migration.replace(
    /\n\s*or pg_catalog\.octet_length\(p_payload::text\) > 65536/i,
    '',
  )
  if (mutatedMigration === migration) {
    throw new Error('payload size mutation did not remove the reviewed guard')
  }
  psql(
    database,
    mutatedMigration,
    'payload size guard mutation migration',
  )

  psql(
    database,
    `
      insert into auth.users (id)
      values ('41000000-0000-4000-8000-000000000088');

      set role service_role;

      do $$
      declare
        v_payload jsonb;
        v_result record;
      begin
        select pg_catalog.jsonb_build_object(
          'user_id', '41000000-0000-4000-8000-000000000088',
          'environment', 'sandbox',
          'order_no', 'PO-SANDBOX-SIZE-MUTATION-1',
          'merchant_order_no', 'LP_SANDBOX_SIZE_MUTATION_1',
          'customer_name', null,
          'customer_email', null,
          'customer_phone', null,
          'note', null,
          'items', (
            select pg_catalog.jsonb_agg(
              pg_catalog.jsonb_build_object(
                'product_slug',
                  'oversized-'
                  || pg_catalog.lpad(item_index::text, 3, '0')
                  || pg_catalog.repeat('s', 180),
                'product_name', pg_catalog.repeat('N', 500),
                'unit_price_twd', 1,
                'quantity', 1,
                'product_snapshot', pg_catalog.jsonb_build_object(
                  'slug',
                    'oversized-'
                    || pg_catalog.lpad(item_index::text, 3, '0')
                    || pg_catalog.repeat('s', 180),
                  'name', pg_catalog.repeat('N', 500),
                  'category', '符咒商品',
                  'priceTwd', 1
                )
              )
            )
            from pg_catalog.generate_series(1, 100) as item_index
          ),
          'shipping_info', pg_catalog.jsonb_build_object(
            'recipient_name', null,
            'recipient_phone', null,
            'recipient_email', null,
            'shipping_method', 'manual',
            'postal_code', null,
            'address', null,
            'store_type', null,
            'store_id', null,
            'store_name', null,
            'store_address', null,
            'store_phone', null
          ),
          'idempotency_key', 'sandbox-size-mutation-0001',
          'request_body_sha256', pg_catalog.repeat('1', 64),
          'confirm_token_hash', pg_catalog.repeat('2', 64),
          'cancel_token_hash', pg_catalog.repeat('3', 64),
          'capability_expires_at',
            pg_catalog.to_char(
              pg_catalog.clock_timestamp() + interval '30 minutes',
              'YYYY-MM-DD"T"HH24:MI:SS.USOF'
            )
        )
        into strict v_payload;

        if pg_catalog.octet_length(v_payload::text) <= 65536 then
          raise exception 'payload_size_mutation_fixture_too_small';
        end if;

        select *
        into strict v_result
        from public.initialize_product_order_line_pay_checkout(v_payload);

        if v_result.result_code <> 'initialized' then
          raise exception 'payload_size_mutation_did_not_reach_initializer';
        end if;
      end;
      $$;
    `,
    'payload size guard mutation sensitivity',
  )
}

function testHostedNonSuperuserUpgrade() {
  const database = 'line_pay_initialization_hosted'
  const clusterAdmin = 'line_pay_initialization_cluster_admin'
  const originalPostgres = 'line_pay_initialization_original_postgres'
  const executor = 'postgres'

  runDocker([
    'run',
    '--detach',
    '--rm',
    '--name',
    hostedContainerName,
    '--label',
    `task=${taskLabel}`,
    '--network',
    networkName,
    '--tmpfs',
    '/var/lib/postgresql/data:rw,nosuid,size=536870912',
    '--env',
    `POSTGRES_PASSWORD=${hostedPostgresPassword}`,
    image,
  ])
  waitForPostgres(hostedContainerName)

  psqlAsInContainer(
    hostedContainerName,
    'postgres',
    executor,
    `
      create role ${clusterAdmin}
        login inherit superuser createdb createrole replication bypassrls;
    `,
    'create hosted cluster admin',
  )
  psqlAsInContainer(
    hostedContainerName,
    'postgres',
    clusterAdmin,
    `alter role postgres rename to ${originalPostgres};`,
    'reserve hosted executor role name',
  )
  psqlAsInContainer(
    hostedContainerName,
    'postgres',
    clusterAdmin,
    `
      create role ${executor}
        login inherit nosuperuser createdb createrole replication bypassrls;
      create database ${database} owner ${executor};
    `,
    'create hosted non-superuser executor',
  )
  psqlFileAsInContainer(
    hostedContainerName,
    database,
    clusterAdmin,
    'supabase/tests/line_pay_local_postgres_bootstrap.sql',
    'hosted bootstrap',
  )
  psqlAsInContainer(
    hostedContainerName,
    database,
    clusterAdmin,
    `
      grant all on schema auth to ${executor};
      grant all on all tables in schema auth to ${executor};
      grant all on all sequences in schema auth to ${executor};
      grant all on all routines in schema auth to ${executor};
      grant anon, authenticated, service_role
        to ${executor} with admin option;
    `,
    'hosted executor baseline capabilities',
  )
  prepareBaselineAs(hostedContainerName, database, executor)
  psqlFileAsInContainer(
    hostedContainerName,
    database,
    executor,
    baseMigration,
    'hosted base LINE Pay migration',
  )
  psqlFileAsInContainer(
    hostedContainerName,
    database,
    executor,
    initializationMigration,
    'hosted aggregate initialization migration',
  )

  const hostedState = JSON.parse(
    psqlAsInContainer(
      hostedContainerName,
      database,
      executor,
      `
        copy (
          select pg_catalog.jsonb_build_object(
            'executor_is_not_superuser',
              not (
                select role.rolsuper
                from pg_catalog.pg_roles as role
                where role.rolname = current_user
              ),
            'initializer_exists',
              pg_catalog.to_regprocedure(
                'public.initialize_product_order_line_pay_checkout(jsonb)'
              ) is not null,
            'admin_only_membership',
              (
                select pg_catalog.count(*)
                from pg_catalog.pg_auth_members as membership
                join pg_catalog.pg_roles as granted_role
                  on granted_role.oid = membership.roleid
                join pg_catalog.pg_roles as member_role
                  on member_role.oid = membership.member
                where granted_role.rolname = 'line_pay_payment_function_owner'
                  and member_role.rolname = current_user
                  and membership.admin_option
                  and not membership.inherit_option
                  and not membership.set_option
              ) = 1,
            'unsafe_membership_absent',
              not exists (
                select 1
                from pg_catalog.pg_auth_members as membership
                join pg_catalog.pg_roles as granted_role
                  on granted_role.oid = membership.roleid
                join pg_catalog.pg_roles as member_role
                  on member_role.oid = membership.member
                where granted_role.rolname = 'line_pay_payment_function_owner'
                  and member_role.rolname = current_user
                  and (membership.inherit_option or membership.set_option)
              )
          )
        ) to stdout;
      `,
      'hosted upgrade postcondition',
    ),
  )
  if (Object.values(hostedState).some((value) => value !== true)) {
    throw new Error(
      `hosted non-superuser upgrade postcondition failed: ${JSON.stringify(hostedState)}`,
    )
  }
}

function runPsqlAsync(database, sql) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      'docker',
      [
        'exec',
        '-i',
        containerName,
        'psql',
        '-X',
        '-A',
        '-t',
        '-F',
        '|',
        '-v',
        'ON_ERROR_STOP=1',
        '-U',
        'postgres',
        '-d',
        database,
      ],
      { cwd: root, encoding: 'utf8' },
    )
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', rejectPromise)
    child.on('close', (code) => {
      if (code !== 0) {
        rejectPromise(
          new Error(`concurrent initializer exited ${code}\n${stderr || stdout}`),
        )
        return
      }
      resolvePromise(stdout.trim())
    })
    child.stdin.end(sql)
  })
}

async function testConcurrentInitialization(database) {
  psql(
    database,
    `
      insert into auth.users (id)
      values ('41000000-0000-4000-8000-000000000002')
      on conflict (id) do nothing;
    `,
    'concurrent auth fixture',
  )

  const capabilityExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  const payload = {
    user_id: '41000000-0000-4000-8000-000000000002',
    environment: 'sandbox',
    order_no: 'PO-SANDBOX-CONCURRENT-1',
    merchant_order_no: 'LP_SANDBOX_CONCURRENT_1',
    customer_name: null,
    customer_email: null,
    customer_phone: null,
    note: null,
    items: [
      {
        product_slug: 'sandbox-concurrent-item',
        product_name: 'Sandbox concurrent item',
        unit_price_twd: 100,
        quantity: 1,
        product_snapshot: {
          slug: 'sandbox-concurrent-item',
          name: 'Sandbox concurrent item',
          category: '符咒商品',
          priceTwd: 100,
        },
      },
    ],
    shipping_info: {
      recipient_name: null,
      recipient_phone: null,
      recipient_email: null,
      shipping_method: 'manual',
      postal_code: null,
      address: null,
      store_type: null,
      store_id: null,
      store_name: null,
      store_address: null,
      store_phone: null,
    },
    idempotency_key: 'sandbox-concurrent-idempotency-0001',
    request_body_sha256: '1'.repeat(64),
    confirm_token_hash: '2'.repeat(64),
    cancel_token_hash: '3'.repeat(64),
    capability_expires_at: capabilityExpiresAt,
  }
  const payloadLiteral = JSON.stringify(payload).replaceAll("'", "''")
  const statement = `
    set role service_role;
    select
      result_code,
      product_order_id,
      payment_id,
      attempt_id,
      outbox_id,
      confirm_capability_id,
      cancel_capability_id
    from public.initialize_product_order_line_pay_checkout(
      '${payloadLiteral}'::jsonb
    );
  `
  const outputs = await Promise.all([
    runPsqlAsync(database, statement),
    runPsqlAsync(database, statement),
  ])
  const rows = outputs.map((output) => {
    const resultLine = output.trim().split('\n').at(-1)
    return resultLine ? resultLine.split('|') : []
  })
  const resultCodes = rows.map((row) => row[0]).sort()

  if (
    resultCodes[0] !== 'already_initialized'
    || resultCodes[1] !== 'initialized'
  ) {
    throw new Error(
      `concurrent initializer result codes were not idempotent: ${JSON.stringify(resultCodes)}`,
    )
  }

  if (
    rows[0].length !== 7
    || rows[1].length !== 7
    || rows[0].slice(1).some((value, index) => value !== rows[1][index + 1])
  ) {
    throw new Error('concurrent initializer returned different aggregate ids')
  }

  psql(
    database,
    `
      do $$
      begin
        if (
          select pg_catalog.count(*)
          from public.product_orders
          where order_no = 'PO-SANDBOX-CONCURRENT-1'
        ) <> 1
        or (
          select pg_catalog.count(*)
          from public.payments
          where merchant_order_no = 'LP_SANDBOX_CONCURRENT_1'
        ) <> 1
        or (
          select pg_catalog.count(*)
          from public.line_pay_checkout_attempts
          where idempotency_key = 'sandbox-concurrent-idempotency-0001'
        ) <> 1
        or (
          select pg_catalog.count(*)
          from public.line_pay_request_outbox
          where idempotency_key = 'sandbox-concurrent-idempotency-0001'
        ) <> 1
        or (
          select pg_catalog.count(*)
          from public.line_pay_payment_audit_events
          where checkout_attempt_id = (
            select id
            from public.line_pay_checkout_attempts
            where idempotency_key = 'sandbox-concurrent-idempotency-0001'
          )
            and event_type = 'checkout_initialized'
        ) <> 1 then
          raise exception 'concurrent_initializer_created_duplicate_aggregate';
        end if;
      end
      $$;
    `,
    'concurrent aggregate count assertions',
  )
}

async function main() {
  runDocker(['pull', image])

  const repositoryDigests = JSON.parse(
    runDocker(['image', 'inspect', '--format', '{{json .RepoDigests}}', image]),
  )
  if (
    !Array.isArray(repositoryDigests)
    || !repositoryDigests.includes(LINE_PAY_POSTGRES_IMAGE)
  ) {
    throw new Error('POSTGRES_IMAGE_REPOSITORY_DIGEST_MISMATCH')
  }

  const postgresVersion = runDocker([
    'run',
    '--rm',
    '--network',
    'none',
    image,
    'postgres',
    '--version',
  ])
  if (!/^postgres \(PostgreSQL\) 17(?:\.|$)/.test(postgresVersion)) {
    throw new Error(`POSTGRES_IMAGE_MAJOR_VERSION_MISMATCH: ${postgresVersion}`)
  }

  runDocker(['volume', 'create', '--label', `task=${taskLabel}`, volumeName])
  runDocker([
    'network',
    'create',
    '--driver',
    'bridge',
    '--internal',
    '--label',
    `task=${taskLabel}`,
    networkName,
  ])
  runDocker([
    'run',
    '--detach',
    '--rm',
    '--name',
    containerName,
    '--label',
    `task=${taskLabel}`,
    '--network',
    networkName,
    '--mount',
    `type=volume,src=${volumeName},dst=/var/lib/postgresql/data`,
    '--env',
    `POSTGRES_PASSWORD=${localPostgresPassword}`,
    image,
  ])

  waitForPostgres(containerName)

  psql(
    'postgres',
    'create database line_pay_initialization_contract;',
    'create contract database',
  )
  psql(
    'postgres',
    'create database line_pay_initialization_concurrent;',
    'create concurrency database',
  )
  psql(
    'postgres',
    'create database line_pay_initialization_migration_rollback;',
    'create migration rollback database',
  )
  psql(
    'postgres',
    'create database line_pay_initialization_payload_mutation;',
    'create payload mutation database',
  )
  psql(
    'postgres',
    'create database line_pay_initialization_reviewed_recovery;',
    'create reviewed recovery database',
  )

  prepareDatabase('line_pay_initialization_contract')
  psqlFile(
    'line_pay_initialization_contract',
    'supabase/tests/line_pay_checkout_aggregate_initialization.sql',
  )
  testReviewedRecoveryRequiresFailForward(
    'line_pay_initialization_contract',
  )
  for (const role of ['public_probe', 'anon', 'authenticated']) {
    psqlExpectDenied(
      'line_pay_initialization_contract',
      role,
      `${role} initializer RPC guard`,
    )
  }

  prepareDatabase('line_pay_initialization_concurrent')
  await testConcurrentInitialization('line_pay_initialization_concurrent')
  testMigrationLateFailureRollback(
    'line_pay_initialization_migration_rollback',
  )
  testPayloadLimitMutationSensitivity(
    'line_pay_initialization_payload_mutation',
  )
  testReviewedRecovery('line_pay_initialization_reviewed_recovery')
  testHostedNonSuperuserUpgrade()

  process.stdout.write(
    'line_pay_checkout_aggregate_initialization: PASS (PostgreSQL 17, atomic migration, hosted non-superuser upgrade, atomic aggregate, replay, concurrency, rollback, reviewed recovery, fail-forward guard, ACL, payload-size mutation caught)\n',
  )
}

try {
  await main()
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  )
  process.exitCode = 1
} finally {
  spawnSync('docker', ['rm', '--force', hostedContainerName], {
    encoding: 'utf8',
  })
  spawnSync('docker', ['rm', '--force', containerName], { encoding: 'utf8' })
  spawnSync('docker', ['volume', 'rm', volumeName], { encoding: 'utf8' })
  spawnSync('docker', ['network', 'rm', networkName], { encoding: 'utf8' })
}
