import { createHash } from 'node:crypto'
import { AI_CHART_D1_MODEL_TARGET } from './d1Assets'
import {
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import {
  AI_CHART_D1_PALACE_WRITING_MAX_OUTPUT_TOKENS,
  AI_CHART_D1_PALACE_WRITING_REVIEW_MAX_OUTPUT_TOKENS,
} from './d1PalaceWritingAdapterBridgeContracts'
import {
  buildAiChartD1PalaceWritingGoldenCase,
  parseAiChartD1PalaceWritingGoldenCase,
  type AiChartD1PalaceWritingGoldenCase,
} from './d1PalaceWritingGoldenCaseContracts'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'
import {
  AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
  AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
} from './openAiResponses'

export const AI_CHART_D1_PALACE_WRITING_PREVIEW_PLAN_VERSION =
  'ai-chart-d1-palace-writing-preview-plan/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_TASK =
  'D1_PALACE_WRITING_CONTROLLED_PREVIEW' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_VERSION =
  'ai-chart-d1-palace-writing-preview-evidence/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_TASK =
  'D1_PALACE_WRITING_CONTROLLED_PREVIEW_EVIDENCE' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_INVALID =
  'ai_chart_d1_palace_writing_preview_invalid' as const

export const AI_CHART_D1_PALACE_WRITING_PREVIEW_FAILURE_CODES =
  freezeAiChartD1Value([
    'WRITING_REQUEST_FAILED',
    'WRITING_OUTPUT_INVALID',
    'FIDELITY_REVIEW_REQUEST_FAILED',
    'FIDELITY_REVIEW_OUTPUT_INVALID',
  ] as const)

export type AiChartD1PalaceWritingPreviewFailureCode =
  (typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_FAILURE_CODES)[number]

export type AiChartD1PalaceWritingPreviewStage =
  Readonly<{
    sequence: 1 | 2
    stage: 'WRITING' | 'FIDELITY_REVIEW'
    bridgeBinding:
      | 'EXACT_PLAN_FINGERPRINT'
      | 'DERIVED_FROM_VALIDATED_WRITING_RESULT'
    bridgeFingerprint: string
    modelTarget: typeof AI_CHART_D1_MODEL_TARGET
    reasoningEffort:
      typeof AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT
    timeoutMs: typeof AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS
    maxOutputTokens:
      | typeof AI_CHART_D1_PALACE_WRITING_MAX_OUTPUT_TOKENS
      | typeof AI_CHART_D1_PALACE_WRITING_REVIEW_MAX_OUTPUT_TOKENS
  }>

export type AiChartD1PalaceWritingPreviewPlan =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_PLAN_VERSION
    task: typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_TASK
    fixtureId: AiChartD1PalaceWritingGoldenCase['fixtureId']
    caseFingerprint: string
    executionMode: 'SEQUENTIAL'
    stages: readonly AiChartD1PalaceWritingPreviewStage[]
    maxRequests: 2
    fetchHardLimit: 2
    retry: false
    qualityDimensions:
      AiChartD1PalaceWritingGoldenCase['benchmarkPlan']['qualityDimensions']
    humanReviewRequired: true
    evidenceProducerPolicy: 'TRUSTED_SERVER_RUNNER_ONLY'
    evidenceSummaryPolicy: 'SAFE_METADATA_ONLY'
    resultArtifactPolicy: 'SEPARATE_RESTRICTED_ARTIFACT'
    modelOutputAllowedInEvidenceSummary: false
    authorizationStatus: 'not_authorized'
    runtimeStatus: 'runtime_not_implemented'
    openAiCallable: false
    planFingerprint: string
  }>

export type AiChartD1PalaceWritingPreviewUsage =
  Readonly<{
    inputTokens: number
    outputTokens: number
    reasoningTokens: number
    totalTokens: number
  }>

