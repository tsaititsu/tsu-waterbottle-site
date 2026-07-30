import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test, { before } from 'node:test'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const validatorPath = join(
  root,
  'scripts/supabase/validate-line-pay-checkout-initializer-contract-detail-diagnostic.mjs',
)
const runnerPath = join(
  root,
  'scripts/supabase/run-line-pay-checkout-initializer-contract-detail-diagnostic.mjs',
)
const diagnosticPath =
  'supabase/deployment/line_pay_checkout_initializer_contract_detail_diagnostic.sql'
const workflowPath =
  '.github/workflows/supabase-production-line-pay-checkout-initializer-contract-detail-diagnostic.yml'
let validator: any

before(async () => {
  validator = await import(pathToFileURL(validatorPath).href)
})

function detailFixture(overrides: Record<string, any> = {}) {
  return {
    status:
      'LINE_PAY_CHECKOUT_INITIALIZER_CONTRACT_DETAIL_DIAGNOSTIC_COMPLETED',
    database_identity_match: true,
    base_remediation_ready: true,
    inventory: {
      functions_present: 2,
      indexes_present: 1,
      policies_present: 3,
      table_select_grants_present: 2,
    },
    initializer_function: {
      signature_exact: true,
      security_exact: true,
      owner_exact: true,
      definition_exact: true,
      execute_acl_exact: true,
      runtime_execute_exact: true,
    },
    audit_function: {
      signature_exact: true,
      security_exact: true,
      owner_exact: true,
      definition_exact: true,
      execute_acl_exact: true,
      runtime_execute_exact: true,
    },
    index_contract: {
      exact: true,
    },
    policy_contract: {
      audit_insert_exact: true,
      items_select_exact: true,
      shipping_select_exact: true,
    },
    table_acl_contract: {
      items_select_exact: true,
      shipping_select_exact: true,
      no_items_write: true,
      no_shipping_write: true,
      aggregate_select_acl_exact: true,
      no_role_issued_acl: true,
      audit_table_acl_exact: true,
      service_role_audit_access_absent: true,
    },
    role_contract: {
      function_owner_membership_absent: true,
    },
    decision: {
      initializer_exact: true,
      recovery_required: false,
      detail_complete: true,
    },
    ...overrides,
  }
}

test('detail diagnostic SQL is digest-sealed, catalog-only, and read-only', () => {
  const sql = readFileSync(diagnosticPath, 'utf8')
  assert.equal(validator.assertContractDetailDiagnosticSql(sql), true)
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
  assert.doesNotMatch(
    validator.stripSqlForStaticAnalysis(sql),
    /\bfrom\s+(?:public|line_pay_private)[.]/iu,
  )
})

test('static mutations cannot weaken detail probes or expose raw metadata', () => {
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
    sql.replaceAll(
      'pg_catalog.pg_get_functiondef',
      'pg_catalog.current_query',
    ),
    sql.replaceAll('pg_catalog.pg_get_expr', 'pg_catalog.current_query'),
    sql.replaceAll(
      'pg_catalog.aclexplode',
      'pg_catalog.pg_get_functiondef',
    ),
    sql.replace("'initializer_function',", ''),
    sql.replace("'audit_table_acl_exact',", ''),
  ]
  assert.equal(mutations.length, 8)
  for (const mutation of mutations) {
    assert.throws(
      () => validator.assertContractDetailDiagnosticSql(mutation),
      /INITIALIZER_DETAIL_DIAGNOSTIC_SQL_INVALID/,
    )
  }
})

test('parser accepts one bounded safe detail object and deeply freezes it', () => {
  const parsed = validator.parseAndValidateContractDetailOutput(
    `${JSON.stringify(detailFixture())}\n`,
  )
  assert.equal(
    parsed.status,
    'LINE_PAY_CHECKOUT_INITIALIZER_CONTRACT_DETAIL_DIAGNOSTIC_COMPLETED',
  )
  assert.equal(parsed.inventory.functions_present, 2)
  assert.equal(parsed.initializer_function.definition_exact, true)
  assert.equal(parsed.table_acl_contract.audit_table_acl_exact, true)
  assert.equal(parsed.decision.initializer_exact, true)
  assert.ok(Object.isFrozen(parsed))
  assert.ok(Object.isFrozen(parsed.inventory))
  assert.ok(Object.isFrozen(parsed.initializer_function))
  assert.ok(Object.isFrozen(parsed.audit_function))
  assert.ok(Object.isFrozen(parsed.index_contract))
  assert.ok(Object.isFrozen(parsed.policy_contract))
  assert.ok(Object.isFrozen(parsed.table_acl_contract))
  assert.ok(Object.isFrozen(parsed.role_contract))
  assert.ok(Object.isFrozen(parsed.decision))
})

