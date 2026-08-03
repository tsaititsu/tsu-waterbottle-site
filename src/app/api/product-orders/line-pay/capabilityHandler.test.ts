import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  handleProductOrderLinePayCapabilityCallback,
  type ProductOrderLinePayCapabilityDatabase,
  type ProductOrderLinePayCapabilityPaymentContext,
} from './capabilityHandler'
import { LinePayCapabilityDatabaseError } from '../../../../lib/supabase/linePayCapabilityRuntime'

const paymentId = '71000000-0000-4000-8000-000000000001'
const productOrderId = '51000000-0000-4000-8000-000000000001'
const attemptId = '61000000-0000-4000-8000-000000000001'
const capabilityId = '91000000-0000-4000-8000-000000000001'
const callbackEventId = '92000000-0000-4000-8000-000000000001'
const callbackClaimId = 'a1000000-0000-4000-8000-000000000001'
const transactionId = '92233720368547758081234567890'
const merchantOrderNo = 'LP_E2E_a1000000000040008000000000000001'
const token = 'sandbox-confirm-capability-token'

const env = {
  NEXT_PUBLIC_ENABLE_LINE_PAY: 'true',
  LINE_PAY_ENV: 'sandbox',
  LINE_PAY_CHANNEL_ID: 'sandbox-channel-id',
  LINE_PAY_CHANNEL_SECRET: 'sandbox-channel-secret',
  LINE_PAY_CONFIRM_URL: 'https://preview.example.com/api/product-orders/line-pay/confirm',
  LINE_PAY_CANCEL_URL: 'https://preview.example.com/api/product-orders/line-pay/cancel',
  LINE_PAY_TRANSPORT: 'gateway',
  VERCEL_ENV: 'preview',
}

const context: ProductOrderLinePayCapabilityPaymentContext = {
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
}

function request(
  purpose: 'confirm' | 'cancel',
  params: Record<string, string | undefined>,
) {
  const url = new URL(
    `https://preview.example.com/api/product-orders/line-pay/${purpose}`,
  )
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value)
  }
  return new Request(url)
}

async function json(response: Response) {
  return (await response.json()) as Record<string, unknown>
}

function createDatabase() {
  const calls: Array<{ operation: string; input: Record<string, unknown> }> = []
  const database: ProductOrderLinePayCapabilityDatabase = {
    async claimCapability(input) {
      calls.push({ operation: 'claimCapability', input })
      return {
        resultCode: 'claimed',
        capabilityId,
        callbackEventId,
      }
    },
    async claimConfirmation(input) {
      calls.push({ operation: 'claimConfirmation', input })
      return { resultCode: 'claimed' }
    },
    async finalizeConfirmation(input) {
      calls.push({ operation: 'finalizeConfirmation', input })
      return { resultCode: 'completed', transactionId }
    },
    async cancelPayment(input) {
      calls.push({ operation: 'cancelPayment', input })
      return { resultCode: 'canceled', requestState: 'canceled' }
    },
    async markReconciliation(input) {
      calls.push({ operation: 'markReconciliation', input })
      return { resultCode: 'marked', requestState: 'reconciliation_required' }
    },
  }
  return { calls, database }
}

test('confirm uses capability, provider evidence, and atomic completion in order', async () => {
  const { calls, database } = createDatabase()
  let providerCalls = 0
  const response = await handleProductOrderLinePayCapabilityCallback({
    purpose: 'confirm',
    request: request('confirm', {
      orderId: merchantOrderNo,
      transactionId,
      capability: token,
    }),
    env,
    readContext: async () => context,
    database,
    confirmPayment: async (input) => {
      providerCalls += 1
      assert.equal(input.transactionId, transactionId)
      assert.deepEqual(input.payloadInput, { amount: 50, currency: 'TWD' })
      assert.equal(JSON.stringify(input).includes(token), false)
      return {
        returnCode: '0000',
        returnMessage: 'Success',
        transactionId,
        orderId: merchantOrderNo,
      }
    },
    now: () => new Date('2026-07-31T12:00:00.000Z'),
    createUuid: () => callbackClaimId,
  })

  assert.equal(response.status, 200)
  assert.equal(providerCalls, 1)
  assert.deepEqual(calls.map(({ operation }) => operation), [
    'claimCapability',
    'claimConfirmation',
    'finalizeConfirmation',
  ])
  const claim = calls[0]?.input ?? {}
  assert.match(String(claim.tokenHash), /^[0-9a-f]{64}$/)
  assert.equal(JSON.stringify(calls).includes(token), false)
  const completion = calls[2]?.input ?? {}
  assert.match(String(completion.confirmResultSha256), /^[0-9a-f]{64}$/)
  assert.equal('auditEvidence' in completion, false)
  assert.deepEqual(await json(response), {
    ok: true,
    confirmed: true,
    markedPaid: true,
    paymentId,
    productOrderId,
    transactionId,
  })
})

