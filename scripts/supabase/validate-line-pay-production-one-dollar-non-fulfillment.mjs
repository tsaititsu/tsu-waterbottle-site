import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  EXPECTED_NODE_VERSION,
  POSTGRES_IMAGE,
  readAndValidateFixedFile,
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
  'DEPLOY_LINE_PAY_PRODUCTION_NT1_NON_FULFILLMENT_EXACT_FILE_ONCE'
export const EXPECTED_BACKUP_CONFIRMATION =
  'CONFIRM_SUPABASE_BACKUP_PITR_RESTORE_POINT_AVAILABLE'
export const EXPECTED_VERIFY_CONFIRMATION =
  'VERIFY_LINE_PAY_PRODUCTION_NT1_NON_FULFILLMENT_READ_ONLY_ONCE'

export const MIGRATION_FILE =
  'supabase/migrations/20260808092959_line_pay_production_one_dollar_non_fulfillment.sql'
export const PREFLIGHT_FILE =
  'supabase/deployment/line_pay_production_one_dollar_non_fulfillment_preflight.sql'
export const POSTFLIGHT_FILE =
  'supabase/deployment/line_pay_production_one_dollar_non_fulfillment_postflight.sql'
export const DEPLOY_FILE =
  'supabase/deployment/line_pay_production_one_dollar_non_fulfillment_deploy.sql'
export const VERIFY_FILE =
  'supabase/deployment/line_pay_production_one_dollar_non_fulfillment_verify.sql'
export const RUNNER_FILE =
  'scripts/supabase/run-line-pay-production-one-dollar-non-fulfillment-exact-file.mjs'
export const WORKFLOW_FILE =
  '.github/workflows/supabase-production-line-pay-one-dollar-non-fulfillment.yml'
export const VERIFY_WORKFLOW_FILE =
  '.github/workflows/supabase-production-line-pay-one-dollar-non-fulfillment-verify.yml'

export const EXPECTED_MIGRATION_SHA256 =
  '037def50000870f5b2d80defa37437271c774b2eece079b8585d34502dae23d0'
export const EXPECTED_PREFLIGHT_SHA256 =
  '5ef17be690e15b2af353f1d096ddfed920a7e31458c98e820fffbd08ef05dc5c'
export const EXPECTED_POSTFLIGHT_SHA256 =
  '0bd1a94f17b4e2a99280af07cf68e20b5be69b5082df5163f1045f67326da63a'
export const EXPECTED_DEPLOY_SHA256 =
  'b735aa6a2b1554ccc4983648ca6ef0a527ed53b84042409bd57d457c2cf9c199'
export const EXPECTED_VERIFY_SHA256 =
  'c3b4882f9a51407aff302ff620f5ab66fd97039939a9ea514a635a0fd7ead45f'
export const EXPECTED_WORKFLOW_SHA256 =
  '5a2857e8871a98fa3ce6afae509ab58ffea47e8e22c74fc7866fe4471ac451bf'
export const EXPECTED_VERIFY_WORKFLOW_SHA256 =
  'f3fca380c8b2ad206e8979d3a6619e1a6443745ba8d7a23e4a8f35b323f54a66'

const repositoryRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/u
const SAFE_ERROR_CODES = new Set([
  'LINE_PAY_NT1_NON_FULFILLMENT_SOURCE_INVALID',
  'LINE_PAY_NT1_NON_FULFILLMENT_FIXED_FILE_INVALID',
  'LINE_PAY_NT1_NON_FULFILLMENT_PREFLIGHT_OUTPUT_INVALID',
  'LINE_PAY_NT1_NON_FULFILLMENT_POSTFLIGHT_OUTPUT_INVALID',
  'INVALID_NODE_VERSION',
  'POSTGRES_IMAGE_MISMATCH',
  'PRODUCTION_CHANNEL_NOT_READY',
])

function fail(code) {
  throw new Error(code)
}

