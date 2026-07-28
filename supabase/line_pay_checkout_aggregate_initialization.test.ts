import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

const migrationPath = new URL(
  './migrations/20260728053215_line_pay_checkout_aggregate_initialization.sql',
  import.meta.url,
)
const migration = readFileSync(migrationPath, 'utf8')
const recoveryPath = new URL(
  './deployment/line_pay_checkout_aggregate_initialization_recovery.sql',
  import.meta.url,
)
const recovery = existsSync(recoveryPath)
  ? readFileSync(recoveryPath, 'utf8')
  : ''
const deploymentRunbookPath = new URL(
  '../docs/line-pay-checkout-aggregate-initialization-deployment.md',
  import.meta.url,
)
const deploymentRunbook = existsSync(deploymentRunbookPath)
  ? readFileSync(deploymentRunbookPath, 'utf8')
  : ''
const workflow = readFileSync(
  new URL('../.github/workflows/line-pay-db-contract-ci.yml', import.meta.url),
  'utf8',
)
const postgresRunner = readFileSync(
  new URL(
    './tests/run_line_pay_checkout_aggregate_initialization.mjs',
    import.meta.url,
  ),
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
  assert.match(migration, /customer_email[\s\S]*?\^\[\^\[:space:\]@\]\+@/i)
  assert.match(migration, /customer_phone[\s\S]*?\^\[0-9\+\(\)\. \-\]\+\$/i)
  assert.match(migration, /recipient_email[\s\S]*?\^\[\^\[:space:\]@\]\+@/i)
  assert.match(migration, /recipient_phone[\s\S]*?\^\[0-9\+\(\)\. \-\]\+\$/i)
  assert.match(migration, /postal_code[\s\S]*?\^\[A-Za-z0-9\]/i)
  assert.match(migration, /store_phone[\s\S]*?\^\[0-9\+\(\)\. \-\]\+\$/i)
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
    migration.indexOf('attempt.request_body_sha256,')
      < migration.indexOf(
        "v_capability_expires_at <= pg_catalog.clock_timestamp() + interval '5 minutes'",
      ),
  )
})

