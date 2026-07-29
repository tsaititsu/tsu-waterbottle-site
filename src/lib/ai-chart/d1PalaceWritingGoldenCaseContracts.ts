import { createHash } from 'node:crypto'
import { AI_CHART_D1_MODEL_TARGET } from './d1Assets'
import { freezeAiChartD1Value } from './d1CommonContracts'
import {
  AI_CHART_D1_PALACE_WRITING_MAX_OUTPUT_TOKENS,
  AI_CHART_D1_PALACE_WRITING_REVIEW_MAX_OUTPUT_TOKENS,
  buildAiChartD1PalaceWritingAdapterBridge,
  buildAiChartD1PalaceWritingFidelityAdapterBridge,
} from './d1PalaceWritingAdapterBridgeContracts'
import type { AiChartD1PalaceAxisClaim } from './d1PalaceAxisContracts'
import { AI_CHART_D1_PALACE_CONTENT_GRID_VERSION } from './d1PalaceContentGridContracts'
import {
  buildAiChartD1PalaceWritingFidelityPromptPackage,
  validateAiChartD1PalaceWritingFidelityPromptPackageAgainstSources,
  type AiChartD1PalaceWritingFidelityPromptPackage,
} from './d1PalaceWritingFidelityPromptPackageContracts'
import {
  AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_TASK,
  AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_VERSION,
  validateAiChartD1PalaceWritingFidelityReviewAgainstSources,
  type AiChartD1PalaceWritingFidelityReview,
} from './d1PalaceWritingFidelityReviewContracts'
import { AI_CHART_D1_PALACE_WRITING_PROMPT_INSTRUCTIONS } from './d1PalaceWritingPromptInstructions'
import {
  AI_CHART_D1_PALACE_WRITING_PROMPT_INPUT_VERSION,
  AI_CHART_D1_PALACE_WRITING_PROMPT_INSTRUCTIONS_SHA256,
  AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES,
  AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_TOTAL_UTF8_BYTES,
  AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_USER_INPUT_UTF8_BYTES,
  AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_VERSION,
  AI_CHART_D1_PALACE_WRITING_PROMPT_TASK,
  AI_CHART_D1_PALACE_WRITING_PROMPT_VERSION,
  AI_CHART_D1_PALACE_WRITING_POLICY,
  createAiChartD1PalaceWritingCanonicalJson,
  parseAiChartD1PalaceWritingPromptPackage,
  type AiChartD1PalaceWritingPromptPackage,
} from './d1PalaceWritingPromptPackageContracts'
import {
  AI_CHART_D1_PALACE_WRITING_RESULT_TASK,
  AI_CHART_D1_PALACE_WRITING_RESULT_VERSION,
  createAiChartD1PalaceWritingResultSha256,
  validateAiChartD1PalaceWritingResultAgainstPromptPackage,
  type AiChartD1PalaceWritingResult,
} from './d1PalaceWritingResultContracts'
import { AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION } from './d1PalaceWritingSourceContracts'
import { AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION } from './d1WholeChartRelationContracts'
import {
  AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
  AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
} from './openAiResponses'

export const AI_CHART_D1_PALACE_WRITING_GOLDEN_CASE_VERSION =
  'ai-chart-d1-palace-writing-golden-case/v1' as const
export const AI_CHART_D1_PALACE_WRITING_GOLDEN_CASE_TASK =
  'D1_PALACE_WRITING_GOLDEN_CASE' as const
export const AI_CHART_D1_PALACE_WRITING_BENCHMARK_PLAN_VERSION =
  'ai-chart-d1-palace-writing-benchmark-plan/v1' as const
export const AI_CHART_D1_PALACE_WRITING_GOLDEN_CASE_INVALID =
  'ai_chart_d1_palace_writing_golden_case_invalid' as const

export const AI_CHART_D1_PALACE_WRITING_GOLDEN_CASE_QUALITY_DIMENSIONS =
  freezeAiChartD1Value([
    'SOURCE_FIDELITY',
    'CONTENT_CELL_COVERAGE',
    'PLAIN_LANGUAGE',
    'POSSIBILITY_BOUNDARY',
    'TAIWAN_CONTEXT',
    'NO_INTERNAL_METADATA',
  ] as const)