export function validateWorkflowContext(environment = process.env) {
  const commit = environment.GITHUB_SHA ?? ''
  if (
    environment.GITHUB_REPOSITORY !== EXPECTED_REPOSITORY
    || environment.GITHUB_EVENT_NAME !== EXPECTED_EVENT
    || environment.GITHUB_REF !== EXPECTED_REF
    || !FULL_SHA_PATTERN.test(commit)
    || environment.AUTHORIZED_COMMIT !== commit
    || environment.PROJECT_REF_INPUT !== EXPECTED_PROJECT_REF
    || environment.MIGRATION_SHA256_INPUT !== EXPECTED_MIGRATION_SHA256
    || environment.DEPLOY_CONFIRMATION !== EXPECTED_CONFIRMATION
    || environment.BACKUP_RESTORE_POINT_CONFIRMATION
      !== EXPECTED_BACKUP_CONFIRMATION
  ) {
    fail('LINE_PAY_NT1_NON_FULFILLMENT_SOURCE_INVALID')
  }
  return true
}

export function validateVerificationWorkflowContext(
  environment = process.env,
) {
  const commit = environment.GITHUB_SHA ?? ''
  if (
    environment.GITHUB_REPOSITORY !== EXPECTED_REPOSITORY
    || environment.GITHUB_EVENT_NAME !== EXPECTED_EVENT
    || environment.GITHUB_REF !== EXPECTED_REF
    || !FULL_SHA_PATTERN.test(commit)
    || environment.AUTHORIZED_COMMIT !== commit
    || environment.PROJECT_REF_INPUT !== EXPECTED_PROJECT_REF
    || environment.VERIFY_CONFIRMATION !== EXPECTED_VERIFY_CONFIRMATION
  ) {
    fail('LINE_PAY_NT1_NON_FULFILLMENT_SOURCE_INVALID')
  }
  return true
}

function assertSourceContract(source) {
  if (
    !source.migration.includes('\nbegin;')
    || !/\ncommit;\s*$/iu.test(source.migration)
    || !source.migration.includes(
      'public.initialize_line_pay_production_nt1_non_fulfillment_checkout',
    )
    || !source.migration.includes('security invoker')
    || !source.migration.includes('security definer')
    || !source.migration.includes(
      'owner to line_pay_payment_function_owner',
    )
    || !source.migration.includes(
      'line_pay_private.line_pay_production_one_dollar_non_fulfillment_orders',
    )
    || !source.migration.includes(
      'line_pay_00_production_one_dollar_order_guard',
    )
    || !source.migration.includes(
      'line_pay_production_one_dollar_item_guard',
    )
    || !source.migration.includes(
      'line_pay_production_one_dollar_shipping_guard',
    )
    || !source.migration.includes('to service_role')
    || !source.preflight.includes(
      'line_pay_production_one_dollar_non_fulfillment_preflight_ready',
    )
    || !source.postflight.includes(
      'line_pay_production_one_dollar_non_fulfillment_postflight_ready',
    )
    || source.deploy.match(
      /20260808092959_line_pay_production_one_dollar_non_fulfillment[.]sql/gu,
    )?.length !== 1
    || !source.deploy.includes('LINE_PAY_DEPLOY_MIGRATION_STARTED')
    || !source.deploy.includes('LINE_PAY_DEPLOY_MIGRATION_COMMITTED')
    || !source.deploy.includes('LINE_PAY_DEPLOY_POSTFLIGHT_STARTED')
    || !source.deploy.includes('LINE_PAY_DEPLOY_POSTFLIGHT_STATE_EMITTED')
    || !source.deploy.includes('LINE_PAY_DEPLOY_POSTFLIGHT_COMMITTED')
    || !/^BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;/mu.test(
      source.verify,
    )
    || !/^ROLLBACK;$/mu.test(source.verify)
    || /\b(?:insert|update|delete|alter|create|drop|grant|revoke|truncate)\b/iu.test(
      source.verify,
    )
    || !/^on:\n  workflow_dispatch:\n/mu.test(source.workflow)
    || /\n  (?:push|pull_request):/u.test(source.workflow)
    || !source.workflow.includes('name: supabase-production')
    || !source.workflow.includes(`${RUNNER_FILE} preflight`)
    || !source.workflow.includes(`${RUNNER_FILE} deploy`)
    || !/^on:\n  workflow_dispatch:\n/mu.test(source.verifyWorkflow)
    || /\n  (?:push|pull_request):/u.test(source.verifyWorkflow)
    || !source.verifyWorkflow.includes('name: supabase-production')
    || !source.verifyWorkflow.includes(`${RUNNER_FILE} verify`)
  ) {
    fail('LINE_PAY_NT1_NON_FULFILLMENT_FIXED_FILE_INVALID')
  }
}

