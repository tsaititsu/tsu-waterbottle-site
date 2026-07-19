import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const migrationNames = readdirSync(join(root, 'supabase/migrations')).filter((name) =>
  name.endsWith('_line_pay_remediation_contracts.sql'),
)

assert.deepEqual(migrationNames, ['20260719033404_line_pay_remediation_contracts.sql'])

const migration = readFileSync(join(root, 'supabase/migrations', migrationNames[0]), 'utf8')
const normalized = migration.toLowerCase()
const functionNames = [
  'claim_product_order_line_pay_request',
  'record_product_order_line_pay_request_success',
  'record_product_order_line_pay_request_failure',
  'mark_product_order_line_pay_request_unknown',
  'read_product_order_line_pay_request_result',
  'claim_line_pay_callback_capability',
  'claim_product_order_line_pay_confirmation',
  'record_product_order_line_pay_confirmation_evidence',
  'complete_product_order_line_pay_confirmation',
  'cancel_product_order_line_pay_payment',
  'mark_product_order_line_pay_reconciliation',
] as const
const newTables = [
  'app_environment_attestation',
  'line_pay_checkout_attempts',
  'line_pay_request_outbox',
  'line_pay_callback_capabilities',
  'line_pay_callback_events',
  'line_pay_payment_audit_events',
] as const

const beginIndex = normalized.indexOf('begin;')
const preambleWithoutComments = migration.slice(0, beginIndex).replace(/^--.*$/gm, '').trim()
assert.equal(preambleWithoutComments, '')
assert.ok(normalized.lastIndexOf('commit;') > beginIndex)
assert.doesNotMatch(migration, /\bsecurity\s+definer\b/i)
assert.doesNotMatch(migration, /\bdrop\s+(?:table|schema|column)\b/i)
assert.doesNotMatch(migration, /\btruncate\b/i)
assert.doesNotMatch(migration, /\bdelete\s+from\b/i)
assert.doesNotMatch(migration, /https?:\/\//i)
assert.doesNotMatch(migration, /\b(?:curl|fetch|http_request|net\.http)\b/i)

for (const table of newTables) {
  assert.match(migration, new RegExp(`create\\s+table\\s+public\\.${table}\\b`, 'i'))
  assert.match(
    migration,
    new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, 'i'),
  )
  assert.match(
    migration,
    new RegExp(`revoke\\s+all\\s+on\\s+table\\s+public\\.${table}\\s+from\\s+public,\\s*anon,\\s*authenticated`, 'i'),
  )
}

for (const functionName of functionNames) {
  const declaration = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${functionName}\\s*\\([\\s\\S]*?set\\s+search_path\\s*=\\s*''`,
    'i',
  )
  const revoke = new RegExp(
    `revoke\\s+execute\\s+on\\s+function\\s+public\\.${functionName}\\s*\\([\\s\\S]*?\\)\\s+from\\s+public,\\s*anon,\\s*authenticated`,
    'i',
  )
  const serviceRoleGrant = new RegExp(
    `grant\\s+execute\\s+on\\s+function\\s+public\\.${functionName}\\s*\\([\\s\\S]*?\\)\\s+to\\s+service_role`,
    'i',
  )

  assert.match(migration, declaration, `${functionName} must have a fixed empty search_path`)
  assert.match(migration, revoke, `${functionName} must be revoked from browser roles`)
  assert.match(migration, serviceRoleGrant, `${functionName} must only be granted to service_role`)
}

assert.match(migration, /payment_method\s+in\s*\(\s*'bank_transfer',\s*'newebpay',\s*'line_pay'\s*\)/i)
assert.match(migration, /environment\s+in\s*\(\s*'sandbox',\s*'production'\s*\)/i)
assert.match(migration, /unique\s+index\s+line_pay_checkout_attempts_environment_key_idx/i)
assert.match(migration, /unique\s+index\s+line_pay_callback_capabilities_token_hash_idx/i)
assert.match(migration, /for\s+update/i)
assert.match(migration, /get\s+diagnostics\s+v_row_count\s*=\s*row_count/i)
assert.match(migration, /line_pay_paid_payment_is_terminal/i)
assert.match(migration, /line_pay_paid_product_order_is_terminal/i)
assert.match(migration, /line_pay_sandbox_fulfillment_is_forbidden/i)
assert.match(migration, /fake_test_token_do_not_use/i)
assert.match(migration, /fake_test_signature_do_not_use/i)
assert.match(migration, /fake_test_authorization_do_not_use/i)

const runtimeFiles = [
  'src/app/api/product-orders/create/handler.ts',
  'src/app/api/product-orders/line-pay/request/handler.ts',
  'src/app/api/product-orders/line-pay/confirm/handler.ts',
  'src/app/api/product-orders/line-pay/cancel/handler.ts',
] as const

for (const runtimeFile of runtimeFiles) {
  const source = readFileSync(join(root, runtimeFile), 'utf8')
  assert.ok(source.length > 0, `${runtimeFile} must remain present`)
}
