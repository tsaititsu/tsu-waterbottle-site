import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const deploymentWorkflowPath =
  '.github/workflows/supabase-production-line-pay-checkout-initializer.yml'
const diagnosticWorkflowPath =
  '.github/workflows/supabase-production-line-pay-checkout-initializer-diagnostic.yml'
const deploymentWorkflow = readFileSync(
  join(root, deploymentWorkflowPath),
  'utf8',
)
const diagnosticWorkflow = readFileSync(
  join(root, diagnosticWorkflowPath),
  'utf8',
)
const ci = readFileSync(
  join(root, '.github/workflows/line-pay-db-contract-ci.yml'),
  'utf8',
)

for (const [label, workflow] of [
  ['deployment', deploymentWorkflow],
  ['diagnostic', diagnosticWorkflow],
] as const) {
  test(`${label} workflow is manual-only, least-privilege, and main-only`, () => {
    assert.match(workflow, /^on:\n  workflow_dispatch:\n/m)
    assert.doesNotMatch(
      workflow,
      /^\s{2}(?:push|pull_request|schedule|repository_dispatch|workflow_call):/m,
    )
    assert.match(workflow, /^permissions:\n  contents: read\n/m)
    assert.doesNotMatch(
      workflow,
      /contents:\s*write|actions:\s*write|deployments:\s*write|id-token:\s*write|pull-requests:\s*write/,
    )
    assert.match(workflow, /GITHUB_REF: \$\{\{ github\.ref \}\}/)
    assert.match(workflow, /GITHUB_SHA: \$\{\{ github\.sha \}\}/)
    assert.match(workflow, /environment:\n      name: supabase-production/)
    assert.match(workflow, /secrets\.SUPABASE_PRODUCTION_DB_URL/)
    assert.match(workflow, /vars\.SUPABASE_PRODUCTION_CHANNEL_READY/)
    assert.doesNotMatch(
      workflow,
      /\bsupabase\s+(?:db|migration)|run:\s*(?:sudo\s+)?psql\b|\bcurl\b|\bretry\b|base64|<<[-~]?['"]?[A-Z_]+/,
    )
    assert.doesNotMatch(
      workflow,
      /LINE_PAY_ENABLED|LINE_PAY_TRANSPORT|api-pay[.]line[.]me|gateway/i,
    )
  })
}

test('deployment workflow fixes exact source and backup/PITR authorization gates', () => {
  for (const input of [
    'authorized_commit:',
    'project_ref:',
    'migration_sha256:',
    'backup_restore_point_confirmation:',
    'confirmation:',
  ]) {
    assert.ok(deploymentWorkflow.includes(input), input)
  }
  assert.match(
    deploymentWorkflow,
    /node scripts\/supabase\/validate-line-pay-checkout-initializer-production[.]mjs source/g,
  )
  assert.match(
    deploymentWorkflow,
    /node scripts\/supabase\/run-line-pay-checkout-initializer-exact-file[.]mjs preflight/,
  )
  assert.match(
    deploymentWorkflow,
    /node scripts\/supabase\/run-line-pay-checkout-initializer-exact-file[.]mjs deploy/,
  )
  assert.equal(
    (
      deploymentWorkflow.match(
        /run-line-pay-checkout-initializer-exact-file[.]mjs deploy/g,
      ) ?? []
    ).length,
    1,
  )
  assert.doesNotMatch(
    deploymentWorkflow,
    /^\s{6}(?:sql|path|file|command|args|runtime|feature_flag):/m,
  )
})

test('diagnostic workflow remains a separate one-session read-only channel', () => {
  assert.match(
    diagnosticWorkflow,
    /group: supabase-production-line-pay-checkout-initializer-diagnostic\n  cancel-in-progress: false/,
  )
  assert.match(
    diagnosticWorkflow,
    /Run one fixed read-only initializer application-state diagnostic session/,
  )
  assert.equal(
    (
      diagnosticWorkflow.match(
        /node scripts\/supabase\/run-line-pay-checkout-initializer-application-state[.]mjs/g,
      ) ?? []
    ).length,
    1,
  )
  assert.doesNotMatch(diagnosticWorkflow, /migration_sha256:|backup_restore_point_confirmation:/)
})

test('actions and Node runtimes are pinned exactly', () => {
  for (const workflow of [deploymentWorkflow, diagnosticWorkflow]) {
    const uses = [...workflow.matchAll(/^\s+uses:\s+([^\s]+)$/gm)].map(
      (match) => match[1],
    )
    assert.ok(uses.length >= 2)
    for (const use of uses) assert.match(use, /@[0-9a-f]{40}$/)
    assert.doesNotMatch(workflow, /node-version:\s*"(?:24|24[.]x)"/)
  }
  assert.equal(
    (deploymentWorkflow.match(/node-version: "24[.]16[.]0"/g) ?? []).length,
    2,
  )
  assert.equal(
    (diagnosticWorkflow.match(/node-version: "24[.]16[.]0"/g) ?? []).length,
    2,
  )
})

test('LINE Pay DB CI watches and runs initializer Production safety contracts', () => {
  for (const path of [
    deploymentWorkflowPath,
    diagnosticWorkflowPath,
    'scripts/supabase/validate-line-pay-checkout-initializer-production.mjs',
    'scripts/supabase/run-line-pay-checkout-initializer-exact-file.mjs',
    'scripts/supabase/run-line-pay-checkout-initializer-application-state.mjs',
    'supabase/deployment/line_pay_checkout_aggregate_initialization_application_state.sql',
    'supabase/deployment/line_pay_checkout_aggregate_initialization_preflight.sql',
    'supabase/deployment/line_pay_checkout_aggregate_initialization_postflight.sql',
    'supabase/deployment/line_pay_checkout_aggregate_initialization_deploy.sql',
    'supabase/line_pay_checkout_initializer_production_workflow.test.ts',
    'supabase/line_pay_checkout_initializer_production_runner.test.ts',
    'supabase/tests/run_line_pay_checkout_initializer_production_contracts.mjs',
  ]) {
    assert.ok(ci.includes(`"${path}"`) || ci.includes(path), path)
  }
})