export type AiChartD1PalaceWritingPreviewEvidenceStage =
  | Readonly<{
      sequence: 1 | 2
      stage: 'WRITING' | 'FIDELITY_REVIEW'
      bridgeFingerprint: string
      status: 'SUCCEEDED'
      durationMs: number
      usage: AiChartD1PalaceWritingPreviewUsage
      resultFingerprint: string
      errorCode: null
    }>
  | Readonly<{
      sequence: 1 | 2
      stage: 'WRITING' | 'FIDELITY_REVIEW'
      bridgeFingerprint: string
      status: 'FAILED'
      durationMs: number
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

export type AiChartD1PalaceWritingPreviewQualityAssessment =
  Readonly<{
    dimension:
      AiChartD1PalaceWritingGoldenCase['benchmarkPlan']['qualityDimensions'][number]
    status:
      | 'TECHNICALLY_VALIDATED'
      | 'NEEDS_HUMAN_REVIEW'
      | 'NOT_AVAILABLE'
  }>

export type AiChartD1PalaceWritingPreviewEvidence =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_VERSION
    task: typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_TASK
    fixtureId: AiChartD1PalaceWritingGoldenCase['fixtureId']
    caseFingerprint: string
    planFingerprint: string
    status: 'SUCCEEDED' | 'FAILED'
    completedStage: 'COMPLETE' | 'WRITING' | 'FIDELITY_REVIEW'
    attemptedRequests: 1 | 2
    executedRequests: 0 | 1 | 2
    fetchCount: 0 | 1 | 2
    retryPerformed: false
    stages: readonly [
      AiChartD1PalaceWritingPreviewEvidenceStage,
      AiChartD1PalaceWritingPreviewEvidenceStage,
    ]
    technicalValidationStatus: 'VALIDATED' | 'FAILED'
    qualityMeasurementStatus:
      | 'PENDING_HUMAN_REVIEW'
      | 'NOT_AVAILABLE'
    humanReviewStatus: 'NOT_REVIEWED'
    customerDeliveryStatus:
      | 'BLOCKED_PENDING_HUMAN_REVIEW'
      | 'BLOCKED'
    qualityAssessments:
      readonly AiChartD1PalaceWritingPreviewQualityAssessment[]
    summaryPolicy: Readonly<{
      safeMetadataOnly: true
      modelOutputPersisted: false
      promptPersisted: false
      requestBodyPersisted: false
      chartDataPersisted: false
      birthDataPersisted: false
      restrictedResultArtifactRequiredForHumanReview: true
    }>
  }>

export class AiChartD1PalaceWritingPreviewError extends Error {
  readonly code = AI_CHART_D1_PALACE_WRITING_PREVIEW_INVALID

  constructor() {
    super(AI_CHART_D1_PALACE_WRITING_PREVIEW_INVALID)
    this.name = 'AiChartD1PalaceWritingPreviewError'
    Object.freeze(this)
  }
}

function invalid(): never {
  throw new AiChartD1PalaceWritingPreviewError()
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function parseExactInteger<const Expected extends number>(
  value: unknown,
  expected: Expected,
): Expected {
  if (!Number.isInteger(value) || value !== expected) invalid()
  return expected
}

function parsePositiveInteger(value: unknown): number {
  if (
    !Number.isInteger(value) ||
    typeof value !== 'number' ||
    value <= 0 ||
    value > Number.MAX_SAFE_INTEGER
  ) {
    invalid()
  }
  return value
}

function parseNonNegativeInteger(value: unknown): number {
  if (
    !Number.isInteger(value) ||
    typeof value !== 'number' ||
    value < 0 ||
    value > Number.MAX_SAFE_INTEGER
  ) {
    invalid()
  }
  return value
}

function parseSha256(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(value)
  ) {
    invalid()
  }
  return value
}

