import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import Module, { createRequire } from 'node:module'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'

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

const authorizationModule =
  loadServerOnlyModule<
    typeof import(
      './d1PalaceWritingPreviewHumanReviewAuthorizationHandoff.server'
    )
  >(
    './d1PalaceWritingPreviewHumanReviewAuthorizationHandoff.server',
  )
const recordProbeModule =
  loadServerOnlyModule<
    typeof import(
      './d1PalaceWritingPreviewHumanReviewRecordPersistenceProbe.server'
    )
  >(
    './d1PalaceWritingPreviewHumanReviewRecordPersistenceProbe.server',
  )
const productionPortModule =
  loadServerOnlyModule<
    typeof import(
      './d1PalaceWritingPreviewHumanReviewProductionPortContracts.server'
    )
  >(
    './d1PalaceWritingPreviewHumanReviewProductionPortContracts.server',
  )
const reportBindingModule =
  loadServerOnlyModule<
    typeof import(
      './d1PalaceWritingPreviewReportArtifactBindingContracts.server'
    )
  >(
    './d1PalaceWritingPreviewReportArtifactBindingContracts.server',
  )

const {
  prepareAiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff,
} = authorizationModule
const {
  probeAiChartD1PalaceWritingPreviewHumanReviewRecordPersistence,
} = recordProbeModule
const {
  buildAiChartD1PalaceWritingPreviewHumanReviewProductionPortContract,
} = productionPortModule
const {
  AiChartD1PalaceWritingPreviewReportArtifactBindingError,
  consumeAiChartD1PalaceWritingPreviewReportArtifactBinding,
  prepareAiChartD1PalaceWritingPreviewReportArtifactBinding,
} = reportBindingModule

const GATE_FINGERPRINT = '1'.repeat(64)
const RESTRICTED_ARTIFACT_FINGERPRINT = '2'.repeat(64)
const ARTIFACT_PAYLOAD_SHA256 = '3'.repeat(64)
const REPORT_SNAPSHOT_SHA256 = '4'.repeat(64)
const REPORT_ID = '3e0ba27e-95f8-4c22-92b1-a42fb9bfaed9'
const REQUIRED_PERMISSION =
  'AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW'

function sha256Canonical(value: unknown): string {
  return createHash('sha256')
    .update(
      createAiChartD1PalaceWritingCanonicalJson(value),
      'utf8',
    )
    .digest('hex')
}

function createProposal(
  decision: 'APPROVED' | 'REPAIR_REQUIRED' | 'REJECTED' =
    'APPROVED',
  issueCodes: readonly string[] = [],
) {
  const customerDeliveryStatus =
    decision === 'APPROVED'
      ? 'BLOCKED_PENDING_TRUSTED_REVIEW_RECORD'
      : decision === 'REPAIR_REQUIRED'
        ? 'BLOCKED_REPAIR_REQUIRED'
        : 'BLOCKED_REJECTED'
  const nextRequiredAction =
    decision === 'APPROVED'
      ? 'RECORD_APPROVAL_WITH_TRUSTED_HUMAN_REVIEW_ADAPTER'
      : decision === 'REPAIR_REQUIRED'
        ? 'RECORD_REPAIR_DECISION_WITH_TRUSTED_HUMAN_REVIEW_ADAPTER'
        : 'RECORD_REJECTION_WITH_TRUSTED_HUMAN_REVIEW_ADAPTER'
  const withoutFingerprint = {
    contractVersion:
      'ai-chart-d1-palace-writing-preview-human-review-decision/v1',
    task:
      'D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_DECISION',
    gateFingerprint: GATE_FINGERPRINT,
    restrictedArtifactFingerprint:
      RESTRICTED_ARTIFACT_FINGERPRINT,
    artifactPayloadSha256: ARTIFACT_PAYLOAD_SHA256,
    dataClassification:
      'HUMAN_REVIEW_DECISION_METADATA',
    decision,
    issueCodes,
    decisionStatus: 'PROPOSED_NOT_AUTHORIZED',
    decisionAuthority:
      'TRUSTED_HUMAN_REVIEW_ADAPTER_REQUIRED',
    reviewerIdentityStatus: 'NOT_VERIFIED',
    persistenceStatus: 'NOT_RECORDED',
    customerDeliveryStatus,
    nextRequiredAction,
  }
  return Object.freeze({
    ...withoutFingerprint,
    issueCodes: Object.freeze([...issueCodes]),
    proposalFingerprint:
      sha256Canonical(withoutFingerprint),
  })
}

type AuthorizationCommand = import(
  './d1PalaceWritingPreviewHumanReviewAuthorizationHandoff.server'
).AiChartD1PalaceWritingPreviewHumanReviewAuthorizationAdapterCommand

