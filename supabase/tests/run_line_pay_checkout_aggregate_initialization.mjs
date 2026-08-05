import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LINE_PAY_POSTGRES_IMAGE } from './line_pay_postgres_image.mjs'
import { inspectDeployOutput } from '../../scripts/supabase/run-line-pay-production-exact-file.mjs'
import { parseDeployOutput as parseServiceCheckoutDeployOutput } from '../../scripts/supabase/validate-service-line-pay-checkout-production.mjs'

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
const serviceCheckoutMigration = join(
  root,
  'supabase/migrations/20260805025344_initialize_service_line_pay_checkout.sql',
)
const productOrderOneDollarEntryTestMigration = join(
  root,
  'supabase/migrations/20260805125532_initialize_product_order_line_pay_one_dollar_entry_test_checkout.sql',
)
const serviceCheckoutPreflight = join(
  root,
  'supabase/deployment/service_line_pay_checkout_initialization_preflight.sql',
)
const serviceCheckoutPostflight = join(
  root,
  'supabase/deployment/service_line_pay_checkout_initialization_postflight.sql',
)
const initializationRecovery = join(
  root,
  'supabase/deployment/line_pay_checkout_aggregate_initialization_recovery.sql',
)
const initializationApplicationState = join(
  root,
  'supabase/deployment/line_pay_checkout_aggregate_initialization_application_state.sql',
)
const initializationContractDetail = join(
  root,
  'supabase/deployment/line_pay_checkout_initializer_contract_detail_diagnostic.sql',
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

function psqlWorkspaceFile(database, path, label = path) {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      '--workdir',
      '/workspace/supabase/deployment',
      containerName,
      'psql',
      '-X',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      database,
      '-f',
      `/workspace/${path}`,
    ],
    { cwd: root, encoding: 'utf8' },
  )

  if (result.status !== 0) {
    throw new Error(`${label} failed\n${result.stderr || result.stdout}`)
  }
  return result.stdout.trim()
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
    const finalProcess = spawnSync(
      'docker',
      ['exec', container, 'cat', '/proc/1/comm'],
      { encoding: 'utf8' },
    )
    if (
      finalProcess.status !== 0
      || finalProcess.stdout.trim() !== 'postgres'
    ) {
      readyChecks = 0
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250)
      continue
    }

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

