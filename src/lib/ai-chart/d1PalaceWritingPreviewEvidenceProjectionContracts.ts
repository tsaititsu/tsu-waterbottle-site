import {
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import {
  AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_TASK,
  AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_VERSION,
  parseAiChartD1PalaceWritingPreviewEvidence,
  parseAiChartD1PalaceWritingPreviewPlan,
  type AiChartD1PalaceWritingPreviewEvidence,
} from './d1PalaceWritingPreviewContracts'
import {
  advanceAiChartD1PalaceWritingPreviewExecutionLedger,
  createAiChartD1PalaceWritingPreviewExecutionLedger,
} from './d1PalaceWritingPreviewExecutionLedgerContracts'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'

export const AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_PROJECTION_INVALID =
  'ai_chart_d1_palace_writing_preview_evidence_projection_invalid' as const

export class AiChartD1PalaceWritingPreviewEvidenceProjectionError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_PROJECTION_INVALID

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_PROJECTION_INVALID,
    )
    Object.defineProperty(this, 'name', {
      value:
        'AiChartD1PalaceWritingPreviewEvidenceProjectionError',
      enumerable: false,
      configurable: true,
    })
    Object.freeze(this)
  }
}

const LEDGER_FIELDS = [
  'contractVersion',
  'task',
  'fixtureId',
  'caseFingerprint',
  'planFingerprint',
  'gateFingerprint',
  'status',
  'currentStage',
  'completedStage',
  'terminal',
  'nextRequiredAction',
  'attemptedRequests',
  'executedRequests',
  'fetchCount',
  'retryPerformed',
  'stages',
  'evidenceStatus',
  'restrictedArtifactPersisted',
  'safeMetadataOnly',
] as const

const LEDGER_STAGE_FIELDS = [
  'sequence',
  'stage',
  'bridgeFingerprint',
  'status',
  'failurePhase',
  'durationMs',
  'usage',
  'resultFingerprint',
  'errorCode',
] as const

const SUMMARY_POLICY = freezeAiChartD1Value({
  safeMetadataOnly: true,
  modelOutputPersisted: false,
  promptPersisted: false,
  requestBodyPersisted: false,
  chartDataPersisted: false,
  birthDataPersisted: false,
  restrictedResultArtifactRequiredForHumanReview: true,
} as const)

const SUCCESS_QUALITY_ASSESSMENTS =
  freezeAiChartD1Value([
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
  ] as const)

function invalid(): never {
  throw new AiChartD1PalaceWritingPreviewEvidenceProjectionError()
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

function parsePositiveInteger(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    invalid()
  }
  return value
}

