import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  checkLinePayProductionOneDollarEntryAvailability,
  requestLinePayProductionOneDollarEntryCheckout,
} from './productionOneDollarEntryClient'

test('authorized admin sees the temporary Production entry test without exposing the token', async () => {
  const token = 'synthetic-admin-access-token'
  const calls: Array<{ input: string; init?: RequestInit }> = []
  const enabled = await checkLinePayProductionOneDollarEntryAvailability({
    accessToken: token,
    fetchFn: async (input, init) => {
      calls.push({ input: String(input), init })
      return new Response(JSON.stringify({ ok: true, enabled: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  })

  assert.equal(enabled, true)
  assert.equal(calls[0]?.input, '/api/admin/line-pay-production-one-dollar-test')
  assert.deepEqual(calls[0]?.init, {
    cache: 'no-store',
    headers: { authorization: `Bearer ${token}` },
  })
  assert.equal(JSON.stringify(enabled).includes(token), false)
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
