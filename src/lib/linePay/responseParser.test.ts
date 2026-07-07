import assert from 'node:assert/strict'
import { parseLinePayConfirmResponse, parseLinePayRequestResponse } from './responseParser'

const transactionId = '2026070700000000001'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

function createRequestResponse(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  }
}

function createConfirmResponse(overrides: Record<string, unknown> = {}) {
  return {
    returnCode: '0000',
    returnMessage: 'Success',
    info: {
      transactionId,
      orderId: 'LP20260707153000A1B2',
    },
    ...overrides,
  }
}

test('request response parses transactionId', () => {
  const parsed = parseLinePayRequestResponse(createRequestResponse())

  assert.equal(parsed.transactionId, transactionId)
})

test('request response transactionId is not converted to number', () => {
  const parsed = parseLinePayRequestResponse(createRequestResponse())

  assert.equal(typeof parsed.transactionId, 'string')
  assert.equal(parsed.transactionId, transactionId)
})

test('request response parses paymentUrl.web', () => {
  const parsed = parseLinePayRequestResponse(createRequestResponse())

  assert.equal(parsed.paymentUrlWeb, 'https://line-pay.example.com/web')
})

test('request response paymentUrl.app is optional', () => {
  const parsed = parseLinePayRequestResponse(
    createRequestResponse({
      info: {
        transactionId,
        paymentUrl: {
          web: 'https://line-pay.example.com/web',
        },
      },
    }),
  )

  assert.equal(parsed.paymentUrlApp, null)
})

test('request response missing returnCode throws safe invalid error', () => {
  assert.throws(
    () =>
      parseLinePayRequestResponse({
        info: {
          transactionId,
          paymentUrl: { web: 'https://line-pay.example.com/web' },
        },
      }),
    /invalid_line_pay_request_response/,
  )
})

test('request response non-success returnCode throws request failed', () => {
  assert.throws(
    () =>
      parseLinePayRequestResponse(
        createRequestResponse({
          returnCode: '1104',
        }),
      ),
    /line_pay_request_failed/,
  )
})

test('request response missing transactionId throws safe invalid error', () => {
  assert.throws(
    () =>
      parseLinePayRequestResponse(
        createRequestResponse({
          info: {
            paymentUrl: { web: 'https://line-pay.example.com/web' },
          },
        }),
      ),
    /invalid_line_pay_request_response/,
  )
})

test('request response missing paymentUrl.web throws safe invalid error', () => {
  assert.throws(
    () =>
      parseLinePayRequestResponse(
        createRequestResponse({
          info: {
            transactionId,
            paymentUrl: { app: 'linepay://pay' },
          },
        }),
      ),
    /invalid_line_pay_request_response/,
  )
})

test('confirm response parses transactionId and orderId', () => {
  const parsed = parseLinePayConfirmResponse(createConfirmResponse())

  assert.equal(parsed.transactionId, transactionId)
  assert.equal(parsed.orderId, 'LP20260707153000A1B2')
})

test('confirm response transactionId is not converted to number', () => {
  const parsed = parseLinePayConfirmResponse(createConfirmResponse())

  assert.equal(typeof parsed.transactionId, 'string')
  assert.equal(parsed.transactionId, transactionId)
})

test('confirm response orderId is optional', () => {
  const parsed = parseLinePayConfirmResponse(
    createConfirmResponse({
      info: {
        transactionId,
      },
    }),
  )

  assert.equal(parsed.orderId, null)
})

test('confirm response missing returnCode throws safe invalid error', () => {
  assert.throws(
    () =>
      parseLinePayConfirmResponse({
        info: {
          transactionId,
        },
      }),
    /invalid_line_pay_confirm_response/,
  )
})

test('confirm response non-success returnCode throws confirm failed', () => {
  assert.throws(
    () =>
      parseLinePayConfirmResponse(
        createConfirmResponse({
          returnCode: '1199',
        }),
      ),
    /line_pay_confirm_failed/,
  )
})

test('request parser output does not contain channelSecret', () => {
  const parsedText = JSON.stringify(parseLinePayRequestResponse(createRequestResponse()))

  assert.equal(parsedText.includes('channelSecret'), false)
})

test('parser output does not contain signature or headers', () => {
  const parsedText = JSON.stringify(parseLinePayRequestResponse(createRequestResponse()))

  assert.equal(parsedText.includes('signature'), false)
  assert.equal(parsedText.includes('headers'), false)
  assert.equal(parsedText.includes('X-LINE-Authorization'), false)
})

test('parser output does not contain phone, email, or address', () => {
  const parsedText = JSON.stringify(parseLinePayConfirmResponse(createConfirmResponse()))

  assert.equal(parsedText.includes('phone'), false)
  assert.equal(parsedText.includes('email'), false)
  assert.equal(parsedText.includes('address'), false)
})

test('parser output does not contain NewebPay TradeInfo or TradeSha', () => {
  const parsedText = JSON.stringify(parseLinePayConfirmResponse(createConfirmResponse()))

  assert.equal(parsedText.includes('TradeInfo'), false)
  assert.equal(parsedText.includes('TradeSha'), false)
})
