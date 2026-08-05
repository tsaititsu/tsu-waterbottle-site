import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { LinePayServerEnv } from '@/lib/linePay'
import type { LinePayServiceTarget } from '@/lib/linePay/serviceCheckout'
import {
  handleServiceLinePayStart,
  type ServiceLinePayStartDependencies,
} from './handler'

const env: LinePayServerEnv = {
  NEXT_PUBLIC_ENABLE_LINE_PAY: 'true',
  LINE_PAY_ENV: 'sandbox',
  LINE_PAY_CHANNEL_ID: 'test_channel_id',
  LINE_PAY_CHANNEL_SECRET: 'test_channel_secret',
  LINE_PAY_CONFIRM_URL: 'https://example.com/api/product-orders/line-pay/confirm',
  LINE_PAY_CANCEL_URL: 'https://example.com/api/product-orders/line-pay/cancel',
}

const oneDollarEnv: LinePayServerEnv = {
  ...env,
  VERCEL_ENV: 'production',
  VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
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
    'https://example.com/api/product-orders/line-pay/confirm',
  LINE_PAY_CANCEL_URL:
    'https://example.com/api/product-orders/line-pay/cancel',
}

const userId = '41000000-0000-4000-8000-000000000001'
const sourceId = '51000000-0000-4000-8000-000000000001'
const target: LinePayServiceTarget = {
  source: 'booking',
  sourceId,
  itemType: 'booking',
  itemName: '水瓶先生論命',
  amountTwd: 3600,
  bookingId: sourceId,
  returnPath: '/account/bookings',
}

const initialized = {
  result_code: 'initialized' as const,
  product_order_id: '61000000-0000-4000-8000-000000000001',
  payment_id: '71000000-0000-4000-8000-000000000001',
  attempt_id: '81000000-0000-4000-8000-000000000001',
  outbox_id: '91000000-0000-4000-8000-000000000001',
  confirm_capability_id: 'a1000000-0000-4000-8000-000000000001',
  cancel_capability_id: 'b1000000-0000-4000-8000-000000000001',
  merchant_order_no: 'LP_SVC_TEST',
  request_state: 'queued' as const,
}

