import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { confirmLinePayPayment } from './confirmClient'
import { requestLinePayPayment } from './requestClient'
import { checkLinePayPaymentRequestStatus, getLinePayPaymentDetails } from './statusClient'
import {
  buildGatewayCanonicalString,
  getLinePayTransportConfig,
  LINE_PAY_GATEWAY_PROXY_PATH,
  LinePayTransportError,
  probeLinePayGatewayAuthentication,
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
const smokeGatewayEnv = {
  ...gatewayEnv,
  VERCEL_ENV: 'preview',
  LINE_PAY_GATEWAY_SMOKE_ENABLED: 'true',
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

function assertGatewayUrlRejectedInEveryRuntime(gatewayUrl: string, label = gatewayUrl) {
  for (const vercelEnv of ['preview', 'production', 'development']) {
    assert.throws(
      () =>
        getLinePayTransportConfig(
          { ...gatewayEnv, VERCEL_ENV: vercelEnv, LINE_PAY_GATEWAY_URL: gatewayUrl },
          vercelEnv === 'production' ? 'production' : 'sandbox',
        ),
      (error: unknown) =>
        error instanceof LinePayTransportError && error.code === 'invalid_line_pay_gateway_url',
      `${label} must be rejected in ${vercelEnv}`,
    )
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

test('Preview accepts only an explicitly configured gateway transport', () => {
  assert.equal(
    getLinePayTransportConfig({ ...gatewayEnv, VERCEL_ENV: 'preview' }, 'sandbox').mode,
    'gateway',
  )

  for (const configuredTransport of [undefined, '', 'direct']) {
    assert.throws(
      () =>
        getLinePayTransportConfig(
          { ...gatewayEnv, VERCEL_ENV: 'preview', LINE_PAY_TRANSPORT: configuredTransport },
          'sandbox',
        ),
      (error: unknown) =>
        error instanceof LinePayTransportError && error.code === 'line_pay_preview_requires_gateway',
    )
  }
})

test('unknown transport values never fall back to direct', () => {
  for (const vercelEnv of ['preview', 'production', 'development', undefined]) {
    assert.throws(
      () =>
        getLinePayTransportConfig(
          { VERCEL_ENV: vercelEnv, LINE_PAY_TRANSPORT: 'automatic' },
          vercelEnv === 'production' ? 'production' : 'sandbox',
        ),
      (error: unknown) =>
        error instanceof LinePayTransportError &&
        error.code === (vercelEnv === 'preview' ? 'line_pay_preview_requires_gateway' : 'invalid_line_pay_transport'),
    )
  }
})

test('Production direct and development missing transport preserve their existing behavior', () => {
  assert.deepEqual(
    getLinePayTransportConfig({ VERCEL_ENV: 'production', LINE_PAY_TRANSPORT: 'direct' }, 'production'),
    { mode: 'direct' },
  )
  assert.deepEqual(getLinePayTransportConfig({ VERCEL_ENV: 'development' }, 'sandbox'), { mode: 'direct' })
  assert.deepEqual(getLinePayTransportConfig({}, 'sandbox'), { mode: 'direct' })
})

test('Gateway URL accepts canonical public HTTPS origins with explicit case and IDNA normalization', () => {
  for (const [gatewayUrl, expectedUrl] of [
    [
      'https://linepay-gateway.tsu-waterbottle.com',
      'https://linepay-gateway.tsu-waterbottle.com/v1/line-pay/proxy',
    ],
    ['HTTPS://EXAMPLE.COM', 'https://example.com/v1/line-pay/proxy'],
    ['https://xn--bcher-kva.de', 'https://xn--bcher-kva.de/v1/line-pay/proxy'],
  ]) {
    const accepted = getLinePayTransportConfig(
      { ...gatewayEnv, VERCEL_ENV: 'preview', LINE_PAY_GATEWAY_URL: gatewayUrl },
      'sandbox',
    )
    assert.equal(accepted.mode === 'gateway' ? accepted.gatewayUrl : null, expectedUrl)
  }
})

test('Gateway URL raw validation rejects non-HTTPS schemes, empty authority, userinfo and every explicit port', () => {
  for (const gatewayUrl of [
    'http://linepay-gateway.tsu-waterbottle.com',
    'ftp://linepay-gateway.tsu-waterbottle.com',
    'ws://linepay-gateway.tsu-waterbottle.com',
    'https://',
    'https://example.com:443',
    'https://example.com:0443',
    'https://example.com:444',
    'https://[::1]:443',
    'https://user@example.com',
    'https://user:pass@example.com',
    'https://user%3Apass@example.com',
  ]) {
    assertGatewayUrlRejectedInEveryRuntime(gatewayUrl)
  }
})

test('Gateway URL raw validation rejects root, literal, encoded and multi-slash paths before URL normalization', () => {
  for (const gatewayUrl of [
    'https://example.com/',
    'https://example.com/path',
    'https://example.com//',
    'https://example.com/.',
    'https://example.com/..',
    'https://example.com/a/..',
    'https://example.com/%2e/',
    'https://example.com/%2e%2e/',
    'https://example.com/%2E%2E/',
    'https://example.com/%2e%2e',
    'https://example.com/%2e%2e%2f',
    'https://example.com/%2f',
  ]) {
    assertGatewayUrlRejectedInEveryRuntime(gatewayUrl)
  }
})

test('Gateway URL raw validation rejects query, fragment, backslash, whitespace and control characters', () => {
  for (const gatewayUrl of [
    'https://example.com?x=1',
    'https://example.com#x',
    String.raw`https://example.com\path`,
    String.raw`https://example.com\@localhost`,
    ' https://example.com',
    'https://example.com ',
    'https://exa mple.com',
  ]) {
    assertGatewayUrlRejectedInEveryRuntime(gatewayUrl)
  }

  for (const characterCode of [9, 10, 13, 0]) {
    assertGatewayUrlRejectedInEveryRuntime(
      `https://example.com${String.fromCharCode(characterCode)}`,
      `control character U+${characterCode.toString(16).padStart(4, '0')}`,
    )
  }
})

test('Gateway URL semantic validation rejects trailing-dot, localhost and special IP hostnames', () => {
  for (const gatewayUrl of [
    'https://localhost.',
    'https://foo.localhost.',
    'https://example.com.',
    'https://linepay-gateway.tsu-waterbottle.com.',
    'https://localhost',
    'https://foo.localhost',
    'https://127.0.0.1',
    'https://127.1',
    'https://2130706433',
    'https://0x7f000001',
    'https://017700000001',
    'https://[::1]',
    'https://[0:0:0:0:0:0:0:1]',
  ]) {
    assertGatewayUrlRejectedInEveryRuntime(gatewayUrl)
  }
})

test('Gateway config errors expose neither secret values nor the unsafe URL', () => {
  const secretMarker = 'gateway-secret-must-stay-redacted'
  const unsafeUrl = 'https://user:password@example.com/private?token=hidden'
  assert.throws(
    () =>
      getLinePayTransportConfig(
        {
          ...gatewayEnv,
          VERCEL_ENV: 'preview',
          LINE_PAY_GATEWAY_SECRET: secretMarker,
          LINE_PAY_GATEWAY_URL: unsafeUrl,
        },
        'sandbox',
      ),
    (error: unknown) =>
      error instanceof LinePayTransportError &&
      error.code === 'invalid_line_pay_gateway_url' &&
      !error.message.includes(secretMarker) &&
      !error.message.includes(unsafeUrl),
  )
})

test('authenticated smoke signs a fixed unsupported operation and accepts only the post-auth rejection', async () => {
  const calls: Array<{ url: string; init: LinePayTransportFetchInit }> = []
  const now = 1_800_000_000_000
  const fetchFn: LinePayTransportFetch = async (url, init) => {
    calls.push({ url, init })
    return {
      status: 400,
      json: async () => ({ ok: false, error: 'invalid_operation' }),
    }
  }
  const result = await probeLinePayGatewayAuthentication({
    fetchFn,
    transportEnv: smokeGatewayEnv,
    now: () => now,
    createNonce: () => 'smoke-nonce-fixed',
    createRequestId: () => 'smoke-request-fixed',
  })
  const call = calls[0]
  const bodyText = call?.init.body ?? ''
  const body = JSON.parse(bodyText) as Record<string, unknown>

  assert.deepEqual(result, { ok: true, authenticated: true, upstreamCalled: false })
  assert.equal(calls.length, 1)
  assert.equal(call?.url, 'https://gateway.example.com/v1/line-pay/proxy')
  assert.deepEqual(body, {
    operation: 'gatewayAuthenticationSmoke',
    environment: 'sandbox',
    requestId: 'smoke-request-fixed',
    linePayHeaders: {},
  })
  const canonical = buildGatewayCanonicalString({
    method: 'POST',
    requestPath: LINE_PAY_GATEWAY_PROXY_PATH,
    timestamp: String(Math.floor(now / 1_000)),
    nonce: 'smoke-nonce-fixed',
    bodyText,
  })
  assert.equal(
    call?.init.headers['x-gateway-signature'],
    createHmac('sha256', gatewaySecret).update(canonical).digest('hex'),
  )
  assert.equal(call?.init.headers['x-gateway-proxy-token'], undefined)
  assert.equal(call?.init.headers['X-LINE-Authorization'], undefined)
})

test('smoke probe itself is unavailable outside an explicitly enabled Preview', async () => {
  for (const transportEnv of [
    { ...smokeGatewayEnv, VERCEL_ENV: 'production' },
    { ...smokeGatewayEnv, VERCEL_ENV: 'development' },
    { ...smokeGatewayEnv, VERCEL_ENV: undefined },
    { ...smokeGatewayEnv, LINE_PAY_GATEWAY_SMOKE_ENABLED: 'false' },
    { ...smokeGatewayEnv, LINE_PAY_GATEWAY_SMOKE_ENABLED: undefined },
  ]) {
    let calls = 0
    await assert.rejects(
      () =>
        probeLinePayGatewayAuthentication({
          fetchFn: async () => {
            calls += 1
            return { status: 400, json: async () => ({ ok: false, error: 'invalid_operation' }) }
          },
          transportEnv,
        }),
      (error: unknown) =>
        error instanceof LinePayTransportError && error.code === 'line_pay_gateway_smoke_unavailable',
    )
    assert.equal(calls, 0)
  }
})

test('smoke refuses unauthenticated or ambiguous Gateway responses', async () => {
  for (const response of [
    { status: 401, body: { ok: false, error: 'unauthorized' } },
    { status: 400, body: { ok: false, error: 'invalid_request' } },
    { status: 200, body: { ok: true, authenticated: true } },
  ]) {
    await assert.rejects(
      () =>
        probeLinePayGatewayAuthentication({
          fetchFn: async () => ({ status: response.status, json: async () => response.body }),
          transportEnv: smokeGatewayEnv,
        }),
      (error: unknown) =>
        error instanceof LinePayTransportError && error.code === 'line_pay_gateway_smoke_failed',
    )
  }
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
