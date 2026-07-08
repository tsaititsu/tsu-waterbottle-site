import assert from 'node:assert/strict'
import {
  buildLinePayCartRedirectUrl,
  redirectLinePayHandlerResponseToCart,
  resolveLinePayCancelCartRedirectStatus,
  resolveLinePayConfirmCartRedirectStatus,
  type LinePayCartRedirectStatus,
} from './redirect'

const tests: Array<{ name: string; fn: () => Promise<void> | void }> = []

function test(name: string, fn: () => Promise<void> | void) {
  tests.push({ name, fn })
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

function createRequest() {
  return new Request(
    'https://example.com/api/product-orders/line-pay/confirm?orderId=LP_product_order_1_20260708&transactionId=2026070800000000001',
  )
}

function assertSafeRedirectUrl(url: string) {
  for (const forbidden of [
    'transactionId',
    'orderId',
    'paymentId',
    'channelSecret',
    'channelId',
    'TradeInfo',
    'TradeSha',
    'phone',
    'email',
    'address',
  ]) {
    assert.equal(url.includes(forbidden), false, forbidden)
  }
}

async function assertRedirect(payload: unknown, resolver: (payload: unknown) => LinePayCartRedirectStatus, expected: string) {
  const response = await redirectLinePayHandlerResponseToCart({
    request: createRequest(),
    response: jsonResponse(payload),
    resolveStatus: resolver,
  })
  const location = response.headers.get('location') ?? ''

  assert.equal(response.status, 303)
  assert.equal(location, `https://example.com/cart?linePay=${expected}`)
  assertSafeRedirectUrl(location)
}

test('buildLinePayCartRedirectUrl only writes allowed linePay status', () => {
  assert.equal(String(buildLinePayCartRedirectUrl({ baseUrl: 'https://example.com/from', status: 'success' })), 'https://example.com/cart?linePay=success')
  assert.equal(String(buildLinePayCartRedirectUrl({ baseUrl: 'https://example.com/from', status: 'not-safe' })), 'https://example.com/cart?linePay=error')
})

test('confirm markedPaid=true redirects to success', async () => {
  await assertRedirect(
    {
      ok: true,
      confirmed: true,
      markedPaid: true,
      paymentId: 'payment-1',
      orderId: 'LP_product_order_1_20260708',
      transactionId: '2026070800000000001',
    },
    resolveLinePayConfirmCartRedirectStatus,
    'success',
  )
})

test('confirm product_order_already_paid redirects to success', async () => {
  await assertRedirect(
    {
      ok: false,
      error: 'product_order_already_paid',
    },
    resolveLinePayConfirmCartRedirectStatus,
    'success',
  )
})

test('confirm unsafe pending or ambiguous outcome redirects to pending', async () => {
  await assertRedirect(
    {
      ok: false,
      confirmed: false,
      markedPaid: false,
      outcome: 'confirm_ambiguous',
    },
    resolveLinePayConfirmCartRedirectStatus,
    'pending',
  )
})

test('confirm preflight or confirm error redirects to error', async () => {
  await assertRedirect(
    {
      ok: false,
      error: 'line_pay_confirm_failed',
    },
    resolveLinePayConfirmCartRedirectStatus,
    'error',
  )
})

test('cancel recorded redirects to canceled', async () => {
  await assertRedirect(
    {
      ok: false,
      canceled: true,
      provider: 'line_pay',
      metadataUpdated: true,
      paymentId: 'payment-1',
      orderId: 'LP_product_order_1_20260708',
      transactionId: '2026070800000000001',
    },
    resolveLinePayCancelCartRedirectStatus,
    'canceled',
  )
})

test('cancel lookup key missing still redirects to canceled', async () => {
  await assertRedirect(
    {
      ok: false,
      canceled: true,
      provider: 'line_pay',
      metadataUpdated: false,
      orderId: null,
      transactionId: null,
      error: 'line_pay_cancel_lookup_key_missing',
    },
    resolveLinePayCancelCartRedirectStatus,
    'canceled',
  )
})

test('cancel metadata update failure redirects to error', async () => {
  await assertRedirect(
    {
      ok: false,
      error: 'line_pay_cancel_metadata_update_failed',
    },
    resolveLinePayCancelCartRedirectStatus,
    'error',
  )
})

test('redirect helper falls back to error for non-json responses', async () => {
  const response = await redirectLinePayHandlerResponseToCart({
    request: createRequest(),
    response: new Response('not json'),
    resolveStatus: resolveLinePayConfirmCartRedirectStatus,
  })
  const location = response.headers.get('location') ?? ''

  assert.equal(location, 'https://example.com/cart?linePay=error')
  assertSafeRedirectUrl(location)
})

test('redirect helper source does not add payment mutation or external payment calls', () => {
  const source = `${String(resolveLinePayConfirmCartRedirectStatus)}\n${String(resolveLinePayCancelCartRedirectStatus)}\n${String(redirectLinePayHandlerResponseToCart)}`

  assert.equal(source.includes('confirmLinePayPayment'), false)
  assert.equal(source.includes('requestLinePayPayment'), false)
  assert.equal(source.includes('markPaid'), false)
  assert.equal(source.includes('productOrderPaidSyncer'), false)
  assert.equal(source.includes('fetch('), false)
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
