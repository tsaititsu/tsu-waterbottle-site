import 'server-only'

import { createHash } from 'node:crypto'
import {
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import {
  parseAiChartD1PalaceWritingPreviewRestrictedArtifact,
} from './d1PalaceWritingPreviewRestrictedArtifactContracts.server'
import {
  AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_READBACK_TASK,
  AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_READBACK_VERSION,
} from './d1PalaceWritingPreviewRestrictedArtifactReadback.server'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'

export const AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_DECISION_VERSION =
  'ai-chart-d1-palace-writing-preview-human-review-decision/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_DECISION_TASK =
  'D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_DECISION' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_DECISION_INVALID =
  'ai_chart_d1_palace_writing_preview_human_review_decision_invalid' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_ISSUE_CODES =
  Object.freeze([
    'LANGUAGE_CLARITY_INSUFFICIENT',
    'POSSIBILITY_BOUNDARY_OVERSTATED',
    'SOCIAL_CONTEXT_MISMATCH',
    'SOURCE_FAITHFULNESS_CONCERN',
    'INTERNAL_METADATA_EXPOSED',
    'UNSAFE_OR_UNSUPPORTED_CONTENT',
  ] as const)

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const VERIFIED_RESTRICTED_ARTIFACT_FIELDS = Object.freeze([
  'contractVersion',
  'task',
  'gateFingerprint',
  'authority',
  'dataClassification',
  'artifactName',
  'restrictedArtifactFingerprint',
  'artifactPayloadSha256',
  'status',
  'restrictedArtifact',
  'accessPolicy',
  'humanReviewStatus',
  'customerDeliveryStatus',
  'safeEvidenceArtifactStatus',
] as const)
const INPUT_FIELDS = Object.freeze([
  'previewPlan',
  'gatePlan',
  'verifiedEvidence',
  'writingPromptPackage',
  'fidelityPromptPackage',
  'verifiedRestrictedArtifact',
  'decision',
  'issueCodes',
] as const)
const REVIEW_DECISIONS = Object.freeze([
  'APPROVED',
  'REPAIR_REQUIRED',
  'REJECTED',
] as const)

export type AiChartD1PalaceWritingPreviewHumanReviewDecision =
  (typeof REVIEW_DECISIONS)[number]
export type AiChartD1PalaceWritingPreviewHumanReviewIssueCode =
  (typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_ISSUE_CODES)[number]

export type AiChartD1PalaceWritingPreviewHumanReviewDecisionProposal =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_DECISION_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_DECISION_TASK
    gateFingerprint: string
    restrictedArtifactFingerprint: string
    artifactPayloadSha256: string
    dataClassification: 'HUMAN_REVIEW_DECISION_METADATA'
    decision:
      AiChartD1PalaceWritingPreviewHumanReviewDecision
    issueCodes:
      readonly AiChartD1PalaceWritingPreviewHumanReviewIssueCode[]
    decisionStatus: 'PROPOSED_NOT_AUTHORIZED'
    decisionAuthority:
      'TRUSTED_HUMAN_REVIEW_ADAPTER_REQUIRED'
    reviewerIdentityStatus: 'NOT_VERIFIED'
    persistenceStatus: 'NOT_RECORDED'
    customerDeliveryStatus:
      | 'BLOCKED_PENDING_TRUSTED_REVIEW_RECORD'
      | 'BLOCKED_REPAIR_REQUIRED'
      | 'BLOCKED_REJECTED'
    nextRequiredAction:
      | 'RECORD_APPROVAL_WITH_TRUSTED_HUMAN_REVIEW_ADAPTER'
      | 'RECORD_REPAIR_DECISION_WITH_TRUSTED_HUMAN_REVIEW_ADAPTER'
      | 'RECORD_REJECTION_WITH_TRUSTED_HUMAN_REVIEW_ADAPTER'
    proposalFingerprint: string
  }>

export class AiChartD1PalaceWritingPreviewHumanReviewDecisionError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_DECISION_INVALID

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_DECISION_INVALID,
    )
    Object.defineProperty(this, 'name', {
      value:
        'AiChartD1PalaceWritingPreviewHumanReviewDecisionError',
      enumerable: false,
      configurable: true,
    })
    Object.freeze(this)
  }
}

