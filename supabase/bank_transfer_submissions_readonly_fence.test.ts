import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const migrationNames = readdirSync(join(root, 'supabase/migrations')).filter((name) =>
  name.endsWith('_retire_bank_transfer_submissions_writes.sql'),
)

assert.deepEqual(migrationNames, ['20260722065311_retire_bank_transfer_submissions_writes.sql'])

const migration = readFileSync(join(root, 'supabase/migrations', migrationNames[0]), 'utf8')
const normalized = migration.toLowerCase()

test('migration is additive and leaves historical rows and schemas untouched', () => {
  assert.equal((normalized.match(/^begin;$/gm) ?? []).length, 1)
  assert.equal((normalized.match(/^commit;$/gm) ?? []).length, 1)
  assert.doesNotMatch(migration, /\bdrop\s+(?:table|schema|column)\b/i)
  assert.doesNotMatch(migration, /\btruncate\s+(?:table\s+)?(?:only\s+)?[a-z_"]/i)
  assert.doesNotMatch(migration, /\bdelete\s+from\b/i)
  assert.doesNotMatch(migration, /\binsert\s+into\b/i)
  assert.doesNotMatch(migration, /\bupdate\s+public\./i)
  assert.doesNotMatch(migration, /\bpayment_attempts?\b/i)
  assert.doesNotMatch(migration, /\bcommerce_orders?\b/i)
  assert.doesNotMatch(migration, /\bproduct_orders?\b/i)
  assert.doesNotMatch(migration, /\bpayments?\b/i)
  assert.doesNotMatch(migration, /https?:\/\//i)
})

test('migration revokes the complete runtime privilege surface before granting read-only access', () => {
  assert.match(
    migration,
    /revoke\s+all\s+privileges\s+on\s+table\s+public\.bank_transfer_submissions\s+from\s+public,\s*anon,\s*authenticated,\s*service_role/i,
  )
  assert.match(
    migration,
    /grant\s+select\s+on\s+table\s+public\.bank_transfer_submissions\s+to\s+authenticated,\s*service_role/i,
  )

  for (const privilege of [
    'SELECT',
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'REFERENCES',
    'TRIGGER',
    'MAINTAIN',
  ]) {
    assert.ok(migration.includes(`'${privilege}'`), `${privilege} must be verified explicitly`)
  }

  assert.match(migration, /has_table_privilege/i)
  assert.match(migration, /pg_catalog\.aclexplode/i)
  assert.match(migration, /pg_catalog\.acldefault\('r',\s*relation\.relowner\)/i)
  assert.match(migration, /acl\.grantee\s*=\s*0/i)
  assert.match(migration, /acl\.grantee\s*<>\s*relation\.relowner/i)
  assert.match(
    migration,
    /acl\.privilege_type\s+in\s*\(\s*'INSERT',\s*'UPDATE',\s*'DELETE',\s*'TRUNCATE'\s*\)/i,
  )
  assert.match(migration, /catalog_acl_mismatch/i)
  assert.match(migration, /catalog_select_acl_mismatch/i)
  assert.match(migration, /privilege_mismatch/i)
})

test('migration removes the write policy and installs one exact owner-scoped read policy', () => {
  assert.match(
    migration,
    /drop\s+policy\s+if\s+exists\s+"Users can insert own bank transfer submissions"\s+on\s+public\.bank_transfer_submissions/i,
  )
  assert.match(
    migration,
    /drop\s+policy\s+if\s+exists\s+"Users can read own bank transfer submissions"\s+on\s+public\.bank_transfer_submissions/i,
  )
  assert.match(
    migration,
    /create\s+policy\s+"Users can read own bank transfer submissions"[\s\S]*?for\s+select[\s\S]*?to\s+authenticated[\s\S]*?using\s*\(\(select\s+auth\.uid\(\)\)\s*=\s*user_id\)/i,
  )
  assert.match(migration, /v_policy_count\s*<>\s*1/i)
  assert.match(migration, /from\s+pg_catalog\.pg_policy\s+as\s+policy/i)
  assert.match(
    migration,
    /pg_catalog\.pg_get_expr\(\s*policy\.polqual,\s*policy\.polrelid,\s*false\s*\)\s*=\s*'\(\(\sSELECT auth\.uid\(\) AS uid\) = user_id\)'/i,
  )
  assert.match(migration, /policy\.polroles\s*=\s*array\[v_authenticated_oid\]::oid\[\]/i)
  assert.match(migration, /policy\.polwithcheck\s+is\s+null/i)
  assert.doesNotMatch(migration, /create\s+policy[\s\S]*?for\s+(?:insert|update|delete)/i)
})

test('migration keeps RLS enabled and records the legacy read-only purpose', () => {
  assert.match(
    migration,
    /alter\s+table\s+public\.bank_transfer_submissions\s+enable\s+row\s+level\s+security/i,
  )
  assert.match(migration, /relation\.relrowsecurity/i)
  assert.match(
    migration,
    /Legacy bank transfer history\. New writes are retired\./,
  )
})

test('migration fails closed on missing or unexpected relation metadata', () => {
  assert.match(migration, /to_regclass\('public\.bank_transfer_submissions'\)/i)
  assert.match(migration, /relation_missing/i)
  assert.match(migration, /unexpected_relation_kind/i)
  assert.match(migration, /user_id_missing/i)
  assert.match(migration, /set\s+local\s+lock_timeout\s*=\s*'5s'/i)
  assert.match(migration, /set\s+local\s+statement_timeout\s*=\s*'30s'/i)
})
