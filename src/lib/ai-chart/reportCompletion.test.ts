import assert from 'node:assert/strict'
import {
  AI_CHART_REPORT_COMPLETION_CHART_SNAPSHOT_REQUIRED,
  AI_CHART_REPORT_GENERATION_FAILED,
  completePaidAiChartReport,
  type CompleteAiChartReportResult,
} from './reportCompletion'
import type { AiChartReportGenerationInput } from './reportGenerator'
import type {
  AiChartReportCompletionSubject,
  AiChartReportResultContext,
  MarkAiChartReportCompletedInput,
  MarkAiChartReportCompletedResult,
  MarkAiChartReportFailedInput,
  MarkAiChartReportFailedResult,
} from '../supabase/aiChartReports'
import { completeModelInputSnapshot, getTestCatalog } from './d1P1ModelInputTestSupport'

function test(name: string, fn: () => void | Promise<void>) {
  Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`✓ ${name}`)
    })
    .catch((error) => {
      console.error(`✗ ${name}`)
      throw error
    })
}

function createReport(
  paymentStatus: AiChartReportResultContext['paymentStatus'],
  reportContent: string | null,
): AiChartReportCompletionSubject {
  return {
    id: 'report-completion-1',
    title: 'AI 命盤分析',
    productName: 'AI 命盤分析',
    amountTwd: 100,
    status: 'pending',
    paymentStatus,
    reportContent,
    paidAt: paymentStatus === 'paid' ? '2026-07-06T18:00:00.000Z' : null,
    completedAt: null,
    errorMessage: null,
    chartSnapshot: null,
    chartSnapshotSha256: null,
  }
}

function createReportWithSnapshot(
  paymentStatus: AiChartReportResultContext['paymentStatus'],
  reportContent: string | null,
): AiChartReportCompletionSubject {
  return {
    ...createReport(paymentStatus, reportContent),
    chartSnapshot: { safe: 'server-chart-snapshot' },
    chartSnapshotSha256: 'safe-test-chart-snapshot-sha',
  }
}

function assertNoUnsafeText(value: string) {
  assert.equal(value.includes('TradeInfo'), false)
  assert.equal(value.includes('TradeSha'), false)
  assert.equal(value.includes('HashKey'), false)
  assert.equal(value.includes('HashIV'), false)
  assert.equal(value.includes('creditCard'), false)
  assert.equal(value.includes('raw_payload'), false)
  assert.equal(value.includes('OpenAI prompt'), false)
  assert.equal(value.includes('OpenAI request'), false)
  assert.equal(value.includes('OpenAI response'), false)
  assert.equal(value.includes('booking'), false)
  assert.equal(value.includes('course'), false)
  assert.equal(value.includes('divination'), false)
  assert.equal(value.includes('product_id'), false)
}

async function runWithMockDeps(input: {
  report: AiChartReportCompletionSubject | null
  completedResult?: MarkAiChartReportCompletedResult
  generator?: (chartInput: AiChartReportGenerationInput) => string
  failedResult?: MarkAiChartReportFailedResult
}): Promise<{
  result: CompleteAiChartReportResult
  readCalls: string[]
  generatorCalls: AiChartReportGenerationInput[]
  completedCalls: MarkAiChartReportCompletedInput[]
  failedCalls: MarkAiChartReportFailedInput[]
}> {
  const readCalls: string[] = []
  const generatorCalls: AiChartReportGenerationInput[] = []
  const completedCalls: MarkAiChartReportCompletedInput[] = []
  const failedCalls: MarkAiChartReportFailedInput[] = []
  const reportId = input.report?.id ?? 'report-completion-missing'

  const result = await completePaidAiChartReport(
    {
      reportId,
      chartInput: {
        name: '測試使用者',
        chartSummary: {
          mainStar: '紫微',
          notes: ['短測試觀察'],
        },
      },
    },
    {
      getAiChartReportCompletionSubject: async (requestedReportId) => {
        readCalls.push(requestedReportId)
        return input.report
      },
      generateAiChartReportContent: (chartInput) => {
        generatorCalls.push(chartInput)
        return input.generator?.(chartInput) ?? '短測試報告內容'
      },
      markAiChartReportCompleted: async (completedInput) => {
        completedCalls.push(completedInput)
        return (
          input.completedResult ?? {
            result: 'updated',
            reportId: completedInput.reportId,
          }
        )
      },
      markAiChartReportFailed: async (failedInput) => {
        failedCalls.push(failedInput)
        return input.failedResult ?? { result: 'updated', reportId: failedInput.reportId }
      },
    },
  )

  return {
    result,
    readCalls,
    generatorCalls,
    completedCalls,
    failedCalls,
  }
}

