import {
  markAiChartReportPaidByPayment,
  type MarkAiChartReportPaidResult,
} from '../supabase/aiChartReports'

export type AiChartPaymentContext = {
  paymentId: string
  itemType: string | null
  itemId: string | null
  merchantOrderNo: string | null
  paidAt?: string | null
}

export type AiChartSyncResult =
  | { result: 'updated'; reportId: string }
  | { result: 'already_paid'; reportId: string }
  | { result: 'not_found'; reportId: string }
  | { result: 'invalid_state'; reportId: string; paymentStatus: string | null }
  | { result: 'skipped_not_ai_chart' }
  | { result: 'skipped_missing_ai_chart_context' }

type MarkAiChartReportPaidHandler = typeof markAiChartReportPaidByPayment
export type StartPaidAiChartReportCompletionHandler = (input: {
  reportId: string
}) => unknown

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function mapMarkResult(result: MarkAiChartReportPaidResult): AiChartSyncResult {
  return result
}

export async function syncAiChartReportAfterPayment(
  payment: AiChartPaymentContext,
  deps: {
    markAiChartReportPaidByPayment?: MarkAiChartReportPaidHandler
    startPaidAiChartReportCompletionInBackground?:
      StartPaidAiChartReportCompletionHandler
  } = {},
): Promise<AiChartSyncResult> {
  if (payment.itemType !== 'ai_chart_report') {
    return {
      result: 'skipped_not_ai_chart',
    }
  }

  if (!hasText(payment.paymentId) || !hasText(payment.itemId) || !hasText(payment.merchantOrderNo)) {
    return {
      result: 'skipped_missing_ai_chart_context',
    }
  }

  const markPaid = deps.markAiChartReportPaidByPayment ?? markAiChartReportPaidByPayment
  const result = await markPaid({
    reportId: payment.itemId.trim(),
    paymentId: payment.paymentId.trim(),
    merchantOrderNo: payment.merchantOrderNo.trim(),
    paidAt: payment.paidAt,
  })

  const syncResult = mapMarkResult(result)
  const startCompletion = deps.startPaidAiChartReportCompletionInBackground
  if (
    syncResult.result === 'updated' ||
    syncResult.result === 'already_paid'
  ) {
    try {
      startCompletion?.({
        reportId: syncResult.reportId,
      })
    } catch {
      // Payment state is already persisted; background completion must not
      // turn a successful payment notification into a failed webhook.
    }
  }

  return syncResult
}
