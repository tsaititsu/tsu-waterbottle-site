import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const migrationPath = new URL(
  './migrations/20260728053215_line_pay_checkout_aggregate_initialization.sql',
  import.meta.url,
)
const migration = readFileSync(migrationPath, 'utf8')
const workflow = readFileSync(
  new URL('../.github/workflows/line-pay-db-contract-ci.yml', import.meta.url),
  'utf8',
)

test('adds one JSON-only atomic LINE Pay checkout initializer', () => {
  assert.match(
    migration,
    /create\s+or\s+replace\s+function\s+public\.initialize_product_order_line_pay_checkout\s*\(\s*p_payload\s+jsonb\s*\)/i,
  )
  assert.match(migration, /language\s+plpgsql/i)
  assert.match(migration, /security\s+invoker/i)
  assert.match(migration, /set\s+search_path\s*=\s*''/i)
  assert.match(
    migration,
    /create\s+or\s+replace\s+function\s+line_pay_private\.record_line_pay_checkout_initialized_audit[\s\S]*?security\s+definer[\s\S]*?set\s+search_path\s*=\s*''/i,
  )
  assert.doesNotMatch(migration, /create\s+table/i)
  assert.doesNotMatch(migration, /alter\s+table/i)
  assert.doesNotMatch(migration, /drop\s+(table|column|constraint|function)/i)
})

test('initializer creates the complete aggregate inside one RPC transaction', () => {
  for (const relation of [
    'public.product_orders',
    'public.product_order_items',
    'public.product_shipping_info',
    'public.payments',
    'public.line_pay_checkout_attempts',
    'public.line_pay_request_outbox',
    'public.line_pay_callback_capabilities',
  ]) {
    assert.match(migration, new RegExp(`insert\\s+into\\s+${relation.replace('.', '\\.')}`, 'i'))
  }

  assert.match(migration, /pg_catalog\.gen_random_uuid\(\)/i)
  assert.match(migration, /pg_catalog\.pg_advisory_xact_lock/i)
  assert.match(migration, /already_initialized/i)
  assert.match(migration, /line_pay_initialization_idempotency_conflict/i)
})

test('the additive migration has one explicit outer transaction boundary', () => {
  assert.match(
    migration,
    /^--[\s\S]*?\n\nbegin;\s*\n\s*grant\s+line_pay_payment_function_owner\s+to\s+current_user/i,
  )
  assert.match(migration, /\ncommit;\s*$/i)
  assert.equal((migration.match(/\bbegin\s*;/gi) ?? []).length, 1)
  assert.equal((migration.match(/\bcommit\s*;/gi) ?? []).length, 1)
  assert.equal((migration.match(/\brollback\s*;/gi) ?? []).length, 0)
})

test('initializer is exact-shape, fail-closed, and secret-minimizing', () => {
  for (const field of [
    'user_id',
    'environment',
    'order_no',
    'merchant_order_no',
    'customer_name',
    'customer_email',
    'customer_phone',
    'note',
    'items',
    'shipping_info',
    'idempotency_key',
    'request_body_sha256',
    'confirm_token_hash',
    'cancel_token_hash',
    'capability_expires_at',
  ]) {
    assert.match(migration, new RegExp(`'${field}'`))
  }

  assert.match(migration, /jsonb_object_keys/i)
  assert.match(migration, /line_pay_initialization_invalid_input/i)
  assert.match(migration, /line_pay_initialization_items_total_mismatch/i)
  assert.match(
    migration,
    /pg_catalog\.octet_length\(p_payload::text\)\s*>\s*65536/i,
  )
  assert.match(
    migration,
    /pg_catalog\.octet_length\(\s*\(entry\.item\s*->\s*'product_snapshot'\)::text\s*\)\s*>\s*16384/i,
  )
  for (const snapshotKey of ['slug', 'name', 'category', 'priceTwd']) {
    assert.match(migration, new RegExp(`'${snapshotKey}'`))
  }
  assert.match(
    migration,
    /entry\.item\s*->\s*'product_snapshot'\s*->>\s*'slug'\s*<>\s*entry\.item\s*->>\s*'product_slug'/i,
  )
  assert.match(
    migration,
    /entry\.item\s*->\s*'product_snapshot'\s*->>\s*'priceTwd'[\s\S]*?<>\s*\(entry\.item\s*->>\s*'unit_price_twd'\)::bigint/i,
  )
  assert.doesNotMatch(
    migration,
    /channel[_ ]?secret|authorization|gateway[_ ]?secret|private[_ ]?key/i,
  )
})

test('initializer replay validates reciprocal aggregate bindings before success', () => {
  for (const invariant of [
    'v_existing_payment.product_order_id',
    'v_existing_payment.checkout_attempt_id',
    'v_existing_order.payment_id',
    'v_existing_order.checkout_attempt_id',
    'v_existing_outbox.payment_id',
    'v_existing_outbox.idempotency_key',
    'v_existing_confirm.product_order_id',
    'v_existing_confirm.checkout_attempt_id',
    'v_existing_cancel.product_order_id',
    'v_existing_cancel.checkout_attempt_id',
  ]) {
    assert.match(migration, new RegExp(invariant.replaceAll('.', '\\.')))
  }
  assert.match(
    migration,
    /v_existing_payment\.item_id\s+is\s+distinct\s+from\s+v_existing_order\.id::text/i,
  )
  assert.ok(
    migration.indexOf('select attempt.*')
      < migration.indexOf(
        "v_capability_expires_at <= pg_catalog.clock_timestamp() + interval '5 minutes'",
      ),
  )
})

