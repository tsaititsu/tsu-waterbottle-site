import assert from 'node:assert/strict'
import {
  handleProductOrderLinePayCancelRedirect,
  type ProductOrderLinePayCancelPaymentContext,
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

function createRequest(query = '', method = 'GET') {
  const suffix = query ? `?${query}` : ''

  return new Request(`https://example.com/api/product-orders/line-pay/cancel${suffix}`, {
    method,
  })
}

async function callHandler({
  request = createRequest(),
  env = fullEnv,
  ...input
}: {
  request?: Request
  env?: LinePayServerEnv
  paymentReader?: Parameters<typeof handleProductOrderLinePayCancelRedirect>[0]['paymentReader']
  paymentMetadataUpdater?: Parameters<typeof handleProductOrderLinePayCancelRedirect>[0]['paymentMetadataUpdater']
  now?: string
} = {}) {
  return handleProductOrderLinePayCancelRedirect({
    request,
    env,
    paymentReader: 'paymentReader' in input ? input.paymentReader : createPaymentReader(),
    paymentMetadataUpdater:
      'paymentMetadataUpdater' in input ? input.paymentMetadataUpdater : createMetadataUpdater(),
    now: input.now,
  })
}

function createPayment(
  override: Partial<ProductOrderLinePayCancelPaymentContext> = {},
): ProductOrderLinePayCancelPaymentContext {
  return {
    id: paymentId,
    provider: 'line_pay',
    status: 'pending',
    merchant_order_no: orderId,
    raw_payload: {
      linePay: {
        orderId,
        sourceType: 'product_order',
        sourceId: productOrderId,
        transactionId,
        request: {
          returnCode: '0000',
          returnMessage: 'Success.',
        },
      },
    },
    ...override,
  }
}

function createPaymentReader(
  payment: ProductOrderLinePayCancelPaymentContext | null = createPayment(),
  calls: Array<Record<string, unknown>> = [],
  error?: unknown,
) {
  return async (input: Record<string, unknown>) => {
    calls.push(input)

    if (error) {
      throw error
    }

    return payment
  }
}

function createMetadataUpdater(calls: Array<Record<string, unknown>> = [], error?: unknown) {
  return async (input: Record<string, unknown>) => {
    calls.push(input)

    if (error) {
      throw error
    }

    return {
      paymentId: input.paymentId,
    }
  }
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

function assertNoStatusMutation(value: unknown) {
  const text = JSON.stringify(value)

  assert.equal(text.includes('"status":"paid"'), false)
  assert.equal(text.includes('"status":"failed"'), false)
  assert.equal(text.includes('"status":"canceled"'), false)
  assert.equal(text.includes('"payment_status":"paid"'), false)
  assert.equal(text.includes('paid_at'), false)
  assert.equal(text.includes('markPaid'), false)
  assert.equal(text.includes('markFailed'), false)
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
      request: createRequest('', 'POST'),
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

test('missing orderId and transactionId does not read DB and returns lookup key missing', async () => {
  const readerCalls: Array<Record<string, unknown>> = []
  const updaterCalls: Array<Record<string, unknown>> = []
  const response = await callHandler({
    paymentReader: createPaymentReader(createPayment(), readerCalls),
    paymentMetadataUpdater: createMetadataUpdater(updaterCalls),
  })
  const json = await readJson(response)

  assert.equal(response.status, 200)
  assert.deepEqual(json, {
    ok: false,
    canceled: true,
    provider: 'line_pay',
    metadataUpdated: false,
    orderId: null,
    transactionId: null,
    error: 'line_pay_cancel_lookup_key_missing',
  })
  assert.deepEqual(readerCalls, [])
  assert.deepEqual(updaterCalls, [])
  assertSafeResponse(json)
})

test('valid orderId calls paymentReader and records metadata', async () => {
  const readerCalls: Array<Record<string, unknown>> = []
  const updaterCalls: Array<Record<string, unknown>> = []
  const response = await callHandler({
    request: createRequest(`orderId=%20${orderId}%20`),
    paymentReader: createPaymentReader(createPayment(), readerCalls),
    paymentMetadataUpdater: createMetadataUpdater(updaterCalls),
    now: '2026-07-08T10:00:00.000Z',
  })
  const json = await readJson(response)
  const metadata = updaterCalls[0].metadata as Record<string, unknown>
  const linePay = metadata.linePay as Record<string, unknown>
  const cancel = linePay.cancel as Record<string, unknown>

  assert.equal(response.status, 200)
  assert.equal(json.orderId, orderId)
  assert.equal(json.canceled, true)
  assert.equal(json.provider, 'line_pay')
  assert.equal(json.metadataUpdated, true)
  assert.equal(json.paymentId, paymentId)
  assert.equal(json.error, 'line_pay_product_order_cancel_recorded')
  assert.deepEqual(readerCalls, [{ orderId, transactionId: null }])
  assert.equal(updaterCalls.length, 1)
  assert.equal(updaterCalls[0].paymentId, paymentId)
  assert.deepEqual(linePay.request, {
    returnCode: '0000',
    returnMessage: 'Success.',
  })
  assert.equal(cancel.canceledAt, '2026-07-08T10:00:00.000Z')
  assert.equal(cancel.reason, 'customer_canceled_on_line_pay_page')
  assert.equal(cancel.orderId, orderId)
  assert.equal(cancel.transactionId, transactionId)
  assertSafeResponse(json)
  assertSafeResponse(metadata)
  assertNoStatusMutation(metadata)
})

test('invalid orderId returns invalid_line_pay_order_id', async () => {
  await assertErrorResponse(
    {
      request: createRequest('orderId=bad/order'),
    },
    400,
    'invalid_line_pay_order_id',
  )
})

test('valid transactionId calls paymentReader and records metadata', async () => {
  const readerCalls: Array<Record<string, unknown>> = []
  const updaterCalls: Array<Record<string, unknown>> = []
  const response = await callHandler({
    request: createRequest(`transactionId=${transactionId}`),
    paymentReader: createPaymentReader(createPayment(), readerCalls),
    paymentMetadataUpdater: createMetadataUpdater(updaterCalls),
  })
  const json = await readJson(response)

  assert.equal(response.status, 200)
  assert.equal(json.transactionId, transactionId)
  assert.equal(typeof json.transactionId, 'string')
  assert.deepEqual(readerCalls, [{ orderId: null, transactionId }])
  assert.equal(updaterCalls.length, 1)
  assertSafeResponse(json)
})

test('19 digit transactionId remains string', async () => {
  const response = await callHandler({
    request: createRequest(`transactionId=${transactionId}`),
  })
  const json = await readJson(response)

  assert.equal(json.transactionId, transactionId)
  assert.equal(typeof json.transactionId, 'string')
})

test('invalid transactionId returns invalid_line_pay_transaction_id', async () => {
  await assertErrorResponse(
    {
      request: createRequest('transactionId=not-a-number'),
    },
    400,
    'invalid_line_pay_transaction_id',
  )
})

test('valid orderId and transactionId are returned together after metadata update', async () => {
  const response = await callHandler({
    request: createRequest(`orderId=${orderId}&transactionId=${transactionId}`),
  })
  const json = await readJson(response)

  assert.equal(response.status, 200)
  assert.equal(json.ok, false)
  assert.equal(json.canceled, true)
  assert.equal(json.provider, 'line_pay')
  assert.equal(json.metadataUpdated, true)
  assert.equal(json.orderId, orderId)
  assert.equal(json.transactionId, transactionId)
  assert.equal(json.error, 'line_pay_product_order_cancel_recorded')
  assertSafeResponse(json)
})

test('missing paymentReader with lookup key returns line_pay_cancel_payment_reader_missing', async () => {
  await assertErrorResponse(
    {
      request: createRequest(`orderId=${orderId}`),
      paymentReader: undefined,
    },
    500,
    'line_pay_cancel_payment_reader_missing',
  )
})

test('missing payment returns line_pay_cancel_payment_not_found', async () => {
  await assertErrorResponse(
    {
      request: createRequest(`orderId=${orderId}`),
      paymentReader: createPaymentReader(null),
    },
    404,
    'line_pay_cancel_payment_not_found',
  )
})

test('payment provider mismatch returns line_pay_cancel_provider_mismatch', async () => {
  await assertErrorResponse(
    {
      request: createRequest(`orderId=${orderId}`),
      paymentReader: createPaymentReader(createPayment({ provider: 'newebpay' })),
    },
    409,
    'line_pay_cancel_provider_mismatch',
  )
})

test('paid payment returns line_pay_cancel_payment_already_paid', async () => {
  await assertErrorResponse(
    {
      request: createRequest(`orderId=${orderId}`),
      paymentReader: createPaymentReader(createPayment({ status: 'paid' })),
    },
    409,
    'line_pay_cancel_payment_already_paid',
  )
})

test('merchant order mismatch returns line_pay_cancel_order_id_mismatch', async () => {
  await assertErrorResponse(
    {
      request: createRequest(`orderId=${orderId}`),
      paymentReader: createPaymentReader(createPayment({ merchant_order_no: 'LP_product_order_other_1' })),
    },
    409,
    'line_pay_cancel_order_id_mismatch',
  )
})

test('raw payload orderId mismatch returns line_pay_cancel_order_id_mismatch', async () => {
  await assertErrorResponse(
    {
      request: createRequest(`orderId=${orderId}`),
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
    'line_pay_cancel_order_id_mismatch',
  )
})

test('raw payload transactionId mismatch returns line_pay_cancel_transaction_id_mismatch', async () => {
  await assertErrorResponse(
    {
      request: createRequest(`transactionId=${transactionId}`),
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
    'line_pay_cancel_transaction_id_mismatch',
  )
})

test('raw payload sourceType mismatch returns line_pay_cancel_source_type_mismatch', async () => {
  await assertErrorResponse(
    {
      request: createRequest(`orderId=${orderId}`),
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
    'line_pay_cancel_source_type_mismatch',
  )
})

test('missing metadata updater returns line_pay_cancel_metadata_updater_missing', async () => {
  await assertErrorResponse(
    {
      request: createRequest(`orderId=${orderId}`),
      paymentMetadataUpdater: undefined,
    },
    500,
    'line_pay_cancel_metadata_updater_missing',
  )
})

test('metadata updater throw returns line_pay_cancel_metadata_update_failed', async () => {
  await assertErrorResponse(
    {
      request: createRequest(`orderId=${orderId}`),
      paymentMetadataUpdater: createMetadataUpdater([], new Error('metadata failed')),
    },
    500,
    'line_pay_cancel_metadata_update_failed',
  )
})

test('handler source does not update product orders, mark paid, or call external APIs', () => {
  const source = String(handleProductOrderLinePayCancelRedirect)

  assert.equal(source.includes('productOrderReader'), false)
  assert.equal(source.includes('from('), false)
  assert.equal(source.includes('select('), false)
  assert.equal(source.includes('update('), false)
  assert.equal(source.includes('markPaid'), false)
  assert.equal(source.includes('markFailed'), false)
  assert.equal(source.includes('product_orders'), false)
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
