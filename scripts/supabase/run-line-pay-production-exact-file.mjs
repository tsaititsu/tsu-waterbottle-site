import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  DEPLOY_FILE,
  EXPECTED_FENCE_SHA256,
  EXPECTED_MIGRATION_SHA256,
  EXPECTED_PROJECT_REF,
  FENCE_MIGRATION_FILE,
  MIGRATION_FILE,
  POSTGRES_IMAGE,
  PREFLIGHT_FILE,
  parseAndValidateAuditOutput,
  readAndValidateFixedFile,
  validateNodeVersion,
  validatePostgresImage,
  validateProductionChannel,
} from './validate-line-pay-production-deployment.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/u
const DIRECT_HOST_PATTERN = /^db[.]([a-z0-9]{20})[.]supabase[.]co$/u
const SUPAVISOR_SESSION_HOST_PATTERN =
  /^aws-(?:0|[1-9][0-9]*)-[a-z]{2}(?:-[a-z]+)+-[1-9][0-9]*[.]pooler[.]supabase[.]com$/u
const POOLER_USERNAME_PATTERN = /^postgres[.]([a-z0-9]{20})$/u
const ASCII_HOST_PATTERN = /^[a-z0-9.-]+$/u
const ALLOWED_SSL_MODES = new Set(['require', 'verify-ca', 'verify-full'])
export const MAX_CAPTURE_BYTES = 1024 * 1024
export const DOCKER_BINARY = '/usr/bin/docker'
export const CONTAINER_REPOSITORY_ROOT = '/workspace'
export const CONTAINER_PGPASS_FILE = '/run/secrets/pgpass'
export const CONNECT_TIMEOUT_SECONDS = '15'
export const LOCK_TIMEOUT_MS = '15000'
export const STATEMENT_TIMEOUT_MS = '120000'
export const IDLE_IN_TRANSACTION_TIMEOUT_MS = '30000'
export const FIXED_PGOPTIONS =
  `-c statement_timeout=${STATEMENT_TIMEOUT_MS} ` +
  `-c lock_timeout=${LOCK_TIMEOUT_MS} ` +
  `-c idle_in_transaction_session_timeout=${IDLE_IN_TRANSACTION_TIMEOUT_MS}`

export const PHASE_FILES = Object.freeze({
  preflight: PREFLIGHT_FILE,
  deploy: DEPLOY_FILE,
})

export const SUCCESS_MESSAGES = Object.freeze({
  preflight: 'PREFLIGHT_VALIDATED',
  deploy: 'DEPLOYMENT_VALIDATED',
})

export const CONNECTION_MODES = Object.freeze({
  direct: 'direct',
  supavisorSession: 'supavisor_session',
})

