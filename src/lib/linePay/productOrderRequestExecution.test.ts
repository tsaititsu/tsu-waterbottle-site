import assert from 'node:assert/strict'
import type {
  LinePayRequestDatabase,
  LinePayRequestReplayResult,
} from '../supabase/linePayDatabaseContracts'
import {
  LinePayProductOrderRequestExecutionError,
  executeInitializedProductOrderLinePayRequest,
} from './productOrderRequestExecution'
import { LinePayTransportError } from './transport'

const tests: Array<{
  name: string
  run: () => void | Promise<void>
}> = []

function test(name: string, run: () => void | Promise<void>) {
  tests.push({ name, run })
}

async function runTests() {
  for (const testCase of tests) {
    await testCase.run()
    console.log(`✓ ${testCase.name}`)
  }
}

const attemptId = '61000000-0000-4000-8000-000000000001'
const paymentId = '71000000-0000-4000-8000-000000000001'
const productOrderId = '51000000-0000-4000-8000-000000000001'
const claimId = 'a1000000-0000-4000-8000-000000000001'
const transactionId = '92233720368547758081234567890'
const idempotencyKey = 'sandbox-runtime-idempotency-0001'
const requestBodySha256 = 'a'.repeat(64)
const merchantOrderNo = 'LP_SANDBOX_RUNTIME_1'

function createDatabase(overrides: Partial<LinePayRequestDatabase> = {}) {
  const calls: string[] = []
  const database: LinePayRequestDatabase = {
    async claim() {
      calls.push('claim')
      return {
        result_code: 'claimed',
        attempt_id: attemptId,
        payment_id: paymentId,
        request_state: 'requesting',
        attempt_count: 1,
      }
    },
    async recordSuccess() {
      calls.push('recordSuccess')
      return {
        result_code: 'recorded',
        attempt_id: attemptId,
        payment_id: paymentId,
        request_state: 'succeeded',
        upstream_transaction_id: transactionId,
      }
    },
    async recordFailure() {
      calls.push('recordFailure')
      return {
        result_code: 'recorded',
        attempt_id: attemptId,
        payment_id: paymentId,
        request_state: 'failed',
      }
    },
    async markUnknown() {
      calls.push('markUnknown')
      return {
        result_code: 'recorded',
        attempt_id: attemptId,
        payment_id: paymentId,
        request_state: 'unknown',
      }
    },
    async readResult() {
      calls.push('readResult')
      return null
    },
    ...overrides,
  }

  return { calls, database }
}

function createInput(database: LinePayRequestDatabase) {
  return {
    environment: 'sandbox' as const,
    attemptId,
    paymentId,
    productOrderId,
    idempotencyKey,
    requestBodySha256,
    merchantOrderNo,
    claimId,
    claimExpiresAt: '2026-07-31T12:02:00.000Z',
    requestId: 'sandbox-runtime-request-1',
    payloadInput: {
      orderId: merchantOrderNo,
      amount: 50,
      currency: 'TWD' as const,
      products: [{ name: 'LINE Pay Sandbox E2E', quantity: 1, price: 50 }],
      confirmUrl: 'https://preview.example.com/api/product-orders/line-pay/confirm',
      cancelUrl: 'https://preview.example.com/api/product-orders/line-pay/cancel',
    },
    database,
    requestPayment: async () => ({
      returnCode: '0000',
      returnMessage: 'Success',
      transactionId,
      paymentUrlWeb: 'https://sandbox-web-pay.line.me/payment',
      paymentUrlApp: null,
    }),
  }
}

test('claimed request calls LINE Pay once and records an exact sanitized success result', async () => {
  const { calls, database } = createDatabase({
    async claim(input) {
      calls.push(`claim:${input.p_claim_id}`)
      return {
        result_code: 'claimed',
        attempt_id: attemptId,
        payment_id: paymentId,
        request_state: 'requesting',
        attempt_count: 1,
      }
    },
    async recordSuccess(input) {
      calls.push(`success:${input.p_upstream_transaction_id}`)
      assert.equal(input.p_sanitized_result.result_code, '0000')
      assert.equal(input.p_sanitized_result.provider_status, 'success')
      assert.equal(input.p_sanitized_result.transaction_id, transactionId)
      assert.equal(input.p_sanitized_result.merchant_order_no, merchantOrderNo)
      assert.match(String(input.p_sanitized_result.response_sha256), /^[0-9a-f]{64}$/)
      assert.equal(JSON.stringify(input).includes('paymentUrl'), false)
      return {
        result_code: 'recorded',
        attempt_id: attemptId,
        payment_id: paymentId,
        request_state: 'succeeded',
        upstream_transaction_id: transactionId,
      }
    },
  })
  let upstreamCalls = 0

  const result = await executeInitializedProductOrderLinePayRequest({
    ...createInput(database),
    requestPayment: async () => {
      upstreamCalls += 1
      return {
        returnCode: '0000',
        returnMessage: 'Success',
        transactionId,
        paymentUrlWeb: 'https://sandbox-web-pay.line.me/payment',
        paymentUrlApp: null,
      }
    },
  })

  assert.equal(upstreamCalls, 1)
  assert.deepEqual(calls, [`claim:${claimId}`, `success:${transactionId}`])
  assert.equal(result.status, 'payment_url_ready')
  assert.equal(result.transactionId, transactionId)
  assert.equal(typeof result.transactionId, 'string')
  assert.equal(result.paymentUrlWeb, 'https://sandbox-web-pay.line.me/payment')
  assert.equal(Object.isFrozen(result), true)
})

