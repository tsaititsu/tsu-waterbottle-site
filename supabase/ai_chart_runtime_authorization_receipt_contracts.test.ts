import assert from 'node:assert/strict'
import {
  existsSync,
  readFileSync,
} from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const migrationPath = join(
  root,
  'supabase/migrations/20260729120000_ai_chart_runtime_authorization_receipts.sql',
)

function readMigration(): string {
  assert.equal(
    existsSync(migrationPath),
    true,
    'authorization receipt Migration source must exist',
  )
  return readFileSync(migrationPath, 'utf8')
}

test('authorization receipt Migration is one additive transaction without destructive data operations', () => {
  const migration = readMigration()
  const normalized = migration.toLowerCase()

  assert.equal(
    (normalized.match(/^begin;$/gmu) ?? [])
      .length,
    1,
  )
  assert.equal(
    (normalized.match(/^commit;$/gmu) ?? [])
      .length,
    1,
  )
  assert.doesNotMatch(
    migration,
    /\bdrop\s+(?:table|schema|column|function|role)\b/iu,
  )
  assert.doesNotMatch(
    migration,
    /\btruncate\b/iu,
  )
  assert.doesNotMatch(
    migration,
    /\bdelete\s+from\b/iu,
  )
  assert.doesNotMatch(
    migration,
    /\balter\s+table\s+public\./iu,
  )
})

test('private table contains exactly the normalized 21-column receipt with two fixed unique keys', () => {
  const migration = readMigration()
  const tableMatch = migration.match(
    /create\s+table\s+ai_chart_private\.runtime_activation_authorization_receipts\s*\(([\s\S]*?)\n\);/iu,
  )
  assert.ok(tableMatch)
  const table = tableMatch[1]
  const requiredColumns = [
    'receipt_contract_version',
    'receipt_task',
    'authorization_status',
    'source_contract_version',
    'source_contract_fingerprint',
    'authorization_port_contract_version',
    'authorization_port_contract_fingerprint',
    'transport_contract_version',
    'transport_contract_fingerprint',
    'authorization_command_contract_version',
    'authorization_command_task',
    'authorization_scope',
    'feature',
    'release_commit_sha',
    'migration_version',
    'migration_sha256',
    'migration_readiness_fingerprint',
    'runtime_activation_policy_version',
    'authorization_command_fingerprint',
    'replay_key_fingerprint',
    'receipt_fingerprint',
  ]

  for (const column of requiredColumns) {
    assert.match(
      table,
      new RegExp(
        `\\b${column}\\s+text\\s+not\\s+null\\b`,
        'iu',
      ),
    )
  }
  assert.equal(
    (
      table.match(
        /^\s{2}[a-z0-9_]+\s+text\s+not\s+null\b/gmu,
      ) ?? []
    ).length,
    21,
  )
  assert.doesNotMatch(
    table,
    /\b(?:id|created_at|updated_at|jsonb|timestamp|timestamptz)\b/iu,
  )
  assert.match(
    table,
    /primary\s+key\s*\(\s*authorization_command_fingerprint\s*\)/iu,
  )
  assert.match(
    table,
    /unique\s*\(\s*replay_key_fingerprint\s*\)/iu,
  )
})

test('private schema and append-only table use a non-login owner, forced RLS, and no direct caller privilege', () => {
  const migration = readMigration()

  assert.match(
    migration,
    /create\s+role\s+ai_chart_runtime_authorization_receipt_owner\s+nologin\s+noinherit\s+nosuperuser\s+nocreatedb\s+nocreaterole\s+noreplication\s+nobypassrls/iu,
  )
  assert.match(
    migration,
    /create\s+schema\s+ai_chart_private\s+authorization\s+ai_chart_runtime_authorization_receipt_owner/iu,
  )
  assert.match(
    migration,
    /enable\s+row\s+level\s+security/iu,
  )
  assert.match(
    migration,
    /force\s+row\s+level\s+security/iu,
  )
  assert.match(
    migration,
    /create\s+policy\s+runtime_activation_authorization_receipts_owner_only[\s\S]*?to\s+ai_chart_runtime_authorization_receipt_owner/iu,
  )
  assert.match(
    migration,
    /revoke\s+all\s+privileges\s+on\s+table\s+ai_chart_private\.runtime_activation_authorization_receipts\s+from\s+public,\s*anon,\s*authenticated,\s*service_role/iu,
  )
  assert.match(
    migration,
    /before\s+update\s+or\s+delete\s+on\s+ai_chart_private\.runtime_activation_authorization_receipts/iu,
  )
})

