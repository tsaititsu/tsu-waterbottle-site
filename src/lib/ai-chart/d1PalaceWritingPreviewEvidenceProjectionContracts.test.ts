import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  buildAiChartD1PalaceWritingGoldenCase,
} from './d1PalaceWritingGoldenCaseContracts'
import {
  AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_TASK,
  AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_VERSION,
  buildAiChartD1PalaceWritingPreviewPlan,
} from './d1PalaceWritingPreviewContracts'
import {
  advanceAiChartD1PalaceWritingPreviewExecutionLedger,
  createAiChartD1PalaceWritingPreviewExecutionLedger,
} from './d1PalaceWritingPreviewExecutionLedgerContracts'
import {
  AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_PROJECTION_INVALID,
  AiChartD1PalaceWritingPreviewEvidenceProjectionError,
  projectAiChartD1PalaceWritingPreviewEvidence,
} from './d1PalaceWritingPreviewEvidenceProjectionContracts'

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

const previewPlan = buildAiChartD1PalaceWritingPreviewPlan(
  buildAiChartD1PalaceWritingGoldenCase(),
)
const gateFingerprint = 'a'.repeat(64)
const writingResultFingerprint = 'b'.repeat(64)
const fidelityBridgeFingerprint = 'c'.repeat(64)
const fidelityResultFingerprint = 'd'.repeat(64)
const writingUsage = {
  inputTokens: 1_200,
  outputTokens: 800,
  reasoningTokens: 200,
  totalTokens: 2_000,
} as const

function buildWritingRequestAttemptedLedger() {
  const ready =
    createAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      gateFingerprint,
    })
  return advanceAiChartD1PalaceWritingPreviewExecutionLedger({
    previewPlan,
    ledger: ready,
    event: {
      type: 'REQUEST_ATTEMPTED',
      sequence: 1,
      stage: 'WRITING',
      bridgeFingerprint:
        previewPlan.stages[0].bridgeFingerprint,
    },
  })
}

function buildWritingFetchDispatchedLedger() {
  return advanceAiChartD1PalaceWritingPreviewExecutionLedger({
    previewPlan,
    ledger: buildWritingRequestAttemptedLedger(),
    event: {
      type: 'FETCH_DISPATCHED',
      sequence: 1,
      stage: 'WRITING',
    },
  })
}

function buildWritingSucceededLedger() {
  return advanceAiChartD1PalaceWritingPreviewExecutionLedger({
    previewPlan,
    ledger: buildWritingFetchDispatchedLedger(),
    event: {
      type: 'STAGE_SUCCEEDED',
      sequence: 1,
      stage: 'WRITING',
      durationMs: 1_500,
      usage: writingUsage,
      resultFingerprint: writingResultFingerprint,
      nextBridgeFingerprint: fidelityBridgeFingerprint,
    },
  })
}

function buildFidelityRequestAttemptedLedger() {
  return advanceAiChartD1PalaceWritingPreviewExecutionLedger({
    previewPlan,
    ledger: buildWritingSucceededLedger(),
    event: {
      type: 'REQUEST_ATTEMPTED',
      sequence: 2,
      stage: 'FIDELITY_REVIEW',
      bridgeFingerprint: fidelityBridgeFingerprint,
    },
  })
}

function buildFidelityFetchDispatchedLedger() {
  return advanceAiChartD1PalaceWritingPreviewExecutionLedger({
    previewPlan,
    ledger: buildFidelityRequestAttemptedLedger(),
    event: {
      type: 'FETCH_DISPATCHED',
      sequence: 2,
      stage: 'FIDELITY_REVIEW',
    },
  })
}

