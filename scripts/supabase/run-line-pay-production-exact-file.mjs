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

export const DEPLOY_ATTESTATION_MARKERS = Object.freeze({
  migrationStarted: 'LINE_PAY_DEPLOY_MIGRATION_STARTED',
  migrationCommitted: 'LINE_PAY_DEPLOY_MIGRATION_COMMITTED',
  postflightStarted: 'LINE_PAY_DEPLOY_POSTFLIGHT_STARTED',
  postflightStateEmitted: 'LINE_PAY_DEPLOY_POSTFLIGHT_STATE_EMITTED',
  postflightCommitted: 'LINE_PAY_DEPLOY_POSTFLIGHT_COMMITTED',
})

const DEPLOY_ATTESTATION_MARKER_ORDER = Object.freeze([
  DEPLOY_ATTESTATION_MARKERS.migrationStarted,
  DEPLOY_ATTESTATION_MARKERS.migrationCommitted,
  DEPLOY_ATTESTATION_MARKERS.postflightStarted,
  DEPLOY_ATTESTATION_MARKERS.postflightStateEmitted,
  DEPLOY_ATTESTATION_MARKERS.postflightCommitted,
])
const DEPLOYMENT_FAILURE_ATTESTATION = Symbol(
  'deploymentFailureAttestation',
)

export const DEPLOYMENT_RECORDING_POLICY =
  'GITHUB_ATTESTED_EXACT_FILE'

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
  'DEPLOY_FAILED_BEFORE_MIGRATION_START',
  'DEPLOY_PROCESS_FAILED_AFTER_BOTH_COMMITS_OBSERVED',
  'DOCKER_IMAGE_PULL_FAILED',
  'CREDENTIAL_CLEANUP_FAILED_AFTER_BOTH_COMMITS_OBSERVED',
  'MIGRATION_COMMIT_STATE_UNKNOWN',
  'MIGRATION_SQL_FAILED_BEFORE_COMMIT',
  'MIGRATION_COMMIT_OBSERVED_POSTFLIGHT_NOT_OBSERVED',
  'MIGRATION_COMMIT_OBSERVED_POSTFLIGHT_COMMIT_STATE_UNKNOWN',
  'MIGRATION_COMMIT_OBSERVED_POSTFLIGHT_SQL_FAILED_BEFORE_COMMIT',
  'OUTPUT_VALIDATION_FAILED_AFTER_BOTH_COMMITS_OBSERVED',
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

function freezeAttestation(value) {
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object') freezeAttestation(nested)
  }
  return Object.freeze(value)
}

function emptyDeployEvidence() {
  return Object.freeze({
    markerSequenceValid: true,
    migration_started_observed: false,
    migration_commit_observed: false,
    postflight_started_observed: false,
    postflight_state_observed: false,
    postflight_commit_observed: false,
    auditOutput: '',
  })
}

export function buildDeploymentFailureAttestation(
  primaryFailureCode,
  evidence = emptyDeployEvidence(),
  cleanupFailureCode,
) {
  if (!SAFE_FAILURE_CODES.has(primaryFailureCode)) {
    primaryFailureCode = 'DATABASE_OUTPUT_INVALID'
  }
  if (
    cleanupFailureCode !== undefined &&
    cleanupFailureCode !== 'TEMP_CREDENTIAL_CLEANUP_FAILED'
  ) {
    cleanupFailureCode = 'TEMP_CREDENTIAL_CLEANUP_FAILED'
  }
  const attestation = {
    status: 'DEPLOYMENT_FAILED',
    primary_failure_code: primaryFailureCode,
    migration_started_observed:
      evidence.migration_started_observed === true,
    migration_commit_observed:
      evidence.migration_commit_observed === true,
    postflight_started_observed:
      evidence.postflight_started_observed === true,
    postflight_state_observed:
      evidence.postflight_state_observed === true,
    postflight_commit_observed:
      evidence.postflight_commit_observed === true,
  }
  if (cleanupFailureCode) {
    attestation.cleanup_failure_code = cleanupFailureCode
  }
  return freezeAttestation(attestation)
}