test('initializer replay only projects reviewed aggregate fields', () => {
  assert.doesNotMatch(
    migration,
    /select\s+(?:attempt|payment|product_order|request_outbox|capability)\.\*/i,
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
    /payment\.merchant_order_no\s*=\s*attempt\.merchant_order_no[\s\S]*?payment\.request_idempotency_key\s*=\s*attempt\.idempotency_key[\s\S]*?payment\.request_body_sha256\s*=\s*attempt\.request_body_sha256/i,
  )
  assert.match(
    migration,
    /payment\.item_name\s*=\s*pg_catalog\.left\([\s\S]*?product_order\.order_no[\s\S]*?50[\s\S]*?payment\.raw_payload\s*=\s*pg_catalog\.jsonb_build_object\([\s\S]*?'orderId',\s*attempt\.merchant_order_no[\s\S]*?'sourceId',\s*product_order\.id::text/i,
  )
  assert.match(
    migration,
    /product_order\.order_status\s*=\s*'pending_payment'[\s\S]*?product_order\.shipping_status\s*=\s*case[\s\S]*?product_order\.fulfillment_mode\s*=\s*case[\s\S]*?product_order\.sandbox_test\s*=\s*\(p_environment\s*=\s*'sandbox'\)/i,
  )
  assert.match(migration, /payment\.state_version\s*=\s*0/i)
  assert.match(migration, /product_order\.state_version\s*=\s*1/i)
  assert.match(migration, /attempt\.state_version\s*=\s*0/i)
  assert.match(
    migration,
    /from\s+public\.line_pay_request_outbox\s+as\s+request_outbox[\s\S]*?request_outbox\.idempotency_key\s*=\s*attempt\.idempotency_key[\s\S]*?request_outbox\.request_body_sha256\s*=\s*attempt\.request_body_sha256[\s\S]*?request_outbox\.state\s*=\s*'queued'/i,
  )
  assert.match(
    migration,
    /from\s+public\.line_pay_callback_capabilities\s+as\s+capability[\s\S]*?capability\.purpose\s+in\s*\(\s*'confirm',\s*'cancel'\s*\)[\s\S]*?capability\.capability_version\s*=\s*1[\s\S]*?capability\.expires_at\s*<=\s*pg_catalog\.clock_timestamp\(\)\s*\+\s*interval\s*'24 hours'[\s\S]*?capability\.consumed_at\s+is\s+null[\s\S]*?capability\.revoked_at\s+is\s+null/i,
  )
  assert.match(
    migration,
    /capability\.expires_at\s*<=\s*capability\.created_at\s*\+\s*interval\s*'24 hours'/i,
  )
  assert.match(
    migration,
    /count\s*\(\s*distinct\s+capability\.expires_at\s*\)[\s\S]*?capability\.purpose\s+in\s*\(\s*'confirm',\s*'cancel'\s*\)[\s\S]*?=\s*1/i,
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
  assert.match(
    migration,
    /policy\s+intent[\s\S]*?read[\s\S]*?insert[\s\S]*?update[\s\S]*?delete/i,
  )
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
  assert.match(migration, /acl\.is_grantable/i)
  assert.match(migration, /line_pay_initialization_rpc_security_postcondition_failed/i)
})

test('item and shipping SELECT ACLs reject grant option in migration and recovery', () => {
  for (const source of [migration, recovery]) {
    assert.match(
      source,
      /pg_catalog\.aclexplode\(relation\.relacl\)\s+as\s+table_acl/i,
    )
    assert.match(
      source,
      /table_acl\.privilege_type\s*=\s*'SELECT'/i,
    )
    assert.match(source, /not\s+table_acl\.is_grantable/i)
    assert.match(
      source,
      /table_acl\.grantor\s*=\s*relation\.relowner/i,
    )
  }
})

test('migration locks the audit index to the exact reviewed catalog shape', () => {
  assert.match(migration, /access_method\.amname\s*=\s*'btree'/i)
  assert.match(migration, /index_catalog\.indisready/i)
  assert.match(migration, /index_catalog\.indnkeyatts\s*=\s*1/i)
  assert.match(migration, /index_catalog\.indnatts\s*=\s*1/i)
  assert.match(migration, /not\s+index_catalog\.indnullsnotdistinct/i)
  assert.match(migration, /index_catalog\.indexprs\s+is\s+null/i)
  assert.match(
    migration,
    /index_catalog\.indkey\[0\]\s*=\s*key_attribute\.attnum/i,
  )
})

test('LINE Pay DB CI runs both static and PostgreSQL 17 initialization contracts', () => {
  for (const path of [
    'src/lib/supabase/linePayCheckoutInitialization.ts',
    'src/lib/supabase/linePayCheckoutInitialization.test.ts',
    'supabase/line_pay_checkout_aggregate_initialization.test.ts',
    'supabase/migrations/20260728053215_line_pay_checkout_aggregate_initialization.sql',
    'supabase/deployment/line_pay_checkout_aggregate_initialization_recovery.sql',
    'supabase/tests/run_line_pay_checkout_aggregate_initialization.mjs',
    'docs/line-pay-checkout-aggregate-initialization-deployment.md',
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

test('initializer PostgreSQL runner waits for the final container process', () => {
  const finalProcessGate = postgresRunner.search(/\/proc\/1\/comm/u)
  const sqlProbe = postgresRunner.search(/['"]select 1['"]/u)

  assert.ok(finalProcessGate >= 0)
  assert.ok(sqlProbe > finalProcessGate)
})

test('provides a reviewed fail-closed recovery artifact without wiring Production execution', () => {
  assert.equal(existsSync(recoveryPath), true)
  assert.match(recovery, /^\s*\\set\s+ON_ERROR_STOP\s+on/im)
  assert.match(recovery, /\bbegin\s*;/i)
  assert.match(recovery, /\bcommit\s*;/i)
  assert.match(recovery, /event_type\s*=\s*'checkout_initialized'/i)
  assert.match(recovery, /line_pay_initialization_recovery_requires_fail_forward/i)
  assert.match(
    recovery,
    /drop\s+function\s+public\.initialize_product_order_line_pay_checkout\s*\(\s*jsonb\s*\)/i,
  )
  assert.match(
    recovery,
    /drop\s+function\s+line_pay_private\.record_line_pay_checkout_initialized_audit/i,
  )
  assert.match(
    recovery,
    /drop\s+policy\s+line_pay_payment_function_owner_checkout_initialized_audit_insert/i,
  )
  assert.match(
    recovery,
    /drop\s+index\s+public\.line_pay_payment_audit_events_checkout_initialized_once_idx/i,
  )
  assert.doesNotMatch(recovery, /\bcascade\b/i)
  assert.doesNotMatch(
    recovery,
    /^\s*(?:delete|truncate|update)\s+/im,
  )
  assert.doesNotMatch(workflow, /run:.*line_pay_checkout_aggregate_initialization_recovery/is)
  assert.match(recovery, /pg_catalog\.pg_get_functiondef/i)
  assert.match(recovery, /pg_catalog\.obj_description/i)
  assert.match(recovery, /pg_catalog\.aclexplode/i)
  assert.match(recovery, /acl\.is_grantable/i)
  assert.match(recovery, /pg_catalog\.pg_get_indexdef/i)
  assert.match(recovery, /pg_catalog\.pg_get_expr/i)
  assert.match(recovery, /index_catalog\.indnkeyatts\s*=\s*1/i)
  assert.match(recovery, /index_catalog\.indnatts\s*=\s*1/i)
  assert.match(recovery, /index_catalog\.indexprs\s+is\s+null/i)
  assert.match(recovery, /access_method\.amname\s*=\s*'btree'/i)
  assert.match(recovery, /index_catalog\.indisready/i)
  assert.match(recovery, /policy\.polcmd\s*=\s*'a'/i)
  assert.match(recovery, /policy\.polwithcheck/i)
  assert.match(recovery, /line_pay_initialization_recovery_state_mismatch/i)
  assert.match(
    recovery,
    /lock\s+table[\s\S]*?public\.product_order_items[\s\S]*?public\.product_shipping_info[\s\S]*?public\.line_pay_payment_audit_events[\s\S]*?share\s+row\s+exclusive/i,
  )
  assert.ok(
    recovery.search(/lock\s+table/i)
      < recovery.search(
        /from\s+public\.line_pay_payment_audit_events\s+as\s+audit/i,
      ),
  )
})

test('documents impact, backup, deployment order, compatibility, and fail-forward boundary', () => {
  assert.equal(existsSync(deploymentRunbookPath), true)
  for (const phrase of [
    '影響範圍',
    'Backup／PITR',
    'restore point',
    '上線順序',
    '舊程式相容性',
    'LINE Pay Runtime disabled',
    'fail-forward',
    'line_pay_checkout_aggregate_initialization_recovery.sql',
  ]) {
    assert.match(deploymentRunbook, new RegExp(phrase, 'i'))
  }
  assert.match(deploymentRunbook, /不得自動執行/i)
  assert.match(deploymentRunbook, /checkout_initialized[\s\S]*?0/i)
})
