import type { CompleteAiChartReportResult } from './reportCompletion'

export const AI_CHART_REPORT_COMPLETION_BACKGROUND_SCHEDULE_FAILED =
  'AI_CHART_REPORT_COMPLETION_BACKGROUND_SCHEDULE_FAILED' as const

export type StartPaidAiChartReportCompletionInput = Readonly<{
  reportId: string
}>

export type StartPaidAiChartReportCompletionResult =
  | { result: 'scheduled'; reportId: string }
  | {
      result: 'schedule_failed'
      reportId: string
      error: typeof AI_CHART_REPORT_COMPLETION_BACKGROUND_SCHEDULE_FAILED
    }

export type CompletePaidAiChartReportHandler = (
  input: StartPaidAiChartReportCompletionInput,
) => Promise<CompleteAiChartReportResult>

type BackgroundScheduler = (task: () => Promise<void>) => void

function normalizeReportId(value: string) {
  const reportId = value.trim()
  if (!reportId) {
    throw new Error('reportId must not be blank')
  }
  return reportId
}

function defaultSchedule(task: () => Promise<void>) {
  queueMicrotask(() => {
    void task()
  })
}

export function startPaidAiChartReportCompletionInBackground(
  input: StartPaidAiChartReportCompletionInput,
  deps: {
    completePaidAiChartReport: CompletePaidAiChartReportHandler
    schedule?: BackgroundScheduler
    onResult?: (result: CompleteAiChartReportResult) => void
    onError?: (error: unknown) => void
  },
): StartPaidAiChartReportCompletionResult {
  const reportId = normalizeReportId(input.reportId)
  const completeReport = deps.completePaidAiChartReport
  const schedule = deps.schedule ?? defaultSchedule
  const onResult = deps.onResult ?? (() => {})
  const onError = deps.onError ?? (() => {})

  try {
    schedule(async () => {
      try {
        const result = await completeReport({ reportId })
        onResult(result)
      } catch (error) {
        onError(error)
      }
    })
  } catch (error) {
    onError(error)
    return {
      result: 'schedule_failed',
      reportId,
      error: AI_CHART_REPORT_COMPLETION_BACKGROUND_SCHEDULE_FAILED,
    }
  }

  return {
    result: 'scheduled',
    reportId,
  }
}
