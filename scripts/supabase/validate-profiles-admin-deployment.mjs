import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const EXPECTED_REPOSITORY = 'tsaititsu/tsu-waterbottle-site'
export const EXPECTED_EVENT = 'workflow_dispatch'
export const EXPECTED_REF = 'refs/heads/main'
export const EXPECTED_CONFIRMATION = 'DEPLOY_PROFILES_ADMIN_ESCALATION_FIX'
export const EXPECTED_CLI_VERSION = '2.109.1'
export const MIGRATION_FILE =
  'supabase/migrations/20260716084928_profiles_admin_escalation_fix.sql'
export const EXPECTED_MIGRATION_SHA256 =
  'f7f2207135ffaf1dd3476108a38ffb95184410ad0fad962f4d0e71e9e9613e7d'

const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/
const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/
const DEPLOYMENT_STATE_KEY = 'profiles_admin_deployment_state'
const PREFLIGHT_STATES = new Set([
  'VULNERABLE_EXPECTED',
  'ALREADY_APPLIED',
  'DATABASE_DRIFT_DETECTED',
])
const POSTFLIGHT_STATES = new Set(['POSTFLIGHT_OK', 'POSTFLIGHT_FAILED'])

function fail(code) {
  throw new Error(code)
}

function decodeUrlComponent(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    fail('invalid-target-encoding')
  }
}

