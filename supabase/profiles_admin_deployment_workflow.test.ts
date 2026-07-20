import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

type AuditResult = {
  status: string
  profiles: Record<string, unknown>
  target_policy: Record<string, unknown>
  function: Record<string, unknown>
  public_schema: Record<string, unknown>
  policy_references: Array<Record<string, unknown>>
  [key: string]: unknown
}

type ValidatorModule = {
  APPROVED_FUNCTION_DEFINITION: string
  CANONICAL_FUNCTION_CONTRACT: Record<string, unknown>
  CANONICAL_POLICY_REFERENCES: readonly string[]
  CANONICAL_PUBLIC_SCHEMA_CONTRACT: Record<string, unknown>
  EXPECTED_MIGRATION_SHA256: string
  EXPECTED_PSQL_MAJOR: number
  MIGRATION_FILE: string
  PSQL_BINARY: string
  assertMetadataSqlStaticSafety: (sql: string) => true
  assertMigrationStaticSafety: (sql: string) => true
  normalizeFunctionDefinition: (definition: string) => string
  normalizePolicyExpression: (expression: string) => string
  parseAndValidateAuditOutput: (text: string, phase: string) => string
  parseSingleColumnJson: (text: string) => Record<string, unknown>
  stripSqlForStaticAnalysis: (sql: string) => string
  validateAuditResult: (result: AuditResult, phase: string) => string
  validateConfirmation: (value: string) => true
  validateFullSha: (value: string) => string
  validateFunctionContract: (value: Record<string, unknown>) => true
  validateMigrationHash: (value: string) => true
  validatePolicyReferences: (value: Array<Record<string, unknown>>) => string[]
  validateInstalledPsql: (implementation?: (
    binary: string,
    args: string[],
    options: Record<string, unknown>,
  ) => string) => true
  validatePsqlVersionOutput: (value: unknown) => true
  validatePublicSchemaContract: (value: Record<string, unknown>) => true
}

const root = process.cwd()
const paths = {
  workflow: '.github/workflows/supabase-emergency-profiles-acl.yml',
  validator: 'scripts/supabase/validate-profiles-admin-deployment.mjs',
  runner: 'scripts/supabase/run-fixed-psql.mjs',
  preflight: 'supabase/deployment/profiles_admin_escalation_preflight.sql',
  postflight: 'supabase/deployment/profiles_admin_escalation_postflight.sql',
  migration: 'supabase/migrations/20260716084928_profiles_admin_escalation_fix.sql',
} as const

