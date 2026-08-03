import { execFileSync } from 'node:child_process'
import { lstatSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  EXPECTED_NODE_VERSION,
  POSTGRES_IMAGE,
  parseSingleColumnJson,
  readAndValidateFixedFile,
  stripSqlForStaticAnalysis,
  validateNodeVersion,
  validatePostgresImage,
  validateProductionChannel,
} from './validate-line-pay-production-deployment.mjs'

export {
  EXPECTED_NODE_VERSION,
  POSTGRES_IMAGE,
  validateNodeVersion,
  validatePostgresImage,
  validateProductionChannel,
}

export const EXPECTED_REPOSITORY = 'tsaititsu/tsu-waterbottle-site'
export const EXPECTED_PROJECT_REF = 'ndbqoznvobmpkgxkiezz'
export const EXPECTED_EVENT = 'workflow_dispatch'
export const EXPECTED_REF = 'refs/heads/main'
export const EXPECTED_CONFIRMATION =
  'DEPLOY_LINE_PAY_ATOMIC_CONFIRMATION_FINALIZATION_EXACT_FILE_ONCE'
export const EXPECTED_BACKUP_CONFIRMATION =
  'CONFIRM_SUPABASE_BACKUP_PITR_RESTORE_POINT_AVAILABLE'

export const MIGRATION_FILE =
  'supabase/migrations/20260802160000_line_pay_atomic_confirmation_finalization.sql'
export const DIAGNOSTIC_FILE =
  'supabase/deployment/line_pay_atomic_confirmation_finalization_application_state.sql'
export const PREFLIGHT_FILE =
  'supabase/deployment/line_pay_atomic_confirmation_finalization_preflight.sql'
export const POSTFLIGHT_FILE =
  'supabase/deployment/line_pay_atomic_confirmation_finalization_postflight.sql'
export const DEPLOY_FILE =
  'supabase/deployment/line_pay_atomic_confirmation_finalization_deploy.sql'
export const RUNNER_FILE =
  'scripts/supabase/run-line-pay-atomic-confirmation-finalization-exact-file.mjs'
export const VALIDATOR_FILE =
  'scripts/supabase/validate-line-pay-atomic-confirmation-finalization-production.mjs'
export const WORKFLOW_FILE =
  '.github/workflows/supabase-production-line-pay-atomic-confirmation-finalization.yml'

export const EXPECTED_MIGRATION_SHA256 =
  '2991bff6e13d76d843f98b2e019bb6c6ff5a1d7471c667dd4de528f95aa12b4f'
export const EXPECTED_DIAGNOSTIC_SHA256 =
  'a9769eb9cd5a78ece4a9a957169f6a25f00e4209ed998f5fd275efd1b6e39e56'
export const EXPECTED_PREFLIGHT_SHA256 =
  '87f2d3398c1e98b588d415ea73a9f66fd195b9bf1b861bf10db8c92a07d0bfee'
export const EXPECTED_POSTFLIGHT_SHA256 =
  '87f2d3398c1e98b588d415ea73a9f66fd195b9bf1b861bf10db8c92a07d0bfee'
export const EXPECTED_DEPLOY_SHA256 =
  '2577c57c0978387b6b4c2d6fece06487501975fedcfff7d4b25202547b8d6510'

const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/u
const FORBIDDEN_SQL_PATTERN =
  /\b(drop\s+(?:schema|table|function)|delete\s+from|truncate\s+table|insert\s+into\s+supabase_migrations[.]schema_migrations|update\s+supabase_migrations[.]schema_migrations|supabase\s+db\s+push|migration\s+up|apply-all)\b/iu
