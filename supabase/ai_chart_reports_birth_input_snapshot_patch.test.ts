import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const migrationPath = join(process.cwd(), 'supabase/ai_chart_reports_birth_input_snapshot_patch.sql')
const schemaPath = join(process.cwd(), 'supabase/schema.sql')

assert.equal(existsSync(migrationPath), true)

const migration = readFileSync(migrationPath, 'utf8')
const schema = readFileSync(schemaPath, 'utf8')

assert.match(
  migration,
  /alter table public\.ai_chart_reports\s+add column if not exists birth_input_snapshot jsonb;/i,
)
assert.match(migration, /birth_input_snapshot is null/i)
assert.match(migration, /jsonb_typeof\(birth_input_snapshot\)\s*=\s*'object'/i)
assert.match(migration, /ai_chart_reports_birth_input_snapshot_object_check/i)
assert.match(migration, /create or replace function public\.prevent_ai_chart_report_birth_input_snapshot_change\(\)/i)
assert.match(migration, /old\.birth_input_snapshot is not null/i)
assert.match(
  migration,
  /new\.birth_input_snapshot is distinct from old\.birth_input_snapshot/i,
)
assert.match(migration, /create trigger prevent_ai_chart_report_birth_input_snapshot_change/i)
assert.match(migration, /before update of birth_input_snapshot on public\.ai_chart_reports/i)
assert.doesNotMatch(migration, /create\s+policy/i)
assert.doesNotMatch(migration, /grant\s+(?:insert|update)/i)

assert.match(
  schema,
  /create table if not exists public\.ai_chart_reports[\s\S]*?birth_input_snapshot jsonb,/i,
)
assert.match(
  schema,
  /alter table public\.ai_chart_reports\s+add column if not exists birth_input_snapshot jsonb;/i,
)

console.log('✓ AI chart birth input snapshot migration is additive, object-only, immutable, and server-only')
