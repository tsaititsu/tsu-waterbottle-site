import assert from 'node:assert/strict'
import {
  checkLinePayPaymentRequestStatus,
  getLinePayPaymentDetails,
  type LinePayStatusFetchInit,
} from './statusClient'

const channelId = 'fake_channel_id'
const channelSecret = 'fake_channel_secret_for_tests'
const nonce = 'fake-nonce'
const transactionId = '2026070700000000001'
const orderId = 'LP_product_order_product-order-1_20260707153000'
const sandboxBaseUrl = 'https://sandbox-api-pay.line.me'
const tests: Array<{ name: string; fn: () => Promise<void> | void }> = []

type FetchCall = {
  url: string
  init: LinePayStatusFetchInit
}

function test(name: string, fn: () => Promise<void> | void) {
  tests.push({ name, fn })
}

function createFetch(responseJson: unknown, calls: FetchCall[] = []) {
  return async (url: string, init: LinePayStatusFetchInit) => {
    calls.push({ url, init })

    return {
      async json() {
        return responseJson
      },
    }
  }
}

function createJsonFailureFetch(calls: FetchCall[] = []) {
  return async (url: string, init: LinePayStatusFetchInit) => {
    calls.push({ url, init })

    return {
      async json() {
        throw new Error('json failed')
      },
    }
  }
}

function createStatusInput(
  responseJson: unknown = {
    returnCode: '0000',
    returnMessage: 'Success.',
  },
  calls: FetchCall[] = [],
) {
  return {
    environment: 'sandbox',
    channelId,
    channelSecret,
    nonce,
    fetchFn: createFetch(responseJson, calls),
    transactionId,
  }
}

function createDetailsInput(
  responseJson: unknown = {
    returnCode: '0000',
    returnMessage: 'Success.',
    info: [
      {
        transactionId,
        orderId,
        amount: 1500,
        currency: 'TWD',
      },
    ],
  },
  calls: FetchCall[] = [],
) {
  return {
    environment: 'sandbox',
    channelId,
    channelSecret,
    nonce,
    fetchFn: createFetch(responseJson, calls),
    transactionId,
  }
}

function assertGetWithoutBody(call: FetchCall) {
  assert.equal(call.init.method, 'GET')
  assert.equal('body' in call.init, false)
}

function assertLinePayHeaders(call: FetchCall) {
  assert.equal(call.init.headers['X-LINE-ChannelId'], channelId)
  assert.equal(typeof call.init.headers['X-LINE-Authorization'], 'string')
  assert.equal(call.init.headers['X-LINE-Authorization'].length > 0, true)
  assert.equal(call.init.headers['X-LINE-Authorization-Nonce'], nonce)
}

function assertSafeResult(value: unknown) {
  const serialized = JSON.stringify(value)

  assert.equal(serialized.includes(channelSecret), false)
  assert.equal(serialized.includes(channelId), false)
  assert.equal(serialized.includes('channelSecret'), false)
  assert.equal(serialized.includes('channelId'), false)
  assert.equal(serialized.includes('LINE_PAY_CHANNEL_SECRET'), false)
  assert.equal(serialized.includes('LINE_PAY_CHANNEL_ID'), false)
  assert.equal(serialized.includes('phone'), false)
  assert.equal(serialized.includes('email'), false)
  assert.equal(serialized.includes('address'), false)
  assert.equal(serialized.includes('TradeInfo'), false)
  assert.equal(serialized.includes('TradeSha'), false)
}

async function getStatusForReturnCode(returnCode: string) {
  return checkLinePayPaymentRequestStatus(
    createStatusInput({
      returnCode,
      returnMessage: `message-${returnCode}`,
    }),
  )
}

test('request status sandbox URL uses request status endpoint', async () => {
  const calls: FetchCall[] = []
  const result = await checkLinePayPaymentRequestStatus(createStatusInput(undefined, calls))

  assert.equal(calls[0]?.url, `${sandboxBaseUrl}/v3/payments/requests/${transactionId}/check`)
  assert.equal(result.transactionId, transactionId)
})

test('request status method is GET and sends no body', async () => {
  const calls: FetchCall[] = []
  await checkLinePayPaymentRequestStatus(createStatusInput(undefined, calls))

  assertGetWithoutBody(calls[0])
})

test('request status headers include LINE Pay authorization values', async () => {
  const calls: FetchCall[] = []
  await checkLinePayPaymentRequestStatus(createStatusInput(undefined, calls))

  assertLinePayHeaders(calls[0])
})

test('request status keeps 19 digit transactionId as string', async () => {
  const result = await checkLinePayPaymentRequestStatus(createStatusInput())

  assert.equal(result.transactionId, transactionId)
  assert.equal(typeof result.transactionId, 'string')
})

test('request status maps 0000 to authentication_pending', async () => {
  const result = await getStatusForReturnCode('0000')

  assert.equal(result.status, 'authentication_pending')
})

test('request status maps 0110 to authentication_completed', async () => {
  const result = await getStatusForReturnCode('0110')

  assert.equal(result.status, 'authentication_completed')
})

test('request status maps 0121 to authentication_canceled_or_expired', async () => {
  const result = await getStatusForReturnCode('0121')

  assert.equal(result.status, 'authentication_canceled_or_expired')
})

test('request status maps 0122 to payment_failed', async () => {
  const result = await getStatusForReturnCode('0122')

  assert.equal(result.status, 'payment_failed')
})

test('request status maps 0123 to payment_completed', async () => {
  const result = await getStatusForReturnCode('0123')

  assert.equal(result.status, 'payment_completed')
})

test('request status missing fetch throws safe fetch error', async () => {
  await assert.rejects(
    () =>
      checkLinePayPaymentRequestStatus({
        environment: 'sandbox',
        channelId,
        channelSecret,
        nonce,
        transactionId,
      }),
    /missing_line_pay_fetch/,
  )
})

