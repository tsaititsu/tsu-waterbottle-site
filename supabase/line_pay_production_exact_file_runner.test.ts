import assert from 'node:assert/strict'
import {
  spawn as spawnProcess,
  type ChildProcessWithoutNullStreams,
} from 'node:child_process'
import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const writableTestRoot = process.env.LINE_PAY_TEST_TMPDIR ?? root
const validatorPath = join(
  root,
  'scripts/supabase/validate-line-pay-production-deployment.mjs',
)
const runnerPath = join(
  root,
  'scripts/supabase/run-line-pay-production-exact-file.mjs',
)

test('validator fixes the complete Production deployment identity', async () => {
  const validator = await import(pathToFileURL(validatorPath).href)
  const migration = readFileSync(join(root, validator.MIGRATION_FILE))
  const fence = readFileSync(join(root, validator.FENCE_MIGRATION_FILE))

  assert.equal(validator.EXPECTED_REPOSITORY, 'tsaititsu/tsu-waterbottle-site')
  assert.equal(validator.EXPECTED_PROJECT_REF, 'ndbqoznvobmpkgxkiezz')
  assert.equal(validator.EXPECTED_EVENT, 'workflow_dispatch')
  assert.equal(validator.EXPECTED_REF, 'refs/heads/main')
  assert.equal(validator.EXPECTED_NODE_VERSION, 'v24.16.0')
  assert.equal(
    validator.POSTGRES_IMAGE,
    'postgres@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193',
  )
  assert.equal(
    validator.EXPECTED_CONFIRMATION,
    'DEPLOY_LINE_PAY_REMEDIATION_EXACT_FILE_ONCE',
  )
  assert.equal(
    validator.MIGRATION_FILE,
    'supabase/migrations/20260719033404_line_pay_remediation_contracts.sql',
  )
  assert.equal(
    validator.FENCE_MIGRATION_FILE,
    'supabase/migrations/20260722065311_retire_bank_transfer_submissions_writes.sql',
  )
  assert.equal(
    createHash('sha256').update(migration).digest('hex'),
    '370984c499d93f602b3dccf876becd030085e88ccd9a17106fee8b0009d84046',
  )
  assert.equal(
    createHash('sha256').update(fence).digest('hex'),
    '2f43979b1f4ff88243296f0a389c146b879652715d40d23bdb7ce1d6785407d7',
  )
})

test('validator rejects identity mutations and unsupported PostgreSQL clients', async () => {
  const validator = await import(pathToFileURL(validatorPath).href)

  assert.equal(validator.validateFullSha('a'.repeat(40)), 'a'.repeat(40))
  assert.throws(() => validator.validateFullSha('abc'), /INVALID_MAIN_SHA/)
  assert.equal(
    validator.validateConfirmation(
      'DEPLOY_LINE_PAY_REMEDIATION_EXACT_FILE_ONCE',
    ),
    true,
  )
  assert.throws(
    () => validator.validateConfirmation('DEPLOY'),
    /INVALID_DEPLOYMENT_CONFIRMATION/,
  )
  assert.equal(validator.validateProjectRef('ndbqoznvobmpkgxkiezz'), true)
  assert.throws(
    () => validator.validateProjectRef('aaaaaaaaaaaaaaaaaaaa'),
    /PROJECT_REF_MISMATCH/,
  )
  assert.equal(
    validator.validateMigrationHash(
      '370984c499d93f602b3dccf876becd030085e88ccd9a17106fee8b0009d84046',
    ),
    true,
  )
  assert.throws(
    () => validator.validateMigrationHash('0'.repeat(64)),
    /MIGRATION_HASH_MISMATCH/,
  )
  assert.equal(
    validator.validateFenceHash(
      '2f43979b1f4ff88243296f0a389c146b879652715d40d23bdb7ce1d6785407d7',
    ),
    true,
  )
  assert.throws(
    () => validator.validateFenceHash('0'.repeat(64)),
    /FENCE_HASH_MISMATCH/,
  )
  assert.equal(validator.validateNodeVersion('v24.16.0'), true)
  for (const version of ['24', '24.x', 'v24.15.0', 'v24.16.0\n', 'v24.16.0x']) {
    assert.throws(
      () => validator.validateNodeVersion(version),
      /INVALID_NODE_VERSION/,
    )
  }
  assert.equal(
    validator.validatePostgresImage(
      'postgres@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193',
    ),
    true,
  )
  for (const image of [
    'postgres:17',
    'postgres:17-alpine',
    'postgres@main',
    'postgres@sha256:' + '0'.repeat(64),
  ]) {
    assert.throws(
      () => validator.validatePostgresImage(image),
      /POSTGRES_IMAGE_MISMATCH/,
    )
  }
  for (const output of [
    'psql (PostgreSQL) 17',
    'psql (PostgreSQL) 17.6',
    'psql (PostgreSQL) 17.6 (Ubuntu 17.6-1.pgdg24.04+1)',
  ]) {
    assert.equal(validator.validatePsqlVersionOutput(`${output}\n`), true)
  }
  for (const output of [
    'psql (PostgreSQL) 16.9',
    'psql (PostgreSQL) 18',
    'psql (PostgreSQL) 17.6\nunsafe',
    'psql (PostgreSQL) 017.6',
  ]) {
    assert.throws(
      () => validator.validatePsqlVersionOutput(output),
      /UNSUPPORTED_PSQL_VERSION/,
    )
  }
})

