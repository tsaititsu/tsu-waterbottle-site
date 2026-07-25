import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  lstatSync,
  readFileSync,
  realpathSync,
} from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

export const EXPECTED_REPOSITORY = 'tsaititsu/tsu-waterbottle-site'
export const EXPECTED_PROJECT_REF = 'ndbqoznvobmpkgxkiezz'
export const EXPECTED_EVENT = 'workflow_dispatch'
export const EXPECTED_REF = 'refs/heads/main'
export const EXPECTED_CONFIRMATION =
  'DEPLOY_BOOKING_ATOMIC_CREATE_EXACT_FILE_ONCE'
export const EXPECTED_NODE_VERSION = 'v24.16.0'
export const EXPECTED_PSQL_MAJOR = 17
export const POSTGRES_IMAGE =
  'postgres@sha256:af194ccf3e2d7fe367012c7b88ce8b816c5c889b18a5b316799a1f0d7eac746a'
export const POSTGRES_IMAGE_INDEX_DIGEST =
  'sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193'
export const POSTGRES_IMAGE_CONFIG_ID =
  'sha256:93aa428db0aeeb71d24dcad1491bef6e1396a4255697e4bfc4c725bfeb981b74'
export const POSTGRES_PLATFORM = 'linux/amd64'
export const APPROVED_SOURCE_COMMIT =
  'cdc2a4fa49300a62782a7171ac9ab77a95a9a602'
export const APPROVED_PR_NUMBER = 89
export const APPROVED_HEAD_REF = 'codex/website-master-convergence-v1'
export const MIGRATION_FILE =
  'supabase/migrations/20260725123441_create_booking_with_available_slot.sql'
export const EXPECTED_MIGRATION_SHA256 =
  'ea02c044e19bacdfc10c81b109bb858d26d205fc58691ddfbb18ea418c9d25e1'
export const EXPECTED_MIGRATION_GIT_BLOB =
  '81beb69694e598b565617d630b97be4affe6b200'
export const WORKFLOW_FILE =
  '.github/workflows/supabase-production-booking-atomic-migration.yml'
export const RUNNER_FILE =
  'scripts/supabase/run-booking-atomic-production-exact-file.mjs'
export const VALIDATOR_FILE =
  'scripts/supabase/validate-booking-atomic-production-deployment.mjs'
export const PREFLIGHT_FILE =
  'supabase/deployment/booking_atomic_create_preflight.sql'
export const LOCKED_GUARD_FILE =
  'supabase/deployment/booking_atomic_create_locked_guard.sql'
export const DEPLOY_FILE =
  'supabase/deployment/booking_atomic_create_deploy.sql'
export const POSTFLIGHT_FILE =
  'supabase/deployment/booking_atomic_create_postflight.sql'
export const PIPELINE_TEST_FILE =
  'supabase/booking_atomic_production_pipeline.test.mjs'
export const EXPECTED_FUNCTION_DEFINITION_MD5 =
  '61a6627113ef013df080440455aaece6'
export const EXPECTED_CONSTRAINT_DEFINITION_MD5 =
  '88eee14f144ab75d2151273690227c9e'

const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/u
const SHA256_PATTERN = /^[0-9a-f]{64}$/u
const GIT_BLOB_PATTERN = /^[0-9a-f]{40}$/u
const SAFE_ERROR_CODES = new Set([
  'ALREADY_APPLIED',
  'APPROVED_SOURCE_INVALID',
  'DATABASE_OUTPUT_INVALID',
  'FIXED_FILE_HASH_MISMATCH',
  'FIXED_FILE_INVALID',
  'INVALID_DEPLOYMENT_CONFIRMATION',
  'INVALID_MAIN_SHA',
  'INVALID_NODE_VERSION',
  'INVALID_PR_HEAD',
  'INVALID_SQL_SYNTAX',
  'MIGRATION_HASH_MISMATCH',
  'POSTFLIGHT_CONTRACT_FAILED',
  'POSTGRES_IMAGE_MISMATCH',
  'PRODUCTION_CHANNEL_NOT_READY',
  'PRODUCTION_DATA_DRIFT',
  'PR_STATE_INVALID',
  'PROJECT_REF_MISMATCH',
  'SCHEMA_DRIFT',
  'SOURCE_CONTEXT_INVALID',
  'SOURCE_VALIDATION_FAILED',
  'UNSAFE_AUDIT_SQL',
  'UNSUPPORTED_PSQL_VERSION',
])

