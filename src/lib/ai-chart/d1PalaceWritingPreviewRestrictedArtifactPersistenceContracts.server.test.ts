import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import Module, { createRequire } from 'node:module'
import {
  buildAiChartD1PalaceWritingGoldenCase,
} from './d1PalaceWritingGoldenCaseContracts'
import {
  createAiChartD1PalaceWritingFidelityCanonicalJson,
} from './d1PalaceWritingFidelityPromptPackageContracts'
import {
  buildAiChartD1PalaceWritingPreviewPlan,
} from './d1PalaceWritingPreviewContracts'
import {
  projectAiChartD1PalaceWritingPreviewEvidence,
} from './d1PalaceWritingPreviewEvidenceProjectionContracts'
import {
  advanceAiChartD1PalaceWritingPreviewExecutionLedger,
  createAiChartD1PalaceWritingPreviewExecutionLedger,
} from './d1PalaceWritingPreviewExecutionLedgerContracts'
import {
  buildAiChartD1PalaceWritingPreviewGatePlan,
} from './d1PalaceWritingPreviewGateContracts'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'
import {
  createAiChartD1PalaceWritingResultSha256,
} from './d1PalaceWritingResultContracts'

type NodeModuleInternals = {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options?: unknown,
  ) => string
  _load: (
    request: string,
    parent: unknown,
    isMain: boolean,
  ) => unknown
}
type Mutable<T> = {
  -readonly [Key in keyof T]: T[Key] extends readonly (infer Item)[]
    ? Mutable<Item>[]
    : T[Key] extends object
      ? Mutable<T[Key]>
      : T[Key]
}

const moduleInternals = Module as unknown as NodeModuleInternals
const originalResolveFilename = moduleInternals._resolveFilename
const originalLoad = moduleInternals._load
const testRequire = createRequire(import.meta.url)
const serverOnlyStubPath = testRequire.resolve('./d1Assets')

function loadServerOnlyModule<T>(request: string): T {
  try {
    moduleInternals._resolveFilename =
      function resolveFilenameForTest(
        this: unknown,
        moduleRequest: string,
        parent: unknown,
        isMain: boolean,
        options?: unknown,
      ) {
        if (moduleRequest === 'server-only') {
          return serverOnlyStubPath
        }
        return originalResolveFilename.call(
          this,
          moduleRequest,
          parent,
          isMain,
          options,
        )
      }
    moduleInternals._load = function loadForTest(
      this: unknown,
      moduleRequest: string,
      parent: unknown,
      isMain: boolean,
    ) {
      if (moduleRequest === 'server-only') return {}
      return originalLoad.call(
        this,
        moduleRequest,
        parent,
        isMain,
      )
    }
    return testRequire(request) as T
  } finally {
    moduleInternals._resolveFilename = originalResolveFilename
    moduleInternals._load = originalLoad
  }
}

function sha256Canonical(value: unknown): string {
  return createHash('sha256')
    .update(
      createAiChartD1PalaceWritingFidelityCanonicalJson(value),
      'utf8',
    )
    .digest('hex')
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

const goldenCase =
  buildAiChartD1PalaceWritingGoldenCase()
const previewPlan =
  buildAiChartD1PalaceWritingPreviewPlan(goldenCase)
const gatePlan =
  buildAiChartD1PalaceWritingPreviewGatePlan(previewPlan)
const writingResultSha256 =
  createAiChartD1PalaceWritingResultSha256(
    goldenCase.expectedWritingResult,
  )
const fidelityReviewSha256 = sha256Canonical(
  goldenCase.expectedFidelityReview,
)

function buildSuccessfulVerifiedEvidence() {
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
        usage: {
          inputTokens: 1_200,
          outputTokens: 800,
          reasoningTokens: 200,
          totalTokens: 2_000,
        },
        resultFingerprint: writingResultSha256,
        nextBridgeFingerprint:
          goldenCase.benchmarkPlan.stages[1].bridgeFingerprint,
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
          goldenCase.benchmarkPlan.stages[1].bridgeFingerprint,
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
  const succeeded =
    advanceAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      ledger: fidelityDispatched,
      event: {
        type: 'STAGE_SUCCEEDED',
        sequence: 2,
        stage: 'FIDELITY_REVIEW',
        durationMs: 800,
        usage: {
          inputTokens: 900,
          outputTokens: 300,
          reasoningTokens: 100,
          totalTokens: 1_200,
        },
        resultFingerprint: fidelityReviewSha256,
      },
    })
  const evidence =
    projectAiChartD1PalaceWritingPreviewEvidence({
      previewPlan,
      executionLedger: succeeded,
    })
  const evidenceFingerprint = createHash('sha256')
    .update(
      createAiChartD1PalaceWritingCanonicalJson(evidence),
      'utf8',
    )
    .digest('hex')

  return Object.freeze({
    contractVersion:
      'ai-chart-d1-palace-writing-preview-evidence-readback/v1',
    task: 'D1_PALACE_WRITING_PREVIEW_EVIDENCE_READBACK',
    gateFingerprint: gatePlan.gateFingerprint,
    authority: 'TRUSTED_SERVER_EVIDENCE_READBACK_ADAPTER',
    artifactName: 'request-succeeded.json',
    evidenceFingerprint,
    status: 'VERIFIED',
    evidence,
    restrictedResultArtifactStatus: 'NOT_READ',
  })
}

