import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  mkdtempSync,
} from 'node:fs'
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import Module, { createRequire } from 'node:module'
import { join } from 'node:path'
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

const commandModule =
  loadServerOnlyModule<
    typeof import(
      './d1PalaceWritingHumanReviewCommand.server'
    )
  >(
    './d1PalaceWritingHumanReviewCommand.server',
  )
const recordEnvelopeModule =
  loadServerOnlyModule<
    typeof import(
      './d1PalaceWritingHumanReviewRecordEnvelope.server'
    )
  >(
    './d1PalaceWritingHumanReviewRecordEnvelope.server',
  )
const recordWriterModule =
  loadServerOnlyModule<
    typeof import(
      './d1PalaceWritingHumanReviewRecordWriter.server'
    )
  >(
    './d1PalaceWritingHumanReviewRecordWriter.server',
  )
const recordReadbackModule =
  loadServerOnlyModule<
    typeof import(
      './d1PalaceWritingHumanReviewRecordReadback.server'
    )
  >(
    './d1PalaceWritingHumanReviewRecordReadback.server',
  )
const customerDeliveryCoordinatorModule =
  loadServerOnlyModule<
    typeof import(
      './d1PalaceWritingCustomerDeliveryCoordinator.server'
    )
  >(
    './d1PalaceWritingCustomerDeliveryCoordinator.server',
  )
const trustedDeliveryAdapterContractModule =
  loadServerOnlyModule<
    typeof import(
      './d1PalaceWritingTrustedDeliveryAdapterContracts.server'
    )
  >(
    './d1PalaceWritingTrustedDeliveryAdapterContracts.server',
  )
const trustedDeliveryAdapterProbeModule =
  loadServerOnlyModule<
    typeof import(
      './d1PalaceWritingTrustedDeliveryAdapterProbe.server'
    )
  >(
    './d1PalaceWritingTrustedDeliveryAdapterProbe.server',
  )
const trustedDeliveryRepositoryAdapterModule =
  loadServerOnlyModule<
    typeof import(
      './d1PalaceWritingTrustedDeliveryRepositoryAdapter.server'
    )
  >(
    './d1PalaceWritingTrustedDeliveryRepositoryAdapter.server',
  )
const trustedDeliverySupabaseRepositoryModule =
  loadServerOnlyModule<
    typeof import(
      './d1PalaceWritingTrustedDeliverySupabaseRepository.server'
    )
  >(
    './d1PalaceWritingTrustedDeliverySupabaseRepository.server',
  )
const trustedDeliverySupabaseAdminClientFactoryModule =
  loadServerOnlyModule<
    typeof import(
      './d1PalaceWritingTrustedDeliverySupabaseAdminClientFactory.server'
    )
  >(
    './d1PalaceWritingTrustedDeliverySupabaseAdminClientFactory.server',
  )
const trustedDeliveryProductionBindingReadinessModule =
  loadServerOnlyModule<
    typeof import(
      './d1PalaceWritingTrustedDeliveryProductionBindingReadiness.server'
    )
  >(
    './d1PalaceWritingTrustedDeliveryProductionBindingReadiness.server',
  )
const trustedDeliveryProductionReadinessAdaptersModule =
  loadServerOnlyModule<
    typeof import(
      './d1PalaceWritingTrustedDeliveryProductionReadinessAdapters.server'
    )
  >(
    './d1PalaceWritingTrustedDeliveryProductionReadinessAdapters.server',
  )
const trustedDeliveryRuntimeActivationAuthorizationHandoffModule =
  loadServerOnlyModule<
    typeof import(
      './d1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff.server'
    )
  >(
    './d1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff.server',
  )
const authorizationModule =
  loadServerOnlyModule<
    typeof import(
      './d1PalaceWritingHumanReviewRequestAuthorization.server'
    )
  >(
    './d1PalaceWritingHumanReviewRequestAuthorization.server',
  )
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
const decisionModule =
  loadServerOnlyModule<
    typeof import(
      './d1PalaceWritingPreviewHumanReviewDecisionContracts.server'
    )
  >(
    './d1PalaceWritingPreviewHumanReviewDecisionContracts.server',
  )

const REPORT_ID =
  '3e0ba27e-95f8-4c22-92b1-a42fb9bfaed9'
const OWNER_ID =
  'f3ba29e1-7fde-4bc3-8d8f-158b24de81ae'
const REVIEWER_ID =
  '57d56bc0-3908-44b0-823e-ebf95e3600fb'
const SENSITIVE_MARKER =
  'sensitive-human-review-command-marker'
const SENSITIVE_EMAIL =
  'private-reviewer@example.test'
const SENSITIVE_TOKEN =
  'sensitive-reviewer-bearer-token'
const originalTmpdirEnvironment = process.env.TMPDIR
const writerSuiteRoot = mkdtempSync(
  join(
    process.cwd(),
    '.ai-chart-human-review-record-writer-suite-',
  ),
)
chmodSync(writerSuiteRoot, 0o700)
const reviewRecordStorageRoot = join(
  writerSuiteRoot,
  'ai-chart-d1-palace-writing-human-review-record',
)

const goldenCase =
  buildAiChartD1PalaceWritingGoldenCase()
const previewPlan =
  buildAiChartD1PalaceWritingPreviewPlan(goldenCase)
const gatePlan =
  buildAiChartD1PalaceWritingPreviewGatePlan(previewPlan)

function sha256Canonical(value: unknown): string {
  return createHash('sha256')
    .update(
      createAiChartD1PalaceWritingCanonicalJson(value),
      'utf8',
    )
    .digest('hex')
}

const TRUSTED_DELIVERY_RELEASE_COMMIT_SHA =
  '0123456789abcdef0123456789abcdef01234567'
const TRUSTED_DELIVERY_MIGRATION_READINESS_RESPONSE =
  Object.freeze({
    bindingMode:
      'INJECTED_PRODUCTION_BINDING_READINESS_PROBE_ONLY' as const,
    readinessStatus: 'READY' as const,
    migrationVersion:
      '20260728120000' as const,
    migrationSha256:
      '8d310b1ef2750afbd41da00e04e0a10b6198fd2f894d07d09f11b5dfc7df3e66' as const,
    requiredRpcName:
      'deliver_ai_chart_report_after_review' as const,
    schemaContractStatus:
      'VERIFIED' as const,
    rpcExecuteGrantStatus:
      'SERVICE_ROLE_ONLY_VERIFIED' as const,
  })
const TRUSTED_DELIVERY_MIGRATION_READINESS_FINGERPRINT =
  sha256Canonical(
    TRUSTED_DELIVERY_MIGRATION_READINESS_RESPONSE,
  )

async function prepareTrustedDeliveryRuntimeAuthorizationHandoff() {
  const prepared =
    await trustedDeliveryRuntimeActivationAuthorizationHandoffModule
      .prepareAiChartD1PalaceWritingTrustedDeliveryRuntimeActivationAuthorizationHandoff(
        {
          activationTarget: {
            releaseCommitSha:
              TRUSTED_DELIVERY_RELEASE_COMMIT_SHA,
            migrationReadinessFingerprint:
              TRUSTED_DELIVERY_MIGRATION_READINESS_FINGERPRINT,
          },
          verifyReleaseScopedRuntimeActivationAuthorization:
            async (command) => ({
              adapterMode: command.adapterMode,
              authorizationStatus:
                'AUTHORIZED',
              authorizationScope:
                command.authorizationScope,
              feature: command.feature,
              releaseCommitSha:
                command.releaseCommitSha,
              migrationVersion:
                command.migrationVersion,
              migrationSha256:
                command.migrationSha256,
              migrationReadinessFingerprint:
                command.migrationReadinessFingerprint,
              runtimeActivationPolicyVersion:
                command.runtimeActivationPolicyVersion,
            }),
        },
      )
  return prepared.handoff
}

function buildVerifiedEvidence() {
  const writingResultSha256 =
    createAiChartD1PalaceWritingResultSha256(
      goldenCase.expectedWritingResult,
    )
  const fidelityReviewSha256 =
    createHash('sha256')
      .update(
        createAiChartD1PalaceWritingFidelityCanonicalJson(
          goldenCase.expectedFidelityReview,
        ),
        'utf8',
      )
      .digest('hex')
  const ready =
    createAiChartD1PalaceWritingPreviewExecutionLedger({
      previewPlan,
      gateFingerprint: gatePlan.gateFingerprint,
    })
  const events = [
    {
      type: 'REQUEST_ATTEMPTED' as const,
      sequence: 1,
      stage: 'WRITING' as const,
      bridgeFingerprint:
        previewPlan.stages[0].bridgeFingerprint,
    },
    {
      type: 'FETCH_DISPATCHED' as const,
      sequence: 1,
      stage: 'WRITING' as const,
    },
    {
      type: 'STAGE_SUCCEEDED' as const,
      sequence: 1,
      stage: 'WRITING' as const,
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
    {
      type: 'REQUEST_ATTEMPTED' as const,
      sequence: 2,
      stage: 'FIDELITY_REVIEW' as const,
      bridgeFingerprint:
        previewPlan.stages[1].bridgeFingerprint,
    },
    {
      type: 'FETCH_DISPATCHED' as const,
      sequence: 2,
      stage: 'FIDELITY_REVIEW' as const,
    },
    {
      type: 'STAGE_SUCCEEDED' as const,
      sequence: 2,
      stage: 'FIDELITY_REVIEW' as const,
      durationMs: 1,
      usage: {
        inputTokens: 1,
        outputTokens: 1,
        reasoningTokens: 0,
        totalTokens: 2,
      },
      resultFingerprint: fidelityReviewSha256,
    },
  ] as const
  const succeeded = events.reduce(
    (ledger, event) =>
      advanceAiChartD1PalaceWritingPreviewExecutionLedger({
        previewPlan,
        ledger,
        event,
      }),
    ready,
  )
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
    evidenceFingerprint: sha256Canonical(evidence),
    status: 'VERIFIED',
    evidence,
    restrictedResultArtifactStatus: 'NOT_READ',
  })
}

function buildReviewMaterial(
  decision:
    | 'APPROVED'
    | 'REPAIR_REQUIRED'
    | 'REJECTED' = 'APPROVED',
) {
  const verifiedEvidence = buildVerifiedEvidence()
  const sourceInput = {
    previewPlan,
    gatePlan,
    verifiedEvidence,
    writingPromptPackage:
      goldenCase.writingPromptPackage,
    fidelityPromptPackage:
      goldenCase.fidelityPromptPackage,
  }
  const restrictedArtifact =
    artifactModule
      .buildAiChartD1PalaceWritingPreviewRestrictedArtifact({
        ...sourceInput,
        writingResult:
          goldenCase.expectedWritingResult,
        fidelityReview:
          goldenCase.expectedFidelityReview,
      })
  const verifiedRestrictedArtifact = Object.freeze({
    contractVersion:
      'ai-chart-d1-palace-writing-preview-restricted-artifact-readback/v1',
    task:
      'D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_READBACK',
    gateFingerprint: gatePlan.gateFingerprint,
    authority:
      'TRUSTED_SERVER_RESTRICTED_ARTIFACT_READBACK_ADAPTER',
    dataClassification: 'RESTRICTED_MODEL_OUTPUT',
    artifactName: 'restricted-result.json',
    restrictedArtifactFingerprint:
      restrictedArtifact.artifactFingerprint,
    artifactPayloadSha256:
      sha256Canonical(restrictedArtifact),
    status: 'VERIFIED',
    restrictedArtifact,
    accessPolicy:
      'SERVER_ONLY_EXPLICIT_HUMAN_REVIEW',
    humanReviewStatus: 'NOT_REVIEWED',
    customerDeliveryStatus:
      'BLOCKED_PENDING_HUMAN_REVIEW',
    safeEvidenceArtifactStatus:
      'SEPARATE_ALREADY_VERIFIED_NOT_INCLUDED',
  })
  const decisionProposal =
    decisionModule
      .buildAiChartD1PalaceWritingPreviewHumanReviewDecisionProposal({
        ...sourceInput,
        verifiedRestrictedArtifact,
        decision,
        issueCodes:
          decision === 'APPROVED'
            ? []
            : ['SOURCE_FAITHFULNESS_CONCERN'],
      })
  return {
    restrictedArtifact,
    decisionProposal,
  }
}

