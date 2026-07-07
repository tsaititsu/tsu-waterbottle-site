import assert from 'node:assert/strict'
import {
  LINE_PAY_REQUEST_PAYMENT_PATH,
  requestLinePayPayment,
  type LinePayRequestPaymentFetch,
  type LinePayRequestPaymentFetchInit,
} from './requestClient'

const channelId = 'test_channel_id'
const channelSecret = 'test_channel_secret'
const nonce = '4fd35eb8-5812-4f2e-b1b3-dffdfeb9ec2d'
const transactionId = '2026070700000000001'

const payloadInput = {
  orderId: 'LP20260707153000A1B2',
  amount: 1500,
  products: [
    {
      name: '人緣符',
      quantity: 1,
      price: 1500,
    },
  ],
  confirmUrl: 'https://example.com/api/payments/line-pay/confirm',
  cancelUrl: 'https://example.com/payment/cancel',
}

function createSuccessResponse() {
  return {
    returnCode: '0000',
    returnMessage: 'Success',
    info: {
      transactionId,
      paymentUrl: {
        web: 'https://line-pay.example.com/web',
        app: 'linepay://pay',
      },
    },
  }
}

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

function createMockFetch(responseJson: unknown) {
  const calls: Array<{ url: string; init: LinePayRequestPaymentFetchInit }> = []
  const fetchFn: LinePayRequestPaymentFetch = async (url, init) => {
    calls.push({ url, init })
    return {
      json: async () => responseJson,
    }
  }

  return { calls, fetchFn }
}

function createRequestInput(fetchFn?: LinePayRequestPaymentFetch | null) {
  return {
    environment: 'sandbox',
    channelId,
    channelSecret,
    nonce,
    fetchFn,
    payloadInput,
  }
}

