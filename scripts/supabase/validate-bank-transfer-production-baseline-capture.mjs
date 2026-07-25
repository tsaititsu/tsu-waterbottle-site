import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

export const EXPECTED_REPOSITORY = 'tsaititsu/tsu-waterbottle-site'
export const EXPECTED_PROJECT_REF = 'ndbqoznvobmpkgxkiezz'
export const EXPECTED_EVENT = 'workflow_dispatch'
export const EXPECTED_REF = 'refs/heads/main'
export const EXPECTED_CONFIRMATION =
  'CAPTURE_BANK_TRANSFER_BASELINE_READ_ONLY_ONCE'
export const EXPECTED_NODE_VERSION = 'v24.16.0'
export const POSTGRES_IMAGE =
  'postgres@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193'
export const CAPTURE_FILE =
  'supabase/deployment/bank_transfer_historical_baseline_capture.sql'
export const RUNNER_FILE =
  'scripts/supabase/run-bank-transfer-production-baseline-capture.mjs'
export const VALIDATOR_FILE =
  'scripts/supabase/validate-bank-transfer-production-baseline-capture.mjs'
export const WORKFLOW_FILE =
  '.github/workflows/supabase-production-bank-transfer-baseline-capture.yml'
export const MIGRATION_FILE =
  'supabase/migrations/20260719033404_line_pay_remediation_contracts.sql'
export const FENCE_MIGRATION_FILE =
  'supabase/migrations/20260722065311_retire_bank_transfer_submissions_writes.sql'
export const ARTIFACT_FILENAME =
  'bank-transfer-baseline-capture.json'
export const ARTIFACT_NAME =
  'bank-transfer-baseline-capture'
export const ARTIFACT_RETENTION_DAYS = 1
export const EXPECTED_CAPTURE_SHA256 =
  '87d6bb39ef820ce3f51da2bae1a1dfad8efc735d651b34ec8290fc926f59d3e0'
export const EXPECTED_MIGRATION_SHA256 =
  '370984c499d93f602b3dccf876becd030085e88ccd9a17106fee8b0009d84046'
export const EXPECTED_FENCE_SHA256 =
  '2f43979b1f4ff88243296f0a389c146b879652715d40d23bdb7ce1d6785407d7'
export const MAX_BASELINE_CAPTURE_BYTES = 16 * 1024

export const SAFE_FAILURE_CODES = Object.freeze([
  'BASELINE_CAPTURE_CHANNEL_RETIRED',
  'SOURCE_CONTEXT_INVALID',
  'INVALID_NODE_VERSION',
  'POSTGRES_IMAGE_MISMATCH',
  'PRODUCTION_CHANNEL_NOT_READY',
  'DATABASE_TARGET_MISMATCH',
  'DATABASE_URL_INVALID',
  'BASELINE_CAPTURE_SQL_INVALID',
  'BASELINE_CAPTURE_DOCKER_IMAGE_PULL_FAILED',
  'BASELINE_CAPTURE_TEMP_CREDENTIAL_CREATE_FAILED',
  'BASELINE_CAPTURE_CONTAINER_START_FAILED',
  'BASELINE_CAPTURE_CONTAINER_EXEC_FAILED',
  'BASELINE_CAPTURE_DB_CONNECT_FAILED',
  'BASELINE_CAPTURE_SQL_EXECUTION_FAILED',
  'BASELINE_CAPTURE_OUTPUT_INVALID',
  'BASELINE_CAPTURE_LIMIT_EXCEEDED',
  'BASELINE_ARTIFACT_WRITE_FAILED',
  'PROCESS_INTERRUPTED',
  'TEMP_CREDENTIAL_CLEANUP_FAILED',
])

const BASELINE_CAPTURE_CHANNEL_RETIRED = true
const SAFE_FAILURE_CODE_SET = new Set(SAFE_FAILURE_CODES)
const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/u
const SHA256_PATTERN = /^[0-9a-f]{64}$/u
const TOP_LEVEL_KEYS = Object.freeze([
  'schema_signature',
  'group_digests',
  'ordinal_digests',
  'row_count',
  'pk_digest',
  'pending_review_count',
])
export const GROUP_KEYS = Object.freeze([
  'identity_and_amount',
  'payer_contact',
  'transfer_details',
  'review_and_confirmation',
  'full_canonical_row',
])
export const ORDINAL_KEYS = Object.freeze([
  'ordinal_1',
  'ordinal_2',
  'ordinal_3',
])

