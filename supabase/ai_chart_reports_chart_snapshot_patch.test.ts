import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const migrationPath = join(process.cwd(), 'supabase/ai_chart_reports_chart_snapshot_patch.sql')
const birthMigrationPath = join(process.cwd(), 'supabase/ai_chart_reports_birth_input_snapshot_patch.sql')
const schemaPath = join(process.cwd(), 'supabase/schema.sql')

assert.equal(existsSync(migrationPath), true)

const migration = readFileSync(migrationPath, 'utf8')
const birthMigration = readFileSync(birthMigrationPath, 'utf8')
const schema = readFileSync(schemaPath, 'utf8')

assert.match(migration, /草稿 migration：保存 AI 命盤 Server chart snapshot/)
assert.match(migration, /尚未在 production 執行/)
assert.match(
  migration,
  /alter table public\.ai_chart_reports\s+add column if not exists chart_snapshot jsonb;/i,
)
assert.doesNotMatch(migration, /chart_snapshot\s+jsonb\s+not\s+null/i)
assert.match(migration, /ai_chart_reports_chart_snapshot_object_check/i)
assert.match(migration, /chart_snapshot is null/i)
assert.match(migration, /jsonb_typeof\(chart_snapshot\)\s*=\s*'object'/i)
assert.match(migration, /ai_chart_reports_chart_snapshot_requires_birth_input_check/i)
assert.match(migration, /chart_snapshot is null\s+or birth_input_snapshot is not null/i)
assert.equal((migration.match(/from pg_constraint/gi) ?? []).length, 2)
assert.equal((migration.match(/conrelid = 'public\.ai_chart_reports'::regclass/gi) ?? []).length, 2)

assert.match(
  migration,
  /create or replace function public\.prevent_ai_chart_report_chart_snapshot_change\(\)/i,
)
assert.match(migration, /returns trigger/i)
assert.match(migration, /language plpgsql/i)
assert.match(migration, /set search_path = public/i)
assert.doesNotMatch(migration, /security\s+definer/i)
assert.match(migration, /old\.chart_snapshot is not null/i)
assert.match(migration, /new\.chart_snapshot is distinct from old\.chart_snapshot/i)
assert.match(migration, /raise exception 'ai_chart_report_chart_snapshot_immutable'/i)
assert.match(migration, /create trigger prevent_ai_chart_report_chart_snapshot_change/i)
assert.match(migration, /before update of chart_snapshot on public\.ai_chart_reports/i)
assert.match(migration, /for each row/i)
assert.doesNotMatch(migration, /create\s+(?:unique\s+)?index/i)
assert.doesNotMatch(migration, /create\s+policy/i)
assert.doesNotMatch(migration, /enable\s+row\s+level\s+security/i)
assert.doesNotMatch(migration, /prevent_ai_chart_report_birth_input_snapshot_change/i)

assert.match(
  schema,
  /create table if not exists public\.ai_chart_reports[\s\S]*?chart_snapshot jsonb,/i,
)
assert.match(
  schema,
  /alter table public\.ai_chart_reports\s+add column if not exists chart_snapshot jsonb;/i,
)
assert.match(schema, /ai_chart_reports_chart_snapshot_object_check/i)
assert.match(schema, /ai_chart_reports_chart_snapshot_requires_birth_input_check/i)
assert.match(schema, /public\.prevent_ai_chart_report_chart_snapshot_change\(\)/i)
assert.match(schema, /before update of chart_snapshot on public\.ai_chart_reports/i)

assert.match(birthMigration, /create trigger prevent_ai_chart_report_birth_input_snapshot_change/i)
assert.match(birthMigration, /before update of birth_input_snapshot on public\.ai_chart_reports/i)

console.log('✓ AI chart snapshot migration source is additive, nullable, constrained, and immutable')
