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
const postgresImageContract = readFileSync(
  join(root, 'supabase/tests/line_pay_postgres_image.mjs'),
  'utf8',
)
const postgresRunner = readFileSync(
  join(root, 'supabase/tests/run_line_pay_remediation_db_contracts.mjs'),
  'utf8',
)
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
const dedicatedExecutorFunctions = new Set([
  'record_product_order_line_pay_confirmation_evidence',
  'complete_product_order_line_pay_confirmation',
])
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
assert.doesNotMatch(migration, /\bdrop\s+(?:table|schema|column)\b/i)
assert.doesNotMatch(migration, /\btruncate\s+(?:table\s+)?(?:only\s+)?[A-Za-z_"]/i)
assert.doesNotMatch(migration, /\bdelete\s+from\b/i)
assert.doesNotMatch(migration, /https?:\/\//i)
assert.doesNotMatch(migration, /\b(?:curl|fetch|http_request|net\.http)\b/i)
assert.match(
  postgresImageContract,
  /postgres@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193/,
)
assert.doesNotMatch(postgresImageContract, /postgres:17-alpine/)
assert.doesNotMatch(postgresImageContract, /process\.env|github\.event|workflow_dispatch/i)
assert.match(postgresRunner, /const image = LINE_PAY_POSTGRES_IMAGE/)
assert.doesNotMatch(postgresRunner, /process\.env\.[A-Z0-9_]*POSTGRES[A-Z0-9_]*IMAGE/i)

function assertRelationLockContract(source: string) {
  const transactionBegins = [...source.matchAll(/^begin;\s*$/gim)]
  const transactionCommits = [...source.matchAll(/^commit;\s*$/gim)]
  const lockTimeouts = [...source.matchAll(/^set local lock_timeout = '5s';\s*$/gim)]
  const timeoutResets = [...source.matchAll(/^set local lock_timeout = '0';\s*$/gim)]
  const relationLocks = [
    ...source.matchAll(/^lock table public\.product_orders in access exclusive mode;\s*$/gim),
  ]
  const relationExistenceGuard = source.indexOf("if to_regclass('public.product_orders') is null then")
  const relationLockIndex = relationLocks[0]?.index ?? -1
  const paymentMethodGuardIndex = source.indexOf('-- Guard every same-name constraint type')
  const paymentMethodDropIndex = source.indexOf(
    'drop constraint if exists product_orders_payment_method_check',
  )
  const paymentMethodRecreateIndex = source.indexOf(
    'add constraint product_orders_payment_method_check',
  )
  const transactionCommitIndex = transactionCommits[0]?.index ?? -1

  assert.equal(transactionBegins.length, 1, 'migration must have one explicit outer BEGIN')
  assert.equal(transactionCommits.length, 1, 'migration must have one explicit outer COMMIT')
  assert.equal(lockTimeouts.length, 1, 'relation lock must have one fixed transaction-local timeout')
  assert.equal(timeoutResets.length, 1, 'lock timeout must reset only after relation lock acquisition')
  assert.equal(relationLocks.length, 1, 'product_orders must have one exact ACCESS EXCLUSIVE lock')
  assert.ok(relationExistenceGuard >= 0, 'relation existence guard must be present')
  assert.ok(transactionBegins[0].index! < relationExistenceGuard)
  assert.ok(relationExistenceGuard < lockTimeouts[0].index!)
  assert.ok(lockTimeouts[0].index! < relationLockIndex)
  assert.ok(relationLockIndex < timeoutResets[0].index!)
  assert.ok(timeoutResets[0].index! < paymentMethodGuardIndex)
  assert.ok(paymentMethodGuardIndex < paymentMethodDropIndex)
  assert.ok(paymentMethodDropIndex < paymentMethodRecreateIndex)
  assert.ok(paymentMethodRecreateIndex < transactionCommitIndex)

  const lockLifetime = source.slice(relationLockIndex, transactionCommitIndex)
  const lockAcquisition = source.slice(lockTimeouts[0].index!, paymentMethodGuardIndex)
  assert.doesNotMatch(lockLifetime, /^\s*(?:commit|rollback);\s*$/gim)
  assert.doesNotMatch(lockAcquisition, /pg_(?:try_)?advisory_lock/i)
  assert.doesNotMatch(lockAcquisition, /\bnowait\b/i)
  assert.doesNotMatch(lockAcquisition, /\bexception\b/i)
}

assertRelationLockContract(migration)

const exactRelationLock = 'lock table public.product_orders in access exclusive mode;'
const exactLockTimeout = "set local lock_timeout = '5s';"
const exactTimeoutReset = "set local lock_timeout = '0';"
const relationLockNegativeContracts = [
  migration.replace(`${exactLockTimeout}\n${exactRelationLock}\n${exactTimeoutReset}\n`, ''),
  migration.replace(exactRelationLock, 'select pg_catalog.pg_advisory_lock(1);'),
  migration.replace(exactRelationLock, 'lock table public.product_orders in access share mode;'),
  migration.replace(exactRelationLock, `${exactRelationLock.slice(0, -1)} nowait;`),
  migration.replace(
    `${exactLockTimeout}\n${exactRelationLock}\n${exactTimeoutReset}`,
    `${exactLockTimeout}\n${exactTimeoutReset}\n${exactRelationLock}`,
  ),
  migration.replace(
    `${exactLockTimeout}\n${exactRelationLock}\n${exactTimeoutReset}`,
    `${exactLockTimeout}\n${exactRelationLock}\ncommit;\nbegin;\n${exactTimeoutReset}`,
  ),
  migration.replace(
    `${exactLockTimeout}\n${exactRelationLock}\n${exactTimeoutReset}`,
    `${exactLockTimeout}\ndo $$\nbegin\n  ${exactRelationLock}\nexception when others then null;\nend\n$$;\n${exactTimeoutReset}`,
  ),
  migration.replace(
    `${exactLockTimeout}\n${exactRelationLock}\n${exactTimeoutReset}\n\n-- Guard every same-name constraint type`,
    `-- Guard every same-name constraint type`,
  ).replace(
    'drop constraint if exists product_orders_payment_method_check,',
    `drop constraint if exists product_orders_payment_method_check;\n${exactLockTimeout}\n${exactRelationLock}\n${exactTimeoutReset}\nalter table public.product_orders`,
  ),
]

for (const weakenedContract of relationLockNegativeContracts) {
  assert.throws(() => assertRelationLockContract(weakenedContract))
}

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
  const dedicatedExecutorGrant = new RegExp(
    `grant\\s+execute\\s+on\\s+function\\s+public\\.${functionName}\\s*\\([\\s\\S]*?\\)\\s+to\\s+line_pay_payment_executor`,
    'i',
  )

  assert.match(migration, declaration, `${functionName} must have a fixed empty search_path`)
  assert.match(migration, revoke, `${functionName} must be revoked from browser roles`)
  if (dedicatedExecutorFunctions.has(functionName)) {
    assert.match(migration, dedicatedExecutorGrant, `${functionName} must use the dedicated executor`)
  } else {
    assert.match(migration, serviceRoleGrant, `${functionName} must be granted to service_role`)
  }
}

assert.match(migration, /create\s+role\s+line_pay_payment_executor\s+[^;]*nologin[^;]*nobypassrls/i)
assert.match(migration, /create\s+role\s+line_pay_payment_function_owner\s+[^;]*nologin[^;]*nobypassrls/i)
assert.match(
  migration,
  /current_setting\s*\(\s*'createrole_self_grant'\s*\)\s*<>\s*''/i,
)
assert.match(
  migration,
  /grant\s+line_pay_payment_function_owner\s+to\s+current_user\s+with\s+inherit\s+true,\s*set\s+true/i,
)
assert.match(
  migration,
  /revoke\s+line_pay_payment_function_owner\s+from\s+current_user/i,
)
assert.match(migration, /membership\.admin_option/i)
assert.match(migration, /not\s+membership\.inherit_option/i)
assert.match(migration, /not\s+membership\.set_option/i)
assert.match(migration, /grantor_role\.rolsuper/i)
assert.match(migration, /when\s+role\.rolsuper\s+then\s+membership_inventory\.membership_count\s+<>\s+0/i)
assert.match(migration, /else\s+membership_inventory\.membership_count\s+<>\s+2/i)
assert.match(migration, /create\s+schema\s+line_pay_private\s+authorization\s+line_pay_payment_function_owner/i)
assert.match(migration, /create\s+table\s+line_pay_private\.line_pay_completion_proofs\b/i)
assert.match(migration, /line_pay_completion_proof_is_immutable/i)
assert.match(migration, /line_pay_paid_payment_completion_proof_required/i)
assert.match(migration, /line_pay_paid_order_completion_proof_required/i)
assert.match(migration, /line_pay_paid_attempt_completion_proof_required/i)
assert.match(migration, /line_pay_provider_verified_success_evidence_required/i)
assert.match(migration, /safe_result_code\s*<>\s*'0000'/i)
assert.match(migration, /provider_result_code\s*=\s*'0000'/i)
assert.match(
  migration,
  /revoke\s+execute\s+on\s+function\s+public\.complete_product_order_line_pay_confirmation\s*\([\s\S]*?\)\s+from\s+public,\s*anon,\s*authenticated,\s*service_role/i,
)
assert.match(
  migration,
  /alter\s+function\s+public\.complete_product_order_line_pay_confirmation\s*\([\s\S]*?\)\s+owner\s+to\s+line_pay_payment_function_owner/i,
)

const paymentMethodGuardStart = migration.indexOf('-- Guard every same-name constraint type')
const paymentMethodGuardEnd = migration.indexOf('-- Default ACLs must be rejected', paymentMethodGuardStart)
assert.ok(paymentMethodGuardStart >= 0, 'payment-method all-contype guard must be present')
assert.ok(paymentMethodGuardEnd > paymentMethodGuardStart, 'payment-method guard must precede side-effect DDL')
const paymentMethodGuard = migration.slice(paymentMethodGuardStart, paymentMethodGuardEnd)
assert.match(paymentMethodGuard, /line_pay_constraint_guard:all_same_name_types/i)
assert.match(paymentMethodGuard, /constraint_row\.conrelid\s*=\s*v_relation_oid/i)
assert.match(paymentMethodGuard, /constraint_row\.conname\s*=\s*'product_orders_payment_method_check'/i)
assert.doesNotMatch(paymentMethodGuard, /and\s+constraint_row\.contype\s*=/i)
assert.match(paymentMethodGuard, /if\s+v_constraint_count\s*>\s*1\s+then/i)
assert.match(paymentMethodGuard, /if\s+v_constraint_type\s+is\s+distinct\s+from\s+'c'\s+then/i)
assert.match(paymentMethodGuard, /product_orders_payment_method_constraint_duplicate_name_conflict/i)
assert.match(paymentMethodGuard, /product_orders_payment_method_constraint_type_conflict/i)
assert.match(paymentMethodGuard, /product_orders_payment_method_constraint_metadata_conflict/i)
for (const metadataGuard of [
  /constraint_row\.convalidated/i,
  /not\s+constraint_row\.connoinherit/i,
  /not\s+constraint_row\.condeferrable/i,
  /not\s+constraint_row\.condeferred/i,
  /constraint_row\.conislocal/i,
  /constraint_row\.coninhcount\s*=\s*0/i,
  /constraint_row\.conparentid\s*=\s*0/i,
  /constraint_row\.contypid\s*=\s*0/i,
  /constraint_row\.connamespace\s*=\s*relation\.relnamespace/i,
]) {
  assert.match(paymentMethodGuard, metadataGuard)
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
