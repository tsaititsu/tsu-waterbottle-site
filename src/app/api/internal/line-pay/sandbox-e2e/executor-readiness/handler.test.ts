import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { handleLinePayExecutorReadiness } from './handler'

const enabledEnv = {
  VERCEL_ENV: 'preview',
  VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
  NEXT_PUBLIC_ENABLE_LINE_PAY: 'true',
  LINE_PAY_ENV: 'sandbox',
  LINE_PAY_TRANSPORT: 'gateway',
  LINE_PAY_SANDBOX_E2E_ENABLED: 'true',
}

function request() {
  return new Request(
    'https://preview.example.com/api/internal/line-pay/sandbox-e2e/executor-readiness',
    { method: 'POST' },
  )
}

async function json(response: Response) {
  return await response.json() as Record<string, unknown>
}

test('authorized Sandbox Preview executes only the fixed no-write readiness probe', async () => {
  let calls = 0
  const response = await handleLinePayExecutorReadiness({
    request: request(),
    env: enabledEnv,
    authorize: async () => true,
    probe: async () => {
      calls += 1
      return Object.freeze({
        ok: true,
        authenticated: true,
        upstreamCalled: false,
        databaseWrites: false,
      })
    },
  })

  assert.equal(calls, 1)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await json(response), {
    ok: true,
    authenticated: true,
    upstreamCalled: false,
    databaseWrites: false,
  })
})

for (const [name, env] of [
  ['production', { ...enabledEnv, VERCEL_ENV: 'production' }],
  ['direct transport', { ...enabledEnv, LINE_PAY_TRANSPORT: 'direct' }],
  ['production LINE Pay', { ...enabledEnv, LINE_PAY_ENV: 'production' }],
  ['disabled LINE Pay', { ...enabledEnv, NEXT_PUBLIC_ENABLE_LINE_PAY: 'false' }],
  ['disabled E2E gate', { ...enabledEnv, LINE_PAY_SANDBOX_E2E_ENABLED: 'false' }],
  ['missing exact head', { ...enabledEnv, VERCEL_GIT_COMMIT_SHA: undefined }],
] as const) {
  test(`${name} is hidden before authorization and probing`, async () => {
    let authorizationCalls = 0
    let probeCalls = 0
    const response = await handleLinePayExecutorReadiness({
      request: request(),
      env,
      authorize: async () => {
        authorizationCalls += 1
        return true
      },
      probe: async () => {
        probeCalls += 1
        throw new Error('must_not_probe')
      },
    })

    assert.equal(response.status, 404)
    assert.deepEqual(await json(response), { ok: false, error: 'not_found' })
    assert.equal(authorizationCalls, 0)
    assert.equal(probeCalls, 0)
  })
}

test('missing admin authorization is hidden and never probes the executor', async () => {
  let probeCalls = 0
  const response = await handleLinePayExecutorReadiness({
    request: request(),
    env: enabledEnv,
    authorize: async () => false,
    probe: async () => {
      probeCalls += 1
      throw new Error('must_not_probe')
    },
  })

  assert.equal(response.status, 404)
  assert.deepEqual(await json(response), { ok: false, error: 'not_found' })
  assert.equal(probeCalls, 0)
})

test('probe failures return a stable redacted response', async () => {
  const secretMarker = 'sb_secret_must_never_escape_1234567890'
  const response = await handleLinePayExecutorReadiness({
    request: request(),
    env: enabledEnv,
    authorize: async () => true,
    probe: async () => {
      throw new Error(`permission denied ${secretMarker} <html>internal</html>`)
    },
  })
  const body = JSON.stringify(await json(response))

  assert.equal(response.status, 502)
  assert.deepEqual(JSON.parse(body), {
    ok: false,
    error: 'line_pay_executor_readiness_failed',
  })
  assert.equal(body.includes(secretMarker), false)
  assert.equal(body.includes('permission denied'), false)
  assert.equal(body.includes('html'), false)
})

test('route is POST-only, uses admin auth, and has no payment or provider call', () => {
  const routeSource = readFileSync(
    join(
      process.cwd(),
      'src/app/api/internal/line-pay/sandbox-e2e/executor-readiness/route.ts',
    ),
    'utf8',
  )

  assert.equal(routeSource.includes('requireAdminUser'), true)
  assert.equal(routeSource.includes('export async function POST'), true)
  assert.equal(routeSource.includes('export async function GET'), false)
  assert.equal(routeSource.includes('confirmLinePayPayment'), false)
  assert.equal(routeSource.includes('requestLinePayPayment'), false)
  assert.equal(routeSource.includes('LINE_PAY_SANDBOX_E2E_CONFIRMATION'), false)
})
