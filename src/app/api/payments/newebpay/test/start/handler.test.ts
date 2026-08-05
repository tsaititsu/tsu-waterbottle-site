import assert from 'node:assert/strict'
import { NextResponse } from 'next/server'
import {
  handleStartNewebPayAdminOneDollarTest,
  type NewebPayAdminOneDollarPaymentInsert,
} from './handler'
import { validateNewebPayPaymentMatch } from '@/lib/newebpay/notify'
import type { NewebPayAdminOneDollarTestChannel } from '@/lib/newebpay/types'
import type { PaymentRecord } from '@/lib/supabase/payments'

const enabledEnv = {
  NODE_ENV: 'production',
  VERCEL_ENV: 'production',
  NEWEBPAY_ENABLE_TEST_PAYMENT: 'true',
  ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_MODE: 'true',
  NEWEBPAY_ONE_DOLLAR_TEST_PRODUCTION_CONFIRMATION:
    'CONFIRM_NEWEBPAY_ONE_DOLLAR_TEST',
}

const channels: NewebPayAdminOneDollarTestChannel[] = [
  'credit',
  'apple_pay',
  'atm',
]

function makeRequest(channel: unknown, withToken = true) {
  return new Request('https://tsu-waterbottle.com/api/payments/newebpay/test/start', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(withToken ? { authorization: 'Bearer admin-token' } : {}),
    },
    body: JSON.stringify({ channel }),
  })
}

function makeDependencies(inserts: NewebPayAdminOneDollarPaymentInsert[]) {
  return {
    env: enabledEnv,
    authorize: async () => ({
      user: { id: 'admin-user-id', email: 'admin@example.com' },
      supabase: {} as never,
    }),
    generateMerchantOrderNo: () => 'NPTESTORDER0001',
    insertPayment: async (input: NewebPayAdminOneDollarPaymentInsert) => {
      inserts.push(input)
      return { id: `payment-${input.channel}` }
    },
  }
}

function toPaymentRecord(
  input: NewebPayAdminOneDollarPaymentInsert,
): PaymentRecord {
  return {
    id: `payment-${input.channel}`,
    userId: input.userId,
    bookingId: null,
    provider: input.provider,
    providerPaymentId: null,
    itemType: input.itemType,
    itemId: input.itemId,
    itemName: input.itemName,
    amountTwd: input.amountTwd,
    currency: input.currency,
    status: input.status,
    paidAt: null,
    refundedAt: null,
    rawPayload: input.rawPayload,
    merchantOrderNo: input.merchantOrderNo,
    providerTradeNo: null,
    notifyReceivedAt: null,
    failureReason: null,
    createdAt: '2026-08-05T00:00:00.000Z',
    updatedAt: '2026-08-05T00:00:00.000Z',
  }
}

async function run() {
for (const channel of channels) {
  const inserts: NewebPayAdminOneDollarPaymentInsert[] = []
  const response = await handleStartNewebPayAdminOneDollarTest(
    makeRequest(channel),
    makeDependencies(inserts),
  )
  const json = (await response.json()) as Record<string, unknown>

  assert.equal(response.status, 200, `${channel} 應可建立管理員測試付款`)
  assert.deepEqual(json, {
    ok: true,
    paymentId: `payment-${channel}`,
  })
  assert.equal(inserts.length, 1)
  assert.equal(inserts[0]?.channel, channel)
  assert.equal(inserts[0]?.amountTwd, 1)
  assert.equal(inserts[0]?.userId, 'admin-user-id')
  assert.equal(inserts[0]?.provider, 'newebpay')
  assert.equal(inserts[0]?.itemType, 'newebpay_test')
  assert.equal(inserts[0]?.rawPayload.paymentMode, channel)
  assert.equal(inserts[0]?.rawPayload.amount, 1)
  assert.equal(inserts[0]?.rawPayload.test_payment, true)
  assert.equal(inserts[0]?.rawPayload.one_dollar_test_mode, true)
  assert.equal(inserts[0]?.rawPayload.do_not_fulfill, true)

  const paymentMatch = validateNewebPayPaymentMatch({
    payment: toPaymentRecord(inserts[0]),
    expectedMerchantOrderNo: inserts[0].merchantOrderNo,
    providerMerchantOrderNo: inserts[0].merchantOrderNo,
    providerAmount: 1,
  })
  assert.equal(paymentMatch.ok, true, `${channel} 應通過 Notify NT$1 對帳`)
  if (paymentMatch.ok) assert.equal(paymentMatch.localAmount, 1)
}

{
  let authorized = false
  let inserted = false
  const response = await handleStartNewebPayAdminOneDollarTest(
    makeRequest('credit', false),
    {
      env: enabledEnv,
      authorize: async () => {
        authorized = true
        return {
          error: NextResponse.json({ ok: false, error: '請先登入後再使用後台。' }, { status: 401 }),
        }
      },
      insertPayment: async () => {
        inserted = true
        return { id: 'must-not-exist' }
      },
    },
  )

  assert.equal(response.status, 401)
  assert.equal(authorized, true)
  assert.equal(inserted, false)
}

{
  const inserts: NewebPayAdminOneDollarPaymentInsert[] = []
  const response = await handleStartNewebPayAdminOneDollarTest(
    makeRequest('installment_3'),
    makeDependencies(inserts),
  )

  assert.equal(response.status, 400)
  assert.equal(inserts.length, 0)
  assert.deepEqual(await response.json(), {
    ok: false,
    error: '不支援的管理員測試付款通道。',
  })
}

{
  const inserts: NewebPayAdminOneDollarPaymentInsert[] = []
  const response = await handleStartNewebPayAdminOneDollarTest(
    makeRequest('credit'),
    {
      ...makeDependencies(inserts),
      env: {
        ...enabledEnv,
        NEWEBPAY_ONE_DOLLAR_TEST_PRODUCTION_CONFIRMATION: 'WRONG',
      },
    },
  )

  assert.equal(response.status, 404)
  assert.equal(inserts.length, 0)
}

console.log('NewebPay 管理員三通道 NT$1 測試 API 契約通過')
}

void run()
