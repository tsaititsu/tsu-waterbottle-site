import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import test from 'node:test'
import {
  createGatewayHandler,
  type GatewayLogEntry,
  type GatewayRequest,
  type GatewayUpstreamFetch,
} from '../src/app.js'
import {
  buildCanonicalString,
  GATEWAY_PROXY_PATH,
  MAX_GATEWAY_BODY_BYTES,
  type GatewayConfig,
} from '../src/security.js'

const nowMs = 1_800_000_000_000
const secret = 'gateway-test-secret-never-production'
const keyId = 'gateway-test-key'
const channelSecret = 'fake-channel-secret-never-log'
const linePayHeaders = {
  'Content-Type': 'application/json',
  'X-LINE-ChannelId': 'fake-channel',
  'X-LINE-Authorization': 'fake-line-signature',
  'X-LINE-Authorization-Nonce': 'fake-line-nonce',
}
const config: GatewayConfig = {
  port: 3000,
  environment: 'sandbox',
  keyId,
  secret,
  upstreamTimeoutMs: 100,
  timestampToleranceSeconds: 60,
  replayTtlSeconds: 120,
  rateLimitWindowMs: 60_000,
  rateLimitMax: 120,
}

function successFetch(calls: Array<{ url: string }> = []): GatewayUpstreamFetch {
  return async (url) => {
    calls.push({ url })
    return { status: 200, text: async () => JSON.stringify({ returnCode: '0000' }) }
  }
}

function buildSignedRequest(
  payloadValue: Record<string, unknown>,
  overrides: { nonce?: string; requestId?: string; timestamp?: string; signature?: string } = {},
): GatewayRequest {
  const requestId = overrides.requestId ?? String(payloadValue.requestId ?? 'request-id-0001')
  const nonce = overrides.nonce ?? 'nonce-id-0001'
  const timestamp = overrides.timestamp ?? String(Math.floor(nowMs / 1_000))
  const bodyText = JSON.stringify({ ...payloadValue, requestId })
  const canonical = buildCanonicalString({
    method: 'POST',
    requestPath: GATEWAY_PROXY_PATH,
    timestamp,
    nonce,
    rawBody: Buffer.from(bodyText, 'utf8'),
  })
  const signature = overrides.signature ?? createHmac('sha256', secret).update(canonical).digest('hex')

  return {
    method: 'POST',
    path: GATEWAY_PROXY_PATH,
    headers: {
      'content-type': 'application/json',
      'x-gateway-key-id': keyId,
      'x-gateway-timestamp': timestamp,
      'x-gateway-nonce': nonce,
      'x-gateway-request-id': requestId,
      'x-gateway-signature': signature,
    },
    bodyText,
    rawBody: Buffer.from(bodyText, 'utf8'),
    remoteAddress: '127.0.0.1',
  }
}

function requestPayload() {
  return {
    operation: 'request',
    environment: 'sandbox',
    requestId: 'request-id-0001',
    bodyText: JSON.stringify({ amount: 1500 }),
    linePayHeaders,
  }
}

test('GET /health does not require authentication', async () => {
  const handler = createGatewayHandler(config, { fetchFn: successFetch(), now: () => nowMs })
  const response = await handler({ method: 'GET', path: '/health', headers: {}, bodyText: '' })
  assert.deepEqual(response, { statusCode: 200, body: { ok: true, status: 'healthy' } })
})

test('Gateway canonical contract uses method, path, seconds, nonce and exact raw-body SHA256', () => {
  const rawBody = Buffer.from('{"operation":"status","note":"測試"}', 'utf8')
  const timestamp = String(Math.floor(nowMs / 1_000))
  const nonce = 'canonical-nonce'
  const expectedHash = createHash('sha256').update(rawBody).digest('hex')
  assert.equal(
    buildCanonicalString({
      method: 'post',
      requestPath: GATEWAY_PROXY_PATH,
      timestamp,
      nonce,
      rawBody,
    }),
    `POST\n${GATEWAY_PROXY_PATH}\n${timestamp}\n${nonce}\n${expectedHash}`,
  )
})

