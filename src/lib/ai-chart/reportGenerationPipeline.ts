import { buildAiChartD1K0P1KnowledgeBundles } from './d1K0Selection'
import { buildAiChartD1P1StructuralInputs } from './d1P1InputContracts'
import { buildAiChartD1P1ReportOpenAiRuntimeAdapterBridges } from './d1P1AdapterBridge'
import { buildAiChartD1P1ModelInputs } from './d1P1ModelInputBindings'
import { buildAiChartD1P1PromptPackages } from './d1P1PromptPackageBuilder'
import {
  buildAiChartD1ReportWriterRuntimeCommand,
  prepareAiChartD1ReportWriterRuntimeAdapter,
  summarizeAiChartD1P1AdapterBridgeDescriptors,
  type AiChartD1ReportWriterRuntimeCommand,
} from './d1ReportWriterRuntimeContracts'
import {
  buildAiChartD1P1ReportExecutionPlan,
  type AiChartD1P1ReportExecutionRuntimePlan,
} from './d1P1ReportExecutionRuntimeContracts'
import {
  AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION,
  AI_CHART_D1_PALACE_IDENTITIES,
} from './d1N0Constants'
import { normalizeAiChartD1N0 } from './d1N0'

export const AI_CHART_D1_REPORT_GENERATION_PIPELINE_VERSION =
  'ai-chart-d1-report-generation-pipeline/v1' as const

export const AI_CHART_D1_REPORT_WRITER_RUNTIME_NOT_READY =
  'AI_CHART_D1_REPORT_WRITER_RUNTIME_NOT_READY' as const

export type AiChartD1ReportGenerationPlan = Readonly<{
  contractVersion: typeof AI_CHART_D1_REPORT_GENERATION_PIPELINE_VERSION
  chartId: string
  sourceSnapshotSha256: string
  n0StructuralStatus: 'ready' | 'partial'
  p1StructuralInputVersion: typeof AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION
  p1StructuralInputCount: 12
  targetPalaceIds: readonly string[]
  writerRuntimeCommand: AiChartD1ReportWriterRuntimeCommand
  p1ReportExecutionPlan: AiChartD1P1ReportExecutionRuntimePlan
  openAiCallable: false
  nextStage: 'd1_p1_model_execution_required'
}>

export class AiChartD1ReportWriterRuntimeNotReadyError extends Error {
  readonly code = AI_CHART_D1_REPORT_WRITER_RUNTIME_NOT_READY

  constructor() {
    super(AI_CHART_D1_REPORT_WRITER_RUNTIME_NOT_READY)
    this.name = 'AiChartD1ReportWriterRuntimeNotReadyError'
  }
}

function reportScopedId(prefix: string, reportId: string) {
  const normalized = reportId.trim().replace(/[^A-Za-z0-9._:-]/g, '-')
  if (!normalized) {
    throw new Error('reportId must not be blank')
  }
  return `${prefix}:${normalized}`.slice(0, 128)
}

export function createAiChartD1ReportChartId(reportId: string) {
  return reportScopedId('chart', reportId)
}

export function buildAiChartD1ReportGenerationPlan(input: {
  reportId: string
  chartSnapshot: unknown
  d1K0Catalog: unknown
}): AiChartD1ReportGenerationPlan {
  const chartId = createAiChartD1ReportChartId(input.reportId)
  const runId = reportScopedId('run:d1-report', input.reportId)
  const n0 = normalizeAiChartD1N0(input.chartSnapshot, { chartId })
  const callIds = AI_CHART_D1_PALACE_IDENTITIES.map(
    ({ palaceId }) => `${runId}:${palaceId}`,
  )
  const structuralInputs = buildAiChartD1P1StructuralInputs(n0, {
    runId,
    callIds,
  })

  if (structuralInputs.length !== 12) {
    throw new Error('ai_chart_d1_report_structural_input_count_invalid')
  }

  const targetPalaceIds = Object.freeze(
    structuralInputs.map((input) => input.targetPalace.palaceId),
  )
  const knowledgeBundles = buildAiChartD1K0P1KnowledgeBundles(
    input.d1K0Catalog,
    structuralInputs,
    {
      bundleIds: targetPalaceIds.map(
        (palaceId) => `${runId}:bundle:${palaceId}`,
      ),
    },
  )
  const modelInputs = buildAiChartD1P1ModelInputs(
    input.d1K0Catalog,
    structuralInputs,
    knowledgeBundles,
  )
  const promptPackages = buildAiChartD1P1PromptPackages(
    input.d1K0Catalog,
    structuralInputs,
    knowledgeBundles,
    modelInputs,
  )
  const p1AdapterBridges = buildAiChartD1P1ReportOpenAiRuntimeAdapterBridges(
    input.d1K0Catalog,
    structuralInputs,
    knowledgeBundles,
    modelInputs,
    promptPackages,
  )
  const p1AdapterBridgeDescriptors =
    summarizeAiChartD1P1AdapterBridgeDescriptors(
      p1AdapterBridges.map((bridge) => bridge.descriptor),
    )
  const writerRuntimeCommand =
    buildAiChartD1ReportWriterRuntimeCommand({
      pipelineVersion:
        AI_CHART_D1_REPORT_GENERATION_PIPELINE_VERSION,
      chartId: n0.chartId,
      sourceSnapshotSha256: n0.sourceSnapshotSha256,
      targetPalaceIds,
      p1AdapterBridgeDescriptors,
    })
  const p1ReportExecutionPlan =
    buildAiChartD1P1ReportExecutionPlan(writerRuntimeCommand)

  return Object.freeze({
    contractVersion: AI_CHART_D1_REPORT_GENERATION_PIPELINE_VERSION,
    chartId: n0.chartId,
    sourceSnapshotSha256: n0.sourceSnapshotSha256,
    n0StructuralStatus: n0.readiness.structuralStatus,
    p1StructuralInputVersion: AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION,
    p1StructuralInputCount: 12,
    targetPalaceIds,
    writerRuntimeCommand,
    p1ReportExecutionPlan,
    openAiCallable: false,
    nextStage: 'd1_p1_model_execution_required',
  })
}

export function generateAiChartD1ReportContentFromSnapshot(input: {
  reportId: string
  chartSnapshot: unknown
  d1K0Catalog?: unknown
}): string {
  if (input.d1K0Catalog === undefined) {
    throw new AiChartD1ReportWriterRuntimeNotReadyError()
  }
  const plan = buildAiChartD1ReportGenerationPlan({
    reportId: input.reportId,
    chartSnapshot: input.chartSnapshot,
    d1K0Catalog: input.d1K0Catalog,
  })
  prepareAiChartD1ReportWriterRuntimeAdapter(
    plan.writerRuntimeCommand,
  )
  throw new AiChartD1ReportWriterRuntimeNotReadyError()
}
