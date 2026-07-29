import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  assertApplicationStateDiagnosticSql,
  assertRunnerSource,
  assertSharedRunnerSource,
  parseAndValidateDiagnosticOutput,
} from '../../scripts/supabase/validate-line-pay-application-state-diagnostic.mjs'
import { LINE_PAY_POSTGRES_IMAGE } from './line_pay_postgres_image.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDirectory, '../..')
const taskLabel = 'line-pay-application-state-diagnostic'
const suffix = randomBytes(6).toString('hex')
const containerName = `${taskLabel}-${suffix}`
const networkName = `${containerName}-network`
const volumeName = `${containerName}-data`
const password = randomBytes(32).toString('base64url')
const diagnosticPath = join(
  root,
  'supabase/deployment/line_pay_application_state_diagnostic.sql',
)
const migrationPath = join(
  root,
  'supabase/migrations/20260719033404_line_pay_remediation_contracts.sql',
)
const fencePath = join(
  root,
  'supabase/migrations/20260722065311_retire_bank_transfer_submissions_writes.sql',
)
const partialRecoveryPath = join(
  root,
  'supabase/migrations/20260729130000_line_pay_partial_acl_metadata_recovery.sql',
)
const runnerPath = join(
  root,
  'scripts/supabase/run-line-pay-application-state-diagnostic.mjs',
)
const sharedRunnerPath = join(
  root,
  'scripts/supabase/run-line-pay-production-diagnostic.mjs',
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
const fixedReadOnlyOptions =
  '-c default_transaction_read_only=on ' +
  '-c statement_timeout=120000 ' +
  '-c lock_timeout=15000 ' +
  '-c idle_in_transaction_session_timeout=30000'
const diagnosticSql = readFileSync(diagnosticPath, 'utf8')

let scenariosPassed = 0
let mutationsCaught = 0
let cleanupPassed = false

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
  sql,
  label,
  { readOnly = false, database = 'postgres' } = {},
) {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      ...(readOnly
        ? ['--env', `PGOPTIONS=${fixedReadOnlyOptions}`]
        : []),
      containerName,
      'psql',
      '-X',
      '--set=ON_ERROR_STOP=1',
      '--quiet',
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
  if (result.status !== 0) {
    throw new Error(`${label}:FAILED\n${result.stderr || result.stdout}`)
  }
  return result.stdout.trim()
}

function psqlFile(relativePath) {
  psql(
    readFileSync(join(root, relativePath), 'utf8'),
    relativePath,
  )
}

function waitForPostgres() {
  let consecutiveReadyChecks = 0
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const finalProcess = spawnSync(
      'docker',
      ['exec', containerName, 'cat', '/proc/1/comm'],
      { cwd: root, encoding: 'utf8' },
    )
    if (
      finalProcess.status !== 0
      || finalProcess.stdout.trim() !== 'postgres'
    ) {
      consecutiveReadyChecks = 0
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250)
      continue
    }

    const result = spawnSync(
      'docker',
      [
        'exec',
        containerName,
        'psql',
        '-X',
        '--no-align',
        '--tuples-only',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-c',
        'select 1',
      ],
      { cwd: root, encoding: 'utf8' },
    )
    consecutiveReadyChecks =
      result.status === 0 && result.stdout.trim() === '1'
        ? consecutiveReadyChecks + 1
        : 0
    if (consecutiveReadyChecks >= 2) return
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250)
  }
  throw new Error('POSTGRES_STABLE_READINESS_TIMEOUT')
}

function prepareBaseline() {
  psqlFile('supabase/tests/line_pay_local_postgres_bootstrap.sql')
  for (const file of baselineFiles) psqlFile(file)
  psql(
    `
      create schema supabase_migrations;
      create table supabase_migrations.schema_migrations (
        version text primary key,
        statements text[],
        name text
      );
    `,
    'migration history baseline',
  )
  psql(readFileSync(fencePath, 'utf8'), 'bank transfer fence')
}

