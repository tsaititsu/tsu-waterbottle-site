import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { before, describe, it } from 'node:test'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '..')
const validatorPath = join(
  root,
  'scripts/supabase/validate-line-pay-partial-acl-metadata-recovery.mjs',
)
const recoveryMigrationPath =
  'supabase/migrations/20260729130000_line_pay_partial_acl_metadata_recovery.sql'
const preflightPath =
  'supabase/deployment/line_pay_partial_acl_metadata_recovery_preflight.sql'
const deployPath =
  'supabase/deployment/line_pay_partial_acl_metadata_recovery_deploy.sql'
const workflowPath =
  '.github/workflows/supabase-production-line-pay-partial-acl-recovery.yml'
const recoverySql = readFileSync(join(root, recoveryMigrationPath), 'utf8')
const preflightSql = readFileSync(join(root, preflightPath), 'utf8')
const deploySql = readFileSync(join(root, deployPath), 'utf8')
const workflow = readFileSync(join(root, workflowPath), 'utf8')
let validator: any

before(async () => {
  validator = await import(pathToFileURL(validatorPath).href)
})

function diagnosticOutput(applicationState: string, categories: string[] = []) {
  const incompleteCategories = categories.map((category) => ({
    category,
    expected_count: category === 'existing_relation_access' ? 2 : 7,
    actual_count: category === 'existing_relation_access' ? 2 : 7,
    count_matches: true,
    metadata_matches: false,
  }))
  return `${JSON.stringify({
    status: 'APPLICATION_STATE_DIAGNOSTIC_COMPLETED',
    database_identity_match: true,
    migration_history: {
      table_present: true,
      version_present: false,
    },
    inventory: {
      relations_present: 7,
      functions_present: 21,
      triggers_present: 11,
      indexes_present: 39,
      policies_present: 14,
      columns_present: 127,
      constraints_present: 115,
      roles_present: 2,
    },
    contracts: {
      relations_complete: categories.length === 0,
      functions_complete: true,
      triggers_complete: true,
      indexes_complete: true,
      policies_complete: true,
      columns_complete: true,
      constraints_complete: true,
      roles_complete: true,
      acl_complete: !categories.includes('existing_relation_access'),
    },
    details: {
      incomplete_categories: incompleteCategories,
      relation_metadata: categories.includes('relations')
        ? [
            {
              identity: 'public.line_pay_checkout_attempts',
              present: true,
              owner_is_current_user: true,
              kind_is_table: true,
              persistence_is_permanent: true,
              rls_enabled: true,
              force_rls_enabled: false,
              replica_identity_default: true,
              explicit_acl_absent: false,
              comment_present: false,
            },
          ]
        : [],
      existing_relation_access: categories.includes(
        'existing_relation_access',
      )
        ? [
            {
              identity: 'public.payments',
              present: true,
              kind_is_table: true,
              rls_enabled: true,
              force_rls_enabled: false,
              explicit_acl_present: true,
              public_write_absent: true,
              anon_write_absent: false,
              authenticated_write_absent: false,
              service_role_write_absent: false,
            },
          ]
        : [],
    },
    application_state: applicationState,
  })}\n`
}

describe('LINE Pay partial ACL metadata recovery', () => {
  it('locks the exact recovery migration identity', () => {
    assert.equal(
      validator.RECOVERY_MIGRATION_FILE,
      'supabase/migrations/20260729130000_line_pay_partial_acl_metadata_recovery.sql',
    )
    assert.equal(
      validator.EXPECTED_RECOVERY_MIGRATION_SHA256,
      'f644a1b8b1c9d679e23a14b4e2936fb57d2049dab350fa297da94b9fa11d1ba5',
    )
    assert.equal(
      validator.EXPECTED_PREFLIGHT_SHA256,
      '5950af1a9e08ac21f31e93a4d9a372fa902eba36890caa7c6064b3acf08abefd',
    )
    assert.equal(
      validator.EXPECTED_DEPLOY_SHA256,
      'ed22f8a8d56931de716123ba0ed1d9182a7023e83416665119f86f56d442925b',
    )
    assert.equal(
      validator.EXPECTED_DIAGNOSTIC_SHA256,
      '6f0442e832d7137fa9f3ba6e8f8edd12a39c1242bbd1c824346dd9ac56e599fc',
    )
    validator.assertRecoverySql(recoverySql)
  })

  it('keeps the recovery workflow behind exact main and environment gates', () => {
    assert.equal(validator.EXPECTED_PROJECT_REF, 'ndbqoznvobmpkgxkiezz')
    assert.equal(
      validator.EXPECTED_CONFIRMATION,
      'DEPLOY_LINE_PAY_PARTIAL_ACL_METADATA_RECOVERY_EXACT_FILE_ONCE',
    )
    assert.match(workflow, /^name: Supabase Production LINE Pay Partial ACL Recovery$/mu)
    assert.match(workflow, /workflow_dispatch:/u)
    assert.doesNotMatch(workflow, /\npull_request:|\npush:|\nschedule:/u)
    assert.match(workflow, /environment:\n\s+name: supabase-production/u)
    assert.match(workflow, /RECOVERY_SHA256_INPUT: \$\{\{ inputs[.]recovery_sha256 \}\}/u)
    assert.match(workflow, /SUPABASE_PRODUCTION_DB_URL: \$\{\{ secrets[.]SUPABASE_PRODUCTION_DB_URL \}\}/u)
    assert.doesNotMatch(workflow, /supabase db push|migration up|apply-all/iu)
  })

  it('uses read-only preflight and exact recovery deploy orchestration', () => {
    validator.assertRecoveryDeploymentSql(preflightSql, deploySql)
    assert.match(preflightSql, /\\ir line_pay_application_state_diagnostic[.]sql/u)
    assert.doesNotMatch(preflightSql, /\\ir \.\.\/migrations/u)
    assert.match(
      deploySql,
      /\\ir \.\.\/migrations\/20260729130000_line_pay_partial_acl_metadata_recovery[.]sql/u,
    )
    assert.doesNotMatch(
      deploySql,
      /20260719033404_line_pay_remediation_contracts[.]sql/u,
    )
  })

  it('fails closed when recovery SQL loses ACL postconditions', () => {
    assert.throws(() =>
      validator.assertRecoverySql(
        recoverySql.replace(
          'line_pay_partial_recovery_public_write_postcondition_failed',
          'line_pay_partial_recovery_public_write_check_removed',
        ),
      ),
    )
  })

  it('accepts only targeted PARTIAL preflight output', () => {
    assert.equal(
      validator.parseAndValidateRecoveryPreflightOutput(
        diagnosticOutput('PARTIAL', [
          'existing_relation_access',
          'relations',
        ]),
      ).application_state,
      'PARTIAL',
    )
    assert.throws(() =>
      validator.parseAndValidateRecoveryPreflightOutput(
        diagnosticOutput('FULL_WITHOUT_HISTORY'),
      ),
    )
    assert.throws(() =>
      validator.parseAndValidateRecoveryPreflightOutput(
        diagnosticOutput('PARTIAL', ['functions']),
      ),
    )
  })

  it('accepts only FULL_WITHOUT_HISTORY postflight output', () => {
    assert.equal(
      validator.parseAndValidateRecoveryDeployOutput(
        diagnosticOutput('FULL_WITHOUT_HISTORY'),
      ).application_state,
      'FULL_WITHOUT_HISTORY',
    )
    assert.throws(() =>
      validator.parseAndValidateRecoveryDeployOutput(
        diagnosticOutput('PARTIAL', ['relations']),
      ),
    )
  })
})