function fail(code) {
  throw new Error(code)
}

function assertPlainObject(value, code) {
  if (
    value === null ||
    Array.isArray(value) ||
    typeof value !== 'object' ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail(code)
  }
}

function assertExactKeys(value, keys, code) {
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

function assertDigest(value) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    fail('BASELINE_CAPTURE_OUTPUT_INVALID')
  }
}

function assertDigestGroup(value) {
  assertExactKeys(
    value,
    GROUP_KEYS,
    'BASELINE_CAPTURE_OUTPUT_INVALID',
  )
  for (const key of GROUP_KEYS) assertDigest(value[key])
}

function freezeArtifact(value) {
  const groupDigests = Object.freeze({ ...value.group_digests })
  const ordinalDigests = {}
  for (const key of ORDINAL_KEYS) {
    ordinalDigests[key] = Object.freeze({
      ...value.ordinal_digests[key],
    })
  }
  return Object.freeze({
    ...value,
    group_digests: groupDigests,
    ordinal_digests: Object.freeze(ordinalDigests),
  })
}

function readFixedRegularFile(root, relativePath) {
  if (
    typeof root !== 'string' ||
    typeof relativePath !== 'string' ||
    !relativePath ||
    isAbsolute(relativePath)
  ) {
    fail('SOURCE_CONTEXT_INVALID')
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
    fail('SOURCE_CONTEXT_INVALID')
  }
  try {
    const stat = lstatSync(filePath)
    if (!stat.isFile() || stat.isSymbolicLink()) {
      fail('SOURCE_CONTEXT_INVALID')
    }
    return readFileSync(filePath, 'utf8')
  } catch (error) {
    if (
      error instanceof Error &&
      SAFE_FAILURE_CODE_SET.has(error.message)
    ) {
      throw error
    }
    fail('SOURCE_CONTEXT_INVALID')
  }
}

export function validateNodeVersion(value = process.version) {
  if (value !== EXPECTED_NODE_VERSION) fail('INVALID_NODE_VERSION')
  return true
}

export function validatePostgresImage(value) {
  if (value !== POSTGRES_IMAGE) fail('POSTGRES_IMAGE_MISMATCH')
  return true
}

export function validateWorkflowContext(environment = process.env) {
  if (BASELINE_CAPTURE_CHANNEL_RETIRED) {
    fail('BASELINE_CAPTURE_CHANNEL_RETIRED')
  }
  validateNodeVersion()
  if (
    environment.GITHUB_REPOSITORY !== EXPECTED_REPOSITORY ||
    environment.GITHUB_EVENT_NAME !== EXPECTED_EVENT ||
    environment.GITHUB_REF !== EXPECTED_REF ||
    typeof environment.GITHUB_SHA !== 'string' ||
    !FULL_SHA_PATTERN.test(environment.GITHUB_SHA) ||
    environment.GITHUB_SHA !== environment.AUTHORIZED_COMMIT ||
    environment.PROJECT_REF_INPUT !== EXPECTED_PROJECT_REF ||
    environment.BASELINE_CAPTURE_CONFIRMATION !== EXPECTED_CONFIRMATION
  ) {
    fail('SOURCE_CONTEXT_INVALID')
  }
  return true
}

export function validateProductionChannel(environment = process.env) {
  if (
    environment.SUPABASE_PRODUCTION_CHANNEL_READY !== 'true' ||
    typeof environment.SUPABASE_PRODUCTION_DB_URL !== 'string' ||
    environment.SUPABASE_PRODUCTION_DB_URL.length === 0 ||
    environment.SUPABASE_PROJECT_ID !== EXPECTED_PROJECT_REF ||
    typeof environment.RUNNER_TEMP !== 'string' ||
    !isAbsolute(environment.RUNNER_TEMP)
  ) {
    fail('PRODUCTION_CHANNEL_NOT_READY')
  }
  return true
}

export function stripSqlForStaticAnalysis(sql) {
  if (typeof sql !== 'string') fail('BASELINE_CAPTURE_SQL_INVALID')
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
  if (state !== 'code' && state !== 'line-comment') {
    fail('BASELINE_CAPTURE_SQL_INVALID')
  }
  return output
}

