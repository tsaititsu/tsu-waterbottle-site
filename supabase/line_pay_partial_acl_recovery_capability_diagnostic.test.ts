import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test, { before } from 'node:test'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const validatorPath = join(
  root,
  'scripts/supabase/validate-line-pay-partial-acl-recovery-capability-diagnostic.mjs',
)
const runnerPath = join(
  root,
  'scripts/supabase/run-line-pay-partial-acl-recovery-capability-diagnostic.mjs',
)
const diagnosticPath =
  'supabase/deployment/line_pay_partial_acl_recovery_capability_diagnostic.sql'
const workflowPath =
  '.github/workflows/supabase-production-line-pay-partial-acl-recovery-capability-diagnostic.yml'
let validator: any

before(async () => {
  validator = await import(pathToFileURL(validatorPath).href)
})

function capabilityFixture(overrides: Record<string, any> = {}) {
  return {
    status:
      'LINE_PAY_PARTIAL_RECOVERY_CAPABILITY_DIAGNOSTIC_COMPLETED',
    database_identity_match: true,
    inventory: {
      relations_present: 9,
      roles_present: 2,
    },
    role_capability: {
      function_owner_membership_present: true,
      function_owner_admin_option_present: true,
      function_owner_inherit_option_present: false,
      function_owner_set_option_present: false,
      executor_membership_present: true,
      executor_admin_option_present: true,
      role_bridge_grant_precondition_met: true,
    },
    ownership: {
      payments_owned_by_current_user: true,
      product_orders_owned_by_current_user: true,
      private_schema_present: true,
      private_schema_owned_by_current_user: false,
      private_schema_owned_by_function_owner: true,
      completion_proofs_owned_by_current_user: false,
      completion_proofs_owned_by_function_owner: true,
    },
    acl_probe: {
      active_runtime_write_acl_present: true,
      line_pay_runtime_acl_drift_present: true,
      private_schema_explicit_acl_present: true,
    },
    decision: {
      recovery_expected_to_need_role_bridge: true,
      role_bridge_available: true,
      active_relation_owner_precondition_met: true,
      diagnostic_supports_next_recovery_decision: true,
    },
    ...overrides,
  }
}

test('capability diagnostic SQL is digest-sealed and read-only', () => {
  const sql = readFileSync(diagnosticPath, 'utf8')
  assert.equal(validator.assertCapabilityDiagnosticSql(sql), true)
  assert.equal(
    createHash('sha256').update(sql).digest('hex'),
    validator.EXPECTED_DIAGNOSTIC_SHA256,
  )
  assert.match(
    sql,
    /^BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;$/mu,
  )
  assert.match(sql, /^ROLLBACK;$/mu)
  assert.doesNotMatch(sql, /^\\(?:i|ir|copy|!|o|w)\b/mu)
  assert.doesNotMatch(
    validator.stripSqlForStaticAnalysis(sql),
    /\b(?:insert|update|delete|merge|truncate|create|alter|drop|grant|revoke|lock\s+table)\b/iu,
  )
})

test('static mutations cannot weaken read-only capability probes', () => {
  const sql = readFileSync(diagnosticPath, 'utf8')
  const mutations = [
    sql.replace(
      'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;',
      'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;',
    ),
    sql.replace('\nROLLBACK;\n', '\nCOMMIT;\n'),
    sql.replace(
      '\nROLLBACK;\n',
      '\ngrant select on public.payments to anon;\nROLLBACK;\n',
    ),
    sql.replaceAll('membership.admin_option', 'true'),
    sql.replaceAll('membership.set_option', 'false'),
    sql.replace('pg_catalog.aclexplode', 'pg_catalog.pg_get_functiondef'),
    sql.replace("'role_bridge_grant_precondition_met',", ''),
  ]
  assert.equal(mutations.length, 7)
  for (const mutation of mutations) {
    assert.throws(
      () => validator.assertCapabilityDiagnosticSql(mutation),
      /CAPABILITY_DIAGNOSTIC_SQL_INVALID/,
    )
  }
})

