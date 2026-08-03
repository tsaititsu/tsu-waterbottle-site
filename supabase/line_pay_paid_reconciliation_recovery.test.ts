import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const migration = readFileSync(
  new URL(
    './migrations/20260803193000_line_pay_paid_reconciliation_recovery.sql',
    import.meta.url,
  ),
  'utf8',
)

test('repairs the completion proof owner drift without rewriting applied migrations', () => {
  assert.match(migration, /^begin;/)
  assert.match(migration, /commit;\s*$/)
  assert.match(
    migration,
    /alter table line_pay_private\.line_pay_completion_proofs\s+owner to line_pay_payment_function_owner/i,
  )
  assert.match(
    migration,
    /alter function line_pay_private\.line_pay_enforce_completion_proof\(\)\s+owner to line_pay_payment_function_owner/i,
  )
  assert.doesNotMatch(migration, /\bdrop\s+(?:table|schema|column)\b/i)
  assert.doesNotMatch(migration, /\b(?:delete\s+from|truncate)\b/i)
})

test('exposes one sandbox-only atomic paid reconciliation recovery RPC', () => {
  assert.match(
    migration,
    /create function public\.recover_product_order_line_pay_confirmation\s*\(/i,
  )
  assert.match(migration, /p_environment\s*<>\s*'sandbox'/i)
  assert.match(migration, /security definer[\s\S]*?set search_path\s*=\s*''/i)
  assert.match(
    migration,
    /from public\.complete_product_order_line_pay_confirmation\s*\(/i,
  )
  assert.match(migration, /for update/g)
  assert.match(migration, /get diagnostics v_row_count = row_count/g)
  assert.match(migration, /line_pay_paid_recovery_payment_zero_rows/)
  assert.match(migration, /line_pay_paid_recovery_order_zero_rows/)
  assert.match(migration, /line_pay_paid_recovery_attempt_zero_rows/)
  assert.doesNotMatch(migration, /http|fetch|request api|confirm api/i)
})

test('fails closed on every payment binding and preserves executor isolation', () => {
  for (const binding of [
    'environment',
    'merchant_order_no',
    'line_pay_transaction_id',
    'amount_twd',
    'currency',
    'product_order_id',
    'checkout_attempt_id',
  ]) {
    assert.match(migration, new RegExp(`v_(?:payment|order|attempt)\\.${binding}`))
  }
  assert.match(
    migration,
    /revoke execute on function public\.recover_product_order_line_pay_confirmation[\s\S]*?from public, anon, authenticated, service_role, line_pay_payment_executor/i,
  )
  assert.match(
    migration,
    /grant execute on function public\.recover_product_order_line_pay_confirmation[\s\S]*?to line_pay_payment_executor/i,
  )
  assert.match(migration, /if v_payment\.status = 'paid' then/)
  assert.match(migration, /line_pay_paid_recovery_postcondition_failed/)
})
