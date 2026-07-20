import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

export const EXPECTED_REPOSITORY = 'tsaititsu/tsu-waterbottle-site'
export const EXPECTED_EVENT = 'workflow_dispatch'
export const EXPECTED_REF = 'refs/heads/main'
export const EXPECTED_CONFIRMATION = 'DEPLOY_PROFILES_ADMIN_ESCALATION_FIX'
export const MIGRATION_FILE =
  'supabase/migrations/20260716084928_profiles_admin_escalation_fix.sql'
export const PREFLIGHT_FILE =
  'supabase/deployment/profiles_admin_escalation_preflight.sql'
export const POSTFLIGHT_FILE =
  'supabase/deployment/profiles_admin_escalation_postflight.sql'
export const RUNNER_FILE = 'scripts/supabase/run-fixed-psql.mjs'
export const WORKFLOW_FILE =
  '.github/workflows/supabase-emergency-profiles-acl.yml'
export const EXPECTED_MIGRATION_SHA256 =
  'f7f2207135ffaf1dd3476108a38ffb95184410ad0fad962f4d0e71e9e9613e7d'
export const EXPECTED_RUNNER_SHA256 =
  'c9f90800a5675e2ca544f14e26ffc13c71c84307143b549d34ed5e9098d4f8f9'
export const PSQL_BINARY = '/usr/lib/postgresql/16/bin/psql'
export const EXPECTED_PSQL_MAJOR = 16

export const APPROVED_FUNCTION_DEFINITION = `CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_admin = true
  );
$function$`

export const CANONICAL_FUNCTION_CONTRACT = Object.freeze({
  schema: 'public',
  function_name: 'is_admin',
  identity_arguments: '',
  function_oid_count: 1,
  overload_count: 0,
  return_type: 'boolean',
  language: 'sql',
  owner: 'postgres',
  security_definer: true,
  volatility: 'STABLE',
  parallel: 'UNSAFE',
  leakproof: false,
  proconfig: Object.freeze(['search_path=public']),
  search_path: 'public',
  raw_acl: null,
  public_execute: true,
  anon_execute: true,
  authenticated_execute: true,
  service_role_execute: true,
  owner_execute: true,
})

export const CANONICAL_PUBLIC_SCHEMA_CONTRACT = Object.freeze({
  owner: 'pg_database_owner',
  public_create: false,
  anon_create: false,
  authenticated_create: false,
})

export const CANONICAL_POLICY_REFERENCES = Object.freeze([
  'public.ai_chart_reports.ai_chart_reports_select_own_or_admin',
  'public.booking_notices.admin_manage_notices',
  'public.booking_notices.public_read_active_notices',
  'public.booking_settings.admin_manage_booking_settings',
  'public.bookings.bookings_select_own_or_admin',
  'public.bookings.bookings_update_own_or_admin',
  'public.chart_profiles.chart_profiles_delete_own_or_admin',
  'public.chart_profiles.chart_profiles_select_own_or_admin',
  'public.chart_profiles.chart_profiles_update_own_or_admin',
  'public.consultation_plans.admin_manage_plans',
  'public.consultation_plans.public_read_active_plans',
  'public.course_group_links.admin_manage_course_group_links',
  'public.course_lessons.admin_manage_course_lessons',
  'public.course_modules.admin_manage_course_modules',
  'public.course_modules.course_modules_select_published_or_admin',
  'public.courses.admin_manage_courses',
  'public.courses.public_read_active_courses',
  'public.divination_readings.divination_readings_select_own_or_admin',
  'public.lesson_assets.admin_manage_lesson_assets',
  'public.payments.payments_select_own_or_admin',
  'public.point_transactions.point_transactions_select_own_or_admin',
  'public.point_wallets.point_wallets_select_own_or_admin',
  'public.profiles.profiles_select_own_or_admin',
  'public.profiles.profiles_update_own_or_admin',
])