const SAFE_FAILURE_CODES = new Set([
  'ATOMIC_FINALIZATION_ALREADY_APPLIED',
  'ATOMIC_FINALIZATION_APPLICATION_STATE_INVALID',
  'ATOMIC_FINALIZATION_DATA_DRIFT',
  'ATOMIC_FINALIZATION_DEPLOY_SQL_INVALID',
  'ATOMIC_FINALIZATION_PARTIAL_APPLICATION',
  'ATOMIC_FINALIZATION_POSTFLIGHT_NOT_FULL',
  'ATOMIC_FINALIZATION_PREFLIGHT_NOT_UNAPPLIED',
  'ATOMIC_FINALIZATION_SOURCE_INVALID',
  'INVALID_NODE_VERSION',
  'POSTGRES_IMAGE_MISMATCH',
  'PRODUCTION_CHANNEL_NOT_READY',
  'SOURCE_CONTEXT_INVALID',
])
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function fail(code) {
  throw new Error(code)
}

function freeze(value) {
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object') freeze(nested)
  }
  return Object.freeze(value)
}

function exactKeys(value, expected) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length === expected.length &&
      expected.every((key) => Object.hasOwn(value, key)),
  )
}

function isIntegerInRange(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum
}

function validateFullSha(value) {
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
  if (validateFullSha(environment.AUTHORIZED_COMMIT) !== githubSha) {
    fail('SOURCE_CONTEXT_INVALID')
  }
  if (
    environment.PROJECT_REF_INPUT !== EXPECTED_PROJECT_REF ||
    environment.MIGRATION_SHA256_INPUT !== EXPECTED_MIGRATION_SHA256 ||
    environment.BACKUP_RESTORE_POINT_CONFIRMATION !==
      EXPECTED_BACKUP_CONFIRMATION ||
    environment.DEPLOY_CONFIRMATION !== EXPECTED_CONFIRMATION
  ) {
    fail('SOURCE_CONTEXT_INVALID')
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
    fail('ATOMIC_FINALIZATION_SOURCE_INVALID')
  }
}

function readFixedRegularFile(root, relativePath) {
  if (
    typeof root !== 'string' ||
    typeof relativePath !== 'string' ||
    !relativePath ||
    isAbsolute(relativePath)
  ) {
    fail('ATOMIC_FINALIZATION_SOURCE_INVALID')
  }
  const resolvedRoot = resolve(root)
  const filePath = resolve(resolvedRoot, relativePath)
  const pathFromRoot = relative(resolvedRoot, filePath)
  if (
    !pathFromRoot ||
    pathFromRoot === '..' ||
    pathFromRoot.startsWith(`..${sep}`) ||
    isAbsolute(pathFromRoot)
  ) {
    fail('ATOMIC_FINALIZATION_SOURCE_INVALID')
  }
  try {
    const stat = lstatSync(filePath)
    if (!stat.isFile() || stat.isSymbolicLink()) {
      fail('ATOMIC_FINALIZATION_SOURCE_INVALID')
    }
    return readFileSync(filePath, 'utf8')
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'ATOMIC_FINALIZATION_SOURCE_INVALID'
    ) {
      throw error
    }
    fail('ATOMIC_FINALIZATION_SOURCE_INVALID')
  }
}

export function buildExpectedAtomicFixture(applicationState) {
  if (!['UNAPPLIED', 'PARTIAL', 'FULL'].includes(applicationState)) {
    fail('ATOMIC_FINALIZATION_APPLICATION_STATE_INVALID')
  }
  const full = applicationState === 'FULL'
  const partial = applicationState === 'PARTIAL'
  return {
    status: 'ATOMIC_FINALIZATION_STATE_DIAGNOSTIC_COMPLETED',
    database_identity_match: true,
    inventory: {
      dependency_functions_present: 5,
      required_roles_present: 3,
      private_schema_owner_matches: 1,
      wrapper_functions_present: full || partial ? 1 : 0,
      wrapper_contract_matches: full ? 1 : 0,
      restricted_core_functions: full ? 2 : 0,
      authenticator_executor_memberships: full ? 1 : 0,
      unexpected_dedicated_role_memberships: 0,
      temporary_owner_memberships: 0,
      safe_dedicated_roles: 2,
      executor_owned_relations: 0,
      executor_relation_acl_entries: 0,
      executor_executable_owner_functions: full ? 1 : 0,
    },
    contracts: {
      base_ready: true,
      wrapper_acl_exact: full,
      validator_acl_ready: true,
      executor_privilege_exact: true,
      atomic_exact: full,
    },
    application_state: applicationState,
  }
}

