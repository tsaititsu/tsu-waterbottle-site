import {
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import {
  parseAiChartD1PalaceWritingPreviewPlan,
  type AiChartD1PalaceWritingPreviewPlan,
  type AiChartD1PalaceWritingPreviewUsage,
} from './d1PalaceWritingPreviewContracts'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'

export const AI_CHART_D1_PALACE_WRITING_PREVIEW_EXECUTION_LEDGER_VERSION =
  'ai-chart-d1-palace-writing-preview-execution-ledger/v1' as const

export const AI_CHART_D1_PALACE_WRITING_PREVIEW_EXECUTION_LEDGER_TASK =
  'D1_PALACE_WRITING_CONTROLLED_PREVIEW_EXECUTION_LEDGER' as const

export const AI_CHART_D1_PALACE_WRITING_PREVIEW_EXECUTION_LEDGER_INVALID =
  'ai_chart_d1_palace_writing_preview_execution_ledger_invalid' as const

export class AiChartD1PalaceWritingPreviewExecutionLedgerError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_PREVIEW_EXECUTION_LEDGER_INVALID

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_PREVIEW_EXECUTION_LEDGER_INVALID,
    )
    Object.defineProperty(this, 'name', {
      value:
        'AiChartD1PalaceWritingPreviewExecutionLedgerError',
      enumerable: false,
      configurable: true,
    })
    Object.freeze(this)
  }
}

function normalizeInvalid(error: unknown): never {
  if (
    error instanceof
    AiChartD1PalaceWritingPreviewExecutionLedgerError
  ) {
    throw error
  }
  throw new AiChartD1PalaceWritingPreviewExecutionLedgerError()
}

export type AiChartD1PalaceWritingPreviewExecutionLedgerStage =
  Readonly<{
    sequence: 1 | 2
    stage: 'WRITING' | 'FIDELITY_REVIEW'
    bridgeFingerprint: string | null
    status:
      | 'NOT_STARTED'
      | 'REQUEST_ATTEMPTED'
      | 'REQUEST_DISPATCHED'
      | 'SUCCEEDED'
      | 'FAILED'
    failurePhase: null | 'PRE_FETCH' | 'POST_FETCH'
    durationMs: number | null
    usage: AiChartD1PalaceWritingPreviewUsage | null
    resultFingerprint: string | null
    errorCode:
      | null
      | 'WRITING_REQUEST_FAILED'
      | 'WRITING_OUTPUT_INVALID'
      | 'FIDELITY_REVIEW_REQUEST_FAILED'
      | 'FIDELITY_REVIEW_OUTPUT_INVALID'
  }>

export type AiChartD1PalaceWritingPreviewExecutionLedger =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_EXECUTION_LEDGER_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_EXECUTION_LEDGER_TASK
    fixtureId: AiChartD1PalaceWritingPreviewPlan['fixtureId']
    caseFingerprint: string
    planFingerprint: string
    gateFingerprint: string
    status:
      | 'READY'
      | 'WRITING_REQUEST_ATTEMPTED'
      | 'WRITING_FETCH_DISPATCHED'
      | 'WRITING_SUCCEEDED'
      | 'FIDELITY_REVIEW_REQUEST_ATTEMPTED'
      | 'FIDELITY_REVIEW_FETCH_DISPATCHED'
      | 'SUCCEEDED'
      | 'FAILED'
    currentStage: null | 'WRITING' | 'FIDELITY_REVIEW'
    completedStage: 'NONE' | 'WRITING' | 'COMPLETE'
    terminal: boolean
    nextRequiredAction:
      | 'ATTEMPT_WRITING_REQUEST'
      | 'DISPATCH_WRITING_FETCH'
      | 'RECORD_WRITING_OUTCOME'
      | 'ATTEMPT_FIDELITY_REVIEW_REQUEST'
      | 'DISPATCH_FIDELITY_REVIEW_FETCH'
      | 'RECORD_FIDELITY_REVIEW_OUTCOME'
      | 'STOP'
    attemptedRequests: 0 | 1 | 2
    executedRequests: 0 | 1 | 2
    fetchCount: 0 | 1 | 2
    retryPerformed: false
    stages: readonly [
      AiChartD1PalaceWritingPreviewExecutionLedgerStage,
      AiChartD1PalaceWritingPreviewExecutionLedgerStage,
    ]
    evidenceStatus:
      | 'IN_PROGRESS_NOT_PERSISTED'
      | 'TERMINAL_NOT_PERSISTED'
    restrictedArtifactPersisted: false
    safeMetadataOnly: true
  }>

