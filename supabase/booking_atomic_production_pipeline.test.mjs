import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { PassThrough } from 'node:stream'
import test from 'node:test'

import {
  APPROVED_SOURCE_COMMIT,
  APPROVED_HEAD_REF,
  APPROVED_PR_NUMBER,
  EXPECTED_CONFIRMATION,
  EXPECTED_CONSTRAINT_DEFINITION_MD5,
  EXPECTED_FUNCTION_DEFINITION_MD5,
  EXPECTED_MIGRATION_GIT_BLOB,
  EXPECTED_MIGRATION_SHA256,
  EXPECTED_PROJECT_REF,
  MIGRATION_FILE,
  POSTGRES_IMAGE,
  POSTGRES_IMAGE_CONFIG_ID,
  POSTGRES_PLATFORM,
  calculateGitBlobId,
  parseAndValidateAuditOutput,
  validateApprovedSource,
  validatePipelineSource,
  validateLockedPullRequest,
  validatePostgresImageIdentity,
  validatePostflightRecord,
  validatePreflightRecord,
  validateProductionChannel,
  validateWorkflowContext,
} from '../scripts/supabase/validate-booking-atomic-production-deployment.mjs'
import {
  APPROVED_SOURCE_MOUNT,
  CONTAINER_PGPASS_FILE,
  PHASE_FILES,
  PIPELINE_MOUNT,
  buildDockerRunArgs,
  buildPgpassLine,
  cleanupCredentialFile,
  createCredentialFile,
  parseDatabaseUrl,
  prepareFixedImage,
  redactSensitiveText,
  runDatabasePhase,
  validatePhase,
} from '../scripts/supabase/run-booking-atomic-production-exact-file.mjs'

const root = process.cwd()
const approvedSourceRoot = process.env.APPROVED_SOURCE_ROOT

function errorCode(callback, expected) {
  assert.throws(callback, (error) => {
    assert.equal(error?.message, expected)
    return true
  })
}

function preflightRecord(overrides = {}) {
  return {
    marker: 'BOOKING_ATOMIC_PREFLIGHT',
    contract_version: 1,
    postgres_major: 17,
    primary_database: true,
    relation_count: 3,
    constraint_count: 0,
    constraint_exact_count: 0,
    function_exact_count: 0,
    function_named_count: 0,
    function_signature_count: 0,
    active_overlap_pairs: 0,
    ...overrides,
  }
}

function postflightRecord(overrides = {}) {
  return {
    marker: 'BOOKING_ATOMIC_POSTFLIGHT',
    contract_version: 1,
    approved_source_commit: APPROVED_SOURCE_COMMIT,
    migration_path: MIGRATION_FILE,
    migration_sha256: EXPECTED_MIGRATION_SHA256,
    postgres_major: 17,
    constraint_definition_md5: EXPECTED_CONSTRAINT_DEFINITION_MD5,
    function_definition_md5: EXPECTED_FUNCTION_DEFINITION_MD5,
    service_role_execute: true,
    authenticated_execute: false,
    anon_execute: false,
    security_invoker: true,
    rollback_atomic_smoke: true,
    expected_failure_constraint: 'bookings_user_id_fkey',
    synthetic_rows_persisted: false,
    ...overrides,
  }
}

function createSpawnSequence(records) {
  let index = 0
  return () => {
    const record = records[index]
    index += 1
    if (!record) throw new Error('unexpected spawn')
    const child = new EventEmitter()
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = () => true
    process.nextTick(() => {
      if (record.error) {
        child.emit('error', new Error(record.error))
        return
      }
      if (record.stdout) child.stdout.end(record.stdout)
      else child.stdout.end()
      if (record.stderr) child.stderr.end(record.stderr)
      else child.stderr.end()
      child.emit('close', record.code ?? 0, record.signal ?? null)
    })
    return child
  }
}