test('source context and Environment channel gates fail closed', async () => {
  const validator = await import(pathToFileURL(validatorPath).href)
  const sha = 'a'.repeat(40)
  const valid = {
    GITHUB_REPOSITORY: 'tsaititsu/tsu-waterbottle-site',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_REF: 'refs/heads/main',
    GITHUB_SHA: sha,
    AUTHORIZED_COMMIT: sha,
    PROJECT_REF_INPUT: 'ndbqoznvobmpkgxkiezz',
    MIGRATION_SHA256_INPUT:
      '370984c499d93f602b3dccf876becd030085e88ccd9a17106fee8b0009d84046',
    DEPLOY_CONFIRMATION: 'DEPLOY_LINE_PAY_REMEDIATION_EXACT_FILE_ONCE',
  }
  assert.equal(validator.validateWorkflowContext(valid), true)
  for (const [key, value] of [
    ['GITHUB_REF', 'refs/heads/codex/test'],
    ['GITHUB_SHA', 'b'.repeat(40)],
    ['PROJECT_REF_INPUT', 'aaaaaaaaaaaaaaaaaaaa'],
    ['MIGRATION_SHA256_INPUT', '0'.repeat(64)],
    ['DEPLOY_CONFIRMATION', 'DEPLOY'],
  ]) {
    assert.throws(
      () => validator.validateWorkflowContext({ ...valid, [key]: value }),
      /SOURCE_CONTEXT_INVALID|PROJECT_REF_MISMATCH|MIGRATION_HASH_MISMATCH|INVALID_DEPLOYMENT_CONFIRMATION/,
    )
  }
  assert.equal(
    validator.validateProductionChannel({
      SUPABASE_PRODUCTION_CHANNEL_READY: 'true',
      SUPABASE_PRODUCTION_DB_URL:
        'postgresql://postgres:synthetic@db.ndbqoznvobmpkgxkiezz.supabase.co:5432/postgres?sslmode=require',
      SUPABASE_PROJECT_ID: 'ndbqoznvobmpkgxkiezz',
    }),
    true,
  )
  for (const environment of [
    {},
    { SUPABASE_PRODUCTION_CHANNEL_READY: 'false' },
    {
      SUPABASE_PRODUCTION_CHANNEL_READY: 'true',
      SUPABASE_PROJECT_ID: 'ndbqoznvobmpkgxkiezz',
    },
  ]) {
    assert.throws(
      () => validator.validateProductionChannel(environment),
      /PRODUCTION_CHANNEL_NOT_READY/,
    )
  }
})

test('fixed-file validation rejects symlinks, traversal, and hash mutations', async () => {
  const validator = await import(pathToFileURL(validatorPath).href)
  const testTempRoot = join(writableTestRoot, '.line-pay-production-test-tmp')
  await mkdir(testTempRoot, { recursive: true })
  const fixtureRoot = await mkdtemp(
    join(testTempRoot, 'line-pay-exact-file-fixture-'),
  )
  try {
    await mkdir(join(fixtureRoot, 'supabase/migrations'), { recursive: true })
    await writeFile(
      join(fixtureRoot, 'supabase/migrations/fixed.sql'),
      'select 1;\n',
      'utf8',
    )
    const hash = createHash('sha256').update('select 1;\n').digest('hex')
    assert.equal(
      validator.readAndValidateFixedFile(
        fixtureRoot,
        'supabase/migrations/fixed.sql',
        hash,
      ),
      'select 1;\n',
    )
    assert.throws(
      () =>
        validator.readAndValidateFixedFile(
          fixtureRoot,
          '../outside.sql',
          hash,
        ),
      /FIXED_FILE_INVALID/,
    )
    await symlink(
      join(fixtureRoot, 'supabase/migrations/fixed.sql'),
      join(fixtureRoot, 'supabase/migrations/link.sql'),
    )
    assert.throws(
      () =>
        validator.readAndValidateFixedFile(
          fixtureRoot,
          'supabase/migrations/link.sql',
          hash,
        ),
      /FIXED_FILE_INVALID/,
    )
    assert.throws(
      () =>
        validator.readAndValidateFixedFile(
          fixtureRoot,
          'supabase/migrations/fixed.sql',
          '0'.repeat(64),
        ),
      /FIXED_FILE_HASH_MISMATCH/,
    )
  } finally {
    await rm(fixtureRoot, { recursive: true })
    await rm(testTempRoot, { recursive: true })
  }
})

test('preflight and postflight SQL are fixed read-only single-statement queries', async () => {
  const validator = await import(pathToFileURL(validatorPath).href)
  for (const relativePath of [
    validator.PREFLIGHT_FILE,
    validator.POSTFLIGHT_FILE,
  ]) {
    const sql = readFileSync(join(root, relativePath), 'utf8')
    assert.equal(validator.assertReadOnlyAuditSql(sql), true)
  }
  for (const sql of [
    'insert into public.x values (1);',
    'with x as (select 1) update public.x set y = 1;',
    'begin; select 1; commit;',
    'select pg_cancel_backend(1);',
    'copy public.x to stdout;',
  ]) {
    assert.throws(() => validator.assertReadOnlyAuditSql(sql), /UNSAFE_AUDIT_SQL/)
  }
})

