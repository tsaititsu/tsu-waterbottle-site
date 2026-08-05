import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20260805025344_initialize_service_line_pay_checkout.sql',
)
const migration = readFileSync(migrationPath, 'utf8')

test('service LINE Pay initializer is one additive transaction', () => {
  assert.match(migration, /^--[\s\S]*?\nbegin;/i)
  assert.match(migration, /commit;\s*$/i)
  assert.doesNotMatch(migration, /\bdrop\s+(?:table|schema|column)\b/i)
  assert.doesNotMatch(migration, /\btruncate\b/i)
  assert.doesNotMatch(migration, /\bdelete\s+from\b/i)
  assert.doesNotMatch(migration, /\bdisable\s+row\s+level\s+security\b/i)
})

test('initializer accepts only the four approved owned service targets', () => {
  for (const source of [
    'ai_chart_report',
    'ai_divination',
    'booking',
    'course',
  ]) {
    assert.match(migration, new RegExp(`'${source}'`))
  }
  assert.doesNotMatch(migration, /'bank_transfer'|'webatm'|'newebpay_line_pay'/i)
  assert.match(migration, /source_type[\s\S]*?not in \([\s\S]*?'course'[\s\S]*?\)/i)
})

test('initializer binds an automatic LINE Pay aggregate without shipping fulfillment', () => {
  assert.match(migration, /insert into public\.payments[\s\S]*?'line_pay'/i)
  assert.match(migration, /insert into public\.line_pay_checkout_attempts/i)
  assert.match(migration, /insert into public\.line_pay_request_outbox/i)
  assert.match(migration, /insert into public\.line_pay_callback_capabilities/i)
  assert.match(migration, /'not_applicable'[\s\S]*?'none'/i)
  assert.match(migration, /payment\.amount_twd = product_order\.total_amount_twd/i)
  assert.match(migration, /payment\.amount_twd = attempt\.amount_twd/i)
})

test('runtime RPC is fail-closed and service-role only', () => {
  assert.match(
    migration,
    /revoke all on function public\.initialize_service_line_pay_checkout\(jsonb\)[\s\S]*?from public, anon, authenticated, line_pay_payment_executor;/i,
  )
  assert.match(
    migration,
    /grant execute on function public\.initialize_service_line_pay_checkout\(jsonb\)[\s\S]*?to service_role;/i,
  )
  assert.doesNotMatch(migration, /channel_secret|hash_key|hash_iv|service_role_key/i)
})

test('idempotency contract locks and validates the immutable checkout identity', () => {
  assert.match(migration, /pg_catalog\.pg_advisory_xact_lock/i)
  assert.match(migration, /line_pay_service_initialization_idempotency_conflict/i)
  for (const field of [
    'user_id',
    'item_type',
    'item_id',
    'booking_id',
    'amount_twd',
    'merchant_order_no',
    'request_body_sha256',
    'order_no',
  ]) {
    assert.match(migration, new RegExp(`v_existing\\.${field}`))
  }
})
