import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import test, { before } from 'node:test'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const runnerPath = join(
  root,
  'scripts/supabase/run-line-pay-application-state-diagnostic.mjs',
)
const sharedRunnerPath = join(
  root,
  'scripts/supabase/run-line-pay-production-diagnostic.mjs',
)
const validatorPath = join(
  root,
  'scripts/supabase/validate-line-pay-application-state-diagnostic.mjs',
)
const disposableRunnerPath = join(
  root,
  'supabase/tests/run_line_pay_application_state_diagnostic_contracts.mjs',
)
let runner: any
let sharedRunner: any
let validator: any

type DiagnosticInventory = Readonly<{
  relations_present: number
  functions_present: number
  triggers_present: number
  indexes_present: number
  policies_present: number
  columns_present: number
  constraints_present: number
  roles_present: number
}>

type DiagnosticContracts = Readonly<{
  relations_complete: boolean
  functions_complete: boolean
  triggers_complete: boolean
  indexes_complete: boolean
  policies_complete: boolean
  columns_complete: boolean
  constraints_complete: boolean
  roles_complete: boolean
  acl_complete: boolean
}>

before(async () => {
  ;[runner, sharedRunner, validator] = await Promise.all([
    import(pathToFileURL(runnerPath).href),
    import(pathToFileURL(sharedRunnerPath).href),
    import(pathToFileURL(validatorPath).href),
  ])
})

const zeroInventory: DiagnosticInventory = Object.freeze({
  relations_present: 0,
  functions_present: 0,
  triggers_present: 0,
  indexes_present: 0,
  policies_present: 0,
  columns_present: 0,
  constraints_present: 0,
  roles_present: 0,
})
const fullInventory: DiagnosticInventory = Object.freeze({
  relations_present: 7,
  functions_present: 21,
  triggers_present: 11,
  indexes_present: 39,
  policies_present: 14,
  columns_present: 127,
  constraints_present: 112,
  roles_present: 2,
})
const incompleteContracts: DiagnosticContracts = Object.freeze({
  relations_complete: false,
  functions_complete: false,
  triggers_complete: false,
  indexes_complete: false,
  policies_complete: false,
  columns_complete: false,
  constraints_complete: false,
  roles_complete: false,
  acl_complete: false,
})
const completeContracts: DiagnosticContracts = Object.freeze({
  relations_complete: true,
  functions_complete: true,
  triggers_complete: true,
  indexes_complete: true,
  policies_complete: true,
  columns_complete: true,
  constraints_complete: true,
  roles_complete: true,
  acl_complete: true,
})

function resultFor(
  applicationState: string,
  {
    tablePresent = true,
    versionPresent = false,
    inventory = zeroInventory,
    contracts = incompleteContracts,
  }: {
    tablePresent?: boolean
    versionPresent?: boolean
    inventory?: DiagnosticInventory
    contracts?: DiagnosticContracts
  } = {},
) {
  return {
    status: 'APPLICATION_STATE_DIAGNOSTIC_COMPLETED',
    database_identity_match: true,
    migration_history: {
      table_present: tablePresent,
      version_present: versionPresent,
    },
    inventory,
    contracts,
    application_state: applicationState,
  }
}

test('all six application states are uniquely classified', () => {
  const fixtures = [
    resultFor('UNAPPLIED'),
    resultFor('PARTIAL', {
      inventory: { ...zeroInventory, relations_present: 1 },
    }),
    resultFor('FULL_WITHOUT_HISTORY', {
      inventory: fullInventory,
      contracts: completeContracts,
    }),
    resultFor('FULL_WITH_HISTORY', {
      versionPresent: true,
      inventory: fullInventory,
      contracts: completeContracts,
    }),
    resultFor('HISTORY_ONLY', {
      versionPresent: true,
    }),
    resultFor('INCONSISTENT', {
      versionPresent: true,
      inventory: { ...zeroInventory, columns_present: 1 },
    }),
  ]
  assert.deepEqual(
    fixtures.map((fixture) =>
      validator.parseAndValidateDiagnosticOutput(
        `${JSON.stringify(fixture)}\n`,
      ).application_state,
    ),
    validator.APPLICATION_STATES,
  )
})

