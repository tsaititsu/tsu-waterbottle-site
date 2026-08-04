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
    authorize: async () => ({ userId, client: { rpc() {} } }),
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