test('approved source identity is fully pinned to the reviewed PR #89 head', async () => {
  assert.equal(
    APPROVED_SOURCE_COMMIT,
    'cdc2a4fa49300a62782a7171ac9ab77a95a9a602',
  )
  assert.equal(
    MIGRATION_FILE,
    'supabase/migrations/20260725123441_create_booking_with_available_slot.sql',
  )
  assert.equal(
    EXPECTED_MIGRATION_SHA256,
    'ea02c044e19bacdfc10c81b109bb858d26d205fc58691ddfbb18ea418c9d25e1',
  )
  assert.equal(
    EXPECTED_MIGRATION_GIT_BLOB,
    '81beb69694e598b565617d630b97be4affe6b200',
  )
  assert.equal(validateApprovedSource(approvedSourceRoot), approvedSourceRoot)
  const migration = await readFile(
    join(approvedSourceRoot, MIGRATION_FILE),
    'utf8',
  )
  assert.equal(calculateGitBlobId(migration), EXPECTED_MIGRATION_GIT_BLOB)
})

test('workflow context accepts only main, exact user authorization, project, hash, and phrase', () => {
  const exact = {
    GITHUB_REPOSITORY: 'tsaititsu/tsu-waterbottle-site',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_REF: 'refs/heads/main',
    GITHUB_SHA: 'a'.repeat(40),
    AUTHORIZED_WORKFLOW_COMMIT: 'a'.repeat(40),
    PROJECT_REF_INPUT: EXPECTED_PROJECT_REF,
    MIGRATION_SHA256_INPUT: EXPECTED_MIGRATION_SHA256,
    DEPLOY_CONFIRMATION: EXPECTED_CONFIRMATION,
    CURRENT_PR_HEAD_INPUT: APPROVED_SOURCE_COMMIT,
  }
  assert.equal(validateWorkflowContext(exact), true)
  for (const [key, value, code] of [
    ['GITHUB_REPOSITORY', 'attacker/repository', 'SOURCE_CONTEXT_INVALID'],
    ['GITHUB_EVENT_NAME', 'push', 'SOURCE_CONTEXT_INVALID'],
    ['GITHUB_REF', 'refs/heads/feature', 'SOURCE_CONTEXT_INVALID'],
    ['AUTHORIZED_WORKFLOW_COMMIT', 'b'.repeat(40), 'SOURCE_CONTEXT_INVALID'],
    ['PROJECT_REF_INPUT', 'a'.repeat(20), 'PROJECT_REF_MISMATCH'],
    ['MIGRATION_SHA256_INPUT', 'b'.repeat(64), 'MIGRATION_HASH_MISMATCH'],
    ['DEPLOY_CONFIRMATION', 'yes', 'INVALID_DEPLOYMENT_CONFIRMATION'],
    ['CURRENT_PR_HEAD_INPUT', 'short', 'INVALID_PR_HEAD'],
  ]) {
    errorCode(
      () => validateWorkflowContext({ ...exact, [key]: value }),
      code,
    )
  }
})

test('remote PR lock accepts only an open Ready PR #89 containing the fixed source commit', async () => {
  const exact = {
    number: APPROVED_PR_NUMBER,
    state: 'open',
    merged_at: null,
    draft: false,
    head: {
      ref: APPROVED_HEAD_REF,
      sha: APPROVED_SOURCE_COMMIT,
    },
    base: { ref: 'main' },
  }
  const response = (record = exact, ok = true) => ({
    ok,
    async json() {
      return record
    },
  })
  assert.equal(
    await validateLockedPullRequest(
      APPROVED_SOURCE_COMMIT,
      async () => response(),
    ),
    true,
  )
  for (const record of [
    { ...exact, state: 'closed' },
    { ...exact, merged_at: '2026-07-25T00:00:00Z' },
    { ...exact, draft: true },
    { ...exact, head: { ...exact.head, sha: '0'.repeat(40) } },
    { ...exact, head: { ...exact.head, ref: 'other' } },
    { ...exact, base: { ref: 'other' } },
  ]) {
    await assert.rejects(
      validateLockedPullRequest(
        APPROVED_SOURCE_COMMIT,
        async () => response(record),
      ),
      /PR_STATE_INVALID/,
    )
  }
  await assert.rejects(
    validateLockedPullRequest(
      APPROVED_SOURCE_COMMIT,
      async () => response(exact, false),
    ),
    /PR_STATE_INVALID/,
  )

  const synchronizedHead = '1'.repeat(40)
  const synchronized = {
    ...exact,
    head: { ...exact.head, sha: synchronizedHead },
  }
  const responses = [
    response(synchronized),
    response({
      status: 'ahead',
      ahead_by: 2,
      behind_by: 0,
      base_commit: { sha: APPROVED_SOURCE_COMMIT },
      merge_base_commit: { sha: APPROVED_SOURCE_COMMIT },
    }),
  ]
  assert.equal(
    await validateLockedPullRequest(
      synchronizedHead,
      async () => responses.shift(),
    ),
    true,
  )
  await assert.rejects(
    validateLockedPullRequest(
      synchronizedHead,
      async (url) =>
        url.includes('/compare/')
          ? response({
              status: 'diverged',
              ahead_by: 1,
              behind_by: 1,
              base_commit: { sha: APPROVED_SOURCE_COMMIT },
              merge_base_commit: { sha: '2'.repeat(40) },
            })
          : response(synchronized),
    ),
    /PR_STATE_INVALID/,
  )
})

