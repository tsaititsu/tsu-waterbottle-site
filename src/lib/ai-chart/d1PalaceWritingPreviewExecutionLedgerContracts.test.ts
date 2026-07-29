import assert from 'node:assert/strict'
import {
  buildAiChartD1PalaceWritingGoldenCase,
} from './d1PalaceWritingGoldenCaseContracts'
import {
  buildAiChartD1PalaceWritingPreviewPlan,
} from './d1PalaceWritingPreviewContracts'
import {
  AI_CHART_D1_PALACE_WRITING_PREVIEW_EXECUTION_LEDGER_INVALID,
  AI_CHART_D1_PALACE_WRITING_PREVIEW_EXECUTION_LEDGER_TASK,
  AI_CHART_D1_PALACE_WRITING_PREVIEW_EXECUTION_LEDGER_VERSION,
  AiChartD1PalaceWritingPreviewExecutionLedgerError,
  advanceAiChartD1PalaceWritingPreviewExecutionLedger,
  createAiChartD1PalaceWritingPreviewExecutionLedger,
} from './d1PalaceWritingPreviewExecutionLedgerContracts'

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
const previewPlan =
  buildAiChartD1PalaceWritingPreviewPlan(goldenCase)
const gateFingerprint = 'a'.repeat(64)
const writingResultFingerprint = 'b'.repeat(64)
const fidelityBridgeFingerprint = 'c'.repeat(64)
const writingUsage = {
  inputTokens: 1_200,
  outputTokens: 800,
  reasoningTokens: 200,
  totalTokens: 2_000,
} as const
const fidelityUsage = {
  inputTokens: 900,
  outputTokens: 300,
  reasoningTokens: 100,
  totalTokens: 1_200,
} as const
const fidelityResultFingerprint = 'd'.repeat(64)

function buildWritingSucceededLedger() {
  const ready =
    createAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      gateFingerprint,
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
          previewPlan.stages[0].bridgeFingerprint,
      },
    })
  const dispatched =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: attempted,
      event: {
        type: 'FETCH_DISPATCHED',
        sequence: 1,
        stage: 'WRITING',
      },
    })

  return advanceAiChartD1PalaceWritingPreviewExecutionLedger({
    previewPlan,
    ledger: dispatched,
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

check('READY ledger starts with truthful zero counters and no implied Fidelity bridge', () => {
  const ledger =
    createAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      gateFingerprint,
    })

  assert.deepEqual(ledger, {
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
        bridgeFingerprint:
          previewPlan.stages[0].bridgeFingerprint,
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
  assert.equal(recursivelyFrozen(ledger), true)
})

check('request attempt increments attemptedRequests before any fetch is dispatched', () => {
  const ready =
    createAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      gateFingerprint,
    })
  const ledger =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
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

  assert.deepEqual(ledger, {
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
  assert.equal(ledger.fetchCount, 0)
  assert.equal(ledger.executedRequests, 0)
  assert.equal(recursivelyFrozen(ledger), true)
})

check('fetch dispatch increments fetchCount without claiming a completed request', () => {
  const ready =
    createAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      gateFingerprint,
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
          previewPlan.stages[0].bridgeFingerprint,
      },
    })
  const ledger =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: attempted,
      event: {
        type: 'FETCH_DISPATCHED',
        sequence: 1,
        stage: 'WRITING',
      },
    })

  assert.deepEqual(ledger, {
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
  assert.equal(ledger.attemptedRequests, 1)
  assert.equal(ledger.executedRequests, 0)
  assert.equal(recursivelyFrozen(ledger), true)
})

check('pre-fetch failure stays terminal without falsely incrementing fetchCount', () => {
  const ready =
    createAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      gateFingerprint,
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
          previewPlan.stages[0].bridgeFingerprint,
      },
    })
  const ledger =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: attempted,
      event: {
        type: 'STAGE_FAILED',
        sequence: 1,
        stage: 'WRITING',
        failurePhase: 'PRE_FETCH',
        durationMs: 7,
        usage: null,
        errorCode: 'WRITING_REQUEST_FAILED',
      },
    })

  assert.deepEqual(ledger, {
    ...attempted,
    status: 'FAILED',
    terminal: true,
    nextRequiredAction: 'STOP',
    stages: [
      {
        ...attempted.stages[0],
        status: 'FAILED',
        failurePhase: 'PRE_FETCH',
        durationMs: 7,
        errorCode: 'WRITING_REQUEST_FAILED',
      },
      attempted.stages[1],
    ],
    evidenceStatus: 'TERMINAL_NOT_PERSISTED',
  })
  assert.equal(ledger.attemptedRequests, 1)
  assert.equal(ledger.fetchCount, 0)
  assert.equal(ledger.executedRequests, 0)
  assert.equal(recursivelyFrozen(ledger), true)
})

