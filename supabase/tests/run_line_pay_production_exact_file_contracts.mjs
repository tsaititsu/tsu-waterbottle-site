import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { LINE_PAY_POSTGRES_IMAGE } from './line_pay_postgres_image.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDirectory, '../..')
const taskLabel = 'line-pay-production-exact-file-runner'
const suffix = randomBytes(6).toString('hex')
const containerName = `${taskLabel}-${suffix}`
const networkName = `${containerName}-network`
const volumeName = `${containerName}-data`
const password = randomBytes(32).toString('base64url')
const image = LINE_PAY_POSTGRES_IMAGE
const migrationPath = join(
  root,
  'supabase/migrations/20260719033404_line_pay_remediation_contracts.sql',
)
const fencePath = join(
  root,
  'supabase/migrations/20260722065311_retire_bank_transfer_submissions_writes.sql',
)
const preflightPath = join(
  root,
  'supabase/deployment/line_pay_remediation_preflight.sql',
)
const postflightPath = join(
  root,
  'supabase/deployment/line_pay_remediation_postflight.sql',
)
const baselineFiles = [
  'supabase/schema.sql',
  'supabase/bank_transfer_submissions_patch.sql',
  'supabase/newebpay_payments_patch.sql',
  'supabase/payments_service_role_grants.sql',
  'supabase/product_orders_schema_draft.sql',
  'supabase/migrations/20260707_line_pay_provider_schema_draft.sql',
  'supabase/tests/line_pay_upgrade_fixture.sql',
]

function runDocker(args, options = {}) {
  const result = spawnSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
    ...options,
  })
  if (result.error?.code === 'ENOENT') {
    throw new Error('LOCAL_DB_RUNTIME_UNAVAILABLE')
  }
  if (result.status !== 0) {
    throw new Error(
      `LOCAL_DB_COMMAND_FAILED:${args[0]}:${result.status}\n${
        result.stderr || result.stdout
      }`,
    )
  }
  return result.stdout.trim()
}

function psql(
  database,
  sql,
  label,
  expectFailure = false,
  quiet = false,
) {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      containerName,
      'psql',
      '-X',
      ...(quiet ? ['--quiet'] : []),
      '--set=ON_ERROR_STOP=1',
      '--no-align',
      '--tuples-only',
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
  if (expectFailure) {
    if (result.status === 0) {
      throw new Error(`${label}:EXPECTED_FAILURE_MISSING`)
    }
    return ''
  }
  if (result.status !== 0) {
    throw new Error(`${label}:FAILED\n${result.stderr || result.stdout}`)
  }
  return result.stdout.trim()
}

function psqlFile(database, relativePath, label = relativePath) {
  psql(database, readFileSync(join(root, relativePath), 'utf8'), label)
}

function prepareBaseline(database) {
  psqlFile(database, 'supabase/tests/line_pay_local_postgres_bootstrap.sql')
  for (const file of baselineFiles) psqlFile(database, file)
  psql(
    database,
    `
      insert into auth.users (id) values
        ('10000000-0000-4000-8000-000000000011'),
        ('10000000-0000-4000-8000-000000000012')
      on conflict (id) do nothing;

      insert into public.bank_transfer_submissions (
        id, user_id, item_type, item_id, item_name, amount_twd,
        payer_name, payer_phone, payer_email, bank_account_last5,
        transfer_time, note, status, created_at
      ) values
        (
          '21000000-0000-4000-8000-000000000001',
          '10000000-0000-4000-8000-000000000011',
          'synthetic', 'fixture-1', 'Synthetic fixture 1', 100,
          'Synthetic User', '0000000000', 'one@example.invalid', '00001',
          '2026-07-01 00:00:00+00', 'synthetic', 'pending_review',
          '2026-07-01 00:00:00+00'
        ),
        (
          '21000000-0000-4000-8000-000000000002',
          '10000000-0000-4000-8000-000000000011',
          'synthetic', 'fixture-2', 'Synthetic fixture 2', 200,
          'Synthetic User', '0000000000', 'two@example.invalid', '00002',
          '2026-07-02 00:00:00+00', 'synthetic', 'pending_review',
          '2026-07-02 00:00:00+00'
        ),
        (
          '21000000-0000-4000-8000-000000000003',
          '10000000-0000-4000-8000-000000000012',
          'synthetic', 'fixture-3', 'Synthetic fixture 3', 300,
          'Synthetic User', '0000000000', 'three@example.invalid', '00003',
          '2026-07-03 00:00:00+00', 'synthetic', 'pending_review',
          '2026-07-03 00:00:00+00'
        );
    `,
    'synthetic bank transfer fixtures',
  )
  psql(database, readFileSync(fencePath, 'utf8'), 'read-only fence')
}

