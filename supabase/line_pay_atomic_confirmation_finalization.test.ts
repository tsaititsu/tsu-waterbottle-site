import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

const migration = readFileSync(
  new URL(
    './migrations/20260802160000_line_pay_atomic_confirmation_finalization.sql',
    import.meta.url,
  ),
  'utf8',
)
const runtime = readFileSync(
  new URL('../src/lib/supabase/linePayCapabilityRuntime.ts', import.meta.url),
  'utf8',
)
const executor = readFileSync(
  new URL('../src/lib/supabase/linePayExecutor.ts', import.meta.url),
  'utf8',
)
const deploymentDocumentUrl = new URL(
  '../docs/line-pay-atomic-confirmation-finalization-deployment.md',
  import.meta.url,
)

test('adds one atomic confirmation finalize RPC without rewriting the base migration', () => {
  assert.match(migration, /^begin;/)
  assert.match(migration, /commit;\s*$/)
  assert.equal((migration.match(/^begin;$/gm) ?? []).length, 1)
  assert.equal((migration.match(/^commit;$/gm) ?? []).length, 1)
  assert.match(
    migration,
    /create\s+function\s+public\.finalize_product_order_line_pay_confirmation\s*\(/i,
  )
  assert.match(migration, /language\s+plpgsql[\s\S]*?security\s+definer/i)
  assert.match(migration, /set\s+search_path\s*=\s*''/i)
  assert.doesNotMatch(migration, /\bdrop\s+(?:function|table|schema|column)\b/i)
  assert.doesNotMatch(migration, /\b(?:delete\s+from|truncate)\b/i)
})

test('provider evidence and paid completion share one transaction boundary', () => {
  const evidenceIndex = migration.indexOf(
    'public.record_product_order_line_pay_confirmation_evidence(',
  )
  const completionIndex = migration.indexOf(
    'public.complete_product_order_line_pay_confirmation(',
    evidenceIndex,
  )

  assert.ok(evidenceIndex > 0)
  assert.ok(completionIndex > evidenceIndex)
  assert.match(migration, /line_pay_atomic_finalize_evidence_postcondition_failed/i)
  assert.match(
    migration,
    /when\s+check_violation\s+or\s+sqlstate\s+'55000'\s+then/i,
  )
  assert.match(migration, /'result_code',\s*'verified'/i)
  assert.match(migration, /'evidence_sha256',\s*p_confirm_result_sha256/i)
})

test('only the dedicated executor can call the wrapper', () => {
  assert.match(
    migration,
    /revoke\s+execute\s+on\s+function\s+public\.finalize_product_order_line_pay_confirmation\s*\([\s\S]*?\)\s+from\s+public,\s*anon,\s*authenticated,\s*service_role,\s*line_pay_payment_executor/i,
  )
  assert.match(
    migration,
    /grant\s+execute\s+on\s+function\s+public\.finalize_product_order_line_pay_confirmation\s*\([\s\S]*?\)\s+to\s+line_pay_payment_executor/i,
  )
  assert.match(
    migration,
    /grant\s+line_pay_payment_executor\s+to\s+authenticator\s+with\s+admin\s+false,\s*inherit\s+false,\s*set\s+true/i,
  )
  for (const functionName of [
    'record_product_order_line_pay_confirmation_evidence',
    'complete_product_order_line_pay_confirmation',
  ]) {
    assert.match(
      migration,
      new RegExp(
        `revoke\\s+execute\\s+on\\s+function\\s+public\\.${functionName}\\s*\\([\\s\\S]*?\\)\\s+from\\s+public,\\s*anon,\\s*authenticated,\\s*service_role,\\s*line_pay_payment_executor`,
        'i',
      ),
    )
  }
  assert.match(migration, /line_pay_atomic_finalize_acl_postcondition_failed/i)
  assert.match(migration, /line_pay_atomic_finalize_membership_postcondition_failed/i)
  assert.match(migration, /line_pay_atomic_finalize_executor_privilege_postcondition_failed/i)
  assert.match(
    migration,
    /line_pay_atomic_finalize_role_membership_allowlist_postcondition_failed/i,
  )
  assert.match(
    migration,
    /line_pay_atomic_finalize_executor_relation_acl_postcondition_failed/i,
  )
  assert.match(
    migration,
    /line_pay_atomic_finalize_executor_rpc_allowlist_postcondition_failed/i,
  )
  assert.match(migration, /pg_catalog\.aclexplode\(relation\.relacl\)/i)
  assert.match(migration, /pg_catalog\.aclexplode\(attribute\.attacl\)/i)
})

test('the application adapter exposes no split evidence or completion call', () => {
  assert.match(
    runtime,
    /rpc\(executorClient,\s*'finalize_product_order_line_pay_confirmation'/,
  )
  assert.doesNotMatch(
    runtime,
    /rpc\([^,]+,\s*'record_product_order_line_pay_confirmation_evidence'/,
  )
  assert.doesNotMatch(
    runtime,
    /rpc\([^,]+,\s*'complete_product_order_line_pay_confirmation'/,
  )
  assert.doesNotMatch(runtime, /p_audit_evidence|p_paid_at/)
})

test('executor client is server-only and rejects broad or unsigned credentials', () => {
  assert.equal(executor.split('\n')[0], "import 'server-only'")
  assert.match(executor, /claims\.role\s*!==\s*'line_pay_payment_executor'/)
  assert.match(executor, /claims\.aud\s*!==\s*'authenticated'/)
  assert.match(executor, /claims\.exp\s*<=\s*Math\.floor\(Date\.now\(\)\s*\/\s*1000\)/)
  assert.match(executor, /const\s+JWT_ALGORITHMS\s*=\s*new\s+Set\(\['ES256',\s*'HS256',\s*'RS256'\]\)/)
  assert.doesNotMatch(executor, /console\.|logger\.|SUPABASE_SERVICE_ROLE_KEY/)
})

test('documents impact, backup, deployment order, compatibility, and fail-forward recovery', () => {
  assert.equal(existsSync(deploymentDocumentUrl), true)
  const deployment = readFileSync(deploymentDocumentUrl, 'utf8')
  for (const requiredBoundary of [
    'Backup／PITR',
    'restore point',
    'fail-forward',
    'Runtime disabled',
    '20260719033404_line_pay_remediation_contracts.sql',
    '20260728053215_line_pay_checkout_aggregate_initialization.sql',
    '20260802160000_line_pay_atomic_confirmation_finalization.sql',
    'SUPABASE_LINE_PAY_EXECUTOR_JWT',
    '舊版 callback',
  ]) {
    assert.match(deployment, new RegExp(requiredBoundary))
  }
})