test('deploy orchestration mutations cannot remove guard, manifest, timeout, or duplicate Migration', async () => {
  const validator = await import(pathToFileURL(validatorPath).href)
  const deploy = readFileSync(join(root, validator.DEPLOY_FILE), 'utf8')
  assert.equal(validator.assertDeployOrchestrationSql(deploy), true)
  for (const mutated of [
    deploy.replace(
      'lock table public.product_orders, public.payments in access exclusive mode;\n',
      '',
    ),
    deploy.replace('\\if :line_pay_locked_guard_ready\n', ''),
    deploy.replace('baseline_payments_manifest', 'removed_manifest'),
    deploy.replace("set local statement_timeout = '120s';\n", ''),
    deploy.replace(
      '\\ir ../migrations/20260719033404_line_pay_remediation_contracts.sql',
      '\\ir ../migrations/20260719033404_line_pay_remediation_contracts.sql\n\\ir ../migrations/20260719033404_line_pay_remediation_contracts.sql',
    ),
    `${deploy}\n\\ir :include_path\n`,
  ]) {
    assert.throws(
      () => validator.assertDeployOrchestrationSql(mutated),
      /FIXED_FILE_INVALID/,
    )
  }
})

test('signal lifecycle source contract catches fail-open mutations', async () => {
  const validator = await import(pathToFileURL(validatorPath).href)
  const source = readFileSync(runnerPath, 'utf8')
  assert.equal(validator.assertSignalLifecycleSource(source), true)

  const handlerBlock =
    `  const removeSignalHandlers = installSignalCleanup(() => {\n` +
    `    interrupted = true\n` +
    `    activeChild?.kill('SIGTERM')\n` +
    `  }, processObject)\n`
  const credentialBlock =
    `    credentials = await createCredentialFile(\n` +
    `      environment.RUNNER_TEMP,\n` +
    `      connection,\n` +
    `      filesystem,\n` +
    `    )\n`
  const handlerAfterCredential = source
    .replace(handlerBlock, '  let removeSignalHandlers = () => {}\n')
    .replace(
      credentialBlock,
      credentialBlock +
        `    removeSignalHandlers = installSignalCleanup(() => {\n` +
        `      interrupted = true\n` +
        `      activeChild?.kill('SIGTERM')\n` +
        `    }, processObject)\n`,
    )

  for (const mutated of [
    source.replace(
      `await pullFixedPostgresImage(spawnImplementation, {\n` +
        `        onSpawn: trackActiveChild,\n` +
        `      })`,
      'await pullFixedPostgresImage(spawnImplementation)',
    ),
    source.replace(
      `    ensureNotInterrupted()\n` +
        `    const dockerRunArgs = buildDockerRunArgs(`,
      '    const dockerRunArgs = buildDockerRunArgs(',
    ),
    handlerAfterCredential,
    source.replace('      await cleanupCredentialsOnce()\n', ''),
    source.replace('    interrupted = true\n', '    interrupted = false\n'),
  ]) {
    assert.throws(
      () => validator.assertSignalLifecycleSource(mutated),
      /FIXED_FILE_INVALID/,
    )
  }
})

test('audit parser requires one JSON row and fixed safe statuses', async () => {
  const validator = await import(pathToFileURL(validatorPath).href)
  const preflight = validator.buildExpectedAuditFixture('preflight')
  const postflight = validator.buildExpectedAuditFixture('postflight')

  assert.equal(
    validator.parseAndValidateAuditOutput(
      `${JSON.stringify(preflight)}\n`,
      'preflight',
    ),
    'READY_EXPECTED',
  )
  assert.equal(
    validator.parseAndValidateAuditOutput(
      `${JSON.stringify(postflight)}\n`,
      'postflight',
    ),
    'DATABASE_CONTRACTS_READY_RUNTIME_DISABLED',
  )
  assert.throws(
    () =>
      validator.parseAndValidateAuditOutput(
        `${JSON.stringify(preflight)}\n${JSON.stringify(preflight)}\n`,
        'preflight',
      ),
    /DATABASE_OUTPUT_INVALID/,
  )
  const drift = structuredClone(preflight)
  drift.historical.payments.rows = 19
  assert.throws(
    () =>
      validator.parseAndValidateAuditOutput(
        JSON.stringify(drift),
        'preflight',
      ),
    /PRODUCTION_DATA_DRIFT/,
  )

  for (const status of [
    'ALREADY_APPLIED',
    'PARTIAL_APPLICATION',
    'SCHEMA_DRIFT',
    'FENCE_REGRESSION',
    'PRODUCTION_DATA_DRIFT',
    'BLOCKED_BY_DATABASE_LOCK_RISK',
  ]) {
    assert.throws(
      () =>
        validator.parseAndValidateAuditOutput(
          JSON.stringify({ ...preflight, status }),
          'preflight',
        ),
      new RegExp(status),
    )
  }

  const lockRisk = structuredClone(preflight)
  lockRisk.locks.payments_blocking = 1
  assert.throws(
    () =>
      validator.parseAndValidateAuditOutput(
        JSON.stringify(lockRisk),
        'preflight',
      ),
    /BLOCKED_BY_DATABASE_LOCK_RISK/,
  )

  const catalogDrift = structuredClone(postflight)
  catalogDrift.line_pay.catalog_fingerprints.functions.digest =
    '0'.repeat(64)
  assert.throws(
    () =>
      validator.parseAndValidateAuditOutput(
        JSON.stringify(catalogDrift),
        'postflight',
      ),
    /POSTFLIGHT_CONTRACT_FAILED/,
  )
})

