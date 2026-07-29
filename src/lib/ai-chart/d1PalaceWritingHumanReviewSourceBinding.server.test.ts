import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import Module, { createRequire } from 'node:module'
import {
  createAiChartD1FlyingModelInputTestSnapshot,
} from './d1FlyingModelInputTestSupport'
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

const moduleInternals =
  Module as unknown as NodeModuleInternals
const originalResolveFilename =
  moduleInternals._resolveFilename
const originalLoad = moduleInternals._load
const testRequire = createRequire(import.meta.url)
const serverOnlyStubPath =
  testRequire.resolve('./d1Assets')

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
    moduleInternals._resolveFilename =
      originalResolveFilename
    moduleInternals._load = originalLoad
  }
}

const sourceBindingModule =
  loadServerOnlyModule<
    typeof import(
      './d1PalaceWritingHumanReviewSourceBinding.server'
    )
  >(
    './d1PalaceWritingHumanReviewSourceBinding.server',
  )
const subjectModule =
  loadServerOnlyModule<
    typeof import(
      './d1PalaceWritingHumanReviewReportSubject.server'
    )
  >(
    './d1PalaceWritingHumanReviewReportSubject.server',
  )
const artifactModule =
  loadServerOnlyModule<
    typeof import(
      './d1PalaceWritingPreviewRestrictedArtifactContracts.server'
    )
  >(
    './d1PalaceWritingPreviewRestrictedArtifactContracts.server',
  )

const REPORT_ID =
  '3e0ba27e-95f8-4c22-92b1-a42fb9bfaed9'
const OWNER_ID =
  'f3ba29e1-7fde-4bc3-8d8f-158b24de81ae'
const SENSITIVE_MARKER =
  'sensitive-snapshot-model-owner-marker'
const goldenCase =
  buildAiChartD1PalaceWritingGoldenCase()
const previewPlan =
  buildAiChartD1PalaceWritingPreviewPlan(goldenCase)
const gatePlan =
  buildAiChartD1PalaceWritingPreviewGatePlan(previewPlan)

function sha256Canonical(value: unknown): string {
  return createHash('sha256')
    .update(
      createAiChartD1PalaceWritingFidelityCanonicalJson(value),
      'utf8',
    )
    .digest('hex')
}

function buildVerifiedEvidence() {
  const writingResultSha256 =
    createAiChartD1PalaceWritingResultSha256(
      goldenCase.expectedWritingResult,
    )
  const fidelityReviewSha256 =
    sha256Canonical(goldenCase.expectedFidelityReview)
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
        durationMs: 1,
        usage: {
          inputTokens: 1,
          outputTokens: 1,
          reasoningTokens: 0,
          totalTokens: 2,
        },
        resultFingerprint: writingResultSha256,
        nextBridgeFingerprint:
          previewPlan.stages[1].bridgeFingerprint,
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
          previewPlan.stages[1].bridgeFingerprint,
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
        durationMs: 1,
        usage: {
          inputTokens: 1,
          outputTokens: 1,
          reasoningTokens: 0,
          totalTokens: 2,
        },
        resultFingerprint: fidelityReviewSha256,
      },
    })
  const evidence =
    projectAiChartD1PalaceWritingPreviewEvidence({
      previewPlan,
      executionLedger: succeeded,
    })
  return Object.freeze({
    contractVersion:
      'ai-chart-d1-palace-writing-preview-evidence-readback/v1',
    task: 'D1_PALACE_WRITING_PREVIEW_EVIDENCE_READBACK',
    gateFingerprint: gatePlan.gateFingerprint,
    authority: 'TRUSTED_SERVER_EVIDENCE_READBACK_ADAPTER',
    artifactName: 'request-succeeded.json',
    evidenceFingerprint: createHash('sha256')
      .update(
        createAiChartD1PalaceWritingCanonicalJson(evidence),
        'utf8',
      )
      .digest('hex'),
    status: 'VERIFIED',
    evidence,
    restrictedResultArtifactStatus: 'NOT_READ',
  })
}

function buildArtifact() {
  return artifactModule
    .buildAiChartD1PalaceWritingPreviewRestrictedArtifact({
      previewPlan,
      gatePlan,
      verifiedEvidence: buildVerifiedEvidence(),
      writingPromptPackage:
        goldenCase.writingPromptPackage,
      writingResult: goldenCase.expectedWritingResult,
      fidelityPromptPackage:
        goldenCase.fidelityPromptPackage,
      fidelityReview:
        goldenCase.expectedFidelityReview,
    })
}

async function resolveSubject(
  snapshot: unknown,
  reportId: string = REPORT_ID,
) {
  return subjectModule
    .resolveAiChartD1PalaceWritingHumanReviewReportSubject(
      { reportId },
      {
        lookupReportReviewSubject: async () => ({
          id: reportId,
          ownerUserId: OWNER_ID,
          paymentStatus: 'paid',
          chartSnapshot: snapshot,
        }),
      },
    )
}

function expectBindingError(
  code:
    (typeof sourceBindingModule.AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_SOURCE_BINDING_FAILURE_CODES)[number],
  operation: () => unknown,
): void {
  assert.throws(
    operation,
    (error: unknown) => {
      assert.equal(
        error instanceof
          sourceBindingModule.AiChartD1PalaceWritingHumanReviewSourceBindingError,
        true,
      )
      assert.equal(
        (
          error as InstanceType<
            typeof sourceBindingModule.AiChartD1PalaceWritingHumanReviewSourceBindingError
          >
        ).code,
        code,
      )
      assert.equal(Object.isFrozen(error), true)
      return true
    },
  )
}

