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

function wrapVerifiedEvidence(
  evidence: ReturnType<
    typeof projectAiChartD1PalaceWritingPreviewEvidence
  >,
  artifactName:
    | 'request-succeeded.json'
    | 'request-failed.json',
) {
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
    artifactName,
    evidenceFingerprint,
    status: 'VERIFIED',
    evidence,
    restrictedResultArtifactStatus: 'NOT_READ',
  })
}

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

  return wrapVerifiedEvidence(
    evidence,
    'request-succeeded.json',
  )
}

function buildFailedVerifiedEvidence() {
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
  const failed =
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
  const evidence =
    projectAiChartD1PalaceWritingPreviewEvidence({
      previewPlan,
      executionLedger: failed,
    })

  return wrapVerifiedEvidence(
    evidence,
    'request-failed.json',
  )
}

function buildArtifactInput(
  verifiedEvidence: unknown = buildSuccessfulVerifiedEvidence(),
) {
  return {
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
  }
}

function expectRestrictedArtifactError(
  contracts: typeof import('./d1PalaceWritingPreviewRestrictedArtifactContracts.server'),
  operation: () => unknown,
): void {
  assert.throws(
    operation,
    (error: unknown) => {
      assert.equal(
        error instanceof
          contracts.AiChartD1PalaceWritingPreviewRestrictedArtifactError,
        true,
      )
      assert.equal(
        (
          error as InstanceType<
            typeof contracts.AiChartD1PalaceWritingPreviewRestrictedArtifactError
          >
        ).code,
        contracts.AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_INVALID,
      )
      assert.equal(Object.isFrozen(error), true)
      return true
    },
  )
}

