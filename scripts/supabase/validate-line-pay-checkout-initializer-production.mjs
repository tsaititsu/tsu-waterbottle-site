import { lstatSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

import {
  EXPECTED_NODE_VERSION,
  POSTGRES_IMAGE,
  readAndValidateFixedFile,
  stripSqlForStaticAnalysis,
  validateNodeVersion,
  validatePostgresImage,
  validateProductionChannel,
} from './validate-line-pay-production-deployment.mjs'

export { EXPECTED_NODE_VERSION, POSTGRES_IMAGE, validateProductionChannel }

export const EXPECTED_REPOSITORY = 'tsaititsu/tsu-waterbottle-site'
export const EXPECTED_PROJECT_REF = 'ndbqoznvobmpkgxkiezz'
export const EXPECTED_EVENT = 'workflow_dispatch'
export const EXPECTED_REF = 'refs/heads/main'
export const EXPECTED_CONFIRMATION =
  'DEPLOY_LINE_PAY_CHECKOUT_INITIALIZER_EXACT_FILE_ONCE'
export const EXPECTED_DIAGNOSTIC_CONFIRMATION =
  'RUN_LINE_PAY_CHECKOUT_INITIALIZER_STATE_DIAGNOSTIC_READ_ONLY_ONCE'
export const EXPECTED_BACKUP_CONFIRMATION =
  'CONFIRM_SUPABASE_BACKUP_PITR_RESTORE_POINT_AVAILABLE'

export const MIGRATION_FILE =
  'supabase/migrations/20260728053215_line_pay_checkout_aggregate_initialization.sql'
export const BASE_MIGRATION_FILE =
  'supabase/migrations/20260719033404_line_pay_remediation_contracts.sql'
export const FENCE_MIGRATION_FILE =
  'supabase/migrations/20260722065311_retire_bank_transfer_submissions_writes.sql'
export const DIAGNOSTIC_FILE =
  'supabase/deployment/line_pay_checkout_aggregate_initialization_application_state.sql'
export const PREFLIGHT_FILE =
  'supabase/deployment/line_pay_checkout_aggregate_initialization_preflight.sql'
export const POSTFLIGHT_FILE =
  'supabase/deployment/line_pay_checkout_aggregate_initialization_postflight.sql'
export const DEPLOY_FILE =
  'supabase/deployment/line_pay_checkout_aggregate_initialization_deploy.sql'
export const RUNNER_FILE =
  'scripts/supabase/run-line-pay-checkout-initializer-exact-file.mjs'
export const DIAGNOSTIC_RUNNER_FILE =
  'scripts/supabase/run-line-pay-checkout-initializer-application-state.mjs'
export const WORKFLOW_FILE =
  '.github/workflows/supabase-production-line-pay-checkout-initializer.yml'
export const DIAGNOSTIC_WORKFLOW_FILE =
  '.github/workflows/supabase-production-line-pay-checkout-initializer-diagnostic.yml'

export const EXPECTED_MIGRATION_SHA256 =
  '2e2ef2cce41431e0dc638033c998b7b616cbdc2b3baefdcb59fbb68ba2adf551'
export const EXPECTED_BASE_MIGRATION_SHA256 =
  '8da1fb429aecb1c35b12a245b63907135dbe7c467ef0a5f069afd431d21e94b8'
export const EXPECTED_FENCE_MIGRATION_SHA256 =
  '2f43979b1f4ff88243296f0a389c146b879652715d40d23bdb7ce1d6785407d7'
export const EXPECTED_DIAGNOSTIC_SHA256 =
  '7347578a9b0a73d22e3876a10a77b88a409b9db5cf263b1a01345060ff83181a'
export const EXPECTED_PREFLIGHT_SHA256 =
  '4263e46ba20cf5731da0e1920b302e75cc1a1334d798da9d1c1eb0777fd65e7a'
export const EXPECTED_POSTFLIGHT_SHA256 =
  '4eada29677a0111325e8cf9b78873b56b6dd84597db8d3307c348768d26b6a99'
export const EXPECTED_DEPLOY_SHA256 =
  'fba00782d644315d18235323b300ee218c5adbd34ac9d73815e9be2ab72a9227'

export const APPLICATION_STATES = Object.freeze([
  'UNAPPLIED',
  'PARTIAL',
  'FULL',
])

const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/u
const SAFE_FAILURE_CODES = new Set([
  'SOURCE_CONTEXT_INVALID',
  'INITIALIZER_SOURCE_INVALID',
  'INITIALIZER_DIAGNOSTIC_OUTPUT_INVALID',
  'INITIALIZER_DATABASE_IDENTITY_MISMATCH',
  'INITIALIZER_BASE_CONTRACT_MISSING',
  'INITIALIZER_ALREADY_PRESENT',
  'INITIALIZER_PARTIAL_APPLICATION',
  'INITIALIZER_DATA_DRIFT',
  'INITIALIZER_POSTFLIGHT_CONTRACT_FAILED',
  'INVALID_NODE_VERSION',
  'POSTGRES_IMAGE_MISMATCH',
  'PRODUCTION_CHANNEL_NOT_READY',
])
const OUTPUT_KEYS = Object.freeze([
  'status',
  'database_identity_match',
  'inventory',
  'contracts',
  'checkout_initialized_audit_count',
  'application_state',
])
const INVENTORY_KEYS = Object.freeze([
  'functions_present',
  'indexes_present',
  'policies_present',
  'table_select_grants_present',
])
const CONTRACT_KEYS = Object.freeze([
  'base_remediation_ready',
  'initializer_exact',
])
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function fail(code) {
  throw new Error(code)
}

function deepFreeze(value) {
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object') deepFreeze(nested)
  }
  return Object.freeze(value)
}

