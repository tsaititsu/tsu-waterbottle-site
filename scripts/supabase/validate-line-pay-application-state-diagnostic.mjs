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

export const EXPECTED_REPOSITORY = 'tsaititsu/tsu-waterbottle-site'
export const EXPECTED_PROJECT_REF = 'ndbqoznvobmpkgxkiezz'
export const EXPECTED_EVENT = 'workflow_dispatch'
export const EXPECTED_REF = 'refs/heads/main'
export const EXPECTED_CONFIRMATION =
  'RUN_LINE_PAY_APPLICATION_STATE_DIAGNOSTIC_READ_ONLY_ONCE'
export const DIAGNOSTIC_FILE =
  'supabase/deployment/line_pay_application_state_diagnostic.sql'
export const RUNNER_FILE =
  'scripts/supabase/run-line-pay-application-state-diagnostic.mjs'
export const VALIDATOR_FILE =
  'scripts/supabase/validate-line-pay-application-state-diagnostic.mjs'
export const WORKFLOW_FILE =
  '.github/workflows/supabase-production-line-pay-application-state-diagnostic.yml'
export const MIGRATION_FILE =
  'supabase/migrations/20260719033404_line_pay_remediation_contracts.sql'
export const FENCE_MIGRATION_FILE =
  'supabase/migrations/20260722065311_retire_bank_transfer_submissions_writes.sql'
export const SHARED_RUNNER_FILE =
  'scripts/supabase/run-line-pay-production-diagnostic.mjs'
export const EXPECTED_DIAGNOSTIC_SHA256 =
  'dd2e3b1cdb8c20b1aca4fb8f2b601d839813450894a63ce73f0190a6f5739434'
export const EXPECTED_MIGRATION_SHA256 =
  '8da1fb429aecb1c35b12a245b63907135dbe7c467ef0a5f069afd431d21e94b8'
export const EXPECTED_FENCE_SHA256 =
  '2f43979b1f4ff88243296f0a389c146b879652715d40d23bdb7ce1d6785407d7'
export const MAX_DIAGNOSTIC_OUTPUT_BYTES = 4096

export const APPLICATION_STATES = Object.freeze([
  'UNAPPLIED',
  'PARTIAL',
  'FULL_WITHOUT_HISTORY',
  'FULL_WITH_HISTORY',
  'HISTORY_ONLY',
  'INCONSISTENT',
])

