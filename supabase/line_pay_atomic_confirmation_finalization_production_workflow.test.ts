import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { before, describe, it } from 'node:test'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const validatorPath = join(
  root,
  'scripts/supabase/validate-line-pay-atomic-confirmation-finalization-production.mjs',
)
const workflowPath = join(
  root,
  '.github/workflows/supabase-production-line-pay-atomic-confirmation-finalization.yml',
)
const migrationPath = join(
  root,
  'supabase/migrations/20260802160000_line_pay_atomic_confirmation_finalization.sql',
)
const diagnosticPath = join(
  root,
  'supabase/deployment/line_pay_atomic_confirmation_finalization_application_state.sql',
)
const preflightPath = join(
  root,
  'supabase/deployment/line_pay_atomic_confirmation_finalization_preflight.sql',
)
const postflightPath = join(
  root,
  'supabase/deployment/line_pay_atomic_confirmation_finalization_postflight.sql',
)
const deployPath = join(
  root,
  'supabase/deployment/line_pay_atomic_confirmation_finalization_deploy.sql',
)

let validator: any
let workflow = ''
let diagnosticSql = ''
let preflightSql = ''
let postflightSql = ''
let deploySql = ''

before(async () => {
  validator = await import(pathToFileURL(validatorPath).href)
  workflow = readFileSync(workflowPath, 'utf8')
  diagnosticSql = readFileSync(diagnosticPath, 'utf8')
  preflightSql = readFileSync(preflightPath, 'utf8')
  postflightSql = readFileSync(postflightPath, 'utf8')
  deploySql = readFileSync(deployPath, 'utf8')
})

describe('LINE Pay Atomic Confirmation Finalization Production workflow', () => {
  it('locks the exact immutable source identity', () => {
    assert.equal(validator.EXPECTED_REPOSITORY, 'tsaititsu/tsu-waterbottle-site')
    assert.equal(validator.EXPECTED_PROJECT_REF, 'ndbqoznvobmpkgxkiezz')
    assert.equal(validator.EXPECTED_EVENT, 'workflow_dispatch')
    assert.equal(validator.EXPECTED_REF, 'refs/heads/main')
    assert.equal(validator.EXPECTED_NODE_VERSION, 'v24.16.0')
    assert.equal(
      validator.EXPECTED_CONFIRMATION,
      'DEPLOY_LINE_PAY_ATOMIC_CONFIRMATION_FINALIZATION_EXACT_FILE_ONCE',
    )
    assert.equal(
      validator.EXPECTED_BACKUP_CONFIRMATION,
      'CONFIRM_SUPABASE_BACKUP_PITR_RESTORE_POINT_AVAILABLE',
    )
    assert.equal(
      validator.MIGRATION_FILE,
      'supabase/migrations/20260802160000_line_pay_atomic_confirmation_finalization.sql',
    )
    assert.equal(
      createHash('sha256')
        .update(readFileSync(migrationPath))
        .digest('hex'),
      '2991bff6e13d76d843f98b2e019bb6c6ff5a1d7471c667dd4de528f95aa12b4f',
    )
    for (const [path, expected] of [
      [diagnosticPath, validator.EXPECTED_DIAGNOSTIC_SHA256],
      [preflightPath, validator.EXPECTED_PREFLIGHT_SHA256],
      [postflightPath, validator.EXPECTED_POSTFLIGHT_SHA256],
      [deployPath, validator.EXPECTED_DEPLOY_SHA256],
    ]) {
      assert.equal(
        createHash('sha256').update(readFileSync(path)).digest('hex'),
        expected,
      )
    }
  })

  it('keeps deployment manual, main-only, exact-file, and environment-gated', () => {
    assert.match(
      workflow,
      /^name: Supabase Production LINE Pay Atomic Confirmation Finalization$/mu,
    )
    assert.match(workflow, /workflow_dispatch:/u)
    assert.doesNotMatch(workflow, /\npull_request:|\npush:|\nschedule:/u)
    assert.match(workflow, /environment:\n\s+name: supabase-production/u)
    assert.match(
      workflow,
      /MIGRATION_SHA256_INPUT: \$\{\{ inputs[.]migration_sha256 \}\}/u,
    )
    assert.match(
      workflow,
      /BACKUP_RESTORE_POINT_CONFIRMATION: \$\{\{ inputs[.]backup_restore_point_confirmation \}\}/u,
    )
    assert.match(
      workflow,
      /SUPABASE_PRODUCTION_DB_URL: \$\{\{ secrets[.]SUPABASE_PRODUCTION_DB_URL \}\}/u,
    )
    assert.doesNotMatch(
      workflow,
      /supabase db push|migration up|apply-all|LINE_PAY_ENABLED|NEXT_PUBLIC_ENABLE_LINE_PAY/iu,
    )
  })

  it('uses read-only preflight and one exact Migration include', () => {
    validator.assertDeploymentSql(preflightSql, postflightSql, deploySql)
    assert.doesNotMatch(preflightSql, /\\ir \.\.\/migrations/u)
    assert.match(
      deploySql,
      /\\ir \.\.\/migrations\/20260802160000_line_pay_atomic_confirmation_finalization[.]sql/u,
    )
    assert.equal(
      deploySql.match(/\\ir \.\.\/migrations\//gu)?.length,
      1,
    )
    assert.doesNotMatch(
      `${diagnosticSql}\n${preflightSql}\n${postflightSql}\n${deploySql}`,
      /api-pay[.]line[.]me|https?:\/\/|LINE_PAY_TRANSPORT|NEXT_PUBLIC_ENABLE_LINE_PAY|\bretry\b/iu,
    )
  })

  it('pins preflight to UNAPPLIED and postflight to FULL', () => {
    const unapplied = validator.buildExpectedAtomicFixture('UNAPPLIED')
    const full = validator.buildExpectedAtomicFixture('FULL')
    assert.equal(
      validator.parseAndValidateAtomicPreflightOutput(
        `${JSON.stringify(unapplied)}\n`,
      ).application_state,
      'UNAPPLIED',
    )
    assert.equal(
      validator.parseAndValidateAtomicPostflightOutput(
        `${JSON.stringify(full)}\n`,
      ).application_state,
      'FULL',
    )
    assert.throws(() =>
      validator.parseAndValidateAtomicPreflightOutput(
        `${JSON.stringify(full)}\n`,
      ),
    )
    assert.throws(() =>
      validator.parseAndValidateAtomicPostflightOutput(
        `${JSON.stringify(unapplied)}\n`,
      ),
    )
  })

  it('bounds and freezes catalog-only diagnostic output', () => {
    const parsed = validator.parseAndValidateAtomicOutput(
      `${JSON.stringify(validator.buildExpectedAtomicFixture('FULL'))}\n`,
    )
    assert.ok(Object.isFrozen(parsed))
    assert.ok(Object.isFrozen(parsed.inventory))
    assert.ok(Object.isFrozen(parsed.contracts))
    assert.doesNotMatch(
      JSON.stringify(parsed),
      /postgres(?:ql)?:\/\/|password|secret|token|authorization|payload|transaction_id|row_data|function_body/iu,
    )
    assert.match(
      diagnosticSql,
      /grantor_role[.]rolname = current_user[\s\S]*member_role[.]rolname = 'authenticator'|member_role[.]rolname = 'authenticator'[\s\S]*grantor_role[.]rolname = current_user/u,
    )
  })
})
