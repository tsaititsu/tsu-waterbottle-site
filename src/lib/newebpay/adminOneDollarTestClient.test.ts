import assert from 'node:assert/strict'
import {
  startNewebPayAdminOneDollarTest,
  type NewebPayAdminOneDollarTestChannel,
} from './adminOneDollarTestClient'

async function run() {
  const channels: NewebPayAdminOneDollarTestChannel[] = [
    'credit',
    'apple_pay',
    'atm',
  ]

  for (const channel of channels) {
    const requests: Array<{ input: string; init?: RequestInit }> = []
    const navigations: string[] = []
    const result = await startNewebPayAdminOneDollarTest(channel, {
      getAccessToken: async () => 'admin-access-token',
      fetchStart: async (input, init) => {
        requests.push({ input: String(input), init })
        return new Response(
          JSON.stringify({ ok: true, paymentId: '123e4567-e89b-42d3-a456-426614174000' }),
          { status: 200 },
        )
      },
      navigate: (url) => {
        navigations.push(url)
      },
    })

    assert.deepEqual(result, { ok: true, channel })
    assert.equal(requests.length, 1)
    assert.equal(requests[0]?.input, '/api/payments/newebpay/test/start')
    assert.equal(requests[0]?.init?.method, 'POST')
    assert.deepEqual(requests[0]?.init?.headers, {
      authorization: 'Bearer admin-access-token',
      'content-type': 'application/json',
    })
    assert.deepEqual(JSON.parse(String(requests[0]?.init?.body)), { channel })
    assert.deepEqual(navigations, [
      '/payment/newebpay/redirect?paymentId=123e4567-e89b-42d3-a456-426614174000',
    ])
  }

  {
    let fetched = false
    let navigated = false
    const result = await startNewebPayAdminOneDollarTest('credit', {
      getAccessToken: async () => null,
      fetchStart: async () => {
        fetched = true
        return new Response('{}')
      },
      navigate: () => {
        navigated = true
      },
    })

    assert.deepEqual(result, {
      ok: false,
      channel: 'credit',
      error: 'admin_session_unavailable',
    })
    assert.equal(fetched, false)
    assert.equal(navigated, false)
  }

  {
    let navigated = false
    const result = await startNewebPayAdminOneDollarTest('atm', {
      getAccessToken: async () => 'admin-access-token',
      fetchStart: async () => new Response(
        JSON.stringify({ ok: true, paymentId: 'not-a-uuid', TradeInfo: 'must-not-be-used' }),
        { status: 200 },
      ),
      navigate: () => {
        navigated = true
      },
    })

    assert.deepEqual(result, {
      ok: false,
      channel: 'atm',
      error: 'payment_response_invalid',
    })
    assert.equal(navigated, false)
  }

  console.log('NewebPay 管理員 NT$1 測試 client 契約通過')
}

void run()
