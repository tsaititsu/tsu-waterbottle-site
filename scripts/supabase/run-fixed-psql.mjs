import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  PSQL_BINARY,
  parseAndValidateAuditOutput,
  validatePsqlVersionOutput,
} from './validate-profiles-admin-deployment.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

export const PHASE_FILES = Object.freeze({
  preflight: resolve(
    repositoryRoot,
    'supabase/deployment/profiles_admin_escalation_preflight.sql',
  ),
  migration: resolve(
    repositoryRoot,
    'supabase/migrations/20260716084928_profiles_admin_escalation_fix.sql',
  ),
  postflight: resolve(
    repositoryRoot,
    'supabase/deployment/profiles_admin_escalation_postflight.sql',
  ),
})

export const SUCCESS_MESSAGES = Object.freeze({
  preflight: 'PREFLIGHT_VALIDATED',
  migration: 'MIGRATION_EXECUTED',
  postflight: 'POSTFLIGHT_VALIDATED',
})

const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/u
const ALLOWED_SSL_MODES = new Set(['require', 'verify-ca', 'verify-full'])
const MAX_CAPTURE_BYTES = 1024 * 1024
const SAFE_FAILURE_CODES = new Set([
  'UNSUPPORTED_DATABASE_PHASE',
  'PSQL_VERSION_CHECK_FAILED',
  'UNSUPPORTED_PSQL_VERSION',
  'SUPABASE_DB_URL_MISSING',
  'SUPABASE_PROJECT_ID_MISSING',
  'DATABASE_URL_INVALID',
  'DATABASE_TARGET_MISMATCH',
  'RUNNER_TEMP_INVALID',
  'TEMP_CREDENTIAL_CREATE_FAILED',
  'TEMP_CREDENTIAL_CLEANUP_FAILED',
  'PREFLIGHT_PSQL_FAILED',
  'MIGRATION_PSQL_FAILED',
  'POSTFLIGHT_PSQL_FAILED',
  'DATABASE_OUTPUT_INVALID',
  'PREFLIGHT_CONTRACT_FAILED',
  'POSTFLIGHT_CONTRACT_FAILED',
  'PROCESS_INTERRUPTED',
])

function fail(code) {
  throw new Error(code)
}

function decodeComponent(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    fail('DATABASE_URL_INVALID')
  }
}

export function validatePhase(phase) {
  if (typeof phase !== 'string' || !Object.hasOwn(PHASE_FILES, phase)) {
    fail('UNSUPPORTED_DATABASE_PHASE')
  }
  return phase
}

export function parseDatabaseUrl(databaseUrl, projectId) {
  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    fail('SUPABASE_DB_URL_MISSING')
  }
  if (typeof projectId !== 'string' || projectId.length === 0) {
    fail('SUPABASE_PROJECT_ID_MISSING')
  }
  if (!PROJECT_REF_PATTERN.test(projectId)) fail('DATABASE_TARGET_MISMATCH')

  let parsed
  try {
    parsed = new URL(databaseUrl)
  } catch {
    fail('DATABASE_URL_INVALID')
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    fail('DATABASE_URL_INVALID')
  }
  if (!parsed.hostname || !parsed.username || !parsed.password) {
    fail('DATABASE_URL_INVALID')
  }
  if (parsed.hash) fail('DATABASE_URL_INVALID')
  if (parsed.hostname !== `db.${projectId}.supabase.co`) {
    fail('DATABASE_TARGET_MISMATCH')
  }

  const database = decodeComponent(parsed.pathname.slice(1))
  const username = decodeComponent(parsed.username)
  const password = decodeComponent(parsed.password)
  if (!database || !username || !password) fail('DATABASE_URL_INVALID')

  const port = parsed.port || '5432'
  const numericPort = Number(port)
  if (!/^\d+$/u.test(port) || numericPort < 1 || numericPort > 65535) {
    fail('DATABASE_URL_INVALID')
  }

  const queryKeys = [...parsed.searchParams.keys()]
  if (queryKeys.some((key) => key !== 'sslmode')) fail('DATABASE_URL_INVALID')
  const sslModes = parsed.searchParams.getAll('sslmode')
  if (sslModes.length > 1) fail('DATABASE_URL_INVALID')
  const sslmode = sslModes[0] ?? 'require'
  if (!ALLOWED_SSL_MODES.has(sslmode)) fail('DATABASE_URL_INVALID')

  return {
    database,
    databaseUrl,
    encodedPassword: parsed.password,
    host: parsed.hostname,
    password,
    port,
    projectId,
    sslmode,
    username,
  }
}