export const PREFLIGHT_STATUS = 'VULNERABLE_EXPECTED'
export const POSTFLIGHT_STATUS = 'SECURE_EXPECTED'
export const DRIFT_STATUSES = Object.freeze([
  'IS_ADMIN_FUNCTION_DRIFT',
  'POLICY_REFERENCE_DRIFT',
  'PROFILES_PRECONDITION_DRIFT',
])

const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/
const EXPECTED_FUNCTION_KEYS = [
  ...Object.keys(CANONICAL_FUNCTION_CONTRACT),
  'definition',
].sort()
const EXPECTED_SCHEMA_KEYS = Object.keys(CANONICAL_PUBLIC_SCHEMA_CONTRACT).sort()
const EXPECTED_PROFILE_KEYS = [
  'anon_update',
  'authenticated_any_column_update',
  'authenticated_is_admin_update',
  'authenticated_select',
  'authenticated_update',
  'profiles_exists',
  'rls_enabled',
  'service_role_insert',
  'service_role_select',
  'service_role_update',
].sort()
const EXPECTED_POLICY_KEYS = [
  'command',
  'count',
  'roles',
  'using_expression',
  'with_check_expression',
].sort()
const EXPECTED_ROOT_KEYS = [
  'function',
  'policy_references',
  'profiles',
  'public_schema',
  'status',
  'target_policy',
].sort()

function fail(code) {
  throw new Error(code)
}

function assertPlainObject(value, code) {
  if (
    value === null ||
    Array.isArray(value) ||
    typeof value !== 'object' ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail(code)
  }
}

function assertExactKeys(value, keys, code) {
  assertPlainObject(value, code)
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(keys)) {
    fail(code)
  }
}

function assertExactValue(actual, expected, code) {
  if (!isDeepStrictEqual(actual, expected)) {
    fail(code)
  }
}

export function validateFullSha(value) {
  if (typeof value !== 'string' || !FULL_SHA_PATTERN.test(value)) {
    fail('INVALID_MAIN_SHA')
  }
  return value
}

export function validateConfirmation(value) {
  if (value !== EXPECTED_CONFIRMATION) {
    fail('INVALID_DEPLOYMENT_CONFIRMATION')
  }
  return true
}

export function validateMigrationHash(actualHash) {
  if (actualHash !== EXPECTED_MIGRATION_SHA256) {
    fail('MIGRATION_HASH_MISMATCH')
  }
  return true
}

export function validateRunnerHash(actualHash) {
  if (actualHash !== EXPECTED_RUNNER_SHA256) {
    fail('RUNNER_HASH_MISMATCH')
  }
  return true
}

export function validatePsqlVersionOutput(output) {
  if (typeof output !== 'string') {
    fail('UNSUPPORTED_PSQL_VERSION')
  }
  const match = /^psql \(PostgreSQL\) (\d+)(?:[.]\d+)*\s*$/.exec(output.trim())
  if (!match || Number(match[1]) !== EXPECTED_PSQL_MAJOR) {
    fail('UNSUPPORTED_PSQL_VERSION')
  }
  return true
}

export function normalizeFunctionDefinition(definition) {
  if (typeof definition !== 'string') {
    fail('IS_ADMIN_FUNCTION_DRIFT')
  }
  const normalizedLines = definition
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .split('\n')
    .map((line) => line.replace(/[\t ]+$/u, ''))
  while (normalizedLines[0] === '') normalizedLines.shift()
  while (normalizedLines.at(-1) === '') normalizedLines.pop()
  return normalizedLines.join('\n')
}

export function normalizePolicyExpression(expression) {
  if (typeof expression !== 'string') {
    fail('PROFILES_PRECONDITION_DRIFT')
  }
  return expression
    .toLowerCase()
    .replaceAll('public.is_admin', 'is_admin')
    .replace(/[\t\n\v\f\r ]+/gu, '')
    .replace(/[()]/gu, '')
    .replaceAll('select', '')
    .replaceAll('asuid', '')
    .replaceAll('asis_admin', '')
}

