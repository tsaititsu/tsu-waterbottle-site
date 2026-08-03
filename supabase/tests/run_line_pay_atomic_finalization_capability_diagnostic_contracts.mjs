import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseAndValidateCapabilityDiagnosticOutput } from '../../scripts/supabase/validate-line-pay-atomic-finalization-capability-diagnostic.mjs'
import { LINE_PAY_POSTGRES_IMAGE } from './line_pay_postgres_image.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const taskLabel = 'line-pay-atomic-finalization-capability-diagnostic'
const containerName = `${taskLabel}-${randomBytes(6).toString('hex')}`
const password = randomBytes(32).toString('base64url')
const diagnosticFile =
  'supabase/deployment/line_pay_atomic_confirmation_finalization_capability_diagnostic.sql'

function runDocker(args) {
  const result = spawnSync('docker', args, { cwd: root, encoding: 'utf8' })
  if (result.error?.code === 'ENOENT') {
    throw new Error('LOCAL_DB_RUNTIME_UNAVAILABLE')
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'LOCAL_DB_COMMAND_FAILED')
  }
  return result.stdout.trim()
}

function postgresSql(sql) {
  return runDocker([
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
    '--command',
    sql,
  ])
}

function runDiagnostic() {
  return runDocker([
    'exec',
    '--env',
    'PGPASSWORD=diagnostic-test-password',
    containerName,
    'psql',
    '--no-psqlrc',
    '--set=ON_ERROR_STOP=1',
    '--quiet',
    '--no-align',
    '--tuples-only',
    '--username=diagnostic_login',
    '--dbname=postgres',
    `--file=/workspace/${diagnosticFile}`,
  ])
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
        '--no-psqlrc',
        '--quiet',
        '--no-align',
        '--tuples-only',
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

function assertDecision(result, stage, relations) {
  if (
    result.decision.blocking_stage !== stage ||
    JSON.stringify(result.decision.blocking_relations) !==
      JSON.stringify(relations)
  ) {
    throw new Error(`UNEXPECTED_CAPABILITY_DECISION:${stage}`)
  }
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

  postgresSql(`
    create role diagnostic_login login password 'diagnostic-test-password';
    create schema line_pay_private;
    create table public.product_orders(id bigint);
    create table public.payments(id bigint);
    create table public.line_pay_checkout_attempts(id bigint);
    create table public.line_pay_request_outbox(id bigint);
    create table public.line_pay_callback_capabilities(id bigint);
    create table public.line_pay_callback_events(id bigint);
    create table public.line_pay_payment_audit_events(id bigint);
    create table line_pay_private.line_pay_completion_proofs(id bigint);
    grant usage on schema public, line_pay_private to diagnostic_login;
    grant select on all tables in schema public, line_pay_private
      to diagnostic_login;
  `)

  const selectOnly = parseAndValidateCapabilityDiagnosticOutput(
    `${runDiagnostic()}\n`,
  )
  assertDecision(selectOnly, 'LOCK_CAPABILITY_MISSING', [
    'product_orders',
    'payments',
    'checkout_attempts',
    'request_outbox',
    'callback_capabilities',
    'callback_events',
    'audit_events',
    'completion_proofs',
  ])

  postgresSql(`
    grant maintain on all tables in schema public, line_pay_private
      to diagnostic_login;
  `)
  const fullyCapable = parseAndValidateCapabilityDiagnosticOutput(
    `${runDiagnostic()}\n`,
  )
  assertDecision(fullyCapable, 'CAPABILITY_READY', [])

  postgresSql(`
    revoke select on public.line_pay_payment_audit_events
      from diagnostic_login;
  `)
  const selectGap = parseAndValidateCapabilityDiagnosticOutput(
    `${runDiagnostic()}\n`,
  )
  assertDecision(
    selectGap,
    'FINGERPRINT_READ_CAPABILITY_MISSING',
    ['audit_events'],
  )

  const rowCount = postgresSql(`
    select
      (select count(*) from public.product_orders)
      + (select count(*) from public.payments)
      + (select count(*) from public.line_pay_checkout_attempts)
      + (select count(*) from public.line_pay_request_outbox)
      + (select count(*) from public.line_pay_callback_capabilities)
      + (select count(*) from public.line_pay_callback_events)
      + (select count(*) from public.line_pay_payment_audit_events)
      + (select count(*) from line_pay_private.line_pay_completion_proofs);
  `)
  if (rowCount !== '0') throw new Error('DIAGNOSTIC_CHANGED_DATA')

  process.stdout.write(
    'line_pay_atomic_finalization_capability_diagnostic_contracts: PASS ' +
      '(PostgreSQL 17, SELECT-only lock gap, MAINTAIN readiness, ' +
      'single fingerprint gap, and zero data writes)\n',
  )
} finally {
  if (started) {
    spawnSync('docker', ['rm', '--force', containerName], {
      cwd: root,
      encoding: 'utf8',
    })
  }
}
