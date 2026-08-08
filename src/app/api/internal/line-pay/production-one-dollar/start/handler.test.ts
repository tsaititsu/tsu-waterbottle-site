import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  LINE_PAY_PRODUCTION_ONE_DOLLAR_CONFIRMATION,
  handleLinePayProductionOneDollarStart,
  type LinePayProductionOneDollarEnvironment,
} from './handler'
import {
  LINE_PAY_CAPABILITY_COOKIE_OPTIONS,
  linePayCapabilityCookieName,
} from '../../../../product-orders/line-pay/capabilityToken'
import { LinePayProductOrderRequestExecutionError } from '../../../../../../lib/linePay/productOrderRequestExecution'

const tests: Array<{ name: string; run: () => void | Promise<void> }> = []

function test(name: string, run: () => void | Promise<void>) {
  tests.push({ name, run })
}

async function runTests() {
  for (const current of tests) {
    await current.run()
    console.log(`✓ ${current.name}`)
  }
}

const enabledEnv: LinePayProductionOneDollarEnvironment = {
  VERCEL_ENV: 'production',
  VERCEL_GIT_COMMIT_SHA: '8c1fba0a6eff0d0162039b0c73500c2147a67898',
  NEXT_PUBLIC_ENABLE_LINE_PAY: 'true',
  LINE_PAY_ENV: 'production',
  LINE_PAY_TRANSPORT: 'gateway',
  LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_ENABLED: 'true',
  LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_CONFIRMATION:
    LINE_PAY_PRODUCTION_ONE_DOLLAR_CONFIRMATION,
  LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_EXPIRES_AT:
    '2026-08-04T13:00:00.000Z',
  LINE_PAY_CHANNEL_ID: 'production-channel-id',
  LINE_PAY_CHANNEL_SECRET: 'production-channel-secret',
  LINE_PAY_CONFIRM_URL:
    'https://tsu-waterbottle.com/api/product-orders/line-pay/confirm',
  LINE_PAY_CANCEL_URL:
    'https://tsu-waterbottle.com/api/product-orders/line-pay/cancel',
}

function createRequest(
  body: unknown = {
    confirmation: LINE_PAY_PRODUCTION_ONE_DOLLAR_CONFIRMATION,
    entrySource: 'ai_chart_report',
  },
  url = 'https://tsu-waterbottle.com/api/internal/line-pay/production-one-dollar/start',
) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function json(response: Response) {
  return (await response.json()) as Record<string, unknown>
}

function successDependencies() {
  const calls: string[] = []
  const initializations: Array<Record<string, unknown>> = []
  return {
    calls,
    initializations,
    authorize: async () => {
      calls.push('authorize')
      return {
        userId: '41000000-0000-4000-8000-000000000001',
        client: { name: 'production-admin-client' },
      }
    },
    initialize: async (input: Record<string, unknown>) => {
      calls.push('initialize')
      initializations.push(input)
      assert.equal(input.environment, 'production')
      assert.equal(input.amountTwd, 1)
      assert.equal(input.userId, '41000000-0000-4000-8000-000000000001')
      assert.match(String(input.requestBodySha256), /^[0-9a-f]{64}$/)
      assert.equal(JSON.stringify(input).includes('production-channel-secret'), false)
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
      const payloadInput = input.payloadInput as {
        amount: number
        products: Array<{ name: string; quantity: number; price: number }>
        confirmUrl: string
        cancelUrl: string
      }
      assert.equal(payloadInput.amount, 1)
      assert.deepEqual(payloadInput.products, [{
        name: 'LINE Pay NT$1 入口測試｜AI 命盤分析（不出貨／不提供服務）',
        quantity: 1,
        price: 1,
      }])
      assert.equal(
        payloadInput.confirmUrl,
        'https://tsu-waterbottle.com/api/product-orders/line-pay/confirm',
      )
      assert.equal(
        payloadInput.cancelUrl,
        'https://tsu-waterbottle.com/api/product-orders/line-pay/cancel',
      )
      return {
        status: 'payment_url_ready' as const,
        attemptId: '61000000-0000-4000-8000-000000000001',
        paymentId: '71000000-0000-4000-8000-000000000001',
        productOrderId: '51000000-0000-4000-8000-000000000001',
        merchantOrderNo: String(input.merchantOrderNo),
        transactionId: '92233720368547758081234567890',
        paymentUrlWeb: 'https://web-pay.line.me/web/payment/wait',
        paymentUrlApp: null,
      }
    },
    now: () => new Date('2026-08-04T12:00:00.000Z'),
    createUuid: (() => {
      const values = [
        'a1000000-0000-4000-8000-000000000001',
        'a1000000-0000-4000-8000-000000000002',
        'a1000000-0000-4000-8000-000000000003',
      ]
      return () => values.shift() ?? 'a1000000-0000-4000-8000-000000000004'
    })(),
    createToken: (() => {
      const values = ['a'.repeat(43), 'b'.repeat(43)]
      return () => values.shift() ?? 'c'.repeat(43)
    })(),
  }
}