function createDatabaseTemplate(name) {
  psql(
    `create database ${name} with template postgres owner postgres;`,
    `create ${name}`,
    { database: 'template1' },
  )
}

function restoreDatabaseFromTemplate(name) {
  psql(
    `
      drop database postgres with (force);
      create database postgres with template ${name} owner postgres;
    `,
    `restore postgres from ${name}`,
    { database: 'template1' },
  )
}

function runApplicationStateScenario(
  name,
  expectedState,
  fixtureSql = '',
  restoreTemplate = '',
  cleanupSql = '',
) {
  try {
    if (fixtureSql) psql(fixtureSql, `${name} fixture`)
    const result = parseAndValidateDiagnosticOutput(
      `${psql(diagnosticSql, name, { readOnly: true })}\n`,
    )
    assert.equal(
      result.application_state,
      expectedState,
      `${name}:${JSON.stringify(result.inventory)}`,
    )
    scenariosPassed += 1
    return result
  } finally {
    if (cleanupSql) psql(cleanupSql, `${name} fixture cleanup`)
    if (restoreTemplate) restoreDatabaseFromTemplate(restoreTemplate)
  }
}

function assertIncompleteCategories(result, expectedCategories, label) {
  assert.deepEqual(
    result.details.incomplete_categories.map((detail) => detail.category),
    expectedCategories,
    label,
  )
  for (const detail of result.details.incomplete_categories) {
    assert.equal(
      detail.count_matches && detail.metadata_matches,
      false,
      `${label}:${detail.category}:must explain an incomplete category`,
    )
  }
}

function assertDetailIdentityRows(rows, expectedIdentities, label) {
  assert.deepEqual(
    rows.map((detail) => detail.identity),
    expectedIdentities,
    label,
  )
}

function findDetailRow(rows, identity, label) {
  const row = rows.find((detail) => detail.identity === identity)
  assert.ok(row, `${label}:${identity}:missing detail row`)
  return row
}

function assertNoLinePayMigrationHistory(label) {
  const versionPresent = psql(
    `
      select exists (
        select 1
        from supabase_migrations.schema_migrations
        where version = '20260719033404'
      )::text;
    `,
    label,
  )
  assert.equal(
    versionPresent,
    'false',
    `${label}:migration history must stay empty`,
  )
}

function assertRuntimeWriteBoundary(label) {
  const boundary = psql(
    `
      select pg_catalog.jsonb_build_object(
        'payments_anon_insert',
          pg_catalog.has_table_privilege('anon', 'public.payments', 'insert'),
        'payments_authenticated_insert',
          pg_catalog.has_table_privilege(
            'authenticated',
            'public.payments',
            'insert'
          ),
        'payments_service_insert',
          pg_catalog.has_table_privilege(
            'service_role',
            'public.payments',
            'insert'
          ),
        'payments_service_update',
          pg_catalog.has_table_privilege(
            'service_role',
            'public.payments',
            'update'
          ),
        'orders_anon_insert',
          pg_catalog.has_table_privilege(
            'anon',
            'public.product_orders',
            'insert'
          ),
        'orders_authenticated_insert',
          pg_catalog.has_table_privilege(
            'authenticated',
            'public.product_orders',
            'insert'
          ),
        'orders_service_insert',
          pg_catalog.has_table_privilege(
            'service_role',
            'public.product_orders',
            'insert'
          ),
        'orders_service_update',
          pg_catalog.has_table_privilege(
            'service_role',
            'public.product_orders',
            'update'
          )
      )::text;
    `,
    label,
  )
  assert.deepEqual(JSON.parse(boundary), {
    payments_anon_insert: false,
    payments_authenticated_insert: false,
    payments_service_insert: true,
    payments_service_update: true,
    orders_anon_insert: false,
    orders_authenticated_insert: false,
    orders_service_insert: true,
    orders_service_update: true,
  })
}