test('parser accepts only bounded safe booleans and counts', () => {
  const parsed = validator.parseAndValidateCapabilityDiagnosticOutput(
    `${JSON.stringify(capabilityFixture())}\n`,
  )
  assert.equal(
    parsed.status,
    'LINE_PAY_PARTIAL_RECOVERY_CAPABILITY_DIAGNOSTIC_COMPLETED',
  )
  assert.equal(parsed.inventory.relations_present, 9)
  assert.equal(
    parsed.role_capability.role_bridge_grant_precondition_met,
    true,
  )
  assert.equal(parsed.decision.role_bridge_available, true)
  assert.ok(Object.isFrozen(parsed))
  assert.ok(Object.isFrozen(parsed.role_capability))
  assert.ok(Object.isFrozen(parsed.ownership))
})

test('parser rejects inconsistent derived decisions and sensitive output', () => {
  assert.throws(
    () =>
      validator.parseAndValidateCapabilityDiagnosticOutput(
        `${JSON.stringify(
          capabilityFixture({
            role_capability: {
              ...capabilityFixture().role_capability,
              role_bridge_grant_precondition_met: false,
            },
          }),
        )}\n`,
      ),
    /CAPABILITY_DIAGNOSTIC_OUTPUT_INVALID/,
  )
  assert.throws(
    () =>
      validator.parseAndValidateCapabilityDiagnosticOutput(
        JSON.stringify({
          ...capabilityFixture(),
          leaked: 'postgres://user:password@example.supabase.co/postgres',
        }),
      ),
    /CAPABILITY_DIAGNOSTIC_OUTPUT_INVALID/,
  )
})

test('workflow is manual-only, protected, pinned, and read-only', () => {
  const workflow = readFileSync(workflowPath, 'utf8')
  assert.equal(validator.assertWorkflowSource(workflow), true)
  assert.match(
    workflow,
    /^name: Supabase Production LINE Pay Partial ACL Recovery Capability Diagnostic$/mu,
  )
  assert.match(workflow, /^on:\n  workflow_dispatch:$/mu)
  assert.match(workflow, /^permissions:\n  contents: read$/mu)
  assert.match(
    workflow,
    /^  group: supabase-production-line-pay-partial-acl-recovery-capability-diagnostic$/mu,
  )
  assert.equal(
    (workflow.match(/environment:\n      name: supabase-production/gu) ?? [])
      .length,
    1,
  )
  assert.doesNotMatch(
    workflow,
    /^\s{2}(?:push|pull_request|schedule|workflow_call|repository_dispatch):/mu,
  )
  assert.doesNotMatch(
    workflow,
    /\bpsql\b|supabase\s+(?:db|migration)|run-line-pay-production-exact-file/iu,
  )
})

test('runner delegates exactly one read-only diagnostic session', () => {
  const runner = readFileSync(runnerPath, 'utf8')
  assert.equal(validator.assertRunnerSource(runner), true)
  assert.match(
    runner,
    /runDiagnostic\(\{[\s\S]*diagnosticFile: DIAGNOSTIC_FILE[\s\S]*parseDiagnosticOutput: parseAndValidateCapabilityDiagnosticOutput/u,
  )
  assert.doesNotMatch(
    runner,
    /\b(?:retry|fallback|supabase\s+(?:db|migration)|shell:\s*true)\b/iu,
  )
})

test('source validation locks confirmation, project, and fixed files', () => {
  assert.equal(
    validator.EXPECTED_CONFIRMATION,
    'RUN_LINE_PAY_PARTIAL_ACL_RECOVERY_CAPABILITY_DIAGNOSTIC_READ_ONLY_ONCE',
  )
  assert.equal(validator.EXPECTED_PROJECT_REF, 'ndbqoznvobmpkgxkiezz')
  assert.equal(validator.DIAGNOSTIC_FILE, diagnosticPath)
  assert.equal(
    validator.RECOVERY_MIGRATION_FILE,
    'supabase/migrations/20260729130000_line_pay_partial_acl_metadata_recovery.sql',
  )
  assert.equal(
    validator.EXPECTED_RECOVERY_MIGRATION_SHA256,
    '30c3a4919d30c756469149cbfc3310431b9c049c5ff7b59cdad8e5ce19fe92d4',
  )
})
