import assert from 'node:assert/strict'
import { handleProductOrderLinePayConfirmRedirect } from './handler'
import type { LinePayServerEnv } from '../../../../../lib/linePay'

const fullEnv: LinePayServerEnv = {
  NEXT_PUBLIC_ENABLE_LINE_PAY: 'true',
  LINE_PAY_ENV: 'sandbox',
  LINE_PAY_CHANNEL_ID: 'fake_channel_id',
  LINE_PAY_CHANNEL_SECRET: 'fake_channel_secret_for_tests',
  LINE_PAY_CONFIRM_URL: 'https://example.com/api/product-orders/line-pay/confirm',
  LINE_PAY_CANCEL_URL: 'https://example.com/api/product-orders/line-pay/cancel',
}
const orderId = 'LP_product_order_product-order-1_20260707153000'
const transactionId = '2026070700000000001'
const tests: Array<{ name: string; fn: () => Promise<void> }> = []

function test(name: string, fn: () => Promise<void>) {
  tests.push({ name, fn })
}

function createRequest(query = `orderId=${orderId}&transactionId=${transactionId}`, method = 'GET') {
  return new Request(`https://example.com/api/product-orders/line-pay/confirm?${query}`, {
    method,
  })
}

async function callHandler({
  request = createRequest(),
  env = fullEnv,
}: {
  request?: Request
  env?: LinePayServerEnv
} = {}) {
  return handleProductOrderLinePayConfirmRedirect({
    request,
    env,
  })
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>
}

function assertSafeResponse(payload: Record<string, unknown>) {
  const text = JSON.stringify(payload)

  assert.equal(text.includes('channelSecret'), false)
  assert.equal(text.includes('fake_channel_secret_for_tests'), false)
  assert.equal(text.includes('channelId'), false)
  assert.equal(text.includes('fake_channel_id'), false)
  assert.equal(text.includes('LINE_PAY_CHANNEL_SECRET'), false)
  assert.equal(text.includes('LINE_PAY_CHANNEL_ID'), false)
  assert.equal(text.includes('TradeInfo'), false)
  assert.equal(text.includes('TradeSha'), false)
  assert.equal(text.includes('phone'), false)
  assert.equal(text.includes('email'), false)
  assert.equal(text.includes('address'), false)
}

test('non-GET returns method_not_allowed', async () => {
  const response = await callHandler({
    request: createRequest(`orderId=${orderId}&transactionId=${transactionId}`, 'POST'),
  })
  const json = await readJson(response)

  assert.equal(response.status, 405)
  assert.deepEqual(json, {
    ok: false,
    error: 'method_not_allowed',
  })
})

test('disabled LINE Pay returns line_pay_disabled', async () => {
  const response = await callHandler({
    env: {
      NEXT_PUBLIC_ENABLE_LINE_PAY: 'false',
    },
  })
  const json = await readJson(response)

  assert.equal(response.status, 404)
  assert.deepEqual(json, {
    ok: false,
    error: 'line_pay_disabled',
  })
})

test('missing orderId returns missing_line_pay_order_id', async () => {
  const response = await callHandler({
    request: createRequest(`transactionId=${transactionId}`),
  })
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, {
    ok: false,
    error: 'missing_line_pay_order_id',
  })
})

test('blank orderId returns missing_line_pay_order_id', async () => {
  const response = await callHandler({
    request: createRequest(`orderId=%20%20&transactionId=${transactionId}`),
  })
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, {
    ok: false,
    error: 'missing_line_pay_order_id',
  })
})

test('invalid orderId returns invalid_line_pay_order_id', async () => {
  const response = await callHandler({
    request: createRequest(`orderId=bad/order&transactionId=${transactionId}`),
  })
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, {
    ok: false,
    error: 'invalid_line_pay_order_id',
  })
})

test('missing transactionId returns missing_line_pay_transaction_id', async () => {
  const response = await callHandler({
    request: createRequest(`orderId=${orderId}`),
  })
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, {
    ok: false,
    error: 'missing_line_pay_transaction_id',
  })
})

test('blank transactionId returns missing_line_pay_transaction_id', async () => {
  const response = await callHandler({
    request: createRequest(`orderId=${orderId}&transactionId=%20%20`),
  })
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, {
    ok: false,
    error: 'missing_line_pay_transaction_id',
  })
})

test('non-numeric transactionId returns invalid_line_pay_transaction_id', async () => {
  const response = await callHandler({
    request: createRequest(`orderId=${orderId}&transactionId=not-a-number`),
  })
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, {
    ok: false,
    error: 'invalid_line_pay_transaction_id',
  })
})

test('successful parse returns not implemented with received values', async () => {
  const response = await callHandler()
  const json = await readJson(response)

  assert.equal(response.status, 501)
  assert.deepEqual(json, {
    ok: false,
    error: 'line_pay_product_order_confirm_not_implemented',
    received: true,
    orderId,
    transactionId,
  })
  assert.equal(typeof json.transactionId, 'string')
})

test('response does not expose secret, env, or customer fields', async () => {
  const response = await callHandler()
  const json = await readJson(response)

  assertSafeResponse(json)
})

test('handler does not call LINE Pay API or global fetch', async () => {
  const originalFetch = globalThis.fetch
  let called = false

  globalThis.fetch = (async () => {
    called = true
    throw new Error('global fetch must not be called')
  }) as typeof fetch

  try {
    const response = await callHandler()
    const json = await readJson(response)

    assert.equal(response.status, 501)
    assert.equal(json.received, true)
    assert.equal(called, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('handler source does not include DB update, confirm API, or mark paid behavior', () => {
  const source = String(handleProductOrderLinePayConfirmRedirect)

  assert.equal(source.includes('confirmLinePayPayment'), false)
  assert.equal(source.includes('requestLinePayPayment'), false)
  assert.equal(source.includes('from('), false)
  assert.equal(source.includes('update('), false)
  assert.equal(source.includes('markPaid'), false)
  assert.equal(source.includes('product_orders'), false)
  assert.equal(source.includes('payments'), false)
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