test('pipeline source has fixed workflow, SQL, runner, and approved source contracts', () => {
  assert.equal(validatePipelineSource(root, approvedSourceRoot), true)
})

test('protected channel checks readiness without parsing or exposing its secret', () => {
  assert.equal(
    validateProductionChannel({
      SUPABASE_PRODUCTION_CHANNEL_READY: 'true',
      SUPABASE_PRODUCTION_DB_URL: 'opaque-secret',
      SUPABASE_PROJECT_ID: EXPECTED_PROJECT_REF,
    }),
    true,
  )
  errorCode(
    () =>
      validateProductionChannel({
        SUPABASE_PRODUCTION_CHANNEL_READY: 'false',
        SUPABASE_PRODUCTION_DB_URL: 'opaque-secret',
        SUPABASE_PROJECT_ID: EXPECTED_PROJECT_REF,
      }),
    'PRODUCTION_CHANNEL_NOT_READY',
  )
})

test('preflight accepts only a clean unapplied PostgreSQL 17 schema', () => {
  assert.equal(validatePreflightRecord(preflightRecord()), true)
  errorCode(
    () => validatePreflightRecord(preflightRecord({ postgres_major: 16 })),
    'SCHEMA_DRIFT',
  )
  errorCode(
    () =>
      validatePreflightRecord(
        preflightRecord({ active_overlap_pairs: 1 }),
      ),
    'PRODUCTION_DATA_DRIFT',
  )
  errorCode(
    () =>
      validatePreflightRecord(
        preflightRecord({
          constraint_count: 1,
          constraint_exact_count: 1,
          function_exact_count: 1,
          function_named_count: 1,
          function_signature_count: 1,
        }),
      ),
    'ALREADY_APPLIED',
  )
  errorCode(
    () =>
      validatePreflightRecord(
        preflightRecord({
          constraint_count: 1,
          function_named_count: 1,
          function_signature_count: 1,
        }),
      ),
    'SCHEMA_DRIFT',
  )
})

test('postflight requires exact identities, ACL, invoker mode, and rollback smoke', () => {
  assert.equal(validatePostflightRecord(postflightRecord()), true)
  for (const [key, value] of [
    ['approved_source_commit', '0'.repeat(40)],
    ['migration_path', 'supabase/migrations/other.sql'],
    ['migration_sha256', '0'.repeat(64)],
    ['function_definition_md5', '0'.repeat(32)],
    ['constraint_definition_md5', '0'.repeat(32)],
    ['service_role_execute', false],
    ['authenticated_execute', true],
    ['anon_execute', true],
    ['security_invoker', false],
    ['rollback_atomic_smoke', false],
    ['expected_failure_constraint', 'other_constraint'],
    ['synthetic_rows_persisted', true],
  ]) {
    errorCode(
      () => validatePostflightRecord(postflightRecord({ [key]: value })),
      'POSTFLIGHT_CONTRACT_FAILED',
    )
  }
})

