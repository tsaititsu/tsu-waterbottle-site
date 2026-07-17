import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { LinePayGatewaySmokeResult, LinePayTransportEnv } from '../../../../../lib/linePay/transport'
import { handleLinePayGatewaySmoke } from './handler'

const enabledEnv = {
  VERCEL_ENV: 'preview',
  LINE_PAY_TRANSPORT: 'gateway',
  LINE_PAY_GATEWAY_SMOKE_ENABLED: 'true',
  LINE_PAY_GATEWAY_URL: 'https://linepay-gateway.tsu-waterbottle.com',
  LINE_PAY_GATEWAY_KEY_ID: 'test-key-id',
  LINE_PAY_GATEWAY_SECRET: 'test-gateway-secret',
}
const tests: Array<{ name: string; fn: () => void | Promise<void> }> = []

function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn })
}

function request(body = '{}', headers: Record<string, string> = {}) {
  return new Request('https://preview.example.com/api/internal/line-pay/gateway-smoke', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  })
}

async function json(response: Response) {
  return (await response.json()) as Record<string, unknown>
}

function successfulSmoke() {
  return Promise.resolve({
    ok: true,
    authenticated: true,
    upstreamCalled: false,
  } satisfies LinePayGatewaySmokeResult)
}

function collectRuntimeSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return collectRuntimeSourceFiles(path)
    if (!entry.isFile() || !/\.(?:ts|tsx)$/.test(entry.name) || entry.name.endsWith('.test.ts')) return []
    return [path]
  })
}

test('Preview enabled plus admin authorization runs the fixed smoke probe', async () => {
  let calls = 0
  let receivedEnv: LinePayTransportEnv | undefined
  const response = await handleLinePayGatewaySmoke({
    request: request(),
    env: enabledEnv,
    authorize: async () => true,
    runSmoke: async (input) => {
      calls += 1
      receivedEnv = input.transportEnv
      return successfulSmoke()
    },
  })

  assert.equal(response.status, 200)
  assert.equal(calls, 1)
  assert.equal(receivedEnv, enabledEnv)
  assert.deepEqual(await json(response), { ok: true, authenticated: true, upstreamCalled: false })
  assert.equal(response.headers.get('cache-control'), 'no-store')
})

for (const [name, env] of [
  ['disabled', { ...enabledEnv, LINE_PAY_GATEWAY_SMOKE_ENABLED: 'false' }],
  ['missing smoke flag', { ...enabledEnv, LINE_PAY_GATEWAY_SMOKE_ENABLED: undefined }],
  ['production', { ...enabledEnv, VERCEL_ENV: 'production' }],
  ['development', { ...enabledEnv, VERCEL_ENV: 'development' }],
  ['missing VERCEL_ENV', { ...enabledEnv, VERCEL_ENV: undefined }],
  ['direct transport', { ...enabledEnv, LINE_PAY_TRANSPORT: 'direct' }],
  ['missing transport', { ...enabledEnv, LINE_PAY_TRANSPORT: undefined }],
  ['unknown transport', { ...enabledEnv, LINE_PAY_TRANSPORT: 'automatic' }],
] as const) {
  test(`${name} returns 404 before authorization or smoke execution`, async () => {
    let authorizationCalls = 0
    let smokeCalls = 0
    const response = await handleLinePayGatewaySmoke({
      request: request(),
      env,
      authorize: async () => {
        authorizationCalls += 1
        return true
      },
      runSmoke: async () => {
        smokeCalls += 1
        return successfulSmoke()
      },
    })

    assert.equal(response.status, 404)
    assert.deepEqual(await json(response), { ok: false, error: 'not_found' })
    assert.equal(authorizationCalls, 0)
    assert.equal(smokeCalls, 0)
  })
}

test('missing or invalid admin authorization returns the same 404', async () => {
  for (const authorize of [async () => false, async () => Promise.reject(new Error('invalid bearer'))]) {
    let smokeCalls = 0
    const response = await handleLinePayGatewaySmoke({
      request: request(),
      env: enabledEnv,
      authorize,
      runSmoke: async () => {
        smokeCalls += 1
        return successfulSmoke()
      },
    })

    assert.equal(response.status, 404)
    assert.deepEqual(await json(response), { ok: false, error: 'not_found' })
    assert.equal(smokeCalls, 0)
  }
})

test('client body and headers cannot control the fixed Gateway request', async () => {
  let receivedKeys: string[] = []
  const response = await handleLinePayGatewaySmoke({
    request: request(
      JSON.stringify({ operation: 'request', url: 'https://api-pay.line.me', headers: { injected: 'yes' } }),
      {
        'x-gateway-key-id': 'client-controlled',
        'x-gateway-signature': 'client-controlled',
        'x-gateway-proxy-token': 'client-controlled',
      },
    ),
    env: enabledEnv,
    authorize: async () => true,
    runSmoke: async (input) => {
      receivedKeys = Object.keys(input).sort()
      return successfulSmoke()
    },
  })

  assert.equal(response.status, 200)
  assert.deepEqual(receivedKeys, ['fetchFn', 'transportEnv'])
})

test('smoke errors return a stable redacted response without stack or secrets', async () => {
  const secretMarker = enabledEnv.LINE_PAY_GATEWAY_SECRET
  const response = await handleLinePayGatewaySmoke({
    request: request(),
    env: enabledEnv,
    authorize: async () => true,
    runSmoke: async () => {
      throw new Error(`upstream HTML and ${secretMarker}`)
    },
  })
  const body = JSON.stringify(await json(response))

  assert.equal(response.status, 502)
  assert.equal(body.includes(secretMarker), false)
  assert.equal(body.includes('stack'), false)
  assert.equal(body.includes('HTML'), false)
  assert.deepEqual(JSON.parse(body), { ok: false, error: 'gateway_smoke_failed' })
})

test('route uses existing admin authorization, exports only POST and website source never references the Proxy Token env', () => {
  const routeSource = readFileSync(join(process.cwd(), 'src/app/api/internal/line-pay/gateway-smoke/route.ts'), 'utf8')
  assert.equal(routeSource.includes('requireAdminUser'), true)
  assert.equal(routeSource.includes('export async function POST'), true)
  assert.equal(routeSource.includes('export async function GET'), false)

  const blockedEnvName = ['LINE', 'PAY', 'GATEWAY', 'PROXY', 'TOKEN'].join('_')
  for (const file of collectRuntimeSourceFiles(join(process.cwd(), 'src'))) {
    assert.equal(readFileSync(file, 'utf8').includes(blockedEnvName), false, `${file} must not reference Proxy Token env`)
  }
})

async function main() {
  for (const entry of tests) {
    await entry.fn()
    console.log(`✓ ${entry.name}`)
  }
  console.log(`${tests.length} gateway smoke route tests passed`)
}

void main()
