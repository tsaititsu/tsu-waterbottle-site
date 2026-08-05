import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  handleProductOrderLinePayStart,
  trustedLinePayPaymentUrl,
  type ProductOrderLinePayStartDependencies,
} from './startHandler'

const userId = '41000000-0000-4000-8000-000000000001'
const productOrderId = '51000000-0000-4000-8000-000000000001'
const paymentId = '71000000-0000-4000-8000-000000000001'
const attemptId = '61000000-0000-4000-8000-000000000001'

const env = {
  NEXT_PUBLIC_ENABLE_LINE_PAY: 'true',
  LINE_PAY_ENV: 'sandbox',
  LINE_PAY_CHANNEL_ID: 'synthetic-channel-id',
  LINE_PAY_CHANNEL_SECRET: 'synthetic-channel-secret',
  LINE_PAY_CONFIRM_URL:
    'https://preview.example.com/api/product-orders/line-pay/confirm',
  LINE_PAY_CANCEL_URL:
    'https://preview.example.com/api/product-orders/line-pay/cancel',
}

const oneDollarEnv = {
  ...env,
  VERCEL_ENV: 'production',
  VERCEL_GIT_COMMIT_SHA: 'b'.repeat(40),
  LINE_PAY_ENV: 'production',
  LINE_PAY_TRANSPORT: 'gateway',
  LINE_PAY_GATEWAY_URL: 'https://gateway.example.com',
  LINE_PAY_GATEWAY_KEY_ID: 'synthetic-key-id',
  LINE_PAY_GATEWAY_SECRET: 'synthetic-gateway-secret',
  LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_ENABLED: 'true',
  LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_CONFIRMATION:
    'RUN_LINE_PAY_PRODUCTION_NT1_ONCE',
  LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_EXPIRES_AT:
    '2026-08-05T02:00:00.000Z',
  LINE_PAY_CONFIRM_URL:
    'https://preview.example.com/api/product-orders/line-pay/confirm',
  LINE_PAY_CANCEL_URL:
    'https://preview.example.com/api/product-orders/line-pay/cancel',
}

