import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  DOCKER_BINARY,
  buildPgpassLine,
  cleanupCredentialFile,
  createCredentialFile,
  installSignalCleanup,
  parseDatabaseUrl,
  pullFixedPostgresImage,
  spawnCaptured,
} from './run-bank-transfer-production-forensic.mjs'
import {
  ARTIFACT_FILENAME,
  CAPTURE_FILE,
  EXPECTED_PROJECT_REF,
  POSTGRES_IMAGE,
  parseAndValidateBaselineArtifact,
  safeErrorCode,
  validateNodeVersion,
  validatePostgresImage,
  validateProductionChannel,
} from './validate-bank-transfer-production-baseline-capture.mjs'

export { parseDatabaseUrl }

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const CONTAINER_REPOSITORY_ROOT = '/workspace'
const CONTAINER_PGPASS_FILE = '/run/secrets/pgpass'
const CONTAINER_CAPTURE_FILE = join(
  CONTAINER_REPOSITORY_ROOT,
  CAPTURE_FILE,
)
const CONNECT_TIMEOUT_SECONDS = '15'
const FIXED_PGOPTIONS =
  '-c default_transaction_read_only=on ' +
  '-c statement_timeout=120000 ' +
  '-c lock_timeout=15000 ' +
  '-c idle_in_transaction_session_timeout=30000'

export const DATABASE_SESSION_LIMIT = 1

function fail(code) {
  throw new Error(code)
}

function childEnvironment(connection) {
  const environment = {
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    PGHOST: connection.host,
    PGPORT: connection.port,
    PGDATABASE: connection.database,
    PGUSER: connection.username,
    PGPASSFILE: CONTAINER_PGPASS_FILE,
    PGSSLMODE: connection.sslmode,
    PGAPPNAME: 'bank-transfer-production-baseline-capture',
    PGCONNECT_TIMEOUT: CONNECT_TIMEOUT_SECONDS,
    PGOPTIONS: FIXED_PGOPTIONS,
  }
  if (connection.mode === 'supavisor_session') {
    environment.PGGSSENCMODE = 'disable'
  }
  return environment
}

export function buildDockerRunArgs(connection, pgpassFile) {
  validatePostgresImage(POSTGRES_IMAGE)
  if (typeof pgpassFile !== 'string' || !isAbsolute(pgpassFile)) {
    fail('BASELINE_CAPTURE_CONTAINER_START_FAILED')
  }
  const user = `${process.getuid?.() ?? 1001}:${process.getgid?.() ?? 1001}`
  return [
    'run',
    '--rm',
    '--read-only',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges',
    '--pull=never',
    '--network=bridge',
    '--pids-limit=64',
    '--memory=256m',
    '--cpus=1',
    '--tmpfs',
    '/tmp:rw,noexec,nosuid,nodev,size=16m',
    `--user=${user}`,
    '--mount',
    `type=bind,source=${repositoryRoot},target=${CONTAINER_REPOSITORY_ROOT},readonly`,
    '--mount',
    `type=bind,source=${pgpassFile},target=${CONTAINER_PGPASS_FILE},readonly`,
    '--workdir',
    CONTAINER_REPOSITORY_ROOT,
    ...Object.entries(childEnvironment(connection)).flatMap(
      ([key, value]) => ['--env', `${key}=${value}`],
    ),
    POSTGRES_IMAGE,
    'psql',
    '--no-psqlrc',
    '--set=ON_ERROR_STOP=1',
    '--quiet',
    '--no-align',
    '--tuples-only',
    `--file=${CONTAINER_CAPTURE_FILE}`,
  ]
}

export async function writePrivateArtifact(
  runnerTemp,
  artifact,
  filesystem = fs,
) {
  if (typeof runnerTemp !== 'string' || !isAbsolute(runnerTemp)) {
    fail('BASELINE_ARTIFACT_WRITE_FAILED')
  }
  parseAndValidateBaselineArtifact(`${JSON.stringify(artifact)}\n`)
  const artifactPath = join(runnerTemp, ARTIFACT_FILENAME)
  try {
    const rootStat = await filesystem.stat(runnerTemp)
    if (!rootStat.isDirectory()) {
      fail('BASELINE_ARTIFACT_WRITE_FAILED')
    }
    await filesystem.writeFile(
      artifactPath,
      `${JSON.stringify(artifact)}\n`,
      {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o600,
      },
    )
    const fileStat = await filesystem.lstat(artifactPath)
    if (
      !fileStat.isFile() ||
      fileStat.isSymbolicLink() ||
      (fileStat.mode & 0o777) !== 0o600
    ) {
      fail('BASELINE_ARTIFACT_WRITE_FAILED')
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'BASELINE_ARTIFACT_WRITE_FAILED'
    ) {
      throw error
    }
    fail('BASELINE_ARTIFACT_WRITE_FAILED')
  }
  return artifactPath
}