const SAFE_FAILURE_CODES = new Set([
  'BLOCKED_BY_DATABASE_LOCK_RISK',
  'DATABASE_OUTPUT_INVALID',
  'DATABASE_TARGET_MISMATCH',
  'DATABASE_URL_INVALID',
  'FENCE_REGRESSION',
  'INVALID_NODE_VERSION',
  'POSTGRES_IMAGE_MISMATCH',
  'DEPLOY_PSQL_FAILED',
  'DOCKER_IMAGE_PULL_FAILED',
  'PARTIAL_APPLICATION',
  'POSTFLIGHT_CONTRACT_FAILED',
  'PREFLIGHT_CONTRACT_FAILED',
  'PREFLIGHT_PSQL_FAILED',
  'PROCESS_INTERRUPTED',
  'PRODUCTION_CHANNEL_NOT_READY',
  'PRODUCTION_DATA_DRIFT',
  'DEPLOY_CONTRACT_FAILED',
  'RUNNER_TEMP_INVALID',
  'SCHEMA_DRIFT',
  'SUPABASE_DB_URL_MISSING',
  'SUPABASE_PROJECT_ID_MISSING',
  'TEMP_CREDENTIAL_CLEANUP_FAILED',
  'TEMP_CREDENTIAL_CREATE_FAILED',
  'UNSUPPORTED_DATABASE_PHASE',
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

function parseRawAuthority(databaseUrl, parsed) {
  if (/[\u0000-\u0020\u007f]/u.test(databaseUrl)) {
    fail('DATABASE_URL_INVALID')
  }
  const schemeEnd = databaseUrl.indexOf('://')
  if (schemeEnd < 0) fail('DATABASE_URL_INVALID')
  const authorityStart = schemeEnd + 3
  const authorityEndMatch = /[/?#]/u.exec(databaseUrl.slice(authorityStart))
  const authorityEnd = authorityEndMatch
    ? authorityStart + authorityEndMatch.index
    : databaseUrl.length
  const authority = databaseUrl.slice(authorityStart, authorityEnd)
  const at = authority.lastIndexOf('@')
  if (at <= 0 || authority.indexOf('@') !== at) {
    fail('DATABASE_URL_INVALID')
  }
  const rawHostPort = authority.slice(at + 1)
  if (!rawHostPort || rawHostPort.startsWith('[')) {
    fail('DATABASE_URL_INVALID')
  }
  const firstColon = rawHostPort.indexOf(':')
  const lastColon = rawHostPort.lastIndexOf(':')
  if (firstColon !== lastColon) fail('DATABASE_URL_INVALID')
  const rawHostname =
    firstColon < 0 ? rawHostPort : rawHostPort.slice(0, firstColon)
  const rawPort = firstColon < 0 ? '' : rawHostPort.slice(firstColon + 1)
  if (
    !rawHostname ||
    !ASCII_HOST_PATTERN.test(rawHostname) ||
    rawHostname !== parsed.hostname
  ) {
    fail('DATABASE_URL_INVALID')
  }
  if (firstColon >= 0 && !rawPort) fail('DATABASE_URL_INVALID')
  if (rawPort && (!/^\d+$/u.test(rawPort) || rawPort !== parsed.port)) {
    fail('DATABASE_URL_INVALID')
  }
  return rawPort
}

export function isValidSupavisorSessionHostname(hostname) {
  return (
    typeof hostname === 'string' &&
    hostname.length <= 253 &&
    ASCII_HOST_PATTERN.test(hostname) &&
    !hostname.includes('xn--') &&
    SUPAVISOR_SESSION_HOST_PATTERN.test(hostname)
  )
}

function determineConnectionMode(hostname, username, projectId) {
  const directMatch = DIRECT_HOST_PATTERN.exec(hostname)
  if (directMatch) {
    if (directMatch[1] !== projectId) fail('DATABASE_TARGET_MISMATCH')
    if (username !== 'postgres') fail('DATABASE_URL_INVALID')
    return CONNECTION_MODES.direct
  }
  if (isValidSupavisorSessionHostname(hostname)) {
    const usernameMatch = POOLER_USERNAME_PATTERN.exec(username)
    if (!usernameMatch || usernameMatch[1] !== projectId) {
      fail('DATABASE_TARGET_MISMATCH')
    }
    return CONNECTION_MODES.supavisorSession
  }
  fail('DATABASE_URL_INVALID')
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
  if (
    !PROJECT_REF_PATTERN.test(projectId) ||
    projectId !== EXPECTED_PROJECT_REF
  ) {
    fail('DATABASE_TARGET_MISMATCH')
  }
  let parsed
  try {
    parsed = new URL(databaseUrl)
  } catch {
    fail('DATABASE_URL_INVALID')
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    fail('DATABASE_URL_INVALID')
  }
  if (!parsed.hostname || !parsed.username || !parsed.password || parsed.hash) {
    fail('DATABASE_URL_INVALID')
  }
  const database = decodeComponent(parsed.pathname.slice(1))
  const username = decodeComponent(parsed.username)
  const password = decodeComponent(parsed.password)
  if (!database || !username || !password || database !== 'postgres') {
    fail('DATABASE_URL_INVALID')
  }
  if (/[\u0000-\u001f\u007f]/u.test(password)) {
    fail('DATABASE_URL_INVALID')
  }
  const rawPort = parseRawAuthority(databaseUrl, parsed)
  const port = rawPort || '5432'
  if (!/^\d+$/u.test(port) || port !== '5432') {
    fail('DATABASE_URL_INVALID')
  }
  const queryKeys = [...parsed.searchParams.keys()]
  if (queryKeys.some((key) => key !== 'sslmode')) {
    fail('DATABASE_URL_INVALID')
  }
  const sslModes = parsed.searchParams.getAll('sslmode')
  if (sslModes.length > 1) fail('DATABASE_URL_INVALID')
  const sslmode = sslModes[0] ?? 'require'
  if (!ALLOWED_SSL_MODES.has(sslmode)) fail('DATABASE_URL_INVALID')
  const mode = determineConnectionMode(parsed.hostname, username, projectId)
  return Object.freeze({
    database,
    databaseUrl,
    encodedPassword: parsed.password,
    host: parsed.hostname,
    mode,
    password,
    port,
    projectId,
    sslmode,
    username,
  })
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
    '--quiet',
    '--no-align',
    '--tuples-only',
    `--file=${join(CONTAINER_REPOSITORY_ROOT, PHASE_FILES[phase])}`,
  ]
}

export function buildChildEnvironment(connection) {
  const environment = {
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    PGHOST: connection.host,
    PGPORT: connection.port,
    PGDATABASE: connection.database,
    PGUSER: connection.username,
    PGPASSFILE: CONTAINER_PGPASS_FILE,
    PGSSLMODE: connection.sslmode,
    PGAPPNAME: 'line-pay-production-exact-file-migration',
    PGCONNECT_TIMEOUT: CONNECT_TIMEOUT_SECONDS,
    PGOPTIONS: FIXED_PGOPTIONS,
  }
  if (connection.mode === CONNECTION_MODES.supavisorSession) {
    environment.PGGSSENCMODE = 'disable'
  }
  return environment
}

export function buildDockerRunArgs(phase, connection, pgpassFile) {
  validatePhase(phase)
  validatePostgresImage(POSTGRES_IMAGE)
  const childEnvironment = buildChildEnvironment(connection)
  const user = `${process.getuid?.() ?? 1001}:${process.getgid?.() ?? 1001}`
  return [
    'run',
    '--rm',
    '--read-only',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges',
    '--pull=never',
    `--user=${user}`,
    '--mount',
    `type=bind,source=${repositoryRoot},target=${CONTAINER_REPOSITORY_ROOT},readonly`,
    '--mount',
    `type=bind,source=${pgpassFile},target=${CONTAINER_PGPASS_FILE},readonly`,
    '--workdir',
    CONTAINER_REPOSITORY_ROOT,
    ...Object.entries(childEnvironment).flatMap(([key, value]) => [
      '--env',
      `${key}=${value}`,
    ]),
    POSTGRES_IMAGE,
    'psql',
    ...buildPsqlArgs(phase),
  ]
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
  for (const value of values) {
    redacted = redacted.split(value).join('[REDACTED]')
  }
  return redacted
}

export function spawnCaptured(
  binary,
  args,
  options,
  spawnImplementation = spawn,
) {
  return new Promise((resolvePromise, rejectPromise) => {
    let child
    try {
      child = spawnImplementation(binary, args, {
        cwd: options.cwd,
        env: options.env,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      options.onSpawn?.(child)
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
    child.stdout?.on('data', (chunk) => {
      stdout = append(stdout, chunk)
    })
    child.stderr?.on('data', (chunk) => {
      stderr = append(stderr, chunk)
    })
    child.once('error', () =>
      rejectPromise(new Error('PROCESS_SPAWN_FAILED')),
    )
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

export async function pullFixedPostgresImage(spawnImplementation = spawn) {
  validatePostgresImage(POSTGRES_IMAGE)
  let result
  try {
    result = await spawnCaptured(
      DOCKER_BINARY,
      ['pull', POSTGRES_IMAGE],
      {
        cwd: repositoryRoot,
        env: {
          LANG: 'C.UTF-8',
          LC_ALL: 'C.UTF-8',
          PATH: process.env.PATH ?? '/usr/bin:/bin',
        },
      },
      spawnImplementation,
    )
  } catch {
    fail('DOCKER_IMAGE_PULL_FAILED')
  }
  if (result.code !== 0 || result.signal) fail('DOCKER_IMAGE_PULL_FAILED')
  return true
}

export async function createCredentialFile(
  runnerTemp,
  connection,
  filesystem = fs,
) {
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
    directory = await filesystem.mkdtemp(
      join(runnerTemp, 'line-pay-production-'),
    )
    pgpassFile = join(directory, 'pgpass')
    await filesystem.writeFile(
      pgpassFile,
      `${buildPgpassLine(connection)}\n`,
      {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o600,
      },
    )
    const credentialStat = await filesystem.stat(pgpassFile)
    if ((credentialStat.mode & 0o777) !== 0o600) {
      fail('TEMP_CREDENTIAL_CREATE_FAILED')
    }
    return { directory, pgpassFile, cleaned: false }
  } catch {
    let cleanupFailed = false
    if (pgpassFile) {
      try {
        await filesystem.unlink(pgpassFile)
      } catch (error) {
        if (!(error instanceof Error && error.code === 'ENOENT')) {
          cleanupFailed = true
        }
      }
    }
    if (directory) {
      try {
        await filesystem.rmdir(directory)
      } catch {
        cleanupFailed = true
      }
    }
    if (cleanupFailed) fail('TEMP_CREDENTIAL_CLEANUP_FAILED')
    fail('TEMP_CREDENTIAL_CREATE_FAILED')
  }
}

export async function cleanupCredentialFile(
  credentials,
  filesystem = fs,
) {
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
      try {
        await cleanup()
      } catch {
        code = 'TEMP_CREDENTIAL_CLEANUP_FAILED'
      }
      processObject.exitCode = 1
      if (code === 'TEMP_CREDENTIAL_CLEANUP_FAILED') {
        processObject.stderr.write(`${code}\n`)
      }
    }
    handlers.set(signal, handler)
    processObject.once(signal, handler)
  }
  return () => {
    for (const [signal, handler] of handlers) {
      processObject.removeListener(signal, handler)
    }
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
  validateNodeVersion()
  validateProductionChannel(environment)
  readAndValidateFixedFile(
    repositoryRoot,
    MIGRATION_FILE,
    EXPECTED_MIGRATION_SHA256,
  )
  readAndValidateFixedFile(
    repositoryRoot,
    FENCE_MIGRATION_FILE,
    EXPECTED_FENCE_SHA256,
  )
  const connection = parseDatabaseUrl(
    environment.SUPABASE_PRODUCTION_DB_URL,
    environment.SUPABASE_PROJECT_ID,
  )
  const credentials = await createCredentialFile(
    environment.RUNNER_TEMP,
    connection,
    filesystem,
  )
  let activeChild
  let interrupted = false
  const removeSignalHandlers = installSignalCleanup(() => {
    interrupted = true
    activeChild?.kill('SIGTERM')
  }, processObject)
  let operationError
  try {
    await pullFixedPostgresImage(spawnImplementation)
    let result
    try {
      result = await spawnCaptured(
        DOCKER_BINARY,
        buildDockerRunArgs(phase, connection, credentials.pgpassFile),
        {
          cwd: repositoryRoot,
          env: {
            LANG: 'C.UTF-8',
            LC_ALL: 'C.UTF-8',
            PATH: environment.PATH ?? process.env.PATH ?? '/usr/bin:/bin',
          },
          onSpawn: (child) => {
            activeChild = child
          },
        },
        spawnImplementation,
      )
    } catch {
      fail(phaseFailureCode(phase))
    }
    if (interrupted) fail('PROCESS_INTERRUPTED')
    if (result.code !== 0 || result.signal) fail(phaseFailureCode(phase))
    try {
      parseAndValidateAuditOutput(
        result.stdout,
        phase === 'deploy' ? 'postflight' : 'preflight',
      )
    } catch (error) {
      if (
        error instanceof Error &&
        SAFE_FAILURE_CODES.has(error.message)
      ) {
        throw error
      }
      fail(`${phase.toUpperCase()}_CONTRACT_FAILED`)
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
  if (process.argv.length !== 3) fail('UNSUPPORTED_DATABASE_PHASE')
  const phase = process.argv[2]
  const message = await runDatabasePhase(phase)
  console.log(message)
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : ''
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(safeFailureCode(error))
    process.exitCode = 1
  })
}