async function main() {
  await test('sandbox environment uses sandbox request URL', async () => {
    const { calls, fetchFn } = createMockFetch(createSuccessResponse())

    await requestLinePayPayment(createRequestInput(fetchFn))

    assert.equal(calls[0]?.url, `https://sandbox-api-pay.line.me${LINE_PAY_REQUEST_PAYMENT_PATH}`)
  })

  await test('request method is POST', async () => {
    const { calls, fetchFn } = createMockFetch(createSuccessResponse())

    await requestLinePayPayment(createRequestInput(fetchFn))

    assert.equal(calls[0]?.init.method, 'POST')
  })

  await test('request headers include LINE Pay channel id', async () => {
    const { calls, fetchFn } = createMockFetch(createSuccessResponse())

    await requestLinePayPayment(createRequestInput(fetchFn))

    assert.equal(calls[0]?.init.headers['X-LINE-ChannelId'], channelId)
  })

  await test('request headers include LINE Pay authorization', async () => {
    const { calls, fetchFn } = createMockFetch(createSuccessResponse())

    await requestLinePayPayment(createRequestInput(fetchFn))

    assert.equal(typeof calls[0]?.init.headers['X-LINE-Authorization'], 'string')
    assert.ok(calls[0]?.init.headers['X-LINE-Authorization'])
  })

  await test('request headers include LINE Pay authorization nonce', async () => {
    const { calls, fetchFn } = createMockFetch(createSuccessResponse())

    await requestLinePayPayment(createRequestInput(fetchFn))

    assert.equal(calls[0]?.init.headers['X-LINE-Authorization-Nonce'], nonce)
  })

  await test('request body is a JSON string', async () => {
    const { calls, fetchFn } = createMockFetch(createSuccessResponse())

    await requestLinePayPayment(createRequestInput(fetchFn))

    const bodyText = calls[0]?.init.body ?? ''
    assert.equal(typeof bodyText, 'string')
    assert.deepEqual(JSON.parse(bodyText), {
      amount: 1500,
      currency: 'TWD',
      orderId: 'LP20260707153000A1B2',
      packages: [
        {
          id: 'LP20260707153000A1B2',
          amount: 1500,
          products: [
            {
              name: '人緣符',
              quantity: 1,
              price: 1500,
            },
          ],
        },
      ],
      redirectUrls: {
        confirmUrl: 'https://example.com/api/payments/line-pay/confirm',
        cancelUrl: 'https://example.com/payment/cancel',
      },
    })
  })

  await test('payload validation rejects subtotal mismatch before fetch', async () => {
    let called = false
    const fetchFn: LinePayRequestPaymentFetch = async () => {
      called = true
      return { json: async () => createSuccessResponse() }
    }

    await assert.rejects(
      () =>
        requestLinePayPayment({
          ...createRequestInput(fetchFn),
          payloadInput: {
            ...payloadInput,
            amount: 1600,
          },
        }),
      /invalid_line_pay_products/,
    )
    assert.equal(called, false)
  })

  await test('successful response returns transactionId', async () => {
    const { fetchFn } = createMockFetch(createSuccessResponse())
    const result = await requestLinePayPayment(createRequestInput(fetchFn))

    assert.equal(result.transactionId, transactionId)
  })

  await test('successful response transactionId is not converted to number', async () => {
    const { fetchFn } = createMockFetch(createSuccessResponse())
    const result = await requestLinePayPayment(createRequestInput(fetchFn))

    assert.equal(typeof result.transactionId, 'string')
    assert.equal(result.transactionId, transactionId)
  })

  await test('successful response returns paymentUrl.web', async () => {
    const { fetchFn } = createMockFetch(createSuccessResponse())
    const result = await requestLinePayPayment(createRequestInput(fetchFn))

    assert.equal(result.paymentUrlWeb, 'https://line-pay.example.com/web')
  })

  await test('missing fetchFn throws safe error', async () => {
    await assert.rejects(() => requestLinePayPayment(createRequestInput(null)), /missing_line_pay_fetch/)
  })

  await test('response json failure throws safe client response error', async () => {
    const fetchFn: LinePayRequestPaymentFetch = async () => ({
      json: async () => {
        throw new Error('bad json')
      },
    })

    await assert.rejects(
      () => requestLinePayPayment(createRequestInput(fetchFn)),
      /invalid_line_pay_request_client_response/,
    )
  })

  await test('LINE Pay failure returnCode preserves parser error', async () => {
    const { fetchFn } = createMockFetch({
      ...createSuccessResponse(),
      returnCode: '1199',
    })

    await assert.rejects(() => requestLinePayPayment(createRequestInput(fetchFn)), /line_pay_request_failed/)
  })

  await test('returned result does not include channelSecret', async () => {
    const { fetchFn } = createMockFetch(createSuccessResponse())
    const resultText = JSON.stringify(await requestLinePayPayment(createRequestInput(fetchFn)))

    assert.equal(resultText.includes(channelSecret), false)
    assert.equal(resultText.includes('channelSecret'), false)
  })

  await test('returned result does not include phone, email, or address', async () => {
    const { fetchFn } = createMockFetch(createSuccessResponse())
    const resultText = JSON.stringify(await requestLinePayPayment(createRequestInput(fetchFn)))

    assert.equal(resultText.includes('phone'), false)
    assert.equal(resultText.includes('email'), false)
    assert.equal(resultText.includes('address'), false)
  })

  await test('returned result does not include NewebPay TradeInfo or TradeSha', async () => {
    const { fetchFn } = createMockFetch(createSuccessResponse())
    const resultText = JSON.stringify(await requestLinePayPayment(createRequestInput(fetchFn)))

    assert.equal(resultText.includes('TradeInfo'), false)
    assert.equal(resultText.includes('TradeSha'), false)
  })

  await test('global fetch is not called', async () => {
    const originalFetch = globalThis.fetch
    let globalFetchCalled = false
    const { fetchFn } = createMockFetch(createSuccessResponse())

    globalThis.fetch = (async () => {
      globalFetchCalled = true
      throw new Error('global fetch must not be called')
    }) as typeof fetch

    try {
      await requestLinePayPayment(createRequestInput(fetchFn))
      assert.equal(globalFetchCalled, false)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
