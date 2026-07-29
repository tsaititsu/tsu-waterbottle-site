import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import Module, { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
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

function sha256Canonical(
  value: unknown,
  canonicalJson:
    (input: unknown) => string =
      createAiChartD1PalaceWritingCanonicalJson,
): string {
  return createHash('sha256')
    .update(canonicalJson(value), 'utf8')
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

let checks = 0

function check(name: string, runCheck: () => void): void {
  runCheck()
  checks += 1
  console.log(`✓ ${name}`)
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
  createAiChartD1PalaceWritingFidelityCanonicalJson,
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
  const evidenceFingerprint = sha256Canonical(evidence)

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
  const decisionContracts =
    loadServerOnlyModule<
      typeof import('./d1PalaceWritingPreviewHumanReviewDecisionContracts.server')
    >(
      './d1PalaceWritingPreviewHumanReviewDecisionContracts.server',
    )
  const verifiedEvidence = buildSuccessfulVerifiedEvidence()
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
    artifactContracts.buildAiChartD1PalaceWritingPreviewRestrictedArtifact(
      {
        ...sourceInput,
        writingResult: goldenCase.expectedWritingResult,
        fidelityReview:
          goldenCase.expectedFidelityReview,
      },
    )
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
  const buildProposal = (
    decision: unknown,
    issueCodes: unknown,
  ) =>
    decisionContracts.buildAiChartD1PalaceWritingPreviewHumanReviewDecisionProposal(
      {
        ...sourceInput,
        verifiedRestrictedArtifact,
        decision,
        issueCodes,
      },
    )

  check(
    'approved human-review decision remains an unauthorized proposal and cannot release customer delivery',
    () => {
      const proposal = buildProposal('APPROVED', [])

      assert.equal(proposal.decision, 'APPROVED')
      assert.deepEqual(proposal.issueCodes, [])
      assert.equal(
        proposal.decisionStatus,
        'PROPOSED_NOT_AUTHORIZED',
      )
      assert.equal(
        proposal.decisionAuthority,
        'TRUSTED_HUMAN_REVIEW_ADAPTER_REQUIRED',
      )
      assert.equal(
        proposal.reviewerIdentityStatus,
        'NOT_VERIFIED',
      )
      assert.equal(
        proposal.customerDeliveryStatus,
        'BLOCKED_PENDING_TRUSTED_REVIEW_RECORD',
      )
      assert.equal(
        proposal.nextRequiredAction,
        'RECORD_APPROVAL_WITH_TRUSTED_HUMAN_REVIEW_ADAPTER',
      )
      assert.equal(
        proposal.restrictedArtifactFingerprint,
        restrictedArtifact.artifactFingerprint,
      )
      assert.equal('restrictedArtifact' in proposal, false)
      assert.equal('reviewerId' in proposal, false)
      assert.equal('reviewNotes' in proposal, false)
      assert.equal(recursivelyFrozen(proposal), true)
    },
  )

  check(
    'repair and rejection proposals use fixed issue codes and remain blocked',
    () => {
      const repair = buildProposal('REPAIR_REQUIRED', [
        'SOCIAL_CONTEXT_MISMATCH',
        'LANGUAGE_CLARITY_INSUFFICIENT',
      ])
      const rejected = buildProposal('REJECTED', [
        'UNSAFE_OR_UNSUPPORTED_CONTENT',
      ])

      assert.equal(repair.decision, 'REPAIR_REQUIRED')
      assert.deepEqual(repair.issueCodes, [
        'LANGUAGE_CLARITY_INSUFFICIENT',
        'SOCIAL_CONTEXT_MISMATCH',
      ])
      assert.equal(
        repair.customerDeliveryStatus,
        'BLOCKED_REPAIR_REQUIRED',
      )
      assert.equal(
        repair.nextRequiredAction,
        'RECORD_REPAIR_DECISION_WITH_TRUSTED_HUMAN_REVIEW_ADAPTER',
      )
      assert.equal(rejected.decision, 'REJECTED')
      assert.deepEqual(rejected.issueCodes, [
        'UNSAFE_OR_UNSUPPORTED_CONTENT',
      ])
      assert.equal(
        rejected.customerDeliveryStatus,
        'BLOCKED_REJECTED',
      )
      assert.equal(
        rejected.nextRequiredAction,
        'RECORD_REJECTION_WITH_TRUSTED_HUMAN_REVIEW_ADAPTER',
      )
      assert.equal(
        repair.decisionStatus,
        'PROPOSED_NOT_AUTHORIZED',
      )
      assert.equal(
        rejected.decisionStatus,
        'PROPOSED_NOT_AUTHORIZED',
      )
      assert.equal(recursivelyFrozen(repair), true)
      assert.equal(recursivelyFrozen(rejected), true)
    },
  )

  check(
    'decision and issue-code combinations fail closed when empty, duplicated, unknown, or unnecessary',
    () => {
      const invalidCases: ReadonlyArray<
        readonly [unknown, unknown]
      > = [
        ['APPROVED', ['LANGUAGE_CLARITY_INSUFFICIENT']],
        ['REPAIR_REQUIRED', []],
        ['REJECTED', []],
        ['REPAIR_REQUIRED', ['UNKNOWN_DYNAMIC_CODE']],
        [
          'REPAIR_REQUIRED',
          [
            'LANGUAGE_CLARITY_INSUFFICIENT',
            'LANGUAGE_CLARITY_INSUFFICIENT',
          ],
        ],
        ['MAYBE', []],
        ['REJECTED', 'UNSAFE_OR_UNSUPPORTED_CONTENT'],
      ]

      for (const [decision, issueCodes] of invalidCases) {
        assert.throws(
          () => buildProposal(decision, issueCodes),
          decisionContracts.AiChartD1PalaceWritingPreviewHumanReviewDecisionError,
        )
      }
    },
  )

  check(
    'caller identity, authorization, notes, and sensitive additions cannot enter the decision proposal',
    () => {
      const sensitiveMarker =
        'synthetic-sensitive-human-review-note'
      const extraFieldCases = [
        { reviewerId: 'reviewer-1' },
        { reviewerIdentityStatus: 'VERIFIED' },
        { decisionAuthority: 'TRUSTED' },
        { reviewNotes: sensitiveMarker },
        { modelOutput: sensitiveMarker },
      ]

      for (const extraFields of extraFieldCases) {
        let thrown: unknown
        try {
          Reflect.apply(
            decisionContracts.buildAiChartD1PalaceWritingPreviewHumanReviewDecisionProposal,
            undefined,
            [
              {
                ...sourceInput,
                verifiedRestrictedArtifact,
                decision: 'APPROVED',
                issueCodes: [],
                ...extraFields,
              },
            ],
          )
        } catch (error) {
          thrown = error
        }
        assert.equal(
          thrown instanceof
            decisionContracts.AiChartD1PalaceWritingPreviewHumanReviewDecisionError,
          true,
        )
        assert.equal(Object.isFrozen(thrown), true)
        assert.equal(
          JSON.stringify(thrown).includes(sensitiveMarker),
          false,
        )
      }
    },
  )

  check(
    'verified readback and source drift cannot be rebound into a review proposal',
    () => {
      const driftedReadback = {
        ...structuredClone(verifiedRestrictedArtifact),
        artifactPayloadSha256: '0'.repeat(64),
      }
      const driftedGatePlan = {
        ...structuredClone(gatePlan),
        gateFingerprint: 'f'.repeat(64),
      }

      assert.throws(
        () =>
          decisionContracts.buildAiChartD1PalaceWritingPreviewHumanReviewDecisionProposal(
            {
              ...sourceInput,
              verifiedRestrictedArtifact: driftedReadback,
              decision: 'APPROVED',
              issueCodes: [],
            },
          ),
        decisionContracts.AiChartD1PalaceWritingPreviewHumanReviewDecisionError,
      )
      assert.throws(
        () =>
          decisionContracts.buildAiChartD1PalaceWritingPreviewHumanReviewDecisionProposal(
            {
              ...sourceInput,
              gatePlan: driftedGatePlan,
              verifiedRestrictedArtifact,
              decision: 'APPROVED',
              issueCodes: [],
            },
          ),
        decisionContracts.AiChartD1PalaceWritingPreviewHumanReviewDecisionError,
      )
    },
  )

  check(
    'server-only proposal contract has no I/O, Runtime, request, reviewer authorization, or model-output copy',
    () => {
      const source = readFileSync(
        fileURLToPath(
          new URL(
            './d1PalaceWritingPreviewHumanReviewDecisionContracts.server.ts',
            import.meta.url,
          ),
        ),
        'utf8',
      )

      assert.equal(source.split('\n')[0], "import 'server-only'")
      assert.match(
        source,
        /TRUSTED_HUMAN_REVIEW_ADAPTER_REQUIRED/,
      )
      assert.doesNotMatch(
        source,
        /node:fs|fetch\s*\(|OPENAI_API_KEY|Authorization|process\.env|writeFile|mkdir|unlink\s*\(|\brm\s*\(|reviewerId\s*:|reviewNotes\s*:|restrictedArtifact:\s*restrictedArtifact/,
      )
    },
  )

  console.log(
    `AI Chart D1 palace-writing Preview human-review decision checks passed: ${checks}`,
  )
}

void run()
