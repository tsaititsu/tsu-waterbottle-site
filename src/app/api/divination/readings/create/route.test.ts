import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// 22J-39 source-level 檢查：
// 占卜紀錄會員歸戶熱修不可破壞既有 flag 行為、paid gate 與 OpenAI 隔離。

const tests: Array<{ name: string; fn: () => void }> = []

function test(name: string, fn: () => void) {
  tests.push({ name, fn })
}

const projectRoot = process.cwd()
const createRouteSource = readFileSync(
  join(projectRoot, 'src/app/api/divination/readings/create/route.ts'),
  'utf8',
)
const interpretRouteSource = readFileSync(
  join(projectRoot, 'src/app/api/divination/interpret/route.ts'),
  'utf8',
)
const interpretResumeSource = readFileSync(
  join(projectRoot, 'src/app/api/divination/interpret/resume.ts'),
  'utf8',
)
const localPreviewSource = readFileSync(
  join(projectRoot, 'src/components/divination/DivinationLocalPreview.tsx'),
  'utf8',
)

test('create route derives user id from the auth token and passes it to the insert helper', () => {
  assert.equal(createRouteSource.includes('getUserIdFromRequest'), true)
  assert.equal(createRouteSource.includes('userId: authenticatedUserId'), true)
})

test('create route persistence is still gated by ENABLE_DIVINATION_DB_READINGS', () => {
  assert.equal(createRouteSource.includes('ENABLE_DIVINATION_DB_READINGS'), true)
  assert.equal(createRouteSource.includes('shouldPersistDivinationReading()'), true)

  const persistGateIndex = createRouteSource.indexOf('if (shouldPersistDivinationReading())')
  const userIdResolveIndex = createRouteSource.indexOf('getUserIdFromRequest(request)')
  assert.equal(persistGateIndex >= 0, true)
  assert.equal(
    userIdResolveIndex > persistGateIndex,
    true,
    'user id 只在 DB 持久化路徑內解析，flag=false 時行為與現況一致',
  )
})

test('create route keeps the anonymous localUserId flow', () => {
  assert.equal(createRouteSource.includes('localUserId'), true)
})

test('create route never talks to OpenAI and never references the OpenAI key', () => {
  assert.equal(createRouteSource.includes('api.openai.com'), false)
  assert.equal(createRouteSource.includes('OPENAI_API_KEY'), false)
  assert.equal(createRouteSource.includes("from '@/lib/openai"), false)
  assert.equal(createRouteSource.includes('from "@/lib/openai'), false)
})

test('interpret route paid gate is untouched by this hotfix', () => {
  assert.equal(interpretRouteSource.includes('isPersistedDivinationReadingsEnabled()'), true)
  assert.equal(interpretRouteSource.includes('reserveLocalDivinationEntitlement'), true)
  assert.equal(interpretRouteSource.includes('paymentRequiredResponse'), true)
  assert.equal(interpretRouteSource.includes('decideDivinationInterpretationStart'), true)
})

test('interpret route does not write user_id (ownership is set at create time only)', () => {
  const interpretSources = `${interpretRouteSource}\n${interpretResumeSource}`
  assert.equal(interpretSources.includes('getUserIdFromRequest'), true)
  assert.equal(interpretSources.includes('userId:'), false)
  assert.equal(interpretSources.includes('user_id:'), false)
  assert.equal(interpretSources.includes("user_id':"), false)
})

test('divination client sends the auth token when logged in and stays anonymous otherwise', () => {
  assert.equal(localPreviewSource.includes('getAuthAccessToken'), true)
  assert.equal(localPreviewSource.includes('Authorization: `Bearer ${accessToken}`'), true)
  assert.equal(localPreviewSource.includes('getLocalUserId'), true)
  assert.equal(localPreviewSource.includes('localStorage'), false)
  assert.equal(localPreviewSource.includes('sessionStorage'), false)
})

test('follow-up context is included in the safety check before a reading can be persisted', () => {
  assert.equal(
    createRouteSource.includes('buildFollowUpSafetyCheckText(question, body.followUpContext)'),
    true,
  )
  assert.equal(createRouteSource.includes('runPreOpenAISafetyCheck(safetyCheckText)'), true)
  assert.equal(localPreviewSource.includes('followUpContext: input.followUpContext'), true)

  const safetyCheckIndex = createRouteSource.indexOf('runPreOpenAISafetyCheck(safetyCheckText)')
  const persistIndex = createRouteSource.indexOf('createPendingDivinationReading({')
  assert.equal(safetyCheckIndex >= 0, true)
  assert.equal(persistIndex > safetyCheckIndex, true, '必須先完成完整脈絡安全判題，再建立收費紀錄')
})

function runTests() {
  for (const { name, fn } of tests) {
    try {
      fn()
      console.log(`✓ ${name}`)
    } catch (error) {
      console.error(`✗ ${name}`)
      throw error
    }
  }
}

runTests()