async function run(): Promise<void> {
  const contracts =
    loadServerOnlyModule<
      typeof import('./d1PalaceWritingPreviewRestrictedArtifactContracts.server')
    >(
      './d1PalaceWritingPreviewRestrictedArtifactContracts.server',
    )
  const verifiedEvidence = buildSuccessfulVerifiedEvidence()
  const artifact =
    contracts.buildAiChartD1PalaceWritingPreviewRestrictedArtifact(
      buildArtifactInput(verifiedEvidence),
    )

  assert.equal(
    artifact.dataClassification,
    'RESTRICTED_MODEL_OUTPUT',
  )
  assert.equal(
    artifact.gateFingerprint,
    gatePlan.gateFingerprint,
  )
  assert.equal(
    artifact.safeEvidenceFingerprint,
    verifiedEvidence.evidenceFingerprint,
  )
  assert.equal(
    artifact.writingResultSha256,
    writingResultSha256,
  )
  assert.equal(
    artifact.fidelityReviewSha256,
    fidelityReviewSha256,
  )
  assert.equal(
    artifact.sourceSnapshotSha256,
    goldenCase.writingPromptPackage.sourceSnapshotSha256,
  )
  assert.deepEqual(
    artifact.writingResult,
    goldenCase.expectedWritingResult,
  )
  assert.deepEqual(
    artifact.fidelityReview,
    goldenCase.expectedFidelityReview,
  )
  assert.equal(
    artifact.humanReviewStatus,
    'NOT_REVIEWED',
  )
  assert.equal(
    artifact.customerDeliveryStatus,
    'BLOCKED_PENDING_HUMAN_REVIEW',
  )
  assert.equal(
    artifact.persistenceStatus,
    'NOT_PERSISTED',
  )
  assert.equal(artifact.promptIncluded, false)
  assert.equal(artifact.requestBodyIncluded, false)
  assert.equal(artifact.secretsIncluded, false)
  assert.equal(artifact.chartSnapshotIncluded, false)
  assert.equal(artifact.birthDataIncluded, false)
  assert.match(artifact.artifactFingerprint, /^[a-f0-9]{64}$/u)
  assert.equal(recursivelyFrozen(artifact), true)
  const parsed =
    contracts.parseAiChartD1PalaceWritingPreviewRestrictedArtifact(
      structuredClone(artifact),
      previewPlan,
      gatePlan,
      verifiedEvidence,
      goldenCase.writingPromptPackage,
      goldenCase.fidelityPromptPackage,
    )
  assert.deepEqual(parsed, artifact)
  assert.equal(recursivelyFrozen(parsed), true)

  console.log(
    '✓ approved model output binds to verified safe Evidence as a restricted, not-persisted artifact',
  )

  expectRestrictedArtifactError(
    contracts,
    () =>
      contracts.buildAiChartD1PalaceWritingPreviewRestrictedArtifact(
        buildArtifactInput(buildFailedVerifiedEvidence()),
      ),
  )
  console.log(
    '✓ failed Evidence cannot authorize a restricted result artifact',
  )

  const repairRequiredReview = structuredClone(
    goldenCase.expectedFidelityReview,
  ) as Mutable<typeof goldenCase.expectedFidelityReview>
  repairRequiredReview.sectionReviews[0] = {
    ...repairRequiredReview.sectionReviews[0],
    decision: 'REPAIR_REQUIRED',
    issueCodes: ['SOURCE_MEANING_DISTORTED'],
    repairScope: 'CONTENT_CELL_ONLY',
  }
  repairRequiredReview.fidelityReviewStatus =
    'repair_required'
  repairRequiredReview.customerDeliveryStatus = 'blocked'
  expectRestrictedArtifactError(
    contracts,
    () =>
      contracts.buildAiChartD1PalaceWritingPreviewRestrictedArtifact(
        {
          ...buildArtifactInput(verifiedEvidence),
          fidelityReview: repairRequiredReview,
        },
      ),
  )
  console.log(
    '✓ Fidelity repair-required output remains blocked from artifact creation',
  )

  const driftedEvidence = structuredClone(
    verifiedEvidence.evidence,
  ) as unknown as Mutable<typeof verifiedEvidence.evidence>
  driftedEvidence.stages[0].resultFingerprint =
    'f'.repeat(64)
  expectRestrictedArtifactError(
    contracts,
    () =>
      contracts.buildAiChartD1PalaceWritingPreviewRestrictedArtifact(
        buildArtifactInput(
          wrapVerifiedEvidence(
            driftedEvidence as unknown as ReturnType<
              typeof projectAiChartD1PalaceWritingPreviewEvidence
            >,
            'request-succeeded.json',
          ),
        ),
      ),
  )
  console.log(
    '✓ recomputed safe Evidence SHA cannot hide Writing result fingerprint drift',
  )

  const identityDriftedWritingResult = structuredClone(
    goldenCase.expectedWritingResult,
  ) as Mutable<typeof goldenCase.expectedWritingResult>
  identityDriftedWritingResult.callId =
    'call:restricted-artifact:drift'
  expectRestrictedArtifactError(
    contracts,
    () =>
      contracts.buildAiChartD1PalaceWritingPreviewRestrictedArtifact(
        {
          ...buildArtifactInput(verifiedEvidence),
          writingResult: identityDriftedWritingResult,
        },
      ),
  )
  console.log(
    '✓ model-result identity drift cannot be rebound to trusted Evidence',
  )

  const sensitiveMarker = 'TOP_SECRET_STORAGE_MARKER'
  expectRestrictedArtifactError(
    contracts,
    () =>
      Reflect.apply(
        contracts.buildAiChartD1PalaceWritingPreviewRestrictedArtifact,
        undefined,
        [
          {
            ...buildArtifactInput(verifiedEvidence),
            storageRoot: sensitiveMarker,
            persist: true,
          },
        ],
      ),
  )
  try {
    Reflect.apply(
      contracts.buildAiChartD1PalaceWritingPreviewRestrictedArtifact,
      undefined,
      [
        {
          ...buildArtifactInput(verifiedEvidence),
          storageRoot: sensitiveMarker,
          persist: true,
        },
      ],
    )
    assert.fail('expected restricted artifact rejection')
  } catch (error) {
    assert.doesNotMatch(
      JSON.stringify(error),
      new RegExp(sensitiveMarker, 'u'),
    )
    assert.equal(
      (error as Error).message,
      contracts.AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_INVALID,
    )
  }
  console.log(
    '✓ storage controls and sensitive markers are rejected without diagnostic leakage',
  )

  expectRestrictedArtifactError(
    contracts,
    () =>
      contracts.parseAiChartD1PalaceWritingPreviewRestrictedArtifact(
        {
          ...structuredClone(artifact),
          persistenceStatus: 'PERSISTED',
        },
        previewPlan,
        gatePlan,
        verifiedEvidence,
        goldenCase.writingPromptPackage,
        goldenCase.fidelityPromptPackage,
      ),
  )
  console.log(
    '✓ parser rejects policy or fingerprint tampering',
  )

  const source = readFileSync(
    new URL(
      './d1PalaceWritingPreviewRestrictedArtifactContracts.server.ts',
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
    '✓ server-only artifact contract remains pure data validation with no I/O or OpenAI path',
  )

  console.log(
    'AI Chart D1 palace-writing Preview restricted artifact checks passed: 8',
  )
}

void run()
