import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const workflowPath =
  '.github/workflows/supabase-production-line-pay-migration.yml'
const workflow = readFileSync(join(root, workflowPath), 'utf8')
const ci = readFileSync(
  join(root, '.github/workflows/line-pay-db-contract-ci.yml'),
  'utf8',
)

test('Production workflow is manual-only with least privilege and fixed concurrency', () => {
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
  assert.match(
    workflow,
    /group: supabase-production-line-pay-migration\n  cancel-in-progress: false/,
  )
  assert.doesNotMatch(workflow, /\bmatrix:|continue-on-error:|max-parallel:/)
})

test('workflow fixes inputs, source identity, Environment, Secret, and variable gate', () => {
  for (const input of [
    'authorized_commit:',
    'project_ref:',
    'migration_sha256:',
    'confirmation:',
  ]) {
    assert.ok(workflow.includes(input))
  }
  assert.match(workflow, /environment:\n      name: supabase-production/)
  assert.match(
    workflow,
    /secrets\.SUPABASE_PRODUCTION_DB_URL/,
  )
  assert.match(
    workflow,
    /vars\.SUPABASE_PRODUCTION_CHANNEL_READY/,
  )
  assert.doesNotMatch(workflow, /secrets\.SUPABASE_DB_URL\b/)
  assert.doesNotMatch(workflow, /secrets\.SUPABASE_PROJECT_ID\b/)
  assert.doesNotMatch(workflow, /repository[_ -]?secret|secrets\.\*/i)
  assert.match(workflow, /GITHUB_SHA: \$\{\{ github\.sha \}\}/)
  assert.match(workflow, /GITHUB_REF: \$\{\{ github\.ref \}\}/)
})

test('workflow actions and both Node runtimes are pinned exactly', () => {
  const actionUses = [...workflow.matchAll(/^\s+uses:\s+([^\s]+)$/gm)].map(
    (match) => match[1],
  )
  assert.ok(actionUses.length >= 2)
  for (const use of actionUses) {
    assert.match(use, /@[0-9a-f]{40}$/)
  }
  assert.equal((workflow.match(/node-version: "24[.]16[.]0"/g) ?? []).length, 2)
  assert.doesNotMatch(workflow, /node-version:\s*"(?:24|24[.]x)"/)
  assert.equal((ci.match(/node-version: "24[.]16[.]0"/g) ?? []).length, 1)
  assert.doesNotMatch(ci, /node-version:\s*"(?:24|24[.]x)"/)
  assert.equal(
    (
      workflow.match(
        /node scripts\/supabase\/validate-line-pay-production-deployment[.]mjs node/g,
      ) ?? []
    ).length,
    2,
  )
})

test('workflow has one fixed deploy database invocation and no stale migration phase', () => {
  assert.match(
    workflow,
    /name: Run attested locked guard, exact Migration, and manifest postflight/,
  )
  assert.equal(
    (
      workflow.match(
        /node scripts\/supabase\/run-line-pay-production-exact-file[.]mjs deploy/g,
      ) ?? []
    ).length,
    1,
  )
  assert.doesNotMatch(
    workflow,
    /run-line-pay-production-exact-file[.]mjs (?:migration|postflight)/,
  )
  assert.doesNotMatch(
    workflow,
    /\bsupabase\s+(?:db|migration)|run:\s*(?:sudo\s+)?psql\b|\bcurl\b|\bretry\b|workflow_call|base64|<<[-~]?['"]?[A-Z_]+/,
  )
})

test('workflow uses only the reviewed PostgreSQL 17 image digest', () => {
  assert.match(
    workflow,
    /postgres@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193/,
  )
  assert.doesNotMatch(
    workflow,
    /apt-get|apt[.]postgresql[.]org|postgresql-client|validate-line-pay-production-deployment[.]mjs psql/,
  )
})

test('workflow never accepts SQL, path, command, or a runtime-enablement input', () => {
  assert.doesNotMatch(
    workflow,
    /^\s{6}(?:sql|path|file|command|args|runtime|feature_flag):/m,
  )
  assert.doesNotMatch(
    workflow,
    /LINE_PAY_ENABLED|LINE_PAY_TRANSPORT|vercel|api-pay\.line\.me|gateway/i,
  )
})

test('LINE Pay contract CI watches and executes all new safety contracts', () => {
  for (const path of [
    workflowPath,
    'scripts/supabase/validate-line-pay-production-deployment.mjs',
    'scripts/supabase/run-line-pay-production-exact-file.mjs',
    'supabase/deployment/line_pay_remediation_preflight.sql',
    'supabase/deployment/line_pay_remediation_postflight.sql',
    'supabase/deployment/line_pay_remediation_deploy.sql',
    'supabase/line_pay_production_exact_file_runner.test.ts',
    'supabase/line_pay_production_deployment_workflow.test.ts',
    'supabase/tests/run_line_pay_production_exact_file_contracts.mjs',
  ]) {
    assert.ok(ci.includes(`"${path}"`) || ci.includes(path), path)
  }
  assert.match(
    ci,
    /node --test supabase\/line_pay_production_exact_file_runner\.test\.ts/,
  )
  assert.match(
    ci,
    /node --test supabase\/line_pay_production_deployment_workflow\.test\.ts/,
  )
  assert.match(
    ci,
    /node supabase\/tests\/run_line_pay_production_exact_file_contracts\.mjs/,
  )
  assert.match(
    ci,
    /label=task=line-pay-production-exact-file-runner/g,
  )
})

test('retired emergency workflow remains absent', () => {
  assert.throws(() =>
    readFileSync(
      join(root, '.github/workflows/supabase-emergency-profiles-acl.yml'),
      'utf8',
    ),
  )
})