function request(body: unknown) {
  return new Request('https://example.com/api/payments/line-pay/request', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function dependencies(overrides: Partial<ServiceLinePayStartDependencies> = {}) {
  const calls = {
    resolved: [] as unknown[],
    initialized: [] as unknown[],
    executed: [] as unknown[],
    linked: [] as unknown[],
  }
  const value: ServiceLinePayStartDependencies = {
    authorize: async () => ({
      userId,
      client: { kind: 'test-client' },
      isAdmin: true,
    }),
    resolveTarget: async (input) => {
      calls.resolved.push(input)
      return target
    },
    initialize: async (input) => {
      calls.initialized.push(input)
      return initialized
    },
    execute: async (input) => {
      calls.executed.push(input)
      return {
        status: 'payment_url_ready',
        attemptId: initialized.attempt_id,
        paymentId: initialized.payment_id,
        productOrderId: initialized.product_order_id,
        merchantOrderNo: initialized.merchant_order_no,
        transactionId: '2026080500000000001',
        paymentUrlWeb: 'https://sandbox-web-pay.line.me/web/payment/wait',
        paymentUrlApp: null,
      }
    },
    linkTarget: async (input) => {
      calls.linked.push(input)
      return 'not_required'
    },
    now: () => new Date('2026-08-05T01:00:00.000Z'),
    createUuid: () => 'c1000000-0000-4000-8000-000000000001',
    createToken: (purpose) => `${purpose}-capability-token`,
    ...overrides,
  }
  return { calls, value }
}

test('rejects unauthenticated service checkout before target lookup', async () => {
  let targetLookups = 0
  const deps = dependencies({
    authorize: async () => null,
    resolveTarget: async () => {
      targetLookups += 1
      return target
    },
  })
  const response = await handleServiceLinePayStart({
    request: request({
      source: 'booking',
      sourceId,
      idempotencyKey: `booking-line-pay:${sourceId}`,
    }),
    env,
    dependencies: deps.value,
  })

  assert.equal(response.status, 401)
  assert.equal(targetLookups, 0)
})

test('rejects unsupported sources without creating a payment aggregate', async () => {
  const deps = dependencies()
  const response = await handleServiceLinePayStart({
    request: request({
      source: 'newebpay_line_pay',
      sourceId,
      idempotencyKey: `booking-line-pay:${sourceId}`,
    }),
    env,
    dependencies: deps.value,
  })

  assert.equal(response.status, 400)
  assert.equal(deps.calls.initialized.length, 0)
  assert.equal(deps.calls.executed.length, 0)
})

test('uses the server-resolved amount and links the service after provider readiness', async () => {
  const deps = dependencies()
  const response = await handleServiceLinePayStart({
    request: request({
      source: 'booking',
      sourceId,
      amountTwd: 1,
      idempotencyKey: `booking-line-pay:${sourceId}`,
    }),
    env,
    dependencies: deps.value,
  })
  const payload = await response.json() as Record<string, unknown>

  assert.equal(response.status, 200)
  assert.deepEqual(payload, {
    ok: true,
    paymentUrl: {
      web: 'https://sandbox-web-pay.line.me/web/payment/wait',
    },
  })
  assert.equal(deps.calls.initialized.length, 1)
  assert.equal(deps.calls.executed.length, 1)
  assert.equal(deps.calls.linked.length, 1)
  const execution = deps.calls.executed[0] as {
    payloadInput: { amount: number; products: Array<{ price: number }> }
  }
  assert.equal(execution.payloadInput.amount, 3600)
  assert.equal(execution.payloadInput.products[0]?.price, 3600)
  assert.equal(JSON.stringify(payload).includes('test_channel_secret'), false)
  assert.match(response.headers.get('set-cookie') ?? '', /HttpOnly/i)
})

test('explicit admin entry test keeps the service target but charges LINE Pay NT$1', async () => {
  const deps = dependencies({
    execute: async (input) => {
      deps.calls.executed.push(input)
      return {
        status: 'payment_url_ready',
        attemptId: initialized.attempt_id,
        paymentId: initialized.payment_id,
        productOrderId: initialized.product_order_id,
        merchantOrderNo: initialized.merchant_order_no,
        transactionId: '2026080500000000001',
        paymentUrlWeb: 'https://web-pay.line.me/web/payment/wait',
        paymentUrlApp: null,
      }
    },
    now: () => new Date('2026-08-05T01:00:00.000Z'),
  })
  const response = await handleServiceLinePayStart({
    request: request({
      source: 'booking',
      sourceId,
      idempotencyKey: `booking-line-pay:${sourceId}`,
      adminOneDollarTest: true,
    }),
    env: oneDollarEnv,
    dependencies: deps.value,
  })

  assert.equal(response.status, 200)
  const initializedInput = deps.calls.initialized[0] as {
    target: LinePayServiceTarget
    idempotencyKey: string
  }
  assert.equal(initializedInput.target.source, 'booking')
  assert.equal(initializedInput.target.sourceId, sourceId)
  assert.equal(initializedInput.target.itemType, 'booking')
  assert.equal(initializedInput.target.bookingId, sourceId)
  assert.equal(initializedInput.target.amountTwd, 1)
  assert.match(initializedInput.target.itemName, /管理員 NT\$1 驗收/)
  assert.match(initializedInput.idempotencyKey, /admin-nt1/)
  const execution = deps.calls.executed[0] as {
    payloadInput: { amount: number; products: Array<{ price: number }> }
  }
  assert.equal(execution.payloadInput.amount, 1)
  assert.equal(execution.payloadInput.products[0]?.price, 1)
})

test('non-admin cannot request the entry NT$1 path and creates no payment aggregate', async () => {
  const deps = dependencies({
    authorize: async () => ({
      userId,
      client: { kind: 'test-client' },
      isAdmin: false,
    }),
    now: () => new Date('2026-08-05T01:00:00.000Z'),
  })
  const response = await handleServiceLinePayStart({
    request: request({
      source: 'booking',
      sourceId,
      idempotencyKey: `booking-line-pay:${sourceId}`,
      adminOneDollarTest: true,
    }),
    env: oneDollarEnv,
    dependencies: deps.value,
  })

  assert.equal(response.status, 404)
  assert.equal(deps.calls.resolved.length, 0)
  assert.equal(deps.calls.initialized.length, 0)
  assert.equal(deps.calls.executed.length, 0)
})

test('course checkout cannot opt into the entry NT$1 path', async () => {
  const deps = dependencies({
    now: () => new Date('2026-08-05T01:00:00.000Z'),
  })
  const response = await handleServiceLinePayStart({
    request: request({
      source: 'course',
      sourceId: 'basic',
      idempotencyKey: 'course-line-pay:basic',
      adminOneDollarTest: true,
    }),
    env: oneDollarEnv,
    dependencies: deps.value,
  })

  assert.equal(response.status, 404)
  assert.equal(deps.calls.resolved.length, 0)
  assert.equal(deps.calls.initialized.length, 0)
  assert.equal(deps.calls.executed.length, 0)
})

test('admin ordinary checkout keeps the formal amount while the test window is enabled', async () => {
  const deps = dependencies({
    execute: async (input) => {
      deps.calls.executed.push(input)
      return {
        status: 'payment_url_ready',
        attemptId: initialized.attempt_id,
        paymentId: initialized.payment_id,
        productOrderId: initialized.product_order_id,
        merchantOrderNo: initialized.merchant_order_no,
        transactionId: '2026080500000000001',
        paymentUrlWeb: 'https://web-pay.line.me/web/payment/wait',
        paymentUrlApp: null,
      }
    },
    now: () => new Date('2026-08-05T01:00:00.000Z'),
  })
  const response = await handleServiceLinePayStart({
    request: request({
      source: 'booking',
      sourceId,
      idempotencyKey: `booking-line-pay:${sourceId}`,
    }),
    env: oneDollarEnv,
    dependencies: deps.value,
  })

  assert.equal(response.status, 200)
  const execution = deps.calls.executed[0] as {
    payloadInput: { amount: number; products: Array<{ price: number }> }
  }
  assert.equal(execution.payloadInput.amount, 3600)
  assert.equal(execution.payloadInput.products[0]?.price, 3600)
})

test('does not link the service when the provider request is not ready', async () => {
  const deps = dependencies({
    execute: async () => ({
      status: 'claim_busy',
      attemptId: initialized.attempt_id,
      paymentId: initialized.payment_id,
      productOrderId: initialized.product_order_id,
      merchantOrderNo: initialized.merchant_order_no,
    }),
  })
  const response = await handleServiceLinePayStart({
    request: request({
      source: 'booking',
      sourceId,
      idempotencyKey: `booking-line-pay:${sourceId}`,
    }),
    env,
    dependencies: deps.value,
  })

  assert.equal(response.status, 409)
  assert.equal(deps.calls.linked.length, 0)
})

test('fails closed when callback origin or path is inconsistent', async () => {
  const deps = dependencies()
  const response = await handleServiceLinePayStart({
    request: request({
      source: 'booking',
      sourceId,
      idempotencyKey: `booking-line-pay:${sourceId}`,
    }),
    env: {
      ...env,
      LINE_PAY_CONFIRM_URL: 'https://other.example/api/product-orders/line-pay/confirm',
    },
    dependencies: deps.value,
  })

  assert.equal(response.status, 500)
  assert.equal(deps.calls.initialized.length, 0)
})
