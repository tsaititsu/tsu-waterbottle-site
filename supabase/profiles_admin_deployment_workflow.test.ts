import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

type ValidatorModule = {
  EXPECTED_MIGRATION_SHA256: string
  MIGRATION_FILE: string
  assertMigrationStaticSafety: (sql: string) => true
  parseDeploymentStateJson: (text: string, mode: string) => string
  parsePostflightState: (text: string) => string
  parsePreflightState: (text: string) => {
    state: string
    shouldDeploy: boolean
  }
  stripSqlForStaticAnalysis: (sql: string) => string
  validateConfirmation: (value: string) => true
  validateFullSha: (value: string) => string
  validateMigrationHash: (value: string) => true
  validateTarget: (
    databaseUrl: string,
    projectId: string,
  ) => {
    connectionType: string
  }
}

const root = process.cwd()
const workflowPath = join(root, '.github/workflows/supabase-emergency-profiles-acl.yml')
const preflightPath = join(
  root,
  'supabase/deployment/profiles_admin_escalation_preflight.sql',
)
const postflightPath = join(
  root,
  'supabase/deployment/profiles_admin_escalation_postflight.sql',
)
const validatorPath = join(
  root,
  'scripts/supabase/validate-profiles-admin-deployment.mjs',
)
const migrationPath = join(
  root,
  'supabase/migrations/20260716084928_profiles_admin_escalation_fix.sql',
)

const workflow = readFileSync(workflowPath, 'utf8')
const preflight = readFileSync(preflightPath, 'utf8')
const postflight = readFileSync(postflightPath, 'utf8')
const validatorSource = readFileSync(validatorPath, 'utf8')
const migration = readFileSync(migrationPath, 'utf8')

function section(source: string, start: string, end?: string) {
  const startIndex = source.indexOf(start)
  assert.notEqual(startIndex, -1, `Missing section: ${start}`)
  const endIndex = end ? source.indexOf(end, startIndex + start.length) : source.length
  assert.notEqual(endIndex, -1, `Missing section end: ${end}`)
  return source.slice(startIndex, endIndex)
}

function sortedUnique(values: string[]) {
  return [...new Set(values)].sort()
}

function deploymentStateJson(state: unknown) {
  return JSON.stringify([
    {
      profiles_admin_deployment_state: state,
    },
  ])
}

function normalizePolicyExpressionFixture(expression: string) {
  return expression
    .toLowerCase()
    .replaceAll('public.is_admin', 'is_admin')
    .replace(/[\t\n\v\f\r ]+/g, '')
    .replace(/[()]/g, '')
}