test('not_found returns not_found without generating content', async () => {
  const { result, generatorCalls, completedCalls, failedCalls } = await runWithMockDeps({
    report: null,
  })

  assert.deepEqual(result, {
    result: 'not_found',
    reportId: 'report-completion-missing',
  })
  assert.equal(generatorCalls.length, 0)
  assert.equal(completedCalls.length, 0)
  assert.equal(failedCalls.length, 0)
})

test('payment_required returns payment_required without generating content', async () => {
  const { result, generatorCalls, completedCalls, failedCalls } = await runWithMockDeps({
    report: createReport('pending', null),
  })

  assert.deepEqual(result, {
    result: 'payment_required',
    reportId: 'report-completion-1',
  })
  assert.equal(generatorCalls.length, 0)
  assert.equal(completedCalls.length, 0)
  assert.equal(failedCalls.length, 0)
})

test('ready returns already_completed without rewriting content', async () => {
  const { result, generatorCalls, completedCalls, failedCalls } = await runWithMockDeps({
    report: createReport('paid', '既有短測試報告內容'),
  })

  assert.deepEqual(result, {
    result: 'already_completed',
    reportId: 'report-completion-1',
  })
  assert.equal(generatorCalls.length, 0)
  assert.equal(completedCalls.length, 0)
  assert.equal(failedCalls.length, 0)
})

test('invalid_state returns invalid_state without rewriting content', async () => {
  const { result, generatorCalls, completedCalls, failedCalls } = await runWithMockDeps({
    report: createReport('failed', null),
  })

  assert.deepEqual(result, {
    result: 'invalid_state',
    reportId: 'report-completion-1',
    paymentStatus: 'failed',
  })
  assert.equal(generatorCalls.length, 0)
  assert.equal(completedCalls.length, 0)
  assert.equal(failedCalls.length, 0)
})

test('paid_missing_content without server chart snapshot stays blocked and does not use legacy fallback', async () => {
  const { result, readCalls, generatorCalls, completedCalls, failedCalls } = await runWithMockDeps({
    report: createReport('paid', null),
  })

  assert.deepEqual(result, {
    result: 'chart_snapshot_required',
    reportId: 'report-completion-1',
    error: AI_CHART_REPORT_COMPLETION_CHART_SNAPSHOT_REQUIRED,
  })
  assert.deepEqual(readCalls, ['report-completion-1'])
  assert.equal(generatorCalls.length, 0)
  assert.equal(completedCalls.length, 0)
  assert.equal(failedCalls.length, 0)
})

test('paid_missing_content with server chart snapshot generates report content and marks completed', async () => {
  const { result, readCalls, generatorCalls, completedCalls, failedCalls } = await runWithMockDeps({
    report: createReportWithSnapshot('paid', null),
  })

  assert.deepEqual(result, {
    result: 'completed',
    reportId: 'report-completion-1',
  })
  assert.deepEqual(readCalls, ['report-completion-1'])
  assert.equal(generatorCalls.length, 1)
  assert.equal(generatorCalls[0].chartSummary?.mainStar, '紫微')
  assert.equal(completedCalls.length, 1)
  assert.equal(completedCalls[0].reportId, 'report-completion-1')
  assert.equal(completedCalls[0].reportContent, '短測試報告內容')
  assertNoUnsafeText(completedCalls[0].reportContent)
  assert.equal(failedCalls.length, 0)
})

test('mark completed already_completed maps to already_completed', async () => {
  const { result, generatorCalls, completedCalls, failedCalls } = await runWithMockDeps({
    report: createReportWithSnapshot('paid', null),
    completedResult: {
      result: 'already_completed',
      reportId: 'report-completion-1',
    },
  })

  assert.deepEqual(result, {
    result: 'already_completed',
    reportId: 'report-completion-1',
  })
  assert.equal(generatorCalls.length, 1)
  assert.equal(completedCalls.length, 1)
  assert.equal(failedCalls.length, 0)
})

