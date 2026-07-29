import assert from 'node:assert/strict'
import { syncAiChartReportAfterPayment, type AiChartPaymentContext } from './aiChartSync'
import type { MarkAiChartReportPaidInput, MarkAiChartReportPaidResult } from '../supabase/aiChartReports'

const aiChartPayment: AiChartPaymentContext = {
  paymentId: 'payment-1',
  itemType: 'ai_chart_report',
  itemId: '2df1a8da-3893-4b81-8d00-774a9cc0e472',
  merchantOrderNo: 'WB20260706170000AICH',
  paidAt: '2026-07-06T17:00:00.000Z',
}

async function runWithMock(payment: AiChartPaymentContext, result: MarkAiChartReportPaidResult) {
  const calls: MarkAiChartReportPaidInput[] = []
  const completionStartCalls: string[] = []
  const syncResult = await syncAiChartReportAfterPayment(payment, {
    markAiChartReportPaidByPayment: async (input) => {
      calls.push(input)
      return result
    },
    startPaidAiChartReportCompletionInBackground: (input) => {
      completionStartCalls.push(input.reportId)
      return {
        result: 'scheduled',
        reportId: input.reportId,
      }
    },
  })

  return {
    calls,
    completionStartCalls,
    syncResult,
  }
}

async function main() {
  const updated = await runWithMock(aiChartPayment, {
    result: 'updated',
    reportId: aiChartPayment.itemId || '',
  })

  assert.deepEqual(updated.syncResult, {
    result: 'updated',
    reportId: aiChartPayment.itemId,
  })
  assert.deepEqual(updated.calls, [
    {
      reportId: aiChartPayment.itemId,
      paymentId: 'payment-1',
      merchantOrderNo: 'WB20260706170000AICH',
      paidAt: '2026-07-06T17:00:00.000Z',
    },
  ])
  assert.deepEqual(updated.completionStartCalls, [aiChartPayment.itemId])

  const alreadyPaid = await runWithMock(aiChartPayment, {
    result: 'already_paid',
    reportId: aiChartPayment.itemId || '',
  })

  assert.deepEqual(alreadyPaid.syncResult, {
    result: 'already_paid',
    reportId: aiChartPayment.itemId,
  })
  assert.equal(alreadyPaid.calls.length, 1)
  assert.deepEqual(alreadyPaid.completionStartCalls, [aiChartPayment.itemId])

  const notFound = await runWithMock(aiChartPayment, {
    result: 'not_found',
    reportId: aiChartPayment.itemId || '',
  })

  assert.deepEqual(notFound.syncResult, {
    result: 'not_found',
    reportId: aiChartPayment.itemId,
  })
  assert.equal(notFound.calls.length, 1)
  assert.deepEqual(notFound.completionStartCalls, [])

  const invalidState = await runWithMock(aiChartPayment, {
    result: 'invalid_state',
    reportId: aiChartPayment.itemId || '',
    paymentStatus: 'failed',
  })

  assert.deepEqual(invalidState.syncResult, {
    result: 'invalid_state',
    reportId: aiChartPayment.itemId,
    paymentStatus: 'failed',
  })
  assert.equal(invalidState.calls.length, 1)
  assert.deepEqual(invalidState.completionStartCalls, [])

  const backgroundStartFailure = await syncAiChartReportAfterPayment(aiChartPayment, {
    markAiChartReportPaidByPayment: async () => ({
      result: 'updated',
      reportId: aiChartPayment.itemId || '',
    }),
    startPaidAiChartReportCompletionInBackground: () => {
      throw new Error('unsafe background scheduler failure')
    },
  })

  assert.deepEqual(backgroundStartFailure, {
    result: 'updated',
    reportId: aiChartPayment.itemId,
  })

  for (const itemType of ['booking', 'course', 'ai_divination', null]) {
    let called = false
    const result = await syncAiChartReportAfterPayment(
      {
        ...aiChartPayment,
        itemType,
      },
      {
        markAiChartReportPaidByPayment: async () => {
          called = true
          throw new Error('should_not_call')
        },
        startPaidAiChartReportCompletionInBackground: () => {
          throw new Error('should_not_schedule')
        },
      },
    )

    assert.deepEqual(result, { result: 'skipped_not_ai_chart' })
    assert.equal(called, false)
  }

  for (const payment of [
    { ...aiChartPayment, paymentId: '' },
    { ...aiChartPayment, itemId: null },
    { ...aiChartPayment, itemId: '   ' },
    { ...aiChartPayment, merchantOrderNo: null },
    { ...aiChartPayment, merchantOrderNo: '   ' },
  ]) {
    let called = false
    const result = await syncAiChartReportAfterPayment(payment, {
      markAiChartReportPaidByPayment: async () => {
        called = true
        throw new Error('should_not_call')
      },
      startPaidAiChartReportCompletionInBackground: () => {
        throw new Error('should_not_schedule')
      },
    })

    assert.deepEqual(result, { result: 'skipped_missing_ai_chart_context' })
    assert.equal(called, false)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
