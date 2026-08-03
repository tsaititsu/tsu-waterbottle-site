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

function psqlArgs() {
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
    '--username=postgres',
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

  const preflightOutput = `${psqlFile(preflightFile)}\n`
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
    throw new Error('DEPLOY_ATTESTATION_INCOMPLETE')
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
      'data fingerprint preserved, grantor/role/ACL contracts, and ACL mutation caught)\n',
  )
} finally {
  if (started) {
    spawnSync('docker', ['rm', '--force', containerName], {
      cwd: root,
      encoding: 'utf8',
    })
  }
}