function createPlan(
  goldenCase: AiChartD1PalaceWritingGoldenCase,
): AiChartD1PalaceWritingPreviewPlan {
  const withoutFingerprint = {
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_PLAN_VERSION,
    task: AI_CHART_D1_PALACE_WRITING_PREVIEW_TASK,
    fixtureId: goldenCase.fixtureId,
    caseFingerprint: goldenCase.caseFingerprint,
    executionMode: 'SEQUENTIAL',
    stages: goldenCase.benchmarkPlan.stages.map((stage) => ({
      sequence: stage.sequence,
      stage: stage.stage,
      bridgeBinding:
        stage.stage === 'WRITING'
          ? ('EXACT_PLAN_FINGERPRINT' as const)
          : ('DERIVED_FROM_VALIDATED_WRITING_RESULT' as const),
      bridgeFingerprint: stage.bridgeFingerprint,
      modelTarget: goldenCase.benchmarkPlan.modelTarget,
      reasoningEffort: stage.reasoningEffort,
      timeoutMs: stage.timeoutMs,
      maxOutputTokens: stage.maxOutputTokens,
    })),
    maxRequests: 2,
    fetchHardLimit: 2,
    retry: false,
    qualityDimensions:
      goldenCase.benchmarkPlan.qualityDimensions,
    humanReviewRequired: true,
    evidenceProducerPolicy: 'TRUSTED_SERVER_RUNNER_ONLY',
    evidenceSummaryPolicy: 'SAFE_METADATA_ONLY',
    resultArtifactPolicy: 'SEPARATE_RESTRICTED_ARTIFACT',
    modelOutputAllowedInEvidenceSummary: false,
    authorizationStatus: 'not_authorized',
    runtimeStatus: 'runtime_not_implemented',
    openAiCallable: false,
  } as const

  return freezeAiChartD1Value({
    ...withoutFingerprint,
    planFingerprint: sha256(
      createAiChartD1PalaceWritingCanonicalJson(
        withoutFingerprint,
      ),
    ),
  })
}

const PREVIEW_PLAN = createPlan(
  buildAiChartD1PalaceWritingGoldenCase(),
)
const PREVIEW_PLAN_CANONICAL_JSON =
  createAiChartD1PalaceWritingCanonicalJson(PREVIEW_PLAN)

export function buildAiChartD1PalaceWritingPreviewPlan(
  goldenCaseValue: unknown,
): AiChartD1PalaceWritingPreviewPlan {
  parseAiChartD1PalaceWritingGoldenCase(goldenCaseValue)
  return PREVIEW_PLAN
}

export function parseAiChartD1PalaceWritingPreviewPlan(
  value: unknown,
): AiChartD1PalaceWritingPreviewPlan {
  try {
    if (
      createAiChartD1PalaceWritingCanonicalJson(value) !==
      PREVIEW_PLAN_CANONICAL_JSON
    ) {
      invalid()
    }
    return PREVIEW_PLAN
  } catch (error) {
    if (error instanceof AiChartD1PalaceWritingPreviewError) {
      throw error
    }
    invalid()
  }
}

const EVIDENCE_FIELDS = [
  'contractVersion',
  'task',
  'fixtureId',
  'caseFingerprint',
  'planFingerprint',
  'status',
  'completedStage',
  'attemptedRequests',
  'executedRequests',
  'fetchCount',
  'retryPerformed',
  'stages',
  'technicalValidationStatus',
  'qualityMeasurementStatus',
  'humanReviewStatus',
  'customerDeliveryStatus',
  'qualityAssessments',
  'summaryPolicy',
] as const

const STAGE_FIELDS = [
  'sequence',
  'stage',
  'bridgeFingerprint',
  'status',
  'durationMs',
  'usage',
  'resultFingerprint',
  'errorCode',
] as const

const USAGE_FIELDS = [
  'inputTokens',
  'outputTokens',
  'reasoningTokens',
  'totalTokens',
] as const

const QUALITY_ASSESSMENT_FIELDS = ['dimension', 'status'] as const

const SUMMARY_POLICY_FIELDS = [
  'safeMetadataOnly',
  'modelOutputPersisted',
  'promptPersisted',
  'requestBodyPersisted',
  'chartDataPersisted',
  'birthDataPersisted',
  'restrictedResultArtifactRequiredForHumanReview',
] as const

const EXPECTED_QUALITY_ASSESSMENTS = [
  {
    dimension: 'SOURCE_FIDELITY',
    status: 'TECHNICALLY_VALIDATED',
  },
  {
    dimension: 'CONTENT_CELL_COVERAGE',
    status: 'TECHNICALLY_VALIDATED',
  },
  {
    dimension: 'PLAIN_LANGUAGE',
    status: 'NEEDS_HUMAN_REVIEW',
  },
  {
    dimension: 'POSSIBILITY_BOUNDARY',
    status: 'NEEDS_HUMAN_REVIEW',
  },
  {
    dimension: 'TAIWAN_CONTEXT',
    status: 'NEEDS_HUMAN_REVIEW',
  },
  {
    dimension: 'NO_INTERNAL_METADATA',
    status: 'TECHNICALLY_VALIDATED',
  },
] as const

