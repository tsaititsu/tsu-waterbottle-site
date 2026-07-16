import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'

const gatewayOrigin = process.env.GATEWAY_RUNTIME_ORIGIN
const gatewaySecret = process.env.GATEWAY_RUNTIME_HMAC_SECRET
const proxyToken = process.env.GATEWAY_RUNTIME_PROXY_TOKEN
const proxyPath = '/v1/line-pay/proxy'
let passCount = 0

assert.match(gatewayOrigin ?? '', /^http:\/\/127\.0\.0\.1:\d+$/)
assert.ok(gatewaySecret)
assert.match(proxyToken ?? '', /^[0-9a-f]{64}$/)

function recordPass(description) {
  passCount += 1
  console.log(`ok ${passCount} - ${description}`)
}

function buildHeaders(bodyText, requestId, nonce, input = {}) {
  const timestamp = String(Math.floor(Date.now() / 1_000))
  const bodyHash = createHash('sha256').update(bodyText).digest('hex')
  const canonical = ['POST', proxyPath, timestamp, nonce, bodyHash].join('\n')
  const signature = createHmac('sha256', gatewaySecret).update(canonical).digest('hex')
  const headers = {
    'content-type': 'application/json',
    'x-gateway-key-id': 'runtime-test-key',
    'x-gateway-timestamp': timestamp,
    'x-gateway-nonce': nonce,
    'x-gateway-request-id': requestId,
    'x-gateway-signature': input.invalidHmac ? '0'.repeat(64) : signature,
    'x-gateway-client-ip': input.clientIp,
  }

  if (input.proxyToken !== null) {
    headers['x-gateway-proxy-token'] = input.proxyToken ?? proxyToken
  }
  return headers
}

async function sendBoundaryRequest(input) {
  const bodyText = JSON.stringify({ operation: 'runtime-test-invalid-operation', requestId: input.requestId })
  const response = await fetch(`${gatewayOrigin}${proxyPath}`, {
    method: 'POST',
    headers: buildHeaders(bodyText, input.requestId, input.nonce, input),
    body: bodyText,
    redirect: 'error',
  })
  return { status: response.status, body: await response.json() }
}

async function expectBoundary(description, input, expectedStatus, expectedError) {
  const response = await sendBoundaryRequest(input)
  assert.equal(response.status, expectedStatus)
  assert.equal(response.body.error, expectedError)
  recordPass(description)
}

const health = await fetch(`${gatewayOrigin}/health`)
assert.equal(health.status, 200)
recordPass('health works through the localhost-published Docker port without Proxy Token')

await expectBoundary(
  'valid Proxy Token and IPv4 Client IP cross the Docker-published boundary',
  {
    requestId: 'runtime-ipv4-request',
    nonce: 'runtime-ipv4-nonce',
    clientIp: '198.51.100.10',
  },
  400,
  'invalid_operation',
)

await expectBoundary(
  'valid Proxy Token and IPv6 Client IP cross the Docker-published boundary',
  {
    requestId: 'runtime-ipv6-request',
    nonce: 'runtime-ipv6-nonce',
    clientIp: '2001:db8::10',
  },
  400,
  'invalid_operation',
)

await expectBoundary(
  'missing Proxy Token is rejected before Client IP trust',
  {
    requestId: 'runtime-missing-token',
    nonce: 'runtime-missing-token-nonce',
    clientIp: '198.51.100.20',
    proxyToken: null,
  },
  401,
  'unauthorized',
)

await expectBoundary(
  'wrong Proxy Token is rejected',
  {
    requestId: 'runtime-wrong-token',
    nonce: 'runtime-wrong-token-nonce',
    clientIp: '198.51.100.21',
    proxyToken: 'c'.repeat(64),
  },
  401,
  'unauthorized',
)

await expectBoundary(
  'invalid Client IP is rejected after valid Proxy Token',
  {
    requestId: 'runtime-invalid-client',
    nonce: 'runtime-invalid-client-nonce',
    clientIp: 'client.example.com',
  },
  400,
  'invalid_proxy_client_ip',
)

await expectBoundary(
  'invalid Proxy Token does not consume an attacker-selected Client IP bucket',
  {
    requestId: 'runtime-token-bucket-a',
    nonce: 'runtime-token-bucket-a-nonce',
    clientIp: '198.51.100.30',
    proxyToken: 'c'.repeat(64),
  },
  401,
  'unauthorized',
)

await expectBoundary(
  'the same Client IP remains available after the invalid Proxy Token',
  {
    requestId: 'runtime-token-bucket-b',
    nonce: 'runtime-token-bucket-b-nonce',
    clientIp: '198.51.100.30',
  },
  400,
  'invalid_operation',
)

await expectBoundary(
  'the same authenticated Client IP reaches its rate limit',
  {
    requestId: 'runtime-token-bucket-c',
    nonce: 'runtime-token-bucket-c-nonce',
    clientIp: '198.51.100.30',
  },
  429,
  'rate_limited',
)

await expectBoundary(
  'a different authenticated Client IP has an independent bucket',
  {
    requestId: 'runtime-other-client',
    nonce: 'runtime-other-client-nonce',
    clientIp: '198.51.100.31',
  },
  400,
  'invalid_operation',
)

await expectBoundary(
  'invalid website HMAC consumes only its authenticated Client IP bucket',
  {
    requestId: 'runtime-invalid-hmac-a',
    nonce: 'runtime-invalid-hmac-a-nonce',
    clientIp: '198.51.100.40',
    invalidHmac: true,
  },
  401,
  'unauthorized',
)

await expectBoundary(
  'the invalid-HMAC Client IP is rate limited on its next request',
  {
    requestId: 'runtime-invalid-hmac-b',
    nonce: 'runtime-invalid-hmac-b-nonce',
    clientIp: '198.51.100.40',
  },
  429,
  'rate_limited',
)

console.log(`1..${passCount}`)
console.log(`Docker runtime integration tests: ${passCount} passed, 0 failed.`)