function readFingerprints(database, afterMigration) {
  const paymentExpression = afterMigration
    ? `(to_jsonb(row_value) - array[
        'updated_at',
        'product_order_id','environment','checkout_attempt_id','request_state',
        'request_idempotency_key','request_body_sha256',
        'line_pay_transaction_id','reconciliation_required','state_version'
      ])`
    : `(to_jsonb(row_value) - 'updated_at')`
  const orderExpression = afterMigration
    ? `(to_jsonb(row_value) - array[
        'environment','fulfillment_mode','sandbox_test','currency',
        'checkout_attempt_id','payment_request_state',
        'reconciliation_required','state_version'
      ])`
    : 'to_jsonb(row_value)'
  const output = psql(
    database,
    `
      with
      bank_transfer as (
        select
          count(*)::integer as rows,
          count(*) filter (where status = 'pending_review')::integer as pending_review,
          encode(sha256(convert_to(coalesce(string_agg(id::text, E'\\n' order by id), ''), 'UTF8')), 'hex') as pk_digest,
          encode(sha256(convert_to(coalesce(string_agg(to_jsonb(row_value)::text, E'\\n' order by id), ''), 'UTF8')), 'hex') as content_digest
        from public.bank_transfer_submissions as row_value
      ),
      payments as (
        select
          count(*)::integer as rows,
          encode(sha256(convert_to(coalesce(string_agg(id::text, E'\\n' order by id), ''), 'UTF8')), 'hex') as pk_digest,
          encode(sha256(convert_to(coalesce(string_agg(${paymentExpression}::text, E'\\n' order by id), ''), 'UTF8')), 'hex') as content_digest
        from public.payments as row_value
      ),
      product_orders as (
        select
          count(*)::integer as rows,
          encode(sha256(convert_to(coalesce(string_agg(id::text, E'\\n' order by id), ''), 'UTF8')), 'hex') as pk_digest,
          encode(sha256(convert_to(coalesce(string_agg(${orderExpression}::text, E'\\n' order by id), ''), 'UTF8')), 'hex') as content_digest
        from public.product_orders as row_value
      )
      select jsonb_build_object(
        'bank_transfer', (select to_jsonb(row_value) from bank_transfer as row_value),
        'payments', (select to_jsonb(row_value) from payments as row_value),
        'product_orders', (select to_jsonb(row_value) from product_orders as row_value)
      );
    `,
    'fixture fingerprints',
  )
  return JSON.parse(output)
}

const productionFingerprints = {
  bank_transfer: {
    rows: 3,
    pending_review: 3,
    pk_digest:
      'e6a67042ff04db27bea56f76d9d983e6762ba4122e67fe54c30d740e458f5fec',
    content_digest:
      'e87a8425def35ac99bb054b4b2e0fee3efe985d5b3376ab6011d30e730c3bc40',
  },
  payments: {
    rows: 18,
    pk_digest:
      'bc3bd47469b3d4c199be57d54c18195f9869d9b1c94527fee445d8cf83f2fa79',
    content_digest:
      'da6b440446bde8d5816f06a610baba34140a21dbd9d58e9c8ffbc0867395d1ab',
  },
  product_orders: {
    rows: 5,
    pk_digest:
      '5b2aa41738c901750a2bb752ce23f7e18743631e941476e84a86336e874b55cd',
    content_digest:
      'eb133b3808572d8ae76829ba87edc33ae04725609cd1d82e3e1a2db0d502f853',
  },
}

