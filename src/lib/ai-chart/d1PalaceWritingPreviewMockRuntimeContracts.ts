import { createHash } from 'node:crypto'
import {
  freezeAiChartD1Value,
} from './d1CommonContracts'
import {
  buildAiChartD1PalaceWritingAdapterBridge,
  buildAiChartD1PalaceWritingFidelityAdapterBridge,
} from './d1PalaceWritingAdapterBridgeContracts'
import {
  buildAiChartD1PalaceWritingFidelityPromptPackage,
  createAiChartD1PalaceWritingFidelityCanonicalJson,
} from './d1PalaceWritingFidelityPromptPackageContracts'
import {
  parseAiChartD1PalaceWritingGoldenCase,
  type AiChartD1PalaceWritingGoldenCase,
} from './d1PalaceWritingGoldenCaseContracts'
import {
  AI_CHART_D1_PALACE_WRITING_PREVIEW_FAILURE_CODES,
  parseAiChartD1PalaceWritingPreviewPlan,
  type AiChartD1PalaceWritingPreviewFailureCode,
  type AiChartD1PalaceWritingPreviewUsage,
} from './d1PalaceWritingPreviewContracts'
import {
  createAiChartD1PalaceWritingResultSha256,
  type AiChartD1PalaceWritingResult,
} from './d1PalaceWritingResultContracts'

export const AI_CHART_D1_PALACE_WRITING_PREVIEW_MOCK_RUNTIME_VERSION =
  'ai-chart-d1-palace-writing-preview-mock-runtime/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_MOCK_RUNTIME_TASK =
  'D1_PALACE_WRITING_PREVIEW_MOCK_RUNTIME' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_MOCK_RUNTIME_INVALID =
  'ai_chart_d1_palace_writing_preview_mock_runtime_invalid' as const

export type AiChartD1PalaceWritingPreviewMockStageCommand =
  Readonly<{
    runtimeMode: 'MOCK_ONLY'
    sequence: 1 | 2
    stage: 'WRITING' | 'FIDELITY_REVIEW'
    bridgeFingerprint: string
  }>

export type AiChartD1PalaceWritingPreviewMockStageOutcome =
  | Readonly<{
      status: 'SUCCEEDED'
      durationMs: number
      usage: AiChartD1PalaceWritingPreviewUsage
      output: unknown
    }>
  | Readonly<{
      status: 'REQUEST_FAILED'
      durationMs: number
      usage: AiChartD1PalaceWritingPreviewUsage | null
    }>

export type AiChartD1PalaceWritingPreviewMockStageExecutor = (
  command: AiChartD1PalaceWritingPreviewMockStageCommand,
) => Promise<AiChartD1PalaceWritingPreviewMockStageOutcome>

export type AiChartD1PalaceWritingPreviewMockEvidenceStage =
  | Readonly<{
      sequence: 1 | 2
      stage: 'WRITING' | 'FIDELITY_REVIEW'
      bridgeFingerprint: string
      status: 'SIMULATED_SUCCEEDED'
      durationMs: number
      usage: AiChartD1PalaceWritingPreviewUsage
      resultFingerprint: string
      errorCode: null
    }>
  | Readonly<{
      sequence: 1 | 2
      stage: 'WRITING' | 'FIDELITY_REVIEW'
      bridgeFingerprint: string
      status: 'SIMULATED_FAILED'
      durationMs: number | null
      usage: AiChartD1PalaceWritingPreviewUsage | null
      resultFingerprint: null
      errorCode: AiChartD1PalaceWritingPreviewFailureCode
    }>
  | Readonly<{
      sequence: 1 | 2
      stage: 'WRITING' | 'FIDELITY_REVIEW'
      bridgeFingerprint: string
      status: 'NOT_STARTED'
      durationMs: null
      usage: null
      resultFingerprint: null
      errorCode: null
    }>

