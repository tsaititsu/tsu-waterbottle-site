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
  'DEPLOY_LINE_PAY_REMEDIATION_EXACT_FILE_ONCE'
export const EXPECTED_NODE_VERSION = 'v24.16.0'
export const POSTGRES_IMAGE =
  'postgres@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193'
export const MIGRATION_FILE =
  'supabase/migrations/20260719033404_line_pay_remediation_contracts.sql'
export const FENCE_MIGRATION_FILE =
  'supabase/migrations/20260722065311_retire_bank_transfer_submissions_writes.sql'
export const PREFLIGHT_FILE =
  'supabase/deployment/line_pay_remediation_preflight.sql'
export const POSTFLIGHT_FILE =
  'supabase/deployment/line_pay_remediation_postflight.sql'
export const DEPLOY_FILE =
  'supabase/deployment/line_pay_remediation_deploy.sql'
export const RUNNER_FILE =
  'scripts/supabase/run-line-pay-production-exact-file.mjs'
export const WORKFLOW_FILE =
  '.github/workflows/supabase-production-line-pay-migration.yml'
export const RETIRED_WORKFLOW_FILE =
  '.github/workflows/supabase-emergency-profiles-acl.yml'
export const EXPECTED_MIGRATION_SHA256 =
  '370984c499d93f602b3dccf876becd030085e88ccd9a17106fee8b0009d84046'
export const EXPECTED_FENCE_SHA256 =
  '2f43979b1f4ff88243296f0a389c146b879652715d40d23bdb7ce1d6785407d7'
export const EXPECTED_PSQL_MAJOR = 17

const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/u
const SHA256_PATTERN = /^[0-9a-f]{64}$/u
const SAFE_ERROR_CODES = new Set([
  'ALREADY_APPLIED',
  'BLOCKED_BY_DATABASE_LOCK_RISK',
  'DATABASE_OUTPUT_INVALID',
  'EMERGENCY_WORKFLOW_PRESENT',
  'FENCE_HASH_MISMATCH',
  'FENCE_REGRESSION',
  'FIXED_FILE_HASH_MISMATCH',
  'FIXED_FILE_INVALID',
  'INVALID_DEPLOYMENT_CONFIRMATION',
  'INVALID_MAIN_SHA',
  'INVALID_NODE_VERSION',
  'INVALID_SQL_SYNTAX',
  'MIGRATION_HASH_MISMATCH',
  'POSTGRES_IMAGE_MISMATCH',
  'PARTIAL_APPLICATION',
  'POSTFLIGHT_CONTRACT_FAILED',
  'PRODUCTION_CHANNEL_NOT_READY',
  'PRODUCTION_DATA_DRIFT',
  'PROJECT_REF_MISMATCH',
  'PSQL_VERSION_CHECK_FAILED',
  'SCHEMA_DRIFT',
  'SOURCE_CONTEXT_INVALID',
  'SOURCE_VALIDATION_FAILED',
  'UNSAFE_AUDIT_SQL',
  'UNSUPPORTED_PSQL_VERSION',
])

const BANK_TRANSFER_MATCH_GROUPS = Object.freeze({
  identity_and_amount: true,
  payer_contact: true,
  transfer_details: true,
  review_and_confirmation: true,
  full_canonical_row: true,
})

const BANK_TRANSFER_ORDINAL_MATCH = Object.freeze({
  identity_group_match: true,
  contact_group_match: true,
  transfer_group_match: true,
  review_group_match: true,
  full_row_match: true,
})

export const BANK_TRANSFER_HISTORICAL_CONTRACT = Object.freeze({
  schema_signature_match: true,
  row_count_match: true,
  pending_review_count_match: true,
  pk_digest_match: true,
  group_matches: BANK_TRANSFER_MATCH_GROUPS,
  ordinal_matches: Object.freeze({
    ordinal_1: BANK_TRANSFER_ORDINAL_MATCH,
    ordinal_2: BANK_TRANSFER_ORDINAL_MATCH,
    ordinal_3: BANK_TRANSFER_ORDINAL_MATCH,
  }),
})