function readRelationAclSnapshot(label) {
  return JSON.parse(
    psql(
      `
        select coalesce(
          pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'identity', namespace.nspname || '.' || relation.relname,
              'owner', owner.rolname,
              'acl', relation.relacl::text,
              'effective_acl',
                coalesce(
                  relation.relacl,
                  pg_catalog.acldefault('r', relation.relowner)
                )::text
            )
            order by namespace.nspname || '.' || relation.relname
          ),
          '[]'::jsonb
        )::text
        from (
          values
            ('public', 'app_environment_attestation'),
            ('public', 'line_pay_checkout_attempts'),
            ('public', 'line_pay_request_outbox'),
            ('public', 'line_pay_callback_capabilities'),
            ('public', 'line_pay_callback_events'),
            ('public', 'line_pay_payment_audit_events'),
            ('line_pay_private', 'line_pay_completion_proofs')
        ) as expected(schema_name, relation_name)
        join pg_catalog.pg_namespace as namespace
          on namespace.nspname = expected.schema_name
        join pg_catalog.pg_class as relation
          on relation.relnamespace = namespace.oid
         and relation.relname = expected.relation_name
        join pg_catalog.pg_roles as owner on owner.oid = relation.relowner;
      `,
      label,
    ),
  )
}

function catchMutation(name, callback) {
  assert.throws(callback, undefined, name)
  mutationsCaught += 1
}

function runStaticMutations() {
  const runnerSource = readFileSync(runnerPath, 'utf8')
  const sharedRunnerSource = readFileSync(sharedRunnerPath, 'utf8')
  const mutations = [
    [
      'remove read only',
      () =>
        assertApplicationStateDiagnosticSql(
          diagnosticSql.replace(
            'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;',
            'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;',
          ),
        ),
    ],
    [
      'remove rollback',
      () =>
        assertApplicationStateDiagnosticSql(
          diagnosticSql.replace('\nROLLBACK;\n', '\nCOMMIT;\n'),
        ),
    ],
    [
      'add DML',
      () =>
        assertApplicationStateDiagnosticSql(
          diagnosticSql.replace(
            '\nROLLBACK;\n',
            '\nupdate public.payments set status = status;\nROLLBACK;\n',
          ),
        ),
    ],
    [
      'omit relation',
      () =>
        assertApplicationStateDiagnosticSql(
          diagnosticSql.replace(
            "    ('public', 'line_pay_callback_events'),\n",
            '',
          ),
        ),
    ],
    [
      'omit column',
      () =>
        assertApplicationStateDiagnosticSql(
          diagnosticSql.replace(
            "    ('payments', 'line_pay_transaction_id'),\n",
            '',
          ),
        ),
    ],
    [
      'count only',
      () =>
        assertApplicationStateDiagnosticSql(
          diagnosticSql.replace(
            'and actual.digest = expected.digest',
            'and true',
          ),
        ),
    ],
    [
      'ignore history only',
      () =>
        assertApplicationStateDiagnosticSql(
          diagnosticSql.replace(
            "then 'HISTORY_ONLY'",
            "then 'INCONSISTENT'",
          ),
        ),
    ],
    [
      'partial as unapplied',
      () =>
        assertApplicationStateDiagnosticSql(
          diagnosticSql.replace("then 'PARTIAL'", "then 'UNAPPLIED'"),
        ),
    ],
    [
      'remove detail categories',
      () =>
        assertApplicationStateDiagnosticSql(
          diagnosticSql.replace(
            "'details', pg_catalog.jsonb_build_object",
            "'opaque', pg_catalog.jsonb_build_object",
          ),
        ),
    ],
    [
      'expose sensitive definition',
      () =>
        assertApplicationStateDiagnosticSql(
          diagnosticSql.replace(
            'pg_catalog.pg_get_expr(policy.polqual, policy.polrelid, false)',
            'pg_catalog.pg_get_functiondef(policy.polrelid)',
          ),
        ),
    ],
    [
      'emit raw stderr',
      () =>
        assertRunnerSource(
          `${runnerSource}\nconsole.error(raw_stderr)\n`,
        ),
    ],
    [
      'second database session',
      () =>
        assertSharedRunnerSource(
          sharedRunnerSource.replace(
            'databaseSessionExecutions += 1',
            'databaseSessionExecutions += 1\ndatabaseSessionExecutions += 1',
          ),
        ),
    ],
    [
      'add retry fallback',
      () =>
        assertRunnerSource(`${runnerSource}\nconst retry = true\n`),
    ],
  ]
  for (const [name, mutation] of mutations) {
    catchMutation(name, mutation)
  }
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
  const residualContainers = runDocker([
    'ps',
    '-aq',
    '--filter',
    `label=task=${taskLabel}`,
  ])
  const residualVolumes = runDocker([
    'volume',
    'ls',
    '-q',
    '--filter',
    `label=task=${taskLabel}`,
  ])
  const residualNetworks = runDocker([
    'network',
    'ls',
    '-q',
    '--filter',
    `label=task=${taskLabel}`,
  ])
  cleanupPassed =
    !residualContainers && !residualVolumes && !residualNetworks
  if (!cleanupPassed) throw new Error('DOCKER_CLEANUP_FAILED')
}

