import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import test from 'node:test'
import {
  createGatewayHandler,
  type GatewayLogEntry,
  type GatewayRequest,
  type GatewayUpstreamFetch,
} from '../src/app.js'
import { GATEWAY_CLIENT_IP_HEADER } from '../src/client-address.js'
import {
  buildCanonicalString,
  GATEWAY_PROXY_PATH,
  loadGatewayConfig,
  MAX_GATEWAY_BODY_BYTES,
  type GatewayConfig,
} from '../src/security.js'
import { authenticateProxyRequest, GATEWAY_PROXY_TOKEN_HEADER } from '../src/proxy-auth.js'

const nowMs = 1_800_000_000_000
const secret = 'gateway-test-secret-never-production'
const keyId = 'gateway-test-key'
const channelSecret = 'fake-channel-secret-never-log'
const defaultClientIp = '198.51.100.10'
const proxyToken = 'a'.repeat(64)
const wrongProxyToken = 'b'.repeat(64)
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
  proxyToken,
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
      [GATEWAY_PROXY_TOKEN_HEADER]: proxyToken,
      [GATEWAY_CLIENT_IP_HEADER]: defaultClientIp,
    },
    bodyText,
    rawBody: Buffer.from(bodyText, 'utf8'),
    remoteAddress: '172.19.0.1',
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

