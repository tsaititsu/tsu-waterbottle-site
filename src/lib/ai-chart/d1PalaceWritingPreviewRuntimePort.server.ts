import 'server-only'
import {
  freezeAiChartD1Value,
} from './d1CommonContracts'
import {
  buildAiChartD1PalaceWritingAdapterBridge,
  buildAiChartD1PalaceWritingFidelityAdapterBridge,
} from './d1PalaceWritingAdapterBridgeContracts'
import {
  buildAiChartD1PalaceWritingFidelityPromptPackage,
} from './d1PalaceWritingFidelityPromptPackageContracts'
import {
  parseAiChartD1PalaceWritingGoldenCase,
  type AiChartD1PalaceWritingGoldenCase,
} from './d1PalaceWritingGoldenCaseContracts'
import {
  type AiChartD1PalaceWritingFidelityReview,
} from './d1PalaceWritingFidelityReviewContracts'
import {
  type AiChartD1PalaceWritingResult,
} from './d1PalaceWritingResultContracts'
import {
  parseAiChartD1PalaceWritingPreviewPlan,
} from './d1PalaceWritingPreviewContracts'
import {
  AiChartD1PalaceWritingPreviewMockRuntimeError,
  runAiChartD1PalaceWritingPreviewMockRuntime,
  type AiChartD1PalaceWritingPreviewMockEvidenceStage,
  type AiChartD1PalaceWritingPreviewMockStageOutcome,
} from './d1PalaceWritingPreviewMockRuntimeContracts'
import {
  type ValidatedAiChartOpenAiStructuredRequest,
} from './openAiResponses'

export const AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_PORT_VERSION =
  'ai-chart-d1-palace-writing-preview-runtime-port/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_PORT_TASK =
  'D1_PALACE_WRITING_PREVIEW_RUNTIME_PORT_PROBE' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_PORT_INVALID =
  'ai_chart_d1_palace_writing_preview_runtime_port_invalid' as const

type RuntimePortCommandBase = Readonly<{
  runtimeMode: 'INJECTED_PORT_PROBE_ONLY'
  sequence: 1 | 2
  stage: 'WRITING' | 'FIDELITY_REVIEW'
  bridgeFingerprint: string
}>

export type AiChartD1PalaceWritingPreviewRuntimePortCommand =
  | RuntimePortCommandBase &
      Readonly<{
        sequence: 1
        stage: 'WRITING'
        request:
          ValidatedAiChartOpenAiStructuredRequest<AiChartD1PalaceWritingResult>
      }>
  | RuntimePortCommandBase &
      Readonly<{
        sequence: 2
        stage: 'FIDELITY_REVIEW'
        request:
          ValidatedAiChartOpenAiStructuredRequest<AiChartD1PalaceWritingFidelityReview>
      }>

export type AiChartD1PalaceWritingPreviewRuntimePort =
  (
    command: AiChartD1PalaceWritingPreviewRuntimePortCommand,
  ) => Promise<AiChartD1PalaceWritingPreviewMockStageOutcome>

export type AiChartD1PalaceWritingPreviewRuntimePortProbeResult =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_PORT_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_PORT_TASK
    runtimeMode: 'INJECTED_PORT_PROBE_ONLY'
    fixtureId: AiChartD1PalaceWritingGoldenCase['fixtureId']
    caseFingerprint: string
    planFingerprint: string
    status: 'PROBE_SUCCEEDED' | 'PROBE_FAILED'
    completedStage: 'COMPLETE' | 'WRITING' | 'FIDELITY_REVIEW'
    portInvocations: 1 | 2
    attemptedRequests: 0
    executedRequests: 0
    fetchCount: 0
    openAiRequests: 0
    retryPerformed: false
    stages: readonly [
      AiChartD1PalaceWritingPreviewMockEvidenceStage,
      AiChartD1PalaceWritingPreviewMockEvidenceStage,
    ]
    requestProjectionStatus: 'VALIDATED_NOT_PERSISTED'
    measurementStatus: 'OFFLINE_PROBE_ONLY'
    customerDeliveryStatus: 'BLOCKED_PORT_PROBE_ONLY'
    runtimeHandoffStatus: 'NOT_CONNECTED'
    productionAdapterStatus: 'NOT_IMPLEMENTED'
    restrictedArtifactPersisted: false
    safeMetadataOnly: true
  }>

export class AiChartD1PalaceWritingPreviewRuntimePortError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_PORT_INVALID

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_PORT_INVALID,
    )
    this.name =
      'AiChartD1PalaceWritingPreviewRuntimePortError'
    Object.freeze(this)
  }
}

function invalid(): never {
  throw new AiChartD1PalaceWritingPreviewRuntimePortError()
}

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function createWritingCommand(
  bridge: ReturnType<
    typeof buildAiChartD1PalaceWritingAdapterBridge
  >,
): AiChartD1PalaceWritingPreviewRuntimePortCommand {
  return freezeAiChartD1Value({
    runtimeMode: 'INJECTED_PORT_PROBE_ONLY' as const,
    sequence: 1 as const,
    stage: 'WRITING' as const,
    bridgeFingerprint:
      bridge.descriptor.bridgeFingerprint,
    request: bridge.request,
  })
}

