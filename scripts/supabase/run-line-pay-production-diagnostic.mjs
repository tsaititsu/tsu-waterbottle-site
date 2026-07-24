import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  DIAGNOSTIC_FILE,
  EXPECTED_PROJECT_REF,
  POSTGRES_IMAGE,
  parseAndValidateDiagnosticOutput,
  readAndValidateDiagnosticFile,
  safeErrorCode,
  validateNodeVersion,
  validatePostgresImage,
  validateProductionChannel,
} from './validate-line-pay-production-diagnostic.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/u
const DIRECT_HOST_PATTERN = /^db[.]([a-z0-9]{20})[.]supabase[.]co$/u
const SUPAVISOR_SESSION_HOST_PATTERN =
  /^aws-(?:0|[1-9][0-9]*)-[a-z]{2}(?:-[a-z]+)+-[1-9][0-9]*[.]pooler[.]supabase[.]com$/u
const POOLER_USERNAME_PATTERN = /^postgres[.]([a-z0-9]{20})$/u
const ASCII_HOST_PATTERN = /^[a-z0-9.-]+$/u
const ALLOWED_SSL_MODES = new Set(['require', 'verify-ca', 'verify-full'])

export const DATABASE_SESSION_LIMIT = 1
export const MAX_CAPTURE_BYTES = 1024 * 1024
export const DOCKER_BINARY = '/usr/bin/docker'
export const CONTAINER_REPOSITORY_ROOT = '/workspace'
export const CONTAINER_PGPASS_FILE = '/run/secrets/pgpass'
export const DIAGNOSTIC_CONTAINER_FILE = join(
  CONTAINER_REPOSITORY_ROOT,
  DIAGNOSTIC_FILE,
)
export const CONNECT_TIMEOUT_SECONDS = '15'
export const LOCK_TIMEOUT_MS = '15000'
export const STATEMENT_TIMEOUT_MS = '120000'
export const IDLE_IN_TRANSACTION_TIMEOUT_MS = '30000'
export const FIXED_PGOPTIONS =
  '-c default_transaction_read_only=on ' +
  `-c statement_timeout=${STATEMENT_TIMEOUT_MS} ` +
  `-c lock_timeout=${LOCK_TIMEOUT_MS} ` +
  `-c idle_in_transaction_session_timeout=${IDLE_IN_TRANSACTION_TIMEOUT_MS}`

export const CONNECTION_MODES = Object.freeze({
  direct: 'direct',
  supavisorSession: 'supavisor_session',
})

export const DIAGNOSTIC_STATES = Object.freeze({
  SOURCE_VALIDATED: 'SOURCE_VALIDATED',
  CREDENTIAL_CREATED: 'CREDENTIAL_CREATED',
  IMAGE_PULL_STARTED: 'IMAGE_PULL_STARTED',
  IMAGE_PULL_COMPLETED: 'IMAGE_PULL_COMPLETED',
  CONTAINER_STARTED: 'CONTAINER_STARTED',
  PSQL_COMPLETED: 'PSQL_COMPLETED',
  OUTPUT_VALIDATED: 'OUTPUT_VALIDATED',
  CREDENTIAL_CLEANED: 'CREDENTIAL_CLEANED',
})

export const DATABASE_CONNECTION_STATES = Object.freeze({
  CONFIRMED: 'CONFIRMED',
  NOT_ESTABLISHED: 'NOT_ESTABLISHED',
  UNKNOWN: 'UNKNOWN',
})

const FAILURE_ATTESTATION_KEYS = Object.freeze([
  'status',
  'phase',
  'failure_code',
  'docker_pull_completed',
  'container_started',
  'database_connection',
  'sql_completed',
  'output_validated',
  'credential_cleanup_completed',
])

class DiagnosticExecutionFailure extends Error {
  constructor(attestation) {
    super(attestation.failure_code)
    this.name = 'DiagnosticExecutionFailure'
    this.attestation = attestation
  }
}

function fail(code) {
  throw new Error(code)
}

