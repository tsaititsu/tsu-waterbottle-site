import { spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { inspectDeployOutput } from '../../scripts/supabase/run-line-pay-production-exact-file.mjs'
import {
  EXPECTED_DEPLOY_SHA256,
  EXPECTED_DIAGNOSTIC_SHA256,
  EXPECTED_MIGRATION_SHA256,
  EXPECTED_POSTFLIGHT_SHA256,
  EXPECTED_PREFLIGHT_SHA256,
  parseAndValidateAtomicDeployOutput,
  parseAndValidateAtomicOutput,
  parseAndValidateAtomicPreflightOutput,
} from '../../scripts/supabase/validate-line-pay-atomic-confirmation-finalization-production.mjs'
import { LINE_PAY_POSTGRES_IMAGE } from './line_pay_postgres_image.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const taskLabel = 'line-pay-atomic-finalization-production'
const containerName = `${taskLabel}-${randomBytes(6).toString('hex')}`
const password = randomBytes(32).toString('base64url')
const baselineFiles = [
  'supabase/schema.sql',
  'supabase/bank_transfer_submissions_patch.sql',
  'supabase/newebpay_payments_patch.sql',
  'supabase/payments_service_role_grants.sql',
  'supabase/product_orders_schema_draft.sql',
  'supabase/migrations/20260707_line_pay_provider_schema_draft.sql',
]
const baseMigration =
  'supabase/migrations/20260719033404_line_pay_remediation_contracts.sql'
const initializerMigration =
  'supabase/migrations/20260728053215_line_pay_checkout_aggregate_initialization.sql'
const migrationFile =
  'supabase/migrations/20260802160000_line_pay_atomic_confirmation_finalization.sql'
const diagnosticFile =
  'supabase/deployment/line_pay_atomic_confirmation_finalization_application_state.sql'
const preflightFile =
  'supabase/deployment/line_pay_atomic_confirmation_finalization_preflight.sql'
const postflightFile =
  'supabase/deployment/line_pay_atomic_confirmation_finalization_postflight.sql'
const deployFile =
  'supabase/deployment/line_pay_atomic_confirmation_finalization_deploy.sql'

function sha256(path) {
  return createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex')
}

function runDocker(args) {
  const result = spawnSync('docker', args, { cwd: root, encoding: 'utf8' })
  if (result.error?.code === 'ENOENT') throw new Error('LOCAL_DB_RUNTIME_UNAVAILABLE')
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'LOCAL_DB_COMMAND_FAILED')
  }
  return result.stdout.trim()
}

function psqlArgs(username = 'postgres') {
  return [
    'exec',
    '--env',
    `PGPASSWORD=${password}`,
    containerName,
    'psql',
    '--no-psqlrc',
    '--set=ON_ERROR_STOP=1',
    '--quiet',
    '--no-align',
    '--tuples-only',
    `--username=${username}`,
    '--dbname=postgres',
  ]
}

function psqlSql(sql) {
  const result = spawnSync('docker', [...psqlArgs(), '--command', sql], {
    cwd: root,
    encoding: 'utf8',
  })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout)
  return result.stdout.trim()
}

function psqlSqlAs(username, sql) {
  const result = spawnSync(
    'docker',
    [...psqlArgs(username), '--command', sql],
    {
      cwd: root,
      encoding: 'utf8',
    },
  )
  if (result.status !== 0) throw new Error(result.stderr || result.stdout)
  return result.stdout.trim()
}

function psqlSqlExpectFailure(username, sql, expectedFailure) {
  const result = spawnSync('docker', [...psqlArgs(username), '--command', sql], {
    cwd: root,
    encoding: 'utf8',
  })
  if (result.status === 0) {
    throw new Error('EXPECTED_DATABASE_FAILURE_NOT_OBSERVED')
  }
  if (!`${result.stderr}\n${result.stdout}`.includes(expectedFailure)) {
    throw new Error('UNEXPECTED_DATABASE_FAILURE')
  }
}