test('valid HMAC is accepted and request operation reaches the fixed sandbox host', async () => {
  const calls: Array<{ url: string }> = []
  const handler = createGatewayHandler(config, { fetchFn: successFetch(calls), now: () => nowMs })
  const response = await handler(buildSignedRequest(requestPayload()))
  assert.equal(response.statusCode, 200)
  assert.equal(calls[0]?.url, 'https://sandbox-api-pay.line.me/v3/payments/request')
})

test('invalid HMAC returns 401 and never calls upstream', async () => {
  const calls: Array<{ url: string }> = []
  const handler = createGatewayHandler(config, { fetchFn: successFetch(calls), now: () => nowMs })
  const response = await handler(buildSignedRequest(requestPayload(), { signature: '0'.repeat(64) }))
  assert.equal(response.statusCode, 401)
  assert.equal(calls.length, 0)
})

test('expired timestamp returns 401', async () => {
  const handler = createGatewayHandler(config, { fetchFn: successFetch(), now: () => nowMs })
  const response = await handler(
    buildSignedRequest(requestPayload(), { timestamp: String(Math.floor(nowMs / 1_000) - 61) }),
  )
  assert.equal(response.statusCode, 401)
})

test('future timestamp outside the allowed window returns 401', async () => {
  const handler = createGatewayHandler(config, { fetchFn: successFetch(), now: () => nowMs })
  const response = await handler(
    buildSignedRequest(requestPayload(), { timestamp: String(Math.floor(nowMs / 1_000) + 61) }),
  )
  assert.equal(response.statusCode, 401)
})

test('replayed nonce returns 409 even with a new requestId', async () => {
  const handler = createGatewayHandler(config, { fetchFn: successFetch(), now: () => nowMs })
  assert.equal(
    (
      await handler(
        buildSignedRequest(requestPayload(), { nonce: 'reused-nonce-01', requestId: 'request-id-replay-01' }),
      )
    ).statusCode,
    200,
  )
  assert.equal(
    (
      await handler(
        buildSignedRequest(requestPayload(), { nonce: 'reused-nonce-01', requestId: 'request-id-replay-02' }),
      )
    ).statusCode,
    409,
  )
})

test('replayed requestId returns 409 even with a new nonce', async () => {
  const handler = createGatewayHandler(config, { fetchFn: successFetch(), now: () => nowMs })
  assert.equal(
    (
      await handler(
        buildSignedRequest(requestPayload(), { nonce: 'request-replay-nonce-01', requestId: 'reused-request-id' }),
      )
    ).statusCode,
    200,
  )
  assert.equal(
    (
      await handler(
        buildSignedRequest(requestPayload(), { nonce: 'request-replay-nonce-02', requestId: 'reused-request-id' }),
      )
    ).statusCode,
    409,
  )
})

test('invalid HMAC does not consume nonce or requestId', async () => {
  const handler = createGatewayHandler(config, { fetchFn: successFetch(), now: () => nowMs })
  const overrides = { nonce: 'not-consumed-nonce', requestId: 'not-consumed-request' }
  assert.equal(
    (await handler(buildSignedRequest(requestPayload(), { ...overrides, signature: '0'.repeat(64) }))).statusCode,
    401,
  )
  assert.equal((await handler(buildSignedRequest(requestPayload(), overrides))).statusCode, 200)
})

test('arbitrary URL, hostname, protocol or port fields are rejected', async () => {
  const calls: Array<{ url: string }> = []
  const handler = createGatewayHandler(config, { fetchFn: successFetch(calls), now: () => nowMs })
  const response = await handler(
    buildSignedRequest(
      { ...requestPayload(), url: 'http://evil.example:8080/steal' },
      { nonce: 'nonce-id-0002', requestId: 'request-id-0002' },
    ),
  )
  assert.equal(response.statusCode, 400)
  assert.equal(calls.length, 0)
})

test('arbitrary hostname field is rejected before upstream', async () => {
  const calls: Array<{ url: string }> = []
  const handler = createGatewayHandler(config, { fetchFn: successFetch(calls), now: () => nowMs })
  const response = await handler(
    buildSignedRequest(
      { ...requestPayload(), hostname: 'evil.example' },
      { nonce: 'nonce-hostname-01', requestId: 'request-hostname-01' },
    ),
  )
  assert.equal(response.statusCode, 400)
  assert.equal(calls.length, 0)
})