for (const resultCode of [
  'already_claimed',
  'claim_busy',
  'reconciliation_required',
  'terminal',
] as const) {
  test(`${resultCode} never calls LINE Pay again`, async () => {
    const { database } = createDatabase({
      async claim() {
        return {
          result_code: resultCode,
          attempt_id: attemptId,
          payment_id: paymentId,
          request_state:
            resultCode === 'reconciliation_required'
              ? 'reconciliation_required'
              : resultCode === 'terminal'
                ? 'failed'
                : 'requesting',
          attempt_count: 1,
        }
      },
    })
    let upstreamCalls = 0

    const result = await executeInitializedProductOrderLinePayRequest({
      ...createInput(database),
      requestPayment: async () => {
        upstreamCalls += 1
        throw new Error('must_not_call_upstream')
      },
    })

    assert.equal(upstreamCalls, 0)
    assert.equal(result.status, resultCode)
  })
}

test('already_succeeded reads the durable result and never calls LINE Pay again', async () => {
  const replay: LinePayRequestReplayResult = {
    attempt_id: attemptId,
    payment_id: paymentId,
    request_state: 'succeeded',
    upstream_transaction_id: transactionId,
    merchant_order_no: merchantOrderNo,
    sanitized_result: {
      result_code: '0000',
      provider_status: 'success',
      transaction_id: transactionId,
      merchant_order_no: merchantOrderNo,
      response_sha256: 'b'.repeat(64),
    },
    last_error_code: null,
    reconciliation_required: false,
    completed_at: '2026-07-31T12:01:00.000Z',
  }
  const { calls, database } = createDatabase({
    async claim() {
      calls.push('claim')
      return {
        result_code: 'already_succeeded',
        attempt_id: attemptId,
        payment_id: paymentId,
        request_state: 'succeeded',
        attempt_count: 1,
      }
    },
    async readResult() {
      calls.push('readResult')
      return replay
    },
  })
  let upstreamCalls = 0

  const result = await executeInitializedProductOrderLinePayRequest({
    ...createInput(database),
    requestPayment: async () => {
      upstreamCalls += 1
      throw new Error('must_not_call_upstream')
    },
  })

  assert.equal(upstreamCalls, 0)
  assert.deepEqual(calls, ['claim', 'readResult'])
  assert.equal(result.status, 'already_succeeded')
  assert.equal(result.transactionId, transactionId)
  assert.equal('paymentUrlWeb' in result, false)
})

test('known provider rejection records failure and does not mark unknown', async () => {
  const { calls, database } = createDatabase()

  await assert.rejects(
    () =>
      executeInitializedProductOrderLinePayRequest({
        ...createInput(database),
        requestPayment: async () => {
          throw new Error('line_pay_request_failed')
        },
      }),
    (error: unknown) =>
      error instanceof LinePayProductOrderRequestExecutionError
      && error.code === 'provider_rejected',
  )

  assert.deepEqual(calls, ['claim', 'recordFailure'])
})

test('ambiguous upstream failure marks the request unknown and returns only a safe error', async () => {
  const secret = 'must-not-escape-upstream-secret'
  const { calls, database } = createDatabase()

  await assert.rejects(
    () =>
      executeInitializedProductOrderLinePayRequest({
        ...createInput(database),
        requestPayment: async () => {
          throw new Error(`timeout ${secret}`)
        },
      }),
    (error: unknown) =>
      error instanceof LinePayProductOrderRequestExecutionError
      && error.code === 'upstream_result_unknown'
      && !JSON.stringify(error).includes(secret),
  )

  assert.deepEqual(calls, ['claim', 'markUnknown'])
})

test('Gateway request failures retain only the allowlisted transport reason', async () => {
  const { calls, database } = createDatabase()

  await assert.rejects(
    () =>
      executeInitializedProductOrderLinePayRequest({
        ...createInput(database),
        requestPayment: async () => {
          throw new LinePayTransportError('line_pay_gateway_request_failed')
        },
      }),
    (error: unknown) =>
      error instanceof LinePayProductOrderRequestExecutionError
      && error.code === 'gateway_request_failed',
  )

  assert.deepEqual(calls, ['claim', 'markUnknown'])
})

test('Gateway authentication failures retain the safe execution reason', async () => {
  const { calls, database } = createDatabase()

  await assert.rejects(
    () =>
      executeInitializedProductOrderLinePayRequest({
        ...createInput(database),
        requestPayment: async () => {
          throw new LinePayTransportError('line_pay_gateway_unauthorized')
        },
      }),
    (error: unknown) =>
      error instanceof LinePayProductOrderRequestExecutionError
      && error.code === 'gateway_unauthorized',
  )

  assert.deepEqual(calls, ['claim', 'markUnknown'])
})

test('database failure after upstream success attempts fail-closed unknown marking', async () => {
  const { calls, database } = createDatabase({
    async recordSuccess() {
      calls.push('recordSuccess')
      throw new Error('database internal detail')
    },
  })

  await assert.rejects(
    () => executeInitializedProductOrderLinePayRequest(createInput(database)),
    (error: unknown) =>
      error instanceof LinePayProductOrderRequestExecutionError
      && error.code === 'success_record_failed',
  )

  assert.deepEqual(calls, ['claim', 'recordSuccess', 'markUnknown'])
})

runTests().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