function testReviewedRecoveryRejectsDefinitionDrift(database) {
  psqlFile(database, 'supabase/tests/line_pay_local_postgres_bootstrap.sql')
  for (const file of baselineFiles) psqlFile(database, file)
  psqlFile(database, baseMigration)
  psqlFile(database, initializationMigration)
  psql(
    database,
    `
      alter function public.initialize_product_order_line_pay_checkout(jsonb)
      stable;
    `,
    'reviewed recovery definition drift fixture',
  )

  const recoveryOutput = psqlAsInContainer(
    containerName,
    database,
    'postgres',
    readFileSync(initializationRecovery, 'utf8'),
    'reviewed recovery after definition drift',
    true,
  )
  if (
    !recoveryOutput.includes(
      'line_pay_initialization_recovery_state_mismatch',
    )
  ) {
    throw new Error(
      'reviewed recovery did not reject definition drift with the exact marker',
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
            'audit_policy_preserved',
              exists (
                select 1
                from pg_catalog.pg_policy as policy
                where policy.polname =
                  'line_pay_payment_function_owner_checkout_initialized_audit_insert'
              ),
            'items_policy_preserved',
              exists (
                select 1
                from pg_catalog.pg_policy as policy
                where policy.polname =
                  'line_pay_payment_function_owner_initialization_items_select'
              ),
            'shipping_policy_preserved',
              exists (
                select 1
                from pg_catalog.pg_policy as policy
                where policy.polname =
                  'line_pay_payment_function_owner_initialization_shipping_select'
              )
          )
        ) to stdout;
      `,
      'definition drift recovery preservation',
    ),
  )
  if (Object.values(preservedState).some((value) => value !== true)) {
    throw new Error(
      `definition drift recovery changed state: ${JSON.stringify(preservedState)}`,
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
  const migrationFailure = psqlAsInContainer(
    containerName,
    database,
    'postgres',
    mutatedMigration,
    'payload size guard mutation migration',
    true,
  )
  if (
    !migrationFailure.includes(
      'line_pay_initialization_rpc_security_postcondition_failed',
    )
  ) {
    throw new Error(
      'payload size guard mutation bypassed definition attestation',
    )
  }
}

function mutateFunctionGrantOption(migration, target) {
  const patterns = {
    initializer: {
      pattern:
        /grant execute on function public\.initialize_product_order_line_pay_checkout\(jsonb\)\s+to service_role;/i,
      replacement:
        'grant execute on function public.initialize_product_order_line_pay_checkout(jsonb)\nto service_role with grant option;',
    },
    helper: {
      pattern:
        /grant execute on function line_pay_private\.record_line_pay_checkout_initialized_audit\(\s*uuid,\s*uuid,\s*uuid,\s*text\s*\) to service_role;/i,
      replacement: `grant execute on function line_pay_private.record_line_pay_checkout_initialized_audit(
  uuid,
  uuid,
  uuid,
  text
) to service_role with grant option;`,
    },
  }
  const selected = patterns[target]
  if (!selected) throw new Error(`unknown grant-option mutation target: ${target}`)
  const mutatedMigration = migration.replace(
    selected.pattern,
    selected.replacement,
  )
  if (mutatedMigration === migration) {
    throw new Error(`${target} grant-option mutation did not change the migration`)
  }
  return mutatedMigration
}

function testMigrationRejectsGrantOption(database, target) {
  psqlFile(database, 'supabase/tests/line_pay_local_postgres_bootstrap.sql')
  for (const file of baselineFiles) psqlFile(database, file)
  psqlFile(database, baseMigration)

  const migration = readFileSync(initializationMigration, 'utf8')
  const failureOutput = psqlAsInContainer(
    containerName,
    database,
    'postgres',
    mutateFunctionGrantOption(migration, target),
    `${target} grant-option migration mutation`,
    true,
  )
  if (
    !failureOutput.includes(
      'line_pay_initialization_rpc_security_postcondition_failed',
    )
  ) {
    throw new Error(
      `${target} grant-option mutation was not rejected by the exact ACL postcondition`,
    )
  }

  const rollbackState = JSON.parse(
    psql(
      database,
      `
        copy (
          select pg_catalog.jsonb_build_object(
            'initializer_absent',
              pg_catalog.to_regprocedure(
                'public.initialize_product_order_line_pay_checkout(jsonb)'
              ) is null,
            'helper_absent',
              pg_catalog.to_regprocedure(
                'line_pay_private.record_line_pay_checkout_initialized_audit(uuid,uuid,uuid,text)'
              ) is null,
            'index_absent',
              pg_catalog.to_regclass(
                'public.line_pay_payment_audit_events_checkout_initialized_once_idx'
              ) is null
          )
        ) to stdout;
      `,
      `${target} grant-option migration rollback`,
    ),
  )
  if (Object.values(rollbackState).some((value) => value !== true)) {
    throw new Error(
      `${target} grant-option migration did not roll back atomically: ${JSON.stringify(
        rollbackState,
      )}`,
    )
  }
}

function testRecoveryRejectsGrantOption(database, target) {
  psqlFile(database, 'supabase/tests/line_pay_local_postgres_bootstrap.sql')
  for (const file of baselineFiles) psqlFile(database, file)
  psqlFile(database, baseMigration)
  psqlFile(database, initializationMigration)

  const signature =
    target === 'initializer'
      ? 'public.initialize_product_order_line_pay_checkout(jsonb)'
      : 'line_pay_private.record_line_pay_checkout_initialized_audit(uuid,uuid,uuid,text)'
  psql(
    database,
    `grant execute on function ${signature} to service_role with grant option;`,
    `${target} recovery grant-option fixture`,
  )

  const recoveryOutput = psqlAsInContainer(
    containerName,
    database,
    'postgres',
    readFileSync(initializationRecovery, 'utf8'),
    `${target} recovery grant-option mutation`,
    true,
  )
  if (
    !recoveryOutput.includes(
      'line_pay_initialization_recovery_state_mismatch',
    )
  ) {
    throw new Error(
      `${target} grant option was not rejected by the recovery precondition`,
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
            'helper_preserved',
              pg_catalog.to_regprocedure(
                'line_pay_private.record_line_pay_checkout_initialized_audit(uuid,uuid,uuid,text)'
              ) is not null,
            'index_preserved',
              pg_catalog.to_regclass(
                'public.line_pay_payment_audit_events_checkout_initialized_once_idx'
              ) is not null
          )
        ) to stdout;
      `,
      `${target} recovery grant-option preservation`,
    ),
  )
  if (Object.values(preservedState).some((value) => value !== true)) {
    throw new Error(
      `${target} grant-option recovery changed state: ${JSON.stringify(
        preservedState,
      )}`,
    )
  }
}