test('operation outside the request/confirm/status/paymentDetails whitelist is rejected', async () => {
  const handler = createGatewayHandler(config, { fetchFn: successFetch(), now: () => nowMs })
  const response = await handler(
    buildSignedRequest(
      { ...requestPayload(), operation: 'refund' },
      { nonce: 'nonce-id-0003', requestId: 'request-id-0003' },
    ),
  )
  assert.equal(response.statusCode, 400)
  assert.equal(response.body.error, 'invalid_operation')
})

test('request body over 64 KB returns 413 before authentication', async () => {
  const handler = createGatewayHandler(config, { fetchFn: successFetch(), now: () => nowMs })
  const response = await handler({
    method: 'POST',
    path: GATEWAY_PROXY_PATH,
    headers: { 'content-type': 'application/json' },
    bodyText: '',
    bodyByteLength: MAX_GATEWAY_BODY_BYTES + 1,
  })
  assert.equal(response.statusCode, 413)
})

test('non-JSON Content-Type returns 415', async () => {
  const handler = createGatewayHandler(config, { fetchFn: successFetch(), now: () => nowMs })
  const request = buildSignedRequest(requestPayload(), {
    nonce: 'nonce-content-type',
    requestId: 'request-content-type',
  })
  request.headers['content-type'] = 'text/plain'
  const response = await handler(request)
  assert.equal(response.statusCode, 415)
})

test('upstream timeout returns a controlled 504 without retrying', async () => {
  let calls = 0
  const fetchFn: GatewayUpstreamFetch = async (_url, init) => {
    calls += 1
    return {
      status: 200,
      text: async () =>
        new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))),
    }
  }
  const handler = createGatewayHandler(config, { fetchFn, now: () => nowMs })
  const response = await handler(
    buildSignedRequest(requestPayload(), { nonce: 'nonce-id-0004', requestId: 'request-id-0004' }),
  )
  assert.equal(response.statusCode, 504)
  assert.equal(response.body.error, 'upstream_timeout')
  assert.equal(calls, 1)
})

test('non-JSON upstream response becomes a controlled 502', async () => {
  const fetchFn: GatewayUpstreamFetch = async () => ({ status: 502, text: async () => '<html>bad gateway</html>' })
  const handler = createGatewayHandler(config, { fetchFn, now: () => nowMs })
  const response = await handler(
    buildSignedRequest(requestPayload(), { nonce: 'nonce-id-0005', requestId: 'request-id-0005' }),
  )
  assert.deepEqual(response, { statusCode: 502, body: { ok: false, error: 'invalid_upstream_json' } })
})

test('upstream redirect is rejected and never retried', async () => {
  let calls = 0
  const fetchFn: GatewayUpstreamFetch = async (_url, init) => {
    calls += 1
    assert.equal(init.redirect, 'error')
    throw new TypeError('redirect mode is error')
  }
  const handler = createGatewayHandler(config, { fetchFn, now: () => nowMs })
  const response = await handler(
    buildSignedRequest(requestPayload(), { nonce: 'nonce-redirect-01', requestId: 'request-redirect-01' }),
  )
  assert.deepEqual(response, { statusCode: 502, body: { ok: false, error: 'upstream_unavailable' } })
  assert.equal(calls, 1)
})

test('rate limit uses the socket address and cannot be bypassed with forwarded headers', async () => {
  const limitedConfig = { ...config, rateLimitMax: 1 }
  const handler = createGatewayHandler(limitedConfig, { fetchFn: successFetch(), now: () => nowMs })
  const first = buildSignedRequest(requestPayload(), { nonce: 'nonce-rate-01', requestId: 'request-rate-01' })
  first.headers['x-forwarded-for'] = '198.51.100.10'
  const second = buildSignedRequest(requestPayload(), { nonce: 'nonce-rate-02', requestId: 'request-rate-02' })
  second.headers['x-forwarded-for'] = '203.0.113.20'
  assert.equal((await handler(first)).statusCode, 200)
  assert.equal((await handler(second)).statusCode, 429)
})

