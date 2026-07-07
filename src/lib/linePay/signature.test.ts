import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { buildLinePaySignature } from './signature'

const channelSecret = 'test_channel_secret'
const nonce = '4fd35eb8-5812-4f2e-b1b3-dffdfeb9ec2d'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

function createExpectedSignature(message: string) {
  return createHmac('sha256', channelSecret).update(message).digest('base64')
}

test('POST signature matches HMAC SHA256 base64 output', () => {
  const apiPath = '/v3/payments/request'
  const bodyText = JSON.stringify({
    amount: 100,
    currency: 'TWD',
    orderId: 'ORDER-1',
  })

  const signature = buildLinePaySignature({
    channelSecret,
    method: 'POST',
    apiPath,
    bodyText,
    nonce,
  })

  assert.equal(signature, createExpectedSignature(`${channelSecret}${apiPath}${bodyText}${nonce}`))
})

test('GET signature matches HMAC SHA256 base64 output', () => {
  const apiPath = '/v3/payments/requests/2026070700000000001/check'
  const queryString = '?orderId=ORDER-1'

  const signature = buildLinePaySignature({
    channelSecret,
    method: 'GET',
    apiPath,
    queryString,
    nonce,
  })

  assert.equal(signature, createExpectedSignature(`${channelSecret}${apiPath}${queryString}${nonce}`))
})

test('GET empty queryString can be signed', () => {
  const apiPath = '/v3/payments'

  const signature = buildLinePaySignature({
    channelSecret,
    method: 'GET',
    apiPath,
    nonce,
  })

  assert.equal(signature, createExpectedSignature(`${channelSecret}${apiPath}${nonce}`))
})

test('POST empty bodyText can be signed', () => {
  const apiPath = '/v3/payments/request'

  const signature = buildLinePaySignature({
    channelSecret,
    method: 'POST',
    apiPath,
    nonce,
  })

  assert.equal(signature, createExpectedSignature(`${channelSecret}${apiPath}${nonce}`))
})

test('empty channelSecret throws safe credentials error', () => {
  assert.throws(
    () =>
      buildLinePaySignature({
        channelSecret: '  ',
        method: 'POST',
        apiPath: '/v3/payments/request',
        bodyText: '{}',
        nonce,
      }),
    /invalid_line_pay_credentials/,
  )
})

test('invalid method throws safe method error', () => {
  assert.throws(
    () =>
      buildLinePaySignature({
        channelSecret,
        method: 'PUT',
        apiPath: '/v3/payments/request',
        bodyText: '{}',
        nonce,
      }),
    /invalid_line_pay_http_method/,
  )
})

test('apiPath without leading slash throws safe path error', () => {
  assert.throws(
    () =>
      buildLinePaySignature({
        channelSecret,
        method: 'POST',
        apiPath: 'v3/payments/request',
        bodyText: '{}',
        nonce,
      }),
    /invalid_line_pay_api_path/,
  )
})

test('empty nonce throws safe nonce error', () => {
  assert.throws(
    () =>
      buildLinePaySignature({
        channelSecret,
        method: 'POST',
        apiPath: '/v3/payments/request',
        bodyText: '{}',
        nonce: '  ',
      }),
    /invalid_line_pay_nonce/,
  )
})

test('signature output is base64', () => {
  const signature = buildLinePaySignature({
    channelSecret,
    method: 'POST',
    apiPath: '/v3/payments/request',
    bodyText: '{}',
    nonce,
  })

  assert.match(signature, /^[A-Za-z0-9+/]+={0,2}$/)
})

test('signature does not output channelSecret', () => {
  const signature = buildLinePaySignature({
    channelSecret,
    method: 'POST',
    apiPath: '/v3/payments/request',
    bodyText: '{}',
    nonce,
  })

  assert.equal(signature.includes(channelSecret), false)
})
