import {
  decideAiChartReportResultAccess,
  getAiChartReportCompletionSubject,
  markAiChartReportCompleted,
  markAiChartReportFailed,
} from '../supabase/aiChartReports'
import {
  AI_CHART_D1_REPORT_WRITER_RUNTIME_NOT_READY,
  AiChartD1ReportWriterRuntimeNotReadyError,
} from './reportGenerationPipeline'
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
  | {
      result: 'runtime_not_ready'
      reportId: string
      error: typeof AI_CHART_D1_REPORT_WRITER_RUNTIME_NOT_READY
    }
  | { result: 'failed'; reportId: string; error: string }

function isAiChartD1ReportWriterRuntimeNotReadyError(error: unknown) {
  return (
    error instanceof AiChartD1ReportWriterRuntimeNotReadyError ||
    (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === AI_CHART_D1_REPORT_WRITER_RUNTIME_NOT_READY
    )
  )
}

async function markAiChartReportGenerationFailed(
  reportId: string,
  markFailed: typeof markAiChartReportFailed,
): Promise<CompleteAiChartReportResult> {
  try {
    await markFailed({
      reportId,
      errorMessage: AI_CHART_REPORT_GENERATION_FAILED,
    })
  } catch {
    // Best effort only: callers should receive the safe generation failure code.
  }

  return {
    result: 'failed',
    reportId,
    error: AI_CHART_REPORT_GENERATION_FAILED,
  }
}

export async function completePaidAiChartReport(
  input: CompleteAiChartReportInput,
  deps?: {
    getAiChartReportCompletionSubject?: typeof getAiChartReportCompletionSubject
    markAiChartReportCompleted?: typeof markAiChartReportCompleted
    markAiChartReportFailed?: typeof markAiChartReportFailed
    generateAiChartReportContent?: typeof generateAiChartReportContent
  },
): Promise<CompleteAiChartReportResult> {
  const readReport =
    deps?.getAiChartReportCompletionSubject ??
    getAiChartReportCompletionSubject
  const markCompleted = deps?.markAiChartReportCompleted ?? markAiChartReportCompleted
  const markFailed = deps?.markAiChartReportFailed ?? markAiChartReportFailed
  const generateReportContent = deps?.generateAiChartReportContent ?? generateAiChartReportContent

  const report = await readReport(input.reportId)
  if (report === null) {
    return {
      result: 'not_found',
      reportId: input.reportId,
    }
  }

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

  let reportContent: string
  try {
    reportContent = generateReportContent({
      ...(input.chartInput ?? {}),
      reportId: input.reportId,
      chartSnapshot: report.chartSnapshot,
      chartSnapshotSha256: report.chartSnapshotSha256,
    })
  } catch (error) {
    if (isAiChartD1ReportWriterRuntimeNotReadyError(error)) {
      return {
        result: 'runtime_not_ready',
        reportId: input.reportId,
        error: AI_CHART_D1_REPORT_WRITER_RUNTIME_NOT_READY,
      }
    }

    return markAiChartReportGenerationFailed(input.reportId, markFailed)
  }

  try {
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
    return markAiChartReportGenerationFailed(input.reportId, markFailed)
  }
}
