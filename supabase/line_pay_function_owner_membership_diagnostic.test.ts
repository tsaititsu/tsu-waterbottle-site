import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test, { before } from 'node:test'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const validatorPath = join(
  root,
  'scripts/supabase/validate-line-pay-function-owner-membership-diagnostic.mjs',
)
const runnerPath = join(
  root,
  'scripts/supabase/run-line-pay-function-owner-membership-diagnostic.mjs',
)
const diagnosticPath =
  'supabase/deployment/line_pay_function_owner_membership_diagnostic.sql'
const workflowPath =
  '.github/workflows/supabase-production-line-pay-function-owner-membership-diagnostic.yml'
let validator: any

before(async () => {
  validator = await import(pathToFileURL(validatorPath).href)
})

function membershipFixture(overrides: Record<string, any> = {}) {
  return {
    status:
      'LINE_PAY_FUNCTION_OWNER_MEMBERSHIP_DIAGNOSTIC_COMPLETED',
    database_identity_match: true,
    role_present: true,
    membership: {
      total_edges: 1,
      owner_as_granted_role_edges: 1,
      owner_as_member_role_edges: 0,
      granted_to_current_user_edges: 1,
      granted_to_executor_edges: 0,
      granted_to_runtime_role_edges: 0,
      granted_to_other_edges: 0,
      owner_member_of_current_user_edges: 0,
      owner_member_of_executor_edges: 0,
      owner_member_of_runtime_role_edges: 0,
      owner_member_of_other_edges: 0,
      granted_by_current_user_edges: 1,
      granted_by_owner_edges: 0,
      granted_by_other_edges: 0,
      admin_option_edges: 1,
      inherit_option_edges: 0,
      set_option_edges: 0,
    },
    decision: {
      detail_complete: true,
      membership_absent: false,
      single_current_user_grant_only: true,
      manual_review_required: false,
    },
    ...overrides,
  }
}

test('membership diagnostic SQL is digest-sealed, catalog-only, and read-only', () => {
  const sql = readFileSync(diagnosticPath, 'utf8')
  assert.equal(validator.assertMembershipDiagnosticSql(sql), true)
  assert.equal(
    createHash('sha256').update(sql).digest('hex'),
    validator.EXPECTED_DIAGNOSTIC_SHA256,
  )
  assert.match(
    sql,
    /^BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;$/mu,
  )
  assert.match(sql, /^ROLLBACK;$/mu)
  assert.match(sql, /pg_catalog[.]pg_auth_members/u)
  assert.match(sql, /membership[.]admin_option/u)
  assert.match(sql, /membership[.]inherit_option/u)
  assert.match(sql, /membership[.]set_option/u)
  assert.match(sql, /membership[.]grantor/u)
  assert.doesNotMatch(sql, /^\\(?:i|ir|copy|!|o|w)\b/mu)
  assert.doesNotMatch(
    validator.stripSqlForStaticAnalysis(sql),
    /\b(?:insert|update|delete|merge|truncate|create|alter|drop|grant|revoke|lock\s+table)\b/iu,
  )
  assert.doesNotMatch(
    validator.stripSqlForStaticAnalysis(sql),
    /\bfrom\s+(?:public|line_pay_private)[.]/iu,
  )
})

test('static mutations cannot weaken membership probes or expose raw identities', () => {
  const sql = readFileSync(diagnosticPath, 'utf8')
  const mutations = [
    sql.replace(
      'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;',
      'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;',
    ),
    sql.replace('\nROLLBACK;\n', '\nCOMMIT;\n'),
    sql.replace(
      '\nROLLBACK;\n',
      '\ngrant line_pay_payment_function_owner to service_role;\nROLLBACK;\n',
    ),
    sql.replaceAll('membership.admin_option', 'false'),
    sql.replaceAll('membership.inherit_option', 'false'),
    sql.replaceAll('membership.set_option', 'false'),
    sql.replaceAll('membership.grantor', 'membership.member'),
    sql.replace(
      'as granted_to_other_edges',
      'as role_name',
    ),
  ]
  assert.equal(mutations.length, 8)
  for (const mutation of mutations) {
    assert.throws(
      () => validator.assertMembershipDiagnosticSql(mutation),
      /MEMBERSHIP_DIAGNOSTIC_SQL_INVALID/,
    )
  }
})

test('parser accepts a bounded single-current-user membership and freezes it', () => {
  const parsed = validator.parseAndValidateMembershipDiagnosticOutput(
    `${JSON.stringify(membershipFixture())}\n`,
  )
  assert.equal(
    parsed.status,
    'LINE_PAY_FUNCTION_OWNER_MEMBERSHIP_DIAGNOSTIC_COMPLETED',
  )
  assert.equal(parsed.membership.total_edges, 1)
  assert.equal(
    parsed.decision.single_current_user_grant_only,
    true,
  )
  assert.equal(parsed.decision.manual_review_required, false)
  assert.ok(Object.isFrozen(parsed))
  assert.ok(Object.isFrozen(parsed.membership))
  assert.ok(Object.isFrozen(parsed.decision))
})

test('parser accepts absent membership only when every category is zero', () => {
  const zeroMembership = Object.fromEntries(
    Object.keys(membershipFixture().membership).map((key) => [key, 0]),
  )
  const parsed = validator.parseAndValidateMembershipDiagnosticOutput(
    JSON.stringify(
      membershipFixture({
        membership: zeroMembership,
        decision: {
          detail_complete: true,
          membership_absent: true,
          single_current_user_grant_only: false,
          manual_review_required: false,
        },
      }),
    ),
  )
  assert.equal(parsed.decision.membership_absent, true)
  assert.equal(parsed.membership.total_edges, 0)
})