export const SAFE_FAILURE_CODES = Object.freeze([
  'SOURCE_CONTEXT_INVALID',
  'INVALID_NODE_VERSION',
  'POSTGRES_IMAGE_MISMATCH',
  'PRODUCTION_CHANNEL_NOT_READY',
  'DATABASE_TARGET_MISMATCH',
  'DATABASE_URL_INVALID',
  'APPLICATION_STATE_DIAGNOSTIC_SQL_INVALID',
  'APPLICATION_STATE_DIAGNOSTIC_OUTPUT_INVALID',
  'APPLICATION_STATE_DATABASE_IDENTITY_MISMATCH',
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
  /postgres(?:ql)?:\/\/|supabase[.]co|pooler[.]supabase[.]com|[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:[.][a-z0-9-]+)+|\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b|\b[0-9a-f]{40}\b|\b[0-9a-f]{64}\b|\bauthorization\b|\bbearer\b|\bpassword\b|\bsecret\b|\btoken\b|\b(?:host|username|database_url|connection_string|function_body|policy_expression|raw_stdout|raw_stderr)\b/iu

const TOP_LEVEL_KEYS = Object.freeze([
  'status',
  'database_identity_match',
  'migration_history',
  'inventory',
  'contracts',
  'details',
  'application_state',
])
const MIGRATION_HISTORY_KEYS = Object.freeze([
  'table_present',
  'version_present',
])
const INVENTORY_KEYS = Object.freeze([
  'relations_present',
  'functions_present',
  'triggers_present',
  'indexes_present',
  'policies_present',
  'columns_present',
  'constraints_present',
  'roles_present',
])
const CONTRACT_KEYS = Object.freeze([
  'relations_complete',
  'functions_complete',
  'triggers_complete',
  'indexes_complete',
  'policies_complete',
  'columns_complete',
  'constraints_complete',
  'roles_complete',
  'acl_complete',
])
const DETAIL_KEYS = Object.freeze([
  'incomplete_categories',
  'relation_metadata',
  'existing_relation_access',
])
const INCOMPLETE_CATEGORY_KEYS = Object.freeze([
  'category',
  'expected_count',
  'actual_count',
  'count_matches',
  'metadata_matches',
])
const RELATION_METADATA_DETAIL_KEYS = Object.freeze([
  'identity',
  'present',
  'owner_is_current_user',
  'kind_is_table',
  'persistence_is_permanent',
  'rls_enabled',
  'force_rls_enabled',
  'replica_identity_default',
  'explicit_acl_absent',
  'comment_present',
])
const EXISTING_RELATION_ACCESS_DETAIL_KEYS = Object.freeze([
  'identity',
  'present',
  'kind_is_table',
  'rls_enabled',
  'force_rls_enabled',
  'explicit_acl_present',
  'public_write_absent',
  'anon_write_absent',
  'authenticated_write_absent',
  'service_role_write_absent',
])
const DIAGNOSTIC_CATEGORY_SET = new Set([
  'roles',
  'columns',
  'indexes',
  'schemas',
  'policies',
  'triggers',
  'functions',
  'relations',
  'constraints',
  'existing_relation_access',
])
const MAX_INCOMPLETE_CATEGORIES = DIAGNOSTIC_CATEGORY_SET.size
const RELATION_METADATA_IDENTITIES = Object.freeze([
  'line_pay_private.line_pay_completion_proofs',
  'public.app_environment_attestation',
  'public.line_pay_callback_capabilities',
  'public.line_pay_callback_events',
  'public.line_pay_checkout_attempts',
  'public.line_pay_payment_audit_events',
  'public.line_pay_request_outbox',
])
const EXISTING_RELATION_ACCESS_IDENTITIES = Object.freeze([
  'public.payments',
  'public.product_orders',
])
const RELATION_METADATA_IDENTITY_SET = new Set(RELATION_METADATA_IDENTITIES)
const EXISTING_RELATION_ACCESS_IDENTITY_SET = new Set(
  EXISTING_RELATION_ACCESS_IDENTITIES,
)
const REQUIRED_SQL_IDENTITIES = Object.freeze([
  'app_environment_attestation',
  'line_pay_checkout_attempts',
  'line_pay_request_outbox',
  'line_pay_callback_capabilities',
  'line_pay_callback_events',
  'line_pay_payment_audit_events',
  'line_pay_completion_proofs',
  'line_pay_payment_executor',
  'line_pay_payment_function_owner',
  "'product_orders', 'environment'",
  "'payments', 'line_pay_transaction_id'",
  'line_pay_completion_proofs_guard',
  'line_pay_payment_function_owner_audit_insert',
  'payments_line_pay_contract_check',
  'payments_line_pay_transaction_idx',
])
const REQUIRED_SQL_EXACT_ONCE = Object.freeze([
  "('public', 'app_environment_attestation')",
  "('public', 'line_pay_checkout_attempts')",
  "('public', 'line_pay_request_outbox')",
  "('public', 'line_pay_callback_capabilities')",
  "('public', 'line_pay_callback_events')",
  "('public', 'line_pay_payment_audit_events')",
  "('line_pay_private', 'line_pay_completion_proofs')",
  "('product_orders', 'environment')",
  "('payments', 'line_pay_transaction_id')",
])

function fail(code) {
  throw new Error(code)
}

function assertPlainObject(value) {
  if (
    value === null ||
    Array.isArray(value) ||
    typeof value !== 'object' ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail('APPLICATION_STATE_DIAGNOSTIC_OUTPUT_INVALID')
  }
}

function assertExactKeys(value, keys) {
  assertPlainObject(value)
  if (!isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort())) {
    fail('APPLICATION_STATE_DIAGNOSTIC_OUTPUT_INVALID')
  }
}

function assertBoolean(value) {
  if (typeof value !== 'boolean') {
    fail('APPLICATION_STATE_DIAGNOSTIC_OUTPUT_INVALID')
  }
}

function assertCount(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 10000) {
    fail('APPLICATION_STATE_DIAGNOSTIC_OUTPUT_INVALID')
  }
}

