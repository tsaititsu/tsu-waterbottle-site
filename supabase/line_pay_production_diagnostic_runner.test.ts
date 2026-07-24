import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
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

const sensitiveFixture = Object.freeze([
  'postgresql://postgres:fake-password@db.example.invalid:5432/postgres',
  'fake-password',
  '21000000-0000-4000-8000-000000000001',
  'person@example.invalid',
  'a'.repeat(40),
  'b'.repeat(64),
  'Bearer fake-token',
])

const productionEnvironment = Object.freeze({
  SUPABASE_PRODUCTION_CHANNEL_READY: 'true',
  SUPABASE_PRODUCTION_DB_URL:
    'postgresql://postgres:synthetic@db.ndbqoznvobmpkgxkiezz.supabase.co:5432/postgres?sslmode=require',
  SUPABASE_PROJECT_ID: 'ndbqoznvobmpkgxkiezz',
  RUNNER_TEMP: '/runner-temp',
  PATH: '/usr/bin:/bin',
})

function createFilesystem({
  credentialMode = 0o600,
  failCreate = false,
  failCleanup = false,
} = {}) {
  return {
    async stat(path: string) {
      if (path.endsWith('/pgpass')) {
        return { mode: credentialMode }
      }
      return { isDirectory: () => true }
    },
    async mkdtemp(prefix: string) {
      if (failCreate) throw new Error('synthetic create failure')
      return `${prefix}fixture`
    },
    async writeFile() {},
    async unlink() {
      if (failCleanup) throw new Error('synthetic cleanup failure')
    },
    async rmdir() {},
  }
}

function createChild({
  code = 0,
  signal = null,
  stdout = sensitiveFixture.join('\n'),
  stderr = sensitiveFixture.join('\n'),
  emitError = false,
  closeOnlyAfterKill = false,
} = {}) {
  const child: any = new EventEmitter()
  child.stdout = new PassThrough()
  child.stderr = new PassThrough()
  let closed = false
  const close = (nextCode = code, nextSignal = signal) => {
    if (closed) return
    closed = true
    child.stdout.end()
    child.stderr.end()
    child.emit('close', nextCode, nextSignal)
  }
  child.kill = () => {
    queueMicrotask(() => close(null, 'SIGTERM'))
    return true
  }
  queueMicrotask(() => {
    if (emitError) {
      child.emit('error', new Error('synthetic spawn failure'))
      return
    }
    if (stdout) child.stdout.write(stdout)
    if (stderr) child.stderr.write(stderr)
    if (!closeOnlyAfterKill) close()
  })
  return child
}

function createSpawnSequence(
  steps: Array<
    | { throw: true }
    | Parameters<typeof createChild>[0]
  >,
) {
  let executions = 0
  const spawnImplementation = () => {
    const step = steps[executions]
    executions += 1
    if (!step) throw new Error('unexpected extra process')
    if ('throw' in step && step.throw) {
      throw new Error('synthetic spawn failure')
    }
    return createChild(step)
  }
  return {
    spawnImplementation,
    get executions() {
      return executions
    },
  }
}

async function captureFailure({
  filesystem = createFilesystem(),
  processObject = process,
  steps,
}: {
  filesystem?: any
  processObject?: any
  steps: Array<{ throw: true } | Parameters<typeof createChild>[0]>
}) {
  const sequence = createSpawnSequence(steps)
  let caught: unknown
  try {
    await runner.runDiagnostic({
      environment: productionEnvironment,
      filesystem,
      processObject,
      spawnImplementation: sequence.spawnImplementation,
    })
  } catch (error) {
    caught = error
  }
  assert.ok(caught)
  const attestation = runner.toSafeFailureAttestation(caught)
  assert.equal(Object.isFrozen(attestation), true)
  assert.deepEqual(
    Object.keys(attestation).sort(),
    [
      'status',
      'phase',
      'failure_code',
      'docker_pull_completed',
      'container_started',
      'database_connection',
      'sql_completed',
      'output_validated',
      'credential_cleanup_completed',
    ].sort(),
  )
  const serialized = JSON.stringify(attestation)
  for (const sensitive of sensitiveFixture) {
    assert.equal(serialized.includes(sensitive), false)
  }
  return { attestation, executions: sequence.executions }
}

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
    sql.replace('\\gset', '\\include /tmp/arbitrary.sql'),
    sql.replace('\\gset', '\\! arbitrary-command'),
    sql.replace('\\if :diagnostic_shape_ready', ''),
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
    source.replace(
      'execution.state = DIAGNOSTIC_STATES.IMAGE_PULL_STARTED',
      'void execution.state',
    ),
    source.replace(
      'execution.state = DIAGNOSTIC_STATES.PSQL_COMPLETED',
      'void execution.state',
    ),
    source.replace(
      'JSON.stringify(toSafeFailureAttestation(error))',
      'String(error)',
    ),
    source.replace(
      'sanitizedResult = parseAndValidateDiagnosticOutput(result.stdout)',
      'console.error(result.stderr)\\n' +
        'sanitizedResult = parseAndValidateDiagnosticOutput(result.stdout)',
    ),
  ]
  for (const mutation of mutations) {
    assert.throws(
      () => validator.assertRunnerSource(mutation),
      /DIAGNOSTIC_SQL_INVALID/,
    )
  }
  assert.doesNotMatch(source, /else if \(!failure\)/u)
  assert.match(source, /validateFailureAttestation\(attestation\)/u)
  assert.match(
    source,
    /classifyFailureForState\(execution[.]state, error\)/u,
  )
})

