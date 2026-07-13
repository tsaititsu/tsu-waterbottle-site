import assert from 'node:assert/strict'
import { resolveLinePayConfirmOutcome } from './confirmOutcome'
import type { LinePayPaymentRequestStatus, LinePayPaymentRequestStatusResult } from './statusClient'

const transactionId = '2026070700000000001'
const orderId = 'LP_product_order_product-order-1_20260707153000'
const expected = {
  transactionId,
  orderId,
  amount: 1500,
  currency: 'TWD',
}
const tests: Array<{ name: string; fn: () => Promise<void> | void }> = []

function test(name: string, fn: () => Promise<void> | void) {
  tests.push({ name, fn })
}

function createConfirmResult(override: Record<string, unknown> = {}) {
  return {
    returnCode: '0000',
    returnMessage: 'Success.',
    transactionId,
    orderId,
    currency: 'TWD',
    payInfo: [
      {
        amount: 1500,
      },
    ],
    ...override,
  }
}

function createRequestStatus(
  status: LinePayPaymentRequestStatus,
  returnCode = '0000',
): LinePayPaymentRequestStatusResult {
  return {
    returnCode,
    returnMessage: 'status message',
    transactionId,
    status,
  }
}

function createPaymentDetails(override: Record<string, unknown> = {}) {
  return {
    returnCode: '0000',
    returnMessage: 'Success.',
    info: [
      {
        transactionId,
        orderId,
        currency: 'TWD',
        payInfo: [
          {
            amount: 1500,
          },
        ],
        ...override,
      },
    ],
  }
}

function assertSafeOutcome(value: unknown) {
  const text = JSON.stringify(value)

  assert.equal(text.includes('channelSecret'), false)
  assert.equal(text.includes('channelId'), false)
  assert.equal(text.includes('LINE_PAY_CHANNEL_SECRET'), false)
  assert.equal(text.includes('LINE_PAY_CHANNEL_ID'), false)
  assert.equal(text.includes('phone'), false)
  assert.equal(text.includes('email'), false)
  assert.equal(text.includes('address'), false)
  assert.equal(text.includes('TradeInfo'), false)
  assert.equal(text.includes('TradeSha'), false)
}

function assertNoMarkPaid(decision: ReturnType<typeof resolveLinePayConfirmOutcome>) {
  assert.equal(decision.shouldMarkPaid, false)
}

test('confirm success with matching payload marks paid', () => {
  const decision = resolveLinePayConfirmOutcome({
    confirmResult: createConfirmResult(),
    expected,
  })

  assert.deepEqual(decision, {
    outcome: 'confirmed_paid',
    shouldMarkPaid: true,
    shouldQueryStatus: false,
    shouldQueryPaymentDetails: false,
    reason: 'confirm_success',
    safeToRetryConfirm: false,
  })
})

test('confirm success with transactionId mismatch does not mark paid', () => {
  const decision = resolveLinePayConfirmOutcome({
    confirmResult: createConfirmResult({ transactionId: '2026070700000000002' }),
    expected,
  })

  assert.equal(decision.outcome, 'mismatch')
  assert.equal(decision.reason, 'confirm_success_but_payload_mismatch')
  assertNoMarkPaid(decision)
})

test('confirm success with orderId mismatch does not mark paid', () => {
  const decision = resolveLinePayConfirmOutcome({
    confirmResult: createConfirmResult({ orderId: 'LP_product_order_other_20260707153000' }),
    expected,
  })

  assert.equal(decision.outcome, 'mismatch')
  assertNoMarkPaid(decision)
})

test('confirm success with amount mismatch does not mark paid', () => {
  const decision = resolveLinePayConfirmOutcome({
    confirmResult: createConfirmResult({ payInfo: [{ amount: 1499 }] }),
    expected,
  })

  assert.equal(decision.outcome, 'mismatch')
  assertNoMarkPaid(decision)
})

test('confirm success with currency mismatch does not mark paid', () => {
  const decision = resolveLinePayConfirmOutcome({
    confirmResult: createConfirmResult({ currency: 'JPY' }),
    expected,
  })

  assert.equal(decision.outcome, 'mismatch')
  assertNoMarkPaid(decision)
})

test('confirmError code 1172 requires status and payment details query', () => {
  const decision = resolveLinePayConfirmOutcome({
    confirmError: {
      code: '1172',
      message: 'confirm exception',
    },
    expected,
  })

  assert.equal(decision.outcome, 'needs_payment_details_check')
  assert.equal(decision.shouldQueryStatus, true)
  assert.equal(decision.shouldQueryPaymentDetails, true)
  assert.equal(decision.reason, 'confirm_exception_requires_status_query')
  assertNoMarkPaid(decision)
})

test('confirmError code 1198 requires status and payment details query', () => {
  const decision = resolveLinePayConfirmOutcome({
    confirmError: {
      code: '1198',
      message: 'confirm exception',
    },
    expected,
  })

  assert.equal(decision.outcome, 'needs_payment_details_check')
  assert.equal(decision.shouldQueryStatus, true)
  assert.equal(decision.shouldQueryPaymentDetails, true)
  assertNoMarkPaid(decision)
})

test('confirm timeout requires status and payment details query', () => {
  const decision = resolveLinePayConfirmOutcome({
    confirmError: {
      code: 'timeout',
      message: 'read timeout',
    },
    expected,
  })

  assert.equal(decision.outcome, 'confirm_ambiguous')
  assert.equal(decision.shouldQueryStatus, true)
  assert.equal(decision.shouldQueryPaymentDetails, true)
  assert.equal(decision.reason, 'confirm_timeout_requires_status_query')
  assertNoMarkPaid(decision)
})