function createDeploymentFailure(
  primaryFailure,
  evidence,
  cleanupFailureCode,
) {
  const primaryFailureCode = safeFailureCode(primaryFailure)
  const error = new Error(primaryFailureCode)
  error.attestation = buildDeploymentFailureAttestation(
    primaryFailureCode,
    evidence,
    cleanupFailureCode,
  )
  error[DEPLOYMENT_FAILURE_ATTESTATION] = error.attestation
  return error
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

export async function pullFixedPostgresImage(
  spawnImplementation = spawn,
  { onSpawn } = {},
) {
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
        onSpawn,
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

function phaseFailureCode(phase) {
  return `${phase.toUpperCase()}_PSQL_FAILED`
}

export function inspectDeployOutput(text) {
  if (typeof text !== 'string') return emptyDeployEvidence()
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  const markerSet = new Set(DEPLOY_ATTESTATION_MARKER_ORDER)
  const observedMarkers = lines.filter((line) => markerSet.has(line))
  const markerCounts = new Map(
    DEPLOY_ATTESTATION_MARKER_ORDER.map((marker) => [
      marker,
      observedMarkers.filter((value) => value === marker).length,
    ]),
  )
  const markerSequenceValid =
    observedMarkers.length <= DEPLOY_ATTESTATION_MARKER_ORDER.length &&
    observedMarkers.every(
      (marker, index) => marker === DEPLOY_ATTESTATION_MARKER_ORDER[index],
    ) &&
    [...markerCounts.values()].every((count) => count <= 1)
  const hasObservedMarker = (marker) => markerCounts.get(marker) >= 1
  const auditLines = lines.filter((line) => !markerSet.has(line))
  return Object.freeze({
    markerSequenceValid,
    migration_started_observed: hasObservedMarker(
      DEPLOY_ATTESTATION_MARKERS.migrationStarted,
    ),
    migration_commit_observed: hasObservedMarker(
      DEPLOY_ATTESTATION_MARKERS.migrationCommitted,
    ),
    postflight_started_observed: hasObservedMarker(
      DEPLOY_ATTESTATION_MARKERS.postflightStarted,
    ),
    postflight_state_observed: hasObservedMarker(
      DEPLOY_ATTESTATION_MARKERS.postflightStateEmitted,
    ),
    postflight_commit_observed: hasObservedMarker(
      DEPLOY_ATTESTATION_MARKERS.postflightCommitted,
    ),
    auditOutput: auditLines.join('\n'),
  })
}

export function buildDeploySuccessAttestation(
  evidence,
  validatedPostflight,
) {
  return freezeAttestation({
    status: 'DEPLOYMENT_VALIDATED',
    deployment_recording_policy: DEPLOYMENT_RECORDING_POLICY,
    transaction_boundary_attestation: {
      migration_started_observed:
        evidence.migration_started_observed,
      migration_commit_observed:
        evidence.migration_commit_observed,
      postflight_started_observed:
        evidence.postflight_started_observed,
      postflight_state_observed:
        evidence.postflight_state_observed,
      postflight_commit_observed:
        evidence.postflight_commit_observed,
    },
    database_postflight_attestation: {
      status: validatedPostflight.status,
      line_pay_contract_status: validatedPostflight.status,
      runtime_enabled: validatedPostflight.runtime_enabled,
      supabase_migration_history_table_present:
        validatedPostflight.migration_history.line_pay_version_present,
      supabase_migration_history_version_present:
        validatedPostflight.migration_history.line_pay_version_present,
    },
  })
}

function isProvenPsqlSqlFailureBeforeCommit(result) {
  return result.code === 3 && result.signal === null
}

function interruptedDeployFailureCode(evidence) {
  if (
    evidence.migration_commit_observed &&
    evidence.postflight_commit_observed
  ) {
    return 'DEPLOY_PROCESS_FAILED_AFTER_BOTH_COMMITS_OBSERVED'
  }
  if (evidence.migration_commit_observed) {
    return evidence.postflight_started_observed
      ? 'MIGRATION_COMMIT_OBSERVED_POSTFLIGHT_COMMIT_STATE_UNKNOWN'
      : 'MIGRATION_COMMIT_OBSERVED_POSTFLIGHT_NOT_OBSERVED'
  }
  return 'MIGRATION_COMMIT_STATE_UNKNOWN'
}

export function validateDeployExecutionResult(result, evidence) {
  if (
    !result ||
    typeof result !== 'object' ||
    !evidence ||
    typeof evidence !== 'object'
  ) {
    fail('MIGRATION_COMMIT_STATE_UNKNOWN')
  }
  if (
    evidence.migration_commit_observed &&
    evidence.postflight_commit_observed
  ) {
    if (
      !evidence.markerSequenceValid ||
      result.code !== 0 ||
      result.signal ||
      !evidence.migration_started_observed ||
      !evidence.postflight_started_observed ||
      !evidence.postflight_state_observed
    ) {
      fail('DEPLOY_PROCESS_FAILED_AFTER_BOTH_COMMITS_OBSERVED')
    }
    let validatedPostflight
    try {
      validatedPostflight = parseAndValidateAuditOutput(
        evidence.auditOutput,
        'postflight',
      )
    } catch {
      fail('OUTPUT_VALIDATION_FAILED_AFTER_BOTH_COMMITS_OBSERVED')
    }
    return buildDeploySuccessAttestation(evidence, validatedPostflight)
  }
  if (evidence.migration_commit_observed) {
    if (!evidence.postflight_started_observed) {
      fail('MIGRATION_COMMIT_OBSERVED_POSTFLIGHT_NOT_OBSERVED')
    }
    if (isProvenPsqlSqlFailureBeforeCommit(result)) {
      fail(
        'MIGRATION_COMMIT_OBSERVED_POSTFLIGHT_SQL_FAILED_BEFORE_COMMIT',
      )
    }
    fail(
      'MIGRATION_COMMIT_OBSERVED_POSTFLIGHT_COMMIT_STATE_UNKNOWN',
    )
  }
  if (evidence.migration_started_observed) {
    if (isProvenPsqlSqlFailureBeforeCommit(result)) {
      fail('MIGRATION_SQL_FAILED_BEFORE_COMMIT')
    }
    fail('MIGRATION_COMMIT_STATE_UNKNOWN')
  }
  if (
    isProvenPsqlSqlFailureBeforeCommit(result) &&
    evidence.markerSequenceValid
  ) {
    fail('DEPLOY_FAILED_BEFORE_MIGRATION_START')
  }
  fail('MIGRATION_COMMIT_STATE_UNKNOWN')
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
  let activeChild = null
  let activeChildCompletion = null
  let credentials = null
  let interrupted = false
  let cleanupStarted = false
  let cleanupCompleted = false
  let cleanupPromise = null
  let deployEvidence = emptyDeployEvidence()
  let completedResult = SUCCESS_MESSAGES[phase]
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
      } catch {
        fail('TEMP_CREDENTIAL_CLEANUP_FAILED')
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
  try {
    credentials = await createCredentialFile(
      environment.RUNNER_TEMP,
      connection,
      filesystem,
    )
    ensureNotInterrupted()
    try {
      await pullFixedPostgresImage(spawnImplementation, {
        onSpawn: trackActiveChild,
      })
    } catch (error) {
      if (interrupted) fail('PROCESS_INTERRUPTED')
      throw error
    }
    ensureNotInterrupted()
    const dockerRunArgs = buildDockerRunArgs(
      phase,
      connection,
      credentials.pgpassFile,
    )
    ensureNotInterrupted()
    let result
    try {
      result = await spawnCaptured(
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
    } catch {
      fail(phaseFailureCode(phase))
    }
    if (phase === 'deploy') {
      deployEvidence = inspectDeployOutput(result.stdout)
      completedResult = validateDeployExecutionResult(
        interrupted && !result.signal
          ? { ...result, signal: 'RUNNER_INTERRUPTED' }
          : result,
        deployEvidence,
      )
    } else {
      ensureNotInterrupted()
      if (result.code !== 0 || result.signal) fail(phaseFailureCode(phase))
      try {
        parseAndValidateAuditOutput(result.stdout, 'preflight')
      } catch (error) {
        if (
          error instanceof Error &&
          SAFE_FAILURE_CODES.has(error.message)
        ) {
          throw error
        }
        fail(`${phase.toUpperCase()}_CONTRACT_FAILED`)
      }
    }
  } catch (error) {
    operationError =
      error instanceof Error &&
      error.message === 'TEMP_CREDENTIAL_CLEANUP_FAILED'
        ? error
        : interrupted && phase !== 'deploy'
          ? new Error('PROCESS_INTERRUPTED')
          : error
  } finally {
    let cleanupError = null
    try {
      await terminateActiveChild()
    } catch {
      if (!operationError) operationError = new Error('PROCESS_INTERRUPTED')
    }
    try {
      await cleanupCredentialsOnce()
    } catch {
      cleanupError = new Error('TEMP_CREDENTIAL_CLEANUP_FAILED')
    } finally {
      removeSignalHandlers()
      if (
        interrupted &&
        phase !== 'deploy' &&
        !(
          operationError instanceof Error &&
          operationError.message === 'TEMP_CREDENTIAL_CLEANUP_FAILED'
        )
      ) {
        operationError = new Error('PROCESS_INTERRUPTED')
      }
    }
    if (interrupted && phase === 'deploy' && !operationError) {
      operationError = new Error(
        interruptedDeployFailureCode(deployEvidence),
      )
    }
    if (cleanupError) {
      if (phase === 'deploy') {
        if (operationError) {
          operationError = createDeploymentFailure(
            operationError,
            deployEvidence,
            'TEMP_CREDENTIAL_CLEANUP_FAILED',
          )
        } else {
          const cleanupPrimary =
            deployEvidence.migration_commit_observed &&
            deployEvidence.postflight_commit_observed
              ? new Error(
                  'CREDENTIAL_CLEANUP_FAILED_AFTER_BOTH_COMMITS_OBSERVED',
                )
              : cleanupError
          operationError = createDeploymentFailure(
            cleanupPrimary,
            deployEvidence,
          )
        }
      } else {
        operationError = cleanupError
      }
    }
  }
  if (operationError) {
    if (phase === 'deploy' && !operationError.attestation) {
      throw createDeploymentFailure(operationError, deployEvidence)
    }
    throw operationError
  }
  return completedResult
}

export function safeFailureCode(error) {
  return error instanceof Error && SAFE_FAILURE_CODES.has(error.message)
    ? error.message
    : 'DATABASE_OUTPUT_INVALID'
}

export function safeFailureOutput(error) {
  if (
    error instanceof Error &&
    error[DEPLOYMENT_FAILURE_ATTESTATION] &&
    error[DEPLOYMENT_FAILURE_ATTESTATION] === error.attestation
  ) {
    return JSON.stringify(error.attestation)
  }
  return safeFailureCode(error)
}

async function main() {
  if (process.argv.length !== 3) fail('UNSUPPORTED_DATABASE_PHASE')
  const phase = process.argv[2]
  const result = await runDatabasePhase(phase)
  console.log(
    typeof result === 'string' ? result : JSON.stringify(result),
  )
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : ''
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(safeFailureOutput(error))
    process.exitCode = 1
  })
}