test('runner accepts only preflight and locked deploy phases with strict Supabase URLs', async () => {
  const runner = await import(pathToFileURL(runnerPath).href)
  assert.deepEqual(Object.keys(runner.PHASE_FILES).sort(), ['deploy', 'preflight'])
  for (const phase of ['preflight', 'deploy']) {
    assert.equal(runner.validatePhase(phase), phase)
    const args = runner.buildPsqlArgs(phase)
    assert.deepEqual(args.slice(0, 5), [
      '--no-psqlrc',
      '--set=ON_ERROR_STOP=1',
      '--quiet',
      '--no-align',
      '--tuples-only',
    ])
    assert.equal(args.length, 6)
    assert.match(args[5], /^--file=\/workspace\//)
  }
  for (const phase of ['', 'sql', '../x', 'migration', 'postflight']) {
    assert.throws(() => runner.validatePhase(phase), /UNSUPPORTED_DATABASE_PHASE/)
  }

  const direct = runner.parseDatabaseUrl(
    'postgresql://postgres:synthetic@db.ndbqoznvobmpkgxkiezz.supabase.co:5432/postgres?sslmode=require',
    'ndbqoznvobmpkgxkiezz',
  )
  assert.equal(direct.mode, 'direct')
  const session = runner.parseDatabaseUrl(
    'postgresql://postgres.ndbqoznvobmpkgxkiezz:synthetic@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=verify-full',
    'ndbqoznvobmpkgxkiezz',
  )
  assert.equal(session.mode, 'supavisor_session')

  for (const url of [
    'postgresql://postgres:synthetic@db.aaaaaaaaaaaaaaaaaaaa.supabase.co:5432/postgres',
    'postgresql://postgres:synthetic@db.ndbqoznvobmpkgxkiezz.supabase.co:5433/postgres',
    'postgresql://postgres:synthetic@db.ndbqoznvobmpkgxkiezz.supabase.co:5432/other',
    'postgresql://postgres:synthetic@db.ndbqoznvobmpkgxkiezz.supabase.co:5432/postgres?target_session_attrs=read-write',
    'postgresql://postgres:bad%0Avalue@db.ndbqoznvobmpkgxkiezz.supabase.co:5432/postgres',
    'postgresql://postgres.aaaaaaaaaaaaaaaaaaaa:synthetic@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres',
  ]) {
    assert.throws(
      () => runner.parseDatabaseUrl(url, 'ndbqoznvobmpkgxkiezz'),
      /DATABASE_URL_INVALID|DATABASE_TARGET_MISMATCH/,
    )
  }
})

test('runner uses shell=false, stdin=ignore, capped output, and fixed redaction', async () => {
  const runner = await import(pathToFileURL(runnerPath).href)
  const connection = runner.parseDatabaseUrl(
    'postgresql://postgres:synthetic-secret@db.ndbqoznvobmpkgxkiezz.supabase.co:5432/postgres?sslmode=require',
    'ndbqoznvobmpkgxkiezz',
  )
  const childEnvironment = runner.buildChildEnvironment(connection)
  assert.equal(
    childEnvironment.PGAPPNAME,
    'line-pay-production-exact-file-migration',
  )
  assert.equal(childEnvironment.PGPASSFILE, '/run/secrets/pgpass')
  assert.equal(childEnvironment.PGCONNECT_TIMEOUT, '15')
  assert.equal(
    childEnvironment.PGOPTIONS,
    '-c statement_timeout=120000 -c lock_timeout=15000 -c idle_in_transaction_session_timeout=30000',
  )
  assert.equal('PGPASSWORD' in childEnvironment, false)
  assert.equal(
    runner.redactSensitiveText(
      `unsafe ${connection.databaseUrl} synthetic-secret`,
      connection,
    ).includes('synthetic-secret'),
    false,
  )
  const dockerArgs = runner.buildDockerRunArgs(
    'deploy',
    connection,
    '/tmp/synthetic-pgpass',
  ) as string[]
  for (const fixedArg of [
    '--rm',
    '--read-only',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges',
    '--pull=never',
  ]) {
    assert.ok(dockerArgs.includes(fixedArg), fixedArg)
  }
  assert.ok(
    dockerArgs.includes(
      'postgres@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193',
    ),
  )
  assert.equal(dockerArgs.some((arg) => arg.includes('synthetic-secret')), false)
  assert.equal(dockerArgs.some((arg) => arg.includes('docker.sock')), false)
  assert.equal(dockerArgs.includes('--privileged'), false)
  assert.ok(
    dockerArgs.some(
      (arg) =>
        arg.includes('target=/workspace') && arg.endsWith(',readonly'),
    ),
  )
  assert.ok(
    dockerArgs.some(
      (arg) =>
        arg.includes('target=/run/secrets/pgpass') &&
        arg.endsWith(',readonly'),
    ),
  )

  const calls: Array<Record<string, unknown>> = []
  const fakeSpawn = (
    binary: string,
    args: string[],
    options: Record<string, unknown>,
  ) => {
    calls.push({ binary, args, options })
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough
      stderr: PassThrough
      kill: () => boolean
    }
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = () => true
    queueMicrotask(() => {
      child.stdout.end('ok\n')
      child.stderr.end()
      child.emit('close', 0, null)
    })
    return child
  }
  const result = await runner.spawnCaptured(
    '/fixed/psql',
    ['--version'],
    { cwd: root, env: {} },
    fakeSpawn,
  )
  assert.equal(result.code, 0)
  assert.deepEqual(calls[0]?.options, {
    cwd: root,
    env: {},
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
})

test('temporary pgpass is mode 0600 and always cleanable', async () => {
  const runner = await import(pathToFileURL(runnerPath).href)
  const testTempRoot = join(writableTestRoot, '.line-pay-production-test-tmp')
  await mkdir(testTempRoot, { recursive: true })
  const runnerTemp = await mkdtemp(join(testTempRoot, 'line-pay-runner-temp-'))
  const connection = runner.parseDatabaseUrl(
    'postgresql://postgres:synthetic@db.ndbqoznvobmpkgxkiezz.supabase.co:5432/postgres',
    'ndbqoznvobmpkgxkiezz',
  )
  try {
    const credentials = await runner.createCredentialFile(runnerTemp, connection)
    assert.equal((await lstat(credentials.pgpassFile)).mode & 0o777, 0o600)
    assert.equal((await readFile(credentials.pgpassFile, 'utf8')).endsWith('\n'), true)
    assert.equal(await runner.cleanupCredentialFile(credentials), true)
    assert.deepEqual(await (await import('node:fs/promises')).readdir(runnerTemp), [])
  } finally {
    await rm(runnerTemp, { recursive: true })
    await rm(testTempRoot, { recursive: true })
  }
})

test('credential cleanup failure exposes only the fixed safe code', async () => {
  const runner = await import(pathToFileURL(runnerPath).href)
  const validator = await import(pathToFileURL(validatorPath).href)
  const realFilesystem = await import('node:fs/promises')
  const testTempRoot = join(writableTestRoot, '.line-pay-production-test-tmp')
  await mkdir(testTempRoot, { recursive: true })
  const runnerTemp = await mkdtemp(join(testTempRoot, 'line-pay-cleanup-temp-'))
  const syntheticSecret = 'synthetic-cleanup-secret'
  const filesystem = {
    stat: realFilesystem.stat,
    mkdtemp: realFilesystem.mkdtemp,
    writeFile: realFilesystem.writeFile,
    unlink: async () => {
      throw new Error(
        `unsafe cleanup detail ${runnerTemp} ${syntheticSecret}`,
      )
    },
    rmdir: realFilesystem.rmdir,
  }
  const fakeSpawn = (
    _binary: string,
    args: string[],
  ) => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough
      stderr: PassThrough
      kill: () => boolean
    }
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = () => true
    queueMicrotask(() => {
      child.stdout.end(
        args[0] === 'pull'
          ? 'fixed image ready\n'
          : `${JSON.stringify(
              validator.buildExpectedAuditFixture('postflight'),
            )}\n`,
      )
      child.stderr.end()
      child.emit('close', 0, null)
    })
    return child
  }

  try {
    const error = await runner
      .runDatabasePhase('deploy', {
        environment: {
          RUNNER_TEMP: runnerTemp,
          SUPABASE_PRODUCTION_CHANNEL_READY: 'true',
          SUPABASE_PRODUCTION_DB_URL:
            'postgresql://postgres:synthetic@db.ndbqoznvobmpkgxkiezz.supabase.co:5432/postgres?sslmode=require',
          SUPABASE_PROJECT_ID: 'ndbqoznvobmpkgxkiezz',
        },
        filesystem,
        spawnImplementation: fakeSpawn,
      })
      .then(
        () => null,
        (caught: unknown) => caught,
      )
    assert.ok(error instanceof Error)
    assert.equal(error.message, 'TEMP_CREDENTIAL_CLEANUP_FAILED')
    assert.equal(runner.safeFailureCode(error), 'TEMP_CREDENTIAL_CLEANUP_FAILED')
    assert.doesNotMatch(error.message, new RegExp(syntheticSecret))
    assert.doesNotMatch(error.message, new RegExp(runnerTemp))
  } finally {
    await rm(runnerTemp, { recursive: true })
    await rm(testTempRoot, { recursive: true })
  }
})