function mutateTableSelectGrantOption(migration) {
  const mutatedMigration = migration.replace(
    /grant select on table\s+public\.product_order_items,\s+public\.product_shipping_info\s+to line_pay_payment_function_owner;/i,
    `grant select on table
  public.product_order_items,
  public.product_shipping_info
to line_pay_payment_function_owner with grant option;`,
  )
  if (mutatedMigration === migration) {
    throw new Error('table SELECT grant-option mutation did not change the migration')
  }
  return mutatedMigration
}

function testMigrationRejectsTableSelectGrantOption(database) {
  psqlFile(database, 'supabase/tests/line_pay_local_postgres_bootstrap.sql')
  for (const file of baselineFiles) psqlFile(database, file)
  psqlFile(database, baseMigration)

  const migration = readFileSync(initializationMigration, 'utf8')
  const failureOutput = psqlAsInContainer(
    containerName,
    database,
    'postgres',
    mutateTableSelectGrantOption(migration),
    'table SELECT grant-option migration mutation',
    true,
  )
  if (
    !failureOutput.includes(
      'line_pay_initialization_rpc_security_postcondition_failed',
    )
  ) {
    throw new Error(
      'table SELECT grant-option mutation was not rejected by the exact ACL postcondition',
    )
  }

  const rollbackState = JSON.parse(
    psql(
      database,
      `
        copy (
          select pg_catalog.jsonb_build_object(
            'initializer_absent',
              pg_catalog.to_regprocedure(
                'public.initialize_product_order_line_pay_checkout(jsonb)'
              ) is null,
            'helper_absent',
              pg_catalog.to_regprocedure(
                'line_pay_private.record_line_pay_checkout_initialized_audit(uuid,uuid,uuid,text)'
              ) is null,
            'index_absent',
              pg_catalog.to_regclass(
                'public.line_pay_payment_audit_events_checkout_initialized_once_idx'
              ) is null
          )
        ) to stdout;
      `,
      'table SELECT grant-option migration rollback',
    ),
  )
  if (Object.values(rollbackState).some((value) => value !== true)) {
    throw new Error(
      `table SELECT grant-option migration did not roll back atomically: ${JSON.stringify(
        rollbackState,
      )}`,
    )
  }
}

