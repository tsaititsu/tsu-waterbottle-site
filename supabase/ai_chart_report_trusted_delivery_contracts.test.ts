import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const migrationPath = join(
  root,
  'supabase/migrations/20260728120000_ai_chart_report_trusted_delivery_contracts.sql',
)

test('trusted delivery migration is one additive transaction with no destructive data operation', () => {
  assert.equal(existsSync(migrationPath), true)

  const migration = readFileSync(migrationPath, 'utf8')
  const normalized = migration.toLowerCase()

  assert.equal((normalized.match(/^begin;$/gm) ?? []).length, 1)
  assert.equal((normalized.match(/^commit;$/gm) ?? []).length, 1)
  assert.doesNotMatch(migration, /\bdrop\s+(?:table|schema|column)\b/i)
  assert.doesNotMatch(migration, /\btruncate\b/i)
  assert.doesNotMatch(migration, /\bdelete\s+from\b/i)
  assert.doesNotMatch(migration, /\bcreate\s+policy\b/i)
  assert.doesNotMatch(migration, /\bdisable\s+row\s+level\s+security\b/i)
})

test('durable review ledger is append-only, exact-bound, and unavailable through direct Data API writes', () => {
  const migration = readFileSync(migrationPath, 'utf8')

  assert.match(
    migration,
    /create\s+table\s+public\.ai_chart_report_review_ledger\s*\(/i,
  )
  for (const requiredColumn of [
    'report_id',
    'reviewer_id',
    'decision',
    'record_payload',
    'record_payload_sha256',
    'record_fingerprint',
    'envelope_fingerprint',
    'report_snapshot_sha256',
    'gate_fingerprint',
    'ledger_receipt_fingerprint',
  ]) {
    assert.match(
      migration,
      new RegExp(`\\b${requiredColumn}\\b`, 'i'),
      `${requiredColumn} must be durable`,
    )
  }

  assert.match(
    migration,
    /unique\s*\(\s*report_id\s*,\s*gate_fingerprint\s*\)/i,
  )
  assert.match(migration, /unique\s*\(\s*record_fingerprint\s*\)/i)
  assert.match(
    migration,
    /decision\s+text\s+not\s+null[\s\S]*?check\s*\(\s*decision\s+in\s*\(\s*'APPROVED',\s*'REPAIR_REQUIRED',\s*'REJECTED'\s*\)\s*\)/i,
  )
  assert.match(
    migration,
    /before\s+update\s+or\s+delete\s+on\s+public\.ai_chart_report_review_ledger/i,
  )
  assert.match(
    migration,
    /alter\s+table\s+public\.ai_chart_report_review_ledger\s+enable\s+row\s+level\s+security/i,
  )
  assert.match(
    migration,
    /revoke\s+all\s+privileges\s+on\s+table\s+public\.ai_chart_report_review_ledger\s+from\s+public,\s*anon,\s*authenticated,\s*service_role/i,
  )
})

test('delivery receipt stores safe bindings and never stores a second report body', () => {
  const migration = readFileSync(migrationPath, 'utf8')
  const tableMatch = migration.match(
    /create\s+table\s+public\.ai_chart_report_deliveries\s*\(([\s\S]*?)\n\);/i,
  )

  assert.ok(tableMatch, 'delivery table must exist')
  const tableDefinition = tableMatch[1]

  for (const requiredColumn of [
    'report_id',
    'review_ledger_id',
    'idempotency_key',
    'contract_fingerprint',
    'source_coordination_fingerprint',
    'report_snapshot_sha256',
    'artifact_payload_sha256',
    'report_content_sha256',
    'delivery_claim_fingerprint',
    'delivery_receipt_fingerprint',
    'claimed_at',
    'published_at',
  ]) {
    assert.match(
      tableDefinition,
      new RegExp(`\\b${requiredColumn}\\b`, 'i'),
      `${requiredColumn} must be part of the receipt`,
    )
  }

  assert.doesNotMatch(tableDefinition, /\breport_content\b/i)
  assert.match(tableDefinition, /report_id\s+uuid\s+not\s+null\s+unique/i)
  assert.match(tableDefinition, /idempotency_key\s+text\s+not\s+null\s+unique/i)
  assert.match(
    migration,
    /before\s+update\s+or\s+delete\s+on\s+public\.ai_chart_report_deliveries/i,
  )
  assert.match(
    migration,
    /alter\s+table\s+public\.ai_chart_report_deliveries\s+enable\s+row\s+level\s+security/i,
  )
  assert.match(
    migration,
    /revoke\s+all\s+privileges\s+on\s+table\s+public\.ai_chart_report_deliveries\s+from\s+public,\s*anon,\s*authenticated,\s*service_role/i,
  )
})

test('one service-role RPC validates ledger, claims the locked report, publishes content, and returns safe receipts atomically', () => {
  const migration = readFileSync(migrationPath, 'utf8')
  const functionStart = migration.search(
    /create\s+or\s+replace\s+function\s+public\.deliver_ai_chart_report_after_review\s*\(/i,
  )
  const functionEnd = migration.search(
    /revoke\s+all\s+on\s+function\s+public\.deliver_ai_chart_report_after_review\s*\(/i,
  )

  assert.ok(functionStart >= 0, 'delivery function must exist')
  assert.ok(functionEnd > functionStart, 'delivery function must end before grants')

  const body = migration.slice(functionStart, functionEnd)
  const ledgerWrite = body.search(
    /insert\s+into\s+public\.ai_chart_report_review_ledger/i,
  )
  const reportWrite = body.search(
    /update\s+public\.ai_chart_reports/i,
  )
  const receiptWrite = body.search(
    /insert\s+into\s+public\.ai_chart_report_deliveries/i,
  )

  assert.match(body, /language\s+plpgsql/i)
  assert.match(body, /security\s+definer/i)
  assert.match(body, /set\s+search_path\s*=\s*''/i)
  assert.match(
    body,
    /from\s+public\.ai_chart_reports[\s\S]*?where\s+id\s*=\s*p_report_id[\s\S]*?for\s+update/i,
  )
  assert.match(body, /user_id\s+is\s+distinct\s+from\s+p_expected_owner_user_id/i)
  assert.match(body, /payment_status\s+is\s+distinct\s+from\s+'paid'/i)
  assert.match(body, /status\s+is\s+distinct\s+from\s+'pending'/i)
  assert.match(body, /chart_snapshot\s+is\s+null/i)
  assert.match(
    body,
    /chart_snapshot_sha256\s+is\s+null[\s\S]+chart_snapshot_sha256[\s\S]+is\s+distinct\s+from\s+p_report_snapshot_sha256/i,
  )
  assert.match(
    body,
    /message\s*=\s*'ai_chart_report_delivery_snapshot_mismatch'/i,
  )
  assert.match(body, /report_content\s+is\s+not\s+null/i)
  assert.match(body, /pg_catalog\.btrim\s*\(\s*v_report\.report_content\s*\)\s*<>\s*''/i)
  assert.ok(ledgerWrite >= 0, 'review ledger must be ensured')
  assert.ok(reportWrite > ledgerWrite, 'ledger must precede Report mutation')
  assert.ok(receiptWrite > reportWrite, 'receipt must follow Report publication')
  assert.match(
    body,
    /status\s*=\s*'completed'[\s\S]*?report_content\s*=\s*p_report_content[\s\S]*?completed_at\s*=\s*v_now/i,
  )
  assert.match(body, /'EXISTING_EXACT_MATCH'::text/i)
  assert.match(body, /'PUBLISHED'::text/i)
  assert.doesNotMatch(body, /\bcommit\b/i)
  assert.doesNotMatch(body, /\brollback\b/i)
})

test('RPC validates exact approved metadata and exposes execution only to service_role', () => {
  const migration = readFileSync(migrationPath, 'utf8')

  assert.match(
    migration,
    /v_review_record\s*:=\s*p_review_record::jsonb/i,
  )
  assert.match(
    migration,
    /jsonb_typeof\(v_review_record\)\s*<>\s*'object'/i,
  )
  assert.match(
    migration,
    /v_review_record\s*->>\s*'decision'\s+is\s+distinct\s+from\s+'APPROVED'/i,
  )
  assert.match(
    migration,
    /v_review_record\s*->\s*'issueCodes'\s+is\s+distinct\s+from\s+'\[\]'::jsonb/i,
  )
  assert.match(
    migration,
    /v_review_record\s*->>\s*'reportSnapshotSha256'\s+is\s+distinct\s+from\s+p_report_snapshot_sha256/i,
  )
  assert.match(
    migration,
    /v_review_record\s*->>\s*'recordFingerprint'\s+is\s+distinct\s+from\s+p_record_fingerprint/i,
  )
  assert.match(migration, /jsonb_object_keys\(v_review_record\)/i)
  assert.match(
    migration,
    /pg_catalog\.count\(\*\)[\s\S]*?pg_catalog\.bool_and\(\s*keys\.key\s*=\s*any\s*\(\s*v_expected_review_record_keys\s*\)\s*\)/i,
  )
  assert.match(migration, /v_review_record_key_count\s*<>\s*23/i)
  assert.match(migration, /not\s+v_review_record_keys_allowed/i)
  assert.match(
    migration,
    /v_actual_record_payload_sha256\s+is\s+distinct\s+from\s+p_record_payload_sha256/i,
  )
  assert.match(
    migration,
    /ai_chart_report_delivery_review_record_hash_mismatch/i,
  )
  assert.match(
    migration,
    /v_actual_report_content_sha256\s+is\s+distinct\s+from\s+p_report_content_sha256/i,
  )
  assert.match(migration, /ai_chart_report_delivery_review_record_invalid/i)

  assert.match(
    migration,
    /revoke\s+all\s+on\s+function\s+public\.deliver_ai_chart_report_after_review\([\s\S]*?\)\s+from\s+public,\s*anon,\s*authenticated,\s*service_role/i,
  )
  assert.match(
    migration,
    /grant\s+execute\s+on\s+function\s+public\.deliver_ai_chart_report_after_review\([\s\S]*?\)\s+to\s+service_role/i,
  )
  assert.doesNotMatch(
    migration,
    /grant\s+execute\s+on\s+function\s+public\.deliver_ai_chart_report_after_review\([\s\S]*?\)\s+to\s+(?:anon|authenticated|public)/i,
  )
})
