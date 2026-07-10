import assert from 'node:assert/strict'
import {
  buildNewebPayReturnRedirectForPayment,
  handleNewebPayReturnGet,
  handleNewebPayReturnPost,
  isValidDivinationReturnReadingId,
} from './handler'
import type { PaymentRecord } from '../../../../../lib/supabase/payments'

const tests: Array<{ name: string; fn: () => Promise<void> | void }> = []

function test(name: string, fn: () => Promise<void> | void) {
  tests.push({ name, fn })
}

const readingId = 'ec34c86a-d6e2-424e-9a37-48cef981b3bc'
const merchantOrderNo = 'WB20260710181818DIV'
const fakeConfig = {
  env: 'test' as const,
  merchantId: 'MS123456789',
  hashKey: '12345678901234567890123456789012',
  hashIv: '1234567890123456',
  version: '2.3',
  siteUrl: 'http://localhost:3000',
  mpgGatewayUrl: 'https://example.test/mpg',
  mpgEndpoint: 'https://example.test/mpg',
}

function makePayment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: 'payment-1',
    userId: 'user-a',
    bookingId: null,
    provider: 'newebpay',
    providerPaymentId: null,
    itemType: 'ai_divination',
    itemId: readingId,
    itemName: '紫微牌卡 AI 深度解讀',
    amountTwd: 1,
    currency: 'TWD',
    status: 'pending',
    paidAt: null,
    refundedAt: null,
    rawPayload: { amount: 1, merchantOrderNo },
    merchantOrderNo,
    providerTradeNo: null,
    notifyReceivedAt: null,
    failureReason: null,
    createdAt: '2026-07-10T10:00:00.000Z',
    updatedAt: '2026-07-10T10:00:00.000Z',
    ...overrides,
  }
}

function makePostRequest(url = `http://localhost/api/payments/newebpay/return?readingId=attacker`) {
  const form = new FormData()
  form.set('TradeInfo', 'encrypted-trade-info')
  form.set('TradeSha', 'trade-sha')
  return new Request(url, { method: 'POST', body: form })
}

function redirectLocation(response: Response) {
  return response.headers.get('location') ?? ''
}

test('ReturnURL 可用 MerchantOrderNo 找出 divination reading 並導向本次結果頁', async () => {
  const calls: string[] = []
  const response = await handleNewebPayReturnPost(makePostRequest(), {
    getNewebPayConfig: () => fakeConfig,
    verifyTradeSha: () => true,
    decryptTradeInfo: () => ({ Result: { MerchantOrderNo: merchantOrderNo } }),
    getPaymentByMerchantOrderNo: async (orderNo) => {
      calls.push(orderNo)
      return makePayment()
    },
  })
  const location = redirectLocation(response)

  assert.equal(response.status, 303)
  assert.deepEqual(calls, [merchantOrderNo])
  assert.equal(location, `http://localhost/ai-divination/result/${readingId}?payment=success`)
})

test('ReturnURL 可直接從 form body 的 MerchantOrderNo 查本地 payment', async () => {
  const form = new FormData()
  form.set('MerchantOrderNo', merchantOrderNo)
  form.set('readingId', 'attacker-controlled-reading-id')
  const calls: string[] = []

  const response = await handleNewebPayReturnPost(
    new Request('http://localhost/api/payments/newebpay/return?readingId=evil-id', {
      method: 'POST',
      body: form,
    }),
    {
      getPaymentByMerchantOrderNo: async (orderNo) => {
        calls.push(orderNo)
        return makePayment()
      },
    },
  )

  assert.equal(response.status, 303)
  assert.deepEqual(calls, [merchantOrderNo])
  assert.equal(
    redirectLocation(response),
    `http://localhost/ai-divination/result/${readingId}?payment=success`,
  )
  assert.equal(redirectLocation(response).includes('evil-id'), false)
  assert.equal(redirectLocation(response).includes('attacker-controlled-reading-id'), false)
})

test('ReturnURL 不信任任意 query readingId', async () => {
  const response = await handleNewebPayReturnPost(makePostRequest('http://localhost/api/payments/newebpay/return?readingId=evil-id'), {
    getNewebPayConfig: () => fakeConfig,
    verifyTradeSha: () => true,
    decryptTradeInfo: () => ({ MerchantOrderNo: merchantOrderNo }),
    getPaymentByMerchantOrderNo: async () => makePayment({ itemId: readingId }),
  })
  const location = redirectLocation(response)

  assert.equal(location.includes('evil-id'), false)
  assert.equal(location.endsWith(`/ai-divination/result/${readingId}?payment=success`), true)
})

test('ReturnURL 不直接 mark paid，只讀 payment 後轉址', async () => {
  let lookupCount = 0
  const response = await handleNewebPayReturnPost(makePostRequest(), {
    getNewebPayConfig: () => fakeConfig,
    verifyTradeSha: () => true,
    decryptTradeInfo: () => ({ MerchantOrderNo: merchantOrderNo }),
    getPaymentByMerchantOrderNo: async () => {
      lookupCount += 1
      return makePayment({ status: 'pending', paidAt: null })
    },
  })

  assert.equal(lookupCount, 1)
  assert.equal(redirectLocation(response).includes('/ai-divination/result/'), true)
})

test('非 divination payment 維持通用 return 頁', () => {
  const response = buildNewebPayReturnRedirectForPayment(
    new Request('http://localhost/api/payments/newebpay/return'),
    makePayment({ itemType: 'booking', itemId: 'booking-1' }),
  )

  assert.equal(response, null)
})

test('divination payment 的 item_id 必須是合法 UUID', () => {
  assert.equal(isValidDivinationReturnReadingId(readingId), true)
  assert.equal(isValidDivinationReturnReadingId('../reading'), false)

  const response = buildNewebPayReturnRedirectForPayment(
    new Request('http://localhost/api/payments/newebpay/return'),
    makePayment({ itemId: '../reading' }),
  )
  assert.equal(response, null)
})

test('TradeSha 失敗或缺資料回通用確認頁', async () => {
  const response = await handleNewebPayReturnPost(makePostRequest(), {
    getNewebPayConfig: () => fakeConfig,
    verifyTradeSha: () => false,
    decryptTradeInfo: () => ({ MerchantOrderNo: merchantOrderNo }),
    getPaymentByMerchantOrderNo: async () => makePayment(),
  })

  assert.equal(response.status, 303)
  assert.equal(redirectLocation(response), 'http://localhost/payment/newebpay/result')
})

test('GET ReturnURL 不做 paid 或 reading redirect', () => {
  const response = handleNewebPayReturnGet(new Request('http://localhost/api/payments/newebpay/return'))

  assert.equal(response.status, 303)
  assert.equal(redirectLocation(response), 'http://localhost/payment/newebpay/result')
})

async function runTests() {
  for (const { name, fn } of tests) {
    try {
      await fn()
      console.log(`✓ ${name}`)
    } catch (error) {
      console.error(`✗ ${name}`)
      throw error
    }
  }
}

void runTests()