async function createProductionPortContract(
  decision: 'APPROVED' | 'REPAIR_REQUIRED' | 'REJECTED' =
    'APPROVED',
  issueCodes: readonly string[] = [],
) {
  const prepared =
    await prepareAiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff(
      {
        decisionProposal:
          createProposal(decision, issueCodes),
        verifyReviewerAuthorizationFake:
          async (command: AuthorizationCommand) =>
            Object.freeze({
              adapterMode:
                'INJECTED_AUTHORIZATION_PROBE_ONLY',
              authorizationStatus: 'AUTHORIZED',
              reviewerSessionStatus: 'VERIFIED',
              permission: REQUIRED_PERMISSION,
              proposalFingerprint:
                command.proposalFingerprint,
              gateFingerprint: command.gateFingerprint,
              restrictedArtifactFingerprint:
                command.restrictedArtifactFingerprint,
              artifactPayloadSha256:
                command.artifactPayloadSha256,
            }),
      },
    )
  const template =
    probeAiChartD1PalaceWritingPreviewHumanReviewRecordPersistence(
      prepared.handoff,
    )
  return buildAiChartD1PalaceWritingPreviewHumanReviewProductionPortContract(
    template,
  )
}

type ReportBindingCommand = import(
  './d1PalaceWritingPreviewReportArtifactBindingContracts.server'
).AiChartD1PalaceWritingPreviewReportArtifactBindingAdapterCommand

