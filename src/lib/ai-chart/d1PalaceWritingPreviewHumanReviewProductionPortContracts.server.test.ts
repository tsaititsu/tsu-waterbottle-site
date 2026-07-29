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

const {
  prepareAiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff,
} = authorizationModule
const {
  probeAiChartD1PalaceWritingPreviewHumanReviewRecordPersistence,
} = recordProbeModule
const {
  AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PRODUCTION_PORT_FAILURE_CODES,
  AiChartD1PalaceWritingPreviewHumanReviewProductionPortContractError,
  buildAiChartD1PalaceWritingPreviewHumanReviewProductionPortContract,
} = productionPortModule

const GATE_FINGERPRINT = '1'.repeat(64)
const RESTRICTED_ARTIFACT_FINGERPRINT = '2'.repeat(64)
const ARTIFACT_PAYLOAD_SHA256 = '3'.repeat(64)
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
  decision: 'APPROVED' | 'REPAIR_REQUIRED' | 'REJECTED',
  issueCodes: readonly string[],
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
    issueCodes: Object.freeze(issueCodes),
    proposalFingerprint:
      sha256Canonical(withoutFingerprint),
  })
}

type AuthorizationCommand = import(
  './d1PalaceWritingPreviewHumanReviewAuthorizationHandoff.server'
).AiChartD1PalaceWritingPreviewHumanReviewAuthorizationAdapterCommand

function createAuthorizedOutcome(
  command: AuthorizationCommand,
) {
  return Object.freeze({
    adapterMode:
      'INJECTED_AUTHORIZATION_PROBE_ONLY',
    authorizationStatus: 'AUTHORIZED',
    reviewerSessionStatus: 'VERIFIED',
    permission: REQUIRED_PERMISSION,
    proposalFingerprint: command.proposalFingerprint,
    gateFingerprint: command.gateFingerprint,
    restrictedArtifactFingerprint:
      command.restrictedArtifactFingerprint,
    artifactPayloadSha256:
      command.artifactPayloadSha256,
  })
}