function assertSafeDetailRows(value, keys, identitySet, maxRows) {
  if (!Array.isArray(value) || value.length > maxRows) {
    fail('APPLICATION_STATE_DIAGNOSTIC_OUTPUT_INVALID')
  }
  let previousIdentity = ''
  return value.map((detail) => {
    assertExactKeys(detail, keys)
    if (
      typeof detail.identity !== 'string' ||
      !identitySet.has(detail.identity) ||
      detail.identity <= previousIdentity
    ) {
      fail('APPLICATION_STATE_DIAGNOSTIC_OUTPUT_INVALID')
    }
    previousIdentity = detail.identity
    const frozenDetail = { identity: detail.identity }
    for (const key of keys) {
      if (key === 'identity') continue
      assertBoolean(detail[key])
      frozenDetail[key] = detail[key]
    }
    return Object.freeze(frozenDetail)
  })
}

function readFixedRegularFile(root, relativePath) {
  if (
    typeof root !== 'string' ||
    typeof relativePath !== 'string' ||
    !relativePath ||
    isAbsolute(relativePath)
  ) {
    fail('APPLICATION_STATE_DIAGNOSTIC_SQL_INVALID')
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
    fail('APPLICATION_STATE_DIAGNOSTIC_SQL_INVALID')
  }
  try {
    const stat = lstatSync(filePath)
    if (!stat.isFile() || stat.isSymbolicLink()) {
      fail('APPLICATION_STATE_DIAGNOSTIC_SQL_INVALID')
    }
    return readFileSync(filePath, 'utf8')
  } catch (error) {
    if (
      error instanceof Error &&
      SAFE_FAILURE_CODE_SET.has(error.message)
    ) {
      throw error
    }
    fail('APPLICATION_STATE_DIAGNOSTIC_SQL_INVALID')
  }
}