function fail(code) {
  throw new Error(code)
}

function assertPlainObject(value, code = 'DATABASE_OUTPUT_INVALID') {
  if (
    value === null ||
    Array.isArray(value) ||
    typeof value !== 'object' ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail(code)
  }
}

function assertExactKeys(value, keys, code = 'DATABASE_OUTPUT_INVALID') {
  assertPlainObject(value, code)
  if (
    !isDeepStrictEqual(
      Object.keys(value).sort(),
      [...keys].sort(),
    )
  ) {
    fail(code)
  }
}

export function validateFullSha(value) {
  if (typeof value !== 'string' || !FULL_SHA_PATTERN.test(value)) {
    fail('INVALID_MAIN_SHA')
  }
  return value
}

export function validateCurrentPrHead(value) {
  if (typeof value !== 'string' || !FULL_SHA_PATTERN.test(value)) {
    fail('INVALID_PR_HEAD')
  }
  return value
}

export function validateNodeVersion(value = process.version) {
  if (value !== EXPECTED_NODE_VERSION) fail('INVALID_NODE_VERSION')
  return true
}

export function validatePostgresImage(value) {
  if (value !== POSTGRES_IMAGE) fail('POSTGRES_IMAGE_MISMATCH')
  return true
}

export function validatePostgresImageIdentity(output) {
  if (typeof output !== 'string') fail('POSTGRES_IMAGE_MISMATCH')
  const record = output.endsWith('\n') ? output.slice(0, -1) : output
  const expectedPrefix = 'linux|amd64|'
  const identity = record.startsWith(expectedPrefix)
    ? record.slice(expectedPrefix.length)
    : ''
  if (
    ![
      POSTGRES_IMAGE.slice('postgres@'.length),
      POSTGRES_IMAGE_CONFIG_ID,
    ].includes(identity) ||
    record !== `${expectedPrefix}${identity}`
  ) {
    fail('POSTGRES_IMAGE_MISMATCH')
  }
  return true
}

export function validatePsqlVersionOutput(output) {
  if (typeof output !== 'string') fail('UNSUPPORTED_PSQL_VERSION')
  const record = output.endsWith('\n') ? output.slice(0, -1) : output
  const match =
    /^psql \(PostgreSQL\) ([1-9][0-9]*(?:[.][0-9]+)*)(?: \(([\x20-\x27\x2a-\x7e]+)\))?$/u.exec(
      record,
    )
  if (
    !match ||
    match[1].split('.')[0] !== String(EXPECTED_PSQL_MAJOR) ||
    /[\x00-\x1f\x7f]/u.test(record)
  ) {
    fail('UNSUPPORTED_PSQL_VERSION')
  }
  return true
}

export function validateWorkflowContext(environment = process.env) {
  validateNodeVersion()
  if (
    environment.GITHUB_REPOSITORY !== EXPECTED_REPOSITORY ||
    environment.GITHUB_EVENT_NAME !== EXPECTED_EVENT ||
    environment.GITHUB_REF !== EXPECTED_REF
  ) {
    fail('SOURCE_CONTEXT_INVALID')
  }
  const githubSha = validateFullSha(environment.GITHUB_SHA)
  const authorizedCommit = validateFullSha(
    environment.AUTHORIZED_WORKFLOW_COMMIT,
  )
  if (githubSha !== authorizedCommit) fail('SOURCE_CONTEXT_INVALID')
  if (environment.PROJECT_REF_INPUT !== EXPECTED_PROJECT_REF) {
    fail('PROJECT_REF_MISMATCH')
  }
  if (environment.MIGRATION_SHA256_INPUT !== EXPECTED_MIGRATION_SHA256) {
    fail('MIGRATION_HASH_MISMATCH')
  }
  if (environment.DEPLOY_CONFIRMATION !== EXPECTED_CONFIRMATION) {
    fail('INVALID_DEPLOYMENT_CONFIRMATION')
  }
  validateCurrentPrHead(environment.CURRENT_PR_HEAD_INPUT)
  return true
}

