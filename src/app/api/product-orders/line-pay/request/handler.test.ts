import assert from 'node:assert/strict'
import { handleProductOrderLinePayRequest } from './handler'
import type { LinePayServerEnv } from '../../../../../lib/linePay'

const fullEnv: LinePayServerEnv = {
  NEXT_PUBLIC_ENABLE_LINE_PAY: 'true',
  LINE_PAY_ENV: 'sandbox',
  LINE_PAY_CHANNEL_ID: 'fake_channel_id',
  LINE_PAY_CHANNEL_SECRET: 'fake_channel_secret_for_tests',
  LINE_PAY_CONFIRM_URL: 'https://example.com/api/payments/line-pay/confirm',
  LINE_PAY_CANCEL_URL: 'https://example.com/payment/cancel',
}

const tests: Array<{ name: string; fn: () => Promise<void> }> = []

function test(name: string, fn: () => Promise<void>) {
  tests.push({ name, fn })
}

function createRequest(body: unknown, method = 'POST') {
  return new Request('https://example.com/api/product-orders/line-pay/request', {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: method === 'GET' ? undefined : JSON.stringify(body),
  })
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>
}

function assertSafeResponse(payload: Record<string, unknown>) {
  const text = JSON.stringify(payload)

  assert.equal(text.includes('channelSecret'), false)
  assert.equal(text.includes('fake_channel_secret_for_tests'), false)
  assert.equal(text.includes('LINE_PAY_CHANNEL_SECRET'), false)
  assert.equal(text.includes('LINE_PAY_CHANNEL_ID'), false)
  assert.equal(text.includes('fake_channel_id'), false)
  assert.equal(text.includes('TradeInfo'), false)
  assert.equal(text.includes('TradeSha'), false)
  assert.equal(text.includes('phone'), false)
  assert.equal(text.includes('email'), false)
  assert.equal(text.includes('address'), false)
}

async function callHandler(body: unknown, env: LinePayServerEnv = fullEnv) {
  return handleProductOrderLinePayRequest({
    request: createRequest(body),
    env,
  })
}

test('body missing productOrderId returns missing_product_order_id', async () => {
  const response = await callHandler({})
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, {
    ok: false,
    error: 'missing_product_order_id',
  })
})

test('empty productOrderId returns missing_product_order_id', async () => {
  const response = await callHandler({ productOrderId: '   ' })
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, {
    ok: false,
    error: 'missing_product_order_id',
  })
})

test('productOrderId is trimmed before feature flag handling', async () => {
  const response = await callHandler({ productOrderId: '  product-order-1  ' })
  const json = await readJson(response)

  assert.equal(response.status, 501)
  assert.deepEqual(json, {
    ok: false,
    error: 'line_pay_product_order_request_not_implemented',
  })
})

test('disabled LINE Pay returns line_pay_disabled', async () => {
  const response = await callHandler(
    { productOrderId: 'product-order-1' },
    {
      NEXT_PUBLIC_ENABLE_LINE_PAY: 'false',
    },
  )
  const json = await readJson(response)

  assert.equal(response.status, 404)
  assert.deepEqual(json, {
    ok: false,
    error: 'line_pay_disabled',
  })
})

test('enabled LINE Pay returns not implemented skeleton response', async () => {
  const response = await callHandler({ productOrderId: 'product-order-1' })
  const json = await readJson(response)

  assert.equal(response.status, 501)
  assert.deepEqual(json, {
    ok: false,
    error: 'line_pay_product_order_request_not_implemented',
  })
})

test('enabled LINE Pay without channelId returns safe config error', async () => {
  const response = await callHandler(
    { productOrderId: 'product-order-1' },
    {
      ...fullEnv,
      LINE_PAY_CHANNEL_ID: '',
    },
  )
  const json = await readJson(response)

  assert.equal(response.status, 500)
  assert.deepEqual(json, {
    ok: false,
    error: 'missing_line_pay_channel_id',
  })
})

test('enabled LINE Pay without channelSecret returns safe config error', async () => {
  const response = await callHandler(
    { productOrderId: 'product-order-1' },
    {
      ...fullEnv,
      LINE_PAY_CHANNEL_SECRET: '',
    },
  )
  const json = await readJson(response)

  assert.equal(response.status, 500)
  assert.deepEqual(json, {
    ok: false,
    error: 'missing_line_pay_channel_secret',
  })
})

test('enabled LINE Pay with invalid confirmUrl returns safe config error', async () => {
  const response = await callHandler(
    { productOrderId: 'product-order-1' },
    {
      ...fullEnv,
      LINE_PAY_CONFIRM_URL: 'not-a-url',
    },
  )
  const json = await readJson(response)

  assert.equal(response.status, 500)
  assert.deepEqual(json, {
    ok: false,
    error: 'invalid_line_pay_confirm_url',
  })
})

test('enabled LINE Pay with invalid cancelUrl returns safe config error', async () => {
  const response = await callHandler(
    { productOrderId: 'product-order-1' },
    {
      ...fullEnv,
      LINE_PAY_CANCEL_URL: 'ftp://example.com/cancel',
    },
  )
  const json = await readJson(response)

  assert.equal(response.status, 500)
  assert.deepEqual(json, {
    ok: false,
    error: 'invalid_line_pay_cancel_url',
  })
})

test('response does not expose secret or customer fields', async () => {
  const response = await callHandler({ productOrderId: 'product-order-1' })
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
    const response = await callHandler({ productOrderId: 'product-order-1' })
    const json = await readJson(response)

    assert.equal(response.status, 501)
    assert.equal(json.error, 'line_pay_product_order_request_not_implemented')
    assert.equal(called, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('handler source does not include DB update or mark paid behavior', async () => {
  const source = String(handleProductOrderLinePayRequest)

  assert.equal(source.includes('requestLinePayPayment'), false)
  assert.equal(source.includes('createPayment'), false)
  assert.equal(source.includes('product_orders'), false)
  assert.equal(source.includes('update'), false)
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
