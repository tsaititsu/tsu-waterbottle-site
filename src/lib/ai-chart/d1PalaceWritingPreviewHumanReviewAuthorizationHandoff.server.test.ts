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

let serverModule:
  typeof import(
    './d1PalaceWritingPreviewHumanReviewAuthorizationHandoff.server'
  )

try {
  moduleInternals._resolveFilename =
    function resolveFilenameForTest(
      this: unknown,
      request: string,
      parent: unknown,
      isMain: boolean,
      options?: unknown,
    ) {
      if (request === 'server-only') return serverOnlyStubPath
      return originalResolveFilename.call(
        this,
        request,
        parent,
        isMain,
        options,
      )
    }
  moduleInternals._load = function loadForTest(
    this: unknown,
    request: string,
    parent: unknown,
    isMain: boolean,
  ) {
    if (request === 'server-only') return {}
    return originalLoad.call(
      this,
      request,
      parent,
      isMain,
    )
  }
  serverModule = testRequire(
    './d1PalaceWritingPreviewHumanReviewAuthorizationHandoff.server',
  ) as typeof import(
    './d1PalaceWritingPreviewHumanReviewAuthorizationHandoff.server'
  )
} finally {
  moduleInternals._resolveFilename = originalResolveFilename
  moduleInternals._load = originalLoad
}

const {
  AiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoffAlreadyConsumedError,
  AiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoffError,
  consumeAiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff,
  prepareAiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff,
} = serverModule

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