function testRecoveryRejectsTableSelectGrantOption(database) {
  psqlFile(database, 'supabase/tests/line_pay_local_postgres_bootstrap.sql')
  for (const file of baselineFiles) psqlFile(database, file)
  psqlFile(database, baseMigration)
  psqlFile(database, initializationMigration)

  psql(
    database,
    `grant select on table
      public.product_order_items,
      public.product_shipping_info
    to line_pay_payment_function_owner with grant option;`,
    'table SELECT recovery grant-option fixture',
  )

  const recoveryOutput = psqlAsInContainer(
    containerName,
    database,
    'postgres',
    readFileSync(initializationRecovery, 'utf8'),
    'table SELECT recovery grant-option mutation',
    true,
  )
  if (
    !recoveryOutput.includes(
      'line_pay_initialization_recovery_state_mismatch',
    )
  ) {
    throw new Error(
      'table SELECT grant option was not rejected by the recovery precondition',
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
            'helper_preserved',
              pg_catalog.to_regprocedure(
                'line_pay_private.record_line_pay_checkout_initialized_audit(uuid,uuid,uuid,text)'
              ) is not null,
            'index_preserved',
              pg_catalog.to_regclass(
                'public.line_pay_payment_audit_events_checkout_initialized_once_idx'
              ) is not null
          )
        ) to stdout;
      `,
      'table SELECT recovery grant-option preservation',
    ),
  )
  if (Object.values(preservedState).some((value) => value !== true)) {
    throw new Error(
      `table SELECT grant-option recovery changed state: ${JSON.stringify(
        preservedState,
      )}`,
    )
  }
}

const auditIndexShapeMutations = Object.freeze({
  include: Object.freeze({
    clause: 'include (event_type)',
    preservedExpression: 'index_catalog.indnatts = 2',
  }),
  nulls_not_distinct: Object.freeze({
    clause: 'nulls not distinct',
    preservedExpression: 'index_catalog.indnullsnotdistinct',
  }),
})

function auditIndexShapeMutation(target) {
  const mutation = auditIndexShapeMutations[target]
  if (!mutation) throw new Error(`unknown audit index shape mutation: ${target}`)
  return mutation
}

function mutateAuditIndexShape(migration, target) {
  const mutation = auditIndexShapeMutation(target)
  const mutatedMigration = migration.replace(
    `on public.line_pay_payment_audit_events(checkout_attempt_id)
where event_type = 'checkout_initialized';`,
    `on public.line_pay_payment_audit_events(checkout_attempt_id)
${mutation.clause}
where event_type = 'checkout_initialized';`,
  )
  if (mutatedMigration === migration) {
    throw new Error(`${target} audit index mutation did not change the migration`)
  }
  return mutatedMigration
}

function testMigrationRejectsAuditIndexShape(database, target) {
  psqlFile(database, 'supabase/tests/line_pay_local_postgres_bootstrap.sql')
  for (const file of baselineFiles) psqlFile(database, file)
  psqlFile(database, baseMigration)

  const migration = readFileSync(initializationMigration, 'utf8')
  const failureOutput = psqlAsInContainer(
    containerName,
    database,
    'postgres',
    mutateAuditIndexShape(migration, target),
    `${target} audit index migration mutation`,
    true,
  )
  if (
    !failureOutput.includes(
      'line_pay_initialization_rpc_security_postcondition_failed',
    )
  ) {
    throw new Error(
      `${target} audit index mutation was not rejected by the exact catalog postcondition`,
    )
  }

  const rollbackState = JSON.parse(
    psql(
      database,
      `
        copy (
          select pg_catalog.jsonb_build_object(
            'initializer_absent',
              pg_catalog.to_regprocedure(
                'public.initialize_product_order_line_pay_checkout(jsonb)'
              ) is null,
            'helper_absent',
              pg_catalog.to_regprocedure(
                'line_pay_private.record_line_pay_checkout_initialized_audit(uuid,uuid,uuid,text)'
              ) is null,
            'index_absent',
              pg_catalog.to_regclass(
                'public.line_pay_payment_audit_events_checkout_initialized_once_idx'
              ) is null
          )
        ) to stdout;
      `,
      `${target} audit index migration rollback`,
    ),
  )
  if (Object.values(rollbackState).some((value) => value !== true)) {
    throw new Error(
      `${target} audit index migration did not roll back atomically: ${JSON.stringify(
        rollbackState,
      )}`,
    )
  }
}

function testRecoveryRejectsAuditIndexShape(database, target) {
  psqlFile(database, 'supabase/tests/line_pay_local_postgres_bootstrap.sql')
  for (const file of baselineFiles) psqlFile(database, file)
  psqlFile(database, baseMigration)
  psqlFile(database, initializationMigration)
  const mutation = auditIndexShapeMutation(target)

  psql(
    database,
    `
      drop index
        public.line_pay_payment_audit_events_checkout_initialized_once_idx;
      create unique index
        line_pay_payment_audit_events_checkout_initialized_once_idx
      on public.line_pay_payment_audit_events(checkout_attempt_id)
      ${mutation.clause}
      where event_type = 'checkout_initialized';
    `,
    `${target} audit index recovery fixture`,
  )

  const recoveryOutput = psqlAsInContainer(
    containerName,
    database,
    'postgres',
    readFileSync(initializationRecovery, 'utf8'),
    `${target} audit index recovery mutation`,
    true,
  )
  if (
    !recoveryOutput.includes(
      'line_pay_initialization_recovery_state_mismatch',
    )
  ) {
    throw new Error(
      `${target} audit index drift was not rejected by the recovery precondition`,
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
            'helper_preserved',
              pg_catalog.to_regprocedure(
                'line_pay_private.record_line_pay_checkout_initialized_audit(uuid,uuid,uuid,text)'
              ) is not null,
            'index_drift_preserved',
              coalesce((
                select ${mutation.preservedExpression}
                from pg_catalog.pg_index as index_catalog
                join pg_catalog.pg_class as index_relation
                  on index_relation.oid = index_catalog.indexrelid
                join pg_catalog.pg_namespace as index_namespace
                  on index_namespace.oid = index_relation.relnamespace
                where index_namespace.nspname = 'public'
                  and index_relation.relname =
                    'line_pay_payment_audit_events_checkout_initialized_once_idx'
              ), false)
          )
        ) to stdout;
      `,
      `${target} audit index recovery preservation`,
    ),
  )
  if (Object.values(preservedState).some((value) => value !== true)) {
    throw new Error(
      `${target} audit index recovery changed state: ${JSON.stringify(
        preservedState,
      )}`,
    )
  }
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
  psqlFileAsInContainer(
    hostedContainerName,
    database,
    executor,
    serviceCheckoutPreflight,
    'hosted service checkout preflight',
  )
  psqlFileAsInContainer(
    hostedContainerName,
    database,
    executor,
    serviceCheckoutMigration,
    'hosted service checkout migration',
  )
  psqlFileAsInContainer(
    hostedContainerName,
    database,
    executor,
    serviceCheckoutPostflight,
    'hosted service checkout postflight',
  )
  psqlAsInContainer(
    hostedContainerName,
    database,
    clusterAdmin,
    `
      grant line_pay_payment_function_owner
        to service_role with inherit true, set false;
    `,
    'add unsafe hosted runtime membership mutation',
  )
  const unsafeMembershipOutput = psqlAsInContainer(
    hostedContainerName,
    database,
    executor,
    readFileSync(serviceCheckoutPostflight, 'utf8'),
    'hosted service checkout unsafe membership postflight',
    true,
  )
  if (!unsafeMembershipOutput.includes(
    'line_pay_service_checkout_postflight_contract_failed',
  )) {
    throw new Error('unsafe hosted runtime membership was not rejected')
  }
  psqlAsInContainer(
    hostedContainerName,
    database,
    clusterAdmin,
    'revoke line_pay_payment_function_owner from service_role;',
    'remove unsafe hosted runtime membership mutation',
  )
  psqlFileAsInContainer(
    hostedContainerName,
    database,
    executor,
    serviceCheckoutPostflight,
    'hosted service checkout postflight after membership cleanup',
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
  const hostedApplicationState = JSON.parse(
    psqlFileAsInContainer(
      hostedContainerName,
      database,
      executor,
      initializationApplicationState,
      'hosted initializer application state',
    ),
  )
  const hostedContractDetail = JSON.parse(
    psqlFileAsInContainer(
      hostedContainerName,
      database,
      executor,
      initializationContractDetail,
      'hosted initializer contract detail',
    ),
  )
  if (
    hostedApplicationState.application_state !== 'FULL' ||
    !hostedApplicationState.contracts.initializer_exact ||
    !hostedContractDetail.role_contract
      .single_bootstrap_superuser_admin_only ||
    !hostedContractDetail.role_contract.function_owner_membership_safe ||
    !hostedContractDetail.decision.initializer_exact ||
    hostedContractDetail.decision.recovery_required
  ) {
    throw new Error(
      'hosted bootstrap-superuser membership was not accepted safely',
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

function startInteractivePsql(database) {
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
  let closed = false
  const completion = new Promise((resolvePromise, rejectPromise) => {
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', rejectPromise)
    child.on('close', (code) => {
      closed = true
      resolvePromise({
        code,
        stdout,
        stderr,
      })
    })
  })

  return {
    child,
    completion,
    get closed() {
      return closed
    },
    get output() {
      return `${stdout}\n${stderr}`
    },
  }
}

function wait(milliseconds) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds)
  })
}