export type AiChartD1PalaceWritingPreviewMockRuntimeResult =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_MOCK_RUNTIME_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_MOCK_RUNTIME_TASK
    runtimeMode: 'MOCK_ONLY'
    fixtureId: AiChartD1PalaceWritingGoldenCase['fixtureId']
    caseFingerprint: string
    planFingerprint: string
    status: 'SIMULATED_SUCCEEDED' | 'SIMULATED_FAILED'
    completedStage: 'COMPLETE' | 'WRITING' | 'FIDELITY_REVIEW'
    mockStageExecutions: 1 | 2
    attemptedRequests: 0
    executedRequests: 0
    fetchCount: 0
    openAiRequests: 0
    retryPerformed: false
    stages: readonly [
      AiChartD1PalaceWritingPreviewMockEvidenceStage,
      AiChartD1PalaceWritingPreviewMockEvidenceStage,
    ]
    measurementStatus: 'SIMULATED_ONLY'
    customerDeliveryStatus: 'BLOCKED_MOCK_ONLY'
    restrictedArtifactPersisted: false
    safeMetadataOnly: true
  }>

export class AiChartD1PalaceWritingPreviewMockRuntimeError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_PREVIEW_MOCK_RUNTIME_INVALID

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_PREVIEW_MOCK_RUNTIME_INVALID,
    )
    this.name =
      'AiChartD1PalaceWritingPreviewMockRuntimeError'
    Object.freeze(this)
  }
}

function invalid(): never {
  throw new AiChartD1PalaceWritingPreviewMockRuntimeError()
}

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function parsePositiveInteger(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value <= 0 ||
    value > Number.MAX_SAFE_INTEGER
  ) {
    invalid()
  }
  return value
}

function parseNonNegativeInteger(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > Number.MAX_SAFE_INTEGER
  ) {
    invalid()
  }
  return value
}

function parseUsage(
  value: unknown,
): AiChartD1PalaceWritingPreviewUsage {
  if (!isPlainObject(value)) invalid()
  const keys = Object.keys(value).sort()
  if (
    keys.join('\0') !==
    [
      'inputTokens',
      'outputTokens',
      'reasoningTokens',
      'totalTokens',
    ]
      .sort()
      .join('\0')
  ) {
    invalid()
  }
  const inputTokens = parseNonNegativeInteger(value.inputTokens)
  const outputTokens = parseNonNegativeInteger(value.outputTokens)
  const reasoningTokens = parseNonNegativeInteger(
    value.reasoningTokens,
  )
  const totalTokens = parseNonNegativeInteger(value.totalTokens)
  if (
    reasoningTokens > outputTokens ||
    totalTokens !== inputTokens + outputTokens
  ) {
    invalid()
  }
  return freezeAiChartD1Value({
    inputTokens,
    outputTokens,
    reasoningTokens,
    totalTokens,
  })
}

function parseOutcome(
  value: unknown,
): AiChartD1PalaceWritingPreviewMockStageOutcome {
  if (!isPlainObject(value) || typeof value.status !== 'string') {
    invalid()
  }
  if (value.status === 'REQUEST_FAILED') {
    if (
      Object.keys(value).sort().join('\0') !==
      ['durationMs', 'status', 'usage'].sort().join('\0')
    ) {
      invalid()
    }
    return freezeAiChartD1Value({
      status: 'REQUEST_FAILED' as const,
      durationMs: parsePositiveInteger(value.durationMs),
      usage: value.usage === null ? null : parseUsage(value.usage),
    })
  }
  if (
    value.status !== 'SUCCEEDED' ||
    Object.keys(value).sort().join('\0') !==
      ['durationMs', 'output', 'status', 'usage']
        .sort()
        .join('\0')
  ) {
    invalid()
  }
  return Object.freeze({
    status: 'SUCCEEDED' as const,
    durationMs: parsePositiveInteger(value.durationMs),
    usage: parseUsage(value.usage),
    output: value.output,
  })
}

function sha256Canonical(value: unknown): string {
  return createHash('sha256')
    .update(
      createAiChartD1PalaceWritingFidelityCanonicalJson(value),
      'utf8',
    )
    .digest('hex')
}

function createCommand(
  sequence: 1 | 2,
  stage: 'WRITING' | 'FIDELITY_REVIEW',
  bridgeFingerprint: string,
): AiChartD1PalaceWritingPreviewMockStageCommand {
  return freezeAiChartD1Value({
    runtimeMode: 'MOCK_ONLY' as const,
    sequence,
    stage,
    bridgeFingerprint,
  })
}

function createNotStartedStage(
  sequence: 1 | 2,
  stage: 'WRITING' | 'FIDELITY_REVIEW',
  bridgeFingerprint: string,
): AiChartD1PalaceWritingPreviewMockEvidenceStage {
  return freezeAiChartD1Value({
    sequence,
    stage,
    bridgeFingerprint,
    status: 'NOT_STARTED' as const,
    durationMs: null,
    usage: null,
    resultFingerprint: null,
    errorCode: null,
  })
}

