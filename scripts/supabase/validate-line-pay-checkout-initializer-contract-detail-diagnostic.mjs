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
  'RUN_LINE_PAY_CHECKOUT_INITIALIZER_CONTRACT_DETAIL_DIAGNOSTIC_READ_ONLY_ONCE'

export const DIAGNOSTIC_FILE =
  'supabase/deployment/line_pay_checkout_initializer_contract_detail_diagnostic.sql'
export const RUNNER_FILE =
  'scripts/supabase/run-line-pay-checkout-initializer-contract-detail-diagnostic.mjs'
export const VALIDATOR_FILE =
  'scripts/supabase/validate-line-pay-checkout-initializer-contract-detail-diagnostic.mjs'
export const WORKFLOW_FILE =
  '.github/workflows/supabase-production-line-pay-checkout-initializer-contract-detail-diagnostic.yml'
export const SHARED_RUNNER_FILE =
  'scripts/supabase/run-line-pay-production-diagnostic.mjs'
export const INITIALIZER_MIGRATION_FILE =
  'supabase/migrations/20260728053215_line_pay_checkout_aggregate_initialization.sql'
export const BASE_MIGRATION_FILE =
  'supabase/migrations/20260719033404_line_pay_remediation_contracts.sql'

export const EXPECTED_DIAGNOSTIC_SHA256 =
  'a49a092a6353571428ecd75ff414baeb0fd9d4a8d58513fa5a853aa75cb780d3'
export const EXPECTED_INITIALIZER_MIGRATION_SHA256 =
  '2e2ef2cce41431e0dc638033c998b7b616cbdc2b3baefdcb59fbb68ba2adf551'
export const EXPECTED_BASE_MIGRATION_SHA256 =
  '8da1fb429aecb1c35b12a245b63907135dbe7c467ef0a5f069afd431d21e94b8'
export const MAX_DIAGNOSTIC_OUTPUT_BYTES = 8192

export const SAFE_FAILURE_CODES = Object.freeze([
  'SOURCE_CONTEXT_INVALID',
  'INVALID_NODE_VERSION',
  'POSTGRES_IMAGE_MISMATCH',
  'PRODUCTION_CHANNEL_NOT_READY',
  'DATABASE_TARGET_MISMATCH',
  'DATABASE_URL_INVALID',
  'INITIALIZER_DETAIL_DIAGNOSTIC_SQL_INVALID',
  'INITIALIZER_DETAIL_DIAGNOSTIC_OUTPUT_INVALID',
  'INITIALIZER_DETAIL_DIAGNOSTIC_DATABASE_IDENTITY_MISMATCH',
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
  /postgres(?:ql)?:\/\/|supabase[.]co|pooler[.]supabase[.]com|[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:[.][a-z0-9-]+)+|\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}\b|\b[0-9a-f]{40}\b|\b[0-9a-f]{64}\b|\bauthorization\b|\bbearer\b|\bpassword\b|\bsecret\b|\btoken\b|\b(?:host|username|database_url|connection_string|raw_stdout|raw_stderr|function_definition|policy_expression|role_name|oid)\b/iu

const TOP_LEVEL_KEYS = Object.freeze([
  'status',
  'database_identity_match',
  'base_remediation_ready',
  'inventory',
  'initializer_function',
  'audit_function',
  'index_contract',
  'policy_contract',
  'table_acl_contract',
  'role_contract',
  'decision',
])
const INVENTORY_KEYS = Object.freeze([
  'functions_present',
  'indexes_present',
  'policies_present',
  'table_select_grants_present',
])
const FUNCTION_KEYS = Object.freeze([
  'signature_exact',
  'security_exact',
  'owner_exact',
  'definition_exact',
  'execute_acl_exact',
  'runtime_execute_exact',
])
const INDEX_KEYS = Object.freeze(['exact'])
const POLICY_KEYS = Object.freeze([
  'audit_insert_exact',
  'items_select_exact',
  'shipping_select_exact',
])
const TABLE_ACL_KEYS = Object.freeze([
  'items_select_exact',
  'shipping_select_exact',
  'no_items_write',
  'no_shipping_write',
  'aggregate_select_acl_exact',
  'no_role_issued_acl',
  'audit_table_acl_exact',
  'service_role_audit_access_absent',
])
const ROLE_KEYS = Object.freeze([
  'function_owner_membership_absent',
])
const DECISION_KEYS = Object.freeze([
  'initializer_exact',
  'recovery_required',
  'detail_complete',
])

function fail(code) {
  throw new Error(code)
}

function assertPlainObject(
  value,
  code = 'INITIALIZER_DETAIL_DIAGNOSTIC_OUTPUT_INVALID',
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
  code = 'INITIALIZER_DETAIL_DIAGNOSTIC_OUTPUT_INVALID',
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
    fail('INITIALIZER_DETAIL_DIAGNOSTIC_OUTPUT_INVALID')
  }
}