test('production shipping fails closed before creating a physical order', () => {
  assert.match(
    migration,
    /v_environment\s*=\s*'production'[\s\S]*?recipient_name[\s\S]*?recipient_phone[\s\S]*?shipping_method' in \('manual', 'home_delivery'\)[\s\S]*?address/i,
  )
  assert.match(
    migration,
    /shipping_method' in \([\s\S]*?'convenience_store_c2c'[\s\S]*?'convenience_store_b2c'[\s\S]*?store_type[\s\S]*?store_id[\s\S]*?store_name[\s\S]*?store_address/i,
  )
})

test('initializer writes one bounded audit event through a least-privilege helper', () => {
  assert.match(
    migration,
    /create\s+unique\s+index\s+line_pay_payment_audit_events_checkout_initialized_once_idx[\s\S]*?where\s+event_type\s*=\s*'checkout_initialized'/i,
  )
  assert.match(
    migration,
    /create\s+policy\s+line_pay_payment_function_owner_checkout_initialized_audit_insert[\s\S]*?to\s+line_pay_payment_function_owner[\s\S]*?with\s+check\s*\(\s*event_type\s*=\s*'checkout_initialized'\s*\)/i,
  )
  assert.match(
    migration,
    /'checkout_initialized'[\s\S]*?'\{"reason_code":"checkout_initialized"\}'::jsonb/i,
  )
  assert.match(
    migration,
    /alter\s+function\s+line_pay_private\.record_line_pay_checkout_initialized_audit[\s\S]*?owner\s+to\s+line_pay_payment_function_owner/i,
  )
  assert.match(
    migration,
    /grant\s+execute\s+on\s+function\s+line_pay_private\.record_line_pay_checkout_initialized_audit[\s\S]*?to\s+service_role/i,
  )
  assert.match(
    migration,
    /payment\.user_id\s*=\s*product_order\.user_id[\s\S]*?product_order\.user_id\s*=\s*attempt\.user_id/i,
  )
  assert.match(
    migration,
    /from\s+public\.line_pay_request_outbox\s+as\s+request_outbox[\s\S]*?request_outbox\.idempotency_key\s*=\s*attempt\.idempotency_key[\s\S]*?request_outbox\.request_body_sha256\s*=\s*attempt\.request_body_sha256[\s\S]*?request_outbox\.state\s*=\s*'queued'/i,
  )
  assert.match(
    migration,
    /from\s+public\.line_pay_callback_capabilities\s+as\s+capability[\s\S]*?capability\.purpose\s+in\s*\(\s*'confirm',\s*'cancel'\s*\)[\s\S]*?capability\.capability_version\s*=\s*1[\s\S]*?capability\.consumed_at\s+is\s+null[\s\S]*?capability\.revoked_at\s+is\s+null/i,
  )
  assert.match(
    migration,
    /revoke\s+line_pay_payment_function_owner\s+from\s+current_user/i,
  )
  assert.match(migration, /membership\.inherit_option\s+or\s+membership\.set_option/i)
  assert.match(
    migration,
    /has_table_privilege\([\s\S]*?'service_role'[\s\S]*?'public\.line_pay_payment_audit_events'/i,
  )
  assert.match(migration, /v_audit_function_oid/i)
})

test('initializer execute ACL is service-role only with an exact catalog postcondition', () => {
  assert.match(
    migration,
    /revoke\s+all\s+on\s+function\s+public\.initialize_product_order_line_pay_checkout\s*\(\s*jsonb\s*\)\s+from\s+public,\s*anon,\s*authenticated/i,
  )
  assert.match(
    migration,
    /grant\s+execute\s+on\s+function\s+public\.initialize_product_order_line_pay_checkout\s*\(\s*jsonb\s*\)\s+to\s+service_role/i,
  )
  assert.match(migration, /pg_catalog\.aclexplode/i)
  assert.match(migration, /line_pay_initialization_rpc_security_postcondition_failed/i)
})

test('LINE Pay DB CI runs both static and PostgreSQL 17 initialization contracts', () => {
  for (const path of [
    'src/lib/supabase/linePayCheckoutInitialization.ts',
    'src/lib/supabase/linePayCheckoutInitialization.test.ts',
    'supabase/line_pay_checkout_aggregate_initialization.test.ts',
    'supabase/migrations/20260728053215_line_pay_checkout_aggregate_initialization.sql',
    'supabase/tests/run_line_pay_checkout_aggregate_initialization.mjs',
  ]) {
    assert.match(workflow, new RegExp(path.replaceAll('.', '\\.')))
  }

  assert.match(
    workflow,
    /node --test supabase\/line_pay_checkout_aggregate_initialization\.test\.ts/,
  )
  assert.match(
    workflow,
    /node --import tsx --test src\/lib\/supabase\/linePayCheckoutInitialization\.test\.ts/,
  )
  assert.match(
    workflow,
    /node supabase\/tests\/run_line_pay_checkout_aggregate_initialization\.mjs/,
  )
  assert.match(workflow, /supabase\/tests\/line_pay_\*\.sql/)
  assert.match(workflow, /task=line-pay-initialize-aggregate-v1/)
})
