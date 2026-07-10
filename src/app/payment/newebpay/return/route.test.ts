import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createNewebPayPublicReturnRoute } from './handler'
import type { PaymentRecord } from '../../../../lib/supabase/payments'
import {
  resumePersistedDivinationReadingFromDb,
  type ResumePersistedDivinationReadingDeps,
} from '../../../api/divination/interpret/resume'
import type { DivinationReadingResumeContext } from '../../../../lib/supabase/divinationReadings'

const readingId = 'ec34c86a-d6e2-424e-9a37-48cef981b3bc'
const merchantOrderNo = 'WB20260710181818DIV'

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
    status: 'paid',
    paidAt: '2026-07-10T10:00:00.000Z',
    refundedAt: null,
    rawPayload: null,
    merchantOrderNo,
    providerTradeNo: null,
    notifyReceivedAt: '2026-07-10T10:00:00.000Z',
    failureReason: null,
    createdAt: '2026-07-10T09:58:00.000Z',
    updatedAt: '2026-07-10T10:00:00.000Z',
    ...overrides,
  }
}

function makeReturnPost(extra: Record<string, string> = {}) {
  const form = new FormData()
  form.set('MerchantOrderNo', merchantOrderNo)
  Object.entries(extra).forEach(([key, value]) => form.set(key, value))
  return new Request('http://localhost/payment/newebpay/return?readingId=attacker-id', {
    method: 'POST',
    body: form,
  })
}

async function runTests() {
  const lookupCalls: string[] = []
  const route = createNewebPayPublicReturnRoute({
  getPaymentByMerchantOrderNo: async (orderNo) => {
    lookupCalls.push(orderNo)
    return makePayment()
  },
})

const response = await route.POST(makeReturnPost({ readingId: 'untrusted-form-reading-id' }))
assert.equal(response.status, 303)
assert.deepEqual(lookupCalls, [merchantOrderNo])
assert.equal(
  response.headers.get('location'),
  `http://localhost/ai-divination/result/${readingId}?payment=success`,
)
assert.equal(response.headers.get('location')?.includes('attacker-id'), false)
assert.equal(response.headers.get('location')?.includes('untrusted-form-reading-id'), false)

const readOnlyRoute = createNewebPayPublicReturnRoute({
  getPaymentByMerchantOrderNo: async () => makePayment({ status: 'pending', paidAt: null }),
})
const pendingResponse = await readOnlyRoute.POST(makeReturnPost())
assert.equal(pendingResponse.status, 303)

const bookingRoute = createNewebPayPublicReturnRoute({
  getPaymentByMerchantOrderNo: async () => makePayment({ itemType: 'booking', itemId: 'booking-1' }),
})
const bookingResponse = await bookingRoute.POST(makeReturnPost())
assert.equal(bookingResponse.status, 303)
assert.equal(bookingResponse.headers.get('location'), 'http://localhost/payment/newebpay/result')

const genericPageSource = readFileSync(
  join(process.cwd(), 'src/app/payment/newebpay/result/page.tsx'),
  'utf8',
)
const productionRouteSource = readFileSync(
  join(process.cwd(), 'src/app/payment/newebpay/return/route.ts'),
  'utf8',
)
assert.equal(productionRouteSource.includes('createNewebPayPublicReturnRoute'), true)
assert.equal(productionRouteSource.includes('getPaymentByMerchantOrderNo'), true)
assert.equal(productionRouteSource.includes('markPaymentPaid'), false)
assert.equal(genericPageSource.includes('返回預約頁'), false)
assert.equal(genericPageSource.includes('返回網站'), true)
assert.equal(genericPageSource.includes('MerchantOrderNo'), false)
assert.equal(genericPageSource.includes('TradeNo'), false)
assert.equal(genericPageSource.includes('paymentId'), false)
assert.equal(genericPageSource.includes('TradeInfo'), false)
assert.equal(genericPageSource.includes('TradeSha'), false)

let currentReading: DivinationReadingResumeContext = {
  id: readingId,
  userId: 'user-a',
  question: '我接下來的工作方向？',
  drawMode: 'manual',
  cardId: 'ziwei',
  cardName: '紫微星',
  position: 'upright',
  status: 'paid',
  interpretation: null,
  paymentId: 'payment-1',
  merchantOrderNo,
}
let openAiCalls = 0
const integrationDeps: ResumePersistedDivinationReadingDeps = {
  getUserIdFromRequest: async () => 'user-a',
  getReadingForUser: async (id, ownerId) => {
    if (id !== readingId || ownerId !== 'user-a') return null
    return currentReading
  },
  getPaymentById: async () => makePayment(),
  startInterpretationIfPaid: async () => {
    currentReading = { ...currentReading, status: 'interpreting' }
    return { result: 'updated', readingId }
  },
  createInterpretation: async () => {
    openAiCalls += 1
    return {
      ok: true,
      interpretation: {
        finalAnswer: '整合完成的解讀',
        summary: '牌卡解讀',
        cardMessage: '牌卡訊息',
        situationAnalysis: '目前狀態',
        advice: '使用建議',
        reminder: '溫和提醒',
      },
    } as const
  },
  markCompleted: async (input) => {
    currentReading = {
      ...currentReading,
      status: 'completed',
      interpretation: input.interpretation,
    }
    return { result: 'updated', readingId }
  },
  markFailed: async () => ({ result: 'updated', readingId }),
}

const redirectedReadingId = new URL(response.headers.get('location') ?? '').pathname.split('/').at(-1)
assert.equal(redirectedReadingId, readingId)

const resumeResponse = await resumePersistedDivinationReadingFromDb({
  request: new Request(`http://localhost/api/divination/interpret`),
  readingId: redirectedReadingId ?? '',
}, integrationDeps)
assert.equal(resumeResponse.status, 200)
assert.equal(currentReading.status, 'completed')
assert.equal(openAiCalls, 1)

const refreshResponse = await resumePersistedDivinationReadingFromDb({
  request: new Request(`http://localhost/api/divination/interpret`),
  readingId,
}, integrationDeps)
assert.equal(refreshResponse.status, 200)
assert.equal(openAiCalls, 1)

  console.log('✓ POST ReturnURL → local payment → 303 result → paid resume → completed integration passed')
}

void runTests()