test('credential creation cleanup failure outranks a concurrent signal', async () => {
  const runner = await import(pathToFileURL(runnerPath).href)
  const realFilesystem = await import('node:fs/promises')
  const testTempRoot = join(writableTestRoot, '.line-pay-production-test-tmp')
  await mkdir(testTempRoot, { recursive: true })
  const runnerTemp = await mkdtemp(join(testTempRoot, 'line-pay-create-temp-'))
  const processObject = new EventEmitter() as EventEmitter & {
    exitCode?: number
    stderr: PassThrough
  }
  processObject.stderr = new PassThrough()
  let spawnCount = 0
  const filesystem = {
    stat: realFilesystem.stat,
    mkdtemp: realFilesystem.mkdtemp,
    writeFile: async (
      path: string,
      data: string,
      options: Record<string, unknown>,
    ) => {
      await realFilesystem.writeFile(path, data, options)
      processObject.emit('SIGTERM')
      throw new Error('synthetic credential create failure')
    },
    unlink: async () => {
      throw new Error('synthetic credential cleanup failure')
    },
    rmdir: realFilesystem.rmdir,
  }

  try {
    await assert.rejects(
      runner.runDatabasePhase('deploy', {
        environment: {
          RUNNER_TEMP: runnerTemp,
          SUPABASE_PRODUCTION_CHANNEL_READY: 'true',
          SUPABASE_PRODUCTION_DB_URL:
            'postgresql://postgres:synthetic@db.ndbqoznvobmpkgxkiezz.supabase.co:5432/postgres?sslmode=require',
          SUPABASE_PROJECT_ID: 'ndbqoznvobmpkgxkiezz',
        },
        filesystem,
        processObject,
        spawnImplementation: () => {
          spawnCount += 1
          throw new Error('unexpected child')
        },
      }),
      /TEMP_CREDENTIAL_CLEANUP_FAILED/,
    )
    assert.equal(processObject.exitCode, 1)
    assert.equal(spawnCount, 0)
  } finally {
    await rm(runnerTemp, { recursive: true })
    await rm(testTempRoot, { recursive: true })
  }
})

