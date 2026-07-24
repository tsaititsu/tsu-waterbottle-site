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
  'RUN_BANK_TRANSFER_HISTORICAL_FORENSIC_READ_ONLY_ONCE'
export const EXPECTED_NODE_VERSION = 'v24.16.0'
export const POSTGRES_IMAGE =
  'postgres@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193'
export const FORENSIC_FILE =
  'supabase/deployment/bank_transfer_historical_forensic.sql'
export const RUNNER_FILE =
  'scripts/supabase/run-bank-transfer-production-forensic.mjs'
export const VALIDATOR_FILE =
  'scripts/supabase/validate-bank-transfer-production-forensic.mjs'
export const WORKFLOW_FILE =
  '.github/workflows/supabase-production-bank-transfer-forensic.yml'
export const MIGRATION_FILE =
  'supabase/migrations/20260719033404_line_pay_remediation_contracts.sql'
export const FENCE_MIGRATION_FILE =
  'supabase/migrations/20260722065311_retire_bank_transfer_submissions_writes.sql'
export const EXPECTED_FORENSIC_SHA256 =
  '93f0925bea029a579333e8e23afb7ba0ba7d43196027cfbbcb623f4b9010628e'
export const EXPECTED_MIGRATION_SHA256 =
  '370984c499d93f602b3dccf876becd030085e88ccd9a17106fee8b0009d84046'
export const EXPECTED_FENCE_SHA256 =
  '2f43979b1f4ff88243296f0a389c146b879652715d40d23bdb7ce1d6785407d7'
export const MAX_FORENSIC_OUTPUT_BYTES = 8192

export const SAFE_FAILURE_CODES = Object.freeze([
  'SOURCE_CONTEXT_INVALID',
  'INVALID_NODE_VERSION',
  'POSTGRES_IMAGE_MISMATCH',
  'PRODUCTION_CHANNEL_NOT_READY',
  'DATABASE_TARGET_MISMATCH',
  'DATABASE_URL_INVALID',
  'FORENSIC_SQL_INVALID',
  'FORENSIC_DOCKER_IMAGE_PULL_FAILED',
  'FORENSIC_TEMP_CREDENTIAL_CREATE_FAILED',
  'FORENSIC_CONTAINER_START_FAILED',
  'FORENSIC_CONTAINER_EXEC_FAILED',
  'FORENSIC_DB_CONNECT_FAILED',
  'FORENSIC_SQL_EXECUTION_FAILED',
  'FORENSIC_OUTPUT_INVALID',
  'FORENSIC_CAPTURE_LIMIT_EXCEEDED',
  'PROCESS_INTERRUPTED',
  'TEMP_CREDENTIAL_CLEANUP_FAILED',
])

const SAFE_FAILURE_CODE_SET = new Set(SAFE_FAILURE_CODES)
const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/u
const SHA256_PATTERN = /^[0-9a-f]{64}$/u
const OUTPUT_SENSITIVE_PATTERN =
  /postgres(?:ql)?:\/\/|supabase[.]co|pooler[.]supabase[.]com|[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:[.][a-z0-9-]+)+|\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b|\b[0-9a-f]{40}\b|\b[0-9a-f]{64}\b|\bauthorization\b|\bbearer\b|\bpassword\b|\bsecret\b|\btoken\b/iu