test('ambiguous confirm failure marks reconciliation and leaks no provider detail', async () => {
  const { calls, database } = createDatabase()
  const secret = 'provider-internal-secret'
  const response = await handleProductOrderLinePayCapabilityCallback({
    purpose: 'confirm',
    request: request('confirm', {
      orderId: merchantOrderNo,
      transactionId,
      capability: token,
    }),
    env,
    readContext: async () => context,
    database,
    confirmPayment: async () => {
      throw new Error(`timeout ${secret}`)
    },
    now: () => new Date('2026-07-31T12:00:00.000Z'),
    createUuid: () => callbackClaimId,
  })
  const body = JSON.stringify(await json(response))

  assert.equal(response.status, 502)
  assert.deepEqual(calls.map(({ operation }) => operation), [
    'claimCapability',
    'claimConfirmation',
    'markReconciliation',
  ])
  assert.equal(body.includes(secret), false)
  assert.deepEqual(JSON.parse(body), {
    ok: false,
    error: 'line_pay_confirmation_reconciliation_required',
  })
})

test('atomic finalize failure reports only frozen allowlisted database metadata', async () => {
  const { calls, database } = createDatabase()
  const diagnosticStages: string[] = []
  const databaseDiagnostics: unknown[] = []
  const secret = 'database-internal-secret'
  const response = await handleProductOrderLinePayCapabilityCallback({
    purpose: 'confirm',
    request: request('confirm', {
      orderId: merchantOrderNo,
      transactionId,
      capability: token,
    }),
    env,
    readContext: async () => context,
    database: {
      ...database,
      finalizeConfirmation: async () => {
        throw new LinePayCapabilityDatabaseError({
          stage: 'finalize_confirmation',
          rpc: 'finalize_product_order_line_pay_confirmation',
          databaseRole: 'line_pay_payment_executor',
          sqlstate: '42501',
        })
      },
    },
    confirmPayment: async () => ({
      returnCode: '0000',
      returnMessage: secret,
      transactionId,
      orderId: merchantOrderNo,
    }),
    createUuid: () => callbackClaimId,
    onDiagnosticStage: (stage) => diagnosticStages.push(stage),
    onDatabaseDiagnostic: (diagnostic) => databaseDiagnostics.push(diagnostic),
  })

  assert.equal(response.status, 502)
  assert.deepEqual(diagnosticStages, ['confirmation_finalize_failed'])
  assert.deepEqual(databaseDiagnostics, [{
    stage: 'finalize_confirmation',
    rpc: 'finalize_product_order_line_pay_confirmation',
    databaseRole: 'line_pay_payment_executor',
    sqlstate: '42501',
  }])
  assert.equal(Object.isFrozen(databaseDiagnostics[0]), true)
  assert.equal(JSON.stringify(databaseDiagnostics).includes(secret), false)
  assert.equal(JSON.stringify(databaseDiagnostics).includes(paymentId), false)
  assert.deepEqual(calls.map(({ operation }) => operation), [
    'claimCapability',
    'claimConfirmation',
    'markReconciliation',
  ])
  assert.deepEqual(await json(response), {
    ok: false,
    error: 'line_pay_confirmation_reconciliation_required',
  })
})

test('cancel consumes the cancel capability without calling LINE Pay', async () => {
  const { calls, database } = createDatabase()
  let providerCalls = 0
  const response = await handleProductOrderLinePayCapabilityCallback({
    purpose: 'cancel',
    request: request('cancel', {
      orderId: merchantOrderNo,
      capability: token,
    }),
    env,
    readContext: async () => context,
    database,
    confirmPayment: async () => {
      providerCalls += 1
      throw new Error('must_not_call_provider')
    },
    now: () => new Date('2026-07-31T12:00:00.000Z'),
    createUuid: () => callbackClaimId,
  })

  assert.equal(response.status, 200)
  assert.equal(providerCalls, 0)
  assert.deepEqual(calls.map(({ operation }) => operation), [
    'claimCapability',
    'cancelPayment',
  ])
  assert.deepEqual(await json(response), {
    ok: true,
    canceled: true,
    paymentId,
    productOrderId,
  })
})