export function policyReferenceKey(reference) {
  assertExactKeys(reference, ['policy', 'schema', 'table'], 'POLICY_REFERENCE_DRIFT')
  for (const key of ['schema', 'table', 'policy']) {
    if (typeof reference[key] !== 'string' || reference[key].length === 0) {
      fail('POLICY_REFERENCE_DRIFT')
    }
  }
  return `${reference.schema}.${reference.table}.${reference.policy}`
}

export function validatePolicyReferences(references) {
  if (!Array.isArray(references)) fail('POLICY_REFERENCE_DRIFT')
  const unique = [...new Set(references.map(policyReferenceKey))].sort()
  assertExactValue(unique, [...CANONICAL_POLICY_REFERENCES], 'POLICY_REFERENCE_DRIFT')
  return unique
}

export function validateFunctionContract(contract) {
  assertExactKeys(contract, EXPECTED_FUNCTION_KEYS, 'IS_ADMIN_FUNCTION_DRIFT')
  for (const [key, expected] of Object.entries(CANONICAL_FUNCTION_CONTRACT)) {
    if (key === 'proconfig') continue
    assertExactValue(contract[key], expected, 'IS_ADMIN_FUNCTION_DRIFT')
  }
  if (
    !Array.isArray(contract.proconfig) ||
    contract.proconfig.length !== 1 ||
    new Set(contract.proconfig).size !== 1 ||
    contract.proconfig[0] !== 'search_path=public'
  ) {
    fail('IS_ADMIN_FUNCTION_DRIFT')
  }
  if (
    normalizeFunctionDefinition(contract.definition) !==
    normalizeFunctionDefinition(APPROVED_FUNCTION_DEFINITION)
  ) {
    fail('IS_ADMIN_FUNCTION_DRIFT')
  }
  return true
}

export function validatePublicSchemaContract(contract) {
  assertExactKeys(contract, EXPECTED_SCHEMA_KEYS, 'IS_ADMIN_FUNCTION_DRIFT')
  assertExactValue(
    contract,
    CANONICAL_PUBLIC_SCHEMA_CONTRACT,
    'IS_ADMIN_FUNCTION_DRIFT',
  )
  return true
}

function validateProfilesContract(profiles, phase) {
  assertExactKeys(profiles, EXPECTED_PROFILE_KEYS, 'PROFILES_PRECONDITION_DRIFT')
  const expected = {
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
  }
  assertExactValue(profiles, expected, 'PROFILES_PRECONDITION_DRIFT')
}

function validateTargetPolicy(policy, phase) {
  assertExactKeys(policy, EXPECTED_POLICY_KEYS, 'PROFILES_PRECONDITION_DRIFT')
  if (policy.count !== 1 || policy.command !== 'w') {
    fail('PROFILES_PRECONDITION_DRIFT')
  }
  assertExactValue(
    policy.roles,
    phase === 'preflight' ? ['public'] : ['authenticated'],
    'PROFILES_PRECONDITION_DRIFT',
  )
  if (normalizePolicyExpression(policy.using_expression) !== 'auth.uid=idoris_admin') {
    fail('PROFILES_PRECONDITION_DRIFT')
  }
  if (phase === 'preflight') {
    if (policy.with_check_expression !== null) fail('PROFILES_PRECONDITION_DRIFT')
  } else if (
    normalizePolicyExpression(policy.with_check_expression) !==
    'auth.uid=idoris_admin'
  ) {
    fail('PROFILES_PRECONDITION_DRIFT')
  }
}

export function validateAuditResult(result, phase) {
  if (!['preflight', 'postflight'].includes(phase)) {
    fail('DATABASE_OUTPUT_INVALID')
  }
  assertExactKeys(result, EXPECTED_ROOT_KEYS, 'DATABASE_OUTPUT_INVALID')
  validateFunctionContract(result.function)
  validatePublicSchemaContract(result.public_schema)
  validatePolicyReferences(result.policy_references)
  validateProfilesContract(result.profiles, phase)
  validateTargetPolicy(result.target_policy, phase)
  const expectedStatus = phase === 'preflight' ? PREFLIGHT_STATUS : POSTFLIGHT_STATUS
  if (result.status !== expectedStatus) {
    if (DRIFT_STATUSES.includes(result.status)) fail(result.status)
    fail('DATABASE_OUTPUT_INVALID')
  }
  return expectedStatus
}

