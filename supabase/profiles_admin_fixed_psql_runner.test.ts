import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
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
  CONNECTION_MODES: Record<string, string>
  PHASE_FILES: Record<string, string>
  SUCCESS_MESSAGES: Record<string, string>
  buildChildEnvironment: (connection: Record<string, string>, pgpassFile: string) => Record<string, string>
  buildPgpassLine: (connection: Record<string, string>) => string
  buildPsqlArgs: (phase: string) => string[]
  cleanupCredentialFile: (credentials: Record<string, unknown>, filesystem?: unknown) => Promise<true>
  createCredentialFile: (runnerTemp: string, connection: Record<string, string>, filesystem?: unknown) => Promise<{ directory: string; pgpassFile: string; cleaned?: boolean }>
  escapePgpass: (value: string) => string
  installSignalCleanup: (cleanup: () => Promise<void>, processObject: EventEmitter & Record<string, unknown>) => () => void
  isValidSupavisorSessionHostname: (hostname: string) => boolean
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
  EXPECTED_RUNNER_SHA256: string
  PSQL_BINARY: string
  validateRunnerHash: (actualHash: string) => true
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
const otherProjectId = 'bbbbbbbbbbbbbbbbbbbb'
const directHost = `db.${projectId}.supabase.co`
const poolerHost = 'aws-0-us-east-1.pooler.supabase.com'
const fakeUrl =
  `postgresql://postgres:fake%3Apass%5Cword@${directHost}:5432/postgres` +
  '?sslmode=require'