test('parser marks reverse or unknown memberships for manual review', () => {
  const reverseMembership = {
    ...membershipFixture().membership,
    owner_as_granted_role_edges: 0,
    owner_as_member_role_edges: 1,
    granted_to_current_user_edges: 0,
    owner_member_of_other_edges: 1,
    granted_by_current_user_edges: 0,
    granted_by_other_edges: 1,
    admin_option_edges: 0,
  }
  const parsed = validator.parseAndValidateMembershipDiagnosticOutput(
    JSON.stringify(
      membershipFixture({
        membership: reverseMembership,
        decision: {
          detail_complete: true,
          membership_absent: false,
          single_current_user_grant_only: false,
          manual_review_required: true,
        },
      }),
    ),
  )
  assert.equal(parsed.membership.owner_as_member_role_edges, 1)
  assert.equal(parsed.decision.manual_review_required, true)
})

test('parser rejects inconsistent sums, decisions, extra keys, and sensitive output', () => {
  assert.throws(
    () =>
      validator.parseAndValidateMembershipDiagnosticOutput(
        JSON.stringify(
          membershipFixture({
            membership: {
              ...membershipFixture().membership,
              total_edges: 2,
            },
          }),
        ),
      ),
    /MEMBERSHIP_DIAGNOSTIC_OUTPUT_INVALID/,
  )
  assert.throws(
    () =>
      validator.parseAndValidateMembershipDiagnosticOutput(
        JSON.stringify(
          membershipFixture({
            membership: {
              ...membershipFixture().membership,
              admin_option_edges: 0,
            },
          }),
        ),
      ),
    /MEMBERSHIP_DIAGNOSTIC_OUTPUT_INVALID/,
  )
  assert.throws(
    () =>
      validator.parseAndValidateMembershipDiagnosticOutput(
        JSON.stringify(
          membershipFixture({
            decision: {
              ...membershipFixture().decision,
              manual_review_required: true,
            },
          }),
        ),
      ),
    /MEMBERSHIP_DIAGNOSTIC_OUTPUT_INVALID/,
  )
  assert.throws(
    () =>
      validator.parseAndValidateMembershipDiagnosticOutput(
        JSON.stringify({
          ...membershipFixture(),
          role_name: 'line_pay_payment_function_owner',
        }),
      ),
    /MEMBERSHIP_DIAGNOSTIC_OUTPUT_INVALID/,
  )
  assert.throws(
    () =>
      validator.parseAndValidateMembershipDiagnosticOutput(
        JSON.stringify({
          ...membershipFixture(),
          leaked: 'postgres://user:password@example.supabase.co/postgres',
        }),
      ),
    /MEMBERSHIP_DIAGNOSTIC_OUTPUT_INVALID/,
  )
})

test('workflow is manual-only, Environment-protected, pinned, and read-only', () => {
  const workflow = readFileSync(workflowPath, 'utf8')
  assert.equal(validator.assertWorkflowSource(workflow), true)
  assert.match(
    workflow,
    /^name: Supabase Production LINE Pay Function Owner Membership Diagnostic$/mu,
  )
  assert.match(workflow, /^on:\n  workflow_dispatch:$/mu)
  assert.match(workflow, /^permissions:\n  contents: read$/mu)
  assert.match(
    workflow,
    /^  group: supabase-production-line-pay-function-owner-membership-diagnostic$/mu,
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
    /runDiagnostic\(\{[\s\S]*diagnosticFile: DIAGNOSTIC_FILE[\s\S]*parseDiagnosticOutput: parseAndValidateMembershipDiagnosticOutput/u,
  )
  assert.doesNotMatch(
    runner,
    /\b(?:retry|fallback|supabase\s+(?:db|migration)|shell:\s*true)\b/iu,
  )
})

test('runner application name fits the PostgreSQL 63-byte limit', () => {
  const runner = readFileSync(runnerPath, 'utf8')
  const applicationName = runner.match(
    /applicationName:\s*\n\s*'([^']+)'/u,
  )?.[1]
  assert.ok(applicationName)
  assert.ok(Buffer.byteLength(applicationName, 'utf8') <= 63)
})

test('source validation locks confirmation, project, and immutable migrations', () => {
  assert.equal(
    validator.EXPECTED_CONFIRMATION,
    'RUN_LINE_PAY_FUNCTION_OWNER_MEMBERSHIP_DIAGNOSTIC_READ_ONLY_ONCE',
  )
  assert.equal(validator.EXPECTED_PROJECT_REF, 'ndbqoznvobmpkgxkiezz')
  assert.equal(validator.DIAGNOSTIC_FILE, diagnosticPath)
  assert.equal(
    validator.INITIALIZER_MIGRATION_FILE,
    'supabase/migrations/20260728053215_line_pay_checkout_aggregate_initialization.sql',
  )
  assert.equal(
    validator.EXPECTED_INITIALIZER_MIGRATION_SHA256,
    '2e2ef2cce41431e0dc638033c998b7b616cbdc2b3baefdcb59fbb68ba2adf551',
  )
  assert.equal(
    validator.BASE_MIGRATION_FILE,
    'supabase/migrations/20260719033404_line_pay_remediation_contracts.sql',
  )
  assert.equal(
    validator.EXPECTED_BASE_MIGRATION_SHA256,
    '8da1fb429aecb1c35b12a245b63907135dbe7c467ef0a5f069afd431d21e94b8',
  )
})