function psqlFile(path) {
  const result = spawnSync(
    'docker',
    [...psqlArgs(), `--file=/workspace/${path}`],
    { cwd: root, encoding: 'utf8' },
  )
  if (result.status !== 0) {
    throw new Error(`${path}\n${result.stderr || result.stdout}`)
  }
  return result.stdout.trim()
}

function waitForPostgres() {
  let consecutiveReadyChecks = 0
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = spawnSync(
      'docker',
      [
        'exec',
        '--env',
        `PGPASSWORD=${password}`,
        containerName,
        'psql',
        '-X',
        '-A',
        '-t',
        '--username=postgres',
        '--dbname=postgres',
        '--command=select 1;',
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

function dataSnapshot() {
  return psqlSql(`
    select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      pg_catalog.jsonb_build_object(
        'product_orders', (select pg_catalog.to_jsonb(pg_catalog.array_agg(row_value order by row_value.id)) from public.product_orders as row_value),
        'payments', (select pg_catalog.to_jsonb(pg_catalog.array_agg(row_value order by row_value.id)) from public.payments as row_value),
        'attempts', (select pg_catalog.to_jsonb(pg_catalog.array_agg(row_value order by row_value.id)) from public.line_pay_checkout_attempts as row_value),
        'outbox', (select pg_catalog.to_jsonb(pg_catalog.array_agg(row_value order by row_value.id)) from public.line_pay_request_outbox as row_value),
        'capabilities', (select pg_catalog.to_jsonb(pg_catalog.array_agg(row_value order by row_value.id)) from public.line_pay_callback_capabilities as row_value),
        'callbacks', (select pg_catalog.to_jsonb(pg_catalog.array_agg(row_value order by row_value.id)) from public.line_pay_callback_events as row_value),
        'audit', (select pg_catalog.to_jsonb(pg_catalog.array_agg(row_value order by row_value.id)) from public.line_pay_payment_audit_events as row_value),
        'proofs', (select pg_catalog.to_jsonb(pg_catalog.array_agg(row_value order by row_value.id)) from line_pay_private.line_pay_completion_proofs as row_value)
      )::text,
      'UTF8'
    )), 'hex');
  `)
}

function verifyOwnerLockBridge() {
  psqlSql(`
    create role line_pay_atomic_deployment_fixture
      login noinherit nosuperuser nocreatedb nocreaterole
      noreplication nobypassrls;
    grant maintain on table
      public.product_orders,
      public.payments,
      public.line_pay_checkout_attempts,
      public.line_pay_request_outbox,
      public.line_pay_callback_capabilities,
      public.line_pay_callback_events,
      public.line_pay_payment_audit_events
    to line_pay_atomic_deployment_fixture;
    grant usage on schema line_pay_private
    to line_pay_atomic_deployment_fixture;
    grant select on table line_pay_private.line_pay_completion_proofs
    to line_pay_atomic_deployment_fixture;
    grant line_pay_payment_function_owner
    to line_pay_atomic_deployment_fixture
      with admin true, inherit false, set false;
  `)

  const bridgeResult = psqlSqlAs(
    'line_pay_atomic_deployment_fixture',
    `
    begin;
    lock table public.product_orders in access exclusive mode;
    grant line_pay_payment_function_owner to current_user
      with admin false, inherit false, set true;
    set local role line_pay_payment_function_owner;
    lock table line_pay_private.line_pay_completion_proofs
      in access exclusive mode;
    reset role;
    revoke line_pay_payment_function_owner from current_user
      granted by current_user;
    select
      current_user = 'line_pay_atomic_deployment_fixture',
      not pg_catalog.has_table_privilege(
        current_user,
        'line_pay_private.line_pay_completion_proofs',
        'MAINTAIN'
      ),
      not exists (
        select 1
        from pg_catalog.pg_auth_members as membership
        join pg_catalog.pg_roles as granted_role
          on granted_role.oid = membership.roleid
        join pg_catalog.pg_roles as member_role
          on member_role.oid = membership.member
        join pg_catalog.pg_roles as grantor_role
          on grantor_role.oid = membership.grantor
        where granted_role.rolname = 'line_pay_payment_function_owner'
          and member_role.rolname = current_user
          and grantor_role.rolname = current_user
      ),
      exists (
        select 1
        from pg_catalog.pg_auth_members as membership
        join pg_catalog.pg_roles as granted_role
          on granted_role.oid = membership.roleid
        join pg_catalog.pg_roles as member_role
          on member_role.oid = membership.member
        join pg_catalog.pg_roles as grantor_role
          on grantor_role.oid = membership.grantor
        where granted_role.rolname = 'line_pay_payment_function_owner'
          and member_role.rolname = current_user
          and grantor_role.rolname <> current_user
          and membership.admin_option
          and not membership.inherit_option
          and not membership.set_option
      ),
      (
        select pg_catalog.count(*)
        from pg_catalog.pg_locks as lock
        where lock.pid = pg_catalog.pg_backend_pid()
          and lock.locktype = 'relation'
          and lock.mode = 'AccessExclusiveLock'
          and lock.granted
          and lock.relation in (
            'public.product_orders'::regclass,
            'line_pay_private.line_pay_completion_proofs'::regclass
          )
      ) = 2;
    commit;
  `,
  )
  if (bridgeResult !== 't|t|t|t|t') {
    throw new Error(`OWNER_LOCK_BRIDGE_NOT_PROVEN:${bridgeResult}`)
  }

  psqlSqlExpectFailure(
    'line_pay_atomic_deployment_fixture',
    `
      begin;
      grant line_pay_payment_function_owner to current_user
        with admin false, inherit false, set true;
      do $$
      begin
        raise exception 'owner_lock_bridge_forced_rollback';
      end
      $$;
      commit;
    `,
    'owner_lock_bridge_forced_rollback',
  )

  const rollbackResult = psqlSql(`
    select
      not exists (
        select 1
        from pg_catalog.pg_auth_members as membership
        join pg_catalog.pg_roles as granted_role
          on granted_role.oid = membership.roleid
        join pg_catalog.pg_roles as member_role
          on member_role.oid = membership.member
        join pg_catalog.pg_roles as grantor_role
          on grantor_role.oid = membership.grantor
        where granted_role.rolname = 'line_pay_payment_function_owner'
          and member_role.rolname = 'line_pay_atomic_deployment_fixture'
          and grantor_role.rolname = 'line_pay_atomic_deployment_fixture'
      )
      and exists (
        select 1
        from pg_catalog.pg_auth_members as membership
        join pg_catalog.pg_roles as granted_role
          on granted_role.oid = membership.roleid
        join pg_catalog.pg_roles as member_role
          on member_role.oid = membership.member
        join pg_catalog.pg_roles as grantor_role
          on grantor_role.oid = membership.grantor
        where granted_role.rolname = 'line_pay_payment_function_owner'
          and member_role.rolname = 'line_pay_atomic_deployment_fixture'
          and grantor_role.rolname = current_user
          and membership.admin_option
          and not membership.inherit_option
          and not membership.set_option
      );
  `)
  if (rollbackResult !== 't') {
    throw new Error('OWNER_LOCK_BRIDGE_ROLLBACK_NOT_PROVEN')
  }

  psqlSql(`
    revoke line_pay_payment_function_owner
    from line_pay_atomic_deployment_fixture;
    revoke maintain on table
      public.product_orders,
      public.payments,
      public.line_pay_checkout_attempts,
      public.line_pay_request_outbox,
      public.line_pay_callback_capabilities,
      public.line_pay_callback_events,
      public.line_pay_payment_audit_events
    from line_pay_atomic_deployment_fixture;
    revoke select on table line_pay_private.line_pay_completion_proofs
    from line_pay_atomic_deployment_fixture;
    revoke usage on schema line_pay_private
    from line_pay_atomic_deployment_fixture;
    drop role line_pay_atomic_deployment_fixture;
  `)
}

for (const [path, expected] of [
  [migrationFile, EXPECTED_MIGRATION_SHA256],
  [diagnosticFile, EXPECTED_DIAGNOSTIC_SHA256],
  [preflightFile, EXPECTED_PREFLIGHT_SHA256],
  [postflightFile, EXPECTED_POSTFLIGHT_SHA256],
  [deployFile, EXPECTED_DEPLOY_SHA256],
]) {
  if (sha256(path) !== expected) throw new Error(`SOURCE_SHA_MISMATCH:${path}`)
}

let started = false
try {
  runDocker([
    'run',
    '--detach',
    '--name',
    containerName,
    '--label',
    `task=${taskLabel}`,
    '--env',
    `POSTGRES_PASSWORD=${password}`,
    '--mount',
    `type=bind,source=${root},target=/workspace,readonly`,
    LINE_PAY_POSTGRES_IMAGE,
  ])
  started = true
  waitForPostgres()

  psqlFile('supabase/tests/line_pay_local_postgres_bootstrap.sql')
  psqlSql('create role authenticator nologin noinherit;')
  for (const file of baselineFiles) psqlFile(file)
  psqlFile(baseMigration)
  psqlFile(initializerMigration)
  verifyOwnerLockBridge()

  const preflightOutput = `${psqlFile(preflightFile)}\n`
  const preflightInventory = parseAndValidateAtomicOutput(preflightOutput)
  if (preflightInventory.application_state !== 'UNAPPLIED') {
    throw new Error(
      `UNAPPLIED_FIXTURE_NOT_PROVEN:${JSON.stringify(preflightInventory)}`,
    )
  }
  const preflight = parseAndValidateAtomicPreflightOutput(preflightOutput)
  if (preflight.application_state !== 'UNAPPLIED') {
    throw new Error('UNAPPLIED_STATE_NOT_OBSERVED')
  }

  const before = dataSnapshot()
  const deploymentOutput = psqlFile(deployFile)
  const evidence = inspectDeployOutput(deploymentOutput)
  if (
    !evidence.migration_commit_observed ||
    !evidence.postflight_commit_observed ||
    !evidence.markerSequenceValid
  ) {
    const observedMarkers = deploymentOutput
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => /^(?:LINE_PAY_DEPLOY_|ATOMIC_FINALIZATION_)/u.test(line))
      .join(',')
    throw new Error(`DEPLOY_ATTESTATION_INCOMPLETE:${observedMarkers}`)
  }
  const full = parseAndValidateAtomicDeployOutput(evidence.auditOutput)
  if (full.application_state !== 'FULL' || !full.contracts.atomic_exact) {
    throw new Error('FULL_STATE_NOT_OBSERVED')
  }
  if (before !== dataSnapshot()) throw new Error('HISTORICAL_DATA_CHANGED')

  psqlSql(`
    grant execute on function public.finalize_product_order_line_pay_confirmation(
      text, uuid, uuid, uuid, text, text, integer, text, uuid, uuid, uuid,
      text, text
    ) to service_role;
  `)
  const aclMutation = parseAndValidateAtomicOutput(
    `${psqlFile(postflightFile)}\n`,
  )
  if (
    aclMutation.application_state !== 'PARTIAL' ||
    aclMutation.contracts.wrapper_acl_exact
  ) {
    throw new Error('WRAPPER_ACL_MUTATION_NOT_CAUGHT')
  }
  process.stdout.write(
    'line_pay_atomic_confirmation_finalization_production_contracts: PASS ' +
      '(PostgreSQL 17, UNAPPLIED/FULL, exact-file deploy, commit attestations, ' +
      'transaction-scoped owner lock bridge and rollback, data fingerprint ' +
      'preserved, grantor/role/ACL contracts, and ACL mutation caught)\n',
  )
} finally {
  if (started) {
    spawnSync('docker', ['rm', '--force', containerName], {
      cwd: root,
      encoding: 'utf8',
    })
  }
}