export function parseSingleColumnJson(text) {
  if (typeof text !== 'string') fail('DATABASE_OUTPUT_INVALID')
  const rows = text.split(/\r?\n/u).filter((line) => line.trim().length > 0)
  if (rows.length !== 1) fail('DATABASE_OUTPUT_INVALID')
  let parsed
  try {
    parsed = JSON.parse(rows[0])
  } catch {
    fail('DATABASE_OUTPUT_INVALID')
  }
  assertPlainObject(parsed, 'DATABASE_OUTPUT_INVALID')
  return parsed
}

export function parseAndValidateAuditOutput(text, phase) {
  const result = parseSingleColumnJson(text)
  validateAuditResult(result, phase)
  return result.status
}

export function stripSqlForStaticAnalysis(sql) {
  let output = ''
  let index = 0
  let state = 'code'
  let dollarTag = ''
  while (index < sql.length) {
    const current = sql[index]
    const next = sql[index + 1]
    if (state === 'line-comment') {
      if (current === '\n') { state = 'code'; output += '\n' } else output += ' '
      index += 1
      continue
    }
    if (state === 'block-comment') {
      if (current === '*' && next === '/') {
        output += '  '; index += 2; state = 'code'
      } else { output += current === '\n' ? '\n' : ' '; index += 1 }
      continue
    }
    if (state === 'single-quote') {
      if (current === "'" && next === "'") { output += '  '; index += 2 }
      else if (current === "'") { output += ' '; index += 1; state = 'code' }
      else { output += current === '\n' ? '\n' : ' '; index += 1 }
      continue
    }
    if (state === 'dollar-quote') {
      if (sql.startsWith(dollarTag, index)) {
        output += ' '.repeat(dollarTag.length); index += dollarTag.length; state = 'code'
      } else { output += current === '\n' ? '\n' : ' '; index += 1 }
      continue
    }
    if (current === '-' && next === '-') { output += '  '; index += 2; state = 'line-comment'; continue }
    if (current === '/' && next === '*') { output += '  '; index += 2; state = 'block-comment'; continue }
    if (current === "'") { output += ' '; index += 1; state = 'single-quote'; continue }
    const dollarMatch = /^\$[a-zA-Z_][a-zA-Z0-9_]*\$|^\$\$/u.exec(sql.slice(index))
    if (dollarMatch) {
      dollarTag = dollarMatch[0]; output += ' '.repeat(dollarTag.length); index += dollarTag.length; state = 'dollar-quote'; continue
    }
    output += current
    index += 1
  }
  if (['block-comment', 'single-quote', 'dollar-quote'].includes(state)) {
    fail('INVALID_SQL_SYNTAX')
  }
  return output
}

export function assertMigrationStaticSafety(sql) {
  const normalized = stripSqlForStaticAnalysis(sql)
  const forbidden = [
    /\bgrant\b/iu, /\binsert\s+into\b/iu, /\bupdate\s+public[.]profiles\b/iu,
    /\bdelete\s+from\b/iu, /\btruncate\b/iu, /\bdrop\s+(?:table|schema)\b/iu,
    /\bdisable\s+row\s+level\s+security\b/iu, /\bcopy\b/iu, /\bcall\b/iu, /\bdo\b/iu,
  ]
  if (forbidden.some((pattern) => pattern.test(normalized))) fail('UNSAFE_MIGRATION_SQL')
  return true
}

export function assertMetadataSqlStaticSafety(sql) {
  const normalized = stripSqlForStaticAnalysis(sql)
  if (!/^\s*with\b/iu.test(normalized) || (normalized.match(/;/gu) ?? []).length !== 1) {
    fail('UNSAFE_METADATA_SQL')
  }
  const forbidden = /\b(do|call|copy|create|alter|drop|grant|revoke|insert|update|delete|truncate|set\s+role)\b/iu
  if (forbidden.test(normalized) || /\bfrom\s+public[.]profiles\b/iu.test(normalized) || /\bauth[.]users\b/iu.test(normalized)) {
    fail('UNSAFE_METADATA_SQL')
  }
  return true
}

