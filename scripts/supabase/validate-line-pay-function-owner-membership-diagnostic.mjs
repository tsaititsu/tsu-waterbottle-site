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
  validateProductionChannel,
} from './validate-line-pay-production-diagnostic.mjs'

export {
  POSTGRES_IMAGE,
  stripSqlForStaticAnalysis,
  validateNodeVersion,
  validatePostgresImage,
  validateProductionChannel,
}

export const EXPECTED_REPOSITORY = 'tsaititsu/tsu-waterbottle-site'
export const EXPECTED_PROJECT_REF = 'ndbqoznvobmpkgxkiezz'
export const EXPECTED_EVENT = 'workflow_dispatch'
export const EXPECTED_REF = 'refs/heads/main'
export const EXPECTED_CONFIRMATION =
  'RUN_LINE_PAY_FUNCTION_OWNER_MEMBERSHIP_DIAGNOSTIC_READ_ONLY_ONCE'

export const DIAGNOSTIC_FILE =
  'supabase/deployment/line_pay_function_owner_membership_diagnostic.sql'
export const RUNNER_FILE =
  'scripts/supabase/run-line-pay-function-owner-membership-diagnostic.mjs'
export const VALIDATOR_FILE =
  'scripts/supabase/validate-line-pay-function-owner-membership-diagnostic.mjs'
export const WORKFLOW_FILE =
  '.github/workflows/supabase-production-line-pay-function-owner-membership-diagnostic.yml'
export const SHARED_RUNNER_FILE =
  'scripts/supabase/run-line-pay-production-diagnostic.mjs'
export const INITIALIZER_MIGRATION_FILE =
  'supabase/migrations/20260728053215_line_pay_checkout_aggregate_initialization.sql'
export const BASE_MIGRATION_FILE =
  'supabase/migrations/20260719033404_line_pay_remediation_contracts.sql'

export const EXPECTED_DIAGNOSTIC_SHA256 =
  '5b069f739f5284c331177732bb571562dcf413098fbf277269791c61a591eeb5'
export const EXPECTED_INITIALIZER_MIGRATION_SHA256 =
  '2e2ef2cce41431e0dc638033c998b7b616cbdc2b3baefdcb59fbb68ba2adf551'
export const EXPECTED_BASE_MIGRATION_SHA256 =
  '8da1fb429aecb1c35b12a245b63907135dbe7c467ef0a5f069afd431d21e94b8'
export const MAX_DIAGNOSTIC_OUTPUT_BYTES = 4096

export const SAFE_FAILURE_CODES = Object.freeze([
  'SOURCE_CONTEXT_INVALID',
  'INVALID_NODE_VERSION',
  'POSTGRES_IMAGE_MISMATCH',
  'PRODUCTION_CHANNEL_NOT_READY',
  'DATABASE_TARGET_MISMATCH',
  'DATABASE_URL_INVALID',
  'MEMBERSHIP_DIAGNOSTIC_SQL_INVALID',
  'MEMBERSHIP_DIAGNOSTIC_OUTPUT_INVALID',
  'MEMBERSHIP_DIAGNOSTIC_DATABASE_IDENTITY_MISMATCH',
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
  /postgres(?:ql)?:\/\/|supabase[.]co|pooler[.]supabase[.]com|[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:[.][a-z0-9-]+)+|\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}\b|\b[0-9a-f]{40}\b|\b[0-9a-f]{64}\b|\bauthorization\b|\bbearer\b|\bpassword\b|\bsecret\b|\btoken\b|\b(?:host|username|database_url|connection_string|raw_stdout|raw_stderr|role_name|oid)\b|line_pay_payment_function_owner|\bservice_role\b|\bauthenticated\b|\banon\b/iu

const TOP_LEVEL_KEYS = Object.freeze([
  'status',
  'database_identity_match',
  'role_present',
  'membership',
  'decision',
])
const MEMBERSHIP_KEYS = Object.freeze([
  'total_edges',
  'owner_as_granted_role_edges',
  'owner_as_member_role_edges',
  'granted_to_current_user_edges',
  'granted_to_executor_edges',
  'granted_to_runtime_role_edges',
  'granted_to_other_edges',
  'owner_member_of_current_user_edges',
  'owner_member_of_executor_edges',
  'owner_member_of_runtime_role_edges',
  'owner_member_of_other_edges',
  'granted_by_current_user_edges',
  'granted_by_owner_edges',
  'granted_by_other_edges',
  'admin_option_edges',
  'inherit_option_edges',
  'set_option_edges',
])
const DECISION_KEYS = Object.freeze([
  'detail_complete',
  'membership_absent',
  'single_current_user_grant_only',
  'manual_review_required',
])

function fail(code) {
  throw new Error(code)
}

function assertPlainObject(
  value,
  code = 'MEMBERSHIP_DIAGNOSTIC_OUTPUT_INVALID',
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
  code = 'MEMBERSHIP_DIAGNOSTIC_OUTPUT_INVALID',
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
    fail('MEMBERSHIP_DIAGNOSTIC_OUTPUT_INVALID')
  }
}

