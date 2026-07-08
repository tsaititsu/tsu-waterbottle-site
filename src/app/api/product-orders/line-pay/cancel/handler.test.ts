import assert from 'node:assert/strict'
import { handleProductOrderLinePayCancelRedirect } from './handler'
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
}: {
  request?: Request
  env?: LinePayServerEnv
} = {}) {
  return handleProductOrderLinePayCancelRedirect({
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

test('missing orderId and transactionId still returns canceled skeleton', async () => {
  const response = await callHandler()
  const json = await readJson(response)

  assert.equal(response.status, 501)
  assert.deepEqual(json, {
    ok: false,
    canceled: true,
    provider: 'line_pay',
    orderId: null,
    transactionId: null,
    error: 'line_pay_product_order_cancel_not_implemented',
  })
  assertSafeResponse(json)
})

test('valid orderId is returned', async () => {
  const response = await callHandler({
    request: createRequest(`orderId=%20${orderId}%20`),
  })
  const json = await readJson(response)

  assert.equal(response.status, 501)
  assert.equal(json.orderId, orderId)
  assert.equal(json.canceled, true)
  assert.equal(json.provider, 'line_pay')
  assertSafeResponse(json)
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

test('valid transactionId is returned as string', async () => {
  const response = await callHandler({
    request: createRequest(`transactionId=${transactionId}`),
  })
  const json = await readJson(response)

  assert.equal(response.status, 501)
  assert.equal(json.transactionId, transactionId)
  assert.equal(typeof json.transactionId, 'string')
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

test('valid orderId and transactionId are returned together', async () => {
  const response = await callHandler({
    request: createRequest(`orderId=${orderId}&transactionId=${transactionId}`),
  })
  const json = await readJson(response)

  assert.equal(response.status, 501)
  assert.equal(json.ok, false)
  assert.equal(json.canceled, true)
  assert.equal(json.provider, 'line_pay')
  assert.equal(json.orderId, orderId)
  assert.equal(json.transactionId, transactionId)
  assert.equal(json.error, 'line_pay_product_order_cancel_not_implemented')
  assertSafeResponse(json)
})

test('handler source does not read or update payment/order data', () => {
  const source = String(handleProductOrderLinePayCancelRedirect)

  assert.equal(source.includes('paymentReader'), false)
  assert.equal(source.includes('productOrderReader'), false)
  assert.equal(source.includes('from('), false)
  assert.equal(source.includes('select('), false)
  assert.equal(source.includes('update('), false)
  assert.equal(source.includes('mark'), false)
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
