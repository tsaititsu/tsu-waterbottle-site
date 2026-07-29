import assert from 'node:assert/strict'
import { generateAiChartReportContent, type AiChartReportGenerationInput } from './reportGenerator'
import {
  AI_CHART_D1_REPORT_WRITER_RUNTIME_NOT_READY,
  AiChartD1ReportWriterRuntimeNotReadyError,
} from './reportGenerationPipeline'
import { createAiChartD1FlyingModelInputTestSnapshot } from './d1FlyingModelInputTestSupport'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

function assertNoUnsafeOutput(content: string) {
  assert.equal(content.includes('TradeInfo'), false)
  assert.equal(content.includes('TradeSha'), false)
  assert.equal(content.includes('HashKey'), false)
  assert.equal(content.includes('HashIV'), false)
  assert.equal(content.includes('payment_id'), false)
  assert.equal(content.includes('paymentId'), false)
  assert.equal(content.includes('merchant_order_no'), false)
  assert.equal(content.includes('merchantOrderNo'), false)
  assert.equal(content.includes('credit card'), false)
  assert.equal(content.includes('信用卡'), false)
  assert.equal(content.includes('raw_payload'), false)
  assert.equal(content.includes('raw payload'), false)
  assert.equal(content.includes('OpenAI prompt'), false)
  assert.equal(content.includes('OpenAI request'), false)
  assert.equal(content.includes('OpenAI response'), false)
}

const completeInput: AiChartReportGenerationInput = {
  name: '測試使用者',
  gender: '女',
  solarDate: '1990-01-02',
  birthTime: '辰時',
  birthPlace: '台北',
  chartSummary: {
    mainStar: '紫微',
    bodyPalace: '財帛宮',
    lifePalace: '命宮',
    notes: ['適合先建立穩定節奏', '近期可聚焦職涯整理'],
  },
}

const expectedHeadings = [
  '## 1. 標題',
  '## 2. 基本資料摘要',
  '## 3. 命盤重點',
  '## 4. 個性與行動模式',
  '## 5. 工作與發展方向',
  '## 6. 感情與人際提醒',
  '## 7. 近期建議',
  '## 8. 結語',
]

test('generateAiChartReportContent returns non-empty content for complete input', () => {
  const content = generateAiChartReportContent(completeInput)

  assert.equal(typeof content, 'string')
  assert.equal(content.trim().length > 0, true)
  assert.equal(content.includes('測試使用者'), true)
  assert.equal(content.includes('紫微'), true)
  assert.equal(content.includes('AI 版初步分析'), true)
})

test('generateAiChartReportContent includes the eight required section headings', () => {
  const content = generateAiChartReportContent(completeInput)

  for (const heading of expectedHeadings) {
    assert.equal(content.includes(heading), true)
  }
})

test('generateAiChartReportContent does not throw when data is missing', () => {
  assert.doesNotThrow(() => generateAiChartReportContent({}))
})

test('generateAiChartReportContent uses conservative copy when data is missing', () => {
  const content = generateAiChartReportContent({})

  assert.equal(content.includes('未提供'), true)
  assert.equal(content.includes('資料不足，建議補充出生資訊後重新分析'), true)
  assert.equal(content.includes('AI 版初步分析'), true)
})

test('generateAiChartReportContent includes notes in the report body', () => {
  const content = generateAiChartReportContent(completeInput)

  assert.equal(content.includes('補充觀察：適合先建立穩定節奏'), true)
  assert.equal(content.includes('近期可聚焦職涯整理'), true)
})

test('generateAiChartReportContent redacts unsafe payment and OpenAI terms from input', () => {
  const content = generateAiChartReportContent({
    name: 'TradeInfo',
    gender: 'HashKey',
    solarDate: 'payment_id',
    birthTime: 'merchant_order_no',
    birthPlace: 'OpenAI prompt',
    chartSummary: {
      mainStar: 'TradeSha',
      bodyPalace: 'HashIV',
      lifePalace: 'credit card',
      notes: ['OpenAI request', 'OpenAI response', 'raw_payload', 'merchantOrderNo'],
    },
  })

  assertNoUnsafeOutput(content)
})

test('generateAiChartReportContent does not touch Supabase or NewebPay state', () => {
  const beforeSupabase = Reflect.has(globalThis, 'supabase')
  const beforeNewebPay = Reflect.has(globalThis, 'newebpay')

  generateAiChartReportContent(completeInput)

  assert.equal(Reflect.has(globalThis, 'supabase'), beforeSupabase)
  assert.equal(Reflect.has(globalThis, 'newebpay'), beforeNewebPay)
})

test('generateAiChartReportContent routes chart snapshots into D1 pipeline and fails closed', () => {
  assert.throws(
    () =>
      generateAiChartReportContent({
        reportId: 'report-generator-1',
        chartSnapshot: createAiChartD1FlyingModelInputTestSnapshot(),
      }),
    (error: unknown) => {
      assert.equal(error instanceof AiChartD1ReportWriterRuntimeNotReadyError, true)
      assert.equal(
        (error as AiChartD1ReportWriterRuntimeNotReadyError).code,
        AI_CHART_D1_REPORT_WRITER_RUNTIME_NOT_READY,
      )
      assert.equal(String(error).includes('output_text'), false)
      assert.equal(String(error).includes('OpenAI request'), false)
      return true
    },
  )
})
