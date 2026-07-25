import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test, { before } from 'node:test'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const validatorPath = join(
  root,
  'scripts/supabase/validate-line-pay-application-state-diagnostic.mjs',
)
const workflowPath =
  '.github/workflows/supabase-production-line-pay-application-state-diagnostic.yml'
const diagnosticPath =
  'supabase/deployment/line_pay_application_state_diagnostic.sql'
const ciPath = '.github/workflows/line-pay-db-contract-ci.yml'
const deployPath =
  'supabase/deployment/line_pay_remediation_deploy.sql'
const migrationPath =
  'supabase/migrations/20260719033404_line_pay_remediation_contracts.sql'
const preflightPath =
  'supabase/deployment/line_pay_remediation_preflight.sql'
const postflightPath =
  'supabase/deployment/line_pay_remediation_postflight.sql'
const exactFileRunnerPath =
  'scripts/supabase/run-line-pay-production-exact-file.mjs'

const workflow = readFileSync(workflowPath, 'utf8')
const diagnosticSql = readFileSync(diagnosticPath, 'utf8')
const ci = readFileSync(ciPath, 'utf8')
const deploySql = readFileSync(deployPath, 'utf8')
const migrationSql = readFileSync(migrationPath, 'utf8')
const preflightSql = readFileSync(preflightPath, 'utf8')
const postflightSql = readFileSync(postflightPath, 'utf8')
const exactFileRunner = readFileSync(exactFileRunnerPath, 'utf8')
let validator: any

before(async () => {
  validator = await import(pathToFileURL(validatorPath).href)
})

test('application-state workflow is manual-only and protected', () => {
  assert.equal(validator.assertWorkflowSource(workflow), true)
  assert.match(
    workflow,
    /^name: Supabase Production LINE Pay Application State Diagnostic$/mu,
  )
  assert.match(workflow, /^permissions:\n  contents: read$/mu)
  assert.match(
    workflow,
    /^  group: supabase-production-line-pay-application-state-diagnostic$/mu,
  )
  assert.match(workflow, /^  cancel-in-progress: false$/mu)
  assert.equal(
    (workflow.match(/environment:\n      name: supabase-production/gu) ?? [])
      .length,
    1,
  )
  assert.doesNotMatch(
    workflow,
    /^\s{2}(?:push|pull_request|schedule|workflow_call|repository_dispatch):/mu,
  )
})

test('workflow exposes only the three fixed identity inputs', () => {
  const inputNames = [
    ...workflow.matchAll(/^      ([a-z_]+):\n        description:/gmu),
  ].map((match) => match[1])
  assert.deepEqual(inputNames, [
    'authorized_commit',
    'project_ref',
    'confirmation',
  ])
  assert.doesNotMatch(
    workflow,
    /\b(?:sql|path|command|runtime|migration_sha256):\n/iu,
  )
  for (const action of [
    ...workflow.matchAll(/^\s+uses: ([^\s]+)$/gmu),
  ].map((match) => match[1])) {
    assert.match(action, /^[^@]+@[0-9a-f]{40}$/u)
  }
})

test('application-state SQL is exact, digest-sealed, read-only and rollback-only', () => {
  assert.equal(
    validator.assertApplicationStateDiagnosticSql(diagnosticSql),
    true,
  )
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
    validator.stripSqlForStaticAnalysis?.(diagnosticSql) ?? '',
    /\b(?:insert|update|delete|merge|truncate|create|alter|drop|grant|revoke)\b/iu,
  )
  assert.doesNotMatch(diagnosticSql, /^\\(?:i|ir|copy|!|o|w)\b/mu)
})

test('static mutations cannot weaken the read-only or inventory contract', () => {
  const mutations = [
    diagnosticSql.replace(
      'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;',
      'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;',
    ),
    diagnosticSql.replace('\nROLLBACK;\n', '\nCOMMIT;\n'),
    diagnosticSql.replace(
      '\nROLLBACK;\n',
      '\ninsert into public.payments default values;\nROLLBACK;\n',
    ),
    diagnosticSql.replace(
      "    ('public', 'line_pay_callback_events'),\n",
      '',
    ),
    diagnosticSql.replace(
      "    ('payments', 'line_pay_transaction_id'),\n",
      '',
    ),
    diagnosticSql.replace('and actual.digest = expected.digest', 'and true'),
    diagnosticSql.replace("then 'HISTORY_ONLY'", "then 'INCONSISTENT'"),
    diagnosticSql.replace("then 'PARTIAL'", "then 'UNAPPLIED'"),
    diagnosticSql.replace(
      'pg_catalog.pg_get_expr(policy.polqual, policy.polrelid, false)',
      'pg_catalog.pg_get_functiondef(policy.polrelid)',
    ),
  ]
  assert.equal(mutations.length, 9)
  for (const mutation of mutations) {
    assert.throws(
      () => validator.assertApplicationStateDiagnosticSql(mutation),
      /APPLICATION_STATE_DIAGNOSTIC_SQL_INVALID/,
    )
  }
})

test('existing deploy boundary makes DEPLOY_PSQL_FAILED commit state unknown', () => {
  assert.deepEqual(
    deploySql.match(/^\\ir [^\r\n]+$/gmu),
    [
      '\\ir line_pay_remediation_preflight.sql',
      '\\ir ../migrations/20260719033404_line_pay_remediation_contracts.sql',
      '\\ir line_pay_remediation_postflight.sql',
    ],
  )
  assert.equal((deploySql.match(/^begin;$/gmu) ?? []).length, 2)
  assert.equal((deploySql.match(/^commit;$/gmu) ?? []).length, 1)
  assert.equal((migrationSql.match(/^begin;$/gmu) ?? []).length, 1)
  assert.equal((migrationSql.match(/^commit;$/gmu) ?? []).length, 1)
  assert.ok(
    deploySql.indexOf(
      '\\ir ../migrations/20260719033404_line_pay_remediation_contracts.sql',
    ) <
      deploySql.indexOf('\\ir line_pay_remediation_postflight.sql'),
  )
  assert.doesNotMatch(
    [deploySql, migrationSql, preflightSql, postflightSql].join('\n'),
    /\binsert\s+into\s+supabase_migrations[.]schema_migrations\b/iu,
  )
  assert.match(
    exactFileRunner,
    /if \(result[.]code !== 0 \|\| result[.]signal\) fail\(phaseFailureCode\(phase\)\)/u,
  )
  assert.match(exactFileRunner, /'DEPLOY_PSQL_FAILED'/u)
  assert.match(exactFileRunner, /'DEPLOY_CONTRACT_FAILED'/u)
})

test('LINE Pay DB CI owns the application-state contracts and cleanup', () => {
  for (const path of [
    workflowPath,
    diagnosticPath,
    'scripts/supabase/run-line-pay-application-state-diagnostic.mjs',
    'scripts/supabase/validate-line-pay-application-state-diagnostic.mjs',
    'supabase/line_pay_application_state_diagnostic_workflow.test.ts',
    'supabase/line_pay_application_state_diagnostic_runner.test.ts',
    'supabase/tests/run_line_pay_application_state_diagnostic_contracts.mjs',
  ]) {
    assert.match(ci, new RegExp(path.replaceAll('.', '[.]'), 'u'))
  }
  assert.match(ci, /task=line-pay-application-state-diagnostic/u)
})
