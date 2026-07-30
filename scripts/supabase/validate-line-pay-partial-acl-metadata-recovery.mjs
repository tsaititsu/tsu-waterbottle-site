import { execFileSync } from 'node:child_process'
import { lstatSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  POSTGRES_IMAGE,
  readAndValidateFixedFile,
  stripSqlForStaticAnalysis,
  validateNodeVersion,
  validatePostgresImage,
  validateProductionChannel,
} from './validate-line-pay-production-deployment.mjs'
import { parseAndValidateDiagnosticOutput } from './validate-line-pay-application-state-diagnostic.mjs'

export { POSTGRES_IMAGE, validateNodeVersion, validatePostgresImage, validateProductionChannel }

export const EXPECTED_REPOSITORY = 'tsaititsu/tsu-waterbottle-site'
export const EXPECTED_PROJECT_REF = 'ndbqoznvobmpkgxkiezz'
export const EXPECTED_EVENT = 'workflow_dispatch'
export const EXPECTED_REF = 'refs/heads/main'
export const EXPECTED_CONFIRMATION =
  'DEPLOY_LINE_PAY_PARTIAL_ACL_METADATA_RECOVERY_EXACT_FILE_ONCE'

export const RECOVERY_MIGRATION_FILE =
  'supabase/migrations/20260729130000_line_pay_partial_acl_metadata_recovery.sql'
export const BASE_MIGRATION_FILE =
  'supabase/migrations/20260719033404_line_pay_remediation_contracts.sql'
export const FENCE_MIGRATION_FILE =
  'supabase/migrations/20260722065311_retire_bank_transfer_submissions_writes.sql'
export const DIAGNOSTIC_FILE =
  'supabase/deployment/line_pay_application_state_diagnostic.sql'
export const PREFLIGHT_FILE =
  'supabase/deployment/line_pay_partial_acl_metadata_recovery_preflight.sql'
export const DEPLOY_FILE =
  'supabase/deployment/line_pay_partial_acl_metadata_recovery_deploy.sql'
export const RUNNER_FILE =
  'scripts/supabase/run-line-pay-partial-acl-metadata-recovery.mjs'
export const VALIDATOR_FILE =
  'scripts/supabase/validate-line-pay-partial-acl-metadata-recovery.mjs'
export const WORKFLOW_FILE =
  '.github/workflows/supabase-production-line-pay-partial-acl-recovery.yml'

export const EXPECTED_RECOVERY_MIGRATION_SHA256 =
  '7f429dd8674aa5835f4f934e183ffa39d31bd4d4884cdbba199734390c21bc83'
export const EXPECTED_BASE_MIGRATION_SHA256 =
  '8da1fb429aecb1c35b12a245b63907135dbe7c467ef0a5f069afd431d21e94b8'
export const EXPECTED_FENCE_MIGRATION_SHA256 =
  '2f43979b1f4ff88243296f0a389c146b879652715d40d23bdb7ce1d6785407d7'
export const EXPECTED_DIAGNOSTIC_SHA256 =
  '6f0442e832d7137fa9f3ba6e8f8edd12a39c1242bbd1c824346dd9ac56e599fc'
export const EXPECTED_PREFLIGHT_SHA256 =
  '5950af1a9e08ac21f31e93a4d9a372fa902eba36890caa7c6064b3acf08abefd'
export const EXPECTED_DEPLOY_SHA256 =
  'ed22f8a8d56931de716123ba0ed1d9182a7023e83416665119f86f56d442925b'

const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/u
const SHA256_PATTERN = /^[0-9a-f]{64}$/u
const SAFE_FAILURE_CODES = new Set([
  'APPLICATION_STATE_DIAGNOSTIC_OUTPUT_INVALID',
  'INVALID_NODE_VERSION',
  'LINE_PAY_PARTIAL_RECOVERY_DEPLOY_SQL_INVALID',
  'LINE_PAY_PARTIAL_RECOVERY_POSTFLIGHT_NOT_FULL',
  'LINE_PAY_PARTIAL_RECOVERY_PREFLIGHT_STATE_INVALID',
  'LINE_PAY_PARTIAL_RECOVERY_SOURCE_INVALID',
  'LINE_PAY_PARTIAL_RECOVERY_SQL_INVALID',
  'POSTGRES_IMAGE_MISMATCH',
  'PRODUCTION_CHANNEL_NOT_READY',
  'SOURCE_CONTEXT_INVALID',
])
const FORBIDDEN_SQL_PATTERN =
  /\b(drop\s+schema|drop\s+table|delete\s+from|truncate\s+table|insert\s+into\s+supabase_migrations[.]schema_migrations|update\s+supabase_migrations[.]schema_migrations|supabase\s+db\s+push|migration\s+up)\b/iu

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function fail(code) {
  throw new Error(code)
}