export function parseAndValidateAtomicOutput(text) {
  let value
  try {
    value = parseSingleColumnJson(text)
  } catch {
    fail('ATOMIC_FINALIZATION_APPLICATION_STATE_INVALID')
  }
  if (
    !exactKeys(value, [
      'status',
      'database_identity_match',
      'inventory',
      'contracts',
      'application_state',
    ]) ||
    value.status !== 'ATOMIC_FINALIZATION_STATE_DIAGNOSTIC_COMPLETED' ||
    value.database_identity_match !== true ||
    !['UNAPPLIED', 'PARTIAL', 'FULL'].includes(value.application_state) ||
    !exactKeys(value.inventory, [
      'dependency_functions_present',
      'required_roles_present',
      'private_schema_owner_matches',
      'wrapper_functions_present',
      'wrapper_contract_matches',
      'restricted_core_functions',
      'authenticator_executor_memberships',
      'unexpected_dedicated_role_memberships',
      'temporary_owner_memberships',
      'safe_dedicated_roles',
      'executor_owned_relations',
      'executor_relation_acl_entries',
      'executor_executable_owner_functions',
    ]) ||
    !exactKeys(value.contracts, [
      'base_ready',
      'wrapper_acl_exact',
      'validator_acl_ready',
      'executor_privilege_exact',
      'atomic_exact',
    ]) ||
    !isIntegerInRange(value.inventory.dependency_functions_present, 0, 5) ||
    !isIntegerInRange(value.inventory.required_roles_present, 0, 3) ||
    !isIntegerInRange(value.inventory.private_schema_owner_matches, 0, 1) ||
    !isIntegerInRange(value.inventory.wrapper_functions_present, 0, 32) ||
    !isIntegerInRange(value.inventory.wrapper_contract_matches, 0, 1) ||
    !isIntegerInRange(value.inventory.restricted_core_functions, 0, 2) ||
    !isIntegerInRange(
      value.inventory.authenticator_executor_memberships,
      0,
      32,
    ) ||
    !isIntegerInRange(
      value.inventory.unexpected_dedicated_role_memberships,
      0,
      32,
    ) ||
    !isIntegerInRange(value.inventory.temporary_owner_memberships, 0, 32) ||
    !isIntegerInRange(value.inventory.safe_dedicated_roles, 0, 2) ||
    !isIntegerInRange(value.inventory.executor_owned_relations, 0, 32) ||
    !isIntegerInRange(value.inventory.executor_relation_acl_entries, 0, 32) ||
    !isIntegerInRange(
      value.inventory.executor_executable_owner_functions,
      0,
      32,
    ) ||
    Object.values(value.contracts).some((entry) => typeof entry !== 'boolean')
  ) {
    fail('ATOMIC_FINALIZATION_APPLICATION_STATE_INVALID')
  }
  return freeze(value)
}

function assertUnapplied(result) {
  if (
    result.application_state !== 'UNAPPLIED' ||
    result.inventory.dependency_functions_present !== 5 ||
    result.inventory.required_roles_present !== 3 ||
    result.inventory.private_schema_owner_matches !== 1 ||
    result.inventory.wrapper_functions_present !== 0 ||
    result.inventory.authenticator_executor_memberships !== 0 ||
    result.inventory.unexpected_dedicated_role_memberships !== 0 ||
    result.inventory.temporary_owner_memberships !== 0 ||
    result.inventory.safe_dedicated_roles !== 2 ||
    result.inventory.executor_owned_relations !== 0 ||
    result.inventory.executor_relation_acl_entries !== 0 ||
    result.contracts.base_ready !== true ||
    result.contracts.validator_acl_ready !== true ||
    result.contracts.executor_privilege_exact !== true ||
    result.contracts.atomic_exact !== false
  ) {
    fail(
      result.application_state === 'FULL'
        ? 'ATOMIC_FINALIZATION_ALREADY_APPLIED'
        : result.application_state === 'PARTIAL'
          ? 'ATOMIC_FINALIZATION_PARTIAL_APPLICATION'
          : 'ATOMIC_FINALIZATION_PREFLIGHT_NOT_UNAPPLIED',
    )
  }
  return result
}

