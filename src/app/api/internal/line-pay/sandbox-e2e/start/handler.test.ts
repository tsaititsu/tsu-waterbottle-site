import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  LINE_PAY_SANDBOX_E2E_CONFIRMATION,
  handleLinePaySandboxE2eStart,
  type LinePaySandboxE2eStartEnvironment,
} from './handler'

const enabledEnv: LinePaySandboxE2eStartEnvironment = {
  VERCEL_ENV: 'preview',
  VERCEL_GIT_COMMIT_SHA: '5d2b264410656d59d5145e57b47709a9a7e95a3c',
  NEXT_PUBLIC_ENABLE_LINE_PAY: 'true',
  LINE_PAY_ENV: 'sandbox',
  LINE_PAY_TRANSPORT: 'gateway',
  LINE_PAY_SANDBOX_E2E_ENABLED: 'true',
  LINE_PAY_CHANNEL_ID: 'sandbox-channel-id',
  LINE_PAY_CHANNEL_SECRET: 'sandbox-channel-secret',
  LINE_PAY_CONFIRM_URL:
    'https://preview.example.com/api/product-orders/line-pay/confirm',
  LINE_PAY_CANCEL_URL:
    'https://preview.example.com/api/product-orders/line-pay/cancel',
}

function createRequest(
  body: unknown = { confirmation: LINE_PAY_SANDBOX_E2E_CONFIRMATION },
  url = 'https://preview.example.com/api/internal/line-pay/sandbox-e2e/start',
) {
  return new Request(
    url,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

async function json(response: Response) {
  return (await response.json()) as Record<string, unknown>
}

function successDependencies() {
  const calls: string[] = []
  const initializations: Array<Record<string, unknown>> = []
  const executions: Array<Record<string, unknown>> = []
  return {
    calls,
    initializations,
    executions,
    authorize: async () => {
      calls.push('authorize')
      return {
        userId: '41000000-0000-4000-8000-000000000001',
        client: { name: 'sandbox-admin-client' },
      }
    },
    initialize: async (input: Record<string, unknown>) => {
      calls.push('initialize')
      initializations.push(input)
      assert.equal(input.environment, 'sandbox')
      assert.equal(input.amountTwd, 50)
      assert.equal(input.userId, '41000000-0000-4000-8000-000000000001')
      assert.match(String(input.requestBodySha256), /^[0-9a-f]{64}$/)
      assert.match(String(input.confirmTokenHash), /^[0-9a-f]{64}$/)
      assert.match(String(input.cancelTokenHash), /^[0-9a-f]{64}$/)
      assert.notEqual(input.confirmTokenHash, input.cancelTokenHash)
      assert.equal(JSON.stringify(input).includes('sandbox-channel-secret'), false)
      return {
        result_code: 'initialized' as const,
        product_order_id: '51000000-0000-4000-8000-000000000001',
        payment_id: '71000000-0000-4000-8000-000000000001',
        attempt_id: '61000000-0000-4000-8000-000000000001',
        outbox_id: '81000000-0000-4000-8000-000000000001',
        confirm_capability_id: '91000000-0000-4000-8000-000000000001',
        cancel_capability_id: '91000000-0000-4000-8000-000000000002',
        merchant_order_no: String(input.merchantOrderNo),
        request_state: 'queued' as const,
      }
    },
    execute: async (input: Record<string, unknown>) => {
      calls.push('execute')
      executions.push(input)
      const payloadInput = input.payloadInput as {
        amount: number
        confirmUrl: string
        cancelUrl: string
      }
      assert.equal(payloadInput.amount, 50)
      assert.match(payloadInput.confirmUrl, /capability=/)
      assert.match(payloadInput.cancelUrl, /capability=/)
      assert.equal(
        new URL(payloadInput.confirmUrl).pathname,
        '/api/internal/line-pay/sandbox-e2e/confirm',
      )
      assert.equal(
        new URL(payloadInput.cancelUrl).pathname,
        '/api/internal/line-pay/sandbox-e2e/cancel',
      )
      assert.equal(payloadInput.confirmUrl.includes('sandbox-channel-secret'), false)
      return {
        status: 'payment_url_ready' as const,
        attemptId: '61000000-0000-4000-8000-000000000001',
        paymentId: '71000000-0000-4000-8000-000000000001',
        productOrderId: '51000000-0000-4000-8000-000000000001',
        merchantOrderNo: String(input.merchantOrderNo),
        transactionId: '92233720368547758081234567890',
        paymentUrlWeb: 'https://sandbox-web-pay.line.me/payment',
        paymentUrlApp: null,
      }
    },
    now: () => new Date('2026-07-31T12:00:00.000Z'),
    createUuid: (() => {
      const values = [
        'a1000000-0000-4000-8000-000000000001',
        'a1000000-0000-4000-8000-000000000002',
        'a1000000-0000-4000-8000-000000000003',
      ]
      return () => values.shift() ?? 'a1000000-0000-4000-8000-000000000004'
    })(),
    createToken: (() => {
      const values = ['confirm-capability-token', 'cancel-capability-token']
      return () => values.shift() ?? 'unexpected-token'
    })(),
  }
}

test('Preview sandbox admin confirmation initializes NT$50 and returns one payment URL', async () => {
  const deps = successDependencies()
  const response = await handleLinePaySandboxE2eStart({
    request: createRequest(),
    env: enabledEnv,
    ...deps,
  })
  const body = await json(response)

  assert.equal(response.status, 200)
  assert.deepEqual(deps.calls, ['authorize', 'initialize', 'execute'])
  assert.deepEqual(body, {
    ok: true,
    environment: 'sandbox',
    amountTwd: 50,
    currency: 'TWD',
    paymentUrl: 'https://sandbox-web-pay.line.me/payment',
  })
  assert.equal(response.headers.get('cache-control'), 'no-store')
})

test('callback origins come from trusted server config, never request Host', async () => {
  const deps = successDependencies()
  await handleLinePaySandboxE2eStart({
    request: createRequest(
      { confirmation: LINE_PAY_SANDBOX_E2E_CONFIRMATION },
      'https://attacker.example/api/internal/line-pay/sandbox-e2e/start',
    ),
    env: enabledEnv,
    ...deps,
  })

  const execution = deps.executions[0]
  assert.ok(execution)
  const payloadInput = execution.payloadInput as {
    confirmUrl: string
    cancelUrl: string
  }
  assert.equal(new URL(payloadInput.confirmUrl).hostname, 'preview.example.com')
  assert.equal(new URL(payloadInput.cancelUrl).hostname, 'preview.example.com')
})

for (const [name, env] of [
  ['production Vercel', { ...enabledEnv, VERCEL_ENV: 'production' }],
  ['development', { ...enabledEnv, VERCEL_ENV: 'development' }],
  ['production LINE Pay', { ...enabledEnv, LINE_PAY_ENV: 'production' }],
  ['direct transport', { ...enabledEnv, LINE_PAY_TRANSPORT: 'direct' }],
  ['runtime disabled', { ...enabledEnv, NEXT_PUBLIC_ENABLE_LINE_PAY: 'false' }],
  ['E2E flag disabled', { ...enabledEnv, LINE_PAY_SANDBOX_E2E_ENABLED: 'false' }],
  ['missing exact Head', { ...enabledEnv, VERCEL_GIT_COMMIT_SHA: undefined }],
] as const) {
  test(`${name} returns 404 before authorization or writes`, async () => {
    const deps = successDependencies()
    const response = await handleLinePaySandboxE2eStart({
      request: createRequest(),
      env,
      ...deps,
    })

    assert.equal(response.status, 404)
    assert.deepEqual(await json(response), { ok: false, error: 'not_found' })
    assert.deepEqual(deps.calls, [])
  })
}

test('one exact Preview Head always derives the same database identity', async () => {
  const first = successDependencies()
  const second = successDependencies()

  await handleLinePaySandboxE2eStart({
    request: createRequest(),
    env: enabledEnv,
    ...first,
  })
  await handleLinePaySandboxE2eStart({
    request: createRequest(),
    env: enabledEnv,
    ...second,
  })

  for (const key of ['orderNo', 'merchantOrderNo', 'idempotencyKey'] as const) {
    assert.equal(first.initializations[0]?.[key], second.initializations[0]?.[key])
  }
  assert.equal(
    String(first.initializations[0]?.idempotencyKey).includes(
      enabledEnv.VERCEL_GIT_COMMIT_SHA ?? '',
    ),
    true,
  )
})

test('missing exact one-time confirmation returns 400 before authorization or writes', async () => {
  const deps = successDependencies()
  const response = await handleLinePaySandboxE2eStart({
    request: createRequest({ confirmation: 'wrong' }),
    env: enabledEnv,
    ...deps,
  })

  assert.equal(response.status, 400)
  assert.deepEqual(await json(response), {
    ok: false,
    error: 'invalid_confirmation',
  })
  assert.deepEqual(deps.calls, [])
})

test('missing admin authorization is hidden as 404 and never writes', async () => {
  const deps = successDependencies()
  const response = await handleLinePaySandboxE2eStart({
    request: createRequest(),
    env: enabledEnv,
    ...deps,
    authorize: async () => null,
  })

  assert.equal(response.status, 404)
  assert.deepEqual(await json(response), { ok: false, error: 'not_found' })
  assert.deepEqual(deps.calls, [])
})

test('initializer or request failure returns only a stable redacted error', async () => {
  const secret = enabledEnv.LINE_PAY_CHANNEL_SECRET ?? ''
  const deps = successDependencies()
  const response = await handleLinePaySandboxE2eStart({
    request: createRequest(),
    env: enabledEnv,
    ...deps,
    execute: async () => {
      throw new Error(`upstream html ${secret}`)
    },
  })
  const body = JSON.stringify(await json(response))

  assert.equal(response.status, 502)
  assert.deepEqual(JSON.parse(body), {
    ok: false,
    error: 'line_pay_sandbox_e2e_start_failed',
  })
  assert.equal(body.includes(secret), false)
  assert.equal(body.includes('html'), false)
})

test('non-LINE Sandbox payment URL is rejected without returning the URL', async () => {
  const deps = successDependencies()
  const unsafeUrl = 'https://payments.attacker.example/collect'
  const response = await handleLinePaySandboxE2eStart({
    request: createRequest(),
    env: enabledEnv,
    ...deps,
    execute: async (input) => ({
      status: 'payment_url_ready',
      attemptId: '61000000-0000-4000-8000-000000000001',
      paymentId: '71000000-0000-4000-8000-000000000001',
      productOrderId: '51000000-0000-4000-8000-000000000001',
      merchantOrderNo: String(input.merchantOrderNo),
      transactionId: '92233720368547758081234567890',
      paymentUrlWeb: unsafeUrl,
      paymentUrlApp: null,
    }),
  })
  const body = JSON.stringify(await json(response))

  assert.equal(response.status, 502)
  assert.equal(body.includes(unsafeUrl), false)
  assert.deepEqual(JSON.parse(body), {
    ok: false,
    error: 'line_pay_sandbox_e2e_start_failed',
  })
})

test('route is POST-only, admin-protected, and uses the unified Gateway transport', () => {
  const source = readFileSync(
    new URL('./route.ts', import.meta.url),
    'utf8',
  )

  assert.match(source, /requireAdminUser/)
  assert.match(source, /initializeLinePaySandboxE2eCheckout/)
  assert.match(source, /createLinePayRequestDatabase/)
  assert.match(source, /executeInitializedProductOrderLinePayRequest/)
  assert.match(source, /requestLinePayPayment/)
  assert.match(source, /transportEnv,/)
  assert.match(source, /export async function POST/)
  assert.doesNotMatch(source, /export async function GET/)
  assert.doesNotMatch(source, /LINE_PAY_GATEWAY_PROXY_TOKEN/)
  assert.doesNotMatch(source, /console\.(?:log|error)/)
})
