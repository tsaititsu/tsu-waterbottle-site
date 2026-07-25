import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  getAiChartDraftNotes,
  getAiChartDraftSession,
  getAiChartDraftWorkspace,
  setAiChartDraftNotes,
  setAiChartDraftSession,
  setAiChartDraftWorkspace,
} from '@/lib/ai-chart/chartDraftMemory'
import {
  getAiChartPaymentSession,
  saveAiChartPaymentSession,
} from '@/lib/ai-chart/paymentSession'
import {
  getDivinationReadingSession,
  getOrCreateDivinationLocalUserId,
  setDivinationReadingSession,
} from '@/lib/divination/readingSessionMemory'
import {
  buildDivinationFollowUpDraft,
  loadDivinationFollowUpDisplayThread,
  loadDivinationFollowUpDraft,
  saveDivinationFollowUpDisplayReading,
  saveDivinationFollowUpDraft,
} from '@/lib/divination/followUpStorage'
import { clearSensitiveBrowserMemory } from './sensitiveBrowserMemory'

setAiChartDraftSession({
  input: {
    name: '會員甲',
    solarDate: '1990-01-01',
    timeIndex: 1,
    gender: 'male',
  },
  chartId: 'chart-a',
  selectedCategory: '自己',
})
setAiChartDraftNotes({ 'chart-a': '私人命盤筆記' })
setAiChartDraftWorkspace({
  categories: ['自己'],
  selectedCategory: '自己',
  selectedChartId: 'chart-a',
  charts: {
    自己: [{
      id: 'chart-a',
      input: {
        name: '會員甲',
        solarDate: '1990-01-01',
        timeIndex: 1,
        gender: 'male',
      },
    }],
  },
})
saveAiChartPaymentSession({
  reportId: '123e4567-e89b-42d3-a456-426614174000',
  merchantOrderNo: 'ORDER-A',
})
const localUserId = getOrCreateDivinationLocalUserId()
setDivinationReadingSession({
  readingId: 'reading-a',
  question: '會員甲的私人問題',
  drawMode: 'manual',
  localUserId,
  persisted: false,
})
const followUpDraft = buildDivinationFollowUpDraft({
  readingId: 'reading-a',
  question: '會員甲的私人問題',
  finalAnswer: '會員甲的私人解讀',
})
assert.ok(followUpDraft)
saveDivinationFollowUpDraft(followUpDraft)
saveDivinationFollowUpDisplayReading({
  readingId: 'reading-a',
  question: '會員甲的私人問題',
  finalAnswer: '會員甲的私人解讀',
})

clearSensitiveBrowserMemory()

assert.equal(getAiChartDraftSession(), null)
assert.deepEqual(getAiChartDraftNotes(), {})
assert.deepEqual(getAiChartDraftWorkspace(), {
  categories: ['自己'],
  selectedCategory: '自己',
  charts: {},
})
assert.equal(getAiChartPaymentSession(), null)
assert.equal(getDivinationReadingSession(), null)
assert.notEqual(getOrCreateDivinationLocalUserId(), localUserId)
assert.equal(loadDivinationFollowUpDraft(), null)
assert.equal(loadDivinationFollowUpDisplayThread(), null)

const authSource = readFileSync(join(process.cwd(), 'src/lib/mockAuth.ts'), 'utf8')
assert.match(
  authSource,
  /import \{ clearSensitiveBrowserMemory \} from ['"]\.\/security\/sensitiveBrowserMemory['"]/,
)
assert.match(authSource, /function updateCachedUser\(/)
assert.match(
  authSource,
  /if \(previousUserId !== nextUserId\) \{\s*clearSensitiveBrowserMemory\(\)\s*\}/,
)
assert.match(
  authSource,
  /export function logoutMockUser\(\) \{[\s\S]*clearSensitiveBrowserMemory\(\)/,
)

console.log('sensitive browser memory auth-boundary contract passed')