const ACTIVE_TABLE_MANIFEST_CONTRACT = Object.freeze({
  manifest_complete: true,
  no_missing_rows: true,
  no_unexpected_rows: true,
  business_fields_unchanged: true,
})

export const FENCE_CONTRACT = Object.freeze({
  relation_kind: 'r',
  rls_enabled: true,
  policy_count: 1,
  policy_name: 'Users can read own bank transfer submissions',
  policy_roles: Object.freeze(['authenticated']),
  policy_command: 'r',
  using_expression: '(( SELECT auth.uid() AS uid) = user_id)',
  with_check_expression: null,
  authenticated_acl: Object.freeze(['SELECT']),
  service_role_acl: Object.freeze(['SELECT']),
  anon_acl: Object.freeze([]),
  public_acl: Object.freeze([]),
  unknown_write_acl_count: 0,
  grant_option_count: 0,
})

function fail(code) {
  throw new Error(code)
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }
  for (const nested of Object.values(value)) deepFreeze(nested)
  return Object.freeze(value)
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
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (!isDeepStrictEqual(actual, expected)) fail(code)
}

export function validateFullSha(value) {
  if (typeof value !== 'string' || !FULL_SHA_PATTERN.test(value)) {
    fail('INVALID_MAIN_SHA')
  }
  return value
}

export function validateConfirmation(value) {
  if (value !== EXPECTED_CONFIRMATION) {
    fail('INVALID_DEPLOYMENT_CONFIRMATION')
  }
  return true
}

export function validateProjectRef(value) {
  if (value !== EXPECTED_PROJECT_REF) fail('PROJECT_REF_MISMATCH')
  return true
}

export function validateMigrationHash(value) {
  if (value !== EXPECTED_MIGRATION_SHA256) fail('MIGRATION_HASH_MISMATCH')
  return true
}

export function validateFenceHash(value) {
  if (value !== EXPECTED_FENCE_SHA256) fail('FENCE_HASH_MISMATCH')
  return true
}

export function validateNodeVersion(value = process.version) {
  if (value !== EXPECTED_NODE_VERSION) fail('INVALID_NODE_VERSION')
  return true
}

export function validatePostgresImage(value) {
  if (value !== POSTGRES_IMAGE) fail('POSTGRES_IMAGE_MISMATCH')
  return true
}

