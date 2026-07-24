import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test, { before } from 'node:test'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const validatorPath = join(
  root,
  'scripts/supabase/validate-line-pay-production-diagnostic.mjs',
)
const workflowPath =
  '.github/workflows/supabase-production-line-pay-diagnostic.yml'
const ciPath = '.github/workflows/line-pay-db-contract-ci.yml'
const diagnosticPath =
  'supabase/deployment/line_pay_remediation_diagnostic.sql'

const workflow = readFileSync(workflowPath, 'utf8')
const diagnosticSql = readFileSync(diagnosticPath, 'utf8')
const ci = readFileSync(ciPath, 'utf8')
let validator: any

before(async () => {
  validator = await import(pathToFileURL(validatorPath).href)
})

test('diagnostic workflow is manual-only and has the exact protected boundary', () => {
  assert.equal(validator.assertWorkflowSource(workflow), true)
  assert.match(
    workflow,
    /^name: Supabase Production LINE Pay Drift Diagnostic$/mu,
  )
  assert.match(workflow, /^permissions:\n  contents: read$/mu)
  assert.match(
    workflow,
    /^  group: supabase-production-line-pay-diagnostic$/mu,
  )
  assert.match(workflow, /^  cancel-in-progress: false$/mu)
  assert.match(workflow, /runs-on: ubuntu-24[.]04/gu)
  assert.match(workflow, /node-version: "24[.]16[.]0"/gu)
  assert.match(
    workflow,
    new RegExp(validator.POSTGRES_IMAGE.replace('.', '[.]'), 'gu'),
  )
  assert.equal(
    (workflow.match(
      /node scripts\/supabase\/run-line-pay-production-diagnostic[.]mjs/gu,
    ) ?? []).length,
    1,
  )
})

test('workflow exposes only three fixed identity inputs and two jobs', () => {
  const inputNames = [
    ...workflow.matchAll(/^      ([a-z_]+):\n        description:/gmu),
  ].map((match) => match[1])
  assert.deepEqual(inputNames, [
    'authorized_commit',
    'project_ref',
    'confirmation',
  ])
  const jobNames = [
    ...workflow.matchAll(/^  ([a-z-]+):\n    (?:needs:|runs-on:)/gmu),
  ].map((match) => match[1])
  assert.deepEqual(jobNames, ['source-validation', 'diagnose-production'])
  assert.equal(
    (workflow.match(/environment:\n      name: supabase-production/gu) ?? [])
      .length,
    1,
  )
})

test('workflow pins every action and never exposes a deploy path', () => {
  const actionUses = [...workflow.matchAll(/^\s+uses: ([^\s]+)$/gmu)].map(
    (match) => match[1],
  )
  assert.ok(actionUses.length >= 4)
  for (const action of actionUses) {
    assert.match(action, /^[^@]+@[0-9a-f]{40}$/u)
  }
  assert.doesNotMatch(
    workflow,
    /run-line-pay-production-exact-file|line_pay_remediation_(?:deploy|preflight|postflight)|supabase\s+(?:db|migration)|psql|artifact/iu,
  )
})

test('diagnostic SQL is exact, read-only, rollback-only, and digest sealed', () => {
  assert.equal(validator.assertDiagnosticSql(diagnosticSql), true)
  assert.equal(
    createHash('sha256').update(diagnosticSql).digest('hex'),
    validator.EXPECTED_DIAGNOSTIC_SHA256,
  )
  assert.match(
    diagnosticSql,
    /^BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;$/mu,
  )
  assert.match(diagnosticSql, /^ROLLBACK;$/mu)
  assert.doesNotMatch(
    diagnosticSql.replaceAll(/'[^']*(?:''[^']*)*'/gu, "''"),
    /\b(?:insert|update|delete|merge|truncate|create|alter|drop|grant|revoke|comment|copy|call|do|execute)\b/iu,
  )
  assert.match(
    diagnosticSql,
    /^select[\s\S]+as diagnostic_shape_ready\s*\\gset$/mu,
  )
  assert.match(diagnosticSql, /^\\if :migration_history_ready$/mu)
  assert.match(diagnosticSql, /^\\if :diagnostic_shape_ready$/mu)
  assert.doesNotMatch(
    diagnosticSql,
    /^\\(?:include|i|ir|!|copy|setenv|o|out|w|write)\b/mu,
  )
})

test('LINE Pay DB CI includes all diagnostic contracts and cleanup', () => {
  for (const path of [
    workflowPath,
    'scripts/supabase/run-line-pay-production-diagnostic.mjs',
    'scripts/supabase/validate-line-pay-production-diagnostic.mjs',
    validator.DIAGNOSTIC_FILE,
    'supabase/line_pay_production_diagnostic_workflow.test.ts',
    'supabase/line_pay_production_diagnostic_runner.test.ts',
    'supabase/tests/run_line_pay_production_diagnostic_contracts.mjs',
  ]) {
    assert.match(ci, new RegExp(path.replaceAll('.', '[.]'), 'u'))
  }
  for (const command of [
    'node --test supabase/line_pay_production_diagnostic_workflow.test.ts',
    'node --test supabase/line_pay_production_diagnostic_runner.test.ts',
    'node supabase/tests/run_line_pay_production_diagnostic_contracts.mjs',
  ]) {
    assert.match(ci, new RegExp(command.replaceAll('.', '[.]'), 'u'))
  }
  assert.match(ci, /task=line-pay-production-data-drift-diagnostic/u)
})
