import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test, { before } from 'node:test'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const validatorPath = join(
  root,
  'scripts/supabase/validate-line-pay-atomic-finalization-capability-diagnostic.mjs',
)
const runnerPath = join(
  root,
  'scripts/supabase/run-line-pay-atomic-finalization-capability-diagnostic.mjs',
)
const diagnosticPath =
  'supabase/deployment/line_pay_atomic_confirmation_finalization_capability_diagnostic.sql'
const workflowPath =
  '.github/workflows/supabase-production-line-pay-atomic-finalization-capability-diagnostic.yml'

const relationKeys = [
  'product_orders',
  'payments',
  'checkout_attempts',
  'request_outbox',
  'callback_capabilities',
  'callback_events',
  'audit_events',
  'completion_proofs',
] as const

type CapabilityFixture = {
  status: string
  database_identity_match: boolean
  session: {
    superuser: boolean
    public_schema_usage: boolean
    private_schema_usage: boolean
  }
  relations: Record<
    (typeof relationKeys)[number],
    ReturnType<typeof relationFixture>
  >
  decision: {
    lock_capability_ready: boolean
    fingerprint_capability_ready: boolean
    blocking_stage: string
    blocking_relations: string[]
  }
}

let validator: any

before(async () => {
  validator = await import(pathToFileURL(validatorPath).href)
})

function relationFixture(overrides: Record<string, boolean> = {}) {
  return {
    present: true,
    schema_usage: true,
    owned_by_current_user: false,
    select_privilege: true,
    maintain_privilege: true,
    update_privilege: false,
    delete_privilege: false,
    truncate_privilege: false,
    access_exclusive_lock_capable: true,
    fingerprint_read_capable: true,
    ...overrides,
  }
}

function capabilityFixture(
  overrides: Partial<CapabilityFixture> = {},
): CapabilityFixture {
  return {
    status:
      'LINE_PAY_ATOMIC_FINALIZATION_CAPABILITY_DIAGNOSTIC_COMPLETED',
    database_identity_match: true,
    session: {
      superuser: false,
      public_schema_usage: true,
      private_schema_usage: true,
    },
    relations: Object.fromEntries(
      relationKeys.map((key) => [key, relationFixture()]),
    ) as CapabilityFixture['relations'],
    decision: {
      lock_capability_ready: true,
      fingerprint_capability_ready: true,
      blocking_stage: 'CAPABILITY_READY',
      blocking_relations: [],
    },
    ...overrides,
  }
}

test('diagnostic SQL is digest-sealed catalog-only and read-only', () => {
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
  assert.doesNotMatch(
    validator.stripSqlForStaticAnalysis(sql),
    /\bfrom\s+(?:public|line_pay_private)[.]/iu,
  )
})

test('diagnostic locks the exact eight pre-marker relations and PostgreSQL 17 privileges', () => {
  const sql = readFileSync(diagnosticPath, 'utf8')
  for (const key of relationKeys) {
    assert.match(sql, new RegExp(`'${key}'`, 'u'))
  }
  assert.match(sql, /'SELECT'/u)
  assert.match(sql, /'MAINTAIN'/u)
  assert.match(sql, /'UPDATE'/u)
  assert.match(sql, /'DELETE'/u)
  assert.match(sql, /'TRUNCATE'/u)
  assert.match(sql, /'access_exclusive_lock_capable'/u)
  assert.match(sql, /'fingerprint_read_capable'/u)
})

test('static mutations cannot weaken catalog-only capability probes', () => {
  const sql = readFileSync(diagnosticPath, 'utf8')
  const mutations = [
    sql.replace(
      'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;',
      'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;',
    ),
    sql.replace('\nROLLBACK;\n', '\nCOMMIT;\n'),
    sql.replace("'MAINTAIN'", "'SELECT'"),
    sql.replace("'access_exclusive_lock_capable',", ''),
    sql.replace("'blocking_relations',", ''),
    sql.replace(
      '\nROLLBACK;\n',
      '\nlock table public.payments in access exclusive mode;\nROLLBACK;\n',
    ),
  ]
  for (const mutation of mutations) {
    assert.throws(
      () => validator.assertCapabilityDiagnosticSql(mutation),
      /CAPABILITY_DIAGNOSTIC_SQL_INVALID/,
    )
  }
})

test('parser accepts a frozen exact safe capability matrix', () => {
  const parsed = validator.parseAndValidateCapabilityDiagnosticOutput(
    `${JSON.stringify(capabilityFixture())}\n`,
  )
  assert.equal(parsed.decision.blocking_stage, 'CAPABILITY_READY')
  assert.deepEqual(parsed.decision.blocking_relations, [])
  assert.ok(Object.isFrozen(parsed))
  assert.ok(Object.isFrozen(parsed.session))
  assert.ok(Object.isFrozen(parsed.relations))
  assert.ok(Object.isFrozen(parsed.relations.payments))
  assert.ok(Object.isFrozen(parsed.decision.blocking_relations))
})

