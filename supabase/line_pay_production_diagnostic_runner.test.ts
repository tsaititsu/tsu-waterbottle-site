import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test, { before } from 'node:test'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const runnerPath = join(
  root,
  'scripts/supabase/run-line-pay-production-diagnostic.mjs',
)
const validatorPath = join(
  root,
  'scripts/supabase/validate-line-pay-production-diagnostic.mjs',
)
let runner: any
let validator: any

before(async () => {
  ;[runner, validator] = await Promise.all([
    import(pathToFileURL(runnerPath).href),
    import(pathToFileURL(validatorPath).href),
  ])
})

const VALID_SHA = 'a'.repeat(40)
const baseEnvironment = Object.freeze({
  GITHUB_REPOSITORY: 'tsaititsu/tsu-waterbottle-site',
  GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_REF: 'refs/heads/main',
  GITHUB_SHA: VALID_SHA,
  AUTHORIZED_COMMIT: VALID_SHA,
  PROJECT_REF_INPUT: 'ndbqoznvobmpkgxkiezz',
  DIAGNOSTIC_CONFIRMATION:
    'RUN_LINE_PAY_PRODUCTION_DRIFT_DIAGNOSTIC_READ_ONLY_ONCE',
})

const safeOutput = Object.freeze({
  status: 'DIAGNOSTIC_COMPLETED',
  database_identity_match: true,
  line_pay_unapplied: true,
  migration_history_absent: true,
  fence_match: true,
  datasets: Object.freeze([
    Object.freeze({
      dataset: 'bank_transfer',
      expected_rows: 3,
      actual_rows: 3,
      rows_match: true,
      pk_digest_match: true,
      content_digest_match: true,
      expected_pending_review: 3,
      actual_pending_review: 3,
      pending_review_match: true,
    }),
    Object.freeze({
      dataset: 'payments',
      expected_rows: 18,
      actual_rows: 18,
      rows_match: true,
      pk_digest_match: true,
      content_digest_match: true,
    }),
    Object.freeze({
      dataset: 'product_orders',
      expected_rows: 5,
      actual_rows: 5,
      rows_match: true,
      pk_digest_match: true,
      content_digest_match: true,
    }),
  ]),
})

test('fixed source and runtime identities are exact', () => {
  assert.equal(validator.EXPECTED_REPOSITORY, 'tsaititsu/tsu-waterbottle-site')
  assert.equal(validator.EXPECTED_PROJECT_REF, 'ndbqoznvobmpkgxkiezz')
  assert.equal(validator.EXPECTED_EVENT, 'workflow_dispatch')
  assert.equal(validator.EXPECTED_REF, 'refs/heads/main')
  assert.equal(validator.EXPECTED_NODE_VERSION, 'v24.16.0')
  assert.equal(
    validator.EXPECTED_CONFIRMATION,
    'RUN_LINE_PAY_PRODUCTION_DRIFT_DIAGNOSTIC_READ_ONLY_ONCE',
  )
  assert.equal(
    validator.POSTGRES_IMAGE,
    'postgres@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193',
  )
  assert.equal(
    validator.DIAGNOSTIC_FILE,
    'supabase/deployment/line_pay_remediation_diagnostic.sql',
  )
})

test('workflow context fails closed on every identity mismatch', () => {
  assert.equal(validator.validateWorkflowContext(baseEnvironment), true)
  for (const [key, value] of [
    ['GITHUB_REPOSITORY', 'other/repository'],
    ['GITHUB_EVENT_NAME', 'push'],
    ['GITHUB_REF', 'refs/heads/feature'],
    ['GITHUB_SHA', 'b'.repeat(40)],
    ['AUTHORIZED_COMMIT', 'short'],
    ['PROJECT_REF_INPUT', 'otherprojectref00000'],
    ['DIAGNOSTIC_CONFIRMATION', 'RUN'],
  ]) {
    assert.throws(
      () =>
        validator.validateWorkflowContext({
          ...baseEnvironment,
          [key]: value,
        }),
      /SOURCE_CONTEXT_INVALID/,
    )
  }
})