function runCommand(command, args, code, cwd = process.cwd()) {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      env: {
        ...process.env,
        SUPABASE_TELEMETRY_DISABLED: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch {
    fail(code)
  }
}

function readJson(relativePath, code, root = process.cwd()) {
  try {
    return JSON.parse(readFileSync(join(root, relativePath), 'utf8'))
  } catch {
    fail(code)
  }
}

export function validateFullSha(value) {
  if (typeof value !== 'string' || !FULL_SHA_PATTERN.test(value)) {
    fail('invalid-main-sha')
  }

  return value
}

export function validateConfirmation(value) {
  if (value !== EXPECTED_CONFIRMATION) {
    fail('invalid-confirmation')
  }

  return true
}

export function validateMigrationHash(actualHash) {
  if (actualHash !== EXPECTED_MIGRATION_SHA256) {
    fail('invalid-migration-hash')
  }

  return true
}

export function stripSqlForStaticAnalysis(sql) {
  let result = ''
  let index = 0
  let state = 'code'

  while (index < sql.length) {
    const current = sql[index]
    const next = sql[index + 1]

    if (state === 'line-comment') {
      if (current === '\n') {
        state = 'code'
        result += '\n'
      } else {
        result += ' '
      }
      index += 1
      continue
    }

    if (state === 'block-comment') {
      if (current === '*' && next === '/') {
        result += '  '
        index += 2
        state = 'code'
      } else {
        result += current === '\n' ? '\n' : ' '
        index += 1
      }
      continue
    }

    if (state === 'single-quote') {
      if (current === "'" && next === "'") {
        result += '  '
        index += 2
      } else if (current === "'") {
        result += ' '
        index += 1
        state = 'code'
      } else {
        result += current === '\n' ? '\n' : ' '
        index += 1
      }
      continue
    }

    if (current === '-' && next === '-') {
      result += '  '
      index += 2
      state = 'line-comment'
      continue
    }

    if (current === '/' && next === '*') {
      result += '  '
      index += 2
      state = 'block-comment'
      continue
    }

    if (current === "'") {
      result += ' '
      index += 1
      state = 'single-quote'
      continue
    }

    result += current
    index += 1
  }

  if (state === 'block-comment' || state === 'single-quote') {
    fail('invalid-sql-syntax')
  }

  return result
}

export function assertMigrationStaticSafety(sql) {
  const normalized = stripSqlForStaticAnalysis(sql)
  const forbiddenPatterns = [
    /\bgrant\b/i,
    /\binsert\s+into\b/i,
    /\bupdate\s+public[.]profiles\b/i,
    /\bdelete\s+from\b/i,
    /\btruncate\b/i,
    /\bdrop\s+table\b/i,
    /\bdrop\s+schema\b/i,
    /\bdisable\s+row\s+level\s+security\b/i,
    /\bcopy\b/i,
    /\bcall\b/i,
    /\bdo\b/i,
  ]

  if (forbiddenPatterns.some((pattern) => pattern.test(normalized))) {
    fail('unsafe-migration-sql')
  }

  return true
}

export function validateTarget(databaseUrl, projectId) {
  if (typeof projectId !== 'string' || !PROJECT_REF_PATTERN.test(projectId)) {
    fail('invalid-project-id')
  }

  let parsed
  try {
    parsed = new URL(databaseUrl)
  } catch {
    fail('invalid-database-url')
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    fail('invalid-database-protocol')
  }

  if (parsed.hostname !== `db.${projectId}.supabase.co`) {
    fail('target-project-mismatch')
  }

  if (decodeUrlComponent(parsed.username) !== 'postgres') {
    fail('invalid-database-username')
  }

  if (!parsed.password) {
    fail('missing-database-password')
  }

  if (parsed.port !== '5432') {
    fail('invalid-database-port')
  }

  if (decodeUrlComponent(parsed.pathname) !== '/postgres') {
    fail('invalid-database-name')
  }

  if (parsed.hash) {
    fail('invalid-database-fragment')
  }

  const queryKeys = [...parsed.searchParams.keys()]
  const sslModes = parsed.searchParams.getAll('sslmode')
  if (
    queryKeys.length !== 1 ||
    queryKeys[0] !== 'sslmode' ||
    sslModes.length !== 1 ||
    sslModes[0] !== 'require'
  ) {
    fail('tls-required')
  }

  return {
    connectionType: 'direct',
  }
}

export function parseDeploymentStateJson(text, mode) {
  if (typeof text !== 'string') {
    fail('invalid-metadata-result')
  }

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    fail('invalid-metadata-result')
  }

  if (!Array.isArray(parsed) || parsed.length !== 1) {
    fail('invalid-metadata-result')
  }

  const row = parsed[0]
  if (
    row === null ||
    Array.isArray(row) ||
    typeof row !== 'object' ||
    Object.getPrototypeOf(row) !== Object.prototype
  ) {
    fail('invalid-metadata-result')
  }

  const keys = Object.keys(row)
  if (keys.length !== 1 || keys[0] !== DEPLOYMENT_STATE_KEY) {
    fail('invalid-metadata-result')
  }

  const state = row[DEPLOYMENT_STATE_KEY]
  if (typeof state !== 'string') {
    fail('invalid-metadata-result')
  }

  const allowedStates =
    mode === 'preflight'
      ? PREFLIGHT_STATES
      : mode === 'postflight'
        ? POSTFLIGHT_STATES
        : null

  if (!allowedStates?.has(state)) {
    fail('invalid-metadata-result')
  }

  return state
}

export function parsePreflightState(text) {
  const state = parseDeploymentStateJson(text, 'preflight')

  if (state === 'DATABASE_DRIFT_DETECTED') {
    fail('database-drift-detected')
  }

  return {
    state,
    shouldDeploy: state === 'VULNERABLE_EXPECTED',
  }
}

export function parsePostflightState(text) {
  const state = parseDeploymentStateJson(text, 'postflight')

  if (state !== 'POSTFLIGHT_OK') {
    fail('postflight-validation-failed')
  }

  return state
}

