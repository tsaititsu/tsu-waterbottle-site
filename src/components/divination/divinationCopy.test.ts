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
  'src/lib/divination/pricing.ts',
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

  assert.equal(text.includes('DIVINATION_READING_PRICE_TWD = 200'), true)
  assert.equal(text.includes('DIVINATION_READING_PRICE_LABEL'), true)
  assert.equal(text.includes('NT$50'), false)
  assert.equal(text.includes('支付 NT$${paymentRequired.amountTwd} 開始解讀（'), false)
})

test('divination entry uses current production copy instead of legacy availability wording', () => {
  const text = readDivinationText()

  assert.equal(text.includes('後續開放'), false)
  assert.equal(text.includes('保留在獨立系統'), false)
  assert.equal(text.includes('DIVINATION_READING_PRICE_LABEL'), true)
})

test('automatic draw starts before payment and never prepays from the question form', () => {
  const source = readSource('src/components/divination/DivinationQuestionForm.tsx')

  assert.equal(source.includes("handlePreviewDraw('auto')"), true)
  assert.equal(source.includes('mockPaid'), false)
  assert.equal(source.includes('自動抽牌會在付款後'), false)
  assert.equal(source.includes('支付 {DIVINATION_READING_PRICE_LABEL} 開始解讀'), false)
})

test('manual and automatic payment require the AI divination consent after a card is drawn', () => {
  const source = readSource('src/components/divination/DivinationDrawPreview.tsx')
  const consentUsages = source.match(/<DivinationConsentNotice/g) ?? []
  const checkoutStart = source.indexOf('async function handleNewebPayDivinationCheckout')
  const checkoutEnd = source.indexOf('\n  async function confirmCard', checkoutStart)
  const checkoutSource = source.slice(checkoutStart, checkoutEnd)
  const mockPaymentStart = source.indexOf('async function handleMockPaidInterpret')
  const mockPaymentEnd = source.indexOf('\n  function returnToDivinationStart', mockPaymentStart)
  const mockPaymentSource = source.slice(mockPaymentStart, mockPaymentEnd)

  assert.equal(consentUsages.length, 2)
  assert.equal(source.includes('AI 占卜解讀同意確認'), true)
  assert.equal(source.includes('紫微牌卡 AI 解讀｜'), true)
  assert.equal(source.includes('《AI 占卜解讀服務說明》、《付款與退款規則》及《服務條款》'), true)
  assert.equal(source.includes('此服務為付款後產生占卜解讀結果之數位內容服務'), true)
  assert.equal(source.includes('正式網站目前作為占卜入口與流程展示'), false)
  assert.equal(source.includes('目前正式網站僅作為占卜入口與流程展示'), false)
  assert.equal(checkoutSource.includes('if (!hasAcceptedTerms)'), true)
  assert.equal(mockPaymentSource.includes('if (!hasAcceptedTerms)'), true)
})

test('automatic draw never carries an advance-payment bypass into the draw page', () => {
  const flowSource = [
    'src/components/divination/DivinationLocalPreview.tsx',
    'src/components/divination/DivinationDrawStepPage.tsx',
    'src/components/divination/DivinationDrawPreview.tsx',
    'src/lib/divination/readingSessionMemory.ts',
  ].map((path) => readSource(path)).join('\n')

  assert.equal(flowSource.includes('autoMockPaid'), false)
})

test('automatic draw reveals the drawn card before showing payment', () => {
  const source = readSource('src/components/divination/DivinationDrawPreview.tsx')
  const autoPaymentStart = source.indexOf(
    'isAutoMode && pendingCard && pendingPosition && !hasResultPreview && paymentRequired',
  )
  const autoPaymentEnd = source.indexOf('\n          {confirmedCard && confirmedPosition', autoPaymentStart)
  const autoPaymentSource = source.slice(autoPaymentStart, autoPaymentEnd)

  assert.equal(autoPaymentSource.includes('已為你抽出這張牌'), true)
  assert.equal(autoPaymentSource.includes('pendingCardImage'), true)
  assert.equal(autoPaymentSource.includes('alt={pendingCard.name}'), true)
  assert.equal(autoPaymentSource.includes('positionLabels[pendingPosition]'), true)
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
