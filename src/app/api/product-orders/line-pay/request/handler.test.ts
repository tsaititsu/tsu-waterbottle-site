import assert from 'node:assert/strict'
import {
  handleProductOrderLinePayRequest,
  type ProductOrderLinePayPaymentCreator,
  type ProductOrderLinePayPaymentCreatorInput,
  type ProductOrderLinePayPreflightContext,
  type ProductOrderLinePayReader,
} from './handler'
import { extractSourceIdFromLinePayOrderId, type LinePayServerEnv } from '../../../../../lib/linePay'

const fullEnv: LinePayServerEnv = {
  NEXT_PUBLIC_ENABLE_LINE_PAY: 'true',
  LINE_PAY_ENV: 'sandbox',
  LINE_PAY_CHANNEL_ID: 'fake_channel_id',
  LINE_PAY_CHANNEL_SECRET: 'fake_channel_secret_for_tests',
  LINE_PAY_CONFIRM_URL: 'https://example.com/api/payments/line-pay/confirm',
  LINE_PAY_CANCEL_URL: 'https://example.com/payment/cancel',
}
const dryRunTimestamp = '20260707153000'

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
    payment_id: null,
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

function createPaymentCreator(
  calls: ProductOrderLinePayPaymentCreatorInput[] = [],
  paymentId = 'payment-line-pay-1',
): ProductOrderLinePayPaymentCreator {
  return async (input) => {
    calls.push(input)
    return {
      paymentId,
      merchantOrderNo: input.merchantOrderNo,
    }
  }
}