function parseSha256(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(value)
  ) {
    throw new TypeError(
      'ai_chart_d1_palace_writing_preview_execution_ledger_invalid',
    )
  }
  return value
}

function parsePositiveInteger(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    throw new TypeError(
      'ai_chart_d1_palace_writing_preview_execution_ledger_invalid',
    )
  }
  return value
}

function parseUsage(
  value: unknown,
): AiChartD1PalaceWritingPreviewUsage {
  assertAiChartD1SafeGraph(value)
  const usage = requireAiChartD1ExactObject(value, [
    'inputTokens',
    'outputTokens',
    'reasoningTokens',
    'totalTokens',
  ])
  const values = [
    usage.inputTokens,
    usage.outputTokens,
    usage.reasoningTokens,
    usage.totalTokens,
  ]
  if (
    values.some(
      (item) =>
        typeof item !== 'number' ||
        !Number.isSafeInteger(item) ||
        item < 0,
    ) ||
    typeof usage.inputTokens !== 'number' ||
    typeof usage.outputTokens !== 'number' ||
    typeof usage.reasoningTokens !== 'number' ||
    typeof usage.totalTokens !== 'number' ||
    usage.reasoningTokens > usage.outputTokens ||
    usage.totalTokens !==
      usage.inputTokens + usage.outputTokens
  ) {
    throw new TypeError(
      'ai_chart_d1_palace_writing_preview_execution_ledger_invalid',
    )
  }
  return freezeAiChartD1Value({
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    reasoningTokens: usage.reasoningTokens,
    totalTokens: usage.totalTokens,
  })
}

function createExecutionLedger(
  input: Readonly<{
    previewPlan: unknown
    gateFingerprint: unknown
  }>,
): AiChartD1PalaceWritingPreviewExecutionLedger {
  const previewPlan =
    parseAiChartD1PalaceWritingPreviewPlan(input.previewPlan)
  const gateFingerprint = parseSha256(input.gateFingerprint)
  const writingStage = previewPlan.stages[0]

  if (
    writingStage?.sequence !== 1 ||
    writingStage.stage !== 'WRITING'
  ) {
    throw new TypeError(
      'ai_chart_d1_palace_writing_preview_execution_ledger_invalid',
    )
  }

  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_EXECUTION_LEDGER_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_EXECUTION_LEDGER_TASK,
    fixtureId: previewPlan.fixtureId,
    caseFingerprint: previewPlan.caseFingerprint,
    planFingerprint: previewPlan.planFingerprint,
    gateFingerprint,
    status: 'READY',
    currentStage: null,
    completedStage: 'NONE',
    terminal: false,
    nextRequiredAction: 'ATTEMPT_WRITING_REQUEST',
    attemptedRequests: 0,
    executedRequests: 0,
    fetchCount: 0,
    retryPerformed: false,
    stages: [
      {
        sequence: 1,
        stage: 'WRITING',
        bridgeFingerprint: writingStage.bridgeFingerprint,
        status: 'NOT_STARTED',
        failurePhase: null,
        durationMs: null,
        usage: null,
        resultFingerprint: null,
        errorCode: null,
      },
      {
        sequence: 2,
        stage: 'FIDELITY_REVIEW',
        bridgeFingerprint: null,
        status: 'NOT_STARTED',
        failurePhase: null,
        durationMs: null,
        usage: null,
        resultFingerprint: null,
        errorCode: null,
      },
    ],
    evidenceStatus: 'IN_PROGRESS_NOT_PERSISTED',
    restrictedArtifactPersisted: false,
    safeMetadataOnly: true,
  })
}