function assertFull(result) {
  if (
    result.application_state !== 'FULL' ||
    result.inventory.dependency_functions_present !== 5 ||
    result.inventory.required_roles_present !== 3 ||
    result.inventory.private_schema_owner_matches !== 1 ||
    result.inventory.wrapper_functions_present !== 1 ||
    result.inventory.wrapper_contract_matches !== 1 ||
    result.inventory.restricted_core_functions !== 2 ||
    result.inventory.authenticator_executor_memberships !== 1 ||
    result.inventory.unexpected_dedicated_role_memberships !== 0 ||
    result.inventory.temporary_owner_memberships !== 0 ||
    result.inventory.safe_dedicated_roles !== 2 ||
    result.inventory.executor_owned_relations !== 0 ||
    result.inventory.executor_relation_acl_entries !== 0 ||
    result.inventory.executor_executable_owner_functions !== 1 ||
    Object.values(result.contracts).some((entry) => entry !== true)
  ) {
    fail('ATOMIC_FINALIZATION_POSTFLIGHT_NOT_FULL')
  }
  return result
}

export function parseAndValidateAtomicPreflightOutput(text) {
  return assertUnapplied(parseAndValidateAtomicOutput(text))
}

export function parseAndValidateAtomicPostflightOutput(text) {
  return assertFull(parseAndValidateAtomicOutput(text))
}

export function parseAndValidateAtomicDeployOutput(text) {
  if (typeof text !== 'string') {
    fail('ATOMIC_FINALIZATION_APPLICATION_STATE_INVALID')
  }
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length !== 2) {
    fail('ATOMIC_FINALIZATION_APPLICATION_STATE_INVALID')
  }
  assertUnapplied(parseAndValidateAtomicOutput(`${lines[0]}\n`))
  return assertFull(parseAndValidateAtomicOutput(`${lines[1]}\n`))
}