test('runner exposes the exact monotonic execution state machine', () => {
  assert.deepEqual(runner.DIAGNOSTIC_STATES, {
    SOURCE_VALIDATED: 'SOURCE_VALIDATED',
    CREDENTIAL_CREATED: 'CREDENTIAL_CREATED',
    IMAGE_PULL_STARTED: 'IMAGE_PULL_STARTED',
    IMAGE_PULL_COMPLETED: 'IMAGE_PULL_COMPLETED',
    CONTAINER_STARTED: 'CONTAINER_STARTED',
    PSQL_COMPLETED: 'PSQL_COMPLETED',
    OUTPUT_VALIDATED: 'OUTPUT_VALIDATED',
    CREDENTIAL_CLEANED: 'CREDENTIAL_CLEANED',
  })
  assert.deepEqual(runner.DATABASE_CONNECTION_STATES, {
    CONFIRMED: 'CONFIRMED',
    NOT_ESTABLISHED: 'NOT_ESTABLISHED',
    UNKNOWN: 'UNKNOWN',
  })
})

test('failure attestation enums and state-only fallback mapping are exact', () => {
  const validAttestation = {
    status: 'DIAGNOSTIC_EXECUTION_FAILED',
    phase: 'psql_connection',
    failure_code: 'DIAGNOSTIC_DB_CONNECT_FAILED',
    docker_pull_completed: true,
    container_started: true,
    database_connection: 'NOT_ESTABLISHED',
    sql_completed: false,
    output_validated: false,
    credential_cleanup_completed: true,
  }
  assert.equal(
    runner.validateFailureAttestation(validAttestation),
    true,
  )
  for (const mutation of [
    { ...validAttestation, status: 'OTHER' },
    { ...validAttestation, phase: 'other_phase' },
    {
      ...validAttestation,
      failure_code: 'DIAGNOSTIC_CONTAINER_EXEC_FAILED',
    },
    { ...validAttestation, database_connection: 'MAYBE' },
    { ...validAttestation, sql_completed: 'false' },
    { ...validAttestation, extra: true },
  ]) {
    assert.throws(
      () => runner.validateFailureAttestation(mutation),
      /DIAGNOSTIC_CONTAINER_EXEC_FAILED/,
    )
  }

  for (const [state, expected] of [
    [
      runner.DIAGNOSTIC_STATES.SOURCE_VALIDATED,
      {
        code: 'DIAGNOSTIC_TEMP_CREDENTIAL_CREATE_FAILED',
        phase: 'credential_create',
      },
    ],
    [
      runner.DIAGNOSTIC_STATES.IMAGE_PULL_STARTED,
      {
        code: 'DIAGNOSTIC_DOCKER_IMAGE_PULL_FAILED',
        phase: 'docker_pull',
      },
    ],
    [
      runner.DIAGNOSTIC_STATES.IMAGE_PULL_COMPLETED,
      {
        code: 'DIAGNOSTIC_CONTAINER_START_FAILED',
        phase: 'docker_run_start',
      },
    ],
    [
      runner.DIAGNOSTIC_STATES.CONTAINER_STARTED,
      {
        code: 'DIAGNOSTIC_CONTAINER_EXEC_FAILED',
        phase: 'docker_run_start',
      },
    ],
    [
      runner.DIAGNOSTIC_STATES.PSQL_COMPLETED,
      {
        code: 'DIAGNOSTIC_OUTPUT_INVALID',
        phase: 'diagnostic_output',
      },
    ],
    [
      runner.DIAGNOSTIC_STATES.OUTPUT_VALIDATED,
      {
        code: 'TEMP_CREDENTIAL_CLEANUP_FAILED',
        phase: 'credential_cleanup',
      },
    ],
  ]) {
    assert.deepEqual(
      runner.classifyFailureForState(
        state,
        new Error('unexpected internal detail'),
      ),
      expected,
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

test('safe failure code list uses the execution observability taxonomy', () => {
  assert.deepEqual(
    [...validator.SAFE_FAILURE_CODES],
    [
      'SOURCE_CONTEXT_INVALID',
      'INVALID_NODE_VERSION',
      'POSTGRES_IMAGE_MISMATCH',
      'PRODUCTION_CHANNEL_NOT_READY',
      'DATABASE_TARGET_MISMATCH',
      'DATABASE_URL_INVALID',
      'DIAGNOSTIC_SQL_INVALID',
      'DIAGNOSTIC_DOCKER_IMAGE_PULL_FAILED',
      'DIAGNOSTIC_TEMP_CREDENTIAL_CREATE_FAILED',
      'DIAGNOSTIC_CONTAINER_START_FAILED',
      'DIAGNOSTIC_CONTAINER_EXEC_FAILED',
      'DIAGNOSTIC_DB_CONNECT_FAILED',
      'DIAGNOSTIC_SQL_EXECUTION_FAILED',
      'DIAGNOSTIC_OUTPUT_INVALID',
      'DIAGNOSTIC_CAPTURE_LIMIT_EXCEEDED',
      'PROCESS_INTERRUPTED',
      'TEMP_CREDENTIAL_CLEANUP_FAILED',
    ],
  )
  for (const code of validator.SAFE_FAILURE_CODES) {
    assert.equal(validator.safeErrorCode(new Error(code)), code)
  }
  assert.equal(
    validator.safeErrorCode(new Error('sensitive internal details')),
    'DIAGNOSTIC_CONTAINER_EXEC_FAILED',
  )
})

test('credential creation and permission failures are safely classified before Docker', async () => {
  for (const filesystem of [
    createFilesystem({ failCreate: true }),
    createFilesystem({ credentialMode: 0o644 }),
  ]) {
    const { attestation, executions } = await captureFailure({
      filesystem,
      steps: [],
    })
    assert.equal(executions, 0)
    assert.deepEqual(attestation, {
      status: 'DIAGNOSTIC_EXECUTION_FAILED',
      phase: 'credential_create',
      failure_code: 'DIAGNOSTIC_TEMP_CREDENTIAL_CREATE_FAILED',
      docker_pull_completed: false,
      container_started: false,
      database_connection: 'NOT_ESTABLISHED',
      sql_completed: false,
      output_validated: false,
      credential_cleanup_completed: true,
    })
  }
})

test('Docker pull spawn and exit failures have one fixed safe classification', async () => {
  for (const pullStep of [{ throw: true } as const, { code: 1 }]) {
    const { attestation, executions } = await captureFailure({
      steps: [pullStep],
    })
    assert.equal(executions, 1)
    assert.deepEqual(attestation, {
      status: 'DIAGNOSTIC_EXECUTION_FAILED',
      phase: 'docker_pull',
      failure_code: 'DIAGNOSTIC_DOCKER_IMAGE_PULL_FAILED',
      docker_pull_completed: false,
      container_started: false,
      database_connection: 'NOT_ESTABLISHED',
      sql_completed: false,
      output_validated: false,
      credential_cleanup_completed: true,
    })
  }
})

test('Docker run start and exec exit codes map without inspecting stderr', async () => {
  for (const scenario of [
    {
      runStep: { throw: true } as const,
      code: 'DIAGNOSTIC_CONTAINER_START_FAILED',
      phase: 'docker_run_start',
      started: false,
      connection: 'NOT_ESTABLISHED',
    },
    {
      runStep: { code: 125 },
      code: 'DIAGNOSTIC_CONTAINER_START_FAILED',
      phase: 'docker_run_start',
      started: false,
      connection: 'NOT_ESTABLISHED',
    },
    {
      runStep: { code: 126 },
      code: 'DIAGNOSTIC_CONTAINER_EXEC_FAILED',
      phase: 'docker_run_start',
      started: true,
      connection: 'NOT_ESTABLISHED',
    },
    {
      runStep: { code: 127 },
      code: 'DIAGNOSTIC_CONTAINER_EXEC_FAILED',
      phase: 'docker_run_start',
      started: true,
      connection: 'NOT_ESTABLISHED',
    },
    {
      runStep: { code: 9 },
      code: 'DIAGNOSTIC_CONTAINER_EXEC_FAILED',
      phase: 'docker_run_start',
      started: true,
      connection: 'UNKNOWN',
    },
  ]) {
    const { attestation, executions } = await captureFailure({
      steps: [{ code: 0 }, scenario.runStep],
    })
    assert.equal(executions, 2)
    assert.equal(attestation.failure_code, scenario.code)
    assert.equal(attestation.phase, scenario.phase)
    assert.equal(attestation.docker_pull_completed, true)
    assert.equal(attestation.container_started, scenario.started)
    assert.equal(
      attestation.database_connection,
      scenario.connection,
    )
    assert.equal(attestation.sql_completed, false)
  }
})

test('psql connection and SQL failures use documented exit semantics', async () => {
  for (const scenario of [
    {
      exitCode: 2,
      failureCode: 'DIAGNOSTIC_DB_CONNECT_FAILED',
      phase: 'psql_connection',
      connection: 'NOT_ESTABLISHED',
    },
    {
      exitCode: 3,
      failureCode: 'DIAGNOSTIC_SQL_EXECUTION_FAILED',
      phase: 'diagnostic_sql',
      connection: 'CONFIRMED',
    },
  ]) {
    const { attestation } = await captureFailure({
      steps: [{ code: 0 }, { code: scenario.exitCode }],
    })
    assert.equal(attestation.failure_code, scenario.failureCode)
    assert.equal(attestation.phase, scenario.phase)
    assert.equal(attestation.container_started, true)
    assert.equal(attestation.database_connection, scenario.connection)
    assert.equal(attestation.sql_completed, false)
  }
})

test('signals and capture limits never expose captured process output', async () => {
  const interrupted = await captureFailure({
    steps: [{ code: 0 }, { code: null, signal: 'SIGTERM' }],
  })
  assert.equal(interrupted.attestation.phase, 'process_signal')
  assert.equal(
    interrupted.attestation.failure_code,
    'PROCESS_INTERRUPTED',
  )
  assert.equal(interrupted.attestation.database_connection, 'UNKNOWN')

  const captureLimit = await captureFailure({
    steps: [
      { code: 0 },
      {
        stdout: 'x'.repeat(runner.MAX_CAPTURE_BYTES + 1),
        closeOnlyAfterKill: true,
      },
    ],
  })
  assert.equal(captureLimit.attestation.phase, 'diagnostic_output')
  assert.equal(
    captureLimit.attestation.failure_code,
    'DIAGNOSTIC_CAPTURE_LIMIT_EXCEEDED',
  )
  assert.equal(captureLimit.attestation.database_connection, 'UNKNOWN')
})

test('invalid and extra-field JSON fail after SQL completion with frozen safe output', async () => {
  for (const stdout of [
    'not-json\n',
    `${JSON.stringify({ ...safeOutput, extra: true })}\n`,
  ]) {
    const { attestation } = await captureFailure({
      steps: [{ code: 0 }, { code: 0, stdout }],
    })
    assert.deepEqual(attestation, {
      status: 'DIAGNOSTIC_EXECUTION_FAILED',
      phase: 'diagnostic_output',
      failure_code: 'DIAGNOSTIC_OUTPUT_INVALID',
      docker_pull_completed: true,
      container_started: true,
      database_connection: 'CONFIRMED',
      sql_completed: true,
      output_validated: false,
      credential_cleanup_completed: true,
    })
  }
})

test('credential cleanup failure overrides execution outcome without leaking credentials', async () => {
  const { attestation } = await captureFailure({
    filesystem: createFilesystem({ failCleanup: true }),
    steps: [{ code: 0 }, { code: 0, stdout: `${JSON.stringify(safeOutput)}\n` }],
  })
  assert.deepEqual(attestation, {
    status: 'DIAGNOSTIC_EXECUTION_FAILED',
    phase: 'credential_cleanup',
    failure_code: 'TEMP_CREDENTIAL_CLEANUP_FAILED',
    docker_pull_completed: true,
    container_started: true,
    database_connection: 'CONFIRMED',
    sql_completed: true,
    output_validated: true,
    credential_cleanup_completed: false,
  })

  const partialCredentialCleanup = await captureFailure({
    filesystem: createFilesystem({
      credentialMode: 0o644,
      failCleanup: true,
    }),
    steps: [],
  })
  assert.deepEqual(partialCredentialCleanup.attestation, {
    status: 'DIAGNOSTIC_EXECUTION_FAILED',
    phase: 'credential_cleanup',
    failure_code: 'TEMP_CREDENTIAL_CLEANUP_FAILED',
    docker_pull_completed: false,
    container_started: false,
    database_connection: 'NOT_ESTABLISHED',
    sql_completed: false,
    output_validated: false,
    credential_cleanup_completed: false,
  })
})

test('successful execution returns only the frozen aggregate result through one database session', async () => {
  const sequence = createSpawnSequence([
    { code: 0 },
    { code: 0, stdout: `${JSON.stringify(safeOutput)}\n` },
  ])
  const result = await runner.runDiagnostic({
    environment: productionEnvironment,
    filesystem: createFilesystem(),
    spawnImplementation: sequence.spawnImplementation,
  })
  assert.deepEqual(result, safeOutput)
  assert.equal(Object.isFrozen(result), true)
  assert.equal(sequence.executions, 2)
})