check('validated Writing success binds the derived Fidelity bridge and increments executedRequests', () => {
  const ready =
    createAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      gateFingerprint,
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
          previewPlan.stages[0].bridgeFingerprint,
      },
    })
  const dispatched =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: attempted,
      event: {
        type: 'FETCH_DISPATCHED',
        sequence: 1,
        stage: 'WRITING',
      },
    })
  const ledger =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: dispatched,
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

  assert.deepEqual(ledger, {
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
        durationMs: 1_500,
        usage: writingUsage,
        resultFingerprint: writingResultFingerprint,
      },
      {
        ...dispatched.stages[1],
        bridgeFingerprint: fidelityBridgeFingerprint,
      },
    ],
  })
  assert.equal(ledger.attemptedRequests, 1)
  assert.equal(ledger.fetchCount, 1)
  assert.equal(recursivelyFrozen(ledger), true)
})

check('Fidelity Review completes the two-stage ledger with exact 2/2/2 counters', () => {
  const ready =
    createAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      gateFingerprint,
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
          previewPlan.stages[0].bridgeFingerprint,
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
        durationMs: 1_500,
        usage: writingUsage,
        resultFingerprint: writingResultFingerprint,
        nextBridgeFingerprint: fidelityBridgeFingerprint,
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
        bridgeFingerprint: fidelityBridgeFingerprint,
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
  const ledger =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: fidelityDispatched,
      event: {
        type: 'STAGE_SUCCEEDED',
        sequence: 2,
        stage: 'FIDELITY_REVIEW',
        durationMs: 700,
        usage: fidelityUsage,
        resultFingerprint: fidelityResultFingerprint,
      },
    })

  assert.deepEqual(fidelityAttempted, {
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
  assert.deepEqual(fidelityDispatched, {
    ...fidelityAttempted,
    status: 'FIDELITY_REVIEW_FETCH_DISPATCHED',
    nextRequiredAction: 'RECORD_FIDELITY_REVIEW_OUTCOME',
    fetchCount: 2,
    stages: [
      fidelityAttempted.stages[0],
      {
        ...fidelityAttempted.stages[1],
        status: 'REQUEST_DISPATCHED',
      },
    ],
  })
  assert.deepEqual(ledger, {
    ...fidelityDispatched,
    status: 'SUCCEEDED',
    currentStage: null,
    completedStage: 'COMPLETE',
    terminal: true,
    nextRequiredAction: 'STOP',
    executedRequests: 2,
    stages: [
      fidelityDispatched.stages[0],
      {
        ...fidelityDispatched.stages[1],
        status: 'SUCCEEDED',
        durationMs: 700,
        usage: fidelityUsage,
        resultFingerprint: fidelityResultFingerprint,
      },
    ],
    evidenceStatus: 'TERMINAL_NOT_PERSISTED',
  })
  assert.equal(ledger.attemptedRequests, 2)
  assert.equal(ledger.fetchCount, 2)
  assert.equal(ledger.executedRequests, 2)
  assert.equal(ledger.retryPerformed, false)
  assert.equal(recursivelyFrozen(ledger), true)
})

check('post-fetch invalid output preserves safe usage without claiming execution success', () => {
  const ready =
    createAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      gateFingerprint,
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
          previewPlan.stages[0].bridgeFingerprint,
      },
    })
  const dispatched =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: attempted,
      event: {
        type: 'FETCH_DISPATCHED',
        sequence: 1,
        stage: 'WRITING',
      },
    })
  const ledger =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: dispatched,
      event: {
        type: 'STAGE_FAILED',
        sequence: 1,
        stage: 'WRITING',
        failurePhase: 'POST_FETCH',
        durationMs: 1_600,
        usage: writingUsage,
        errorCode: 'WRITING_OUTPUT_INVALID',
      },
    })

  assert.deepEqual(ledger, {
    ...dispatched,
    status: 'FAILED',
    terminal: true,
    nextRequiredAction: 'STOP',
    stages: [
      {
        ...dispatched.stages[0],
        status: 'FAILED',
        failurePhase: 'POST_FETCH',
        durationMs: 1_600,
        usage: writingUsage,
        errorCode: 'WRITING_OUTPUT_INVALID',
      },
      dispatched.stages[1],
    ],
    evidenceStatus: 'TERMINAL_NOT_PERSISTED',
  })
  assert.equal(ledger.attemptedRequests, 1)
  assert.equal(ledger.fetchCount, 1)
  assert.equal(ledger.executedRequests, 0)
  assert.equal(recursivelyFrozen(ledger), true)
})