test('runner executes one fixed phase and cleans credentials on success and failure', async () => {
  const runner = await import(pathToFileURL(runnerPath).href)
  const validator = await import(pathToFileURL(validatorPath).href)
  const testTempRoot = join(writableTestRoot, '.line-pay-production-test-tmp')
  await mkdir(testTempRoot, { recursive: true })
  const runnerTemp = await mkdtemp(join(testTempRoot, 'line-pay-phase-temp-'))
  const environment = {
    RUNNER_TEMP: runnerTemp,
    SUPABASE_PRODUCTION_CHANNEL_READY: 'true',
    SUPABASE_PRODUCTION_DB_URL:
      'postgresql://postgres:synthetic@db.ndbqoznvobmpkgxkiezz.supabase.co:5432/postgres?sslmode=require',
    SUPABASE_PROJECT_ID: 'ndbqoznvobmpkgxkiezz',
  }

  const makeSpawn = (phaseExitCode: number) => {
    const calls: Array<{ args: string[]; options: Record<string, unknown> }> = []
    const fakeSpawn = (
      _binary: string,
      args: string[],
      options: Record<string, unknown>,
    ) => {
      calls.push({ args, options })
      const child = new EventEmitter() as EventEmitter & {
        stdout: PassThrough
        stderr: PassThrough
        kill: () => boolean
      }
      child.stdout = new PassThrough()
      child.stderr = new PassThrough()
      child.kill = () => true
      queueMicrotask(() => {
        if (args[0] === 'pull') {
          child.stdout.end('fixed image ready\n')
          child.stderr.end()
          child.emit('close', 0, null)
          return
        }
        child.stdout.end(
          `${JSON.stringify(
            validator.buildExpectedAuditFixture('postflight'),
          )}\n`,
        )
        child.stderr.end('synthetic failure detail\n')
        child.emit('close', phaseExitCode, null)
      })
      return child
    }
    return { calls, fakeSpawn }
  }

  try {
    const success = makeSpawn(0)
    assert.equal(
      await runner.runDatabasePhase('deploy', {
        environment,
        spawnImplementation: success.fakeSpawn,
      }),
      'DEPLOYMENT_VALIDATED',
    )
    assert.equal(success.calls.length, 2)
    assert.equal(
      success.calls.filter(({ args }) =>
        args.some((argument) => argument.includes('line_pay_remediation_deploy.sql')),
      ).length,
      1,
    )
    assert.deepEqual(
      await (await import('node:fs/promises')).readdir(runnerTemp),
      [],
    )

    const failure = makeSpawn(9)
    await assert.rejects(
      runner.runDatabasePhase('deploy', {
        environment,
        spawnImplementation: failure.fakeSpawn,
      }),
      /DEPLOY_PSQL_FAILED/,
    )
    assert.equal(failure.calls.length, 2)
    assert.deepEqual(
      await (await import('node:fs/promises')).readdir(runnerTemp),
      [],
    )
  } finally {
    await rm(runnerTemp, { recursive: true })
    await rm(testTempRoot, { recursive: true })
  }
})

test('capture overflow terminates the child and fails closed', async () => {
  const runner = await import(pathToFileURL(runnerPath).href)
  let killCount = 0
  const fakeSpawn = () => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough
      stderr: PassThrough
      kill: () => boolean
    }
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = () => {
      killCount += 1
      queueMicrotask(() => child.emit('close', null, 'SIGTERM'))
      return true
    }
    queueMicrotask(() => {
      child.stdout.write(Buffer.alloc(runner.MAX_CAPTURE_BYTES + 1, 65))
    })
    return child
  }

  const result = await runner.spawnCaptured(
    '/fixed/psql',
    [],
    { cwd: root, env: {} },
    fakeSpawn,
  )
  assert.equal(killCount, 1)
  assert.equal(result.code, null)
  assert.equal(result.signal, 'CAPTURE_LIMIT')
})