try {
  runDocker([
    'network',
    'create',
    '--label',
    `task=${taskLabel}`,
    networkName,
  ])
  runDocker([
    'volume',
    'create',
    '--label',
    `task=${taskLabel}`,
    volumeName,
  ])
  runDocker([
    'run',
    '--detach',
    '--name',
    containerName,
    '--network',
    networkName,
    '--label',
    `task=${taskLabel}`,
    '--mount',
    `type=volume,source=${volumeName},target=/var/lib/postgresql/data`,
    '--env',
    `POSTGRES_PASSWORD=${password}`,
    '--env',
    'POSTGRES_USER=postgres',
    '--env',
    'POSTGRES_DB=postgres',
    LINE_PAY_POSTGRES_IMAGE,
  ])
  waitForPostgres()
  assert.match(
    psql('show server_version_num;', 'PostgreSQL version'),
    /^17[0-9]{4}$/u,
  )
  prepareBaseline()
  createDatabaseTemplate('line_pay_unapplied_template')

  assertIncompleteCategories(
    runApplicationStateScenario('unapplied', 'UNAPPLIED'),
    [
      'columns',
      'constraints',
      'functions',
      'indexes',
      'policies',
      'relations',
      'roles',
      'schemas',
      'triggers',
    ],
    'unapplied details',
  )
  assertIncompleteCategories(
    runApplicationStateScenario(
      'one relation',
      'PARTIAL',
      'create table public.app_environment_attestation (id integer);',
      'line_pay_unapplied_template',
    ),
    [
      'columns',
      'constraints',
      'functions',
      'indexes',
      'policies',
      'relations',
      'roles',
      'schemas',
      'triggers',
    ],
    'one relation details',
  )
  assertIncompleteCategories(
    runApplicationStateScenario(
      'partial columns',
      'PARTIAL',
      'alter table public.payments add column environment text;',
      'line_pay_unapplied_template',
    ),
    [
      'columns',
      'constraints',
      'functions',
      'indexes',
      'policies',
      'relations',
      'roles',
      'schemas',
      'triggers',
    ],
    'partial columns details',
  )
  runApplicationStateScenario(
    'roles only',
    'PARTIAL',
    `
      create role line_pay_payment_executor noinherit nologin;
      create role line_pay_payment_function_owner noinherit nologin;
    `,
    'line_pay_unapplied_template',
    `
      drop role line_pay_payment_executor;
      drop role line_pay_payment_function_owner;
    `,
  )
  runApplicationStateScenario(
    'function only',
    'PARTIAL',
    `
      create function public.line_pay_sanitized_result_is_valid(jsonb)
      returns boolean language sql immutable as 'select true';
    `,
    'line_pay_unapplied_template',
  )
  runApplicationStateScenario(
    'history only',
    'HISTORY_ONLY',
    `
      insert into supabase_migrations.schema_migrations (
        version, statements, name
      ) values ('20260719033404', array[]::text[], 'synthetic');
    `,
    'line_pay_unapplied_template',
  )
  runApplicationStateScenario(
    'history with partial schema',
    'INCONSISTENT',
    `
      insert into supabase_migrations.schema_migrations (
        version, statements, name
      ) values ('20260719033404', array[]::text[], 'synthetic');
      create table public.app_environment_attestation (id integer);
    `,
    'line_pay_unapplied_template',
  )

  psql(readFileSync(migrationPath, 'utf8'), 'full LINE Pay fixture')
  createDatabaseTemplate('line_pay_applied_template')
  const fullWithoutHistory = runApplicationStateScenario(
    'full without history',
    'FULL_WITHOUT_HISTORY',
  )
  assertIncompleteCategories(
    fullWithoutHistory,
    [],
    'full without history details',
  )
  assertDetailIdentityRows(
    fullWithoutHistory.details.relation_metadata,
    [],
    'full without history relation metadata details',
  )
  assertDetailIdentityRows(
    fullWithoutHistory.details.existing_relation_access,
    [],
    'full without history existing relation access details',
  )
  runApplicationStateScenario(
    'full with history',
    'FULL_WITH_HISTORY',
    `
      insert into supabase_migrations.schema_migrations (
        version, statements, name
      ) values ('20260719033404', array[]::text[], 'synthetic');
    `,
    'line_pay_applied_template',
  )
  const aclMismatch = runApplicationStateScenario(
    'ACL mismatch',
    'PARTIAL',
    'grant select on public.line_pay_checkout_attempts to anon;',
    'line_pay_applied_template',
  )
  assertIncompleteCategories(
    aclMismatch,
    ['relations'],
    'ACL mismatch details',
  )
  assertDetailIdentityRows(
    aclMismatch.details.existing_relation_access,
    [],
    'ACL mismatch existing relation access details',
  )
  const checkoutAttemptRelation = findDetailRow(
    aclMismatch.details.relation_metadata,
    'public.line_pay_checkout_attempts',
    'ACL mismatch relation metadata',
  )
  assert.equal(
    checkoutAttemptRelation.explicit_acl_absent,
    false,
    'ACL mismatch relation metadata: explicit ACL must be visible as a safe boolean',
  )
  assert.equal(
    checkoutAttemptRelation.owner_is_current_user,
    true,
    'ACL mismatch relation metadata: owner must remain intact',
  )
  const existingAccessMismatch = runApplicationStateScenario(
    'existing relation access mismatch',
    'PARTIAL',
    'grant insert on public.payments to authenticated;',
    'line_pay_applied_template',
  )
  assertIncompleteCategories(
    existingAccessMismatch,
    ['existing_relation_access'],
    'existing relation access mismatch details',
  )
  assertDetailIdentityRows(
    existingAccessMismatch.details.relation_metadata,
    [],
    'existing relation access mismatch relation metadata details',
  )
  const paymentsAccess = findDetailRow(
    existingAccessMismatch.details.existing_relation_access,
    'public.payments',
    'existing relation access mismatch',
  )
  assert.equal(
    paymentsAccess.authenticated_write_absent,
    false,
    'existing relation access mismatch: authenticated write must be visible as a safe boolean',
  )
  const combinedAccessMismatch = runApplicationStateScenario(
    'combined relation and existing access mismatch',
    'PARTIAL',
    `
      grant select on public.line_pay_checkout_attempts to anon;
      grant insert on public.payments to authenticated;
    `,
    'line_pay_applied_template',
  )
  assertIncompleteCategories(
    combinedAccessMismatch,
    ['existing_relation_access', 'relations'],
    'combined relation and existing access mismatch details',
  )
  assert.equal(
    findDetailRow(
      combinedAccessMismatch.details.relation_metadata,
      'public.line_pay_checkout_attempts',
      'combined relation and existing access mismatch',
    ).explicit_acl_absent,
    false,
    'combined relation and existing access mismatch: relation ACL boolean',
  )
  assert.equal(
    findDetailRow(
      combinedAccessMismatch.details.existing_relation_access,
      'public.payments',
      'combined relation and existing access mismatch',
    ).authenticated_write_absent,
    false,
    'combined relation and existing access mismatch: access ACL boolean',
  )
  psql(
    `
      grant select on public.line_pay_checkout_attempts to anon;
      grant insert on public.payments to authenticated;
      alter table public.payments owner to service_role;
      alter table public.product_orders owner to service_role;
    `,
    'recoverable Production PARTIAL fixture',
  )
  const recoverablePartial = parseAndValidateDiagnosticOutput(
    `${psql(diagnosticSql, 'recoverable Production PARTIAL', {
      readOnly: true,
    })}\n`,
  )
  assert.equal(recoverablePartial.application_state, 'PARTIAL')
  assertIncompleteCategories(
    recoverablePartial,
    ['existing_relation_access', 'relations'],
    'recoverable Production PARTIAL details',
  )
  psql(
    readFileSync(partialRecoveryPath, 'utf8'),
    'partial ACL metadata recovery',
  )
  const recovered = parseAndValidateDiagnosticOutput(
    `${psql(diagnosticSql, 'recovered Production PARTIAL', {
      readOnly: true,
    })}\n`,
  )
  assert.equal(
    recovered.application_state,
    'FULL_WITHOUT_HISTORY',
    `recovered Production PARTIAL:${JSON.stringify({
      details: recovered.details,
      relationAcl: readRelationAclSnapshot('recovered relation ACL snapshot'),
    })}`,
  )
  assertIncompleteCategories(recovered, [], 'recovered details')
  assertDetailIdentityRows(
    recovered.details.relation_metadata,
    [],
    'recovered relation metadata details',
  )
  assertDetailIdentityRows(
    recovered.details.existing_relation_access,
    [],
    'recovered existing relation access details',
  )
  assertNoLinePayMigrationHistory('partial recovery history preservation')
  assertRuntimeWriteBoundary('partial recovery runtime write boundary')
  restoreDatabaseFromTemplate('line_pay_applied_template')
  runApplicationStateScenario(
    'ownership mismatch',
    'PARTIAL',
    'alter table public.line_pay_checkout_attempts owner to service_role;',
    'line_pay_applied_template',
  )
  runApplicationStateScenario(
    'policy mismatch',
    'PARTIAL',
    `
      alter policy line_pay_payment_function_owner_payments_select
      on public.payments using (false);
    `,
    'line_pay_applied_template',
  )
  runApplicationStateScenario(
    'trigger mismatch',
    'PARTIAL',
    `
      alter table public.line_pay_checkout_attempts
      disable trigger line_pay_checkout_attempts_touch_updated_at;
    `,
    'line_pay_applied_template',
  )
  runApplicationStateScenario(
    'constraint mismatch',
    'PARTIAL',
    `
      alter table public.payments
      drop constraint payments_line_pay_contract_check;
    `,
    'line_pay_applied_template',
  )
  runApplicationStateScenario(
    'index mismatch',
    'PARTIAL',
    'drop index public.payments_line_pay_transaction_idx;',
    'line_pay_applied_template',
  )
  runApplicationStateScenario(
    'history with contract mismatch',
    'INCONSISTENT',
    `
      insert into supabase_migrations.schema_migrations (
        version, statements, name
      ) values ('20260719033404', array[]::text[], 'synthetic');
      drop index public.payments_line_pay_transaction_idx;
    `,
    'line_pay_applied_template',
  )

  runStaticMutations()
  assert.equal(scenariosPassed, 18)
  assert.equal(mutationsCaught, 13)
} finally {
  cleanup()
}

console.log(`Application state scenarios: ${scenariosPassed}/18 PASS`)
console.log(`Mutations: ${mutationsCaught}/13 caught`)
console.log('Uncaught mutations: 0')
console.log('PostgreSQL: 17 PASS')
console.log(`Docker cleanup: ${cleanupPassed ? 'PASS' : 'FAIL'}`)