test('diagnostic output accepts mismatches and returns a frozen allowlisted copy', () => {
  const drift: any = structuredClone(safeOutput)
  drift.datasets[1].actual_rows = 19
  drift.datasets[1].rows_match = false
  const parsed = validator.parseAndValidateDiagnosticOutput(
    `${JSON.stringify(drift)}\n`,
  )
  assert.deepEqual(parsed, drift)
  assert.equal(Object.isFrozen(parsed), true)
  assert.equal(Object.isFrozen(parsed.datasets), true)
  for (const dataset of parsed.datasets) {
    assert.equal(Object.isFrozen(dataset), true)
  }
})

test('diagnostic output rejects extra fields, wrong order, invalid counts, and secrets', () => {
  const mutations = [
    { ...structuredClone(safeOutput), extra: true },
    {
      ...structuredClone(safeOutput),
      datasets: [...safeOutput.datasets].reverse(),
    },
    {
      ...structuredClone(safeOutput),
      datasets: safeOutput.datasets.map((dataset, index) =>
        index === 0 ? { ...dataset, actual_rows: -1 } : dataset,
      ),
    },
    {
      ...structuredClone(safeOutput),
      datasets: safeOutput.datasets.map((dataset, index) =>
        index === 0
          ? { ...dataset, leak: 'postgresql://user:pass@example.invalid/db' }
          : dataset,
      ),
    },
  ]
  for (const mutation of mutations) {
    assert.throws(
      () =>
        validator.parseAndValidateDiagnosticOutput(
          `${JSON.stringify(mutation)}\n`,
        ),
      /DIAGNOSTIC_OUTPUT_INVALID/,
    )
  }
  for (const sensitive of [
    'postgres://',
    'example.supabase.co',
    'pooler.supabase.com',
    'person@example.com',
    '21000000-0000-4000-8000-000000000001',
    'a'.repeat(40),
    'b'.repeat(64),
    'Authorization',
    'Bearer',
    'password',
    'secret',
    'token',
  ]) {
    assert.throws(
      () => validator.parseAndValidateDiagnosticOutput(sensitive),
      /DIAGNOSTIC_OUTPUT_INVALID/,
    )
  }
})

test('runner has a fixed single-session read-only Docker boundary', () => {
  const connection = runner.parseDatabaseUrl(
    'postgresql://postgres:synthetic@db.ndbqoznvobmpkgxkiezz.supabase.co:5432/postgres?sslmode=require',
    'ndbqoznvobmpkgxkiezz',
  )
  const args = runner.buildDockerRunArgs(
    connection,
    '/tmp/synthetic-pgpass',
  )
  assert.equal(args[0], 'run')
  for (const token of [
    '--rm',
    '--read-only',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges',
    '--pull=never',
  ]) {
    assert.ok(args.includes(token))
  }
  assert.ok(
    args.some(
      (value: string) =>
        value.includes('target=/workspace') && value.endsWith(',readonly'),
    ),
  )
  assert.ok(
    args.some(
      (value: string) =>
        value.includes('target=/run/secrets/pgpass') &&
        value.endsWith(',readonly'),
    ),
  )
  assert.equal(args.includes('/var/run/docker.sock'), false)
  assert.equal(
    args.at(-1),
    `--file=${runner.DIAGNOSTIC_CONTAINER_FILE}`,
  )
  const environment = runner.buildChildEnvironment(connection)
  assert.match(environment.PGOPTIONS, /default_transaction_read_only=on/u)
  assert.match(environment.PGOPTIONS, /statement_timeout=120000/u)
  assert.match(environment.PGOPTIONS, /lock_timeout=15000/u)
  assert.match(
    environment.PGOPTIONS,
    /idle_in_transaction_session_timeout=30000/u,
  )
})