export function assertCaptureSql(sql) {
  if (
    typeof sql !== 'string' ||
    Buffer.byteLength(sql, 'utf8') > 128 * 1024 ||
    (sql.match(
      /^BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;$/gmu,
    ) ?? []).length !== 1 ||
    (sql.match(/^ROLLBACK;$/gmu) ?? []).length !== 1 ||
    /^\\/mu.test(sql) ||
    /string_agg[(]\s*to_jsonb[(]row_value[)]/iu.test(sql)
  ) {
    fail('BASELINE_CAPTURE_SQL_INVALID')
  }
  const normalized = stripSqlForStaticAnalysis(sql)
  const forbidden =
    /\b(insert|update|delete|merge|truncate|create|alter|drop|grant|revoke|comment|copy|call|do|execute|security\s+definer|set\s+role|lock\s+table|select\s+for\s+(?:update|share)|pg_sleep|dblink|listen|notify|vacuum|analyze|reindex|cluster|prepare|savepoint|release)\b|\bpg_(?:try_)?advisory_(?:lock|xact_lock|unlock)\b|\bpg_(?:cancel|terminate)_backend\b/iu
  if (
    forbidden.test(normalized) ||
    (normalized.match(/^\s*begin\s+transaction\b/gimu) ?? []).length !== 1 ||
    (normalized.match(/^\s*rollback\s*;/gimu) ?? []).length !== 1 ||
    (normalized.match(/;/gu) ?? []).length !== 3
  ) {
    fail('BASELINE_CAPTURE_SQL_INVALID')
  }
  for (const column of [
    'id',
    'user_id',
    'item_type',
    'item_id',
    'item_name',
    'amount_twd',
    'payer_name',
    'payer_phone',
    'payer_email',
    'line_display_name',
    'bank_account_last5',
    'transfer_time',
    'note',
    'status',
    'admin_note',
    'created_at',
    'confirmed_at',
  ]) {
    if (!sql.includes(`'${column}'`)) {
      fail('BASELINE_CAPTURE_SQL_INVALID')
    }
  }
  for (const group of GROUP_KEYS) {
    if (!sql.includes(`'${group}'`)) {
      fail('BASELINE_CAPTURE_SQL_INVALID')
    }
  }
  return true
}

export function parseAndValidateBaselineArtifact(text) {
  if (
    typeof text !== 'string' ||
    Buffer.byteLength(text, 'utf8') > MAX_BASELINE_CAPTURE_BYTES
  ) {
    fail('BASELINE_CAPTURE_OUTPUT_INVALID')
  }
  const rows = text
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
  if (rows.length !== 1) fail('BASELINE_CAPTURE_OUTPUT_INVALID')
  let value
  try {
    value = JSON.parse(rows[0])
  } catch {
    fail('BASELINE_CAPTURE_OUTPUT_INVALID')
  }
  assertExactKeys(
    value,
    TOP_LEVEL_KEYS,
    'BASELINE_CAPTURE_OUTPUT_INVALID',
  )
  assertDigest(value.schema_signature)
  assertDigest(value.pk_digest)
  assertDigestGroup(value.group_digests)
  assertExactKeys(
    value.ordinal_digests,
    ORDINAL_KEYS,
    'BASELINE_CAPTURE_OUTPUT_INVALID',
  )
  for (const key of ORDINAL_KEYS) {
    assertDigestGroup(value.ordinal_digests[key])
  }
  if (
    value.row_count !== 3 ||
    value.pending_review_count !== 3
  ) {
    fail('BASELINE_CAPTURE_OUTPUT_INVALID')
  }
  return freezeArtifact(value)
}

export function assertWorkflowSource(source) {
  if (typeof source !== 'string') fail('SOURCE_CONTEXT_INVALID')
  const actionUses = [...source.matchAll(/^\s+uses: ([^\s]+)$/gmu)].map(
    (match) => match[1],
  )
  if (
    !/^name: Supabase Production Bank Transfer Baseline Capture$/mu.test(
      source,
    ) ||
    !/^on:\n  workflow_dispatch:$/mu.test(source) ||
    /^\s{2}(?:push|pull_request|schedule|workflow_call|repository_dispatch):/gmu.test(
      source,
    ) ||
    !/^permissions:\n  contents: read$/mu.test(source) ||
    !/^  group: supabase-production-bank-transfer-baseline-capture$/mu.test(
      source,
    ) ||
    !/^  cancel-in-progress: false$/mu.test(source) ||
    actionUses.length !== 5 ||
    actionUses.some((action) => !/^[^@]+@[0-9a-f]{40}$/u.test(action)) ||
    (
      source.match(
        /node scripts\/supabase\/run-bank-transfer-production-baseline-capture[.]mjs/gu,
      ) ?? []
    ).length !== 1 ||
    (source.match(/actions\/upload-artifact@[0-9a-f]{40}/gu) ?? [])
      .length !== 1 ||
    !/retention-days: 1/u.test(source) ||
    !/if-no-files-found: error/u.test(source) ||
    !/include-hidden-files: false/u.test(source) ||
    !/archive: false/u.test(source) ||
    /run-line-pay-production-exact-file|line_pay_remediation_(?:deploy|preflight|postflight)|\bpsql\b|supabase\s+(?:db|migration)/iu.test(
      source,
    )
  ) {
    fail('SOURCE_CONTEXT_INVALID')
  }
  return true
}

export function assertRunnerSource(source) {
  if (
    typeof source !== 'string' ||
    !source.includes('export const DATABASE_SESSION_LIMIT = 1') ||
    !source.includes('writePrivateArtifact(') ||
    !source.includes('buildSafeSuccessAttestation(artifact)') ||
    !source.includes('console.log(JSON.stringify(attestation))') ||
    /console[.](?:log|error)\s*\([^)]*(?:stdout|artifact)|shell:\s*true|spawnSync|\bretry\b|\bfallback\b|docker[.]sock|supabase\s+(?:db|migration)/iu.test(
      source,
    )
  ) {
    fail('SOURCE_CONTEXT_INVALID')
  }
  return true
}

function assertFixedHash(root, file, expectedHash) {
  const contents = readFixedRegularFile(root, file)
  if (
    !SHA256_PATTERN.test(expectedHash) ||
    createHash('sha256').update(contents).digest('hex') !== expectedHash
  ) {
    fail('SOURCE_CONTEXT_INVALID')
  }
  return contents
}

function runGit(args, root) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      env: {
        LANG: 'C.UTF-8',
        LC_ALL: 'C.UTF-8',
        PATH: process.env.PATH ?? '/usr/bin:/bin',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch {
    fail('SOURCE_CONTEXT_INVALID')
  }
}

export function validateSource(
  environment = process.env,
  root = process.cwd(),
) {
  validateWorkflowContext(environment)
  const capture = assertFixedHash(
    root,
    CAPTURE_FILE,
    EXPECTED_CAPTURE_SHA256,
  )
  assertCaptureSql(capture)
  assertFixedHash(root, MIGRATION_FILE, EXPECTED_MIGRATION_SHA256)
  assertFixedHash(root, FENCE_MIGRATION_FILE, EXPECTED_FENCE_SHA256)
  assertRunnerSource(readFixedRegularFile(root, RUNNER_FILE))
  assertWorkflowSource(readFixedRegularFile(root, WORKFLOW_FILE))
  validatePostgresImage(POSTGRES_IMAGE)

  const githubSha = environment.GITHUB_SHA
  if (
    runGit(['rev-parse', 'HEAD'], root) !== githubSha ||
    runGit(['status', '--porcelain=v1', '--untracked-files=all'], root)
  ) {
    fail('SOURCE_CONTEXT_INVALID')
  }
  for (const file of [
    CAPTURE_FILE,
    RUNNER_FILE,
    VALIDATOR_FILE,
    WORKFLOW_FILE,
    MIGRATION_FILE,
    FENCE_MIGRATION_FILE,
  ]) {
    runGit(['ls-files', '--error-unmatch', file], root)
    runGit(['cat-file', '-e', `${githubSha}:${file}`], root)
  }
  return true
}

export function safeErrorCode(error) {
  return error instanceof Error &&
    SAFE_FAILURE_CODE_SET.has(error.message)
    ? error.message
    : 'BASELINE_CAPTURE_CONTAINER_EXEC_FAILED'
}

async function main() {
  if (process.argv.length !== 3) fail('SOURCE_CONTEXT_INVALID')
  const mode = process.argv[2]
  if (mode === 'source') {
    validateSource()
    console.log('SOURCE_VALIDATED')
    return
  }
  if (mode === 'node') {
    validateNodeVersion()
    console.log('NODE_VERSION_VALIDATED')
    return
  }
  if (mode === 'image') {
    validatePostgresImage(process.env.POSTGRES_IMAGE)
    console.log('POSTGRES_IMAGE_VALIDATED')
    return
  }
  fail('SOURCE_CONTEXT_INVALID')
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : ''
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(safeErrorCode(error))
    process.exitCode = 1
  })
}
