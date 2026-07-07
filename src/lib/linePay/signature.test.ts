import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { buildLinePayRequestHeaders, buildLinePaySignature } from './signature'

const channelId = 'test_channel_id'
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

test('request headers contain required LINE Pay headers', () => {
  const headers = buildLinePayRequestHeaders({
    channelId,
    channelSecret,
    method: 'POST',
    apiPath: '/v3/payments/request',
    bodyText: '{}',
    nonce,
  })

  assert.equal(headers['Content-Type'], 'application/json')
  assert.equal(headers['X-LINE-ChannelId'], channelId)
  assert.equal(typeof headers['X-LINE-Authorization'], 'string')
  assert.equal(headers['X-LINE-Authorization-Nonce'], nonce)
})

test('request authorization header equals buildLinePaySignature output', () => {
  const signatureInput = {
    channelSecret,
    method: 'POST',
    apiPath: '/v3/payments/request',
    bodyText: '{}',
    nonce,
  } as const
  const headers = buildLinePayRequestHeaders({
    channelId,
    ...signatureInput,
  })

  assert.equal(headers['X-LINE-Authorization'], buildLinePaySignature(signatureInput))
})

test('request headers do not include channelSecret', () => {
  const headers = buildLinePayRequestHeaders({
    channelId,
    channelSecret,
    method: 'POST',
    apiPath: '/v3/payments/request',
    bodyText: '{}',
    nonce,
  })

  assert.equal(Object.keys(headers).includes('channelSecret'), false)
  assert.equal(Object.values(headers).includes(channelSecret), false)
  assert.equal(JSON.stringify(headers).includes(channelSecret), false)
})

test('empty channelId throws safe credentials error', () => {
  assert.throws(
    () =>
      buildLinePayRequestHeaders({
        channelId: '  ',
        channelSecret,
        method: 'POST',
        apiPath: '/v3/payments/request',
        bodyText: '{}',
        nonce,
      }),
    /invalid_line_pay_credentials/,
  )
})
