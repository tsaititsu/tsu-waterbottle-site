import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import Module, { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
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

const {
  prepareAiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff,
} = authorizationModule
const {
  AiChartD1PalaceWritingPreviewHumanReviewRecordPersistenceProbeError,
  probeAiChartD1PalaceWritingPreviewHumanReviewRecordPersistence,
} = recordProbeModule

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

async function prepareHandoff(
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
  return prepared.handoff
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
    'exact synthetic handoff creates one frozen write-once record template without becoming a formal record',
    async () => {
      const handoff = await prepareHandoff()
      const template =
        probeAiChartD1PalaceWritingPreviewHumanReviewRecordPersistence(
          handoff,
        )

      assert.deepEqual(template, {
        contractVersion:
          'ai-chart-d1-palace-writing-preview-human-review-record-persistence-probe/v1',
        task:
          'D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_RECORD_PERSISTENCE_PROBE',
        dataClassification:
          'HUMAN_REVIEW_RECORD_METADATA',
        gateFingerprint: GATE_FINGERPRINT,
        restrictedArtifactFingerprint:
          RESTRICTED_ARTIFACT_FINGERPRINT,
        artifactPayloadSha256:
          ARTIFACT_PAYLOAD_SHA256,
        proposalFingerprint:
          handoff.proposalFingerprint,
        decision: 'APPROVED',
        issueCodes: [],
        recordArtifactName:
          'human-review-record.json',
        storageScope: 'GATE_FINGERPRINT',
        storageAuthority:
          'TRUSTED_SERVER_HUMAN_REVIEW_RECORD_STORAGE_ADAPTER_REQUIRED',
        serialization: 'CANONICAL_JSON_UTF8',
        createMode: 'EXCLUSIVE_CREATE',
        directoryMode: '0700',
        fileMode: '0600',
        overwriteAllowed: false,
        retryAllowed: false,
        sourceAuthorizationMode:
          'OFFLINE_SYNTHETIC_ADAPTER_PROBE_ONLY',
        authorizationBindingStatus:
          'PRODUCTION_HUMAN_REVIEW_AUTHORIZATION_REQUIRED',
        reviewerIdentityBindingStatus:
          'PRODUCTION_REVIEWER_IDENTITY_REQUIRED',
        recordedAtBindingStatus:
          'PRODUCTION_SERVER_CLOCK_REQUIRED',
        recordStatus: 'TEMPLATE_NOT_FORMAL_RECORD',
        persistenceStatus: 'NOT_PERSISTED',
        customerDeliveryStatus:
          'BLOCKED_PENDING_TRUSTED_REVIEW_RECORD',
        formalReviewRecordAllowed: false,
        customerDeliveryAllowed: false,
        productionCallable: false,
        openAiRequests: 0,
        nextRequiredAction:
          'IMPLEMENT_PRODUCTION_HUMAN_REVIEW_AUTHORIZATION_AND_RECORD_WRITER',
        templateFingerprint:
          template.templateFingerprint,
      })
      assert.match(
        template.templateFingerprint,
        /^[a-f0-9]{64}$/u,
      )
      assert.equal(recursivelyFrozen(template), true)
      assert.equal('reviewerId' in template, false)
      assert.equal('recordedAt' in template, false)
      assert.equal('restrictedArtifact' in template, false)
      assert.equal('reviewNotes' in template, false)
    },
  )

  await check(
    'repair and rejection templates preserve their fixed decisions and remain blocked',
    async () => {
      const cases = [
        [
          'REPAIR_REQUIRED',
          ['LANGUAGE_CLARITY_INSUFFICIENT'],
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
        const template =
          probeAiChartD1PalaceWritingPreviewHumanReviewRecordPersistence(
            await prepareHandoff(decision, issueCodes),
          )
        assert.equal(template.decision, decision)
        assert.deepEqual(
          template.issueCodes,
          issueCodes,
        )
        assert.equal(
          template.customerDeliveryStatus,
          customerDeliveryStatus,
        )
        assert.equal(
          template.formalReviewRecordAllowed,
          false,
        )
        assert.equal(
          template.customerDeliveryAllowed,
          false,
        )
      }
    },
  )

  await check(
    'copy, clone, and caller-selected storage controls cannot create a record template',
    async () => {
      const handoff = await prepareHandoff()
      const invalidValues = [
        { ...handoff },
        structuredClone(handoff),
        {
          handoff,
          recordArtifactName: 'caller.json',
        },
        {
          handoff,
          storageRoot: '/caller-selected',
        },
      ]

      for (const invalidValue of invalidValues) {
        assert.throws(
          () =>
            probeAiChartD1PalaceWritingPreviewHumanReviewRecordPersistence(
              invalidValue,
            ),
          AiChartD1PalaceWritingPreviewHumanReviewRecordPersistenceProbeError,
        )
      }

      const template =
        probeAiChartD1PalaceWritingPreviewHumanReviewRecordPersistence(
          handoff,
        )
      assert.equal(
        template.recordArtifactName,
        'human-review-record.json',
      )
      assert.throws(
        () =>
          probeAiChartD1PalaceWritingPreviewHumanReviewRecordPersistence(
            handoff,
          ),
        AiChartD1PalaceWritingPreviewHumanReviewRecordPersistenceProbeError,
      )
    },
  )

  await check(
    'two concurrent template probes can consume the exact handoff only once',
    async () => {
      const handoff = await prepareHandoff()
      const results = await Promise.allSettled([
        Promise.resolve().then(() =>
          probeAiChartD1PalaceWritingPreviewHumanReviewRecordPersistence(
            handoff,
          ),
        ),
        Promise.resolve().then(() =>
          probeAiChartD1PalaceWritingPreviewHumanReviewRecordPersistence(
            handoff,
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
            AiChartD1PalaceWritingPreviewHumanReviewRecordPersistenceProbeError,
          true,
        )
      }
    },
  )

  await check(
    'non-test environment fails before consuming the exact handoff',
    async () => {
      const handoff = await prepareHandoff()
      const mutableEnvironment = process.env as Record<
        string,
        string | undefined
      >
      const originalNodeEnvironment =
        mutableEnvironment.NODE_ENV
      try {
        mutableEnvironment.NODE_ENV = 'production'
        assert.throws(
          () =>
            probeAiChartD1PalaceWritingPreviewHumanReviewRecordPersistence(
              handoff,
            ),
          AiChartD1PalaceWritingPreviewHumanReviewRecordPersistenceProbeError,
        )
      } finally {
        if (originalNodeEnvironment === undefined) {
          delete mutableEnvironment.NODE_ENV
        } else {
          mutableEnvironment.NODE_ENV =
            originalNodeEnvironment
        }
      }

      const template =
        probeAiChartD1PalaceWritingPreviewHumanReviewRecordPersistence(
          handoff,
        )
      assert.equal(
        template.recordStatus,
        'TEMPLATE_NOT_FORMAL_RECORD',
      )
    },
  )

  await check(
    'template source has no filesystem, database, network, secret, reviewer identity, or delivery-release path',
    () => {
      const source = readFileSync(
        fileURLToPath(
          new URL(
            './d1PalaceWritingPreviewHumanReviewRecordPersistenceProbe.server.ts',
            import.meta.url,
          ),
        ),
        'utf8',
      )

      assert.equal(source.split('\n')[0], "import 'server-only'")
      assert.match(source, /TEMPLATE_NOT_FORMAL_RECORD/)
      assert.match(source, /EXCLUSIVE_CREATE/)
      assert.match(source, /overwriteAllowed: false/)
      assert.match(source, /retryAllowed: false/)
      assert.match(
        source,
        /formalReviewRecordAllowed: false/,
      )
      assert.doesNotMatch(
        source,
        /node:fs|fetch\s*\(|OPENAI_API_KEY|Authorization\s*:|writeFile|mkdir|unlink\s*\(|\brm\s*\(|requestAiChartOpenAiStructuredResponse|restrictedArtifact\s*:|reviewerId\s*:|reviewNotes\s*:|recordedAt\s*:|customerDeliveryAllowed:\s*true/,
      )
    },
  )

  console.log(
    `AI Chart D1 palace-writing Preview human-review record persistence probe checks passed: ${checks}`,
  )
}

void run()
