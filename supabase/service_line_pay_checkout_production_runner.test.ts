import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')
const validatorPath = pathToFileURL(join(
  root,
  'scripts/supabase/validate-service-line-pay-checkout-production.mjs',
)).href
const runnerPath = pathToFileURL(join(
  root,
  'scripts/supabase/run-service-line-pay-checkout-exact-file.mjs',
)).href

async function loadDeploymentModules() {
  const [validator, runner] = await Promise.all([
    import(validatorPath),
    import(runnerPath),
  ])
  return { validator, runner }
}

test('service checkout deployment identity is fixed to one main Migration', async () => {
  const { validator } = await loadDeploymentModules()
  const {
    EXPECTED_CONFIRMATION,
    EXPECTED_MIGRATION_SHA256,
    EXPECTED_PROJECT_REF,
    MIGRATION_FILE,
  } = validator
  assert.equal(EXPECTED_PROJECT_REF, 'ndbqoznvobmpkgxkiezz')
  assert.equal(
    MIGRATION_FILE,
    'supabase/migrations/20260805025344_initialize_service_line_pay_checkout.sql',
  )
  assert.equal(
    EXPECTED_MIGRATION_SHA256,
    'ff952bde87970fd1f0542bc49a2351925ca0a9e774fec5700bca0dd73a8c5c1c',
  )
  assert.equal(
    EXPECTED_CONFIRMATION,
    'DEPLOY_SERVICE_LINE_PAY_CHECKOUT_EXACT_FILE_ONCE',
  )
})

test('workflow context requires the exact authorized main commit', async () => {
  const { validator } = await loadDeploymentModules()
  const {
    EXPECTED_BACKUP_CONFIRMATION,
    EXPECTED_CONFIRMATION,
    EXPECTED_MIGRATION_SHA256,
    EXPECTED_PROJECT_REF,
    validateWorkflowContext,
  } = validator
  const commit = 'a'.repeat(40)
  assert.doesNotThrow(() => validateWorkflowContext({
    GITHUB_REPOSITORY: 'tsaititsu/tsu-waterbottle-site',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_REF: 'refs/heads/main',
    GITHUB_SHA: commit,
    AUTHORIZED_COMMIT: commit,
    PROJECT_REF_INPUT: EXPECTED_PROJECT_REF,
    MIGRATION_SHA256_INPUT: EXPECTED_MIGRATION_SHA256,
    DEPLOY_CONFIRMATION: EXPECTED_CONFIRMATION,
    BACKUP_RESTORE_POINT_CONFIRMATION: EXPECTED_BACKUP_CONFIRMATION,
  }))
  assert.throws(() => validateWorkflowContext({
    GITHUB_REPOSITORY: 'tsaititsu/tsu-waterbottle-site',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_REF: 'refs/heads/main',
    GITHUB_SHA: commit,
    AUTHORIZED_COMMIT: 'b'.repeat(40),
    PROJECT_REF_INPUT: EXPECTED_PROJECT_REF,
    MIGRATION_SHA256_INPUT: EXPECTED_MIGRATION_SHA256,
    DEPLOY_CONFIRMATION: EXPECTED_CONFIRMATION,
    BACKUP_RESTORE_POINT_CONFIRMATION: EXPECTED_BACKUP_CONFIRMATION,
  }))
})

test('runner separates fixed deployment phases from read-only verification', async () => {
  const { validator, runner } = await loadDeploymentModules()
  const {
    DEPLOY_FILE,
    MIGRATION_FILE,
    POSTFLIGHT_FILE,
    PREFLIGHT_FILE,
    VERIFY_FILE,
  } = validator
  const {
    SERVICE_CHECKOUT_DATABASE_CONTRACT,
    SERVICE_CHECKOUT_VERIFICATION_CONTRACT,
  } = runner
  assert.deepEqual(SERVICE_CHECKOUT_DATABASE_CONTRACT.phaseFiles, {
    preflight: PREFLIGHT_FILE,
    deploy: DEPLOY_FILE,
  })
  assert.deepEqual(
    SERVICE_CHECKOUT_DATABASE_CONTRACT.fixedFiles.map(
      (file: { path: string }) => file.path,
    ),
    [MIGRATION_FILE, PREFLIGHT_FILE, POSTFLIGHT_FILE, DEPLOY_FILE],
  )
  assert.deepEqual(SERVICE_CHECKOUT_VERIFICATION_CONTRACT.phaseFiles, {
    preflight: VERIFY_FILE,
  })
  assert.deepEqual(
    SERVICE_CHECKOUT_VERIFICATION_CONTRACT.fixedFiles.map(
      (file: { path: string }) => file.path,
    ),
    [POSTFLIGHT_FILE, VERIFY_FILE],
  )
})

test('fixed files and bounded output parsers fail closed', async () => {
  const { validator } = await loadDeploymentModules()
  const {
    parseDeployOutput,
    parsePreflightOutput,
    parseVerificationOutput,
    validateSource,
  } = validator
  assert.equal(validateSource(root), true)
  assert.deepEqual(
    parsePreflightOutput('line_pay_service_checkout_preflight_ready\n'),
    { status: 'preflight_ready' },
  )
  assert.deepEqual(
    parseDeployOutput(
      'line_pay_service_checkout_preflight_ready\nline_pay_service_checkout_postflight_ready\n',
    ),
    { status: 'postflight_ready' },
  )
  assert.deepEqual(
    parseVerificationOutput('line_pay_service_checkout_postflight_ready\n'),
    { status: 'postflight_ready' },
  )
  assert.throws(() => parsePreflightOutput('unexpected'))
  assert.throws(() => parseDeployOutput(
    'line_pay_service_checkout_postflight_ready\nline_pay_service_checkout_preflight_ready',
  ))
  assert.throws(() => parseDeployOutput(
    'line_pay_service_checkout_preflight_ready\nline_pay_service_checkout_postflight_ready\nsecret=value',
  ))
  assert.throws(() => parseVerificationOutput(
    'line_pay_service_checkout_postflight_ready\nunexpected',
  ))
})