test('production environment maps only to the production LINE Pay hostname', async () => {
  const calls: Array<{ url: string }> = []
  const productionConfig = { ...config, environment: 'production' as const }
  const handler = createGatewayHandler(productionConfig, { fetchFn: successFetch(calls), now: () => nowMs })
  const response = await handler(
    buildSignedRequest(
      { ...requestPayload(), environment: 'production' },
      { nonce: 'nonce-production-01', requestId: 'request-production-01' },
    ),
  )
  assert.equal(response.statusCode, 200)
  assert.equal(calls[0]?.url, 'https://api-pay.line.me/v3/payments/request')
})

test('request body cannot switch the configured Gateway environment', async () => {
  const calls: Array<{ url: string }> = []
  const handler = createGatewayHandler(config, { fetchFn: successFetch(calls), now: () => nowMs })
  const response = await handler(
    buildSignedRequest(
      { ...requestPayload(), environment: 'production' },
      { nonce: 'nonce-env-mismatch', requestId: 'request-env-mismatch' },
    ),
  )
  assert.equal(response.statusCode, 400)
  assert.equal(response.body.error, 'environment_mismatch')
  assert.equal(calls.length, 0)
})

test('all hop-by-hop and arbitrary LINE Pay headers are rejected', async () => {
  const calls: Array<{ url: string }> = []
  const handler = createGatewayHandler(config, { fetchFn: successFetch(calls), now: () => nowMs })
  const blockedHeaders = ['Host', 'Connection', 'Content-Length', 'Transfer-Encoding', 'Keep-Alive', 'Upgrade']

  for (const [index, header] of blockedHeaders.entries()) {
    const response = await handler(
      buildSignedRequest(
        { ...requestPayload(), linePayHeaders: { ...linePayHeaders, [header]: 'blocked-value' } },
        { nonce: `nonce-hop-header-${index}`, requestId: `request-hop-header-${index}` },
      ),
    )
    assert.equal(response.statusCode, 400, `${header} must be rejected`)
    assert.equal(response.body.error, 'invalid_line_pay_headers')
  }
  assert.equal(calls.length, 0)
})

test('HMAC verifies the exact raw UTF-8 body bytes', async () => {
  const calls: Array<{ url: string }> = []
  const handler = createGatewayHandler(config, { fetchFn: successFetch(calls), now: () => nowMs })
  const request = buildSignedRequest(
    { ...requestPayload(), bodyText: JSON.stringify({ amount: 1500, note: '測試' }) },
    { nonce: 'nonce-raw-body-01', requestId: 'request-raw-body-01' },
  )
  assert.equal((await handler(request)).statusCode, 200)

  const tampered = buildSignedRequest(
    { ...requestPayload(), bodyText: JSON.stringify({ amount: 1500, note: '測試' }) },
    { nonce: 'nonce-raw-body-02', requestId: 'request-raw-body-02' },
  )
  tampered.rawBody = Buffer.concat([tampered.rawBody ?? Buffer.from(tampered.bodyText, 'utf8'), Buffer.from(' ')])
  assert.equal((await handler(tampered)).statusCode, 400)
  assert.equal(calls.length, 1)
})

test('structured logs contain only allowlisted metadata and never secrets or signatures', async () => {
  const entries: GatewayLogEntry[] = []
  const handler = createGatewayHandler(config, {
    fetchFn: successFetch(),
    now: () => nowMs,
    logger: (entry) => entries.push(entry),
  })
  const request = buildSignedRequest(
    { ...requestPayload(), bodyText: JSON.stringify({ amount: 1500, channelSecret }) },
    { nonce: 'nonce-id-0006', requestId: 'request-id-0006' },
  )
  await handler(request)
  const logText = JSON.stringify(entries)
  const gatewaySignature = request.headers['x-gateway-signature']
  assert.equal(typeof gatewaySignature, 'string')
  assert.equal(logText.includes(secret), false)
  assert.equal(logText.includes(channelSecret), false)
  assert.equal(logText.includes(gatewaySignature ?? 'missing-signature'), false)
  assert.equal(logText.includes('fake-line-signature'), false)
  assert.deepEqual(Object.keys(entries[0] ?? {}).sort(), [
    'elapsedMs',
    'operation',
    'orderId',
    'requestId',
    'statusCode',
    'transactionId',
  ])
})