async function callHandler({
  body = { productOrderId: 'product-order-1' },
  env = fullEnv,
  productOrderReader = createReader(payableOrder()),
  paymentCreator = createPaymentCreator(),
  now = dryRunTimestamp,
}: {
  body?: unknown
  env?: LinePayServerEnv
  productOrderReader?: ProductOrderLinePayReader
  paymentCreator?: ProductOrderLinePayPaymentCreator
  now?: number | string
} = {}) {
  return handleProductOrderLinePayRequest({
    request: createRequest(body),
    env,
    productOrderReader,
    paymentCreator,
    now,
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
  assert.equal(text.includes('transactionId'), false)
  assert.equal(text.includes('paymentUrl'), false)
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
  const paymentCalls: ProductOrderLinePayPaymentCreatorInput[] = []
  const response = await callHandler({
    env: {
      NEXT_PUBLIC_ENABLE_LINE_PAY: 'false',
    },
    paymentCreator: createPaymentCreator(paymentCalls),
  })
  const json = await readJson(response)

  assert.equal(response.status, 404)
  assert.deepEqual(json, {
    ok: false,
    error: 'line_pay_disabled',
  })
  assert.equal(paymentCalls.length, 0)
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
  const paymentCalls: ProductOrderLinePayPaymentCreatorInput[] = []
  const response = await callHandler({
    productOrderReader: createReader(null),
    paymentCreator: createPaymentCreator(paymentCalls),
  })
  const json = await readJson(response)

  assert.equal(response.status, 404)
  assert.deepEqual(json, {
    ok: false,
    error: 'product_order_not_found',
  })
  assert.equal(paymentCalls.length, 0)
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
  const paymentCalls: ProductOrderLinePayPaymentCreatorInput[] = []
  const response = await callHandler({
    productOrderReader: createReader(payableOrder({ status: 'canceled' })),
    paymentCreator: createPaymentCreator(paymentCalls),
  })
  const json = await readJson(response)

  assert.equal(response.status, 409)
  assert.deepEqual(json, {
    ok: false,
    error: 'product_order_not_payable',
  })
  assert.equal(paymentCalls.length, 0)
})

test('paid payment status returns product_order_already_paid', async () => {
  const paymentCalls: ProductOrderLinePayPaymentCreatorInput[] = []
  const response = await callHandler({
    productOrderReader: createReader(payableOrder({ payment_status: 'paid' })),
    paymentCreator: createPaymentCreator(paymentCalls),
  })
  const json = await readJson(response)

  assert.equal(response.status, 409)
  assert.deepEqual(json, {
    ok: false,
    error: 'product_order_already_paid',
  })
  assert.equal(paymentCalls.length, 0)
})

test('already linked payment returns product_order_not_payable before payment creation', async () => {
  const paymentCalls: ProductOrderLinePayPaymentCreatorInput[] = []
  const response = await callHandler({
    productOrderReader: createReader(payableOrder({ payment_id: 'existing-payment-id' })),
    paymentCreator: createPaymentCreator(paymentCalls),
  })
  const json = await readJson(response)

  assert.equal(response.status, 409)
  assert.deepEqual(json, {
    ok: false,
    error: 'product_order_not_payable',
  })
  assert.equal(paymentCalls.length, 0)
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

test('preflight success creates pending payment and summary response', async () => {
  const response = await callHandler()
  const json = await readJson(response)
  const orderId = String(json.orderId)

  assert.equal(response.status, 501)
  assert.equal(json.ok, false)
  assert.equal(json.error, 'line_pay_product_order_request_not_implemented')
  assert.equal(json.preflight, true)
  assert.equal(json.dryRun, true)
  assert.equal(json.pendingPayment, true)
  assert.equal(json.paymentId, 'payment-line-pay-1')
  assert.equal(orderId, `LP_product_order_product-order-1_${dryRunTimestamp}`)
  assert.equal(json.amount, 1500)
  assert.equal(json.currency, 'TWD')
  assert.equal(json.itemCount, 1)
})

test('dry-run orderId contains product_order source type, trimmed sourceId, and fixed timestamp', async () => {
  const response = await callHandler({
    body: {
      productOrderId: '  product-order-1  ',
    },
  })
  const json = await readJson(response)
  const parsed = extractSourceIdFromLinePayOrderId(json.orderId)

  assert.equal(parsed.sourceType, 'product_order')
  assert.equal(parsed.sourceId, 'product-order-1')
  assert.equal(parsed.timestamp, dryRunTimestamp)
})

test('dry-run request payload summary uses order amount, TWD currency, and item count', async () => {
  const response = await callHandler({
    productOrderReader: createReader(
      payableOrder({
        total_amount: 2000,
        items: [
          {
            name: '人緣符',
            quantity: 1,
            amount: 1500,
          },
          {
            name: '開運小物',
            quantity: 1,
            amount: 500,
          },
        ],
      }),
    ),
  })
  const json = await readJson(response)

  assert.equal(response.status, 501)
  assert.equal(json.dryRun, true)
  assert.equal(json.pendingPayment, true)
  assert.equal(json.amount, 2000)
  assert.equal(json.currency, 'TWD')
  assert.equal(json.itemCount, 2)
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
  assert.equal(json.dryRun, true)
  assert.equal(json.pendingPayment, true)
  assert.deepEqual(calls, ['product-order-1'])
})

test('preflight success calls paymentCreator with line_pay payment input', async () => {
  const paymentCalls: ProductOrderLinePayPaymentCreatorInput[] = []
  const response = await callHandler({
    paymentCreator: createPaymentCreator(paymentCalls, 'payment-line-pay-2'),
  })
  const json = await readJson(response)

  assert.equal(response.status, 501)
  assert.equal(json.paymentId, 'payment-line-pay-2')
  assert.equal(paymentCalls.length, 1)
  assert.equal(paymentCalls[0].provider, 'line_pay')
  assert.equal(paymentCalls[0].amount, 1500)
  assert.equal(paymentCalls[0].currency, 'TWD')
  assert.equal(paymentCalls[0].merchantOrderNo, `LP_product_order_product-order-1_${dryRunTimestamp}`)
  assert.deepEqual(paymentCalls[0].metadata, {
    linePay: {
      orderId: `LP_product_order_product-order-1_${dryRunTimestamp}`,
      sourceType: 'product_order',
      sourceId: 'product-order-1',
    },
  })
})

test('paymentCreator missing returns safe error after preflight', async () => {
  const response = await handleProductOrderLinePayRequest({
    request: createRequest({ productOrderId: 'product-order-1' }),
    env: fullEnv,
    productOrderReader: createReader(payableOrder()),
    now: dryRunTimestamp,
  })
  const json = await readJson(response)

  assert.equal(response.status, 500)
  assert.deepEqual(json, {
    ok: false,
    error: 'product_order_payment_creator_missing',
  })
})

test('paymentCreator failure returns safe create failed error', async () => {
  const response = await callHandler({
    paymentCreator: async () => {
      throw new Error('raw payment insert detail')
    },
  })
  const json = await readJson(response)

  assert.equal(response.status, 500)
  assert.deepEqual(json, {
    ok: false,
    error: 'product_order_line_pay_payment_create_failed',
  })
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

test('response does not expose full LINE Pay request payload', async () => {
  const response = await callHandler()
  const json = await readJson(response)

  assert.equal('packages' in json, false)
  assert.equal('products' in json, false)
  assert.equal('redirectUrls' in json, false)
  assert.equal('confirmUrl' in json, false)
  assert.equal('cancelUrl' in json, false)
  assert.equal('transactionId' in json, false)
  assert.equal('paymentUrl' in json, false)
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
  assert.equal(source.includes('update'), false)
  assert.equal(source.includes('markPaid'), false)
  assert.equal(source.includes('transactionId'), false)
  assert.equal(source.includes('paymentUrl'), false)
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
