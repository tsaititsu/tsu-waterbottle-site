import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260805125532_initialize_product_order_line_pay_one_dollar_entry_test_checkout.sql',
  ),
  'utf8',
)

test('Production cart NT$1 initializer is service-role only and atomically non-fulfillable', () => {
  assert.match(
    migration,
    /create or replace function public\.initialize_line_pay_one_dollar_product_order_test\(\s*p_payload jsonb\s*\)/,
  )
  assert.match(migration, /security invoker/)
  assert.match(
    migration,
    /create or replace function line_pay_private\.lock_line_pay_one_dollar_product_order_test[\s\S]*security definer[\s\S]*set search_path = ''/,
  )
  assert.match(migration, /set search_path = ''/)
  assert.match(
    migration,
    /public\.initialize_product_order_line_pay_checkout\(p_payload\)/,
  )
  assert.match(migration, /fulfillment_mode = 'none'/)
  assert.match(migration, /shipping_status = 'not_applicable'/)
  assert.match(migration, /delete from public\.product_shipping_info/)
  assert.match(
    migration,
    /revoke all on function public\.initialize_line_pay_one_dollar_product_order_test\(jsonb\)[\s\S]*from public, anon, authenticated, line_pay_payment_executor/,
  )
  assert.match(
    migration,
    /grant execute on function public\.initialize_line_pay_one_dollar_product_order_test\(jsonb\)[\s\S]*to service_role/,
  )
})