test('request status authentication_pending does not mark paid', () => {
  const decision = resolveLinePayConfirmOutcome({
    requestStatusResult: createRequestStatus('authentication_pending'),
    expected,
  })

  assert.equal(decision.outcome, 'authentication_pending')
  assert.equal(decision.reason, 'request_status_not_paid')
  assertNoMarkPaid(decision)
})

test('request status authentication_completed does not mark paid and allows confirm', () => {
  const decision = resolveLinePayConfirmOutcome({
    requestStatusResult: createRequestStatus('authentication_completed'),
    expected,
  })

  assert.equal(decision.outcome, 'authentication_completed_needs_confirm')
  assert.equal(decision.safeToRetryConfirm, true)
  assertNoMarkPaid(decision)
})

test('request status authentication_canceled_or_expired does not mark paid', () => {
  const decision = resolveLinePayConfirmOutcome({
    requestStatusResult: createRequestStatus('authentication_canceled_or_expired'),
    expected,
  })

  assert.equal(decision.outcome, 'authentication_canceled_or_expired')
  assertNoMarkPaid(decision)
})

test('request status payment_failed does not mark paid', () => {
  const decision = resolveLinePayConfirmOutcome({
    requestStatusResult: createRequestStatus('payment_failed'),
    expected,
  })

  assert.equal(decision.outcome, 'payment_failed')
  assertNoMarkPaid(decision)
})

test('request status payment_completed without payment details asks for details', () => {
  const decision = resolveLinePayConfirmOutcome({
    requestStatusResult: createRequestStatus('payment_completed', '0123'),
    expected,
  })

  assert.equal(decision.outcome, 'needs_payment_details_check')
  assert.equal(decision.shouldQueryPaymentDetails, true)
  assert.equal(decision.reason, 'request_status_payment_completed_requires_details')
  assertNoMarkPaid(decision)
})

test('payment details matching transactionId orderId amount and currency marks paid', () => {
  const decision = resolveLinePayConfirmOutcome({
    paymentDetailsResult: createPaymentDetails(),
    expected,
  })

  assert.deepEqual(decision, {
    outcome: 'payment_completed',
    shouldMarkPaid: true,
    shouldQueryStatus: false,
    shouldQueryPaymentDetails: false,
    reason: 'payment_details_verified',
    safeToRetryConfirm: false,
  })
})

test('payment details transactionId mismatch returns mismatch', () => {
  const decision = resolveLinePayConfirmOutcome({
    paymentDetailsResult: createPaymentDetails({ transactionId: '2026070700000000002' }),
    expected,
  })

  assert.equal(decision.outcome, 'mismatch')
  assert.equal(decision.reason, 'payment_details_mismatch')
  assertNoMarkPaid(decision)
})

test('payment details orderId mismatch returns mismatch', () => {
  const decision = resolveLinePayConfirmOutcome({
    paymentDetailsResult: createPaymentDetails({ orderId: 'LP_product_order_other_20260707153000' }),
    expected,
  })

  assert.equal(decision.outcome, 'mismatch')
  assertNoMarkPaid(decision)
})

test('payment details amount mismatch returns mismatch', () => {
  const decision = resolveLinePayConfirmOutcome({
    paymentDetailsResult: createPaymentDetails({ payInfo: [{ amount: 1499 }] }),
    expected,
  })

  assert.equal(decision.outcome, 'mismatch')
  assertNoMarkPaid(decision)
})

test('payment details currency mismatch returns mismatch', () => {
  const decision = resolveLinePayConfirmOutcome({
    paymentDetailsResult: createPaymentDetails({ currency: 'JPY' }),
    expected,
  })

  assert.equal(decision.outcome, 'mismatch')
  assertNoMarkPaid(decision)
})

test('transactionId remains a string in inputs and no numeric conversion is required', () => {
  const decision = resolveLinePayConfirmOutcome({
    confirmResult: createConfirmResult(),
    expected,
  })

  assert.equal(typeof transactionId, 'string')
  assert.equal(decision.shouldMarkPaid, true)
})

test('outcome does not include secrets, env, contact fields, or NewebPay fields', () => {
  const decision = resolveLinePayConfirmOutcome({
    paymentDetailsResult: {
      returnCode: '0000',
      returnMessage: 'Success',
      info: [
        {
          transactionId,
          orderId,
          amount: 1500,
          currency: 'TWD',
          channelSecret: 'secret',
          channelId: 'channel',
          customerPhone: '0912345678',
          customerEmail: 'customer@example.com',
          shippingAddress: 'Taipei',
          TradeInfo: 'unsafe',
          TradeSha: 'unsafe',
        },
      ],
    },
    expected,
  })

  assertSafeOutcome(decision)
})

test('helper does not call LINE Pay API or global fetch', () => {
  const originalFetch = globalThis.fetch
  let called = false

  globalThis.fetch = (async () => {
    called = true
    throw new Error('global fetch must not be called')
  }) as typeof fetch

  try {
    resolveLinePayConfirmOutcome({
      confirmResult: createConfirmResult(),
      expected,
    })
    assert.equal(called, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('helper source does not update payments, update product_orders, or mark paid', () => {
  const source = String(resolveLinePayConfirmOutcome)

  assert.equal(source.includes('confirmLinePayPayment'), false)
  assert.equal(source.includes('getLinePayPaymentDetails'), false)
  assert.equal(source.includes('checkLinePayPaymentRequestStatus'), false)
  assert.equal(source.includes('fetch('), false)
  assert.equal(source.includes('update('), false)
  assert.equal(source.includes('product_orders'), false)
  assert.equal(source.includes('markPaid'), false)
})

async function runTests() {
  for (const { name, fn } of tests) {
    try {
      await fn()
      console.log(`✓ ${name}`)
    } catch (error) {
      console.error(`✗ ${name}`)
      throw error
    }
  }
}

void runTests()
