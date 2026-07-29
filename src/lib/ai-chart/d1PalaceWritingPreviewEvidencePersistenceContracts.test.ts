import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  buildAiChartD1PalaceWritingGoldenCase,
} from './d1PalaceWritingGoldenCaseContracts'
import {
  buildAiChartD1PalaceWritingPreviewPlan,
} from './d1PalaceWritingPreviewContracts'
import {
  advanceAiChartD1PalaceWritingPreviewExecutionLedger,
  createAiChartD1PalaceWritingPreviewExecutionLedger,
} from './d1PalaceWritingPreviewExecutionLedgerContracts'
import {
  AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_PERSISTENCE_ENVELOPE_TASK,
  AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_PERSISTENCE_ENVELOPE_VERSION,
  AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_PERSISTENCE_INVALID,
  AiChartD1PalaceWritingPreviewEvidencePersistenceError,
  buildAiChartD1PalaceWritingPreviewEvidencePersistenceEnvelope,
  parseAiChartD1PalaceWritingPreviewEvidencePersistenceEnvelope,
} from './d1PalaceWritingPreviewEvidencePersistenceContracts'
import {
  buildAiChartD1PalaceWritingPreviewGatePlan,
} from './d1PalaceWritingPreviewGateContracts'

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
const gatePlan =
  buildAiChartD1PalaceWritingPreviewGatePlan(previewPlan)
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
const writingResultFingerprint = 'b'.repeat(64)
const fidelityBridgeFingerprint = 'c'.repeat(64)
const fidelityResultFingerprint = 'd'.repeat(64)