test('parser accepts a partial result only when derived decisions remain consistent', () => {
  const parsed = validator.parseAndValidateContractDetailOutput(
    JSON.stringify(
      detailFixture({
        policy_contract: {
          ...detailFixture().policy_contract,
          items_select_exact: false,
        },
        decision: {
          initializer_exact: false,
          recovery_required: true,
          detail_complete: true,
        },
      }),
    ),
  )
  assert.equal(parsed.policy_contract.items_select_exact, false)
  assert.equal(parsed.decision.initializer_exact, false)
  assert.equal(parsed.decision.recovery_required, true)
})

test('parser marks detail incomplete when base remediation is not ready', () => {
  const unavailableBooleans = {
    signature_exact: false,
    security_exact: false,
    owner_exact: false,
    definition_exact: false,
    execute_acl_exact: false,
    runtime_execute_exact: false,
  }
  const parsed = validator.parseAndValidateContractDetailOutput(
    JSON.stringify(
      detailFixture({
        base_remediation_ready: false,
        inventory: {
          functions_present: 0,
          indexes_present: 0,
          policies_present: 0,
          table_select_grants_present: 0,
        },
        initializer_function: unavailableBooleans,
        audit_function: unavailableBooleans,
        index_contract: { exact: false },
        policy_contract: {
          audit_insert_exact: false,
          items_select_exact: false,
          shipping_select_exact: false,
        },
        table_acl_contract: {
          items_select_exact: false,
          shipping_select_exact: false,
          no_items_write: false,
          no_shipping_write: false,
          aggregate_select_acl_exact: false,
          no_role_issued_acl: false,
          audit_table_acl_exact: false,
          service_role_audit_access_absent: false,
        },
        role_contract: {
          function_owner_membership_absent: false,
        },
        decision: {
          initializer_exact: false,
          recovery_required: false,
          detail_complete: false,
        },
      }),
    ),
  )
  assert.equal(parsed.base_remediation_ready, false)
  assert.equal(parsed.decision.initializer_exact, false)
  assert.equal(parsed.decision.recovery_required, false)
  assert.equal(parsed.decision.detail_complete, false)

  assert.throws(
    () =>
      validator.parseAndValidateContractDetailOutput(
        JSON.stringify({
          ...parsed,
          decision: {
            ...parsed.decision,
            detail_complete: true,
          },
        }),
      ),
    /INITIALIZER_DETAIL_DIAGNOSTIC_OUTPUT_INVALID/,
  )
})

test('parser rejects inconsistent decisions, extra keys, and sensitive output', () => {
  assert.throws(
    () =>
      validator.parseAndValidateContractDetailOutput(
        JSON.stringify(
          detailFixture({
            initializer_function: {
              ...detailFixture().initializer_function,
              definition_exact: false,
            },
          }),
        ),
      ),
    /INITIALIZER_DETAIL_DIAGNOSTIC_OUTPUT_INVALID/,
  )
  assert.throws(
    () =>
      validator.parseAndValidateContractDetailOutput(
        JSON.stringify({
          ...detailFixture(),
          raw_expression: 'private metadata',
        }),
      ),
    /INITIALIZER_DETAIL_DIAGNOSTIC_OUTPUT_INVALID/,
  )
  assert.throws(
    () =>
      validator.parseAndValidateContractDetailOutput(
        JSON.stringify({
          ...detailFixture(),
          leaked: 'postgres://user:password@example.supabase.co/postgres',
        }),
      ),
    /INITIALIZER_DETAIL_DIAGNOSTIC_OUTPUT_INVALID/,
  )
})

test('workflow is manual-only, Environment-protected, pinned, and read-only', () => {
  const workflow = readFileSync(workflowPath, 'utf8')
  assert.equal(validator.assertWorkflowSource(workflow), true)
  assert.match(
    workflow,
    /^name: Supabase Production LINE Pay Checkout Initializer Contract Detail Diagnostic$/mu,
  )
  assert.match(workflow, /^on:\n  workflow_dispatch:$/mu)
  assert.match(workflow, /^permissions:\n  contents: read$/mu)
  assert.match(
    workflow,
    /^  group: supabase-production-line-pay-checkout-initializer-contract-detail-diagnostic$/mu,
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
    /runDiagnostic\(\{[\s\S]*diagnosticFile: DIAGNOSTIC_FILE[\s\S]*parseDiagnosticOutput: parseAndValidateContractDetailOutput/u,
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
    'RUN_LINE_PAY_CHECKOUT_INITIALIZER_CONTRACT_DETAIL_DIAGNOSTIC_READ_ONLY_ONCE',
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