function invalid(): never {
  throw new AiChartD1PalaceWritingPreviewHumanReviewDecisionError()
}

function sha256Canonical(value: unknown): string {
  return createHash('sha256')
    .update(
      createAiChartD1PalaceWritingCanonicalJson(value),
      'utf8',
    )
    .digest('hex')
}

function parseDecision(
  value: unknown,
): AiChartD1PalaceWritingPreviewHumanReviewDecision {
  if (
    typeof value !== 'string' ||
    !REVIEW_DECISIONS.includes(
      value as AiChartD1PalaceWritingPreviewHumanReviewDecision,
    )
  ) {
    invalid()
  }
  return value as AiChartD1PalaceWritingPreviewHumanReviewDecision
}

function parseIssueCodes(
  value: unknown,
  decision:
    AiChartD1PalaceWritingPreviewHumanReviewDecision,
): readonly AiChartD1PalaceWritingPreviewHumanReviewIssueCode[] {
  if (!Array.isArray(value)) invalid()
  const issueCodes = value.map((item) => {
    if (
      typeof item !== 'string' ||
      !AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_ISSUE_CODES.includes(
        item as AiChartD1PalaceWritingPreviewHumanReviewIssueCode,
      )
    ) {
      invalid()
    }
    return item as AiChartD1PalaceWritingPreviewHumanReviewIssueCode
  })
  if (
    new Set(issueCodes).size !== issueCodes.length ||
    (decision === 'APPROVED' && issueCodes.length !== 0) ||
    (decision !== 'APPROVED' && issueCodes.length === 0)
  ) {
    invalid()
  }
  const selected = new Set(issueCodes)
  return Object.freeze(
    AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_ISSUE_CODES.filter(
      (issueCode) => selected.has(issueCode),
    ),
  )
}

function customerDeliveryStatusForDecision(
  decision:
    AiChartD1PalaceWritingPreviewHumanReviewDecision,
):
  | 'BLOCKED_PENDING_TRUSTED_REVIEW_RECORD'
  | 'BLOCKED_REPAIR_REQUIRED'
  | 'BLOCKED_REJECTED' {
  if (decision === 'APPROVED') {
    return 'BLOCKED_PENDING_TRUSTED_REVIEW_RECORD'
  }
  return decision === 'REPAIR_REQUIRED'
    ? 'BLOCKED_REPAIR_REQUIRED'
    : 'BLOCKED_REJECTED'
}

function nextRequiredActionForDecision(
  decision:
    AiChartD1PalaceWritingPreviewHumanReviewDecision,
):
  | 'RECORD_APPROVAL_WITH_TRUSTED_HUMAN_REVIEW_ADAPTER'
  | 'RECORD_REPAIR_DECISION_WITH_TRUSTED_HUMAN_REVIEW_ADAPTER'
  | 'RECORD_REJECTION_WITH_TRUSTED_HUMAN_REVIEW_ADAPTER' {
  if (decision === 'APPROVED') {
    return 'RECORD_APPROVAL_WITH_TRUSTED_HUMAN_REVIEW_ADAPTER'
  }
  return decision === 'REPAIR_REQUIRED'
    ? 'RECORD_REPAIR_DECISION_WITH_TRUSTED_HUMAN_REVIEW_ADAPTER'
    : 'RECORD_REJECTION_WITH_TRUSTED_HUMAN_REVIEW_ADAPTER'
}

