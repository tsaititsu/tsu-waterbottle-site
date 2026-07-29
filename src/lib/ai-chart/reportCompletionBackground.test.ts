import assert from 'node:assert/strict'
import {
  AI_CHART_REPORT_COMPLETION_BACKGROUND_SCHEDULE_FAILED,
  startPaidAiChartReportCompletionInBackground,
} from './reportCompletionBackground'

async function main() {
  const scheduledTasks: Array<() => Promise<void>> = []
  const completedReportIds: string[] = []
  const errors: unknown[] = []

  const scheduled = startPaidAiChartReportCompletionInBackground(
    { reportId: ' report-1 ' },
    {
      schedule: (task) => {
        scheduledTasks.push(task)
      },
      completePaidAiChartReport: async ({ reportId }) => {
        completedReportIds.push(reportId)
        return {
          result: 'completed',
          reportId,
        }
      },
      onError: (error) => {
        errors.push(error)
      },
    },
  )

  assert.deepEqual(scheduled, {
    result: 'scheduled',
    reportId: 'report-1',
  })
  assert.equal(scheduledTasks.length, 1)
  assert.deepEqual(completedReportIds, [])

  await scheduledTasks[0]()
  assert.deepEqual(completedReportIds, ['report-1'])
  assert.deepEqual(errors, [])

  const failingTasks: Array<() => Promise<void>> = []
  const taskErrors: unknown[] = []
  startPaidAiChartReportCompletionInBackground(
    { reportId: 'report-2' },
    {
      schedule: (task) => {
        failingTasks.push(task)
      },
      completePaidAiChartReport: async () => {
        throw new Error('unsafe completion failure')
      },
      onError: (error) => {
        taskErrors.push(error)
      },
    },
  )

  await failingTasks[0]()
  assert.equal(taskErrors.length, 1)
  assert.equal(String(taskErrors[0]).includes('unsafe completion failure'), true)

  const scheduleErrors: unknown[] = []
  const failedSchedule = startPaidAiChartReportCompletionInBackground(
    { reportId: 'report-3' },
    {
      completePaidAiChartReport: async ({ reportId }) => ({
        result: 'completed',
        reportId,
      }),
      schedule: () => {
        throw new Error('unsafe scheduler failure')
      },
      onError: (error) => {
        scheduleErrors.push(error)
      },
    },
  )

  assert.deepEqual(failedSchedule, {
    result: 'schedule_failed',
    reportId: 'report-3',
    error: AI_CHART_REPORT_COMPLETION_BACKGROUND_SCHEDULE_FAILED,
  })
  assert.equal(scheduleErrors.length, 1)
  assert.throws(() =>
    startPaidAiChartReportCompletionInBackground(
      { reportId: '   ' },
      {
        completePaidAiChartReport: async ({ reportId }) => ({
          result: 'completed',
          reportId,
        }),
      },
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