test('request status json failure throws safe client response error', async () => {
  await assert.rejects(
    () =>
      checkLinePayPaymentRequestStatus({
        environment: 'sandbox',
        channelId,
        channelSecret,
        nonce,
        fetchFn: createJsonFailureFetch(),
        transactionId,
      }),
    /invalid_line_pay_status_client_response/,
  )
})

test('payment details URL with transactionId is correct', async () => {
  const calls: FetchCall[] = []
  const result = await getLinePayPaymentDetails(createDetailsInput(undefined, calls))

  assert.equal(calls[0]?.url, `${sandboxBaseUrl}/v3/payments?transactionId=${transactionId}`)
  assert.equal(result.info[0]?.transactionId, transactionId)
})

test('payment details URL with orderId is correct', async () => {
  const calls: FetchCall[] = []
  await getLinePayPaymentDetails({
    environment: 'sandbox',
    channelId,
    channelSecret,
    nonce,
    fetchFn: createFetch(
      {
        returnCode: '0000',
        info: [{ orderId, transactionId }],
      },
      calls,
    ),
    orderId,
  })

  assert.equal(calls[0]?.url, `${sandboxBaseUrl}/v3/payments?orderId=${orderId}`)
})

test('payment details URL with transactionId and orderId is correct', async () => {
  const calls: FetchCall[] = []
  await getLinePayPaymentDetails({
    environment: 'sandbox',
    channelId,
    channelSecret,
    nonce,
    fetchFn: createFetch(
      {
        returnCode: '0000',
        info: [{ orderId, transactionId }],
      },
      calls,
    ),
    transactionId,
    orderId,
  })

  assert.equal(calls[0]?.url, `${sandboxBaseUrl}/v3/payments?transactionId=${transactionId}&orderId=${orderId}`)
})

test('payment details validates orderId through normalizeLinePayOrderId', async () => {
  await assert.rejects(
    () =>
      getLinePayPaymentDetails({
        environment: 'sandbox',
        channelId,
        channelSecret,
        nonce,
        fetchFn: createFetch({ returnCode: '0000', info: [] }),
        orderId: 'bad/order',
      }),
    /invalid_line_pay_order_id/,
  )
})

test('payment details missing lookup key throws safe error', async () => {
  await assert.rejects(
    () =>
      getLinePayPaymentDetails({
        environment: 'sandbox',
        channelId,
        channelSecret,
        nonce,
        fetchFn: createFetch({ returnCode: '0000', info: [] }),
      }),
    /missing_line_pay_payment_lookup_key/,
  )
})

test('payment details returnCode 0000 returns info array', async () => {
  const result = await getLinePayPaymentDetails(createDetailsInput())

  assert.equal(Array.isArray(result.info), true)
  assert.equal(result.info.length, 1)
  assert.equal(result.returnCode, '0000')
})

test('payment details converts info transactionId to string', async () => {
  const result = await getLinePayPaymentDetails(
    createDetailsInput({
      returnCode: '0000',
      info: [
        {
          transactionId: 2026070700000000001n,
          orderId,
        },
      ],
    }),
  )

  assert.equal(result.info[0]?.transactionId, transactionId)
  assert.equal(typeof result.info[0]?.transactionId, 'string')
})

test('payment details non-0000 returnCode throws line_pay_payment_details_failed', async () => {
  await assert.rejects(
    () =>
      getLinePayPaymentDetails(
        createDetailsInput({
          returnCode: '1101',
          returnMessage: 'failed',
          info: [],
        }),
      ),
    /line_pay_payment_details_failed/,
  )
})

test('payment details json failure throws safe response error', async () => {
  await assert.rejects(
    () =>
      getLinePayPaymentDetails({
        environment: 'sandbox',
        channelId,
        channelSecret,
        nonce,
        fetchFn: createJsonFailureFetch(),
        transactionId,
      }),
    /invalid_line_pay_payment_details_response/,
  )
})

test('payment details method is GET and sends no body', async () => {
  const calls: FetchCall[] = []
  await getLinePayPaymentDetails(createDetailsInput(undefined, calls))

  assertGetWithoutBody(calls[0])
})

test('status and details clients do not call global fetch', async () => {
  const originalFetch = globalThis.fetch
  let called = false

  globalThis.fetch = (async () => {
    called = true
    throw new Error('global fetch must not be called')
  }) as typeof fetch

  try {
    await checkLinePayPaymentRequestStatus(createStatusInput())
    await getLinePayPaymentDetails(createDetailsInput())
    assert.equal(called, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('returned results do not expose secrets, env, contact fields, or NewebPay fields', async () => {
  const status = await checkLinePayPaymentRequestStatus(createStatusInput())
  const details = await getLinePayPaymentDetails(
    createDetailsInput({
      returnCode: '0000',
      info: [
        {
          transactionId,
          orderId,
          customerPhone: '0912345678',
          customerEmail: 'customer@example.com',
          shippingAddress: 'Taipei',
          TradeInfo: 'unsafe',
          TradeSha: 'unsafe',
          channelSecret: 'unsafe',
          channelId: 'unsafe',
        },
      ],
    }),
  )

  assertSafeResult(status)
  assertSafeResult(details)
})

test('status client source does not expose DB update or mark paid behavior', () => {
  const statusSource = String(checkLinePayPaymentRequestStatus)
  const detailsSource = String(getLinePayPaymentDetails)
  const source = `${statusSource}\n${detailsSource}`

  assert.equal(source.includes('update('), false)
  assert.equal(source.includes('markPaid'), false)
  assert.equal(source.includes('product_orders'), false)
  assert.equal(source.includes('from('), false)
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