function assertRequiredOnce(source, tokens) {
  for (const token of tokens) {
    if (source.split(token).length !== 2) {
      fail('APPLICATION_STATE_DIAGNOSTIC_SQL_INVALID')
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
    environment.GITHUB_REF !== EXPECTED_REF ||
    environment.PROJECT_REF_INPUT !== EXPECTED_PROJECT_REF ||
    environment.DIAGNOSTIC_CONFIRMATION !== EXPECTED_CONFIRMATION
  ) {
    fail('SOURCE_CONTEXT_INVALID')
  }
  const githubSha = validateFullSha(environment.GITHUB_SHA)
  const authorizedCommit = validateFullSha(environment.AUTHORIZED_COMMIT)
  if (githubSha !== authorizedCommit) fail('SOURCE_CONTEXT_INVALID')
  return true
}

export function classifyApplicationState(
  migrationHistory,
  inventory,
  contracts,
) {
  assertExactKeys(migrationHistory, MIGRATION_HISTORY_KEYS)
  assertExactKeys(inventory, INVENTORY_KEYS)
  assertExactKeys(contracts, CONTRACT_KEYS)
  for (const value of Object.values(migrationHistory)) assertBoolean(value)
  for (const value of Object.values(inventory)) assertCount(value)
  for (const value of Object.values(contracts)) assertBoolean(value)
  if (migrationHistory.version_present && !migrationHistory.table_present) {
    fail('APPLICATION_STATE_DIAGNOSTIC_OUTPUT_INVALID')
  }
  const inventoryEmpty = Object.values(inventory).every((value) => value === 0)
  const contractsComplete = Object.values(contracts).every(Boolean)
  if (contractsComplete) {
    return migrationHistory.version_present
      ? 'FULL_WITH_HISTORY'
      : 'FULL_WITHOUT_HISTORY'
  }
  if (migrationHistory.version_present) {
    return inventoryEmpty ? 'HISTORY_ONLY' : 'INCONSISTENT'
  }
  return inventoryEmpty ? 'UNAPPLIED' : 'PARTIAL'
}

function assertDiagnosticDetails(value) {
  assertExactKeys(value, DETAIL_KEYS)
  const categories = value.incomplete_categories
  if (
    !Array.isArray(categories) ||
    categories.length > MAX_INCOMPLETE_CATEGORIES
  ) {
    fail('APPLICATION_STATE_DIAGNOSTIC_OUTPUT_INVALID')
  }
  let previousCategory = ''
  const frozenCategories = categories.map((categoryDetail) => {
    assertExactKeys(categoryDetail, INCOMPLETE_CATEGORY_KEYS)
    if (
      typeof categoryDetail.category !== 'string' ||
      !DIAGNOSTIC_CATEGORY_SET.has(categoryDetail.category) ||
      categoryDetail.category <= previousCategory
    ) {
      fail('APPLICATION_STATE_DIAGNOSTIC_OUTPUT_INVALID')
    }
    previousCategory = categoryDetail.category
    assertCount(categoryDetail.expected_count)
    assertCount(categoryDetail.actual_count)
    assertBoolean(categoryDetail.count_matches)
    assertBoolean(categoryDetail.metadata_matches)
    if (
      categoryDetail.count_matches !==
        (categoryDetail.actual_count === categoryDetail.expected_count) ||
      (categoryDetail.count_matches && categoryDetail.metadata_matches)
    ) {
      fail('APPLICATION_STATE_DIAGNOSTIC_OUTPUT_INVALID')
    }
    return Object.freeze({
      category: categoryDetail.category,
      expected_count: categoryDetail.expected_count,
      actual_count: categoryDetail.actual_count,
      count_matches: categoryDetail.count_matches,
      metadata_matches: categoryDetail.metadata_matches,
    })
  })
  const relationMetadata = assertSafeDetailRows(
    value.relation_metadata,
    RELATION_METADATA_DETAIL_KEYS,
    RELATION_METADATA_IDENTITY_SET,
    RELATION_METADATA_IDENTITIES.length,
  )
  const existingRelationAccess = assertSafeDetailRows(
    value.existing_relation_access,
    EXISTING_RELATION_ACCESS_DETAIL_KEYS,
    EXISTING_RELATION_ACCESS_IDENTITY_SET,
    EXISTING_RELATION_ACCESS_IDENTITIES.length,
  )
  return Object.freeze({
    incomplete_categories: Object.freeze(frozenCategories),
    relation_metadata: Object.freeze(relationMetadata),
    existing_relation_access: Object.freeze(existingRelationAccess),
  })
}

export function assertApplicationStateDiagnosticSql(sql) {
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
    (sql.match(/actual[.]digest = expected[.]digest/gu) ?? []).length !== 3 ||
    !/'details', pg_catalog[.]jsonb_build_object/u.test(sql) ||
    !/'incomplete_categories'/u.test(sql) ||
    !/'relation_metadata'/u.test(sql) ||
    !/'existing_relation_access'/u.test(sql) ||
    !/'metadata_matches'/u.test(sql) ||
    !/'owner_is_current_user'/u.test(sql) ||
    !/'public_write_absent'/u.test(sql) ||
    !/then 'HISTORY_ONLY'/u.test(sql) ||
    !/then 'UNAPPLIED'/u.test(sql) ||
    !/then 'PARTIAL'/u.test(sql)
  ) {
    fail('APPLICATION_STATE_DIAGNOSTIC_SQL_INVALID')
  }
  for (const state of APPLICATION_STATES) {
    if (!sql.includes(`'${state}'`)) {
      fail('APPLICATION_STATE_DIAGNOSTIC_SQL_INVALID')
    }
  }
  for (const identity of REQUIRED_SQL_IDENTITIES) {
    if (!sql.includes(identity)) {
      fail('APPLICATION_STATE_DIAGNOSTIC_SQL_INVALID')
    }
  }
  for (const identity of REQUIRED_SQL_EXACT_ONCE) {
    if (sql.split(identity).length !== 2) {
      fail('APPLICATION_STATE_DIAGNOSTIC_SQL_INVALID')
    }
  }
  const psqlCommands = sql.match(/^\\[^\r\n]+$/gmu) ?? []
  if (
    !isDeepStrictEqual(psqlCommands, [
      '\\set ON_ERROR_STOP on',
      '\\set QUIET on',
      '\\pset format unaligned',
      '\\pset tuples_only on',
      '\\gset',
      '\\if :migration_history_table_present',
      '\\gset',
      '\\else',
      '\\set migration_history_version_present false',
      '\\endif',
    ])
  ) {
    fail('APPLICATION_STATE_DIAGNOSTIC_SQL_INVALID')
  }
  const normalized = stripSqlForStaticAnalysis(sql)
  const forbidden =
    /\b(insert|update|delete|merge|truncate|create|alter|drop|grant|revoke|comment|copy|call|do|execute|security\s+definer|set\s+role|lock\s+table|select\s+for\s+(?:update|share)|pg_sleep|dblink|listen|notify|vacuum|analyze|reindex|cluster|prepare|savepoint|release)\b|\bpg_(?:try_)?advisory_(?:lock|xact_lock|unlock)\b|\bpg_(?:cancel|terminate)_backend\b|\bpg_(?:read|write|stat)_file\b|\blo_(?:export|import)\b/iu
  if (
    forbidden.test(normalized) ||
    /\\(?:i|ir|copy|!|o|w)\b/iu.test(sql) ||
    /\bfrom\s+(?:public|line_pay_private)[.]/iu.test(normalized) ||
    /\bpg_get_functiondef\b/iu.test(normalized) ||
    (normalized.match(/^\s*begin\s+transaction\b/gimu) ?? []).length !== 1 ||
    (normalized.match(/^\s*rollback\s*;/gimu) ?? []).length !== 1
  ) {
    fail('APPLICATION_STATE_DIAGNOSTIC_SQL_INVALID')
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
    fail('APPLICATION_STATE_DIAGNOSTIC_SQL_INVALID')
  }
  assertApplicationStateDiagnosticSql(sql)
  return sql
}

