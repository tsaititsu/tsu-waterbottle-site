import assert from 'node:assert/strict'
import {
  handleProductOrderLinePayRequest,
  type ProductOrderLinePayPreflightContext,
  type ProductOrderLinePayReader,
} from './handler'
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

function payableOrder(
  overrides: Partial<ProductOrderLinePayPreflightContext> = {},
): ProductOrderLinePayPreflightContext {
  return {
    id: 'product-order-1',
    status: 'pending_payment',
    payment_status: 'pending',
    total_amount: 1500,
    currency: 'TWD',
    items: [
      {
        name: '人緣符',
        quantity: 1,
        amount: 1500,
      },
    ],
    ...overrides,
  }
}

function createReader(
  order: ProductOrderLinePayPreflightContext | null,
  calls: string[] = [],
): ProductOrderLinePayReader {
  return async (productOrderId) => {
    calls.push(productOrderId)
    return order
  }
}

async function callHandler({
  body = { productOrderId: 'product-order-1' },
  env = fullEnv,
  productOrderReader = createReader(payableOrder()),
}: {
  body?: unknown
  env?: LinePayServerEnv
  productOrderReader?: ProductOrderLinePayReader
} = {}) {
  return handleProductOrderLinePayRequest({
    request: createRequest(body),
    env,
    productOrderReader,
  })
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

test('body missing productOrderId returns missing_product_order_id', async () => {
  const response = await callHandler({ body: {} })
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, {
    ok: false,
    error: 'missing_product_order_id',
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

test('missing productOrderReader returns product_order_reader_missing', async () => {
  const response = await handleProductOrderLinePayRequest({
    request: createRequest({ productOrderId: 'product-order-1' }),
    env: fullEnv,
  })
  const json = await readJson(response)

  assert.equal(response.status, 500)
  assert.deepEqual(json, {
    ok: false,
    error: 'product_order_reader_missing',
  })
})

test('missing product order returns product_order_not_found', async () => {
  const response = await callHandler({
    productOrderReader: createReader(null),
  })
  const json = await readJson(response)

  assert.equal(response.status, 404)
  assert.deepEqual(json, {
    ok: false,
    error: 'product_order_not_found',
  })
})

test('productOrderReader failure returns safe lookup error', async () => {
  const response = await callHandler({
    productOrderReader: async () => {
      throw new Error('raw database detail')
    },
  })
  const json = await readJson(response)

  assert.equal(response.status, 500)
  assert.deepEqual(json, {
    ok: false,
    error: 'product_order_lookup_failed',
  })
})

test('not payable order status returns product_order_not_payable', async () => {
  const response = await callHandler({
    productOrderReader: createReader(payableOrder({ status: 'canceled' })),
  })
  const json = await readJson(response)

  assert.equal(response.status, 409)
  assert.deepEqual(json, {
    ok: false,
    error: 'product_order_not_payable',
  })
})

test('paid payment status returns product_order_already_paid', async () => {
  const response = await callHandler({
    productOrderReader: createReader(payableOrder({ payment_status: 'paid' })),
  })
  const json = await readJson(response)

  assert.equal(response.status, 409)
  assert.deepEqual(json, {
    ok: false,
    error: 'product_order_already_paid',
  })
})

test('non-positive total amount returns invalid_product_order_amount', async () => {
  const response = await callHandler({
    productOrderReader: createReader(payableOrder({ total_amount: 0 })),
  })
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, {
    ok: false,
    error: 'invalid_product_order_amount',
  })
})

test('decimal total amount returns invalid_product_order_amount', async () => {
  const response = await callHandler({
    productOrderReader: createReader(payableOrder({ total_amount: 1500.5 })),
  })
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, {
    ok: false,
    error: 'invalid_product_order_amount',
  })
})

test('non-TWD currency returns invalid_product_order_currency', async () => {
  const response = await callHandler({
    productOrderReader: createReader(payableOrder({ currency: 'JPY' })),
  })
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, {
    ok: false,
    error: 'invalid_product_order_currency',
  })
})

test('empty items returns invalid_product_order_items', async () => {
  const response = await callHandler({
    productOrderReader: createReader(payableOrder({ items: [] })),
  })
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, {
    ok: false,
    error: 'invalid_product_order_items',
  })
})

test('item subtotal mismatch returns invalid_product_order_items_total', async () => {
  const response = await callHandler({
    productOrderReader: createReader(
      payableOrder({
        total_amount: 1500,
        items: [
          {
            name: '人緣符',
            quantity: 1,
            amount: 1200,
          },
        ],
      }),
    ),
  })
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, {
    ok: false,
    error: 'invalid_product_order_items_total',
  })
})

test('preflight success returns not implemented with preflight true', async () => {
  const response = await callHandler()
  const json = await readJson(response)

  assert.equal(response.status, 501)
  assert.deepEqual(json, {
    ok: false,
    error: 'line_pay_product_order_request_not_implemented',
    preflight: true,
  })
})

test('preflight success calls productOrderReader with trimmed productOrderId', async () => {
  const calls: string[] = []
  const response = await callHandler({
    body: {
      productOrderId: '  product-order-1  ',
    },
    productOrderReader: createReader(payableOrder(), calls),
  })
  const json = await readJson(response)

  assert.equal(response.status, 501)
  assert.equal(json.preflight, true)
  assert.deepEqual(calls, ['product-order-1'])
})

test('enabled LINE Pay without channelId returns safe config error', async () => {
  const response = await callHandler({
    env: {
      ...fullEnv,
      LINE_PAY_CHANNEL_ID: '',
    },
  })
  const json = await readJson(response)

  assert.equal(response.status, 500)
  assert.deepEqual(json, {
    ok: false,
    error: 'missing_line_pay_channel_id',
  })
})

test('enabled LINE Pay without channelSecret returns safe config error', async () => {
  const response = await callHandler({
    env: {
      ...fullEnv,
      LINE_PAY_CHANNEL_SECRET: '',
    },
  })
  const json = await readJson(response)

  assert.equal(response.status, 500)
  assert.deepEqual(json, {
    ok: false,
    error: 'missing_line_pay_channel_secret',
  })
})

test('enabled LINE Pay with invalid confirmUrl returns safe config error', async () => {
  const response = await callHandler({
    env: {
      ...fullEnv,
      LINE_PAY_CONFIRM_URL: 'not-a-url',
    },
  })
  const json = await readJson(response)

  assert.equal(response.status, 500)
  assert.deepEqual(json, {
    ok: false,
    error: 'invalid_line_pay_confirm_url',
  })
})

test('enabled LINE Pay with invalid cancelUrl returns safe config error', async () => {
  const response = await callHandler({
    env: {
      ...fullEnv,
      LINE_PAY_CANCEL_URL: 'ftp://example.com/cancel',
    },
  })
  const json = await readJson(response)

  assert.equal(response.status, 500)
  assert.deepEqual(json, {
    ok: false,
    error: 'invalid_line_pay_cancel_url',
  })
})

test('response does not expose secret or customer fields', async () => {
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
    assert.equal(json.preflight, true)
    assert.equal(called, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('handler source does not include payment creation or mark paid behavior', async () => {
  const source = String(handleProductOrderLinePayRequest)

  assert.equal(source.includes('requestLinePayPayment'), false)
  assert.equal(source.includes('buildLinePayRequestPayload'), false)
  assert.equal(source.includes('buildLinePayOrderId'), false)
  assert.equal(source.includes('createPayment'), false)
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