async function waitForSessionMatch(session, pattern, label) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const match = session.output.match(pattern)
    if (match) return match
    if (session.closed) {
      throw new Error(`${label} exited before emitting its marker\n${session.output}`)
    }
    await wait(50)
  }

  throw new Error(`${label} did not emit its marker before timeout`)
}

async function waitForCompletion(session, label) {
  return Promise.race([
    session.completion,
    wait(15_000).then(() => {
      throw new Error(`${label} did not complete before timeout`)
    }),
  ])
}

async function waitForRecoveryRelationLock(
  database,
  recoveryPid,
  initializerPid,
  initializerSession,
) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const stateOutput = psql(
      database,
      `
        copy (
          select pg_catalog.jsonb_build_object(
            'waiting_on_lock',
              activity.wait_event_type = 'Lock',
            'blocked_by_recovery',
              ${recoveryPid} = any (
                pg_catalog.pg_blocking_pids(activity.pid)
              ),
            'waiting_on_recovery_relation',
              exists (
                select 1
                from pg_catalog.pg_locks as relation_lock
                where relation_lock.pid = activity.pid
                  and relation_lock.relation = any (
                    array[
                      'public.product_order_items'::regclass,
                      'public.product_shipping_info'::regclass,
                      'public.line_pay_payment_audit_events'::regclass
                    ]::oid[]
                  )
                  and relation_lock.mode = 'RowExclusiveLock'
                  and not relation_lock.granted
              )
          )
          from pg_catalog.pg_stat_activity as activity
          where activity.pid = ${initializerPid}
        ) to stdout;
      `,
      'recovery relation-lock wait evidence',
    )
    if (stateOutput) {
      const state = JSON.parse(stateOutput)
      if (Object.values(state).every((value) => value === true)) return state
    }
    if (initializerSession.closed) break
    await wait(100)
  }

  throw new Error(
    'recovery did not block the concurrent initializer on a protected relation lock',
  )
}

