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
    authorize: async () => ({ userId, client: { kind: 'test-client' } }),
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