check('terminal Writing pre-fetch ledger projects to truthful formal Evidence without leaking ledger controls', () => {
  const executionLedger =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: buildWritingRequestAttemptedLedger(),
      event: {
        type: 'STAGE_FAILED',
        sequence: 1,
        stage: 'WRITING',
        failurePhase: 'PRE_FETCH',
        durationMs: 75,
        usage: null,
        errorCode: 'WRITING_REQUEST_FAILED',
      },
    })

  const evidence =
    projectAiChartD1PalaceWritingPreviewEvidence({
      previewPlan,
      executionLedger,
    })

  assert.deepEqual(evidence, {
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_VERSION,
    task: AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_TASK,
    fixtureId: previewPlan.fixtureId,
    caseFingerprint: previewPlan.caseFingerprint,
    planFingerprint: previewPlan.planFingerprint,
    status: 'FAILED',
    completedStage: 'WRITING',
    attemptedRequests: 1,
    executedRequests: 0,
    fetchCount: 0,
    retryPerformed: false,
    stages: [
      {
        sequence: 1,
        stage: 'WRITING',
        bridgeFingerprint:
          previewPlan.stages[0].bridgeFingerprint,
        status: 'FAILED',
        durationMs: 75,
        usage: null,
        resultFingerprint: null,
        errorCode: 'WRITING_REQUEST_FAILED',
      },
      {
        sequence: 2,
        stage: 'FIDELITY_REVIEW',
        bridgeFingerprint:
          previewPlan.stages[1].bridgeFingerprint,
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
    qualityAssessments: previewPlan.qualityDimensions.map(
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
  })
  assert.equal(recursivelyFrozen(evidence), true)
  const serialized = JSON.stringify(evidence)
  assert.doesNotMatch(
    serialized,
    /gateFingerprint|failurePhase|TERMINAL_NOT_PERSISTED/,
  )
})

check('terminal Writing post-fetch ledger preserves allowlisted usage and failure identity', () => {
  const executionLedger =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: buildWritingFetchDispatchedLedger(),
      event: {
        type: 'STAGE_FAILED',
        sequence: 1,
        stage: 'WRITING',
        failurePhase: 'POST_FETCH',
        durationMs: 1_500,
        usage: writingUsage,
        errorCode: 'WRITING_OUTPUT_INVALID',
      },
    })

  const evidence =
    projectAiChartD1PalaceWritingPreviewEvidence({
      previewPlan,
      executionLedger,
    })

  assert.equal(evidence.status, 'FAILED')
  assert.equal(evidence.completedStage, 'WRITING')
  assert.equal(evidence.attemptedRequests, 1)
  assert.equal(evidence.fetchCount, 1)
  assert.equal(evidence.executedRequests, 0)
  assert.deepEqual(evidence.stages[0], {
    sequence: 1,
    stage: 'WRITING',
    bridgeFingerprint:
      previewPlan.stages[0].bridgeFingerprint,
    status: 'FAILED',
    durationMs: 1_500,
    usage: writingUsage,
    resultFingerprint: null,
    errorCode: 'WRITING_OUTPUT_INVALID',
  })
  assert.deepEqual(evidence.stages[1], {
    sequence: 2,
    stage: 'FIDELITY_REVIEW',
    bridgeFingerprint:
      previewPlan.stages[1].bridgeFingerprint,
    status: 'NOT_STARTED',
    durationMs: null,
    usage: null,
    resultFingerprint: null,
    errorCode: null,
  })
  assert.equal(recursivelyFrozen(evidence), true)
})

check('terminal Fidelity pre-fetch ledger preserves validated Writing without claiming a second fetch', () => {
  const executionLedger =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: buildFidelityRequestAttemptedLedger(),
      event: {
        type: 'STAGE_FAILED',
        sequence: 2,
        stage: 'FIDELITY_REVIEW',
        failurePhase: 'PRE_FETCH',
        durationMs: 125,
        usage: null,
        errorCode: 'FIDELITY_REVIEW_REQUEST_FAILED',
      },
    })

  const evidence =
    projectAiChartD1PalaceWritingPreviewEvidence({
      previewPlan,
      executionLedger,
    })

  assert.equal(evidence.status, 'FAILED')
  assert.equal(evidence.completedStage, 'FIDELITY_REVIEW')
  assert.equal(evidence.attemptedRequests, 2)
  assert.equal(evidence.fetchCount, 1)
  assert.equal(evidence.executedRequests, 1)
  assert.deepEqual(evidence.stages[0], {
    sequence: 1,
    stage: 'WRITING',
    bridgeFingerprint:
      previewPlan.stages[0].bridgeFingerprint,
    status: 'SUCCEEDED',
    durationMs: 1_500,
    usage: writingUsage,
    resultFingerprint: writingResultFingerprint,
    errorCode: null,
  })
  assert.deepEqual(evidence.stages[1], {
    sequence: 2,
    stage: 'FIDELITY_REVIEW',
    bridgeFingerprint: fidelityBridgeFingerprint,
    status: 'FAILED',
    durationMs: 125,
    usage: null,
    resultFingerprint: null,
    errorCode: 'FIDELITY_REVIEW_REQUEST_FAILED',
  })
  assert.equal(recursivelyFrozen(evidence), true)
})

