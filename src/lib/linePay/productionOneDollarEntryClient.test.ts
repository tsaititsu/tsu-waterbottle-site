import assert from 'node:assert/strict'
import {
  checkLinePayProductionOneDollarEntryAvailability,
  requestLinePayProductionOneDollarEntryCheckout,
} from './productionOneDollarEntryClient'

const tests: Array<{ name: string; run: () => Promise<void> }> = []

function test(name: string, run: () => Promise<void>) {
  tests.push({ name, run })
}

test('authorized admin sees the temporary Production entry test without exposing the token', async () => {
  const token = 'synthetic-admin-access-token'
  const calls: Array<{ input: string; init?: RequestInit }> = []
  const availability = await checkLinePayProductionOneDollarEntryAvailability({
    accessToken: token,
    now: () => new Date('2026-08-08T12:00:00.000Z'),
    fetchFn: async (input, init) => {
      calls.push({ input: String(input), init })
      return new Response(JSON.stringify({
        ok: true,
        enabled: true,
        enabledUntil: '2026-08-08T12:55:00.000Z',
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  })

  assert.deepEqual(availability, {
    status: 'enabled',
    enabledUntil: '2026-08-08T12:55:00.000Z',
  })
  assert.equal(calls[0]?.input, '/api/admin/line-pay-production-one-dollar-test')
  assert.deepEqual(calls[0]?.init, {
    cache: 'no-store',
    headers: { authorization: `Bearer ${token}` },
  })
  assert.equal(JSON.stringify(availability).includes(token), false)
})

test('non-admin response enables the regular full-price flow', async () => {
  const availability = await checkLinePayProductionOneDollarEntryAvailability({
    accessToken: 'member-token',
    fetchFn: async () => new Response('{}', { status: 403 }),
  })

  assert.deepEqual(availability, { status: 'disabled' })
})

test('status transport failure blocks an ambiguous payment mode', async () => {
  const availability = await checkLinePayProductionOneDollarEntryAvailability({
    accessToken: 'synthetic-admin-access-token',
    fetchFn: async () => {
      throw new Error('network detail')
    },
  })

  assert.deepEqual(availability, { status: 'error' })
})

test('AI chart entry starts only its fixed Production NT$1 checkout', async () => {
  const token = 'synthetic-admin-access-token'
  const calls: Array<{ input: string; init?: RequestInit }> = []
  const result = await requestLinePayProductionOneDollarEntryCheckout({
    accessToken: token,
    entrySource: 'ai_chart_report',
    fetchFn: async (input, init) => {
      calls.push({ input: String(input), init })
      return new Response(JSON.stringify({
        ok: true,
        environment: 'production',
        entrySource: 'ai_chart_report',
        amountTwd: 1,
        currency: 'TWD',
        paymentUrl: 'https://web-pay.line.me/web/payment/wait',
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  })

  assert.deepEqual(result, {
    ok: true,
    paymentUrlWeb: 'https://web-pay.line.me/web/payment/wait',
  })
  assert.equal(
    calls[0]?.input,
    '/api/internal/line-pay/production-one-dollar/start',
  )
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    confirmation: 'RUN_LINE_PAY_PRODUCTION_NT1_ONCE',
    entrySource: 'ai_chart_report',
  })
})

async function main() {
  for (const current of tests) {
    await current.run()
    console.log(`✓ ${current.name}`)
  }
  console.log(`LINE Pay Production NT$1 entry client tests passed (${tests.length} cases)`)
}

void main()
