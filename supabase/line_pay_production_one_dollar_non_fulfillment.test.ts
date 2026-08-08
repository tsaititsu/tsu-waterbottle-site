import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

import { LINE_PAY_PRODUCTION_ONE_DOLLAR_ENTRY_DEFINITIONS } from '../src/lib/linePay/productionOneDollarEntry'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')
const validatorPath = pathToFileURL(join(
  root,
  'scripts/supabase/validate-line-pay-production-one-dollar-non-fulfillment.mjs',
)).href
const runnerPath = pathToFileURL(join(
  root,
  'scripts/supabase/run-line-pay-production-one-dollar-non-fulfillment-exact-file.mjs',
)).href

async function loadDeploymentModules() {
  const [validator, runner] = await Promise.all([
    import(validatorPath),
    import(runnerPath),
  ])
  return { validator, runner }
}

test('Migration is additive, service-role-only, and fail-closed', () => {
  const migration = read(
    'supabase/migrations/20260808092959_line_pay_production_one_dollar_non_fulfillment.sql',
  )

  assert.match(migration, /^--[\s\S]*?\nbegin;/iu)
  assert.match(migration, /commit;\s*$/iu)
  assert.doesNotMatch(migration, /\bdrop\s+(?:table|schema|column)\b/iu)
  assert.doesNotMatch(migration, /\btruncate\b|\bdelete\s+from\b/iu)
  assert.match(migration, /\bsecurity\s+definer\b/iu)
  assert.match(migration, /\bsecurity\s+invoker\b/iu)
  assert.match(
    migration,
    /alter function line_pay_private\.mark_line_pay_production_one_dollar_non_fulfillment\([\s\S]*?owner to line_pay_payment_function_owner;/iu,
  )
  assert.match(
    migration,
    /grant execute on function public\.initialize_line_pay_production_nt1_non_fulfillment_checkout\([\s\S]*?to service_role;/iu,
  )
  assert.match(
    migration,
    /create table line_pay_private\.line_pay_production_one_dollar_non_fulfillment_orders/iu,
  )
  assert.match(migration, /on delete restrict/iu)
  assert.match(migration, /line_pay_00_production_one_dollar_order_guard/iu)
  assert.match(migration, /line_pay_production_one_dollar_item_guard/iu)
  assert.match(migration, /line_pay_production_one_dollar_shipping_guard/iu)
  assert.match(migration, /select pg_catalog\.count\(\*\)[\s\S]*?<> 1/iu)
  assert.ok(
    (migration.match(/line_pay_production_nt1_non_fulfillment:/gu)?.length
      ?? 0) >= 3,
  )

  const postflight = read(
    'supabase/deployment/line_pay_production_one_dollar_non_fulfillment_postflight.sql',
  )
  assert.match(postflight, /pg_catalog\.aclexplode/iu)
  assert.match(postflight, /pg_catalog\.md5\(v_wrapper\.prosrc\)/iu)
  assert.match(postflight, /pg_catalog\.md5\(v_private_marker\.prosrc\)/iu)
  assert.match(postflight, /pg_catalog\.md5\(v_order_guard\.prosrc\)/iu)
  assert.match(postflight, /pg_catalog\.md5\(v_child_guard\.prosrc\)/iu)
  assert.match(postflight, /v_marker_table\.relforcerowsecurity/iu)
  assert.match(postflight, /trigger_record\.tgrelid/iu)
  assert.match(postflight, /trigger_record\.tgfoid/iu)
  assert.match(postflight, /trigger_record\.tgtype = 19/iu)
  assert.match(postflight, /trigger_record\.tgtype = 31/iu)
})

test('only the four exact Production NT$1 entry identities can transition', () => {
  const migration = read(
    'supabase/migrations/20260808092959_line_pay_production_one_dollar_non_fulfillment.sql',
  )

  for (const source of [
    'ai_chart_report',
    'ai_divination',
    'cart',
    'booking',
  ]) {
    assert.match(migration, new RegExp(`'${source}'`, 'u'))
  }
  assert.doesNotMatch(migration, /'admin'|'course'|'bank_transfer'|'webatm'/iu)
  assert.match(migration, /total_amount_twd = 1/iu)
  assert.match(migration, /environment = 'production'/iu)
  assert.match(migration, /line-pay-production-one-dollar-test-/u)
  assert.match(migration, /LPONE-\[0-9a-f\]\{32\}/u)
  assert.match(migration, /LP_ONE_\[0-9a-f\]\{32\}/u)
  assert.match(migration, /不出貨、不提供服務/u)
  assert.match(migration, /fulfillment_mode = 'none'/u)
  assert.match(migration, /shipping_status = 'not_applicable'/u)

  for (const entry of LINE_PAY_PRODUCTION_ONE_DOLLAR_ENTRY_DEFINITIONS) {
    assert.match(
      migration,
      new RegExp(
        `when '${entry.source}' then '${entry.label}'`,
        'u',
      ),
    )
  }
})

test('controlled runner pins one Migration and a read-only verifier', async () => {
  const { validator, runner } = await loadDeploymentModules()
  const {
    DEPLOY_FILE,
    MIGRATION_FILE,
    POSTFLIGHT_FILE,
    PREFLIGHT_FILE,
    VERIFY_FILE,
  } = validator

  assert.deepEqual(runner.NON_FULFILLMENT_DATABASE_CONTRACT.phaseFiles, {
    preflight: PREFLIGHT_FILE,
    deploy: DEPLOY_FILE,
  })
  assert.deepEqual(
    runner.NON_FULFILLMENT_DATABASE_CONTRACT.fixedFiles.map(
      (file: { path: string }) => file.path,
    ),
    [MIGRATION_FILE, PREFLIGHT_FILE, POSTFLIGHT_FILE, DEPLOY_FILE],
  )
  assert.deepEqual(
    runner.NON_FULFILLMENT_VERIFICATION_CONTRACT.fixedFiles.map(
      (file: { path: string }) => file.path,
    ),
    [POSTFLIGHT_FILE, VERIFY_FILE],
  )

  const verify = read(VERIFY_FILE)
  assert.match(
    verify,
    /BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY/iu,
  )
  assert.match(verify, /ROLLBACK/iu)
  assert.doesNotMatch(
    verify,
    /\b(?:insert|update|delete|alter|create|drop|grant|revoke|truncate)\b/iu,
  )
})

test('workflow identity and exact fixed-file hashes fail closed', async () => {
  const { validator } = await loadDeploymentModules()
  const commit = 'a'.repeat(40)
  const environment = {
    GITHUB_REPOSITORY: validator.EXPECTED_REPOSITORY,
    GITHUB_EVENT_NAME: validator.EXPECTED_EVENT,
    GITHUB_REF: validator.EXPECTED_REF,
    GITHUB_SHA: commit,
    AUTHORIZED_COMMIT: commit,
    PROJECT_REF_INPUT: validator.EXPECTED_PROJECT_REF,
    MIGRATION_SHA256_INPUT: validator.EXPECTED_MIGRATION_SHA256,
    DEPLOY_CONFIRMATION: validator.EXPECTED_CONFIRMATION,
    BACKUP_RESTORE_POINT_CONFIRMATION:
      validator.EXPECTED_BACKUP_CONFIRMATION,
  }

  assert.equal(validator.validateWorkflowContext(environment), true)
  assert.throws(() => validator.validateWorkflowContext({
    ...environment,
    AUTHORIZED_COMMIT: 'b'.repeat(40),
  }))
  assert.equal(validator.validateSource(root), true)
  assert.deepEqual(
    validator.parsePreflightOutput(
      'line_pay_production_one_dollar_non_fulfillment_preflight_ready\n',
    ),
    { status: 'preflight_ready' },
  )
  assert.throws(() => validator.parseDeployOutput(
    'line_pay_production_one_dollar_non_fulfillment_postflight_ready\n',
  ))
})

test('workflows are manual-only, protected, and accept no secret input', async () => {
  const { validator } = await loadDeploymentModules()
  for (const path of [validator.WORKFLOW_FILE, validator.VERIFY_WORKFLOW_FILE]) {
    const workflow = read(path)
    assert.match(workflow, /^on:\n  workflow_dispatch:\n/mu)
    assert.doesNotMatch(workflow, /\n  (?:push|pull_request):/u)
    assert.match(workflow, /environment:\n      name: supabase-production/u)
    assert.match(
      workflow,
      /SUPABASE_PRODUCTION_DB_URL: \$\{\{ secrets\.SUPABASE_PRODUCTION_DB_URL \}\}/u,
    )
    assert.doesNotMatch(
      workflow,
      /type:\s*string[\s\S]{0,120}(?:database_url|secret|token|password)/iu,
    )
  }
})