function useFixtureContract(source, fixture, database) {
  let output = source.replace(
    '{"name":"postgres","major":17,"recovery":false}',
    `{"name":"${database}","major":17,"recovery":false}`,
  )
  for (const table of Object.keys(productionFingerprints)) {
    for (const key of Object.keys(productionFingerprints[table])) {
      output = output.replaceAll(
        `"${key}":${
          typeof productionFingerprints[table][key] === 'number'
            ? productionFingerprints[table][key]
            : `"${productionFingerprints[table][key]}"`
        }`,
        `"${key}":${
          typeof fixture[table][key] === 'number'
            ? fixture[table][key]
            : `"${fixture[table][key]}"`
        }`,
      )
    }
  }
  return output
}

function assertAuditStatus(output, expected, expectedHistorical) {
  const rows = output.split(/\r?\n/u).filter(Boolean)
  if (rows.length !== 1) throw new Error('AUDIT_OUTPUT_ROW_COUNT_INVALID')
  const result = JSON.parse(rows[0])
  if (result.status !== expected) {
    throw new Error(
      `AUDIT_STATUS_MISMATCH:${result.status}:${JSON.stringify({
        database: result.database,
        line_pay: result.line_pay,
        fence: result.fence,
        historical: result.historical,
        expectedHistorical,
        locks: result.locks,
        migration_history: result.migration_history,
      })}`,
    )
  }
  return result
}

function assertAuditFailureStatus(output, expected) {
  const rows = output.split(/\r?\n/u).filter(Boolean)
  if (rows.length !== 1) throw new Error('AUDIT_OUTPUT_ROW_COUNT_INVALID')
  const result = JSON.parse(rows[0])
  if (result.status !== expected) {
    throw new Error(
      `AUDIT_FAILURE_STATUS_MISMATCH:${expected}:${result.status}`,
    )
  }
}

function assertNoLinePayObjects(database) {
  const output = psql(
    database,
    `
      select jsonb_build_object(
        'relations', (
          select count(*)
          from pg_class as relation
          join pg_namespace as namespace on namespace.oid = relation.relnamespace
          where (namespace.nspname, relation.relname) in (
            ('public', 'app_environment_attestation'),
            ('public', 'line_pay_checkout_attempts'),
            ('public', 'line_pay_request_outbox'),
            ('public', 'line_pay_callback_capabilities'),
            ('public', 'line_pay_callback_events'),
            ('public', 'line_pay_payment_audit_events'),
            ('line_pay_private', 'line_pay_completion_proofs')
          )
        ),
        'roles', (
          select count(*)
          from pg_roles
          where rolname in (
            'line_pay_payment_executor',
            'line_pay_payment_function_owner'
          )
        )
      );
    `,
    'rollback inventory',
  )
  const result = JSON.parse(output)
  if (result.relations !== 0 || result.roles !== 0) {
    throw new Error(
      `MIGRATION_ROLLBACK_INCOMPLETE:relations=${result.relations}:roles=${result.roles}`,
    )
  }
}