export function assertDeploymentSql(preflight, postflight, deploy) {
  const stripped = stripSqlForStaticAnalysis(`${preflight}\n${postflight}\n${deploy}`)
  if (
    FORBIDDEN_SQL_PATTERN.test(stripped) ||
    !/\\ir line_pay_atomic_confirmation_finalization_application_state[.]sql/u.test(
      preflight,
    ) ||
    !/\\ir line_pay_atomic_confirmation_finalization_application_state[.]sql/u.test(
      postflight,
    ) ||
    /\\ir \.\.\/migrations\//u.test(preflight) ||
    /\\ir \.\.\/migrations\//u.test(postflight) ||
    (deploy.match(/\\ir \.\.\/migrations\//gu) ?? []).length !== 1 ||
    !/\\ir \.\.\/migrations\/20260802160000_line_pay_atomic_confirmation_finalization[.]sql/u.test(
      deploy,
    ) ||
    !/lock table[\s\S]*public[.]product_orders[\s\S]*public[.]payments[\s\S]*public[.]line_pay_checkout_attempts[\s\S]*public[.]line_pay_callback_events[\s\S]*line_pay_private[.]line_pay_completion_proofs[\s\S]*in access exclusive mode/iu.test(
      deploy,
    ) ||
    !/baseline_atomic_data_fingerprint/u.test(deploy) ||
    !/line_pay_atomic_data_preserved/u.test(deploy) ||
    !/\\echo LINE_PAY_DEPLOY_MIGRATION_STARTED/u.test(deploy) ||
    !/\\echo LINE_PAY_DEPLOY_MIGRATION_COMMITTED/u.test(deploy) ||
    !/\\echo LINE_PAY_DEPLOY_POSTFLIGHT_STARTED/u.test(deploy) ||
    !/\\echo LINE_PAY_DEPLOY_POSTFLIGHT_STATE_EMITTED/u.test(deploy) ||
    !/\\echo LINE_PAY_DEPLOY_POSTFLIGHT_COMMITTED/u.test(deploy)
  ) {
    fail('ATOMIC_FINALIZATION_DEPLOY_SQL_INVALID')
  }
  return true
}

export function validateSource(environment = process.env, root = process.cwd()) {
  validateWorkflowContext(environment)
  for (const [file, sha256] of [
    [MIGRATION_FILE, EXPECTED_MIGRATION_SHA256],
    [DIAGNOSTIC_FILE, EXPECTED_DIAGNOSTIC_SHA256],
    [PREFLIGHT_FILE, EXPECTED_PREFLIGHT_SHA256],
    [POSTFLIGHT_FILE, EXPECTED_POSTFLIGHT_SHA256],
    [DEPLOY_FILE, EXPECTED_DEPLOY_SHA256],
  ]) {
    readAndValidateFixedFile(root, file, sha256)
  }
  const migration = readFixedRegularFile(root, MIGRATION_FILE)
  const diagnostic = readFixedRegularFile(root, DIAGNOSTIC_FILE)
  const preflight = readFixedRegularFile(root, PREFLIGHT_FILE)
  const postflight = readFixedRegularFile(root, POSTFLIGHT_FILE)
  const deploy = readFixedRegularFile(root, DEPLOY_FILE)
  readFixedRegularFile(root, RUNNER_FILE)
  readFixedRegularFile(root, VALIDATOR_FILE)
  readFixedRegularFile(root, WORKFLOW_FILE)
  if (
    !/create function public[.]finalize_product_order_line_pay_confirmation/iu.test(
      migration,
    ) ||
    !/grant execute on function public[.]finalize_product_order_line_pay_confirmation[\s\S]*to line_pay_payment_executor/iu.test(
      migration,
    ) ||
    !/grant line_pay_payment_executor to authenticator[\s\S]*inherit false, set true/iu.test(
      migration,
    ) ||
    /\b(drop|delete|truncate)\b/iu.test(
      stripSqlForStaticAnalysis(migration),
    ) ||
    !/ATOMIC_FINALIZATION_STATE_DIAGNOSTIC_COMPLETED/u.test(diagnostic)
  ) {
    fail('ATOMIC_FINALIZATION_SOURCE_INVALID')
  }
  assertDeploymentSql(preflight, postflight, deploy)
  validatePostgresImage(POSTGRES_IMAGE)

  const githubSha = environment.GITHUB_SHA
  if (runGit(['rev-parse', 'HEAD'], root) !== githubSha) {
    fail('SOURCE_CONTEXT_INVALID')
  }
  if (runGit(['status', '--porcelain=v1', '--untracked-files=all'], root)) {
    fail('ATOMIC_FINALIZATION_SOURCE_INVALID')
  }
  for (const relativePath of [
    MIGRATION_FILE,
    DIAGNOSTIC_FILE,
    PREFLIGHT_FILE,
    POSTFLIGHT_FILE,
    DEPLOY_FILE,
    RUNNER_FILE,
    VALIDATOR_FILE,
    WORKFLOW_FILE,
  ]) {
    runGit(['ls-files', '--error-unmatch', relativePath], root)
    runGit(['cat-file', '-e', `${githubSha}:${relativePath}`], root)
  }
  return true
}

export function safeErrorCode(error) {
  return error instanceof Error && SAFE_FAILURE_CODES.has(error.message)
    ? error.message
    : 'ATOMIC_FINALIZATION_SOURCE_INVALID'
}

async function main() {
  if (process.argv.length !== 3) fail('ATOMIC_FINALIZATION_SOURCE_INVALID')
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
  fail('ATOMIC_FINALIZATION_SOURCE_INVALID')
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
