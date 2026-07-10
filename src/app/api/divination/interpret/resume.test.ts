import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  resumePersistedDivinationReadingFromDb,
  type ResumePersistedDivinationReadingDeps,
} from './resume'
import type { DivinationReadingResumeContext } from '../../../../lib/supabase/divinationReadings'
import type { PaymentRecord } from '../../../../lib/supabase/payments'

const readingId = 'ec34c86a-d6e2-424e-9a37-48cef981b3bc'
const userId = 'user-a'
const paymentId = 'payment-1'
const interpretation = {
  finalAnswer: '完整解讀',
  summary: '牌卡解讀',
  cardMessage: '牌卡訊息',
  situationAnalysis: '目前狀態',
  advice: '使用建議',
  reminder: '溫和提醒',
}

function makeReading(
  overrides: Partial<DivinationReadingResumeContext> = {},
): DivinationReadingResumeContext {
  return {
    id: readingId,
    userId,
    question: '我接下來的工作方向？',
    drawMode: 'manual',
    cardId: 'ziwei',
    cardName: '紫微星',
    position: 'upright',
    status: 'paid',
    interpretation: null,
    paymentId,
    merchantOrderNo: 'WB20260710181818DIV',
    ...overrides,
  }
}

function makePayment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: paymentId,
    userId,
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
    merchantOrderNo: 'WB20260710181818DIV',
    providerTradeNo: null,
    notifyReceivedAt: '2026-07-10T10:00:00.000Z',
    failureReason: null,
    createdAt: '2026-07-10T09:58:00.000Z',
    updatedAt: '2026-07-10T10:00:00.000Z',
    ...overrides,
  }
}

function makeDeps(input: {
  reading?: DivinationReadingResumeContext | null
  payment?: PaymentRecord | null
  user?: string | null
} = {}) {
  let openAiCalls = 0
  let startCalls = 0
  let completedCalls = 0
  let failedCalls = 0
  let receivedInterpretationInput: Record<string, unknown> | null = null

  const deps: ResumePersistedDivinationReadingDeps = {
    getUserIdFromRequest: async () => input.user === undefined ? userId : input.user,
    getReadingForUser: async () => input.reading === undefined ? makeReading() : input.reading,
    getPaymentById: async () => input.payment === undefined ? makePayment() : input.payment,
    startInterpretationIfPaid: async () => {
      startCalls += 1
      return { result: 'updated', readingId }
    },
    createInterpretation: async (requestInput) => {
      openAiCalls += 1
      receivedInterpretationInput = requestInput as unknown as Record<string, unknown>
      return { ok: true, interpretation } as const
    },
    markCompleted: async () => {
      completedCalls += 1
      return { result: 'updated', readingId }
    },
    markFailed: async () => {
      failedCalls += 1
      return { result: 'updated', readingId }
    },
  }

  return {
    deps,
    calls: {
      get openAi() { return openAiCalls },
      get start() { return startCalls },
      get completed() { return completedCalls },
      get failed() { return failedCalls },
      get interpretationInput() { return receivedInterpretationInput },
    },
  }
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>
}

const tests: Array<{ name: string; fn: () => Promise<void> | void }> = []

function test(name: string, fn: () => Promise<void> | void) {
  tests.push({ name, fn })
}

test('paid reading 會再次驗證本地 paid payment，再以 DB 內容產生解讀', async () => {
  const { deps, calls } = makeDeps()
  const response = await resumePersistedDivinationReadingFromDb({
    request: new Request('http://localhost/api/divination/interpret'),
    readingId,
  }, deps)
  const json = await readJson(response)

  assert.equal(response.status, 200)
  assert.equal(calls.start, 1)
  assert.equal(calls.openAi, 1)
  assert.equal(calls.completed, 1)
  assert.equal(calls.failed, 0)
  assert.equal(calls.interpretationInput?.question, '我接下來的工作方向？')
  assert.equal(calls.interpretationInput?.drawMode, 'manual')
  assert.equal(calls.interpretationInput?.position, 'upright')
  assert.equal((calls.interpretationInput?.card as { id?: string }).id, 'ziwei')
  assert.equal((json.paymentGate as Record<string, unknown>).mode, 'db_paid')
  assert.equal((json.paymentGate as Record<string, unknown>).provider, 'newebpay')
})