function parseVerifiedRestrictedArtifact(
  value: unknown,
  sourceRecord: Readonly<Record<string, unknown>>,
): Readonly<{
  gateFingerprint: string
  restrictedArtifactFingerprint: string
  artifactPayloadSha256: string
}> {
  assertAiChartD1SafeGraph(value)
  const record = requireAiChartD1ExactObject(
    value,
    VERIFIED_RESTRICTED_ARTIFACT_FIELDS,
  )
  const restrictedArtifact =
    parseAiChartD1PalaceWritingPreviewRestrictedArtifact(
      record.restrictedArtifact,
      sourceRecord.previewPlan,
      sourceRecord.gatePlan,
      sourceRecord.verifiedEvidence,
      sourceRecord.writingPromptPackage,
      sourceRecord.fidelityPromptPackage,
    )
  const artifactPayloadSha256 =
    sha256Canonical(restrictedArtifact)
  if (
    record.contractVersion !==
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_READBACK_VERSION ||
    record.task !==
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_READBACK_TASK ||
    record.gateFingerprint !==
      restrictedArtifact.gateFingerprint ||
    record.authority !==
      'TRUSTED_SERVER_RESTRICTED_ARTIFACT_READBACK_ADAPTER' ||
    record.dataClassification !== 'RESTRICTED_MODEL_OUTPUT' ||
    record.artifactName !== 'restricted-result.json' ||
    typeof record.restrictedArtifactFingerprint !== 'string' ||
    !SHA256_PATTERN.test(
      record.restrictedArtifactFingerprint,
    ) ||
    record.restrictedArtifactFingerprint !==
      restrictedArtifact.artifactFingerprint ||
    typeof record.artifactPayloadSha256 !== 'string' ||
    !SHA256_PATTERN.test(record.artifactPayloadSha256) ||
    record.artifactPayloadSha256 !== artifactPayloadSha256 ||
    record.status !== 'VERIFIED' ||
    record.accessPolicy !==
      'SERVER_ONLY_EXPLICIT_HUMAN_REVIEW' ||
    record.humanReviewStatus !== 'NOT_REVIEWED' ||
    record.customerDeliveryStatus !==
      'BLOCKED_PENDING_HUMAN_REVIEW' ||
    record.safeEvidenceArtifactStatus !==
      'SEPARATE_ALREADY_VERIFIED_NOT_INCLUDED'
  ) {
    invalid()
  }
  return freezeAiChartD1Value({
    gateFingerprint: restrictedArtifact.gateFingerprint,
    restrictedArtifactFingerprint:
      restrictedArtifact.artifactFingerprint,
    artifactPayloadSha256,
  })
}

export function buildAiChartD1PalaceWritingPreviewHumanReviewDecisionProposal(
  input: Readonly<{
    previewPlan: unknown
    gatePlan: unknown
    verifiedEvidence: unknown
    writingPromptPackage: unknown
    fidelityPromptPackage: unknown
    verifiedRestrictedArtifact: unknown
    decision: unknown
    issueCodes: unknown
  }>,
): AiChartD1PalaceWritingPreviewHumanReviewDecisionProposal {
  try {
    assertAiChartD1SafeGraph(input)
    const record = requireAiChartD1ExactObject(
      input,
      INPUT_FIELDS,
    )
    const verifiedRestrictedArtifact =
      parseVerifiedRestrictedArtifact(
        record.verifiedRestrictedArtifact,
        record,
      )
    const decision = parseDecision(record.decision)
    const issueCodes = parseIssueCodes(
      record.issueCodes,
      decision,
    )
    const withoutFingerprint = {
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_DECISION_VERSION,
      task:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_DECISION_TASK,
      gateFingerprint:
        verifiedRestrictedArtifact.gateFingerprint,
      restrictedArtifactFingerprint:
        verifiedRestrictedArtifact.restrictedArtifactFingerprint,
      artifactPayloadSha256:
        verifiedRestrictedArtifact.artifactPayloadSha256,
      dataClassification:
        'HUMAN_REVIEW_DECISION_METADATA' as const,
      decision,
      issueCodes,
      decisionStatus: 'PROPOSED_NOT_AUTHORIZED' as const,
      decisionAuthority:
        'TRUSTED_HUMAN_REVIEW_ADAPTER_REQUIRED' as const,
      reviewerIdentityStatus: 'NOT_VERIFIED' as const,
      persistenceStatus: 'NOT_RECORDED' as const,
      customerDeliveryStatus:
        customerDeliveryStatusForDecision(decision),
      nextRequiredAction:
        nextRequiredActionForDecision(decision),
    }
    return freezeAiChartD1Value({
      ...withoutFingerprint,
      proposalFingerprint:
        sha256Canonical(withoutFingerprint),
    })
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingPreviewHumanReviewDecisionError
    ) {
      throw error
    }
    invalid()
  }
}