test('signal handling terminates the active child and leaves no credential file', async () => {
  const runner = await import(pathToFileURL(runnerPath).href)
  const testTempRoot = join(writableTestRoot, '.line-pay-production-test-tmp')
  await mkdir(testTempRoot, { recursive: true })
  const runnerTemp = await mkdtemp(join(testTempRoot, 'line-pay-signal-temp-'))
  const processObject = new EventEmitter() as EventEmitter & {
    exitCode?: number
    stderr: PassThrough
  }
  processObject.stderr = new PassThrough()
  let phaseChildKilled = false
  let callCount = 0
  const fakeSpawn = () => {
    callCount += 1
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough
      stderr: PassThrough
      kill: () => boolean
    }
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = () => {
      phaseChildKilled = true
      queueMicrotask(() => child.emit('close', null, 'SIGTERM'))
      return true
    }
    queueMicrotask(() => {
      if (callCount === 1) {
        child.stdout.end('fixed image ready\n')
        child.stderr.end()
        child.emit('close', 0, null)
        return
      }
      processObject.emit('SIGTERM')
    })
    return child
  }

  try {
    await assert.rejects(
      runner.runDatabasePhase('preflight', {
        environment: {
          RUNNER_TEMP: runnerTemp,
          SUPABASE_PRODUCTION_CHANNEL_READY: 'true',
          SUPABASE_PRODUCTION_DB_URL:
            'postgresql://postgres:synthetic@db.ndbqoznvobmpkgxkiezz.supabase.co:5432/postgres?sslmode=require',
          SUPABASE_PROJECT_ID: 'ndbqoznvobmpkgxkiezz',
        },
        processObject,
        spawnImplementation: fakeSpawn,
      }),
      /PROCESS_INTERRUPTED/,
    )
    assert.equal(phaseChildKilled, true)
    assert.equal(processObject.exitCode, 1)
    assert.deepEqual(
      await (await import('node:fs/promises')).readdir(runnerTemp),
      [],
    )
  } finally {
    await rm(runnerTemp, { recursive: true })
    await rm(testTempRoot, { recursive: true })
  }
})

type SignalName = 'SIGINT' | 'SIGTERM' | 'SIGHUP'
type SignalStage =
  | 'before-credential'
  | 'credential-created'
  | 'pull-running'
  | 'post-pull'
  | 'container-running'
  | 'cleanup-running'

async function runSignalLifecycleScenario(
  signal: SignalName,
  stage: SignalStage,
) {
  const runner = await import(pathToFileURL(runnerPath).href)
  const validator = await import(pathToFileURL(validatorPath).href)
  const realFilesystem = await import('node:fs/promises')
  const testTempRoot = join(writableTestRoot, '.line-pay-production-test-tmp')
  await mkdir(testTempRoot, { recursive: true })
  const runnerTemp = await mkdtemp(join(testTempRoot, 'line-pay-lifecycle-temp-'))
  const processObject = new EventEmitter() as EventEmitter & {
    exitCode?: number
    stderr: PassThrough
  }
  processObject.stderr = new PassThrough()

  let signalEmitted = false
  let credentialCleanupCount = 0
  let childKillCount = 0
  const calls: string[][] = []
  const emitSignal = () => {
    if (signalEmitted) return
    signalEmitted = true
    processObject.emit(signal)
  }
  const filesystem = {
    stat: async (path: string) => {
      if (stage === 'before-credential' && path === runnerTemp) emitSignal()
      const result = await realFilesystem.stat(path)
      if (
        stage === 'credential-created' &&
        path.endsWith('/pgpass')
      ) {
        emitSignal()
      }
      return result
    },
    mkdtemp: realFilesystem.mkdtemp,
    writeFile: realFilesystem.writeFile,
    unlink: async (path: string) => {
      if (path.endsWith('/pgpass')) credentialCleanupCount += 1
      if (stage === 'cleanup-running' && path.endsWith('/pgpass')) {
        emitSignal()
      }
      return realFilesystem.unlink(path)
    },
    rmdir: realFilesystem.rmdir,
  }
  const fakeSpawn = (
    _binary: string,
    args: string[],
  ) => {
    calls.push(args)
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough
      stderr: PassThrough
      kill: () => boolean
    }
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    let closed = false
    const close = (code: number | null, closeSignal: string | null) => {
      if (closed) return
      closed = true
      child.stdout.end()
      child.stderr.end()
      child.emit('close', code, closeSignal)
    }
    child.kill = () => {
      childKillCount += 1
      queueMicrotask(() => close(null, 'SIGTERM'))
      return true
    }

    if (args[0] === 'pull') {
      if (stage === 'pull-running') {
        queueMicrotask(() => {
          emitSignal()
          setImmediate(() => close(0, null))
        })
      } else if (stage === 'post-pull') {
        queueMicrotask(() => {
          close(0, null)
          emitSignal()
        })
      } else {
        queueMicrotask(() => close(0, null))
      }
    } else if (stage === 'container-running') {
      queueMicrotask(emitSignal)
    } else {
      queueMicrotask(() => {
        child.stdout.end(
          `${JSON.stringify(
            validator.buildExpectedAuditFixture('postflight'),
          )}\n`,
        )
        child.stderr.end()
        closed = true
        child.emit('close', 0, null)
      })
    }
    return child
  }

  try {
    await assert.rejects(
      runner.runDatabasePhase('deploy', {
        environment: {
          RUNNER_TEMP: runnerTemp,
          SUPABASE_PRODUCTION_CHANNEL_READY: 'true',
          SUPABASE_PRODUCTION_DB_URL:
            'postgresql://postgres:synthetic@db.ndbqoznvobmpkgxkiezz.supabase.co:5432/postgres?sslmode=require',
          SUPABASE_PROJECT_ID: 'ndbqoznvobmpkgxkiezz',
        },
        filesystem,
        processObject,
        spawnImplementation: fakeSpawn,
      }),
      /PROCESS_INTERRUPTED/,
    )
    assert.equal(processObject.exitCode, 1)
    assert.equal(credentialCleanupCount, 1)
    assert.deepEqual(await realFilesystem.readdir(runnerTemp), [])

    const expectedSpawnCount =
      stage === 'before-credential' || stage === 'credential-created'
        ? 0
        : stage === 'container-running' || stage === 'cleanup-running'
          ? 2
          : 1
    assert.equal(calls.length, expectedSpawnCount)
    assert.equal(
      calls.filter(({ 0: command }) => command === 'run').length,
      stage === 'container-running' || stage === 'cleanup-running' ? 1 : 0,
    )
    assert.equal(
      childKillCount,
      stage === 'pull-running' || stage === 'container-running' ? 1 : 0,
    )
  } finally {
    await rm(runnerTemp, { recursive: true })
    await rm(testTempRoot, { recursive: true })
  }
}

