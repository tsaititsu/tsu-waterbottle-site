import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  AI_CHART_PAYMENT_SESSION_DEFAULT_AMOUNT_TWD,
  clearAiChartPaymentSession,
  getAiChartPaymentSession,
  isAiChartPaymentSession,
  saveAiChartPaymentSession,
} from './paymentSession'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

function assertNoUnsafeKeys(payload: Record<string, unknown>) {
  assert.equal('TradeInfo' in payload, false)
  assert.equal('TradeSha' in payload, false)
  assert.equal('HashKey' in payload, false)
  assert.equal('HashIV' in payload, false)
  assert.equal('MerchantID' in payload, false)
  assert.equal('Version' in payload, false)
  assert.equal('creditCard' in payload, false)
  assert.equal('cardNumber' in payload, false)
  assert.equal('birthData' in payload, false)
  assert.equal('birthDate' in payload, false)
  assert.equal('birthTime' in payload, false)
  assert.equal('birthPlace' in payload, false)
  assert.equal('ziweiPayload' in payload, false)
  assert.equal('chartPayload' in payload, false)
  assert.equal('report_content' in payload, false)
  assert.equal('reportContent' in payload, false)
  assert.equal('prompt' in payload, false)
  assert.equal('openAiRequest' in payload, false)
  assert.equal('openAiResponse' in payload, false)
  assert.equal('paymentForm' in payload, false)
}

const reportId = '2df1a8da-3893-4b81-8d00-774a9cc0e472'
const merchantOrderNo = 'WB20260706172000AICH'

test('saveAiChartPaymentSession keeps reportId in memory with the default amount and fixed source', () => {
  clearAiChartPaymentSession()
  const session = saveAiChartPaymentSession({ reportId })
  const saved = getAiChartPaymentSession()

  assert.equal(session.reportId, reportId)
  assert.equal(session.amountTwd, AI_CHART_PAYMENT_SESSION_DEFAULT_AMOUNT_TWD)
  assert.equal(session.source, 'ai_chart_report')
  assert.equal(saved?.reportId, reportId)
  assert.equal(saved?.amountTwd, 100)
  assert.equal(saved?.source, 'ai_chart_report')
  assert.equal(typeof saved?.createdAt, 'string')
  assert.equal(Number.isNaN(Date.parse(saved?.createdAt ?? '')), false)
})

test('saveAiChartPaymentSession can store merchantOrderNo and returnPath', () => {
  const session = saveAiChartPaymentSession({
    reportId,
    merchantOrderNo,
    returnPath: '/ai-chart/result',
  })

  assert.equal(session.merchantOrderNo, merchantOrderNo)
  assert.equal(session.returnPath, '/ai-chart/result')
  assert.equal(getAiChartPaymentSession()?.merchantOrderNo, merchantOrderNo)
  assert.equal(getAiChartPaymentSession()?.returnPath, '/ai-chart/result')
})

test('saveAiChartPaymentSession rejects invalid reportId', () => {
  assert.throws(
    () =>
      saveAiChartPaymentSession({
        reportId: 'not-a-uuid',
      }),
    /invalid_ai_chart_report_id/,
  )
})

test('saveAiChartPaymentSession does not retain unsafe extra fields', () => {
  saveAiChartPaymentSession({
    reportId,
    merchantOrderNo,
    TradeInfo: 'unsafe-trade-info',
    TradeSha: 'unsafe-trade-sha',
    HashKey: 'unsafe-hash-key',
    HashIV: 'unsafe-hash-iv',
    MerchantID: 'MS123456789',
    Version: '2.3',
    birthData: { name: 'unsafe' },
    chartPayload: { unsafe: true },
    reportContent: 'unsafe report content',
  } as Parameters<typeof saveAiChartPaymentSession>[0] & Record<string, unknown>)

  assertNoUnsafeKeys(getAiChartPaymentSession() as unknown as Record<string, unknown>)
})

test('getAiChartPaymentSession returns null when no session exists', () => {
  clearAiChartPaymentSession()
  assert.equal(getAiChartPaymentSession(), null)
})

test('getAiChartPaymentSession returns a defensive copy of a valid session', () => {
  const saved = saveAiChartPaymentSession({
    reportId,
    merchantOrderNo,
    returnPath: '/ai-chart/result',
  })

  assert.deepEqual(getAiChartPaymentSession(), saved)
  assert.equal(isAiChartPaymentSession(saved), true)
  saved.reportId = '00000000-0000-4000-8000-000000000000'
  assert.equal(getAiChartPaymentSession()?.reportId, reportId)
})

test('isAiChartPaymentSession rejects unsafe or malformed sessions', () => {
  assert.equal(
    isAiChartPaymentSession({
      reportId,
      amountTwd: 100,
      source: 'ai_chart_report',
      createdAt: 'not-a-date',
    }),
    false,
  )
  assert.equal(
    isAiChartPaymentSession({
      reportId: 'not-a-uuid',
      amountTwd: 100,
      source: 'ai_chart_report',
      createdAt: new Date().toISOString(),
    }),
    false,
  )
})

test('clearAiChartPaymentSession clears the in-memory payment handoff only', () => {
  saveAiChartPaymentSession({ reportId })
  clearAiChartPaymentSession()
  assert.equal(getAiChartPaymentSession(), null)
})

const source = readFileSync(join(process.cwd(), 'src/lib/ai-chart/paymentSession.ts'), 'utf8')
assert.doesNotMatch(source, /localStorage|sessionStorage/)