function buildWritingPreFetchFailureLedger() {
  const ready =
    createAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      gateFingerprint: gatePlan.gateFingerprint,
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
  return advanceAiChartD1PalaceWritingPreviewExecutionLedger({
    previewPlan,
    ledger: attempted,
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
}

function buildSuccessfulLedger() {
  const ready =
    createAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      gateFingerprint: gatePlan.gateFingerprint,
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
  return advanceAiChartD1PalaceWritingPreviewExecutionLedger({
    previewPlan,
    ledger: fidelityDispatched,
    event: {
      type: 'STAGE_SUCCEEDED',
      sequence: 2,
      stage: 'FIDELITY_REVIEW',
      durationMs: 800,
      usage: fidelityUsage,
      resultFingerprint: fidelityResultFingerprint,
    },
  })
}

check('terminal failed Evidence becomes a deterministic write-once safe persistence envelope', () => {
  const executionLedger = buildWritingPreFetchFailureLedger()
  const envelope =
    buildAiChartD1PalaceWritingPreviewEvidencePersistenceEnvelope({
      previewPlan,
      gatePlan,
      executionLedger,
    })
  const repeated =
    buildAiChartD1PalaceWritingPreviewEvidencePersistenceEnvelope({
      previewPlan,
      gatePlan,
      executionLedger,
    })

  assert.equal(
    envelope.contractVersion,
    AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_PERSISTENCE_ENVELOPE_VERSION,
  )
  assert.equal(
    envelope.task,
    AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_PERSISTENCE_ENVELOPE_TASK,
  )
  assert.equal(envelope.fixtureId, previewPlan.fixtureId)
  assert.equal(
    envelope.previewPlanFingerprint,
    previewPlan.planFingerprint,
  )
  assert.equal(
    envelope.gateFingerprint,
    gatePlan.gateFingerprint,
  )
  assert.equal(envelope.artifactName, 'request-failed.json')
  assert.equal(envelope.storageScope, 'GATE_FINGERPRINT')
  assert.equal(
    envelope.storageAuthority,
    'TRUSTED_SERVER_EVIDENCE_STORAGE_ADAPTER_REQUIRED',
  )
  assert.equal(envelope.serialization, 'CANONICAL_JSON_UTF8')
  assert.equal(envelope.createMode, 'EXCLUSIVE_CREATE')
  assert.equal(envelope.directoryMode, '0700')
  assert.equal(envelope.fileMode, '0600')
  assert.equal(envelope.overwriteAllowed, false)
  assert.equal(envelope.retryAllowed, false)
  assert.equal(envelope.persistenceStatus, 'NOT_PERSISTED')
  assert.equal(
    envelope.nextRequiredAction,
    'PERSIST_WITH_TRUSTED_SERVER_ADAPTER',
  )
  assert.equal(
    envelope.restrictedResultArtifactPolicy,
    'SEPARATE_NOT_INCLUDED',
  )
  assert.match(envelope.evidenceFingerprint, /^[a-f0-9]{64}$/u)
  assert.equal(
    envelope.evidenceFingerprint,
    repeated.evidenceFingerprint,
  )
  assert.deepEqual(envelope, repeated)
  assert.equal(envelope.evidence.status, 'FAILED')
  assert.equal(envelope.evidence.fetchCount, 0)
  assert.equal(
    envelope.evidence.stages[0].errorCode,
    'WRITING_REQUEST_FAILED',
  )
  assert.equal(recursivelyFrozen(envelope), true)

  const serialized = JSON.stringify(envelope)
  for (const forbidden of [
    '"outputText"',
    '"output_text"',
    '"prompt"',
    '"instructions"',
    '"requestBody"',
    '"apiKey"',
    '"authorizationHeader"',
    '"chartSnapshot"',
    '"birthDate"',
    '"birthTime"',
    'gateFingerprint\":\"not-the-gate',
  ]) {
    assert.equal(
      serialized.toLowerCase().includes(forbidden.toLowerCase()),
      false,
      forbidden,
    )
  }
})

check('successful Evidence selects the success artifact but remains separate from restricted model output', () => {
  const envelope =
    buildAiChartD1PalaceWritingPreviewEvidencePersistenceEnvelope({
      previewPlan,
      gatePlan,
      executionLedger: buildSuccessfulLedger(),
    })

  assert.equal(envelope.artifactName, 'request-succeeded.json')
  assert.equal(envelope.evidence.status, 'SUCCEEDED')
  assert.equal(envelope.evidence.completedStage, 'COMPLETE')
  assert.equal(envelope.evidence.attemptedRequests, 2)
  assert.equal(envelope.evidence.fetchCount, 2)
  assert.equal(envelope.evidence.executedRequests, 2)
  assert.equal(
    envelope.evidence.customerDeliveryStatus,
    'BLOCKED_PENDING_HUMAN_REVIEW',
  )
  assert.equal(
    envelope.restrictedResultArtifactPolicy,
    'SEPARATE_NOT_INCLUDED',
  )
  assert.equal(envelope.persistenceStatus, 'NOT_PERSISTED')
  assert.equal(recursivelyFrozen(envelope), true)
})

check('persistence envelope parser revalidates its Plan, Gate, Evidence, filename, and fingerprint bindings', () => {
  const envelope =
    buildAiChartD1PalaceWritingPreviewEvidencePersistenceEnvelope({
      previewPlan,
      gatePlan,
      executionLedger: buildSuccessfulLedger(),
    })
  const parsed =
    parseAiChartD1PalaceWritingPreviewEvidencePersistenceEnvelope(
      structuredClone(envelope),
      previewPlan,
      gatePlan,
    )

  assert.deepEqual(parsed, envelope)
  assert.equal(recursivelyFrozen(parsed), true)

  for (const tampered of [
    {
      ...structuredClone(envelope),
      artifactName: 'request-failed.json',
    },
    {
      ...structuredClone(envelope),
      evidenceFingerprint: '0'.repeat(64),
    },
    {
      ...structuredClone(envelope),
      storageRoot: '/caller-selected-root',
    },
    {
      ...structuredClone(envelope),
      evidence: {
        ...structuredClone(envelope.evidence),
        outputText: 'sensitive-model-marker',
      },
    },
  ]) {
    assert.throws(
      () =>
        parseAiChartD1PalaceWritingPreviewEvidencePersistenceEnvelope(
          tampered,
          previewPlan,
          gatePlan,
        ),
      AiChartD1PalaceWritingPreviewEvidencePersistenceError,
    )
  }
})

function assertPersistenceInvalid(input: unknown): void {
  let thrown: unknown
  try {
    Reflect.apply(
      buildAiChartD1PalaceWritingPreviewEvidencePersistenceEnvelope,
      undefined,
      [input],
    )
  } catch (error) {
    thrown = error
  }
  assert.ok(
    thrown instanceof
      AiChartD1PalaceWritingPreviewEvidencePersistenceError,
  )
  assert.equal(
    thrown.code,
    AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_PERSISTENCE_INVALID,
  )
  assert.equal(
    thrown.message,
    AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_PERSISTENCE_INVALID,
  )
  assert.equal(Object.isFrozen(thrown), true)
}

check('Gate drift, non-terminal state, and sensitive additions fail closed before persistence', () => {
  const wrongGateFingerprint = 'f'.repeat(64)
  const wrongGateReady =
    createAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      gateFingerprint: wrongGateFingerprint,
    })
  const wrongGateAttempted =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: wrongGateReady,
      event: {
        type: 'REQUEST_ATTEMPTED',
        sequence: 1,
        stage: 'WRITING',
        bridgeFingerprint:
          previewPlan.stages[0].bridgeFingerprint,
      },
    })
  const wrongGateFailure =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: wrongGateAttempted,
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
  assertPersistenceInvalid({
    previewPlan,
    gatePlan,
    executionLedger: wrongGateFailure,
  })

  const ready =
    createAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      gateFingerprint: gatePlan.gateFingerprint,
    })
  assertPersistenceInvalid({
    previewPlan,
    gatePlan,
    executionLedger: ready,
  })

  const sensitiveLedger = structuredClone(
    buildWritingPreFetchFailureLedger(),
  ) as Record<string, unknown>
  sensitiveLedger.outputText = 'sensitive-model-marker'
  let serializedError = ''
  try {
    buildAiChartD1PalaceWritingPreviewEvidencePersistenceEnvelope({
      previewPlan,
      gatePlan,
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
    /ai_chart_d1_palace_writing_preview_evidence_persistence_invalid/,
  )

  assertPersistenceInvalid({
    previewPlan,
    gatePlan,
    executionLedger: buildWritingPreFetchFailureLedger(),
    storageRoot: '/caller-selected-root',
  })
})

check('persistence envelope contract is pure and cannot write Evidence or access Runtime', () => {
  const source = readFileSync(
    fileURLToPath(
      new URL(
        './d1PalaceWritingPreviewEvidencePersistenceContracts.ts',
        import.meta.url,
      ),
    ),
    'utf8',
  )
  assert.doesNotMatch(
    source,
    /fetch\s*\(|process\.env|OPENAI_API_KEY|Authorization|node:fs|\.server|writeFile|mkdir|open\s*\(|requestAiChartOpenAiStructuredResponse/,
  )
})

console.log(
  `AI Chart D1 palace-writing Preview Evidence persistence checks passed: ${checks}`,
)
