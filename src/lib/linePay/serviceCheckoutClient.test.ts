import assert from 'node:assert/strict'
import {
  getServiceLinePayErrorMessage,
  requestServiceLinePayCheckout,
} from './serviceCheckoutClient'

async function runTests() {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const result = await requestServiceLinePayCheckout({
  accessToken: 'test-access-token',
  source: 'course',
  sourceId: 'basic',
  idempotencyKey: 'course-line-pay:test-idempotency-key',
  fetchFn: async (url, init) => {
    calls.push({ url: String(url), init })
    return Response.json({
      ok: true,
      paymentUrl: { web: 'https://sandbox-web-pay.line.me/web/payment/wait' },
    })
  },
  })

  assert.deepEqual(result, {
  ok: true,
  paymentUrlWeb: 'https://sandbox-web-pay.line.me/web/payment/wait',
  })
  assert.equal(calls[0]?.url, '/api/payments/line-pay/request')
  assert.equal(calls[0]?.init?.method, 'POST')
  assert.equal(
  (calls[0]?.init?.headers as Record<string, string>).Authorization,
  'Bearer test-access-token',
  )
  assert.equal(JSON.stringify(calls).includes('channelSecret'), false)
  assert.equal(JSON.stringify(calls).includes('amountTwd'), false)
  assert.equal(JSON.stringify(calls).includes('adminOneDollarTest'), false)

  const adminCalls: Array<{ url: string; init?: RequestInit }> = []
  const adminResult = await requestServiceLinePayCheckout({
    accessToken: 'test-access-token',
    source: 'booking',
    sourceId: '51000000-0000-4000-8000-000000000001',
    idempotencyKey: 'booking-line-pay:test-idempotency-key',
    adminOneDollarTest: true,
    fetchFn: async (url, init) => {
      adminCalls.push({ url: String(url), init })
      return Response.json({
        ok: true,
        paymentUrl: { web: 'https://web-pay.line.me/web/payment/wait' },
      })
    },
  })
  assert.equal(adminResult.ok, true)
  assert.deepEqual(
    JSON.parse(String(adminCalls[0]?.init?.body)),
    {
      source: 'booking',
      sourceId: '51000000-0000-4000-8000-000000000001',
      idempotencyKey: 'booking-line-pay:test-idempotency-key',
      adminOneDollarTest: true,
    },
  )

  const unavailable = await requestServiceLinePayCheckout({
  accessToken: 'test-access-token',
  source: 'course',
  sourceId: 'basic',
  idempotencyKey: 'course-line-pay:test-idempotency-key',
  fetchFn: async () => Response.json(
    { ok: false, error: 'line_pay_disabled' },
    { status: 404 },
  ),
  })
  assert.equal(unavailable.ok, false)
  if (!unavailable.ok) {
    assert.equal(
      getServiceLinePayErrorMessage(unavailable),
      'LINE Pay 目前暫時無法使用，請改選其他付款方式。',
    )
  }

  console.log('LINE Pay service checkout client tests passed')
}

void runTests()
