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

test('missing OpenAI server configuration returns generic maintenance copy', () => {
  const source = readSource('src/app/api/divination/interpret/route.ts')

  assert.equal(source.includes('AI 解讀服務暫時維護中，請稍後再試。'), true)
  assert.equal(source.includes('付款已完成，但 AI 解讀暫時無法產生，請聯繫客服。'), true)
  assert.equal(source.includes('OPENAI_API_KEY_MISSING'), true)
})

test('divination model helper remains gpt-5.5 and paid gate imports remain', () => {
  const modelSource = readSource('src/lib/openai/divinationModel.ts')
  const routeSource = readSource('src/app/api/divination/interpret/route.ts')

  assert.equal(modelSource.includes('gpt-5.5'), true)
  assert.equal(routeSource.includes('getDivinationOpenAIModel(process.env)'), true)
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