let checks = 0

async function check(
  name: string,
  run: () => void | Promise<void>,
) {
  await run()
  checks += 1
  console.log(`✓ ${name}`)
}

async function main() {
  const mutableEnvironment =
    process.env as Record<string, string | undefined>
  const previousNodeEnv = mutableEnvironment.NODE_ENV
  mutableEnvironment.NODE_ENV = 'test'
  try {
    const snapshot =
      createAiChartD1FlyingModelInputTestSnapshot()

    await check(
      'trusted Report Snapshot and original restricted Artifact bind only when their canonical SHA-256 values match',
      async () => {
        const subject = await resolveSubject(snapshot)
        const artifact = buildArtifact()
        assert.equal(
          subject.reportSnapshotSha256,
          artifact.sourceSnapshotSha256,
        )
        const binding =
          sourceBindingModule
            .bindAiChartD1PalaceWritingHumanReviewSource({
              reportSubject: subject,
              restrictedArtifact: artifact,
            })
        assert.deepEqual(Object.keys(binding), [
          'contractVersion',
          'task',
          'dataClassification',
          'reportId',
          'reportSnapshotSha256',
          'artifactSourceSnapshotSha256',
          'reportSubjectFingerprint',
          'restrictedArtifactFingerprint',
          'restrictedArtifactPayloadSha256',
          'gateFingerprint',
          'sourceBindingStatus',
          'capabilityScope',
          'productionCallable',
          'formalReviewRecordAllowed',
          'customerDeliveryAllowed',
          'openAiRequests',
          'bindingFingerprint',
        ])
        assert.equal(
          binding.sourceBindingStatus,
          'SERVER_VERIFIED_EXACT_SNAPSHOT_MATCH',
        )
        assert.equal(
          binding.restrictedArtifactPayloadSha256,
          sha256Canonical(artifact),
        )
        assert.equal(binding.productionCallable, true)
        assert.equal(binding.formalReviewRecordAllowed, false)
        assert.equal(binding.customerDeliveryAllowed, false)
        assert.equal(binding.openAiRequests, 0)
        assert.equal(Object.isFrozen(binding), true)
      },
    )

    await check(
      'different canonical Snapshot content fails closed with one fixed safe mismatch code',
      async () => {
        const changedSnapshot =
          createAiChartD1FlyingModelInputTestSnapshot()
        changedSnapshot.lunarDate =
          'different-synthetic-snapshot'
        const subject =
          await resolveSubject(changedSnapshot)
        const artifact = buildArtifact()
        expectBindingError(
          'ARTIFACT_SNAPSHOT_MISMATCH',
          () =>
            sourceBindingModule
              .bindAiChartD1PalaceWritingHumanReviewSource({
                reportSubject: subject,
                restrictedArtifact: artifact,
              }),
        )
      },
    )

    await check(
      'copied subject or copied Artifact cannot substitute for exact in-process capabilities',
      async () => {
        const copiedSubject = structuredClone(
          await resolveSubject(snapshot),
        )
        expectBindingError(
          'REPORT_SUBJECT_UNAVAILABLE',
          () =>
            sourceBindingModule
              .bindAiChartD1PalaceWritingHumanReviewSource({
                reportSubject: copiedSubject,
                restrictedArtifact: buildArtifact(),
              }),
        )

        const subject = await resolveSubject(snapshot)
        const copiedArtifact =
          structuredClone(buildArtifact())
        expectBindingError(
          'ARTIFACT_SOURCE_UNAVAILABLE',
          () =>
            sourceBindingModule
              .bindAiChartD1PalaceWritingHumanReviewSource({
                reportSubject: subject,
                restrictedArtifact: copiedArtifact,
              }),
        )
      },
    )

    await check(
      'binding is single-use and serialized metadata excludes owner, Snapshot, model output, and sensitive markers',
      async () => {
        const binding =
          sourceBindingModule
            .bindAiChartD1PalaceWritingHumanReviewSource({
              reportSubject:
                await resolveSubject(snapshot),
              restrictedArtifact: buildArtifact(),
            })
        const consumed =
          sourceBindingModule
            .consumeAiChartD1PalaceWritingHumanReviewSourceBinding(
              binding,
            )
        assert.equal(consumed, binding)
        expectBindingError(
          'ARTIFACT_SOURCE_UNAVAILABLE',
          () =>
            sourceBindingModule
              .consumeAiChartD1PalaceWritingHumanReviewSourceBinding(
                binding,
              ),
        )
        const serialized = JSON.stringify(binding)
        for (const forbidden of [
          OWNER_ID,
          SENSITIVE_MARKER,
          'chartSnapshot',
          'writingResult',
          'fidelityReview',
          'output_text',
          'birthInput',
        ]) {
          assert.equal(serialized.includes(forbidden), false)
        }
      },
    )
  } finally {
    if (previousNodeEnv === undefined) {
      delete mutableEnvironment.NODE_ENV
    } else {
      mutableEnvironment.NODE_ENV = previousNodeEnv
    }
  }

  console.log(
    `AI Chart D1 human-review source-binding checks passed: ${checks}`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
