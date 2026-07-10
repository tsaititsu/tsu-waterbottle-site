import assert from 'node:assert/strict'
import {
  handleGetAccountDivinationReading,
  isValidDivinationReadingId,
  type GetAccountDivinationReadingDeps,
} from '../handler'
import type { AccountDivinationReadingDetail } from '../../../../../lib/supabase/divinationReadings'

const tests: Array<{ name: string; fn: () => Promise<void> | void }> = []

function test(name: string, fn: () => Promise<void> | void) {
  tests.push({ name, fn })
}

const READING_ID = 'a2e3c86a-d6e2-424e-9a37-48cef981b3b1'
const OTHER_READING_ID = 'b7f4d97b-e7f3-535f-8b48-59d0a92c4c22'

function makeDetail(overrides: Partial<AccountDivinationReadingDetail> = {}): AccountDivinationReadingDetail {
  return {
    id: READING_ID,
    question: '工作方向？',
    cardName: '紫微星',
    position: 'upright',
    drawMode: 'manual',
    status: 'completed',
    createdAt: '2026-07-09T16:08:00.000Z',
    interpretedAt: '2026-07-09T16:10:00.000Z',
    hasInterpretation: true,
    resultSummary: null,
    interpretation: {
      summary: '整體穩定',
      cardMessage: '牌卡訊息',
      situationAnalysis: '目前狀態',
      advice: '建議',
      reminder: '提醒',
    },
    ...overrides,
  }
}

function makeDeps(overrides: Partial<GetAccountDivinationReadingDeps> = {}) {
  const getCalls: Array<{ readingId: string; userId: string }> = []

  const deps: GetAccountDivinationReadingDeps = {
    getUserIdFromRequest: async () => 'user-a',
    getReadingForUser: async (readingId, userId) => {
      getCalls.push({ readingId, userId })
      // 模擬 DB 端 id + user_id 同時過濾：只有 user-a 的 READING_ID 存在。
      if (readingId === READING_ID && userId === 'user-a') return makeDetail()
      return null
    },
    ...overrides,
  }

  return { deps, getCalls }
}

function makeRequest(id: string) {
  return new Request(`http://localhost/api/account/divination-readings/${id}`, { method: 'GET' })
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>
}

test('isValidDivinationReadingId 只接受 UUID', () => {
  assert.equal(isValidDivinationReadingId(READING_ID), true)
  assert.equal(isValidDivinationReadingId('abc'), false)
  assert.equal(isValidDivinationReadingId('../etc/passwd'), false)
  assert.equal(isValidDivinationReadingId(''), false)
  assert.equal(isValidDivinationReadingId(null), false)
})

test('未登入 detail 回 401 且不查資料', async () => {
  const { deps, getCalls } = makeDeps({ getUserIdFromRequest: async () => null })
  const response = await handleGetAccountDivinationReading(makeRequest(READING_ID), READING_ID, deps)

  assert.equal(response.status, 401)
  assert.equal(getCalls.length, 0)
})

test('非 UUID 的 id 直接 404，不觸碰資料庫', async () => {
  const { deps, getCalls } = makeDeps()
  const response = await handleGetAccountDivinationReading(makeRequest('abc'), 'abc', deps)

  assert.equal(response.status, 404)
  assert.equal(getCalls.length, 0)
})

test('本人可讀取 completed 解讀（含 interpretation）', async () => {
  const { deps, getCalls } = makeDeps()
  const response = await handleGetAccountDivinationReading(makeRequest(READING_ID), READING_ID, deps)
  const json = await readJson(response)

  assert.equal(response.status, 200)
  assert.equal(getCalls[0].userId, 'user-a')
  const reading = json.reading as Record<string, unknown>
  assert.equal(reading.id, READING_ID)
  assert.deepEqual((reading.interpretation as Record<string, unknown>).summary, '整體穩定')
})

test('讀取別人的 reading（或猜 id）一律 404，回應不洩漏存在與否', async () => {
  const { deps } = makeDeps()

  const otherId = await handleGetAccountDivinationReading(makeRequest(OTHER_READING_ID), OTHER_READING_ID, deps)
  assert.equal(otherId.status, 404)

  const otherUser = makeDeps({ getUserIdFromRequest: async () => 'user-b' })
  const asOtherUser = await handleGetAccountDivinationReading(makeRequest(READING_ID), READING_ID, otherUser.deps)
  assert.equal(asOtherUser.status, 404)

  const bodyA = JSON.stringify(await readJson(otherId))
  const bodyB = JSON.stringify(await asOtherUser.json())
  assert.equal(bodyA, bodyB)
})

test('pending_payment 不回傳 interpretation', async () => {
  const { deps } = makeDeps({
    getReadingForUser: async () =>
      makeDetail({ status: 'pending_payment', hasInterpretation: false, interpretation: null, interpretedAt: null }),
  })
  const response = await handleGetAccountDivinationReading(makeRequest(READING_ID), READING_ID, deps)
  const json = await readJson(response)

  assert.equal(response.status, 200)
  assert.equal((json.reading as Record<string, unknown>).interpretation, null)
})

test('回應不含 user_id / raw_payload / payment 資料 / key', async () => {
  const { deps } = makeDeps()
  const response = await handleGetAccountDivinationReading(makeRequest(READING_ID), READING_ID, deps)
  const serialized = JSON.stringify(await readJson(response))

  assert.equal(serialized.includes('user_id'), false)
  assert.equal(serialized.includes('raw_payload'), false)
  assert.equal(serialized.includes('merchant_order_no'), false)
  assert.equal(serialized.includes('payment_id'), false)
  assert.equal(serialized.includes('SUPABASE'), false)
  assert.equal(serialized.includes('OPENAI'), false)
})

test('查詢失敗回固定文案，不洩漏錯誤細節', async () => {
  const { deps } = makeDeps({
    getReadingForUser: async () => {
      throw new Error('secret sb_key_999')
    },
  })
  const response = await handleGetAccountDivinationReading(makeRequest(READING_ID), READING_ID, deps)
  const serialized = JSON.stringify(await readJson(response))

  assert.equal(response.status, 500)
  assert.equal(serialized.includes('sb_key_999'), false)
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
