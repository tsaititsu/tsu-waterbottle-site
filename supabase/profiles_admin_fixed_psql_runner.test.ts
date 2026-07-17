import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { pathToFileURL } from 'node:url'

type SpawnCall = {
  binary: string
  args: string[]
  options: {
    cwd?: string
    env?: Record<string, string>
    shell?: boolean
    stdio?: string[]
  }
}

type FakeResult = {
  code: number | null
  signal?: string | null
  stderr?: string
  stdout?: string
}

type SpawnImplementation = (
  binary: string,
  args: string[],
  options: SpawnCall['options'],
) => EventEmitter & {
  stdout: PassThrough
  stderr: PassThrough
  kill: (signal?: string) => boolean
}

type RunnerModule = {
  PHASE_FILES: Record<string, string>
  SUCCESS_MESSAGES: Record<string, string>
  buildChildEnvironment: (connection: Record<string, string>, pgpassFile: string) => Record<string, string>
  buildPgpassLine: (connection: Record<string, string>) => string
  buildPsqlArgs: (phase: string) => string[]
  cleanupCredentialFile: (credentials: Record<string, unknown>, filesystem?: unknown) => Promise<true>
  createCredentialFile: (runnerTemp: string, connection: Record<string, string>, filesystem?: unknown) => Promise<{ directory: string; pgpassFile: string; cleaned?: boolean }>
  escapePgpass: (value: string) => string
  installSignalCleanup: (cleanup: () => Promise<void>, processObject: EventEmitter & Record<string, unknown>) => () => void
  parseDatabaseUrl: (url: string, projectId: string) => Record<string, string>
  redactSensitiveText: (text: string, connection: Record<string, string>) => string
  runDatabasePhase: (phase: string, options?: {
    environment?: Record<string, string>
    filesystem?: unknown
    processObject?: unknown
    spawnImplementation?: SpawnImplementation
  }) => Promise<string>
  safeFailureCode: (error: unknown) => string
  spawnCaptured: (binary: string, args: string[], options: SpawnCall['options'], spawnImplementation?: SpawnImplementation) => Promise<FakeResult>
  validatePhase: (phase: string) => string
  verifyFixedPsql: (spawnImplementation?: SpawnImplementation) => Promise<true>
}

type ValidatorModule = {
  APPROVED_FUNCTION_DEFINITION: string
  CANONICAL_FUNCTION_CONTRACT: Record<string, unknown>
  CANONICAL_POLICY_REFERENCES: readonly string[]
  CANONICAL_PUBLIC_SCHEMA_CONTRACT: Record<string, unknown>
  PSQL_BINARY: string
}

const root = process.cwd()
const runnerPath = join(root, 'scripts/supabase/run-fixed-psql.mjs')
const validatorPath = join(root, 'scripts/supabase/validate-profiles-admin-deployment.mjs')
let runnerSource = ''
let runner: RunnerModule
let validator: ValidatorModule

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function fakeSpawnSequence(results: FakeResult[], calls: SpawnCall[]): SpawnImplementation {
  let index = 0
  return (binary, args, options) => {
    const result = results[index]
    index += 1
    if (!result) throw new Error('unexpected fake spawn')
    calls.push({ binary, args: [...args], options: { ...options, env: options.env ? { ...options.env } : undefined } })
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough
      stderr: PassThrough
      kill: (signal?: string) => boolean
    }
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = () => true
    queueMicrotask(() => {
      child.stdout.end(result.stdout ?? '')
      child.stderr.end(result.stderr ?? '')
      child.emit('close', result.code, result.signal ?? null)
    })
    return child
  }
}

function references() {
  const unique = validator.CANONICAL_POLICY_REFERENCES.map((key) => {
    const [schema, table, policy] = key.split('.')
    return { schema, table, policy }
  })
  return [...unique, ...clone(unique.slice(0, 8))]
}

function auditFixture(phase: 'preflight' | 'postflight') {
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
      using_expression: '((auth.uid() = id) OR is_admin())',
      with_check_expression: phase === 'preflight' ? null : '((auth.uid() = id) OR is_admin())',
    },
    function: {
      ...clone(validator.CANONICAL_FUNCTION_CONTRACT),
      definition: validator.APPROVED_FUNCTION_DEFINITION,
    },
    public_schema: clone(validator.CANONICAL_PUBLIC_SCHEMA_CONTRACT),
    policy_references: references(),
  }
}

const projectId = 'abcdefghijklmnopqrst'
const fakeUrl =
  `postgresql://fake_user:fake%3Apass%5Cword@db.${projectId}.supabase.co:5432/fake%20database` +
  '?sslmode=require'

