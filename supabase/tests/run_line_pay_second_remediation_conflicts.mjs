import { spawn, spawnSync } from 'node:child_process'
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
const expectFindingAGuardMutation = process.env.LINE_PAY_EXPECT_FINDING_A_MUTATION === '1'
const expectRelationLockMutation = process.env.LINE_PAY_EXPECT_RELATION_LOCK_MUTATION === '1'
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

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds))
}

function startPsql(database, sql, applicationName) {
  const child = spawn(
    'docker',
    [
      'exec', '-i', '--env', `PGAPPNAME=${applicationName}`, containerName,
      'psql', '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database,
    ],
    { cwd: root, encoding: 'utf8' },
  )
  let stdout = ''
  let stderr = ''
  const completion = new Promise((resolvePromise, rejectPromise) => {
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', rejectPromise)
    child.on('close', (code) => {
      const combinedOutput = `${stdout}\n${stderr}`
      assertNoFakeMarker(combinedOutput, applicationName)
      resolvePromise({ code, stdout, stderr, combinedOutput })
    })
  })
  child.stdin.end(sql)
  return { child, completion }
}

async function withTimeout(promise, milliseconds, label) {
  const timeout = delay(milliseconds).then(() => {
    throw new Error(`${label} timed out after ${milliseconds}ms`)
  })
  return Promise.race([promise, timeout])
}

async function settleWithin(promise, milliseconds) {
  return Promise.race([promise, delay(milliseconds).then(() => null)])
}

async function waitForQuery(database, sql, predicate, label, timeoutMilliseconds = 5000) {
  const deadline = Date.now() + timeoutMilliseconds
  let lastOutput = ''
  while (Date.now() < deadline) {
    lastOutput = psql(database, sql, label)
    if (predicate(lastOutput)) return lastOutput
    await delay(50)
  }
  throw new Error(`${label} was not observed; last output: ${lastOutput}`)
}

async function startCatalogPause(database, applicationName) {
  const blocker = startPsql(
    database,
    `
      begin;
      lock table pg_catalog.pg_default_acl in access exclusive mode;
      select 'catalog_pause_ready';
      select pg_catalog.pg_sleep(600);
      commit;
    `,
    applicationName,
  )
  await waitForQuery(
    database,
    `
      select pg_catalog.count(*)::text
      from pg_catalog.pg_stat_activity as activity
      join pg_catalog.pg_locks as held_lock
        on held_lock.pid = activity.pid
       and held_lock.locktype = 'relation'
       and held_lock.relation = 'pg_catalog.pg_default_acl'::regclass
       and held_lock.mode = 'AccessExclusiveLock'
       and held_lock.granted
      where activity.application_name = '${applicationName}'
        and activity.state = 'active';
    `,
    (output) => output === '1',
    `${applicationName} catalog pause`,
  )
  return blocker
}

async function terminateApplication(database, applicationName, label) {
  const result = psql(
    database,
    `
      select coalesce(pg_catalog.bool_and(pg_catalog.pg_terminate_backend(activity.pid)), true)::text
      from pg_catalog.pg_stat_activity as activity
      where activity.datname = pg_catalog.current_database()
        and activity.application_name = '${applicationName}'
        and activity.pid <> pg_catalog.pg_backend_pid();
    `,
    label,
  )
  if (result !== 'true') throw new Error(`${label} could not terminate the test session`)
}

async function waitForMigrationGuardPause(database, migrationApplication, blockerApplication, label) {
  return waitForQuery(
    database,
    `
      select pg_catalog.concat_ws(
        '|',
        migration_activity.pid::text,
        migration_activity.wait_event_type,
        product_lock.mode,
        product_lock.granted::text,
        pg_catalog.array_position(
          pg_catalog.pg_blocking_pids(migration_activity.pid),
          blocker_activity.pid
        ) is not null
      )
      from pg_catalog.pg_stat_activity as migration_activity
      join pg_catalog.pg_stat_activity as blocker_activity
        on blocker_activity.application_name = '${blockerApplication}'
      join pg_catalog.pg_locks as product_lock
        on product_lock.pid = migration_activity.pid
       and product_lock.locktype = 'relation'
       and product_lock.relation = 'public.product_orders'::regclass
       and product_lock.mode = 'AccessExclusiveLock'
       and product_lock.granted
      where migration_activity.application_name = '${migrationApplication}'
        and migration_activity.wait_event_type = 'Lock'
        and exists (
          select 1
          from pg_catalog.pg_locks as pending_lock
          where pending_lock.pid = migration_activity.pid
            and pending_lock.locktype = 'relation'
            and pending_lock.relation = 'pg_catalog.pg_default_acl'::regclass
            and not pending_lock.granted
        );
    `,
    (output) => /\|Lock\|AccessExclusiveLock\|true\|t$/.test(output),
    label,
  )
}