export function validateSource(root = repositoryRoot) {
  const source = {
    migration: readAndValidateFixedFile(root, MIGRATION_FILE, EXPECTED_MIGRATION_SHA256),
    preflight: readAndValidateFixedFile(root, PREFLIGHT_FILE, EXPECTED_PREFLIGHT_SHA256),
    postflight: readAndValidateFixedFile(root, POSTFLIGHT_FILE, EXPECTED_POSTFLIGHT_SHA256),
    deploy: readAndValidateFixedFile(root, DEPLOY_FILE, EXPECTED_DEPLOY_SHA256),
    verify: readAndValidateFixedFile(root, VERIFY_FILE, EXPECTED_VERIFY_SHA256),
    workflow: readAndValidateFixedFile(root, WORKFLOW_FILE, EXPECTED_WORKFLOW_SHA256),
    verifyWorkflow: readAndValidateFixedFile(
      root,
      VERIFY_WORKFLOW_FILE,
      EXPECTED_VERIFY_WORKFLOW_SHA256,
    ),
  }
  assertSourceContract(source)
  return true
}

function outputLines(text) {
  return typeof text === 'string'
    ? text.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean)
    : []
}

export function parsePreflightOutput(text) {
  if (
    outputLines(text).join('\n')
    !== 'line_pay_production_one_dollar_non_fulfillment_preflight_ready'
  ) {
    fail('LINE_PAY_NT1_NON_FULFILLMENT_PREFLIGHT_OUTPUT_INVALID')
  }
  return Object.freeze({ status: 'preflight_ready' })
}

export function parseDeployOutput(text) {
  if (
    outputLines(text).join('\n') !== [
      'line_pay_production_one_dollar_non_fulfillment_preflight_ready',
      'line_pay_production_one_dollar_non_fulfillment_postflight_ready',
    ].join('\n')
  ) {
    fail('LINE_PAY_NT1_NON_FULFILLMENT_POSTFLIGHT_OUTPUT_INVALID')
  }
  return Object.freeze({ status: 'postflight_ready' })
}

export function parseVerificationOutput(text) {
  if (
    outputLines(text).join('\n')
    !== 'line_pay_production_one_dollar_non_fulfillment_postflight_ready'
  ) {
    fail('LINE_PAY_NT1_NON_FULFILLMENT_POSTFLIGHT_OUTPUT_INVALID')
  }
  return Object.freeze({ status: 'postflight_ready' })
}

export function safeErrorCode(error) {
  return error instanceof Error && SAFE_ERROR_CODES.has(error.message)
    ? error.message
    : 'LINE_PAY_NT1_NON_FULFILLMENT_SOURCE_INVALID'
}

async function main() {
  const command = process.argv[2]
  if (process.argv.length !== 3) fail('LINE_PAY_NT1_NON_FULFILLMENT_SOURCE_INVALID')
  if (command === 'node') {
    validateNodeVersion()
    console.log('LINE_PAY_NT1_NON_FULFILLMENT_NODE_VALIDATED')
    return
  }
  if (command === 'image') {
    validatePostgresImage(process.env.POSTGRES_IMAGE)
    console.log('LINE_PAY_NT1_NON_FULFILLMENT_IMAGE_VALIDATED')
    return
  }
  if (command === 'source') {
    validateWorkflowContext()
    validateSource()
    console.log('LINE_PAY_NT1_NON_FULFILLMENT_SOURCE_VALIDATED')
    return
  }
  if (command === 'verify-source') {
    validateVerificationWorkflowContext()
    validateSource()
    console.log('LINE_PAY_NT1_NON_FULFILLMENT_VERIFY_SOURCE_VALIDATED')
    return
  }
  if (command === 'channel') {
    validateProductionChannel()
    console.log('LINE_PAY_NT1_NON_FULFILLMENT_CHANNEL_VALIDATED')
    return
  }
  fail('LINE_PAY_NT1_NON_FULFILLMENT_SOURCE_INVALID')
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
