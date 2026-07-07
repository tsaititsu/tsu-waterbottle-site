import assert from 'node:assert/strict'
import { handleReadAiChartReportRequest } from './handler'
import type {
  AiChartReportPaymentStatus,
  AiChartReportResultContext,
} from '../../../../../lib/supabase/aiChartReports'

const tests: Array<{ name: string; fn: () => Promise<void> }> = []
const VALID_REPORT_ID = '2df1a8da-3893-4b81-8d00-774a9cc0e472'

function test(name: string, fn: () => Promise<void>) {
  tests.push({ name, fn })
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>
}

function params(reportId?: string) {
  const searchParams = new URLSearchParams()
  if (reportId !== undefined) {
    searchParams.set('reportId', reportId)
  }

  return searchParams
}

function createReport(
  paymentStatus: AiChartReportPaymentStatus | null,
  reportContent: string | null,
): AiChartReportResultContext {
  return {
    id: VALID_REPORT_ID,
    title: 'AI 命盤分析',
    productName: 'AI 命盤分析',
    amountTwd: 100,
    status: 'pending',
    paymentStatus,
    reportContent,
    paidAt: paymentStatus === 'paid' ? '2026-07-07T10:00:00.000Z' : null,
    completedAt: reportContent ? '2026-07-07T10:05:00.000Z' : null,
    errorMessage: null,
  }
}

function assertNoUnsafeResponseKeys(value: unknown) {
  const unsafeKeys = new Set([
    'user_id',
    'userId',
    'chart_profile_id',
    'chartProfileId',
    'payment_id',
    'paymentId',
    'merchant_order_no',
    'merchantOrderNo',
    'TradeInfo',
    'TradeSha',
    'HashKey',
    'HashIV',
    'creditCard',
    'cardNumber',
    'birthData',
    'birthDate',
    'birthTime',
    'birthPlace',
    'ziwei_payload',
    'ziweiPayload',
    'chartPayload',
    'raw_payload',
    'rawPayload',
  ])

  if (!value || typeof value !== 'object') {
    return
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    assert.equal(unsafeKeys.has(key), false, `unsafe response key: ${key}`)
    assertNoUnsafeResponseKeys(nestedValue)
  }
}

test('missing reportId is rejected', async () => {
  let called = false
  const response = await handleReadAiChartReportRequest(params(), {
    getAiChartReportResultById: async () => {
      called = true
      return null
    },
  })
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, {
    ok: false,
    error: 'ai_chart_report_id_required',
  })
  assert.equal(called, false)
  assertNoUnsafeResponseKeys(json)
})

test('invalid reportId is rejected', async () => {
  let called = false
  const response = await handleReadAiChartReportRequest(params('not-a-uuid'), {
    getAiChartReportResultById: async () => {
      called = true
      return null
    },
  })
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, {
    ok: false,
    error: 'invalid_ai_chart_report_id',
  })
  assert.equal(called, false)
  assertNoUnsafeResponseKeys(json)
})

test('not found report returns 404', async () => {
  const response = await handleReadAiChartReportRequest(params(VALID_REPORT_ID), {
    getAiChartReportResultById: async (reportId) => {
      assert.equal(reportId, VALID_REPORT_ID)
      return null
    },
  })
  const json = await readJson(response)

  assert.equal(response.status, 404)
  assert.deepEqual(json, {
    ok: false,
    error: 'ai_chart_report_not_found',
  })
  assertNoUnsafeResponseKeys(json)
})

test('pending report returns payment required', async () => {
  const response = await handleReadAiChartReportRequest(params(VALID_REPORT_ID), {
    getAiChartReportResultById: async () => createReport('pending', null),
  })
  const json = await readJson(response)

  assert.equal(response.status, 402)
  assert.deepEqual(json, {
    ok: false,
    error: 'PAYMENT_REQUIRED',
    requiresPayment: true,
    amountTwd: 100,
  })
  assertNoUnsafeResponseKeys(json)
})

test('paid report without content returns paid missing content', async () => {
  const response = await handleReadAiChartReportRequest(params(VALID_REPORT_ID), {
    getAiChartReportResultById: async () => createReport('paid', null),
  })
  const json = await readJson(response)

  assert.equal(response.status, 200)
  assert.deepEqual(json, {
    ok: true,
    status: 'paid_missing_content',
    message: '付款已完成，分析內容準備中。',
    report: {
      id: VALID_REPORT_ID,
      title: 'AI 命盤分析',
      productName: 'AI 命盤分析',
      amountTwd: 100,
      paymentStatus: 'paid',
      paidAt: '2026-07-07T10:00:00.000Z',
    },
  })
  assertNoUnsafeResponseKeys(json)
})

test('ready report returns report content', async () => {
  const response = await handleReadAiChartReportRequest(params(VALID_REPORT_ID), {
    getAiChartReportResultById: async () => createReport('paid', '短測試報告內容'),
  })
  const json = await readJson(response)

  assert.equal(response.status, 200)
  assert.deepEqual(json, {
    ok: true,
    status: 'ready',
    report: {
      id: VALID_REPORT_ID,
      title: 'AI 命盤分析',
      productName: 'AI 命盤分析',
      amountTwd: 100,
      paymentStatus: 'paid',
      paidAt: '2026-07-07T10:00:00.000Z',
      reportContent: '短測試報告內容',
      completedAt: '2026-07-07T10:05:00.000Z',
    },
  })
  assertNoUnsafeResponseKeys(json)
})

for (const paymentStatus of ['failed', 'canceled', 'refunded'] satisfies AiChartReportPaymentStatus[]) {
  test(`${paymentStatus} report returns invalid state`, async () => {
    const response = await handleReadAiChartReportRequest(params(VALID_REPORT_ID), {
      getAiChartReportResultById: async () => createReport(paymentStatus, null),
    })
    const json = await readJson(response)

    assert.equal(response.status, 409)
    assert.deepEqual(json, {
      ok: false,
      error: 'AI_CHART_REPORT_INVALID_STATE',
      paymentStatus,
    })
    assertNoUnsafeResponseKeys(json)
  })
}

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
