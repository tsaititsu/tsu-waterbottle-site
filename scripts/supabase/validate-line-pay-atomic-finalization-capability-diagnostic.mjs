import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

import {
  POSTGRES_IMAGE,
  stripSqlForStaticAnalysis,
  validateNodeVersion,
  validatePostgresImage,
} from './validate-line-pay-production-diagnostic.mjs'

export {
  POSTGRES_IMAGE,
  stripSqlForStaticAnalysis,
  validateNodeVersion,
  validatePostgresImage,
}

export const EXPECTED_REPOSITORY = 'tsaititsu/tsu-waterbottle-site'
export const EXPECTED_PROJECT_REF = 'ndbqoznvobmpkgxkiezz'
export const EXPECTED_EVENT = 'workflow_dispatch'
export const EXPECTED_REF = 'refs/heads/main'
export const EXPECTED_CONFIRMATION =
  'RUN_LINE_PAY_ATOMIC_FINALIZATION_CAPABILITY_DIAGNOSTIC_READ_ONLY_ONCE'

export const DIAGNOSTIC_FILE =
  'supabase/deployment/line_pay_atomic_confirmation_finalization_capability_diagnostic.sql'
export const RUNNER_FILE =
  'scripts/supabase/run-line-pay-atomic-finalization-capability-diagnostic.mjs'
export const VALIDATOR_FILE =
  'scripts/supabase/validate-line-pay-atomic-finalization-capability-diagnostic.mjs'
export const WORKFLOW_FILE =
  '.github/workflows/supabase-production-line-pay-atomic-finalization-capability-diagnostic.yml'
export const SHARED_RUNNER_FILE =
  'scripts/supabase/run-line-pay-production-diagnostic.mjs'
export const DEPLOY_FILE =
  'supabase/deployment/line_pay_atomic_confirmation_finalization_deploy.sql'
export const MIGRATION_FILE =
  'supabase/migrations/20260802160000_line_pay_atomic_confirmation_finalization.sql'

export const EXPECTED_DIAGNOSTIC_SHA256 =
  'ac1255a0e12fd54e4969a7d90ed4973b81a9f904da0b701a02985ca12c20ab9f'
export const EXPECTED_DEPLOY_SHA256 =
  '2577c57c0978387b6b4c2d6fece06487501975fedcfff7d4b25202547b8d6510'
export const EXPECTED_MIGRATION_SHA256 =
  '2991bff6e13d76d843f98b2e019bb6c6ff5a1d7471c667dd4de528f95aa12b4f'
export const MAX_DIAGNOSTIC_OUTPUT_BYTES = 16 * 1024

export const RELATION_KEYS = Object.freeze([
  'product_orders',
  'payments',
  'checkout_attempts',
  'request_outbox',
  'callback_capabilities',
  'callback_events',
  'audit_events',
  'completion_proofs',
])

export const BLOCKING_STAGES = Object.freeze([
  'RELATION_MISSING',
  'SCHEMA_USAGE_MISSING',
  'LOCK_CAPABILITY_MISSING',
  'FINGERPRINT_READ_CAPABILITY_MISSING',
  'CAPABILITY_READY',
])

export const SAFE_FAILURE_CODES = Object.freeze([
  'SOURCE_CONTEXT_INVALID',
  'INVALID_NODE_VERSION',
  'POSTGRES_IMAGE_MISMATCH',
  'PRODUCTION_CHANNEL_NOT_READY',
  'DATABASE_TARGET_MISMATCH',
  'DATABASE_URL_INVALID',
  'CAPABILITY_DIAGNOSTIC_SQL_INVALID',
  'CAPABILITY_DIAGNOSTIC_OUTPUT_INVALID',
  'CAPABILITY_DIAGNOSTIC_DATABASE_IDENTITY_MISMATCH',
  'DIAGNOSTIC_DOCKER_IMAGE_PULL_FAILED',
  'DIAGNOSTIC_TEMP_CREDENTIAL_CREATE_FAILED',
  'DIAGNOSTIC_CONTAINER_START_FAILED',
  'DIAGNOSTIC_CONTAINER_EXEC_FAILED',
  'DIAGNOSTIC_DB_CONNECT_FAILED',
  'DIAGNOSTIC_SQL_EXECUTION_FAILED',
  'DIAGNOSTIC_CAPTURE_LIMIT_EXCEEDED',
  'PROCESS_INTERRUPTED',
  'TEMP_CREDENTIAL_CLEANUP_FAILED',
])

