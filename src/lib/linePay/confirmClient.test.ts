import assert from 'node:assert/strict'
import {
  buildLinePayConfirmPath,
  confirmLinePayPayment,
  type LinePayConfirmPaymentFetch,
  type LinePayConfirmPaymentFetchInit,
} from './confirmClient'

const channelId = 'test_channel_id'
const channelSecret = 'test_channel_secret'
const nonce = '4fd35eb8-5812-4f2e-b1b3-dffdfeb9ec2d'
const transactionId = '2026070700000000001'
const orderId = 'LP20260707153000A1B2'

const payloadInput = {
  amount: 1500,
}

function createSuccessResponse() {
  return {
    returnCode: '0000',
    returnMessage: 'Success',
    info: {
      transactionId,
      orderId,
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
  const calls: Array<{ url: string; init: LinePayConfirmPaymentFetchInit }> = []
  const fetchFn: LinePayConfirmPaymentFetch = async (url, init) => {
    calls.push({ url, init })
    return {
      json: async () => responseJson,
    }
  }

  return { calls, fetchFn }
}

function createConfirmInput(fetchFn?: LinePayConfirmPaymentFetch | null) {
  return {
    environment: 'sandbox',
    channelId,
    channelSecret,
    nonce,
    fetchFn,
    transactionId,
    payloadInput,
  }
}

async function main() {
  await test('confirm path includes validated transactionId', () => {
    assert.equal(buildLinePayConfirmPath(transactionId), `/v3/payments/${transactionId}/confirm`)
  })

  await test('sandbox environment uses sandbox confirm URL', async () => {
    const { calls, fetchFn } = createMockFetch(createSuccessResponse())

    await confirmLinePayPayment(createConfirmInput(fetchFn))

    assert.equal(calls[0]?.url, `https://sandbox-api-pay.line.me/v3/payments/${transactionId}/confirm`)
  })

  await test('request method is POST', async () => {
    const { calls, fetchFn } = createMockFetch(createSuccessResponse())

    await confirmLinePayPayment(createConfirmInput(fetchFn))

    assert.equal(calls[0]?.init.method, 'POST')
  })

  await test('request headers include LINE Pay channel id', async () => {
    const { calls, fetchFn } = createMockFetch(createSuccessResponse())

    await confirmLinePayPayment(createConfirmInput(fetchFn))

    assert.equal(calls[0]?.init.headers['X-LINE-ChannelId'], channelId)
  })

  await test('request headers include LINE Pay authorization', async () => {
    const { calls, fetchFn } = createMockFetch(createSuccessResponse())

    await confirmLinePayPayment(createConfirmInput(fetchFn))

    assert.equal(typeof calls[0]?.init.headers['X-LINE-Authorization'], 'string')
    assert.ok(calls[0]?.init.headers['X-LINE-Authorization'])
  })

  await test('request headers include LINE Pay authorization nonce', async () => {
    const { calls, fetchFn } = createMockFetch(createSuccessResponse())

    await confirmLinePayPayment(createConfirmInput(fetchFn))

    assert.equal(calls[0]?.init.headers['X-LINE-Authorization-Nonce'], nonce)
  })

  await test('request body is a JSON string', async () => {
    const { calls, fetchFn } = createMockFetch(createSuccessResponse())

    await confirmLinePayPayment(createConfirmInput(fetchFn))

    const bodyText = calls[0]?.init.body ?? ''
    assert.equal(typeof bodyText, 'string')
    assert.deepEqual(JSON.parse(bodyText), {
      amount: 1500,
      currency: 'TWD',
    })
  })

  await test('confirm payload validates positive integer amount before fetch', async () => {
    let called = false
    const fetchFn: LinePayConfirmPaymentFetch = async () => {
      called = true
      return { json: async () => createSuccessResponse() }
    }

    await assert.rejects(
      () =>
        confirmLinePayPayment({
          ...createConfirmInput(fetchFn),
          payloadInput: {
            amount: 0,
          },
        }),
      /invalid_line_pay_amount/,
    )
    assert.equal(called, false)
  })

  await test('confirm payload defaults currency to TWD', async () => {
    const { calls, fetchFn } = createMockFetch(createSuccessResponse())

    await confirmLinePayPayment(createConfirmInput(fetchFn))

    assert.equal(JSON.parse(calls[0]?.init.body ?? '{}').currency, 'TWD')
  })

  await test('transactionId validation only accepts numeric string', async () => {
    const { fetchFn } = createMockFetch(createSuccessResponse())

    await assert.rejects(
      () =>
        confirmLinePayPayment({
          ...createConfirmInput(fetchFn),
          transactionId: 'not-a-number',
        }),
      /invalid_line_pay_transaction_id/,
    )
  })

  await test('transactionId is not converted to number in URL', async () => {
    const { calls, fetchFn } = createMockFetch(createSuccessResponse())

    await confirmLinePayPayment(createConfirmInput(fetchFn))

    assert.equal(calls[0]?.url.includes(transactionId), true)
  })

  await test('successful response returns transactionId', async () => {
    const { fetchFn } = createMockFetch(createSuccessResponse())
    const result = await confirmLinePayPayment(createConfirmInput(fetchFn))

    assert.equal(result.transactionId, transactionId)
  })

  await test('successful response returns orderId', async () => {
    const { fetchFn } = createMockFetch(createSuccessResponse())
    const result = await confirmLinePayPayment(createConfirmInput(fetchFn))

    assert.equal(result.orderId, orderId)
  })

  await test('missing fetchFn throws safe error', async () => {
    await assert.rejects(() => confirmLinePayPayment(createConfirmInput(null)), /missing_line_pay_fetch/)
  })

  await test('response json failure throws safe client response error', async () => {
    const fetchFn: LinePayConfirmPaymentFetch = async () => ({
      json: async () => {
        throw new Error('bad json')
      },
    })

    await assert.rejects(
      () => confirmLinePayPayment(createConfirmInput(fetchFn)),
      /invalid_line_pay_confirm_client_response/,
    )
  })

  await test('LINE Pay failure returnCode preserves parser error', async () => {
    const { fetchFn } = createMockFetch({
      ...createSuccessResponse(),
      returnCode: '1199',
    })

    await assert.rejects(() => confirmLinePayPayment(createConfirmInput(fetchFn)), /line_pay_confirm_failed/)
  })

  await test('returned result does not include channelSecret', async () => {
    const { fetchFn } = createMockFetch(createSuccessResponse())
    const resultText = JSON.stringify(await confirmLinePayPayment(createConfirmInput(fetchFn)))

    assert.equal(resultText.includes(channelSecret), false)
    assert.equal(resultText.includes('channelSecret'), false)
  })

  await test('returned result does not include phone, email, or address', async () => {
    const { fetchFn } = createMockFetch(createSuccessResponse())
    const resultText = JSON.stringify(await confirmLinePayPayment(createConfirmInput(fetchFn)))

    assert.equal(resultText.includes('phone'), false)
    assert.equal(resultText.includes('email'), false)
    assert.equal(resultText.includes('address'), false)
  })

  await test('returned result does not include NewebPay TradeInfo or TradeSha', async () => {
    const { fetchFn } = createMockFetch(createSuccessResponse())
    const resultText = JSON.stringify(await confirmLinePayPayment(createConfirmInput(fetchFn)))

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
      await confirmLinePayPayment(createConfirmInput(fetchFn))
      assert.equal(globalFetchCalled, false)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  await test('confirm client does not expose DB update or mark paid behavior', () => {
    assert.equal(JSON.stringify({ confirmLinePayPayment: String(confirmLinePayPayment) }).includes('markPaid'), false)
    assert.equal(JSON.stringify({ confirmLinePayPayment: String(confirmLinePayPayment) }).includes('payments'), false)
  })
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