export function parseAndValidateDiagnosticOutput(text) {
  if (
    typeof text !== 'string' ||
    Buffer.byteLength(text, 'utf8') > MAX_DIAGNOSTIC_OUTPUT_BYTES ||
    OUTPUT_SENSITIVE_PATTERN.test(text)
  ) {
    fail('APPLICATION_STATE_DIAGNOSTIC_OUTPUT_INVALID')
  }
  const rows = text
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
  if (rows.length !== 1) {
    fail('APPLICATION_STATE_DIAGNOSTIC_OUTPUT_INVALID')
  }
  let value
  try {
    value = JSON.parse(rows[0])
  } catch {
    fail('APPLICATION_STATE_DIAGNOSTIC_OUTPUT_INVALID')
  }
  assertExactKeys(value, TOP_LEVEL_KEYS)
  if (
    value.status !== 'APPLICATION_STATE_DIAGNOSTIC_COMPLETED' ||
    !APPLICATION_STATES.includes(value.application_state)
  ) {
    fail('APPLICATION_STATE_DIAGNOSTIC_OUTPUT_INVALID')
  }
  assertBoolean(value.database_identity_match)
  if (!value.database_identity_match) {
    fail('APPLICATION_STATE_DATABASE_IDENTITY_MISMATCH')
  }
  const expectedState = classifyApplicationState(
    value.migration_history,
    value.inventory,
    value.contracts,
  )
  if (value.application_state !== expectedState) {
    fail('APPLICATION_STATE_DIAGNOSTIC_OUTPUT_INVALID')
  }
  const details = assertDiagnosticDetails(value.details)
  return Object.freeze({
    status: value.status,
    database_identity_match: value.database_identity_match,
    migration_history: Object.freeze({ ...value.migration_history }),
    inventory: Object.freeze({ ...value.inventory }),
    contracts: Object.freeze({ ...value.contracts }),
    details,
    application_state: value.application_state,
  })
}