function request(body: unknown) {
  return new Request(
    'https://preview.example.com/api/product-orders/line-pay/request',
    {
      method: 'POST',
      headers: {
        authorization: 'Bearer synthetic-user-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )
}

function validBody() {
  return {
    idempotencyKey: 'cart-checkout-attempt-0001',
    customerInfo: {
      customerName: '測試客人',
      customerPhone: '0900000000',
      customerEmail: null,
      recipientName: '測試收件人',
      recipientPhone: '0900000000',
      recipientEmail: null,
      postalCode: '100',
      address: '測試地址',
      note: '測試備註',
    },
    items: [
      {
        productSlug: 'ren-yuan-fu',
        quantity: 1,
        amount: 1,
        name: 'client-spoofed-name',
      },
    ],
  }
}

test('authenticated cart checkout uses the atomic initializer and returns an approved payment URL', async () => {
  const calls: Array<{ operation: string; input: Record<string, unknown> }> = []
  const dependencies: ProductOrderLinePayStartDependencies = {
    authorize: async () => ({ userId, client: { rpc() {} }, isAdmin: false }),
    initialize: async (input) => {
      calls.push({ operation: 'initialize', input })
      return {
        result_code: 'initialized',
        product_order_id: productOrderId,
        payment_id: paymentId,
        attempt_id: attemptId,
        outbox_id: '81000000-0000-4000-8000-000000000001',
        confirm_capability_id: '91000000-0000-4000-8000-000000000001',
        cancel_capability_id: '91000000-0000-4000-8000-000000000002',
        merchant_order_no: String(input.merchantOrderNo),
        request_state: 'queued',
      }
    },
    execute: async (input) => {
      calls.push({ operation: 'execute', input })
      return {
        status: 'payment_url_ready',
        attemptId,
        paymentId,
        productOrderId,
        merchantOrderNo: String(input.merchantOrderNo),
        transactionId: '2026080400000000001',
        paymentUrlWeb:
          'https://sandbox-web-pay.line.me/web/payment/wait?transactionReserveId=synthetic',
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

  const response = await handleProductOrderLinePayStart({
    request: request(validBody()),
    env,
    dependencies,
  })
  const payload = (await response.json()) as Record<string, unknown>

  assert.equal(response.status, 200)
  assert.deepEqual(calls.map(({ operation }) => operation), [
    'initialize',
    'execute',
  ])
  assert.equal(
    (calls[0]?.input.items as Array<Record<string, unknown>>)[0]?.productSlug,
    'ren-yuan-fu',
  )
  assert.equal(
    JSON.stringify(calls).includes('client-spoofed-name'),
    false,
  )
  assert.equal('amount' in calls[0]!.input, false)
  assert.equal(
    (calls[1]?.input.payloadInput as { amount: number }).amount,
    1500,
  )
  assert.deepEqual(payload, {
    ok: true,
    paymentUrl: {
      web: 'https://sandbox-web-pay.line.me/web/payment/wait?transactionReserveId=synthetic',
    },
  })
  const setCookie = response.headers.get('set-cookie') ?? ''
  assert.match(setCookie, /__Host-line-pay-confirm=/)
  assert.match(setCookie, /__Host-line-pay-cancel=/)
  assert.equal(JSON.stringify(payload).includes('synthetic-channel-secret'), false)
  assert.equal(JSON.stringify(payload).includes('2026080400000000001'), false)
})

test('explicit admin cart entry test initializes the fixed no-shipping NT$1 order', async () => {
  const calls: Array<{ operation: string; input: Record<string, unknown> }> = []
  const dependencies: ProductOrderLinePayStartDependencies = {
    authorize: async () => ({ userId, client: { rpc() {} }, isAdmin: true }),
    initialize: async (input) => {
      calls.push({ operation: 'initialize', input })
      throw new Error('formal initializer must not run')
    },
    initializeOneDollarTest: async (input) => {
      calls.push({ operation: 'initializeOneDollarTest', input })
      return {
        result_code: 'initialized',
        product_order_id: productOrderId,
        payment_id: paymentId,
        attempt_id: attemptId,
        outbox_id: '81000000-0000-4000-8000-000000000001',
        confirm_capability_id: '91000000-0000-4000-8000-000000000001',
        cancel_capability_id: '91000000-0000-4000-8000-000000000002',
        merchant_order_no: String(input.merchantOrderNo),
        request_state: 'queued',
      }
    },
    execute: async (input) => {
      calls.push({ operation: 'execute', input })
      return {
        status: 'payment_url_ready',
        attemptId,
        paymentId,
        productOrderId,
        merchantOrderNo: String(input.merchantOrderNo),
        transactionId: '2026080500000000001',
        paymentUrlWeb:
          'https://web-pay.line.me/web/payment/wait?transactionReserveId=synthetic',
        paymentUrlApp: null,
      }
    },
    now: () => new Date('2026-08-05T01:00:00.000Z'),
    createUuid: () => 'a1000000-0000-4000-8000-000000000001',
    createToken: (purpose) => purpose === 'confirm' ? 'a'.repeat(43) : 'b'.repeat(43),
  }
  const body = { ...validBody(), adminOneDollarTest: true }
  const response = await handleProductOrderLinePayStart({
    request: request(body),
    env: oneDollarEnv,
    dependencies,
  })

  assert.equal(response.status, 200)
  assert.deepEqual(calls.map(({ operation }) => operation), [
    'initializeOneDollarTest',
    'execute',
  ])
  const initialization = calls[0]?.input
  assert.equal(initialization?.amountTwd, 1)
  assert.equal(initialization?.environment, 'production')
  assert.match(String(initialization?.idempotencyKey), /admin-nt1/)
  assert.equal(
    initialization?.capabilityExpiresAt,
    oneDollarEnv.LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_EXPIRES_AT,
  )
  const payloadInput = calls[1]?.input.payloadInput as {
    amount: number
    products: Array<{ name: string; quantity: number; price: number }>
  }
  assert.equal(payloadInput.amount, 1)
  assert.deepEqual(payloadInput.products, [{
    name: '管理員入口驗收｜購物車 NT$1（請勿出貨）',
    quantity: 1,
    price: 1,
  }])
})

test('non-admin cart request cannot opt into the NT$1 entry path', async () => {
  let writes = 0
  const response = await handleProductOrderLinePayStart({
    request: request({ ...validBody(), adminOneDollarTest: true }),
    env: oneDollarEnv,
    dependencies: {
      authorize: async () => ({ userId, client: { rpc() {} }, isAdmin: false }),
      initialize: async () => {
        writes += 1
        throw new Error('must_not_initialize')
      },
      initializeOneDollarTest: async () => {
        writes += 1
        throw new Error('must_not_initialize_test')
      },
      execute: async () => {
        writes += 1
        throw new Error('must_not_execute')
      },
      now: () => new Date('2026-08-05T01:00:00.000Z'),
    },
  })

  assert.equal(response.status, 404)
  assert.equal(writes, 0)
})

test('expired cart NT$1 window fails closed before initialization', async () => {
  let writes = 0
  const response = await handleProductOrderLinePayStart({
    request: request({ ...validBody(), adminOneDollarTest: true }),
    env: oneDollarEnv,
    dependencies: {
      authorize: async () => ({ userId, client: { rpc() {} }, isAdmin: true }),
      initialize: async () => {
        writes += 1
        throw new Error('must_not_initialize')
      },
      initializeOneDollarTest: async () => {
        writes += 1
        throw new Error('must_not_initialize_test')
      },
      execute: async () => {
        writes += 1
        throw new Error('must_not_execute')
      },
      now: () => new Date('2026-08-05T03:00:00.000Z'),
    },
  })

  assert.equal(response.status, 404)
  assert.equal(writes, 0)
})

test('cart NT$1 initializer failure stops before the provider request', async () => {
  let executions = 0
  const response = await handleProductOrderLinePayStart({
    request: request({ ...validBody(), adminOneDollarTest: true }),
    env: oneDollarEnv,
    dependencies: {
      authorize: async () => ({ userId, client: { rpc() {} }, isAdmin: true }),
      initialize: async () => {
        throw new Error('formal_initializer_must_not_run')
      },
      initializeOneDollarTest: async () => {
        throw new Error('synthetic_initializer_failure')
      },
      execute: async () => {
        executions += 1
        throw new Error('must_not_execute')
      },
      now: () => new Date('2026-08-05T01:00:00.000Z'),
    },
  })

  assert.equal(response.status, 502)
  assert.equal(executions, 0)
})

test('cart NT$1 provider failure returns a redacted error', async () => {
  const response = await handleProductOrderLinePayStart({
    request: request({ ...validBody(), adminOneDollarTest: true }),
    env: oneDollarEnv,
    dependencies: {
      authorize: async () => ({ userId, client: { rpc() {} }, isAdmin: true }),
      initialize: async () => {
        throw new Error('formal_initializer_must_not_run')
      },
      initializeOneDollarTest: async () => ({
        result_code: 'initialized',
        product_order_id: productOrderId,
        payment_id: paymentId,
        attempt_id: attemptId,
        outbox_id: '81000000-0000-4000-8000-000000000001',
        confirm_capability_id: '91000000-0000-4000-8000-000000000001',
        cancel_capability_id: '91000000-0000-4000-8000-000000000002',
        merchant_order_no: 'LP_CART_SYNTHETIC',
        request_state: 'queued',
      }),
      execute: async () => {
        throw new Error('sensitive_provider_detail')
      },
      now: () => new Date('2026-08-05T01:00:00.000Z'),
    },
  })
  const payload = await response.json() as Record<string, unknown>

  assert.equal(response.status, 502)
  assert.deepEqual(payload, {
    ok: false,
    error: 'line_pay_checkout_request_failed',
  })
  assert.equal(JSON.stringify(payload).includes('sensitive_provider_detail'), false)
})

test('payment redirect allowlist separates sandbox and production hosts', () => {
  assert.equal(
    trustedLinePayPaymentUrl(
      'https://web-pay.line.me/web/payment/wait?id=synthetic',
      'production',
    ),
    'https://web-pay.line.me/web/payment/wait?id=synthetic',
  )
  for (const unsafeUrl of [
    'http://web-pay.line.me/web/payment/wait',
    'https://sandbox-web-pay.line.me/web/payment/wait',
    'https://web-pay.line.me.attacker.example/web/payment/wait',
    'https://user@web-pay.line.me/web/payment/wait',
    'https://web-pay.line.me/not-web/payment/wait',
  ]) {
    assert.throws(
      () => trustedLinePayPaymentUrl(unsafeUrl, 'production'),
      /invalid_line_pay_payment_url/,
    )
  }
})

test('unauthenticated checkout stops before initialization and execution', async () => {
  let writes = 0
  const response = await handleProductOrderLinePayStart({
    request: request(validBody()),
    env,
    dependencies: {
      authorize: async () => null,
      initialize: async () => {
        writes += 1
        throw new Error('must_not_initialize')
      },
      execute: async () => {
        writes += 1
        throw new Error('must_not_execute')
      },
    },
  })

  assert.equal(response.status, 401)
  assert.equal(writes, 0)
  assert.deepEqual(await response.json(), {
    ok: false,
    error: 'line_pay_login_required',
  })
})