function validateFullSha(value) {
  if (typeof value !== 'string' || !FULL_SHA_PATTERN.test(value)) {
    fail('SOURCE_CONTEXT_INVALID')
  }
  return value
}

function validateRecoveryHash(value) {
  if (
    typeof value !== 'string' ||
    !SHA256_PATTERN.test(value) ||
    value !== EXPECTED_RECOVERY_MIGRATION_SHA256
  ) {
    fail('LINE_PAY_PARTIAL_RECOVERY_SOURCE_INVALID')
  }
  return true
}

function validateProjectRef(value) {
  if (value !== EXPECTED_PROJECT_REF) {
    fail('SOURCE_CONTEXT_INVALID')
  }
  return true
}

function validateConfirmation(value) {
  if (value !== EXPECTED_CONFIRMATION) {
    fail('LINE_PAY_PARTIAL_RECOVERY_SOURCE_INVALID')
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
  validateRecoveryHash(environment.RECOVERY_SHA256_INPUT)
  validateConfirmation(environment.DEPLOY_CONFIRMATION)
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
    fail('LINE_PAY_PARTIAL_RECOVERY_SOURCE_INVALID')
  }
}

function readFixedRegularFile(root, relativePath) {
  if (
    typeof root !== 'string' ||
    typeof relativePath !== 'string' ||
    !relativePath ||
    isAbsolute(relativePath)
  ) {
    fail('LINE_PAY_PARTIAL_RECOVERY_SOURCE_INVALID')
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
    fail('LINE_PAY_PARTIAL_RECOVERY_SOURCE_INVALID')
  }
  let stat
  try {
    stat = lstatSync(filePath)
    if (!stat.isFile() || stat.isSymbolicLink()) {
      fail('LINE_PAY_PARTIAL_RECOVERY_SOURCE_INVALID')
    }
    return readFileSync(filePath, 'utf8')
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'LINE_PAY_PARTIAL_RECOVERY_SOURCE_INVALID'
    ) {
      throw error
    }
    fail('LINE_PAY_PARTIAL_RECOVERY_SOURCE_INVALID')
  }
}

export function assertRecoverySql(sql) {
  const stripped = stripSqlForStaticAnalysis(sql)
  if (
    FORBIDDEN_SQL_PATTERN.test(stripped) ||
    !/lock table[\s\S]*public[.]payments[\s\S]*public[.]product_orders[\s\S]*in access exclusive mode/iu.test(
      stripped,
    ) ||
    !/revoke all on schema line_pay_private[\s\S]*from public, anon, authenticated, service_role, line_pay_payment_executor/iu.test(
      stripped,
    ) ||
    !/grant select, insert, update on table[\s\S]*public[.]payments[\s\S]*public[.]product_orders[\s\S]*to service_role/iu.test(
      stripped,
    ) ||
    !/grant select on table[\s\S]*public[.]payments[\s\S]*public[.]product_orders[\s\S]*public[.]line_pay_checkout_attempts[\s\S]*to line_pay_payment_function_owner/iu.test(
      stripped,
    ) ||
    /\bset\s+role\b/iu.test(stripped) ||
    /grant line_pay_payment_function_owner to current_user[\s\S]*with inherit true, set true/iu.test(
      stripped,
    ) ||
    !/grant line_pay_payment_function_owner to current_user[\s\S]*with inherit true, set false/iu.test(
      stripped,
    ) ||
    !/revoke line_pay_payment_function_owner from current_user/iu.test(
      stripped,
    ) ||
    !/line_pay_partial_recovery_role_bridge_cleanup_postcondition_failed/u.test(
      sql,
    ) ||
    !/line_pay_partial_recovery_public_write_postcondition_failed/u.test(
      sql,
    ) ||
    !/line_pay_partial_recovery_service_role_postcondition_failed/u.test(
      sql,
    ) ||
    !/line_pay_partial_recovery_executor_postcondition_failed/u.test(sql)
  ) {
    fail('LINE_PAY_PARTIAL_RECOVERY_SQL_INVALID')
  }
  return true
}

