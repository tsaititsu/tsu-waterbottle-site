import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createProductOrderLinePayCapabilityDatabase,
  readProductOrderLinePayCapabilityContext,
  type ProductOrderLinePayCapabilityRpcClient,
} from './linePayCapabilityRuntime'

const paymentId = '71000000-0000-4000-8000-000000000001'
const productOrderId = '51000000-0000-4000-8000-000000000001'
const attemptId = '61000000-0000-4000-8000-000000000001'
const capabilityId = '91000000-0000-4000-8000-000000000001'
const callbackEventId = '92000000-0000-4000-8000-000000000001'
const claimId = 'a1000000-0000-4000-8000-000000000001'
const transactionId = '92233720368547758081234567890'
const merchantOrderNo = 'LP_E2E_a1000000000040008000000000000001'

function createRpcClient(responses: unknown[]) {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = []
  let index = 0
  const client: ProductOrderLinePayCapabilityRpcClient = {
    rpc(functionName, args) {
      return {
        single: async () => {
          calls.push({ functionName, args })
          const data = responses[index]
          index += 1
          return { data, error: null }
        },
      }
    },
  }
  return { calls, client }
}

test('reads one exact LINE Pay capability payment context without raw payload', async () => {
  const calls: Array<{ name: string; value: string }> = []
  const row = {
    id: paymentId,
    product_order_id: productOrderId,
    checkout_attempt_id: attemptId,
    environment: 'sandbox',
    status: 'pending',
    request_state: 'pending',
    amount_twd: 50,
    currency: 'TWD',
    merchant_order_no: merchantOrderNo,
    line_pay_transaction_id: transactionId,
  }
  const builder = {
    select(columns: string) {
      assert.equal(columns.includes('raw_payload'), false)
      calls.push({ name: 'select', value: columns })
      return this
    },
    eq(name: string, value: string) {
      calls.push({ name, value })
      return this
    },
    async maybeSingle() {
      return { data: row, error: null }
    },
  }
  const context = await readProductOrderLinePayCapabilityContext(
    merchantOrderNo,
    {
      from(table: string) {
        assert.equal(table, 'payments')
        return builder
      },
    },
  )

  assert.deepEqual(context, {
    paymentId,
    productOrderId,
    attemptId,
    environment: 'sandbox',
    status: 'pending',
    requestState: 'pending',
    amountTwd: 50,
    currency: 'TWD',
    merchantOrderNo,
    transactionId,
  })
  assert.equal(Object.isFrozen(context), true)
  assert.deepEqual(calls.slice(1), [
    { name: 'merchant_order_no', value: merchantOrderNo },
    { name: 'provider', value: 'line_pay' },
  ])
})

test('maps the capability callback sequence to exact RPC names and arguments', async () => {
  const rpc = createRpcClient([
    {
      result_code: 'claimed',
      capability_id: capabilityId,
      callback_event_id: callbackEventId,
      payment_id: paymentId,
      product_order_id: productOrderId,
      purpose: 'confirm',
      expires_at: '2026-07-31T12:30:00.000Z',
    },
    {
      result_code: 'claimed',
      payment_id: paymentId,
      product_order_id: productOrderId,
      request_state: 'confirmation_processing',
    },
    {
      result_code: 'recorded',
      callback_event_id: callbackEventId,
      provider_result_sha256: 'd'.repeat(64),
    },
    {
      result_code: 'completed',
      payment_id: paymentId,
      product_order_id: productOrderId,
      transaction_id: transactionId,
    },
    {
      result_code: 'canceled',
      payment_id: paymentId,
      product_order_id: productOrderId,
      request_state: 'canceled',
    },
    {
      result_code: 'marked',
      payment_id: paymentId,
      product_order_id: productOrderId,
      request_state: 'reconciliation_required',
    },
  ])
  const database = createProductOrderLinePayCapabilityDatabase(rpc.client)

  await database.claimCapability({
    tokenHash: 'a'.repeat(64),
    environment: 'sandbox',
    purpose: 'confirm',
    paymentId,
    productOrderId,
    attemptId,
    claimId,
    claimExpiresAt: '2026-07-31T12:02:00.000Z',
  })
  await database.claimConfirmation({
    environment: 'sandbox',
    paymentId,
    productOrderId,
    attemptId,
    capabilityId,
    callbackEventId,
    callbackClaimId: claimId,
    transactionId,
    requestId: 'line-pay-callback:request-1',
  })
  await database.recordConfirmationEvidence({
    environment: 'sandbox',
    callbackEventId,
    callbackClaimId: claimId,
    providerResultSha256: 'd'.repeat(64),
    safeResultCode: '0000',
    requestId: 'line-pay-callback:request-1',
  })
  await database.completeConfirmation({
    environment: 'sandbox',
    paymentId,
    productOrderId,
    attemptId,
    merchantOrderNo,
    transactionId,
    amountTwd: 50,
    currency: 'TWD',
    capabilityId,
    callbackEventId,
    callbackClaimId: claimId,
    confirmResultSha256: 'd'.repeat(64),
    requestId: 'line-pay-callback:request-1',
    auditEvidence: {
      result_code: 'verified',
      evidence_sha256: 'd'.repeat(64),
    },
  })
  await database.cancelPayment({
    environment: 'sandbox',
    paymentId,
    productOrderId,
    attemptId,
    capabilityId,
    callbackEventId,
    callbackClaimId: claimId,
    requestId: 'line-pay-callback:request-2',
    reasonCode: 'payment_canceled',
  })
  await database.markReconciliation({
    environment: 'sandbox',
    paymentId,
    productOrderId,
    attemptId,
    requestId: 'line-pay-callback:request-3',
    reasonCode: 'confirmation_completion_failed',
  })

  assert.deepEqual(rpc.calls.map(({ functionName }) => functionName), [
    'claim_line_pay_callback_capability',
    'claim_product_order_line_pay_confirmation',
    'record_product_order_line_pay_confirmation_evidence',
    'complete_product_order_line_pay_confirmation',
    'cancel_product_order_line_pay_payment',
    'mark_product_order_line_pay_reconciliation',
  ])
  assert.deepEqual(rpc.calls[0]?.args, {
    p_token_hash: 'a'.repeat(64),
    p_environment: 'sandbox',
    p_purpose: 'confirm',
    p_payment_id: paymentId,
    p_product_order_id: productOrderId,
    p_attempt_id: attemptId,
    p_claim_id: claimId,
    p_claim_expires_at: '2026-07-31T12:02:00.000Z',
  })
  assert.deepEqual(rpc.calls[3]?.args.p_audit_evidence, {
    result_code: 'verified',
    evidence_sha256: 'd'.repeat(64),
  })
  assert.equal(rpc.calls[3]?.args.p_paid_at, null)
})

test('RPC failure and unexpected result shape fail closed without details', async () => {
  const secret = 'database-internal-secret'
  const errorClient: ProductOrderLinePayCapabilityRpcClient = {
    rpc() {
      return {
        single: async () => ({ data: null, error: { message: secret } }),
      }
    },
  }
  await assert.rejects(
    () =>
      createProductOrderLinePayCapabilityDatabase(errorClient).claimCapability({
        tokenHash: 'a'.repeat(64),
        environment: 'sandbox',
        purpose: 'confirm',
        paymentId,
        productOrderId,
        attemptId,
        claimId,
        claimExpiresAt: '2026-07-31T12:02:00.000Z',
      }),
    (error: unknown) =>
      error instanceof Error
      && error.message === 'line_pay_capability_database_error'
      && !JSON.stringify(error).includes(secret),
  )
})