function createFailureAttestation(failure, execution) {
  const attestation = {
    status: 'DIAGNOSTIC_EXECUTION_FAILED',
    phase: failure.phase,
    failure_code: failure.code,
    docker_pull_completed: execution.dockerPullCompleted,
    container_started: execution.containerStarted,
    database_connection: execution.databaseConnection,
    sql_completed: execution.sqlCompleted,
    output_validated: execution.outputValidated,
    credential_cleanup_completed: execution.credentialCleanupCompleted,
  }
  if (
    Object.keys(attestation).length !== FAILURE_ATTESTATION_KEYS.length ||
    FAILURE_ATTESTATION_KEYS.some((key) => !(key in attestation))
  ) {
    throw new Error('DIAGNOSTIC_CONTAINER_EXEC_FAILED')
  }
  return Object.freeze(attestation)
}

export function toSafeFailureAttestation(error) {
  if (
    error instanceof DiagnosticExecutionFailure &&
    error.attestation &&
    Object.isFrozen(error.attestation)
  ) {
    return error.attestation
  }
  return Object.freeze({
    status: 'DIAGNOSTIC_EXECUTION_FAILED',
    phase: 'docker_run_start',
    failure_code: 'DIAGNOSTIC_CONTAINER_EXEC_FAILED',
    docker_pull_completed: false,
    container_started: false,
    database_connection: DATABASE_CONNECTION_STATES.UNKNOWN,
    sql_completed: false,
    output_validated: false,
    credential_cleanup_completed: false,
  })
}