async function createTemplate(
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
          async (command) =>
            createAuthorizedOutcome(command),
      },
    )
  return probeAiChartD1PalaceWritingPreviewHumanReviewRecordPersistence(
    prepared.handoff,
  )
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
    'exact template yields a frozen three-port contract without invoking or implementing Production capabilities',
    async () => {
      const template = await createTemplate()
      const contract =
        buildAiChartD1PalaceWritingPreviewHumanReviewProductionPortContract(
          template,
        )

      assert.deepEqual(contract, {
        contractVersion:
          'ai-chart-d1-palace-writing-preview-human-review-production-port-contract/v1',
        task:
          'D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PRODUCTION_PORT_CONTRACT',
        dataClassification:
          'HUMAN_REVIEW_PRODUCTION_PORT_METADATA',
        sourceTemplateFingerprint:
          template.templateFingerprint,
        gateFingerprint: GATE_FINGERPRINT,
        restrictedArtifactFingerprint:
          RESTRICTED_ARTIFACT_FINGERPRINT,
        artifactPayloadSha256:
          ARTIFACT_PAYLOAD_SHA256,
        proposalFingerprint:
          template.proposalFingerprint,
        decision: 'APPROVED',
        issueCodes: [],
        requiredPermission: REQUIRED_PERMISSION,
        recordArtifactName:
          'human-review-record.json',
        storageScope: 'GATE_FINGERPRINT',
        serialization: 'CANONICAL_JSON_UTF8',
        createMode: 'EXCLUSIVE_CREATE',
        directoryMode: '0700',
        fileMode: '0600',
        overwriteAllowed: false,
        retryAllowed: false,
        requiredPorts: [
          {
            sequence: 1,
            port:
              'VERIFY_REQUEST_BOUND_REVIEWER_AUTHORIZATION',
            requiredInput:
              'SOURCE_BOUND_DECISION_METADATA_ONLY',
            requiredOutput:
              'VERIFIED_REVIEWER_IDENTITY_AND_FIXED_PERMISSION',
            implementationStatus: 'NOT_IMPLEMENTED',
          },
          {
            sequence: 2,
            port: 'READ_TRUSTED_SERVER_CLOCK',
            requiredInput: 'NO_CALLER_TIMESTAMP',
            requiredOutput:
              'RFC3339_UTC_SERVER_TIMESTAMP',
            implementationStatus: 'NOT_IMPLEMENTED',
          },
          {
            sequence: 3,
            port:
              'EXCLUSIVE_CREATE_HUMAN_REVIEW_RECORD',
            requiredInput:
              'MODULE_OWNED_CANONICAL_RECORD_ONLY',
            requiredOutput:
              'WRITE_ONCE_RECORD_RECEIPT',
            implementationStatus: 'NOT_IMPLEMENTED',
          },
        ],
        failureCodes:
          AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PRODUCTION_PORT_FAILURE_CODES,
        authorizationBoundary:
          'REQUEST_BOUND_SERVER_SESSION_ONLY',
        reviewerIdentityBoundary:
          'AUTHORIZED_SERVER_PRINCIPAL_ONLY',
        recordedAtBoundary:
          'TRUSTED_SERVER_CLOCK_ONLY',
        storageBoundary:
          'TRUSTED_ADAPTER_OWNED_GATE_FINGERPRINT_SCOPE',
        sourceAuthorizationMode:
          'OFFLINE_SYNTHETIC_ADAPTER_PROBE_ONLY',
        sourceAcceptedForProduction: false,
        implementationStatus:
          'PORTS_DECLARED_NOT_IMPLEMENTED',
        recordStatus: 'FORMAL_RECORD_NOT_CREATED',
        persistenceStatus: 'NOT_PERSISTED',
        customerDeliveryStatus:
          'BLOCKED_PENDING_TRUSTED_REVIEW_RECORD',
        formalReviewRecordAllowed: false,
        customerDeliveryAllowed: false,
        productionCallable: false,
        adapterInvocations: 0,
        storageWrites: 0,
        openAiRequests: 0,
        nextRequiredAction:
          'SELECT_AND_IMPLEMENT_REQUEST_BOUND_PRODUCTION_ADAPTERS',
        contractFingerprint:
          contract.contractFingerprint,
      })
      assert.match(
        contract.contractFingerprint,
        /^[a-f0-9]{64}$/u,
      )
      assert.equal(recursivelyFrozen(contract), true)
    },
  )

  await check(
    'the fixed failure taxonomy cannot contain provider text or caller-selected values',
    async () => {
      assert.deepEqual(
        AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PRODUCTION_PORT_FAILURE_CODES,
        [
          'AUTHORIZATION_ADAPTER_UNAVAILABLE',
          'REVIEWER_SESSION_INVALID',
          'REVIEWER_PERMISSION_DENIED',
          'REVIEWER_IDENTITY_INVALID',
          'SERVER_CLOCK_UNAVAILABLE',
          'SERVER_TIMESTAMP_INVALID',
          'RECORD_STORAGE_ADAPTER_UNAVAILABLE',
          'RECORD_ALREADY_EXISTS',
          'RECORD_WRITE_FAILED',
          'SOURCE_BINDING_MISMATCH',
        ],
      )
      const serialized = JSON.stringify(
        buildAiChartD1PalaceWritingPreviewHumanReviewProductionPortContract(
          await createTemplate(
            'REPAIR_REQUIRED',
            ['LANGUAGE_CLARITY_INSUFFICIENT'],
          ),
        ),
      )
      for (
        const forbidden of [
          '"reviewerId":',
          '"recordedAt":',
          '"reviewNotes":',
          '"sessionToken":',
          '"authorizationHeader":',
          '"restrictedArtifact":',
          '"prompt":',
          '"birth":',
        ]
      ) {
        assert.equal(
          serialized.includes(forbidden),
          false,
        )
      }
    },
  )

  await check(
    'copy, clone, wrapper, and caller-selected adapter controls cannot cross the port seam',
    async () => {
      const template = await createTemplate()
      const invalidValues = [
        { ...template },
        structuredClone(template),
        {
          template,
          reviewerId: 'caller-selected',
        },
        {
          template,
          recordedAt: '2026-07-28T00:00:00.000Z',
        },
        {
          template,
          authorizeReviewer: async () => true,
        },
        {
          template,
          storageRoot: '/caller-selected',
        },
      ]

      for (const invalidValue of invalidValues) {
        assert.throws(
          () =>
            buildAiChartD1PalaceWritingPreviewHumanReviewProductionPortContract(
              invalidValue,
            ),
          AiChartD1PalaceWritingPreviewHumanReviewProductionPortContractError,
        )
      }

      buildAiChartD1PalaceWritingPreviewHumanReviewProductionPortContract(
        template,
      )
      assert.throws(
        () =>
          buildAiChartD1PalaceWritingPreviewHumanReviewProductionPortContract(
            template,
          ),
        AiChartD1PalaceWritingPreviewHumanReviewProductionPortContractError,
      )
    },
  )

  await check(
    'all decisions remain blocked and no contract can become a formal record or delivery permit',
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
        const contract =
          buildAiChartD1PalaceWritingPreviewHumanReviewProductionPortContract(
            await createTemplate(decision, issueCodes),
          )
        assert.equal(contract.decision, decision)
        assert.deepEqual(
          contract.issueCodes,
          issueCodes,
        )
        assert.equal(
          contract.customerDeliveryStatus,
          customerDeliveryStatus,
        )
        assert.equal(
          contract.formalReviewRecordAllowed,
          false,
        )
        assert.equal(
          contract.customerDeliveryAllowed,
          false,
        )
        assert.equal(contract.productionCallable, false)
        assert.equal(contract.adapterInvocations, 0)
        assert.equal(contract.storageWrites, 0)
        assert.equal(contract.openAiRequests, 0)
      }
    },
  )

  await check(
    'two concurrent port builders can consume the exact template only once',
    async () => {
      const template = await createTemplate()
      const results = await Promise.allSettled([
        Promise.resolve().then(() =>
          buildAiChartD1PalaceWritingPreviewHumanReviewProductionPortContract(
            template,
          ),
        ),
        Promise.resolve().then(() =>
          buildAiChartD1PalaceWritingPreviewHumanReviewProductionPortContract(
            template,
          ),
        ),
      ])

      assert.equal(
        results.filter(
          (result) => result.status === 'fulfilled',
        ).length,
        1,
      )
      assert.equal(
        results.filter(
          (result) => result.status === 'rejected',
        ).length,
        1,
      )
      const rejected = results.find(
        (result) => result.status === 'rejected',
      )
      assert.equal(rejected?.status, 'rejected')
      if (rejected?.status === 'rejected') {
        assert.equal(
          rejected.reason instanceof
            AiChartD1PalaceWritingPreviewHumanReviewProductionPortContractError,
          true,
        )
      }
    },
  )

  await check(
    'non-test execution rejects before consuming the exact template',
    async () => {
      const template = await createTemplate()
      const mutableEnvironment = process.env as Record<
        string,
        string | undefined
      >
      const previousNodeEnv =
        mutableEnvironment.NODE_ENV
      try {
        mutableEnvironment.NODE_ENV = 'production'
        assert.throws(
          () =>
            buildAiChartD1PalaceWritingPreviewHumanReviewProductionPortContract(
              template,
            ),
          AiChartD1PalaceWritingPreviewHumanReviewProductionPortContractError,
        )
      } finally {
        if (previousNodeEnv === undefined) {
          delete mutableEnvironment.NODE_ENV
        } else {
          mutableEnvironment.NODE_ENV = previousNodeEnv
        }
      }

      const contract =
        buildAiChartD1PalaceWritingPreviewHumanReviewProductionPortContract(
          template,
        )
      assert.equal(
        contract.implementationStatus,
        'PORTS_DECLARED_NOT_IMPLEMENTED',
      )
    },
  )

  assert.equal(checks, 6)
  console.log(
    'AI chart D1 palace-writing Production human-review port contract checks passed (6 checks).',
  )
}

void run()
