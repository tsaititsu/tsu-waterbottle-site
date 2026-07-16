import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const migrationsDirectory = join(root, 'supabase/migrations')
const schemaPath = join(root, 'supabase/schema.sql')
const packagePath = join(root, 'package.json')
const lockfilePath = join(root, 'package-lock.json')
const profileUpsertPaths = [
  'src/app/auth/callback/route.ts',
  'src/app/api/auth/sync-profile/route.ts',
  'src/lib/auth/line.ts',
] as const

function readProjectFile(relativePath: string) {
  return readFileSync(join(root, relativePath), 'utf8')
}

function extractPolicyBlock(sql: string, action: 'alter' | 'create') {
  const startPattern = new RegExp(
    `${action}\\s+policy\\s+"profiles_update_own_or_admin"\\s+on\\s+public\\.profiles`,
    'i',
  )
  const start = sql.search(startPattern)

  assert.notEqual(start, -1, `${action} profiles_update_own_or_admin policy must exist`)

  const end = sql.indexOf(';', start)
  assert.notEqual(end, -1, `${action} profiles_update_own_or_admin policy must end with a semicolon`)

  return sql.slice(start, end + 1)
}

function extractParenthesizedClause(policy: string, clause: 'using' | 'with check') {
  const clausePattern = new RegExp(`${clause.replace(' ', '\\s+')}\\s*\\(`, 'i')
  const match = clausePattern.exec(policy)

  assert.ok(match, `${clause.toUpperCase()} clause must exist in the target policy`)

  const open = match.index + match[0].lastIndexOf('(')
  let depth = 0

  for (let index = open; index < policy.length; index += 1) {
    const character = policy[index]

    if (character === '(') depth += 1
    if (character === ')') depth -= 1

    if (depth === 0) {
      return policy.slice(open + 1, index)
    }
  }

  assert.fail(`${clause.toUpperCase()} clause must have balanced parentheses`)
}

function canonicalizeCondition(condition: string) {
  return condition.toLowerCase().replace(/\bselect\b/g, '').replace(/[\s()]/g, '')
}

function assertOwnershipAndAdminConditions(condition: string, label: string) {
  assert.match(condition, /auth\.uid\(\)\s*\)?\s*=\s*id/i, `${label} must enforce row ownership`)
  assert.match(condition, /public\.is_admin\(\)/i, `${label} must retain the admin condition`)
}

function findMatchingBrace(source: string, open: number) {
  let depth = 0
  let quote: "'" | '"' | '`' | null = null
  let escaped = false

  for (let index = open; index < source.length; index += 1) {
    const character = source[index]

    if (quote) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === quote) {
        quote = null
      }
      continue
    }

    if (character === "'" || character === '"' || character === '`') {
      quote = character
      continue
    }

    if (character === '{') depth += 1
    if (character === '}') depth -= 1

    if (depth === 0) return index
  }

  assert.fail('Profile upsert payload must have balanced braces')
}