test('missing capability or mismatched transaction fails before database mutation', async () => {
  for (const params of [
    { orderId: merchantOrderNo, transactionId },
    { orderId: merchantOrderNo, transactionId: '999', capability: token },
  ]) {
    const { calls, database } = createDatabase()
    const response = await handleProductOrderLinePayCapabilityCallback({
      purpose: 'confirm',
      request: request('confirm', params),
      env,
      readContext: async () => context,
      database,
      confirmPayment: async () => {
        throw new Error('must_not_call_provider')
      },
    })

    assert.equal(response.status, 400)
    assert.deepEqual(calls, [])
  }
})

test('invalid callback inputs report fixed diagnostic stages without exposing values', async () => {
  const cases = [
    {
      params: { transactionId, capability: token },
      expectedStage: 'callback_order_id_invalid',
    },
    {
      params: { orderId: merchantOrderNo, transactionId },
      expectedStage: 'callback_capability_invalid',
    },
    {
      params: { orderId: merchantOrderNo, capability: token },
      expectedStage: 'callback_transaction_id_invalid',
    },
  ] as const

  for (const { params, expectedStage } of cases) {
    const observedStages: string[] = []
    const { calls, database } = createDatabase()
    const response = await handleProductOrderLinePayCapabilityCallback({
      purpose: 'confirm',
      request: request('confirm', params),
      env,
      readContext: async () => context,
      database,
      confirmPayment: async () => {
        throw new Error('must_not_call_provider')
      },
      onDiagnosticStage: (stage) => observedStages.push(stage),
    })

    assert.equal(response.status, 400)
    assert.deepEqual(observedStages, [expectedStage])
    assert.deepEqual(calls, [])
    assert.equal(JSON.stringify(observedStages).includes(transactionId), false)
    assert.equal(
      JSON.stringify(observedStages).includes(merchantOrderNo),
      false,
    )
  }
})

test('context mismatch and capability claim failure report distinct safe stages', async () => {
  const mismatchStages: string[] = []
  const mismatchDatabase = createDatabase()
  const mismatchResponse = await handleProductOrderLinePayCapabilityCallback({
    purpose: 'confirm',
    request: request('confirm', {
      orderId: merchantOrderNo,
      transactionId,
      capability: token,
    }),
    env,
    readContext: async () => ({ ...context, transactionId: 'different' }),
    database: mismatchDatabase.database,
    confirmPayment: async () => {
      throw new Error('must_not_call_provider')
    },
    onDiagnosticStage: (stage) => mismatchStages.push(stage),
  })

  assert.equal(mismatchResponse.status, 400)
  assert.deepEqual(mismatchStages, ['callback_context_mismatch'])
  assert.deepEqual(mismatchDatabase.calls, [])

  const claimStages: string[] = []
  const claimDatabase = createDatabase()
  const claimResponse = await handleProductOrderLinePayCapabilityCallback({
    purpose: 'confirm',
    request: request('confirm', {
      orderId: merchantOrderNo,
      transactionId,
      capability: token,
    }),
    env,
    readContext: async () => context,
    database: {
      ...claimDatabase.database,
      claimCapability: async () => {
        throw new Error('database detail must stay private')
      },
    },
    confirmPayment: async () => {
      throw new Error('must_not_call_provider')
    },
    onDiagnosticStage: (stage) => claimStages.push(stage),
  })

  assert.equal(claimResponse.status, 400)
  assert.deepEqual(claimStages, ['capability_claim_failed'])
  assert.equal(JSON.stringify(claimStages).includes('database detail'), false)
})

test('diagnostic observer failure cannot change callback behavior', async () => {
  const { database } = createDatabase()
  const response = await handleProductOrderLinePayCapabilityCallback({
    purpose: 'confirm',
    request: request('confirm', {
      orderId: merchantOrderNo,
      transactionId,
    }),
    env,
    readContext: async () => context,
    database,
    confirmPayment: async () => {
      throw new Error('must_not_call_provider')
    },
    onDiagnosticStage: () => {
      throw new Error('diagnostic observer failure')
    },
  })

  assert.equal(response.status, 400)
  assert.deepEqual(await json(response), {
    ok: false,
    error: 'invalid_line_pay_callback',
  })
})

test('disabled runtime fails closed before context lookup', async () => {
  let reads = 0
  const { database } = createDatabase()
  const response = await handleProductOrderLinePayCapabilityCallback({
    purpose: 'confirm',
    request: request('confirm', {
      orderId: merchantOrderNo,
      transactionId,
      capability: token,
    }),
    env: { ...env, NEXT_PUBLIC_ENABLE_LINE_PAY: 'false' },
    readContext: async () => {
      reads += 1
      return context
    },
    database,
    confirmPayment: async () => {
      throw new Error('must_not_call_provider')
    },
  })

  assert.equal(response.status, 404)
  assert.equal(reads, 0)
})
