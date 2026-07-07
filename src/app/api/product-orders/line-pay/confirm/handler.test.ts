import assert from 'node:assert/strict'
import {
  handleProductOrderLinePayConfirmRedirect,
  type ProductOrderLinePayConfirmPaymentContext,
  type ProductOrderLinePayConfirmProductOrderContext,
} from './handler'
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
const paymentId = 'payment-line-pay-1'
const productOrderId = 'product-order-1'
const tests: Array<{ name: string; fn: () => Promise<void> | void }> = []

function test(name: string, fn: () => Promise<void> | void) {
  tests.push({ name, fn })
}

function createRequest(query = `orderId=${orderId}&transactionId=${transactionId}`, method = 'GET') {
  return new Request(`https://example.com/api/product-orders/line-pay/confirm?${query}`, {
    method,
  })
}

function createPayment(
  override: Partial<ProductOrderLinePayConfirmPaymentContext> = {},
): ProductOrderLinePayConfirmPaymentContext {
  return {
    id: paymentId,
    provider: 'line_pay',
    status: 'pending',
    amount: 1500,
    currency: 'TWD',
    merchant_order_no: orderId,
    raw_payload: {
      linePay: {
        orderId,
        sourceType: 'product_order',
        sourceId: productOrderId,
        transactionId,
        paymentUrl: {
          web: 'https://line-pay.example.test/pay',
        },
        request: {
          returnCode: '0000',
          returnMessage: 'Success.',
        },
      },
    },
    ...override,
  }
}

function createProductOrder(
  override: Partial<ProductOrderLinePayConfirmProductOrderContext> = {},
): ProductOrderLinePayConfirmProductOrderContext {
  return {
    id: productOrderId,
    status: 'pending_payment',
    payment_status: 'pending',
    payment_id: paymentId,
    total_amount: 1500,
    currency: 'TWD',
    ...override,
  }
}

function createPaymentReader(
  payment: ProductOrderLinePayConfirmPaymentContext | null = createPayment(),
  calls: Array<{ orderId: string }> = [],
) {
  return async (input: { orderId: string }) => {
    calls.push(input)
    return payment
  }
}

function createProductOrderReader(
  order: ProductOrderLinePayConfirmProductOrderContext | null = createProductOrder(),
  calls: Array<{ productOrderId: string }> = [],
) {
  return async (input: { productOrderId: string }) => {
    calls.push(input)
    return order
  }
}