export type AiChartD1PalaceWritingGoldenCaseQualityDimension =
  (typeof AI_CHART_D1_PALACE_WRITING_GOLDEN_CASE_QUALITY_DIMENSIONS)[number]

export type AiChartD1PalaceWritingGoldenCaseUsage =
  Readonly<{
    inputTokens: number
    outputTokens: number
    reasoningTokens: number
    totalTokens: number
  }>

export type AiChartD1PalaceWritingGoldenCaseBenchmarkStage =
  Readonly<{
    sequence: 1 | 2
    stage: 'WRITING' | 'FIDELITY_REVIEW'
    bridgeFingerprint: string
    reasoningEffort:
      typeof AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT
    timeoutMs: typeof AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS
    maxOutputTokens:
      | typeof AI_CHART_D1_PALACE_WRITING_MAX_OUTPUT_TOKENS
      | typeof AI_CHART_D1_PALACE_WRITING_REVIEW_MAX_OUTPUT_TOKENS
    durationMs: null
    usage: null
  }>

export type AiChartD1PalaceWritingGoldenCaseBenchmarkPlan =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_BENCHMARK_PLAN_VERSION
    modelTarget: typeof AI_CHART_D1_MODEL_TARGET
    executionMode: 'SEQUENTIAL'
    stages: readonly AiChartD1PalaceWritingGoldenCaseBenchmarkStage[]
    maxRequests: 2
    retry: false
    requiredMeasurements: readonly ['DURATION_MS', 'SAFE_USAGE']
    qualityDimensions:
      readonly AiChartD1PalaceWritingGoldenCaseQualityDimension[]
    executionStatus: 'not_executed'
    measurementStatus: 'not_measured'
    openAiCallable: false
  }>

export type AiChartD1PalaceWritingGoldenCase = Readonly<{
  contractVersion:
    typeof AI_CHART_D1_PALACE_WRITING_GOLDEN_CASE_VERSION
  task: typeof AI_CHART_D1_PALACE_WRITING_GOLDEN_CASE_TASK
  fixtureId: 'golden-case:ziwei-ming:v1'
  targetPalaceId: 'palace:ming'
  primaryLifeRegion: 'TW'
  reportLanguage: 'zh-Hant-TW'
  privacy: Readonly<{
    dataClassification: 'SYNTHETIC'
    containsPersonIdentity: false
    containsBirthData: false
    containsChartSnapshot: false
    containsSecrets: false
  }>
  writingPromptPackage: AiChartD1PalaceWritingPromptPackage
  expectedWritingResult: AiChartD1PalaceWritingResult
  fidelityPromptPackage: AiChartD1PalaceWritingFidelityPromptPackage
  expectedFidelityReview: AiChartD1PalaceWritingFidelityReview
  benchmarkPlan: AiChartD1PalaceWritingGoldenCaseBenchmarkPlan
  goldenBaselineStatus: 'approved_reference'
  caseFingerprint: string
}>

export type AiChartD1PalaceWritingGoldenCaseEvaluation =
  Readonly<{
    fixtureId: AiChartD1PalaceWritingGoldenCase['fixtureId']
    caseFingerprint: string
    contractStatus: 'validated'
    sourceBindingStatus: 'validated'
    fidelityStatus: 'approved'
    customerDeliveryStatus: 'ready'
    goldenBaselineStatus: 'approved_reference'
    runtimeMeasurementStatus: 'not_measured'
    readyForControlledPreview: true
    openAiRequests: 0
  }>

export class AiChartD1PalaceWritingGoldenCaseError extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_GOLDEN_CASE_INVALID

  constructor() {
    super(AI_CHART_D1_PALACE_WRITING_GOLDEN_CASE_INVALID)
    this.name = 'AiChartD1PalaceWritingGoldenCaseError'
    Object.freeze(this)
  }
}