check('Fidelity failures preserve Writing success and terminal ledgers cannot retry', () => {
  const writingSucceeded = buildWritingSucceededLedger()
  const fidelityAttempted =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: writingSucceeded,
      event: {
        type: 'REQUEST_ATTEMPTED',
        sequence: 2,
        stage: 'FIDELITY_REVIEW',
        bridgeFingerprint: fidelityBridgeFingerprint,
      },
    })
  const preFetchFailure =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: fidelityAttempted,
      event: {
        type: 'STAGE_FAILED',
        sequence: 2,
        stage: 'FIDELITY_REVIEW',
        failurePhase: 'PRE_FETCH',
        durationMs: 12,
        usage: null,
        errorCode: 'FIDELITY_REVIEW_REQUEST_FAILED',
      },
    })

  assert.equal(preFetchFailure.attemptedRequests, 2)
  assert.equal(preFetchFailure.fetchCount, 1)
  assert.equal(preFetchFailure.executedRequests, 1)
  assert.equal(preFetchFailure.completedStage, 'WRITING')
  assert.equal(preFetchFailure.stages[0].status, 'SUCCEEDED')
  assert.deepEqual(preFetchFailure.stages[1], {
    ...fidelityAttempted.stages[1],
    status: 'FAILED',
    failurePhase: 'PRE_FETCH',
    durationMs: 12,
    errorCode: 'FIDELITY_REVIEW_REQUEST_FAILED',
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
  const postFetchFailure =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: fidelityDispatched,
      event: {
        type: 'STAGE_FAILED',
        sequence: 2,
        stage: 'FIDELITY_REVIEW',
        failurePhase: 'POST_FETCH',
        durationMs: 900,
        usage: fidelityUsage,
        errorCode: 'FIDELITY_REVIEW_OUTPUT_INVALID',
      },
    })

  assert.equal(postFetchFailure.attemptedRequests, 2)
  assert.equal(postFetchFailure.fetchCount, 2)
  assert.equal(postFetchFailure.executedRequests, 1)
  assert.equal(postFetchFailure.retryPerformed, false)
  assert.equal(postFetchFailure.terminal, true)
  assert.equal(postFetchFailure.nextRequiredAction, 'STOP')
  assert.deepEqual(postFetchFailure.stages[1], {
    ...fidelityDispatched.stages[1],
    status: 'FAILED',
    failurePhase: 'POST_FETCH',
    durationMs: 900,
    usage: fidelityUsage,
    errorCode: 'FIDELITY_REVIEW_OUTPUT_INVALID',
  })
  assert.throws(
    () =>
      advanceAiChartD1PalaceWritingPreviewExecutionLedger({
        previewPlan,
        ledger: postFetchFailure,
        event: {
          type: 'REQUEST_ATTEMPTED',
          sequence: 2,
          stage: 'FIDELITY_REVIEW',
          bridgeFingerprint: fidelityBridgeFingerprint,
        },
      }),
  )
  assert.equal(recursivelyFrozen(preFetchFailure), true)
  assert.equal(recursivelyFrozen(postFetchFailure), true)
})

check('untrusted ledger events fail closed with one immutable safe error identity', () => {
  function expectInvalid(run: () => unknown): void {
    let caught: unknown
    try {
      run()
    } catch (error) {
      caught = error
    }
    assert.ok(
      caught instanceof
        AiChartD1PalaceWritingPreviewExecutionLedgerError,
    )
    assert.equal(
      caught.code,
      AI_CHART_D1_PALACE_WRITING_PREVIEW_EXECUTION_LEDGER_INVALID,
    )
    assert.equal(Object.isFrozen(caught), true)
    assert.equal(
      JSON.stringify(caught),
      JSON.stringify({
        code:
          AI_CHART_D1_PALACE_WRITING_PREVIEW_EXECUTION_LEDGER_INVALID,
      }),
    )
  }

  expectInvalid(() =>
    createAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      gateFingerprint: 'not-a-fingerprint',
    }),
  )

  const ready =
    createAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      gateFingerprint,
    })
  expectInvalid(() =>
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: ready,
      event: {
        type: 'REQUEST_ATTEMPTED',
        sequence: 1,
        stage: 'WRITING',
        bridgeFingerprint: 'e'.repeat(64),
      },
    }),
  )
  expectInvalid(() =>
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: ready,
      event: {
        type: 'REQUEST_ATTEMPTED',
        sequence: 1,
        stage: 'WRITING',
        bridgeFingerprint:
          previewPlan.stages[0].bridgeFingerprint,
        prompt: 'SENSITIVE_MARKER',
      },
    }),
  )

  const attempted =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
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
  expectInvalid(() =>
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: {
        ...attempted,
        fetchCount: 1,
      },
      event: {
        type: 'FETCH_DISPATCHED',
        sequence: 1,
        stage: 'WRITING',
      },
    }),
  )

  const dispatched =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: attempted,
      event: {
        type: 'FETCH_DISPATCHED',
        sequence: 1,
        stage: 'WRITING',
      },
    })
  expectInvalid(() =>
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: dispatched,
      event: {
        type: 'STAGE_SUCCEEDED',
        sequence: 1,
        stage: 'WRITING',
        durationMs: 1,
        usage: {
          ...writingUsage,
          totalTokens: 999,
          outputText: 'SENSITIVE_MARKER',
        },
        resultFingerprint: writingResultFingerprint,
        nextBridgeFingerprint: fidelityBridgeFingerprint,
      },
    }),
  )
})

console.log(
  `AI Chart D1 palace-writing execution-ledger checks passed: ${checks}`,
)
