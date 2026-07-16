import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { confirmLinePayPayment } from './confirmClient'
import { requestLinePayPayment } from './requestClient'
import { checkLinePayPaymentRequestStatus, getLinePayPaymentDetails } from './statusClient'
import {
  buildGatewayCanonicalString,
  LINE_PAY_GATEWAY_PROXY_PATH,
  LinePayTransportError,
  sendLinePayRequest,
  type LinePayTransportEnv,
  type LinePayTransportFetch,
  type LinePayTransportFetchInit,
} from './transport'

const channelId = 'transport-test-channel'
const channelSecret = 'transport-test-line-secret'
const gatewaySecret = 'transport-test-gateway-secret'
const transactionId = '2026070700000000001'
const orderId = 'LP20260707153000A1B2'
const gatewayEnv = {
  LINE_PAY_TRANSPORT: 'gateway',
  LINE_PAY_GATEWAY_URL: 'https://gateway.example.com',
  LINE_PAY_GATEWAY_KEY_ID: 'gateway-key-1',
  LINE_PAY_GATEWAY_SECRET: gatewaySecret,
  LINE_PAY_GATEWAY_TIMEOUT_MS: '100',
}
const tests: Array<{ name: string; fn: () => void | Promise<void> }> = []

function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn })
}

function responseForOperation(operation: string) {
  if (operation === 'request') {
    return {
      returnCode: '0000',
      info: { transactionId, paymentUrl: { web: 'https://line.example/pay' } },
    }
  }
  if (operation === 'confirm') {
    return { returnCode: '0000', info: { transactionId, orderId } }
  }
  if (operation === 'status') return { returnCode: '0123', returnMessage: 'completed' }
  return { returnCode: '0000', info: [{ transactionId, orderId, amount: 1500, currency: 'TWD' }] }
}

function createGatewayFetch(calls: Array<{ url: string; init: LinePayTransportFetchInit }> = []) {
  const fetchFn: LinePayTransportFetch = async (url, init) => {
    calls.push({ url, init })
    const gatewayBody = JSON.parse(init.body ?? '{}') as { operation?: string }
    return {
      status: 200,
      json: async () => ({
        ok: true,
        upstreamStatus: 200,
        body: responseForOperation(gatewayBody.operation ?? ''),
      }),
    }
  }
  return fetchFn
}

function requestInput(fetchFn: LinePayTransportFetch, transportEnv: LinePayTransportEnv = gatewayEnv) {
  return {
    environment: 'sandbox',
    channelId,
    channelSecret,
    nonce: 'line-pay-nonce-request',
    fetchFn,
    transportEnv,
    payloadInput: {
      orderId,
      amount: 1500,
      products: [{ name: '測試商品', quantity: 1, price: 1500 }],
      confirmUrl: 'https://example.com/confirm',
      cancelUrl: 'https://example.com/cancel',
    },
  }
}

test('direct mode preserves the original LINE Pay URL, method, body and headers', async () => {
  const calls: Array<{ url: string; init: LinePayTransportFetchInit }> = []
  const fetchFn: LinePayTransportFetch = async (url, init) => {
    calls.push({ url, init })
    return { json: async () => responseForOperation('request') }
  }
  await requestLinePayPayment(requestInput(fetchFn, { LINE_PAY_TRANSPORT: 'direct' }))
  assert.equal(calls[0]?.url, 'https://sandbox-api-pay.line.me/v3/payments/request')
  assert.equal(calls[0]?.init.method, 'POST')
  assert.equal(calls[0]?.init.headers['X-LINE-ChannelId'], channelId)
  assert.equal(typeof calls[0]?.init.body, 'string')
})