export function isDiagnosticExecutionFailure(error) {
  return error instanceof DiagnosticExecutionFailure
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
  const authorityEndMatch = /[/?#]/u.exec(
    databaseUrl.slice(authorityStart),
  )
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

function determineConnectionMode(hostname, username, projectId) {
  const directMatch = DIRECT_HOST_PATTERN.exec(hostname)
  if (directMatch) {
    if (directMatch[1] !== projectId) fail('DATABASE_TARGET_MISMATCH')
    if (username !== 'postgres') fail('DATABASE_URL_INVALID')
    return CONNECTION_MODES.direct
  }
  if (
    ASCII_HOST_PATTERN.test(hostname) &&
    !hostname.includes('xn--') &&
    SUPAVISOR_SESSION_HOST_PATTERN.test(hostname)
  ) {
    const usernameMatch = POOLER_USERNAME_PATTERN.exec(username)
    if (!usernameMatch || usernameMatch[1] !== projectId) {
      fail('DATABASE_TARGET_MISMATCH')
    }
    return CONNECTION_MODES.supavisorSession
  }
  fail('DATABASE_URL_INVALID')
}

export function parseDatabaseUrl(databaseUrl, projectId) {
  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    fail('DATABASE_URL_INVALID')
  }
  if (
    typeof projectId !== 'string' ||
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
  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
    !parsed.hostname ||
    !parsed.username ||
    !parsed.password ||
    parsed.hash
  ) {
    fail('DATABASE_URL_INVALID')
  }
  const database = decodeComponent(parsed.pathname.slice(1))
  const username = decodeComponent(parsed.username)
  const password = decodeComponent(parsed.password)
  if (
    database !== 'postgres' ||
    !username ||
    !password ||
    /[\u0000-\u001f\u007f]/u.test(password)
  ) {
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

export function validateCliArguments(argv = process.argv) {
  if (!Array.isArray(argv) || argv.length !== 2) {
    fail('SOURCE_CONTEXT_INVALID')
  }
  return true
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

export function buildPsqlArgs() {
  return [
    '--no-psqlrc',
    '--set=ON_ERROR_STOP=1',
    '--quiet',
    '--no-align',
    '--tuples-only',
    `--file=${DIAGNOSTIC_CONTAINER_FILE}`,
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
    PGAPPNAME: 'line-pay-production-read-only-diagnostic',
    PGCONNECT_TIMEOUT: CONNECT_TIMEOUT_SECONDS,
    PGOPTIONS: FIXED_PGOPTIONS,
  }
  if (connection.mode === CONNECTION_MODES.supavisorSession) {
    environment.PGGSSENCMODE = 'disable'
  }
  return environment
}

export function buildDockerRunArgs(connection, pgpassFile) {
  validatePostgresImage(POSTGRES_IMAGE)
  if (typeof pgpassFile !== 'string' || !isAbsolute(pgpassFile)) {
    fail('DIAGNOSTIC_CONTAINER_START_FAILED')
  }
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
    ...buildPsqlArgs(),
  ]
}

export function spawnCaptured(
  binary,
  args,
  options,
  spawnImplementation = spawn,
) {
  return new Promise((resolvePromise) => {
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
      resolvePromise({
        captureExceeded: false,
        code: null,
        signal: null,
        spawned: false,
        stdout: '',
      })
      return
    }
    let stdout = ''
    let capturedBytes = 0
    let captureExceeded = false
    let settled = false
    const append = (chunk, includeInStdout) => {
      capturedBytes += Buffer.byteLength(chunk)
      if (capturedBytes > MAX_CAPTURE_BYTES) {
        captureExceeded = true
        child.kill('SIGTERM')
        return
      }
      if (includeInStdout) stdout += chunk.toString('utf8')
    }
    child.stdout?.on('data', (chunk) => {
      append(chunk, true)
    })
    child.stderr?.on('data', (chunk) => {
      append(chunk, false)
    })
    const settle = (result) => {
      if (settled) return
      settled = true
      resolvePromise(result)
    }
    child.once('error', () => {
      settle({
        captureExceeded: false,
        code: null,
        signal: null,
        spawned: false,
        stdout: '',
      })
    })
    child.once('close', (code, signal) => {
      settle({
        captureExceeded,
        code: captureExceeded ? null : code,
        signal: captureExceeded ? 'CAPTURE_LIMIT' : signal,
        spawned: true,
        stdout,
      })
    })
  })
}

export async function pullFixedPostgresImage(
  spawnImplementation = spawn,
  { onSpawn } = {},
) {
  validatePostgresImage(POSTGRES_IMAGE)
  return spawnCaptured(
    DOCKER_BINARY,
    ['pull', POSTGRES_IMAGE],
    {
      cwd: repositoryRoot,
      env: {
        LANG: 'C.UTF-8',
        LC_ALL: 'C.UTF-8',
        PATH: process.env.PATH ?? '/usr/bin:/bin',
      },
      onSpawn,
    },
    spawnImplementation,
  )
}

export async function createCredentialFile(
  runnerTemp,
  connection,
  filesystem = fs,
) {
  if (typeof runnerTemp !== 'string' || !isAbsolute(runnerTemp)) {
    fail('DIAGNOSTIC_TEMP_CREDENTIAL_CREATE_FAILED')
  }
  try {
    const rootStat = await filesystem.stat(runnerTemp)
    if (!rootStat.isDirectory()) {
      fail('DIAGNOSTIC_TEMP_CREDENTIAL_CREATE_FAILED')
    }
  } catch {
    fail('DIAGNOSTIC_TEMP_CREDENTIAL_CREATE_FAILED')
  }
  let directory
  let pgpassFile
  try {
    directory = await filesystem.mkdtemp(
      join(runnerTemp, 'line-pay-diagnostic-'),
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
      fail('DIAGNOSTIC_TEMP_CREDENTIAL_CREATE_FAILED')
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
    fail('DIAGNOSTIC_TEMP_CREDENTIAL_CREATE_FAILED')
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

export function installSignalCleanup(interrupt, processObject = process) {
  let handling = false
  const handlers = new Map()
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    const handler = () => {
      if (handling) return
      handling = true
      processObject.exitCode = 1
      interrupt(signal)
    }
    handlers.set(signal, handler)
    processObject.on(signal, handler)
  }
  return () => {
    for (const [signal, handler] of handlers) {
      processObject.removeListener(signal, handler)
    }
  }
}

export async function runDiagnostic({
  environment = process.env,
  filesystem = fs,
  processObject = process,
  spawnImplementation = spawn,
} = {}) {
  validateNodeVersion()
  validateProductionChannel(environment)
  readAndValidateDiagnosticFile(repositoryRoot)
  const connection = parseDatabaseUrl(
    environment.SUPABASE_PRODUCTION_DB_URL,
    environment.SUPABASE_PROJECT_ID,
  )
  const execution = {
    state: DIAGNOSTIC_STATES.SOURCE_VALIDATED,
    dockerPullCompleted: false,
    containerStarted: false,
    databaseConnection: DATABASE_CONNECTION_STATES.NOT_ESTABLISHED,
    sqlCompleted: false,
    outputValidated: false,
    credentialCleanupCompleted: false,
  }
  let databaseSessionExecutions = 0
  let activeChild = null
  let activeChildCompletion = null
  let credentials = null
  let interrupted = false
  let cleanupStarted = false
  let cleanupCompleted = false
  let cleanupPromise = null
  const ensureNotInterrupted = () => {
    if (interrupted) fail('PROCESS_INTERRUPTED')
  }
  const trackActiveChild = (child) => {
    activeChild = child
    activeChildCompletion = new Promise((resolvePromise) => {
      let settled = false
      const settle = () => {
        if (settled) return
        settled = true
        if (activeChild === child) activeChild = null
        resolvePromise()
      }
      child.once('close', settle)
      child.once('error', settle)
    })
    if (interrupted) child.kill('SIGTERM')
  }
  const terminateActiveChild = async () => {
    const child = activeChild
    const completion = activeChildCompletion
    if (!child) return
    child.kill('SIGTERM')
    if (completion) await completion
  }
  const cleanupCredentialsOnce = async () => {
    if (cleanupCompleted) return true
    if (cleanupStarted) return cleanupPromise
    cleanupStarted = true
    cleanupPromise = (async () => {
      try {
        if (credentials) {
          await cleanupCredentialFile(credentials, filesystem)
        }
        return true
      } finally {
        cleanupCompleted = true
      }
    })()
    return cleanupPromise
  }
  const removeSignalHandlers = installSignalCleanup(() => {
    interrupted = true
    activeChild?.kill('SIGTERM')
  }, processObject)
  let operationError
  let failure
  let sanitizedResult
  try {
    credentials = await createCredentialFile(
      environment.RUNNER_TEMP,
      connection,
      filesystem,
    )
    execution.state = DIAGNOSTIC_STATES.CREDENTIAL_CREATED
    ensureNotInterrupted()
    execution.state = DIAGNOSTIC_STATES.IMAGE_PULL_STARTED
    const pullResult = await pullFixedPostgresImage(spawnImplementation, {
      onSpawn: trackActiveChild,
    })
    if (pullResult.captureExceeded) {
      failure = {
        code: 'DIAGNOSTIC_CAPTURE_LIMIT_EXCEEDED',
        phase: 'docker_pull',
      }
      throw new Error(failure.code)
    }
    if (
      !pullResult.spawned ||
      pullResult.code !== 0 ||
      pullResult.signal
    ) {
      failure = {
        code: 'DIAGNOSTIC_DOCKER_IMAGE_PULL_FAILED',
        phase: 'docker_pull',
      }
      throw new Error(failure.code)
    }
    execution.state = DIAGNOSTIC_STATES.IMAGE_PULL_COMPLETED
    execution.dockerPullCompleted = true
    ensureNotInterrupted()
    const dockerRunArgs = buildDockerRunArgs(
      connection,
      credentials.pgpassFile,
    )
    databaseSessionExecutions += 1
    if (databaseSessionExecutions !== DATABASE_SESSION_LIMIT) {
      failure = {
        code: 'DIAGNOSTIC_CONTAINER_EXEC_FAILED',
        phase: 'docker_run_start',
      }
      throw new Error(failure.code)
    }
    const result = await spawnCaptured(
      DOCKER_BINARY,
      dockerRunArgs,
      {
        cwd: repositoryRoot,
        env: {
          LANG: 'C.UTF-8',
          LC_ALL: 'C.UTF-8',
          PATH: environment.PATH ?? process.env.PATH ?? '/usr/bin:/bin',
        },
        onSpawn: trackActiveChild,
      },
      spawnImplementation,
    )
    ensureNotInterrupted()
    if (!result.spawned || result.code === 125) {
      failure = {
        code: 'DIAGNOSTIC_CONTAINER_START_FAILED',
        phase: 'docker_run_start',
      }
      throw new Error(failure.code)
    }
    if (result.captureExceeded) {
      execution.databaseConnection = DATABASE_CONNECTION_STATES.UNKNOWN
      failure = {
        code: 'DIAGNOSTIC_CAPTURE_LIMIT_EXCEEDED',
        phase: 'diagnostic_output',
      }
      throw new Error(failure.code)
    }
    if (result.signal) {
      execution.databaseConnection = DATABASE_CONNECTION_STATES.UNKNOWN
      failure = {
        code: 'PROCESS_INTERRUPTED',
        phase: 'process_signal',
      }
      throw new Error(failure.code)
    }
    execution.state = DIAGNOSTIC_STATES.CONTAINER_STARTED
    execution.containerStarted = true
    if (result.code === 2) {
      failure = {
        code: 'DIAGNOSTIC_DB_CONNECT_FAILED',
        phase: 'psql_connection',
      }
      throw new Error(failure.code)
    }
    if (result.code === 3) {
      execution.databaseConnection = DATABASE_CONNECTION_STATES.CONFIRMED
      failure = {
        code: 'DIAGNOSTIC_SQL_EXECUTION_FAILED',
        phase: 'diagnostic_sql',
      }
      throw new Error(failure.code)
    }
    if (result.code !== 0) {
      execution.databaseConnection =
        result.code === 126 || result.code === 127
          ? DATABASE_CONNECTION_STATES.NOT_ESTABLISHED
          : DATABASE_CONNECTION_STATES.UNKNOWN
      failure = {
        code: 'DIAGNOSTIC_CONTAINER_EXEC_FAILED',
        phase: 'docker_run_start',
      }
      throw new Error(failure.code)
    }
    execution.state = DIAGNOSTIC_STATES.PSQL_COMPLETED
    execution.databaseConnection = DATABASE_CONNECTION_STATES.CONFIRMED
    execution.sqlCompleted = true
    sanitizedResult = parseAndValidateDiagnosticOutput(result.stdout)
    execution.state = DIAGNOSTIC_STATES.OUTPUT_VALIDATED
    execution.outputValidated = true
  } catch (error) {
    operationError = interrupted
      ? new Error('PROCESS_INTERRUPTED')
      : error
    if (interrupted) {
      failure = {
        code: 'PROCESS_INTERRUPTED',
        phase: 'process_signal',
      }
      execution.databaseConnection =
        execution.containerStarted
          ? DATABASE_CONNECTION_STATES.UNKNOWN
          : DATABASE_CONNECTION_STATES.NOT_ESTABLISHED
    } else if (!failure) {
      const code = error instanceof Error ? error.message : ''
      if (code === 'TEMP_CREDENTIAL_CLEANUP_FAILED') {
        failure = {
          code: 'TEMP_CREDENTIAL_CLEANUP_FAILED',
          phase: 'credential_cleanup',
        }
      } else if (
        execution.state === DIAGNOSTIC_STATES.SOURCE_VALIDATED
      ) {
        failure = {
          code: 'DIAGNOSTIC_TEMP_CREDENTIAL_CREATE_FAILED',
          phase: 'credential_create',
        }
      } else if (
        execution.state === DIAGNOSTIC_STATES.PSQL_COMPLETED
      ) {
        failure = {
          code: 'DIAGNOSTIC_OUTPUT_INVALID',
          phase: 'diagnostic_output',
        }
      } else {
        failure = {
          code: 'DIAGNOSTIC_CONTAINER_EXEC_FAILED',
          phase: 'docker_run_start',
        }
      }
    }
  } finally {
    try {
      await terminateActiveChild()
    } catch {
      if (!operationError) operationError = new Error('PROCESS_INTERRUPTED')
    }
    try {
      await cleanupCredentialsOnce()
      if (failure?.code !== 'TEMP_CREDENTIAL_CLEANUP_FAILED') {
        execution.state = DIAGNOSTIC_STATES.CREDENTIAL_CLEANED
        execution.credentialCleanupCompleted = true
      }
    } catch {
      operationError = new Error('TEMP_CREDENTIAL_CLEANUP_FAILED')
      failure = {
        code: 'TEMP_CREDENTIAL_CLEANUP_FAILED',
        phase: 'credential_cleanup',
      }
      execution.credentialCleanupCompleted = false
    } finally {
      removeSignalHandlers()
      if (
        interrupted &&
        !(
          operationError instanceof Error &&
          operationError.message === 'TEMP_CREDENTIAL_CLEANUP_FAILED'
        )
      ) {
        operationError = new Error('PROCESS_INTERRUPTED')
        failure = {
          code: 'PROCESS_INTERRUPTED',
          phase: 'process_signal',
        }
      }
    }
  }
  if (operationError) {
    throw new DiagnosticExecutionFailure(
      createFailureAttestation(
        failure ?? {
          code: 'DIAGNOSTIC_CONTAINER_EXEC_FAILED',
          phase: 'docker_run_start',
        },
        execution,
      ),
    )
  }
  return sanitizedResult
}

async function main() {
  validateCliArguments(process.argv)
  const result = await runDiagnostic()
  console.log(JSON.stringify(result))
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : ''
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(
      isDiagnosticExecutionFailure(error)
        ? JSON.stringify(toSafeFailureAttestation(error))
        : safeErrorCode(error),
    )
    process.exitCode = 1
  })
}