test('database output rejects extra records, keys, and malformed JSON', () => {
  const preflight = JSON.stringify(preflightRecord())
  const postflight = JSON.stringify(postflightRecord())
  assert.equal(parseAndValidateAuditOutput(`${preflight}\n`, 'preflight'), true)
  assert.equal(
    parseAndValidateAuditOutput(
      `${preflight}\n${postflight}\n`,
      'deploy',
    ),
    true,
  )
  errorCode(
    () => parseAndValidateAuditOutput(`${preflight}\nextra\n`, 'preflight'),
    'DATABASE_OUTPUT_INVALID',
  )
  errorCode(
    () =>
      parseAndValidateAuditOutput(
        JSON.stringify({ ...preflightRecord(), extra: true }),
        'preflight',
      ),
    'DATABASE_OUTPUT_INVALID',
  )
  errorCode(
    () => parseAndValidateAuditOutput('{', 'preflight'),
    'DATABASE_OUTPUT_INVALID',
  )
})

test('database URL parser accepts only the fixed project direct or session endpoint', () => {
  const direct = parseDatabaseUrl(
    `postgresql://postgres:p%40ss@db.${EXPECTED_PROJECT_REF}.supabase.co:5432/postgres?sslmode=require`,
    EXPECTED_PROJECT_REF,
  )
  assert.equal(direct.password, 'p@ss')
  assert.equal(direct.mode, 'direct')

  const pooler = parseDatabaseUrl(
    `postgresql://postgres.${EXPECTED_PROJECT_REF}:secret@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require`,
    EXPECTED_PROJECT_REF,
  )
  assert.equal(pooler.mode, 'supavisor_session')

  for (const [url, code] of [
    [
      `postgresql://postgres:secret@db.${'a'.repeat(20)}.supabase.co:5432/postgres`,
      'DATABASE_TARGET_MISMATCH',
    ],
    [
      `postgresql://postgres:secret@db.${EXPECTED_PROJECT_REF}.supabase.co:6543/postgres`,
      'DATABASE_URL_INVALID',
    ],
    [
      `postgresql://postgres:secret@db.${EXPECTED_PROJECT_REF}.supabase.co:5432/postgres?application_name=unsafe`,
      'DATABASE_URL_INVALID',
    ],
    [
      `https://postgres:secret@db.${EXPECTED_PROJECT_REF}.supabase.co:5432/postgres`,
      'DATABASE_URL_INVALID',
    ],
  ]) {
    errorCode(() => parseDatabaseUrl(url, EXPECTED_PROJECT_REF), code)
  }
})

test('Docker arguments mount only fixed read-only roots and never contain the password', () => {
  const connection = parseDatabaseUrl(
    `postgresql://postgres:never-print-me@db.${EXPECTED_PROJECT_REF}.supabase.co:5432/postgres`,
    EXPECTED_PROJECT_REF,
  )
  const args = buildDockerRunArgs(
    'deploy',
    connection,
    '/tmp/booking-pgpass',
    resolve(approvedSourceRoot),
  )
  const serialized = JSON.stringify(args)
  assert.match(serialized, /--read-only/)
  assert.match(serialized, /--cap-drop/)
  assert.match(serialized, /no-new-privileges/)
  assert.match(serialized, new RegExp(PIPELINE_MOUNT))
  assert.match(serialized, new RegExp(APPROVED_SOURCE_MOUNT))
  assert.match(serialized, new RegExp(CONTAINER_PGPASS_FILE))
  assert.match(serialized, new RegExp(POSTGRES_IMAGE.replaceAll('.', '[.]')))
  assert.match(serialized, new RegExp(POSTGRES_PLATFORM))
  assert.doesNotMatch(serialized, /never-print-me/)
  assert.doesNotMatch(serialized, /SUPABASE_PRODUCTION_DB_URL/)
  assert.equal(PHASE_FILES.deploy.endsWith('booking_atomic_create_deploy.sql'), true)
  assert.equal(validatePhase('preflight'), 'preflight')
  errorCode(() => validatePhase('migration'), 'UNSUPPORTED_DATABASE_PHASE')
})