export function buildSafeSuccessAttestation(artifact) {
  const parsed = parseAndValidateBaselineArtifact(
    `${JSON.stringify(artifact)}\n`,
  )
  return Object.freeze({
    status: 'BASELINE_CAPTURE_COMPLETED',
    artifact_created: true,
    row_count: parsed.row_count,
    pending_review_count: parsed.pending_review_count,
    database_sessions: DATABASE_SESSION_LIMIT,
    read_only: true,
  })
}

function classifyResult(result) {
  if (!result.spawned || result.code === 125) {
    fail('BASELINE_CAPTURE_CONTAINER_START_FAILED')
  }
  if (result.captureExceeded) {
    fail('BASELINE_CAPTURE_LIMIT_EXCEEDED')
  }
  if (result.signal) fail('PROCESS_INTERRUPTED')
  if (result.code === 2) fail('BASELINE_CAPTURE_DB_CONNECT_FAILED')
  if (result.code === 3) fail('BASELINE_CAPTURE_SQL_EXECUTION_FAILED')
  if (result.code !== 0) {
    fail('BASELINE_CAPTURE_CONTAINER_EXEC_FAILED')
  }
  return parseAndValidateBaselineArtifact(result.stdout)
}

export async function runBaselineCapture({
  environment = process.env,
  filesystem = fs,
  processObject = process,
  spawnImplementation = spawn,
} = {}) {
  validateNodeVersion()
  validateProductionChannel(environment)
  const connection = parseDatabaseUrl(
    environment.SUPABASE_PRODUCTION_DB_URL,
    environment.SUPABASE_PROJECT_ID,
  )
  if (connection.projectId !== EXPECTED_PROJECT_REF) {
    fail('DATABASE_TARGET_MISMATCH')
  }
  let databaseSessionExecutions = 0
  let credentials
  let activeChild = null
  let activeChildCompletion = null
  let interrupted = false
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
  const removeSignalHandlers = installSignalCleanup(() => {
    interrupted = true
    activeChild?.kill('SIGTERM')
  }, processObject)

  let artifact
  let operationError
  try {
    try {
      credentials = await createCredentialFile(
        environment.RUNNER_TEMP,
        connection,
        filesystem,
      )
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'TEMP_CREDENTIAL_CLEANUP_FAILED'
      ) {
        throw error
      }
      fail('BASELINE_CAPTURE_TEMP_CREDENTIAL_CREATE_FAILED')
    }
    if (interrupted) fail('PROCESS_INTERRUPTED')

    const pullResult = await pullFixedPostgresImage(spawnImplementation, {
      onSpawn: trackActiveChild,
    })
    if (
      pullResult.captureExceeded ||
      !pullResult.spawned ||
      pullResult.code !== 0 ||
      pullResult.signal
    ) {
      fail('BASELINE_CAPTURE_DOCKER_IMAGE_PULL_FAILED')
    }
    if (interrupted) fail('PROCESS_INTERRUPTED')

    databaseSessionExecutions += 1
    if (databaseSessionExecutions !== DATABASE_SESSION_LIMIT) {
      fail('BASELINE_CAPTURE_CONTAINER_EXEC_FAILED')
    }
    const result = await spawnCaptured(
      DOCKER_BINARY,
      buildDockerRunArgs(connection, credentials.pgpassFile),
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
    if (interrupted) fail('PROCESS_INTERRUPTED')
    artifact = classifyResult(result)
  } catch (error) {
    operationError = interrupted
      ? new Error('PROCESS_INTERRUPTED')
      : error
  } finally {
    try {
      if (activeChild) {
        activeChild.kill('SIGTERM')
        if (activeChildCompletion) await activeChildCompletion
      }
    } catch {
      operationError = new Error('PROCESS_INTERRUPTED')
    }
    try {
      if (credentials) {
        await cleanupCredentialFile(credentials, filesystem)
      }
    } catch {
      operationError = new Error('TEMP_CREDENTIAL_CLEANUP_FAILED')
    } finally {
      removeSignalHandlers()
    }
  }
  if (operationError) throw operationError
  return artifact
}

async function main() {
  if (process.argv.length !== 2) fail('SOURCE_CONTEXT_INVALID')
  const artifact = await runBaselineCapture()
  await writePrivateArtifact(process.env.RUNNER_TEMP, artifact)
  const attestation = buildSafeSuccessAttestation(artifact)
  console.log(JSON.stringify(attestation))
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : ''
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(safeErrorCode(error))
    process.exitCode = 1
  })
}