for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP'] as const) {
  for (const stage of [
    'before-credential',
    'credential-created',
    'pull-running',
    'post-pull',
    'container-running',
    'cleanup-running',
  ] as const) {
    test(`${signal} at ${stage} fails closed without a later child`, async () => {
      await runSignalLifecycleScenario(signal, stage)
    })
  }
}

test('real OS signals terminate a real active pull child and clean credentials', async () => {
  const realFilesystem = await import('node:fs/promises')
  const testTempRoot = join(writableTestRoot, '.line-pay-production-test-tmp')
  await mkdir(testTempRoot, { recursive: true })

  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP'] as const) {
    const runnerTemp = await mkdtemp(
      join(testTempRoot, `line-pay-real-${signal.toLowerCase()}-`),
    )
    const probeSource = `
      import { spawn } from 'node:child_process'
      import { promises as fs } from 'node:fs'
      const runner = await import(${JSON.stringify(pathToFileURL(runnerPath).href)})
      const runnerTemp = ${JSON.stringify(runnerTemp)}
      const fakeSpawn = () => {
        const child = spawn(
          process.execPath,
          ['--input-type=module', '--eval', 'setInterval(() => {}, 1000)'],
          { stdio: ['ignore', 'pipe', 'pipe'] },
        )
        setImmediate(() => process.stdout.write('ACTIVE\\n'))
        return child
      }
      try {
        await runner.runDatabasePhase('deploy', {
          environment: {
            RUNNER_TEMP: runnerTemp,
            SUPABASE_PRODUCTION_CHANNEL_READY: 'true',
            SUPABASE_PRODUCTION_DB_URL:
              'postgresql://postgres:synthetic@db.ndbqoznvobmpkgxkiezz.supabase.co:5432/postgres?sslmode=require',
            SUPABASE_PROJECT_ID: 'ndbqoznvobmpkgxkiezz',
          },
          spawnImplementation: fakeSpawn,
        })
        process.stdout.write('UNEXPECTED_SUCCESS\\n')
        process.exitCode = 2
      } catch (error) {
        const code = error instanceof Error ? error.message : 'UNKNOWN_ERROR'
        const residual = await fs.readdir(runnerTemp)
        process.stdout.write(
          'RESULT:' + code + ':RESIDUAL:' + residual.length + '\\n',
        )
        if (code !== 'PROCESS_INTERRUPTED' || residual.length !== 0) {
          process.exitCode = 2
        }
      }
    `
    const worker: ChildProcessWithoutNullStreams = spawnProcess(
      process.execPath,
      ['--input-type=module', '--eval', probeSource],
      {
        cwd: root,
        env: {
          NODE_ENV: 'test',
          LANG: 'C.UTF-8',
          LC_ALL: 'C.UTF-8',
          PATH: process.env.PATH ?? '/usr/bin:/bin',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    )
    worker.stdin.end()
    let stdout = ''
    let stderr = ''
    let signalSent = false
    worker.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8')
      if (!signalSent && stdout.includes('ACTIVE\n')) {
        signalSent = true
        worker.kill(signal)
      }
    })
    worker.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8')
    })

    try {
      const result = await new Promise<{
        code: number | null
        signal: NodeJS.Signals | null
      }>((resolvePromise, rejectPromise) => {
        const timeout = setTimeout(() => {
          worker.kill('SIGKILL')
          rejectPromise(new Error('REAL_SIGNAL_PROBE_TIMEOUT'))
        }, 10_000)
        worker.once('error', (error) => {
          clearTimeout(timeout)
          rejectPromise(error)
        })
        worker.once('close', (code, closeSignal) => {
          clearTimeout(timeout)
          resolvePromise({ code, signal: closeSignal })
        })
      })
      assert.equal(signalSent, true)
      assert.deepEqual(result, { code: 1, signal: null })
      assert.match(stdout, /RESULT:PROCESS_INTERRUPTED:RESIDUAL:0/)
      assert.doesNotMatch(stdout, /UNEXPECTED_SUCCESS/)
      assert.doesNotMatch(stderr, /synthetic|postgresql:|ndbqoznvobmpkgxkiezz/)
      assert.deepEqual(await realFilesystem.readdir(runnerTemp), [])
    } finally {
      if (worker.exitCode === null && worker.signalCode === null) {
        worker.kill('SIGKILL')
      }
      await rm(runnerTemp, { recursive: true })
    }
  }

  await rm(testTempRoot, { recursive: true })
})