test('SQL channel is read-only before one exact Migration and exact postflight', async () => {
  const { validator } = await loadDeploymentModules()
  const { DEPLOY_FILE, POSTFLIGHT_FILE, PREFLIGHT_FILE, VERIFY_FILE } = validator
  const preflight = read(PREFLIGHT_FILE)
  const postflight = read(POSTFLIGHT_FILE)
  const deploy = read(DEPLOY_FILE)
  const verify = read(VERIFY_FILE)

  assert.match(preflight, /line_pay_service_checkout_preflight_ready/u)
  assert.doesNotMatch(preflight, /\b(?:insert|update|delete|alter|create|drop|grant|revoke|truncate)\b/iu)
  assert.match(postflight, /line_pay_service_checkout_postflight_ready/u)
  assert.match(deploy, /\\ir \.\.\/migrations\/20260805025344_initialize_service_line_pay_checkout\.sql/u)
  assert.equal(
    deploy.match(/20260805025344_initialize_service_line_pay_checkout\.sql/gu)?.length,
    1,
  )
  assert.match(deploy, /LINE_PAY_DEPLOY_MIGRATION_STARTED/u)
  assert.match(deploy, /LINE_PAY_DEPLOY_MIGRATION_COMMITTED/u)
  assert.match(deploy, /LINE_PAY_DEPLOY_POSTFLIGHT_COMMITTED/u)
  assert.match(verify, /BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY/iu)
  assert.match(verify, /\\ir service_line_pay_checkout_initialization_postflight[.]sql/u)
  assert.match(verify, /ROLLBACK/u)
  assert.doesNotMatch(verify, /\b(?:insert|update|delete|alter|create|drop|grant|revoke|truncate)\b/iu)
})

test('workflow is manual-only, protected, and never exposes a secret input', async () => {
  const { validator } = await loadDeploymentModules()
  const { VERIFY_WORKFLOW_FILE, WORKFLOW_FILE } = validator
  const workflow = read(WORKFLOW_FILE)
  const verifyWorkflow = read(VERIFY_WORKFLOW_FILE)
  assert.match(workflow, /^on:\n  workflow_dispatch:\n/mu)
  assert.doesNotMatch(workflow, /\b(?:push|pull_request):/u)
  assert.match(workflow, /environment:\n      name: supabase-production/u)
  assert.match(workflow, /SUPABASE_PRODUCTION_DB_URL: \$\{\{ secrets\.SUPABASE_PRODUCTION_DB_URL \}\}/u)
  assert.doesNotMatch(workflow, /type:\s*string[\s\S]{0,120}(?:database_url|secret|token|password)/iu)
  assert.match(workflow, /run-service-line-pay-checkout-exact-file\.mjs preflight/u)
  assert.match(workflow, /run-service-line-pay-checkout-exact-file\.mjs deploy/u)
  assert.match(verifyWorkflow, /^on:\n  workflow_dispatch:\n/mu)
  assert.doesNotMatch(verifyWorkflow, /\b(?:push|pull_request):/u)
  assert.match(verifyWorkflow, /environment:\n      name: supabase-production/u)
  assert.match(verifyWorkflow, /SUPABASE_PRODUCTION_DB_URL: \$\{\{ secrets\.SUPABASE_PRODUCTION_DB_URL \}\}/u)
  assert.doesNotMatch(verifyWorkflow, /type:\s*string[\s\S]{0,120}(?:database_url|secret|token|password)/iu)
  assert.match(verifyWorkflow, /run-service-line-pay-checkout-exact-file\.mjs verify/u)
})

test('read-only verification context requires one exact main commit', async () => {
  const { validator } = await loadDeploymentModules()
  const {
    EXPECTED_PROJECT_REF,
    EXPECTED_VERIFY_CONFIRMATION,
    validateVerificationWorkflowContext,
  } = validator
  const commit = 'c'.repeat(40)
  assert.doesNotThrow(() => validateVerificationWorkflowContext({
    GITHUB_REPOSITORY: 'tsaititsu/tsu-waterbottle-site',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_REF: 'refs/heads/main',
    GITHUB_SHA: commit,
    AUTHORIZED_COMMIT: commit,
    PROJECT_REF_INPUT: EXPECTED_PROJECT_REF,
    VERIFY_CONFIRMATION: EXPECTED_VERIFY_CONFIRMATION,
  }))
  assert.throws(() => validateVerificationWorkflowContext({
    GITHUB_REPOSITORY: 'tsaititsu/tsu-waterbottle-site',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_REF: 'refs/heads/main',
    GITHUB_SHA: commit,
    AUTHORIZED_COMMIT: 'd'.repeat(40),
    PROJECT_REF_INPUT: EXPECTED_PROJECT_REF,
    VERIFY_CONFIRMATION: EXPECTED_VERIFY_CONFIRMATION,
  }))
})