function extractProfileUpsertPayloads(source: string) {
  const callPattern = /\.from\(\s*['"]profiles['"]\s*\)\s*\.upsert\s*\(/g
  const payloads: string[] = []

  for (const match of source.matchAll(callPattern)) {
    const open = source.indexOf('{', match.index + match[0].length)
    assert.notEqual(open, -1, 'Profile upsert must receive an object payload')

    const close = findMatchingBrace(source, open)
    payloads.push(source.slice(open, close + 1))
  }

  return payloads
}

const migrationNames = readdirSync(migrationsDirectory).filter((name) =>
  name.endsWith('_profiles_admin_escalation_fix.sql'),
)
assert.deepEqual(migrationNames, ['20260716084928_profiles_admin_escalation_fix.sql'])

const migration = readProjectFile(`supabase/migrations/${migrationNames[0]}`)
const schema = readFileSync(schemaPath, 'utf8')
const normalizedMigration = migration.toLowerCase()
const revokePattern =
  /revoke\s+update\s+on\s+table\s+public\.profiles\s+from\s+authenticated\s*;/i
const authenticatedProfileUpdateGrantPattern =
  /grant\s+(?:all(?:\s+privileges)?|[^;]*\bupdate(?:\s*\([^)]*\))?[^;]*)\s+on\s+(?:table\s+)?public\.profiles\s+to\s+[^;]*\bauthenticated\b\s*;/i

const beginIndex = normalizedMigration.indexOf('begin;')
const revokeIndex = normalizedMigration.search(revokePattern)
const policyIndex = normalizedMigration.search(
  /alter\s+policy\s+"profiles_update_own_or_admin"\s+on\s+public\.profiles/i,
)
const commitIndex = normalizedMigration.lastIndexOf('commit;')

assert.equal(beginIndex, normalizedMigration.search(/\S/))
assert.ok(beginIndex < revokeIndex)
assert.ok(revokeIndex < policyIndex)
assert.ok(policyIndex < commitIndex)
assert.match(migration, revokePattern)

const migrationPolicy = extractPolicyBlock(migration, 'alter')
assert.equal(
  (migration.match(/alter\s+policy\s+"profiles_update_own_or_admin"\s+on\s+public\.profiles/gi) ?? [])
    .length,
  1,
)
assert.match(migrationPolicy, /^alter\s+policy/i)
assert.match(migrationPolicy, /\bto\s+authenticated\b/i)
const migrationUsing = extractParenthesizedClause(migrationPolicy, 'using')
const migrationWithCheck = extractParenthesizedClause(migrationPolicy, 'with check')
assertOwnershipAndAdminConditions(migrationUsing, 'Migration USING')
assertOwnershipAndAdminConditions(migrationWithCheck, 'Migration WITH CHECK')
assert.equal(canonicalizeCondition(migrationUsing), canonicalizeCondition(migrationWithCheck))

assert.doesNotMatch(migration, /\bgrant\s+update\b/i)
assert.doesNotMatch(migration, /\bgrant\s+all\b/i)
assert.doesNotMatch(migration, /\bdisable\s+row\s+level\s+security\b/i)
assert.doesNotMatch(migration, /\bupdate\s+public\.profiles\b/i)
assert.doesNotMatch(migration, /\bdelete\s+from\s+public\.profiles\b/i)
assert.doesNotMatch(migration, /\btruncate\b/i)
assert.doesNotMatch(migration, /\bdrop\s+(?:table|schema)\b/i)

const schemaRevokeMatch = revokePattern.exec(schema)
assert.ok(schemaRevokeMatch, 'Schema must revoke authenticated UPDATE on profiles')
assert.doesNotMatch(schema.slice(schemaRevokeMatch.index + schemaRevokeMatch[0].length), authenticatedProfileUpdateGrantPattern)

const schemaPolicy = extractPolicyBlock(schema, 'create')
assert.equal(
  (schema.match(/create\s+policy\s+"profiles_update_own_or_admin"\s+on\s+public\.profiles/gi) ?? [])
    .length,
  1,
)
assert.match(schemaPolicy, /\bfor\s+update\b/i)
assert.match(schemaPolicy, /\bto\s+authenticated\b/i)
const schemaUsing = extractParenthesizedClause(schemaPolicy, 'using')
const schemaWithCheck = extractParenthesizedClause(schemaPolicy, 'with check')
assertOwnershipAndAdminConditions(schemaUsing, 'Schema USING')
assertOwnershipAndAdminConditions(schemaWithCheck, 'Schema WITH CHECK')
assert.equal(canonicalizeCondition(schemaUsing), canonicalizeCondition(schemaWithCheck))
assert.equal(canonicalizeCondition(schemaUsing), canonicalizeCondition(migrationUsing))

for (const sql of [migration, schema]) {
  assert.doesNotMatch(sql, /grant\s+update\s*\(\s*is_admin\s*\)/i)
  assert.doesNotMatch(sql, /grant\s+update\s+on\s+(?:table\s+)?public\.profiles\s+to\s+authenticated/i)
}

for (const relativePath of profileUpsertPaths) {
  const payloads = extractProfileUpsertPayloads(readProjectFile(relativePath))

  assert.equal(payloads.length, 1, `${relativePath} must have exactly one trusted profiles upsert`)
  assert.doesNotMatch(payloads[0], /\bis_admin\b/i, `${relativePath} must not synchronize is_admin`)
}

const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as {
  devDependencies?: Record<string, string>
}
const packageLock = JSON.parse(readFileSync(lockfilePath, 'utf8')) as {
  packages?: Record<string, { devDependencies?: Record<string, string>; version?: string; integrity?: string }>
}

assert.equal(packageJson.devDependencies?.supabase, '2.109.1')
assert.equal(packageLock.packages?.['']?.devDependencies?.supabase, '2.109.1')
assert.equal(packageLock.packages?.['node_modules/supabase']?.version, '2.109.1')
assert.ok(packageLock.packages?.['node_modules/supabase']?.integrity)

console.log('✓ 10 profiles admin escalation security contracts passed')