test('Gateway canonical contract excludes Proxy Token and uses method, path, seconds, nonce and raw-body SHA256', () => {
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

test('valid Proxy Token and IPv4 client header are accepted through an arbitrary Docker bridge peer', async () => {
  const calls: Array<{ url: string }> = []
  const handler = createGatewayHandler(config, { fetchFn: successFetch(calls), now: () => nowMs })
  const request = buildSignedRequest(requestPayload(), {
    nonce: 'nonce-ipv4-client',
    requestId: 'request-ipv4-client',
  })
  request.remoteAddress = '172.31.0.1'
  request.headers[GATEWAY_CLIENT_IP_HEADER] = '203.0.113.10'
  assert.equal((await handler(request)).statusCode, 200)
  assert.equal(calls.length, 1)
})

test('valid Proxy Token and IPv6 client header use the IPv6 address as the rate-limit bucket', async () => {
  const limitedConfig = { ...config, rateLimitMax: 1 }
  const handler = createGatewayHandler(limitedConfig, { fetchFn: successFetch(), now: () => nowMs })
  const first = buildSignedRequest(requestPayload(), {
    nonce: 'nonce-ipv6-client-01',
    requestId: 'request-ipv6-client-01',
  })
  first.headers[GATEWAY_CLIENT_IP_HEADER] = '2001:db8::10'
  const second = buildSignedRequest(requestPayload(), {
    nonce: 'nonce-ipv6-client-02',
    requestId: 'request-ipv6-client-02',
  })
  second.remoteAddress = '172.30.0.1'
  second.headers[GATEWAY_CLIENT_IP_HEADER] = '2001:db8::10'

  assert.equal((await handler(first)).statusCode, 200)
  assert.equal((await handler(second)).statusCode, 429)
})

test('Proxy Token authentication accepts the configured token and rejects a same-length wrong token', () => {
  assert.doesNotThrow(() =>
    authenticateProxyRequest({ [GATEWAY_PROXY_TOKEN_HEADER]: proxyToken }, proxyToken),
  )
  assert.throws(
    () => authenticateProxyRequest({ [GATEWAY_PROXY_TOKEN_HEADER]: wrongProxyToken }, proxyToken),
    /unauthorized/,
  )
})

test('missing Proxy Token fails closed without calling upstream', async () => {
  const calls: Array<{ url: string }> = []
  const handler = createGatewayHandler(config, { fetchFn: successFetch(calls), now: () => nowMs })
  const request = buildSignedRequest(requestPayload(), {
    nonce: 'nonce-missing-proxy-token',
    requestId: 'request-missing-proxy-token',
  })
  delete request.headers[GATEWAY_PROXY_TOKEN_HEADER]

  assert.deepEqual(await handler(request), {
    statusCode: 401,
    body: { ok: false, error: 'unauthorized' },
  })
  assert.equal(calls.length, 0)
})

test('wrong Proxy Token fails closed without exposing its value', async () => {
  const handler = createGatewayHandler(config, { fetchFn: successFetch(), now: () => nowMs })
  const request = buildSignedRequest(requestPayload(), {
    nonce: 'nonce-wrong-proxy-token',
    requestId: 'request-wrong-proxy-token',
  })
  request.headers[GATEWAY_PROXY_TOKEN_HEADER] = wrongProxyToken
  const response = await handler(request)
  assert.deepEqual(response, { statusCode: 401, body: { ok: false, error: 'unauthorized' } })
  assert.equal(JSON.stringify(response).includes(wrongProxyToken), false)
})

test('malformed, uppercase and multiple Proxy Token values return the same controlled 401', async () => {
  const handler = createGatewayHandler(config, { fetchFn: successFetch(), now: () => nowMs })
  const invalidTokens = ['', 'a'.repeat(63), 'A'.repeat(64), `${proxyToken},${wrongProxyToken}`]

  for (const [index, invalidToken] of invalidTokens.entries()) {
    const request = buildSignedRequest(requestPayload(), {
      nonce: `nonce-malformed-proxy-${index}`,
      requestId: `request-malformed-proxy-${index}`,
    })
    request.headers[GATEWAY_PROXY_TOKEN_HEADER] = invalidToken
    assert.deepEqual(await handler(request), {
      statusCode: 401,
      body: { ok: false, error: 'unauthorized' },
    })
  }
})

test('Gateway config rejects malformed Proxy Token and reuse of the Gateway HMAC secret', () => {
  const baseEnv = {
    LINE_PAY_GATEWAY_ENV: 'sandbox',
    LINE_PAY_GATEWAY_KEY_ID: keyId,
    LINE_PAY_GATEWAY_SECRET: secret,
    LINE_PAY_GATEWAY_PROXY_TOKEN: proxyToken,
  }
  assert.throws(
    () => loadGatewayConfig({ ...baseEnv, LINE_PAY_GATEWAY_PROXY_TOKEN: 'not-hex' }),
    /invalid_line_pay_gateway_proxy_token/,
  )
  assert.throws(
    () =>
      loadGatewayConfig({
        ...baseEnv,
        LINE_PAY_GATEWAY_SECRET: proxyToken,
        LINE_PAY_GATEWAY_PROXY_TOKEN: proxyToken,
      }),
    /proxy_token_must_differ_from_gateway_secret/,
  )
})

test('valid Proxy Token does not depend on socket remoteAddress', async () => {
  const handler = createGatewayHandler(config, { fetchFn: successFetch(), now: () => nowMs })
  const request = buildSignedRequest(requestPayload(), {
    nonce: 'nonce-no-remote-address',
    requestId: 'request-no-remote-address',
  })
  delete request.remoteAddress
  assert.equal((await handler(request)).statusCode, 200)
})

test('missing proxy client IP fails closed after Proxy Token verification', async () => {
  const calls: Array<{ url: string }> = []
  const handler = createGatewayHandler(config, { fetchFn: successFetch(calls), now: () => nowMs })
  const request = buildSignedRequest(requestPayload(), {
    nonce: 'nonce-missing-client-ip',
    requestId: 'request-missing-client-ip',
  })
  delete request.headers[GATEWAY_CLIENT_IP_HEADER]
  assert.deepEqual(await handler(request), {
    statusCode: 400,
    body: { ok: false, error: 'invalid_proxy_client_ip' },
  })
  assert.equal(calls.length, 0)
})

test('blank proxy client IP is rejected', async () => {
  const handler = createGatewayHandler(config, { fetchFn: successFetch(), now: () => nowMs })
  const request = buildSignedRequest(requestPayload(), {
    nonce: 'nonce-blank-client-ip',
    requestId: 'request-blank-client-ip',
  })
  request.headers[GATEWAY_CLIENT_IP_HEADER] = '   '
  assert.equal((await handler(request)).body.error, 'invalid_proxy_client_ip')
})

test('hostname proxy client IP is rejected', async () => {
  const handler = createGatewayHandler(config, { fetchFn: successFetch(), now: () => nowMs })
  const request = buildSignedRequest(requestPayload(), {
    nonce: 'nonce-host-client-ip',
    requestId: 'request-host-client-ip',
  })
  request.headers[GATEWAY_CLIENT_IP_HEADER] = 'client.example.com'
  assert.equal((await handler(request)).body.error, 'invalid_proxy_client_ip')
})

test('proxy client IP containing a port is rejected', async () => {
  const handler = createGatewayHandler(config, { fetchFn: successFetch(), now: () => nowMs })
  const request = buildSignedRequest(requestPayload(), {
    nonce: 'nonce-port-client-ip',
    requestId: 'request-port-client-ip',
  })
  request.headers[GATEWAY_CLIENT_IP_HEADER] = '203.0.113.10:443'
  assert.equal((await handler(request)).body.error, 'invalid_proxy_client_ip')
})

test('comma-separated proxy client IP is rejected', async () => {
  const handler = createGatewayHandler(config, { fetchFn: successFetch(), now: () => nowMs })
  const request = buildSignedRequest(requestPayload(), {
    nonce: 'nonce-list-client-ip',
    requestId: 'request-list-client-ip',
  })
  request.headers[GATEWAY_CLIENT_IP_HEADER] = '203.0.113.10, 198.51.100.20'
  assert.equal((await handler(request)).body.error, 'invalid_proxy_client_ip')
})

test('URL proxy client IP is rejected', async () => {
  const handler = createGatewayHandler(config, { fetchFn: successFetch(), now: () => nowMs })
  const request = buildSignedRequest(requestPayload(), {
    nonce: 'nonce-url-client-ip',
    requestId: 'request-url-client-ip',
  })
  request.headers[GATEWAY_CLIENT_IP_HEADER] = 'https://203.0.113.10/'
  assert.equal((await handler(request)).body.error, 'invalid_proxy_client_ip')
})

test('control characters in proxy client IP are rejected', async () => {
  const handler = createGatewayHandler(config, { fetchFn: successFetch(), now: () => nowMs })
  const request = buildSignedRequest(requestPayload(), {
    nonce: 'nonce-control-client-ip',
    requestId: 'request-control-client-ip',
  })
  request.headers[GATEWAY_CLIENT_IP_HEADER] = '203.0.113.10\u0007'
  assert.equal((await handler(request)).body.error, 'invalid_proxy_client_ip')
})

test('userinfo, CIDR, zone identifiers, percent encoding and overlong client IP values are rejected', async () => {
  const calls: Array<{ url: string }> = []
  const handler = createGatewayHandler(config, { fetchFn: successFetch(calls), now: () => nowMs })
  const invalidValues = [
    'user@203.0.113.10',
    '203.0.113.10/32',
    'fe80::1%eth0',
    '203.0.113.%31',
    '2'.repeat(65),
  ]

  for (const [index, invalidValue] of invalidValues.entries()) {
    const request = buildSignedRequest(requestPayload(), {
      nonce: `nonce-other-client-ip-${index}`,
      requestId: `request-other-client-ip-${index}`,
    })
    request.headers[GATEWAY_CLIENT_IP_HEADER] = invalidValue
    assert.equal((await handler(request)).body.error, 'invalid_proxy_client_ip')
  }
  assert.equal(calls.length, 0)
})

test('socket peer and X-Forwarded-For never replace the authenticated proxy client IP bucket', async () => {
  const limitedConfig = { ...config, rateLimitMax: 1 }
  const handler = createGatewayHandler(limitedConfig, { fetchFn: successFetch(), now: () => nowMs })
  const first = buildSignedRequest(requestPayload(), { nonce: 'nonce-rate-01', requestId: 'request-rate-01' })
  first.remoteAddress = '203.0.113.40'
  first.headers[GATEWAY_CLIENT_IP_HEADER] = '198.51.100.10'
  first.headers['x-forwarded-for'] = '192.0.2.10'
  const second = buildSignedRequest(requestPayload(), { nonce: 'nonce-rate-02', requestId: 'request-rate-02' })
  second.remoteAddress = '203.0.113.41'
  second.headers[GATEWAY_CLIENT_IP_HEADER] = '198.51.100.10'
  second.headers['x-forwarded-for'] = '192.0.2.11'
  assert.equal((await handler(first)).statusCode, 200)
  assert.equal((await handler(second)).statusCode, 429)
})

test('the same effective client IP shares one rate-limit bucket', async () => {
  const limitedConfig = { ...config, rateLimitMax: 1 }
  const handler = createGatewayHandler(limitedConfig, { fetchFn: successFetch(), now: () => nowMs })
  const first = buildSignedRequest(requestPayload(), {
    nonce: 'nonce-same-client-01',
    requestId: 'request-same-client-01',
  })
  const second = buildSignedRequest(requestPayload(), {
    nonce: 'nonce-same-client-02',
    requestId: 'request-same-client-02',
  })
  first.headers['x-forwarded-for'] = '203.0.113.200'
  second.headers['x-forwarded-for'] = '203.0.113.201'
  assert.equal((await handler(first)).statusCode, 200)
  assert.equal((await handler(second)).statusCode, 429)
})

test('a rate-limited client does not consume another client IP bucket', async () => {
  const limitedConfig = { ...config, rateLimitMax: 1 }
  const handler = createGatewayHandler(limitedConfig, { fetchFn: successFetch(), now: () => nowMs })
  const clientA1 = buildSignedRequest(requestPayload(), {
    nonce: 'nonce-client-a-01',
    requestId: 'request-client-a-01',
  })
  clientA1.headers[GATEWAY_CLIENT_IP_HEADER] = '198.51.100.30'
  const clientA2 = buildSignedRequest(requestPayload(), {
    nonce: 'nonce-client-a-02',
    requestId: 'request-client-a-02',
  })
  clientA2.headers[GATEWAY_CLIENT_IP_HEADER] = '198.51.100.30'
  const clientB = buildSignedRequest(requestPayload(), {
    nonce: 'nonce-client-b-01',
    requestId: 'request-client-b-01',
  })
  clientB.headers[GATEWAY_CLIENT_IP_HEADER] = '198.51.100.31'

  assert.equal((await handler(clientA1)).statusCode, 200)
  assert.equal((await handler(clientA2)).statusCode, 429)
  assert.equal((await handler(clientB)).statusCode, 200)
})

test('invalid HMAC consumes only its effective client IP rate-limit bucket', async () => {
  const limitedConfig = { ...config, rateLimitMax: 1 }
  const handler = createGatewayHandler(limitedConfig, { fetchFn: successFetch(), now: () => nowMs })
  const invalidClientA = buildSignedRequest(requestPayload(), {
    nonce: 'nonce-invalid-client-a',
    requestId: 'request-invalid-client-a',
    signature: '0'.repeat(64),
  })
  invalidClientA.headers[GATEWAY_CLIENT_IP_HEADER] = '198.51.100.40'
  const validClientA = buildSignedRequest(requestPayload(), {
    nonce: 'nonce-valid-client-a',
    requestId: 'request-valid-client-a',
  })
  validClientA.headers[GATEWAY_CLIENT_IP_HEADER] = '198.51.100.40'
  const validClientB = buildSignedRequest(requestPayload(), {
    nonce: 'nonce-valid-client-b',
    requestId: 'request-valid-client-b',
  })
  validClientB.headers[GATEWAY_CLIENT_IP_HEADER] = '198.51.100.41'

  assert.equal((await handler(invalidClientA)).statusCode, 401)
  assert.equal((await handler(validClientA)).statusCode, 429)
  assert.equal((await handler(validClientB)).statusCode, 200)
})

test('invalid Proxy Token does not consume a client IP bucket or claim replay keys', async () => {
  const limitedConfig = { ...config, rateLimitMax: 1 }
  const calls: Array<{ url: string }> = []
  const handler = createGatewayHandler(limitedConfig, { fetchFn: successFetch(calls), now: () => nowMs })
  const request = buildSignedRequest(requestPayload(), {
    nonce: 'nonce-invalid-proxy-no-claim',
    requestId: 'request-invalid-proxy-no-claim',
  })
  request.headers[GATEWAY_PROXY_TOKEN_HEADER] = wrongProxyToken
  assert.equal((await handler(request)).statusCode, 401)
  assert.equal(calls.length, 0)

  request.headers[GATEWAY_PROXY_TOKEN_HEADER] = proxyToken
  assert.equal((await handler(request)).statusCode, 200)
  assert.equal(calls.length, 1)
})

test('Proxy Token and proxy client IP are not forwarded while official LINE Pay authorization stays unchanged', async () => {
  let upstreamHeaders: Record<string, string> | undefined
  const fetchFn: GatewayUpstreamFetch = async (_url, init) => {
    upstreamHeaders = init.headers
    return { status: 200, text: async () => JSON.stringify({ returnCode: '0000' }) }
  }
  const handler = createGatewayHandler(config, { fetchFn, now: () => nowMs })
  const response = await handler(
    buildSignedRequest(requestPayload(), {
      nonce: 'nonce-client-ip-upstream',
      requestId: 'request-client-ip-upstream',
    }),
  )

  assert.equal(response.statusCode, 200)
  assert.equal(upstreamHeaders?.[GATEWAY_PROXY_TOKEN_HEADER], undefined)
  assert.equal(upstreamHeaders?.[GATEWAY_CLIENT_IP_HEADER], undefined)
  assert.equal(upstreamHeaders?.['x-line-authorization'], linePayHeaders['X-LINE-Authorization'])
  assert.equal(upstreamHeaders?.['x-line-authorization-nonce'], linePayHeaders['X-LINE-Authorization-Nonce'])
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
  assert.equal(logText.includes(proxyToken), false)
  assert.equal(logText.includes(channelSecret), false)
  assert.equal(logText.includes(gatewaySignature ?? 'missing-signature'), false)
  assert.equal(logText.includes('fake-line-signature'), false)
  assert.equal(logText.includes(defaultClientIp), false)
  assert.deepEqual(Object.keys(entries[0] ?? {}).sort(), [
    'elapsedMs',
    'operation',
    'orderId',
    'requestId',
    'statusCode',
    'transactionId',
  ])
})