export function assertRunnerSource(source) {
  if (typeof source !== 'string') {
    fail('APPLICATION_STATE_DIAGNOSTIC_SQL_INVALID')
  }
  assertRequiredOnce(source, [
    'export function runApplicationStateDiagnostic(options = {})',
    'diagnosticFile: DIAGNOSTIC_FILE',
    "applicationName: 'line-pay-application-state-read-only-diagnostic'",
    "credentialPrefix: 'line-pay-application-state-'",
    'validateDiagnosticFile: readAndValidateDiagnosticFile',
    'parseDiagnosticOutput: parseAndValidateDiagnosticOutput',
    'const result = await runApplicationStateDiagnostic()',
    'JSON.stringify(toSafeFailureAttestation(error))',
  ])
  if (
    /\b(?:retry|fallback|secondDatabaseSession)\b|spawnSync|execSync|execFile|shell:\s*true|docker[.]sock|supabase\s+(?:db|migration)|console[.](?:log|error)\s*\([^)]*(?:stdout|stderr)|raw_(?:stdout|stderr)/iu.test(
      source,
    )
  ) {
    fail('APPLICATION_STATE_DIAGNOSTIC_SQL_INVALID')
  }
  return true
}

export function assertSharedRunnerSource(source) {
  if (typeof source !== 'string') {
    fail('APPLICATION_STATE_DIAGNOSTIC_SQL_INVALID')
  }
  assertRequiredOnce(source, [
    'let databaseSessionExecutions = 0',
    'databaseSessionExecutions += 1',
    'if (databaseSessionExecutions !== DATABASE_SESSION_LIMIT)',
  ])
  if (
    /\b(?:retry|fallback|secondDatabaseSession)\b|shell:\s*true|docker[.]sock|console[.](?:log|error)\s*\([^)]*(?:stdout|stderr)|raw_(?:stdout|stderr)/iu.test(
      source,
    )
  ) {
    fail('APPLICATION_STATE_DIAGNOSTIC_SQL_INVALID')
  }
  return true
}

export function assertWorkflowSource(source) {
  if (typeof source !== 'string') {
    fail('APPLICATION_STATE_DIAGNOSTIC_SQL_INVALID')
  }
  const actionUses = [...source.matchAll(/^\s+uses: ([^\s]+)$/gmu)].map(
    (match) => match[1],
  )
  const inputNames = [...source.matchAll(/^\s{6}([a-z_]+):$/gmu)].map(
    (match) => match[1],
  )
  if (
    !/^name: Supabase Production LINE Pay Application State Diagnostic$/mu.test(
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
    !/^  group: supabase-production-line-pay-application-state-diagnostic$/mu.test(
      source,
    ) ||
    !/^  cancel-in-progress: false$/mu.test(source) ||
    !/^      name: supabase-production$/mu.test(source) ||
    actionUses.length < 4 ||
    actionUses.some((action) => !/^[^@]+@[0-9a-f]{40}$/u.test(action)) ||
    (source.match(
      /node scripts\/supabase\/run-line-pay-application-state-diagnostic[.]mjs/gu,
    ) ?? []).length !== 1 ||
    /\bpsql\b|supabase\s+(?:db|migration)|upload-artifact|run-line-pay-production-exact-file|line_pay_remediation_(?:deploy|preflight|postflight)/iu.test(
      source,
    )
  ) {
    fail('APPLICATION_STATE_DIAGNOSTIC_SQL_INVALID')
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
  assertFixedHash(root, MIGRATION_FILE, EXPECTED_MIGRATION_SHA256)
  assertFixedHash(root, FENCE_MIGRATION_FILE, EXPECTED_FENCE_SHA256)
  const runner = readFixedRegularFile(root, RUNNER_FILE)
  const sharedRunner = readFixedRegularFile(root, SHARED_RUNNER_FILE)
  const workflow = readFixedRegularFile(root, WORKFLOW_FILE)
  assertRunnerSource(runner)
  assertSharedRunnerSource(sharedRunner)
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
    DIAGNOSTIC_FILE,
    RUNNER_FILE,
    VALIDATOR_FILE,
    SHARED_RUNNER_FILE,
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

export {
  POSTGRES_IMAGE,
  stripSqlForStaticAnalysis,
  validateNodeVersion,
  validatePostgresImage,
  validateProductionChannel,
}
