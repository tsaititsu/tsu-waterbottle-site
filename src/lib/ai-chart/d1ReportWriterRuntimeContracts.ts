import { freezeAiChartD1Value } from './d1CommonContracts'

export const AI_CHART_D1_REPORT_WRITER_RUNTIME_COMMAND_VERSION =
  'ai-chart-d1-report-writer-runtime-command/v1' as const
export const AI_CHART_D1_REPORT_WRITER_RUNTIME_COMMAND_TASK =
  'D1_REPORT_WRITER_RUNTIME_COMMAND' as const

export type AiChartD1ReportWriterRuntimeCommand = Readonly<{
  contractVersion:
    typeof AI_CHART_D1_REPORT_WRITER_RUNTIME_COMMAND_VERSION
  task: typeof AI_CHART_D1_REPORT_WRITER_RUNTIME_COMMAND_TASK
  pipelineVersion: string
  chartId: string
  sourceSnapshotSha256: string
  expectedPalaceCount: 12
  targetPalaceIds: readonly string[]
  runtimeMode: 'PRODUCTION_REPORT_WRITER'
  runtimeStatus: 'DISABLED_PENDING_IMPLEMENTATION'
  nextRequiredAction:
    'IMPLEMENT_D1_REPORT_WRITER_RUNTIME_ADAPTER'
  productionCallable: false
  fetchAllowed: false
  openAiCallable: false
  attemptedRequests: 0
  executedRequests: 0
  fetchCount: 0
  openAiRequests: 0
  retryPerformed: false
  customerDeliveryAllowed: false
  safeMetadataOnly: true
}>

function assertNonBlankText(value: string, fieldName: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldName}_must_not_be_blank`)
  }
}

export function buildAiChartD1ReportWriterRuntimeCommand(
  input: Readonly<{
    pipelineVersion: string
    chartId: string
    sourceSnapshotSha256: string
    targetPalaceIds: readonly string[]
  }>,
): AiChartD1ReportWriterRuntimeCommand {
  assertNonBlankText(input.pipelineVersion, 'pipelineVersion')
  assertNonBlankText(input.chartId, 'chartId')
  assertNonBlankText(
    input.sourceSnapshotSha256,
    'sourceSnapshotSha256',
  )

  if (input.targetPalaceIds.length !== 12) {
    throw new Error('targetPalaceIds_must_contain_12_palaces')
  }

  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_REPORT_WRITER_RUNTIME_COMMAND_VERSION,
    task: AI_CHART_D1_REPORT_WRITER_RUNTIME_COMMAND_TASK,
    pipelineVersion: input.pipelineVersion,
    chartId: input.chartId,
    sourceSnapshotSha256: input.sourceSnapshotSha256,
    expectedPalaceCount: 12 as const,
    targetPalaceIds: freezeAiChartD1Value([
      ...input.targetPalaceIds,
    ]),
    runtimeMode: 'PRODUCTION_REPORT_WRITER' as const,
    runtimeStatus:
      'DISABLED_PENDING_IMPLEMENTATION' as const,
    nextRequiredAction:
      'IMPLEMENT_D1_REPORT_WRITER_RUNTIME_ADAPTER' as const,
    productionCallable: false as const,
    fetchAllowed: false as const,
    openAiCallable: false as const,
    attemptedRequests: 0 as const,
    executedRequests: 0 as const,
    fetchCount: 0 as const,
    openAiRequests: 0 as const,
    retryPerformed: false as const,
    customerDeliveryAllowed: false as const,
    safeMetadataOnly: true as const,
  })
}