test('output validation is frozen, exact and never accepts sensitive fields', () => {
  const parsed = validator.parseAndValidateDiagnosticOutput(
    `${JSON.stringify(resultFor('UNAPPLIED'))}\n`,
  )
  assert.equal(Object.isFrozen(parsed), true)
  assert.equal(Object.isFrozen(parsed.migration_history), true)
  assert.equal(Object.isFrozen(parsed.inventory), true)
  assert.equal(Object.isFrozen(parsed.contracts), true)
  const mutations = [
    { ...resultFor('UNAPPLIED'), extra: true },
    resultFor('PARTIAL'),
    {
      ...resultFor('UNAPPLIED'),
      inventory: { ...zeroInventory, relations_present: -1 },
    },
    {
      ...resultFor('UNAPPLIED'),
      raw_stderr: 'synthetic',
    },
    {
      ...resultFor('UNAPPLIED'),
      function_body: 'synthetic sensitive body',
    },
  ]
  for (const mutation of mutations) {
    assert.throws(
      () =>
        validator.parseAndValidateDiagnosticOutput(
          `${JSON.stringify(mutation)}\n`,
        ),
      /APPLICATION_STATE_DIAGNOSTIC_OUTPUT_INVALID/,
    )
  }
})

test('application-state runner uses one fixed PostgreSQL session', async () => {
  const productionEnvironment = {
    SUPABASE_PRODUCTION_CHANNEL_READY: 'true',
    SUPABASE_PRODUCTION_DB_URL:
      'postgresql://postgres:synthetic@db.ndbqoznvobmpkgxkiezz.supabase.co:5432/postgres?sslmode=require',
    SUPABASE_PROJECT_ID: 'ndbqoznvobmpkgxkiezz',
    RUNNER_TEMP: '/runner-temp',
    PATH: '/usr/bin:/bin',
  }
  const filesystem = {
    async stat(path: string) {
      return path.endsWith('/pgpass')
        ? { mode: 0o600 }
        : { isDirectory: () => true }
    },
    async mkdtemp(prefix: string) {
      return `${prefix}fixture`
    },
    async writeFile() {},
    async unlink() {},
    async rmdir() {},
  }
  const invocations: string[][] = []
  const outputs = ['', `${JSON.stringify(resultFor('UNAPPLIED'))}\n`]
  const spawnImplementation = (_binary: string, args: string[]) => {
    invocations.push(args)
    const child: any = new EventEmitter()
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = () => true
    queueMicrotask(() => {
      child.stdout.end(outputs[invocations.length - 1])
      child.stderr.end()
      child.emit('close', 0, null)
    })
    return child
  }
  const result = await runner.runApplicationStateDiagnostic({
    environment: productionEnvironment,
    filesystem,
    spawnImplementation,
  })
  assert.equal(result.application_state, 'UNAPPLIED')
  assert.equal(invocations.length, 2)
  assert.equal(
    invocations[1].filter((arg) => arg === 'psql').length,
    1,
  )
  assert.ok(
    invocations[1].includes(
      '--file=/workspace/supabase/deployment/line_pay_application_state_diagnostic.sql',
    ),
  )
  assert.ok(
    invocations[1].includes(
      'PGAPPNAME=line-pay-application-state-read-only-diagnostic',
    ),
  )
  assert.equal(
    invocations[1].some((arg) => /retry|fallback/iu.test(arg)),
    false,
  )
})

test('shared runner defaults remain unchanged for the existing diagnostic', () => {
  assert.deepEqual(sharedRunner.buildPsqlArgs(), [
    '--no-psqlrc',
    '--set=ON_ERROR_STOP=1',
    '--quiet',
    '--no-align',
    '--tuples-only',
    '--file=/workspace/supabase/deployment/line_pay_remediation_diagnostic.sql',
  ])
  assert.equal(sharedRunner.DATABASE_SESSION_LIMIT, 1)
})

test('disposable PostgreSQL runner waits for stable SQL readiness', () => {
  const source = readFileSync(disposableRunnerPath, 'utf8')
  assert.match(source, /let consecutiveReadyChecks = 0/u)
  assert.match(source, /['"]select 1['"]/u)
  assert.match(source, /consecutiveReadyChecks >= 2/u)
  assert.doesNotMatch(source, /if \(result[.]status === 0\) return/u)
})
