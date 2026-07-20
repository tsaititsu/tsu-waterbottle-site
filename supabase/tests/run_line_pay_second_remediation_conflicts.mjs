import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LINE_PAY_POSTGRES_IMAGE } from './line_pay_postgres_image.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDirectory, '../..')
const containerName = `line-pay-second-conflicts-${randomBytes(6).toString('hex')}`
const networkName = `${containerName}-network`
const volumeName = `${containerName}-data`
const localPostgresPassword = randomBytes(32).toString('base64url')
const image = LINE_PAY_POSTGRES_IMAGE
const migration = process.env.LINE_PAY_MIGRATION_UNDER_TEST
  ? resolve(process.env.LINE_PAY_MIGRATION_UNDER_TEST)
  : join(root, 'supabase/migrations/20260719033404_line_pay_remediation_contracts.sql')
const selectedScenario = process.env.LINE_PAY_CONFLICT_SCENARIO ?? null
const baselineFiles = [
  'supabase/schema.sql',
  'supabase/bank_transfer_submissions_patch.sql',
  'supabase/newebpay_payments_patch.sql',
  'supabase/payments_service_role_grants.sql',
  'supabase/product_orders_schema_draft.sql',
  'supabase/migrations/20260707_line_pay_provider_schema_draft.sql',
]
const fakeMarkers = [
  'fake_test_token_do_not_use',
  'fake_test_signature_do_not_use',
  'fake_test_authorization_do_not_use',
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

function assertNoFakeMarker(output, label) {
  if (fakeMarkers.some((marker) => output.includes(marker))) {
    throw new Error(`${label} leaked a fake secret marker`)
  }
}

function psqlResult(database, sql) {
  const result = spawnSync(
    'docker',
    ['exec', '-i', containerName, 'psql', '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database],
    { cwd: root, encoding: 'utf8', input: sql },
  )
  const combinedOutput = `${result.stdout}\n${result.stderr}`
  assertNoFakeMarker(combinedOutput, `psql ${database}`)
  return { ...result, combinedOutput }
}

function psql(database, sql, label) {
  const result = psqlResult(database, sql)
  if (result.status !== 0) {
    throw new Error(`${label} failed\n${result.stderr || result.stdout}`)
  }
  return result.stdout.trim()
}

function psqlFile(database, path, label = path) {
  const absolutePath = path.startsWith('/') ? path : join(root, path)
  return psql(database, readFileSync(absolutePath, 'utf8'), label)
}

function prepareBaseline(database) {
  psqlFile(database, 'supabase/tests/line_pay_local_postgres_bootstrap.sql')
  for (const file of baselineFiles) psqlFile(database, file)
}

function assertMigrationRollback(database, label) {
  const result = psql(
    database,
    `
      select (
        pg_catalog.to_regprocedure('public.line_pay_sanitized_result_is_valid(jsonb)') is null
        and pg_catalog.to_regclass('public.line_pay_checkout_attempts') is null
        and not exists (
          select 1
          from pg_catalog.pg_attribute as attribute
          where attribute.attrelid = 'public.product_orders'::regclass
            and attribute.attname = 'environment'
            and not attribute.attisdropped
        )
      )::text;
    `,
    `${label} rollback assertion`,
  )
  if (result !== 'true') throw new Error(`${label} did not fully roll back`)
}

function applyMigrationExpectFailure(database, expectedPattern, label) {
  const result = psqlResult(database, readFileSync(migration, 'utf8'))
  if (result.status === 0 || !expectedPattern.test(result.combinedOutput)) {
    throw new Error(
      `${label} did not fail closed with the expected error\n${result.combinedOutput}`,
    )
  }
  assertMigrationRollback(database, label)
}

function cleanupScenarioDatabase(database) {
  psql('postgres', `drop database if exists ${database};`, `drop ${database}`)
  psql(
    'postgres',
    `
      drop role if exists line_pay_payment_executor;
      drop role if exists line_pay_payment_function_owner;
      drop role if exists line_pay_conflict_peer;
    `,
    `drop roles after ${database}`,
  )
}

function runScenario(name, setup, expectation) {
  if (selectedScenario !== null && selectedScenario !== name) return 0
  const database = `lp_conflict_${name.replaceAll('-', '_')}`.slice(0, 60)
  psql('postgres', `create database ${database};`, `create ${database}`)
  try {
    prepareBaseline(database)
    setup(database)
    expectation(database)
  } finally {
    cleanupScenarioDatabase(database)
  }
  return 1
}

function createMinimalRole(roleName) {
  psql(
    'postgres',
    `create role ${roleName} nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;`,
    `create ${roleName}`,
  )
}

const roleFixtures = [
  ['attributes', (database, role) => psql('postgres', `alter role ${role} login;`, 'role attribute fixture')],
  ['database-privilege', (database, role) => psql('postgres', `grant connect on database ${database} to ${role};`, 'database privilege fixture')],
  ['database-ownership', (database, role) => psql('postgres', `alter database ${database} owner to ${role};`, 'database ownership fixture')],
  ['schema-usage', (database, role) => psql(database, `grant usage on schema public to ${role};`, 'schema usage fixture')],
  ['schema-create', (database, role) => psql(database, `grant create on schema public to ${role};`, 'schema create fixture')],
  ['schema-ownership', (database, role) => psql(database, `create schema line_pay_conflict_owned authorization ${role};`, 'schema ownership fixture')],
  ['table-select', (database, role) => psql(database, `grant select on table public.payments to ${role};`, 'table select fixture')],
  ['table-insert', (database, role) => psql(database, `grant insert on table public.payments to ${role};`, 'table insert fixture')],
  ['table-update', (database, role) => psql(database, `grant update on table public.payments to ${role};`, 'table update fixture')],
  ['table-delete', (database, role) => psql(database, `grant delete on table public.payments to ${role};`, 'table delete fixture')],
  ['table-truncate', (database, role) => psql(database, `grant truncate on table public.payments to ${role};`, 'table truncate fixture')],
  ['table-references', (database, role) => psql(database, `grant references on table public.payments to ${role};`, 'table references fixture')],
  ['table-trigger', (database, role) => psql(database, `grant trigger on table public.payments to ${role};`, 'table trigger fixture')],
  ['sequence-privilege', (database, role) => psql(database, `create sequence public.line_pay_conflict_sequence; grant usage on sequence public.line_pay_conflict_sequence to ${role};`, 'sequence privilege fixture')],
  ['sequence-ownership', (database, role) => psql(database, `create sequence public.line_pay_conflict_sequence; alter sequence public.line_pay_conflict_sequence owner to ${role};`, 'sequence ownership fixture')],
  ['function-execute', (database, role) => psql(database, `create function public.line_pay_conflict_function() returns integer language sql as 'select 1'; revoke execute on function public.line_pay_conflict_function() from public; grant execute on function public.line_pay_conflict_function() to ${role};`, 'function execute fixture')],
  ['function-ownership', (database, role) => psql(database, `create function public.line_pay_conflict_function() returns integer language sql as 'select 1'; alter function public.line_pay_conflict_function() owner to ${role};`, 'function ownership fixture')],
  ['type-privilege', (database, role) => psql(database, `create domain public.line_pay_conflict_domain as text; grant usage on type public.line_pay_conflict_domain to ${role};`, 'type privilege fixture')],
  ['type-ownership', (database, role) => psql(database, `create domain public.line_pay_conflict_domain as text; alter domain public.line_pay_conflict_domain owner to ${role};`, 'type ownership fixture')],
  ['default-privilege', (database, role) => psql(database, `alter default privileges for role postgres grant select on tables to ${role};`, 'default privilege fixture')],
  ['outbound-membership', (database, role) => {
    createMinimalRole('line_pay_conflict_peer')
    psql('postgres', `grant line_pay_conflict_peer to ${role};`, 'outbound membership fixture')
  }],
  ['inbound-membership', (database, role) => {
    createMinimalRole('line_pay_conflict_peer')
    psql('postgres', `grant ${role} to line_pay_conflict_peer with admin option;`, 'inbound membership fixture')
  }],
  ['inherited-privilege', (database, role) => {
    createMinimalRole('line_pay_conflict_peer')
    psql(database, 'grant select on table public.payments to line_pay_conflict_peer;', 'inherited privilege parent grant')
    psql('postgres', `grant line_pay_conflict_peer to ${role};`, 'inherited privilege membership')
  }],
]

async function main() {
  runDocker(['pull', image])
  const repositoryDigests = JSON.parse(
    runDocker(['image', 'inspect', '--format', '{{json .RepoDigests}}', image]),
  )
  if (!repositoryDigests.includes(image)) {
    throw new Error('POSTGRES_IMAGE_REPOSITORY_DIGEST_MISMATCH')
  }

  runDocker(['volume', 'create', '--label', 'task=line-pay-second-remediation', volumeName])
  runDocker(['network', 'create', '--driver', 'bridge', '--internal', '--label', 'task=line-pay-second-remediation', networkName])
  runDocker([
    'run', '--detach', '--rm', '--name', containerName, '--network', networkName,
    '--mount', `type=volume,src=${volumeName},dst=/var/lib/postgresql/data`,
    '--env', `POSTGRES_PASSWORD=${localPostgresPassword}`, image,
  ])

  let consecutiveReadyChecks = 0
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = spawnSync(
      'docker',
      ['exec', containerName, 'psql', '-X', '-A', '-t', '-U', 'postgres', '-d', 'postgres', '-c', 'select 1'],
      { encoding: 'utf8' },
    )
    consecutiveReadyChecks = result.status === 0 && result.stdout.trim() === '1'
      ? consecutiveReadyChecks + 1
      : 0
    if (consecutiveReadyChecks >= 2) break
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250)
  }
  if (consecutiveReadyChecks < 2) {
    throw new Error('LOCAL_DB_RUNTIME_UNAVAILABLE: PostgreSQL did not become stably ready')
  }

  let scenarioCount = 0
  scenarioCount += runScenario(
    'unexpected-overload',
    (database) => psql(
      database,
      "create function public.complete_product_order_line_pay_confirmation(text) returns text language sql as 'select $1';",
      'unexpected overload fixture',
    ),
    (database) => {
      applyMigrationExpectFailure(database, /line_pay_sensitive_rpc_preexisting_overload/, 'unexpected overload')
      const remains = psql(
        database,
        "select (pg_catalog.to_regprocedure('public.complete_product_order_line_pay_confirmation(text)') is not null)::text;",
        'unexpected overload preservation',
      )
      if (remains !== 'true') throw new Error('unexpected overload was modified or removed')
    },
  )

  for (const roleName of ['line_pay_payment_executor', 'line_pay_payment_function_owner']) {
    for (const [fixtureName, fixture] of roleFixtures) {
      const scenarioName = `${roleName === 'line_pay_payment_executor' ? 'executor' : 'owner'}-${fixtureName}`
      const expectedCategory = fixtureName === 'attributes'
        ? 'role_attribute'
        : fixtureName.includes('membership') || fixtureName === 'inherited-privilege'
          ? 'role_membership'
          : fixtureName.startsWith('database-')
            ? 'database_privilege'
            : fixtureName.startsWith('schema-')
              ? 'schema_privilege'
              : fixtureName.startsWith('table-')
                ? 'relation_privilege'
                : fixtureName.startsWith('sequence-')
                  ? 'sequence_privilege'
                  : fixtureName.startsWith('function-')
                    ? 'function_privilege'
                    : fixtureName.startsWith('type-')
                      ? 'type_privilege'
                      : 'default_privilege'
      scenarioCount += runScenario(
        scenarioName,
        (database) => {
          createMinimalRole(roleName)
          fixture(database, roleName)
        },
        (database) => applyMigrationExpectFailure(
          database,
          new RegExp(`${roleName}_${expectedCategory}_conflict`),
          scenarioName,
        ),
      )
    }
  }

  const constraintCases = [
    ['constraint-absent', 'alter table public.product_orders drop constraint product_orders_payment_method_check;', true],
    ['constraint-legacy', 'select 1;', true],
    ['constraint-equivalent-formatting', `alter table public.product_orders drop constraint product_orders_payment_method_check; alter table public.product_orders add constraint product_orders_payment_method_check check (((payment_method in ('bank_transfer', 'newebpay'))));`, true],
    ['constraint-new', `alter table public.product_orders drop constraint product_orders_payment_method_check; alter table public.product_orders add constraint product_orders_payment_method_check check (payment_method in ('bank_transfer', 'newebpay', 'line_pay'));`, true],
    ['constraint-different', `alter table public.product_orders drop constraint product_orders_payment_method_check; alter table public.product_orders add constraint product_orders_payment_method_check check (payment_method in ('bank_transfer'));`, false],
    ['constraint-unknown-value', `alter table public.product_orders drop constraint product_orders_payment_method_check; alter table public.product_orders add constraint product_orders_payment_method_check check (payment_method in ('bank_transfer', 'newebpay', 'crypto'));`, false],
  ]

  for (const [name, setupSql, shouldSucceed] of constraintCases) {
    scenarioCount += runScenario(
      name,
      (database) => psql(database, setupSql, `${name} fixture`),
      (database) => {
        if (shouldSucceed) {
          psqlFile(database, migration, `${name} migration`)
          const normalized = psql(
            database,
            `
              select pg_catalog.lower(pg_catalog.regexp_replace(
                pg_catalog.btrim(pg_catalog.pg_get_constraintdef(constraint_row.oid, false)),
                '[[:space:]]+', '', 'g'
              ))
              from pg_catalog.pg_constraint as constraint_row
              where constraint_row.conrelid = 'public.product_orders'::regclass
                and constraint_row.conname = 'product_orders_payment_method_check';
            `,
            `${name} normalized constraint`,
          )
          if (normalized !== "check((payment_method=any(array['bank_transfer'::text,'newebpay'::text,'line_pay'::text])))") {
            throw new Error(`${name} did not produce the exact reviewed constraint`)
          }
        } else {
          applyMigrationExpectFailure(
            database,
            /product_orders_payment_method_constraint_definition_conflict/,
            name,
          )
        }
      },
    )
  }

  if (selectedScenario !== null && scenarioCount !== 1) {
    throw new Error(`UNKNOWN_LINE_PAY_CONFLICT_SCENARIO: ${selectedScenario}`)
  }

  process.stdout.write(`line_pay_second_remediation_conflicts: PASS (${scenarioCount} scenarios)\n`)
}

try {
  await main()
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
} finally {
  spawnSync('docker', ['rm', '--force', containerName], { encoding: 'utf8' })
  spawnSync('docker', ['volume', 'rm', volumeName], { encoding: 'utf8' })
  spawnSync('docker', ['network', 'rm', networkName], { encoding: 'utf8' })
}