function readLinePayFunctionMetadata(database) {
  return JSON.parse(
    psql(
      database,
      `
        select jsonb_agg(to_jsonb(row_value) order by schema_name, function_name, argument_types)
        from (
          select
            namespace.nspname as schema_name,
            procedure.proname as function_name,
            pg_catalog.oidvectortypes(procedure.proargtypes) as argument_types,
            pg_catalog.format_type(procedure.prorettype, null) as return_type,
            language.lanname as language_name,
            owner.rolname as owner_name,
            procedure.prosecdef as security_definer,
            procedure.provolatile as volatility,
            procedure.proparallel as parallel_safety,
            procedure.proleakproof as leakproof,
            procedure.proconfig as configuration,
            procedure.proacl::text as raw_acl
          from pg_catalog.pg_proc as procedure
          join pg_catalog.pg_namespace as namespace
            on namespace.oid = procedure.pronamespace
          join pg_catalog.pg_language as language
            on language.oid = procedure.prolang
          join pg_catalog.pg_roles as owner on owner.oid = procedure.proowner
          where procedure.proname in (
            'line_pay_sanitized_result_is_valid',
            'line_pay_audit_evidence_is_valid',
            'line_pay_touch_updated_at',
            'line_pay_enforce_attempt_transition',
            'line_pay_enforce_payment_transition',
            'line_pay_enforce_product_order_transition',
            'line_pay_enforce_outbox_transition',
            'line_pay_enforce_callback_capability_transition',
            'line_pay_enforce_callback_event_transition',
            'claim_product_order_line_pay_request',
            'record_product_order_line_pay_request_success',
            'record_product_order_line_pay_request_failure',
            'mark_product_order_line_pay_request_unknown',
            'read_product_order_line_pay_request_result',
            'claim_line_pay_callback_capability',
            'claim_product_order_line_pay_confirmation',
            'record_product_order_line_pay_confirmation_evidence',
            'complete_product_order_line_pay_confirmation',
            'cancel_product_order_line_pay_payment',
            'mark_product_order_line_pay_reconciliation',
            'line_pay_enforce_completion_proof'
          )
        ) as row_value;
      `,
      'function metadata diagnostics',
    ),
  )
}

function cleanup() {
  spawnSync('docker', ['rm', '--force', containerName], {
    cwd: root,
    encoding: 'utf8',
  })
  spawnSync('docker', ['volume', 'rm', volumeName], {
    cwd: root,
    encoding: 'utf8',
  })
  spawnSync('docker', ['network', 'rm', networkName], {
    cwd: root,
    encoding: 'utf8',
  })
}