test('payment 尚未 paid 或關聯不一致時不可呼叫 OpenAI', async () => {
  const { deps, calls } = makeDeps({ payment: makePayment({ status: 'pending' }) })
  const response = await resumePersistedDivinationReadingFromDb({
    request: new Request('http://localhost/api/divination/interpret'),
    readingId,
  }, deps)
  const json = await readJson(response)

  assert.equal(response.status, 409)
  assert.equal(json.error, 'PAYMENT_PENDING')
  assert.equal(calls.start, 0)
  assert.equal(calls.openAi, 0)
})

test('interpreting reading 不會再開第二個 OpenAI request', async () => {
  const { deps, calls } = makeDeps({ reading: makeReading({ status: 'interpreting' }) })
  const response = await resumePersistedDivinationReadingFromDb({
    request: new Request('http://localhost/api/divination/interpret'),
    readingId,
  }, deps)

  assert.equal(response.status, 409)
  assert.equal(calls.start, 0)
  assert.equal(calls.openAi, 0)
})

test('completed reading 直接回既有 interpretation，重新整理不重跑 OpenAI', async () => {
  const { deps, calls } = makeDeps({
    reading: makeReading({ status: 'completed', interpretation }),
  })
  const response = await resumePersistedDivinationReadingFromDb({
    request: new Request('http://localhost/api/divination/interpret'),
    readingId,
  }, deps)
  const json = await readJson(response)

  assert.equal(response.status, 200)
  assert.equal(calls.start, 0)
  assert.equal(calls.openAi, 0)
  assert.equal((json.interpretation as Record<string, unknown>).summary, interpretation.summary)
})

test('pending_payment reading 不可 interpret，也不要求建立第二筆付款', async () => {
  const { deps, calls } = makeDeps({ reading: makeReading({ status: 'pending_payment' }) })
  const response = await resumePersistedDivinationReadingFromDb({
    request: new Request('http://localhost/api/divination/interpret'),
    readingId,
  }, deps)
  const json = await readJson(response)

  assert.equal(response.status, 402)
  assert.equal(json.error, 'PAYMENT_PENDING')
  assert.equal(calls.openAi, 0)
})

test('非本人 reading 一律 404，不呼叫 OpenAI', async () => {
  const { deps, calls } = makeDeps({ reading: null })
  const response = await resumePersistedDivinationReadingFromDb({
    request: new Request('http://localhost/api/divination/interpret'),
    readingId,
  }, deps)

  assert.equal(response.status, 404)
  assert.equal(calls.openAi, 0)
})

test('resume request 不依賴 sessionStorage 或 client 重傳問題與牌卡', () => {
  const resumeSource = readFileSync(
    join(process.cwd(), 'src/app/api/divination/interpret/resume.ts'),
    'utf8',
  )
  const routeSource = readFileSync(
    join(process.cwd(), 'src/app/api/divination/interpret/route.ts'),
    'utf8',
  )

  assert.equal(resumeSource.includes('reading.question'), true)
  assert.equal(resumeSource.includes('reading.cardId'), true)
  assert.equal(resumeSource.includes('reading.position'), true)
  assert.equal(resumeSource.includes('reading.drawMode'), true)
  assert.equal(resumeSource.includes('deps.getPaymentById(reading.paymentId)'), true)
  assert.equal(resumeSource.includes('sessionStorage'), false)
  assert.equal(routeSource.includes('resumePersistedDivinationReadingFromDb'), true)
  assert.equal(routeSource.includes('createInterpretation: createOpenAiInterpretation'), true)
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