const UNAVAILABLE_QUALITY_ASSESSMENTS = [
  'SOURCE_FIDELITY',
  'CONTENT_CELL_COVERAGE',
  'PLAIN_LANGUAGE',
  'POSSIBILITY_BOUNDARY',
  'TAIWAN_CONTEXT',
  'NO_INTERNAL_METADATA',
].map((dimension) => ({
  dimension,
  status: 'NOT_AVAILABLE' as const,
})) as readonly AiChartD1PalaceWritingPreviewQualityAssessment[]

const SUMMARY_POLICY = {
  safeMetadataOnly: true,
  modelOutputPersisted: false,
  promptPersisted: false,
  requestBodyPersisted: false,
  chartDataPersisted: false,
  birthDataPersisted: false,
  restrictedResultArtifactRequiredForHumanReview: true,
} as const

function parseUsage(
  value: unknown,
): AiChartD1PalaceWritingPreviewUsage {
  const record = requireAiChartD1ExactObject(value, USAGE_FIELDS)
  const inputTokens = parseNonNegativeInteger(record.inputTokens)
  const outputTokens = parseNonNegativeInteger(record.outputTokens)
  const reasoningTokens = parseNonNegativeInteger(record.reasoningTokens)
  const totalTokens = parseNonNegativeInteger(record.totalTokens)
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

function parseSucceededStage(
  value: unknown,
  planStage: AiChartD1PalaceWritingPreviewStage,
): AiChartD1PalaceWritingPreviewEvidenceStage {
  const record = requireAiChartD1ExactObject(value, STAGE_FIELDS)
  if (
    record.sequence !== planStage.sequence ||
    record.stage !== planStage.stage ||
    record.status !== 'SUCCEEDED' ||
    record.errorCode !== null
  ) {
    invalid()
  }
  const bridgeFingerprint =
    planStage.bridgeBinding === 'EXACT_PLAN_FINGERPRINT'
      ? record.bridgeFingerprint === planStage.bridgeFingerprint
        ? planStage.bridgeFingerprint
        : invalid()
      : parseSha256(record.bridgeFingerprint)
  return freezeAiChartD1Value({
    sequence: planStage.sequence,
    stage: planStage.stage,
    bridgeFingerprint,
    status: 'SUCCEEDED' as const,
    durationMs: parsePositiveInteger(record.durationMs),
    usage: parseUsage(record.usage),
    resultFingerprint: parseSha256(record.resultFingerprint),
    errorCode: null,
  })
}

function parseFailedStage(
  value: unknown,
  planStage: AiChartD1PalaceWritingPreviewStage,
  allowedErrorCodes:
    readonly AiChartD1PalaceWritingPreviewFailureCode[],
): AiChartD1PalaceWritingPreviewEvidenceStage {
  const record = requireAiChartD1ExactObject(value, STAGE_FIELDS)
  if (
    record.sequence !== planStage.sequence ||
    record.stage !== planStage.stage ||
    record.status !== 'FAILED' ||
    record.resultFingerprint !== null ||
    typeof record.errorCode !== 'string' ||
    !allowedErrorCodes.includes(
      record.errorCode as AiChartD1PalaceWritingPreviewFailureCode,
    )
  ) {
    invalid()
  }
  const bridgeFingerprint =
    planStage.bridgeBinding === 'EXACT_PLAN_FINGERPRINT'
      ? record.bridgeFingerprint === planStage.bridgeFingerprint
        ? planStage.bridgeFingerprint
        : invalid()
      : parseSha256(record.bridgeFingerprint)
  return freezeAiChartD1Value({
    sequence: planStage.sequence,
    stage: planStage.stage,
    bridgeFingerprint,
    status: 'FAILED' as const,
    durationMs: parsePositiveInteger(record.durationMs),
    usage:
      record.usage === null ? null : parseUsage(record.usage),
    resultFingerprint: null,
    errorCode:
      record.errorCode as AiChartD1PalaceWritingPreviewFailureCode,
  })
}

function parsePreFetchFailedStage(
  value: unknown,
  planStage: AiChartD1PalaceWritingPreviewStage,
  requestFailureCode:
    AiChartD1PalaceWritingPreviewFailureCode,
): AiChartD1PalaceWritingPreviewEvidenceStage {
  const stage = parseFailedStage(
    value,
    planStage,
    [requestFailureCode],
  )
  if (
    stage.status !== 'FAILED' ||
    stage.usage !== null ||
    stage.errorCode !== requestFailureCode
  ) {
    invalid()
  }
  return stage
}

function parseNotStartedStage(
  value: unknown,
  planStage: AiChartD1PalaceWritingPreviewStage,
): AiChartD1PalaceWritingPreviewEvidenceStage {
  const record = requireAiChartD1ExactObject(value, STAGE_FIELDS)
  if (
    record.sequence !== planStage.sequence ||
    record.stage !== planStage.stage ||
    record.bridgeFingerprint !== planStage.bridgeFingerprint ||
    record.status !== 'NOT_STARTED' ||
    record.durationMs !== null ||
    record.usage !== null ||
    record.resultFingerprint !== null ||
    record.errorCode !== null
  ) {
    invalid()
  }
  return freezeAiChartD1Value({
    sequence: planStage.sequence,
    stage: planStage.stage,
    bridgeFingerprint: planStage.bridgeFingerprint,
    status: 'NOT_STARTED' as const,
    durationMs: null,
    usage: null,
    resultFingerprint: null,
    errorCode: null,
  })
}

function parseQualityAssessments(
  value: unknown,
  expectedAssessments:
    readonly AiChartD1PalaceWritingPreviewQualityAssessment[],
): AiChartD1PalaceWritingPreviewEvidence['qualityAssessments'] {
  if (
    !Array.isArray(value) ||
    value.length !== expectedAssessments.length
  ) {
    invalid()
  }
  const parsed = value.map((item, index) => {
    const record = requireAiChartD1ExactObject(
      item,
      QUALITY_ASSESSMENT_FIELDS,
    )
    const expected = expectedAssessments[index]
    if (
      record.dimension !== expected.dimension ||
      record.status !== expected.status
    ) {
      invalid()
    }
    return expected
  })
  return freezeAiChartD1Value(
    parsed,
  ) as AiChartD1PalaceWritingPreviewEvidence['qualityAssessments']
}

function parseSummaryPolicy(
  value: unknown,
): AiChartD1PalaceWritingPreviewEvidence['summaryPolicy'] {
  const record = requireAiChartD1ExactObject(
    value,
    SUMMARY_POLICY_FIELDS,
  )
  for (const [key, expected] of Object.entries(SUMMARY_POLICY)) {
    if (record[key] !== expected) invalid()
  }
  return freezeAiChartD1Value(SUMMARY_POLICY)
}

export function parseAiChartD1PalaceWritingPreviewEvidence(
  value: unknown,
  planValue: unknown,
): AiChartD1PalaceWritingPreviewEvidence {
  try {
    const plan = parseAiChartD1PalaceWritingPreviewPlan(planValue)
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(
      value,
      EVIDENCE_FIELDS,
    )
    if (
      record.contractVersion !==
        AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_VERSION ||
      record.task !==
        AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_TASK ||
      record.fixtureId !== plan.fixtureId ||
      record.caseFingerprint !== plan.caseFingerprint ||
      record.planFingerprint !== plan.planFingerprint ||
      record.retryPerformed !== false ||
      record.humanReviewStatus !== 'NOT_REVIEWED' ||
      !Array.isArray(record.stages) ||
      record.stages.length !== 2
    ) {
      invalid()
    }
    const common = {
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_VERSION,
      task: AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_TASK,
      fixtureId: plan.fixtureId,
      caseFingerprint: plan.caseFingerprint,
      planFingerprint: plan.planFingerprint,
      retryPerformed: false as const,
      humanReviewStatus: 'NOT_REVIEWED' as const,
      summaryPolicy: parseSummaryPolicy(record.summaryPolicy),
    }

    if (record.status === 'SUCCEEDED') {
      if (
        record.completedStage !== 'COMPLETE' ||
        record.technicalValidationStatus !== 'VALIDATED' ||
        record.qualityMeasurementStatus !==
          'PENDING_HUMAN_REVIEW' ||
        record.customerDeliveryStatus !==
          'BLOCKED_PENDING_HUMAN_REVIEW'
      ) {
        invalid()
      }
      parseExactInteger(record.attemptedRequests, 2)
      parseExactInteger(record.executedRequests, 2)
      parseExactInteger(record.fetchCount, 2)

      return freezeAiChartD1Value({
        ...common,
        status: 'SUCCEEDED' as const,
        completedStage: 'COMPLETE' as const,
        attemptedRequests: 2 as const,
        executedRequests: 2 as const,
        fetchCount: 2 as const,
        stages: freezeAiChartD1Value([
          parseSucceededStage(record.stages[0], plan.stages[0]),
          parseSucceededStage(record.stages[1], plan.stages[1]),
        ] as const),
        technicalValidationStatus: 'VALIDATED' as const,
        qualityMeasurementStatus:
          'PENDING_HUMAN_REVIEW' as const,
        customerDeliveryStatus:
          'BLOCKED_PENDING_HUMAN_REVIEW' as const,
        qualityAssessments: parseQualityAssessments(
          record.qualityAssessments,
          EXPECTED_QUALITY_ASSESSMENTS,
        ),
      })
    }

    if (
      record.status !== 'FAILED' ||
      record.technicalValidationStatus !== 'FAILED' ||
      record.qualityMeasurementStatus !== 'NOT_AVAILABLE' ||
      record.customerDeliveryStatus !== 'BLOCKED'
    ) {
      invalid()
    }
    const failedCommon = {
      ...common,
      status: 'FAILED' as const,
      technicalValidationStatus: 'FAILED' as const,
      qualityMeasurementStatus: 'NOT_AVAILABLE' as const,
      customerDeliveryStatus: 'BLOCKED' as const,
      qualityAssessments: parseQualityAssessments(
        record.qualityAssessments,
        UNAVAILABLE_QUALITY_ASSESSMENTS,
      ),
    }

    if (record.completedStage === 'WRITING') {
      parseExactInteger(record.attemptedRequests, 1)
      parseExactInteger(record.executedRequests, 0)
      const fetchCount: 0 | 1 =
        record.fetchCount === 0
          ? 0
          : parseExactInteger(record.fetchCount, 1)

      return freezeAiChartD1Value({
        ...failedCommon,
        completedStage: 'WRITING' as const,
        attemptedRequests: 1 as const,
        executedRequests: 0 as const,
        fetchCount,
        stages: freezeAiChartD1Value([
          fetchCount === 0
            ? parsePreFetchFailedStage(
                record.stages[0],
                plan.stages[0],
                'WRITING_REQUEST_FAILED',
              )
            : parseFailedStage(
                record.stages[0],
                plan.stages[0],
                [
                  'WRITING_REQUEST_FAILED',
                  'WRITING_OUTPUT_INVALID',
                ],
              ),
          parseNotStartedStage(record.stages[1], plan.stages[1]),
        ] as const),
      })
    }

    if (record.completedStage === 'FIDELITY_REVIEW') {
      parseExactInteger(record.attemptedRequests, 2)
      parseExactInteger(record.executedRequests, 1)
      const fetchCount: 1 | 2 =
        record.fetchCount === 1
          ? 1
          : parseExactInteger(record.fetchCount, 2)

      return freezeAiChartD1Value({
        ...failedCommon,
        completedStage: 'FIDELITY_REVIEW' as const,
        attemptedRequests: 2 as const,
        executedRequests: 1 as const,
        fetchCount,
        stages: freezeAiChartD1Value([
          parseSucceededStage(record.stages[0], plan.stages[0]),
          fetchCount === 1
            ? parsePreFetchFailedStage(
                record.stages[1],
                plan.stages[1],
                'FIDELITY_REVIEW_REQUEST_FAILED',
              )
            : parseFailedStage(
                record.stages[1],
                plan.stages[1],
                [
                  'FIDELITY_REVIEW_REQUEST_FAILED',
                  'FIDELITY_REVIEW_OUTPUT_INVALID',
                ],
              ),
        ] as const),
      })
    }

    invalid()
  } catch (error) {
    if (error instanceof AiChartD1PalaceWritingPreviewError) {
      throw error
    }
    invalid()
  }
}