function createApprovedProposal() {
  return createProposal('APPROVED', [])
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
    issueCodes: Object.freeze(withoutFingerprint.issueCodes),
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

async function prepareFreshHandoff() {
  const prepared =
    await prepareAiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff(
      {
        decisionProposal: createApprovedProposal(),
        verifyReviewerAuthorizationFake: async (command) =>
          createAuthorizedOutcome(command),
      },
    )
  return prepared.handoff
}

async function run(): Promise<void> {
  await check(
    'offline adapter receives one frozen metadata-only command and creates a non-production exact-identity handoff',
    async () => {
      const commands: AuthorizationCommand[] = []
      const prepared =
        await prepareAiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff(
          {
            decisionProposal: createApprovedProposal(),
            verifyReviewerAuthorizationFake:
              async (command) => {
                commands.push(command)
                return createAuthorizedOutcome(command)
              },
          },
        )

      assert.equal(commands.length, 1)
      assert.deepEqual(commands[0], {
        contractVersion:
          'ai-chart-d1-palace-writing-preview-human-review-authorization-adapter-command/v1',
        task:
          'D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_ADAPTER_COMMAND',
        adapterMode:
          'INJECTED_AUTHORIZATION_PROBE_ONLY',
        sequence: 1,
        requiredPermission: REQUIRED_PERMISSION,
        proposalFingerprint:
          prepared.handoff.proposalFingerprint,
        gateFingerprint: GATE_FINGERPRINT,
        restrictedArtifactFingerprint:
          RESTRICTED_ARTIFACT_FINGERPRINT,
        artifactPayloadSha256:
          ARTIFACT_PAYLOAD_SHA256,
        decision: 'APPROVED',
        issueCodes: [],
      })
      assert.equal(recursivelyFrozen(commands[0]), true)
      assert.equal(prepared.status, 'READY_STOPPED')
      assert.equal(
        prepared.stage,
        'OFFLINE_AUTHORIZATION_HANDOFF_CREATED',
      )
      assert.equal(
        prepared.nextRequiredAction,
        'CONSUME_OFFLINE_HANDOFF_ONCE',
      )
      assert.equal(
        prepared.handoff.adapterMode,
        'OFFLINE_SYNTHETIC_ADAPTER_PROBE_ONLY',
      )
      assert.equal(
        prepared.handoff.authorizationStatus,
        'SYNTHETIC_AUTHORIZED_NOT_PRODUCTION',
      )
      assert.equal(
        prepared.handoff.reviewerSessionStatus,
        'SYNTHETIC_VERIFIED',
      )
      assert.equal(
        prepared.handoff.reviewerPermissionStatus,
        'SYNTHETIC_GRANTED',
      )
      assert.equal(prepared.handoff.productionCallable, false)
      assert.equal(
        prepared.handoff.formalReviewRecordAllowed,
        false,
      )
      assert.equal(
        prepared.handoff.persistenceStatus,
        'NOT_RECORDED',
      )
      assert.equal(
        prepared.handoff.customerDeliveryStatus,
        'BLOCKED_PENDING_TRUSTED_REVIEW_RECORD',
      )
      assert.equal(prepared.handoff.openAiRequests, 0)
      assert.equal(
        'reviewerId' in prepared.handoff,
        false,
      )
      assert.equal(
        'restrictedArtifact' in prepared.handoff,
        false,
      )
      assert.equal(recursivelyFrozen(prepared), true)
    },
  )

  await check(
    'repair and rejection proposals preserve canonical issue metadata while remaining blocked and non-production',
    async () => {
      const cases = [
        createProposal('REPAIR_REQUIRED', [
          'LANGUAGE_CLARITY_INSUFFICIENT',
          'SOCIAL_CONTEXT_MISMATCH',
        ]),
        createProposal('REJECTED', [
          'UNSAFE_OR_UNSUPPORTED_CONTENT',
        ]),
      ] as const

      for (const decisionProposal of cases) {
        const prepared =
          await prepareAiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff(
            {
              decisionProposal,
              verifyReviewerAuthorizationFake:
                async (command) =>
                  createAuthorizedOutcome(command),
            },
          )
        assert.equal(
          prepared.handoff.decision,
          decisionProposal.decision,
        )
        assert.deepEqual(
          prepared.handoff.issueCodes,
          decisionProposal.issueCodes,
        )
        assert.equal(
          prepared.handoff.customerDeliveryStatus,
          decisionProposal.customerDeliveryStatus,
        )
        assert.equal(
          prepared.handoff.formalReviewRecordAllowed,
          false,
        )
        assert.equal(
          prepared.handoff.productionCallable,
          false,
        )
      }
    },
  )

  await check(
    'tampered or caller-authorized proposals fail before the injected adapter is called',
    async () => {
      const proposal = createApprovedProposal()
      const invalidProposals = [
        {
          ...proposal,
          proposalFingerprint: '0'.repeat(64),
        },
        {
          ...proposal,
          reviewerIdentityStatus: 'VERIFIED',
        },
        {
          ...proposal,
          reviewerId: 'synthetic-reviewer',
        },
      ]

      for (const decisionProposal of invalidProposals) {
        let calls = 0
        await assert.rejects(
          prepareAiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff(
            {
              decisionProposal,
              verifyReviewerAuthorizationFake:
                async (command) => {
                  calls += 1
                  return createAuthorizedOutcome(command)
                },
            },
          ),
          AiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoffError,
        )
        assert.equal(calls, 0)
      }
    },
  )

  await check(
    'authorization result must bind the exact proposal and fixed permission without leaking adapter errors',
    async () => {
      const sensitiveMarker =
        'synthetic-sensitive-reviewer-session'
      const invalidOutcomes = [
        (command: AuthorizationCommand) => ({
          ...createAuthorizedOutcome(command),
          proposalFingerprint: '0'.repeat(64),
        }),
        (command: AuthorizationCommand) => ({
          ...createAuthorizedOutcome(command),
          reviewerSessionStatus: 'UNVERIFIED',
        }),
        (command: AuthorizationCommand) => ({
          ...createAuthorizedOutcome(command),
          permission: 'ADMIN',
        }),
        (command: AuthorizationCommand) => ({
          ...createAuthorizedOutcome(command),
          reviewerId: sensitiveMarker,
        }),
      ]

      for (const createOutcome of invalidOutcomes) {
        let thrown: unknown
        try {
          await prepareAiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff(
            {
              decisionProposal: createApprovedProposal(),
              verifyReviewerAuthorizationFake:
                async (command) => createOutcome(command),
            },
          )
        } catch (error) {
          thrown = error
        }
        assert.equal(
          thrown instanceof
            AiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoffError,
          true,
        )
        assert.equal(Object.isFrozen(thrown), true)
        assert.equal(
          JSON.stringify(thrown).includes(sensitiveMarker),
          false,
        )
      }

      let thrown: unknown
      try {
        await prepareAiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff(
          {
            decisionProposal: createApprovedProposal(),
            verifyReviewerAuthorizationFake: async () => {
              throw new Error(sensitiveMarker)
            },
          },
        )
      } catch (error) {
        thrown = error
      }
      assert.equal(
        thrown instanceof
          AiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoffError,
        true,
      )
      assert.equal(
        JSON.stringify(thrown).includes(sensitiveMarker),
        false,
      )
    },
  )

  await check(
    'field-equivalent copies are rejected while the exact handoff is consumed once and still cannot create a formal record',
    async () => {
      const handoff = await prepareFreshHandoff()
      assert.throws(
        () =>
          consumeAiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff(
            { ...handoff },
          ),
        AiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoffError,
      )
      assert.throws(
        () =>
          consumeAiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff(
            structuredClone(handoff),
          ),
        AiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoffError,
      )

      const consumed =
        consumeAiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff(
          handoff,
        )
      assert.equal(consumed.status, 'CONSUMED_STOPPED')
      assert.equal(
        consumed.stage,
        'OFFLINE_AUTHORIZATION_HANDOFF_CONSUMED',
      )
      assert.equal(
        consumed.nextRequiredAction,
        'IMPLEMENT_PRODUCTION_HUMAN_REVIEW_AUTHORIZATION_ADAPTER',
      )
      assert.equal(consumed.productionCallable, false)
      assert.equal(
        consumed.formalReviewRecordAllowed,
        false,
      )
      assert.equal(
        consumed.persistenceStatus,
        'NOT_RECORDED',
      )
      assert.equal(
        consumed.customerDeliveryStatus,
        'BLOCKED_PENDING_TRUSTED_REVIEW_RECORD',
      )
      assert.equal(consumed.openAiRequests, 0)
      assert.equal(recursivelyFrozen(consumed), true)
      assert.throws(
        () =>
          consumeAiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff(
            handoff,
          ),
        AiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoffAlreadyConsumedError,
      )
    },
  )

  await check(
    'two concurrent consumers can consume the exact in-process handoff only once',
    async () => {
      const handoff = await prepareFreshHandoff()
      const results = await Promise.allSettled([
        Promise.resolve().then(() =>
          consumeAiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff(
            handoff,
          ),
        ),
        Promise.resolve().then(() =>
          consumeAiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff(
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
            AiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoffAlreadyConsumedError,
          true,
        )
      }
    },
  )

  await check(
    'offline authorization probe fails before adapter invocation outside the canonical test environment',
    async () => {
      let calls = 0
      const mutableEnvironment = process.env as Record<
        string,
        string | undefined
      >
      const originalNodeEnvironment =
        mutableEnvironment.NODE_ENV
      try {
        mutableEnvironment.NODE_ENV = 'production'
        await assert.rejects(
          prepareAiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff(
            {
              decisionProposal: createApprovedProposal(),
              verifyReviewerAuthorizationFake:
                async (command) => {
                  calls += 1
                  return createAuthorizedOutcome(command)
                },
            },
          ),
          AiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoffError,
        )
      } finally {
        if (originalNodeEnvironment === undefined) {
          delete mutableEnvironment.NODE_ENV
        } else {
          mutableEnvironment.NODE_ENV =
            originalNodeEnvironment
        }
      }
      assert.equal(calls, 0)
    },
  )

  await check(
    'server-only handoff contains no storage, network, secret, model-output, or delivery-release path',
    () => {
      const source = readFileSync(
        fileURLToPath(
          new URL(
            './d1PalaceWritingPreviewHumanReviewAuthorizationHandoff.server.ts',
            import.meta.url,
          ),
        ),
        'utf8',
      )

      assert.equal(source.split('\n')[0], "import 'server-only'")
      assert.match(
        source,
        /OFFLINE_SYNTHETIC_ADAPTER_PROBE_ONLY/,
      )
      assert.match(source, /productionCallable: false/)
      assert.match(source, /formalReviewRecordAllowed: false/)
      assert.doesNotMatch(
        source,
        /node:fs|fetch\s*\(|OPENAI_API_KEY|Authorization\s*:|writeFile|mkdir|unlink\s*\(|\brm\s*\(|requestAiChartOpenAiStructuredResponse|restrictedArtifact\s*:|reviewerId\s*:|reviewNotes\s*:|customerDeliveryStatus:\s*'READY'/,
      )
    },
  )

  console.log(
    `AI Chart D1 palace-writing Preview human-review authorization handoff checks passed: ${checks}`,
  )
}

void run()