test('runner rejects arbitrary URL targets and command-line arguments', () => {
  for (const url of [
    'https://example.com/',
    'postgresql://postgres:synthetic@example.com:5432/postgres',
    'postgresql://postgres:synthetic@db.otherprojectref00000.supabase.co:5432/postgres',
    'postgresql://postgres:synthetic@db.ndbqoznvobmpkgxkiezz.supabase.co:5433/postgres',
  ]) {
    assert.throws(
      () => runner.parseDatabaseUrl(url, 'ndbqoznvobmpkgxkiezz'),
      /DATABASE_(?:URL_INVALID|TARGET_MISMATCH)/,
    )
  }
  assert.equal(runner.validateCliArguments(['node', 'runner.mjs']), true)
  assert.throws(
    () => runner.validateCliArguments(['node', 'runner.mjs', 'sql']),
    /SOURCE_CONTEXT_INVALID/,
  )
  assert.throws(
    () => runner.validateCliArguments(['node', 'runner.mjs', '/tmp/file']),
    /SOURCE_CONTEXT_INVALID/,
  )
})

test('SQL mutations are caught before any database session', () => {
  const sql = readFileSync(validator.DIAGNOSTIC_FILE, 'utf8')
  const mutations = [
    sql.replace(', READ ONLY', ''),
    sql.replace('ROLLBACK;', ''),
    sql.replace('ROLLBACK;', 'INSERT INTO audit_log VALUES (1); ROLLBACK;'),
    sql.replace('ROLLBACK;', 'UPDATE public.payments SET status = status; ROLLBACK;'),
    sql.replace('ROLLBACK;', 'DELETE FROM public.payments; ROLLBACK;'),
    sql.replace(
      "'pk_digest_match'",
      "'actual_digest', payment_fingerprint.pk_digest, 'pk_digest_match'",
    ),
    sql.replace(
      "'pk_digest_match'",
      "'primary_key', payment_fingerprint.pk_digest, 'pk_digest_match'",
    ),
  ]
  for (const mutation of mutations) {
    assert.throws(
      () => validator.assertDiagnosticSql(mutation),
      /DIAGNOSTIC_SQL_INVALID/,
    )
  }
})

test('runner source mutations cannot weaken image, shell, retry, fallback, session, or cleanup', () => {
  const source = readFileSync(
    'scripts/supabase/run-line-pay-production-diagnostic.mjs',
    'utf8',
  )
  assert.equal(validator.assertRunnerSource(source), true)
  const mutations = [
    source.replace(
      'validatePostgresImage(POSTGRES_IMAGE)',
      "validatePostgresImage('postgres:17')",
    ),
    source.replace('shell: false', 'shell: true'),
    source.replace(
      'const dockerRunArgs = buildDockerRunArgs(',
      'for (let retry = 0; retry < 2; retry += 1) {}\\nconst dockerRunArgs = buildDockerRunArgs(',
    ),
    source.replace(
      'const dockerRunArgs = buildDockerRunArgs(',
      "const fallback = 'host psql'\\nconst dockerRunArgs = buildDockerRunArgs(",
    ),
    source.replace(
      'const dockerRunArgs = buildDockerRunArgs(',
      'const secondDatabaseSession = true\\nconst dockerRunArgs = buildDockerRunArgs(',
    ),
    source.replace('await cleanupCredentialsOnce()', 'void credentials'),
  ]
  for (const mutation of mutations) {
    assert.throws(
      () => validator.assertRunnerSource(mutation),
      /DIAGNOSTIC_SQL_INVALID/,
    )
  }
})

test('validator source mutation cannot remove the output allowlist', () => {
  const source = readFileSync(
    'scripts/supabase/validate-line-pay-production-diagnostic.mjs',
    'utf8',
  )
  assert.equal(validator.assertValidatorSource(source), true)
  const mutation = source.replace(
    "assertExactKeys(value, TOP_LEVEL_KEYS, 'DIAGNOSTIC_OUTPUT_INVALID')",
    'void value',
  )
  assert.throws(
    () => validator.assertValidatorSource(mutation),
    /DIAGNOSTIC_SQL_INVALID/,
  )
})

test('safe failure output is restricted to the approved code list', () => {
  for (const code of validator.SAFE_FAILURE_CODES) {
    assert.equal(validator.safeErrorCode(new Error(code)), code)
  }
  assert.equal(
    validator.safeErrorCode(new Error('sensitive internal details')),
    'DIAGNOSTIC_PSQL_FAILED',
  )
})