export function escapePgpass(value) {
  return value.replaceAll('\\', '\\\\').replaceAll(':', '\\:')
}

export function buildPgpassLine(connection) {
  return [
    connection.host,
    connection.port,
    connection.database,
    connection.username,
    connection.password,
  ]
    .map(escapePgpass)
    .join(':')
}

export function buildPsqlArgs(phase) {
  validatePhase(phase)
  return [
    '--no-psqlrc',
    '--set=ON_ERROR_STOP=1',
    '--no-align',
    '--tuples-only',
    `--file=${PHASE_FILES[phase]}`,
  ]
}

export function buildChildEnvironment(connection, pgpassFile) {
  return {
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    PGHOST: connection.host,
    PGPORT: connection.port,
    PGDATABASE: connection.database,
    PGUSER: connection.username,
    PGPASSFILE: pgpassFile,
    PGSSLMODE: connection.sslmode,
    PGAPPNAME: 'profiles-admin-emergency-migration',
    PGCONNECT_TIMEOUT: '15',
  }
}

export function redactSensitiveText(text, connection) {
  let redacted = typeof text === 'string' ? text : ''
  const values = [
    connection?.databaseUrl,
    connection?.password,
    connection?.encodedPassword,
    connection?.username,
    connection?.host,
    connection?.database,
    connection?.projectId,
  ]
    .filter((value) => typeof value === 'string' && value.length > 0)
    .sort((left, right) => right.length - left.length)
  for (const value of values) redacted = redacted.split(value).join('[REDACTED]')
  return redacted
}