async function callHandler({
  request = createRequest(),
  env = fullEnv,
  ...input
}: {
  request?: Request
  env?: LinePayServerEnv
  paymentReader?: Parameters<typeof handleProductOrderLinePayConfirmRedirect>[0]['paymentReader']
  productOrderReader?: Parameters<typeof handleProductOrderLinePayConfirmRedirect>[0]['productOrderReader']
} = {}) {
  return handleProductOrderLinePayConfirmRedirect({
    request,
    env,
    paymentReader: 'paymentReader' in input ? input.paymentReader : createPaymentReader(),
    productOrderReader: 'productOrderReader' in input ? input.productOrderReader : createProductOrderReader(),
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

async function assertErrorResponse(
  input: Parameters<typeof callHandler>[0],
  expectedStatus: number,
  expectedError: string,
) {
  const response = await callHandler(input)
  const json = await readJson(response)

  assert.equal(response.status, expectedStatus)
  assert.deepEqual(json, {
    ok: false,
    error: expectedError,
  })
  assertSafeResponse(json)
}

test('non-GET returns method_not_allowed', async () => {
  await assertErrorResponse(
    {
      request: createRequest(`orderId=${orderId}&transactionId=${transactionId}`, 'POST'),
    },
    405,
    'method_not_allowed',
  )
})

test('disabled LINE Pay returns line_pay_disabled', async () => {
  await assertErrorResponse(
    {
      env: {
        NEXT_PUBLIC_ENABLE_LINE_PAY: 'false',
      },
    },
    404,
    'line_pay_disabled',
  )
})

test('missing orderId returns missing_line_pay_order_id', async () => {
  await assertErrorResponse(
    {
      request: createRequest(`transactionId=${transactionId}`),
    },
    400,
    'missing_line_pay_order_id',
  )
})

test('blank orderId returns missing_line_pay_order_id', async () => {
  await assertErrorResponse(
    {
      request: createRequest(`orderId=%20%20&transactionId=${transactionId}`),
    },
    400,
    'missing_line_pay_order_id',
  )
})

test('invalid orderId returns invalid_line_pay_order_id', async () => {
  await assertErrorResponse(
    {
      request: createRequest(`orderId=bad/order&transactionId=${transactionId}`),
    },
    400,
    'invalid_line_pay_order_id',
  )
})

test('missing transactionId returns missing_line_pay_transaction_id', async () => {
  await assertErrorResponse(
    {
      request: createRequest(`orderId=${orderId}`),
    },
    400,
    'missing_line_pay_transaction_id',
  )
})

test('blank transactionId returns missing_line_pay_transaction_id', async () => {
  await assertErrorResponse(
    {
      request: createRequest(`orderId=${orderId}&transactionId=%20%20`),
    },
    400,
    'missing_line_pay_transaction_id',
  )
})

test('non-numeric transactionId returns invalid_line_pay_transaction_id', async () => {
  await assertErrorResponse(
    {
      request: createRequest(`orderId=${orderId}&transactionId=not-a-number`),
    },
    400,
    'invalid_line_pay_transaction_id',
  )
})

test('missing paymentReader returns line_pay_confirm_payment_reader_missing', async () => {
  await assertErrorResponse(
    {
      paymentReader: undefined,
    },
    500,
    'line_pay_confirm_payment_reader_missing',
  )
})

test('missing productOrderReader returns line_pay_confirm_product_order_reader_missing', async () => {
  await assertErrorResponse(
    {
      productOrderReader: undefined,
    },
    500,
    'line_pay_confirm_product_order_reader_missing',
  )
})

test('payment not found returns line_pay_payment_not_found', async () => {
  await assertErrorResponse(
    {
      paymentReader: createPaymentReader(null),
    },
    404,
    'line_pay_payment_not_found',
  )
})

test('payment provider mismatch returns line_pay_payment_provider_mismatch', async () => {
  await assertErrorResponse(
    {
      paymentReader: createPaymentReader(createPayment({ provider: 'newebpay' })),
    },
    409,
    'line_pay_payment_provider_mismatch',
  )
})

test('payment not pending returns line_pay_payment_not_pending', async () => {
  await assertErrorResponse(
    {
      paymentReader: createPaymentReader(createPayment({ status: 'paid' })),
    },
    409,
    'line_pay_payment_not_pending',
  )
})

test('payment merchant order mismatch returns line_pay_payment_order_id_mismatch', async () => {
  await assertErrorResponse(
    {
      paymentReader: createPaymentReader(createPayment({ merchant_order_no: 'LP_product_order_other_1' })),
    },
    409,
    'line_pay_payment_order_id_mismatch',
  )
})

test('raw payload orderId mismatch returns line_pay_payment_order_id_mismatch', async () => {
  await assertErrorResponse(
    {
      paymentReader: createPaymentReader(
        createPayment({
          raw_payload: {
            linePay: {
              orderId: 'LP_product_order_other_1',
              sourceType: 'product_order',
              sourceId: productOrderId,
              transactionId,
            },
          },
        }),
      ),
    },
    409,
    'line_pay_payment_order_id_mismatch',
  )
})

test('transactionId mismatch returns line_pay_payment_transaction_id_mismatch', async () => {
  await assertErrorResponse(
    {
      paymentReader: createPaymentReader(
        createPayment({
          raw_payload: {
            linePay: {
              orderId,
              sourceType: 'product_order',
              sourceId: productOrderId,
              transactionId: '2026070700000000002',
            },
          },
        }),
      ),
    },
    409,
    'line_pay_payment_transaction_id_mismatch',
  )
})

test('source type mismatch returns line_pay_payment_source_type_mismatch', async () => {
  await assertErrorResponse(
    {
      paymentReader: createPaymentReader(
        createPayment({
          raw_payload: {
            linePay: {
              orderId,
              sourceType: 'booking',
              sourceId: productOrderId,
              transactionId,
            },
          },
        }),
      ),
    },
    409,
    'line_pay_payment_source_type_mismatch',
  )
})

test('missing sourceId returns line_pay_payment_source_id_missing', async () => {
  await assertErrorResponse(
    {
      paymentReader: createPaymentReader(
        createPayment({
          raw_payload: {
            linePay: {
              orderId,
              sourceType: 'product_order',
              sourceId: '',
              transactionId,
            },
          },
        }),
      ),
    },
    409,
    'line_pay_payment_source_id_missing',
  )
})

test('invalid payment amount returns invalid_line_pay_confirm_amount', async () => {
  await assertErrorResponse(
    {
      paymentReader: createPaymentReader(createPayment({ amount: 0 })),
    },
    400,
    'invalid_line_pay_confirm_amount',
  )
})

test('payment currency mismatch returns line_pay_payment_currency_mismatch', async () => {
  await assertErrorResponse(
    {
      paymentReader: createPaymentReader(createPayment({ currency: 'USD' })),
    },
    409,
    'line_pay_payment_currency_mismatch',
  )
})

test('product order not found returns product_order_not_found', async () => {
  await assertErrorResponse(
    {
      productOrderReader: createProductOrderReader(null),
    },
    404,
    'product_order_not_found',
  )
})

test('product order payment_id mismatch returns line_pay_payment_product_order_mismatch', async () => {
  await assertErrorResponse(
    {
      productOrderReader: createProductOrderReader(createProductOrder({ payment_id: 'other-payment' })),
    },
    409,
    'line_pay_payment_product_order_mismatch',
  )
})

test('product order already paid returns product_order_already_paid', async () => {
  await assertErrorResponse(
    {
      productOrderReader: createProductOrderReader(createProductOrder({ payment_status: 'paid' })),
    },
    409,
    'product_order_already_paid',
  )
})

test('product order status not payable returns product_order_not_payable', async () => {
  await assertErrorResponse(
    {
      productOrderReader: createProductOrderReader(createProductOrder({ status: 'canceled' })),
    },
    409,
    'product_order_not_payable',
  )
})

test('product order invalid amount returns invalid_line_pay_confirm_amount', async () => {
  await assertErrorResponse(
    {
      productOrderReader: createProductOrderReader(createProductOrder({ total_amount: 0 })),
    },
    400,
    'invalid_line_pay_confirm_amount',
  )
})

test('product order invalid currency returns invalid_line_pay_confirm_currency', async () => {
  await assertErrorResponse(
    {
      productOrderReader: createProductOrderReader(createProductOrder({ currency: 'USD' })),
    },
    400,
    'invalid_line_pay_confirm_currency',
  )
})

test('payment amount mismatch returns line_pay_payment_amount_mismatch', async () => {
  await assertErrorResponse(
    {
      productOrderReader: createProductOrderReader(createProductOrder({ total_amount: 1600 })),
    },
    409,
    'line_pay_payment_amount_mismatch',
  )
})

test('successful preflight returns not implemented with payment and order context', async () => {
  const paymentReaderCalls: Array<{ orderId: string }> = []
  const productOrderReaderCalls: Array<{ productOrderId: string }> = []
  const response = await callHandler({
    request: createRequest(`orderId=%20${orderId}%20&transactionId=${transactionId}`),
    paymentReader: createPaymentReader(createPayment(), paymentReaderCalls),
    productOrderReader: createProductOrderReader(createProductOrder(), productOrderReaderCalls),
  })
  const json = await readJson(response)

  assert.equal(response.status, 501)
  assert.deepEqual(json, {
    ok: false,
    error: 'line_pay_product_order_confirm_not_implemented',
    received: true,
    preflight: true,
    paymentId,
    productOrderId,
    orderId,
    transactionId,
    amount: 1500,
    currency: 'TWD',
  })
  assert.deepEqual(paymentReaderCalls, [{ orderId }])
  assert.deepEqual(productOrderReaderCalls, [{ productOrderId }])
  assert.equal(typeof json.transactionId, 'string')
  assertSafeResponse(json)
})

test('19 digit transactionId stays string', async () => {
  const response = await callHandler()
  const json = await readJson(response)

  assert.equal(json.transactionId, transactionId)
  assert.equal(typeof json.transactionId, 'string')
})

test('pre-query errors do not call payment or product order readers', async () => {
  const paymentReaderCalls: Array<{ orderId: string }> = []
  const productOrderReaderCalls: Array<{ productOrderId: string }> = []
  const response = await callHandler({
    request: createRequest(`orderId=bad/order&transactionId=${transactionId}`),
    paymentReader: createPaymentReader(createPayment(), paymentReaderCalls),
    productOrderReader: createProductOrderReader(createProductOrder(), productOrderReaderCalls),
  })

  assert.equal(response.status, 400)
  assert.deepEqual(paymentReaderCalls, [])
  assert.deepEqual(productOrderReaderCalls, [])
})

test('payment preflight errors do not call product order reader', async () => {
  const productOrderReaderCalls: Array<{ productOrderId: string }> = []
  const response = await callHandler({
    paymentReader: createPaymentReader(createPayment({ status: 'paid' })),
    productOrderReader: createProductOrderReader(createProductOrder(), productOrderReaderCalls),
  })

  assert.equal(response.status, 409)
  assert.deepEqual(productOrderReaderCalls, [])
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

test('handler source does not include DB update, confirm API, or mark paid behavior', () => {
  const source = String(handleProductOrderLinePayConfirmRedirect)

  assert.equal(source.includes('confirmLinePayPayment'), false)
  assert.equal(source.includes('requestLinePayPayment'), false)
  assert.equal(source.includes('fetch('), false)
  assert.equal(source.includes('from('), false)
  assert.equal(source.includes('update('), false)
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