function read(relativePath: string) {
  return readFileSync(join(root, relativePath), 'utf8')
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function section(source: string, start: string, end?: string) {
  const startIndex = source.indexOf(start)
  assert.notEqual(startIndex, -1, `missing section: ${start}`)
  const endIndex = end ? source.indexOf(end, startIndex + start.length) : source.length
  assert.notEqual(endIndex, -1, `missing end section: ${end}`)
  return source.slice(startIndex, endIndex)
}

async function main() {
  const workflow = read(paths.workflow)
  const validatorSource = read(paths.validator)
  const runnerSource = read(paths.runner)
  const preflight = read(paths.preflight)
  const postflight = read(paths.postflight)
  const migration = read(paths.migration)
  const validator = (await import(pathToFileURL(join(root, paths.validator)).href)) as ValidatorModule
  let passed = 0

  function contract(name: string, assertion: () => void) {
    assertion()
    passed += 1
    return name
  }

  const onSection = section(workflow, 'on:\n', '\npermissions:')
  const permissionsSection = section(workflow, 'permissions:\n', '\nconcurrency:')
  const jobsSection = section(workflow, 'jobs:\n')
  const sourceJob = section(jobsSection, '  source-validation:\n', '  deploy-production:\n')
  const deployJob = section(jobsSection, '  deploy-production:\n')

  contract('run name uses only actor and source SHA', () => {
    assert.match(workflow, /run-name: .*github[.]actor.*github[.]sha/)
    assert.doesNotMatch(workflow.split('\n')[1] ?? '', /secrets[.]|inputs[.]/)
  })
  contract('manual dispatch is the only trigger', () => {
    assert.match(onSection, /^\s{2}workflow_dispatch:\s*$/m)
    assert.doesNotMatch(onSection, /^\s{2}(push|pull_request|schedule|workflow_call|repository_dispatch):/m)
  })
  contract('dispatch has only approved inputs', () => {
    const inputs = [...onSection.matchAll(/^\s{6}([a-z][a-z0-9_]*):\s*$/gm)].map((match) => match[1]).sort()
    assert.deepEqual(inputs, ['confirmation', 'expected_main_sha'])
  })
  contract('workflow permissions are read only', () => {
    assert.equal(permissionsSection.trim(), 'permissions:\n  contents: read')
    assert.doesNotMatch(workflow, /^\s+[a-z-]+:\s*write\s*$/m)
  })
  contract('production concurrency is fixed and non-cancelling', () => {
    assert.match(workflow, /group: supabase-production-migrations/)
    assert.match(workflow, /cancel-in-progress: false/)
  })
  contract('workflow has only source and deployment jobs', () => {
    const jobs = [...jobsSection.matchAll(/^\s{2}([a-z][a-z0-9-]+):\s*$/gm)].map((match) => match[1])
    assert.deepEqual(jobs, ['source-validation', 'deploy-production'])
  })
  contract('both jobs use fixed ubuntu 24.04', () => {
    assert.equal((workflow.match(/runs-on: ubuntu-24[.]04/g) ?? []).length, 2)
    assert.doesNotMatch(workflow, /ubuntu-latest|self-hosted/)
  })
  contract('deployment waits for source validation', () => {
    assert.match(deployJob, /needs:\n\s+- source-validation/)
  })
  contract('production environment applies only to deployment job', () => {
    assert.match(deployJob, /environment:\n\s+name: supabase-production/)
    assert.doesNotMatch(sourceJob, /\benvironment:/)
  })
  contract('all Actions are pinned to full SHAs', () => {
    const actions = [...workflow.matchAll(/uses:\s*([^\s]+)/g)].map((match) => match[1])
    assert.equal(actions.length, 4)
    assert.ok(actions.every((action) => /@[0-9a-f]{40}$/.test(action)))
  })
  contract('checkout never persists credentials', () => {
    assert.equal((workflow.match(/persist-credentials: false/g) ?? []).length, 2)
    assert.equal((workflow.match(/fetch-depth: 1/g) ?? []).length, 2)
  })
  contract('checkout uses the dispatch source SHA', () => {
    assert.equal((workflow.match(/ref: \$\{\{ github[.]sha \}\}/g) ?? []).length, 2)
  })
  contract('Node 24 setup is fixed', () => {
    assert.equal((workflow.match(/node-version: '24'/g) ?? []).length, 2)
  })
  contract('workflow performs no runtime installation', () => {
    assert.doesNotMatch(workflow, /\b(apt-get|apt|curl|wget|npm\s+(?:install|ci)|npx)\b/)
  })
  contract('workflow never invokes Supabase CLI database commands', () => {
    assert.doesNotMatch(workflow, /supabase\s+(?:db|migration|link|login)\b/)
  })
  contract('workflow never uses db-url argv', () => {
    assert.doesNotMatch(workflow, /--db-url/)
  })
  contract('workflow never uses PGPASSWORD', () => {
    assert.doesNotMatch(workflow, /PGPASSWORD/)
  })
  contract('source job is secret-free', () => {
    assert.doesNotMatch(sourceJob, /secrets[.]|SUPABASE_DB_URL|SUPABASE_PROJECT_ID/)
  })
  contract('only two approved secret names appear', () => {
    const secrets = [...new Set([...workflow.matchAll(/secrets[.]([A-Z0-9_]+)/g)].map((match) => match[1]))].sort()
    assert.deepEqual(secrets, ['SUPABASE_DB_URL', 'SUPABASE_PROJECT_ID'])
  })
  contract('database URL is scoped to three database steps', () => {
    assert.equal((workflow.match(/SUPABASE_DB_URL: \$\{\{ secrets[.]SUPABASE_DB_URL \}\}/g) ?? []).length, 3)
  })
  contract('project id is scoped to three database steps', () => {
    assert.equal((workflow.match(/SUPABASE_PROJECT_ID: \$\{\{ secrets[.]SUPABASE_PROJECT_ID \}\}/g) ?? []).length, 3)
  })
  contract('source validator runs before every deployment context', () => {
    assert.equal((workflow.match(/validate-profiles-admin-deployment[.]mjs source/g) ?? []).length, 2)
  })
  contract('psql major is validated before database phases', () => {
    const psqlIndex = deployJob.indexOf('validate-profiles-admin-deployment.mjs psql')
    const preflightIndex = deployJob.indexOf('run-fixed-psql.mjs preflight')
    assert.ok(psqlIndex >= 0 && psqlIndex < preflightIndex)
  })
  contract('only the three fixed runner phases execute', () => {
    const phases = [...workflow.matchAll(/run-fixed-psql[.]mjs ([a-z]+)/g)].map((match) => match[1])
    assert.deepEqual(phases, ['preflight', 'migration', 'postflight'])
  })
  contract('workflow does not export database results', () => {
    assert.doesNotMatch(workflow, /GITHUB_OUTPUT|GITHUB_ENV|upload-artifact|cache/)
  })
  contract('every run block fails closed', () => {
    assert.equal((workflow.match(/run: \|/g) ?? []).length, (workflow.match(/set -euo pipefail/g) ?? []).length)
  })
  contract('workflow never echoes secrets', () => {
    assert.doesNotMatch(workflow, /^\s*(echo|printf).*(SUPABASE_DB_URL|SUPABASE_PROJECT_ID|secrets[.])/m)
    assert.doesNotMatch(workflow, /\bset\s+-x\b/)
  })
  contract('runner and validator paths are fixed literals', () => {
    assert.doesNotMatch(workflow, /run-fixed-psql[.]mjs\s+\$|validate-profiles-admin-deployment[.]mjs\s+\$/)
  })

  const forbiddenMetadataSql = /\b(do|call|copy|create|alter|drop|grant|revoke|insert|update|delete|truncate|set\s+role)\b/i
  for (const [phase, sql] of [['preflight', preflight], ['postflight', postflight]] as const) {
    contract(`${phase} is a single CTE statement`, () => {
      assert.match(sql, /^with\b/)
      assert.equal((validatorSource && validator.assertMetadataSqlStaticSafety(sql)), true)
    })
    contract(`${phase} contains no write or role-changing SQL`, () => {
      const cleaned = sql.replace(/'(?:''|[^'])*'/g, "''").replace(/\$approved\$[\s\S]*?\$approved\$/g, '$approved$$approved$')
      assert.doesNotMatch(cleaned, forbiddenMetadataSql)
    })
    contract(`${phase} never reads profile rows or auth users`, () => {
      const cleaned = validator.stripSqlForStaticAnalysis(sql)
      assert.doesNotMatch(cleaned, /\bfrom\s+public[.]profiles\b/i)
      assert.doesNotMatch(cleaned, /\bauth[.]users\b/i)
    })
    contract(`${phase} uses metadata catalogs and privilege checks`, () => {
      for (const token of ['pg_catalog.pg_proc', 'pg_catalog.pg_policy', 'pg_catalog.pg_depend', 'has_table_privilege', 'has_column_privilege', 'has_function_privilege', 'has_schema_privilege']) assert.ok(sql.includes(token))
    })
    contract(`${phase} returns one audit_result JSON column`, () => {
      assert.match(sql, /select jsonb_build_object\([\s\S]*\) as audit_result\s+from/)
    })
    contract(`${phase} captures full function metadata`, () => {
      for (const token of ['function_oid_count', 'overload_count', 'security_definer', 'volatility', 'parallel', 'leakproof', 'proconfig', 'raw_acl', 'definition']) assert.ok(sql.includes(token))
    })
    contract(`${phase} captures effective function ACL`, () => {
      for (const token of ['public_execute', 'anon_execute', 'authenticated_execute', 'service_role_execute', 'owner_execute']) assert.ok(sql.includes(token))
    })
    contract(`${phase} captures public schema contract`, () => {
      for (const token of ['pg_database_owner', 'public_create', 'anon_create', 'authenticated_create']) assert.ok(sql.includes(token))
    })
    contract(`${phase} includes all 24 approved policy references`, () => {
      for (const reference of validator.CANONICAL_POLICY_REFERENCES) {
        const [, table, policy] = reference.split('.')
        assert.ok(sql.includes(`'${table}', '${policy}'`))
      }
    })
    contract(`${phase} compares deduplicated policy references`, () => {
      assert.match(sql, /select distinct schema_name, table_name, policy_name/)
      assert.match(sql, /except select \* from policy_references_unique/)
      assert.match(sql, /except select \* from expected_policy_references/)
    })
    contract(`${phase} checks the complete approved function body`, () => {
      assert.ok(sql.includes(validator.APPROVED_FUNCTION_DEFINITION))
    })
    contract(`${phase} emits finite drift statuses`, () => {
      for (const status of ['IS_ADMIN_FUNCTION_DRIFT', 'POLICY_REFERENCE_DRIFT', 'PROFILES_PRECONDITION_DRIFT']) assert.ok(sql.includes(status))
    })
  }

  contract('preflight accepts only vulnerable expected final status', () => {
    assert.match(preflight, /else 'VULNERABLE_EXPECTED'/)
    assert.doesNotMatch(preflight, /ALREADY_APPLIED/)
  })
  contract('preflight requires public role and absent with-check', () => {
    assert.match(preflight, /target_policy[.]roles = array\['public'\]/)
    assert.match(preflight, /with_check_expression is null/)
  })
  contract('postflight accepts only secure expected final status', () => {
    assert.match(postflight, /else 'SECURE_EXPECTED'/)
  })
  contract('postflight requires authenticated role and both policy clauses', () => {
    assert.match(postflight, /target_policy[.]roles = array\['authenticated'\]/)
    assert.match(postflight, /target_policy[.]with_check_expression/)
  })
  contract('postflight requires every authenticated update path revoked', () => {
    assert.match(postflight, /not authenticated_update and not authenticated_is_admin_update and not authenticated_any_column_update/)
  })

  contract('validator imports Node built-ins and its local runner imports only validator', () => {
    const validatorImports = [...validatorSource.matchAll(/^import .* from ['"]([^'"]+)['"]/gm)].map((match) => match[1])
    assert.ok(validatorImports.every((specifier) => specifier.startsWith('node:')))
    assert.doesNotMatch(runnerSource, /from ['"](?!node:|[.]{1,2}\/)/)
  })
  contract('fixed Migration identity is exact', () => {
    assert.equal(validator.MIGRATION_FILE, paths.migration)
    assert.equal(createHash('sha256').update(migration).digest('hex'), validator.EXPECTED_MIGRATION_SHA256)
  })
  contract('fixed PostgreSQL binary is exact', () => {
    assert.equal(validator.PSQL_BINARY, '/usr/lib/postgresql/16/bin/psql')
  })
  contract('expected PostgreSQL major remains fixed at 16', () => {
    assert.equal(validator.EXPECTED_PSQL_MAJOR, 16)
  })
  for (const output of [
    'psql (PostgreSQL) 16',
    'psql (PostgreSQL) 16.0',
    'psql (PostgreSQL) 16.14',
    'psql (PostgreSQL) 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)',
    'psql (PostgreSQL) 16.14 (Ubuntu 16.14-1.pgdg24.04+1)',
  ]) {
    contract(`approved PostgreSQL version output passes: ${output}`, () => {
      assert.equal(validator.validatePsqlVersionOutput(output), true)
    })
  }
  const rejectedVersionOutputs: unknown[] = [
    null,
    undefined,
    16,
    {},
    '',
    'psql (PostgreSQL) 15',
    'psql (PostgreSQL) 17',
    'psql (PostgreSQL) 016.14',
    'psql (PostgreSQL) 16evil',
    'psql (PostgreSQL) v16',
    'psql (PostgreSQL) 16.',
    'psql (PostgreSQL) 16..14',
    'psql (PostgreSQL) 16.14 Ubuntu',
    'psql (PostgreSQL) 16.14 ()',
    'psql (PostgreSQL) 16.14 ( )',
    'psql (PostgreSQL) 16.14 (Ubuntu) extra',
    'psql (PostgreSQL) 16.14 (Ubuntu) (Extra)',
    'psql (PostgreSQL) 16.14 (Ubuntu (nested))',
    'psql (PostgreSQL) 16.14 (Ubuntü)',
    'psql (PostgreSQL) 16.14\nmalicious',
    'psql (PostgreSQL) 16.14\n\n',
    'leading psql (PostgreSQL) 16.14',
    'psql (PostgreSQL) 16.14 trailing',
    'psql (PostgreSQL) 16.14\0',
    'psql (PostgreSQL) 16.14\t',
    'psql (PostgreSQL) 16.14\x1b',
    'psql (PostgreSQL) 16.14\x7f',
    'psql (PostgreSQL) 16.14\r',
  ]
  for (const output of rejectedVersionOutputs) {
    contract(`unapproved PostgreSQL version output fails: ${JSON.stringify(output)}`, () => {
      assert.throws(
        () => validator.validatePsqlVersionOutput(output),
        (error: unknown) => error instanceof Error && error.message === 'UNSUPPORTED_PSQL_VERSION',
      )
    })
  }
  contract('version failures expose only the fixed safe code', () => {
    const unsafeOutput = 'psql (PostgreSQL) 17.1 (credential-like-text) trailing'
    assert.throws(
      () => validator.validatePsqlVersionOutput(unsafeOutput),
      (error: unknown) => error instanceof Error && error.message === 'UNSUPPORTED_PSQL_VERSION',
    )
  })
  contract('installed psql accepts the Ubuntu 24.04 packaged version output', () => {
    const calls: Array<{ binary: string; args: string[]; options: Record<string, unknown> }> = []
    const result = validator.validateInstalledPsql((binary, args, options) => {
      calls.push({ binary, args, options })
      return 'psql (PostgreSQL) 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)\n'
    })
    assert.equal(result, true)
    assert.deepEqual(calls, [{
      binary: '/usr/lib/postgresql/16/bin/psql',
      args: ['--version'],
      options: {
        encoding: 'utf8',
        env: { LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    }])
  })
  contract('full lowercase SHA passes', () => {
    const sha = 'a'.repeat(40)
    assert.equal(validator.validateFullSha(sha), sha)
  })
  contract('short SHA fails', () => assert.throws(() => validator.validateFullSha('abc1234'), /INVALID_MAIN_SHA/))
  contract('uppercase SHA fails', () => assert.throws(() => validator.validateFullSha('A'.repeat(40)), /INVALID_MAIN_SHA/))
  contract('approved confirmation passes', () => assert.equal(validator.validateConfirmation('DEPLOY_PROFILES_ADMIN_ESCALATION_FIX'), true))
  contract('wrong confirmation fails', () => assert.throws(() => validator.validateConfirmation('DEPLOY'), /INVALID_DEPLOYMENT_CONFIRMATION/))
  contract('approved Migration passes static guard', () => assert.equal(validator.assertMigrationStaticSafety(migration), true))
  contract('wrong Migration hash fails', () => assert.throws(() => validator.validateMigrationHash('0'.repeat(64)), /MIGRATION_HASH_MISMATCH/))

  function references() {
    return validator.CANONICAL_POLICY_REFERENCES.map((key) => {
      const [schema, table, policy] = key.split('.')
      return { schema, table, policy }
    })
  }
  function functionFixture() {
    return {
      ...clone(validator.CANONICAL_FUNCTION_CONTRACT),
      definition: validator.APPROVED_FUNCTION_DEFINITION,
    }
  }
  function auditFixture(phase: 'preflight' | 'postflight'): AuditResult {
    const policyReferences = references()
    policyReferences.push(...clone(policyReferences.slice(0, 8)))
    return {
      status: phase === 'preflight' ? 'VULNERABLE_EXPECTED' : 'SECURE_EXPECTED',
      profiles: {
        profiles_exists: true,
        rls_enabled: true,
        anon_update: false,
        authenticated_update: phase === 'preflight',
        authenticated_is_admin_update: phase === 'preflight',
        authenticated_any_column_update: phase === 'preflight',
        authenticated_select: true,
        service_role_select: true,
        service_role_insert: true,
        service_role_update: true,
      },
      target_policy: {
        count: 1,
        command: 'w',
        roles: phase === 'preflight' ? ['public'] : ['authenticated'],
        using_expression: phase === 'preflight'
          ? '((auth.uid() = id) OR is_admin())'
          : '(((SELECT auth.uid() AS uid) = id) OR (SELECT is_admin() AS is_admin))',
        with_check_expression: phase === 'preflight'
          ? null
          : '(((SELECT auth.uid() AS uid) = id) OR (SELECT is_admin() AS is_admin))',
      },
      function: functionFixture(),
      public_schema: clone(validator.CANONICAL_PUBLIC_SCHEMA_CONTRACT),
      policy_references: policyReferences,
    }
  }

  contract('32 raw references deduplicate to 24 canonical references', () => {
    const fixture = auditFixture('preflight')
    assert.equal(fixture.policy_references.length, 32)
    assert.equal(validator.validatePolicyReferences(fixture.policy_references).length, 24)
  })
  contract('24 unique canonical references pass', () => assert.equal(validator.validatePolicyReferences(references()).length, 24))
  for (const [name, mutate] of [
    ['missing reference', (items: Array<Record<string, unknown>>) => { items.pop() }],
    ['extra reference', (items: Array<Record<string, unknown>>) => { items.push({ schema: 'public', table: 'extra', policy: 'extra' }) }],
    ['schema rename', (items: Array<Record<string, unknown>>) => { items[0].schema = 'private' }],
    ['table rename', (items: Array<Record<string, unknown>>) => { items[0].table = 'renamed' }],
    ['policy rename', (items: Array<Record<string, unknown>>) => { items[0].policy = 'renamed' }],
    ['extra object key', (items: Array<Record<string, unknown>>) => { items[0].extra = true }],
  ] as const) {
    contract(`${name} is rejected`, () => {
      const items = references()
      mutate(items)
      assert.throws(() => validator.validatePolicyReferences(items), /POLICY_REFERENCE_DRIFT/)
    })
  }

  contract('canonical function contract passes', () => assert.equal(validator.validateFunctionContract(functionFixture()), true))
  contract('CRLF and line-end whitespace normalize safely', () => {
    const fixture = functionFixture()
    fixture.definition = `\r\n${validator.APPROVED_FUNCTION_DEFINITION.replaceAll('\n', '  \r\n')}\r\n`
    assert.equal(validator.validateFunctionContract(fixture), true)
  })
  const functionDrifts: Array<[string, (value: Record<string, unknown>) => void]> = [
    ['owner', (value) => { value.owner = 'other_owner' }],
    ['security definer', (value) => { value.security_definer = false }],
    ['search path', (value) => { value.search_path = 'private' }],
    ['proconfig extra', (value) => { value.proconfig = ['search_path=public', 'statement_timeout=1s'] }],
    ['proconfig missing', (value) => { value.proconfig = [] }],
    ['proconfig duplicate', (value) => { value.proconfig = ['search_path=public', 'search_path=public'] }],
    ['volatility', (value) => { value.volatility = 'VOLATILE' }],
    ['parallel', (value) => { value.parallel = 'SAFE' }],
    ['leakproof', (value) => { value.leakproof = true }],
    ['raw ACL', (value) => { value.raw_acl = ['=X/postgres'] }],
    ['PUBLIC execute', (value) => { value.public_execute = false }],
    ['anon execute', (value) => { value.anon_execute = false }],
    ['authenticated execute', (value) => { value.authenticated_execute = false }],
    ['service role execute', (value) => { value.service_role_execute = false }],
    ['owner execute', (value) => { value.owner_execute = false }],
    ['return type', (value) => { value.return_type = 'text' }],
    ['language', (value) => { value.language = 'plpgsql' }],
    ['overload count', (value) => { value.overload_count = 1 }],
    ['OID count', (value) => { value.function_oid_count = 2 }],
    ['schema', (value) => { value.schema = 'private' }],
    ['function name', (value) => { value.function_name = 'is_admin_copy' }],
    ['identity arguments', (value) => { value.identity_arguments = 'user_id uuid' }],
    ['always true body', (value) => { value.definition = 'CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql AS $$ select true $$' }],
    ['always false body', (value) => { value.definition = 'CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql AS $$ select false $$' }],
    ['OR true body', (value) => { value.definition = `${validator.APPROVED_FUNCTION_DEFINITION}\nOR true` }],
    ['OR one equals one body', (value) => { value.definition = validator.APPROVED_FUNCTION_DEFINITION.replace('and is_admin = true', 'and is_admin = true or 1 = 1') }],
    ['auth identity change', (value) => { value.definition = validator.APPROVED_FUNCTION_DEFINITION.replace('auth.uid()', 'auth.role()') }],
    ['schema qualification removed', (value) => { value.definition = validator.APPROVED_FUNCTION_DEFINITION.replace('public.profiles', 'profiles') }],
    ['extra statement', (value) => { value.definition = `${validator.APPROVED_FUNCTION_DEFINITION}\nselect true;` }],
    ['comment-only canonical body', (value) => { value.definition = `-- ${validator.APPROVED_FUNCTION_DEFINITION}\nselect true;` }],
  ]
  for (const [name, mutate] of functionDrifts) {
    contract(`function drift rejects ${name}`, () => {
      const fixture = functionFixture()
      mutate(fixture)
      assert.throws(() => validator.validateFunctionContract(fixture), /IS_ADMIN_FUNCTION_DRIFT/)
    })
  }

  contract('canonical public schema contract passes', () => assert.equal(validator.validatePublicSchemaContract(clone(validator.CANONICAL_PUBLIC_SCHEMA_CONTRACT)), true))
  for (const key of ['owner', 'public_create', 'anon_create', 'authenticated_create']) {
    contract(`public schema drift rejects ${key}`, () => {
      const fixture = clone(validator.CANONICAL_PUBLIC_SCHEMA_CONTRACT)
      fixture[key] = key === 'owner' ? 'postgres' : true
      assert.throws(() => validator.validatePublicSchemaContract(fixture), /IS_ADMIN_FUNCTION_DRIFT/)
    })
  }

  contract('valid preflight audit passes', () => assert.equal(validator.validateAuditResult(auditFixture('preflight'), 'preflight'), 'VULNERABLE_EXPECTED'))
  contract('valid postflight audit passes', () => assert.equal(validator.validateAuditResult(auditFixture('postflight'), 'postflight'), 'SECURE_EXPECTED'))
  contract('unknown audit phase fails', () => assert.throws(() => validator.validateAuditResult(auditFixture('preflight'), 'other'), /DATABASE_OUTPUT_INVALID/))
  for (const key of ['profiles_exists', 'rls_enabled', 'anon_update', 'authenticated_update', 'authenticated_is_admin_update', 'authenticated_any_column_update', 'authenticated_select', 'service_role_select', 'service_role_insert', 'service_role_update']) {
    contract(`profile contract drift rejects ${key}`, () => {
      const fixture = auditFixture('preflight')
      fixture.profiles[key] = !fixture.profiles[key]
      assert.throws(() => validator.validateAuditResult(fixture, 'preflight'), /PROFILES_PRECONDITION_DRIFT/)
    })
  }
  for (const [name, mutate] of [
    ['policy count', (fixture: AuditResult) => { fixture.target_policy.count = 2 }],
    ['policy command', (fixture: AuditResult) => { fixture.target_policy.command = 'r' }],
    ['policy role', (fixture: AuditResult) => { fixture.target_policy.roles = ['public'] }],
    ['policy using OR true', (fixture: AuditResult) => { fixture.target_policy.using_expression = 'auth.uid() = id OR is_admin() OR true' }],
    ['policy with-check missing', (fixture: AuditResult) => { fixture.target_policy.with_check_expression = null }],
  ] as const) {
    contract(`${name} fails postflight`, () => {
      const fixture = auditFixture('postflight')
      mutate(fixture)
      assert.throws(() => validator.validateAuditResult(fixture, 'postflight'), /PROFILES_PRECONDITION_DRIFT/)
    })
  }

  contract('single JSON object row parses', () => assert.deepEqual(validator.parseSingleColumnJson('{"status":"x"}\n'), { status: 'x' }))
  for (const [name, text] of [
    ['empty output', ''],
    ['whitespace output', ' \n'],
    ['non JSON', 'not-json'],
    ['multiple rows', '{"a":1}\n{"a":2}\n'],
    ['JSON plus warning', 'warning\n{"a":1}'],
    ['top-level array', '[]'],
    ['top-level null', 'null'],
  ] as const) {
    contract(`${name} is rejected`, () => assert.throws(() => validator.parseSingleColumnJson(text), /DATABASE_OUTPUT_INVALID/))
  }
  contract('extra audit root key fails closed', () => {
    const fixture = auditFixture('preflight')
    fixture.extra = true
    assert.throws(() => validator.validateAuditResult(fixture, 'preflight'), /DATABASE_OUTPUT_INVALID/)
  })
  contract('unknown status fails closed', () => {
    const fixture = auditFixture('preflight')
    fixture.status = 'UNKNOWN'
    assert.throws(() => validator.validateAuditResult(fixture, 'preflight'), /DATABASE_OUTPUT_INVALID/)
  })
  contract('drift status never passes a canonical audit', () => {
    const fixture = auditFixture('preflight')
    fixture.status = 'IS_ADMIN_FUNCTION_DRIFT'
    assert.throws(() => validator.validateAuditResult(fixture, 'preflight'), /IS_ADMIN_FUNCTION_DRIFT/)
  })
  contract('complete preflight stdout validates', () => {
    assert.equal(validator.parseAndValidateAuditOutput(`${JSON.stringify(auditFixture('preflight'))}\n`, 'preflight'), 'VULNERABLE_EXPECTED')
  })
  contract('complete postflight stdout validates', () => {
    assert.equal(validator.parseAndValidateAuditOutput(`${JSON.stringify(auditFixture('postflight'))}\n`, 'postflight'), 'SECURE_EXPECTED')
  })

  console.log(`✓ ${passed} profiles admin deployment workflow contracts passed`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