function assertPlainObject(value) {
  if (
    value === null ||
    Array.isArray(value) ||
    typeof value !== 'object' ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail('INITIALIZER_DIAGNOSTIC_OUTPUT_INVALID')
  }
}

function assertExactKeys(value, keys) {
  assertPlainObject(value)
  if (!isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort())) {
    fail('INITIALIZER_DIAGNOSTIC_OUTPUT_INVALID')
  }
}

function assertCount(value, maximum = 1000000) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    fail('INITIALIZER_DIAGNOSTIC_OUTPUT_INVALID')
  }
}

function readFixedRegularFile(root, relativePath) {
  if (
    typeof root !== 'string' ||
    typeof relativePath !== 'string' ||
    !relativePath ||
    isAbsolute(relativePath)
  ) {
    fail('INITIALIZER_SOURCE_INVALID')
  }
  const fixedRoot = resolve(root)
  const path = resolve(fixedRoot, relativePath)
  const fromRoot = relative(fixedRoot, path)
  if (
    !fromRoot ||
    fromRoot === '..' ||
    fromRoot.startsWith(`..${sep}`) ||
    isAbsolute(fromRoot)
  ) {
    fail('INITIALIZER_SOURCE_INVALID')
  }
  try {
    const stat = lstatSync(path)
    if (!stat.isFile() || stat.isSymbolicLink()) {
      fail('INITIALIZER_SOURCE_INVALID')
    }
    return readFileSync(path, 'utf8')
  } catch (error) {
    if (error instanceof Error && SAFE_FAILURE_CODES.has(error.message)) {
      throw error
    }
    fail('INITIALIZER_SOURCE_INVALID')
  }
}