const SAFE_FAILURE_CODE_SET = new Set(SAFE_FAILURE_CODES)
const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/u
const SHA256_PATTERN = /^[0-9a-f]{64}$/u
const OUTPUT_SENSITIVE_PATTERN =
  /postgres(?:ql)?:\/\/|supabase[.]co|pooler[.]supabase[.]com|[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:[.][a-z0-9-]+)+|\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}\b|\b[0-9a-f]{40}\b|\b[0-9a-f]{64}\b|\bauthorization\b|\bbearer\b|\bpassword\b|\bsecret\b|\btoken\b|\b(?:host|username|database_url|connection_string|raw_stdout|raw_stderr)\b/iu

const TOP_LEVEL_KEYS = Object.freeze([
  'status',
  'database_identity_match',
  'session',
  'relations',
  'decision',
])
const SESSION_KEYS = Object.freeze([
  'superuser',
  'public_schema_usage',
  'private_schema_usage',
])
const RELATION_CAPABILITY_KEYS = Object.freeze([
  'present',
  'schema_usage',
  'owned_by_current_user',
  'select_privilege',
  'maintain_privilege',
  'update_privilege',
  'delete_privilege',
  'truncate_privilege',
  'access_exclusive_lock_capable',
  'fingerprint_read_capable',
])
const DECISION_KEYS = Object.freeze([
  'lock_capability_ready',
  'fingerprint_capability_ready',
  'blocking_stage',
  'blocking_relations',
])

function fail(code) {
  throw new Error(code)
}

function assertPlainObject(
  value,
  code = 'CAPABILITY_DIAGNOSTIC_OUTPUT_INVALID',
) {
  if (
    value === null ||
    Array.isArray(value) ||
    typeof value !== 'object' ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail(code)
  }
}

function assertExactKeys(
  value,
  expectedKeys,
  code = 'CAPABILITY_DIAGNOSTIC_OUTPUT_INVALID',
) {
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
  if (typeof value !== 'boolean') {
    fail('CAPABILITY_DIAGNOSTIC_OUTPUT_INVALID')
  }
}

