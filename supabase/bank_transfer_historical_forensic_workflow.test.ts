import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test, { before } from 'node:test'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const validatorPath = join(
  root,
  'scripts/supabase/validate-bank-transfer-production-forensic.mjs',
)
const workflowPath =
  '.github/workflows/supabase-production-bank-transfer-forensic.yml'
const ciPath = '.github/workflows/line-pay-db-contract-ci.yml'
const forensicPath =
  'supabase/deployment/bank_transfer_historical_forensic.sql'
const contractRunnerPath =
  'supabase/tests/run_bank_transfer_historical_forensic_contracts.mjs'

const workflow = readFileSync(workflowPath, 'utf8')
const forensicSql = readFileSync(forensicPath, 'utf8')
const contractRunner = readFileSync(contractRunnerPath, 'utf8')
const ci = readFileSync(ciPath, 'utf8')
let validator: any

before(async () => {
  validator = await import(pathToFileURL(validatorPath).href)
})

test('forensic workflow is manual-only and has the exact protected boundary', () => {
  assert.equal(validator.assertWorkflowSource(workflow), true)
  assert.match(
    workflow,
    /^name: Supabase Production Bank Transfer Historical Forensic$/mu,
  )
  assert.match(workflow, /^permissions:\n  contents: read$/mu)
  assert.match(
    workflow,
    /^  group: supabase-production-bank-transfer-forensic$/mu,
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
      /node scripts\/supabase\/run-bank-transfer-production-forensic[.]mjs/gu,
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
  assert.deepEqual(jobNames, ['source-validation', 'inspect-production'])
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

test('forensic SQL is exact, read-only, rollback-only, and digest sealed', () => {
  assert.equal(validator.assertForensicSql(forensicSql), true)
  assert.equal(
    createHash('sha256').update(forensicSql).digest('hex'),
    validator.EXPECTED_FORENSIC_SHA256,
  )
  assert.match(
    forensicSql,
    /^BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;$/mu,
  )
  assert.match(forensicSql, /^ROLLBACK;$/mu)
  assert.doesNotMatch(
    forensicSql.replaceAll(/'[^']*(?:''[^']*)*'/gu, "''"),
    /\b(?:insert|update|delete|merge|truncate|create|alter|drop|grant|revoke|comment|copy|call|do|execute)\b/iu,
  )
  assert.match(
    forensicSql,
    /^select[\s\S]+as forensic_shape_ready,[\s\S]+as commit_timestamp_tracking_enabled\s*\\gset$/mu,
  )
  assert.match(forensicSql, /^\\if :forensic_shape_ready$/mu)
  assert.match(
    forensicSql,
    /^\\if :commit_timestamp_tracking_enabled$/mu,
  )
  assert.doesNotMatch(
    forensicSql,
    /^\\(?:include|i|ir|!|copy|setenv|o|out|w|write)\b/mu,
  )
})

test('LINE Pay DB CI includes all forensic contracts and cleanup', () => {
  for (const path of [
    workflowPath,
    'scripts/supabase/run-bank-transfer-production-forensic.mjs',
    'scripts/supabase/validate-bank-transfer-production-forensic.mjs',
    validator.FORENSIC_FILE,
    'supabase/bank_transfer_historical_forensic_workflow.test.ts',
    'supabase/bank_transfer_historical_forensic_runner.test.ts',
    'supabase/tests/run_bank_transfer_historical_forensic_contracts.mjs',
  ]) {
    assert.match(ci, new RegExp(path.replaceAll('.', '[.]'), 'u'))
  }
  for (const command of [
    'node --test supabase/bank_transfer_historical_forensic_workflow.test.ts',
    'node --test supabase/bank_transfer_historical_forensic_runner.test.ts',
    'node supabase/tests/run_bank_transfer_historical_forensic_contracts.mjs',
  ]) {
    assert.match(ci, new RegExp(command.replaceAll('.', '[.]'), 'u'))
  }
  assert.match(ci, /task=bank-transfer-historical-forensic/u)
})

test('forensic PostgreSQL contract runner waits for the final server process', () => {
  assert.match(
    contractRunner,
    /\['exec', containerName, 'cat', '\/proc\/1\/comm'\]/u,
  )
  assert.match(
    contractRunner,
    /pidOneResult[.]stdout[.]trim\(\) === 'postgres'/u,
  )
  const finalServerGate = contractRunner.search(
    /pidOneResult[.]stdout[.]trim\(\) === 'postgres'/u,
  )
  const readinessProbe = contractRunner.search(
    /\[\s*'exec',\s*containerName,\s*'pg_isready',\s*'-U',\s*'postgres',\s*'-d',\s*'postgres',?\s*\]/u,
  )
  assert.ok(finalServerGate >= 0)
  assert.ok(readinessProbe > finalServerGate)
})