function assertReadOnlyDiagnosticSql(sql) {
  const stripped = stripSqlForStaticAnalysis(sql)
  if (
    /\b(?:insert|update|delete|merge|truncate|create|alter|drop|grant|revoke|copy|vacuum|analyze|refresh|reindex|cluster|call)\b/iu.test(
      stripped,
    ) ||
    /\bpg_(?:advisory|terminate|cancel|reload|rotate|switch|promote)/iu.test(
      stripped,
    )
  ) {
    fail('INITIALIZER_SOURCE_INVALID')
  }
  for (const token of [
    'LINE_PAY_CHECKOUT_INITIALIZER_APPLICATION_STATE',
    'initialize_product_order_line_pay_checkout',
    'record_line_pay_checkout_initialized_audit',
    'checkout_initialized',
    'application_state',
  ]) {
    if (!sql.includes(token)) fail('INITIALIZER_SOURCE_INVALID')
  }
}

function assertFixedDeploySql(sql) {
  for (const token of [
    '\\ir line_pay_checkout_aggregate_initialization_preflight.sql',
    '\\ir ../migrations/20260728053215_line_pay_checkout_aggregate_initialization.sql',
    '\\ir line_pay_checkout_aggregate_initialization_postflight.sql',
    'LINE_PAY_DEPLOY_MIGRATION_STARTED',
    'LINE_PAY_DEPLOY_MIGRATION_COMMITTED',
    'LINE_PAY_DEPLOY_POSTFLIGHT_STARTED',
    'LINE_PAY_DEPLOY_POSTFLIGHT_STATE_EMITTED',
    'LINE_PAY_DEPLOY_POSTFLIGHT_COMMITTED',
    'in access exclusive mode',
  ]) {
    if (!sql.includes(token)) fail('INITIALIZER_SOURCE_INVALID')
  }
  if (
    /\\ir\s+(?!line_pay_checkout_aggregate_initialization_(?:preflight|postflight)[.]sql|[.][.]\/migrations\/20260728053215_line_pay_checkout_aggregate_initialization[.]sql)/u.test(
      sql,
    ) ||
    /\b(?:retry|fallback|supabase\s+(?:db|migration)|runtime_enabled\s*[,=]\s*true)\b/iu.test(
      sql,
    )
  ) {
    fail('INITIALIZER_SOURCE_INVALID')
  }
}

export function validateFullSha(value) {
  if (typeof value !== 'string' || !FULL_SHA_PATTERN.test(value)) {
    fail('SOURCE_CONTEXT_INVALID')
  }
  return value
}

function validateBaseWorkflowContext(environment) {
  validateNodeVersion()
  if (
    environment.GITHUB_REPOSITORY !== EXPECTED_REPOSITORY ||
    environment.GITHUB_EVENT_NAME !== EXPECTED_EVENT ||
    environment.GITHUB_REF !== EXPECTED_REF ||
    environment.PROJECT_REF_INPUT !== EXPECTED_PROJECT_REF
  ) {
    fail('SOURCE_CONTEXT_INVALID')
  }
  const githubSha = validateFullSha(environment.GITHUB_SHA)
  const authorizedCommit = validateFullSha(environment.AUTHORIZED_COMMIT)
  if (githubSha !== authorizedCommit) fail('SOURCE_CONTEXT_INVALID')
}

export function validateDeploymentWorkflowContext(
  environment = process.env,
) {
  validateBaseWorkflowContext(environment)
  if (
    environment.MIGRATION_SHA256_INPUT !== EXPECTED_MIGRATION_SHA256 ||
    environment.BACKUP_RESTORE_POINT_CONFIRMATION
      !== EXPECTED_BACKUP_CONFIRMATION ||
    environment.DEPLOY_CONFIRMATION !== EXPECTED_CONFIRMATION
  ) {
    fail('SOURCE_CONTEXT_INVALID')
  }
  return true
}

export function validateDiagnosticWorkflowContext(
  environment = process.env,
) {
  validateBaseWorkflowContext(environment)
  if (
    environment.DIAGNOSTIC_CONFIRMATION
      !== EXPECTED_DIAGNOSTIC_CONFIRMATION
  ) {
    fail('SOURCE_CONTEXT_INVALID')
  }
  return true
}