function createFailedStage(
  command: AiChartD1PalaceWritingPreviewMockStageCommand,
  errorCode: AiChartD1PalaceWritingPreviewFailureCode,
  outcome?: AiChartD1PalaceWritingPreviewMockStageOutcome,
): AiChartD1PalaceWritingPreviewMockEvidenceStage {
  if (
    !AI_CHART_D1_PALACE_WRITING_PREVIEW_FAILURE_CODES.includes(
      errorCode,
    )
  ) {
    invalid()
  }
  return freezeAiChartD1Value({
    sequence: command.sequence,
    stage: command.stage,
    bridgeFingerprint: command.bridgeFingerprint,
    status: 'SIMULATED_FAILED' as const,
    durationMs:
      outcome?.status === 'REQUEST_FAILED'
        ? outcome.durationMs
        : outcome?.status === 'SUCCEEDED'
          ? outcome.durationMs
          : null,
    usage: outcome === undefined ? null : outcome.usage,
    resultFingerprint: null,
    errorCode,
  })
}

function createSucceededStage(
  command: AiChartD1PalaceWritingPreviewMockStageCommand,
  outcome: Extract<
    AiChartD1PalaceWritingPreviewMockStageOutcome,
    { status: 'SUCCEEDED' }
  >,
  resultFingerprint: string,
): AiChartD1PalaceWritingPreviewMockEvidenceStage {
  return freezeAiChartD1Value({
    sequence: command.sequence,
    stage: command.stage,
    bridgeFingerprint: command.bridgeFingerprint,
    status: 'SIMULATED_SUCCEEDED' as const,
    durationMs: outcome.durationMs,
    usage: outcome.usage,
    resultFingerprint,
    errorCode: null,
  })
}

function createResult(
  goldenCase: AiChartD1PalaceWritingGoldenCase,
  planFingerprint: string,
  value: Readonly<{
    status: 'SIMULATED_SUCCEEDED' | 'SIMULATED_FAILED'
    completedStage: 'COMPLETE' | 'WRITING' | 'FIDELITY_REVIEW'
    mockStageExecutions: 1 | 2
    stages: readonly [
      AiChartD1PalaceWritingPreviewMockEvidenceStage,
      AiChartD1PalaceWritingPreviewMockEvidenceStage,
    ]
  }>,
): AiChartD1PalaceWritingPreviewMockRuntimeResult {
  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_MOCK_RUNTIME_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_MOCK_RUNTIME_TASK,
    runtimeMode: 'MOCK_ONLY' as const,
    fixtureId: goldenCase.fixtureId,
    caseFingerprint: goldenCase.caseFingerprint,
    planFingerprint,
    status: value.status,
    completedStage: value.completedStage,
    mockStageExecutions: value.mockStageExecutions,
    attemptedRequests: 0 as const,
    executedRequests: 0 as const,
    fetchCount: 0 as const,
    openAiRequests: 0 as const,
    retryPerformed: false as const,
    stages: value.stages,
    measurementStatus: 'SIMULATED_ONLY' as const,
    customerDeliveryStatus: 'BLOCKED_MOCK_ONLY' as const,
    restrictedArtifactPersisted: false as const,
    safeMetadataOnly: true as const,
  })
}

async function executeMockStage(
  executeStage: AiChartD1PalaceWritingPreviewMockStageExecutor,
  command: AiChartD1PalaceWritingPreviewMockStageCommand,
): Promise<
  | Readonly<{
      status: 'RETURNED'
      outcome: AiChartD1PalaceWritingPreviewMockStageOutcome
    }>
  | Readonly<{ status: 'THREW' }>
> {
  try {
    return Object.freeze({
      status: 'RETURNED' as const,
      outcome: parseOutcome(await executeStage(command)),
    })
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingPreviewMockRuntimeError
    ) {
      throw error
    }
    return Object.freeze({ status: 'THREW' as const })
  }
}