test('mark completed payment_required maps to payment_required', async () => {
  const { result, generatorCalls, completedCalls, failedCalls } = await runWithMockDeps({
    report: createReportWithSnapshot('paid', null),
    completedResult: {
      result: 'payment_required',
      reportId: 'report-completion-1',
    },
  })

  assert.deepEqual(result, {
    result: 'payment_required',
    reportId: 'report-completion-1',
  })
  assert.equal(generatorCalls.length, 1)
  assert.equal(completedCalls.length, 1)
  assert.equal(failedCalls.length, 0)
})

test('mark completed not_found maps to not_found', async () => {
  const { result, generatorCalls, completedCalls, failedCalls } = await runWithMockDeps({
    report: createReportWithSnapshot('paid', null),
    completedResult: {
      result: 'not_found',
      reportId: 'report-completion-1',
    },
  })

  assert.deepEqual(result, {
    result: 'not_found',
    reportId: 'report-completion-1',
  })
  assert.equal(generatorCalls.length, 1)
  assert.equal(completedCalls.length, 1)
  assert.equal(failedCalls.length, 0)
})

test('mark completed invalid_state maps to invalid_state', async () => {
  const { result, generatorCalls, completedCalls, failedCalls } = await runWithMockDeps({
    report: createReportWithSnapshot('paid', null),
    completedResult: {
      result: 'invalid_state',
      reportId: 'report-completion-1',
      status: 'failed',
      paymentStatus: 'paid',
    },
  })

  assert.deepEqual(result, {
    result: 'invalid_state',
    reportId: 'report-completion-1',
    paymentStatus: 'paid',
  })
  assert.equal(generatorCalls.length, 1)
  assert.equal(completedCalls.length, 1)
  assert.equal(failedCalls.length, 0)
})

test('generator throw marks failed with a safe error code', async () => {
  const { result, completedCalls, failedCalls } = await runWithMockDeps({
    report: createReportWithSnapshot('paid', null),
    generator: () => {
      throw new Error('unsafe full stack should not be returned')
    },
  })

  assert.deepEqual(result, {
    result: 'failed',
    reportId: 'report-completion-1',
    error: AI_CHART_REPORT_GENERATION_FAILED,
  })
  assert.equal(completedCalls.length, 0)
  assert.equal(failedCalls.length, 1)
  assert.deepEqual(failedCalls[0], {
    reportId: 'report-completion-1',
    errorMessage: AI_CHART_REPORT_GENERATION_FAILED,
  })
  assertNoUnsafeText(failedCalls[0].errorMessage)
})

test('default generator uses chart snapshot pipeline and keeps the paid report recoverable until writer runtime exists', async () => {
  const failedCalls: MarkAiChartReportFailedInput[] = []
  const result = await completePaidAiChartReport(
    {
      reportId: 'report-completion-1',
      chartInput: null,
    },
    {
      getAiChartReportCompletionSubject: async () => ({
        ...createReport('paid', null),
        chartSnapshot: completeModelInputSnapshot(),
        chartSnapshotSha256: 'safe-test-sha',
      }),
      markAiChartReportCompleted: async () => {
        throw new Error('should_not_complete_placeholder_report')
      },
      markAiChartReportFailed: async (failedInput) => {
        failedCalls.push(failedInput)
        return { result: 'updated', reportId: failedInput.reportId }
      },
      compileAiChartD1K0Catalog: getTestCatalog,
    },
  )

  assert.deepEqual(result, {
    result: 'runtime_not_ready',
    reportId: 'report-completion-1',
    error: 'AI_CHART_D1_REPORT_WRITER_RUNTIME_NOT_READY',
  })
  assert.deepEqual(failedCalls, [])
})

test('mark completed throw marks failed with a safe error code', async () => {
  const failedCalls: MarkAiChartReportFailedInput[] = []
  const result = await completePaidAiChartReport(
    {
      reportId: 'report-completion-1',
      chartInput: null,
    },
    {
      getAiChartReportCompletionSubject: async () =>
        createReportWithSnapshot('paid', null),
      generateAiChartReportContent: () => '短測試報告內容',
      markAiChartReportCompleted: async () => {
        throw new Error('unsafe write failure detail')
      },
      markAiChartReportFailed: async (failedInput) => {
        failedCalls.push(failedInput)
        return { result: 'updated', reportId: failedInput.reportId }
      },
    },
  )

  assert.deepEqual(result, {
    result: 'failed',
    reportId: 'report-completion-1',
    error: AI_CHART_REPORT_GENERATION_FAILED,
  })
  assert.equal(failedCalls.length, 1)
  assert.equal(failedCalls[0].errorMessage, AI_CHART_REPORT_GENERATION_FAILED)
})
