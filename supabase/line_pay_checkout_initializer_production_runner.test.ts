import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const validatorPath = join(
  root,
  'scripts/supabase/validate-line-pay-checkout-initializer-production.mjs',
)
const initializerRunnerPath = join(
  root,
  'scripts/supabase/run-line-pay-checkout-initializer-exact-file.mjs',
)

test('initializer validator fixes the complete Production identity', async () => {
  const validator = await import(pathToFileURL(validatorPath).href)
  const migration = readFileSync(join(root, validator.MIGRATION_FILE))

  assert.equal(validator.EXPECTED_REPOSITORY, 'tsaititsu/tsu-waterbottle-site')
  assert.equal(validator.EXPECTED_PROJECT_REF, 'ndbqoznvobmpkgxkiezz')
  assert.equal(validator.EXPECTED_EVENT, 'workflow_dispatch')
  assert.equal(validator.EXPECTED_REF, 'refs/heads/main')
  assert.equal(validator.EXPECTED_NODE_VERSION, 'v24.16.0')
  assert.equal(
    validator.EXPECTED_CONFIRMATION,
    'DEPLOY_LINE_PAY_CHECKOUT_INITIALIZER_EXACT_FILE_ONCE',
  )
  assert.equal(
    validator.EXPECTED_DIAGNOSTIC_CONFIRMATION,
    'RUN_LINE_PAY_CHECKOUT_INITIALIZER_STATE_DIAGNOSTIC_READ_ONLY_ONCE',
  )
  assert.equal(
    validator.EXPECTED_BACKUP_CONFIRMATION,
    'CONFIRM_SUPABASE_BACKUP_PITR_RESTORE_POINT_AVAILABLE',
  )
  assert.equal(
    validator.MIGRATION_FILE,
    'supabase/migrations/20260728053215_line_pay_checkout_aggregate_initialization.sql',
  )
  assert.equal(
    createHash('sha256').update(migration).digest('hex'),
    '2e2ef2cce41431e0dc638033c998b7b616cbdc2b3baefdcb59fbb68ba2adf551',
  )
})

test('source gates reject branch, head, project, hash, and authorization drift', async () => {
  const validator = await import(pathToFileURL(validatorPath).href)
  const sha = 'a'.repeat(40)
  const valid = {
    GITHUB_REPOSITORY: validator.EXPECTED_REPOSITORY,
    GITHUB_EVENT_NAME: validator.EXPECTED_EVENT,
    GITHUB_REF: validator.EXPECTED_REF,
    GITHUB_SHA: sha,
    AUTHORIZED_COMMIT: sha,
    PROJECT_REF_INPUT: validator.EXPECTED_PROJECT_REF,
    MIGRATION_SHA256_INPUT: validator.EXPECTED_MIGRATION_SHA256,
    BACKUP_RESTORE_POINT_CONFIRMATION:
      validator.EXPECTED_BACKUP_CONFIRMATION,
    DEPLOY_CONFIRMATION: validator.EXPECTED_CONFIRMATION,
  }
  assert.equal(validator.validateDeploymentWorkflowContext(valid), true)

  for (const [key, value] of [
    ['GITHUB_REF', 'refs/heads/codex/not-main'],
    ['GITHUB_SHA', 'b'.repeat(40)],
    ['PROJECT_REF_INPUT', 'aaaaaaaaaaaaaaaaaaaa'],
    ['MIGRATION_SHA256_INPUT', '0'.repeat(64)],
    ['BACKUP_RESTORE_POINT_CONFIRMATION', 'CONFIRMED'],
    ['DEPLOY_CONFIRMATION', 'DEPLOY'],
  ]) {
    assert.throws(
      () => validator.validateDeploymentWorkflowContext({ ...valid, [key]: value }),
      /SOURCE_CONTEXT_INVALID/,
    )
  }
})

test('diagnostic output classifies only UNAPPLIED, PARTIAL, or FULL', async () => {
  const validator = await import(pathToFileURL(validatorPath).href)
  const unapplied = validator.buildExpectedInitializerFixture('UNAPPLIED')
  const full = validator.buildExpectedInitializerFixture('FULL')
  const partial = validator.buildExpectedInitializerFixture('PARTIAL')

  assert.equal(
    validator.parseAndValidateInitializerOutput(
      `${JSON.stringify(unapplied)}\n`,
    ).application_state,
    'UNAPPLIED',
  )
  assert.equal(
    validator.parseAndValidateInitializerOutput(`${JSON.stringify(full)}\n`)
      .application_state,
    'FULL',
  )
  assert.equal(
    validator.parseAndValidateInitializerOutput(`${JSON.stringify(partial)}\n`)
      .application_state,
    'PARTIAL',
  )
})