export async function runAiChartD1PalaceWritingPreviewMockRuntime(
  input: Readonly<{
    previewPlan: unknown
    goldenCase: unknown
    executeStage: AiChartD1PalaceWritingPreviewMockStageExecutor
  }>,
): Promise<AiChartD1PalaceWritingPreviewMockRuntimeResult> {
  if (!isPlainObject(input) || typeof input.executeStage !== 'function') {
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

  const writingCommand = createCommand(
    1,
    'WRITING',
    writingBridge.descriptor.bridgeFingerprint,
  )
  const writingExecution = await executeMockStage(
    input.executeStage,
    writingCommand,
  )
  const plannedFidelityStage = createNotStartedStage(
    2,
    'FIDELITY_REVIEW',
    previewPlan.stages[1].bridgeFingerprint,
  )
  if (writingExecution.status === 'THREW') {
    return createResult(
      goldenCase,
      previewPlan.planFingerprint,
      {
        status: 'SIMULATED_FAILED',
        completedStage: 'WRITING',
        mockStageExecutions: 1,
        stages: [
          createFailedStage(
            writingCommand,
            'WRITING_REQUEST_FAILED',
          ),
          plannedFidelityStage,
        ],
      },
    )
  }
  if (writingExecution.outcome.status === 'REQUEST_FAILED') {
    return createResult(
      goldenCase,
      previewPlan.planFingerprint,
      {
        status: 'SIMULATED_FAILED',
        completedStage: 'WRITING',
        mockStageExecutions: 1,
        stages: [
          createFailedStage(
            writingCommand,
            'WRITING_REQUEST_FAILED',
            writingExecution.outcome,
          ),
          plannedFidelityStage,
        ],
      },
    )
  }

  let writingResult: AiChartD1PalaceWritingResult
  try {
    writingResult = writingBridge.request.parseResult(
      writingExecution.outcome.output,
    )
  } catch {
    return createResult(
      goldenCase,
      previewPlan.planFingerprint,
      {
        status: 'SIMULATED_FAILED',
        completedStage: 'WRITING',
        mockStageExecutions: 1,
        stages: [
          createFailedStage(
            writingCommand,
            'WRITING_OUTPUT_INVALID',
            writingExecution.outcome,
          ),
          plannedFidelityStage,
        ],
      },
    )
  }
  const writingStage = createSucceededStage(
    writingCommand,
    writingExecution.outcome,
    createAiChartD1PalaceWritingResultSha256(writingResult),
  )

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
  const fidelityCommand = createCommand(
    2,
    'FIDELITY_REVIEW',
    fidelityBridge.descriptor.bridgeFingerprint,
  )
  const fidelityExecution = await executeMockStage(
    input.executeStage,
    fidelityCommand,
  )
  if (fidelityExecution.status === 'THREW') {
    return createResult(
      goldenCase,
      previewPlan.planFingerprint,
      {
        status: 'SIMULATED_FAILED',
        completedStage: 'FIDELITY_REVIEW',
        mockStageExecutions: 2,
        stages: [
          writingStage,
          createFailedStage(
            fidelityCommand,
            'FIDELITY_REVIEW_REQUEST_FAILED',
          ),
        ],
      },
    )
  }
  if (fidelityExecution.outcome.status === 'REQUEST_FAILED') {
    return createResult(
      goldenCase,
      previewPlan.planFingerprint,
      {
        status: 'SIMULATED_FAILED',
        completedStage: 'FIDELITY_REVIEW',
        mockStageExecutions: 2,
        stages: [
          writingStage,
          createFailedStage(
            fidelityCommand,
            'FIDELITY_REVIEW_REQUEST_FAILED',
            fidelityExecution.outcome,
          ),
        ],
      },
    )
  }

  let fidelityReview
  try {
    fidelityReview = fidelityBridge.request.parseResult(
      fidelityExecution.outcome.output,
    )
  } catch {
    return createResult(
      goldenCase,
      previewPlan.planFingerprint,
      {
        status: 'SIMULATED_FAILED',
        completedStage: 'FIDELITY_REVIEW',
        mockStageExecutions: 2,
        stages: [
          writingStage,
          createFailedStage(
            fidelityCommand,
            'FIDELITY_REVIEW_OUTPUT_INVALID',
            fidelityExecution.outcome,
          ),
        ],
      },
    )
  }

  return createResult(
    goldenCase,
    previewPlan.planFingerprint,
    {
      status: 'SIMULATED_SUCCEEDED',
      completedStage: 'COMPLETE',
      mockStageExecutions: 2,
      stages: [
        writingStage,
        createSucceededStage(
          fidelityCommand,
          fidelityExecution.outcome,
          sha256Canonical(fidelityReview),
        ),
      ],
    },
  )
}
