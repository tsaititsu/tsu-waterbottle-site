import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const oldMigrationPath = join(
  root,
  'supabase/migrations/20260722065311_retire_bank_transfer_submissions_writes.sql',
)
const remediationMigrationPath = join(
  root,
  'supabase/migrations/20260723082100_bank_transfer_submissions_readonly_fence_remediation.sql',
)
const migrationNames = readdirSync(join(root, 'supabase/migrations')).filter((name) =>
  name.endsWith('_retire_bank_transfer_submissions_writes.sql'),
)

assert.deepEqual(migrationNames, ['20260722065311_retire_bank_transfer_submissions_writes.sql'])

const oldMigration = readFileSync(oldMigrationPath, 'utf8')
const migration = existsSync(remediationMigrationPath)
  ? readFileSync(remediationMigrationPath, 'utf8')
  : ''
const normalized = migration.toLowerCase()
const runner = readFileSync(
  join(root, 'supabase/tests/run_bank_transfer_submissions_readonly_fence.mjs'),
  'utf8',
)
const linePayMutationRunner = readFileSync(
  join(root, 'supabase/tests/run_line_pay_remediation_mutations.mjs'),
  'utf8',
)

test('remediation is a new additive migration and the merged migration stays byte-identical', () => {
  assert.equal(existsSync(remediationMigrationPath), true, 'remediation migration must exist')
  assert.equal(
    createHash('sha256').update(oldMigration).digest('hex'),
    '2f43979b1f4ff88243296f0a389c146b879652715d40d23bdb7ce1d6785407d7',
  )
})

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
    /acl\.grantee\s*<>\s*relation\.relowner[\s\S]*?acl\.grantee\s*<>\s*0[\s\S]*?coalesce\(grantee\.rolname,\s*''\)\s+not\s+in\s*\(\s*'anon',\s*'authenticated',\s*'service_role'\s*\)/i,
  )
  assert.doesNotMatch(
    migration,
    /coalesce\(grantee\.rolname,\s*''\)\s+not\s+in\s*\(\s*'anon',\s*'authenticated',\s*'service_role'\s*\)[\s\S]{0,160}?acl\.privilege_type\s+in/i,
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

test('migration locks and revalidates the exact relation identity before named operations', () => {
  assert.match(
    migration,
    /set_config\(\s*'bank_transfer_submissions_readonly_fence\.relation_oid'/i,
  )
  assert.match(
    migration,
    /lock\s+table\s+public\.bank_transfer_submissions\s+in\s+access\s+exclusive\s+mode/i,
  )
  assert.match(migration, /relation_identity_changed/i)
  assert.match(
    migration,
    /current_setting\(\s*'bank_transfer_submissions_readonly_fence\.relation_oid'/i,
  )
})

test('migration validates canonical ACL grantors as well as grantees and privileges', () => {
  assert.match(migration, /acl\.grantor\s*<>\s*relation\.relowner/i)
  assert.match(migration, /unexpected_acl_grantor/i)
})

test('PostgreSQL runner enforces complete scenarios, mutations, process bounds, and cleanup', () => {
  for (const marker of [
    'assertLockTimeoutRollback',
    'assertSecondRunBehavior',
    'applyOldFenceThenRemediation',
    'assertRelationIdentityMismatch',
    'assertConcurrentRelationReplacement',
    'runFenceMutationMatrix',
    'MUTATION_TOTAL',
    'MUTATION_CAUGHT',
    'MUTATION_UNCAUGHT',
    'MUTATION_INFRASTRUCTURE_FAILURES',
    'MUTATION_HARNESS_CHECKS',
    'runUnknownAclFixtureMutationMatrix',
    'unknown role SELECT',
    'unknown role SELECT WITH GRANT OPTION',
    'unknown role REFERENCES',
    'unknown role TRIGGER',
    'unknown role MAINTAIN',
    'authenticated SELECT WITH GRANT OPTION',
    'service_role SELECT WITH GRANT OPTION',
    'cleanup task-owned Docker resources',
  ]) {
    assert.match(runner, new RegExp(marker))
  }

  assert.match(runner, /const PROCESS_TIMEOUT_MS\s*=/)
  assert.match(runner, /timeout:\s*options\.timeout\s*\?\?\s*PROCESS_TIMEOUT_MS/)
  assert.match(runner, /maxBuffer:\s*MAX_PROCESS_OUTPUT_BYTES/)
  assert.match(runner, /result\.signal/)
  assert.match(runner, /snapshotHistoricalState/)
  assert.match(runner, /primary key/i)
  assert.match(runner, /acl\.grantor/i)
})

test('LINE Pay mutation runner rejects markerless and infrastructure process failures', () => {
  for (const marker of [
    'classifyMutationExecution',
    'assertMutationClassifierHarness',
    'expectedMarkers',
    'expectedMarkersByScenario',
    'INVALID_MUTATION_CATCH_REASON',
    'LINE_PAY_MUTATION_HARNESS_CHECKS',
    'result.error',
    'result.signal',
    'Number.isInteger(result.status)',
    'MUTATION_ANCHOR_NOT_FOUND',
    'UNKNOWN_LINE_PAY_MUTATION_SCENARIO',
    'LOCAL_DB_RUNTIME_UNAVAILABLE',
    'POSTGRES_IMAGE_REPOSITORY_DIGEST_MISMATCH',
    'POSTGRES_IMAGE_MAJOR_VERSION_MISMATCH',
    'TLS handshake timeout',
    'context deadline exceeded',
    'network is unreachable',
    'JavaScript syntax error',
    'SQL syntax error',
  ]) {
    assert.ok(
      linePayMutationRunner.includes(marker),
      `LINE Pay mutation oracle must enforce ${marker}`,
    )
  }

  assert.doesNotMatch(
    linePayMutationRunner,
    /if\s*\(result\.status\s*===\s*0\)\s*\{\s*mutationWasCaught\s*=\s*false/,
  )
})

test('LINE Pay mutation runner scopes audit atomicity and enforces a reachable child timeout', () => {
  assert.match(linePayMutationRunner, /const MUTATION_CHILD_TIMEOUT_MS\s*=/)
  assert.match(linePayMutationRunner, /timeout:\s*MUTATION_CHILD_TIMEOUT_MS/)
  assert.match(linePayMutationRunner, /assertMutationProcessHarness/)
  assert.match(linePayMutationRunner, /LINE_PAY_MUTATION_PROCESS_HARNESS_CHECKS/)
  assert.match(
    linePayMutationRunner,
    /replaceInFunction\(\s*input,\s*'complete_product_order_line_pay_confirmation'/,
  )
  assert.match(linePayMutationRunner, /line_pay_completion_proof_contract_mismatch/)
  assert.match(linePayMutationRunner, /is not a known variable/)
  assert.doesNotMatch(
    linePayMutationRunner,
    /expectedMarkers:\s*\['"v_audit_event_id" is not a known variable'\]/,
  )
})