async function testReviewedRecoveryBlocksConcurrentInitializer(database) {
  psqlFile(database, 'supabase/tests/line_pay_local_postgres_bootstrap.sql')
  for (const file of baselineFiles) psqlFile(database, file)
  psqlFile(database, baseMigration)
  psqlFile(database, initializationMigration)
  psql(
    database,
    `
      insert into auth.users (id)
      values ('41000000-0000-4000-8000-000000000003');
    `,
    'recovery race auth fixture',
  )

  const recovery = readFileSync(initializationRecovery, 'utf8')
  const pauseMarker = '$recovery_precondition$;'
  const pauseIndex = recovery.indexOf(pauseMarker)
  if (pauseIndex < 0) {
    throw new Error('recovery race fixture could not locate the precondition boundary')
  }
  const recoveryPrefix = recovery.slice(
    0,
    pauseIndex + pauseMarker.length,
  )
  const recoveryRemainder = recovery.slice(
    pauseIndex + pauseMarker.length,
  )

  const capabilityExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  const payloadLiteral = JSON.stringify({
    user_id: '41000000-0000-4000-8000-000000000003',
    environment: 'sandbox',
    order_no: 'PO-SANDBOX-RECOVERY-RACE-1',
    merchant_order_no: 'LP_SANDBOX_RECOVERY_RACE_1',
    customer_name: null,
    customer_email: null,
    customer_phone: null,
    note: null,
    items: [
      {
        product_slug: 'sandbox-recovery-race-item',
        product_name: 'Sandbox recovery race item',
        unit_price_twd: 100,
        quantity: 1,
        product_snapshot: {
          slug: 'sandbox-recovery-race-item',
          name: 'Sandbox recovery race item',
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
    idempotency_key: 'sandbox-recovery-race-idempotency-0001',
    request_body_sha256: '4'.repeat(64),
    confirm_token_hash: '5'.repeat(64),
    cancel_token_hash: '6'.repeat(64),
    capability_expires_at: capabilityExpiresAt,
  }).replaceAll("'", "''")

  const recoverySession = startInteractivePsql(database)
  const initializerSession = startInteractivePsql(database)
  let recoveryReleased = false

  try {
    recoverySession.child.stdin.write(`
${recoveryPrefix}
select 'RECOVERY_GUARD_PAUSED', pg_catalog.pg_backend_pid();
`)
    const recoveryMatch = await waitForSessionMatch(
      recoverySession,
      /RECOVERY_GUARD_PAUSED\|([0-9]+)/,
      'recovery session',
    )
    const recoveryPid = Number(recoveryMatch[1])

    initializerSession.child.stdin.write(`
select 'INITIALIZER_STARTED', pg_catalog.pg_backend_pid();
set role service_role;
select result_code
from public.initialize_product_order_line_pay_checkout(
  '${payloadLiteral}'::jsonb
);
`)
    initializerSession.child.stdin.end()
    const initializerMatch = await waitForSessionMatch(
      initializerSession,
      /INITIALIZER_STARTED\|([0-9]+)/,
      'initializer session',
    )
    const initializerPid = Number(initializerMatch[1])

    await waitForRecoveryRelationLock(
      database,
      recoveryPid,
      initializerPid,
      initializerSession,
    )
    if (initializerSession.closed) {
      throw new Error(
        'initializer completed before the recovery transaction released its lock',
      )
    }

    recoverySession.child.stdin.write(recoveryRemainder)
    recoverySession.child.stdin.end()
    recoveryReleased = true

    const recoveryResult = await waitForCompletion(
      recoverySession,
      'recovery session',
    )
    if (recoveryResult.code !== 0) {
      throw new Error(
        `recovery session failed\n${recoveryResult.stderr || recoveryResult.stdout}`,
      )
    }

    const initializerResult = await waitForCompletion(
      initializerSession,
      'initializer session',
    )
    if (
      initializerResult.code === 0
      || !/permission denied|row-level security|does not exist/i.test(
        `${initializerResult.stdout}\n${initializerResult.stderr}`,
      )
    ) {
      throw new Error(
        `concurrent initializer did not fail closed after recovery\n${
          initializerResult.stderr || initializerResult.stdout
        }`,
      )
    }

    const finalState = JSON.parse(
      psql(
        database,
        `
          copy (
            select pg_catalog.jsonb_build_object(
              'aggregate_absent',
                not exists (
                  select 1
                  from public.line_pay_checkout_attempts as attempt
                  where attempt.idempotency_key =
                    'sandbox-recovery-race-idempotency-0001'
                ),
              'audit_absent',
                not exists (
                  select 1
                  from public.line_pay_payment_audit_events as audit
                  where audit.event_type = 'checkout_initialized'
                ),
              'initializer_absent',
                pg_catalog.to_regprocedure(
                  'public.initialize_product_order_line_pay_checkout(jsonb)'
                ) is null,
              'helper_absent',
                pg_catalog.to_regprocedure(
                  'line_pay_private.record_line_pay_checkout_initialized_audit(uuid,uuid,uuid,text)'
                ) is null
            )
          ) to stdout;
        `,
        'recovery race final state',
      ),
    )
    if (Object.values(finalState).some((value) => value !== true)) {
      throw new Error(
        `recovery race left unsafe state: ${JSON.stringify(finalState)}`,
      )
    }
  } finally {
    if (!recoveryReleased && !recoverySession.closed) {
      recoverySession.child.stdin.end('\nrollback;\n')
    }
    if (!initializerSession.closed) {
      initializerSession.child.kill('SIGTERM')
    }
    await Promise.allSettled([
      recoverySession.completion,
      initializerSession.completion,
    ])
  }
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
    '--mount',
    `type=bind,src=${root},dst=/workspace,readonly`,
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
    'create database line_pay_service_checkout_deploy;',
    'create service checkout deploy database',
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
  psql(
    'postgres',
    'create database line_pay_initialization_recovery_drift;',
    'create recovery drift database',
  )
  psql(
    'postgres',
    'create database line_pay_initialization_recovery_race;',
    'create recovery race database',
  )
  for (const target of ['initializer', 'helper']) {
    psql(
      'postgres',
      `create database line_pay_initialization_${target}_grant_mutation;`,
      `create ${target} grant mutation database`,
    )
    psql(
      'postgres',
      `create database line_pay_initialization_${target}_recovery_grant;`,
      `create ${target} recovery grant database`,
    )
  }
  psql(
    'postgres',
    'create database line_pay_initialization_table_grant_mutation;',
    'create table grant mutation database',
  )
  psql(
    'postgres',
    'create database line_pay_initialization_table_recovery_grant;',
    'create table recovery grant database',
  )
  for (const target of Object.keys(auditIndexShapeMutations)) {
    psql(
      'postgres',
      `create database line_pay_initialization_index_${target}_mutation;`,
      `create ${target} index mutation database`,
    )
    psql(
      'postgres',
      `create database line_pay_initialization_index_${target}_recovery;`,
      `create ${target} index recovery database`,
    )
  }

  prepareDatabase('line_pay_initialization_contract')
  psqlFile(
    'line_pay_initialization_contract',
    'supabase/tests/line_pay_checkout_aggregate_initialization.sql',
  )
  psqlFile('line_pay_initialization_contract', serviceCheckoutPreflight)
  psqlFile('line_pay_initialization_contract', serviceCheckoutMigration)
  psqlFile('line_pay_initialization_contract', serviceCheckoutPostflight)
  psqlFile(
    'line_pay_initialization_contract',
    'supabase/tests/service_line_pay_checkout_initialization.sql',
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
  psqlFile(
    'line_pay_initialization_contract',
    productOrderOneDollarEntryTestMigration,
  )
  psqlFile(
    'line_pay_initialization_contract',
    'supabase/tests/product_order_line_pay_one_dollar_entry_test.sql',
  )

  prepareDatabase('line_pay_initialization_concurrent')
  await testConcurrentInitialization('line_pay_initialization_concurrent')
  prepareDatabase('line_pay_service_checkout_deploy')
  const serviceDeployOutput = psqlWorkspaceFile(
    'line_pay_service_checkout_deploy',
    'supabase/deployment/service_line_pay_checkout_initialization_deploy.sql',
    'service checkout exact deployment',
  )
  const serviceDeployEvidence = inspectDeployOutput(serviceDeployOutput)
  parseServiceCheckoutDeployOutput(serviceDeployEvidence.auditOutput)
  for (const marker of [
    'LINE_PAY_DEPLOY_MIGRATION_STARTED',
    'LINE_PAY_DEPLOY_MIGRATION_COMMITTED',
    'LINE_PAY_DEPLOY_POSTFLIGHT_STARTED',
    'LINE_PAY_DEPLOY_POSTFLIGHT_STATE_EMITTED',
    'LINE_PAY_DEPLOY_POSTFLIGHT_COMMITTED',
  ]) {
    if (!serviceDeployOutput.includes(marker)) {
      throw new Error(`service checkout deployment marker missing: ${marker}`)
    }
  }
  const serviceVerifyOutput = psqlWorkspaceFile(
    'line_pay_service_checkout_deploy',
    'supabase/deployment/service_line_pay_checkout_initialization_verify.sql',
    'service checkout read-only verification',
  )
  if (serviceVerifyOutput !== 'line_pay_service_checkout_postflight_ready') {
    throw new Error('service checkout read-only verification output invalid')
  }
  psqlFile(
    'line_pay_service_checkout_deploy',
    'supabase/tests/service_line_pay_checkout_initialization.sql',
  )
  testMigrationLateFailureRollback(
    'line_pay_initialization_migration_rollback',
  )
  testPayloadLimitMutationSensitivity(
    'line_pay_initialization_payload_mutation',
  )
  testReviewedRecovery('line_pay_initialization_reviewed_recovery')
  testReviewedRecoveryRejectsDefinitionDrift(
    'line_pay_initialization_recovery_drift',
  )
  await testReviewedRecoveryBlocksConcurrentInitializer(
    'line_pay_initialization_recovery_race',
  )
  for (const target of ['initializer', 'helper']) {
    testMigrationRejectsGrantOption(
      `line_pay_initialization_${target}_grant_mutation`,
      target,
    )
    testRecoveryRejectsGrantOption(
      `line_pay_initialization_${target}_recovery_grant`,
      target,
    )
  }
  testMigrationRejectsTableSelectGrantOption(
    'line_pay_initialization_table_grant_mutation',
  )
  testRecoveryRejectsTableSelectGrantOption(
    'line_pay_initialization_table_recovery_grant',
  )
  for (const target of Object.keys(auditIndexShapeMutations)) {
    testMigrationRejectsAuditIndexShape(
      `line_pay_initialization_index_${target}_mutation`,
      target,
    )
    testRecoveryRejectsAuditIndexShape(
      `line_pay_initialization_index_${target}_recovery`,
      target,
    )
  }
  testHostedNonSuperuserUpgrade()

  process.stdout.write(
    'line_pay_checkout_aggregate_initialization: PASS (PostgreSQL 17, atomic migration, hosted non-superuser upgrade, atomic aggregate, replay, concurrency, rollback, recovery relation-lock timeline, fail-forward guard, exact function/table ACL grant-option and index-shape mutations, audit binding drift fixtures, payload-size mutation caught)\n',
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