export function spawnCaptured(binary, args, options, spawnImplementation = spawn) {
  return new Promise((resolvePromise, rejectPromise) => {
    let child
    try {
      child = spawnImplementation(binary, args, {
        cwd: options.cwd,
        env: options.env,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch {
      rejectPromise(new Error('PROCESS_SPAWN_FAILED'))
      return
    }

    let stdout = ''
    let stderr = ''
    let captureExceeded = false
    const append = (stream, chunk) => {
      const next = stream + chunk.toString('utf8')
      if (Buffer.byteLength(next, 'utf8') > MAX_CAPTURE_BYTES) {
        captureExceeded = true
        child.kill('SIGTERM')
        return stream
      }
      return next
    }
    child.stdout?.on('data', (chunk) => { stdout = append(stdout, chunk) })
    child.stderr?.on('data', (chunk) => { stderr = append(stderr, chunk) })
    child.once('error', () => rejectPromise(new Error('PROCESS_SPAWN_FAILED')))
    child.once('close', (code, signal) => {
      resolvePromise({
        code: captureExceeded ? null : code,
        signal: captureExceeded ? 'CAPTURE_LIMIT' : signal,
        stderr,
        stdout,
      })
    })
  })
}

export async function verifyFixedPsql(spawnImplementation = spawn) {
  let result
  try {
    result = await spawnCaptured(
      PSQL_BINARY,
      ['--version'],
      {
        cwd: repositoryRoot,
        env: { LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' },
      },
      spawnImplementation,
    )
  } catch {
    fail('PSQL_VERSION_CHECK_FAILED')
  }
  if (result.code !== 0 || result.signal) fail('PSQL_VERSION_CHECK_FAILED')
  validatePsqlVersionOutput(result.stdout)
  return true
}

export async function createCredentialFile(runnerTemp, connection, filesystem = fs) {
  if (typeof runnerTemp !== 'string' || !isAbsolute(runnerTemp)) {
    fail('RUNNER_TEMP_INVALID')
  }
  let rootStat
  try {
    rootStat = await filesystem.stat(runnerTemp)
  } catch {
    fail('RUNNER_TEMP_INVALID')
  }
  if (!rootStat.isDirectory()) fail('RUNNER_TEMP_INVALID')

  let directory
  let pgpassFile
  try {
    directory = await filesystem.mkdtemp(join(runnerTemp, 'profiles-admin-'))
    pgpassFile = join(directory, 'pgpass')
    await filesystem.writeFile(pgpassFile, `${buildPgpassLine(connection)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    })
    const credentialStat = await filesystem.stat(pgpassFile)
    if ((credentialStat.mode & 0o777) !== 0o600) {
      fail('TEMP_CREDENTIAL_CREATE_FAILED')
    }
    return { directory, pgpassFile }
  } catch (error) {
    let cleanupFailed = false
    if (pgpassFile) {
      try {
        await filesystem.unlink(pgpassFile)
      } catch (cleanupError) {
        if (!(cleanupError instanceof Error && cleanupError.code === 'ENOENT')) {
          cleanupFailed = true
        }
      }
    }
    if (directory) {
      try { await filesystem.rmdir(directory) } catch { cleanupFailed = true }
    }
    if (cleanupFailed) fail('TEMP_CREDENTIAL_CLEANUP_FAILED')
    fail('TEMP_CREDENTIAL_CREATE_FAILED')
  }
}

export async function cleanupCredentialFile(credentials, filesystem = fs) {
  if (!credentials || credentials.cleaned) return true
  try {
    await filesystem.unlink(credentials.pgpassFile)
    await filesystem.rmdir(credentials.directory)
    credentials.cleaned = true
    return true
  } catch {
    fail('TEMP_CREDENTIAL_CLEANUP_FAILED')
  }
}

export function installSignalCleanup(cleanup, processObject = process) {
  let handling = false
  const handlers = new Map()
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    const handler = async () => {
      if (handling) return
      handling = true
      let code = 'PROCESS_INTERRUPTED'
      try { await cleanup() } catch { code = 'TEMP_CREDENTIAL_CLEANUP_FAILED' }
      processObject.stderr.write(`${code}\n`)
      processObject.exit(1)
    }
    handlers.set(signal, handler)
    processObject.once(signal, handler)
  }
  return () => {
    for (const [signal, handler] of handlers) processObject.removeListener(signal, handler)
  }
}

function phaseFailureCode(phase) {
  return `${phase.toUpperCase()}_PSQL_FAILED`
}

export async function runDatabasePhase(
  phase,
  {
    environment = process.env,
    filesystem = fs,
    processObject = process,
    spawnImplementation = spawn,
  } = {},
) {
  validatePhase(phase)
  await verifyFixedPsql(spawnImplementation)
  const connection = parseDatabaseUrl(
    environment.SUPABASE_DB_URL,
    environment.SUPABASE_PROJECT_ID,
  )
  const credentials = await createCredentialFile(
    environment.RUNNER_TEMP,
    connection,
    filesystem,
  )
  const removeSignalHandlers = installSignalCleanup(
    () => cleanupCredentialFile(credentials, filesystem),
    processObject,
  )
  let operationError
  try {
    let result
    try {
      result = await spawnCaptured(
        PSQL_BINARY,
        buildPsqlArgs(phase),
        {
          cwd: repositoryRoot,
          env: buildChildEnvironment(connection, credentials.pgpassFile),
        },
        spawnImplementation,
      )
    } catch {
      fail(phaseFailureCode(phase))
    }
    if (result.code !== 0 || result.signal) fail(phaseFailureCode(phase))
    if (phase !== 'migration') {
      try {
        parseAndValidateAuditOutput(result.stdout, phase)
      } catch (error) {
        if (error instanceof Error && error.message === 'DATABASE_OUTPUT_INVALID') throw error
        fail(`${phase.toUpperCase()}_CONTRACT_FAILED`)
      }
    }
  } catch (error) {
    operationError = error
  } finally {
    removeSignalHandlers()
    try {
      await cleanupCredentialFile(credentials, filesystem)
    } catch (cleanupError) {
      operationError = cleanupError
    }
  }
  if (operationError) throw operationError
  return SUCCESS_MESSAGES[phase]
}

export function safeFailureCode(error) {
  return error instanceof Error && SAFE_FAILURE_CODES.has(error.message)
    ? error.message
    : 'DATABASE_OUTPUT_INVALID'
}

async function main() {
  const phase = process.argv[2]
  if (process.argv.length !== 3) fail('UNSUPPORTED_DATABASE_PHASE')
  const message = await runDatabasePhase(phase)
  console.log(message)
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(safeFailureCode(error))
    process.exitCode = 1
  })
}