async function waitForUnlockedMigrationGuardPause(database, migrationApplication, blockerApplication, label) {
  return waitForQuery(
    database,
    `
      select pg_catalog.concat_ws(
        '|',
        migration_activity.pid::text,
        migration_activity.wait_event_type,
        pg_catalog.array_position(
          pg_catalog.pg_blocking_pids(migration_activity.pid),
          blocker_activity.pid
        ) is not null,
        not exists (
          select 1
          from pg_catalog.pg_locks as product_lock
          where product_lock.pid = migration_activity.pid
            and product_lock.locktype = 'relation'
            and product_lock.relation = 'public.product_orders'::regclass
            and product_lock.mode = 'AccessExclusiveLock'
            and product_lock.granted
        )
      )
      from pg_catalog.pg_stat_activity as migration_activity
      join pg_catalog.pg_stat_activity as blocker_activity
        on blocker_activity.application_name = '${blockerApplication}'
      where migration_activity.application_name = '${migrationApplication}'
        and migration_activity.wait_event_type = 'Lock'
        and exists (
          select 1
          from pg_catalog.pg_locks as pending_lock
          where pending_lock.pid = migration_activity.pid
            and pending_lock.locktype = 'relation'
            and pending_lock.relation = 'pg_catalog.pg_default_acl'::regclass
            and not pending_lock.granted
        );
    `,
    (output) => /\|Lock\|t\|t$/.test(output),
    label,
  )
}