export function buildExpectedInitializerFixture(state) {
  if (!APPLICATION_STATES.includes(state)) {
    fail('INITIALIZER_DIAGNOSTIC_OUTPUT_INVALID')
  }
  const full = state === 'FULL'
  return {
    status: 'LINE_PAY_CHECKOUT_INITIALIZER_APPLICATION_STATE',
    database_identity_match: true,
    inventory: {
      functions_present: full ? 2 : state === 'PARTIAL' ? 1 : 0,
      indexes_present: full ? 1 : 0,
      policies_present: full ? 3 : 0,
      table_select_grants_present: full ? 2 : 0,
    },
    contracts: {
      base_remediation_ready: true,
      initializer_exact: full,
    },
    checkout_initialized_audit_count: 0,
    application_state: state,
  }
}

function parseSingleJsonLine(text) {
  if (
    typeof text !== 'string' ||
    Buffer.byteLength(text, 'utf8') > 4096
  ) {
    fail('INITIALIZER_DIAGNOSTIC_OUTPUT_INVALID')
  }
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length !== 1) fail('INITIALIZER_DIAGNOSTIC_OUTPUT_INVALID')
  try {
    return JSON.parse(lines[0])
  } catch {
    fail('INITIALIZER_DIAGNOSTIC_OUTPUT_INVALID')
  }
}

export function parseAndValidateInitializerOutput(text) {
  const value = parseSingleJsonLine(text)
  assertExactKeys(value, OUTPUT_KEYS)
  assertExactKeys(value.inventory, INVENTORY_KEYS)
  assertExactKeys(value.contracts, CONTRACT_KEYS)
  if (
    value.status !== 'LINE_PAY_CHECKOUT_INITIALIZER_APPLICATION_STATE' ||
    typeof value.database_identity_match !== 'boolean' ||
    typeof value.contracts.base_remediation_ready !== 'boolean' ||
    typeof value.contracts.initializer_exact !== 'boolean' ||
    !APPLICATION_STATES.includes(value.application_state)
  ) {
    fail('INITIALIZER_DIAGNOSTIC_OUTPUT_INVALID')
  }
  for (const count of Object.values(value.inventory)) assertCount(count, 100)
  assertCount(value.checkout_initialized_audit_count)
  if (!value.database_identity_match) {
    fail('INITIALIZER_DATABASE_IDENTITY_MISMATCH')
  }

  const inventoryEmpty = Object.values(value.inventory).every(
    (count) => count === 0,
  )
  const inventoryFull =
    value.inventory.functions_present === 2 &&
    value.inventory.indexes_present === 1 &&
    value.inventory.policies_present === 3 &&
    value.inventory.table_select_grants_present === 2
  const expectedState =
    inventoryEmpty && !value.contracts.initializer_exact
      ? 'UNAPPLIED'
      : inventoryFull && value.contracts.initializer_exact
        ? 'FULL'
        : 'PARTIAL'
  if (value.application_state !== expectedState) {
    fail('INITIALIZER_DIAGNOSTIC_OUTPUT_INVALID')
  }
  return deepFreeze(value)
}

export function parseAndValidateInitializerPreflightOutput(text) {
  const value = parseAndValidateInitializerOutput(text)
  if (!value.contracts.base_remediation_ready) {
    fail('INITIALIZER_BASE_CONTRACT_MISSING')
  }
  if (value.checkout_initialized_audit_count !== 0) {
    fail('INITIALIZER_DATA_DRIFT')
  }
  if (value.application_state === 'FULL') {
    fail('INITIALIZER_ALREADY_PRESENT')
  }
  if (value.application_state === 'PARTIAL') {
    fail('INITIALIZER_PARTIAL_APPLICATION')
  }
  return value
}

export function parseAndValidateInitializerPostflightOutput(text) {
  const value = parseAndValidateInitializerOutput(text)
  if (
    !value.contracts.base_remediation_ready ||
    !value.contracts.initializer_exact ||
    value.application_state !== 'FULL'
  ) {
    fail('INITIALIZER_POSTFLIGHT_CONTRACT_FAILED')
  }
  return value
}