function assertBooleanObject(value, keys) {
  assertExactKeys(value, keys)
  for (const key of keys) assertBoolean(value[key])
  return Object.freeze({ ...value })
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

function assertRequiredOnce(source, tokens) {
  for (const token of tokens) {
    if (source.split(token).length !== 2) {
      fail('CAPABILITY_DIAGNOSTIC_SQL_INVALID')
    }
  }
}

export function validateFullSha(value) {
  if (typeof value !== 'string' || !FULL_SHA_PATTERN.test(value)) {
    fail('SOURCE_CONTEXT_INVALID')
  }
  return value
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
  const authorizedCommit = validateFullSha(environment.AUTHORIZED_COMMIT)
  if (githubSha !== authorizedCommit) fail('SOURCE_CONTEXT_INVALID')
  if (
    environment.PROJECT_REF_INPUT !== EXPECTED_PROJECT_REF ||
    environment.DIAGNOSTIC_CONFIRMATION !== EXPECTED_CONFIRMATION
  ) {
    fail('SOURCE_CONTEXT_INVALID')
  }
  return true
}

export function assertCapabilityDiagnosticSql(sql) {
  if (
    typeof sql !== 'string' ||
    Buffer.byteLength(sql, 'utf8') > 64 * 1024 ||
    !/^BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;$/mu.test(
      sql,
    ) ||
    !/^ROLLBACK;$/mu.test(sql) ||
    (sql.match(
      /^BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;$/gmu,
    ) ?? []).length !== 1 ||
    (sql.match(/^ROLLBACK;$/gmu) ?? []).length !== 1 ||
    !/'LINE_PAY_ATOMIC_FINALIZATION_CAPABILITY_DIAGNOSTIC_COMPLETED'/u.test(
      sql,
    ) ||
    !/pg_catalog[.]pg_class/u.test(sql) ||
    !/pg_catalog[.]pg_namespace/u.test(sql) ||
    !/pg_catalog[.]has_schema_privilege/u.test(sql) ||
    (sql.match(/pg_catalog[.]has_table_privilege/gu) ?? []).length !== 5
  ) {
    fail('CAPABILITY_DIAGNOSTIC_SQL_INVALID')
  }
  assertRequiredOnce(sql, [
    "'product_orders', 'public', 'product_orders'",
    "'payments', 'public', 'payments'",
    "'checkout_attempts', 'public', 'line_pay_checkout_attempts'",
    "'request_outbox', 'public', 'line_pay_request_outbox'",
    "'callback_capabilities', 'public', 'line_pay_callback_capabilities'",
    "'callback_events', 'public', 'line_pay_callback_events'",
    "'audit_events', 'public', 'line_pay_payment_audit_events'",
    "'completion_proofs', 'line_pay_private', 'line_pay_completion_proofs'",
    "'SELECT'",
    "'MAINTAIN'",
    "'UPDATE'",
    "'DELETE'",
    "'TRUNCATE'",
    "'access_exclusive_lock_capable',",
    "'fingerprint_read_capable',",
    "'blocking_relations',",
  ])
  const normalized = stripSqlForStaticAnalysis(sql)
  const forbidden =
    /\b(insert|update|delete|merge|truncate|create|alter|drop|grant|revoke|comment|copy|call|do|execute|security\s+definer|set\s+role|lock\s+table|select\s+for\s+(?:update|share)|pg_sleep|dblink|listen|notify|vacuum|analyze|reindex|cluster|prepare|savepoint|release)\b|\bpg_(?:try_)?advisory_(?:lock|xact_lock|unlock)\b|\bpg_(?:cancel|terminate)_backend\b|\bpg_(?:read|write|stat)_file\b|\blo_(?:export|import)\b/iu
  if (
    forbidden.test(normalized) ||
    /\\(?:i|ir|copy|!|o|w)\b/iu.test(sql) ||
    /\bfrom\s+(?:public|line_pay_private)[.]/iu.test(normalized) ||
    (normalized.match(/^\s*begin\s+transaction\b/gimu) ?? []).length !== 1 ||
    (normalized.match(/^\s*rollback\s*;/gimu) ?? []).length !== 1
  ) {
    fail('CAPABILITY_DIAGNOSTIC_SQL_INVALID')
  }
  return true
}

export function readAndValidateDiagnosticFile(root = process.cwd()) {
  const sql = readFixedRegularFile(root, DIAGNOSTIC_FILE)
  const hash = createHash('sha256').update(sql).digest('hex')
  if (
    !SHA256_PATTERN.test(EXPECTED_DIAGNOSTIC_SHA256) ||
    hash !== EXPECTED_DIAGNOSTIC_SHA256
  ) {
    fail('CAPABILITY_DIAGNOSTIC_SQL_INVALID')
  }
  assertCapabilityDiagnosticSql(sql)
  return sql
}

function validateRelationCapability(value, session) {
  const capability = assertBooleanObject(value, RELATION_CAPABILITY_KEYS)
  const expectedLockCapability =
    capability.present &&
    capability.schema_usage &&
    (session.superuser ||
      capability.owned_by_current_user ||
      capability.maintain_privilege ||
      capability.update_privilege ||
      capability.delete_privilege ||
      capability.truncate_privilege)
  const expectedFingerprintCapability =
    capability.present &&
    capability.schema_usage &&
    capability.select_privilege
  if (
    capability.access_exclusive_lock_capable !==
      expectedLockCapability ||
    capability.fingerprint_read_capable !==
      expectedFingerprintCapability ||
    (!capability.present &&
      (capability.owned_by_current_user ||
        capability.select_privilege ||
        capability.maintain_privilege ||
        capability.update_privilege ||
        capability.delete_privilege ||
        capability.truncate_privilege))
  ) {
    fail('CAPABILITY_DIAGNOSTIC_OUTPUT_INVALID')
  }
  return capability
}

function expectedDecision(relations) {
  const missing = RELATION_KEYS.filter((key) => !relations[key].present)
  const schemaUsageMissing = RELATION_KEYS.filter(
    (key) => !relations[key].schema_usage,
  )
  const lockMissing = RELATION_KEYS.filter(
    (key) => !relations[key].access_exclusive_lock_capable,
  )
  const fingerprintMissing = RELATION_KEYS.filter(
    (key) => !relations[key].fingerprint_read_capable,
  )
  if (missing.length > 0) {
    return ['RELATION_MISSING', missing]
  }
  if (schemaUsageMissing.length > 0) {
    return ['SCHEMA_USAGE_MISSING', schemaUsageMissing]
  }
  if (lockMissing.length > 0) {
    return ['LOCK_CAPABILITY_MISSING', lockMissing]
  }
  if (fingerprintMissing.length > 0) {
    return ['FINGERPRINT_READ_CAPABILITY_MISSING', fingerprintMissing]
  }
  return ['CAPABILITY_READY', []]
}

export function parseAndValidateCapabilityDiagnosticOutput(text) {
  if (
    typeof text !== 'string' ||
    Buffer.byteLength(text, 'utf8') > MAX_DIAGNOSTIC_OUTPUT_BYTES ||
    OUTPUT_SENSITIVE_PATTERN.test(text)
  ) {
    fail('CAPABILITY_DIAGNOSTIC_OUTPUT_INVALID')
  }
  const rows = text
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
  if (rows.length !== 1) fail('CAPABILITY_DIAGNOSTIC_OUTPUT_INVALID')
  let value
  try {
    value = JSON.parse(rows[0])
  } catch {
    fail('CAPABILITY_DIAGNOSTIC_OUTPUT_INVALID')
  }
  assertExactKeys(value, TOP_LEVEL_KEYS)
  if (
    value.status !==
    'LINE_PAY_ATOMIC_FINALIZATION_CAPABILITY_DIAGNOSTIC_COMPLETED'
  ) {
    fail('CAPABILITY_DIAGNOSTIC_OUTPUT_INVALID')
  }
  assertBoolean(value.database_identity_match)
  if (!value.database_identity_match) {
    fail('CAPABILITY_DIAGNOSTIC_DATABASE_IDENTITY_MISMATCH')
  }
  const session = assertBooleanObject(value.session, SESSION_KEYS)
  assertExactKeys(value.relations, RELATION_KEYS)
  const relations = {}
  for (const key of RELATION_KEYS) {
    relations[key] = validateRelationCapability(
      value.relations[key],
      session,
    )
  }
  assertExactKeys(value.decision, DECISION_KEYS)
  assertBoolean(value.decision.lock_capability_ready)
  assertBoolean(value.decision.fingerprint_capability_ready)
  if (!BLOCKING_STAGES.includes(value.decision.blocking_stage)) {
    fail('CAPABILITY_DIAGNOSTIC_OUTPUT_INVALID')
  }
  if (
    !Array.isArray(value.decision.blocking_relations) ||
    value.decision.blocking_relations.some(
      (key) => typeof key !== 'string' || !RELATION_KEYS.includes(key),
    ) ||
    new Set(value.decision.blocking_relations).size !==
      value.decision.blocking_relations.length
  ) {
    fail('CAPABILITY_DIAGNOSTIC_OUTPUT_INVALID')
  }
  const lockCapabilityReady = RELATION_KEYS.every(
    (key) => relations[key].access_exclusive_lock_capable,
  )
  const fingerprintCapabilityReady = RELATION_KEYS.every(
    (key) => relations[key].fingerprint_read_capable,
  )
  const [blockingStage, blockingRelations] = expectedDecision(relations)
  if (
    value.decision.lock_capability_ready !== lockCapabilityReady ||
    value.decision.fingerprint_capability_ready !==
      fingerprintCapabilityReady ||
    value.decision.blocking_stage !== blockingStage ||
    !isDeepStrictEqual(
      value.decision.blocking_relations,
      blockingRelations,
    )
  ) {
    fail('CAPABILITY_DIAGNOSTIC_OUTPUT_INVALID')
  }
  return Object.freeze({
    status: value.status,
    database_identity_match: value.database_identity_match,
    session,
    relations: Object.freeze({ ...relations }),
    decision: Object.freeze({
      lock_capability_ready: lockCapabilityReady,
      fingerprint_capability_ready: fingerprintCapabilityReady,
      blocking_stage: blockingStage,
      blocking_relations: Object.freeze([...blockingRelations]),
    }),
  })
}

export function assertRunnerSource(source) {
  if (typeof source !== 'string') {
    fail('CAPABILITY_DIAGNOSTIC_SQL_INVALID')
  }
  assertRequiredOnce(source, [
    'export function runAtomicFinalizationCapabilityDiagnostic(options = {})',
    'diagnosticFile: DIAGNOSTIC_FILE',
    "applicationName:\n      'line-pay-atomic-finalization-capability-read-only-diagnostic'",
    "credentialPrefix: 'line-pay-atomic-capability-'",
    'validateDiagnosticFile: readAndValidateDiagnosticFile',
    'parseDiagnosticOutput: parseAndValidateCapabilityDiagnosticOutput',
    'const result = await runAtomicFinalizationCapabilityDiagnostic()',
    'JSON.stringify(toSafeFailureAttestation(error))',
  ])
  if (
    /\b(?:retry|fallback|secondDatabaseSession)\b|spawnSync|execSync|execFile|shell:\s*true|docker[.]sock|supabase\s+(?:db|migration)|console[.](?:log|error)\s*\([^)]*(?:stdout|stderr)|raw_(?:stdout|stderr)/iu.test(
      source,
    )
  ) {
    fail('CAPABILITY_DIAGNOSTIC_SQL_INVALID')
  }
  return true
}

export function assertWorkflowSource(source) {
  if (typeof source !== 'string') {
    fail('CAPABILITY_DIAGNOSTIC_SQL_INVALID')
  }
  const actionUses = [...source.matchAll(/^\s+uses: ([^\s]+)$/gmu)].map(
    (match) => match[1],
  )
  const inputNames = [...source.matchAll(/^\s{6}([a-z_]+):$/gmu)].map(
    (match) => match[1],
  )
  if (
    !/^name: Supabase Production LINE Pay Atomic Finalization Capability Diagnostic$/mu.test(
      source,
    ) ||
    !/^on:\n  workflow_dispatch:$/mu.test(source) ||
    !isDeepStrictEqual(inputNames, [
      'authorized_commit',
      'project_ref',
      'confirmation',
    ]) ||
    /^\s{2}(?:push|pull_request|schedule|workflow_call|repository_dispatch):/gmu.test(
      source,
    ) ||
    !/^permissions:\n  contents: read$/mu.test(source) ||
    !/^  group: supabase-production-line-pay-atomic-finalization-capability-diagnostic$/mu.test(
      source,
    ) ||
    !/^  cancel-in-progress: false$/mu.test(source) ||
    !/^      name: supabase-production$/mu.test(source) ||
    actionUses.length < 4 ||
    actionUses.some((action) => !/^[^@]+@[0-9a-f]{40}$/u.test(action)) ||
    (source.match(
      /node scripts\/supabase\/run-line-pay-atomic-finalization-capability-diagnostic[.]mjs/gu,
    ) ?? []).length !== 1 ||
    /\bpsql\b|supabase\s+(?:db|migration)|upload-artifact|run-line-pay-production-exact-file|line_pay_atomic_confirmation_finalization_(?:deploy|preflight|postflight)/iu.test(
      source,
    )
  ) {
    fail('CAPABILITY_DIAGNOSTIC_SQL_INVALID')
  }
  return true
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
  readAndValidateDiagnosticFile(root)
  assertFixedHash(root, DEPLOY_FILE, EXPECTED_DEPLOY_SHA256)
  assertFixedHash(root, MIGRATION_FILE, EXPECTED_MIGRATION_SHA256)
  const runner = readFixedRegularFile(root, RUNNER_FILE)
  const workflow = readFixedRegularFile(root, WORKFLOW_FILE)
  const sharedRunner = readFixedRegularFile(root, SHARED_RUNNER_FILE)
  assertRunnerSource(runner)
  assertWorkflowSource(workflow)
  if (
    !/let databaseSessionExecutions = 0/u.test(sharedRunner) ||
    !/if \(databaseSessionExecutions !== DATABASE_SESSION_LIMIT\)/u.test(
      sharedRunner,
    )
  ) {
    fail('CAPABILITY_DIAGNOSTIC_SQL_INVALID')
  }
  validatePostgresImage(POSTGRES_IMAGE)
  const githubSha = environment.GITHUB_SHA
  if (
    runGit(['rev-parse', 'HEAD'], root) !== githubSha ||
    runGit(['status', '--porcelain=v1', '--untracked-files=all'], root)
  ) {
    fail('SOURCE_CONTEXT_INVALID')
  }
  for (const relativePath of [
    DIAGNOSTIC_FILE,
    RUNNER_FILE,
    VALIDATOR_FILE,
    SHARED_RUNNER_FILE,
    WORKFLOW_FILE,
    DEPLOY_FILE,
    MIGRATION_FILE,
  ]) {
    runGit(['ls-files', '--error-unmatch', relativePath], root)
    runGit(['cat-file', '-e', `${githubSha}:${relativePath}`], root)
  }
  return true
}

export function safeErrorCode(error) {
  return error instanceof Error && SAFE_FAILURE_CODE_SET.has(error.message)
    ? error.message
    : 'DIAGNOSTIC_CONTAINER_EXEC_FAILED'
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
