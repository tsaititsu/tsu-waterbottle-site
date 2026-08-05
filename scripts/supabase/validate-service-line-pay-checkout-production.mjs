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
  'DEPLOY_SERVICE_LINE_PAY_CHECKOUT_EXACT_FILE_ONCE'
export const EXPECTED_BACKUP_CONFIRMATION =
  'CONFIRM_SUPABASE_BACKUP_PITR_RESTORE_POINT_AVAILABLE'

export const MIGRATION_FILE =
  'supabase/migrations/20260805025344_initialize_service_line_pay_checkout.sql'
export const PREFLIGHT_FILE =
  'supabase/deployment/service_line_pay_checkout_initialization_preflight.sql'
export const POSTFLIGHT_FILE =
  'supabase/deployment/service_line_pay_checkout_initialization_postflight.sql'
export const DEPLOY_FILE =
  'supabase/deployment/service_line_pay_checkout_initialization_deploy.sql'
export const RUNNER_FILE =
  'scripts/supabase/run-service-line-pay-checkout-exact-file.mjs'
export const WORKFLOW_FILE =
  '.github/workflows/supabase-production-service-line-pay-checkout.yml'

export const EXPECTED_MIGRATION_SHA256 =
  'ff952bde87970fd1f0542bc49a2351925ca0a9e774fec5700bca0dd73a8c5c1c'
export const EXPECTED_PREFLIGHT_SHA256 =
  'fb5b02aebff1d4a80672b46389d0a684fa69869945f75ac8f97b4945ab4e4ca0'
export const EXPECTED_POSTFLIGHT_SHA256 =
  'a4f46ac93c2245aaa85f73fea608190776a6ca6157fb89648cc0f3fb50d00ca1'
export const EXPECTED_DEPLOY_SHA256 =
  '5368f6a0b8a08374929a6d9feaa87be0097f03dc2c0235ec365b3e0f8e75c0ed'
export const EXPECTED_WORKFLOW_SHA256 =
  '18430041ba694d88ed5e2f86581bfa814f8a4293072e51db48798aa1f57b2ab0'

const repositoryRoot = resolve(
  fileURLToPath(new URL('../..', import.meta.url)),
)
const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/u
const SAFE_ERROR_CODES = new Set([
  'SERVICE_CHECKOUT_SOURCE_INVALID',
  'SERVICE_CHECKOUT_FIXED_FILE_INVALID',
  'SERVICE_CHECKOUT_PREFLIGHT_OUTPUT_INVALID',
  'SERVICE_CHECKOUT_POSTFLIGHT_OUTPUT_INVALID',
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
    fail('SERVICE_CHECKOUT_SOURCE_INVALID')
  }
  return true
}

function assertSourceContract(source) {
  if (
    !source.migration.includes('\nbegin;')
    || !/\ncommit;\s*$/iu.test(source.migration)
    || !source.migration.includes(
      'public.initialize_service_line_pay_checkout',
    )
    || !source.migration.includes(
      'line_pay_private.record_service_line_pay_checkout_initialized_audit',
    )
    || !source.preflight.includes(
      'line_pay_service_checkout_preflight_ready',
    )
    || !source.postflight.includes(
      'line_pay_service_checkout_postflight_ready',
    )
    || source.deploy.match(
      /20260805025344_initialize_service_line_pay_checkout[.]sql/gu,
    )?.length !== 1
    || !source.deploy.includes('LINE_PAY_DEPLOY_MIGRATION_STARTED')
    || !source.deploy.includes('LINE_PAY_DEPLOY_MIGRATION_COMMITTED')
    || !source.deploy.includes('LINE_PAY_DEPLOY_POSTFLIGHT_STARTED')
    || !source.deploy.includes('LINE_PAY_DEPLOY_POSTFLIGHT_STATE_EMITTED')
    || !source.deploy.includes('LINE_PAY_DEPLOY_POSTFLIGHT_COMMITTED')
    || !/^on:\n  workflow_dispatch:\n/mu.test(source.workflow)
    || /\n  (?:push|pull_request):/u.test(source.workflow)
    || !source.workflow.includes('name: supabase-production')
    || !source.workflow.includes(`${RUNNER_FILE} preflight`)
    || !source.workflow.includes(`${RUNNER_FILE} deploy`)
  ) {
    fail('SERVICE_CHECKOUT_FIXED_FILE_INVALID')
  }
}

export function validateSource(root = repositoryRoot) {
  const migration = readAndValidateFixedFile(
    root,
    MIGRATION_FILE,
    EXPECTED_MIGRATION_SHA256,
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
  const workflow = readAndValidateFixedFile(
    root,
    WORKFLOW_FILE,
    EXPECTED_WORKFLOW_SHA256,
  )
  assertSourceContract({ migration, preflight, postflight, deploy, workflow })
  return true
}

function normalizedOutputLines(text) {
  if (typeof text !== 'string') return []
  return text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
}

export function parsePreflightOutput(text) {
  const lines = normalizedOutputLines(text)
  if (
    lines.length !== 1
    || lines[0] !== 'line_pay_service_checkout_preflight_ready'
  ) {
    fail('SERVICE_CHECKOUT_PREFLIGHT_OUTPUT_INVALID')
  }
  return Object.freeze({ status: 'preflight_ready' })
}

export function parseDeployOutput(text) {
  const lines = normalizedOutputLines(text)
  if (
    lines.length !== 2
    || lines[0] !== 'line_pay_service_checkout_preflight_ready'
    || lines[1] !== 'line_pay_service_checkout_postflight_ready'
  ) {
    fail('SERVICE_CHECKOUT_POSTFLIGHT_OUTPUT_INVALID')
  }
  return Object.freeze({ status: 'postflight_ready' })
}

export function safeErrorCode(error) {
  return error instanceof Error && SAFE_ERROR_CODES.has(error.message)
    ? error.message
    : 'SERVICE_CHECKOUT_SOURCE_INVALID'
}

async function main() {
  const command = process.argv[2]
  if (process.argv.length !== 3) fail('SERVICE_CHECKOUT_SOURCE_INVALID')

  if (command === 'node') {
    validateNodeVersion()
    console.log('SERVICE_CHECKOUT_NODE_VALIDATED')
    return
  }
  if (command === 'image') {
    validatePostgresImage(process.env.POSTGRES_IMAGE)
    console.log('SERVICE_CHECKOUT_IMAGE_VALIDATED')
    return
  }
  if (command === 'source') {
    validateWorkflowContext()
    validateSource()
    console.log('SERVICE_CHECKOUT_SOURCE_VALIDATED')
    return
  }
  if (command === 'channel') {
    validateProductionChannel()
    console.log('SERVICE_CHECKOUT_CHANNEL_VALIDATED')
    return
  }
  fail('SERVICE_CHECKOUT_SOURCE_INVALID')
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