function createReportSubjectOutcome(
  command: ReportBindingCommand,
) {
  return {
    adapterMode:
      'INJECTED_REPORT_SUBJECT_PROBE_ONLY',
    lookupStatus: 'FOUND',
    reportId: REPORT_ID,
    paymentStatus: 'PAID',
    ownerBindingStatus: 'SERVER_VERIFIED',
    sourceBindingStatus: 'MATCHED',
    reportSnapshotSha256: REPORT_SNAPSHOT_SHA256,
    gateFingerprint: command.gateFingerprint,
    restrictedArtifactFingerprint:
      command.restrictedArtifactFingerprint,
    artifactPayloadSha256:
      command.artifactPayloadSha256,
    proposalFingerprint:
      command.proposalFingerprint,
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

let checks = 0

async function check(
  name: string,
  runCheck: () => void | Promise<void>,
): Promise<void> {
  await runCheck()
  checks += 1
  console.log(`✓ ${name}`)
}

async function run(): Promise<void> {
  await check(
    'trusted report lookup binds one exact Production contract to a paid Report without exposing owner data',
    async () => {
      const productionPortContract =
        await createProductionPortContract()
      let adapterInvocations = 0
      const prepared =
        await prepareAiChartD1PalaceWritingPreviewReportArtifactBinding(
          {
            productionPortContract,
            resolveReportSubjectFake: async (command) => {
              adapterInvocations += 1
              assert.deepEqual(command, {
                contractVersion:
                  'ai-chart-d1-palace-writing-preview-report-artifact-binding-adapter-command/v1',
                task:
                  'D1_PALACE_WRITING_PREVIEW_REPORT_ARTIFACT_BINDING_ADAPTER_COMMAND',
                adapterMode:
                  'INJECTED_REPORT_SUBJECT_PROBE_ONLY',
                sequence: 1,
                gateFingerprint: GATE_FINGERPRINT,
                restrictedArtifactFingerprint:
                  RESTRICTED_ARTIFACT_FINGERPRINT,
                artifactPayloadSha256:
                  ARTIFACT_PAYLOAD_SHA256,
                proposalFingerprint:
                  productionPortContract.proposalFingerprint,
              })
              return Object.freeze(
                createReportSubjectOutcome(command),
              )
            },
          },
        )

      assert.equal(adapterInvocations, 1)
      assert.deepEqual(prepared, {
        contractVersion:
          'ai-chart-d1-palace-writing-preview-report-artifact-binding-preparation/v1',
        task:
          'D1_PALACE_WRITING_PREVIEW_REPORT_ARTIFACT_BINDING_PREPARATION',
        status: 'READY_STOPPED',
        stage:
          'OFFLINE_REPORT_ARTIFACT_BINDING_CREATED',
        nextRequiredAction:
          'IMPLEMENT_PRODUCTION_REPORT_SUBJECT_LOOKUP_ADAPTER',
        binding: {
          contractVersion:
            'ai-chart-d1-palace-writing-preview-report-artifact-binding/v1',
          task:
            'D1_PALACE_WRITING_PREVIEW_REPORT_ARTIFACT_BINDING',
          dataClassification:
            'REPORT_ARTIFACT_BINDING_METADATA',
          reportId: REPORT_ID,
          reportSnapshotSha256:
            REPORT_SNAPSHOT_SHA256,
          sourceProductionPortContractFingerprint:
            productionPortContract.contractFingerprint,
          gateFingerprint: GATE_FINGERPRINT,
          restrictedArtifactFingerprint:
            RESTRICTED_ARTIFACT_FINGERPRINT,
          artifactPayloadSha256:
            ARTIFACT_PAYLOAD_SHA256,
          proposalFingerprint:
            productionPortContract.proposalFingerprint,
          decision: 'APPROVED',
          issueCodes: [],
          requiredPermission: REQUIRED_PERMISSION,
          customerDeliveryStatus:
            'BLOCKED_PENDING_TRUSTED_REVIEW_RECORD',
          reportLookupStatus: 'SYNTHETIC_FOUND',
          paymentStatus:
            'SYNTHETIC_PAID_NOT_PRODUCTION',
          ownerBindingStatus:
            'SYNTHETIC_SERVER_VERIFIED_NOT_PRODUCTION',
          sourceBindingStatus:
            'SYNTHETIC_MATCHED_NOT_PRODUCTION',
          capabilityScope:
            'IN_PROCESS_EXACT_OBJECT_IDENTITY',
          productionCallable: false,
          formalReviewRecordAllowed: false,
          persistenceStatus: 'NOT_PERSISTED',
          customerDeliveryAllowed: false,
          openAiRequests: 0,
          bindingFingerprint:
            prepared.binding.bindingFingerprint,
        },
        productionCallable: false,
        formalReviewRecordAllowed: false,
        customerDeliveryAllowed: false,
        openAiRequests: 0,
      })
      assert.match(
        prepared.binding.bindingFingerprint,
        /^[a-f0-9]{64}$/u,
      )
      assert.equal(recursivelyFrozen(prepared), true)
      const serialized = JSON.stringify(prepared)
      for (
        const forbidden of [
          '"userId":',
          '"user_id":',
          '"ownerId":',
          '"ownerEmail":',
          '"birthInput":',
          '"chartSnapshot":',
          '"reportContent":',
          '"restrictedArtifact":',
          '"prompt":',
          '"reviewerId":',
        ]
      ) {
        assert.equal(serialized.includes(forbidden), false)
      }
    },
  )

  await check(
    'missing, unpaid, unowned, mismatched, malformed, and over-posted Report outcomes fail closed',
    async () => {
      const cases = [
        [
          'missing report',
          (outcome: Record<string, unknown>) => {
            outcome.lookupStatus = 'NOT_FOUND'
          },
        ],
        [
          'unpaid report',
          (outcome: Record<string, unknown>) => {
            outcome.paymentStatus = 'PENDING'
          },
        ],
        [
          'owner not verified',
          (outcome: Record<string, unknown>) => {
            outcome.ownerBindingStatus = 'UNVERIFIED'
          },
        ],
        [
          'source mismatch',
          (outcome: Record<string, unknown>) => {
            outcome.sourceBindingStatus = 'MISMATCHED'
          },
        ],
        [
          'invalid report id',
          (outcome: Record<string, unknown>) => {
            outcome.reportId = 'caller-selected-report'
          },
        ],
        [
          'invalid snapshot digest',
          (outcome: Record<string, unknown>) => {
            outcome.reportSnapshotSha256 = 'not-a-sha'
          },
        ],
        [
          'artifact drift',
          (outcome: Record<string, unknown>) => {
            outcome.artifactPayloadSha256 = '9'.repeat(64)
          },
        ],
        [
          'proposal drift',
          (outcome: Record<string, unknown>) => {
            outcome.proposalFingerprint = '8'.repeat(64)
          },
        ],
        [
          'over-posted owner identity',
          (outcome: Record<string, unknown>) => {
            outcome.ownerId = 'must-not-cross'
          },
        ],
      ] as const

      for (const [name, mutate] of cases) {
        const productionPortContract =
          await createProductionPortContract()
        await assert.rejects(
          () =>
            prepareAiChartD1PalaceWritingPreviewReportArtifactBinding(
              {
                productionPortContract,
                resolveReportSubjectFake:
                  async (command) => {
                    const outcome =
                      createReportSubjectOutcome(command)
                    mutate(outcome)
                    return outcome
                  },
              },
            ),
          AiChartD1PalaceWritingPreviewReportArtifactBindingError,
          name,
        )
      }
    },
  )

  await check(
    'Production contract and Report binding are exact-object single-use capabilities',
    async () => {
      const productionPortContract =
        await createProductionPortContract()
      for (
        const invalidSource of [
          { ...productionPortContract },
          structuredClone(productionPortContract),
        ]
      ) {
        await assert.rejects(
          () =>
            prepareAiChartD1PalaceWritingPreviewReportArtifactBinding(
              {
                productionPortContract: invalidSource,
                resolveReportSubjectFake:
                  async (command) =>
                    createReportSubjectOutcome(command),
              },
            ),
          AiChartD1PalaceWritingPreviewReportArtifactBindingError,
        )
      }

      const prepared =
        await prepareAiChartD1PalaceWritingPreviewReportArtifactBinding(
          {
            productionPortContract,
            resolveReportSubjectFake: async (command) =>
              createReportSubjectOutcome(command),
          },
        )
      await assert.rejects(
        () =>
          prepareAiChartD1PalaceWritingPreviewReportArtifactBinding(
            {
              productionPortContract,
              resolveReportSubjectFake: async (command) =>
                createReportSubjectOutcome(command),
            },
          ),
        AiChartD1PalaceWritingPreviewReportArtifactBindingError,
      )

      for (
        const invalidBinding of [
          { ...prepared.binding },
          structuredClone(prepared.binding),
        ]
      ) {
        assert.throws(
          () =>
            consumeAiChartD1PalaceWritingPreviewReportArtifactBinding(
              invalidBinding,
            ),
          AiChartD1PalaceWritingPreviewReportArtifactBindingError,
        )
      }
      assert.equal(
        consumeAiChartD1PalaceWritingPreviewReportArtifactBinding(
          prepared.binding,
        ),
        prepared.binding,
      )
      assert.throws(
        () =>
          consumeAiChartD1PalaceWritingPreviewReportArtifactBinding(
            prepared.binding,
          ),
        AiChartD1PalaceWritingPreviewReportArtifactBindingError,
      )
    },
  )

  await check(
    'non-test execution and adapter exceptions reveal no provider, owner, or report content',
    async () => {
      const productionPortContract =
        await createProductionPortContract()
      let adapterInvocations = 0
      const mutableEnvironment = process.env as Record<
        string,
        string | undefined
      >
      const previousNodeEnvironment =
        mutableEnvironment.NODE_ENV
      mutableEnvironment.NODE_ENV = 'production'
      try {
        await assert.rejects(
          () =>
            prepareAiChartD1PalaceWritingPreviewReportArtifactBinding(
              {
                productionPortContract,
                resolveReportSubjectFake: async (command) => {
                  adapterInvocations += 1
                  return createReportSubjectOutcome(command)
                },
              },
            ),
          AiChartD1PalaceWritingPreviewReportArtifactBindingError,
        )
      } finally {
        if (previousNodeEnvironment === undefined) {
          delete mutableEnvironment.NODE_ENV
        } else {
          mutableEnvironment.NODE_ENV =
            previousNodeEnvironment
        }
      }
      assert.equal(adapterInvocations, 0)

      const sensitiveMarker =
        'sensitive-owner-and-chart-content'
      const errorContract =
        await createProductionPortContract()
      let caught: unknown
      try {
        await prepareAiChartD1PalaceWritingPreviewReportArtifactBinding(
          {
            productionPortContract: errorContract,
            resolveReportSubjectFake: async () => {
              throw new Error(sensitiveMarker)
            },
          },
        )
      } catch (error) {
        caught = error
      }
      assert.ok(
        caught instanceof
          AiChartD1PalaceWritingPreviewReportArtifactBindingError,
      )
      assert.equal(
        JSON.stringify(caught).includes(sensitiveMarker),
        false,
      )
      assert.equal(
        String(caught).includes(sensitiveMarker),
        false,
      )
    },
  )

  await check(
    'all human decisions retain canonical metadata while Report binding never releases delivery',
    async () => {
      const cases = [
        [
          'APPROVED',
          [],
          'BLOCKED_PENDING_TRUSTED_REVIEW_RECORD',
        ],
        [
          'REPAIR_REQUIRED',
          ['SOCIAL_CONTEXT_MISMATCH'],
          'BLOCKED_REPAIR_REQUIRED',
        ],
        [
          'REJECTED',
          ['UNSAFE_OR_UNSUPPORTED_CONTENT'],
          'BLOCKED_REJECTED',
        ],
      ] as const
      for (
        const [
          decision,
          issueCodes,
          customerDeliveryStatus,
        ] of cases
      ) {
        const productionPortContract =
          await createProductionPortContract(
            decision,
            issueCodes,
          )
        const prepared =
          await prepareAiChartD1PalaceWritingPreviewReportArtifactBinding(
            {
              productionPortContract,
              resolveReportSubjectFake:
                async (command) =>
                  createReportSubjectOutcome(command),
            },
          )
        assert.equal(prepared.binding.decision, decision)
        assert.deepEqual(
          prepared.binding.issueCodes,
          issueCodes,
        )
        assert.equal(
          prepared.binding.customerDeliveryStatus,
          customerDeliveryStatus,
        )
        assert.equal(
          prepared.binding.formalReviewRecordAllowed,
          false,
        )
        assert.equal(
          prepared.binding.customerDeliveryAllowed,
          false,
        )
        assert.equal(prepared.binding.openAiRequests, 0)
      }
    },
  )

  console.log(
    `D1 palace-writing Report artifact binding contracts: ${checks} checks passed`,
  )
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
