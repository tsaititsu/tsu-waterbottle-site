import {
  decideAiChartReportResultAccess,
  getAiChartReportResultById,
  markAiChartReportCompleted,
  markAiChartReportFailed,
} from '../supabase/aiChartReports'
import { generateAiChartReportContent, type AiChartReportGenerationInput } from './reportGenerator'

export const AI_CHART_REPORT_GENERATION_FAILED = 'AI_CHART_REPORT_GENERATION_FAILED'

export type CompleteAiChartReportInput = {
  reportId: string
  chartInput?: AiChartReportGenerationInput | null
}

export type CompleteAiChartReportResult =
  | { result: 'completed'; reportId: string }
  | { result: 'already_completed'; reportId: string }
  | { result: 'payment_required'; reportId: string }
  | { result: 'not_found'; reportId: string }
  | { result: 'invalid_state'; reportId: string; paymentStatus: string | null }
  | { result: 'failed'; reportId: string; error: string }

export async function completePaidAiChartReport(
  input: CompleteAiChartReportInput,
  deps?: {
    getAiChartReportResultById?: typeof getAiChartReportResultById
    markAiChartReportCompleted?: typeof markAiChartReportCompleted
    markAiChartReportFailed?: typeof markAiChartReportFailed
    generateAiChartReportContent?: typeof generateAiChartReportContent
  },
): Promise<CompleteAiChartReportResult> {
  const readReport = deps?.getAiChartReportResultById ?? getAiChartReportResultById
  const markCompleted = deps?.markAiChartReportCompleted ?? markAiChartReportCompleted
  const markFailed = deps?.markAiChartReportFailed ?? markAiChartReportFailed
  const generateReportContent = deps?.generateAiChartReportContent ?? generateAiChartReportContent

  const report = await readReport(input.reportId)
  const decision = decideAiChartReportResultAccess(report)

  if (decision.result === 'not_found') {
    return {
      result: 'not_found',
      reportId: input.reportId,
    }
  }

  if (decision.result === 'payment_required') {
    return {
      result: 'payment_required',
      reportId: input.reportId,
    }
  }

  if (decision.result === 'ready') {
    return {
      result: 'already_completed',
      reportId: input.reportId,
    }
  }

  if (decision.result === 'invalid_state') {
    return {
      result: 'invalid_state',
      reportId: input.reportId,
      paymentStatus: decision.paymentStatus,
    }
  }

  try {
    const reportContent = generateReportContent(input.chartInput ?? {})
    const completedResult = await markCompleted({
      reportId: input.reportId,
      reportContent,
    })

    if (completedResult.result === 'updated') {
      return {
        result: 'completed',
        reportId: input.reportId,
      }
    }

    if (completedResult.result === 'already_completed') {
      return {
        result: 'already_completed',
        reportId: input.reportId,
      }
    }

    if (completedResult.result === 'payment_required') {
      return {
        result: 'payment_required',
        reportId: input.reportId,
      }
    }

    if (completedResult.result === 'not_found') {
      return {
        result: 'not_found',
        reportId: input.reportId,
      }
    }

    return {
      result: 'invalid_state',
      reportId: input.reportId,
      paymentStatus: completedResult.paymentStatus,
    }
  } catch {
    try {
      await markFailed({
        reportId: input.reportId,
        errorMessage: AI_CHART_REPORT_GENERATION_FAILED,
      })
    } catch {
      // Best effort only: callers should receive the safe generation failure code.
    }

    return {
      result: 'failed',
      reportId: input.reportId,
      error: AI_CHART_REPORT_GENERATION_FAILED,
    }
  }
}