test('parser classifies an exact lock privilege gap without trusting supplied decision', () => {
  const fixture = capabilityFixture()
  fixture.relations.audit_events = relationFixture({
    maintain_privilege: false,
    access_exclusive_lock_capable: false,
  })
  fixture.decision = {
    lock_capability_ready: false,
    fingerprint_capability_ready: true,
    blocking_stage: 'LOCK_CAPABILITY_MISSING',
    blocking_relations: ['audit_events'],
  }
  const parsed = validator.parseAndValidateCapabilityDiagnosticOutput(
    JSON.stringify(fixture),
  )
  assert.equal(parsed.decision.blocking_stage, 'LOCK_CAPABILITY_MISSING')
  assert.deepEqual(parsed.decision.blocking_relations, ['audit_events'])

  fixture.decision.blocking_stage = 'CAPABILITY_READY'
  assert.throws(
    () =>
      validator.parseAndValidateCapabilityDiagnosticOutput(
        JSON.stringify(fixture),
      ),
    /CAPABILITY_DIAGNOSTIC_OUTPUT_INVALID/,
  )
})

test('parser enforces relation, schema, and fingerprint precedence', () => {
  const missing = capabilityFixture()
  missing.relations.request_outbox = relationFixture({
    present: false,
    schema_usage: false,
    select_privilege: false,
    maintain_privilege: false,
    access_exclusive_lock_capable: false,
    fingerprint_read_capable: false,
  })
  missing.decision = {
    lock_capability_ready: false,
    fingerprint_capability_ready: false,
    blocking_stage: 'RELATION_MISSING',
    blocking_relations: ['request_outbox'],
  }
  assert.doesNotThrow(() =>
    validator.parseAndValidateCapabilityDiagnosticOutput(
      JSON.stringify(missing),
    ),
  )

  const fingerprint = capabilityFixture()
  fingerprint.relations.completion_proofs = relationFixture({
    select_privilege: false,
    fingerprint_read_capable: false,
  })
  fingerprint.decision = {
    lock_capability_ready: true,
    fingerprint_capability_ready: false,
    blocking_stage: 'FINGERPRINT_READ_CAPABILITY_MISSING',
    blocking_relations: ['completion_proofs'],
  }
  assert.doesNotThrow(() =>
    validator.parseAndValidateCapabilityDiagnosticOutput(
      JSON.stringify(fingerprint),
    ),
  )
})

test('parser rejects extra keys, arbitrary relation names, and sensitive output', () => {
  assert.throws(
    () =>
      validator.parseAndValidateCapabilityDiagnosticOutput(
        JSON.stringify({ ...capabilityFixture(), leaked: true }),
      ),
    /CAPABILITY_DIAGNOSTIC_OUTPUT_INVALID/,
  )
  const arbitrary = capabilityFixture()
  arbitrary.decision.blocking_stage = 'LOCK_CAPABILITY_MISSING'
  arbitrary.decision.lock_capability_ready = false
  arbitrary.decision.blocking_relations = ['arbitrary_relation']
  assert.throws(
    () =>
      validator.parseAndValidateCapabilityDiagnosticOutput(
        JSON.stringify(arbitrary),
      ),
    /CAPABILITY_DIAGNOSTIC_OUTPUT_INVALID/,
  )
  assert.throws(
    () =>
      validator.parseAndValidateCapabilityDiagnosticOutput(
        `${JSON.stringify(capabilityFixture())}\npostgres://user:password@example.supabase.co/postgres`,
      ),
    /CAPABILITY_DIAGNOSTIC_OUTPUT_INVALID/,
  )
})

test('workflow is manual-only, protected, pinned, and read-only', () => {
  const workflow = readFileSync(workflowPath, 'utf8')
  assert.equal(validator.assertWorkflowSource(workflow), true)
  assert.match(
    workflow,
    /^name: Supabase Production LINE Pay Atomic Finalization Capability Diagnostic$/mu,
  )
  assert.match(workflow, /^on:\n  workflow_dispatch:$/mu)
  assert.match(workflow, /^permissions:\n  contents: read$/mu)
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

test('source identity locks the failing deploy and migration artifacts', () => {
  assert.equal(
    validator.EXPECTED_CONFIRMATION,
    'RUN_LINE_PAY_ATOMIC_FINALIZATION_CAPABILITY_DIAGNOSTIC_READ_ONLY_ONCE',
  )
  assert.equal(validator.EXPECTED_PROJECT_REF, 'ndbqoznvobmpkgxkiezz')
  assert.equal(validator.DIAGNOSTIC_FILE, diagnosticPath)
  assert.equal(
    validator.EXPECTED_DEPLOY_SHA256,
    '2577c57c0978387b6b4c2d6fece06487501975fedcfff7d4b25202547b8d6510',
  )
  assert.equal(
    validator.EXPECTED_MIGRATION_SHA256,
    '2991bff6e13d76d843f98b2e019bb6c6ff5a1d7471c667dd4de528f95aa12b4f',
  )
})