async function run(): Promise<void> {
  const artifactContracts =
    loadServerOnlyModule<
      typeof import('./d1PalaceWritingPreviewRestrictedArtifactContracts.server')
    >(
      './d1PalaceWritingPreviewRestrictedArtifactContracts.server',
    )
  const persistenceContracts =
    loadServerOnlyModule<
      typeof import('./d1PalaceWritingPreviewRestrictedArtifactPersistenceContracts.server')
    >(
      './d1PalaceWritingPreviewRestrictedArtifactPersistenceContracts.server',
    )
  const verifiedEvidence = buildSuccessfulVerifiedEvidence()
  const artifact =
    artifactContracts.buildAiChartD1PalaceWritingPreviewRestrictedArtifact(
      {
        previewPlan,
        gatePlan,
        verifiedEvidence,
        writingPromptPackage:
          goldenCase.writingPromptPackage,
        writingResult: goldenCase.expectedWritingResult,
        fidelityPromptPackage:
          goldenCase.fidelityPromptPackage,
        fidelityReview:
          goldenCase.expectedFidelityReview,
      },
    )
  const envelope =
    persistenceContracts.buildAiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceEnvelope(
      {
        previewPlan,
        gatePlan,
        verifiedEvidence,
        writingPromptPackage:
          goldenCase.writingPromptPackage,
        fidelityPromptPackage:
          goldenCase.fidelityPromptPackage,
        restrictedArtifact: artifact,
      },
    )
  const repeated =
    persistenceContracts.buildAiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceEnvelope(
      {
        previewPlan,
        gatePlan,
        verifiedEvidence,
        writingPromptPackage:
          goldenCase.writingPromptPackage,
        fidelityPromptPackage:
          goldenCase.fidelityPromptPackage,
        restrictedArtifact: artifact,
      },
    )

  assert.equal(
    envelope.contractVersion,
    persistenceContracts.AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_PERSISTENCE_ENVELOPE_VERSION,
  )
  assert.equal(
    envelope.task,
    persistenceContracts.AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_PERSISTENCE_ENVELOPE_TASK,
  )
  assert.equal(
    envelope.dataClassification,
    'RESTRICTED_MODEL_OUTPUT',
  )
  assert.equal(
    envelope.gateFingerprint,
    gatePlan.gateFingerprint,
  )
  assert.equal(
    envelope.safeEvidenceFingerprint,
    verifiedEvidence.evidenceFingerprint,
  )
  assert.equal(
    envelope.restrictedArtifactFingerprint,
    artifact.artifactFingerprint,
  )
  assert.match(
    envelope.artifactPayloadSha256,
    /^[a-f0-9]{64}$/u,
  )
  assert.equal(
    envelope.artifactName,
    'restricted-result.json',
  )
  assert.equal(envelope.storageScope, 'GATE_FINGERPRINT')
  assert.equal(
    envelope.storageAuthority,
    'TRUSTED_SERVER_RESTRICTED_ARTIFACT_STORAGE_ADAPTER_REQUIRED',
  )
  assert.equal(envelope.serialization, 'CANONICAL_JSON_UTF8')
  assert.equal(envelope.createMode, 'EXCLUSIVE_CREATE')
  assert.equal(envelope.directoryMode, '0700')
  assert.equal(envelope.fileMode, '0600')
  assert.equal(envelope.overwriteAllowed, false)
  assert.equal(envelope.retryAllowed, false)
  assert.equal(envelope.persistenceStatus, 'NOT_PERSISTED')
  assert.equal(
    envelope.accessPolicy,
    'SERVER_ONLY_EXPLICIT_HUMAN_REVIEW',
  )
  assert.equal(envelope.humanReviewStatus, 'NOT_REVIEWED')
  assert.equal(
    envelope.customerDeliveryStatus,
    'BLOCKED_PENDING_HUMAN_REVIEW',
  )
  assert.equal(
    envelope.safeEvidenceArtifactPolicy,
    'SEPARATE_ALREADY_VERIFIED_NOT_INCLUDED',
  )
  assert.equal(
    envelope.nextRequiredAction,
    'PERSIST_WITH_TRUSTED_SERVER_RESTRICTED_ARTIFACT_ADAPTER',
  )
  assert.deepEqual(envelope.restrictedArtifact, artifact)
  assert.deepEqual(repeated, envelope)
  assert.equal(recursivelyFrozen(envelope), true)

  console.log(
    '✓ validated restricted model output becomes a deterministic private write-once persistence envelope',
  )

  const sourceInput = {
    previewPlan,
    gatePlan,
    verifiedEvidence,
    writingPromptPackage:
      goldenCase.writingPromptPackage,
    fidelityPromptPackage:
      goldenCase.fidelityPromptPackage,
  }
  const parsed =
    persistenceContracts.parseAiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceEnvelope(
      structuredClone(envelope),
      sourceInput,
    )
  assert.deepEqual(parsed, envelope)
  assert.equal(recursivelyFrozen(parsed), true)
  console.log(
    '✓ parser rebuilds the envelope from authoritative sources and returns an immutable value',
  )

  for (const tampered of [
    {
      ...structuredClone(envelope),
      artifactName: 'caller-selected.json',
    },
    {
      ...structuredClone(envelope),
      artifactPayloadSha256: '0'.repeat(64),
    },
    {
      ...structuredClone(envelope),
      directoryMode: '0777',
    },
    {
      ...structuredClone(envelope),
      overwriteAllowed: true,
    },
    {
      ...structuredClone(envelope),
      safeEvidenceArtifactPolicy: 'INCLUDE_EVIDENCE',
    },
  ]) {
    assert.throws(
      () =>
        persistenceContracts.parseAiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceEnvelope(
          tampered,
          sourceInput,
        ),
      persistenceContracts.AiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceError,
    )
  }
  const tamperedArtifactEnvelope =
    structuredClone(envelope) as Mutable<typeof envelope>
  tamperedArtifactEnvelope.restrictedArtifact.writingResult
    .sections[0].customerText =
    'UNTRUSTED_MODEL_OUTPUT_MARKER'
  assert.throws(
    () =>
      persistenceContracts.parseAiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceEnvelope(
        tamperedArtifactEnvelope,
        sourceInput,
      ),
    persistenceContracts.AiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceError,
  )
  console.log(
    '✓ policy, payload SHA, and nested restricted artifact tampering fail closed',
  )

  const sensitiveMarker = 'TOP_SECRET_RESTRICTED_STORAGE_ROOT'
  const expandedInput = {
    ...sourceInput,
    restrictedArtifact: artifact,
    storageRoot: sensitiveMarker,
    persist: true,
  }
  let rejectedError: unknown
  try {
    Reflect.apply(
      persistenceContracts.buildAiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceEnvelope,
      undefined,
      [expandedInput],
    )
    assert.fail('expected expanded persistence input rejection')
  } catch (error) {
    rejectedError = error
  }
  assert.equal(
    rejectedError instanceof
      persistenceContracts.AiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceError,
    true,
  )
  assert.equal(Object.isFrozen(rejectedError), true)
  assert.doesNotMatch(
    JSON.stringify(rejectedError),
    new RegExp(sensitiveMarker, 'u'),
  )
  const serializedEnvelope = JSON.stringify(envelope)
  assert.doesNotMatch(
    serializedEnvelope,
    /"evidence":|"attemptedRequests":|"fetchCount":|"instructions":|"requestBody":/u,
  )
  console.log(
    '✓ caller storage controls and safe Evidence payload are excluded without sensitive error leakage',
  )

  const source = readFileSync(
    new URL(
      './d1PalaceWritingPreviewRestrictedArtifactPersistenceContracts.server.ts',
      import.meta.url,
    ),
    'utf8',
  )
  assert.equal(source.startsWith("import 'server-only'"), true)
  assert.doesNotMatch(
    source,
    /\bfetch\s*\(|OPENAI_API_KEY|Authorization|process\.env|node:fs|writeFile|mkdir|unlink|\brm\s*\(/u,
  )
  console.log(
    '✓ persistence envelope remains a server-only pure-data contract without I/O or OpenAI authority',
  )

  console.log(
    'AI Chart D1 palace-writing Preview restricted artifact persistence checks passed: 5',
  )
}

void run()