test('gateway canonical signature covers method, path, timestamp, nonce and exact body hash', async () => {
  const calls: Array<{ url: string; init: LinePayTransportFetchInit }> = []
  const fetchFn = createGatewayFetch(calls)
  const now = 1_800_000_000_000
  await sendLinePayRequest({
    operation: 'status',
    environment: 'sandbox',
    method: 'GET',
    apiPath: `/v3/payments/requests/${transactionId}/check`,
    linePayHeaders: { 'Content-Type': 'application/json' },
    transactionId,
    fetchFn,
    transportEnv: gatewayEnv,
    now: () => now,
    createNonce: () => 'gateway-nonce-fixed',
    createRequestId: () => 'gateway-request-fixed',
  })
  const call = calls[0]
  const canonical = buildGatewayCanonicalString({
    method: 'POST',
    requestPath: LINE_PAY_GATEWAY_PROXY_PATH,
    timestamp: String(Math.floor(now / 1_000)),
    nonce: 'gateway-nonce-fixed',
    bodyText: call?.init.body ?? '',
  })
  const bodyHash = createHash('sha256').update(call?.init.body ?? '').digest('hex')
  assert.equal(
    canonical,
    `POST\n${LINE_PAY_GATEWAY_PROXY_PATH}\n${String(Math.floor(now / 1_000))}\ngateway-nonce-fixed\n${bodyHash}`,
  )
  const expected = createHmac('sha256', gatewaySecret).update(canonical).digest('hex')
  assert.equal(call?.init.headers['x-gateway-signature'], expected)
  assert.equal(call?.url, 'https://gateway.example.com/v1/line-pay/proxy')
})

test('request operation is forwarded through gateway and keeps transactionId as string', async () => {
  const calls: Array<{ url: string; init: LinePayTransportFetchInit }> = []
  const result = await requestLinePayPayment(requestInput(createGatewayFetch(calls)))
  assert.equal(JSON.parse(calls[0]?.init.body ?? '{}').operation, 'request')
  assert.equal(result.transactionId, transactionId)
  assert.equal(typeof result.transactionId, 'string')
})

test('confirm operation is forwarded through gateway', async () => {
  const calls: Array<{ url: string; init: LinePayTransportFetchInit }> = []
  await confirmLinePayPayment({
    environment: 'sandbox',
    channelId,
    channelSecret,
    nonce: 'line-pay-nonce-confirm',
    transactionId,
    payloadInput: { amount: 1500 },
    fetchFn: createGatewayFetch(calls),
    transportEnv: gatewayEnv,
  })
  const body = JSON.parse(calls[0]?.init.body ?? '{}')
  assert.equal(body.operation, 'confirm')
  assert.equal(body.transactionId, transactionId)
})

test('status operation is forwarded through gateway', async () => {
  const calls: Array<{ url: string; init: LinePayTransportFetchInit }> = []
  const result = await checkLinePayPaymentRequestStatus({
    environment: 'sandbox',
    channelId,
    channelSecret,
    nonce: 'line-pay-nonce-status',
    transactionId,
    fetchFn: createGatewayFetch(calls),
    transportEnv: gatewayEnv,
  })
  assert.equal(JSON.parse(calls[0]?.init.body ?? '{}').operation, 'status')
  assert.equal(result.status, 'payment_completed')
})

test('paymentDetails operation is forwarded through gateway with fixed lookup fields', async () => {
  const calls: Array<{ url: string; init: LinePayTransportFetchInit }> = []
  const result = await getLinePayPaymentDetails({
    environment: 'sandbox',
    channelId,
    channelSecret,
    nonce: 'line-pay-nonce-details',
    transactionId,
    orderId,
    fetchFn: createGatewayFetch(calls),
    transportEnv: gatewayEnv,
  })
  const body = JSON.parse(calls[0]?.init.body ?? '{}')
  assert.equal(body.operation, 'paymentDetails')
  assert.equal(body.transactionId, transactionId)
  assert.equal(body.orderId, orderId)
  assert.equal(result.info[0]?.transactionId, transactionId)
})