function assertCount(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100) {
    fail('INITIALIZER_DETAIL_DIAGNOSTIC_OUTPUT_INVALID')
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

function assertIncludes(source, tokens) {
  for (const token of tokens) {
    if (!source.includes(token)) {
      fail('INITIALIZER_DETAIL_DIAGNOSTIC_SQL_INVALID')
    }
  }
}

function assertRequiredOnce(source, tokens) {
  for (const token of tokens) {
    if (source.split(token).length !== 2) {
      fail('INITIALIZER_DETAIL_DIAGNOSTIC_SQL_INVALID')
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

export function assertContractDetailDiagnosticSql(sql) {
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
    fail('INITIALIZER_DETAIL_DIAGNOSTIC_SQL_INVALID')
  }
  assertIncludes(sql, [
    'LINE_PAY_CHECKOUT_INITIALIZER_CONTRACT_DETAIL_DIAGNOSTIC_COMPLETED',
    'initialize_product_order_line_pay_checkout',
    'record_line_pay_checkout_initialized_audit',
    'pg_catalog.pg_get_functiondef',
    'pg_catalog.pg_get_expr',
    'pg_catalog.aclexplode',
    'pg_catalog.pg_auth_members',
    "'initializer_function',",
    "'audit_function',",
    "'index_contract',",
    "'policy_contract',",
    "'table_acl_contract',",
    "'role_contract',",
    "'decision',",
  ])
  if (
    (sql.match(/'initializer_function',/gu) ?? []).length !== 2 ||
    (sql.match(/'audit_table_acl_exact',/gu) ?? []).length !== 1
  ) {
    fail('INITIALIZER_DETAIL_DIAGNOSTIC_SQL_INVALID')
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
    fail('INITIALIZER_DETAIL_DIAGNOSTIC_SQL_INVALID')
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
    fail('INITIALIZER_DETAIL_DIAGNOSTIC_SQL_INVALID')
  }
  assertContractDetailDiagnosticSql(sql)
  return sql
}

function allValuesTrue(...objects) {
  return objects.every((object) =>
    Object.values(object).every((value) => value === true),
  )
}

export function parseAndValidateContractDetailOutput(text) {
  if (
    typeof text !== 'string' ||
    Buffer.byteLength(text, 'utf8') > MAX_DIAGNOSTIC_OUTPUT_BYTES ||
    OUTPUT_SENSITIVE_PATTERN.test(text)
  ) {
    fail('INITIALIZER_DETAIL_DIAGNOSTIC_OUTPUT_INVALID')
  }
  const rows = text
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
  if (rows.length !== 1) {
    fail('INITIALIZER_DETAIL_DIAGNOSTIC_OUTPUT_INVALID')
  }
  let value
  try {
    value = JSON.parse(rows[0])
  } catch {
    fail('INITIALIZER_DETAIL_DIAGNOSTIC_OUTPUT_INVALID')
  }
  assertExactKeys(value, TOP_LEVEL_KEYS)
  if (
    value.status !==
    'LINE_PAY_CHECKOUT_INITIALIZER_CONTRACT_DETAIL_DIAGNOSTIC_COMPLETED'
  ) {
    fail('INITIALIZER_DETAIL_DIAGNOSTIC_OUTPUT_INVALID')
  }
  assertBoolean(value.database_identity_match)
  if (!value.database_identity_match) {
    fail('INITIALIZER_DETAIL_DIAGNOSTIC_DATABASE_IDENTITY_MISMATCH')
  }
  assertBoolean(value.base_remediation_ready)
  assertExactKeys(value.inventory, INVENTORY_KEYS)
  for (const key of INVENTORY_KEYS) assertCount(value.inventory[key])
  const inventory = Object.freeze({ ...value.inventory })
  const initializerFunction = assertBooleanObject(
    value.initializer_function,
    FUNCTION_KEYS,
  )
  const auditFunction = assertBooleanObject(
    value.audit_function,
    FUNCTION_KEYS,
  )
  const indexContract = assertBooleanObject(
    value.index_contract,
    INDEX_KEYS,
  )
  const policyContract = assertBooleanObject(
    value.policy_contract,
    POLICY_KEYS,
  )
  const tableAclContract = assertBooleanObject(
    value.table_acl_contract,
    TABLE_ACL_KEYS,
  )
  const roleContract = assertBooleanObject(
    value.role_contract,
    ROLE_KEYS,
  )
  const decision = assertBooleanObject(value.decision, DECISION_KEYS)
  const inventoryExact =
    inventory.functions_present === 2 &&
    inventory.indexes_present === 1 &&
    inventory.policies_present === 3 &&
    inventory.table_select_grants_present === 2
  const initializerExact =
    value.base_remediation_ready &&
    inventoryExact &&
    allValuesTrue(
      initializerFunction,
      auditFunction,
      indexContract,
      policyContract,
      tableAclContract,
      roleContract,
    )
  if (
    decision.initializer_exact !== initializerExact ||
    decision.recovery_required !==
      (value.base_remediation_ready && !initializerExact) ||
    decision.detail_complete !== value.base_remediation_ready
  ) {
    fail('INITIALIZER_DETAIL_DIAGNOSTIC_OUTPUT_INVALID')
  }
  return Object.freeze({
    status: value.status,
    database_identity_match: value.database_identity_match,
    base_remediation_ready: value.base_remediation_ready,
    inventory,
    initializer_function: initializerFunction,
    audit_function: auditFunction,
    index_contract: indexContract,
    policy_contract: policyContract,
    table_acl_contract: tableAclContract,
    role_contract: roleContract,
    decision,
  })
}

export function assertRunnerSource(source) {
  if (typeof source !== 'string') {
    fail('INITIALIZER_DETAIL_DIAGNOSTIC_SQL_INVALID')
  }
  assertRequiredOnce(source, [
    'export function runCheckoutInitializerContractDetailDiagnostic(',
    'diagnosticFile: DIAGNOSTIC_FILE',
    "applicationName:\n      'line-pay-checkout-initializer-contract-detail-read-only-diagnostic'",
    "credentialPrefix: 'line-pay-initializer-detail-'",
    'validateDiagnosticFile: readAndValidateDiagnosticFile',
    'parseDiagnosticOutput: parseAndValidateContractDetailOutput',
    'await runCheckoutInitializerContractDetailDiagnostic()',
    'JSON.stringify(toSafeFailureAttestation(error))',
  ])
  if (
    /\b(?:retry|fallback|secondDatabaseSession)\b|spawnSync|execSync|execFile|shell:\s*true|docker[.]sock|supabase\s+(?:db|migration)|console[.](?:log|error)\s*\([^)]*(?:stdout|stderr)|raw_(?:stdout|stderr)/iu.test(
      source,
    )
  ) {
    fail('INITIALIZER_DETAIL_DIAGNOSTIC_SQL_INVALID')
  }
  return true
}

export function assertWorkflowSource(source) {
  if (typeof source !== 'string') {
    fail('INITIALIZER_DETAIL_DIAGNOSTIC_SQL_INVALID')
  }
  const actionUses = [...source.matchAll(/^\s+uses: ([^\s]+)$/gmu)].map(
    (match) => match[1],
  )
  const inputNames = [...source.matchAll(/^\s{6}([a-z_]+):$/gmu)].map(
    (match) => match[1],
  )
  if (
    !/^name: Supabase Production LINE Pay Checkout Initializer Contract Detail Diagnostic$/mu.test(
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
    !/^  group: supabase-production-line-pay-checkout-initializer-contract-detail-diagnostic$/mu.test(
      source,
    ) ||
    !/^  cancel-in-progress: false$/mu.test(source) ||
    !/^      name: supabase-production$/mu.test(source) ||
    actionUses.length < 4 ||
    actionUses.some((action) => !/^[^@]+@[0-9a-f]{40}$/u.test(action)) ||
    (source.match(
      /node scripts\/supabase\/run-line-pay-checkout-initializer-contract-detail-diagnostic[.]mjs/gu,
    ) ?? []).length !== 1 ||
    /\bpsql\b|supabase\s+(?:db|migration)|upload-artifact|run-line-pay-production-exact-file|line_pay_checkout_aggregate_initialization_(?:deploy|preflight|postflight|recovery)/iu.test(
      source,
    )
  ) {
    fail('INITIALIZER_DETAIL_DIAGNOSTIC_SQL_INVALID')
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
    fail('INITIALIZER_DETAIL_DIAGNOSTIC_SQL_INVALID')
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