export function assertRecoveryDeploymentSql(preflight, deploy) {
  if (
    !/\\ir line_pay_application_state_diagnostic[.]sql/u.test(preflight) ||
    /\\ir \.\.\/migrations\//u.test(preflight) ||
    !/\\echo LINE_PAY_DEPLOY_MIGRATION_STARTED/u.test(deploy) ||
    !/\\ir \.\.\/migrations\/20260729130000_line_pay_partial_acl_metadata_recovery[.]sql/u.test(
      deploy,
    ) ||
    !/\\echo LINE_PAY_DEPLOY_MIGRATION_COMMITTED/u.test(deploy) ||
    !/\\echo LINE_PAY_DEPLOY_POSTFLIGHT_STARTED/u.test(deploy) ||
    !/\\ir line_pay_application_state_diagnostic[.]sql/u.test(deploy) ||
    !/\\echo LINE_PAY_DEPLOY_POSTFLIGHT_STATE_EMITTED/u.test(deploy) ||
    !/\\echo LINE_PAY_DEPLOY_POSTFLIGHT_COMMITTED/u.test(deploy)
  ) {
    fail('LINE_PAY_PARTIAL_RECOVERY_DEPLOY_SQL_INVALID')
  }
  return true
}

function assertTargetedPartialState(result) {
  if (result.application_state !== 'PARTIAL') {
    fail('LINE_PAY_PARTIAL_RECOVERY_PREFLIGHT_STATE_INVALID')
  }
  const categories = result.details.incomplete_categories.map(
    (detail) => detail.category,
  )
  if (
    categories.length === 0 ||
    categories.some(
      (category) =>
        category !== 'relations' &&
        category !== 'existing_relation_access',
    )
  ) {
    fail('LINE_PAY_PARTIAL_RECOVERY_PREFLIGHT_STATE_INVALID')
  }
  return true
}

export function parseAndValidateRecoveryPreflightOutput(text) {
  const result = parseAndValidateDiagnosticOutput(text)
  assertTargetedPartialState(result)
  return result
}

export function parseAndValidateRecoveryDeployOutput(text) {
  const result = parseAndValidateDiagnosticOutput(text)
  if (
    result.application_state !== 'FULL_WITHOUT_HISTORY' ||
    result.migration_history.version_present !== false ||
    result.details.incomplete_categories.length !== 0 ||
    result.details.relation_metadata.length !== 0 ||
    result.details.existing_relation_access.length !== 0
  ) {
    fail('LINE_PAY_PARTIAL_RECOVERY_POSTFLIGHT_NOT_FULL')
  }
  return result
}

export function validateSource(
  environment = process.env,
  root = process.cwd(),
) {
  validateWorkflowContext(environment)
  readAndValidateFixedFile(
    root,
    RECOVERY_MIGRATION_FILE,
    EXPECTED_RECOVERY_MIGRATION_SHA256,
  )
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
  readAndValidateFixedFile(
    root,
    DIAGNOSTIC_FILE,
    EXPECTED_DIAGNOSTIC_SHA256,
  )
  readAndValidateFixedFile(root, PREFLIGHT_FILE, EXPECTED_PREFLIGHT_SHA256)
  readAndValidateFixedFile(root, DEPLOY_FILE, EXPECTED_DEPLOY_SHA256)
  const recovery = readFixedRegularFile(root, RECOVERY_MIGRATION_FILE)
  const preflight = readFixedRegularFile(root, PREFLIGHT_FILE)
  const deploy = readFixedRegularFile(root, DEPLOY_FILE)
  readFixedRegularFile(root, RUNNER_FILE)
  readFixedRegularFile(root, WORKFLOW_FILE)
  assertRecoverySql(recovery)
  assertRecoveryDeploymentSql(preflight, deploy)
  validatePostgresImage(POSTGRES_IMAGE)

  const githubSha = environment.GITHUB_SHA
  if (runGit(['rev-parse', 'HEAD'], root) !== githubSha) {
    fail('SOURCE_CONTEXT_INVALID')
  }
  if (runGit(['status', '--porcelain=v1', '--untracked-files=all'], root)) {
    fail('LINE_PAY_PARTIAL_RECOVERY_SOURCE_INVALID')
  }
  for (const relativePath of [
    RECOVERY_MIGRATION_FILE,
    BASE_MIGRATION_FILE,
    FENCE_MIGRATION_FILE,
    DIAGNOSTIC_FILE,
    PREFLIGHT_FILE,
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
  return error instanceof Error && SAFE_FAILURE_CODES.has(error.message)
    ? error.message
    : 'LINE_PAY_PARTIAL_RECOVERY_SOURCE_INVALID'
}

async function main() {
  if (process.argv.length !== 3) fail('LINE_PAY_PARTIAL_RECOVERY_SOURCE_INVALID')
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
  fail('LINE_PAY_PARTIAL_RECOVERY_SOURCE_INVALID')
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