test('fixed image preparation pulls once, checks digest, and executes PostgreSQL 17 version probe', async () => {
  assert.equal(
    validatePostgresImageIdentity(
      `linux|amd64|${POSTGRES_IMAGE.slice('postgres@'.length)}\n`,
    ),
    true,
  )
  errorCode(
    () =>
      validatePostgresImageIdentity(
        `linux|amd64|${'sha256:' + '0'.repeat(64)}\n`,
      ),
    'POSTGRES_IMAGE_MISMATCH',
  )
  const spawnImplementation = createSpawnSequence([
    { code: 0 },
    {
      code: 0,
      stdout: `linux|amd64|${POSTGRES_IMAGE_CONFIG_ID}\n`,
    },
    {
      code: 0,
      stdout: 'psql (PostgreSQL) 17.6 (Debian 17.6-1.pgdg120+1)\n',
    },
  ])
  assert.equal(
    await prepareFixedImage(spawnImplementation),
    'POSTGRES_IMAGE_READY',
  )

  await assert.rejects(
    prepareFixedImage(
      createSpawnSequence([
        { code: 0 },
        {
          code: 0,
          stdout: `linux|amd64|${POSTGRES_IMAGE_CONFIG_ID}\n`,
        },
        { code: 0, stdout: 'psql (PostgreSQL) 18.0\n' },
      ]),
    ),
    /UNSUPPORTED_PSQL_VERSION/,
  )
})

test('preflight runner cleans credentials and never passes the database secret to child args or env', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'booking-runner-phase-test-'))
  const calls = []
  const sequence = createSpawnSequence([
    {
      code: 0,
      stdout: `linux|amd64|${POSTGRES_IMAGE_CONFIG_ID}\n`,
    },
    {
      code: 0,
      stdout: 'psql (PostgreSQL) 17.6 (Debian 17.6-1.pgdg120+1)\n',
    },
    {
      code: 0,
      stdout: `${JSON.stringify(preflightRecord())}\n`,
    },
  ])
  const spawnImplementation = (binary, args, options) => {
    calls.push({ binary, args, options })
    return sequence(binary, args, options)
  }
  try {
    assert.equal(
      await runDatabasePhase('preflight', {
        environment: {
          APPROVED_SOURCE_ROOT: approvedSourceRoot,
          SUPABASE_PRODUCTION_CHANNEL_READY: 'true',
          SUPABASE_PRODUCTION_DB_URL:
            `postgresql://postgres:runner-secret@db.${EXPECTED_PROJECT_REF}.supabase.co:5432/postgres?sslmode=require`,
          SUPABASE_PROJECT_ID: EXPECTED_PROJECT_REF,
          RUNNER_TEMP: tempRoot,
          PATH: process.env.PATH,
        },
        spawnImplementation,
      }),
      'PREFLIGHT_VALIDATED',
    )
    assert.equal((await readdir(tempRoot)).length, 0)
    assert.equal(
      JSON.stringify(calls).includes('runner-secret'),
      false,
    )
    assert.equal(calls.length, 3)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})

test('temporary pgpass uses mode 0600, escapes fields, and is removed once', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'booking-runner-test-'))
  try {
    const connection = {
      host: 'db.example.test',
      port: '5432',
      database: 'postgres',
      username: 'postgres',
      password: String.raw`p:a\ss`,
    }
    assert.equal(
      buildPgpassLine(connection),
      String.raw`db.example.test:5432:postgres:postgres:p\:a\\ss`,
    )
    const credentials = await createCredentialFile(tempRoot, connection)
    assert.equal((await stat(credentials.pgpassFile)).mode & 0o777, 0o600)
    assert.equal(await cleanupCredentialFile(credentials), true)
    assert.equal(await cleanupCredentialFile(credentials), true)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})

test('redaction removes every connection identity and credential variant', () => {
  const connection = {
    databaseUrl: 'postgresql://user:secret@host/postgres',
    password: 'secret',
    encodedPassword: 'sec%72et',
    username: 'user',
    host: 'host',
    database: 'postgres',
    projectId: EXPECTED_PROJECT_REF,
  }
  const output = redactSensitiveText(
    Object.values(connection).join('|'),
    connection,
  )
  for (const value of Object.values(connection)) {
    assert.equal(output.includes(value), false)
  }
})