async function createAuthorization() {
  const request = new Request(
    'https://example.test/api/internal/ai-chart/review',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${SENSITIVE_TOKEN}`,
      },
    },
  )
  return authorizationModule
    .authorizeAiChartD1PalaceWritingHumanReviewRequest(
      request,
      {
        requireAdmin: async () => ({
          supabase: {} as never,
          user: {
            id: REVIEWER_ID,
            email: SENSITIVE_EMAIL,
          },
        }),
      },
    )
}

async function createSourceBinding(
  restrictedArtifact:
    ReturnType<typeof buildReviewMaterial>['restrictedArtifact'],
) {
  const subject =
    await subjectModule
      .resolveAiChartD1PalaceWritingHumanReviewReportSubject(
        { reportId: REPORT_ID },
        {
          lookupReportReviewSubject: async () => ({
            id: REPORT_ID,
            ownerUserId: OWNER_ID,
            paymentStatus: 'paid',
            chartSnapshot:
              createAiChartD1FlyingModelInputTestSnapshot(),
          }),
        },
      )
  return sourceBindingModule
    .bindAiChartD1PalaceWritingHumanReviewSource({
      reportSubject: subject,
      restrictedArtifact,
    })
}

function expectCommandError(
  code:
    (typeof commandModule.AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_COMMAND_FAILURE_CODES)[number],
  operation: () => unknown,
) {
  assert.throws(
    operation,
    (error: unknown) => {
      assert.equal(
        error instanceof
          commandModule.AiChartD1PalaceWritingHumanReviewCommandError,
        true,
      )
      assert.equal(
        (
          error as InstanceType<
            typeof commandModule.AiChartD1PalaceWritingHumanReviewCommandError
          >
        ).code,
        code,
      )
      assert.equal(Object.isFrozen(error), true)
      return true
    },
  )
}

function expectRecordEnvelopeError(
  code:
    (typeof recordEnvelopeModule.AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_ENVELOPE_FAILURE_CODES)[number],
  operation: () => unknown,
) {
  assert.throws(
    operation,
    (error: unknown) => {
      assert.equal(
        error instanceof
          recordEnvelopeModule.AiChartD1PalaceWritingHumanReviewRecordEnvelopeError,
        true,
      )
      assert.equal(
        (
          error as InstanceType<
            typeof recordEnvelopeModule.AiChartD1PalaceWritingHumanReviewRecordEnvelopeError
          >
        ).code,
        code,
      )
      assert.equal(Object.isFrozen(error), true)
      return true
    },
  )
}

async function expectRecordReadbackError(
  operation: Promise<unknown>,
) {
  await assert.rejects(
    operation,
    (error: unknown) => {
      assert.equal(
        error instanceof
          recordReadbackModule.AiChartD1PalaceWritingHumanReviewRecordReadbackError,
        true,
      )
      assert.equal(
        (
          error as InstanceType<
            typeof recordReadbackModule.AiChartD1PalaceWritingHumanReviewRecordReadbackError
          >
        ).code,
        'ai_chart_d1_palace_writing_human_review_record_readback_invalid',
      )
      assert.equal(Object.isFrozen(error), true)
      assert.equal(
        JSON.stringify(error).includes(
          SENSITIVE_MARKER,
        ),
        false,
      )
      assert.equal(
        JSON.stringify(error).includes(
          writerSuiteRoot,
        ),
        false,
      )
      return true
    },
  )
}

async function createReviewCommand(
  decision:
    | 'APPROVED'
    | 'REPAIR_REQUIRED'
    | 'REJECTED' = 'APPROVED',
  material = buildReviewMaterial(decision),
) {
  return commandModule
    .createAiChartD1PalaceWritingHumanReviewCommand({
      requestAuthorization: await createAuthorization(),
      sourceBinding:
        await createSourceBinding(
          material.restrictedArtifact,
        ),
      decisionProposal: material.decisionProposal,
    })
}

async function createVerifiedReviewRecord(
  decision:
    | 'APPROVED'
    | 'REPAIR_REQUIRED'
    | 'REJECTED' = 'APPROVED',
  recordedAt = '2026-07-28T09:10:11.123Z',
  material = buildReviewMaterial(decision),
) {
  process.env.TMPDIR = writerSuiteRoot
  await rm(reviewRecordStorageRoot, {
    recursive: true,
    force: true,
  })
  const envelope =
    recordEnvelopeModule
      .buildAiChartD1PalaceWritingHumanReviewRecordEnvelope(
        await createReviewCommand(decision, material),
        {
          now: () =>
            new Date(recordedAt),
        },
      )
  const receipt =
    await recordWriterModule
      .persistAiChartD1PalaceWritingHumanReviewRecord(
        envelope,
      )
  return recordReadbackModule
    .readAndVerifyAiChartD1PalaceWritingHumanReviewRecord(
      receipt,
    )
}

function createEligibleDeliveryStateOutcome(
  command:
    import(
      './d1PalaceWritingCustomerDeliveryCoordinator.server'
    ).AiChartD1PalaceWritingCustomerDeliveryStateProbeCommand,
) {
  return {
    adapterMode:
      'INJECTED_LATEST_REPORT_DELIVERY_STATE_PROBE_ONLY',
    lookupStatus: 'FOUND',
    reportId: command.reportId,
    reportSnapshotSha256:
      command.reportSnapshotSha256,
    paymentStatus: 'PAID',
    reportStatus: 'PENDING',
    reportContentStatus: 'ABSENT',
    ownerBindingStatus: 'SERVER_VERIFIED',
    sourceBindingStatus: 'MATCHED',
    gateFingerprint: command.gateFingerprint,
    recordFingerprint: command.recordFingerprint,
  } as const
}

async function createCustomerDeliveryCoordination(
  recordedAt = '2026-07-28T09:10:11.123Z',
) {
  const verified =
    await createVerifiedReviewRecord(
      'APPROVED',
      recordedAt,
    )
  return customerDeliveryCoordinatorModule
    .coordinateAiChartD1PalaceWritingCustomerDelivery({
      verifiedHumanReviewRecord: verified,
      probeLatestReportDeliveryState:
        async (command) =>
          createEligibleDeliveryStateOutcome(command),
    })
}

async function createTrustedDeliveryAdapterContract(
  recordedAt = '2026-07-28T09:10:11.123Z',
) {
  return trustedDeliveryAdapterContractModule
    .buildAiChartD1PalaceWritingTrustedDeliveryAdapterContract(
      await createCustomerDeliveryCoordination(
        recordedAt,
      ),
    )
}

async function createTrustedDeliveryRepositoryMaterial(
  recordedAt = '2026-07-28T09:10:11.123Z',
) {
  const material = buildReviewMaterial('APPROVED')
  const verified =
    await createVerifiedReviewRecord(
      'APPROVED',
      recordedAt,
      material,
    )
  const reviewRecord = verified.reviewRecord
  const coordination =
    await customerDeliveryCoordinatorModule
      .coordinateAiChartD1PalaceWritingCustomerDelivery({
        verifiedHumanReviewRecord: verified,
        probeLatestReportDeliveryState:
          async (command) =>
            createEligibleDeliveryStateOutcome(command),
      })
  const trustedDeliveryContract =
    trustedDeliveryAdapterContractModule
      .buildAiChartD1PalaceWritingTrustedDeliveryAdapterContract(
        coordination,
      )
  return {
    trustedDeliveryContract,
    reviewRecord,
    restrictedArtifact: material.restrictedArtifact,
  }
}

async function expectCustomerDeliveryCoordinatorError(
  code:
    (typeof customerDeliveryCoordinatorModule.AI_CHART_D1_PALACE_WRITING_CUSTOMER_DELIVERY_COORDINATOR_FAILURE_CODES)[number],
  operation: Promise<unknown>,
) {
  await assert.rejects(
    operation,
    (error: unknown) => {
      assert.equal(
        error instanceof
          customerDeliveryCoordinatorModule.AiChartD1PalaceWritingCustomerDeliveryCoordinatorError,
        true,
      )
      assert.equal(
        (
          error as InstanceType<
            typeof customerDeliveryCoordinatorModule.AiChartD1PalaceWritingCustomerDeliveryCoordinatorError
          >
        ).code,
        code,
      )
      assert.equal(Object.isFrozen(error), true)
      const serialized = JSON.stringify(error)
      for (const forbidden of [
        REPORT_ID,
        REVIEWER_ID,
        OWNER_ID,
        SENSITIVE_EMAIL,
        SENSITIVE_TOKEN,
        SENSITIVE_MARKER,
        'chartSnapshot',
        'writingResult',
        'output_text',
        writerSuiteRoot,
      ]) {
        assert.equal(
          serialized.includes(forbidden),
          false,
        )
      }
      return true
    },
  )
}

function expectTrustedDeliveryAdapterContractError(
  code:
    (typeof trustedDeliveryAdapterContractModule.AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_ADAPTER_CONTRACT_FAILURE_CODES)[number],
  operation: () => unknown,
) {
  assert.throws(
    operation,
    (error: unknown) => {
      assert.equal(
        error instanceof
          trustedDeliveryAdapterContractModule.AiChartD1PalaceWritingTrustedDeliveryAdapterContractError,
        true,
      )
      assert.equal(
        (
          error as InstanceType<
            typeof trustedDeliveryAdapterContractModule.AiChartD1PalaceWritingTrustedDeliveryAdapterContractError
          >
        ).code,
        code,
      )
      assert.equal(Object.isFrozen(error), true)
      const serialized = JSON.stringify(error)
      for (const forbidden of [
        REPORT_ID,
        REVIEWER_ID,
        OWNER_ID,
        SENSITIVE_EMAIL,
        SENSITIVE_TOKEN,
        SENSITIVE_MARKER,
      ]) {
        assert.equal(
          serialized.includes(forbidden),
          false,
        )
      }
      return true
    },
  )
}

async function expectTrustedDeliveryAdapterProbeError(
  code:
    (typeof trustedDeliveryAdapterProbeModule.AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_ADAPTER_PROBE_FAILURE_CODES)[number],
  operation: Promise<unknown>,
) {
  await assert.rejects(
    operation,
    (error: unknown) => {
      assert.equal(
        error instanceof
          trustedDeliveryAdapterProbeModule.AiChartD1PalaceWritingTrustedDeliveryAdapterProbeError,
        true,
      )
      assert.equal(
        (
          error as InstanceType<
            typeof trustedDeliveryAdapterProbeModule.AiChartD1PalaceWritingTrustedDeliveryAdapterProbeError
          >
        ).code,
        code,
      )
      assert.equal(Object.isFrozen(error), true)
      const serialized = JSON.stringify(error)
      for (const forbidden of [
        REPORT_ID,
        REVIEWER_ID,
        OWNER_ID,
        SENSITIVE_EMAIL,
        SENSITIVE_TOKEN,
        SENSITIVE_MARKER,
        'chartSnapshot',
        'birthInput',
        'writingResult',
        'output_text',
        writerSuiteRoot,
      ]) {
        assert.equal(
          serialized.includes(forbidden),
          false,
        )
      }
      return true
    },
  )
}

function recursivelyFrozen(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return true
  }
  if (!Object.isFrozen(value)) return false
  return Reflect.ownKeys(value).every((key) =>
    recursivelyFrozen(
      (value as Record<PropertyKey, unknown>)[key],
    ),
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
    await check(
      'authorized reviewer, exact Report source, and bound decision create one frozen review command',
      async () => {
        const material = buildReviewMaterial()
        const authorization = await createAuthorization()
        const sourceBinding =
          await createSourceBinding(
            material.restrictedArtifact,
          )
        const command =
          commandModule
            .createAiChartD1PalaceWritingHumanReviewCommand({
              requestAuthorization: authorization,
              sourceBinding,
              decisionProposal:
                material.decisionProposal,
            })

        assert.deepEqual(Object.keys(command), [
          'contractVersion',
          'task',
          'dataClassification',
          'reportId',
          'reviewerId',
          'permission',
          'decision',
          'issueCodes',
          'customerDeliveryStatus',
          'reportSnapshotSha256',
          'artifactSourceSnapshotSha256',
          'restrictedArtifactFingerprint',
          'artifactPayloadSha256',
          'gateFingerprint',
          'proposalFingerprint',
          'authorizationFingerprint',
          'sourceBindingFingerprint',
          'authorizationStatus',
          'sourceBindingStatus',
          'commandStatus',
          'capabilityScope',
          'productionCallable',
          'trustedServerClockRequired',
          'writeOnceRecordWriterRequired',
          'formalReviewRecordAllowed',
          'customerDeliveryAllowed',
          'openAiRequests',
          'commandFingerprint',
        ])
        assert.equal(command.reportId, REPORT_ID)
        assert.equal(command.reviewerId, REVIEWER_ID)
        assert.equal(command.decision, 'APPROVED')
        assert.deepEqual(command.issueCodes, [])
        assert.equal(
          command.artifactPayloadSha256,
          material.decisionProposal
            .artifactPayloadSha256,
        )
        assert.equal(
          command.commandStatus,
          'AUTHORIZED_SOURCE_BOUND_AWAITING_SERVER_CLOCK_AND_WRITE_ONCE_RECORD',
        )
        assert.equal(
          command.formalReviewRecordAllowed,
          false,
        )
        assert.equal(
          command.customerDeliveryAllowed,
          false,
        )
        assert.equal(command.openAiRequests, 0)
        assert.equal(Object.isFrozen(command), true)
        assert.equal(Object.isFrozen(command.issueCodes), true)

        const serialized = JSON.stringify(command)
        for (const forbidden of [
          OWNER_ID,
          SENSITIVE_EMAIL,
          SENSITIVE_TOKEN,
          SENSITIVE_MARKER,
          'chartSnapshot',
          'writingResult',
          'fidelityReview',
          'output_text',
          'birthInput',
        ]) {
          assert.equal(
            serialized.includes(forbidden),
            false,
          )
        }
      },
    )

    await check(
      'decision source drift fails before consuming otherwise valid capabilities',
      async () => {
        const material = buildReviewMaterial()
        const authorization = await createAuthorization()
        const sourceBinding =
          await createSourceBinding(
            material.restrictedArtifact,
          )
        const driftedWithoutFingerprint = {
          ...material.decisionProposal,
          artifactPayloadSha256: '0'.repeat(64),
        }
        const driftedFields = Object.fromEntries(
          Object.entries(driftedWithoutFingerprint).filter(
            ([key]) => key !== 'proposalFingerprint',
          ),
        )
        const driftedProposal = {
          ...driftedFields,
          proposalFingerprint:
            sha256Canonical(driftedFields),
        }

        expectCommandError(
          'DECISION_SOURCE_BINDING_MISMATCH',
          () =>
            commandModule
              .createAiChartD1PalaceWritingHumanReviewCommand({
                requestAuthorization: authorization,
                sourceBinding,
                decisionProposal: driftedProposal,
              }),
        )

        const command =
          commandModule
            .createAiChartD1PalaceWritingHumanReviewCommand({
              requestAuthorization: authorization,
              sourceBinding,
              decisionProposal:
                material.decisionProposal,
            })
        assert.equal(command.reportId, REPORT_ID)
      },
    )

    await check(
      'copied authorization or copied source binding cannot create a review command',
      async () => {
        const firstMaterial = buildReviewMaterial()
        const firstAuthorization =
          await createAuthorization()
        const firstSourceBinding =
          await createSourceBinding(
            firstMaterial.restrictedArtifact,
          )
        expectCommandError(
          'REQUEST_AUTHORIZATION_UNAVAILABLE',
          () =>
            commandModule
              .createAiChartD1PalaceWritingHumanReviewCommand({
                requestAuthorization:
                  structuredClone(
                    firstAuthorization,
                  ),
                sourceBinding:
                  firstSourceBinding,
                decisionProposal:
                  firstMaterial.decisionProposal,
              }),
        )

        const secondMaterial = buildReviewMaterial()
        const authorization = await createAuthorization()
        const sourceBinding =
          await createSourceBinding(
            secondMaterial.restrictedArtifact,
          )
        expectCommandError(
          'SOURCE_BINDING_UNAVAILABLE',
          () =>
            commandModule
              .createAiChartD1PalaceWritingHumanReviewCommand({
                requestAuthorization: authorization,
                sourceBinding:
                  structuredClone(sourceBinding),
                decisionProposal:
                  secondMaterial.decisionProposal,
              }),
        )
      },
    )

    await check(
      'review command requires exact object identity and is consumed once',
      async () => {
        const material = buildReviewMaterial()
        const command =
          commandModule
            .createAiChartD1PalaceWritingHumanReviewCommand({
              requestAuthorization:
                await createAuthorization(),
              sourceBinding:
                await createSourceBinding(
                  material.restrictedArtifact,
                ),
              decisionProposal:
                material.decisionProposal,
            })
        expectCommandError(
          'REVIEW_COMMAND_UNAVAILABLE',
          () =>
            commandModule
              .consumeAiChartD1PalaceWritingHumanReviewCommand(
                structuredClone(command),
              ),
        )
        assert.equal(
          commandModule
            .consumeAiChartD1PalaceWritingHumanReviewCommand(
              command,
            ),
          command,
        )
        expectCommandError(
          'REVIEW_COMMAND_UNAVAILABLE',
          () =>
            commandModule
              .consumeAiChartD1PalaceWritingHumanReviewCommand(
                command,
              ),
        )
      },
    )

    await check(
      'trusted Server clock creates one canonical write-once record envelope without persisting it',
      async () => {
        const command = await createReviewCommand()
        let clockReads = 0
        const envelope =
          recordEnvelopeModule
            .buildAiChartD1PalaceWritingHumanReviewRecordEnvelope(
              command,
              {
                now: () => {
                  clockReads += 1
                  return new Date(
                    '2026-07-28T09:10:11.123Z',
                  )
                },
              },
            )

        assert.equal(clockReads, 1)
        assert.deepEqual(Object.keys(envelope), [
          'contractVersion',
          'task',
          'dataClassification',
          'recordArtifactName',
          'storageScope',
          'storageAuthority',
          'serialization',
          'createMode',
          'directoryMode',
          'fileMode',
          'overwriteAllowed',
          'retryAllowed',
          'recordPayloadSha256',
          'recordStatus',
          'persistenceStatus',
          'formalReviewRecordAllowed',
          'customerDeliveryAllowed',
          'productionCallable',
          'storageWrites',
          'openAiRequests',
          'nextRequiredAction',
          'reviewRecord',
          'envelopeFingerprint',
        ])
        assert.deepEqual(
          Object.keys(envelope.reviewRecord),
          [
            'contractVersion',
            'task',
            'dataClassification',
            'reportId',
            'reviewerId',
            'permission',
            'decision',
            'issueCodes',
            'recordedAt',
            'recordedAtAuthority',
            'reportSnapshotSha256',
            'artifactSourceSnapshotSha256',
            'restrictedArtifactFingerprint',
            'artifactPayloadSha256',
            'gateFingerprint',
            'proposalFingerprint',
            'authorizationFingerprint',
            'sourceBindingFingerprint',
            'reviewCommandFingerprint',
            'sourceBindingStatus',
            'authorizationStatus',
            'customerDeliveryStatus',
            'recordFingerprint',
          ],
        )
        assert.equal(
          envelope.reviewRecord.recordedAt,
          '2026-07-28T09:10:11.123Z',
        )
        assert.equal(
          envelope.reviewRecord.recordedAtAuthority,
          'TRUSTED_SERVER_CLOCK',
        )
        assert.equal(
          envelope.recordArtifactName,
          'human-review-record.json',
        )
        assert.equal(
          envelope.createMode,
          'EXCLUSIVE_CREATE',
        )
        assert.equal(envelope.overwriteAllowed, false)
        assert.equal(envelope.retryAllowed, false)
        assert.equal(
          envelope.recordStatus,
          'CANONICAL_RECORD_READY_NOT_PERSISTED',
        )
        assert.equal(
          envelope.persistenceStatus,
          'NOT_PERSISTED',
        )
        assert.equal(
          envelope.formalReviewRecordAllowed,
          false,
        )
        assert.equal(
          envelope.customerDeliveryAllowed,
          false,
        )
        assert.equal(envelope.storageWrites, 0)
        assert.equal(envelope.openAiRequests, 0)
        assert.match(
          envelope.recordPayloadSha256,
          /^[a-f0-9]{64}$/u,
        )
        assert.equal(Object.isFrozen(envelope), true)
        assert.equal(
          Object.isFrozen(envelope.reviewRecord),
          true,
        )
        assert.equal(
          Object.isFrozen(
            envelope.reviewRecord.issueCodes,
          ),
          true,
        )

        const serialized = JSON.stringify(envelope)
        for (const forbidden of [
          OWNER_ID,
          SENSITIVE_EMAIL,
          SENSITIVE_TOKEN,
          SENSITIVE_MARKER,
          'chartSnapshot',
          'writingResult',
          'fidelityReview',
          'output_text',
          'birthInput',
          'storageRoot',
        ]) {
          assert.equal(
            serialized.includes(forbidden),
            false,
          )
        }
      },
    )

    await check(
      'invalid or unavailable clock fails before consuming the review command',
      async () => {
        const command = await createReviewCommand()
        expectRecordEnvelopeError(
          'SERVER_TIMESTAMP_INVALID',
          () =>
            recordEnvelopeModule
              .buildAiChartD1PalaceWritingHumanReviewRecordEnvelope(
                command,
                {
                  now: () => new Date(Number.NaN),
                },
              ),
        )

        const envelope =
          recordEnvelopeModule
            .buildAiChartD1PalaceWritingHumanReviewRecordEnvelope(
              command,
              {
                now: () =>
                  new Date(
                    '2026-07-28T09:10:11.123Z',
                  ),
              },
            )
        assert.equal(
          envelope.reviewRecord.reportId,
          REPORT_ID,
        )

        const throwingClockCommand =
          await createReviewCommand()
        expectRecordEnvelopeError(
          'SERVER_CLOCK_UNAVAILABLE',
          () =>
            recordEnvelopeModule
              .buildAiChartD1PalaceWritingHumanReviewRecordEnvelope(
                throwingClockCommand,
                {
                  now: () => {
                    throw new Error(SENSITIVE_MARKER)
                  },
                },
              ),
        )
      },
    )

    await check(
      'caller timestamp, copied command, and Production clock replacement cannot create a record envelope',
      async () => {
        const copiedCommand =
          structuredClone(await createReviewCommand())
        expectRecordEnvelopeError(
          'REVIEW_COMMAND_UNAVAILABLE',
          () =>
            recordEnvelopeModule
              .buildAiChartD1PalaceWritingHumanReviewRecordEnvelope(
                copiedCommand,
                {
                  now: () =>
                    new Date(
                      '2026-07-28T09:10:11.123Z',
                    ),
                },
              ),
        )

        const wrappedCommand = {
          reviewCommand: await createReviewCommand(),
          recordedAt: '2000-01-01T00:00:00.000Z',
        }
        expectRecordEnvelopeError(
          'REVIEW_COMMAND_UNAVAILABLE',
          () =>
            recordEnvelopeModule
              .buildAiChartD1PalaceWritingHumanReviewRecordEnvelope(
                wrappedCommand,
                {
                  now: () =>
                    new Date(
                      '2026-07-28T09:10:11.123Z',
                    ),
                },
              ),
        )

        const productionCommand =
          await createReviewCommand()
        mutableEnvironment.NODE_ENV = 'production'
        let injectedClockReads = 0
        try {
          expectRecordEnvelopeError(
            'SERVER_CLOCK_UNAVAILABLE',
            () =>
              recordEnvelopeModule
                .buildAiChartD1PalaceWritingHumanReviewRecordEnvelope(
                  productionCommand,
                  {
                    now: () => {
                      injectedClockReads += 1
                      return new Date(
                        '2026-07-28T09:10:11.123Z',
                      )
                    },
                  },
                ),
          )
          assert.equal(injectedClockReads, 0)
        } finally {
          mutableEnvironment.NODE_ENV = 'test'
        }

        const envelope =
          recordEnvelopeModule
            .buildAiChartD1PalaceWritingHumanReviewRecordEnvelope(
              productionCommand,
              {
                now: () =>
                  new Date(
                    '2026-07-28T09:10:11.123Z',
                  ),
              },
            )
        assert.equal(
          envelope.reviewRecord.reportId,
          REPORT_ID,
        )
      },
    )

    await check(
      'record envelope requires exact identity and is consumed once by a future writer',
      async () => {
        const envelope =
          recordEnvelopeModule
            .buildAiChartD1PalaceWritingHumanReviewRecordEnvelope(
              await createReviewCommand(),
              {
                now: () =>
                  new Date(
                    '2026-07-28T09:10:11.123Z',
                  ),
              },
            )
        expectRecordEnvelopeError(
          'REVIEW_RECORD_ENVELOPE_UNAVAILABLE',
          () =>
            recordEnvelopeModule
              .consumeAiChartD1PalaceWritingHumanReviewRecordEnvelope(
                structuredClone(envelope),
              ),
        )
        assert.equal(
          recordEnvelopeModule
            .consumeAiChartD1PalaceWritingHumanReviewRecordEnvelope(
              envelope,
            ),
          envelope,
        )
        expectRecordEnvelopeError(
          'REVIEW_RECORD_ENVELOPE_UNAVAILABLE',
          () =>
            recordEnvelopeModule
              .consumeAiChartD1PalaceWritingHumanReviewRecordEnvelope(
                envelope,
              ),
        )
      },
    )

    await check(
      'trusted writer persists one canonical human-review record with a path-free frozen receipt',
      async () => {
        process.env.TMPDIR = writerSuiteRoot
        await rm(reviewRecordStorageRoot, {
          recursive: true,
          force: true,
        })
        const envelope =
          recordEnvelopeModule
            .buildAiChartD1PalaceWritingHumanReviewRecordEnvelope(
              await createReviewCommand(),
              {
                now: () =>
                  new Date(
                    '2026-07-28T09:10:11.123Z',
                  ),
              },
            )
        const receipt =
          await recordWriterModule
            .persistAiChartD1PalaceWritingHumanReviewRecord(
              envelope,
            )
        const gateDirectory = join(
          reviewRecordStorageRoot,
          envelope.reviewRecord.gateFingerprint,
        )
        const artifactPath = join(
          gateDirectory,
          envelope.recordArtifactName,
        )
        const payload = await readFile(artifactPath)
        const directoryMetadata =
          await lstat(gateDirectory)
        const fileMetadata = await lstat(artifactPath)

        assert.deepEqual(Object.keys(receipt), [
          'contractVersion',
          'task',
          'dataClassification',
          'gateFingerprint',
          'authority',
          'artifactName',
          'recordFingerprint',
          'recordPayloadSha256',
          'envelopeFingerprint',
          'status',
          'serialization',
          'createMode',
          'directoryMode',
          'fileMode',
          'overwriteAllowed',
          'retryAllowed',
          'formalReviewRecordStatus',
          'customerDeliveryStatus',
          'customerDeliveryAllowed',
          'storageWrites',
          'openAiRequests',
        ])
        assert.equal(
          receipt.status,
          'PERSISTED_AWAITING_VERIFIED_READBACK',
        )
        assert.equal(
          receipt.authority,
          'TRUSTED_SERVER_HUMAN_REVIEW_RECORD_STORAGE_ADAPTER',
        )
        assert.equal(
          receipt.artifactName,
          'human-review-record.json',
        )
        assert.equal(
          receipt.recordFingerprint,
          envelope.reviewRecord.recordFingerprint,
        )
        assert.equal(
          receipt.recordPayloadSha256,
          envelope.recordPayloadSha256,
        )
        assert.equal(
          receipt.formalReviewRecordStatus,
          'PERSISTED_NOT_VERIFIED',
        )
        assert.equal(
          receipt.customerDeliveryStatus,
          'BLOCKED_PENDING_TRUSTED_REVIEW_RECORD',
        )
        assert.equal(
          receipt.customerDeliveryAllowed,
          false,
        )
        assert.equal(receipt.storageWrites, 1)
        assert.equal(receipt.openAiRequests, 0)
        assert.equal(Object.isFrozen(receipt), true)
        assert.equal('artifactPath' in receipt, false)
        assert.equal('reportId' in receipt, false)
        assert.equal('reviewerId' in receipt, false)
        assert.equal(
          payload.toString('utf8'),
          createAiChartD1PalaceWritingCanonicalJson(
            envelope.reviewRecord,
          ),
        )
        assert.equal(
          createHash('sha256')
            .update(payload)
            .digest('hex'),
          envelope.recordPayloadSha256,
        )
        assert.equal(
          directoryMetadata.isDirectory(),
          true,
        )
        assert.equal(
          directoryMetadata.isSymbolicLink(),
          false,
        )
        assert.equal(
          directoryMetadata.mode & 0o777,
          0o700,
        )
        assert.equal(fileMetadata.isFile(), true)
        assert.equal(
          fileMetadata.isSymbolicLink(),
          false,
        )
        assert.equal(
          fileMetadata.mode & 0o777,
          0o600,
        )

        const serialized = JSON.stringify(receipt)
        for (const forbidden of [
          REPORT_ID,
          REVIEWER_ID,
          OWNER_ID,
          SENSITIVE_EMAIL,
          SENSITIVE_TOKEN,
          SENSITIVE_MARKER,
          'output_text',
          'birthInput',
          'artifactPath',
          writerSuiteRoot,
        ]) {
          assert.equal(
            serialized.includes(forbidden),
            false,
          )
        }
      },
    )

    await check(
      'trusted readback verifies one canonical persisted review record without releasing customer delivery',
      async () => {
        process.env.TMPDIR = writerSuiteRoot
        await rm(reviewRecordStorageRoot, {
          recursive: true,
          force: true,
        })
        const envelope =
          recordEnvelopeModule
            .buildAiChartD1PalaceWritingHumanReviewRecordEnvelope(
              await createReviewCommand(),
              {
                now: () =>
                  new Date(
                    '2026-07-28T09:10:11.123Z',
                  ),
              },
            )
        const receipt =
          await recordWriterModule
            .persistAiChartD1PalaceWritingHumanReviewRecord(
              envelope,
            )
        const verified =
          await recordReadbackModule
            .readAndVerifyAiChartD1PalaceWritingHumanReviewRecord(
              receipt,
            )

        assert.deepEqual(Object.keys(verified), [
          'contractVersion',
          'task',
          'dataClassification',
          'gateFingerprint',
          'authority',
          'artifactName',
          'recordFingerprint',
          'recordPayloadSha256',
          'envelopeFingerprint',
          'status',
          'formalReviewRecordStatus',
          'decisionStatus',
          'customerDeliveryStatus',
          'customerDeliveryAllowed',
          'storageReads',
          'storageWrites',
          'openAiRequests',
          'nextRequiredAction',
          'reviewRecord',
        ])
        assert.equal(verified.status, 'VERIFIED')
        assert.equal(
          verified.formalReviewRecordStatus,
          'VERIFIED_PERSISTED_RECORD',
        )
        assert.equal(
          verified.decisionStatus,
          'VERIFIED_APPROVAL_AWAITING_DELIVERY_COORDINATOR',
        )
        assert.equal(
          verified.customerDeliveryStatus,
          'BLOCKED_PENDING_DELIVERY_COORDINATOR',
        )
        assert.equal(
          verified.customerDeliveryAllowed,
          false,
        )
        assert.equal(verified.storageReads, 1)
        assert.equal(verified.storageWrites, 0)
        assert.equal(verified.openAiRequests, 0)
        assert.equal(
          verified.nextRequiredAction,
          'EVALUATE_WITH_TRUSTED_CUSTOMER_DELIVERY_COORDINATOR',
        )
        assert.deepEqual(
          verified.reviewRecord,
          envelope.reviewRecord,
        )
        assert.equal(Object.isFrozen(verified), true)
        assert.equal(
          Object.isFrozen(verified.reviewRecord),
          true,
        )
        assert.equal(
          Object.isFrozen(
            verified.reviewRecord.issueCodes,
          ),
          true,
        )

        const serialized = JSON.stringify(verified)
        for (const forbidden of [
          OWNER_ID,
          SENSITIVE_EMAIL,
          SENSITIVE_TOKEN,
          SENSITIVE_MARKER,
          'chartSnapshot',
          'writingResult',
          'fidelityReview',
          'output_text',
          'birthInput',
          'artifactPath',
          writerSuiteRoot,
        ]) {
          assert.equal(
            serialized.includes(forbidden),
            false,
          )
        }
      },
    )

    await check(
      'readback accepts only the exact persisted receipt identity and consumes it once',
      async () => {
        process.env.TMPDIR = writerSuiteRoot
        await rm(reviewRecordStorageRoot, {
          recursive: true,
          force: true,
        })
        const envelope =
          recordEnvelopeModule
            .buildAiChartD1PalaceWritingHumanReviewRecordEnvelope(
              await createReviewCommand(),
              {
                now: () =>
                  new Date(
                    '2026-07-28T09:10:11.123Z',
                  ),
              },
            )
        const receipt =
          await recordWriterModule
            .persistAiChartD1PalaceWritingHumanReviewRecord(
              envelope,
            )

        await expectRecordReadbackError(
          recordReadbackModule
            .readAndVerifyAiChartD1PalaceWritingHumanReviewRecord(
              structuredClone(receipt),
            ),
        )
        const verified =
          await recordReadbackModule
            .readAndVerifyAiChartD1PalaceWritingHumanReviewRecord(
              receipt,
            )
        assert.equal(verified.status, 'VERIFIED')
        await expectRecordReadbackError(
          recordReadbackModule
            .readAndVerifyAiChartD1PalaceWritingHumanReviewRecord(
              receipt,
            ),
        )
      },
    )

    await check(
      'readback rejects a non-canonical or tampered review record without leaking its content or allowing retry',
      async () => {
        process.env.TMPDIR = writerSuiteRoot
        await rm(reviewRecordStorageRoot, {
          recursive: true,
          force: true,
        })
        const envelope =
          recordEnvelopeModule
            .buildAiChartD1PalaceWritingHumanReviewRecordEnvelope(
              await createReviewCommand(),
              {
                now: () =>
                  new Date(
                    '2026-07-28T09:10:11.123Z',
                  ),
              },
            )
        const receipt =
          await recordWriterModule
            .persistAiChartD1PalaceWritingHumanReviewRecord(
              envelope,
            )
        const artifactPath = join(
          reviewRecordStorageRoot,
          receipt.gateFingerprint,
          receipt.artifactName,
        )
        await writeFile(
          artifactPath,
          JSON.stringify({
            ...envelope.reviewRecord,
            untrusted: SENSITIVE_MARKER,
          }),
          {
            encoding: 'utf8',
          },
        )

        await expectRecordReadbackError(
          recordReadbackModule
            .readAndVerifyAiChartD1PalaceWritingHumanReviewRecord(
              receipt,
            ),
        )
        await expectRecordReadbackError(
          recordReadbackModule
            .readAndVerifyAiChartD1PalaceWritingHumanReviewRecord(
              receipt,
            ),
        )
      },
    )

    await check(
      'readback rejects an unexpected second Gate artifact',
      async () => {
        process.env.TMPDIR = writerSuiteRoot
        await rm(reviewRecordStorageRoot, {
          recursive: true,
          force: true,
        })
        const envelope =
          recordEnvelopeModule
            .buildAiChartD1PalaceWritingHumanReviewRecordEnvelope(
              await createReviewCommand(),
              {
                now: () =>
                  new Date(
                    '2026-07-28T09:10:11.123Z',
                  ),
              },
            )
        const receipt =
          await recordWriterModule
            .persistAiChartD1PalaceWritingHumanReviewRecord(
              envelope,
            )
        await writeFile(
          join(
            reviewRecordStorageRoot,
            receipt.gateFingerprint,
            'unexpected.json',
          ),
          '{}',
          {
            encoding: 'utf8',
            mode: 0o600,
          },
        )

        await expectRecordReadbackError(
          recordReadbackModule
            .readAndVerifyAiChartD1PalaceWritingHumanReviewRecord(
              receipt,
            ),
        )
      },
    )

    await check(
      'readback rejects private-file mode drift',
      async () => {
        process.env.TMPDIR = writerSuiteRoot
        await rm(reviewRecordStorageRoot, {
          recursive: true,
          force: true,
        })
        const envelope =
          recordEnvelopeModule
            .buildAiChartD1PalaceWritingHumanReviewRecordEnvelope(
              await createReviewCommand(),
              {
                now: () =>
                  new Date(
                    '2026-07-28T09:10:11.123Z',
                  ),
              },
            )
        const receipt =
          await recordWriterModule
            .persistAiChartD1PalaceWritingHumanReviewRecord(
              envelope,
            )
        chmodSync(
          join(
            reviewRecordStorageRoot,
            receipt.gateFingerprint,
            receipt.artifactName,
          ),
          0o644,
        )

        await expectRecordReadbackError(
          recordReadbackModule
            .readAndVerifyAiChartD1PalaceWritingHumanReviewRecord(
              receipt,
            ),
        )
      },
    )

    await check(
      'readback rejects private Gate-directory mode drift',
      async () => {
        process.env.TMPDIR = writerSuiteRoot
        await rm(reviewRecordStorageRoot, {
          recursive: true,
          force: true,
        })
        const envelope =
          recordEnvelopeModule
            .buildAiChartD1PalaceWritingHumanReviewRecordEnvelope(
              await createReviewCommand(),
              {
                now: () =>
                  new Date(
                    '2026-07-28T09:10:11.123Z',
                  ),
              },
            )
        const receipt =
          await recordWriterModule
            .persistAiChartD1PalaceWritingHumanReviewRecord(
              envelope,
            )
        chmodSync(
          join(
            reviewRecordStorageRoot,
            receipt.gateFingerprint,
          ),
          0o755,
        )

        await expectRecordReadbackError(
          recordReadbackModule
            .readAndVerifyAiChartD1PalaceWritingHumanReviewRecord(
              receipt,
            ),
        )
      },
    )

    await check(
      'readback rejects a symlinked review-record artifact',
      async () => {
        process.env.TMPDIR = writerSuiteRoot
        await rm(reviewRecordStorageRoot, {
          recursive: true,
          force: true,
        })
        const envelope =
          recordEnvelopeModule
            .buildAiChartD1PalaceWritingHumanReviewRecordEnvelope(
              await createReviewCommand(),
              {
                now: () =>
                  new Date(
                    '2026-07-28T09:10:11.123Z',
                  ),
              },
            )
        const receipt =
          await recordWriterModule
            .persistAiChartD1PalaceWritingHumanReviewRecord(
              envelope,
            )
        const artifactPath = join(
          reviewRecordStorageRoot,
          receipt.gateFingerprint,
          receipt.artifactName,
        )
        const externalArtifact = join(
          writerSuiteRoot,
          'untrusted-human-review-record.json',
        )
        await writeFile(
          externalArtifact,
          createAiChartD1PalaceWritingCanonicalJson(
            envelope.reviewRecord,
          ),
          {
            encoding: 'utf8',
            mode: 0o600,
          },
        )
        await rm(artifactPath)
        await symlink(externalArtifact, artifactPath)

        await expectRecordReadbackError(
          recordReadbackModule
            .readAndVerifyAiChartD1PalaceWritingHumanReviewRecord(
              receipt,
            ),
        )
      },
    )

    await check(
      'readback rejects a review record larger than the fixed 32 KiB limit',
      async () => {
        process.env.TMPDIR = writerSuiteRoot
        await rm(reviewRecordStorageRoot, {
          recursive: true,
          force: true,
        })
        const envelope =
          recordEnvelopeModule
            .buildAiChartD1PalaceWritingHumanReviewRecordEnvelope(
              await createReviewCommand(),
              {
                now: () =>
                  new Date(
                    '2026-07-28T09:10:11.123Z',
                  ),
              },
            )
        const receipt =
          await recordWriterModule
            .persistAiChartD1PalaceWritingHumanReviewRecord(
              envelope,
            )
        await writeFile(
          join(
            reviewRecordStorageRoot,
            receipt.gateFingerprint,
            receipt.artifactName,
          ),
          'x'.repeat(32 * 1024 + 1),
          {
            encoding: 'utf8',
          },
        )

        await expectRecordReadbackError(
          recordReadbackModule
            .readAndVerifyAiChartD1PalaceWritingHumanReviewRecord(
              receipt,
            ),
        )
      },
    )

    await check(
      'verified repair and rejection records remain blocked under their decision-specific next actions',
      async () => {
        process.env.TMPDIR = writerSuiteRoot
        const cases = [
          {
            decision: 'REPAIR_REQUIRED' as const,
            decisionStatus:
              'VERIFIED_REPAIR_REQUIRED',
            customerDeliveryStatus:
              'BLOCKED_REPAIR_REQUIRED',
            nextRequiredAction:
              'RETURN_TO_REPAIR_WORKFLOW',
          },
          {
            decision: 'REJECTED' as const,
            decisionStatus: 'VERIFIED_REJECTED',
            customerDeliveryStatus: 'BLOCKED_REJECTED',
            nextRequiredAction:
              'KEEP_REJECTED_ARTIFACT_BLOCKED',
          },
        ] as const

        for (const testCase of cases) {
          await rm(reviewRecordStorageRoot, {
            recursive: true,
            force: true,
          })
          const envelope =
            recordEnvelopeModule
              .buildAiChartD1PalaceWritingHumanReviewRecordEnvelope(
                await createReviewCommand(
                  testCase.decision,
                ),
                {
                  now: () =>
                    new Date(
                      '2026-07-28T09:10:11.123Z',
                    ),
                },
              )
          const receipt =
            await recordWriterModule
              .persistAiChartD1PalaceWritingHumanReviewRecord(
                envelope,
              )
          const verified =
            await recordReadbackModule
              .readAndVerifyAiChartD1PalaceWritingHumanReviewRecord(
                receipt,
              )

          assert.equal(
            verified.decisionStatus,
            testCase.decisionStatus,
          )
          assert.equal(
            verified.customerDeliveryStatus,
            testCase.customerDeliveryStatus,
          )
          assert.equal(
            verified.nextRequiredAction,
            testCase.nextRequiredAction,
          )
          assert.equal(
            verified.customerDeliveryAllowed,
            false,
          )
          assert.deepEqual(
            verified.reviewRecord.issueCodes,
            ['SOURCE_FAITHFULNESS_CONCERN'],
          )
        }
      },
    )

    await check(
      'customer-delivery coordinator consumes one verified approval and stops after latest Report state verification',
      async () => {
        const verified =
          await createVerifiedReviewRecord()
        let probeCalls = 0
        let observedCommand:
          | import(
            './d1PalaceWritingCustomerDeliveryCoordinator.server'
          ).AiChartD1PalaceWritingCustomerDeliveryStateProbeCommand
          | undefined
        const coordination =
          await customerDeliveryCoordinatorModule
            .coordinateAiChartD1PalaceWritingCustomerDelivery({
              verifiedHumanReviewRecord: verified,
              probeLatestReportDeliveryState:
                async (command) => {
                  probeCalls += 1
                  observedCommand = command
                  return createEligibleDeliveryStateOutcome(
                    command,
                  )
                },
            })

        assert.equal(probeCalls, 1)
        assert.notEqual(observedCommand, undefined)
        assert.deepEqual(
          Object.keys(observedCommand ?? {}),
          [
            'contractVersion',
            'task',
            'adapterMode',
            'sequence',
            'reportId',
            'reportSnapshotSha256',
            'gateFingerprint',
            'recordFingerprint',
          ],
        )
        assert.equal(
          Object.isFrozen(observedCommand),
          true,
        )
        assert.deepEqual(Object.keys(coordination), [
          'contractVersion',
          'task',
          'dataClassification',
          'reportId',
          'reportSnapshotSha256',
          'gateFingerprint',
          'recordFingerprint',
          'recordPayloadSha256',
          'envelopeFingerprint',
          'decision',
          'authority',
          'status',
          'stage',
          'capabilityScope',
          'verifiedHumanReviewStatus',
          'reportLookupStatus',
          'paymentStatus',
          'reportStatus',
          'reportContentStatus',
          'ownerBindingStatus',
          'sourceBindingStatus',
          'deliveryAdapterStatus',
          'customerDeliveryStatus',
          'customerDeliveryAllowed',
          'reportMutationAllowed',
          'productionCallable',
          'reportStateReads',
          'storageWrites',
          'reportMutations',
          'openAiRequests',
          'nextRequiredAction',
          'coordinationFingerprint',
        ])
        assert.equal(
          coordination.status,
          'READY_STOPPED',
        )
        assert.equal(
          coordination.stage,
          'LATEST_REPORT_DELIVERY_STATE_VERIFIED',
        )
        assert.equal(
          coordination.capabilityScope,
          'IN_PROCESS_EXACT_OBJECT_IDENTITY',
        )
        assert.equal(
          coordination.verifiedHumanReviewStatus,
          'CONSUMED_VERIFIED_APPROVAL',
        )
        assert.equal(
          coordination.reportLookupStatus,
          'SYNTHETIC_FOUND',
        )
        assert.equal(
          coordination.paymentStatus,
          'SYNTHETIC_PAID_NOT_PRODUCTION',
        )
        assert.equal(
          coordination.reportStatus,
          'SYNTHETIC_PENDING_NOT_PRODUCTION',
        )
        assert.equal(
          coordination.reportContentStatus,
          'SYNTHETIC_ABSENT_NOT_PRODUCTION',
        )
        assert.equal(
          coordination.ownerBindingStatus,
          'SYNTHETIC_SERVER_VERIFIED_NOT_PRODUCTION',
        )
        assert.equal(
          coordination.sourceBindingStatus,
          'SYNTHETIC_MATCHED_NOT_PRODUCTION',
        )
        assert.equal(
          coordination.deliveryAdapterStatus,
          'NOT_IMPLEMENTED',
        )
        assert.equal(
          coordination.customerDeliveryStatus,
          'BLOCKED_PENDING_TRUSTED_DELIVERY_ADAPTER',
        )
        assert.equal(
          coordination.customerDeliveryAllowed,
          false,
        )
        assert.equal(
          coordination.reportMutationAllowed,
          false,
        )
        assert.equal(
          coordination.productionCallable,
          false,
        )
        assert.equal(
          coordination.reportStateReads,
          1,
        )
        assert.equal(coordination.storageWrites, 0)
        assert.equal(coordination.reportMutations, 0)
        assert.equal(coordination.openAiRequests, 0)
        assert.equal(
          coordination.nextRequiredAction,
          'IMPLEMENT_SEPARATELY_AUTHORIZED_TRUSTED_DELIVERY_ADAPTER',
        )
        assert.equal(Object.isFrozen(coordination), true)
        assert.match(
          coordination.coordinationFingerprint,
          /^[a-f0-9]{64}$/u,
        )
        assert.throws(
          () =>
            customerDeliveryCoordinatorModule
              .consumeAiChartD1PalaceWritingCustomerDeliveryCoordination(
                structuredClone(coordination),
              ),
          {
            code: 'COORDINATION_UNAVAILABLE',
          },
        )
        assert.equal(
          customerDeliveryCoordinatorModule
            .consumeAiChartD1PalaceWritingCustomerDeliveryCoordination(
              coordination,
            ),
          coordination,
        )
        assert.throws(
          () =>
            customerDeliveryCoordinatorModule
              .consumeAiChartD1PalaceWritingCustomerDeliveryCoordination(
                coordination,
              ),
          {
            code: 'COORDINATION_UNAVAILABLE',
          },
        )

        const serialized = JSON.stringify(coordination)
        for (const forbidden of [
          REVIEWER_ID,
          OWNER_ID,
          SENSITIVE_EMAIL,
          SENSITIVE_TOKEN,
          SENSITIVE_MARKER,
          'chartSnapshot',
          'writingResult',
          'fidelityReview',
          'output_text',
          'birthInput',
          '"reportContent":',
          writerSuiteRoot,
        ]) {
          assert.equal(
            serialized.includes(forbidden),
            false,
          )
        }
      },
    )

    await check(
      'customer-delivery coordinator rejects copied and reused verified approval capabilities',
      async () => {
        const copiedSource =
          await createVerifiedReviewRecord()
        let copiedProbeCalls = 0
        await expectCustomerDeliveryCoordinatorError(
          'VERIFIED_APPROVAL_UNAVAILABLE',
          customerDeliveryCoordinatorModule
            .coordinateAiChartD1PalaceWritingCustomerDelivery({
              verifiedHumanReviewRecord:
                structuredClone(copiedSource),
              probeLatestReportDeliveryState:
                async (command) => {
                  copiedProbeCalls += 1
                  return createEligibleDeliveryStateOutcome(
                    command,
                  )
                },
            }),
        )
        assert.equal(copiedProbeCalls, 0)

        const reusableSource =
          await createVerifiedReviewRecord()
        const probe = async (
          command:
            import(
              './d1PalaceWritingCustomerDeliveryCoordinator.server'
            ).AiChartD1PalaceWritingCustomerDeliveryStateProbeCommand,
        ) =>
          createEligibleDeliveryStateOutcome(command)
        const first =
          await customerDeliveryCoordinatorModule
            .coordinateAiChartD1PalaceWritingCustomerDelivery({
              verifiedHumanReviewRecord: reusableSource,
              probeLatestReportDeliveryState: probe,
            })
        assert.equal(first.status, 'READY_STOPPED')
        await expectCustomerDeliveryCoordinatorError(
          'VERIFIED_APPROVAL_UNAVAILABLE',
          customerDeliveryCoordinatorModule
            .coordinateAiChartD1PalaceWritingCustomerDelivery({
              verifiedHumanReviewRecord: reusableSource,
              probeLatestReportDeliveryState: probe,
            }),
        )
      },
    )

    await check(
      'repair and rejection records cannot invoke the customer-delivery state probe',
      async () => {
        for (const decision of [
          'REPAIR_REQUIRED',
          'REJECTED',
        ] as const) {
          const verified =
            await createVerifiedReviewRecord(decision)
          let probeCalls = 0
          await expectCustomerDeliveryCoordinatorError(
            'HUMAN_REVIEW_APPROVAL_REQUIRED',
            customerDeliveryCoordinatorModule
              .coordinateAiChartD1PalaceWritingCustomerDelivery({
                verifiedHumanReviewRecord: verified,
                probeLatestReportDeliveryState:
                  async (command) => {
                    probeCalls += 1
                    return createEligibleDeliveryStateOutcome(
                      command,
                    )
                  },
              }),
          )
          assert.equal(probeCalls, 0)
        }
      },
    )

    await check(
      'customer-delivery coordinator rejects Report identity and Snapshot drift without allowing retry',
      async () => {
        const cases = [
          {
            name: 'report',
            mutate: (
              outcome:
                ReturnType<
                  typeof createEligibleDeliveryStateOutcome
                >,
            ) => ({
              ...outcome,
              reportId:
                '8b5896aa-4267-40bf-88ae-590719928e45',
            }),
          },
          {
            name: 'snapshot',
            mutate: (
              outcome:
                ReturnType<
                  typeof createEligibleDeliveryStateOutcome
                >,
            ) => ({
              ...outcome,
              reportSnapshotSha256: '0'.repeat(64),
            }),
          },
          {
            name: 'gate',
            mutate: (
              outcome:
                ReturnType<
                  typeof createEligibleDeliveryStateOutcome
                >,
            ) => ({
              ...outcome,
              gateFingerprint: '1'.repeat(64),
            }),
          },
          {
            name: 'record',
            mutate: (
              outcome:
                ReturnType<
                  typeof createEligibleDeliveryStateOutcome
                >,
            ) => ({
              ...outcome,
              recordFingerprint: '2'.repeat(64),
            }),
          },
        ] as const

        for (const testCase of cases) {
          const verified =
            await createVerifiedReviewRecord()
          await expectCustomerDeliveryCoordinatorError(
            'LATEST_REPORT_STATE_MISMATCH',
            customerDeliveryCoordinatorModule
              .coordinateAiChartD1PalaceWritingCustomerDelivery({
                verifiedHumanReviewRecord: verified,
                probeLatestReportDeliveryState:
                  async (command) =>
                    testCase.mutate(
                      createEligibleDeliveryStateOutcome(
                        command,
                      ),
                    ),
              }),
          )
          await expectCustomerDeliveryCoordinatorError(
            'VERIFIED_APPROVAL_UNAVAILABLE',
            customerDeliveryCoordinatorModule
              .coordinateAiChartD1PalaceWritingCustomerDelivery({
                verifiedHumanReviewRecord: verified,
                probeLatestReportDeliveryState:
                  async (command) =>
                    createEligibleDeliveryStateOutcome(
                      command,
                    ),
              }),
          )
          assert.equal(
            testCase.name.length > 0,
            true,
          )
        }
      },
    )

    await check(
      'customer-delivery coordinator fails closed for unpaid, terminal, or already published Report state',
      async () => {
        const cases = [
          {
            code: 'REPORT_PAYMENT_REQUIRED' as const,
            patch: {
              paymentStatus: 'PENDING',
            },
          },
          {
            code: 'REPORT_STATUS_INVALID' as const,
            patch: {
              reportStatus: 'FAILED',
            },
          },
          {
            code: 'REPORT_ALREADY_PUBLISHED' as const,
            patch: {
              reportContentStatus: 'PRESENT',
            },
          },
          {
            code:
              'REPORT_OWNER_BINDING_INVALID' as const,
            patch: {
              ownerBindingStatus: 'MISSING',
            },
          },
          {
            code: 'LATEST_REPORT_STATE_INVALID' as const,
            patch: {
              untrusted: SENSITIVE_MARKER,
            },
          },
        ] as const

        for (const testCase of cases) {
          const verified =
            await createVerifiedReviewRecord()
          await expectCustomerDeliveryCoordinatorError(
            testCase.code,
            customerDeliveryCoordinatorModule
              .coordinateAiChartD1PalaceWritingCustomerDelivery({
                verifiedHumanReviewRecord: verified,
                probeLatestReportDeliveryState:
                  async (command) => ({
                    ...createEligibleDeliveryStateOutcome(
                      command,
                    ),
                    ...testCase.patch,
                  }),
              }),
          )
        }
      },
    )

    await check(
      'customer-delivery coordinator test seam is unavailable outside canonical test mode',
      async () => {
        const verified =
          await createVerifiedReviewRecord()
        mutableEnvironment.NODE_ENV = 'production'
        let probeCalls = 0
        try {
          await expectCustomerDeliveryCoordinatorError(
            'LATEST_REPORT_STATE_ADAPTER_UNAVAILABLE',
            customerDeliveryCoordinatorModule
              .coordinateAiChartD1PalaceWritingCustomerDelivery({
                verifiedHumanReviewRecord: verified,
                probeLatestReportDeliveryState:
                  async (command) => {
                    probeCalls += 1
                    return createEligibleDeliveryStateOutcome(
                      command,
                    )
                  },
              }),
          )
        } finally {
          mutableEnvironment.NODE_ENV = 'test'
        }
        assert.equal(probeCalls, 0)

        const result =
          await customerDeliveryCoordinatorModule
            .coordinateAiChartD1PalaceWritingCustomerDelivery({
              verifiedHumanReviewRecord: verified,
              probeLatestReportDeliveryState:
                async (command) =>
                  createEligibleDeliveryStateOutcome(
                    command,
                  ),
            })
        assert.equal(result.status, 'READY_STOPPED')
      },
    )

    await check(
      'trusted delivery adapter contract fixes durable ledger, Report compare-and-set, and idempotency order without invoking delivery',
      async () => {
        const coordination =
          await createCustomerDeliveryCoordination()
        const contract =
          trustedDeliveryAdapterContractModule
            .buildAiChartD1PalaceWritingTrustedDeliveryAdapterContract(
              coordination,
            )

        assert.deepEqual(
          contract.requiredPorts,
          [
            {
              sequence: 1,
              port:
                'ENSURE_DURABLE_REVIEW_LEDGER',
              requiredInput:
                'EXACT_APPROVAL_BINDING_AND_IDEMPOTENCY_KEY',
              requiredOutput:
                'CREATED_OR_EXISTING_EXACT_MATCH',
              idempotencyRule:
                'EXCLUSIVE_CREATE_OR_EXACT_MATCH',
              implementationStatus:
                'NOT_IMPLEMENTED',
            },
            {
              sequence: 2,
              port:
                'COMPARE_AND_SET_REPORT_DELIVERY_CLAIM',
              requiredInput:
                'EXPECTED_OWNER_PAID_PENDING_CONTENT_ABSENT_EXACT_SNAPSHOT',
              requiredOutput:
                'CLAIMED_OR_ALREADY_DELIVERED_EXACT_MATCH',
              idempotencyRule:
                'SAME_IDEMPOTENCY_KEY_ONLY',
              implementationStatus:
                'NOT_IMPLEMENTED',
            },
            {
              sequence: 3,
              port:
                'PUBLISH_SOURCE_BOUND_REPORT_CONTENT',
              requiredInput:
                'EXACT_CLAIM_AND_VERIFIED_RESTRICTED_ARTIFACT_ONLY',
              requiredOutput:
                'PUBLISHED_OR_ALREADY_PUBLISHED_EXACT_MATCH',
              idempotencyRule:
                'COMPARE_AND_SET_ON_REPORT_AND_IDEMPOTENCY_KEY',
              implementationStatus:
                'NOT_IMPLEMENTED',
            },
          ],
        )
        assert.equal(
          contract.durableReviewLedgerPolicy,
          'APPEND_OR_VERIFY_EXACT_MATCH_BEFORE_ANY_REPORT_MUTATION',
        )
        assert.equal(
          contract.reportCompareAndSetPolicy,
          'ATOMIC_EXPECTED_OWNER_PAID_PENDING_CONTENT_ABSENT_EXACT_SNAPSHOT',
        )
        assert.equal(
          contract.reportContentSourcePolicy,
          'VERIFIED_RESTRICTED_ARTIFACT_REQUIRED',
        )
        assert.equal(
          contract.replayPolicy,
          'EXACT_MATCH_ONLY_OTHERWISE_FAIL_CLOSED',
        )
        assert.equal(
          contract.partialFailurePolicy,
          'NO_BLIND_RETRY_RECONCILE_BY_IDEMPOTENCY_KEY',
        )
        assert.equal(
          contract.existingReportContentGateStatus,
          'INSUFFICIENT_READ_THEN_WRITE_NOT_ATOMIC',
        )
        assert.deepEqual(
          contract.reportCompareAndSetExpectedState,
          {
            ownerBindingStatus: 'SERVER_VERIFIED',
            paymentStatus: 'PAID',
            reportStatus: 'PENDING',
            reportContentStatus: 'ABSENT',
            reportSnapshotStatus: 'EXACT_MATCH',
          },
        )
        assert.match(
          contract.idempotencyKey,
          /^[a-f0-9]{64}$/u,
        )
        assert.equal(
          contract.idempotencyStatus,
          'KEY_DERIVED_NOT_PERSISTED',
        )
        assert.equal(
          contract.status,
          'PORTS_DECLARED_NOT_IMPLEMENTED',
        )
        assert.equal(
          contract.customerDeliveryStatus,
          'BLOCKED_PENDING_DURABLE_DELIVERY_ADAPTER',
        )
        assert.equal(
          contract.customerDeliveryAllowed,
          false,
        )
        assert.equal(
          contract.reportMutationAllowed,
          false,
        )
        assert.equal(
          contract.productionCallable,
          false,
        )
        assert.equal(contract.adapterInvocations, 0)
        assert.equal(contract.durableLedgerWrites, 0)
        assert.equal(contract.reportMutations, 0)
        assert.equal(contract.openAiRequests, 0)
        assert.equal(
          recursivelyFrozen(contract),
          true,
        )
      },
    )

    await check(
      'trusted delivery adapter contract rejects copied and reused capabilities while keeping idempotency and diagnostics safe',
      async () => {
        const copiedCoordination =
          await createCustomerDeliveryCoordination()
        expectTrustedDeliveryAdapterContractError(
          'COORDINATION_UNAVAILABLE',
          () =>
            trustedDeliveryAdapterContractModule
              .buildAiChartD1PalaceWritingTrustedDeliveryAdapterContract(
                structuredClone(copiedCoordination),
              ),
        )
        const contractFromOriginal =
          trustedDeliveryAdapterContractModule
            .buildAiChartD1PalaceWritingTrustedDeliveryAdapterContract(
              copiedCoordination,
            )

        const equivalentContract =
          trustedDeliveryAdapterContractModule
            .buildAiChartD1PalaceWritingTrustedDeliveryAdapterContract(
              await createCustomerDeliveryCoordination(),
            )
        assert.equal(
          equivalentContract.idempotencyKey,
          contractFromOriginal.idempotencyKey,
        )
        assert.equal(
          equivalentContract.contractFingerprint,
          contractFromOriginal.contractFingerprint,
        )
        const differentApprovalContract =
          trustedDeliveryAdapterContractModule
            .buildAiChartD1PalaceWritingTrustedDeliveryAdapterContract(
              await createCustomerDeliveryCoordination(
                '2026-07-28T09:10:12.123Z',
              ),
            )
        assert.notEqual(
          differentApprovalContract.idempotencyKey,
          contractFromOriginal.idempotencyKey,
        )
        assert.notEqual(
          differentApprovalContract.recordFingerprint,
          contractFromOriginal.recordFingerprint,
        )

        expectTrustedDeliveryAdapterContractError(
          'COORDINATION_UNAVAILABLE',
          () =>
            trustedDeliveryAdapterContractModule
              .buildAiChartD1PalaceWritingTrustedDeliveryAdapterContract(
                copiedCoordination,
              ),
        )
        expectTrustedDeliveryAdapterContractError(
          'TRUSTED_DELIVERY_ADAPTER_CONTRACT_UNAVAILABLE',
          () =>
            trustedDeliveryAdapterContractModule
              .consumeAiChartD1PalaceWritingTrustedDeliveryAdapterContract(
                structuredClone(contractFromOriginal),
              ),
        )
        assert.equal(
          trustedDeliveryAdapterContractModule
            .consumeAiChartD1PalaceWritingTrustedDeliveryAdapterContract(
              contractFromOriginal,
            ),
          contractFromOriginal,
        )
        expectTrustedDeliveryAdapterContractError(
          'TRUSTED_DELIVERY_ADAPTER_CONTRACT_UNAVAILABLE',
          () =>
            trustedDeliveryAdapterContractModule
              .consumeAiChartD1PalaceWritingTrustedDeliveryAdapterContract(
                contractFromOriginal,
              ),
        )

        const serialized = JSON.stringify(
          equivalentContract,
        )
        for (const forbidden of [
          REVIEWER_ID,
          OWNER_ID,
          SENSITIVE_EMAIL,
          SENSITIVE_TOKEN,
          SENSITIVE_MARKER,
          'chartSnapshot',
          'birthInput',
          'writingResult',
          'fidelityReview',
          'output_text',
          '"reportContent":',
          writerSuiteRoot,
        ]) {
          assert.equal(
            serialized.includes(forbidden),
            false,
          )
        }
      },
    )

    await check(
      'trusted delivery repository adapter maps verified material to one exact atomic RPC call',
      async () => {
        const material =
          await createTrustedDeliveryRepositoryMaterial()
        const ownerLookupCommands: unknown[] = []
        const rpcCommands: Array<
          import(
            './d1PalaceWritingTrustedDeliveryRepositoryAdapter.server'
          ).AiChartD1PalaceWritingAtomicDeliveryRpcCommand
        > = []

        const result =
          await trustedDeliveryRepositoryAdapterModule
            .executeAiChartD1PalaceWritingTrustedDeliveryRepositoryAdapter(
              material,
              {
                lookupExpectedOwner: async (command) => {
                  ownerLookupCommands.push(command)
                  return {
                    adapterMode:
                      'INJECTED_OFFLINE_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_ONLY',
                    reportId: command.reportId,
                    ownerUserId: OWNER_ID,
                  }
                },
                invokeAtomicDeliveryRpc: async (command) => {
                  rpcCommands.push(command)
                  return {
                    result_code: 'PUBLISHED',
                    ledger_receipt_fingerprint:
                      command.p_ledger_receipt_fingerprint,
                    delivery_claim_fingerprint:
                      command.p_delivery_claim_fingerprint,
                    delivery_receipt_fingerprint:
                      command.p_delivery_receipt_fingerprint,
                    report_content_sha256:
                      command.p_report_content_sha256,
                  }
                },
              },
            )

        assert.equal(ownerLookupCommands.length, 1)
        assert.equal(rpcCommands.length, 1)
        assert.deepEqual(
          Object.keys(rpcCommands[0]),
          [
            'p_report_id',
            'p_expected_owner_user_id',
            'p_review_record',
            'p_report_snapshot_sha256',
            'p_gate_fingerprint',
            'p_record_fingerprint',
            'p_record_payload_sha256',
            'p_envelope_fingerprint',
            'p_contract_fingerprint',
            'p_source_coordination_fingerprint',
            'p_idempotency_key',
            'p_artifact_payload_sha256',
            'p_ledger_receipt_fingerprint',
            'p_delivery_claim_fingerprint',
            'p_delivery_receipt_fingerprint',
            'p_report_content_sha256',
            'p_report_content',
          ],
        )
        assert.equal(
          rpcCommands[0].p_expected_owner_user_id,
          OWNER_ID,
        )
        assert.equal(
          rpcCommands[0].p_report_id,
          REPORT_ID,
        )
        assert.equal(
          rpcCommands[0].p_review_record,
          createAiChartD1PalaceWritingCanonicalJson(
            material.reviewRecord,
          ),
        )
        assert.equal(
          rpcCommands[0].p_artifact_payload_sha256,
          sha256Canonical(material.restrictedArtifact),
        )
        assert.equal(
          rpcCommands[0].p_report_content,
          material.restrictedArtifact.writingResult.sections
            .map((section) => section.customerText)
            .join('\n\n'),
        )
        assert.equal(
          result.status,
          'OFFLINE_ATOMIC_RPC_MAPPING_VERIFIED',
        )
        assert.equal(result.rpcResultCode, 'PUBLISHED')
        assert.equal(result.ownerLookups, 1)
        assert.equal(result.atomicRpcCalls, 1)
        assert.equal(result.automaticRetryPerformed, false)
        assert.equal(result.customerDeliveryAllowed, false)
        assert.equal(result.productionCallable, false)
        assert.equal(result.openAiRequests, 0)
        assert.equal(recursivelyFrozen(result), true)
      },
    )

    await check(
      'trusted delivery Supabase repository invokes the one atomic RPC and normalizes its single row',
      async () => {
        const material =
          await createTrustedDeliveryRepositoryMaterial()
        const rpcCalls: Array<
          Readonly<{
            functionName: string
            command:
              import(
                './d1PalaceWritingTrustedDeliveryRepositoryAdapter.server'
              ).AiChartD1PalaceWritingAtomicDeliveryRpcCommand
          }>
        > = []
        const invokeAtomicDeliveryRpc =
          trustedDeliverySupabaseRepositoryModule
            .createAiChartD1PalaceWritingTrustedDeliverySupabaseAtomicRpcInvoker(
              {
                rpc: async (
                  functionName,
                  command,
                ) => {
                  rpcCalls.push({
                    functionName,
                    command,
                  })
                  return {
                    data: [
                      {
                        result_code: 'PUBLISHED',
                        ledger_receipt_fingerprint:
                          command.p_ledger_receipt_fingerprint,
                        delivery_claim_fingerprint:
                          command.p_delivery_claim_fingerprint,
                        delivery_receipt_fingerprint:
                          command.p_delivery_receipt_fingerprint,
                        report_content_sha256:
                          command.p_report_content_sha256,
                      },
                    ],
                    error: null,
                    count: null,
                    status: 200,
                    statusText: 'OK',
                  }
                },
              },
            )

        const result =
          await trustedDeliveryRepositoryAdapterModule
            .executeAiChartD1PalaceWritingTrustedDeliveryRepositoryAdapter(
              material,
              {
                lookupExpectedOwner:
                  async (command) => ({
                    adapterMode:
                      'INJECTED_OFFLINE_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_ONLY',
                    reportId: command.reportId,
                    ownerUserId: OWNER_ID,
                  }),
                invokeAtomicDeliveryRpc,
              },
            )

        assert.equal(rpcCalls.length, 1)
        assert.equal(
          rpcCalls[0].functionName,
          'deliver_ai_chart_report_after_review',
        )
        assert.equal(
          Object.isFrozen(rpcCalls[0].command),
          true,
        )
        assert.equal(result.rpcResultCode, 'PUBLISHED')
        assert.equal(result.atomicRpcCalls, 1)
        assert.equal(result.automaticRetryPerformed, false)
        assert.equal(result.customerDeliveryAllowed, false)
        assert.equal(result.productionCallable, false)
      },
    )

    await check(
      'trusted delivery Supabase admin client factory binds one owner lookup and one atomic RPC to the same client',
      async () => {
        const material =
          await createTrustedDeliveryRepositoryMaterial()
        const events: string[] = []
        let adminClientFactoryCalls = 0
        let ownerQueryExecutions = 0
        let rpcCalls = 0
        const adminClient = {
          from(tableName: string) {
            events.push(`from:${tableName}`)
            assert.equal(tableName, 'ai_chart_reports')
            return {
              select(columns: string) {
                events.push(`select:${columns}`)
                assert.equal(columns, 'id,user_id')
                return {
                  eq(column: string, value: string) {
                    events.push(`eq:${column}`)
                    assert.equal(column, 'id')
                    assert.equal(value, REPORT_ID)
                    return {
                      retry(enabled: boolean) {
                        events.push(`retry:${enabled}`)
                        assert.equal(enabled, false)
                        return {
                          async maybeSingle() {
                            ownerQueryExecutions += 1
                            events.push('owner:response')
                            return {
                              data: {
                                id: REPORT_ID,
                                user_id: OWNER_ID,
                              },
                              error: null,
                              count: null,
                              status: 200,
                              statusText: 'OK',
                            }
                          },
                        }
                      },
                    }
                  },
                }
              },
            }
          },
          async rpc(
            functionName: string,
            command:
              import(
                './d1PalaceWritingTrustedDeliveryRepositoryAdapter.server'
              ).AiChartD1PalaceWritingAtomicDeliveryRpcCommand,
          ) {
            rpcCalls += 1
            events.push(`rpc:${functionName}`)
            assert.equal(
              functionName,
              'deliver_ai_chart_report_after_review',
            )
            assert.equal(
              command.p_expected_owner_user_id,
              OWNER_ID,
            )
            return {
              data: [
                {
                  result_code: 'PUBLISHED',
                  ledger_receipt_fingerprint:
                    command.p_ledger_receipt_fingerprint,
                  delivery_claim_fingerprint:
                    command.p_delivery_claim_fingerprint,
                  delivery_receipt_fingerprint:
                    command.p_delivery_receipt_fingerprint,
                  report_content_sha256:
                    command.p_report_content_sha256,
                },
              ],
              error: null,
              count: null,
              status: 200,
              statusText: 'OK',
            }
          },
        }
        const repositoryBundle =
          trustedDeliverySupabaseAdminClientFactoryModule
            .createAiChartD1PalaceWritingTrustedDeliverySupabaseAdminClientRepositoryBundle(
              {
                getSupabaseAdmin: () => {
                  adminClientFactoryCalls += 1
                  return adminClient
                },
              },
            )

        const result =
          await trustedDeliveryRepositoryAdapterModule
            .executeAiChartD1PalaceWritingTrustedDeliveryRepositoryAdapter(
              material,
              repositoryBundle,
            )

        assert.deepEqual(
          Object.keys(repositoryBundle),
          [
            'lookupExpectedOwner',
            'invokeAtomicDeliveryRpc',
          ],
        )
        assert.equal(Object.isFrozen(repositoryBundle), true)
        assert.equal(
          Object.isFrozen(
            repositoryBundle.lookupExpectedOwner,
          ),
          true,
        )
        assert.equal(
          Object.isFrozen(
            repositoryBundle.invokeAtomicDeliveryRpc,
          ),
          true,
        )
        assert.equal(adminClientFactoryCalls, 1)
        assert.equal(ownerQueryExecutions, 1)
        assert.equal(rpcCalls, 1)
        assert.deepEqual(events, [
          'from:ai_chart_reports',
          'select:id,user_id',
          'eq:id',
          'retry:false',
          'owner:response',
          'rpc:deliver_ai_chart_report_after_review',
        ])
        assert.equal(result.rpcResultCode, 'PUBLISHED')
        assert.equal(result.ownerLookups, 1)
        assert.equal(result.atomicRpcCalls, 1)
        assert.equal(
          result.automaticRetryPerformed,
          false,
        )
        assert.equal(result.productionCallable, false)
        assert.equal(
          result.customerDeliveryAllowed,
          false,
        )
      },
    )

    await check(
      'trusted delivery Production binding checks Migration and runtime activation before the existing admin client binding',
      async () => {
        const events: string[] = []
        let ownerQueries = 0
        let rpcCalls = 0
        const prepared =
          await trustedDeliveryProductionBindingReadinessModule
            .prepareAiChartD1PalaceWritingTrustedDeliveryProductionBindingReadiness(
              {
                verifyMigrationReadiness:
                  async (command) => {
                    events.push('migration-readiness')
                    assert.deepEqual(command, {
                      bindingMode:
                        'INJECTED_PRODUCTION_BINDING_READINESS_PROBE_ONLY',
                      migrationVersion:
                        '20260728120000',
                      migrationPath:
                        'supabase/migrations/20260728120000_ai_chart_report_trusted_delivery_contracts.sql',
                      migrationSha256:
                        '8d310b1ef2750afbd41da00e04e0a10b6198fd2f894d07d09f11b5dfc7df3e66',
                      requiredRpcName:
                        'deliver_ai_chart_report_after_review',
                    })
                    assert.equal(
                      recursivelyFrozen(command),
                      true,
                    )
                    return Object.freeze({
                      bindingMode:
                        command.bindingMode,
                      readinessStatus: 'READY',
                      migrationVersion:
                        command.migrationVersion,
                      migrationSha256:
                        command.migrationSha256,
                      requiredRpcName:
                        command.requiredRpcName,
                      schemaContractStatus:
                        'VERIFIED',
                      rpcExecuteGrantStatus:
                        'SERVICE_ROLE_ONLY_VERIFIED',
                    })
                  },
                verifyRuntimeActivation:
                  async (command) => {
                    events.push('runtime-activation')
                    assert.deepEqual(
                      Object.keys(command),
                      [
                        'bindingMode',
                        'feature',
                        'migrationVersion',
                        'migrationSha256',
                        'migrationReadinessFingerprint',
                      ],
                    )
                    assert.equal(
                      command.bindingMode,
                      'INJECTED_RUNTIME_ACTIVATION_GATE_PROBE_ONLY',
                    )
                    assert.equal(
                      command.feature,
                      'D1_PALACE_WRITING_TRUSTED_DELIVERY',
                    )
                    assert.match(
                      command.migrationReadinessFingerprint,
                      /^[a-f0-9]{64}$/u,
                    )
                    assert.equal(
                      recursivelyFrozen(command),
                      true,
                    )
                    return Object.freeze({
                      bindingMode:
                        command.bindingMode,
                      activationStatus: 'ACTIVE',
                      feature: command.feature,
                      migrationReadinessFingerprint:
                        command.migrationReadinessFingerprint,
                    })
                  },
                getSupabaseAdmin: () => {
                  events.push('get-supabase-admin')
                  return {
                    from: () => ({
                      select: () => ({
                        eq: () => ({
                          retry: (enabled: boolean) => {
                            assert.equal(enabled, false)
                            return {
                              maybeSingle: async () => {
                                ownerQueries += 1
                                events.push('owner-query')
                                return {
                                  data: {
                                    id: REPORT_ID,
                                    user_id: OWNER_ID,
                                  },
                                  error: null,
                                  count: null,
                                  status: 200,
                                  statusText: 'OK',
                                }
                              },
                            }
                          },
                        }),
                      }),
                    }),
                    rpc: async (
                      _functionName: string,
                      command:
                        import(
                          './d1PalaceWritingTrustedDeliveryRepositoryAdapter.server'
                        ).AiChartD1PalaceWritingAtomicDeliveryRpcCommand,
                    ) => {
                      rpcCalls += 1
                      events.push('atomic-rpc')
                      return {
                        data: [
                          {
                            result_code: 'PUBLISHED',
                            ledger_receipt_fingerprint:
                              command.p_ledger_receipt_fingerprint,
                            delivery_claim_fingerprint:
                              command.p_delivery_claim_fingerprint,
                            delivery_receipt_fingerprint:
                              command.p_delivery_receipt_fingerprint,
                            report_content_sha256:
                              command.p_report_content_sha256,
                          },
                        ],
                        error: null,
                        count: null,
                        status: 200,
                        statusText: 'OK',
                      }
                    },
                  }
                },
              },
            )

        assert.deepEqual(events, [
          'migration-readiness',
          'runtime-activation',
          'get-supabase-admin',
        ])
        assert.equal(
          prepared.bindingStatus,
          'TEST_ONLY_ORDER_VERIFIED',
        )
        assert.deepEqual(prepared.dependencyOrder, [
          'VERIFY_MIGRATION_READINESS',
          'VERIFY_RUNTIME_ACTIVATION',
          'BIND_EXISTING_GET_SUPABASE_ADMIN',
        ])
        assert.equal(
          prepared.migrationReadinessStatus,
          'VERIFIED',
        )
        assert.equal(
          prepared.runtimeActivationStatus,
          'VERIFIED',
        )
        assert.equal(
          prepared.adminClientBindingStatus,
          'BOUND_TO_INJECTED_EXISTING_GET_SUPABASE_ADMIN',
        )
        assert.equal(prepared.productionCallable, false)
        assert.equal(
          prepared.customerDeliveryAllowed,
          false,
        )
        assert.equal(prepared.databaseConnections, 0)
        assert.equal(prepared.reportMutations, 0)
        assert.equal(prepared.openAiRequests, 0)
        assert.equal(recursivelyFrozen(prepared), true)

        const result =
          await trustedDeliveryRepositoryAdapterModule
            .executeAiChartD1PalaceWritingTrustedDeliveryRepositoryAdapter(
              await createTrustedDeliveryRepositoryMaterial(),
              prepared.repositoryBundle,
            )

        assert.deepEqual(events, [
          'migration-readiness',
          'runtime-activation',
          'get-supabase-admin',
          'owner-query',
          'atomic-rpc',
        ])
        assert.equal(ownerQueries, 1)
        assert.equal(rpcCalls, 1)
        assert.equal(result.rpcResultCode, 'PUBLISHED')
      },
    )

    await check(
      'trusted delivery Production binding stops at Migration readiness without activating runtime or creating a client',
      async () => {
        for (const testCase of [
          {
            expectedCode:
              'MIGRATION_READINESS_CHECK_FAILED',
            migrationOutcome:
              'throw' as const,
          },
          {
            expectedCode: 'MIGRATION_NOT_READY',
            migrationOutcome:
              'not-ready' as const,
          },
          {
            expectedCode:
              'MIGRATION_READINESS_RESPONSE_INVALID',
            migrationOutcome:
              'malformed' as const,
          },
        ] as const) {
          let migrationChecks = 0
          let activationChecks = 0
          let adminClientBindings = 0

          await assert.rejects(
            trustedDeliveryProductionBindingReadinessModule
              .prepareAiChartD1PalaceWritingTrustedDeliveryProductionBindingReadiness(
                {
                  verifyMigrationReadiness:
                    async (command) => {
                      migrationChecks += 1
                      if (
                        testCase.migrationOutcome ===
                        'throw'
                      ) {
                        throw new Error(
                          SENSITIVE_MARKER,
                        )
                      }
                      if (
                        testCase.migrationOutcome ===
                        'malformed'
                      ) {
                        return {
                          bindingMode:
                            command.bindingMode,
                          readinessStatus: 'READY',
                          migrationVersion:
                            command.migrationVersion,
                          migrationSha256:
                            command.migrationSha256,
                          requiredRpcName:
                            command.requiredRpcName,
                          schemaContractStatus:
                            'VERIFIED',
                          rpcExecuteGrantStatus:
                            'SERVICE_ROLE_ONLY_VERIFIED',
                          providerPayload:
                            SENSITIVE_MARKER,
                        }
                      }
                      return {
                        bindingMode:
                          command.bindingMode,
                        readinessStatus:
                          'NOT_READY',
                        migrationVersion:
                          command.migrationVersion,
                        migrationSha256:
                          command.migrationSha256,
                        requiredRpcName:
                          command.requiredRpcName,
                        schemaContractStatus:
                          'NOT_VERIFIED',
                        rpcExecuteGrantStatus:
                          'NOT_VERIFIED',
                      }
                    },
                  verifyRuntimeActivation:
                    async () => {
                      activationChecks += 1
                      return {}
                    },
                  getSupabaseAdmin: () => {
                    adminClientBindings += 1
                    return {}
                  },
                },
              ),
            (error: unknown) => {
              assert.equal(
                error instanceof
                  trustedDeliveryProductionBindingReadinessModule.AiChartD1PalaceWritingTrustedDeliveryProductionBindingReadinessError,
                true,
              )
              assert.equal(
                (
                  error as InstanceType<
                    typeof trustedDeliveryProductionBindingReadinessModule.AiChartD1PalaceWritingTrustedDeliveryProductionBindingReadinessError
                  >
                ).code,
                testCase.expectedCode,
              )
              assert.equal(Object.isFrozen(error), true)
              assert.equal(
                JSON.stringify(error).includes(
                  SENSITIVE_MARKER,
                ),
                false,
              )
              return true
            },
          )

          assert.equal(migrationChecks, 1)
          assert.equal(activationChecks, 0)
          assert.equal(adminClientBindings, 0)
        }
      },
    )

    await check(
      'trusted delivery Production binding stops at runtime activation before creating the admin client',
      async () => {
        for (const testCase of [
          {
            expectedCode:
              'RUNTIME_ACTIVATION_CHECK_FAILED',
            activationOutcome: 'throw' as const,
          },
          {
            expectedCode: 'RUNTIME_NOT_ACTIVE',
            activationOutcome:
              'inactive' as const,
          },
          {
            expectedCode:
              'RUNTIME_ACTIVATION_RESPONSE_INVALID',
            activationOutcome:
              'malformed' as const,
          },
        ] as const) {
          let migrationChecks = 0
          let activationChecks = 0
          let adminClientBindings = 0

          await assert.rejects(
            trustedDeliveryProductionBindingReadinessModule
              .prepareAiChartD1PalaceWritingTrustedDeliveryProductionBindingReadiness(
                {
                  verifyMigrationReadiness:
                    async (command) => {
                      migrationChecks += 1
                      return {
                        bindingMode:
                          command.bindingMode,
                        readinessStatus: 'READY',
                        migrationVersion:
                          command.migrationVersion,
                        migrationSha256:
                          command.migrationSha256,
                        requiredRpcName:
                          command.requiredRpcName,
                        schemaContractStatus:
                          'VERIFIED',
                        rpcExecuteGrantStatus:
                          'SERVICE_ROLE_ONLY_VERIFIED',
                      }
                    },
                  verifyRuntimeActivation:
                    async (command) => {
                      activationChecks += 1
                      if (
                        testCase.activationOutcome ===
                        'throw'
                      ) {
                        throw new Error(
                          SENSITIVE_MARKER,
                        )
                      }
                      if (
                        testCase.activationOutcome ===
                        'malformed'
                      ) {
                        return {
                          bindingMode:
                            command.bindingMode,
                          activationStatus:
                            'ACTIVE',
                          feature:
                            command.feature,
                          migrationReadinessFingerprint:
                            command.migrationReadinessFingerprint,
                          providerMessage:
                            SENSITIVE_MARKER,
                        }
                      }
                      return {
                        bindingMode:
                          command.bindingMode,
                        activationStatus:
                          'INACTIVE',
                        feature: command.feature,
                        migrationReadinessFingerprint:
                          command.migrationReadinessFingerprint,
                      }
                    },
                  getSupabaseAdmin: () => {
                    adminClientBindings += 1
                    return {}
                  },
                },
              ),
            (error: unknown) => {
              assert.equal(
                (
                  error as InstanceType<
                    typeof trustedDeliveryProductionBindingReadinessModule.AiChartD1PalaceWritingTrustedDeliveryProductionBindingReadinessError
                  >
                ).code,
                testCase.expectedCode,
              )
              assert.equal(Object.isFrozen(error), true)
              assert.equal(
                JSON.stringify(error).includes(
                  SENSITIVE_MARKER,
                ),
                false,
              )
              return true
            },
          )

          assert.equal(migrationChecks, 1)
          assert.equal(activationChecks, 1)
          assert.equal(adminClientBindings, 0)
        }
      },
    )

    await check(
      'trusted delivery Production binding rejects unsafe dependencies, Production, and admin client failures without retry',
      async () => {
        let migrationChecks = 0
        let activationChecks = 0
        let adminClientBindings = 0
        const dependencies = {
          verifyMigrationReadiness:
            async (
              command:
                import(
                  './d1PalaceWritingTrustedDeliveryProductionBindingReadiness.server'
                ).AiChartD1PalaceWritingTrustedDeliveryMigrationReadinessCommand,
            ) => {
              migrationChecks += 1
              return {
                bindingMode: command.bindingMode,
                readinessStatus: 'READY',
                migrationVersion:
                  command.migrationVersion,
                migrationSha256:
                  command.migrationSha256,
                requiredRpcName:
                  command.requiredRpcName,
                schemaContractStatus: 'VERIFIED',
                rpcExecuteGrantStatus:
                  'SERVICE_ROLE_ONLY_VERIFIED',
              }
            },
          verifyRuntimeActivation:
            async (
              command:
                import(
                  './d1PalaceWritingTrustedDeliveryProductionBindingReadiness.server'
                ).AiChartD1PalaceWritingTrustedDeliveryRuntimeActivationCommand,
            ) => {
              activationChecks += 1
              return {
                bindingMode: command.bindingMode,
                activationStatus: 'ACTIVE',
                feature: command.feature,
                migrationReadinessFingerprint:
                  command.migrationReadinessFingerprint,
              }
            },
          getSupabaseAdmin: () => {
            adminClientBindings += 1
            throw new Error(SENSITIVE_MARKER)
          },
        }

        await assert.rejects(
          trustedDeliveryProductionBindingReadinessModule
            .prepareAiChartD1PalaceWritingTrustedDeliveryProductionBindingReadiness(
              dependencies,
            ),
          (error: unknown) => {
            assert.equal(
              (
                error as InstanceType<
                  typeof trustedDeliveryProductionBindingReadinessModule.AiChartD1PalaceWritingTrustedDeliveryProductionBindingReadinessError
                >
              ).code,
              'ADMIN_CLIENT_BINDING_FAILED',
            )
            assert.equal(
              JSON.stringify(error).includes(
                SENSITIVE_MARKER,
              ),
              false,
            )
            return true
          },
        )
        assert.equal(migrationChecks, 1)
        assert.equal(activationChecks, 1)
        assert.equal(adminClientBindings, 1)

        await assert.rejects(
          trustedDeliveryProductionBindingReadinessModule
            .prepareAiChartD1PalaceWritingTrustedDeliveryProductionBindingReadiness(
              {
                ...dependencies,
                callerSelectedOwner: OWNER_ID,
              } as unknown as typeof dependencies,
            ),
          (error: unknown) => {
            assert.equal(
              (
                error as InstanceType<
                  typeof trustedDeliveryProductionBindingReadinessModule.AiChartD1PalaceWritingTrustedDeliveryProductionBindingReadinessError
                >
              ).code,
              'PRODUCTION_BINDING_READINESS_UNAVAILABLE',
            )
            return true
          },
        )
        assert.equal(migrationChecks, 1)
        assert.equal(activationChecks, 1)
        assert.equal(adminClientBindings, 1)

        mutableEnvironment.NODE_ENV = 'production'
        try {
          await assert.rejects(
            trustedDeliveryProductionBindingReadinessModule
              .prepareAiChartD1PalaceWritingTrustedDeliveryProductionBindingReadiness(
                dependencies,
              ),
            (error: unknown) => {
              assert.equal(
                (
                  error as InstanceType<
                    typeof trustedDeliveryProductionBindingReadinessModule.AiChartD1PalaceWritingTrustedDeliveryProductionBindingReadinessError
                  >
                ).code,
                'PRODUCTION_BINDING_READINESS_UNAVAILABLE',
              )
              return true
            },
          )
        } finally {
          mutableEnvironment.NODE_ENV = 'test'
        }
        assert.equal(migrationChecks, 1)
        assert.equal(activationChecks, 1)
        assert.equal(adminClientBindings, 1)
      },
    )

    await check(
      'trusted delivery Production binding locks the tracked Migration SHA and imports the existing admin binding only as a type',
      async () => {
        const migrationSource = await readFile(
          join(
            process.cwd(),
            trustedDeliveryProductionBindingReadinessModule
              .AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_PATH,
          ),
        )
        assert.equal(
          createHash('sha256')
            .update(migrationSource)
            .digest('hex'),
          trustedDeliveryProductionBindingReadinessModule
            .AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_MIGRATION_SHA256,
        )

        const bindingSource = await readFile(
          join(
            process.cwd(),
            'src/lib/ai-chart/d1PalaceWritingTrustedDeliveryProductionBindingReadiness.server.ts',
          ),
          'utf8',
        )
        assert.equal(
          bindingSource.startsWith(
            "import 'server-only'\n",
          ),
          true,
        )
        assert.match(
          bindingSource,
          /import type \{\s*getSupabaseAdmin as getExistingSupabaseAdmin,\s*\} from '\.\.\/supabase\/admin'/u,
        )
        assert.doesNotMatch(
          bindingSource,
          /import \{\s*getSupabaseAdmin/u,
        )
        assert.doesNotMatch(
          bindingSource,
          /process\.env\.(?:NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)/u,
        )
      },
    )

    await check(
      'controlled deployment attestation is consumed once while the module-owned runtime policy keeps admin binding blocked',
      async () => {
        const events: string[] = []
        let attestationChecks = 0
        let adminClientBindings = 0
        const runtimeActivationAuthorizationHandoff =
          await prepareTrustedDeliveryRuntimeAuthorizationHandoff()
        const adapters =
          trustedDeliveryProductionReadinessAdaptersModule
            .createAiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapters(
              {
                verifyControlledDeploymentMigrationAttestation:
                  async (command) => {
                    attestationChecks += 1
                    events.push(
                      'controlled-deployment-attestation',
                    )
                    assert.deepEqual(command, {
                      bindingMode:
                        'INJECTED_CONTROLLED_DEPLOYMENT_ATTESTATION_PROBE_ONLY',
                      attestationSource:
                        'APPROVED_PSQL_EXACT_FILE_RUNNER',
                      migrationVersion:
                        '20260728120000',
                      migrationPath:
                        'supabase/migrations/20260728120000_ai_chart_report_trusted_delivery_contracts.sql',
                      migrationSha256:
                        '8d310b1ef2750afbd41da00e04e0a10b6198fd2f894d07d09f11b5dfc7df3e66',
                      requiredRpcName:
                        'deliver_ai_chart_report_after_review',
                      requiredChecks: [
                        'SOURCE_VALIDATION',
                        'PREFLIGHT',
                        'MIGRATION',
                        'POSTFLIGHT',
                      ],
                    })
                    assert.equal(
                      recursivelyFrozen(command),
                      true,
                    )
                    return Object.freeze({
                      bindingMode:
                        command.bindingMode,
                      attestationStatus:
                        'VERIFIED',
                      attestationSource:
                        command.attestationSource,
                      sourceCommitSha:
                        '0123456789abcdef0123456789abcdef01234567',
                      migrationVersion:
                        command.migrationVersion,
                      migrationPath:
                        command.migrationPath,
                      migrationSha256:
                        command.migrationSha256,
                      requiredRpcName:
                        command.requiredRpcName,
                      sourceValidationStatus:
                        'PASSED',
                      preflightStatus: 'PASSED',
                      migrationApplyStatus:
                        'APPLIED',
                      postflightStatus: 'PASSED',
                      schemaContractStatus:
                        'VERIFIED',
                      rpcExecuteGrantStatus:
                        'SERVICE_ROLE_ONLY_VERIFIED',
                    })
                  },
                runtimeActivationAuthorizationHandoff,
              },
            )

        assert.equal(
          adapters.bindingStatus,
          'OFFLINE_ATTESTATION_AND_RELEASE_AUTHORIZATION_BOUND_RUNTIME_BLOCKED',
        )
        assert.equal(
          adapters.runtimeActivationPolicyStatus,
          'BLOCKED_PENDING_EXPLICIT_PRODUCTION_AUTHORIZATION',
        )
        assert.equal(adapters.productionCallable, false)
        assert.equal(
          adapters.customerDeliveryAllowed,
          false,
        )
        assert.equal(adapters.databaseConnections, 0)
        assert.equal(adapters.reportMutations, 0)
        assert.equal(adapters.openAiRequests, 0)
        assert.equal(recursivelyFrozen(adapters), true)

        await assert.rejects(
          trustedDeliveryProductionBindingReadinessModule
            .prepareAiChartD1PalaceWritingTrustedDeliveryProductionBindingReadiness(
              {
                verifyMigrationReadiness:
                  adapters.verifyMigrationReadiness,
                verifyRuntimeActivation:
                  adapters.verifyRuntimeActivation,
                getSupabaseAdmin: () => {
                  adminClientBindings += 1
                  return {}
                },
              },
            ),
          (error: unknown) => {
            assert.equal(
              (
                error as InstanceType<
                  typeof trustedDeliveryProductionBindingReadinessModule.AiChartD1PalaceWritingTrustedDeliveryProductionBindingReadinessError
                >
              ).code,
              'RUNTIME_NOT_ACTIVE',
            )
            return true
          },
        )

        assert.deepEqual(events, [
          'controlled-deployment-attestation',
        ])
        assert.equal(attestationChecks, 1)
        assert.equal(adminClientBindings, 0)
      },
    )

    await check(
      'deployment attestation failures remain fixed, single-use, and free of provider diagnostics',
      async () => {
        const migrationCommand =
          Object.freeze({
            bindingMode:
              'INJECTED_PRODUCTION_BINDING_READINESS_PROBE_ONLY' as const,
            migrationVersion:
              '20260728120000' as const,
            migrationPath:
              'supabase/migrations/20260728120000_ai_chart_report_trusted_delivery_contracts.sql' as const,
            migrationSha256:
              '8d310b1ef2750afbd41da00e04e0a10b6198fd2f894d07d09f11b5dfc7df3e66' as const,
            requiredRpcName:
              'deliver_ai_chart_report_after_review' as const,
          })

        for (const testCase of [
          {
            expectedCode:
              'DEPLOYMENT_ATTESTATION_CHECK_FAILED',
            outcome: 'throw' as const,
          },
          {
            expectedCode:
              'DEPLOYMENT_ATTESTATION_NOT_VERIFIED',
            outcome: 'not-verified' as const,
          },
          {
            expectedCode:
              'DEPLOYMENT_ATTESTATION_RESPONSE_INVALID',
            outcome: 'malformed' as const,
          },
          {
            expectedCode:
              'DEPLOYMENT_ATTESTATION_RESPONSE_INVALID',
            outcome: 'invalid-commit' as const,
          },
        ] as const) {
          let attestationChecks = 0
          const runtimeActivationAuthorizationHandoff =
            await prepareTrustedDeliveryRuntimeAuthorizationHandoff()
          const adapters =
            trustedDeliveryProductionReadinessAdaptersModule
              .createAiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapters(
                {
                  verifyControlledDeploymentMigrationAttestation:
                    async (command) => {
                      attestationChecks += 1
                      if (testCase.outcome === 'throw') {
                        throw new Error(SENSITIVE_MARKER)
                      }
                      const response = {
                        bindingMode:
                          command.bindingMode,
                        attestationStatus:
                          testCase.outcome ===
                          'not-verified'
                            ? 'NOT_VERIFIED'
                            : 'VERIFIED',
                        attestationSource:
                          command.attestationSource,
                        sourceCommitSha:
                          testCase.outcome ===
                          'invalid-commit'
                            ? SENSITIVE_MARKER
                            : '0123456789abcdef0123456789abcdef01234567',
                        migrationVersion:
                          command.migrationVersion,
                        migrationPath:
                          command.migrationPath,
                        migrationSha256:
                          command.migrationSha256,
                        requiredRpcName:
                          command.requiredRpcName,
                        sourceValidationStatus:
                          testCase.outcome ===
                          'not-verified'
                            ? 'FAILED'
                            : 'PASSED',
                        preflightStatus: 'PASSED',
                        migrationApplyStatus:
                          'APPLIED',
                        postflightStatus: 'PASSED',
                        schemaContractStatus:
                          'VERIFIED',
                        rpcExecuteGrantStatus:
                          'SERVICE_ROLE_ONLY_VERIFIED',
                      }
                      if (
                        testCase.outcome ===
                        'malformed'
                      ) {
                        return {
                          ...response,
                          providerMessage:
                            SENSITIVE_MARKER,
                        }
                      }
                      return response
                    },
                  runtimeActivationAuthorizationHandoff,
                },
              )

          await assert.rejects(
            adapters.verifyMigrationReadiness(
              migrationCommand,
            ),
            (error: unknown) => {
              assert.equal(
                error instanceof
                  trustedDeliveryProductionReadinessAdaptersModule.AiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapterError,
                true,
              )
              assert.equal(
                (
                  error as InstanceType<
                    typeof trustedDeliveryProductionReadinessAdaptersModule.AiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapterError
                  >
                ).code,
                testCase.expectedCode,
              )
              assert.equal(Object.isFrozen(error), true)
              assert.equal(
                JSON.stringify(error).includes(
                  SENSITIVE_MARKER,
                ),
                false,
              )
              return true
            },
          )
          assert.equal(attestationChecks, 1)

          await assert.rejects(
            adapters.verifyMigrationReadiness(
              migrationCommand,
            ),
            (error: unknown) => {
              assert.equal(
                (
                  error as InstanceType<
                    typeof trustedDeliveryProductionReadinessAdaptersModule.AiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapterError
                  >
                ).code,
                'DEPLOYMENT_ATTESTATION_ALREADY_CONSUMED',
              )
              return true
            },
          )
          assert.equal(attestationChecks, 1)
        }
      },
    )

    await check(
      'readiness adapters reject caller activation controls and Production before any attestation check',
      async () => {
        let attestationChecks = 0
        const runtimeActivationAuthorizationHandoff =
          await prepareTrustedDeliveryRuntimeAuthorizationHandoff()
        const dependencies = {
          verifyControlledDeploymentMigrationAttestation:
            async () => {
              attestationChecks += 1
              return {}
            },
          runtimeActivationAuthorizationHandoff,
        }

        assert.throws(
          () =>
            trustedDeliveryProductionReadinessAdaptersModule
              .createAiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapters(
                {
                  ...dependencies,
                  callerEnabled: true,
                } as unknown as typeof dependencies,
              ),
          (error: unknown) => {
            assert.equal(
              (
                error as InstanceType<
                  typeof trustedDeliveryProductionReadinessAdaptersModule.AiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapterError
                >
              ).code,
              'PRODUCTION_READINESS_ADAPTERS_UNAVAILABLE',
            )
            return true
          },
        )
        assert.equal(attestationChecks, 0)

        mutableEnvironment.NODE_ENV = 'production'
        try {
          assert.throws(
            () =>
              trustedDeliveryProductionReadinessAdaptersModule
                .createAiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapters(
                  dependencies,
                ),
            (error: unknown) => {
              assert.equal(
                (
                  error as InstanceType<
                    typeof trustedDeliveryProductionReadinessAdaptersModule.AiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapterError
                  >
                ).code,
                'PRODUCTION_READINESS_ADAPTERS_UNAVAILABLE',
              )
              return true
            },
          )
        } finally {
          mutableEnvironment.NODE_ENV = 'test'
        }
        assert.equal(attestationChecks, 0)

        const policy =
          trustedDeliveryProductionReadinessAdaptersModule
            .AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_RUNTIME_ACTIVATION_POLICY
        assert.equal(
          policy.activationStatus,
          'BLOCKED_PENDING_EXPLICIT_PRODUCTION_AUTHORIZATION',
        )
        assert.equal(
          policy.activationSource,
          'MODULE_OWNED_STATIC_POLICY',
        )
        assert.equal(
          policy.callerOverrideAllowed,
          false,
        )
        assert.equal(
          policy.environmentOverrideAllowed,
          false,
        )
        assert.equal(recursivelyFrozen(policy), true)

        const adapters =
          trustedDeliveryProductionReadinessAdaptersModule
            .createAiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapters(
              dependencies,
            )
        const activationCommand =
          Object.freeze({
            bindingMode:
              'INJECTED_RUNTIME_ACTIVATION_GATE_PROBE_ONLY' as const,
            feature:
              'D1_PALACE_WRITING_TRUSTED_DELIVERY' as const,
            migrationVersion:
              '20260728120000' as const,
            migrationSha256:
              '8d310b1ef2750afbd41da00e04e0a10b6198fd2f894d07d09f11b5dfc7df3e66' as const,
            migrationReadinessFingerprint:
              '0'.repeat(64),
          })
        await assert.rejects(
          adapters.verifyRuntimeActivation(
            activationCommand,
          ),
          (error: unknown) => {
            assert.equal(
              (
                error as InstanceType<
                  typeof trustedDeliveryProductionReadinessAdaptersModule.AiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapterError
                >
              ).code,
              'RUNTIME_ACTIVATION_SEQUENCE_INVALID',
            )
            return true
          },
        )
        await assert.rejects(
          adapters.verifyRuntimeActivation(
            activationCommand,
          ),
          (error: unknown) => {
            assert.equal(
              (
                error as InstanceType<
                  typeof trustedDeliveryProductionReadinessAdaptersModule.AiChartD1PalaceWritingTrustedDeliveryProductionReadinessAdapterError
                >
              ).code,
              'RUNTIME_ACTIVATION_ALREADY_CONSUMED',
            )
            return true
          },
        )
        assert.equal(attestationChecks, 0)

        const source = await readFile(
          join(
            process.cwd(),
            'src/lib/ai-chart/d1PalaceWritingTrustedDeliveryProductionReadinessAdapters.server.ts',
          ),
          'utf8',
        )
        assert.equal(
          source.startsWith(
            "import 'server-only'\n",
          ),
          true,
        )
        assert.doesNotMatch(
          source,
          /(?:OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_URL|createClient\(|getSupabaseAdmin|fetch\()/u,
        )
      },
    )

    await check(
      'trusted delivery Supabase admin client factory stops unsafe owner outcomes before the atomic RPC',
      async () => {
        for (const ownerOutcome of [
          {
            data: null,
            error: {
              code: '42501',
              details: SENSITIVE_MARKER,
              hint: SENSITIVE_MARKER,
              message: SENSITIVE_MARKER,
            },
            count: null,
            status: 403,
            statusText: 'Forbidden',
          },
          {
            data: null,
            error: null,
            count: null,
            status: 200,
            statusText: 'OK',
          },
          {
            data: {
              id: REPORT_ID,
              user_id: OWNER_ID,
              providerPayload: SENSITIVE_MARKER,
            },
            error: null,
            count: null,
            status: 200,
            statusText: 'OK',
          },
          {
            data: {
              id: '9ea11aef-5e35-43bd-a413-e7888c3c1d9f',
              user_id: OWNER_ID,
            },
            error: null,
            count: null,
            status: 200,
            statusText: 'OK',
          },
        ] as const) {
          const material =
            await createTrustedDeliveryRepositoryMaterial()
          let ownerQueryExecutions = 0
          let rpcCalls = 0
          const repositoryBundle =
            trustedDeliverySupabaseAdminClientFactoryModule
              .createAiChartD1PalaceWritingTrustedDeliverySupabaseAdminClientRepositoryBundle(
                {
                  getSupabaseAdmin: () => ({
                    from: () => ({
                      select: () => ({
                        eq: () => ({
                          retry: (enabled: boolean) => {
                            assert.equal(enabled, false)
                            return {
                              maybeSingle: async () => {
                                ownerQueryExecutions += 1
                                return ownerOutcome
                              },
                            }
                          },
                        }),
                      }),
                    }),
                    rpc: async () => {
                      rpcCalls += 1
                      return {}
                    },
                  }),
                },
              )

          await assert.rejects(
            trustedDeliveryRepositoryAdapterModule
              .executeAiChartD1PalaceWritingTrustedDeliveryRepositoryAdapter(
                material,
                repositoryBundle,
              ),
            (error: unknown) => {
              assert.equal(
                (
                  error as InstanceType<
                    typeof trustedDeliveryRepositoryAdapterModule.AiChartD1PalaceWritingTrustedDeliveryRepositoryAdapterError
                  >
                ).code,
                'REPORT_OWNER_LOOKUP_FAILED',
              )
              const serialized = JSON.stringify(error)
              assert.equal(
                serialized.includes(SENSITIVE_MARKER),
                false,
              )
              assert.equal(
                serialized.includes(OWNER_ID),
                false,
              )
              assert.equal(
                serialized.includes('providerPayload'),
                false,
              )
              return true
            },
          )
          assert.equal(ownerQueryExecutions, 1)
          assert.equal(rpcCalls, 0)
        }

        const material =
          await createTrustedDeliveryRepositoryMaterial()
        let transportQueries = 0
        let transportRpcCalls = 0
        const transportBundle =
          trustedDeliverySupabaseAdminClientFactoryModule
            .createAiChartD1PalaceWritingTrustedDeliverySupabaseAdminClientRepositoryBundle(
              {
                getSupabaseAdmin: () => ({
                  from: () => ({
                    select: () => ({
                      eq: () => ({
                        retry: (enabled: boolean) => {
                          assert.equal(enabled, false)
                          return {
                            maybeSingle: async () => {
                              transportQueries += 1
                              throw new Error(
                                SENSITIVE_MARKER,
                              )
                            },
                          }
                        },
                      }),
                    }),
                  }),
                  rpc: async () => {
                    transportRpcCalls += 1
                    return {}
                  },
                }),
              },
            )
        await assert.rejects(
          trustedDeliveryRepositoryAdapterModule
            .executeAiChartD1PalaceWritingTrustedDeliveryRepositoryAdapter(
              material,
              transportBundle,
            ),
          (error: unknown) => {
            assert.equal(
              (
                error as InstanceType<
                  typeof trustedDeliveryRepositoryAdapterModule.AiChartD1PalaceWritingTrustedDeliveryRepositoryAdapterError
                >
              ).code,
              'REPORT_OWNER_LOOKUP_FAILED',
            )
            assert.equal(
              JSON.stringify(error).includes(
                SENSITIVE_MARKER,
              ),
              false,
            )
            return true
          },
        )
        assert.equal(transportQueries, 1)
        assert.equal(transportRpcCalls, 0)
      },
    )

    await check(
      'trusted delivery Supabase admin client factory rejects forged owner commands and Production before client creation',
      async () => {
        let clientFactoryCalls = 0
        let fromCalls = 0
        let rpcCalls = 0
        const dependencies = {
          getSupabaseAdmin: () => {
            clientFactoryCalls += 1
            return {
              from: () => {
                fromCalls += 1
                return {
                  select: () => ({
                    eq: () => ({
                      retry: (enabled: boolean) => {
                        assert.equal(enabled, false)
                        return {
                          maybeSingle: async () => ({
                            data: {
                              id: REPORT_ID,
                              user_id: OWNER_ID,
                            },
                            error: null,
                            count: null,
                            status: 200,
                            statusText: 'OK',
                          }),
                        }
                      },
                    }),
                  }),
                }
              },
              rpc: async () => {
                rpcCalls += 1
                return {}
              },
            }
          },
        }
        const repositoryBundle =
          trustedDeliverySupabaseAdminClientFactoryModule
            .createAiChartD1PalaceWritingTrustedDeliverySupabaseAdminClientRepositoryBundle(
              dependencies,
            )
        assert.equal(clientFactoryCalls, 1)

        await assert.rejects(
          repositoryBundle.lookupExpectedOwner(
            Object.freeze({
              adapterMode:
                'INJECTED_OFFLINE_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_ONLY',
              reportId: REPORT_ID,
              ownerUserId: OWNER_ID,
            }) as unknown as
              import(
                './d1PalaceWritingTrustedDeliveryRepositoryAdapter.server'
              ).AiChartD1PalaceWritingExpectedOwnerLookupCommand,
          ),
          (error: unknown) => {
            assert.equal(
              error instanceof
                trustedDeliverySupabaseAdminClientFactoryModule.AiChartD1PalaceWritingTrustedDeliverySupabaseAdminClientFactoryError,
              true,
            )
            assert.equal(
              (
                error as InstanceType<
                  typeof trustedDeliverySupabaseAdminClientFactoryModule.AiChartD1PalaceWritingTrustedDeliverySupabaseAdminClientFactoryError
                >
              ).code,
              'SUPABASE_ADMIN_OWNER_LOOKUP_COMMAND_INVALID',
            )
            assert.equal(
              JSON.stringify(error).includes(OWNER_ID),
              false,
            )
            return true
          },
        )
        assert.equal(fromCalls, 0)
        assert.equal(rpcCalls, 0)

        mutableEnvironment.NODE_ENV = 'production'
        try {
          assert.throws(
            () =>
              trustedDeliverySupabaseAdminClientFactoryModule
                .createAiChartD1PalaceWritingTrustedDeliverySupabaseAdminClientRepositoryBundle(
                  dependencies,
                ),
            (error: unknown) => {
              assert.equal(
                (
                  error as InstanceType<
                    typeof trustedDeliverySupabaseAdminClientFactoryModule.AiChartD1PalaceWritingTrustedDeliverySupabaseAdminClientFactoryError
                  >
                ).code,
                'SUPABASE_ADMIN_REPOSITORY_BUNDLE_UNAVAILABLE',
              )
              return true
            },
          )
        } finally {
          mutableEnvironment.NODE_ENV = 'test'
        }
        assert.equal(clientFactoryCalls, 1)
        assert.equal(fromCalls, 0)
        assert.equal(rpcCalls, 0)
      },
    )

    await check(
      'trusted delivery Supabase repository preserves only fixed database failures and removes provider diagnostics',
      async () => {
        for (const testCase of [
          {
            providerMessage:
              'ai_chart_report_delivery_owner_mismatch',
            expectedAdapterCode:
              'REPORT_OWNER_MISMATCH',
          },
          {
            providerMessage: SENSITIVE_MARKER,
            expectedAdapterCode:
              'ATOMIC_DELIVERY_RPC_FAILED',
          },
        ] as const) {
          const material =
            await createTrustedDeliveryRepositoryMaterial()
          let rpcCalls = 0
          const invokeAtomicDeliveryRpc =
            trustedDeliverySupabaseRepositoryModule
              .createAiChartD1PalaceWritingTrustedDeliverySupabaseAtomicRpcInvoker(
                {
                  rpc: async () => {
                    rpcCalls += 1
                    return {
                      data: null,
                      error: {
                        code: '23514',
                        details: SENSITIVE_MARKER,
                        hint: SENSITIVE_MARKER,
                        message:
                          testCase.providerMessage,
                      },
                      count: null,
                      status: 400,
                      statusText: 'Bad Request',
                    }
                  },
                },
              )

          await assert.rejects(
            trustedDeliveryRepositoryAdapterModule
              .executeAiChartD1PalaceWritingTrustedDeliveryRepositoryAdapter(
                material,
                {
                  lookupExpectedOwner:
                    async (command) => ({
                      adapterMode:
                        'INJECTED_OFFLINE_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_ONLY',
                      reportId: command.reportId,
                      ownerUserId: OWNER_ID,
                    }),
                  invokeAtomicDeliveryRpc,
                },
              ),
            (error: unknown) => {
              assert.equal(
                (
                  error as InstanceType<
                    typeof trustedDeliveryRepositoryAdapterModule.AiChartD1PalaceWritingTrustedDeliveryRepositoryAdapterError
                  >
                ).code,
                testCase.expectedAdapterCode,
              )
              const serialized = JSON.stringify(error)
              assert.equal(
                serialized.includes(SENSITIVE_MARKER),
                false,
              )
              assert.equal(
                serialized.includes('23514'),
                false,
              )
              assert.equal(
                serialized.includes('Bad Request'),
                false,
              )
              return true
            },
          )
          assert.equal(rpcCalls, 1)
        }
      },
    )

    await check(
      'trusted delivery Supabase repository rejects a forged RPC command and Production binding before any call',
      async () => {
        const material =
          await createTrustedDeliveryRepositoryMaterial()
        let capturedCommand:
          | import(
              './d1PalaceWritingTrustedDeliveryRepositoryAdapter.server'
            ).AiChartD1PalaceWritingAtomicDeliveryRpcCommand
          | undefined
        await trustedDeliveryRepositoryAdapterModule
          .executeAiChartD1PalaceWritingTrustedDeliveryRepositoryAdapter(
            material,
            {
              lookupExpectedOwner:
                async (command) => ({
                  adapterMode:
                    'INJECTED_OFFLINE_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_ONLY',
                  reportId: command.reportId,
                  ownerUserId: OWNER_ID,
                }),
              invokeAtomicDeliveryRpc:
                async (command) => {
                  capturedCommand = command
                  return {
                    result_code: 'PUBLISHED',
                    ledger_receipt_fingerprint:
                      command.p_ledger_receipt_fingerprint,
                    delivery_claim_fingerprint:
                      command.p_delivery_claim_fingerprint,
                    delivery_receipt_fingerprint:
                      command.p_delivery_receipt_fingerprint,
                    report_content_sha256:
                      command.p_report_content_sha256,
                  }
                },
            },
          )
        assert.ok(capturedCommand)

        let rpcCalls = 0
        const invokeAtomicDeliveryRpc =
          trustedDeliverySupabaseRepositoryModule
            .createAiChartD1PalaceWritingTrustedDeliverySupabaseAtomicRpcInvoker(
              {
                rpc: async () => {
                  rpcCalls += 1
                  return {
                    data: [],
                    error: null,
                    count: null,
                    status: 200,
                    statusText: 'OK',
                  }
                },
              },
            )
        await assert.rejects(
          invokeAtomicDeliveryRpc(
            {
              ...capturedCommand,
              ownerUserId: OWNER_ID,
            } as unknown as
              import(
                './d1PalaceWritingTrustedDeliveryRepositoryAdapter.server'
              ).AiChartD1PalaceWritingAtomicDeliveryRpcCommand,
          ),
          (error: unknown) => {
            assert.equal(
              error instanceof
                trustedDeliverySupabaseRepositoryModule.AiChartD1PalaceWritingTrustedDeliverySupabaseRepositoryError,
              true,
            )
            assert.equal(
              (
                error as InstanceType<
                  typeof trustedDeliverySupabaseRepositoryModule.AiChartD1PalaceWritingTrustedDeliverySupabaseRepositoryError
                >
              ).code,
              'SUPABASE_RPC_COMMAND_INVALID',
            )
            assert.equal(
              JSON.stringify(error).includes(OWNER_ID),
              false,
            )
            return true
          },
        )
        assert.equal(rpcCalls, 0)

        mutableEnvironment.NODE_ENV = 'production'
        try {
          assert.throws(
            () =>
              trustedDeliverySupabaseRepositoryModule
                .createAiChartD1PalaceWritingTrustedDeliverySupabaseAtomicRpcInvoker(
                  {
                    rpc: async () => {
                      rpcCalls += 1
                      return {}
                    },
                  },
                ),
            (error: unknown) => {
              assert.equal(
                (
                  error as InstanceType<
                    typeof trustedDeliverySupabaseRepositoryModule.AiChartD1PalaceWritingTrustedDeliverySupabaseRepositoryError
                  >
                ).code,
                'SUPABASE_RPC_REPOSITORY_UNAVAILABLE',
              )
              return true
            },
          )
        } finally {
          mutableEnvironment.NODE_ENV = 'test'
        }
        assert.equal(rpcCalls, 0)
      },
    )

    await check(
      'trusted delivery Supabase repository rejects malformed and transport outcomes with one call and no retry',
      async () => {
        const validRow = {
          result_code: 'PUBLISHED',
          ledger_receipt_fingerprint:
            'a'.repeat(64),
          delivery_claim_fingerprint:
            'b'.repeat(64),
          delivery_receipt_fingerprint:
            'c'.repeat(64),
          report_content_sha256:
            'd'.repeat(64),
        }
        for (const testCase of [
          {
            outcome: {
              data: [],
              error: null,
              count: null,
              status: 200,
              statusText: 'OK',
            },
          },
          {
            outcome: {
              data: [validRow, validRow],
              error: null,
              count: null,
              status: 200,
              statusText: 'OK',
            },
          },
          {
            outcome: {
              data: [
                {
                  ...validRow,
                  providerPayload: SENSITIVE_MARKER,
                },
              ],
              error: null,
              count: null,
              status: 200,
              statusText: 'OK',
            },
          },
          {
            outcome: null,
          },
        ] as const) {
          const material =
            await createTrustedDeliveryRepositoryMaterial()
          let rpcCalls = 0
          const invokeAtomicDeliveryRpc =
            trustedDeliverySupabaseRepositoryModule
              .createAiChartD1PalaceWritingTrustedDeliverySupabaseAtomicRpcInvoker(
                {
                  rpc: async () => {
                    rpcCalls += 1
                    if (testCase.outcome === null) {
                      throw new Error(SENSITIVE_MARKER)
                    }
                    return testCase.outcome
                  },
                },
              )

          await assert.rejects(
            trustedDeliveryRepositoryAdapterModule
              .executeAiChartD1PalaceWritingTrustedDeliveryRepositoryAdapter(
                material,
                {
                  lookupExpectedOwner:
                    async (command) => ({
                      adapterMode:
                        'INJECTED_OFFLINE_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_ONLY',
                      reportId: command.reportId,
                      ownerUserId: OWNER_ID,
                    }),
                  invokeAtomicDeliveryRpc,
                },
              ),
            (error: unknown) => {
              assert.equal(
                (
                  error as InstanceType<
                    typeof trustedDeliveryRepositoryAdapterModule.AiChartD1PalaceWritingTrustedDeliveryRepositoryAdapterError
                  >
                ).code,
                'ATOMIC_DELIVERY_RPC_FAILED',
              )
              const serialized = JSON.stringify(error)
              assert.equal(
                serialized.includes(SENSITIVE_MARKER),
                false,
              )
              assert.equal(
                serialized.includes('providerPayload'),
                false,
              )
              return true
            },
          )
          assert.equal(rpcCalls, 1)
        }
      },
    )

    await check(
      'trusted delivery repository adapter accepts only exact replay and never reuses one contract capability',
      async () => {
        const execute = async (
          material:
            Awaited<
              ReturnType<
                typeof createTrustedDeliveryRepositoryMaterial
              >
            >,
          resultCode:
            | 'PUBLISHED'
            | 'EXISTING_EXACT_MATCH',
        ) => {
          let ownerLookups = 0
          let atomicRpcCalls = 0
          const result =
            await trustedDeliveryRepositoryAdapterModule
              .executeAiChartD1PalaceWritingTrustedDeliveryRepositoryAdapter(
                material,
                {
                  lookupExpectedOwner:
                    async (command) => {
                      ownerLookups += 1
                      return {
                        adapterMode:
                          'INJECTED_OFFLINE_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_ONLY',
                        reportId: command.reportId,
                        ownerUserId: OWNER_ID,
                      }
                    },
                  invokeAtomicDeliveryRpc:
                    async (command) => {
                      atomicRpcCalls += 1
                      return {
                        result_code: resultCode,
                        ledger_receipt_fingerprint:
                          command.p_ledger_receipt_fingerprint,
                        delivery_claim_fingerprint:
                          command.p_delivery_claim_fingerprint,
                        delivery_receipt_fingerprint:
                          command.p_delivery_receipt_fingerprint,
                        report_content_sha256:
                          command.p_report_content_sha256,
                      }
                    },
                },
              )
          return {
            result,
            ownerLookups,
            atomicRpcCalls,
          }
        }

        const firstMaterial =
          await createTrustedDeliveryRepositoryMaterial()
        const first = await execute(
          firstMaterial,
          'PUBLISHED',
        )
        const replayMaterial =
          await createTrustedDeliveryRepositoryMaterial()
        const replay = await execute(
          replayMaterial,
          'EXISTING_EXACT_MATCH',
        )
        assert.equal(
          replay.result.idempotencyKey,
          first.result.idempotencyKey,
        )
        assert.equal(
          replay.result.deliveryReceiptFingerprint,
          first.result.deliveryReceiptFingerprint,
        )
        assert.equal(
          replay.result.rpcResultCode,
          'EXISTING_EXACT_MATCH',
        )
        assert.equal(first.ownerLookups, 1)
        assert.equal(first.atomicRpcCalls, 1)
        assert.equal(replay.ownerLookups, 1)
        assert.equal(replay.atomicRpcCalls, 1)

        let reusedOwnerLookups = 0
        let reusedRpcCalls = 0
        await assert.rejects(
          trustedDeliveryRepositoryAdapterModule
            .executeAiChartD1PalaceWritingTrustedDeliveryRepositoryAdapter(
              firstMaterial,
              {
                lookupExpectedOwner: async () => {
                  reusedOwnerLookups += 1
                  return {}
                },
                invokeAtomicDeliveryRpc: async () => {
                  reusedRpcCalls += 1
                  return {}
                },
              },
            ),
          (error: unknown) => {
            assert.equal(
              error instanceof
                trustedDeliveryRepositoryAdapterModule.AiChartD1PalaceWritingTrustedDeliveryRepositoryAdapterError,
              true,
            )
            assert.equal(
              (
                error as InstanceType<
                  typeof trustedDeliveryRepositoryAdapterModule.AiChartD1PalaceWritingTrustedDeliveryRepositoryAdapterError
                >
              ).code,
              'TRUSTED_DELIVERY_CONTRACT_UNAVAILABLE',
            )
            return true
          },
        )
        assert.equal(reusedOwnerLookups, 0)
        assert.equal(reusedRpcCalls, 0)
      },
    )

    await check(
      'trusted delivery repository adapter rejects caller owner fields and classifies RPC failures without leaking them',
      async () => {
        const material =
          await createTrustedDeliveryRepositoryMaterial()
        let ownerLookups = 0
        let atomicRpcCalls = 0
        const dependencies = {
          lookupExpectedOwner: async (command: {
            reportId: string
          }) => {
            ownerLookups += 1
            return {
              adapterMode:
                'INJECTED_OFFLINE_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_ONLY',
              reportId: command.reportId,
              ownerUserId: OWNER_ID,
            }
          },
          invokeAtomicDeliveryRpc:
            async (
              command:
                import(
                  './d1PalaceWritingTrustedDeliveryRepositoryAdapter.server'
                ).AiChartD1PalaceWritingAtomicDeliveryRpcCommand,
            ) => {
              atomicRpcCalls += 1
              return {
                result_code: 'PUBLISHED',
                ledger_receipt_fingerprint:
                  command.p_ledger_receipt_fingerprint,
                delivery_claim_fingerprint:
                  command.p_delivery_claim_fingerprint,
                delivery_receipt_fingerprint:
                  command.p_delivery_receipt_fingerprint,
                report_content_sha256:
                  command.p_report_content_sha256,
              }
            },
        }
        await assert.rejects(
          trustedDeliveryRepositoryAdapterModule
            .executeAiChartD1PalaceWritingTrustedDeliveryRepositoryAdapter(
              {
                ...material,
                ownerUserId: OWNER_ID,
              },
              dependencies,
            ),
          (error: unknown) => {
            assert.equal(
              (
                error as InstanceType<
                  typeof trustedDeliveryRepositoryAdapterModule.AiChartD1PalaceWritingTrustedDeliveryRepositoryAdapterError
                >
              ).code,
              'TRUSTED_DELIVERY_REPOSITORY_ADAPTER_UNAVAILABLE',
            )
            return true
          },
        )
        assert.equal(ownerLookups, 0)
        assert.equal(atomicRpcCalls, 0)
        await trustedDeliveryRepositoryAdapterModule
          .executeAiChartD1PalaceWritingTrustedDeliveryRepositoryAdapter(
            material,
            dependencies,
          )
        assert.equal(ownerLookups, 1)
        assert.equal(atomicRpcCalls, 1)

        for (const testCase of [
          {
            providerMessage:
              'ai_chart_report_delivery_report_not_found',
            expectedCode: 'REPORT_NOT_FOUND',
          },
          {
            providerMessage:
              'ai_chart_report_delivery_owner_mismatch',
            expectedCode: 'REPORT_OWNER_MISMATCH',
          },
          {
            providerMessage:
              'ai_chart_report_delivery_payment_required',
            expectedCode: 'REPORT_PAYMENT_REQUIRED',
          },
          {
            providerMessage:
              'ai_chart_report_delivery_snapshot_missing',
            expectedCode: 'REPORT_SNAPSHOT_MISMATCH',
          },
          {
            providerMessage:
              'ai_chart_report_delivery_snapshot_mismatch',
            expectedCode: 'REPORT_SNAPSHOT_MISMATCH',
          },
          {
            providerMessage:
              'ai_chart_report_delivery_ledger_conflict',
            expectedCode:
              'DURABLE_REVIEW_LEDGER_CONFLICT',
          },
          {
            providerMessage:
              'ai_chart_report_delivery_report_state_conflict',
            expectedCode: 'REPORT_STATE_CONFLICT',
          },
          {
            providerMessage:
              'ai_chart_report_delivery_idempotency_conflict',
            expectedCode: 'IDEMPOTENCY_CONFLICT',
          },
          {
            providerMessage: SENSITIVE_MARKER,
            expectedCode: 'ATOMIC_DELIVERY_RPC_FAILED',
          },
        ] as const) {
          const failureMaterial =
            await createTrustedDeliveryRepositoryMaterial()
          let failureRpcCalls = 0
          await assert.rejects(
            trustedDeliveryRepositoryAdapterModule
              .executeAiChartD1PalaceWritingTrustedDeliveryRepositoryAdapter(
                failureMaterial,
                {
                  lookupExpectedOwner:
                    async (command) => ({
                      adapterMode:
                        'INJECTED_OFFLINE_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_ONLY',
                      reportId: command.reportId,
                      ownerUserId: OWNER_ID,
                    }),
                  invokeAtomicDeliveryRpc:
                    async () => {
                      failureRpcCalls += 1
                      throw new Error(
                        testCase.providerMessage,
                      )
                    },
                },
              ),
            (error: unknown) => {
              assert.equal(
                (
                  error as InstanceType<
                    typeof trustedDeliveryRepositoryAdapterModule.AiChartD1PalaceWritingTrustedDeliveryRepositoryAdapterError
                  >
                ).code,
                testCase.expectedCode,
              )
              const serialized = JSON.stringify(error)
              assert.equal(
                serialized.includes(SENSITIVE_MARKER),
                false,
              )
              assert.equal(
                serialized.includes(OWNER_ID),
                false,
              )
              assert.equal(
                serialized.includes('writingResult'),
                false,
              )
              return true
            },
          )
          assert.equal(failureRpcCalls, 1)
        }
      },
    )

    await check(
      'trusted delivery repository adapter rejects artifact drift before capability consumption and is unavailable in Production',
      async () => {
        const material =
          await createTrustedDeliveryRepositoryMaterial()
        const tamperedArtifact = structuredClone(
          material.restrictedArtifact,
        )
        const tamperedFirstSection =
          tamperedArtifact.writingResult.sections[0] as {
            customerText: string
          }
        tamperedFirstSection.customerText =
          SENSITIVE_MARKER
        let ownerLookups = 0
        let rpcCalls = 0
        const dependencies = {
          lookupExpectedOwner: async (command: {
            reportId: string
          }) => {
            ownerLookups += 1
            return {
              adapterMode:
                'INJECTED_OFFLINE_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_ONLY',
              reportId: command.reportId,
              ownerUserId: OWNER_ID,
            }
          },
          invokeAtomicDeliveryRpc:
            async (
              command:
                import(
                  './d1PalaceWritingTrustedDeliveryRepositoryAdapter.server'
                ).AiChartD1PalaceWritingAtomicDeliveryRpcCommand,
            ) => {
              rpcCalls += 1
              return {
                result_code: 'PUBLISHED',
                ledger_receipt_fingerprint:
                  command.p_ledger_receipt_fingerprint,
                delivery_claim_fingerprint:
                  command.p_delivery_claim_fingerprint,
                delivery_receipt_fingerprint:
                  command.p_delivery_receipt_fingerprint,
                report_content_sha256:
                  command.p_report_content_sha256,
              }
            },
        }
        await assert.rejects(
          trustedDeliveryRepositoryAdapterModule
            .executeAiChartD1PalaceWritingTrustedDeliveryRepositoryAdapter(
              {
                ...material,
                restrictedArtifact: tamperedArtifact,
              },
              dependencies,
            ),
          (error: unknown) => {
            assert.equal(
              (
                error as InstanceType<
                  typeof trustedDeliveryRepositoryAdapterModule.AiChartD1PalaceWritingTrustedDeliveryRepositoryAdapterError
                >
              ).code,
              'RESTRICTED_ARTIFACT_INVALID',
            )
            assert.equal(
              JSON.stringify(error).includes(
                SENSITIVE_MARKER,
              ),
              false,
            )
            return true
          },
        )
        assert.equal(ownerLookups, 0)
        assert.equal(rpcCalls, 0)

        mutableEnvironment.NODE_ENV = 'production'
        try {
          await assert.rejects(
            trustedDeliveryRepositoryAdapterModule
              .executeAiChartD1PalaceWritingTrustedDeliveryRepositoryAdapter(
                material,
                dependencies,
              ),
            (error: unknown) => {
              assert.equal(
                (
                  error as InstanceType<
                    typeof trustedDeliveryRepositoryAdapterModule.AiChartD1PalaceWritingTrustedDeliveryRepositoryAdapterError
                  >
                ).code,
                'TRUSTED_DELIVERY_REPOSITORY_ADAPTER_UNAVAILABLE',
              )
              return true
            },
          )
        } finally {
          mutableEnvironment.NODE_ENV = 'test'
        }
        assert.equal(ownerLookups, 0)
        assert.equal(rpcCalls, 0)

        const result =
          await trustedDeliveryRepositoryAdapterModule
            .executeAiChartD1PalaceWritingTrustedDeliveryRepositoryAdapter(
              material,
              dependencies,
            )
        assert.equal(
          result.rpcResultCode,
          'PUBLISHED',
        )
        assert.equal(ownerLookups, 1)
        assert.equal(rpcCalls, 1)
      },
    )

    await check(
      'offline trusted delivery adapter probe verifies the exact three-port order without performing real delivery',
      async () => {
        const contract =
          await createTrustedDeliveryAdapterContract()
        const commands: Array<
          import(
            './d1PalaceWritingTrustedDeliveryAdapterProbe.server'
          ).AiChartD1PalaceWritingTrustedDeliveryAdapterProbeCommand
        > = []
        const ledgerReceiptFingerprint =
          'a'.repeat(64)
        const deliveryClaimFingerprint =
          'b'.repeat(64)
        const deliveryReceiptFingerprint =
          'c'.repeat(64)

        const result =
          await trustedDeliveryAdapterProbeModule
            .probeAiChartD1PalaceWritingTrustedDeliveryAdapter({
              trustedDeliveryContract: contract,
              executePort: async (command) => {
                commands.push(command)
                if (
                  command.port ===
                  'ENSURE_DURABLE_REVIEW_LEDGER'
                ) {
                  return {
                    adapterMode:
                      'INJECTED_OFFLINE_TRUSTED_DELIVERY_ADAPTER_PROBE_ONLY',
                    sequence: 1,
                    port:
                      'ENSURE_DURABLE_REVIEW_LEDGER',
                    result: 'CREATED',
                    idempotencyKey:
                      command.idempotencyKey,
                    contractFingerprint:
                      command.contractFingerprint,
                    durableReviewLedgerReceiptFingerprint:
                      ledgerReceiptFingerprint,
                  }
                }
                if (
                  command.port ===
                  'COMPARE_AND_SET_REPORT_DELIVERY_CLAIM'
                ) {
                  return {
                    adapterMode:
                      'INJECTED_OFFLINE_TRUSTED_DELIVERY_ADAPTER_PROBE_ONLY',
                    sequence: 2,
                    port:
                      'COMPARE_AND_SET_REPORT_DELIVERY_CLAIM',
                    result: 'CLAIMED',
                    idempotencyKey:
                      command.idempotencyKey,
                    contractFingerprint:
                      command.contractFingerprint,
                    durableReviewLedgerReceiptFingerprint:
                      command.durableReviewLedgerReceiptFingerprint,
                    deliveryClaimFingerprint,
                  }
                }
                return {
                  adapterMode:
                    'INJECTED_OFFLINE_TRUSTED_DELIVERY_ADAPTER_PROBE_ONLY',
                  sequence: 3,
                  port:
                    'PUBLISH_SOURCE_BOUND_REPORT_CONTENT',
                  result: 'PUBLISHED',
                  idempotencyKey:
                    command.idempotencyKey,
                  contractFingerprint:
                    command.contractFingerprint,
                  durableReviewLedgerReceiptFingerprint:
                    command.durableReviewLedgerReceiptFingerprint,
                  deliveryClaimFingerprint:
                    command.deliveryClaimFingerprint,
                  deliveryReceiptFingerprint,
                }
              },
            })

        assert.deepEqual(
          commands.map(
            ({ sequence, port }) => ({
              sequence,
              port,
            }),
          ),
          [
            {
              sequence: 1,
              port:
                'ENSURE_DURABLE_REVIEW_LEDGER',
            },
            {
              sequence: 2,
              port:
                'COMPARE_AND_SET_REPORT_DELIVERY_CLAIM',
            },
            {
              sequence: 3,
              port:
                'PUBLISH_SOURCE_BOUND_REPORT_CONTENT',
            },
          ],
        )
        assert.equal(
          commands[0]?.contractFingerprint,
          contract.contractFingerprint,
        )
        const claimCommand = commands[1]
        if (claimCommand?.sequence !== 2) {
          assert.fail(
            'expected the second trusted-delivery port command',
          )
        }
        assert.equal(
          claimCommand.durableReviewLedgerReceiptFingerprint,
          ledgerReceiptFingerprint,
        )
        const publishCommand = commands[2]
        if (publishCommand?.sequence !== 3) {
          assert.fail(
            'expected the third trusted-delivery port command',
          )
        }
        assert.equal(
          publishCommand.deliveryClaimFingerprint,
          deliveryClaimFingerprint,
        )
        assert.equal(
          result.status,
          'OFFLINE_PROBE_SUCCEEDED',
        )
        assert.equal(
          result.replayStatus,
          'NEW_DELIVERY_VERIFIED',
        )
        assert.equal(
          result.partialFailureReconciliationStatus,
          'NOT_REQUIRED',
        )
        assert.deepEqual(result.portResults, [
          {
            sequence: 1,
            port:
              'ENSURE_DURABLE_REVIEW_LEDGER',
            result: 'CREATED',
            receiptFingerprint:
              ledgerReceiptFingerprint,
          },
          {
            sequence: 2,
            port:
              'COMPARE_AND_SET_REPORT_DELIVERY_CLAIM',
            result: 'CLAIMED',
            receiptFingerprint:
              deliveryClaimFingerprint,
          },
          {
            sequence: 3,
            port:
              'PUBLISH_SOURCE_BOUND_REPORT_CONTENT',
            result: 'PUBLISHED',
            receiptFingerprint:
              deliveryReceiptFingerprint,
          },
        ])
        assert.equal(result.adapterInvocations, 3)
        assert.equal(result.durableLedgerWrites, 0)
        assert.equal(result.reportMutations, 0)
        assert.equal(result.openAiRequests, 0)
        assert.equal(result.retryPerformed, false)
        assert.equal(
          result.customerDeliveryAllowed,
          false,
        )
        assert.equal(result.productionCallable, false)
        assert.equal(
          commands.every(recursivelyFrozen),
          true,
        )
        assert.equal(recursivelyFrozen(result), true)
      },
    )

    await check(
      'offline trusted delivery adapter probe recognizes an exact three-port replay without creating another delivery',
      async () => {
        const contract =
          await createTrustedDeliveryAdapterContract()
        const ledgerReceiptFingerprint =
          'd'.repeat(64)
        const deliveryClaimFingerprint =
          'e'.repeat(64)
        const deliveryReceiptFingerprint =
          'f'.repeat(64)
        const result =
          await trustedDeliveryAdapterProbeModule
            .probeAiChartD1PalaceWritingTrustedDeliveryAdapter({
              trustedDeliveryContract: contract,
              executePort: async (command) => {
                if (command.sequence === 1) {
                  return {
                    adapterMode:
                      'INJECTED_OFFLINE_TRUSTED_DELIVERY_ADAPTER_PROBE_ONLY',
                    sequence: 1,
                    port:
                      'ENSURE_DURABLE_REVIEW_LEDGER',
                    result:
                      'EXISTING_EXACT_MATCH',
                    idempotencyKey:
                      command.idempotencyKey,
                    contractFingerprint:
                      command.contractFingerprint,
                    durableReviewLedgerReceiptFingerprint:
                      ledgerReceiptFingerprint,
                  }
                }
                if (command.sequence === 2) {
                  return {
                    adapterMode:
                      'INJECTED_OFFLINE_TRUSTED_DELIVERY_ADAPTER_PROBE_ONLY',
                    sequence: 2,
                    port:
                      'COMPARE_AND_SET_REPORT_DELIVERY_CLAIM',
                    result:
                      'EXISTING_EXACT_MATCH',
                    idempotencyKey:
                      command.idempotencyKey,
                    contractFingerprint:
                      command.contractFingerprint,
                    durableReviewLedgerReceiptFingerprint:
                      command.durableReviewLedgerReceiptFingerprint,
                    deliveryClaimFingerprint,
                  }
                }
                return {
                  adapterMode:
                    'INJECTED_OFFLINE_TRUSTED_DELIVERY_ADAPTER_PROBE_ONLY',
                  sequence: 3,
                  port:
                    'PUBLISH_SOURCE_BOUND_REPORT_CONTENT',
                  result:
                    'EXISTING_EXACT_MATCH',
                  idempotencyKey:
                    command.idempotencyKey,
                  contractFingerprint:
                    command.contractFingerprint,
                  durableReviewLedgerReceiptFingerprint:
                    command.durableReviewLedgerReceiptFingerprint,
                  deliveryClaimFingerprint:
                    command.deliveryClaimFingerprint,
                  deliveryReceiptFingerprint,
                }
              },
            })

        assert.equal(
          result.replayStatus,
          'EXACT_REPLAY_VERIFIED',
        )
        assert.equal(
          result.partialFailureReconciliationStatus,
          'EXACT_REPLAY_CONFIRMED',
        )
        assert.deepEqual(
          result.portResults.map(
            ({ result: portResult }) =>
              portResult,
          ),
          [
            'EXISTING_EXACT_MATCH',
            'EXISTING_EXACT_MATCH',
            'EXISTING_EXACT_MATCH',
          ],
        )
        assert.equal(result.adapterInvocations, 3)
        assert.equal(result.actualAdapterWrites, 0)
        assert.equal(result.reportMutations, 0)
        assert.equal(result.retryPerformed, false)
      },
    )

    await check(
      'offline trusted delivery adapter probe stops on partial failure and a fresh equivalent contract reconciles earlier work by idempotency key',
      async () => {
        const failedContract =
          await createTrustedDeliveryAdapterContract()
        const ledgerReceiptFingerprint =
          '1'.repeat(64)
        const deliveryClaimFingerprint =
          '2'.repeat(64)
        const deliveryReceiptFingerprint =
          '3'.repeat(64)
        const failedSequences: number[] = []

        await expectTrustedDeliveryAdapterProbeError(
          'REPORT_DELIVERY_CLAIM_PORT_FAILED',
          trustedDeliveryAdapterProbeModule
            .probeAiChartD1PalaceWritingTrustedDeliveryAdapter({
              trustedDeliveryContract: failedContract,
              executePort: async (command) => {
                failedSequences.push(command.sequence)
                if (command.sequence === 1) {
                  return {
                    adapterMode:
                      'INJECTED_OFFLINE_TRUSTED_DELIVERY_ADAPTER_PROBE_ONLY',
                    sequence: 1,
                    port:
                      'ENSURE_DURABLE_REVIEW_LEDGER',
                    result: 'CREATED',
                    idempotencyKey:
                      command.idempotencyKey,
                    contractFingerprint:
                      command.contractFingerprint,
                    durableReviewLedgerReceiptFingerprint:
                      ledgerReceiptFingerprint,
                  }
                }
                throw new Error(SENSITIVE_MARKER)
              },
            }),
        )
        assert.deepEqual(failedSequences, [1, 2])

        let reusedContractInvocations = 0
        await expectTrustedDeliveryAdapterProbeError(
          'TRUSTED_DELIVERY_ADAPTER_PROBE_UNAVAILABLE',
          trustedDeliveryAdapterProbeModule
            .probeAiChartD1PalaceWritingTrustedDeliveryAdapter({
              trustedDeliveryContract: failedContract,
              executePort: async () => {
                reusedContractInvocations += 1
                return null
              },
            }),
        )
        assert.equal(reusedContractInvocations, 0)

        const reconciliationContract =
          await createTrustedDeliveryAdapterContract()
        assert.equal(
          reconciliationContract.idempotencyKey,
          failedContract.idempotencyKey,
        )
        const reconciliationSequences: number[] = []
        const result =
          await trustedDeliveryAdapterProbeModule
            .probeAiChartD1PalaceWritingTrustedDeliveryAdapter({
              trustedDeliveryContract:
                reconciliationContract,
              executePort: async (command) => {
                reconciliationSequences.push(
                  command.sequence,
                )
                if (command.sequence === 1) {
                  return {
                    adapterMode:
                      'INJECTED_OFFLINE_TRUSTED_DELIVERY_ADAPTER_PROBE_ONLY',
                    sequence: 1,
                    port:
                      'ENSURE_DURABLE_REVIEW_LEDGER',
                    result:
                      'EXISTING_EXACT_MATCH',
                    idempotencyKey:
                      command.idempotencyKey,
                    contractFingerprint:
                      command.contractFingerprint,
                    durableReviewLedgerReceiptFingerprint:
                      ledgerReceiptFingerprint,
                  }
                }
                if (command.sequence === 2) {
                  return {
                    adapterMode:
                      'INJECTED_OFFLINE_TRUSTED_DELIVERY_ADAPTER_PROBE_ONLY',
                    sequence: 2,
                    port:
                      'COMPARE_AND_SET_REPORT_DELIVERY_CLAIM',
                    result: 'CLAIMED',
                    idempotencyKey:
                      command.idempotencyKey,
                    contractFingerprint:
                      command.contractFingerprint,
                    durableReviewLedgerReceiptFingerprint:
                      command.durableReviewLedgerReceiptFingerprint,
                    deliveryClaimFingerprint,
                  }
                }
                return {
                  adapterMode:
                    'INJECTED_OFFLINE_TRUSTED_DELIVERY_ADAPTER_PROBE_ONLY',
                  sequence: 3,
                  port:
                    'PUBLISH_SOURCE_BOUND_REPORT_CONTENT',
                  result: 'PUBLISHED',
                  idempotencyKey:
                    command.idempotencyKey,
                  contractFingerprint:
                    command.contractFingerprint,
                  durableReviewLedgerReceiptFingerprint:
                    command.durableReviewLedgerReceiptFingerprint,
                  deliveryClaimFingerprint:
                    command.deliveryClaimFingerprint,
                  deliveryReceiptFingerprint,
                }
              },
            })

        assert.deepEqual(
          reconciliationSequences,
          [1, 2, 3],
        )
        assert.equal(
          result.replayStatus,
          'PARTIAL_FAILURE_RECONCILED',
        )
        assert.equal(
          result.partialFailureReconciliationStatus,
          'EARLIER_PORTS_RECONCILED',
        )
        assert.equal(result.retryPerformed, false)
        assert.equal(result.openAiRequests, 0)
      },
    )

    await check(
      'offline trusted delivery adapter probe rejects idempotency drift, impossible replay state, and untrusted metadata without leaking it',
      async () => {
        const idempotencyConflictContract =
          await createTrustedDeliveryAdapterContract()
        let idempotencyConflictInvocations = 0
        await expectTrustedDeliveryAdapterProbeError(
          'IDEMPOTENCY_CONFLICT',
          trustedDeliveryAdapterProbeModule
            .probeAiChartD1PalaceWritingTrustedDeliveryAdapter({
              trustedDeliveryContract:
                idempotencyConflictContract,
              executePort: async (command) => {
                idempotencyConflictInvocations += 1
                return {
                  adapterMode:
                    'INJECTED_OFFLINE_TRUSTED_DELIVERY_ADAPTER_PROBE_ONLY',
                  sequence: 1,
                  port:
                    'ENSURE_DURABLE_REVIEW_LEDGER',
                  result: 'CREATED',
                  idempotencyKey: '0'.repeat(64),
                  contractFingerprint:
                    command.contractFingerprint,
                  durableReviewLedgerReceiptFingerprint:
                    '4'.repeat(64),
                }
              },
            }),
        )
        assert.equal(
          idempotencyConflictInvocations,
          1,
        )

        const impossibleReplayContract =
          await createTrustedDeliveryAdapterContract()
        await expectTrustedDeliveryAdapterProbeError(
          'RECONCILIATION_CONFLICT',
          trustedDeliveryAdapterProbeModule
            .probeAiChartD1PalaceWritingTrustedDeliveryAdapter({
              trustedDeliveryContract:
                impossibleReplayContract,
              executePort: async (command) => {
                if (command.sequence === 1) {
                  return {
                    adapterMode:
                      'INJECTED_OFFLINE_TRUSTED_DELIVERY_ADAPTER_PROBE_ONLY',
                    sequence: 1,
                    port:
                      'ENSURE_DURABLE_REVIEW_LEDGER',
                    result: 'CREATED',
                    idempotencyKey:
                      command.idempotencyKey,
                    contractFingerprint:
                      command.contractFingerprint,
                    durableReviewLedgerReceiptFingerprint:
                      '5'.repeat(64),
                  }
                }
                if (command.sequence === 2) {
                  return {
                    adapterMode:
                      'INJECTED_OFFLINE_TRUSTED_DELIVERY_ADAPTER_PROBE_ONLY',
                    sequence: 2,
                    port:
                      'COMPARE_AND_SET_REPORT_DELIVERY_CLAIM',
                    result:
                      'EXISTING_EXACT_MATCH',
                    idempotencyKey:
                      command.idempotencyKey,
                    contractFingerprint:
                      command.contractFingerprint,
                    durableReviewLedgerReceiptFingerprint:
                      command.durableReviewLedgerReceiptFingerprint,
                    deliveryClaimFingerprint:
                      '6'.repeat(64),
                  }
                }
                return {
                  adapterMode:
                    'INJECTED_OFFLINE_TRUSTED_DELIVERY_ADAPTER_PROBE_ONLY',
                  sequence: 3,
                  port:
                    'PUBLISH_SOURCE_BOUND_REPORT_CONTENT',
                  result:
                    'EXISTING_EXACT_MATCH',
                  idempotencyKey:
                    command.idempotencyKey,
                  contractFingerprint:
                    command.contractFingerprint,
                  durableReviewLedgerReceiptFingerprint:
                    command.durableReviewLedgerReceiptFingerprint,
                  deliveryClaimFingerprint:
                    command.deliveryClaimFingerprint,
                  deliveryReceiptFingerprint:
                    '7'.repeat(64),
                }
              },
            }),
        )

        const unsafeOutcomeContract =
          await createTrustedDeliveryAdapterContract()
        await expectTrustedDeliveryAdapterProbeError(
          'DURABLE_REVIEW_LEDGER_OUTCOME_INVALID',
          trustedDeliveryAdapterProbeModule
            .probeAiChartD1PalaceWritingTrustedDeliveryAdapter({
              trustedDeliveryContract:
                unsafeOutcomeContract,
              executePort: async (command) => ({
                adapterMode:
                  'INJECTED_OFFLINE_TRUSTED_DELIVERY_ADAPTER_PROBE_ONLY',
                sequence: 1,
                port:
                  'ENSURE_DURABLE_REVIEW_LEDGER',
                result: 'CREATED',
                idempotencyKey:
                  command.idempotencyKey,
                contractFingerprint:
                  command.contractFingerprint,
                durableReviewLedgerReceiptFingerprint:
                  '8'.repeat(64),
                providerMessage: SENSITIVE_MARKER,
              }),
            }),
        )
      },
    )

    await check(
      'offline trusted delivery adapter probe rejects Production, copied contracts, and added input before invoking a port',
      async () => {
        const contract =
          await createTrustedDeliveryAdapterContract()
        let portInvocations = 0
        const executePort = async (
          command:
            import(
              './d1PalaceWritingTrustedDeliveryAdapterProbe.server'
            ).AiChartD1PalaceWritingTrustedDeliveryAdapterProbeCommand,
        ) => {
          portInvocations += 1
          if (command.sequence === 1) {
            return {
              adapterMode:
                'INJECTED_OFFLINE_TRUSTED_DELIVERY_ADAPTER_PROBE_ONLY',
              sequence: 1,
              port:
                'ENSURE_DURABLE_REVIEW_LEDGER',
              result: 'CREATED',
              idempotencyKey:
                command.idempotencyKey,
              contractFingerprint:
                command.contractFingerprint,
              durableReviewLedgerReceiptFingerprint:
                '9'.repeat(64),
            }
          }
          if (command.sequence === 2) {
            return {
              adapterMode:
                'INJECTED_OFFLINE_TRUSTED_DELIVERY_ADAPTER_PROBE_ONLY',
              sequence: 2,
              port:
                'COMPARE_AND_SET_REPORT_DELIVERY_CLAIM',
              result: 'CLAIMED',
              idempotencyKey:
                command.idempotencyKey,
              contractFingerprint:
                command.contractFingerprint,
              durableReviewLedgerReceiptFingerprint:
                command.durableReviewLedgerReceiptFingerprint,
              deliveryClaimFingerprint:
                'a'.repeat(64),
            }
          }
          return {
            adapterMode:
              'INJECTED_OFFLINE_TRUSTED_DELIVERY_ADAPTER_PROBE_ONLY',
            sequence: 3,
            port:
              'PUBLISH_SOURCE_BOUND_REPORT_CONTENT',
            result: 'PUBLISHED',
            idempotencyKey:
              command.idempotencyKey,
            contractFingerprint:
              command.contractFingerprint,
            durableReviewLedgerReceiptFingerprint:
              command.durableReviewLedgerReceiptFingerprint,
            deliveryClaimFingerprint:
              command.deliveryClaimFingerprint,
            deliveryReceiptFingerprint:
              'b'.repeat(64),
          }
        }

        mutableEnvironment.NODE_ENV = 'production'
        try {
          await expectTrustedDeliveryAdapterProbeError(
            'TRUSTED_DELIVERY_ADAPTER_PROBE_UNAVAILABLE',
            trustedDeliveryAdapterProbeModule
              .probeAiChartD1PalaceWritingTrustedDeliveryAdapter({
                trustedDeliveryContract: contract,
                executePort,
              }),
          )
        } finally {
          mutableEnvironment.NODE_ENV = 'test'
        }
        assert.equal(portInvocations, 0)

        await expectTrustedDeliveryAdapterProbeError(
          'TRUSTED_DELIVERY_ADAPTER_PROBE_UNAVAILABLE',
          trustedDeliveryAdapterProbeModule
            .probeAiChartD1PalaceWritingTrustedDeliveryAdapter({
              trustedDeliveryContract:
                structuredClone(contract),
              executePort,
            }),
        )
        assert.equal(portInvocations, 0)

        const accessorContract =
          await createTrustedDeliveryAdapterContract()
        let accessorCalls = 0
        const accessorInput = Object.defineProperty(
          {
            trustedDeliveryContract:
              accessorContract,
          },
          'executePort',
          {
            enumerable: true,
            get() {
              accessorCalls += 1
              return executePort
            },
          },
        )
        await expectTrustedDeliveryAdapterProbeError(
          'TRUSTED_DELIVERY_ADAPTER_PROBE_UNAVAILABLE',
          trustedDeliveryAdapterProbeModule
            .probeAiChartD1PalaceWritingTrustedDeliveryAdapter(
              accessorInput as never,
            ),
        )
        assert.equal(accessorCalls, 0)
        assert.equal(portInvocations, 0)
        const accessorContractResult =
          await trustedDeliveryAdapterProbeModule
            .probeAiChartD1PalaceWritingTrustedDeliveryAdapter({
              trustedDeliveryContract:
                accessorContract,
              executePort,
            })
        assert.equal(
          accessorContractResult.replayStatus,
          'NEW_DELIVERY_VERIFIED',
        )
        assert.equal(portInvocations, 3)

        await expectTrustedDeliveryAdapterProbeError(
          'TRUSTED_DELIVERY_ADAPTER_PROBE_UNAVAILABLE',
          trustedDeliveryAdapterProbeModule
            .probeAiChartD1PalaceWritingTrustedDeliveryAdapter({
              trustedDeliveryContract: contract,
              executePort,
              callerOverride: SENSITIVE_MARKER,
            } as never),
        )
        assert.equal(portInvocations, 3)

        const result =
          await trustedDeliveryAdapterProbeModule
            .probeAiChartD1PalaceWritingTrustedDeliveryAdapter({
              trustedDeliveryContract: contract,
              executePort,
            })
        assert.equal(
          result.replayStatus,
          'NEW_DELIVERY_VERIFIED',
        )
        assert.equal(portInvocations, 6)
      },
    )

    await check(
      'writer accepts only the exact envelope identity and the original envelope cannot be reused',
      async () => {
        process.env.TMPDIR = writerSuiteRoot
        await rm(reviewRecordStorageRoot, {
          recursive: true,
          force: true,
        })
        const envelope =
          recordEnvelopeModule
            .buildAiChartD1PalaceWritingHumanReviewRecordEnvelope(
              await createReviewCommand(),
              {
                now: () =>
                  new Date(
                    '2026-07-28T09:10:11.123Z',
                  ),
              },
            )

        await assert.rejects(
          recordWriterModule
            .persistAiChartD1PalaceWritingHumanReviewRecord(
              structuredClone(envelope),
            ),
          (error: unknown) => {
            assert.equal(
              error instanceof
                recordEnvelopeModule.AiChartD1PalaceWritingHumanReviewRecordEnvelopeError,
              true,
            )
            assert.equal(
              (
                error as InstanceType<
                  typeof recordEnvelopeModule.AiChartD1PalaceWritingHumanReviewRecordEnvelopeError
                >
              ).code,
              'REVIEW_RECORD_ENVELOPE_UNAVAILABLE',
            )
            return true
          },
        )
        await assert.rejects(
          recordWriterModule
            .persistAiChartD1PalaceWritingHumanReviewRecord({
              envelope,
              storageRoot: writerSuiteRoot,
            }),
          (error: unknown) =>
            error instanceof
            recordEnvelopeModule.AiChartD1PalaceWritingHumanReviewRecordEnvelopeError,
        )
        const receipt =
          await recordWriterModule
            .persistAiChartD1PalaceWritingHumanReviewRecord(
              envelope,
            )
        await assert.rejects(
          recordWriterModule
            .persistAiChartD1PalaceWritingHumanReviewRecord(
              envelope,
            ),
          (error: unknown) =>
            error instanceof
            recordEnvelopeModule.AiChartD1PalaceWritingHumanReviewRecordEnvelopeError,
        )
        assert.deepEqual(
          await readdir(
            join(
              reviewRecordStorageRoot,
              receipt.gateFingerprint,
            ),
          ),
          ['human-review-record.json'],
        )
      },
    )

    await check(
      'same Gate admits exactly one human-review record under concurrent and repeated writes',
      async () => {
        process.env.TMPDIR = writerSuiteRoot
        await rm(reviewRecordStorageRoot, {
          recursive: true,
          force: true,
        })
        const createEnvelope = async () =>
          recordEnvelopeModule
            .buildAiChartD1PalaceWritingHumanReviewRecordEnvelope(
              await createReviewCommand(),
              {
                now: () =>
                  new Date(
                    '2026-07-28T09:10:11.123Z',
                  ),
              },
            )
        const firstEnvelope = await createEnvelope()
        const secondEnvelope = await createEnvelope()
        const attempts = await Promise.allSettled([
          recordWriterModule
            .persistAiChartD1PalaceWritingHumanReviewRecord(
              firstEnvelope,
            ),
          recordWriterModule
            .persistAiChartD1PalaceWritingHumanReviewRecord(
              secondEnvelope,
            ),
        ])
        const fulfilled = attempts.filter(
          (attempt) => attempt.status === 'fulfilled',
        )
        const rejected = attempts.filter(
          (attempt) => attempt.status === 'rejected',
        )

        assert.equal(fulfilled.length, 1)
        assert.equal(rejected.length, 1)
        if (fulfilled[0]?.status !== 'fulfilled') {
          assert.fail('expected one persisted review record')
        }
        if (rejected[0]?.status !== 'rejected') {
          assert.fail('expected one rejected review record')
        }
        assert.equal(
          rejected[0].reason instanceof
            recordWriterModule.AiChartD1PalaceWritingHumanReviewRecordAlreadyPersistedError,
          true,
        )
        assert.equal(
          Object.isFrozen(rejected[0].reason),
          true,
        )
        const gateDirectory = join(
          reviewRecordStorageRoot,
          fulfilled[0].value.gateFingerprint,
        )
        const artifactPath = join(
          gateDirectory,
          fulfilled[0].value.artifactName,
        )
        const before = await readFile(artifactPath)
        await assert.rejects(
          recordWriterModule
            .persistAiChartD1PalaceWritingHumanReviewRecord(
              await createEnvelope(),
            ),
          (error: unknown) =>
            error instanceof
            recordWriterModule.AiChartD1PalaceWritingHumanReviewRecordAlreadyPersistedError,
        )
        assert.deepEqual(
          await readdir(gateDirectory),
          ['human-review-record.json'],
        )
        assert.deepEqual(
          await readFile(artifactPath),
          before,
        )
      },
    )

    await check(
      'symlink storage fails closed without writing or allowing the consumed envelope to retry',
      async () => {
        process.env.TMPDIR = writerSuiteRoot
        await rm(reviewRecordStorageRoot, {
          recursive: true,
          force: true,
        })
        const externalDirectory = join(
          writerSuiteRoot,
          'untrusted-human-review-record-target',
        )
        await rm(externalDirectory, {
          recursive: true,
          force: true,
        })
        await mkdir(externalDirectory, {
          mode: 0o700,
        })
        await symlink(
          externalDirectory,
          reviewRecordStorageRoot,
        )
        const envelope =
          recordEnvelopeModule
            .buildAiChartD1PalaceWritingHumanReviewRecordEnvelope(
              await createReviewCommand(),
              {
                now: () =>
                  new Date(
                    '2026-07-28T09:10:11.123Z',
                  ),
              },
            )

        await assert.rejects(
          recordWriterModule
            .persistAiChartD1PalaceWritingHumanReviewRecord(
              envelope,
            ),
          (error: unknown) => {
            assert.equal(
              error instanceof
                recordWriterModule.AiChartD1PalaceWritingHumanReviewRecordStorageError,
              true,
            )
            assert.equal(Object.isFrozen(error), true)
            assert.equal(
              JSON.stringify(error).includes(
                SENSITIVE_MARKER,
              ),
              false,
            )
            return true
          },
        )
        assert.deepEqual(
          await readdir(externalDirectory),
          [],
        )
        await assert.rejects(
          recordWriterModule
            .persistAiChartD1PalaceWritingHumanReviewRecord(
              envelope,
            ),
          (error: unknown) =>
            error instanceof
            recordEnvelopeModule.AiChartD1PalaceWritingHumanReviewRecordEnvelopeError,
        )
      },
    )
  } finally {
    await rm(writerSuiteRoot, {
      recursive: true,
      force: true,
    })
    if (originalTmpdirEnvironment === undefined) {
      delete mutableEnvironment.TMPDIR
    } else {
      mutableEnvironment.TMPDIR =
        originalTmpdirEnvironment
    }
    if (previousNodeEnv === undefined) {
      delete mutableEnvironment.NODE_ENV
    } else {
      mutableEnvironment.NODE_ENV = previousNodeEnv
    }
  }

  console.log(
    `AI Chart D1 human-review command and record-envelope checks passed: ${checks}`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