async function makeRunnerTemp() {
  return fs.mkdtemp(join(tmpdir(), 'profiles-runner-test-'))
}

async function main() {
  runnerSource = await fs.readFile(runnerPath, 'utf8')
  runner = (await import(pathToFileURL(runnerPath).href)) as RunnerModule
  validator = (await import(pathToFileURL(validatorPath).href)) as ValidatorModule
  let passed = 0
  async function contract(name: string, assertion: () => void | Promise<void>) {
    await assertion()
    passed += 1
    return name
  }

  for (const phase of ['preflight', 'migration', 'postflight']) {
    await contract(`${phase} is supported`, () => assert.equal(runner.validatePhase(phase), phase))
  }
  for (const phase of ['', 'other', 'preflight.sql', '/tmp/file.sql']) {
    await contract(`unsupported phase ${JSON.stringify(phase)} fails`, () => {
      assert.throws(() => runner.validatePhase(phase), /UNSUPPORTED_DATABASE_PHASE/)
    })
  }
  await contract('exactly three SQL files are whitelisted', () => {
    assert.deepEqual(Object.keys(runner.PHASE_FILES), ['preflight', 'migration', 'postflight'])
  })
  await contract('preflight SQL path is fixed', () => assert.match(runner.PHASE_FILES.preflight, /supabase\/deployment\/profiles_admin_escalation_preflight[.]sql$/))
  await contract('migration SQL path is fixed', () => assert.match(runner.PHASE_FILES.migration, /supabase\/migrations\/20260716084928_profiles_admin_escalation_fix[.]sql$/))
  await contract('postflight SQL path is fixed', () => assert.match(runner.PHASE_FILES.postflight, /supabase\/deployment\/profiles_admin_escalation_postflight[.]sql$/))
  await contract('psql argv is fixed and non-secret', () => {
    assert.deepEqual(runner.buildPsqlArgs('migration').slice(0, 4), ['--no-psqlrc', '--set=ON_ERROR_STOP=1', '--no-align', '--tuples-only'])
    assert.equal(runner.buildPsqlArgs('migration').length, 5)
  })
  await contract('arbitrary SQL path cannot enter argv', () => {
    assert.throws(() => runner.buildPsqlArgs('/tmp/evil.sql'), /UNSUPPORTED_DATABASE_PHASE/)
  })

  await contract('valid PostgreSQL URL parses percent encoding', () => {
    const parsed = runner.parseDatabaseUrl(fakeUrl, projectId)
    assert.equal(parsed.username, 'fake_user')
    assert.equal(parsed.password, 'fake:pass\\word')
    assert.equal(parsed.database, 'fake database')
    assert.equal(parsed.sslmode, 'require')
  })
  await contract('postgres protocol is accepted', () => {
    assert.equal(runner.parseDatabaseUrl(fakeUrl.replace('postgresql:', 'postgres:'), projectId).host, `db.${projectId}.supabase.co`)
  })
  await contract('missing sslmode defaults to require', () => {
    assert.equal(runner.parseDatabaseUrl(fakeUrl.replace('?sslmode=require', ''), projectId).sslmode, 'require')
  })
  for (const sslmode of ['require', 'verify-ca', 'verify-full']) {
    await contract(`sslmode ${sslmode} is accepted`, () => {
      assert.equal(runner.parseDatabaseUrl(fakeUrl.replace('sslmode=require', `sslmode=${sslmode}`), projectId).sslmode, sslmode)
    })
  }
  for (const sslmode of ['disable', 'allow', 'prefer']) {
    await contract(`sslmode ${sslmode} is rejected`, () => {
      assert.throws(() => runner.parseDatabaseUrl(fakeUrl.replace('sslmode=require', `sslmode=${sslmode}`), projectId), /DATABASE_URL_INVALID/)
    })
  }
  const invalidUrls: Array<[string, string]> = [
    ['missing URL', ''],
    ['non PostgreSQL protocol', fakeUrl.replace('postgresql:', 'https:')],
    ['missing host', 'postgresql://fake_user:fake-password@:5432/postgres?sslmode=require'],
    ['missing username', `postgresql://:fake-password@db.${projectId}.supabase.co:5432/postgres?sslmode=require`],
    ['missing password', `postgresql://fake_user@db.${projectId}.supabase.co:5432/postgres?sslmode=require`],
    ['missing database', `postgresql://fake_user:fake-password@db.${projectId}.supabase.co:5432/?sslmode=require`],
    ['fragment', `${fakeUrl}#fragment`],
    ['unknown query parameter', `${fakeUrl}&application_name=unsafe`],
    ['duplicate sslmode', `${fakeUrl}&sslmode=require`],
    ['port zero', fakeUrl.replace(':5432/', ':0/')],
  ]
  for (const [name, url] of invalidUrls) {
    await contract(`${name} is rejected`, () => assert.throws(() => runner.parseDatabaseUrl(url, projectId), /SUPABASE_DB_URL_MISSING|DATABASE_URL_INVALID/))
  }
  await contract('missing project id is rejected', () => assert.throws(() => runner.parseDatabaseUrl(fakeUrl, ''), /SUPABASE_PROJECT_ID_MISSING/))
  await contract('invalid project id is rejected', () => assert.throws(() => runner.parseDatabaseUrl(fakeUrl, 'short'), /DATABASE_TARGET_MISMATCH/))
  await contract('host and project mismatch is rejected', () => assert.throws(() => runner.parseDatabaseUrl(fakeUrl, 'bbbbbbbbbbbbbbbbbbbb'), /DATABASE_TARGET_MISMATCH/))

  await contract('pgpass escapes colon', () => assert.equal(runner.escapePgpass('fake:pass'), 'fake\\:pass'))
  await contract('pgpass escapes backslash', () => assert.equal(runner.escapePgpass('fake\\pass'), 'fake\\\\pass'))
  await contract('pgpass line escapes every field', () => {
    const connection = runner.parseDatabaseUrl(fakeUrl, projectId)
    assert.equal(runner.buildPgpassLine(connection), `db.${projectId}.supabase.co:5432:fake database:fake_user:fake\\:pass\\\\word`)
  })

  await contract('child environment contains only approved keys', () => {
    const connection = runner.parseDatabaseUrl(fakeUrl, projectId)
    const env = runner.buildChildEnvironment(connection, '/tmp/fake-pgpass')
    assert.deepEqual(Object.keys(env).sort(), ['LANG', 'LC_ALL', 'PGAPPNAME', 'PGCONNECT_TIMEOUT', 'PGDATABASE', 'PGHOST', 'PGPASSFILE', 'PGPORT', 'PGSSLMODE', 'PGUSER'].sort())
  })
  await contract('child environment excludes secrets and project id', () => {
    const connection = runner.parseDatabaseUrl(fakeUrl, projectId)
    const env = runner.buildChildEnvironment(connection, '/tmp/fake-pgpass')
    for (const key of ['SUPABASE_DB_URL', 'SUPABASE_PROJECT_ID', 'PGPASSWORD', 'GITHUB_TOKEN']) assert.equal(Object.hasOwn(env, key), false)
  })
  await contract('child environment fixes app name and timeout', () => {
    const env = runner.buildChildEnvironment(runner.parseDatabaseUrl(fakeUrl, projectId), '/tmp/fake-pgpass')
    assert.equal(env.PGAPPNAME, 'profiles-admin-emergency-migration')
    assert.equal(env.PGCONNECT_TIMEOUT, '15')
  })

  await contract('redaction removes URL and decoded or encoded secrets', () => {
    const connection = runner.parseDatabaseUrl(fakeUrl, projectId)
    const raw = `${fakeUrl} ${connection.password} ${connection.encodedPassword} ${connection.username} ${connection.host} ${connection.database} ${projectId}`
    const redacted = runner.redactSensitiveText(raw, connection)
    for (const secret of [fakeUrl, connection.password, connection.encodedPassword, connection.username, connection.host, connection.database, projectId]) assert.equal(redacted.includes(secret), false)
  })
  await contract('source never spreads process env into child', () => assert.doesNotMatch(runnerSource, /\.\.\.process[.]env/))
  await contract('source never references PGPASSWORD or db-url', () => assert.doesNotMatch(runnerSource, /PGPASSWORD|--db-url/))
  await contract('source fixes shell false', () => assert.match(runnerSource, /shell: false/))
  await contract('source captures stderr without logging it', () => {
    assert.match(runnerSource, /child[.]stderr[?][.]on\('data'/)
    assert.doesNotMatch(runnerSource, /console[.]error\([^\n]*(stderr|result[.]stderr)/)
  })

  await contract('fixed psql 16 version succeeds', async () => {
    const calls: SpawnCall[] = []
    const spawnImplementation = fakeSpawnSequence([{ code: 0, stdout: 'psql (PostgreSQL) 16.8\n' }], calls)
    assert.equal(await runner.verifyFixedPsql(spawnImplementation), true)
    assert.equal(calls[0].binary, validator.PSQL_BINARY)
    assert.deepEqual(calls[0].args, ['--version'])
    assert.deepEqual(calls[0].options.env, { LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' })
  })
  await contract('non-16 psql fails before secret handling', async () => {
    const spawnImplementation = fakeSpawnSequence([{ code: 0, stdout: 'psql (PostgreSQL) 17.1\n' }], [])
    await assert.rejects(() => runner.verifyFixedPsql(spawnImplementation), /UNSUPPORTED_PSQL_VERSION/)
  })
  await contract('psql version process failure is fixed-code only', async () => {
    const spawnImplementation = fakeSpawnSequence([{ code: 1, stderr: `secret ${fakeUrl}` }], [])
    await assert.rejects(() => runner.verifyFixedPsql(spawnImplementation), /PSQL_VERSION_CHECK_FAILED/)
  })

  await contract('credential file uses unpredictable directory and 0600 mode', async () => {
    const runnerTemp = await makeRunnerTemp()
    const connection = runner.parseDatabaseUrl(fakeUrl, projectId)
    const credentials = await runner.createCredentialFile(runnerTemp, connection)
    const stat = await fs.stat(credentials.pgpassFile)
    assert.equal(stat.mode & 0o777, 0o600)
    assert.match(credentials.directory, /profiles-admin-/)
    assert.equal((await fs.readFile(credentials.pgpassFile, 'utf8')).trim(), runner.buildPgpassLine(connection))
    await runner.cleanupCredentialFile(credentials)
    await fs.rmdir(runnerTemp)
  })
  await contract('relative RUNNER_TEMP is rejected', async () => {
    await assert.rejects(() => runner.createCredentialFile('relative', runner.parseDatabaseUrl(fakeUrl, projectId)), /RUNNER_TEMP_INVALID/)
  })
  await contract('cleanup is idempotent after success', async () => {
    const runnerTemp = await makeRunnerTemp()
    const credentials = await runner.createCredentialFile(runnerTemp, runner.parseDatabaseUrl(fakeUrl, projectId))
    assert.equal(await runner.cleanupCredentialFile(credentials), true)
    assert.equal(await runner.cleanupCredentialFile(credentials), true)
    await fs.rmdir(runnerTemp)
  })

  async function runPhase(phase: 'preflight' | 'migration' | 'postflight', phaseResult: FakeResult) {
    const runnerTemp = await makeRunnerTemp()
    const calls: SpawnCall[] = []
    const spawnImplementation = fakeSpawnSequence([
      { code: 0, stdout: 'psql (PostgreSQL) 16.8\n' },
      phaseResult,
    ], calls)
    const execution = runner.runDatabasePhase(phase, {
      environment: {
        RUNNER_TEMP: runnerTemp,
        SUPABASE_DB_URL: fakeUrl,
        SUPABASE_PROJECT_ID: projectId,
      },
      spawnImplementation,
    })
    return { calls, execution, runnerTemp }
  }

  for (const phase of ['preflight', 'migration', 'postflight'] as const) {
    await contract(`${phase} succeeds with fixed message and cleans credentials`, async () => {
      const stdout = phase === 'migration' ? '' : `${JSON.stringify(auditFixture(phase))}\n`
      const { calls, execution, runnerTemp } = await runPhase(phase, { code: 0, stdout })
      assert.equal(await execution, runner.SUCCESS_MESSAGES[phase])
      assert.deepEqual(await fs.readdir(runnerTemp), [])
      const databaseCall = calls[1]
      assert.equal(databaseCall.binary, validator.PSQL_BINARY)
      assert.equal(databaseCall.options.shell, false)
      assert.equal(databaseCall.args.length, 5)
      await fs.rmdir(runnerTemp)
    })
  }
  await contract('database argv contains no URL or connection identity', async () => {
    const { calls, execution, runnerTemp } = await runPhase('migration', { code: 0 })
    await execution
    const argv = calls[1].args.join(' ')
    for (const secret of [fakeUrl, 'fake_user', `db.${projectId}.supabase.co`, 'fake database', 'fake:pass\\word', projectId]) assert.equal(argv.includes(secret), false)
    await fs.rmdir(runnerTemp)
  })
  await contract('database child env never inherits URL or project id', async () => {
    const { calls, execution, runnerTemp } = await runPhase('migration', { code: 0 })
    await execution
    const env = calls[1].options.env ?? {}
    assert.equal(Object.hasOwn(env, 'SUPABASE_DB_URL'), false)
    assert.equal(Object.hasOwn(env, 'SUPABASE_PROJECT_ID'), false)
    assert.equal(Object.hasOwn(env, 'PGPASSWORD'), false)
    await fs.rmdir(runnerTemp)
  })
  for (const phase of ['preflight', 'migration', 'postflight'] as const) {
    await contract(`${phase} psql failure is fixed-code and cleans credentials`, async () => {
      const { execution, runnerTemp } = await runPhase(phase, { code: 1, stderr: `${fakeUrl} fake:pass\\word` })
      await assert.rejects(() => execution, new RegExp(`${phase.toUpperCase()}_PSQL_FAILED`))
      assert.deepEqual(await fs.readdir(runnerTemp), [])
      await fs.rmdir(runnerTemp)
    })
  }
  await contract('preflight parser failure cleans credentials', async () => {
    const { execution, runnerTemp } = await runPhase('preflight', { code: 0, stdout: 'not-json' })
    await assert.rejects(() => execution, /DATABASE_OUTPUT_INVALID/)
    assert.deepEqual(await fs.readdir(runnerTemp), [])
    await fs.rmdir(runnerTemp)
  })
  await contract('postflight contract drift cleans credentials', async () => {
    const fixture = auditFixture('postflight')
    fixture.status = 'IS_ADMIN_FUNCTION_DRIFT'
    const { execution, runnerTemp } = await runPhase('postflight', { code: 0, stdout: JSON.stringify(fixture) })
    await assert.rejects(() => execution, /POSTFLIGHT_CONTRACT_FAILED/)
    assert.deepEqual(await fs.readdir(runnerTemp), [])
    await fs.rmdir(runnerTemp)
  })
  await contract('cleanup failure overrides successful operation', async () => {
    const runnerTemp = await makeRunnerTemp()
    let createdFile = ''
    let createdDirectory = ''
    const filesystem = {
      stat: fs.stat.bind(fs),
      mkdtemp: fs.mkdtemp.bind(fs),
      writeFile: fs.writeFile.bind(fs),
      unlink: async (path: string) => { createdFile = path; throw new Error('fake cleanup failure') },
      rmdir: async (path: string) => { createdDirectory = path; return fs.rmdir(path) },
    }
    const calls: SpawnCall[] = []
    const spawnImplementation = fakeSpawnSequence([
      { code: 0, stdout: 'psql (PostgreSQL) 16.8\n' },
      { code: 0 },
    ], calls)
    await assert.rejects(() => runner.runDatabasePhase('migration', {
      environment: { RUNNER_TEMP: runnerTemp, SUPABASE_DB_URL: fakeUrl, SUPABASE_PROJECT_ID: projectId },
      filesystem,
      spawnImplementation,
    }), /TEMP_CREDENTIAL_CLEANUP_FAILED/)
    assert.ok(createdFile)
    await fs.unlink(createdFile)
    await fs.rmdir(join(createdFile, '..'))
    await fs.rmdir(runnerTemp)
    assert.equal(createdDirectory, '')
  })
  await contract('signal handler cleans before exiting', async () => {
    const fakeProcess = new EventEmitter() as EventEmitter & Record<string, unknown>
    let cleaned = false
    let exitCode: number | null = null
    let stderr = ''
    fakeProcess.stderr = { write: (value: string) => { stderr += value } }
    fakeProcess.exit = (code: number) => { exitCode = code }
    const remove = runner.installSignalCleanup(async () => { cleaned = true }, fakeProcess)
    fakeProcess.emit('SIGTERM')
    await new Promise((resolvePromise) => setImmediate(resolvePromise))
    assert.equal(cleaned, true)
    assert.equal(exitCode, 1)
    assert.equal(stderr, 'PROCESS_INTERRUPTED\n')
    remove()
  })
  await contract('signal cleanup failure emits cleanup code', async () => {
    const fakeProcess = new EventEmitter() as EventEmitter & Record<string, unknown>
    let stderr = ''
    fakeProcess.stderr = { write: (value: string) => { stderr += value } }
    fakeProcess.exit = () => undefined
    const remove = runner.installSignalCleanup(async () => { throw new Error('fake') }, fakeProcess)
    fakeProcess.emit('SIGHUP')
    await new Promise((resolvePromise) => setImmediate(resolvePromise))
    assert.equal(stderr, 'TEMP_CREDENTIAL_CLEANUP_FAILED\n')
    remove()
  })
  await contract('unknown errors collapse to non-secret fixed code', () => {
    assert.equal(runner.safeFailureCode(new Error(fakeUrl)), 'DATABASE_OUTPUT_INVALID')
  })
  await contract('known errors preserve only fixed code', () => {
    assert.equal(runner.safeFailureCode(new Error('MIGRATION_PSQL_FAILED')), 'MIGRATION_PSQL_FAILED')
  })

  console.log(`✓ ${passed} fixed psql runner security contracts passed`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
