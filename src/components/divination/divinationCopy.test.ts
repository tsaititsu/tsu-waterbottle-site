import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const tests: Array<{ name: string; fn: () => void }> = []

function test(name: string, fn: () => void) {
  tests.push({ name, fn })
}

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

const divinationSources = [
  'src/app/ai-divination/page.tsx',
  'src/components/divination/DivinationLocalPreview.tsx',
  'src/components/divination/DivinationDrawPreview.tsx',
  'src/components/divination/DivinationQuestionForm.tsx',
  'src/app/api/divination/interpret/route.ts',
]

function readDivinationText() {
  return divinationSources.map((path) => readSource(path)).join('\n')
}

test('divination user-facing source does not expose local test or OpenAI key copy', () => {
  const text = readDivinationText()

  for (const forbidden of [
    '本機測試',
    'OpenAI API Key',
    '尚未設定 OpenAI',
    'API key missing',
    'local test',
    'server config',
    'env 未設定',
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden)
  }
})

test('divination payment button copy uses production wording', () => {
  const text = readDivinationText()

  assert.equal(text.includes('支付 NT$50 開始解讀'), true)
  assert.equal(text.includes('支付 NT$50 開始解讀（'), false)
  assert.equal(text.includes('支付 NT$${paymentRequired.amountTwd} 開始解讀（'), false)
})

test('divination entry uses current production copy instead of legacy availability wording', () => {
  const text = readDivinationText()

  assert.equal(text.includes('後續開放'), false)
  assert.equal(text.includes('保留在獨立系統'), false)
  assert.equal(text.includes('AI 解讀每次 NT$50'), true)
  assert.equal(text.includes('開始 AI 解讀時每次 NT$50'), true)
})

test('missing OpenAI server configuration returns generic maintenance copy', () => {
  const source = readSource('src/app/api/divination/interpret/route.ts')

  assert.equal(source.includes('AI 解讀服務暫時維護中，請稍後再試。'), true)
  assert.equal(source.includes('付款已完成，但 AI 解讀暫時無法產生，請聯繫客服。'), true)
  assert.equal(source.includes('OPENAI_API_KEY_MISSING'), true)
})

test('divination model helper uses Terra and paid gate imports remain', () => {
  const modelSource = readSource('src/lib/openai/divinationModel.ts')
  const routeSource = readSource('src/app/api/divination/interpret/route.ts')
  const engineSource = readSource('src/lib/divination/ziweiCardReadingEngine.ts')

  assert.equal(modelSource.includes('gpt-5.6-terra'), true)
  assert.equal(modelSource.includes('max'), true)
  assert.equal(routeSource.includes('generateZiweiCardReading'), true)
  assert.equal(engineSource.includes('getDivinationOpenAIModel(process.env)'), true)
  assert.equal(engineSource.includes('getDivinationReasoningEffort()'), true)
  assert.equal(routeSource.includes('decideDivinationInterpretationStart'), true)
  assert.equal(routeSource.includes('paymentRequiredResponse'), true)
})

for (const { name, fn } of tests) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}