test('Production admin confirmation initializes fixed NT$1 and returns only the trusted LINE URL', async () => {
  const deps = successDependencies()
  const response = await handleLinePayProductionOneDollarStart({
    request: createRequest(),
    env: enabledEnv,
    ...deps,
  })

  assert.equal(response.status, 200)
  assert.deepEqual(deps.calls, ['authorize', 'initialize', 'execute'])
  assert.deepEqual(await json(response), {
    ok: true,
    environment: 'production',
    entrySource: 'ai_chart_report',
    amountTwd: 1,
    currency: 'TWD',
    paymentUrl: 'https://web-pay.line.me/web/payment/wait',
  })
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const setCookie = response.headers.get('set-cookie') ?? ''
  for (const purpose of ['confirm', 'cancel'] as const) {
    assert.match(
      setCookie,
      new RegExp(`${linePayCapabilityCookieName(purpose)}=[A-Za-z0-9_-]{43}`),
    )
  }
  assert.match(setCookie, /HttpOnly/i)
  assert.match(setCookie, /Secure/i)
  assert.match(setCookie, /SameSite=Lax/i)
  assert.equal(Object.isFrozen(LINE_PAY_CAPABILITY_COOKIE_OPTIONS), true)
})

for (const [name, env] of [
  ['Preview Vercel', { ...enabledEnv, VERCEL_ENV: 'preview' }],
  ['Sandbox LINE Pay', { ...enabledEnv, LINE_PAY_ENV: 'sandbox' }],
  ['direct transport', { ...enabledEnv, LINE_PAY_TRANSPORT: 'direct' }],
  ['runtime disabled', { ...enabledEnv, NEXT_PUBLIC_ENABLE_LINE_PAY: 'false' }],
  ['test flag disabled', {
    ...enabledEnv,
    LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_ENABLED: 'false',
  }],
  ['server acknowledgement missing', {
    ...enabledEnv,
    LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_CONFIRMATION: undefined,
  }],
  ['test expiration missing', {
    ...enabledEnv,
    LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_EXPIRES_AT: undefined,
  }],
  ['test expiration too close', {
    ...enabledEnv,
    LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_EXPIRES_AT:
      '2026-08-04T12:05:00.000Z',
  }],
  ['test expiration too far away', {
    ...enabledEnv,
    LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_EXPIRES_AT:
      '2026-08-05T12:00:00.001Z',
  }],
  ['exact Head missing', { ...enabledEnv, VERCEL_GIT_COMMIT_SHA: undefined }],
] as const) {
  test(`${name} returns 404 before authorization or writes`, async () => {
    const deps = successDependencies()
    const response = await handleLinePayProductionOneDollarStart({
      request: createRequest(),
      env,
      ...deps,
    })

    assert.equal(response.status, 404)
    assert.deepEqual(await json(response), { ok: false, error: 'not_found' })
    assert.deepEqual(deps.calls, [])
  })
}