test('preflight only accepts exact UNAPPLIED state with zero initializer audit rows', async () => {
  const validator = await import(pathToFileURL(validatorPath).href)
  const valid = validator.buildExpectedInitializerFixture('UNAPPLIED')
  assert.equal(
    validator.parseAndValidateInitializerPreflightOutput(
      `${JSON.stringify(valid)}\n`,
    ).application_state,
    'UNAPPLIED',
  )

  for (const state of ['PARTIAL', 'FULL'] as const) {
    assert.throws(
      () =>
        validator.parseAndValidateInitializerPreflightOutput(
          `${JSON.stringify(
            validator.buildExpectedInitializerFixture(state),
          )}\n`,
        ),
      /INITIALIZER_ALREADY_PRESENT|INITIALIZER_PARTIAL_APPLICATION/,
    )
  }
  const drift = validator.buildExpectedInitializerFixture('UNAPPLIED')
  drift.checkout_initialized_audit_count = 1
  assert.throws(
    () =>
      validator.parseAndValidateInitializerPreflightOutput(
        `${JSON.stringify(drift)}\n`,
      ),
    /INITIALIZER_DATA_DRIFT/,
  )
})

test('diagnostics are bounded, frozen, and secret-minimizing', async () => {
  const validator = await import(pathToFileURL(validatorPath).href)
  const parsed = validator.parseAndValidateInitializerOutput(
    `${JSON.stringify(
      validator.buildExpectedInitializerFixture('FULL'),
    )}\n`,
  )
  assert.ok(Object.isFrozen(parsed))
  assert.ok(Object.isFrozen(parsed.inventory))
  assert.ok(Object.isFrozen(parsed.contracts))
  assert.doesNotMatch(
    JSON.stringify(parsed),
    /postgres(?:ql)?:\/\/|password|secret|token|authorization|raw_|function_body|policy_expression|row_data/i,
  )
})

test('fixed SQL accepts no arbitrary URL, SQL, path, retry, or runtime enablement', async () => {
  const validator = await import(pathToFileURL(validatorPath).href)
  assert.equal(validator.validateSource(root), true)
  for (const path of [
    validator.DIAGNOSTIC_FILE,
    validator.PREFLIGHT_FILE,
    validator.POSTFLIGHT_FILE,
    validator.DEPLOY_FILE,
  ]) {
    const sql = readFileSync(join(root, path), 'utf8')
    assert.doesNotMatch(
      sql,
      /api-pay[.]line[.]me|https?:\/\/|LINE_PAY_ENABLED|LINE_PAY_TRANSPORT|\bretry\b/i,
    )
  }
})

test('initializer deploy runner validates its own two-phase output after both commits', async () => {
  const runner = await import(pathToFileURL(initializerRunnerPath).href)
  const validator = await import(pathToFileURL(validatorPath).href)
  const sharedRunner = await import(
    pathToFileURL(
      join(root, 'scripts/supabase/run-line-pay-production-exact-file.mjs'),
    ).href
  )
  const tempRoot = process.env.LINE_PAY_TEST_TMPDIR ?? root
  const taskRoot = join(tempRoot, '.line-pay-initializer-runner-test')
  await mkdir(taskRoot, { recursive: true })
  const runnerTemp = await mkdtemp(join(taskRoot, 'phase-'))
  const markers = sharedRunner.DEPLOY_ATTESTATION_MARKERS
  const deployOutput = [
    JSON.stringify(validator.buildExpectedInitializerFixture('UNAPPLIED')),
    markers.migrationStarted,
    markers.migrationCommitted,
    markers.postflightStarted,
    JSON.stringify(validator.buildExpectedInitializerFixture('FULL')),
    markers.postflightStateEmitted,
    markers.postflightCommitted,
    '',
  ].join('\n')
  const fakeSpawn = (
    _binary: string,
    args: string[],
  ) => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough
      stderr: PassThrough
      kill: () => boolean
    }
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = () => true
    queueMicrotask(() => {
      child.stdout.end(
        args[0] === 'pull' ? 'fixed image ready\n' : deployOutput,
      )
      child.stderr.end()
      child.emit('close', 0, null)
    })
    return child
  }

  try {
    const result = await runner.runInitializerDatabasePhase('deploy', {
      environment: {
        RUNNER_TEMP: runnerTemp,
        SUPABASE_PRODUCTION_CHANNEL_READY: 'true',
        SUPABASE_PRODUCTION_DB_URL:
          'postgresql://postgres:synthetic@db.ndbqoznvobmpkgxkiezz.supabase.co:5432/postgres?sslmode=require',
        SUPABASE_PROJECT_ID: 'ndbqoznvobmpkgxkiezz',
      },
      spawnImplementation: fakeSpawn,
    })
    assert.equal(result.status, 'INITIALIZER_DEPLOYMENT_VALIDATED')
    assert.equal(
      result.database_postflight_attestation.application_state,
      'FULL',
    )
    assert.equal(
      result.transaction_boundary_attestation.postflight_commit_observed,
      true,
    )
    assert.equal(Object.isFrozen(result), true)
  } finally {
    await rm(runnerTemp, { recursive: true })
    await rm(taskRoot, { recursive: true })
  }
})