export function parseAndValidateInitializerDeployOutput(text) {
  if (
    typeof text !== 'string' ||
    Buffer.byteLength(text, 'utf8') > 1024 * 1024
  ) {
    fail('INITIALIZER_DIAGNOSTIC_OUTPUT_INVALID')
  }
  const diagnosticLines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) =>
      line.startsWith(
        '{"application_state":',
      ) ||
      line.includes(
        '"status": "LINE_PAY_CHECKOUT_INITIALIZER_APPLICATION_STATE"',
      ) ||
      line.includes(
        '"status":"LINE_PAY_CHECKOUT_INITIALIZER_APPLICATION_STATE"',
      ),
    )
  if (diagnosticLines.length !== 2) {
    fail('INITIALIZER_DIAGNOSTIC_OUTPUT_INVALID')
  }
  parseAndValidateInitializerPreflightOutput(`${diagnosticLines[0]}\n`)
  return parseAndValidateInitializerPostflightOutput(
    `${diagnosticLines[1]}\n`,
  )
}

export function validateSource(root = repositoryRoot) {
  readAndValidateFixedFile(root, MIGRATION_FILE, EXPECTED_MIGRATION_SHA256)
  readAndValidateFixedFile(
    root,
    BASE_MIGRATION_FILE,
    EXPECTED_BASE_MIGRATION_SHA256,
  )
  readAndValidateFixedFile(
    root,
    FENCE_MIGRATION_FILE,
    EXPECTED_FENCE_MIGRATION_SHA256,
  )
  const diagnostic = readAndValidateFixedFile(
    root,
    DIAGNOSTIC_FILE,
    EXPECTED_DIAGNOSTIC_SHA256,
  )
  const preflight = readAndValidateFixedFile(
    root,
    PREFLIGHT_FILE,
    EXPECTED_PREFLIGHT_SHA256,
  )
  const postflight = readAndValidateFixedFile(
    root,
    POSTFLIGHT_FILE,
    EXPECTED_POSTFLIGHT_SHA256,
  )
  const deploy = readAndValidateFixedFile(
    root,
    DEPLOY_FILE,
    EXPECTED_DEPLOY_SHA256,
  )
  assertReadOnlyDiagnosticSql(diagnostic)
  if (!preflight.includes('\\ir line_pay_checkout_aggregate_initialization_application_state.sql')) {
    fail('INITIALIZER_SOURCE_INVALID')
  }
  if (!postflight.includes('\\ir line_pay_checkout_aggregate_initialization_application_state.sql')) {
    fail('INITIALIZER_SOURCE_INVALID')
  }
  assertFixedDeploySql(deploy)
  for (const path of [
    RUNNER_FILE,
    DIAGNOSTIC_RUNNER_FILE,
    WORKFLOW_FILE,
    DIAGNOSTIC_WORKFLOW_FILE,
  ]) {
    readFixedRegularFile(root, path)
  }
  return true
}

export function safeErrorCode(error) {
  return error instanceof Error && SAFE_FAILURE_CODES.has(error.message)
    ? error.message
    : 'INITIALIZER_SOURCE_INVALID'
}

async function main() {
  if (process.argv.length !== 3) fail('SOURCE_CONTEXT_INVALID')
  const mode = process.argv[2]
  if (mode === 'node') {
    validateNodeVersion()
  } else if (mode === 'image') {
    validatePostgresImage(process.env.POSTGRES_IMAGE)
  } else if (mode === 'source') {
    validateDeploymentWorkflowContext()
    validateSource()
  } else if (mode === 'diagnostic-source') {
    validateDiagnosticWorkflowContext()
    validateSource()
  } else if (mode === 'channel') {
    validateProductionChannel()
  } else {
    fail('SOURCE_CONTEXT_INVALID')
  }
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