test('wrong browser confirmation returns 400 before authorization or writes', async () => {
  const deps = successDependencies()
  const response = await handleLinePayProductionOneDollarStart({
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

test('unknown payment entry returns 400 before authorization or writes', async () => {
  const deps = successDependencies()
  const response = await handleLinePayProductionOneDollarStart({
    request: createRequest({
      confirmation: LINE_PAY_PRODUCTION_ONE_DOLLAR_CONFIRMATION,
      entrySource: 'forged_entry',
    }),
    env: enabledEnv,
    ...deps,
  })

  assert.equal(response.status, 400)
  assert.deepEqual(await json(response), {
    ok: false,
    error: 'invalid_entry_source',
  })
  assert.deepEqual(deps.calls, [])
})

test('missing admin authorization stays hidden and never writes', async () => {
  const deps = successDependencies()
  const response = await handleLinePayProductionOneDollarStart({
    request: createRequest(),
    env: enabledEnv,
    ...deps,
    authorize: async () => null,
  })

  assert.equal(response.status, 404)
  assert.deepEqual(deps.calls, [])
})

test('one Production Head and admin always derive one database identity', async () => {
  const first = successDependencies()
  const second = successDependencies()
  await handleLinePayProductionOneDollarStart({
    request: createRequest(),
    env: enabledEnv,
    ...first,
    createToken: undefined,
  })
  await handleLinePayProductionOneDollarStart({
    request: createRequest(),
    env: enabledEnv,
    ...second,
    now: () => new Date('2026-08-04T12:05:00.000Z'),
    createToken: undefined,
  })

  for (const key of [
    'orderNo',
    'merchantOrderNo',
    'idempotencyKey',
    'confirmTokenHash',
    'cancelTokenHash',
    'capabilityExpiresAt',
  ] as const) {
    assert.equal(first.initializations[0]?.[key], second.initializations[0]?.[key])
  }
  assert.match(String(first.initializations[0]?.idempotencyKey), /production-one-dollar/)
  assert.equal(
    first.initializations[0]?.capabilityExpiresAt,
    enabledEnv.LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_EXPIRES_AT,
  )
})

test('each real payment entry derives its own stable one-dollar identity', async () => {
  const sources = [
    'ai_chart_report',
    'ai_divination',
    'cart',
    'booking',
  ] as const
  const identities = new Set<string>()

  for (const entrySource of sources) {
    const deps = successDependencies()
    await handleLinePayProductionOneDollarStart({
      request: createRequest({
        confirmation: LINE_PAY_PRODUCTION_ONE_DOLLAR_CONFIRMATION,
        entrySource,
      }),
      env: enabledEnv,
      ...deps,
      createToken: undefined,
    })

    assert.equal(deps.initializations[0]?.entrySource, entrySource)
    identities.add(String(deps.initializations[0]?.idempotencyKey))
  }

  assert.equal(identities.size, sources.length)
})

test('untrusted Production payment URL is redacted and never returned', async () => {
  const deps = successDependencies()
  const unsafeUrl = 'https://payments.attacker.example/collect'
  const response = await handleLinePayProductionOneDollarStart({
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
    error: 'line_pay_production_one_dollar_payment_url_failed',
  })
})

test('Production execution failure preserves only an allowlisted safe reason', async () => {
  const deps = successDependencies()
  const response = await handleLinePayProductionOneDollarStart({
    request: createRequest(),
    env: enabledEnv,
    ...deps,
    execute: async () => {
      throw new LinePayProductOrderRequestExecutionError('provider_rejected')
    },
  })

  assert.equal(response.status, 502)
  assert.deepEqual(await json(response), {
    ok: false,
    error: 'line_pay_production_one_dollar_execution_failed',
    executionReason: 'provider_rejected',
  })
})

test('route is POST-only, admin-protected, atomic, and uses the Gateway transport', () => {
  const source = readFileSync(new URL('./route.ts', import.meta.url), 'utf8')

  assert.match(source, /requireAdminUser/)
  assert.match(source, /initializeLinePayOneDollarTestCheckout/)
  assert.match(source, /createLinePayRequestDatabase/)
  assert.match(source, /executeInitializedProductOrderLinePayRequest/)
  assert.match(source, /requestLinePayPayment/)
  assert.match(source, /transportEnv,/)
  assert.match(source, /export async function POST/)
  assert.doesNotMatch(source, /export async function GET/)
  assert.doesNotMatch(source, /console\.(?:log|error)/)
})

runTests().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