export function createAiChartD1PalaceWritingPreviewExecutionLedger(
  input: Readonly<{
    previewPlan: unknown
    gateFingerprint: unknown
  }>,
): AiChartD1PalaceWritingPreviewExecutionLedger {
  try {
    return createExecutionLedger(input)
  } catch (error) {
    normalizeInvalid(error)
  }
}

function createWritingRequestAttemptedLedger(
  ready: AiChartD1PalaceWritingPreviewExecutionLedger,
): AiChartD1PalaceWritingPreviewExecutionLedger {
  return freezeAiChartD1Value({
    ...ready,
    status: 'WRITING_REQUEST_ATTEMPTED',
    currentStage: 'WRITING',
    nextRequiredAction: 'DISPATCH_WRITING_FETCH',
    attemptedRequests: 1,
    stages: [
      {
        ...ready.stages[0],
        status: 'REQUEST_ATTEMPTED',
      },
      ready.stages[1],
    ],
  })
}

function createWritingFetchDispatchedLedger(
  attempted: AiChartD1PalaceWritingPreviewExecutionLedger,
): AiChartD1PalaceWritingPreviewExecutionLedger {
  return freezeAiChartD1Value({
    ...attempted,
    status: 'WRITING_FETCH_DISPATCHED',
    nextRequiredAction: 'RECORD_WRITING_OUTCOME',
    fetchCount: 1,
    stages: [
      {
        ...attempted.stages[0],
        status: 'REQUEST_DISPATCHED',
      },
      attempted.stages[1],
    ],
  })
}

function createWritingPreFetchFailureLedger(
  attempted: AiChartD1PalaceWritingPreviewExecutionLedger,
  durationMs: number,
): AiChartD1PalaceWritingPreviewExecutionLedger {
  return freezeAiChartD1Value({
    ...attempted,
    status: 'FAILED',
    terminal: true,
    nextRequiredAction: 'STOP',
    stages: [
      {
        ...attempted.stages[0],
        status: 'FAILED',
        failurePhase: 'PRE_FETCH',
        durationMs,
        errorCode: 'WRITING_REQUEST_FAILED',
      },
      attempted.stages[1],
    ],
    evidenceStatus: 'TERMINAL_NOT_PERSISTED',
  })
}

function createWritingSucceededLedger(
  dispatched: AiChartD1PalaceWritingPreviewExecutionLedger,
  input: Readonly<{
    durationMs: number
    usage: AiChartD1PalaceWritingPreviewUsage
    resultFingerprint: string
    nextBridgeFingerprint: string
  }>,
): AiChartD1PalaceWritingPreviewExecutionLedger {
  return freezeAiChartD1Value({
    ...dispatched,
    status: 'WRITING_SUCCEEDED',
    currentStage: null,
    completedStage: 'WRITING',
    nextRequiredAction:
      'ATTEMPT_FIDELITY_REVIEW_REQUEST',
    executedRequests: 1,
    stages: [
      {
        ...dispatched.stages[0],
        status: 'SUCCEEDED',
        durationMs: input.durationMs,
        usage: input.usage,
        resultFingerprint: input.resultFingerprint,
      },
      {
        ...dispatched.stages[1],
        bridgeFingerprint: input.nextBridgeFingerprint,
      },
    ],
  })
}

function createWritingPostFetchFailureLedger(
  dispatched: AiChartD1PalaceWritingPreviewExecutionLedger,
  input: Readonly<{
    durationMs: number
    usage: AiChartD1PalaceWritingPreviewUsage | null
    errorCode:
      | 'WRITING_REQUEST_FAILED'
      | 'WRITING_OUTPUT_INVALID'
  }>,
): AiChartD1PalaceWritingPreviewExecutionLedger {
  return freezeAiChartD1Value({
    ...dispatched,
    status: 'FAILED',
    terminal: true,
    nextRequiredAction: 'STOP',
    stages: [
      {
        ...dispatched.stages[0],
        status: 'FAILED',
        failurePhase: 'POST_FETCH',
        durationMs: input.durationMs,
        usage: input.usage,
        errorCode: input.errorCode,
      },
      dispatched.stages[1],
    ],
    evidenceStatus: 'TERMINAL_NOT_PERSISTED',
  })
}