export function validatePsqlVersionOutput(output) {
  if (typeof output !== 'string') fail('UNSUPPORTED_PSQL_VERSION')
  const record = output.endsWith('\n') ? output.slice(0, -1) : output
  if (!record || /[\x00-\x1f\x7f]/u.test(record)) {
    fail('UNSUPPORTED_PSQL_VERSION')
  }
  const match =
    /^psql \(PostgreSQL\) ([1-9][0-9]*(?:[.][0-9]+)*)(?: \(([\x20-\x27\x2a-\x7e]+)\))?$/u.exec(
      record,
    )
  if (
    !match ||
    match[1].split('.')[0] !== String(EXPECTED_PSQL_MAJOR) ||
    (match[2] !== undefined && !/[\x21-\x27\x2a-\x7e]/u.test(match[2]))
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
  const authorizedCommit = validateFullSha(environment.AUTHORIZED_COMMIT)
  if (githubSha !== authorizedCommit) fail('SOURCE_CONTEXT_INVALID')
  validateProjectRef(environment.PROJECT_REF_INPUT)
  validateMigrationHash(environment.MIGRATION_SHA256_INPUT)
  validateConfirmation(environment.DEPLOY_CONFIRMATION)
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

export function readAndValidateFixedFile(root, relativePath, expectedHash) {
  if (
    typeof root !== 'string' ||
    typeof relativePath !== 'string' ||
    !relativePath ||
    isAbsolute(relativePath) ||
    !SHA256_PATTERN.test(expectedHash)
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
  let stat
  let contents
  try {
    stat = lstatSync(filePath)
    contents = readFileSync(filePath, 'utf8')
  } catch {
    fail('FIXED_FILE_INVALID')
  }
  if (!stat.isFile() || stat.isSymbolicLink()) fail('FIXED_FILE_INVALID')
  const actualHash = createHash('sha256').update(contents).digest('hex')
  if (actualHash !== expectedHash) fail('FIXED_FILE_HASH_MISMATCH')
  return contents
}

function readFixedRegularFile(root, relativePath) {
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
  let stat
  try {
    stat = lstatSync(filePath)
    if (!stat.isFile() || stat.isSymbolicLink()) fail('FIXED_FILE_INVALID')
    return readFileSync(filePath, 'utf8')
  } catch (error) {
    if (error instanceof Error && SAFE_ERROR_CODES.has(error.message)) throw error
    fail('FIXED_FILE_INVALID')
  }
}

export function assertEmergencyWorkflowRetired(root = process.cwd()) {
  try {
    lstatSync(resolve(root, RETIRED_WORKFLOW_FILE))
  } catch (error) {
    if (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return true
    }
    fail('EMERGENCY_WORKFLOW_PRESENT')
  }
  fail('EMERGENCY_WORKFLOW_PRESENT')
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

export function assertReadOnlyAuditSql(sql) {
  const psqlCommands = sql
    .split(/\r?\n/u)
    .filter((line) => line.trimStart().startsWith('\\'))
  if (
    psqlCommands.some(
      (line) =>
        !/^\\(?:if :\{\?[a-z_]+\}|else|endif|gset)\s*$/u.test(line.trim()),
    )
  ) {
    fail('UNSAFE_AUDIT_SQL')
  }
  const normalized = stripSqlForStaticAnalysis(
    sql
      .split(/\r?\n/u)
      .filter((line) => !line.trimStart().startsWith('\\'))
      .join('\n'),
  )
  if (
    !/^\s*with\b/iu.test(normalized) ||
    (normalized.match(/;/gu) ?? []).length !== 1 ||
    !/;\s*$/u.test(normalized)
  ) {
    fail('UNSAFE_AUDIT_SQL')
  }
  const forbidden =
    /\b(insert|update|delete|truncate|create|alter|drop|grant|revoke|comment|call|copy|do|begin|commit|rollback|savepoint|release|prepare|execute|set\s+role|reset\s+role|listen|notify|vacuum|analyze|reindex|cluster)\b|\bpg_(?:try_)?advisory_(?:lock|xact_lock|unlock)\b|\bpg_(?:cancel|terminate)_backend\b/iu
  if (forbidden.test(normalized)) fail('UNSAFE_AUDIT_SQL')
  return true
}

export function assertDeployOrchestrationSql(sql) {
  if (typeof sql !== 'string') fail('FIXED_FILE_INVALID')
  const requiredOnce = [
    '\\ir line_pay_remediation_preflight.sql',
    '\\ir ../migrations/20260719033404_line_pay_remediation_contracts.sql',
    '\\ir line_pay_remediation_postflight.sql',
    '\\set line_pay_locked_guard 1',
    '\\if :line_pay_locked_guard_ready',
    'baseline_payments_manifest',
    'baseline_product_orders_manifest',
    'baseline_payments_row_count',
    'baseline_product_orders_row_count',
    '\\set line_pay_baseline_manifest 1',
    "'provider', row_value.provider",
    "'payment_status', row_value.payment_status",
    '\\echo LINE_PAY_DEPLOY_MIGRATION_STARTED',
    '\\echo LINE_PAY_DEPLOY_MIGRATION_COMMITTED',
    '\\echo LINE_PAY_DEPLOY_POSTFLIGHT_STARTED',
    '\\echo LINE_PAY_DEPLOY_POSTFLIGHT_STATE_EMITTED',
    '\\echo LINE_PAY_DEPLOY_POSTFLIGHT_COMMITTED',
  ]
  for (const token of requiredOnce) {
    if (sql.split(token).length !== 2) fail('FIXED_FILE_INVALID')
  }
  for (const token of [
    'begin;',
    'lock table public.product_orders, public.payments in access exclusive mode;',
    'set local lock_timeout = \'15s\';',
    'set local statement_timeout = \'120s\';',
    'set local idle_in_transaction_session_timeout = \'30s\';',
  ]) {
    if (sql.split(token).length !== 3) fail('FIXED_FILE_INVALID')
  }
  if (sql.split('commit;').length !== 2) fail('FIXED_FILE_INVALID')
  const migrationIndex = sql.indexOf(
    '\\ir ../migrations/20260719033404_line_pay_remediation_contracts.sql',
  )
  const migrationStartedIndex = sql.indexOf(
    '\\echo LINE_PAY_DEPLOY_MIGRATION_STARTED',
  )
  const migrationCommittedIndex = sql.indexOf(
    '\\echo LINE_PAY_DEPLOY_MIGRATION_COMMITTED',
  )
  const postflightStartedIndex = sql.indexOf(
    '\\echo LINE_PAY_DEPLOY_POSTFLIGHT_STARTED',
  )
  const secondTransactionIndex = sql.indexOf('begin;', migrationIndex)
  const secondLockIndex = sql.indexOf(
    'lock table public.product_orders, public.payments in access exclusive mode;',
    secondTransactionIndex,
  )
  const postflightIndex = sql.indexOf(
    '\\ir line_pay_remediation_postflight.sql',
  )
  const postflightStateEmittedIndex = sql.indexOf(
    '\\echo LINE_PAY_DEPLOY_POSTFLIGHT_STATE_EMITTED',
  )
  const postflightCommitIndex = sql.indexOf('commit;', postflightIndex)
  const postflightCommittedIndex = sql.indexOf(
    '\\echo LINE_PAY_DEPLOY_POSTFLIGHT_COMMITTED',
  )
  if (
    migrationStartedIndex < 0 ||
    migrationIndex <= migrationStartedIndex ||
    migrationCommittedIndex <= migrationIndex ||
    postflightStartedIndex <= migrationCommittedIndex ||
    secondTransactionIndex <= postflightStartedIndex ||
    secondLockIndex <= secondTransactionIndex ||
    postflightIndex <= secondLockIndex ||
    postflightStateEmittedIndex <= postflightIndex ||
    postflightCommitIndex <= postflightStateEmittedIndex ||
    postflightCommittedIndex <= postflightCommitIndex
  ) {
    fail('FIXED_FILE_INVALID')
  }
  const requiredManifestFields = [
    "'id', row_value.id",
    "'user_id', row_value.user_id",
    "'booking_id', row_value.booking_id",
    "'provider', row_value.provider",
    "'provider_payment_id', row_value.provider_payment_id",
    "'item_type', row_value.item_type",
    "'item_name', row_value.item_name",
    "'amount_twd', row_value.amount_twd",
    "'currency', row_value.currency",
    "'status', row_value.status",
    "'paid_at', row_value.paid_at",
    "'refunded_at', row_value.refunded_at",
    "'raw_payload', row_value.raw_payload",
    "'created_at', row_value.created_at",
    "'item_id', row_value.item_id",
    "'merchant_order_no', row_value.merchant_order_no",
    "'provider_trade_no', row_value.provider_trade_no",
    "'notify_received_at', row_value.notify_received_at",
    "'failure_reason', row_value.failure_reason",
    "'order_no', row_value.order_no",
    "'customer_name', row_value.customer_name",
    "'customer_email', row_value.customer_email",
    "'customer_phone', row_value.customer_phone",
    "'total_amount_twd', row_value.total_amount_twd",
    "'payment_method', row_value.payment_method",
    "'payment_status', row_value.payment_status",
    "'order_status', row_value.order_status",
    "'shipping_status', row_value.shipping_status",
    "'payment_id', row_value.payment_id",
    "'bank_transfer_submission_id',",
    'row_value.bank_transfer_submission_id',
    "'note', row_value.note",
    "'updated_at', row_value.updated_at",
  ]
  if (requiredManifestFields.some((token) => !sql.includes(token))) {
    fail('FIXED_FILE_INVALID')
  }
  for (const token of [
    "'id', row_value.id",
    "'user_id', row_value.user_id",
    "'created_at', row_value.created_at",
  ]) {
    if (sql.split(token).length !== 3) fail('FIXED_FILE_INVALID')
  }
  const includeLines = sql
    .split(/\r?\n/u)
    .filter((line) => /^\\i(?:r)?\s/u.test(line.trim()))
  if (
    includeLines.length !== 3 ||
    /(?:^|\n)\s*\\i\s|:[{]?include|base64|\\!|\\copy/iu.test(sql)
  ) {
    fail('FIXED_FILE_INVALID')
  }
  return true
}

export function assertSignalLifecycleSource(source) {
  if (typeof source !== 'string') fail('FIXED_FILE_INVALID')
  const requiredOnce = [
    'let activeChild = null',
    'let credentials = null',
    'let interrupted = false',
    'let cleanupStarted = false',
    'let cleanupCompleted = false',
    'const removeSignalHandlers = installSignalCleanup(() => {',
    'interrupted = true',
    "activeChild?.kill('SIGTERM')",
    'await cleanupCredentialsOnce()',
  ]
  for (const token of requiredOnce) {
    if (source.split(token).length !== 2) fail('FIXED_FILE_INVALID')
  }
  if (
    (source.match(/onSpawn: trackActiveChild/gu) ?? []).length !== 2 ||
    (source.match(/ensureNotInterrupted[(][)]/gu) ?? []).length !== 4
  ) {
    fail('FIXED_FILE_INVALID')
  }

  const handlerIndex = source.indexOf(
    'const removeSignalHandlers = installSignalCleanup(() => {',
  )
  const credentialIndex = source.indexOf(
    'credentials = await createCredentialFile(',
  )
  const credentialGateIndex = source.indexOf(
    'ensureNotInterrupted()',
    credentialIndex,
  )
  const pullIndex = source.indexOf(
    'await pullFixedPostgresImage(spawnImplementation, {',
  )
  const pullGateIndex = source.indexOf('ensureNotInterrupted()', pullIndex)
  const buildIndex = source.indexOf('const dockerRunArgs = buildDockerRunArgs(')
  const spawnGateIndex = source.indexOf('ensureNotInterrupted()', buildIndex)
  const containerIndex = source.indexOf(
    'result = await spawnCaptured(',
    buildIndex,
  )
  const containerGateIndex = source.indexOf(
    'ensureNotInterrupted()',
    containerIndex,
  )
  const finallyIndex = source.indexOf('  } finally {', containerIndex)
  const cleanupIndex = source.indexOf(
    'await cleanupCredentialsOnce()',
    finallyIndex,
  )
  const removeHandlersIndex = source.indexOf(
    'removeSignalHandlers()',
    cleanupIndex,
  )
  if (
    !(
      handlerIndex >= 0 &&
      handlerIndex < credentialIndex &&
      credentialIndex < credentialGateIndex &&
      credentialGateIndex < pullIndex &&
      pullIndex < pullGateIndex &&
      pullGateIndex < buildIndex &&
      buildIndex < spawnGateIndex &&
      spawnGateIndex < containerIndex &&
      containerIndex < containerGateIndex &&
      containerGateIndex < finallyIndex &&
      finallyIndex < cleanupIndex &&
      cleanupIndex < removeHandlersIndex
    )
  ) {
    fail('FIXED_FILE_INVALID')
  }
  return true
}

export function assertDeployAttestationSource(source) {
  if (typeof source !== 'string') fail('FIXED_FILE_INVALID')
  const requiredOnce = [
    'export const DEPLOY_ATTESTATION_MARKERS = Object.freeze({',
    'export const DEPLOYMENT_RECORDING_POLICY =',
    'export function buildDeploySuccessAttestation(',
    'validatedPostflight = parseAndValidateAuditOutput(',
    'return buildDeploySuccessAttestation(evidence, validatedPostflight)',
    'deployEvidence = inspectDeployOutput(result.stdout)',
    "error.attestation = buildDeploymentFailureAttestation(",
    'export function safeFailureOutput(error) {',
    "typeof result === 'string' ? result : JSON.stringify(result)",
  ]
  for (const token of requiredOnce) {
    if (source.split(token).length !== 2) fail('FIXED_FILE_INVALID')
  }
  for (const token of [
    'validatedPostflight.status',
    'line_pay_contract_status: validatedPostflight.status',
    'validatedPostflight.runtime_enabled',
    'supabase_migration_history_table_present:',
    'validatedPostflight.migration_history.line_pay_version_present',
    'migration_started_observed',
    'migration_commit_observed',
    'postflight_started_observed',
    'postflight_state_observed',
    'postflight_commit_observed',
    'cleanup_failure_code',
    'operationError = createDeploymentFailure(',
  ]) {
    if (!source.includes(token)) fail('FIXED_FILE_INVALID')
  }
  if (
    source.split(
      'validatedPostflight.migration_history.line_pay_version_present',
    ).length !== 3
  ) {
    fail('FIXED_FILE_INVALID')
  }
  const inspectIndex = source.indexOf(
    'deployEvidence = inspectDeployOutput(result.stdout)',
  )
  const validationIndex = source.indexOf(
    'completedResult = validateDeployExecutionResult(',
    inspectIndex,
  )
  const cleanupClassificationIndex = source.indexOf(
    'operationError = createDeploymentFailure(',
    validationIndex,
  )
  if (
    !(
      inspectIndex >= 0 &&
      inspectIndex < validationIndex &&
      validationIndex < cleanupClassificationIndex
    ) ||
    source.includes('DEPLOY_SUCCESS_ATTESTATION') ||
    source.includes('DATABASE_CONTRACTS_READY_RUNTIME_DISABLED') ||
    /runtime_enabled:\s*false/u.test(source) ||
    /line_pay_version_present:\s*false/u.test(source) ||
    /console[.](?:log|error)[(](?:result[.](?:stdout|stderr)|evidence[.]auditOutput)/u.test(
      source,
    )
  ) {
    fail('FIXED_FILE_INVALID')
  }
  return true
}

function databaseContract() {
  return {
    name: 'postgres',
    major: 17,
    recovery: false,
  }
}

function lockContract() {
  return {
    product_orders_blocking: 0,
    payments_blocking: 0,
    long_transactions: 0,
    prepared_transactions: 0,
    connection_pressure: false,
    conflicts: 0,
    deadlocks: 0,
  }
}

function preflightLinePayContract() {
  return {
    expected_relations_present: 0,
    private_schema_present: false,
    dedicated_roles_present: 0,
    functions_present: 0,
    triggers_present: 0,
    indexes_present: 0,
    policies_present: 0,
    added_columns_present: 0,
    constraints_present: 0,
  }
}

function postflightLinePayContract() {
  return {
    expected_relations_exact: true,
    private_schema_exact: true,
    dedicated_roles_exact: true,
    functions_exact: true,
    tables_exact: true,
    constraints_exact: true,
    indexes_exact: true,
    triggers_exact: true,
    policies_exact: true,
    grants_exact: true,
    unknown_overloads: 0,
    catalog_fingerprints: {
      roles: {
        count: 2,
        digest:
          '786d1c5ca588b748675bdf743ca951a1e6257d965510e07ce416af73b12e0d52',
      },
      columns: {
        count: 127,
        digest:
          '912bb632ea158c789e9d888be2fc2d4bdfbc916c53ff15a04bf91129e6ad31e3',
      },
      indexes: {
        count: 39,
        digest:
          '1b46355b945fd1b645515cafa42953da7d97a73441ddb607e35712735299ea05',
      },
      schemas: {
        count: 1,
        digest:
          '7f4bc5f9792e18737278e4014cf568d3984d9a2eee712f15c10ce7dd14dfd278',
      },
      policies: {
        count: 14,
        digest:
          '82835fd30a53aa319123d691a0cd46742b9b28da77b5cf44eceebdcb82aed915',
      },
      triggers: {
        count: 11,
        digest:
          '110eb112b655178d1d1f2d0ee1d67ac0966a37efff2ca8cf8c15eb8747f5899e',
      },
      functions: {
        count: 21,
        digest:
          'a63fb3c9d868be844ff836d655d5c96ec77b1b79eda85869d8a6251279f4ee85',
      },
      relations: {
        count: 7,
        digest:
          'd4d62e30c89763b49e6c33c77c4b3d6f38a1921848bdda5144ccaec9cc12407f',
      },
      constraints: {
        count: 115,
        digest:
          '8a78fcbe6ca7e07e8cd9bd560da6fdea601ce09b825948bb9b1d1de33e86bcb6',
      },
      existing_relation_access: {
        count: 2,
        digest:
          '9e8052b3233f19df10341fce5fd6737f926c63105e3a6aa8d30ea97a11e39a8c',
      },
    },
    new_relation_rows: {
      app_environment_attestation: 0,
      line_pay_checkout_attempts: 0,
      line_pay_request_outbox: 0,
      line_pay_callback_capabilities: 0,
      line_pay_callback_events: 0,
      line_pay_payment_audit_events: 0,
      line_pay_completion_proofs: 0,
    },
  }
}

export function buildExpectedAuditFixture(phase) {
  if (!['preflight', 'postflight'].includes(phase)) {
    fail('DATABASE_OUTPUT_INVALID')
  }
  const common = {
    database: databaseContract(),
    fence: clone(FENCE_CONTRACT),
  }
  if (phase === 'preflight') {
    return {
      status: 'READY_EXPECTED',
      ...common,
      migration_history: {
        line_pay_version_present: false,
      },
      historical: {
        bank_transfer: clone(BANK_TRANSFER_HISTORICAL_CONTRACT),
      },
      line_pay: preflightLinePayContract(),
      locks: lockContract(),
    }
  }
  return {
    status: 'DATABASE_CONTRACTS_READY_RUNTIME_DISABLED',
    ...common,
    migration_history: {
      line_pay_version_present: false,
    },
    historical: {
      bank_transfer: clone(BANK_TRANSFER_HISTORICAL_CONTRACT),
      payments: clone(ACTIVE_TABLE_MANIFEST_CONTRACT),
      product_orders: clone(ACTIVE_TABLE_MANIFEST_CONTRACT),
    },
    line_pay: postflightLinePayContract(),
    runtime_enabled: false,
  }
}

function validateAuditResult(result, phase) {
  assertPlainObject(result)
  const allowedFailureStatuses = new Set([
    'ALREADY_APPLIED',
    'BLOCKED_BY_DATABASE_LOCK_RISK',
    'FENCE_REGRESSION',
    'PARTIAL_APPLICATION',
    'PRODUCTION_DATA_DRIFT',
    'SCHEMA_DRIFT',
  ])
  if (allowedFailureStatuses.has(result.status)) fail(result.status)
  const expected = buildExpectedAuditFixture(phase)
  assertExactKeys(result, Object.keys(expected))
  if (!isDeepStrictEqual(result.database, expected.database)) {
    fail('SCHEMA_DRIFT')
  }
  if (!isDeepStrictEqual(result.fence, expected.fence)) {
    fail('FENCE_REGRESSION')
  }
  if (!isDeepStrictEqual(result.historical, expected.historical)) {
    fail('PRODUCTION_DATA_DRIFT')
  }
  if (
    phase === 'preflight' &&
    !isDeepStrictEqual(result.locks, expected.locks)
  ) {
    fail('BLOCKED_BY_DATABASE_LOCK_RISK')
  }
  if (!isDeepStrictEqual(result, expected)) {
    fail(
      phase === 'preflight'
        ? 'SCHEMA_DRIFT'
        : 'POSTFLIGHT_CONTRACT_FAILED',
    )
  }
  return deepFreeze(result)
}

export function parseSingleColumnJson(text) {
  if (typeof text !== 'string') fail('DATABASE_OUTPUT_INVALID')
  const rows = text
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
  if (rows.length !== 1) fail('DATABASE_OUTPUT_INVALID')
  let parsed
  try {
    parsed = JSON.parse(rows[0])
  } catch {
    fail('DATABASE_OUTPUT_INVALID')
  }
  assertPlainObject(parsed)
  return parsed
}

export function parseAndValidateAuditOutput(text, phase) {
  return validateAuditResult(parseSingleColumnJson(text), phase)
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
    fail('SOURCE_VALIDATION_FAILED')
  }
}

export function validateSource(
  environment = process.env,
  root = process.cwd(),
) {
  validateWorkflowContext(environment)
  assertEmergencyWorkflowRetired(root)
  const migration = readAndValidateFixedFile(
    root,
    MIGRATION_FILE,
    EXPECTED_MIGRATION_SHA256,
  )
  const fence = readAndValidateFixedFile(
    root,
    FENCE_MIGRATION_FILE,
    EXPECTED_FENCE_SHA256,
  )
  const preflight = readFixedRegularFile(root, PREFLIGHT_FILE)
  const postflight = readFixedRegularFile(root, POSTFLIGHT_FILE)
  const deploy = readFixedRegularFile(root, DEPLOY_FILE)
  const runner = readFixedRegularFile(root, RUNNER_FILE)
  readFixedRegularFile(root, WORKFLOW_FILE)
  void migration
  void fence
  assertReadOnlyAuditSql(preflight)
  assertReadOnlyAuditSql(postflight)
  assertDeployOrchestrationSql(deploy)
  assertSignalLifecycleSource(runner)
  assertDeployAttestationSource(runner)
  validatePostgresImage(POSTGRES_IMAGE)

  const githubSha = environment.GITHUB_SHA
  if (runGit(['rev-parse', 'HEAD'], root) !== githubSha) {
    fail('SOURCE_CONTEXT_INVALID')
  }
  if (runGit(['status', '--porcelain=v1', '--untracked-files=all'], root)) {
    fail('SOURCE_VALIDATION_FAILED')
  }
  for (const relativePath of [
    MIGRATION_FILE,
    FENCE_MIGRATION_FILE,
    PREFLIGHT_FILE,
    POSTFLIGHT_FILE,
    DEPLOY_FILE,
    RUNNER_FILE,
    WORKFLOW_FILE,
  ]) {
    runGit(['ls-files', '--error-unmatch', relativePath], root)
    runGit(['cat-file', '-e', `${githubSha}:${relativePath}`], root)
  }
  return true
}

export function safeErrorCode(error) {
  return error instanceof Error && SAFE_ERROR_CODES.has(error.message)
    ? error.message
    : 'SOURCE_VALIDATION_FAILED'
}

async function main() {
  if (process.argv.length !== 3) fail('SOURCE_VALIDATION_FAILED')
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
  if (mode === 'channel') {
    validateProductionChannel()
    console.log('PRODUCTION_CHANNEL_VALIDATED')
    return
  }
  fail('SOURCE_VALIDATION_FAILED')
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
