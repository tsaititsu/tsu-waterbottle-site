import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const validatorPath = join(
  root,
  'scripts/supabase/validate-line-pay-atomic-confirmation-finalization-production.mjs',
)
const runnerPath = join(
  root,
  'scripts/supabase/run-line-pay-atomic-confirmation-finalization-exact-file.mjs',
)

test('source gates reject branch, head, project, hash, backup, and confirmation drift', async () => {
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
  assert.equal(validator.validateWorkflowContext(valid), true)

  for (const [key, value] of [
    ['GITHUB_REF', 'refs/heads/codex/not-main'],
    ['GITHUB_SHA', 'b'.repeat(40)],
    ['PROJECT_REF_INPUT', 'aaaaaaaaaaaaaaaaaaaa'],
    ['MIGRATION_SHA256_INPUT', '0'.repeat(64)],
    ['BACKUP_RESTORE_POINT_CONFIRMATION', 'CONFIRMED'],
    ['DEPLOY_CONFIRMATION', 'DEPLOY'],
  ]) {
    assert.throws(() =>
      validator.validateWorkflowContext({ ...valid, [key]: value }),
    )
  }
})

test('deploy runner validates its own exact two-transaction evidence', async () => {
  const validator = await import(pathToFileURL(validatorPath).href)
  const runner = await import(pathToFileURL(runnerPath).href)
  const sharedRunner = await import(
    pathToFileURL(
      join(root, 'scripts/supabase/run-line-pay-production-exact-file.mjs'),
    ).href
  )
  const tempRoot = process.env.LINE_PAY_TEST_TMPDIR ?? root
  const taskRoot = join(tempRoot, '.line-pay-atomic-production-runner-test')
  await mkdir(taskRoot, { recursive: true })
  const runnerTemp = await mkdtemp(join(taskRoot, 'phase-'))
  const markers = sharedRunner.DEPLOY_ATTESTATION_MARKERS
  const deployOutput = [
    JSON.stringify(validator.buildExpectedAtomicFixture('UNAPPLIED')),
    markers.migrationStarted,
    markers.migrationCommitted,
    markers.postflightStarted,
    JSON.stringify(validator.buildExpectedAtomicFixture('FULL')),
    markers.postflightStateEmitted,
    markers.postflightCommitted,
    '',
  ].join('\n')
  const fakeSpawn = (_binary: string, args: string[]) => {
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
    const result = await runner.runAtomicDatabasePhase('deploy', {
      environment: {
        RUNNER_TEMP: runnerTemp,
        SUPABASE_PRODUCTION_CHANNEL_READY: 'true',
        SUPABASE_PRODUCTION_DB_URL: [
          'postgresql://postgres',
          'synthetic@db.ndbqoznvobmpkgxkiezz.supabase.co:5432/postgres?sslmode=require',
        ].join(':'),
        SUPABASE_PROJECT_ID: 'ndbqoznvobmpkgxkiezz',
      },
      spawnImplementation: fakeSpawn,
    })
    assert.equal(result.status, 'ATOMIC_FINALIZATION_DEPLOYMENT_VALIDATED')
    assert.equal(
      result.database_postflight_attestation.application_state,
      'FULL',
    )
    assert.equal(
      result.transaction_boundary_attestation.postflight_commit_observed,
      true,
    )
    assert.ok(Object.isFrozen(result))
  } finally {
    await rm(runnerTemp, { recursive: true })
    await rm(taskRoot, { recursive: true })
  }
})

test('runner exposes only fixed safe failure codes', async () => {
  const runner = await import(pathToFileURL(runnerPath).href)
  assert.equal(
    runner.safeAtomicFailureOutput(
      new Error('ATOMIC_FINALIZATION_POSTFLIGHT_NOT_FULL'),
    ),
    'ATOMIC_FINALIZATION_POSTFLIGHT_NOT_FULL',
  )
  assert.equal(
    runner.safeAtomicFailureOutput(new Error('raw database detail')),
    'DATABASE_OUTPUT_INVALID',
  )
})