async function waitForProductOrdersBlock(database, waiterApplication, blockerApplication, label) {
  return waitForQuery(
    database,
    `
      select pg_catalog.concat_ws(
        '|',
        waiter.pid::text,
        waiter.wait_event_type,
        pending_lock.mode,
        pending_lock.granted::text,
        pg_catalog.array_position(pg_catalog.pg_blocking_pids(waiter.pid), blocker.pid) is not null
      )
      from pg_catalog.pg_stat_activity as waiter
      join pg_catalog.pg_stat_activity as blocker
        on blocker.application_name = '${blockerApplication}'
      join pg_catalog.pg_locks as pending_lock
        on pending_lock.pid = waiter.pid
       and pending_lock.locktype = 'relation'
       and pending_lock.relation = 'public.product_orders'::regclass
       and not pending_lock.granted
      where waiter.application_name = '${waiterApplication}'
        and waiter.wait_event_type = 'Lock';
    `,
    (output) => /\|Lock\|[A-Za-z]+Lock\|false\|t$/.test(output),
    label,
  )
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
        and pg_catalog.to_regclass('public.line_pay_request_outbox') is null
        and pg_catalog.to_regclass('public.line_pay_callback_capabilities') is null
        and pg_catalog.to_regclass('public.line_pay_callback_events') is null
        and pg_catalog.to_regclass('public.line_pay_payment_audit_events') is null
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

function assertNoLinePayRoles(database, label) {
  const roleCount = psql(
    database,
    `
      select pg_catalog.count(*)::text
      from pg_catalog.pg_roles as role
      where role.rolname in (
        'line_pay_payment_executor',
        'line_pay_payment_function_owner'
      );
    `,
    `${label} role rollback assertion`,
  )
  if (roleCount !== '0') throw new Error(`${label} created a LINE Pay role before failing`)
}

function readPaymentMethodConstraintFingerprint(database, label) {
  const output = psql(
    database,
    `
      select pg_catalog.jsonb_build_object(
        'contype', constraint_row.contype,
        'definition', pg_catalog.pg_get_constraintdef(constraint_row.oid, false),
        'validated', constraint_row.convalidated,
        'noinherit', constraint_row.connoinherit,
        'deferrable', constraint_row.condeferrable,
        'deferred', constraint_row.condeferred,
        'islocal', constraint_row.conislocal,
        'inhcount', constraint_row.coninhcount,
        'parentid', constraint_row.conparentid,
        'contypid', constraint_row.contypid,
        'conrelid', constraint_row.conrelid,
        'namespace', constraint_row.connamespace,
        'indexid', constraint_row.conindid
      )::text
      from pg_catalog.pg_constraint as constraint_row
      where constraint_row.conrelid = 'public.product_orders'::regclass
        and constraint_row.conname = 'product_orders_payment_method_check';
    `,
    `${label} constraint fingerprint`,
  )
  const rows = output.split('\n').filter(Boolean)
  if (rows.length !== 1) {
    throw new Error(`${label} expected exactly one same-name constraint, received ${rows.length}`)
  }
  return rows[0]
}

function cleanupScenarioDatabase(database) {
  psql(
    'postgres',
    `
      select pg_catalog.pg_terminate_backend(activity.pid)
      from pg_catalog.pg_stat_activity as activity
      where activity.datname = '${database}'
        and activity.pid <> pg_catalog.pg_backend_pid();
    `,
    `terminate sessions for ${database}`,
  )
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

async function runAsyncScenario(name, scenario) {
  if (selectedScenario !== null && selectedScenario !== name) return 0
  const database = `lp_conflict_${name.replaceAll('-', '_')}`.slice(0, 60)
  psql('postgres', `create database ${database};`, `create ${database}`)
  try {
    prepareBaseline(database)
    await scenario(database)
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

const relationLockMetrics = {
  commitLockMilliseconds: 0,
  rollbackReleaseMilliseconds: 0,
  impactWaitMilliseconds: 0,
  timeoutMilliseconds: 0,
}

function assertPsqlSucceeded(result, label) {
  if (result.code !== 0) {
    throw new Error(`${label} failed\n${result.stderr || result.stdout}`)
  }
}

function assertPsqlFailed(result, expectedPattern, label) {
  if (result.code === 0 || !expectedPattern.test(result.combinedOutput)) {
    throw new Error(`${label} did not fail as expected\n${result.stderr || result.stdout}`)
  }
}

function dropPaymentMethodConstraint(database, label) {
  psql(
    database,
    'alter table public.product_orders drop constraint product_orders_payment_method_check;',
    label,
  )
}

function assertSameNameConstraintCount(database, expected, label) {
  const count = psql(
    database,
    `
      select pg_catalog.count(*)::text
      from pg_catalog.pg_constraint as constraint_row
      where constraint_row.conrelid = 'public.product_orders'::regclass
        and constraint_row.conname = 'product_orders_payment_method_check';
    `,
    label,
  )
  if (count !== String(expected)) {
    throw new Error(`${label} expected ${expected}, received ${count}`)
  }
}

async function runRelationLockCommitScenario(database) {
  dropPaymentMethodConstraint(database, 'relation lock commit absent constraint')
  const blockerApplication = 'lp_lock_commit_catalog'
  const migrationApplication = 'lp_lock_commit_migration'
  const concurrentApplication = 'lp_lock_commit_concurrent'
  const blocker = await startCatalogPause(database, blockerApplication)
  const migrationStartedAt = Date.now()
  const migrationSession = startPsql(
    database,
    readFileSync(migration, 'utf8'),
    migrationApplication,
  )

  if (expectRelationLockMutation) {
    await waitForUnlockedMigrationGuardPause(
      database,
      migrationApplication,
      blockerApplication,
      'mutated migration guard pause without relation lock',
    )
  } else {
    await waitForMigrationGuardPause(
      database,
      migrationApplication,
      blockerApplication,
      'migration guard pause with relation lock',
    )
  }

  const concurrentSession = startPsql(
    database,
    `
      alter table public.product_orders
        add constraint product_orders_payment_method_check unique (id);
    `,
    concurrentApplication,
  )
  const earlyConcurrentResult = await settleWithin(concurrentSession.completion, 500)

  if (expectRelationLockMutation) {
    if (earlyConcurrentResult === null) {
      throw new Error('relation-lock mutation did not reopen the concurrent DDL window')
    }
    assertPsqlSucceeded(earlyConcurrentResult, 'mutated concurrent UNIQUE creation')
    const beforeReplacement = readPaymentMethodConstraintFingerprint(
      database,
      'mutated concurrent UNIQUE before replacement',
    )
    if (JSON.parse(beforeReplacement).contype !== 'u') {
      throw new Error('relation-lock mutation did not create the expected UNIQUE constraint')
    }

    await terminateApplication(database, blockerApplication, 'release mutated catalog pause')
    await withTimeout(blocker.completion, 5000, 'mutated catalog blocker exit')
    const migrationResult = await withTimeout(
      migrationSession.completion,
      20000,
      'mutated migration completion',
    )
    assertPsqlSucceeded(migrationResult, 'mutated migration')
    const afterReplacement = readPaymentMethodConstraintFingerprint(
      database,
      'mutated replacement result',
    )
    if (
      JSON.parse(afterReplacement).contype !== 'c'
      || afterReplacement === beforeReplacement
    ) {
      throw new Error('relation-lock mutation did not reproduce the unsafe replacement')
    }
    throw new Error('RELATION_LOCK_MUTATION_CAUGHT:unsafe_concurrent_constraint_replacement')
  }

  if (earlyConcurrentResult !== null) {
    throw new Error('concurrent DDL completed while Session A held ACCESS EXCLUSIVE')
  }
  const blockingEvidence = await waitForProductOrdersBlock(
    database,
    concurrentApplication,
    migrationApplication,
    'concurrent same-name UNIQUE lock wait',
  )
  assertSameNameConstraintCount(database, 0, 'concurrent constraint absence while blocked')

  await terminateApplication(database, blockerApplication, 'release commit catalog pause')
  await withTimeout(blocker.completion, 5000, 'commit catalog blocker exit')
  const migrationResult = await withTimeout(
    migrationSession.completion,
    20000,
    'commit migration completion',
  )
  const concurrentResult = await withTimeout(
    concurrentSession.completion,
    20000,
    'commit concurrent DDL completion',
  )
  assertPsqlSucceeded(migrationResult, 'relation lock commit migration')
  assertPsqlFailed(
    concurrentResult,
    /constraint .*product_orders_payment_method_check.* already exists/i,
    'post-commit concurrent same-name UNIQUE',
  )
  const after = readPaymentMethodConstraintFingerprint(database, 'commit CHECK result')
  if (JSON.parse(after).contype !== 'c') {
    throw new Error('commit scenario did not retain the reviewed CHECK constraint')
  }
  relationLockMetrics.commitLockMilliseconds = Date.now() - migrationStartedAt
  process.stdout.write(
    `relation_lock_commit_evidence: waiter_blocked=true blocker_is_session_a=true mode=AccessExclusiveLock evidence=${blockingEvidence}\n`,
  )
}

async function runRelationLockRollbackScenario(database) {
  dropPaymentMethodConstraint(database, 'relation lock rollback absent constraint')
  const blockerApplication = 'lp_lock_rollback_catalog'
  const migrationApplication = 'lp_lock_rollback_migration'
  const concurrentApplication = 'lp_lock_rollback_concurrent'
  const blocker = await startCatalogPause(database, blockerApplication)
  const migrationSession = startPsql(
    database,
    readFileSync(migration, 'utf8'),
    migrationApplication,
  )
  await waitForMigrationGuardPause(
    database,
    migrationApplication,
    blockerApplication,
    'rollback migration guard pause',
  )
  const concurrentSession = startPsql(
    database,
    `
      alter table public.product_orders
        add constraint product_orders_payment_method_check unique (id);
    `,
    concurrentApplication,
  )
  await waitForProductOrdersBlock(
    database,
    concurrentApplication,
    migrationApplication,
    'rollback concurrent DDL lock wait',
  )

  const rollbackStartedAt = Date.now()
  await terminateApplication(database, migrationApplication, 'force migration rollback')
  const migrationResult = await withTimeout(
    migrationSession.completion,
    5000,
    'rolled-back migration exit',
  )
  const concurrentResult = await withTimeout(
    concurrentSession.completion,
    10000,
    'post-rollback concurrent DDL completion',
  )
  relationLockMetrics.rollbackReleaseMilliseconds = Date.now() - rollbackStartedAt
  if (migrationResult.code === 0) {
    throw new Error('terminated migration unexpectedly committed')
  }
  assertPsqlSucceeded(concurrentResult, 'post-rollback concurrent UNIQUE creation')
  const after = readPaymentMethodConstraintFingerprint(database, 'rollback UNIQUE result')
  if (JSON.parse(after).contype !== 'u') {
    throw new Error('rollback scenario did not release the relation for Session B')
  }
  assertMigrationRollback(database, 'relation lock rollback')
  assertNoLinePayRoles(database, 'relation lock rollback')
  await terminateApplication(database, blockerApplication, 'release rollback catalog pause')
  await withTimeout(blocker.completion, 5000, 'rollback catalog blocker exit')
}

async function runPreexistingUnknownConstraintScenario(database) {
  dropPaymentMethodConstraint(database, 'preexisting unknown absent constraint')
  const blockerApplication = 'lp_lock_preexisting_catalog'
  const concurrentApplication = 'lp_lock_preexisting_unknown'
  const migrationApplication = 'lp_lock_preexisting_migration'
  const blocker = await startCatalogPause(database, blockerApplication)
  const concurrentSession = startPsql(
    database,
    `
      begin;
      alter table public.product_orders
        add constraint product_orders_payment_method_check unique (id);
      lock table pg_catalog.pg_default_acl in access share mode;
      commit;
    `,
    concurrentApplication,
  )
  await waitForQuery(
    database,
    `
      select pg_catalog.concat_ws('|', product_lock.mode, product_lock.granted::text)
      from pg_catalog.pg_stat_activity as activity
      join pg_catalog.pg_locks as product_lock
        on product_lock.pid = activity.pid
       and product_lock.locktype = 'relation'
       and product_lock.relation = 'public.product_orders'::regclass
       and product_lock.mode = 'AccessExclusiveLock'
       and product_lock.granted
      where activity.application_name = '${concurrentApplication}'
        and activity.wait_event_type = 'Lock';
    `,
    (output) => output === 'AccessExclusiveLock|true',
    'preexisting Session B holds product_orders lock',
  )

  const migrationSession = startPsql(
    database,
    readFileSync(migration, 'utf8'),
    migrationApplication,
  )
  await waitForProductOrdersBlock(
    database,
    migrationApplication,
    concurrentApplication,
    'migration waits for preexisting unknown DDL',
  )
  await terminateApplication(database, blockerApplication, 'release preexisting catalog pause')
  await withTimeout(blocker.completion, 5000, 'preexisting catalog blocker exit')
  const concurrentResult = await withTimeout(
    concurrentSession.completion,
    5000,
    'preexisting constraint commit',
  )
  assertPsqlSucceeded(concurrentResult, 'preexisting unknown constraint commit')
  const before = readPaymentMethodConstraintFingerprint(database, 'preexisting unknown before migration')
  const migrationResult = await withTimeout(
    migrationSession.completion,
    10000,
    'preexisting unknown migration failure',
  )
  assertPsqlFailed(
    migrationResult,
    /product_orders_payment_method_constraint_type_conflict/,
    'preexisting unknown constraint migration',
  )
  assertMigrationRollback(database, 'preexisting unknown constraint')
  assertNoLinePayRoles(database, 'preexisting unknown constraint')
  const after = readPaymentMethodConstraintFingerprint(database, 'preexisting unknown preserved')
  if (JSON.parse(after).contype !== 'u' || after !== before) {
    throw new Error('preexisting unknown constraint fingerprint changed')
  }
}

async function runRelationLockImpactScenario(database) {
  const blockerApplication = 'lp_lock_impact_catalog'
  const migrationApplication = 'lp_lock_impact_migration'
  const blocker = await startCatalogPause(database, blockerApplication)
  const migrationStartedAt = Date.now()
  const migrationSession = startPsql(
    database,
    readFileSync(migration, 'utf8'),
    migrationApplication,
  )
  await waitForMigrationGuardPause(
    database,
    migrationApplication,
    blockerApplication,
    'lock impact migration guard pause',
  )

  const probes = [
    ['select', 'select pg_catalog.count(*) from public.product_orders;'],
    ['insert', 'insert into public.product_orders select * from public.product_orders where false;'],
    ['update', 'update public.product_orders set id = id where false;'],
    ['delete', 'delete from public.product_orders where false;'],
    ['alter', 'alter table public.product_orders add column line_pay_lock_impact_probe integer;'],
  ].map(([name, sql]) => ({
    name,
    applicationName: `lp_lock_impact_${name}`,
    session: startPsql(database, sql, `lp_lock_impact_${name}`),
  }))
  const probesStartedAt = Date.now()

  for (const probe of probes) {
    await waitForProductOrdersBlock(
      database,
      probe.applicationName,
      migrationApplication,
      `${probe.name} relation lock impact`,
    )
  }
  relationLockMetrics.impactWaitMilliseconds = Date.now() - probesStartedAt
  await terminateApplication(database, blockerApplication, 'release lock impact catalog pause')
  await withTimeout(blocker.completion, 5000, 'lock impact catalog blocker exit')
  const migrationResult = await withTimeout(
    migrationSession.completion,
    20000,
    'lock impact migration completion',
  )
  assertPsqlSucceeded(migrationResult, 'lock impact migration')
  const probeResults = await Promise.all(
    probes.map((probe) => withTimeout(probe.session.completion, 20000, `${probe.name} probe completion`)),
  )
  for (const [index, result] of probeResults.entries()) {
    assertPsqlSucceeded(result, `${probes[index].name} post-lock probe`)
  }
  relationLockMetrics.commitLockMilliseconds = Math.max(
    relationLockMetrics.commitLockMilliseconds,
    Date.now() - migrationStartedAt,
  )
}

async function runRelationLockTimeoutScenario(database) {
  const holderApplication = 'lp_lock_timeout_holder'
  const holder = startPsql(
    database,
    `
      begin;
      lock table public.product_orders in access exclusive mode;
      select pg_catalog.pg_sleep(600);
      commit;
    `,
    holderApplication,
  )
  await waitForQuery(
    database,
    `
      select pg_catalog.count(*)::text
      from pg_catalog.pg_stat_activity as activity
      join pg_catalog.pg_locks as held_lock
        on held_lock.pid = activity.pid
       and held_lock.locktype = 'relation'
       and held_lock.relation = 'public.product_orders'::regclass
       and held_lock.mode = 'AccessExclusiveLock'
       and held_lock.granted
      where activity.application_name = '${holderApplication}';
    `,
    (output) => output === '1',
    'relation lock timeout holder',
  )
  const startedAt = Date.now()
  const result = psqlResult(database, readFileSync(migration, 'utf8'))
  relationLockMetrics.timeoutMilliseconds = Date.now() - startedAt
  if (
    result.status === 0
    || !/canceling statement due to lock timeout/i.test(result.combinedOutput)
  ) {
    throw new Error(`migration did not fail closed on relation lock timeout\n${result.combinedOutput}`)
  }
  if (
    relationLockMetrics.timeoutMilliseconds < 4000
    || relationLockMetrics.timeoutMilliseconds > 15000
  ) {
    throw new Error(`unexpected relation lock timeout duration: ${relationLockMetrics.timeoutMilliseconds}ms`)
  }
  assertMigrationRollback(database, 'relation lock timeout')
  assertNoLinePayRoles(database, 'relation lock timeout')
  await terminateApplication(database, holderApplication, 'release relation lock timeout holder')
  await withTimeout(holder.completion, 5000, 'relation lock timeout holder exit')
}

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

  const nonCheckConstraintCases = [
    {
      name: 'constraint-unique',
      contype: 'u',
      setupSql: `
        alter table public.product_orders
          drop constraint product_orders_payment_method_check;
        alter table public.product_orders
          add constraint product_orders_payment_method_check unique (id);
      `,
    },
    {
      name: 'constraint-primary-key',
      contype: 'p',
      setupSql: `
        alter table public.product_orders
          drop constraint product_orders_payment_method_check;
        alter table public.product_orders
          add constraint product_orders_id_finding_a_unique unique (id);
        do $$
        declare
          dependency record;
        begin
          for dependency in
            select foreign_key.conrelid::pg_catalog.regclass as relation_name,
                   foreign_key.conname
            from pg_catalog.pg_constraint as foreign_key
            where foreign_key.contype = 'f'
              and foreign_key.confrelid = 'public.product_orders'::pg_catalog.regclass
          loop
            execute pg_catalog.format(
              'alter table %s drop constraint %I',
              dependency.relation_name,
              dependency.conname
            );
          end loop;
        end
        $$;
        alter table public.product_orders drop constraint product_orders_pkey;
        alter table public.product_orders
          add constraint product_orders_payment_method_check primary key (id);
      `,
    },
    {
      name: 'constraint-foreign-key',
      contype: 'f',
      setupSql: `
        alter table public.product_orders
          drop constraint product_orders_payment_method_check;
        alter table public.product_orders
          add constraint product_orders_payment_method_check
          foreign key (user_id) references auth.users(id);
      `,
    },
    {
      name: 'constraint-exclude',
      contype: 'x',
      setupSql: `
        create extension if not exists btree_gist;
        alter table public.product_orders
          drop constraint product_orders_payment_method_check;
        alter table public.product_orders
          add constraint product_orders_payment_method_check
          exclude using gist (id with =);
      `,
    },
  ]

  for (const { name, contype, setupSql } of nonCheckConstraintCases) {
    scenarioCount += runScenario(
      name,
      (database) => psql(database, setupSql, `${name} fixture`),
      (database) => {
        const before = readPaymentMethodConstraintFingerprint(database, name)
        const beforeType = JSON.parse(before).contype
        if (beforeType !== contype) {
          throw new Error(`${name} fixture has contype ${beforeType}, expected ${contype}`)
        }

        if (expectFindingAGuardMutation) {
          psqlFile(database, migration, `${name} mutated migration`)
          const afterMutation = readPaymentMethodConstraintFingerprint(database, `${name} mutated`)
          const afterMutationType = JSON.parse(afterMutation).contype
          if (afterMutationType !== 'c' || afterMutation === before) {
            throw new Error(`${name} mutation did not reproduce unsafe non-CHECK replacement`)
          }
          throw new Error(`FINDING_A_GUARD_MUTATION_CAUGHT:${name}:unsafe_non_check_replacement`)
        }

        applyMigrationExpectFailure(
          database,
          /product_orders_payment_method_constraint_type_conflict/,
          name,
        )
        assertNoLinePayRoles(database, name)
        const after = readPaymentMethodConstraintFingerprint(database, `${name} preserved`)
        if (after !== before) {
          throw new Error(`${name} constraint type, definition, or metadata changed after rollback`)
        }
      },
    )
  }

  scenarioCount += await runAsyncScenario(
    'relation-lock-commit',
    runRelationLockCommitScenario,
  )
  scenarioCount += await runAsyncScenario(
    'relation-lock-rollback',
    runRelationLockRollbackScenario,
  )
  scenarioCount += await runAsyncScenario(
    'relation-lock-preexisting-unknown',
    runPreexistingUnknownConstraintScenario,
  )
  scenarioCount += await runAsyncScenario(
    'relation-lock-impact',
    runRelationLockImpactScenario,
  )
  scenarioCount += await runAsyncScenario(
    'relation-lock-timeout',
    runRelationLockTimeoutScenario,
  )

  if (selectedScenario === null) {
    process.stdout.write(
      `relation_lock_impact: select=blocked writes=blocked alter_table=blocked impact_observation_ms=${relationLockMetrics.impactWaitMilliseconds} migration_lock_ms=${relationLockMetrics.commitLockMilliseconds} rollback_release_ms=${relationLockMetrics.rollbackReleaseMilliseconds} timeout_ms=${relationLockMetrics.timeoutMilliseconds}\n`,
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