function invalid(): never {
  throw new AiChartD1PalaceWritingGoldenCaseError()
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function buildWritingPromptPackage(): AiChartD1PalaceWritingPromptPackage {
  const contentGrid = {
    targetPalaceId: 'palace:ming',
    facetSections: [
      {
        facetId: 'life.core_personality',
        contentCells: [
          {
            contentCellId:
              'content-grid-cell:palace:ming:core-personality',
            targetPalaceId: 'palace:ming',
            facetId: 'life.core_personality',
            sourceCellRefs: [
              'writing-source-cell:palace:ming:core-personality',
            ],
            relationRefs: [],
            writingStatus: 'required',
          },
        ],
      },
      {
        facetId: 'life.values_direction',
        contentCells: [
          {
            contentCellId:
              'content-grid-cell:palace:ming:values-direction',
            targetPalaceId: 'palace:ming',
            facetId: 'life.values_direction',
            sourceCellRefs: [
              'writing-source-cell:palace:ming:values-direction',
            ],
            relationRefs: [],
            writingStatus: 'required',
          },
        ],
      },
    ],
  } as const
  const corePersonalityClaim = {
    claimId: 'axis-claim:palace:ming:ziwei-core',
    facetId: 'life.core_personality',
    actor: 'NATIVE',
    actorBindingRefs: ['actor:native'],
    doubleStarCoreRef: null,
    interactionRoleBindings: null,
    palaceMeaningRefs: [
      'palace-meaning:ming:core-personality',
    ],
    targetCoreRefs: ['star-core:ziwei'],
    targetLocalModifierRefs: [],
    oppositeExpressionRefs: [],
    natalModifierRefs: [],
    mechanismLink:
      '紫微的核心包含重視尊重、面子、主導感與格局；在命宮只可推演為人格可能性。',
    possibleExpressions: [
      '命主可能在意是否被尊重，以及自己的決定是否保有主導感。',
    ],
    constraints: [
      '不得把可能性寫成每次必然發生的事實。',
    ],
  } as const satisfies AiChartD1PalaceAxisClaim
  const valuesDirectionClaim = {
    claimId: 'axis-claim:palace:ming:ziwei-direction',
    facetId: 'life.values_direction',
    actor: 'NATIVE',
    actorBindingRefs: ['actor:native'],
    doubleStarCoreRef: null,
    interactionRoleBindings: null,
    palaceMeaningRefs: [
      'palace-meaning:ming:values-direction',
    ],
    targetCoreRefs: ['star-core:ziwei'],
    targetLocalModifierRefs: [],
    oppositeExpressionRefs: [],
    natalModifierRefs: [],
    mechanismLink:
      '紫微在命宮的價值方向重視身分感、被認可與保有主導空間；生活例子不得改寫此核心。',
    possibleExpressions: [
      '命主可能在工作或合作選擇中，重視體面、認可與主導空間。',
    ],
    constraints: [
      '生活例子只能說明既有核心，不能新增命理。',
    ],
  } as const satisfies AiChartD1PalaceAxisClaim
  const userInputValue = {
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PROMPT_INPUT_VERSION,
    chartId: 'chart:synthetic:ziwei-ming',
    runId: 'run:golden-case:ziwei-ming:v1',
    targetPalaceId: 'palace:ming',
    reportContext: {
      primaryLifeRegion: 'TW',
      reportLanguage: 'zh-Hant-TW',
    },
    contentGrid,
    sourceMaterials: [
      {
        contentCellId:
          'content-grid-cell:palace:ming:core-personality',
        targetPalaceId: 'palace:ming',
        facetId: 'life.core_personality',
        sourceCellRef:
          'writing-source-cell:palace:ming:core-personality',
        sourceKind: 'AXIS_CLAIM',
        sourceRef: 'axis-claim:palace:ming:ziwei-core',
        material: corePersonalityClaim,
      },
      {
        contentCellId:
          'content-grid-cell:palace:ming:values-direction',
        targetPalaceId: 'palace:ming',
        facetId: 'life.values_direction',
        sourceCellRef:
          'writing-source-cell:palace:ming:values-direction',
        sourceKind: 'AXIS_CLAIM',
        sourceRef: 'axis-claim:palace:ming:ziwei-direction',
        material: valuesDirectionClaim,
      },
    ],
    relationContext: [],
    writingPolicy: AI_CHART_D1_PALACE_WRITING_POLICY,
  }
  const userInput =
    createAiChartD1PalaceWritingCanonicalJson(userInputValue)
  const contentGridSha256 = sha256(
    createAiChartD1PalaceWritingCanonicalJson(contentGrid),
  )
  const sourceSnapshotSha256 =
    'cb9491f65303cd16d940a0ed9422a6faebb8724548437bca08e4dfb3107ee973'
  const instructionsUtf8Bytes = Buffer.byteLength(
    AI_CHART_D1_PALACE_WRITING_PROMPT_INSTRUCTIONS,
    'utf8',
  )
  const userInputUtf8Bytes = Buffer.byteLength(userInput, 'utf8')
  const withoutFingerprint = {
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_VERSION,
    promptVersion: AI_CHART_D1_PALACE_WRITING_PROMPT_VERSION,
    task: AI_CHART_D1_PALACE_WRITING_PROMPT_TASK,
    chartId: 'chart:synthetic:ziwei-ming',
    runId: 'run:golden-case:ziwei-ming:v1',
    callId: 'palace-writing-call:palace:ming:golden-v1',
    targetPalaceId: 'palace:ming',
    sourceSnapshotSha256,
    sourceContentGridVersion:
      AI_CHART_D1_PALACE_CONTENT_GRID_VERSION,
    sourceContentGridSha256: contentGridSha256,
    sourceWritingSetVersion:
      AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION,
    sourceWholeChartResultVersion:
      AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION,
    primaryLifeRegion: 'TW',
    reportLanguage: 'zh-Hant-TW',
    instructions:
      AI_CHART_D1_PALACE_WRITING_PROMPT_INSTRUCTIONS,
    instructionsSha256:
      AI_CHART_D1_PALACE_WRITING_PROMPT_INSTRUCTIONS_SHA256,
    userInput,
    userInputSha256: sha256(userInput),
    sourceTrace: {
      sourceSnapshotSha256,
      contentGridSha256,
      contentCellIds: [
        'content-grid-cell:palace:ming:core-personality',
        'content-grid-cell:palace:ming:values-direction',
      ],
      sourceCellRefs: [
        'writing-source-cell:palace:ming:core-personality',
        'writing-source-cell:palace:ming:values-direction',
      ],
      sourceRefs: [
        'axis-claim:palace:ming:ziwei-core',
        'axis-claim:palace:ming:ziwei-direction',
      ],
      relationRefs: [],
    },
    budget: {
      measurement: 'utf8_bytes',
      instructionsUtf8Bytes,
      userInputUtf8Bytes,
      totalUtf8Bytes:
        instructionsUtf8Bytes + userInputUtf8Bytes,
      maxInstructionsUtf8Bytes:
        AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES,
      maxUserInputUtf8Bytes:
        AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_USER_INPUT_UTF8_BYTES,
      maxTotalUtf8Bytes:
        AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_TOTAL_UTF8_BYTES,
      status: 'within_budget',
    },
    writingOutputContractStatus: 'available',
    promptStatus: 'prepared',
    adapterStatus: 'bridge_required',
    customerWritingStatus: 'not_generated',
    openAiCallable: false,
  } as const
  return parseAiChartD1PalaceWritingPromptPackage({
    ...withoutFingerprint,
    packageFingerprint: sha256(
      createAiChartD1PalaceWritingCanonicalJson(
        withoutFingerprint,
      ),
    ),
  })
}

function buildExpectedWritingResult(
  promptPackage: AiChartD1PalaceWritingPromptPackage,
): AiChartD1PalaceWritingResult {
  return validateAiChartD1PalaceWritingResultAgainstPromptPackage(
    {
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_RESULT_VERSION,
      task: AI_CHART_D1_PALACE_WRITING_RESULT_TASK,
      writingResultId:
        'palace-writing-result:palace:ming:golden-v1',
      chartId: promptPackage.chartId,
      runId: promptPackage.runId,
      callId: promptPackage.callId,
      targetPalaceId: promptPackage.targetPalaceId,
      sourcePackageFingerprint:
        promptPackage.packageFingerprint,
      sections: [
        {
          contentCellRef:
            'content-grid-cell:palace:ming:core-personality',
          facetId: 'life.core_personality',
          customerText:
            '因為命宮的紫微重視尊重、面子與主導感，你可能希望自己做事有一定格局，也在意別人是否把你當一回事。當感覺不被尊重時，你可能會更想掌握局面；這是在說你的傾向，不代表每次都會如此。',
        },
        {
          contentCellRef:
            'content-grid-cell:palace:ming:values-direction',
          facetId: 'life.values_direction',
          customerText:
            '你做選擇時，可能會先看這件事是否夠體面、是否符合你心中的身分與方向。例如挑工作或合作方式時，你可能比較在意能不能被認可、能不能保有主導空間，而不只是眼前方便。',
        },
      ],
      resultStatus: 'complete',
      fidelityReviewStatus: 'required',
      customerDeliveryStatus: 'blocked',
    },
    promptPackage,
  )
}

function buildExpectedFidelityReview(
  promptPackage: AiChartD1PalaceWritingPromptPackage,
  writingResult: AiChartD1PalaceWritingResult,
): AiChartD1PalaceWritingFidelityReview {
  return validateAiChartD1PalaceWritingFidelityReviewAgainstSources(
    {
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_VERSION,
      task:
        AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_TASK,
      fidelityReviewId:
        'palace-writing-review:palace:ming:golden-v1',
      chartId: promptPackage.chartId,
      runId: promptPackage.runId,
      callId: promptPackage.callId,
      targetPalaceId: promptPackage.targetPalaceId,
      sourcePackageFingerprint:
        promptPackage.packageFingerprint,
      sourceWritingResultVersion:
        AI_CHART_D1_PALACE_WRITING_RESULT_VERSION,
      sourceWritingResultSha256:
        createAiChartD1PalaceWritingResultSha256(
          writingResult,
        ),
      sectionReviews: writingResult.sections.map((section) => ({
        contentCellRef: section.contentCellRef,
        decision: 'APPROVED',
        issueCodes: [],
        repairScope: 'NONE',
      })),
      fidelityReviewStatus: 'approved',
      customerDeliveryStatus: 'ready',
      rewriteStatus: 'forbidden',
    },
    writingResult,
    promptPackage,
  )
}

function createGoldenCase(): AiChartD1PalaceWritingGoldenCase {
  const writingPromptPackage = buildWritingPromptPackage()
  const expectedWritingResult = buildExpectedWritingResult(
    writingPromptPackage,
  )
  const fidelityPromptPackage =
    buildAiChartD1PalaceWritingFidelityPromptPackage(
      writingPromptPackage,
      expectedWritingResult,
    )
  const expectedFidelityReview =
    buildExpectedFidelityReview(
      writingPromptPackage,
      expectedWritingResult,
    )
  const writingBridge =
    buildAiChartD1PalaceWritingAdapterBridge(
      writingPromptPackage,
    )
  const fidelityBridge =
    buildAiChartD1PalaceWritingFidelityAdapterBridge(
      fidelityPromptPackage,
      writingPromptPackage,
      expectedWritingResult,
    )
  const benchmarkPlan =
    freezeAiChartD1Value<AiChartD1PalaceWritingGoldenCaseBenchmarkPlan>(
      {
        contractVersion:
          AI_CHART_D1_PALACE_WRITING_BENCHMARK_PLAN_VERSION,
        modelTarget: AI_CHART_D1_MODEL_TARGET,
        executionMode: 'SEQUENTIAL',
        stages: [
          {
            sequence: 1,
            stage: 'WRITING',
            bridgeFingerprint:
              writingBridge.descriptor.bridgeFingerprint,
            reasoningEffort:
              AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
            timeoutMs: AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
            maxOutputTokens:
              AI_CHART_D1_PALACE_WRITING_MAX_OUTPUT_TOKENS,
            durationMs: null,
            usage: null,
          },
          {
            sequence: 2,
            stage: 'FIDELITY_REVIEW',
            bridgeFingerprint:
              fidelityBridge.descriptor.bridgeFingerprint,
            reasoningEffort:
              AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
            timeoutMs: AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
            maxOutputTokens:
              AI_CHART_D1_PALACE_WRITING_REVIEW_MAX_OUTPUT_TOKENS,
            durationMs: null,
            usage: null,
          },
        ],
        maxRequests: 2,
        retry: false,
        requiredMeasurements: [
          'DURATION_MS',
          'SAFE_USAGE',
        ],
        qualityDimensions:
          AI_CHART_D1_PALACE_WRITING_GOLDEN_CASE_QUALITY_DIMENSIONS,
        executionStatus: 'not_executed',
        measurementStatus: 'not_measured',
        openAiCallable: false,
      },
    )
  const withoutFingerprint = {
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_GOLDEN_CASE_VERSION,
    task: AI_CHART_D1_PALACE_WRITING_GOLDEN_CASE_TASK,
    fixtureId: 'golden-case:ziwei-ming:v1',
    targetPalaceId: 'palace:ming',
    primaryLifeRegion: 'TW',
    reportLanguage: 'zh-Hant-TW',
    privacy: {
      dataClassification: 'SYNTHETIC',
      containsPersonIdentity: false,
      containsBirthData: false,
      containsChartSnapshot: false,
      containsSecrets: false,
    },
    writingPromptPackage,
    expectedWritingResult,
    fidelityPromptPackage,
    expectedFidelityReview,
    benchmarkPlan,
    goldenBaselineStatus: 'approved_reference',
  } as const
  return freezeAiChartD1Value({
    ...withoutFingerprint,
    caseFingerprint: sha256(
      createAiChartD1PalaceWritingCanonicalJson(
        withoutFingerprint,
      ),
    ),
  })
}

const GOLDEN_CASE = createGoldenCase()
const GOLDEN_CASE_CANONICAL_JSON =
  createAiChartD1PalaceWritingCanonicalJson(GOLDEN_CASE)

export function buildAiChartD1PalaceWritingGoldenCase():
  AiChartD1PalaceWritingGoldenCase {
  return GOLDEN_CASE
}

export function parseAiChartD1PalaceWritingGoldenCase(
  value: unknown,
): AiChartD1PalaceWritingGoldenCase {
  try {
    if (
      createAiChartD1PalaceWritingCanonicalJson(value) !==
      GOLDEN_CASE_CANONICAL_JSON
    ) {
      invalid()
    }
    return GOLDEN_CASE
  } catch (error) {
    if (error instanceof AiChartD1PalaceWritingGoldenCaseError) {
      throw error
    }
    invalid()
  }
}

export function evaluateAiChartD1PalaceWritingGoldenCase(
  value: unknown,
): AiChartD1PalaceWritingGoldenCaseEvaluation {
  const goldenCase =
    parseAiChartD1PalaceWritingGoldenCase(value)
  const writingResult =
    validateAiChartD1PalaceWritingResultAgainstPromptPackage(
      goldenCase.expectedWritingResult,
      goldenCase.writingPromptPackage,
    )
  validateAiChartD1PalaceWritingFidelityPromptPackageAgainstSources(
    goldenCase.fidelityPromptPackage,
    goldenCase.writingPromptPackage,
    writingResult,
  )
  const fidelityReview =
    validateAiChartD1PalaceWritingFidelityReviewAgainstSources(
      goldenCase.expectedFidelityReview,
      writingResult,
      goldenCase.writingPromptPackage,
    )
  if (
    fidelityReview.fidelityReviewStatus !== 'approved' ||
    fidelityReview.customerDeliveryStatus !== 'ready'
  ) {
    invalid()
  }
  return freezeAiChartD1Value({
    fixtureId: goldenCase.fixtureId,
    caseFingerprint: goldenCase.caseFingerprint,
    contractStatus: 'validated' as const,
    sourceBindingStatus: 'validated' as const,
    fidelityStatus: 'approved' as const,
    customerDeliveryStatus: 'ready' as const,
    goldenBaselineStatus: 'approved_reference' as const,
    runtimeMeasurementStatus: 'not_measured' as const,
    readyForControlledPreview: true as const,
    openAiRequests: 0 as const,
  })
}
