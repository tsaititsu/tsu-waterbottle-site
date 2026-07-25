import assert from 'node:assert/strict'
import { join } from 'node:path'
import test, { before } from 'node:test'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const runnerPath = join(
  root,
  'scripts/supabase/run-bank-transfer-production-baseline-capture.mjs',
)
const validatorPath = join(
  root,
  'scripts/supabase/validate-bank-transfer-production-baseline-capture.mjs',
)

let runner: any
let validator: any

before(async () => {
  ;[runner, validator] = await Promise.all([
    import(pathToFileURL(runnerPath).href),
    import(pathToFileURL(validatorPath).href),
  ])
})

function validArtifact() {
  const digest = 'a'.repeat(64)
  const groups = {
    identity_and_amount: digest,
    payer_contact: digest,
    transfer_details: digest,
    review_and_confirmation: digest,
    full_canonical_row: digest,
  }
  return {
    schema_signature: digest,
    group_digests: groups,
    ordinal_digests: {
      ordinal_1: groups,
      ordinal_2: groups,
      ordinal_3: groups,
    },
    row_count: 3,
    pk_digest: digest,
    pending_review_count: 3,
  }
}

test('capture runner accepts only the protected production channel and exact fixed session', () => {
  assert.equal(runner.DATABASE_SESSION_LIMIT, 1)
  assert.equal(validator.ARTIFACT_RETENTION_DAYS, 1)
  assert.equal(
    validator.ARTIFACT_FILENAME,
    'bank-transfer-baseline-capture.json',
  )
  assert.equal(
    validator.EXPECTED_CONFIRMATION,
    'CAPTURE_BANK_TRANSFER_BASELINE_READ_ONLY_ONCE',
  )

  const connection = runner.parseDatabaseUrl(
    'postgresql://postgres:synthetic@db.ndbqoznvobmpkgxkiezz.supabase.co:5432/postgres?sslmode=require',
    'ndbqoznvobmpkgxkiezz',
  )
  const args = runner.buildDockerRunArgs(
    connection,
    '/runner-temp/task/pgpass',
  )
  for (const token of [
    'run',
    '--rm',
    '--read-only',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges',
    '--pull=never',
  ]) {
    assert.ok(args.includes(token), token)
  }
  assert.equal(
    args.filter(
      (value: string) =>
        value.includes('bank_transfer_historical_baseline_capture.sql'),
    ).length,
    1,
  )
  assert.equal(args.includes('/var/run/docker.sock'), false)
  assert.equal(args.includes('--privileged'), false)
  assert.equal(args.includes('--network=host'), false)
})

test('private artifact writer uses one exclusive 0600 file and does not log contents', async () => {
  const operations: Array<[string, ...unknown[]]> = []
  const filesystem = {
    async stat(path: string) {
      operations.push(['stat', path])
      if (path.endsWith('.json')) return { mode: 0o100600, isFile: () => true }
      return { mode: 0o40700, isDirectory: () => true }
    },
    async lstat(path: string) {
      operations.push(['lstat', path])
      return {
        mode: 0o100600,
        isFile: () => true,
        isSymbolicLink: () => false,
      }
    },
    async writeFile(path: string, contents: string, options: unknown) {
      operations.push(['writeFile', path, contents, options])
    },
  }
  const artifact = validArtifact()
  const path = await runner.writePrivateArtifact(
    '/runner-temp',
    artifact,
    filesystem,
  )
  assert.equal(
    path,
    '/runner-temp/bank-transfer-baseline-capture.json',
  )
  const write = operations.find(([operation]) => operation === 'writeFile')
  assert.ok(write)
  assert.equal((write?.[2] as string).endsWith('\n'), true)
  assert.deepEqual(write?.[3], {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  })

  const attestation = runner.buildSafeSuccessAttestation(artifact)
  assert.deepEqual(attestation, {
    status: 'BASELINE_CAPTURE_COMPLETED',
    artifact_created: true,
    row_count: 3,
    pending_review_count: 3,
    database_sessions: 1,
    read_only: true,
  })
  const safe = JSON.stringify(attestation)
  assert.equal(safe.includes('a'.repeat(64)), false)
  assert.equal(safe.includes('ordinal_1'), false)
})

test('artifact writer rejects unsafe roots, symlinks, wrong modes, and existing files', async () => {
  const artifact = validArtifact()
  await assert.rejects(
    () =>
      runner.writePrivateArtifact('relative', artifact, {
        async stat() {
          return { isDirectory: () => true }
        },
      }),
    /BASELINE_ARTIFACT_WRITE_FAILED/,
  )

  await assert.rejects(
    () =>
      runner.writePrivateArtifact('/runner-temp', artifact, {
        async stat(path: string) {
          if (path.endsWith('.json')) return { mode: 0o100644 }
          return { isDirectory: () => true }
        },
        async lstat() {
          return {
            mode: 0o120777,
            isFile: () => false,
            isSymbolicLink: () => true,
          }
        },
        async writeFile() {},
      }),
    /BASELINE_ARTIFACT_WRITE_FAILED/,
  )
})

test('artifact validation rejects any raw row, identifier, PII, or unexpected metadata', () => {
  const artifact = validArtifact()
  for (const mutation of [
    { ...artifact, rows: [] },
    { ...artifact, ids: [] },
    { ...artifact, raw_json: {} },
    { ...artifact, database_url: 'redacted' },
    { ...artifact, ordinal_digests: { ordinal_1: artifact.group_digests } },
  ]) {
    assert.throws(
      () =>
        validator.parseAndValidateBaselineArtifact(
          JSON.stringify(mutation),
        ),
      /BASELINE_CAPTURE_OUTPUT_INVALID/,
    )
  }
})