const TOP_LEVEL_KEYS = Object.freeze([
  'status',
  'database_identity_match',
  'fence_match',
  'row_count',
  'pk_digest_match',
  'pending_review_count',
  'pending_review_match',
  'full_content_digest_match',
  'schema_signature_match',
  'column_set_match',
  'column_order_match',
  'column_type_match',
  'column_nullability_match',
  'column_default_match',
  'column_generated_match',
  'column_identity_match',
  'no_dropped_columns',
  'commit_timestamp_tracking_enabled',
  'tuple_commit_timestamp_evidence_available',
  'rows_with_known_commit_timestamp',
  'table_stats_available',
  'table_stats_authoritative',
  'reported_insert_count',
  'reported_update_count',
  'reported_delete_count',
  'baseline_provenance_complete',
  'exact_changed_row_identifiable',
  'exact_changed_column_identifiable',
  'database_audit_log_evidence_status',
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

function assertExactKeys(value, expectedKeys, code) {
  assertPlainObject(value, code)
  if (
    !isDeepStrictEqual(
      Object.keys(value).sort(),
      [...expectedKeys].sort(),
    )
  ) {
    fail(code)
  }
}

function assertBoolean(value) {
  if (typeof value !== 'boolean') fail('FORENSIC_OUTPUT_INVALID')
}

function assertCount(value) {
  if (
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    fail('FORENSIC_OUTPUT_INVALID')
  }
}

function readFixedRegularFile(root, relativePath) {
  if (
    typeof root !== 'string' ||
    typeof relativePath !== 'string' ||
    !relativePath ||
    isAbsolute(relativePath)
  ) {
    fail('FORENSIC_SQL_INVALID')
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
    fail('FORENSIC_SQL_INVALID')
  }
  try {
    const stat = lstatSync(filePath)
    if (!stat.isFile() || stat.isSymbolicLink()) {
      fail('FORENSIC_SQL_INVALID')
    }
    return readFileSync(filePath, 'utf8')
  } catch (error) {
    if (
      error instanceof Error &&
      SAFE_FAILURE_CODE_SET.has(error.message)
    ) {
      throw error
    }
    fail('FORENSIC_SQL_INVALID')
  }
}

export function validateFullSha(value) {
  if (typeof value !== 'string' || !FULL_SHA_PATTERN.test(value)) {
    fail('SOURCE_CONTEXT_INVALID')
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
    environment.AUTHORIZED_COMMIT,
  )
  if (githubSha !== authorizedCommit) fail('SOURCE_CONTEXT_INVALID')
  if (
    environment.PROJECT_REF_INPUT !== EXPECTED_PROJECT_REF ||
    environment.FORENSIC_CONFIRMATION !== EXPECTED_CONFIRMATION
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
    environment.SUPABASE_PROJECT_ID !== EXPECTED_PROJECT_REF
  ) {
    fail('PRODUCTION_CHANNEL_NOT_READY')
  }
  return true
}

export function stripSqlForStaticAnalysis(sql) {
  if (typeof sql !== 'string') fail('FORENSIC_SQL_INVALID')
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
    fail('FORENSIC_SQL_INVALID')
  }
  return output
}

export function assertForensicSql(sql) {
  if (
    typeof sql !== 'string' ||
    Buffer.byteLength(sql, 'utf8') > 128 * 1024 ||
    !/^BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;$/mu.test(
      sql,
    ) ||
    !/^ROLLBACK;$/mu.test(sql) ||
    (sql.match(
      /^BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;$/gmu,
    ) ?? []).length !== 1 ||
    (sql.match(/^ROLLBACK;$/gmu) ?? []).length !== 1 ||
    /'(?:actual(?:_[a-z]+)*_?digest|primary_key|row_data|raw_data|record_data)'/iu.test(
      sql,
    )
  ) {
    fail('FORENSIC_SQL_INVALID')
  }
  const psqlCommands = sql.match(/^\\[^\r\n]+$/gmu) ?? []
  if (
    !isDeepStrictEqual(psqlCommands, [
      '\\gset',
      '\\if :forensic_shape_ready',
      '\\if :commit_timestamp_tracking_enabled',
      '\\gset',
      '\\else',
      '\\set rows_with_known_commit_timestamp 0',
      '\\endif',
      '\\else',
      '\\endif',
    ])
  ) {
    fail('FORENSIC_SQL_INVALID')
  }
  const normalized = stripSqlForStaticAnalysis(sql)
  const forbidden =
    /\b(insert|update|delete|merge|truncate|create|alter|drop|grant|revoke|comment|copy|call|do|execute|security\s+definer|set\s+role|lock\s+table|select\s+for\s+(?:update|share)|pg_sleep|dblink|listen|notify|vacuum|analyze|reindex|cluster|prepare|savepoint|release)\b|\bpg_(?:try_)?advisory_(?:lock|xact_lock|unlock)\b|\bpg_(?:cancel|terminate)_backend\b/iu
  if (
    forbidden.test(normalized) ||
    (normalized.match(/^\s*begin\s+transaction\b/gimu) ?? []).length !== 1 ||
    (normalized.match(/^\s*rollback\s*;/gimu) ?? []).length !== 1 ||
    (normalized.match(/;/gu) ?? []).length !== 4 ||
    !/as forensic_shape_ready,[\s\S]+as commit_timestamp_tracking_enabled\s*\\gset/iu.test(
      sql,
    )
  ) {
    fail('FORENSIC_SQL_INVALID')
  }
  return true
}

export function readAndValidateForensicFile(root = process.cwd()) {
  const sql = readFixedRegularFile(root, FORENSIC_FILE)
  const hash = createHash('sha256').update(sql).digest('hex')
  if (
    !SHA256_PATTERN.test(EXPECTED_FORENSIC_SHA256) ||
    hash !== EXPECTED_FORENSIC_SHA256
  ) {
    fail('FORENSIC_SQL_INVALID')
  }
  assertForensicSql(sql)
  return sql
}

function assertRequiredOnce(source, tokens) {
  for (const token of tokens) {
    if (source.split(token).length !== 2) fail('FORENSIC_SQL_INVALID')
  }
}

export function assertRunnerSource(source) {
  if (typeof source !== 'string') fail('FORENSIC_SQL_INVALID')
  assertRequiredOnce(source, [
    'export const DATABASE_SESSION_LIMIT = 1',
    'validateCliArguments(process.argv)',
    'let databaseSessionExecutions = 0',
    'databaseSessionExecutions += 1',
    'if (databaseSessionExecutions !== DATABASE_SESSION_LIMIT)',
    'const dockerRunArgs = buildDockerRunArgs(',
    'state: FORENSIC_STATES.SOURCE_VALIDATED',
    'execution.state = FORENSIC_STATES.CREDENTIAL_CREATED',
    'execution.state = FORENSIC_STATES.IMAGE_PULL_STARTED',
    'execution.state = FORENSIC_STATES.IMAGE_PULL_COMPLETED',
    'execution.state = FORENSIC_STATES.CONTAINER_STARTED',
    'execution.state = FORENSIC_STATES.PSQL_COMPLETED',
    'execution.state = FORENSIC_STATES.OUTPUT_VALIDATED',
    'execution.state = FORENSIC_STATES.CREDENTIAL_CLEANED',
    'export function validateFailureAttestation(attestation)',
    '  validateFailureAttestation(attestation)\n  return Object.freeze',
    'classifyFailureForState(execution.state, error)',
    'await cleanupCredentialsOnce()',
    'JSON.stringify(toSafeFailureAttestation(error))',
  ])
  if (
    /shell:\s*true|spawnSync|\b(?:execFile|execSync)\s*\(|\b(?:retry|fallback|secondDatabaseSession)\b|docker[.]sock|supabase\s+(?:db|migration)|apt(?:-get)?\s+install|['"]postgres:17['"]/iu.test(
      source,
    ) ||
    /console[.](?:log|error)\s*\([^)]*(?:stdout|stderr)|\blet\s+stderr\b|\bstderr\s*[,}]/iu.test(
      source,
    ) ||
    /else if \(!failure\)/u.test(source) ||
    !/shell:\s*false/u.test(source) ||
    !/POSTGRES_IMAGE/u.test(source) ||
    !/FORENSIC_FILE/u.test(source)
  ) {
    fail('FORENSIC_SQL_INVALID')
  }
  return true
}

export function assertValidatorSource(source) {
  if (typeof source !== 'string') fail('FORENSIC_SQL_INVALID')
  assertRequiredOnce(source, [
    [
      'assertExactKeys(value, ',
      "TOP_LEVEL_KEYS, 'FORENSIC_OUTPUT_INVALID')",
    ].join(''),
    [
      'Buffer.byteLength(text, ',
      "'utf8') > MAX_FORENSIC_OUTPUT_BYTES",
    ].join(''),
    ['OUTPUT_SENSITIVE_PATTERN', '.test(text)'].join(''),
    ['value.baseline_provenance_complete', ' ||'].join(''),
    ['value.exact_changed_row_identifiable', ' ||'].join(''),
    ['value.exact_changed_column_identifiable', ' ||'].join(''),
  ])
  return true
}

export function assertWorkflowSource(source) {
  if (typeof source !== 'string') fail('FORENSIC_SQL_INVALID')
  const forbiddenTriggers =
    /^\s{2}(?:push|pull_request|schedule|workflow_call|repository_dispatch):/gmu
  const actionUses = [...source.matchAll(/^\s+uses: ([^\s]+)$/gmu)].map(
    (match) => match[1],
  )
  if (
    !/^name: Supabase Production Bank Transfer Historical Forensic$/mu.test(
      source,
    ) ||
    !/^on:\n  workflow_dispatch:$/mu.test(source) ||
    forbiddenTriggers.test(source) ||
    !/^permissions:\n  contents: read$/mu.test(source) ||
    !/^  group: supabase-production-bank-transfer-forensic$/mu.test(source) ||
    !/^  cancel-in-progress: false$/mu.test(source) ||
    actionUses.length < 4 ||
    actionUses.some((action) => !/^[^@]+@[0-9a-f]{40}$/u.test(action)) ||
    (source.match(
      /node scripts\/supabase\/run-bank-transfer-production-forensic[.]mjs/gu,
    ) ?? []).length !== 1 ||
    /run-line-pay-production-exact-file|line_pay_remediation_(?:deploy|preflight|postflight)|\bpsql\b|supabase\s+(?:db|migration)|upload-artifact/iu.test(
      source,
    )
  ) {
    fail('FORENSIC_SQL_INVALID')
  }
  return true
}

export function parseAndValidateForensicOutput(text) {
  if (
    typeof text !== 'string' ||
    Buffer.byteLength(text, 'utf8') > MAX_FORENSIC_OUTPUT_BYTES ||
    OUTPUT_SENSITIVE_PATTERN.test(text)
  ) {
    fail('FORENSIC_OUTPUT_INVALID')
  }
  const rows = text
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
  if (rows.length !== 1) fail('FORENSIC_OUTPUT_INVALID')
  let value
  try {
    value = JSON.parse(rows[0])
  } catch {
    fail('FORENSIC_OUTPUT_INVALID')
  }
  assertExactKeys(value, TOP_LEVEL_KEYS, 'FORENSIC_OUTPUT_INVALID')
  if (value.status !== 'FORENSIC_COMPLETED') {
    fail('FORENSIC_OUTPUT_INVALID')
  }
  for (const key of [
    'database_identity_match',
    'fence_match',
    'pk_digest_match',
    'pending_review_match',
    'full_content_digest_match',
    'schema_signature_match',
    'column_set_match',
    'column_order_match',
    'column_type_match',
    'column_nullability_match',
    'column_default_match',
    'column_generated_match',
    'column_identity_match',
    'no_dropped_columns',
    'commit_timestamp_tracking_enabled',
    'tuple_commit_timestamp_evidence_available',
    'table_stats_available',
    'table_stats_authoritative',
    'baseline_provenance_complete',
    'exact_changed_row_identifiable',
    'exact_changed_column_identifiable',
  ]) {
    assertBoolean(value[key])
  }
  for (const key of [
    'row_count',
    'pending_review_count',
    'rows_with_known_commit_timestamp',
    'reported_insert_count',
    'reported_update_count',
    'reported_delete_count',
  ]) {
    assertCount(value[key])
  }
  if (
    value.baseline_provenance_complete ||
    value.exact_changed_row_identifiable ||
    value.exact_changed_column_identifiable ||
    value.table_stats_authoritative ||
    value.database_audit_log_evidence_status !==
      'DATABASE_AUDIT_LOG_EVIDENCE_UNAVAILABLE' ||
    value.tuple_commit_timestamp_evidence_available !==
      (value.commit_timestamp_tracking_enabled &&
        value.rows_with_known_commit_timestamp > 0)
  ) {
    fail('FORENSIC_OUTPUT_INVALID')
  }
  return Object.freeze({ ...value })
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

function assertFixedHash(root, file, expectedHash) {
  const contents = readFixedRegularFile(root, file)
  if (
    !SHA256_PATTERN.test(expectedHash) ||
    createHash('sha256').update(contents).digest('hex') !== expectedHash
  ) {
    fail('SOURCE_CONTEXT_INVALID')
  }
}

export function validateSource(
  environment = process.env,
  root = process.cwd(),
) {
  validateWorkflowContext(environment)
  readAndValidateForensicFile(root)
  assertFixedHash(root, MIGRATION_FILE, EXPECTED_MIGRATION_SHA256)
  assertFixedHash(root, FENCE_MIGRATION_FILE, EXPECTED_FENCE_SHA256)
  const runner = readFixedRegularFile(root, RUNNER_FILE)
  const workflow = readFixedRegularFile(root, WORKFLOW_FILE)
  const validator = readFixedRegularFile(root, VALIDATOR_FILE)
  assertRunnerSource(runner)
  assertValidatorSource(validator)
  assertWorkflowSource(workflow)
  validatePostgresImage(POSTGRES_IMAGE)

  const githubSha = environment.GITHUB_SHA
  if (
    runGit(['rev-parse', 'HEAD'], root) !== githubSha ||
    runGit(['status', '--porcelain=v1', '--untracked-files=all'], root)
  ) {
    fail('SOURCE_CONTEXT_INVALID')
  }
  for (const relativePath of [
    FORENSIC_FILE,
    RUNNER_FILE,
    VALIDATOR_FILE,
    WORKFLOW_FILE,
    MIGRATION_FILE,
    FENCE_MIGRATION_FILE,
  ]) {
    runGit(['ls-files', '--error-unmatch', relativePath], root)
    runGit(['cat-file', '-e', `${githubSha}:${relativePath}`], root)
  }
  return true
}

export function safeErrorCode(error) {
  return error instanceof Error &&
    SAFE_FAILURE_CODE_SET.has(error.message)
    ? error.message
    : 'FORENSIC_CONTAINER_EXEC_FAILED'
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
