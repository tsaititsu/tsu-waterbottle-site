import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test, { before } from 'node:test'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const validatorPath = join(
  root,
  'scripts/supabase/validate-bank-transfer-production-baseline-capture.mjs',
)
const workflowPath =
  '.github/workflows/supabase-production-bank-transfer-baseline-capture.yml'
const capturePath =
  'supabase/deployment/bank_transfer_historical_baseline_capture.sql'

let validator: any

before(async () => {
  validator = await import(pathToFileURL(validatorPath).href)
})
test('baseline capture workflow is manual-only, protected, and uploads one private one-day artifact', () => {
  const workflow = readFileSync(workflowPath, 'utf8')
  assert.equal(validator.assertWorkflowSource(workflow), true)
  assert.match(
    workflow,
    /^name: Supabase Production Bank Transfer Baseline Capture$/mu,
  )
  assert.match(workflow, /^permissions:\n  contents: read$/mu)
  assert.match(
    workflow,
    /^  group: supabase-production-bank-transfer-baseline-capture$/mu,
  )
  assert.equal(
    (
      workflow.match(
        /node scripts\/supabase\/run-bank-transfer-production-baseline-capture[.]mjs/gu,
      ) ?? []
    ).length,
    1,
  )
  assert.equal(
    (workflow.match(/environment:\n      name: supabase-production/gu) ?? [])
      .length,
    1,
  )
  assert.match(
    workflow,
    /uses: actions\/upload-artifact@[0-9a-f]{40}/u,
  )
  assert.match(workflow, /retention-days: 1/u)
  assert.match(workflow, /if-no-files-found: error/u)
  assert.match(workflow, /include-hidden-files: false/u)
  assert.doesNotMatch(
    workflow,
    /run-line-pay-production-exact-file|line_pay_remediation_(?:deploy|preflight|postflight)|supabase\s+(?:db|migration)|\bpsql\b/iu,
  )
})

test('capture SQL is an exact explicit 17-column read-only canonicalization', () => {
  const sql = readFileSync(capturePath, 'utf8')
  assert.equal(validator.assertCaptureSql(sql), true)
  assert.match(
    sql,
    /^BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;$/mu,
  )
  assert.match(sql, /^ROLLBACK;$/mu)
  for (const column of [
    'id',
    'user_id',
    'item_type',
    'item_id',
    'item_name',
    'amount_twd',
    'payer_name',
    'payer_phone',
    'payer_email',
    'line_display_name',
    'bank_account_last5',
    'transfer_time',
    'note',
    'status',
    'admin_note',
    'created_at',
    'confirmed_at',
  ]) {
    assert.match(sql, new RegExp(`'${column}'`, 'u'))
  }
  for (const group of [
    'identity_and_amount',
    'payer_contact',
    'transfer_details',
    'review_and_confirmation',
    'full_canonical_row',
  ]) {
    assert.match(sql, new RegExp(`'${group}'`, 'u'))
  }
  assert.doesNotMatch(sql, /string_agg[(]\s*to_jsonb[(]row_value[)]/iu)
  assert.doesNotMatch(
    validator.stripSqlForStaticAnalysis(sql),
    /\b(?:insert|update|delete|merge|truncate|create|alter|drop|grant|revoke|comment|copy|call|do|execute)\b/iu,
  )
})

test('capture artifact schema contains only anonymous digests and approved counts', () => {
  const digest = 'a'.repeat(64)
  const groups = {
    identity_and_amount: digest,
    payer_contact: digest,
    transfer_details: digest,
    review_and_confirmation: digest,
    full_canonical_row: digest,
  }
  const artifact = {
    schema_signature: digest,
    group_digests: groups,
    ordinal_digests: {
      ordinal_1: groups,
      ordinal_2: groups,
      ordinal_3: groups,
    },
    row_count: 3,
    pk_digest: digest,
    pending_review_count: 3,
  }
  const parsed = validator.parseAndValidateBaselineArtifact(
    `${JSON.stringify(artifact)}\n`,
  )
  assert.deepEqual(parsed, artifact)
  assert.equal(Object.isFrozen(parsed), true)
  assert.equal(Object.isFrozen(parsed.group_digests), true)
  assert.equal(Object.isFrozen(parsed.ordinal_digests), true)
  for (const value of Object.values(parsed.ordinal_digests)) {
    assert.equal(Object.isFrozen(value), true)
  }

  for (const mutation of [
    { ...artifact, extra: true },
    { ...artifact, row_count: 0 },
    { ...artifact, pending_review_count: 2 },
    { ...artifact, pk_digest: 'not-a-digest' },
    {
      ...artifact,
      ordinal_digests: {
        ...artifact.ordinal_digests,
        ordinal_4: groups,
      },
    },
    {
      ...artifact,
      group_digests: {
        ...groups,
        raw_row: digest,
      },
    },
  ]) {
    assert.throws(
      () =>
        validator.parseAndValidateBaselineArtifact(
          `${JSON.stringify(mutation)}\n`,
        ),
      /BASELINE_CAPTURE_OUTPUT_INVALID/,
    )
  }
})