function assertCount(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100) {
    fail('MEMBERSHIP_DIAGNOSTIC_OUTPUT_INVALID')
  }
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

function assertIncludes(source, tokens) {
  for (const token of tokens) {
    if (!source.includes(token)) {
      fail('MEMBERSHIP_DIAGNOSTIC_SQL_INVALID')
    }
  }
}

function assertRequiredOnce(source, tokens) {
  for (const token of tokens) {
    if (source.split(token).length !== 2) {
      fail('MEMBERSHIP_DIAGNOSTIC_SQL_INVALID')
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

export function assertMembershipDiagnosticSql(sql) {
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
    (sql.match(/^ROLLBACK;$/gmu) ?? []).length !== 1
  ) {
    fail('MEMBERSHIP_DIAGNOSTIC_SQL_INVALID')
  }
  assertIncludes(sql, [
    'LINE_PAY_FUNCTION_OWNER_MEMBERSHIP_DIAGNOSTIC_COMPLETED',
    'pg_catalog.pg_auth_members',
    'membership.roleid',
    'membership.member',
    'membership.grantor',
    'membership.admin_option',
    'membership.inherit_option',
    'membership.set_option',
    'as total_edges',
    'as granted_to_current_user_edges',
    'as granted_to_other_edges',
    'as owner_member_of_other_edges',
    'as granted_by_other_edges',
    "'single_current_user_grant_only',",
    "'manual_review_required',",
  ])
  if (
    /\brole_name\b|pg_catalog[.]pg_authid/iu.test(sql) ||
    (sql.match(/'membership',/gu) ?? []).length !== 1 ||
    (sql.match(/'decision',/gu) ?? []).length !== 1
  ) {
    fail('MEMBERSHIP_DIAGNOSTIC_SQL_INVALID')
  }
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
    fail('MEMBERSHIP_DIAGNOSTIC_SQL_INVALID')
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
    fail('MEMBERSHIP_DIAGNOSTIC_SQL_INVALID')
  }
  assertMembershipDiagnosticSql(sql)
  return sql
}

function sumCounts(object, keys) {
  return keys.reduce((sum, key) => sum + object[key], 0)
}

export function parseAndValidateMembershipDiagnosticOutput(text) {
  if (
    typeof text !== 'string' ||
    Buffer.byteLength(text, 'utf8') > MAX_DIAGNOSTIC_OUTPUT_BYTES ||
    OUTPUT_SENSITIVE_PATTERN.test(text)
  ) {
    fail('MEMBERSHIP_DIAGNOSTIC_OUTPUT_INVALID')
  }
  const rows = text
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
  if (rows.length !== 1) {
    fail('MEMBERSHIP_DIAGNOSTIC_OUTPUT_INVALID')
  }
  let value
  try {
    value = JSON.parse(rows[0])
  } catch {
    fail('MEMBERSHIP_DIAGNOSTIC_OUTPUT_INVALID')
  }
  assertExactKeys(value, TOP_LEVEL_KEYS)
  if (
    value.status !==
    'LINE_PAY_FUNCTION_OWNER_MEMBERSHIP_DIAGNOSTIC_COMPLETED'
  ) {
    fail('MEMBERSHIP_DIAGNOSTIC_OUTPUT_INVALID')
  }
  assertBoolean(value.database_identity_match)
  if (!value.database_identity_match) {
    fail('MEMBERSHIP_DIAGNOSTIC_DATABASE_IDENTITY_MISMATCH')
  }
  assertBoolean(value.role_present)
  assertExactKeys(value.membership, MEMBERSHIP_KEYS)
  for (const key of MEMBERSHIP_KEYS) {
    assertCount(value.membership[key])
  }
  assertExactKeys(value.decision, DECISION_KEYS)
  for (const key of DECISION_KEYS) {
    assertBoolean(value.decision[key])
  }

  const membership = Object.freeze({ ...value.membership })
  const decision = Object.freeze({ ...value.decision })
  const directionSum =
    membership.owner_as_granted_role_edges +
    membership.owner_as_member_role_edges
  const grantedTargetSum = sumCounts(membership, [
    'granted_to_current_user_edges',
    'granted_to_executor_edges',
    'granted_to_runtime_role_edges',
    'granted_to_other_edges',
  ])
  const ownerParentSum = sumCounts(membership, [
    'owner_member_of_current_user_edges',
    'owner_member_of_executor_edges',
    'owner_member_of_runtime_role_edges',
    'owner_member_of_other_edges',
  ])
  const grantorSum = sumCounts(membership, [
    'granted_by_current_user_edges',
    'granted_by_owner_edges',
    'granted_by_other_edges',
  ])
  const optionsBounded = [
    membership.admin_option_edges,
    membership.inherit_option_edges,
    membership.set_option_edges,
  ].every((count) => count <= membership.total_edges)
  const membershipAbsent =
    value.role_present && membership.total_edges === 0
  const singleCurrentUserGrantOnly =
    value.role_present &&
    membership.total_edges === 1 &&
    membership.owner_as_granted_role_edges === 1 &&
    membership.owner_as_member_role_edges === 0 &&
    membership.granted_to_current_user_edges === 1 &&
    membership.granted_to_executor_edges === 0 &&
    membership.granted_to_runtime_role_edges === 0 &&
    membership.granted_to_other_edges === 0 &&
    membership.granted_by_current_user_edges === 1 &&
    membership.granted_by_owner_edges === 0 &&
    membership.granted_by_other_edges === 0 &&
    membership.admin_option_edges === 1 &&
    membership.inherit_option_edges === 0 &&
    membership.set_option_edges === 0
  const manualReviewRequired =
    value.role_present &&
    membership.total_edges > 0 &&
    !singleCurrentUserGrantOnly

  if (
    directionSum !== membership.total_edges ||
    grantedTargetSum !== membership.owner_as_granted_role_edges ||
    ownerParentSum !== membership.owner_as_member_role_edges ||
    grantorSum !== membership.total_edges ||
    !optionsBounded ||
    decision.detail_complete !== value.role_present ||
    decision.membership_absent !== membershipAbsent ||
    decision.single_current_user_grant_only !==
      singleCurrentUserGrantOnly ||
    decision.manual_review_required !== manualReviewRequired ||
    (!value.role_present && membership.total_edges !== 0)
  ) {
    fail('MEMBERSHIP_DIAGNOSTIC_OUTPUT_INVALID')
  }

  return Object.freeze({
    status: value.status,
    database_identity_match: value.database_identity_match,
    role_present: value.role_present,
    membership,
    decision,
  })
}

export function assertRunnerSource(source) {
  if (typeof source !== 'string') {
    fail('MEMBERSHIP_DIAGNOSTIC_SQL_INVALID')
  }
  assertRequiredOnce(source, [
    'export function runFunctionOwnerMembershipDiagnostic(options = {})',
    'diagnosticFile: DIAGNOSTIC_FILE',
    "applicationName:\n      'line-pay-owner-membership-read-only-diagnostic'",
    "credentialPrefix: 'line-pay-owner-membership-'",
    'validateDiagnosticFile: readAndValidateDiagnosticFile',
    'parseDiagnosticOutput: parseAndValidateMembershipDiagnosticOutput',
    'await runFunctionOwnerMembershipDiagnostic()',
    'JSON.stringify(toSafeFailureAttestation(error))',
  ])
  if (
    /\b(?:retry|fallback|secondDatabaseSession)\b|spawnSync|execSync|execFile|shell:\s*true|docker[.]sock|supabase\s+(?:db|migration)|console[.](?:log|error)\s*\([^)]*(?:stdout|stderr)|raw_(?:stdout|stderr)/iu.test(
      source,
    )
  ) {
    fail('MEMBERSHIP_DIAGNOSTIC_SQL_INVALID')
  }
  return true
}

export function assertWorkflowSource(source) {
  if (typeof source !== 'string') {
    fail('MEMBERSHIP_DIAGNOSTIC_SQL_INVALID')
  }
  const actionUses = [...source.matchAll(/^\s+uses: ([^\s]+)$/gmu)].map(
    (match) => match[1],
  )
  const inputNames = [...source.matchAll(/^\s{6}([a-z_]+):$/gmu)].map(
    (match) => match[1],
  )
  if (
    !/^name: Supabase Production LINE Pay Function Owner Membership Diagnostic$/mu.test(
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
    !/^  group: supabase-production-line-pay-function-owner-membership-diagnostic$/mu.test(
      source,
    ) ||
    !/^  cancel-in-progress: false$/mu.test(source) ||
    !/^      name: supabase-production$/mu.test(source) ||
    actionUses.length < 4 ||
    actionUses.some((action) => !/^[^@]+@[0-9a-f]{40}$/u.test(action)) ||
    (source.match(
      /node scripts\/supabase\/run-line-pay-function-owner-membership-diagnostic[.]mjs/gu,
    ) ?? []).length !== 1 ||
    /\bpsql\b|supabase\s+(?:db|migration)|upload-artifact|run-line-pay-production-exact-file|line_pay_(?:remediation|checkout_aggregate_initialization)_(?:deploy|preflight|postflight|recovery)/iu.test(
      source,
    )
  ) {
    fail('MEMBERSHIP_DIAGNOSTIC_SQL_INVALID')
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
  assertFixedHash(
    root,
    INITIALIZER_MIGRATION_FILE,
    EXPECTED_INITIALIZER_MIGRATION_SHA256,
  )
  assertFixedHash(
    root,
    BASE_MIGRATION_FILE,
    EXPECTED_BASE_MIGRATION_SHA256,
  )
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
    fail('MEMBERSHIP_DIAGNOSTIC_SQL_INVALID')
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
    INITIALIZER_MIGRATION_FILE,
    BASE_MIGRATION_FILE,
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