check('terminal Fidelity post-fetch ledger preserves both safe stage measurements', () => {
  const fidelityUsage = {
    inputTokens: 900,
    outputTokens: 300,
    reasoningTokens: 100,
    totalTokens: 1_200,
  } as const
  const executionLedger =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: buildFidelityFetchDispatchedLedger(),
      event: {
        type: 'STAGE_FAILED',
        sequence: 2,
        stage: 'FIDELITY_REVIEW',
        failurePhase: 'POST_FETCH',
        durationMs: 800,
        usage: fidelityUsage,
        errorCode: 'FIDELITY_REVIEW_OUTPUT_INVALID',
      },
    })

  const evidence =
    projectAiChartD1PalaceWritingPreviewEvidence({
      previewPlan,
      executionLedger,
    })

  assert.equal(evidence.status, 'FAILED')
  assert.equal(evidence.completedStage, 'FIDELITY_REVIEW')
  assert.equal(evidence.attemptedRequests, 2)
  assert.equal(evidence.fetchCount, 2)
  assert.equal(evidence.executedRequests, 1)
  assert.deepEqual(evidence.stages[0].usage, writingUsage)
  assert.deepEqual(evidence.stages[1], {
    sequence: 2,
    stage: 'FIDELITY_REVIEW',
    bridgeFingerprint: fidelityBridgeFingerprint,
    status: 'FAILED',
    durationMs: 800,
    usage: fidelityUsage,
    resultFingerprint: null,
    errorCode: 'FIDELITY_REVIEW_OUTPUT_INVALID',
  })
  assert.equal(recursivelyFrozen(evidence), true)
})

check('post-fetch request failures remain distinct from output failures and carry no fabricated usage', () => {
  const writingFailure =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: buildWritingFetchDispatchedLedger(),
      event: {
        type: 'STAGE_FAILED',
        sequence: 1,
        stage: 'WRITING',
        failurePhase: 'POST_FETCH',
        durationMs: 350,
        usage: null,
        errorCode: 'WRITING_REQUEST_FAILED',
      },
    })
  const writingEvidence =
    projectAiChartD1PalaceWritingPreviewEvidence({
      previewPlan,
      executionLedger: writingFailure,
    })
  assert.equal(
    writingEvidence.stages[0].errorCode,
    'WRITING_REQUEST_FAILED',
  )
  assert.equal(writingEvidence.stages[0].usage, null)
  assert.equal(writingEvidence.fetchCount, 1)

  const fidelityFailure =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: buildFidelityFetchDispatchedLedger(),
      event: {
        type: 'STAGE_FAILED',
        sequence: 2,
        stage: 'FIDELITY_REVIEW',
        failurePhase: 'POST_FETCH',
        durationMs: 450,
        usage: null,
        errorCode: 'FIDELITY_REVIEW_REQUEST_FAILED',
      },
    })
  const fidelityEvidence =
    projectAiChartD1PalaceWritingPreviewEvidence({
      previewPlan,
      executionLedger: fidelityFailure,
    })
  assert.equal(
    fidelityEvidence.stages[1].errorCode,
    'FIDELITY_REVIEW_REQUEST_FAILED',
  )
  assert.equal(fidelityEvidence.stages[1].usage, null)
  assert.equal(fidelityEvidence.fetchCount, 2)
})