const poolerUrl =
  `postgresql://postgres.${projectId}:fake%3Apass%5Cword@${poolerHost}:5432/postgres` +
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

  await contract('direct URL parses percent-encoded password and derives direct mode', () => {
    const parsed = runner.parseDatabaseUrl(fakeUrl, projectId)
    assert.equal(parsed.username, 'postgres')
    assert.equal(parsed.password, 'fake:pass\\word')
    assert.equal(parsed.database, 'postgres')
    assert.equal(parsed.port, '5432')
    assert.equal(parsed.sslmode, 'require')
    assert.equal(parsed.mode, runner.CONNECTION_MODES.direct)
    assert.equal(Object.isFrozen(parsed), true)
  })
  await contract('postgres protocol is accepted', () => {
    assert.equal(runner.parseDatabaseUrl(fakeUrl.replace('postgresql:', 'postgres:'), projectId).host, directHost)
  })
  await contract('direct omitted port normalizes to 5432', () => {
    const parsed = runner.parseDatabaseUrl(fakeUrl.replace(':5432/', '/'), projectId)
    assert.equal(parsed.port, '5432')
    assert.equal(parsed.mode, runner.CONNECTION_MODES.direct)
  })
  await contract('Supavisor session URL derives bound session mode', () => {
    const parsed = runner.parseDatabaseUrl(poolerUrl, projectId)
    assert.equal(parsed.host, poolerHost)
    assert.equal(parsed.username, `postgres.${projectId}`)
    assert.equal(parsed.database, 'postgres')
    assert.equal(parsed.port, '5432')
    assert.equal(parsed.mode, runner.CONNECTION_MODES.supavisorSession)
    assert.equal(Object.isFrozen(parsed), true)
  })
  await contract('Supavisor session omitted port normalizes to 5432', () => {
    const parsed = runner.parseDatabaseUrl(poolerUrl.replace(':5432/', '/'), projectId)
    assert.equal(parsed.port, '5432')
    assert.equal(parsed.mode, runner.CONNECTION_MODES.supavisorSession)
  })
  await contract('percent-encoded pooler username is validated after decoding', () => {
    const encodedUsernameUrl = poolerUrl.replace('postgres.', 'postgres%2E')
    assert.equal(runner.parseDatabaseUrl(encodedUsernameUrl, projectId).username, `postgres.${projectId}`)
  })
  await contract('formal Supabase shared pooler host grammar is accepted without a region allowlist', () => {
    for (const host of [
      'aws-0-us-east-1.pooler.supabase.com',
      'aws-7-eu-central-2.pooler.supabase.com',
      'aws-12-us-gov-east-1.pooler.supabase.com',
    ]) {
      assert.equal(runner.isValidSupavisorSessionHostname(host), true)
    }
  })
  await contract('missing sslmode defaults to require for both modes', () => {
    assert.equal(runner.parseDatabaseUrl(fakeUrl.replace('?sslmode=require', ''), projectId).sslmode, 'require')
    assert.equal(runner.parseDatabaseUrl(poolerUrl.replace('?sslmode=require', ''), projectId).sslmode, 'require')
  })
  for (const sslmode of ['require', 'verify-ca', 'verify-full']) {
    await contract(`sslmode ${sslmode} is accepted for direct and session modes`, () => {
      assert.equal(runner.parseDatabaseUrl(fakeUrl.replace('sslmode=require', `sslmode=${sslmode}`), projectId).sslmode, sslmode)
      assert.equal(runner.parseDatabaseUrl(poolerUrl.replace('sslmode=require', `sslmode=${sslmode}`), projectId).sslmode, sslmode)
    })
  }
  for (const sslmode of ['disable', 'allow', 'prefer']) {
    await contract(`sslmode ${sslmode} is rejected`, () => {
      assert.throws(() => runner.parseDatabaseUrl(fakeUrl.replace('sslmode=require', `sslmode=${sslmode}`), projectId), /DATABASE_URL_INVALID/)
    })
  }
  const invalidUrls: Array<[string, string, RegExp]> = [
    ['missing URL', '', /SUPABASE_DB_URL_MISSING/],
    ['non PostgreSQL protocol', fakeUrl.replace('postgresql:', 'https:'), /DATABASE_URL_INVALID/],
    ['missing host', 'postgresql://postgres:fake-password@:5432/postgres?sslmode=require', /DATABASE_URL_INVALID/],
    ['missing username', `postgresql://:fake-password@${directHost}:5432/postgres?sslmode=require`, /DATABASE_URL_INVALID/],
    ['missing password', `postgresql://postgres@${directHost}:5432/postgres?sslmode=require`, /DATABASE_URL_INVALID/],
    ['missing database', `postgresql://postgres:fake-password@${directHost}:5432/?sslmode=require`, /DATABASE_URL_INVALID/],
    ['database mismatch', fakeUrl.replace('/postgres?', '/other?'), /DATABASE_URL_INVALID/],
    ['fragment', `${fakeUrl}#fragment`, /DATABASE_URL_INVALID/],
    ['unknown query parameter', `${fakeUrl}&application_name=unsafe`, /DATABASE_URL_INVALID/],
    ['gssencmode query cannot control child environment', `${poolerUrl}&gssencmode=disable`, /DATABASE_URL_INVALID/],
    ['duplicate sslmode', `${fakeUrl}&sslmode=require`, /DATABASE_URL_INVALID/],
    ['invalid sslmode', fakeUrl.replace('sslmode=require', 'sslmode=prefer'), /DATABASE_URL_INVALID/],
    ['port zero', fakeUrl.replace(':5432/', ':0/'), /DATABASE_URL_INVALID/],
    ['empty explicit port', fakeUrl.replace(':5432/', ':/'), /DATABASE_URL_INVALID/],
    ['port 65536', fakeUrl.replace(':5432/', ':65536/'), /DATABASE_URL_INVALID/],
    ['non-numeric port', fakeUrl.replace(':5432/', ':abc/'), /DATABASE_URL_INVALID/],
    ['shared transaction pooler 6543', poolerUrl.replace(':5432/', ':6543/'), /DATABASE_URL_INVALID/],
    ['dedicated transaction pooler 6543', fakeUrl.replace(':5432/', ':6543/'), /DATABASE_URL_INVALID/],
    ['pooler username missing project ref', poolerUrl.replace(`postgres.${projectId}`, 'postgres'), /DATABASE_TARGET_MISMATCH/],
    ['pooler username project mismatch', poolerUrl.replace(projectId, otherProjectId), /DATABASE_TARGET_MISMATCH/],
    ['percent-encoded username decodes to mismatch', poolerUrl.replace(`postgres.${projectId}`, `postgres%2E${otherProjectId}`), /DATABASE_TARGET_MISMATCH/],
    ['direct host project mismatch', fakeUrl.replace(projectId, otherProjectId), /DATABASE_TARGET_MISMATCH/],
    ['direct username mismatch', fakeUrl.replace('postgres:', 'other:'), /DATABASE_URL_INVALID/],
    ['pooler hostname has no AWS region prefix', poolerUrl.replace(poolerHost, 'pooler.supabase.com'), /DATABASE_URL_INVALID/],
    ['informal evil pooler prefix', poolerUrl.replace(poolerHost, 'evil.pooler.supabase.com'), /DATABASE_URL_INVALID/],
    ['pooler extra suffix', poolerUrl.replace(poolerHost, `${poolerHost}.evil.example`), /DATABASE_URL_INVALID/],
    ['pooler suffix substring bypass', poolerUrl.replace(poolerHost, 'aws-0-us-east-1.pooler.supabase.com.evil.example'), /DATABASE_URL_INVALID/],
    ['localhost', poolerUrl.replace(poolerHost, 'localhost'), /DATABASE_URL_INVALID/],
    ['IPv4 literal', poolerUrl.replace(poolerHost, '127.0.0.1'), /DATABASE_URL_INVALID/],
    ['IPv6 literal', poolerUrl.replace(poolerHost, '[::1]'), /DATABASE_URL_INVALID/],
    ['Unicode hostname', poolerUrl.replace(poolerHost, 'aws-0-us-éast-1.pooler.supabase.com'), /DATABASE_URL_INVALID/],
    ['punycode hostname', poolerUrl.replace(poolerHost, 'aws-0-xn--east-9za-1.pooler.supabase.com'), /DATABASE_URL_INVALID/],
    ['pooler node has a leading zero', poolerUrl.replace(poolerHost, 'aws-00-us-east-1.pooler.supabase.com'), /DATABASE_URL_INVALID/],
    ['pooler region number has a leading zero', poolerUrl.replace(poolerHost, 'aws-0-us-east-01.pooler.supabase.com'), /DATABASE_URL_INVALID/],
    ['uppercase hostname normalization', poolerUrl.replace(poolerHost, 'AWS-0-US-EAST-1.POOLER.SUPABASE.COM'), /DATABASE_URL_INVALID/],
    ['trailing dot hostname', poolerUrl.replace(poolerHost, `${poolerHost}.`), /DATABASE_URL_INVALID/],
    ['raw whitespace', poolerUrl.replace('fake%3Apass', 'fake pass'), /DATABASE_URL_INVALID/],
    ['encoded password newline', poolerUrl.replace('fake%3Apass%5Cword', 'fake%0Apass'), /DATABASE_URL_INVALID/],
  ]
  for (const [name, url, expectedCode] of invalidUrls) {
    await contract(`${name} is rejected fail closed`, () => {
      assert.throws(() => runner.parseDatabaseUrl(url, projectId), expectedCode)
    })
  }
  await contract('missing project id is rejected', () => assert.throws(() => runner.parseDatabaseUrl(fakeUrl, ''), /SUPABASE_PROJECT_ID_MISSING/))
  for (const invalidProjectId of ['short', projectId.toUpperCase(), `${projectId}x`, 'abcdefghijklmnopqrs-']) {
    await contract(`invalid project id ${JSON.stringify(invalidProjectId)} is rejected`, () => {
      assert.throws(() => runner.parseDatabaseUrl(fakeUrl, invalidProjectId), /DATABASE_TARGET_MISMATCH/)
    })
  }
  await contract('invalid URL errors never contain connection identity', () => {
    for (const [, url] of invalidUrls) {
      try {
        runner.parseDatabaseUrl(url, projectId)
        assert.fail('expected parse failure')
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        for (const sensitive of [url, projectId, poolerHost, directHost, 'fake:pass\\word']) {
          if (sensitive) assert.equal(message.includes(sensitive), false)
        }
      }
    }
  })

  await contract('pgpass escapes colon', () => assert.equal(runner.escapePgpass('fake:pass'), 'fake\\:pass'))
  await contract('pgpass escapes backslash', () => assert.equal(runner.escapePgpass('fake\\pass'), 'fake\\\\pass'))
  await contract('pgpass line escapes every field', () => {
    const connection = runner.parseDatabaseUrl(fakeUrl, projectId)
    assert.equal(runner.buildPgpassLine(connection), `${directHost}:5432:postgres:postgres:fake\\:pass\\\\word`)
  })
  await contract('Supavisor session pgpass line preserves the bound username', () => {
    const connection = runner.parseDatabaseUrl(poolerUrl, projectId)
    assert.equal(runner.buildPgpassLine(connection), `${poolerHost}:5432:postgres:postgres.${projectId}:fake\\:pass\\\\word`)
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
  await contract('Supavisor session child environment is complete and disables GSS negotiation', () => {
    const connection = runner.parseDatabaseUrl(poolerUrl, projectId)
    const env = runner.buildChildEnvironment(connection, '/tmp/fake-pgpass')
    assert.deepEqual(env, {
      LANG: 'C.UTF-8',
      LC_ALL: 'C.UTF-8',
      PGHOST: poolerHost,
      PGPORT: '5432',
      PGDATABASE: 'postgres',
      PGUSER: `postgres.${projectId}`,
      PGPASSFILE: '/tmp/fake-pgpass',
      PGSSLMODE: 'require',
      PGAPPNAME: 'profiles-admin-emergency-migration',
      PGCONNECT_TIMEOUT: '15',
      PGGSSENCMODE: 'disable',
    })
  })
  await contract('direct child environment does not change GSS behavior', () => {
    const env = runner.buildChildEnvironment(runner.parseDatabaseUrl(fakeUrl, projectId), '/tmp/fake-pgpass')
    assert.equal(Object.hasOwn(env, 'PGGSSENCMODE'), false)
  })

  await contract('redaction removes URL and decoded or encoded secrets', () => {
    const connection = runner.parseDatabaseUrl(fakeUrl, projectId)
    const raw = `${fakeUrl} ${connection.password} ${connection.encodedPassword} ${connection.username} ${connection.host} ${connection.database} ${projectId}`
    const redacted = runner.redactSensitiveText(raw, connection)
    for (const secret of [fakeUrl, connection.password, connection.encodedPassword, connection.username, connection.host, connection.database, projectId]) assert.equal(redacted.includes(secret), false)
  })
  await contract('Supavisor redaction removes pooler identity and project binding', () => {
    const connection = runner.parseDatabaseUrl(poolerUrl, projectId)
    const raw = `${poolerUrl} ${connection.password} ${connection.encodedPassword} ${connection.username} ${connection.host} ${connection.database} ${projectId}`
    const redacted = runner.redactSensitiveText(raw, connection)
    for (const secret of [poolerUrl, connection.password, connection.encodedPassword, connection.username, connection.host, connection.database, projectId]) {
      assert.equal(redacted.includes(secret), false)
    }
  })
  await contract('runner source performs no DNS or network lookup', () => {
    assert.doesNotMatch(runnerSource, /node:(?:dns|net|tls)|\bfetch\s*\(/u)
  })
  await contract('runner source hash matches the source validator contract', () => {
    assert.equal(createHash('sha256').update(runnerSource).digest('hex'), validator.EXPECTED_RUNNER_SHA256)
    assert.equal(validator.validateRunnerHash(validator.EXPECTED_RUNNER_SHA256), true)
    assert.throws(() => validator.validateRunnerHash('0'.repeat(64)), /RUNNER_HASH_MISMATCH/)
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

  async function runPhase(
    phase: 'preflight' | 'migration' | 'postflight',
    phaseResult: FakeResult,
    databaseUrl = fakeUrl,
  ) {
    const runnerTemp = await makeRunnerTemp()
    const calls: SpawnCall[] = []
    const spawnImplementation = fakeSpawnSequence([
      { code: 0, stdout: 'psql (PostgreSQL) 16.8\n' },
      phaseResult,
    ], calls)
    const execution = runner.runDatabasePhase(phase, {
      environment: {
        RUNNER_TEMP: runnerTemp,
        SUPABASE_DB_URL: databaseUrl,
        SUPABASE_PROJECT_ID: projectId,
      },
      spawnImplementation,
    })
    return { calls, execution, runnerTemp }
  }

  await contract('Supavisor session mode reaches only the mocked psql child with approved environment', async () => {
    const { calls, execution, runnerTemp } = await runPhase('migration', { code: 0 }, poolerUrl)
    assert.equal(await execution, runner.SUCCESS_MESSAGES.migration)
    assert.equal(calls.length, 2)
    assert.equal(calls[1].options.env?.PGHOST, poolerHost)
    assert.equal(calls[1].options.env?.PGPORT, '5432')
    assert.equal(calls[1].options.env?.PGUSER, `postgres.${projectId}`)
    assert.equal(calls[1].options.env?.PGGSSENCMODE, 'disable')
    assert.equal(Object.hasOwn(calls[1].options.env ?? {}, 'PGPASSWORD'), false)
    assert.deepEqual(await fs.readdir(runnerTemp), [])
    await fs.rmdir(runnerTemp)
  })
  await contract('invalid transaction pooler fails before credential or database child creation', async () => {
    const runnerTemp = await makeRunnerTemp()
    const calls: SpawnCall[] = []
    const spawnImplementation = fakeSpawnSequence([
      { code: 0, stdout: 'psql (PostgreSQL) 16.8\n' },
    ], calls)
    await assert.rejects(
      () => runner.runDatabasePhase('migration', {
        environment: {
          RUNNER_TEMP: runnerTemp,
          SUPABASE_DB_URL: poolerUrl.replace(':5432/', ':6543/'),
          SUPABASE_PROJECT_ID: projectId,
        },
        spawnImplementation,
      }),
      /DATABASE_URL_INVALID/,
    )
    assert.equal(calls.length, 1)
    assert.deepEqual(await fs.readdir(runnerTemp), [])
    await fs.rmdir(runnerTemp)
  })

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
    for (const secret of [fakeUrl, 'postgres', directHost, 'fake:pass\\word', projectId]) {
      assert.equal(argv.includes(secret), false)
    }
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