export function validateProductionChannel(environment = process.env) {
  if (
    environment.SUPABASE_PRODUCTION_CHANNEL_READY !== 'true' ||
    typeof environment.SUPABASE_PRODUCTION_DB_URL !== 'string' ||
    environment.SUPABASE_PRODUCTION_DB_URL.length === 0 ||
    environment.SUPABASE_PROJECT_ID !== EXPECTED_PROJECT_REF
  ) {
    fail('PRODUCTION_CHANNEL_NOT_READY')
  }
  return true
}

export async function validateLockedPullRequest(
  currentPrHead,
  fetchImplementation = globalThis.fetch,
) {
  validateCurrentPrHead(currentPrHead)
  if (typeof fetchImplementation !== 'function') fail('PR_STATE_INVALID')
  let response
  let record
  try {
    response = await fetchImplementation(
      `https://api.github.com/repos/${EXPECTED_REPOSITORY}/pulls/${APPROVED_PR_NUMBER}`,
      {
        method: 'GET',
        redirect: 'error',
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'tsu-waterbottle-booking-production-validator',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    )
    if (!response.ok) fail('PR_STATE_INVALID')
    record = await response.json()
  } catch (error) {
    if (
      error instanceof Error &&
      SAFE_ERROR_CODES.has(error.message)
    ) {
      throw error
    }
    fail('PR_STATE_INVALID')
  }
  if (
    record === null ||
    typeof record !== 'object' ||
    record.number !== APPROVED_PR_NUMBER ||
    record.state !== 'open' ||
    record.merged_at !== null ||
    record.draft !== false ||
    record.head?.ref !== APPROVED_HEAD_REF ||
    record.head?.sha !== currentPrHead ||
    record.base?.ref !== 'main'
  ) {
    fail('PR_STATE_INVALID')
  }
  if (currentPrHead !== APPROVED_SOURCE_COMMIT) {
    let comparisonResponse
    let comparison
    try {
      comparisonResponse = await fetchImplementation(
        `https://api.github.com/repos/${EXPECTED_REPOSITORY}/compare/${APPROVED_SOURCE_COMMIT}...${currentPrHead}`,
        {
          method: 'GET',
          redirect: 'error',
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent':
              'tsu-waterbottle-booking-production-validator',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        },
      )
      if (!comparisonResponse.ok) fail('PR_STATE_INVALID')
      comparison = await comparisonResponse.json()
    } catch (error) {
      if (
        error instanceof Error &&
        SAFE_ERROR_CODES.has(error.message)
      ) {
        throw error
      }
      fail('PR_STATE_INVALID')
    }
    if (
      comparison === null ||
      typeof comparison !== 'object' ||
      comparison.status !== 'ahead' ||
      comparison.base_commit?.sha !== APPROVED_SOURCE_COMMIT ||
      comparison.merge_base_commit?.sha !== APPROVED_SOURCE_COMMIT ||
      comparison.ahead_by < 1 ||
      comparison.behind_by !== 0
    ) {
      fail('PR_STATE_INVALID')
    }
  }
  return true
}

function resolveFixedPath(root, relativePath) {
  if (
    typeof root !== 'string' ||
    typeof relativePath !== 'string' ||
    !relativePath ||
    isAbsolute(relativePath)
  ) {
    fail('FIXED_FILE_INVALID')
  }
  const repositoryRoot = resolve(root)
  const filePath = resolve(repositoryRoot, relativePath)
  const pathFromRoot = relative(repositoryRoot, filePath)
  if (
    !pathFromRoot ||
    pathFromRoot === '..' ||
    pathFromRoot.startsWith(`..${sep}`) ||
    isAbsolute(pathFromRoot)
  ) {
    fail('FIXED_FILE_INVALID')
  }
  return filePath
}

export function readFixedRegularFile(root, relativePath) {
  const filePath = resolveFixedPath(root, relativePath)
  try {
    const stat = lstatSync(filePath)
    if (!stat.isFile() || stat.isSymbolicLink()) fail('FIXED_FILE_INVALID')
    return readFileSync(filePath, 'utf8')
  } catch (error) {
    if (
      error instanceof Error &&
      SAFE_ERROR_CODES.has(error.message)
    ) {
      throw error
    }
    fail('FIXED_FILE_INVALID')
  }
}

export function readAndValidateFixedFile(
  root,
  relativePath,
  expectedHash,
) {
  if (!SHA256_PATTERN.test(expectedHash)) fail('FIXED_FILE_INVALID')
  const contents = readFixedRegularFile(root, relativePath)
  const actualHash = createHash('sha256').update(contents).digest('hex')
  if (actualHash !== expectedHash) fail('FIXED_FILE_HASH_MISMATCH')
  return contents
}

export function calculateGitBlobId(contents) {
  const bytes = Buffer.isBuffer(contents)
    ? contents
    : Buffer.from(String(contents), 'utf8')
  return createHash('sha1')
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest('hex')
}

export function validateApprovedSource(approvedSourceRoot) {
  if (
    typeof approvedSourceRoot !== 'string' ||
    !isAbsolute(approvedSourceRoot)
  ) {
    fail('APPROVED_SOURCE_INVALID')
  }
  let root
  try {
    const stat = lstatSync(approvedSourceRoot)
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      fail('APPROVED_SOURCE_INVALID')
    }
    root = realpathSync(approvedSourceRoot)
  } catch (error) {
    if (
      error instanceof Error &&
      SAFE_ERROR_CODES.has(error.message)
    ) {
      throw error
    }
    fail('APPROVED_SOURCE_INVALID')
  }

  let head
  let status
  let treeRecord
  try {
    head = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    status = execFileSync(
      'git',
      ['status', '--porcelain', '--untracked-files=no'],
      {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    )
    treeRecord = execFileSync(
      'git',
      ['ls-tree', 'HEAD', '--', MIGRATION_FILE],
      {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    ).trim()
  } catch {
    fail('APPROVED_SOURCE_INVALID')
  }
  if (
    head !== APPROVED_SOURCE_COMMIT ||
    status !== '' ||
    treeRecord !==
      `100644 blob ${EXPECTED_MIGRATION_GIT_BLOB}\t${MIGRATION_FILE}`
  ) {
    fail('APPROVED_SOURCE_INVALID')
  }

  const migration = readAndValidateFixedFile(
    root,
    MIGRATION_FILE,
    EXPECTED_MIGRATION_SHA256,
  )
  if (
    !GIT_BLOB_PATTERN.test(EXPECTED_MIGRATION_GIT_BLOB) ||
    calculateGitBlobId(migration) !== EXPECTED_MIGRATION_GIT_BLOB
  ) {
    fail('APPROVED_SOURCE_INVALID')
  }
  return root
}

export function stripSqlForStaticAnalysis(sql) {
  if (typeof sql !== 'string') fail('INVALID_SQL_SYNTAX')
  let output = ''
  let index = 0
  let state = 'code'
  let dollarTag = ''
  while (index < sql.length) {
    const current = sql[index]
    const next = sql[index + 1]
    if (state === 'line-comment') {
      output += current === '\n' ? '\n' : ' '
      if (current === '\n') state = 'code'
      index += 1
      continue
    }
    if (state === 'block-comment') {
      if (current === '*' && next === '/') {
        output += '  '
        index += 2
        state = 'code'
      } else {
        output += current === '\n' ? '\n' : ' '
        index += 1
      }
      continue
    }
    if (state === 'single-quote') {
      if (current === "'" && next === "'") {
        output += '  '
        index += 2
      } else if (current === "'") {
        output += ' '
        index += 1
        state = 'code'
      } else {
        output += current === '\n' ? '\n' : ' '
        index += 1
      }
      continue
    }
    if (state === 'dollar-quote') {
      if (sql.startsWith(dollarTag, index)) {
        output += ' '.repeat(dollarTag.length)
        index += dollarTag.length
        state = 'code'
      } else {
        output += current === '\n' ? '\n' : ' '
        index += 1
      }
      continue
    }
    if (current === '-' && next === '-') {
      output += '  '
      index += 2
      state = 'line-comment'
      continue
    }
    if (current === '/' && next === '*') {
      output += '  '
      index += 2
      state = 'block-comment'
      continue
    }
    if (current === "'") {
      output += ' '
      index += 1
      state = 'single-quote'
      continue
    }
    const dollarMatch =
      /^\$[a-zA-Z_][a-zA-Z0-9_]*\$|^\$\$/u.exec(sql.slice(index))
    if (dollarMatch) {
      dollarTag = dollarMatch[0]
      output += ' '.repeat(dollarTag.length)
      index += dollarTag.length
      state = 'dollar-quote'
      continue
    }
    output += current
    index += 1
  }
  if (['block-comment', 'single-quote', 'dollar-quote'].includes(state)) {
    fail('INVALID_SQL_SYNTAX')
  }
  return output
}

export function assertReadOnlyPreflight(sql) {
  const normalized = stripSqlForStaticAnalysis(sql)
  if (
    !/^\s*with\b/iu.test(normalized) ||
    (normalized.match(/;/gu) ?? []).length !== 1 ||
    !/;\s*$/u.test(normalized) ||
    /\b(insert|update|delete|truncate|create|alter|drop|grant|revoke|comment|call|copy|do|begin|commit|rollback|savepoint|release|prepare|execute|set\s+role|reset\s+role|listen|notify|vacuum|analyze|reindex|cluster)\b/iu.test(
      normalized,
    )
  ) {
    fail('UNSAFE_AUDIT_SQL')
  }
  for (const [token, expectedCount] of [
    ["'BOOKING_ATOMIC_PREFLIGHT'", 1],
    ["'bookings_active_schedule_no_overlap'", 1],
    ["'create_booking_with_available_slot'", 1],
    ['active_overlap_pairs', 3],
  ]) {
    if (sql.split(token).length !== expectedCount + 1) {
      fail('UNSAFE_AUDIT_SQL')
    }
  }
  return true
}

export function assertDeploySql(sql) {
  const requiredOnce = [
    '\\ir booking_atomic_create_preflight.sql',
    '\\ir booking_atomic_create_locked_guard.sql',
    '\\ir /approved-source/supabase/migrations/20260725123441_create_booking_with_available_slot.sql',
    '\\ir booking_atomic_create_postflight.sql',
    'lock table',
    'public.bookings,',
    'public.consultation_availability_slots,',
    'public.consultation_plans',
    'in access exclusive mode;',
    "set local lock_timeout = '15s';",
    "set local statement_timeout = '120s';",
    "set local idle_in_transaction_session_timeout = '30s';",
  ]
  for (const token of requiredOnce) {
    if (sql.split(token).length !== 2) fail('FIXED_FILE_INVALID')
  }
  if (
    (sql.match(/\bbegin;/giu) ?? []).length !== 1 ||
    (sql.match(/\bcommit;/giu) ?? []).length !== 1 ||
    (sql.match(/^\\ir\s/gmu) ?? []).length !== 4 ||
    /\\i\s|\\!|\\copy|:[{]?include|base64/iu.test(sql)
  ) {
    fail('FIXED_FILE_INVALID')
  }
  return true
}

export function assertLockedGuardSql(sql) {
  const normalized = stripSqlForStaticAnalysis(sql)
  for (const [token, expectedCount] of [
    ['do $guard$', 1],
    ["'BOOKING_ATOMIC_LOCKED_DATABASE_DRIFT'", 1],
    ["'BOOKING_ATOMIC_LOCKED_SCHEMA_DRIFT'", 1],
    ["'BOOKING_ATOMIC_LOCKED_DATA_DRIFT'", 1],
    ["'bookings_active_schedule_no_overlap'", 1],
    ["'create_booking_with_available_slot'", 1],
    ['active_overlap_pairs', 3],
  ]) {
    if (sql.split(token).length !== expectedCount + 1) {
      fail('FIXED_FILE_INVALID')
    }
  }
  if (
    !/^\s*do\b/iu.test(normalized) ||
    (normalized.match(/;/gu) ?? []).length < 1 ||
    !/;\s*$/u.test(normalized) ||
    /\b(insert|update|delete|truncate|create|alter|drop|grant|revoke|comment|call|copy|commit|rollback|savepoint|release|prepare|execute|set\s+role|reset\s+role|listen|notify|vacuum|analyze|reindex|cluster)\b/iu.test(
      normalized,
    )
  ) {
    fail('FIXED_FILE_INVALID')
  }
  return true
}

export function assertPostflightSql(sql) {
  for (const [token, expectedCount] of [
    ["'BOOKING_ATOMIC_POSTFLIGHT'", 1],
    ["'BOOKING_FUNCTION_ACL_MISMATCH'", 1],
    ["'BOOKING_POSTFLIGHT_IDENTITY_MISMATCH'", 1],
    ["'BOOKING_ATOMIC_SMOKE_UNEXPECTED_SUCCESS'", 1],
    ["'BOOKING_ATOMIC_SMOKE_WRONG_FAILURE'", 1],
    ["'BOOKING_ATOMIC_SMOKE_ROLLBACK_FAILED'", 1],
    ["'bookings_user_id_fkey'", 2],
    ['savepoint booking_atomic_smoke;', 3],
    ['rollback to savepoint booking_atomic_smoke;', 1],
    ['release savepoint booking_atomic_smoke;', 1],
    ['set local role service_role;', 1],
    ['reset role;', 1],
    [EXPECTED_FUNCTION_DEFINITION_MD5, 1],
    [EXPECTED_CONSTRAINT_DEFINITION_MD5, 1],
    [APPROVED_SOURCE_COMMIT, 1],
    [MIGRATION_FILE, 1],
    [EXPECTED_MIGRATION_SHA256, 1],
  ]) {
    if (sql.split(token).length !== expectedCount + 1) {
      fail('FIXED_FILE_INVALID')
    }
  }
  if (
    /\\i|\\!|\\copy/iu.test(sql) ||
    (sql.match(/insert into public[.]consultation_plans/giu) ?? [])
      .length !== 1 ||
    (
      sql.match(
        /insert into public[.]consultation_availability_slots/giu,
      ) ?? []
    ).length !== 1
  ) {
    fail('FIXED_FILE_INVALID')
  }
  return true
}

export function validatePipelineSource(root, approvedSourceRoot) {
  const workflow = readFixedRegularFile(root, WORKFLOW_FILE)
  const runner = readFixedRegularFile(root, RUNNER_FILE)
  const validator = readFixedRegularFile(root, VALIDATOR_FILE)
  const test = readFixedRegularFile(root, PIPELINE_TEST_FILE)
  const preflight = readFixedRegularFile(root, PREFLIGHT_FILE)
  const lockedGuard = readFixedRegularFile(root, LOCKED_GUARD_FILE)
  const deploy = readFixedRegularFile(root, DEPLOY_FILE)
  const postflight = readFixedRegularFile(root, POSTFLIGHT_FILE)
  assertReadOnlyPreflight(preflight)
  assertLockedGuardSql(lockedGuard)
  assertDeploySql(deploy)
  assertPostflightSql(postflight)
  validateApprovedSource(approvedSourceRoot)

  const workflowTokens = [
    'name: Supabase Production Booking Atomic Migration',
    'workflow_dispatch:',
    'current_pr_head:',
    'environment:',
    'name: supabase-production',
    `ref: ${APPROVED_SOURCE_COMMIT}`,
    'path: approved-source',
    'SUPABASE_PRODUCTION_DB_URL: ${{ secrets.SUPABASE_PRODUCTION_DB_URL }}',
    'node scripts/supabase/run-booking-atomic-production-exact-file.mjs image',
    'node scripts/supabase/run-booking-atomic-production-exact-file.mjs preflight',
    'node scripts/supabase/run-booking-atomic-production-exact-file.mjs deploy',
    'node scripts/supabase/validate-booking-atomic-production-deployment.mjs pr',
    'CURRENT_PR_HEAD_INPUT: ${{ inputs.current_pr_head }}',
  ]
  if (workflowTokens.some((token) => !workflow.includes(token))) {
    fail('SOURCE_VALIDATION_FAILED')
  }
  if (
    workflow.split(`ref: ${APPROVED_SOURCE_COMMIT}`).length !== 3 ||
    (
      workflow.match(
        /node scripts\/supabase\/run-booking-atomic-production-exact-file[.]mjs image/gu,
      ) ?? []
    ).length !== 2 ||
    (
      workflow.match(
        /node scripts\/supabase\/run-booking-atomic-production-exact-file[.]mjs preflight/gu,
      ) ?? []
    ).length !== 1 ||
    (
      workflow.match(
        /node scripts\/supabase\/validate-booking-atomic-production-deployment[.]mjs pr/gu,
      ) ?? []
    ).length !== 2 ||
    (
      workflow.match(
        /node scripts\/supabase\/run-booking-atomic-production-exact-file[.]mjs deploy/gu,
      ) ?? []
    ).length !== 1 ||
    /(?:^|\s)(?:psql|supabase\s+(?:db|migration)|curl|wget)\b/iu.test(
      workflow,
    ) ||
    /--force|apply-all|migration up|db push/iu.test(workflow)
  ) {
    fail('SOURCE_VALIDATION_FAILED')
  }
  const sourceJob = workflow.slice(
    workflow.indexOf('  source-validation:'),
    workflow.indexOf('  deploy-production:'),
  )
  if (
    !sourceJob ||
    /secrets[.]|environment:\s*\n\s+name:\s*supabase-production/iu.test(
      sourceJob,
    ) ||
    !sourceJob.includes(
      'node supabase/tests/run_booking_atomic_production_pipeline_postgres17.mjs',
    )
  ) {
    fail('SOURCE_VALIDATION_FAILED')
  }

  for (const token of [
    APPROVED_SOURCE_COMMIT,
    EXPECTED_MIGRATION_SHA256,
    EXPECTED_MIGRATION_GIT_BLOB,
    MIGRATION_FILE,
    POSTGRES_IMAGE,
    POSTGRES_IMAGE_INDEX_DIGEST,
    POSTGRES_IMAGE_CONFIG_ID,
    POSTGRES_PLATFORM,
  ]) {
    if (
      !runner.includes(token) &&
      !validator.includes(token) &&
      !test.includes(token)
    ) {
      fail('SOURCE_VALIDATION_FAILED')
    }
  }
  return true
}

function parseRecord(line) {
  let record
  try {
    record = JSON.parse(line)
  } catch {
    fail('DATABASE_OUTPUT_INVALID')
  }
  assertPlainObject(record)
  return record
}

export function validatePreflightRecord(record) {
  assertExactKeys(record, [
    'active_overlap_pairs',
    'constraint_count',
    'constraint_exact_count',
    'contract_version',
    'function_exact_count',
    'function_named_count',
    'function_signature_count',
    'marker',
    'postgres_major',
    'primary_database',
    'relation_count',
  ])
  if (
    record.marker !== 'BOOKING_ATOMIC_PREFLIGHT' ||
    record.contract_version !== 1 ||
    record.postgres_major !== EXPECTED_PSQL_MAJOR ||
    record.primary_database !== true ||
    record.relation_count !== 3
  ) {
    fail('SCHEMA_DRIFT')
  }
  if (record.active_overlap_pairs !== 0) {
    fail('PRODUCTION_DATA_DRIFT')
  }
  if (
    record.constraint_count === 0 &&
    record.constraint_exact_count === 0 &&
    record.function_named_count === 0 &&
    record.function_signature_count === 0 &&
    record.function_exact_count === 0
  ) {
    return true
  }
  if (
    record.constraint_count === 1 &&
    record.constraint_exact_count === 1 &&
    record.function_named_count === 1 &&
    record.function_signature_count === 1 &&
    record.function_exact_count === 1
  ) {
    fail('ALREADY_APPLIED')
  }
  fail('SCHEMA_DRIFT')
}

export function validatePostflightRecord(record) {
  assertExactKeys(record, [
    'approved_source_commit',
    'anon_execute',
    'authenticated_execute',
    'constraint_definition_md5',
    'contract_version',
    'function_definition_md5',
    'marker',
    'expected_failure_constraint',
    'migration_path',
    'migration_sha256',
    'postgres_major',
    'rollback_atomic_smoke',
    'security_invoker',
    'service_role_execute',
    'synthetic_rows_persisted',
  ])
  if (
    record.marker !== 'BOOKING_ATOMIC_POSTFLIGHT' ||
    record.contract_version !== 1 ||
    record.postgres_major !== EXPECTED_PSQL_MAJOR ||
    record.approved_source_commit !== APPROVED_SOURCE_COMMIT ||
    record.migration_path !== MIGRATION_FILE ||
    record.migration_sha256 !== EXPECTED_MIGRATION_SHA256 ||
    record.constraint_definition_md5 !==
      EXPECTED_CONSTRAINT_DEFINITION_MD5 ||
    record.function_definition_md5 !== EXPECTED_FUNCTION_DEFINITION_MD5 ||
    record.expected_failure_constraint !== 'bookings_user_id_fkey' ||
    record.service_role_execute !== true ||
    record.authenticated_execute !== false ||
    record.anon_execute !== false ||
    record.security_invoker !== true ||
    record.rollback_atomic_smoke !== true ||
    record.synthetic_rows_persisted !== false
  ) {
    fail('POSTFLIGHT_CONTRACT_FAILED')
  }
  return true
}

export function parseAndValidateAuditOutput(stdout, phase) {
  if (typeof stdout !== 'string') fail('DATABASE_OUTPUT_INVALID')
  const lines = stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
  if (phase === 'preflight') {
    if (lines.length !== 1) fail('DATABASE_OUTPUT_INVALID')
    validatePreflightRecord(parseRecord(lines[0]))
    return true
  }
  if (phase === 'deploy') {
    if (lines.length !== 2) fail('DATABASE_OUTPUT_INVALID')
    validatePreflightRecord(parseRecord(lines[0]))
    validatePostflightRecord(parseRecord(lines[1]))
    return true
  }
  fail('DATABASE_OUTPUT_INVALID')
}

export function safeFailureCode(error) {
  return error instanceof Error && SAFE_ERROR_CODES.has(error.message)
    ? error.message
    : 'SOURCE_VALIDATION_FAILED'
}

async function main() {
  if (process.argv.length !== 3) fail('SOURCE_CONTEXT_INVALID')
  const mode = process.argv[2]
  const repositoryRoot = resolve(
    new URL('../..', import.meta.url).pathname,
  )
  if (mode === 'node') {
    validateNodeVersion()
    console.log('NODE_RUNTIME_VALIDATED')
    return
  }
  if (mode === 'image') {
    validatePostgresImage(process.env.POSTGRES_IMAGE)
    console.log('POSTGRES_IMAGE_VALIDATED')
    return
  }
  if (mode === 'source') {
    validateWorkflowContext()
    validatePipelineSource(
      repositoryRoot,
      process.env.APPROVED_SOURCE_ROOT,
    )
    console.log('SOURCE_VALIDATED')
    return
  }
  if (mode === 'pr') {
    await validateLockedPullRequest(process.env.CURRENT_PR_HEAD_INPUT)
    console.log('PR_HEAD_VALIDATED')
    return
  }
  if (mode === 'channel') {
    validateProductionChannel()
    console.log('PRODUCTION_CHANNEL_VALIDATED')
    return
  }
  fail('SOURCE_CONTEXT_INVALID')
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : ''
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(safeFailureCode(error))
    process.exitCode = 1
  })
}
