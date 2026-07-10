import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { handleListAccountDivinationReadings, type ListAccountDivinationReadingsDeps } from './handler'
import {
  normalizeAccountDivinationListLimit,
  type AccountDivinationReadingListItem,
} from '../../../../lib/supabase/divinationReadings'

const tests: Array<{ name: string; fn: () => Promise<void> | void }> = []

function test(name: string, fn: () => Promise<void> | void) {
  tests.push({ name, fn })
}

function makeItem(overrides: Partial<AccountDivinationReadingListItem> = {}): AccountDivinationReadingListItem {
  return {
    id: 'a2e3c86a-d6e2-424e-9a37-48cef981b3b1',
    question: '工作方向？',
    cardName: '紫微星',
    position: 'upright',
    drawMode: 'manual',
    status: 'completed',
    createdAt: '2026-07-09T16:08:00.000Z',
    interpretedAt: '2026-07-09T16:10:00.000Z',
    hasInterpretation: true,
    resultSummary: null,
    ...overrides,
  }
}

function makeDeps(overrides: Partial<ListAccountDivinationReadingsDeps> = {}) {
  const listCalls: Array<{ userId: string; limit: unknown; effectiveLimit: number }> = []

  const deps: ListAccountDivinationReadingsDeps = {
    getUserIdFromRequest: async () => 'user-a',
    listReadingsForUser: async (userId, options) => {
      listCalls.push({
        userId,
        limit: options.limit,
        effectiveLimit: normalizeAccountDivinationListLimit(options.limit),
      })
      return [makeItem()]
    },
    ...overrides,
  }

  return { deps, listCalls }
}

function makeRequest(query = '') {
  return new Request(`http://localhost/api/account/divination-readings${query}`, { method: 'GET' })
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>
}

// --- API 行為 ---

test('未登入 list 回 401 且不查資料', async () => {
  const { deps, listCalls } = makeDeps({ getUserIdFromRequest: async () => null })
  const response = await handleListAccountDivinationReadings(makeRequest(), deps)

  assert.equal(response.status, 401)
  assert.equal(listCalls.length, 0)
})

test('登入者只會查到自己的 readings（userId 由 token 推導）', async () => {
  const { deps, listCalls } = makeDeps()
  const response = await handleListAccountDivinationReadings(makeRequest(), deps)

  assert.equal(response.status, 200)
  assert.equal(listCalls.length, 1)
  assert.equal(listCalls[0].userId, 'user-a')
})

test('client 傳 userId / email 參數不會改變查詢對象', async () => {
  const { deps, listCalls } = makeDeps()
  const response = await handleListAccountDivinationReadings(
    makeRequest('?userId=user-b&email=attacker%40example.com&limit=5'),
    deps,
  )

  assert.equal(response.status, 200)
  assert.equal(listCalls[0].userId, 'user-a')
  assert.equal(listCalls[0].limit, '5')
})

test('list 預設 20 筆、limit 上限 50', async () => {
  const { deps, listCalls } = makeDeps()
  await handleListAccountDivinationReadings(makeRequest(), deps)
  await handleListAccountDivinationReadings(makeRequest('?limit=999'), deps)

  assert.equal(listCalls[0].effectiveLimit, 20)
  assert.equal(listCalls[1].effectiveLimit, 50)
})

test('list 回傳不含 interpretation / user_id / raw_payload', async () => {
  const { deps } = makeDeps()
  const response = await handleListAccountDivinationReadings(makeRequest(), deps)
  const serialized = JSON.stringify(await readJson(response))

  assert.equal(serialized.includes('interpretation'), false)
  assert.equal(serialized.includes('user_id'), false)
  assert.equal(serialized.includes('raw_payload'), false)
  assert.equal(serialized.includes('merchant_order_no'), false)
})

test('查詢失敗回固定文案，不洩漏 key / env / stack', async () => {
  const { deps } = makeDeps({
    listReadingsForUser: async () => {
      throw new Error('supabase key sb_secret_12345 failed')
    },
  })
  const response = await handleListAccountDivinationReadings(makeRequest(), deps)
  const serialized = JSON.stringify(await readJson(response))

  assert.equal(response.status, 500)
  assert.equal(serialized.includes('sb_secret_12345'), false)
  assert.equal(serialized.includes('stack'), false)
  assert.equal(serialized.includes('SUPABASE'), false)
})

// --- source-level 檢查（頁面與回歸）---

const projectRoot = process.cwd()

test('handler 只讀 limit 參數，不讀 userId / email', () => {
  const source = readFileSync(
    join(projectRoot, 'src/app/api/account/divination-readings/handler.ts'),
    'utf8',
  )
  assert.equal(source.includes("searchParams.get('limit')"), true)
  assert.equal(source.includes("searchParams.get('userId')"), false)
  assert.equal(source.includes("searchParams.get('email')"), false)
})

test('/account 有「我的占卜紀錄」入口', () => {
  const source = readFileSync(join(projectRoot, 'src/app/account/page.tsx'), 'utf8')
  assert.equal(source.includes('我的占卜紀錄'), true)
  assert.equal(source.includes('/account/divinations'), true)
  assert.equal(source.includes('查看已完成的紫微牌卡解讀。'), true)
})

test('列表頁狀態與空資料文案正確，且不觸碰 OpenAI', () => {
  const source = readFileSync(join(projectRoot, 'src/app/account/divinations/page.tsx'), 'utf8')
  assert.equal(source.includes('目前還沒有占卜紀錄。'), true)
  assert.equal(source.includes('前往紫微牌卡占卜'), true)
  assert.equal(source.includes('查看解讀'), true)
  assert.equal(source.includes('尚未完成付款。'), true)
  assert.equal(source.includes('解讀暫時未完成，請聯繫客服協助。'), true)
  assert.equal(source.includes('待付款'), true)
  assert.equal(source.includes('formatTaipeiDateTime'), true)
  assert.equal(source.includes('dangerouslySetInnerHTML'), false)
  assert.equal(source.includes('api.openai.com'), false)
  assert.equal(source.includes('/api/divination/interpret'), false)
  // completed 才顯示查看解讀；pending_payment 不提供重新付款
  assert.equal(source.includes("reading.status === 'completed'"), true)
  assert.equal(source.includes('重新付款'), false)
})

test('單筆頁以純文字渲染 interpretation，顯示台北時間', () => {
  const source = readFileSync(join(projectRoot, 'src/app/account/divinations/[id]/page.tsx'), 'utf8')
  assert.equal(source.includes('dangerouslySetInnerHTML'), false)
  assert.equal(source.includes('whitespace-pre-line'), true)
  assert.equal(source.includes('formatTaipeiDateTime'), true)
  assert.equal(source.includes('返回我的占卜紀錄'), true)
  assert.equal(source.includes('api.openai.com'), false)
  assert.equal(source.includes('/api/divination/interpret'), false)
})

test('回歸：抽牌 create route 仍寫入 user_id、paid gate 未動', () => {
  const createSource = readFileSync(
    join(projectRoot, 'src/app/api/divination/readings/create/route.ts'),
    'utf8',
  )
  assert.equal(createSource.includes('userId: authenticatedUserId'), true)

  const interpretSource = readFileSync(
    join(projectRoot, 'src/app/api/divination/interpret/route.ts'),
    'utf8',
  )
  assert.equal(interpretSource.includes('paymentRequiredResponse'), true)
  assert.equal(interpretSource.includes('decideDivinationInterpretationStart'), true)
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