async function main() {
  const validatorUrl = pathToFileURL(validatorPath).href
  const validator = (await import(validatorUrl)) as ValidatorModule
  let passed = 0

  function contract(name: string, assertion: () => void) {
    assertion()
    passed += 1
    return name
  }

  const onSection = section(workflow, 'on:\n', '\npermissions:')
  const permissionsSection = section(workflow, 'permissions:\n', '\nconcurrency:')
  const jobsSection = section(workflow, 'jobs:\n')
  const sourceJob = section(
    jobsSection,
    '  source-preflight:\n',
    '  deploy-production:\n',
  )
  const deployJob = section(jobsSection, '  deploy-production:\n')

  contract('run name identifies actor and trusted source SHA', () => {
    assert.match(workflow, /run-name: .*github[.]actor.*github[.]sha/)
    assert.doesNotMatch(workflow.split('\n')[1] ?? '', /secrets[.]/)
    assert.doesNotMatch(workflow.split('\n')[1] ?? '', /inputs[.]/)
  })

  contract('manual trigger only', () => {
    assert.match(onSection, /^\s{2}workflow_dispatch:\s*$/m)
    assert.doesNotMatch(
      onSection,
      /^\s{2}(push|pull_request|schedule|workflow_call|repository_dispatch):/m,
    )
  })

  contract('only approved inputs', () => {
    const inputs = [...onSection.matchAll(/^\s{6}([a-z][a-z0-9_]*):\s*$/gm)].map(
      (match) => match[1],
    )
    assert.deepEqual(inputs.sort(), ['confirmation', 'expected_main_sha'])
    assert.match(onSection, /description: Exact main commit SHA to deploy/)
    assert.match(onSection, /description: Type the required deployment confirmation/)
  })

  contract('read-only permissions', () => {
    assert.equal(permissionsSection.trim(), 'permissions:\n  contents: read')
    assert.doesNotMatch(workflow, /^\s+[a-z-]+:\s*write\s*$/m)
  })

  contract('fixed concurrency', () => {
    assert.match(
      workflow,
      /concurrency:\n  group: supabase-production-migrations\n  cancel-in-progress: false/,
    )
  })

  contract('only two jobs', () => {
    const jobs = [...jobsSection.matchAll(/^\s{2}([a-z][a-z0-9-]+):\s*$/gm)].map(
      (match) => match[1],
    )
    assert.deepEqual(jobs, ['source-preflight', 'deploy-production'])
  })

  contract('fixed runner and timeouts', () => {
    assert.equal((workflow.match(/runs-on: ubuntu-24[.]04/g) ?? []).length, 2)
    assert.equal((workflow.match(/timeout-minutes: 10/g) ?? []).length, 1)
    assert.equal((workflow.match(/timeout-minutes: 15/g) ?? []).length, 1)
    assert.doesNotMatch(workflow, /ubuntu-latest|self-hosted/)
  })

  contract('pinned actions only', () => {
    const actions = [...workflow.matchAll(/uses:\s*([^\s]+)/g)].map((match) => match[1])
    assert.deepEqual(actions, [
      'actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0',
      'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020',
      'actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0',
      'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020',
    ])
    assert.ok(actions.every((action) => /@[0-9a-f]{40}$/.test(action)))
  })

  contract('checkout is exact and credential-free', () => {
    assert.equal((workflow.match(/ref: \$\{\{ github[.]sha \}\}/g) ?? []).length, 2)
    assert.equal((workflow.match(/persist-credentials: false/g) ?? []).length, 2)
    assert.equal((workflow.match(/fetch-depth: 1/g) ?? []).length, 2)
  })

  contract('Node 24 is fixed', () => {
    assert.equal((workflow.match(/node-version: '24'/g) ?? []).length, 2)
  })

  contract('deploy depends on source preflight', () => {
    assert.match(deployJob, /needs:\n\s+- source-preflight/)
    assert.match(deployJob, /environment:\n\s+name: supabase-production/)
    assert.doesNotMatch(sourceJob, /\benvironment:/)
  })

  contract('source job is secret-free', () => {
    assert.doesNotMatch(sourceJob, /secrets[.]|SUPABASE_DB_URL|SUPABASE_PROJECT_ID/)
  })

  contract('only approved secrets are referenced', () => {
    const secretNames = sortedUnique(
      [...workflow.matchAll(/secrets[.]([A-Z0-9_]+)/g)].map((match) => match[1]),
    )
    assert.deepEqual(secretNames, ['SUPABASE_DB_URL', 'SUPABASE_PROJECT_ID'])
    assert.match(deployJob, /secrets[.]SUPABASE_DB_URL/)
    assert.match(deployJob, /secrets[.]SUPABASE_PROJECT_ID/)
  })

  contract('secrets are not logged', () => {
    assert.doesNotMatch(
      workflow,
      /^\s*(echo|printf).*(SUPABASE_DB_URL|SUPABASE_PROJECT_ID|secrets[.])/m,
    )
    assert.doesNotMatch(workflow, /\bset\s+-x\b/)
  })

  contract('all shell blocks fail closed', () => {
    const runBlocks = workflow.match(/run: \|/g) ?? []
    const strictModes = workflow.match(/set -euo pipefail/g) ?? []
    assert.ok(runBlocks.length > 0)
    assert.equal(strictModes.length, runBlocks.length)
  })

  contract('inputs are passed through environment variables', () => {
    assert.match(workflow, /EXPECTED_MAIN_SHA: \$\{\{ inputs[.]expected_main_sha \}\}/)
    assert.match(workflow, /DEPLOY_CONFIRMATION: \$\{\{ inputs[.]confirmation \}\}/)
    assert.doesNotMatch(workflow, /run:[^\n]*\$\{\{ inputs[.]/)
  })

  contract('fixed context gates are repeated', () => {
    assert.equal(
      (workflow.match(/tsaititsu\/tsu-waterbottle-site/g) ?? []).length,
      2,
    )
    assert.equal((workflow.match(/refs\/heads\/main/g) ?? []).length, 2)
    assert.equal(
      (workflow.match(/DEPLOY_PROFILES_ADMIN_ESCALATION_FIX/g) ?? []).length,
      2,
    )
    assert.equal((workflow.match(/\^\[0-9a-f\]\{40\}\$/g) ?? []).length, 2)
  })

  contract('migration identity is fixed', () => {
    assert.ok(
      (workflow.match(
        /supabase\/migrations\/20260716084928_profiles_admin_escalation_fix[.]sql/g,
      ) ?? []).length >= 3,
    )
    assert.ok(
      (workflow.match(
        /f7f2207135ffaf1dd3476108a38ffb95184410ad0fad962f4d0e71e9e9613e7d/g,
      ) ?? []).length >= 3,
    )
    assert.doesNotMatch(workflow, /MIGRATION_FILE:\s*\$\{\{/)
  })

  contract('only db query is used for database access', () => {
    assert.equal((workflow.match(/supabase db query/g) ?? []).length, 3)
    assert.doesNotMatch(
      workflow,
      /supabase\s+(?:db\s+(?:push|pull)|migration\s+(?:up|repair)|link|login|seed)\b/i,
    )
  })

  contract('write command uses only the fixed Migration', () => {
    assert.match(
      workflow,
      /node_modules\/[.]bin\/supabase db query \\\n\s+--db-url "\$SUPABASE_DB_URL" \\\n\s+--file "supabase\/migrations\/20260716084928_profiles_admin_escalation_fix[.]sql" \\\n\s+--log-level error/,
    )
    assert.doesNotMatch(workflow, /--file\s+"\$MIGRATION_FILE"/)
  })

  contract('preflight controls the only write', () => {
    assert.match(
      workflow,
      /if: steps[.]metadata-preflight[.]outputs[.]state == 'VULNERABLE_EXPECTED'/,
    )
    assert.match(workflow, /ALREADY_APPLIED|metadata-preflight/)
  })

  contract('metadata output is private and parsed', () => {
    assert.equal((workflow.match(/umask 077/g) ?? []).length, 3)
    assert.match(workflow, /--output-format json/)
    assert.doesNotMatch(workflow, /\btee\b/)
    assert.match(workflow, /metadata query failed/)
  })

  contract('both security tests run', () => {
    assert.match(workflow, /supabase\/profiles_admin_escalation_fix[.]test[.]ts/)
    assert.match(workflow, /supabase\/profiles_admin_deployment_workflow[.]test[.]ts/)
    assert.equal((workflow.match(/JITI_CACHE: 'false'/g) ?? []).length, 2)
    assert.equal((workflow.match(/JITI_REQUIRE_CACHE: 'false'/g) ?? []).length, 2)
  })

  contract('summary contains only approved categories', () => {
    assert.match(workflow, /是否讀取會員資料: 否/)
    assert.match(workflow, /是否寫入Migration history: 否/)
    assert.doesNotMatch(
      section(workflow, '- name: Write non-sensitive deployment summary'),
      /SUPABASE_DB_URL|SUPABASE_PROJECT_ID|secrets[.]/,
    )
  })

  const cleanedPreflight = validator.stripSqlForStaticAnalysis(preflight)
  const cleanedPostflight = validator.stripSqlForStaticAnalysis(postflight)
  const forbiddenMetadataSql =
    /\b(do|call|copy|create|alter|drop|grant|revoke|insert|update|delete|truncate|set\s+role)\b/i
  const expectedVulnerablePolicy = 'auth.uid=idoris_admin'
  const approvedAppliedPolicies = new Set([
    expectedVulnerablePolicy,
    'selectauth.uid=idorselectis_admin',
    'selectauth.uidasuid=idorselectis_adminasis_admin',
  ])

  contract('preflight is one read-only metadata statement', () => {
    assert.match(cleanedPreflight, /^\s*with\b/i)
    assert.doesNotMatch(cleanedPreflight, forbiddenMetadataSql)
    assert.equal((cleanedPreflight.match(/;/g) ?? []).length, 1)
  })

  contract('postflight is one read-only metadata statement', () => {
    assert.match(cleanedPostflight, /^\s*with\b/i)
    assert.doesNotMatch(cleanedPostflight, forbiddenMetadataSql)
    assert.equal((cleanedPostflight.match(/;/g) ?? []).length, 1)
  })

  contract('metadata SQL never reads member rows', () => {
    for (const cleanedSql of [cleanedPreflight, cleanedPostflight]) {
      assert.doesNotMatch(cleanedSql, /\bfrom\s+public[.]profiles\b/i)
      assert.doesNotMatch(cleanedSql, /\bauth[.]users\b/i)
    }
  })

  contract('metadata SQL uses approved catalogs and privilege checks', () => {
    for (const sql of [preflight, postflight]) {
      assert.match(sql, /pg_catalog[.]pg_policy/)
      assert.match(sql, /information_schema[.]columns/)
      assert.match(sql, /has_table_privilege/)
      assert.match(sql, /has_column_privilege/)
    }
  })

  contract('preflight has exactly the three fail-closed classifications', () => {
    assert.match(preflight, /VULNERABLE_EXPECTED/)
    assert.match(preflight, /ALREADY_APPLIED/)
    assert.match(preflight, /else 'DATABASE_DRIFT_DETECTED'/)
    assert.match(preflight, /select state as profiles_admin_deployment_state/)
    assert.doesNotMatch(preflight, /PROFILES_ADMIN_DEPLOYMENT_STATE=/)
    assert.doesNotMatch(preflight, /as deployment_state/)
  })

  contract('preflight distinguishes old and applied policy roles', () => {
    assert.match(preflight, /array\['public'\]::text\[\]/)
    assert.match(preflight, /array\['authenticated'\]::text\[\]/)
    assert.match(preflight, /not policy_facts[.]with_check_exists/)
    assert.match(preflight, /policy_facts[.]using_is_expected_vulnerable_policy/)
    assert.match(preflight, /policy_facts[.]using_is_approved_applied_policy/)
    assert.match(preflight, /policy_facts[.]with_check_is_approved_applied_policy/)
    assert.match(preflight, /policy_facts[.]policy_conditions_match/)
  })

  contract('postflight fails closed', () => {
    assert.match(postflight, /then 'POSTFLIGHT_OK'/)
    assert.match(postflight, /else 'POSTFLIGHT_FAILED'/)
    assert.match(postflight, /select state as profiles_admin_deployment_state/)
    assert.doesNotMatch(postflight, /PROFILES_ADMIN_DEPLOYMENT_STATE=/)
    assert.doesNotMatch(postflight, /as deployment_state/)
  })

  contract('postflight requires all authenticated column updates revoked', () => {
    assert.match(postflight, /not acl_facts[.]authenticated_update/)
    assert.match(postflight, /not acl_facts[.]authenticated_is_admin_update/)
    assert.match(postflight, /not acl_facts[.]authenticated_any_column_update/)
  })

  contract('policy normalization only lowers and removes approved syntax noise', () => {
    for (const sql of [preflight, postflight]) {
      assert.match(
        sql,
        /replace\(lower\(using_expression\), 'public[.]is_admin', 'is_admin'\)/,
      )
      assert.match(sql, /'\[\[:space:\]\]\+',\n\s+'',\n\s+'g'/)
      assert.match(sql, /'\[\(\)\]',\n\s+'',\n\s+'g'/)
      assert.doesNotMatch(
        sql,
        /\b(like|ilike|strpos|position|similar\s+to)\b|(?:^|[^!<>])~(?:[^=]|$)/i,
      )
    }
  })

  contract('policy SQL uses exact canonical equality and finite whitelists', () => {
    assert.match(
      preflight,
      /normalized_using_expression = 'auth[.]uid=idoris_admin'/,
    )

    for (const sql of [preflight, postflight]) {
      for (const canonical of approvedAppliedPolicies) {
        assert.ok(sql.includes(`'${canonical}'`))
      }
      assert.match(sql, /normalized_using_expression in \(/)
      assert.match(sql, /normalized_with_check_expression in \(/)
      assert.match(
        sql,
        /normalized_using_expression = normalized_with_check_expression/,
      )
    }
  })

  contract('old formal policy normalizes to its sole vulnerable canonical form', () => {
    assert.equal(
      normalizePolicyExpressionFixture('((auth.uid() = id) OR is_admin())'),
      expectedVulnerablePolicy,
    )
    assert.equal(
      normalizePolicyExpressionFixture(
        '((auth.uid() = id) OR public.is_admin())',
      ),
      expectedVulnerablePolicy,
    )
  })

  contract('approved applied policy renderings normalize into the finite whitelist', () => {
    const fixtures = [
      '((auth.uid() = id) OR is_admin())',
      '((SELECT auth.uid()) = id OR (SELECT is_admin()))',
      '((SELECT auth.uid() AS uid) = id OR (SELECT is_admin() AS is_admin))',
    ]

    assert.deepEqual(
      fixtures.map(normalizePolicyExpressionFixture),
      [...approvedAppliedPolicies],
    )
  })

  contract('policy normalization preserves every security-significant token', () => {
    assert.equal(
      normalizePolicyExpressionFixture(
        '((auth.uid()::text = id::text) OR is_admin()) AND TRUE',
      ),
      'auth.uid::text=id::textoris_adminandtrue',
    )
    assert.equal(
      normalizePolicyExpressionFixture(
        'NOT ((auth.uid() = id) OR public.is_admin())',
      ),
      'notauth.uid=idoris_admin',
    )
  })

  contract('malicious extra policy terms never enter an approved canonical set', () => {
    const maliciousFixtures = [
      '((auth.uid() = id) OR is_admin() OR 1 = 1)',
      '((auth.uid() = id) OR is_admin()) AND true',
      '((auth.uid() = id) OR is_admin()) OR true',
      "((auth.uid() = id) OR is_admin() OR auth.role() = 'authenticated')",
      '((auth.uid() = id) OR is_admin() OR auth.jwt() IS NOT NULL)',
      '((auth.uid() = id) OR is_admin() OR another_function())',
      '((auth.uid() = id) OR is_admin()) OR auth.uid() = id',
      'NOT ((auth.uid() = id) OR is_admin())',
      '((auth.uid()::text = id::text) OR is_admin())',
      'is_admin() OR auth.uid() = id',
      '((auth.uid() = id) AND is_admin())',
      '((SELECT auth.uid()) = id OR (SELECT is_admin())) AND id IS NOT NULL',
    ]

    for (const fixture of maliciousFixtures) {
      const normalized = normalizePolicyExpressionFixture(fixture)
      assert.notEqual(normalized, expectedVulnerablePolicy)
      assert.equal(approvedAppliedPolicies.has(normalized), false)
    }
  })

  contract('validator uses Node built-ins only', () => {
    const imports = [...validatorSource.matchAll(/^import .* from ['"]([^'"]+)['"]/gm)].map(
      (match) => match[1],
    )
    assert.ok(imports.length > 0)
    assert.ok(imports.every((specifier) => specifier.startsWith('node:')))
  })

  contract('validator parses JSON structurally without raw sentinel scanning', () => {
    assert.match(validatorSource, /JSON[.]parse\(text\)/)
    assert.match(validatorSource, /Array[.]isArray\(parsed\)/)
    assert.match(validatorSource, /Object[.]keys\(row\)/)
    assert.doesNotMatch(validatorSource, /SENTINEL_PATTERN|matchAll\(|extractUniqueSentinel/)
  })

  contract('valid full SHA passes', () => {
    const sha = 'a'.repeat(40)
    assert.equal(validator.validateFullSha(sha), sha)
  })

  contract('short SHA fails', () => {
    assert.throws(() => validator.validateFullSha('abcdef1'), /invalid-main-sha/)
  })

  contract('non-hex SHA fails', () => {
    assert.throws(() => validator.validateFullSha('z'.repeat(40)), /invalid-main-sha/)
  })

  contract('correct confirmation passes', () => {
    assert.equal(
      validator.validateConfirmation('DEPLOY_PROFILES_ADMIN_ESCALATION_FIX'),
      true,
    )
  })

  contract('wrong confirmation fails', () => {
    assert.throws(
      () => validator.validateConfirmation('DEPLOY_PROFILES_ADMIN_ESCALATION'),
      /invalid-confirmation/,
    )
  })

  contract('correct Migration hash passes', () => {
    assert.equal(
      validator.validateMigrationHash(validator.EXPECTED_MIGRATION_SHA256),
      true,
    )
  })

  contract('wrong Migration hash fails', () => {
    assert.throws(() => validator.validateMigrationHash('0'.repeat(64)), /invalid-migration-hash/)
  })

  const projectId = 'abcdefghijklmnopqrst'
  const directUrl =
    `postgresql://postgres:fake-password@db.${projectId}.supabase.co:5432/postgres` +
    '?sslmode=require'

  contract('valid direct database URL passes', () => {
    assert.deepEqual(validator.validateTarget(directUrl, projectId), {
      connectionType: 'direct',
    })
  })

  contract('postgres protocol also passes', () => {
    assert.deepEqual(
      validator.validateTarget(directUrl.replace('postgresql:', 'postgres:'), projectId),
      { connectionType: 'direct' },
    )
  })

  contract('project mismatch fails', () => {
    assert.throws(
      () => validator.validateTarget(directUrl, 'bbbbbbbbbbbbbbbbbbbb'),
      /target-project-mismatch/,
    )
  })

  contract('non-Supabase host fails', () => {
    assert.throws(
      () =>
        validator.validateTarget(
          'postgresql://postgres:fake-password@example.com:5432/postgres?sslmode=require',
          projectId,
        ),
      /target-project-mismatch/,
    )
  })

  contract('missing TLS mode fails', () => {
    assert.throws(
      () => validator.validateTarget(directUrl.replace('?sslmode=require', ''), projectId),
      /tls-required/,
    )
  })

  contract('unexpected query parameters fail', () => {
    assert.throws(
      () => validator.validateTarget(`${directUrl}&application_name=test`, projectId),
      /tls-required/,
    )
  })

  contract('VULNERABLE_EXPECTED permits deployment', () => {
    assert.deepEqual(
      validator.parsePreflightState(deploymentStateJson('VULNERABLE_EXPECTED')),
      {
        state: 'VULNERABLE_EXPECTED',
        shouldDeploy: true,
      },
    )
  })

  contract('ALREADY_APPLIED skips deployment', () => {
    assert.deepEqual(
      validator.parsePreflightState(deploymentStateJson('ALREADY_APPLIED')),
      {
        state: 'ALREADY_APPLIED',
        shouldDeploy: false,
      },
    )
  })

  contract('database drift fails', () => {
    assert.throws(
      () =>
        validator.parsePreflightState(deploymentStateJson('DATABASE_DRIFT_DETECTED')),
      /database-drift-detected/,
    )
  })

  contract('unknown preflight state fails', () => {
    assert.throws(
      () =>
        validator.parsePreflightState(deploymentStateJson('UNRECOGNIZED_STATE')),
      /invalid-metadata-result/,
    )
  })

  contract('POSTFLIGHT_OK passes', () => {
    assert.equal(
      validator.parsePostflightState(deploymentStateJson('POSTFLIGHT_OK')),
      'POSTFLIGHT_OK',
    )
  })

  contract('failed postflight fails', () => {
    assert.throws(
      () =>
        validator.parsePostflightState(deploymentStateJson('POSTFLIGHT_FAILED')),
      /postflight-validation-failed/,
    )
  })

  contract('unknown postflight state fails', () => {
    assert.throws(
      () =>
        validator.parsePostflightState(deploymentStateJson('UNRECOGNIZED_STATE')),
      /invalid-metadata-result/,
    )
  })

  contract('malformed JSON fails', () => {
    assert.throws(
      () => validator.parsePreflightState('not-json'),
      /invalid-metadata-result/,
    )
  })

  contract('truncated JSON fails', () => {
    assert.throws(
      () =>
        validator.parsePreflightState(
          '[{"profiles_admin_deployment_state":"VULNERABLE_EXPECTED"}',
        ),
      /invalid-metadata-result/,
    )
  })

  contract('valid JSON with trailing garbage fails', () => {
    assert.throws(
      () =>
        validator.parsePreflightState(
          `${deploymentStateJson('VULNERABLE_EXPECTED')} trailing`,
        ),
      /invalid-metadata-result/,
    )
  })

  contract('top-level object fails', () => {
    assert.throws(
      () =>
        validator.parsePreflightState(
          JSON.stringify({
            profiles_admin_deployment_state: 'VULNERABLE_EXPECTED',
          }),
        ),
      /invalid-metadata-result/,
    )
  })

  contract('empty top-level array fails', () => {
    assert.throws(
      () => validator.parsePreflightState('[]'),
      /invalid-metadata-result/,
    )
  })

  contract('duplicate rows fail', () => {
    assert.throws(
      () =>
        validator.parsePreflightState(
          JSON.stringify([
            {
              profiles_admin_deployment_state: 'VULNERABLE_EXPECTED',
            },
            {
              profiles_admin_deployment_state: 'ALREADY_APPLIED',
            },
          ]),
        ),
      /invalid-metadata-result/,
    )
  })

  contract('scalar row fails', () => {
    assert.throws(
      () => validator.parsePreflightState(JSON.stringify(['VULNERABLE_EXPECTED'])),
      /invalid-metadata-result/,
    )
  })

  contract('null row fails', () => {
    assert.throws(
      () => validator.parsePreflightState(JSON.stringify([null])),
      /invalid-metadata-result/,
    )
  })

  contract('array row fails', () => {
    assert.throws(
      () =>
        validator.parsePreflightState(
          JSON.stringify([['VULNERABLE_EXPECTED']]),
        ),
      /invalid-metadata-result/,
    )
  })

  contract('wrong result key fails', () => {
    assert.throws(
      () =>
        validator.parsePreflightState(
          JSON.stringify([
            {
              deployment_state: 'VULNERABLE_EXPECTED',
            },
          ]),
        ),
      /invalid-metadata-result/,
    )
  })

  contract('extra result key fails', () => {
    assert.throws(
      () =>
        validator.parsePreflightState(
          JSON.stringify([
            {
              profiles_admin_deployment_state: 'VULNERABLE_EXPECTED',
              extra: 'ignored',
            },
          ]),
        ),
      /invalid-metadata-result/,
    )
  })

  contract('non-string result value fails', () => {
    assert.throws(
      () => validator.parsePreflightState(deploymentStateJson(true)),
      /invalid-metadata-result/,
    )
  })

  contract('sentinel text embedded in an unrelated field fails', () => {
    assert.throws(
      () =>
        validator.parsePreflightState(
          JSON.stringify([
            {
              message:
                'PROFILES_ADMIN_DEPLOYMENT_STATE=VULNERABLE_EXPECTED',
            },
          ]),
        ),
      /invalid-metadata-result/,
    )
  })

  contract('postflight text embedded in an error field fails', () => {
    assert.throws(
      () =>
        validator.parsePostflightState(
          JSON.stringify([
            {
              error: 'POSTFLIGHT_OK',
            },
          ]),
        ),
      /invalid-metadata-result/,
    )
  })

  contract('nested result wrapper fails', () => {
    assert.throws(
      () =>
        validator.parsePreflightState(
          JSON.stringify({
            result: [
              {
                profiles_admin_deployment_state: 'VULNERABLE_EXPECTED',
              },
            ],
          }),
        ),
      /invalid-metadata-result/,
    )
  })

  contract('leading warning outside JSON fails', () => {
    assert.throws(
      () =>
        validator.parsePreflightState(
          `warning\n${deploymentStateJson('VULNERABLE_EXPECTED')}`,
        ),
      /invalid-metadata-result/,
    )
  })

  contract('one valid row plus one malicious row fails', () => {
    assert.throws(
      () =>
        validator.parsePreflightState(
          JSON.stringify([
            {
              profiles_admin_deployment_state: 'VULNERABLE_EXPECTED',
            },
            {
              message:
                'PROFILES_ADMIN_DEPLOYMENT_STATE=ALREADY_APPLIED',
            },
          ]),
        ),
      /invalid-metadata-result/,
    )
  })

  contract('pure JSON parser enforces mode-specific state whitelists', () => {
    assert.equal(
      validator.parseDeploymentStateJson(
        deploymentStateJson('ALREADY_APPLIED'),
        'preflight',
      ),
      'ALREADY_APPLIED',
    )
    assert.throws(
      () =>
        validator.parseDeploymentStateJson(
          deploymentStateJson('ALREADY_APPLIED'),
          'postflight',
        ),
      /invalid-metadata-result/,
    )
    assert.throws(
      () =>
        validator.parseDeploymentStateJson(
          deploymentStateJson('POSTFLIGHT_OK'),
          'preflight',
        ),
      /invalid-metadata-result/,
    )
  })

  contract('unknown parser mode fails closed', () => {
    assert.throws(
      () =>
        validator.parseDeploymentStateJson(
          deploymentStateJson('VULNERABLE_EXPECTED'),
          'unknown',
        ),
      /invalid-metadata-result/,
    )
  })

  contract('approved Migration passes the static SQL guard', () => {
    assert.equal(validator.assertMigrationStaticSafety(migration), true)
    assert.match(migration, /revoke update/i)
  })

  contract('forbidden Migration statements fail the static SQL guard', () => {
    const forbiddenStatements = [
      'grant update on public.profiles to authenticated;',
      'insert into public.profiles (id) values (null);',
      'update public.profiles set is_admin = true;',
      'delete from public.profiles;',
      'truncate public.profiles;',
      'drop table public.profiles;',
      'drop schema public;',
      'alter table public.profiles disable row level security;',
      'copy public.profiles to stdout;',
      'call public.example();',
      'do language plpgsql begin null; end;',
    ]

    for (const statement of forbiddenStatements) {
      assert.throws(
        () => validator.assertMigrationStaticSafety(statement),
        /unsafe-migration-sql/,
      )
    }
  })

  contract('existing Migration identity remains exact', () => {
    const hash = createHash('sha256').update(migration).digest('hex')
    assert.equal(validator.MIGRATION_FILE, 'supabase/migrations/20260716084928_profiles_admin_escalation_fix.sql')
    assert.equal(hash, 'f7f2207135ffaf1dd3476108a38ffb95184410ad0fad962f4d0e71e9e9613e7d')
  })

  console.log(`✓ ${passed} profiles admin deployment workflow contracts passed`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