async function main() {
  const localImage = spawnSync('docker', ['image', 'inspect', image], {
    cwd: root,
    encoding: 'utf8',
  })
  if (localImage.status !== 0) runDocker(['pull', image])
  const digests = JSON.parse(
    runDocker(['image', 'inspect', '--format', '{{json .RepoDigests}}', image]),
  )
  if (!Array.isArray(digests) || !digests.includes(image)) {
    throw new Error('POSTGRES_IMAGE_REPOSITORY_DIGEST_MISMATCH')
  }
  runDocker(['network', 'create', '--label', `task=${taskLabel}`, networkName])
  runDocker(['volume', 'create', '--label', `task=${taskLabel}`, volumeName])
  runDocker([
    'run',
    '--detach',
    '--name',
    containerName,
    '--network',
    networkName,
    '--label',
    `task=${taskLabel}`,
    '--env',
    `POSTGRES_PASSWORD=${password}`,
    '--mount',
    `type=volume,source=${volumeName},target=/var/lib/postgresql/data`,
    image,
  ])
  let consecutiveReadyChecks = 0
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const ready = spawnSync(
      'docker',
      [
        'exec',
        containerName,
        'psql',
        '-X',
        '--set=ON_ERROR_STOP=1',
        '--no-align',
        '--tuples-only',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '--command=select 1;',
      ],
      { cwd: root, encoding: 'utf8' },
    )
    consecutiveReadyChecks =
      ready.status === 0 && ready.stdout.trim() === '1'
        ? consecutiveReadyChecks + 1
        : 0
    if (consecutiveReadyChecks >= 2) break
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250))
    if (attempt === 59) throw new Error('POSTGRES_READINESS_TIMEOUT')
  }
  const version = runDocker([
    'exec',
    containerName,
    'postgres',
    '--version',
  ])
  if (!/^postgres \(PostgreSQL\) 17(?:[.]|$)/u.test(version)) {
    throw new Error('POSTGRES_MAJOR_VERSION_MISMATCH')
  }

  psql('postgres', 'create database exact_file_success;', 'create success db')
  psql('postgres', 'create database exact_file_rollback;', 'create rollback db')

  prepareBaseline('exact_file_rollback')
  psql(
    'exact_file_rollback',
    `
      alter table public.product_orders
        drop constraint product_orders_payment_method_check;
      alter table public.product_orders
        add constraint product_orders_payment_method_check unique (id);
    `,
    'conflicting constraint fixture',
  )
  psql(
    'exact_file_rollback',
    readFileSync(migrationPath, 'utf8'),
    'rollback mutation',
    true,
  )
  assertNoLinePayObjects('exact_file_rollback')

  prepareBaseline('exact_file_success')
  const before = readFingerprints('exact_file_success', false)
  const preflight = useFixtureContract(
    readFileSync(preflightPath, 'utf8'),
    before,
    'exact_file_success',
  )
  assertAuditStatus(
    psql('exact_file_success', preflight, 'read-only preflight'),
    'READY_EXPECTED',
    before,
  )
  const preflightMutations = [
    {
      label: 'partial private schema',
      status: 'PARTIAL_APPLICATION',
      apply: 'create schema line_pay_private;',
    },
    {
      label: 'partial dedicated role',
      status: 'PARTIAL_APPLICATION',
      apply: 'create role line_pay_payment_executor nologin;',
    },
    {
      label: 'partial expected relation',
      status: 'PARTIAL_APPLICATION',
      apply: 'create table public.line_pay_request_outbox (id integer);',
    },
    {
      label: 'partial added column',
      status: 'PARTIAL_APPLICATION',
      apply: 'alter table public.payments add column environment text;',
    },
    {
      label: 'partial index',
      status: 'PARTIAL_APPLICATION',
      apply: 'create index line_pay_partial_index on public.payments (id);',
    },
    {
      label: 'migration history drift',
      status: 'SCHEMA_DRIFT',
      apply:
        'create schema supabase_migrations; create table supabase_migrations.schema_migrations (version text);',
    },
    {
      label: 'Fence ACL drift',
      status: 'FENCE_REGRESSION',
      apply:
        'grant insert on table public.bank_transfer_submissions to authenticated;',
    },
    {
      label: 'historical data drift',
      status: 'PRODUCTION_DATA_DRIFT',
      apply:
        "update public.payments set item_name = 'synthetic drift' where id = '20000000-0000-4000-8000-000000000001';",
    },
  ]
  for (const mutation of preflightMutations) {
    assertAuditFailureStatus(
      psql(
        'exact_file_success',
        `begin;\n${mutation.apply}\n${preflight}\nrollback;`,
        `${mutation.label} preflight`,
        false,
        true,
      ),
      mutation.status,
    )
    assertAuditStatus(
      psql(
        'exact_file_success',
        preflight,
        `${mutation.label} restored preflight`,
      ),
      'READY_EXPECTED',
      before,
    )
  }
  psql(
    'exact_file_success',
    readFileSync(migrationPath, 'utf8'),
    'exact LINE Pay Migration',
  )
  const after = readFingerprints('exact_file_success', true)
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    const changedFields = Object.keys(before).flatMap((table) =>
      Object.keys(before[table])
        .filter((key) => before[table][key] !== after[table][key])
        .map((key) => `${table}.${key}`),
    )
    throw new Error(
      `EXISTING_DATA_FINGERPRINT_CHANGED:${changedFields.join(',')}`,
    )
  }
  assertAuditFailureStatus(
    psql(
      'exact_file_success',
      preflight,
      'already-applied preflight',
    ),
    'ALREADY_APPLIED',
  )
  const postflight = useFixtureContract(
    readFileSync(postflightPath, 'utf8'),
    after,
    'exact_file_success',
  )
  const postflightOutput = psql(
    'exact_file_success',
    postflight,
    'read-only postflight',
  )
  const parsedPostflight = JSON.parse(postflightOutput)
  if (parsedPostflight.line_pay?.functions_exact === false) {
    throw new Error(
      `FUNCTION_CONTRACT_MISMATCH:${JSON.stringify(
        readLinePayFunctionMetadata('exact_file_success'),
      )}`,
    )
  }
  const postflightResult = assertAuditStatus(
    postflightOutput,
    'DATABASE_CONTRACTS_READY_RUNTIME_DISABLED',
    after,
  )
  if (
    Object.values(postflightResult.line_pay.new_relation_rows).some(
      (count) => count !== 0,
    )
  ) {
    throw new Error('NEW_LINE_PAY_RELATION_NOT_EMPTY')
  }

  const catalogMutations = [
    {
      label: 'function metadata',
      apply:
        'alter function public.line_pay_sanitized_result_is_valid(jsonb) parallel unsafe;',
      restore:
        'alter function public.line_pay_sanitized_result_is_valid(jsonb) parallel safe;',
    },
    {
      label: 'column default',
      apply:
        'alter table public.line_pay_checkout_attempts alter column request_state drop default;',
      restore:
        "alter table public.line_pay_checkout_attempts alter column request_state set default 'initialized';",
    },
    {
      label: 'constraint inventory',
      apply:
        'alter table public.line_pay_checkout_attempts add constraint line_pay_unreviewed_contract check (true);',
      restore:
        'alter table public.line_pay_checkout_attempts drop constraint line_pay_unreviewed_contract;',
    },
    {
      label: 'index inventory',
      apply:
        'create index line_pay_unreviewed_index on public.line_pay_checkout_attempts (created_at);',
      restore: 'drop index public.line_pay_unreviewed_index;',
    },
    {
      label: 'trigger metadata',
      apply:
        'alter table public.line_pay_checkout_attempts disable trigger line_pay_checkout_attempts_transition_guard;',
      restore:
        'alter table public.line_pay_checkout_attempts enable trigger line_pay_checkout_attempts_transition_guard;',
    },
    {
      label: 'policy metadata',
      apply:
        'alter policy line_pay_payment_function_owner_payments_select on public.payments to public;',
      restore:
        'alter policy line_pay_payment_function_owner_payments_select on public.payments to line_pay_payment_function_owner;',
    },
    {
      label: 'role metadata',
      apply: 'alter role line_pay_payment_executor inherit;',
      restore: 'alter role line_pay_payment_executor noinherit;',
    },
    {
      label: 'relation ACL',
      apply:
        'grant select on table public.line_pay_checkout_attempts to public;',
      restore:
        'revoke select on table public.line_pay_checkout_attempts from public;',
    },
    {
      label: 'schema ACL',
      apply: 'grant usage on schema line_pay_private to public;',
      restore: 'revoke usage on schema line_pay_private from public;',
    },
    {
      label: 'relation comment',
      apply:
        "comment on table public.line_pay_checkout_attempts is 'synthetic catalog drift';",
      restore:
        'comment on table public.line_pay_checkout_attempts is null;',
    },
  ]
  for (const mutation of catalogMutations) {
    psql(
      'exact_file_success',
      mutation.apply,
      `${mutation.label} mutation`,
    )
    assertAuditFailureStatus(
      psql(
        'exact_file_success',
        postflight,
        `${mutation.label} postflight`,
      ),
      'POSTFLIGHT_CONTRACT_FAILED',
    )
    psql(
      'exact_file_success',
      mutation.restore,
      `${mutation.label} restore`,
    )
    assertAuditStatus(
      psql(
        'exact_file_success',
        postflight,
        `${mutation.label} restored postflight`,
      ),
      'DATABASE_CONTRACTS_READY_RUNTIME_DISABLED',
      after,
    )
  }

  process.stdout.write(
    'line_pay_production_exact_file_contracts: PASS ' +
      '(PostgreSQL 17, preflight, exact Migration, postflight, ' +
      'catalog mutations, rollback, cleanup)\n',
  )
}

try {
  await main()
} finally {
  cleanup()
}