function createFidelityRequestAttemptedLedger(
  writingSucceeded: AiChartD1PalaceWritingPreviewExecutionLedger,
): AiChartD1PalaceWritingPreviewExecutionLedger {
  return freezeAiChartD1Value({
    ...writingSucceeded,
    status: 'FIDELITY_REVIEW_REQUEST_ATTEMPTED',
    currentStage: 'FIDELITY_REVIEW',
    nextRequiredAction: 'DISPATCH_FIDELITY_REVIEW_FETCH',
    attemptedRequests: 2,
    stages: [
      writingSucceeded.stages[0],
      {
        ...writingSucceeded.stages[1],
        status: 'REQUEST_ATTEMPTED',
      },
    ],
  })
}

function createFidelityFetchDispatchedLedger(
  attempted: AiChartD1PalaceWritingPreviewExecutionLedger,
): AiChartD1PalaceWritingPreviewExecutionLedger {
  return freezeAiChartD1Value({
    ...attempted,
    status: 'FIDELITY_REVIEW_FETCH_DISPATCHED',
    nextRequiredAction: 'RECORD_FIDELITY_REVIEW_OUTCOME',
    fetchCount: 2,
    stages: [
      attempted.stages[0],
      {
        ...attempted.stages[1],
        status: 'REQUEST_DISPATCHED',
      },
    ],
  })
}

function createFidelitySucceededLedger(
  dispatched: AiChartD1PalaceWritingPreviewExecutionLedger,
  input: Readonly<{
    durationMs: number
    usage: AiChartD1PalaceWritingPreviewUsage
    resultFingerprint: string
  }>,
): AiChartD1PalaceWritingPreviewExecutionLedger {
  return freezeAiChartD1Value({
    ...dispatched,
    status: 'SUCCEEDED',
    currentStage: null,
    completedStage: 'COMPLETE',
    terminal: true,
    nextRequiredAction: 'STOP',
    executedRequests: 2,
    stages: [
      dispatched.stages[0],
      {
        ...dispatched.stages[1],
        status: 'SUCCEEDED',
        durationMs: input.durationMs,
        usage: input.usage,
        resultFingerprint: input.resultFingerprint,
      },
    ],
    evidenceStatus: 'TERMINAL_NOT_PERSISTED',
  })
}

function createFidelityFailureLedger(
  current: AiChartD1PalaceWritingPreviewExecutionLedger,
  input: Readonly<{
    failurePhase: 'PRE_FETCH' | 'POST_FETCH'
    durationMs: number
    usage: AiChartD1PalaceWritingPreviewUsage | null
    errorCode:
      | 'FIDELITY_REVIEW_REQUEST_FAILED'
      | 'FIDELITY_REVIEW_OUTPUT_INVALID'
  }>,
): AiChartD1PalaceWritingPreviewExecutionLedger {
  return freezeAiChartD1Value({
    ...current,
    status: 'FAILED',
    terminal: true,
    nextRequiredAction: 'STOP',
    stages: [
      current.stages[0],
      {
        ...current.stages[1],
        status: 'FAILED',
        failurePhase: input.failurePhase,
        durationMs: input.durationMs,
        usage: input.usage,
        errorCode: input.errorCode,
      },
    ],
    evidenceStatus: 'TERMINAL_NOT_PERSISTED',
  })
}

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