test('three fixed SECURITY DEFINER RPCs have empty search paths and service-role-only execution', () => {
  const migration = readMigration()
  const rpcNames = [
    'create_or_read_ai_chart_runtime_authorization_receipt',
    'reconcile_ai_chart_runtime_authorization_receipt',
    'read_ai_chart_runtime_authorization_receipt',
  ]

  for (const rpcName of rpcNames) {
    assert.match(
      migration,
      new RegExp(
        `create\\s+or\\s+replace\\s+function\\s+public\\.${rpcName}\\s*\\(`,
        'iu',
      ),
    )
    assert.match(
      migration,
      new RegExp(
        `function\\s+public\\.${rpcName}\\s*\\([\\s\\S]*?security\\s+definer[\\s\\S]*?set\\s+search_path\\s*=\\s*''`,
        'iu',
      ),
    )
    assert.match(
      migration,
      new RegExp(
        `grant\\s+execute\\s+on\\s+function\\s+public\\.${rpcName}\\s*\\([\\s\\S]*?\\)\\s+to\\s+service_role`,
        'iu',
      ),
    )
  }
  assert.doesNotMatch(
    migration,
    /grant\s+execute[\s\S]*?\s+to\s+(?:public|anon|authenticated)\s*;/iu,
  )
})

test('atomic create serializes both absent keys and inserts or returns only an exact existing receipt', () => {
  const migration = readMigration()
  const start = migration.search(
    /create\s+or\s+replace\s+function\s+public\.create_or_read_ai_chart_runtime_authorization_receipt\s*\(/iu,
  )
  const end = migration.search(
    /create\s+or\s+replace\s+function\s+public\.reconcile_ai_chart_runtime_authorization_receipt\s*\(/iu,
  )
  assert.ok(start >= 0)
  assert.ok(end > start)
  const body = migration.slice(start, end)

  assert.match(
    body,
    /pg_catalog\.pg_advisory_xact_lock/iu,
  )
  assert.match(
    body,
    /authorization_command_fingerprint\s*=\s*p_authorization_command_fingerprint[\s\S]*?or\s+receipt\.replay_key_fingerprint\s*=\s*p_replay_key_fingerprint/iu,
  )
  assert.match(
    body,
    /insert\s+into\s+ai_chart_private\.runtime_activation_authorization_receipts/iu,
  )
  assert.match(
    body,
    /v_existing\s+is\s+distinct\s+from\s+v_expected/iu,
  )
  assert.match(body, /'CREATED'::text/iu)
  assert.match(
    body,
    /'EXISTING_EXACT'::text/iu,
  )
  assert.doesNotMatch(body, /\bupdate\b/iu)
  assert.doesNotMatch(body, /\bdelete\b/iu)
})

test('reconciliation is one read-only both-key check and Runtime read uses only command fingerprint', () => {
  const migration = readMigration()
  const reconcileStart = migration.search(
    /create\s+or\s+replace\s+function\s+public\.reconcile_ai_chart_runtime_authorization_receipt\s*\(/iu,
  )
  const readStart = migration.search(
    /create\s+or\s+replace\s+function\s+public\.read_ai_chart_runtime_authorization_receipt\s*\(/iu,
  )
  assert.ok(reconcileStart >= 0)
  assert.ok(readStart > reconcileStart)
  const reconciliation = migration.slice(
    reconcileStart,
    readStart,
  )
  const runtimeRead = migration.slice(
    readStart,
    migration.lastIndexOf('commit;'),
  )

  assert.match(
    reconciliation,
    /authorization_command_fingerprint\s*=\s*p_authorization_command_fingerprint/iu,
  )
  assert.match(
    reconciliation,
    /replay_key_fingerprint\s*=\s*p_replay_key_fingerprint/iu,
  )
  assert.match(
    reconciliation,
    /'RECONCILED_EXACT'::text/iu,
  )
  assert.doesNotMatch(
    reconciliation,
    /\b(?:insert\s+into|update|delete)\b/iu,
  )
  assert.match(
    runtimeRead,
    /where\s+receipt\.authorization_command_fingerprint\s*=\s*p_authorization_command_fingerprint/iu,
  )
  assert.match(
    runtimeRead,
    /'READ_EXACT'::text/iu,
  )
  assert.doesNotMatch(
    runtimeRead,
    /\b(?:insert\s+into|update|delete)\b/iu,
  )
})

test('Migration stores no token, reviewer, approval proof, provider payload, report, chart, or birth data', () => {
  const migration = readMigration()
  const tableMatch = migration.match(
    /create\s+table\s+ai_chart_private\.runtime_activation_authorization_receipts\s*\(([\s\S]*?)\n\);/iu,
  )
  assert.ok(tableMatch)
  const table = tableMatch[1]
  const columnDeclarations =
    table.match(
      /^\s{2}([a-z0-9_]+)\s+text\s+not\s+null\b/gmu,
    ) ?? []
  const columnNames = columnDeclarations.map((line) =>
    line
      .trim()
      .split(/\s+/u)[0],
  )

  for (const forbidden of [
    'token',
    'reviewer',
    'approval',
    'provider',
    'message',
    'report_id',
    'user_id',
    'chart',
    'birth',
    'json',
  ]) {
    for (const columnName of columnNames) {
      assert.doesNotMatch(
        columnName,
        new RegExp(forbidden, 'iu'),
      )
    }
  }
})