function createFidelityCommand(
  bridge: ReturnType<
    typeof buildAiChartD1PalaceWritingFidelityAdapterBridge
  >,
): AiChartD1PalaceWritingPreviewRuntimePortCommand {
  return freezeAiChartD1Value({
    runtimeMode: 'INJECTED_PORT_PROBE_ONLY' as const,
    sequence: 2 as const,
    stage: 'FIDELITY_REVIEW' as const,
    bridgeFingerprint:
      bridge.descriptor.bridgeFingerprint,
    request: bridge.request,
  })
}

function createProbeResult(
  goldenCase: AiChartD1PalaceWritingGoldenCase,
  value: Awaited<
    ReturnType<
      typeof runAiChartD1PalaceWritingPreviewMockRuntime
    >
  >,
): AiChartD1PalaceWritingPreviewRuntimePortProbeResult {
  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_PORT_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_PORT_TASK,
    runtimeMode: 'INJECTED_PORT_PROBE_ONLY' as const,
    fixtureId: goldenCase.fixtureId,
    caseFingerprint: value.caseFingerprint,
    planFingerprint: value.planFingerprint,
    status:
      value.status === 'SIMULATED_SUCCEEDED'
        ? ('PROBE_SUCCEEDED' as const)
        : ('PROBE_FAILED' as const),
    completedStage: value.completedStage,
    portInvocations: value.mockStageExecutions,
    attemptedRequests: 0 as const,
    executedRequests: 0 as const,
    fetchCount: 0 as const,
    openAiRequests: 0 as const,
    retryPerformed: false as const,
    stages: value.stages,
    requestProjectionStatus:
      'VALIDATED_NOT_PERSISTED' as const,
    measurementStatus: 'OFFLINE_PROBE_ONLY' as const,
    customerDeliveryStatus:
      'BLOCKED_PORT_PROBE_ONLY' as const,
    runtimeHandoffStatus: 'NOT_CONNECTED' as const,
    productionAdapterStatus: 'NOT_IMPLEMENTED' as const,
    restrictedArtifactPersisted: false as const,
    safeMetadataOnly: true as const,
  })
}

export async function probeAiChartD1PalaceWritingPreviewRuntimePort(
  input: Readonly<{
    previewPlan: unknown
    goldenCase: unknown
    executeStage: AiChartD1PalaceWritingPreviewRuntimePort
  }>,
): Promise<AiChartD1PalaceWritingPreviewRuntimePortProbeResult> {
  if (
    !isPlainObject(input) ||
    typeof input.executeStage !== 'function' ||
    process.env.NODE_ENV !== 'test'
  ) {
    invalid()
  }

  let goldenCase: AiChartD1PalaceWritingGoldenCase
  let previewPlan: ReturnType<
    typeof parseAiChartD1PalaceWritingPreviewPlan
  >
  let writingBridge: ReturnType<
    typeof buildAiChartD1PalaceWritingAdapterBridge
  >
  try {
    goldenCase =
      parseAiChartD1PalaceWritingGoldenCase(input.goldenCase)
    previewPlan =
      parseAiChartD1PalaceWritingPreviewPlan(input.previewPlan)
    writingBridge =
      buildAiChartD1PalaceWritingAdapterBridge(
        goldenCase.writingPromptPackage,
      )
  } catch {
    invalid()
  }

  if (
    previewPlan.stages[0].bridgeBinding !==
      'EXACT_PLAN_FINGERPRINT' ||
    previewPlan.stages[0].bridgeFingerprint !==
      writingBridge.descriptor.bridgeFingerprint ||
    previewPlan.stages[1].bridgeBinding !==
      'DERIVED_FROM_VALIDATED_WRITING_RESULT'
  ) {
    invalid()
  }

  let writingResult: AiChartD1PalaceWritingResult | null =
    null
  let result: Awaited<
    ReturnType<
      typeof runAiChartD1PalaceWritingPreviewMockRuntime
    >
  >
  try {
    result =
      await runAiChartD1PalaceWritingPreviewMockRuntime({
        previewPlan,
        goldenCase,
        executeStage: async (stageCommand) => {
          if (stageCommand.stage === 'WRITING') {
            if (
              stageCommand.sequence !== 1 ||
              stageCommand.bridgeFingerprint !==
                writingBridge.descriptor.bridgeFingerprint
            ) {
              throw new AiChartD1PalaceWritingPreviewMockRuntimeError()
            }
            const outcome = await input.executeStage(
              createWritingCommand(writingBridge),
            )
            if (
              isPlainObject(outcome) &&
              outcome.status === 'SUCCEEDED'
            ) {
              try {
                writingResult =
                  writingBridge.request.parseResult(
                    outcome.output,
                  )
              } catch {
                writingResult = null
              }
            }
            return outcome
          }

          if (
            stageCommand.sequence !== 2 ||
            writingResult === null
          ) {
            throw new AiChartD1PalaceWritingPreviewMockRuntimeError()
          }
          const fidelityPromptPackage =
            buildAiChartD1PalaceWritingFidelityPromptPackage(
              goldenCase.writingPromptPackage,
              writingResult,
            )
          const fidelityBridge =
            buildAiChartD1PalaceWritingFidelityAdapterBridge(
              fidelityPromptPackage,
              goldenCase.writingPromptPackage,
              writingResult,
            )
          if (
            stageCommand.bridgeFingerprint !==
              fidelityBridge.descriptor.bridgeFingerprint
          ) {
            throw new AiChartD1PalaceWritingPreviewMockRuntimeError()
          }
          return input.executeStage(
            createFidelityCommand(fidelityBridge),
          )
        },
      })
  } catch {
    invalid()
  }

  return createProbeResult(goldenCase, result)
}
