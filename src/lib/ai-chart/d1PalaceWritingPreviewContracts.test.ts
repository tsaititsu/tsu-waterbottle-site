import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  AI_CHART_D1_PALACE_WRITING_MAX_OUTPUT_TOKENS,
  AI_CHART_D1_PALACE_WRITING_REVIEW_MAX_OUTPUT_TOKENS,
} from './d1PalaceWritingAdapterBridgeContracts'
import {
  buildAiChartD1PalaceWritingGoldenCase,
} from './d1PalaceWritingGoldenCaseContracts'
import {
  AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_VERSION,
  AI_CHART_D1_PALACE_WRITING_PREVIEW_PLAN_VERSION,
  buildAiChartD1PalaceWritingPreviewPlan,
  parseAiChartD1PalaceWritingPreviewEvidence,
  parseAiChartD1PalaceWritingPreviewPlan,
} from './d1PalaceWritingPreviewContracts'

let checks = 0

function check(name: string, run: () => void): void {
  try {
    run()
    checks += 1
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

function recursivelyFrozen(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true
  if (!Object.isFrozen(value)) return false
  return Reflect.ownKeys(value).every((key) =>
    recursivelyFrozen(
      (value as Record<PropertyKey, unknown>)[key],
    ),
  )
}

const goldenCase = buildAiChartD1PalaceWritingGoldenCase()
const plan = buildAiChartD1PalaceWritingPreviewPlan(goldenCase)

check('controlled Preview plan is bound to the Golden Case and remains non-callable without separate runtime authorization', () => {
  const plan = buildAiChartD1PalaceWritingPreviewPlan(goldenCase)

  assert.equal(
    plan.contractVersion,
    AI_CHART_D1_PALACE_WRITING_PREVIEW_PLAN_VERSION,
  )
  assert.equal(plan.fixtureId, goldenCase.fixtureId)
  assert.equal(plan.caseFingerprint, goldenCase.caseFingerprint)
  assert.equal(plan.executionMode, 'SEQUENTIAL')
  assert.equal(plan.maxRequests, 2)
  assert.equal(plan.fetchHardLimit, 2)
  assert.equal(plan.retry, false)
  assert.equal(plan.authorizationStatus, 'not_authorized')
  assert.equal(plan.runtimeStatus, 'runtime_not_implemented')
  assert.equal(plan.openAiCallable, false)
  assert.deepEqual(
    plan.qualityDimensions,
    goldenCase.benchmarkPlan.qualityDimensions,
  )
  assert.equal(plan.humanReviewRequired, true)
  assert.equal(
    plan.evidenceProducerPolicy,
    'TRUSTED_SERVER_RUNNER_ONLY',
  )
  assert.equal(plan.evidenceSummaryPolicy, 'SAFE_METADATA_ONLY')
  assert.equal(
    plan.resultArtifactPolicy,
    'SEPARATE_RESTRICTED_ARTIFACT',
  )
  assert.equal(plan.modelOutputAllowedInEvidenceSummary, false)
  assert.deepEqual(
    plan.stages.map((stage) => stage.stage),
    ['WRITING', 'FIDELITY_REVIEW'],
  )
  assert.deepEqual(
    plan.stages.map((stage) => stage.bridgeBinding),
    [
      'EXACT_PLAN_FINGERPRINT',
      'DERIVED_FROM_VALIDATED_WRITING_RESULT',
    ],
  )
  assert.deepEqual(
    plan.stages.map((stage) => stage.bridgeFingerprint),
    goldenCase.benchmarkPlan.stages.map(
      (stage) => stage.bridgeFingerprint,
    ),
  )
  assert.deepEqual(
    plan.stages.map((stage) => stage.maxOutputTokens),
    [
      AI_CHART_D1_PALACE_WRITING_MAX_OUTPUT_TOKENS,
      AI_CHART_D1_PALACE_WRITING_REVIEW_MAX_OUTPUT_TOKENS,
    ],
  )
  assert.deepEqual(parseAiChartD1PalaceWritingPreviewPlan(plan), plan)
  assert.equal(recursivelyFrozen(plan), true)
})

check('successful evidence preserves safe runtime measurements while customer quality remains pending human review', () => {
  const evidence = parseAiChartD1PalaceWritingPreviewEvidence(
    {
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_VERSION,
      task: 'D1_PALACE_WRITING_CONTROLLED_PREVIEW_EVIDENCE',
      fixtureId: goldenCase.fixtureId,
      caseFingerprint: goldenCase.caseFingerprint,
      planFingerprint: plan.planFingerprint,
      status: 'SUCCEEDED',
      completedStage: 'COMPLETE',
      attemptedRequests: 2,
      executedRequests: 2,
      fetchCount: 2,
      retryPerformed: false,
      stages: [
        {
          sequence: 1,
          stage: 'WRITING',
          bridgeFingerprint: plan.stages[0].bridgeFingerprint,
          status: 'SUCCEEDED',
          durationMs: 1_250,
          usage: {
            inputTokens: 1_200,
            outputTokens: 600,
            reasoningTokens: 120,
            totalTokens: 1_800,
          },
          resultFingerprint: 'a'.repeat(64),
          errorCode: null,
        },
        {
          sequence: 2,
          stage: 'FIDELITY_REVIEW',
          bridgeFingerprint: 'c'.repeat(64),
          status: 'SUCCEEDED',
          durationMs: 800,
          usage: {
            inputTokens: 900,
            outputTokens: 300,
            reasoningTokens: 80,
            totalTokens: 1_200,
          },
          resultFingerprint: 'b'.repeat(64),
          errorCode: null,
        },
      ],
      technicalValidationStatus: 'VALIDATED',
      qualityMeasurementStatus: 'PENDING_HUMAN_REVIEW',
      humanReviewStatus: 'NOT_REVIEWED',
      customerDeliveryStatus: 'BLOCKED_PENDING_HUMAN_REVIEW',
      qualityAssessments: [
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
      ],
      summaryPolicy: {
        safeMetadataOnly: true,
        modelOutputPersisted: false,
        promptPersisted: false,
        requestBodyPersisted: false,
        chartDataPersisted: false,
        birthDataPersisted: false,
        restrictedResultArtifactRequiredForHumanReview: true,
      },
    },
    plan,
  )

  assert.equal(evidence.status, 'SUCCEEDED')
  assert.equal(evidence.technicalValidationStatus, 'VALIDATED')
  assert.equal(
    evidence.qualityMeasurementStatus,
    'PENDING_HUMAN_REVIEW',
  )
  assert.equal(evidence.humanReviewStatus, 'NOT_REVIEWED')
  assert.equal(
    evidence.customerDeliveryStatus,
    'BLOCKED_PENDING_HUMAN_REVIEW',
  )
  assert.deepEqual(
    evidence.stages.map((stage) => [
      stage.bridgeFingerprint,
      stage.durationMs,
      stage.usage?.totalTokens,
      stage.resultFingerprint,
    ]),
    [
      [
        plan.stages[0].bridgeFingerprint,
        1_250,
        1_800,
        'a'.repeat(64),
      ],
      ['c'.repeat(64), 800, 1_200, 'b'.repeat(64)],
    ],
  )
  assert.equal(recursivelyFrozen(evidence), true)
})

function buildWritingFailureEvidence(): Record<string, unknown> {
  return {
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_VERSION,
    task: 'D1_PALACE_WRITING_CONTROLLED_PREVIEW_EVIDENCE',
    fixtureId: goldenCase.fixtureId,
    caseFingerprint: goldenCase.caseFingerprint,
    planFingerprint: plan.planFingerprint,
    status: 'FAILED',
    completedStage: 'WRITING',
    attemptedRequests: 1,
    executedRequests: 0,
    fetchCount: 1,
    retryPerformed: false,
    stages: [
      {
        sequence: 1,
        stage: 'WRITING',
        bridgeFingerprint: plan.stages[0].bridgeFingerprint,
        status: 'FAILED',
        durationMs: 1_250,
        usage: {
          inputTokens: 1_200,
          outputTokens: 600,
          reasoningTokens: 120,
          totalTokens: 1_800,
        },
        resultFingerprint: null,
        errorCode: 'WRITING_OUTPUT_INVALID',
      },
      {
        sequence: 2,
        stage: 'FIDELITY_REVIEW',
        bridgeFingerprint: plan.stages[1].bridgeFingerprint,
        status: 'NOT_STARTED',
        durationMs: null,
        usage: null,
        resultFingerprint: null,
        errorCode: null,
      },
    ],
    technicalValidationStatus: 'FAILED',
    qualityMeasurementStatus: 'NOT_AVAILABLE',
    humanReviewStatus: 'NOT_REVIEWED',
    customerDeliveryStatus: 'BLOCKED',
    qualityAssessments: goldenCase.benchmarkPlan.qualityDimensions.map(
      (dimension) => ({
        dimension,
        status: 'NOT_AVAILABLE',
      }),
    ),
    summaryPolicy: {
      safeMetadataOnly: true,
      modelOutputPersisted: false,
      promptPersisted: false,
      requestBodyPersisted: false,
      chartDataPersisted: false,
      birthDataPersisted: false,
      restrictedResultArtifactRequiredForHumanReview: true,
    },
  }
}

function buildWritingPreFetchFailureEvidence(): Record<string, unknown> {
  const value = buildWritingFailureEvidence()
  value.fetchCount = 0
  const writingStage = (
    value.stages as Record<string, unknown>[]
  )[0]
  writingStage.usage = null
  writingStage.errorCode = 'WRITING_REQUEST_FAILED'
  return value
}

check('pre-fetch Writing failure truthfully records an attempt without claiming fetch dispatch', () => {
  const evidence = parseAiChartD1PalaceWritingPreviewEvidence(
    buildWritingPreFetchFailureEvidence(),
    plan,
  )

  assert.equal(evidence.status, 'FAILED')
  assert.equal(evidence.completedStage, 'WRITING')
  assert.equal(evidence.attemptedRequests, 1)
  assert.equal(evidence.fetchCount, 0)
  assert.equal(evidence.executedRequests, 0)
  assert.equal(
    evidence.stages[0].errorCode,
    'WRITING_REQUEST_FAILED',
  )
  assert.equal(evidence.stages[0].usage, null)
  assert.equal(evidence.stages[1].status, 'NOT_STARTED')
  assert.equal(recursivelyFrozen(evidence), true)
})

check('failed writing evidence records only allowlisted failure metadata and proves review was not started', () => {
  const evidence = parseAiChartD1PalaceWritingPreviewEvidence(
    buildWritingFailureEvidence(),
    plan,
  )

  assert.equal(evidence.status, 'FAILED')
  assert.equal(evidence.completedStage, 'WRITING')
  assert.equal(evidence.attemptedRequests, 1)
  assert.equal(evidence.executedRequests, 0)
  assert.equal(evidence.fetchCount, 1)
  assert.equal(evidence.stages[0].errorCode, 'WRITING_OUTPUT_INVALID')
  assert.equal(evidence.stages[1].status, 'NOT_STARTED')
  assert.equal(evidence.qualityMeasurementStatus, 'NOT_AVAILABLE')
  assert.equal(evidence.customerDeliveryStatus, 'BLOCKED')
  assert.equal(recursivelyFrozen(evidence), true)
})

check('evidence rejects arbitrary failure text, sensitive fields, and inconsistent request counters', () => {
  const arbitraryError = structuredClone(
    buildWritingFailureEvidence(),
  ) as Record<string, unknown>
  const arbitraryStages = arbitraryError.stages as Record<
    string,
    unknown
  >[]
  arbitraryStages[0].errorCode = 'provider said sensitive marker'
  assert.throws(() =>
    parseAiChartD1PalaceWritingPreviewEvidence(
      arbitraryError,
      plan,
    ),
  )

  const sensitiveOutput = structuredClone(
    buildWritingFailureEvidence(),
  ) as Record<string, unknown>
  ;(
    sensitiveOutput.stages as Record<string, unknown>[]
  )[0].outputText = 'sensitive model output'
  assert.throws(() =>
    parseAiChartD1PalaceWritingPreviewEvidence(
      sensitiveOutput,
      plan,
    ),
  )

  const inconsistentCounters = structuredClone(
    buildWritingFailureEvidence(),
  ) as Record<string, unknown>
  inconsistentCounters.executedRequests = 1
  assert.throws(() =>
    parseAiChartD1PalaceWritingPreviewEvidence(
      inconsistentCounters,
      plan,
    ),
  )
})

function buildFidelityFailureEvidence(): Record<string, unknown> {
  const value = buildWritingFailureEvidence()
  value.completedStage = 'FIDELITY_REVIEW'
  value.attemptedRequests = 2
  value.executedRequests = 1
  value.fetchCount = 2
  const stages = value.stages as Record<string, unknown>[]
  stages[0] = {
    sequence: 1,
    stage: 'WRITING',
    bridgeFingerprint: plan.stages[0].bridgeFingerprint,
    status: 'SUCCEEDED',
    durationMs: 1_250,
    usage: {
      inputTokens: 1_200,
      outputTokens: 600,
      reasoningTokens: 120,
      totalTokens: 1_800,
    },
    resultFingerprint: 'a'.repeat(64),
    errorCode: null,
  }
  stages[1] = {
    sequence: 2,
    stage: 'FIDELITY_REVIEW',
    bridgeFingerprint: 'c'.repeat(64),
    status: 'FAILED',
    durationMs: 800,
    usage: null,
    resultFingerprint: null,
    errorCode: 'FIDELITY_REVIEW_REQUEST_FAILED',
  }
  return value
}

function buildFidelityPreFetchFailureEvidence(): Record<string, unknown> {
  const value = buildFidelityFailureEvidence()
  value.fetchCount = 1
  return value
}

check('pre-fetch Fidelity failure preserves Writing success without claiming a second fetch', () => {
  const evidence = parseAiChartD1PalaceWritingPreviewEvidence(
    buildFidelityPreFetchFailureEvidence(),
    plan,
  )

  assert.equal(evidence.status, 'FAILED')
  assert.equal(evidence.completedStage, 'FIDELITY_REVIEW')
  assert.equal(evidence.attemptedRequests, 2)
  assert.equal(evidence.fetchCount, 1)
  assert.equal(evidence.executedRequests, 1)
  assert.equal(evidence.stages[0].status, 'SUCCEEDED')
  assert.equal(
    evidence.stages[1].errorCode,
    'FIDELITY_REVIEW_REQUEST_FAILED',
  )
  assert.equal(evidence.stages[1].usage, null)
  assert.equal(recursivelyFrozen(evidence), true)
})

check('pre-fetch counters reject output failures, usage, and mismatched stage failure codes', () => {
  const writingOutputFailure = buildWritingPreFetchFailureEvidence()
  ;(
    writingOutputFailure.stages as Record<string, unknown>[]
  )[0].errorCode = 'WRITING_OUTPUT_INVALID'
  assert.throws(() =>
    parseAiChartD1PalaceWritingPreviewEvidence(
      writingOutputFailure,
      plan,
    ),
  )

  const writingUsage = buildWritingPreFetchFailureEvidence()
  ;(
    writingUsage.stages as Record<string, unknown>[]
  )[0].usage = {
    inputTokens: 1,
    outputTokens: 1,
    reasoningTokens: 0,
    totalTokens: 2,
  }
  assert.throws(() =>
    parseAiChartD1PalaceWritingPreviewEvidence(
      writingUsage,
      plan,
    ),
  )

  const fidelityOutputFailure =
    buildFidelityPreFetchFailureEvidence()
  ;(
    fidelityOutputFailure.stages as Record<string, unknown>[]
  )[1].errorCode = 'FIDELITY_REVIEW_OUTPUT_INVALID'
  assert.throws(() =>
    parseAiChartD1PalaceWritingPreviewEvidence(
      fidelityOutputFailure,
      plan,
    ),
  )

  const fidelityUsage = buildFidelityPreFetchFailureEvidence()
  ;(
    fidelityUsage.stages as Record<string, unknown>[]
  )[1].usage = {
    inputTokens: 1,
    outputTokens: 1,
    reasoningTokens: 0,
    totalTokens: 2,
  }
  assert.throws(() =>
    parseAiChartD1PalaceWritingPreviewEvidence(
      fidelityUsage,
      plan,
    ),
  )
})

check('failed fidelity evidence preserves successful writing measurements but remains blocked', () => {
  const evidence = parseAiChartD1PalaceWritingPreviewEvidence(
    buildFidelityFailureEvidence(),
    plan,
  )

  assert.equal(evidence.status, 'FAILED')
  assert.equal(evidence.completedStage, 'FIDELITY_REVIEW')
  assert.equal(evidence.attemptedRequests, 2)
  assert.equal(evidence.executedRequests, 1)
  assert.equal(evidence.fetchCount, 2)
  assert.equal(evidence.stages[0].status, 'SUCCEEDED')
  assert.equal(
    evidence.stages[1].errorCode,
    'FIDELITY_REVIEW_REQUEST_FAILED',
  )
  assert.equal(evidence.customerDeliveryStatus, 'BLOCKED')

  const wrongStageCode = structuredClone(
    buildFidelityFailureEvidence(),
  ) as Record<string, unknown>
  ;(
    wrongStageCode.stages as Record<string, unknown>[]
  )[1].errorCode = 'WRITING_REQUEST_FAILED'
  assert.throws(() =>
    parseAiChartD1PalaceWritingPreviewEvidence(
      wrongStageCode,
      plan,
    ),
  )
})

check('plan binding and usage arithmetic reject tampering instead of normalizing it', () => {
  const changedPlan = structuredClone(plan) as Record<string, unknown>
  changedPlan.authorizationStatus = 'authorized'
  assert.throws(() =>
    parseAiChartD1PalaceWritingPreviewPlan(changedPlan),
  )

  const changedBinding = structuredClone(
    buildWritingFailureEvidence(),
  ) as Record<string, unknown>
  changedBinding.caseFingerprint = 'f'.repeat(64)
  assert.throws(() =>
    parseAiChartD1PalaceWritingPreviewEvidence(
      changedBinding,
      plan,
    ),
  )

  const changedUsage = structuredClone(
    buildWritingFailureEvidence(),
  ) as Record<string, unknown>
  const changedUsageStages =
    changedUsage.stages as Record<string, unknown>[]
  const usage =
    changedUsageStages[0].usage as Record<string, unknown>
  usage.totalTokens = 1_799
  assert.throws(() =>
    parseAiChartD1PalaceWritingPreviewEvidence(
      changedUsage,
      plan,
    ),
  )

  const changedWritingBridge = structuredClone(
    buildWritingFailureEvidence(),
  ) as Record<string, unknown>
  ;(
    changedWritingBridge.stages as Record<string, unknown>[]
  )[0].bridgeFingerprint = 'f'.repeat(64)
  assert.throws(() =>
    parseAiChartD1PalaceWritingPreviewEvidence(
      changedWritingBridge,
      plan,
    ),
  )
})

check('Preview summary serialization contains no model body, prompt, request body, chart, birth, or secret fields', () => {
  const evidence = parseAiChartD1PalaceWritingPreviewEvidence(
    buildWritingFailureEvidence(),
    plan,
  )
  const serialized = JSON.stringify(evidence)
  for (const forbidden of [
    '"outputText"',
    '"output_text"',
    '"prompt"',
    '"instructions"',
    '"userInput"',
    '"requestBody"',
    '"apiKey"',
    '"authorizationHeader"',
    '"chartSnapshot"',
    '"birthDate"',
    '"birthTime"',
  ]) {
    assert.equal(
      serialized.toLowerCase().includes(forbidden.toLowerCase()),
      false,
    )
  }
})

check('Preview Contract remains pure offline data with no server runtime, fetch, env, or secret access', () => {
  const source = readFileSync(
    fileURLToPath(
      new URL(
        './d1PalaceWritingPreviewContracts.ts',
        import.meta.url,
      ),
    ),
    'utf8',
  )
  assert.doesNotMatch(
    source,
    /fetch\s*\(|process\.env|OPENAI_API_KEY|Authorization|\.server|requestAiChartOpenAiStructuredResponse/,
  )
})

console.log(
  `AI Chart D1 palace-writing Preview contract checks passed: ${checks}`,
)