test('gateway timeout aborts with a stable error', async () => {
  const fetchFn: LinePayTransportFetch = async (_url, init) => ({
    json: async () =>
      new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted')))),
  })
  await assert.rejects(() => requestLinePayPayment(requestInput(fetchFn)), /line_pay_gateway_timeout/)
})

test('gateway non-JSON response becomes a stable controlled error', async () => {
  const fetchFn: LinePayTransportFetch = async () => ({
    json: async () => {
      throw new SyntaxError('unexpected HTML')
    },
  })
  await assert.rejects(
    () => requestLinePayPayment(requestInput(fetchFn)),
    (error: unknown) =>
      error instanceof LinePayTransportError && error.code === 'invalid_line_pay_gateway_response',
  )
})

test('production gateway mode fails closed when any required setting is missing', async () => {
  let calls = 0
  const fetchFn: LinePayTransportFetch = async () => {
    calls += 1
    return { json: async () => responseForOperation('request') }
  }
  await assert.rejects(
    () =>
      requestLinePayPayment({
        ...requestInput(fetchFn, { LINE_PAY_TRANSPORT: 'gateway' }),
        environment: 'production',
      }),
    /missing_line_pay_gateway_config/,
  )
  assert.equal(calls, 0)
})

test('sandbox gateway mode also fails closed when required settings are missing', async () => {
  let calls = 0
  const fetchFn: LinePayTransportFetch = async () => {
    calls += 1
    return { json: async () => responseForOperation('request') }
  }
  await assert.rejects(
    () => requestLinePayPayment(requestInput(fetchFn, { LINE_PAY_TRANSPORT: 'gateway' })),
    /missing_line_pay_gateway_config/,
  )
  assert.equal(calls, 0)
})

test('gateway failure never falls back to direct LINE Pay', async () => {
  const urls: string[] = []
  const fetchFn: LinePayTransportFetch = async (url) => {
    urls.push(url)
    throw new Error('gateway down')
  }
  await assert.rejects(() => requestLinePayPayment(requestInput(fetchFn)), /line_pay_gateway_unavailable/)
  assert.deepEqual(urls, ['https://gateway.example.com/v1/line-pay/proxy'])
})

test('Gateway payload preserves the complete LINE Pay official header set', async () => {
  const calls: Array<{ url: string; init: LinePayTransportFetchInit }> = []
  await requestLinePayPayment(requestInput(createGatewayFetch(calls)))
  const body = JSON.parse(calls[0]?.init.body ?? '{}') as {
    linePayHeaders?: Record<string, string>
  }
  assert.equal(body.linePayHeaders?.['Content-Type'], 'application/json')
  assert.equal(body.linePayHeaders?.['X-LINE-ChannelId'], channelId)
  assert.equal(typeof body.linePayHeaders?.['X-LINE-Authorization'], 'string')
  assert.equal(body.linePayHeaders?.['X-LINE-Authorization-Nonce'], 'line-pay-nonce-request')
  assert.deepEqual(Object.keys(body.linePayHeaders ?? {}).sort(), [
    'Content-Type',
    'X-LINE-Authorization',
    'X-LINE-Authorization-Nonce',
    'X-LINE-ChannelId',
  ])
})

test('all LINE Pay clients delegate external calls to the unified transport', () => {
  for (const file of ['requestClient.ts', 'confirmClient.ts', 'statusClient.ts']) {
    const source = readFileSync(join(process.cwd(), 'src/lib/linePay', file), 'utf8')
    assert.equal(source.includes('sendLinePayRequest({'), true, `${file} must use sendLinePayRequest`)
    assert.equal(source.includes('getLinePayBaseUrl'), false, `${file} must not construct a direct upstream URL`)
    assert.equal(source.includes('api-pay.line.me'), false, `${file} must not contain an upstream hostname`)
  }
})

async function main() {
  for (const entry of tests) {
    await entry.fn()
    console.log(`✓ ${entry.name}`)
  }
  console.log(`${tests.length} transport tests passed`)
}

void main()