check('terminal successful ledger projects validated Evidence that remains blocked for human review', () => {
  const fidelityUsage = {
    inputTokens: 900,
    outputTokens: 300,
    reasoningTokens: 100,
    totalTokens: 1_200,
  } as const
  const executionLedger =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: buildFidelityFetchDispatchedLedger(),
      event: {
        type: 'STAGE_SUCCEEDED',
        sequence: 2,
        stage: 'FIDELITY_REVIEW',
        durationMs: 800,
        usage: fidelityUsage,
        resultFingerprint: fidelityResultFingerprint,
      },
    })

  const evidence =
    projectAiChartD1PalaceWritingPreviewEvidence({
      previewPlan,
      executionLedger,
    })

  assert.equal(evidence.status, 'SUCCEEDED')
  assert.equal(evidence.completedStage, 'COMPLETE')
  assert.equal(evidence.attemptedRequests, 2)
  assert.equal(evidence.fetchCount, 2)
  assert.equal(evidence.executedRequests, 2)
  assert.notEqual(
    fidelityBridgeFingerprint,
    previewPlan.stages[1].bridgeFingerprint,
  )
  assert.deepEqual(evidence.stages[0].usage, writingUsage)
  assert.deepEqual(evidence.stages[1], {
    sequence: 2,
    stage: 'FIDELITY_REVIEW',
    bridgeFingerprint: fidelityBridgeFingerprint,
    status: 'SUCCEEDED',
    durationMs: 800,
    usage: fidelityUsage,
    resultFingerprint: fidelityResultFingerprint,
    errorCode: null,
  })
  assert.equal(evidence.technicalValidationStatus, 'VALIDATED')
  assert.equal(
    evidence.qualityMeasurementStatus,
    'PENDING_HUMAN_REVIEW',
  )
  assert.equal(
    evidence.customerDeliveryStatus,
    'BLOCKED_PENDING_HUMAN_REVIEW',
  )
  assert.deepEqual(
    evidence.qualityAssessments.map((assessment) => [
      assessment.dimension,
      assessment.status,
    ]),
    [
      ['SOURCE_FIDELITY', 'TECHNICALLY_VALIDATED'],
      ['CONTENT_CELL_COVERAGE', 'TECHNICALLY_VALIDATED'],
      ['PLAIN_LANGUAGE', 'NEEDS_HUMAN_REVIEW'],
      ['POSSIBILITY_BOUNDARY', 'NEEDS_HUMAN_REVIEW'],
      ['TAIWAN_CONTEXT', 'NEEDS_HUMAN_REVIEW'],
      ['NO_INTERNAL_METADATA', 'TECHNICALLY_VALIDATED'],
    ],
  )
  assert.equal(recursivelyFrozen(evidence), true)
})

function assertProjectionInvalid(
  executionLedger: unknown,
): void {
  let thrown: unknown
  try {
    projectAiChartD1PalaceWritingPreviewEvidence({
      previewPlan,
      executionLedger,
    })
  } catch (error) {
    thrown = error
  }
  assert.ok(
    thrown instanceof
      AiChartD1PalaceWritingPreviewEvidenceProjectionError,
  )
  assert.equal(
    thrown.code,
    AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_PROJECTION_INVALID,
  )
  assert.equal(
    thrown.message,
    AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_PROJECTION_INVALID,
  )
  assert.equal(Object.isFrozen(thrown), true)
}

check('non-terminal, tampered, and sensitive ledgers fail closed with one immutable error identity', () => {
  const ready =
    createAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      gateFingerprint,
    })
  assertProjectionInvalid(ready)

  const validFailure =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: buildWritingRequestAttemptedLedger(),
      event: {
        type: 'STAGE_FAILED',
        sequence: 1,
        stage: 'WRITING',
        failurePhase: 'PRE_FETCH',
        durationMs: 75,
        usage: null,
        errorCode: 'WRITING_REQUEST_FAILED',
      },
    })
  const tamperedCounters = structuredClone(
    validFailure,
  ) as Record<string, unknown>
  tamperedCounters.executedRequests = 1
  assertProjectionInvalid(tamperedCounters)

  const sensitiveLedger = structuredClone(validFailure) as
    Record<string, unknown>
  sensitiveLedger.outputText = 'sensitive-model-marker'
  let serializedError = ''
  try {
    projectAiChartD1PalaceWritingPreviewEvidence({
      previewPlan,
      executionLedger: sensitiveLedger,
    })
  } catch (error) {
    serializedError = JSON.stringify(error)
  }
  assert.equal(
    serializedError.includes('sensitive-model-marker'),
    false,
  )
  assert.match(
    serializedError,
    /ai_chart_d1_palace_writing_preview_evidence_projection_invalid/,
  )
})

check('Evidence projection remains a pure offline transformation with no runtime or persistence access', () => {
  const source = readFileSync(
    fileURLToPath(
      new URL(
        './d1PalaceWritingPreviewEvidenceProjectionContracts.ts',
        import.meta.url,
      ),
    ),
    'utf8',
  )
  assert.doesNotMatch(
    source,
    /fetch\s*\(|process\.env|OPENAI_API_KEY|Authorization|node:fs|\.server|writeFile|mkdir|requestAiChartOpenAiStructuredResponse/,
  )
})

console.log(
  `AI Chart D1 palace-writing Preview Evidence projection checks passed: ${checks}`,
)