function runGit(args, root) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      env: { LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', PATH: process.env.PATH ?? '/usr/bin:/bin' },
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch { fail('SOURCE_VALIDATION_FAILED') }
}

function readFixedFile(root, relativePath) {
  const filePath = join(root, relativePath)
  let stat
  try { stat = lstatSync(filePath) } catch { fail('SOURCE_VALIDATION_FAILED') }
  if (!stat.isFile() || stat.isSymbolicLink()) fail('SOURCE_VALIDATION_FAILED')
  try { return readFileSync(filePath, 'utf8') } catch { fail('SOURCE_VALIDATION_FAILED') }
}

export function validateSource(environment = process.env, root = process.cwd()) {
  if (environment.GITHUB_REPOSITORY !== EXPECTED_REPOSITORY || environment.GITHUB_EVENT_NAME !== EXPECTED_EVENT || environment.GITHUB_REF !== EXPECTED_REF) {
    fail('SOURCE_CONTEXT_INVALID')
  }
  const expectedMainSha = validateFullSha(environment.EXPECTED_MAIN_SHA)
  const githubSha = validateFullSha(environment.GITHUB_SHA)
  if (expectedMainSha !== githubSha) fail('SOURCE_CONTEXT_INVALID')
  validateConfirmation(environment.DEPLOY_CONFIRMATION)
  const fixedFiles = [MIGRATION_FILE, PREFLIGHT_FILE, POSTFLIGHT_FILE, RUNNER_FILE, WORKFLOW_FILE]
  const fileContents = new Map()
  for (const relativePath of fixedFiles) {
    fileContents.set(relativePath, readFixedFile(root, relativePath))
    runGit(['ls-files', '--error-unmatch', relativePath], root)
    runGit(['cat-file', '-e', `${githubSha}:${relativePath}`], root)
  }
  if (runGit(['rev-parse', 'HEAD'], root) !== githubSha) fail('SOURCE_CONTEXT_INVALID')
  const migration = fileContents.get(MIGRATION_FILE)
  const runner = fileContents.get(RUNNER_FILE)
  validateMigrationHash(createHash('sha256').update(migration).digest('hex'))
  validateRunnerHash(createHash('sha256').update(runner).digest('hex'))
  assertMigrationStaticSafety(migration)
  assertMetadataSqlStaticSafety(fileContents.get(PREFLIGHT_FILE))
  assertMetadataSqlStaticSafety(fileContents.get(POSTFLIGHT_FILE))
  return true
}

export function validateInstalledPsql() {
  let output
  try {
    output = execFileSync(PSQL_BINARY, ['--version'], {
      encoding: 'utf8', env: { LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' }, stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch { fail('PSQL_VERSION_CHECK_FAILED') }
  validatePsqlVersionOutput(output)
  return true
}

const SAFE_ERROR_CODES = new Set([
  'INVALID_MAIN_SHA', 'INVALID_DEPLOYMENT_CONFIRMATION', 'MIGRATION_HASH_MISMATCH',
  'SOURCE_CONTEXT_INVALID', 'SOURCE_VALIDATION_FAILED', 'UNSAFE_MIGRATION_SQL',
  'UNSAFE_METADATA_SQL', 'INVALID_SQL_SYNTAX', 'PSQL_VERSION_CHECK_FAILED',
  'UNSUPPORTED_PSQL_VERSION',
  'RUNNER_HASH_MISMATCH',
])

async function main() {
  const mode = process.argv[2]
  if (mode === 'source') { validateSource(); console.log('SOURCE_VALIDATED'); return }
  if (mode === 'psql') { validateInstalledPsql(); console.log('PSQL_VERSION_VALIDATED'); return }
  fail('SOURCE_VALIDATION_FAILED')
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    const code = error instanceof Error && SAFE_ERROR_CODES.has(error.message) ? error.message : 'SOURCE_VALIDATION_FAILED'
    console.error(code)
    process.exitCode = 1
  })
}