function projectWritingFailure(
  previewPlanValue: unknown,
  executionLedgerValue: unknown,
): AiChartD1PalaceWritingPreviewEvidence {
  const previewPlan =
    parseAiChartD1PalaceWritingPreviewPlan(previewPlanValue)
  assertAiChartD1SafeGraph(executionLedgerValue)
  const ledger = requireAiChartD1ExactObject(
    executionLedgerValue,
    LEDGER_FIELDS,
  )
  if (
    !Array.isArray(ledger.stages) ||
    ledger.stages.length !== 2
  ) {
    invalid()
  }
  const writingStage = requireAiChartD1ExactObject(
    ledger.stages[0],
    LEDGER_STAGE_FIELDS,
  )
  requireAiChartD1ExactObject(
    ledger.stages[1],
    LEDGER_STAGE_FIELDS,
  )
  const ready =
    createAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      gateFingerprint: parseSha256(ledger.gateFingerprint),
    })
  const attempted =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: ready,
      event: {
        type: 'REQUEST_ATTEMPTED',
        sequence: 1,
        stage: 'WRITING',
        bridgeFingerprint:
          previewPlan.stages[0]?.bridgeFingerprint,
      },
    })
  const durationMs = parsePositiveInteger(
    writingStage.durationMs,
  )
  const reconstructed =
    writingStage.failurePhase === 'PRE_FETCH'
      ? advanceAiChartD1PalaceWritingPreviewExecutionLedger({
          previewPlan,
          ledger: attempted,
          event: {
            type: 'STAGE_FAILED',
            sequence: 1,
            stage: 'WRITING',
            failurePhase: 'PRE_FETCH',
            durationMs,
            usage: null,
            errorCode: 'WRITING_REQUEST_FAILED',
          },
        })
      : writingStage.failurePhase === 'POST_FETCH'
        ? advanceAiChartD1PalaceWritingPreviewExecutionLedger({
            previewPlan,
            ledger:
              advanceAiChartD1PalaceWritingPreviewExecutionLedger({
                previewPlan,
                ledger: attempted,
                event: {
                  type: 'FETCH_DISPATCHED',
                  sequence: 1,
                  stage: 'WRITING',
                },
              }),
            event: {
              type: 'STAGE_FAILED',
              sequence: 1,
              stage: 'WRITING',
              failurePhase: 'POST_FETCH',
              durationMs,
              usage: writingStage.usage,
              errorCode: writingStage.errorCode,
            },
          })
        : invalid()

  if (
    createAiChartD1PalaceWritingCanonicalJson(
      executionLedgerValue,
    ) !==
    createAiChartD1PalaceWritingCanonicalJson(reconstructed)
  ) {
    invalid()
  }

  return parseAiChartD1PalaceWritingPreviewEvidence(
    {
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
      fetchCount: reconstructed.fetchCount,
      retryPerformed: false,
      stages: [
        {
          sequence: 1,
          stage: 'WRITING',
          bridgeFingerprint:
            reconstructed.stages[0].bridgeFingerprint,
          status: 'FAILED',
          durationMs: reconstructed.stages[0].durationMs,
          usage: reconstructed.stages[0].usage,
          resultFingerprint: null,
          errorCode: reconstructed.stages[0].errorCode,
        },
        {
          sequence: 2,
          stage: 'FIDELITY_REVIEW',
          bridgeFingerprint:
            previewPlan.stages[1]?.bridgeFingerprint,
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
      summaryPolicy: SUMMARY_POLICY,
    },
    previewPlan,
  )
}

function projectFidelityFailure(
  previewPlanValue: unknown,
  executionLedgerValue: unknown,
): AiChartD1PalaceWritingPreviewEvidence {
  const previewPlan =
    parseAiChartD1PalaceWritingPreviewPlan(previewPlanValue)
  assertAiChartD1SafeGraph(executionLedgerValue)
  const ledger = requireAiChartD1ExactObject(
    executionLedgerValue,
    LEDGER_FIELDS,
  )
  if (
    !Array.isArray(ledger.stages) ||
    ledger.stages.length !== 2
  ) {
    invalid()
  }
  const writingStage = requireAiChartD1ExactObject(
    ledger.stages[0],
    LEDGER_STAGE_FIELDS,
  )
  const fidelityStage = requireAiChartD1ExactObject(
    ledger.stages[1],
    LEDGER_STAGE_FIELDS,
  )
  const ready =
    createAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      gateFingerprint: parseSha256(ledger.gateFingerprint),
    })
  const writingAttempted =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: ready,
      event: {
        type: 'REQUEST_ATTEMPTED',
        sequence: 1,
        stage: 'WRITING',
        bridgeFingerprint:
          previewPlan.stages[0]?.bridgeFingerprint,
      },
    })
  const writingDispatched =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: writingAttempted,
      event: {
        type: 'FETCH_DISPATCHED',
        sequence: 1,
        stage: 'WRITING',
      },
    })
  const writingSucceeded =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: writingDispatched,
      event: {
        type: 'STAGE_SUCCEEDED',
        sequence: 1,
        stage: 'WRITING',
        durationMs: writingStage.durationMs,
        usage: writingStage.usage,
        resultFingerprint: writingStage.resultFingerprint,
        nextBridgeFingerprint: parseSha256(
          fidelityStage.bridgeFingerprint,
        ),
      },
    })
  const fidelityAttempted =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: writingSucceeded,
      event: {
        type: 'REQUEST_ATTEMPTED',
        sequence: 2,
        stage: 'FIDELITY_REVIEW',
        bridgeFingerprint:
          writingSucceeded.stages[1].bridgeFingerprint,
      },
    })
  const reconstructed =
    fidelityStage.failurePhase === 'PRE_FETCH'
      ? advanceAiChartD1PalaceWritingPreviewExecutionLedger({
          previewPlan,
          ledger: fidelityAttempted,
          event: {
            type: 'STAGE_FAILED',
            sequence: 2,
            stage: 'FIDELITY_REVIEW',
            failurePhase: 'PRE_FETCH',
            durationMs: fidelityStage.durationMs,
            usage: null,
            errorCode: 'FIDELITY_REVIEW_REQUEST_FAILED',
          },
        })
      : fidelityStage.failurePhase === 'POST_FETCH'
        ? advanceAiChartD1PalaceWritingPreviewExecutionLedger({
            previewPlan,
            ledger:
              advanceAiChartD1PalaceWritingPreviewExecutionLedger({
                previewPlan,
                ledger: fidelityAttempted,
                event: {
                  type: 'FETCH_DISPATCHED',
                  sequence: 2,
                  stage: 'FIDELITY_REVIEW',
                },
              }),
            event: {
              type: 'STAGE_FAILED',
              sequence: 2,
              stage: 'FIDELITY_REVIEW',
              failurePhase: 'POST_FETCH',
              durationMs: fidelityStage.durationMs,
              usage: fidelityStage.usage,
              errorCode: fidelityStage.errorCode,
            },
          })
        : invalid()

  if (
    createAiChartD1PalaceWritingCanonicalJson(
      executionLedgerValue,
    ) !==
    createAiChartD1PalaceWritingCanonicalJson(reconstructed)
  ) {
    invalid()
  }

  return parseAiChartD1PalaceWritingPreviewEvidence(
    {
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_VERSION,
      task: AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_TASK,
      fixtureId: previewPlan.fixtureId,
      caseFingerprint: previewPlan.caseFingerprint,
      planFingerprint: previewPlan.planFingerprint,
      status: 'FAILED',
      completedStage: 'FIDELITY_REVIEW',
      attemptedRequests: 2,
      executedRequests: 1,
      fetchCount: reconstructed.fetchCount,
      retryPerformed: false,
      stages: [
        {
          sequence: 1,
          stage: 'WRITING',
          bridgeFingerprint:
            reconstructed.stages[0].bridgeFingerprint,
          status: 'SUCCEEDED',
          durationMs: reconstructed.stages[0].durationMs,
          usage: reconstructed.stages[0].usage,
          resultFingerprint:
            reconstructed.stages[0].resultFingerprint,
          errorCode: null,
        },
        {
          sequence: 2,
          stage: 'FIDELITY_REVIEW',
          bridgeFingerprint:
            reconstructed.stages[1].bridgeFingerprint,
          status: 'FAILED',
          durationMs: reconstructed.stages[1].durationMs,
          usage: reconstructed.stages[1].usage,
          resultFingerprint: null,
          errorCode: reconstructed.stages[1].errorCode,
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
      summaryPolicy: SUMMARY_POLICY,
    },
    previewPlan,
  )
}

function projectSuccessfulEvidence(
  previewPlanValue: unknown,
  executionLedgerValue: unknown,
): AiChartD1PalaceWritingPreviewEvidence {
  const previewPlan =
    parseAiChartD1PalaceWritingPreviewPlan(previewPlanValue)
  assertAiChartD1SafeGraph(executionLedgerValue)
  const ledger = requireAiChartD1ExactObject(
    executionLedgerValue,
    LEDGER_FIELDS,
  )
  if (
    !Array.isArray(ledger.stages) ||
    ledger.stages.length !== 2
  ) {
    invalid()
  }
  const writingStage = requireAiChartD1ExactObject(
    ledger.stages[0],
    LEDGER_STAGE_FIELDS,
  )
  const fidelityStage = requireAiChartD1ExactObject(
    ledger.stages[1],
    LEDGER_STAGE_FIELDS,
  )
  const ready =
    createAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      gateFingerprint: parseSha256(ledger.gateFingerprint),
    })
  const writingAttempted =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: ready,
      event: {
        type: 'REQUEST_ATTEMPTED',
        sequence: 1,
        stage: 'WRITING',
        bridgeFingerprint:
          previewPlan.stages[0]?.bridgeFingerprint,
      },
    })
  const writingDispatched =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: writingAttempted,
      event: {
        type: 'FETCH_DISPATCHED',
        sequence: 1,
        stage: 'WRITING',
      },
    })
  const writingSucceeded =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: writingDispatched,
      event: {
        type: 'STAGE_SUCCEEDED',
        sequence: 1,
        stage: 'WRITING',
        durationMs: writingStage.durationMs,
        usage: writingStage.usage,
        resultFingerprint: writingStage.resultFingerprint,
        nextBridgeFingerprint: parseSha256(
          fidelityStage.bridgeFingerprint,
        ),
      },
    })
  const fidelityAttempted =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: writingSucceeded,
      event: {
        type: 'REQUEST_ATTEMPTED',
        sequence: 2,
        stage: 'FIDELITY_REVIEW',
        bridgeFingerprint:
          writingSucceeded.stages[1].bridgeFingerprint,
      },
    })
  const fidelityDispatched =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: fidelityAttempted,
      event: {
        type: 'FETCH_DISPATCHED',
        sequence: 2,
        stage: 'FIDELITY_REVIEW',
      },
    })
  const reconstructed =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: fidelityDispatched,
      event: {
        type: 'STAGE_SUCCEEDED',
        sequence: 2,
        stage: 'FIDELITY_REVIEW',
        durationMs: fidelityStage.durationMs,
        usage: fidelityStage.usage,
        resultFingerprint: fidelityStage.resultFingerprint,
      },
    })

  if (
    createAiChartD1PalaceWritingCanonicalJson(
      executionLedgerValue,
    ) !==
    createAiChartD1PalaceWritingCanonicalJson(reconstructed)
  ) {
    invalid()
  }

  return parseAiChartD1PalaceWritingPreviewEvidence(
    {
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_VERSION,
      task: AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_TASK,
      fixtureId: previewPlan.fixtureId,
      caseFingerprint: previewPlan.caseFingerprint,
      planFingerprint: previewPlan.planFingerprint,
      status: 'SUCCEEDED',
      completedStage: 'COMPLETE',
      attemptedRequests: 2,
      executedRequests: 2,
      fetchCount: 2,
      retryPerformed: false,
      stages: reconstructed.stages.map((stage) => ({
        sequence: stage.sequence,
        stage: stage.stage,
        bridgeFingerprint: stage.bridgeFingerprint,
        status: 'SUCCEEDED',
        durationMs: stage.durationMs,
        usage: stage.usage,
        resultFingerprint: stage.resultFingerprint,
        errorCode: null,
      })),
      technicalValidationStatus: 'VALIDATED',
      qualityMeasurementStatus: 'PENDING_HUMAN_REVIEW',
      humanReviewStatus: 'NOT_REVIEWED',
      customerDeliveryStatus: 'BLOCKED_PENDING_HUMAN_REVIEW',
      qualityAssessments: SUCCESS_QUALITY_ASSESSMENTS,
      summaryPolicy: SUMMARY_POLICY,
    },
    previewPlan,
  )
}

export function projectAiChartD1PalaceWritingPreviewEvidence(
  input: Readonly<{
    previewPlan: unknown
    executionLedger: unknown
  }>,
): AiChartD1PalaceWritingPreviewEvidence {
  try {
    assertAiChartD1SafeGraph(input)
    const record = requireAiChartD1ExactObject(input, [
      'previewPlan',
      'executionLedger',
    ])
    const ledger = requireAiChartD1ExactObject(
      record.executionLedger,
      LEDGER_FIELDS,
    )
    if (ledger.status === 'SUCCEEDED') {
      return projectSuccessfulEvidence(
        record.previewPlan,
        record.executionLedger,
      )
    }
    if (ledger.currentStage === 'WRITING') {
      return projectWritingFailure(
        record.previewPlan,
        record.executionLedger,
      )
    }
    if (ledger.currentStage === 'FIDELITY_REVIEW') {
      return projectFidelityFailure(
        record.previewPlan,
        record.executionLedger,
      )
    }
    invalid()
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingPreviewEvidenceProjectionError
    ) {
      throw error
    }
    invalid()
  }
}