function reconstructWritingSucceededLedger(
  ledgerRecord: Readonly<Record<string, unknown>>,
  dispatched: AiChartD1PalaceWritingPreviewExecutionLedger,
): AiChartD1PalaceWritingPreviewExecutionLedger {
  if (
    !Array.isArray(ledgerRecord.stages) ||
    ledgerRecord.stages.length !== 2
  ) {
    throw new TypeError(
      'ai_chart_d1_palace_writing_preview_execution_ledger_invalid',
    )
  }
  const writingStage = requireAiChartD1ExactObject(
    ledgerRecord.stages[0],
    LEDGER_STAGE_FIELDS,
  )
  const fidelityStage = requireAiChartD1ExactObject(
    ledgerRecord.stages[1],
    LEDGER_STAGE_FIELDS,
  )

  return createWritingSucceededLedger(dispatched, {
    durationMs: parsePositiveInteger(writingStage.durationMs),
    usage: parseUsage(writingStage.usage),
    resultFingerprint: parseSha256(
      writingStage.resultFingerprint,
    ),
    nextBridgeFingerprint: parseSha256(
      fidelityStage.bridgeFingerprint,
    ),
  })
}

function advanceExecutionLedger(
  input: Readonly<{
    previewPlan: unknown
    ledger: unknown
    event: unknown
  }>,
): AiChartD1PalaceWritingPreviewExecutionLedger {
  const previewPlan =
    parseAiChartD1PalaceWritingPreviewPlan(input.previewPlan)
  assertAiChartD1SafeGraph(input.ledger)

  const ledgerRecord = requireAiChartD1ExactObject(input.ledger, [
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
  ])
  const ready =
    createExecutionLedger({
      previewPlan,
      gateFingerprint: ledgerRecord.gateFingerprint,
    })
  const attempted = createWritingRequestAttemptedLedger(ready)
  const dispatched = createWritingFetchDispatchedLedger(attempted)
  const currentCanonical =
    createAiChartD1PalaceWritingCanonicalJson(input.ledger)
  const readyMatches =
    currentCanonical ===
    createAiChartD1PalaceWritingCanonicalJson(ready)
  const attemptedMatches =
    currentCanonical ===
    createAiChartD1PalaceWritingCanonicalJson(attempted)
  const dispatchedMatches =
    currentCanonical ===
    createAiChartD1PalaceWritingCanonicalJson(dispatched)
  const mayContainWritingSuccess = [
    'WRITING_SUCCEEDED',
    'FIDELITY_REVIEW_REQUEST_ATTEMPTED',
    'FIDELITY_REVIEW_FETCH_DISPATCHED',
  ].includes(String(ledgerRecord.status))
  const writingSucceeded = mayContainWritingSuccess
    ? reconstructWritingSucceededLedger(ledgerRecord, dispatched)
    : null
  const fidelityAttempted = writingSucceeded
    ? createFidelityRequestAttemptedLedger(writingSucceeded)
    : null
  const fidelityDispatched = fidelityAttempted
    ? createFidelityFetchDispatchedLedger(fidelityAttempted)
    : null
  const writingSucceededMatches =
    writingSucceeded !== null &&
    currentCanonical ===
      createAiChartD1PalaceWritingCanonicalJson(writingSucceeded)
  const fidelityAttemptedMatches =
    fidelityAttempted !== null &&
    currentCanonical ===
      createAiChartD1PalaceWritingCanonicalJson(fidelityAttempted)
  const fidelityDispatchedMatches =
    fidelityDispatched !== null &&
    currentCanonical ===
      createAiChartD1PalaceWritingCanonicalJson(fidelityDispatched)

  if (
    !readyMatches &&
    !attemptedMatches &&
    !dispatchedMatches &&
    !writingSucceededMatches &&
    !fidelityAttemptedMatches &&
    !fidelityDispatchedMatches
  ) {
    throw new TypeError(
      'ai_chart_d1_palace_writing_preview_execution_ledger_invalid',
    )
  }

  assertAiChartD1SafeGraph(input.event)

  if (readyMatches) {
    const event = requireAiChartD1ExactObject(input.event, [
      'type',
      'sequence',
      'stage',
      'bridgeFingerprint',
    ])
    if (
      event.type !== 'REQUEST_ATTEMPTED' ||
      event.sequence !== 1 ||
      event.stage !== 'WRITING' ||
      event.bridgeFingerprint !==
        previewPlan.stages[0]?.bridgeFingerprint
    ) {
      throw new TypeError(
        'ai_chart_d1_palace_writing_preview_execution_ledger_invalid',
      )
    }
    return attempted
  }

  const eventType = (
    input.event as Readonly<Record<string, unknown>>
  ).type

  if (attemptedMatches && eventType === 'FETCH_DISPATCHED') {
    const event = requireAiChartD1ExactObject(input.event, [
      'type',
      'sequence',
      'stage',
    ])
    if (
      event.sequence !== 1 ||
      event.stage !== 'WRITING'
    ) {
      throw new TypeError(
        'ai_chart_d1_palace_writing_preview_execution_ledger_invalid',
      )
    }
    return dispatched
  }

  if (attemptedMatches) {
    const event = requireAiChartD1ExactObject(input.event, [
      'type',
      'sequence',
      'stage',
      'failurePhase',
      'durationMs',
      'usage',
      'errorCode',
    ])
    if (
      event.type !== 'STAGE_FAILED' ||
      event.sequence !== 1 ||
      event.stage !== 'WRITING' ||
      event.failurePhase !== 'PRE_FETCH' ||
      event.usage !== null ||
      event.errorCode !== 'WRITING_REQUEST_FAILED'
    ) {
      throw new TypeError(
        'ai_chart_d1_palace_writing_preview_execution_ledger_invalid',
      )
    }
    return createWritingPreFetchFailureLedger(
      attempted,
      parsePositiveInteger(event.durationMs),
    )
  }

  if (dispatchedMatches) {
    if (eventType === 'STAGE_FAILED') {
      const event = requireAiChartD1ExactObject(input.event, [
        'type',
        'sequence',
        'stage',
        'failurePhase',
        'durationMs',
        'usage',
        'errorCode',
      ])
      if (
        event.sequence !== 1 ||
        event.stage !== 'WRITING' ||
        event.failurePhase !== 'POST_FETCH' ||
        (
          event.errorCode !== 'WRITING_REQUEST_FAILED' &&
          event.errorCode !== 'WRITING_OUTPUT_INVALID'
        ) ||
        (
          event.errorCode === 'WRITING_REQUEST_FAILED' &&
          event.usage !== null
        ) ||
        (
          event.errorCode === 'WRITING_OUTPUT_INVALID' &&
          event.usage === null
        )
      ) {
        throw new TypeError(
          'ai_chart_d1_palace_writing_preview_execution_ledger_invalid',
        )
      }
      return createWritingPostFetchFailureLedger(dispatched, {
        durationMs: parsePositiveInteger(event.durationMs),
        usage:
          event.usage === null
            ? null
            : parseUsage(event.usage),
        errorCode: event.errorCode,
      })
    }

    const event = requireAiChartD1ExactObject(input.event, [
      'type',
      'sequence',
      'stage',
      'durationMs',
      'usage',
      'resultFingerprint',
      'nextBridgeFingerprint',
    ])
    if (
      event.type !== 'STAGE_SUCCEEDED' ||
      event.sequence !== 1 ||
      event.stage !== 'WRITING'
    ) {
      throw new TypeError(
        'ai_chart_d1_palace_writing_preview_execution_ledger_invalid',
      )
    }
    return createWritingSucceededLedger(dispatched, {
      durationMs: parsePositiveInteger(event.durationMs),
      usage: parseUsage(event.usage),
      resultFingerprint: parseSha256(event.resultFingerprint),
      nextBridgeFingerprint: parseSha256(
        event.nextBridgeFingerprint,
      ),
    })
  }

  if (writingSucceededMatches && writingSucceeded) {
    const event = requireAiChartD1ExactObject(input.event, [
      'type',
      'sequence',
      'stage',
      'bridgeFingerprint',
    ])
    if (
      event.type !== 'REQUEST_ATTEMPTED' ||
      event.sequence !== 2 ||
      event.stage !== 'FIDELITY_REVIEW' ||
      event.bridgeFingerprint !==
        writingSucceeded.stages[1].bridgeFingerprint
    ) {
      throw new TypeError(
        'ai_chart_d1_palace_writing_preview_execution_ledger_invalid',
      )
    }
    return createFidelityRequestAttemptedLedger(
      writingSucceeded,
    )
  }

  if (fidelityAttemptedMatches && fidelityAttempted) {
    if (eventType === 'STAGE_FAILED') {
      const event = requireAiChartD1ExactObject(input.event, [
        'type',
        'sequence',
        'stage',
        'failurePhase',
        'durationMs',
        'usage',
        'errorCode',
      ])
      if (
        event.sequence !== 2 ||
        event.stage !== 'FIDELITY_REVIEW' ||
        event.failurePhase !== 'PRE_FETCH' ||
        event.usage !== null ||
        event.errorCode !==
          'FIDELITY_REVIEW_REQUEST_FAILED'
      ) {
        throw new TypeError(
          'ai_chart_d1_palace_writing_preview_execution_ledger_invalid',
        )
      }
      return createFidelityFailureLedger(fidelityAttempted, {
        failurePhase: 'PRE_FETCH',
        durationMs: parsePositiveInteger(event.durationMs),
        usage: null,
        errorCode: 'FIDELITY_REVIEW_REQUEST_FAILED',
      })
    }

    const event = requireAiChartD1ExactObject(input.event, [
      'type',
      'sequence',
      'stage',
    ])
    if (
      event.type !== 'FETCH_DISPATCHED' ||
      event.sequence !== 2 ||
      event.stage !== 'FIDELITY_REVIEW'
    ) {
      throw new TypeError(
        'ai_chart_d1_palace_writing_preview_execution_ledger_invalid',
      )
    }
    return createFidelityFetchDispatchedLedger(
      fidelityAttempted,
    )
  }

  if (!fidelityDispatched) {
    throw new TypeError(
      'ai_chart_d1_palace_writing_preview_execution_ledger_invalid',
    )
  }

  if (eventType === 'STAGE_FAILED') {
    const event = requireAiChartD1ExactObject(input.event, [
      'type',
      'sequence',
      'stage',
      'failurePhase',
      'durationMs',
      'usage',
      'errorCode',
    ])
    if (
      event.sequence !== 2 ||
      event.stage !== 'FIDELITY_REVIEW' ||
      event.failurePhase !== 'POST_FETCH' ||
      (
        event.errorCode !==
          'FIDELITY_REVIEW_REQUEST_FAILED' &&
        event.errorCode !==
          'FIDELITY_REVIEW_OUTPUT_INVALID'
      ) ||
      (
        event.errorCode ===
          'FIDELITY_REVIEW_REQUEST_FAILED' &&
        event.usage !== null
      ) ||
      (
        event.errorCode ===
          'FIDELITY_REVIEW_OUTPUT_INVALID' &&
        event.usage === null
      )
    ) {
      throw new TypeError(
        'ai_chart_d1_palace_writing_preview_execution_ledger_invalid',
      )
    }
    return createFidelityFailureLedger(fidelityDispatched, {
      failurePhase: 'POST_FETCH',
      durationMs: parsePositiveInteger(event.durationMs),
      usage:
        event.usage === null
          ? null
          : parseUsage(event.usage),
      errorCode: event.errorCode,
    })
  }

  const event = requireAiChartD1ExactObject(input.event, [
    'type',
    'sequence',
    'stage',
    'durationMs',
    'usage',
    'resultFingerprint',
  ])
  if (
    event.type !== 'STAGE_SUCCEEDED' ||
    event.sequence !== 2 ||
    event.stage !== 'FIDELITY_REVIEW'
  ) {
    throw new TypeError(
      'ai_chart_d1_palace_writing_preview_execution_ledger_invalid',
    )
  }
  return createFidelitySucceededLedger(fidelityDispatched, {
    durationMs: parsePositiveInteger(event.durationMs),
    usage: parseUsage(event.usage),
    resultFingerprint: parseSha256(event.resultFingerprint),
  })
}

export function advanceAiChartD1PalaceWritingPreviewExecutionLedger(
  input: Readonly<{
    previewPlan: unknown
    ledger: unknown
    event: unknown
  }>,
): AiChartD1PalaceWritingPreviewExecutionLedger {
  try {
    return advanceExecutionLedger(input)
  } catch (error) {
    normalizeInvalid(error)
  }
}