export function validateSource(environment = process.env, root = process.cwd()) {
  if (environment.GITHUB_REPOSITORY !== EXPECTED_REPOSITORY) {
    fail('invalid-repository')
  }

  if (environment.GITHUB_EVENT_NAME !== EXPECTED_EVENT) {
    fail('invalid-event')
  }

  if (environment.GITHUB_REF !== EXPECTED_REF) {
    fail('invalid-ref')
  }

  const expectedMainSha = validateFullSha(environment.EXPECTED_MAIN_SHA)
  const githubSha = validateFullSha(environment.GITHUB_SHA)

  if (githubSha !== expectedMainSha) {
    fail('main-sha-mismatch')
  }

  validateConfirmation(environment.DEPLOY_CONFIRMATION)

  if (environment.MIGRATION_FILE !== MIGRATION_FILE) {
    fail('invalid-migration-path')
  }

  if (environment.EXPECTED_SHA256 !== EXPECTED_MIGRATION_SHA256) {
    fail('invalid-expected-hash')
  }

  const migrationPath = join(root, MIGRATION_FILE)
  let migrationStat
  try {
    migrationStat = lstatSync(migrationPath)
  } catch {
    fail('migration-file-missing')
  }

  if (!migrationStat.isFile() || migrationStat.isSymbolicLink()) {
    fail('invalid-migration-file-type')
  }

  const head = runCommand('git', ['rev-parse', 'HEAD'], 'git-head-validation-failed', root)
  if (head !== githubSha) {
    fail('checkout-sha-mismatch')
  }

  runCommand(
    'git',
    ['ls-files', '--error-unmatch', MIGRATION_FILE],
    'migration-not-tracked',
    root,
  )
  runCommand(
    'git',
    ['cat-file', '-e', `${githubSha}:${MIGRATION_FILE}`],
    'migration-not-in-commit',
    root,
  )

  const migration = readFileSync(migrationPath, 'utf8')
  const migrationHash = createHash('sha256').update(migration).digest('hex')
  validateMigrationHash(migrationHash)
  assertMigrationStaticSafety(migration)

  const packageJson = readJson('package.json', 'invalid-package-json', root)
  const packageLock = readJson('package-lock.json', 'invalid-package-lock', root)
  const lockedSupabase = packageLock.packages?.['node_modules/supabase']

  if (
    packageJson.devDependencies?.supabase !== EXPECTED_CLI_VERSION ||
    packageLock.packages?.['']?.devDependencies?.supabase !== EXPECTED_CLI_VERSION ||
    lockedSupabase?.version !== EXPECTED_CLI_VERSION ||
    typeof lockedSupabase?.integrity !== 'string' ||
    lockedSupabase.integrity.length === 0
  ) {
    fail('invalid-cli-lock')
  }

  const cliPath = join(root, 'node_modules/.bin/supabase')
  const cliVersion = runCommand(
    cliPath,
    ['--version'],
    'cli-version-check-failed',
    root,
  ).split(/\s+/)[0]

  if (cliVersion !== EXPECTED_CLI_VERSION) {
    fail('invalid-cli-version')
  }

  return true
}

function readResultFile(filePath) {
  if (!filePath) {
    fail('result-file-missing')
  }

  try {
    return readFileSync(filePath, 'utf8')
  } catch {
    fail('result-file-unreadable')
  }
}

function safeErrorMessage(error) {
  if (error instanceof Error && error.message === 'invalid-metadata-result') {
    return 'invalid metadata result'
  }

  if (error instanceof Error && /^[a-z0-9-]+$/.test(error.message)) {
    return error.message
  }

  return 'unexpected-validation-error'
}

async function main() {
  const mode = process.argv[2]

  if (mode === 'source') {
    validateSource()
    console.log('source validation passed')
    return
  }

  if (mode === 'target') {
    validateTarget(process.env.SUPABASE_DB_URL, process.env.SUPABASE_PROJECT_ID)
    console.log('target validation passed')
    return
  }

  if (mode === 'preflight') {
    const result = parsePreflightState(readResultFile(process.argv[3]))
    console.log(result.state)
    return
  }

  if (mode === 'postflight') {
    console.log(parsePostflightState(readResultFile(process.argv[3])))
    return
  }

  fail('unknown-validator-mode')
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(`validation failed: ${safeErrorMessage(error)}`)
    process.exitCode = 1
  })
}
