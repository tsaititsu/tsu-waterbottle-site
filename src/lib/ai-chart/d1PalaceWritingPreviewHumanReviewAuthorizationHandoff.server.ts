import 'server-only'

import { createHash } from 'node:crypto'
import {
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import {
  AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_DECISION_TASK,
  AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_DECISION_VERSION,
  AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_ISSUE_CODES,
  type AiChartD1PalaceWritingPreviewHumanReviewDecision,
  type AiChartD1PalaceWritingPreviewHumanReviewDecisionProposal,
  type AiChartD1PalaceWritingPreviewHumanReviewIssueCode,
} from './d1PalaceWritingPreviewHumanReviewDecisionContracts.server'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'

export const AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_ADAPTER_COMMAND_VERSION =
  'ai-chart-d1-palace-writing-preview-human-review-authorization-adapter-command/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_ADAPTER_COMMAND_TASK =
  'D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_ADAPTER_COMMAND' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_HANDOFF_VERSION =
  'ai-chart-d1-palace-writing-preview-human-review-authorization-handoff/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_HANDOFF_TASK =
  'D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_HANDOFF' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_HANDOFF_PREPARATION_VERSION =
  'ai-chart-d1-palace-writing-preview-human-review-authorization-handoff-preparation/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_HANDOFF_PREPARATION_TASK =
  'D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_HANDOFF_PREPARATION' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_HANDOFF_CONSUMPTION_VERSION =
  'ai-chart-d1-palace-writing-preview-human-review-authorization-handoff-consumption/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_HANDOFF_CONSUMPTION_TASK =
  'D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_HANDOFF_CONSUMPTION' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PERMISSION =
  'AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_HANDOFF_INVALID =
  'ai_chart_d1_palace_writing_preview_human_review_authorization_handoff_invalid' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_HANDOFF_ALREADY_CONSUMED =
  'ai_chart_d1_palace_writing_preview_human_review_authorization_handoff_already_consumed' as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const INPUT_FIELDS = Object.freeze([
  'decisionProposal',
  'verifyReviewerAuthorizationFake',
] as const)
const PROPOSAL_FIELDS = Object.freeze([
  'contractVersion',
  'task',
  'gateFingerprint',
  'restrictedArtifactFingerprint',
  'artifactPayloadSha256',
  'dataClassification',
  'decision',
  'issueCodes',
  'decisionStatus',
  'decisionAuthority',
  'reviewerIdentityStatus',
  'persistenceStatus',
  'customerDeliveryStatus',
  'nextRequiredAction',
  'proposalFingerprint',
] as const)
const AUTHORIZATION_OUTCOME_FIELDS = Object.freeze([
  'adapterMode',
  'authorizationStatus',
  'reviewerSessionStatus',
  'permission',
  'proposalFingerprint',
  'gateFingerprint',
  'restrictedArtifactFingerprint',
  'artifactPayloadSha256',
] as const)
const REVIEW_DECISIONS = Object.freeze([
  'APPROVED',
  'REPAIR_REQUIRED',
  'REJECTED',
] as const)

export type AiChartD1PalaceWritingPreviewHumanReviewAuthorizationAdapterCommand =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_ADAPTER_COMMAND_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_ADAPTER_COMMAND_TASK
    adapterMode: 'INJECTED_AUTHORIZATION_PROBE_ONLY'
    sequence: 1
    requiredPermission:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PERMISSION
    proposalFingerprint: string
    gateFingerprint: string
    restrictedArtifactFingerprint: string
    artifactPayloadSha256: string
    decision:
      AiChartD1PalaceWritingPreviewHumanReviewDecision
    issueCodes:
      readonly AiChartD1PalaceWritingPreviewHumanReviewIssueCode[]
  }>

export type AiChartD1PalaceWritingPreviewHumanReviewAuthorizationAdapterFake =
  (
    command:
      AiChartD1PalaceWritingPreviewHumanReviewAuthorizationAdapterCommand,
  ) => Promise<unknown>

export type AiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_HANDOFF_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_HANDOFF_TASK
    gateFingerprint: string
    restrictedArtifactFingerprint: string
    artifactPayloadSha256: string
    proposalFingerprint: string
    decision:
      AiChartD1PalaceWritingPreviewHumanReviewDecision
    issueCodes:
      readonly AiChartD1PalaceWritingPreviewHumanReviewIssueCode[]
    status: 'READY_NOT_CONSUMED'
    capabilityScope: 'IN_PROCESS_EXACT_OBJECT_IDENTITY'
    adapterMode: 'OFFLINE_SYNTHETIC_ADAPTER_PROBE_ONLY'
    authorizationStatus:
      'SYNTHETIC_AUTHORIZED_NOT_PRODUCTION'
    reviewerSessionStatus: 'SYNTHETIC_VERIFIED'
    reviewerPermission:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PERMISSION
    reviewerPermissionStatus: 'SYNTHETIC_GRANTED'
    persistenceStatus: 'NOT_RECORDED'
    customerDeliveryStatus:
      AiChartD1PalaceWritingPreviewHumanReviewDecisionProposal['customerDeliveryStatus']
    formalReviewRecordAllowed: false
    productionCallable: false
    openAiRequests: 0
  }>

export type AiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoffPreparation =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_HANDOFF_PREPARATION_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_HANDOFF_PREPARATION_TASK
    status: 'READY_STOPPED'
    stage: 'OFFLINE_AUTHORIZATION_HANDOFF_CREATED'
    nextRequiredAction:
      'CONSUME_OFFLINE_HANDOFF_ONCE'
    handoff:
      AiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff
    productionCallable: false
    formalReviewRecordAllowed: false
    openAiRequests: 0
  }>

export type AiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoffConsumption =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_HANDOFF_CONSUMPTION_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_HANDOFF_CONSUMPTION_TASK
    gateFingerprint: string
    restrictedArtifactFingerprint: string
    artifactPayloadSha256: string
    proposalFingerprint: string
    decision:
      AiChartD1PalaceWritingPreviewHumanReviewDecision
    issueCodes:
      readonly AiChartD1PalaceWritingPreviewHumanReviewIssueCode[]
    status: 'CONSUMED_STOPPED'
    stage: 'OFFLINE_AUTHORIZATION_HANDOFF_CONSUMED'
    capabilityScope: 'IN_PROCESS_EXACT_OBJECT_IDENTITY'
    adapterMode: 'OFFLINE_SYNTHETIC_ADAPTER_PROBE_ONLY'
    authorizationStatus:
      'SYNTHETIC_AUTHORIZED_NOT_PRODUCTION'
    reviewerSessionStatus: 'SYNTHETIC_VERIFIED'
    reviewerPermission:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PERMISSION
    reviewerPermissionStatus: 'SYNTHETIC_GRANTED'
    persistenceStatus: 'NOT_RECORDED'
    customerDeliveryStatus:
      AiChartD1PalaceWritingPreviewHumanReviewDecisionProposal['customerDeliveryStatus']
    nextRequiredAction:
      'IMPLEMENT_PRODUCTION_HUMAN_REVIEW_AUTHORIZATION_ADAPTER'
    formalReviewRecordAllowed: false
    productionCallable: false
    openAiRequests: 0
  }>

type HandoffBinding = Readonly<{
  gateFingerprint: string
  restrictedArtifactFingerprint: string
  artifactPayloadSha256: string
  proposalFingerprint: string
  decision:
    AiChartD1PalaceWritingPreviewHumanReviewDecision
  issueCodes:
    readonly AiChartD1PalaceWritingPreviewHumanReviewIssueCode[]
  customerDeliveryStatus:
    AiChartD1PalaceWritingPreviewHumanReviewDecisionProposal['customerDeliveryStatus']
}>

const activeHandoffs = new WeakMap<
  AiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff,
  HandoffBinding
>()
const consumedHandoffs =
  new WeakSet<AiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff>()

export class AiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoffError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_HANDOFF_INVALID

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_HANDOFF_INVALID,
    )
    this.name =
      'AiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoffError'
    Object.freeze(this)
  }
}

export class AiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoffAlreadyConsumedError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_HANDOFF_ALREADY_CONSUMED

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_HANDOFF_ALREADY_CONSUMED,
    )
    this.name =
      'AiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoffAlreadyConsumedError'
    Object.freeze(this)
  }
}

function invalid(): never {
  throw new AiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoffError()
}

function alreadyConsumed(): never {
  throw new AiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoffAlreadyConsumedError()
}

function sha256Canonical(value: unknown): string {
  return createHash('sha256')
    .update(
      createAiChartD1PalaceWritingCanonicalJson(value),
      'utf8',
    )
    .digest('hex')
}

function parseSha256(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !SHA256_PATTERN.test(value)
  ) {
    invalid()
  }
  return value
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
  const selected = new Set(issueCodes)
  const canonical =
    AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_ISSUE_CODES.filter(
      (issueCode) => selected.has(issueCode),
    )
  if (
    selected.size !== issueCodes.length ||
    canonical.some(
      (issueCode, index) =>
        issueCode !== issueCodes[index],
    ) ||
    (decision === 'APPROVED' && issueCodes.length !== 0) ||
    (decision !== 'APPROVED' && issueCodes.length === 0)
  ) {
    invalid()
  }
  return Object.freeze(canonical)
}

function customerDeliveryStatusForDecision(
  decision:
    AiChartD1PalaceWritingPreviewHumanReviewDecision,
):
  AiChartD1PalaceWritingPreviewHumanReviewDecisionProposal['customerDeliveryStatus'] {
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
  AiChartD1PalaceWritingPreviewHumanReviewDecisionProposal['nextRequiredAction'] {
  if (decision === 'APPROVED') {
    return 'RECORD_APPROVAL_WITH_TRUSTED_HUMAN_REVIEW_ADAPTER'
  }
  return decision === 'REPAIR_REQUIRED'
    ? 'RECORD_REPAIR_DECISION_WITH_TRUSTED_HUMAN_REVIEW_ADAPTER'
    : 'RECORD_REJECTION_WITH_TRUSTED_HUMAN_REVIEW_ADAPTER'
}

function parseDecisionProposal(
  value: unknown,
): AiChartD1PalaceWritingPreviewHumanReviewDecisionProposal {
  assertAiChartD1SafeGraph(value)
  const record = requireAiChartD1ExactObject(
    value,
    PROPOSAL_FIELDS,
  )
  const gateFingerprint =
    parseSha256(record.gateFingerprint)
  const restrictedArtifactFingerprint =
    parseSha256(record.restrictedArtifactFingerprint)
  const artifactPayloadSha256 =
    parseSha256(record.artifactPayloadSha256)
  const decision = parseDecision(record.decision)
  const issueCodes = parseIssueCodes(
    record.issueCodes,
    decision,
  )
  const expectedCustomerDeliveryStatus =
    customerDeliveryStatusForDecision(decision)
  const expectedNextRequiredAction =
    nextRequiredActionForDecision(decision)
  const withoutFingerprint = {
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_DECISION_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_DECISION_TASK,
    gateFingerprint,
    restrictedArtifactFingerprint,
    artifactPayloadSha256,
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
      expectedCustomerDeliveryStatus,
    nextRequiredAction: expectedNextRequiredAction,
  }
  const proposalFingerprint =
    parseSha256(record.proposalFingerprint)
  if (
    record.contractVersion !==
      withoutFingerprint.contractVersion ||
    record.task !== withoutFingerprint.task ||
    record.dataClassification !==
      withoutFingerprint.dataClassification ||
    record.decisionStatus !==
      withoutFingerprint.decisionStatus ||
    record.decisionAuthority !==
      withoutFingerprint.decisionAuthority ||
    record.reviewerIdentityStatus !==
      withoutFingerprint.reviewerIdentityStatus ||
    record.persistenceStatus !==
      withoutFingerprint.persistenceStatus ||
    record.customerDeliveryStatus !==
      expectedCustomerDeliveryStatus ||
    record.nextRequiredAction !==
      expectedNextRequiredAction ||
    proposalFingerprint !==
      sha256Canonical(withoutFingerprint)
  ) {
    invalid()
  }
  return freezeAiChartD1Value({
    ...withoutFingerprint,
    proposalFingerprint,
  })
}

function createAdapterCommand(
  proposal:
    AiChartD1PalaceWritingPreviewHumanReviewDecisionProposal,
): AiChartD1PalaceWritingPreviewHumanReviewAuthorizationAdapterCommand {
  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_ADAPTER_COMMAND_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_ADAPTER_COMMAND_TASK,
    adapterMode:
      'INJECTED_AUTHORIZATION_PROBE_ONLY' as const,
    sequence: 1 as const,
    requiredPermission:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PERMISSION,
    proposalFingerprint:
      proposal.proposalFingerprint,
    gateFingerprint: proposal.gateFingerprint,
    restrictedArtifactFingerprint:
      proposal.restrictedArtifactFingerprint,
    artifactPayloadSha256:
      proposal.artifactPayloadSha256,
    decision: proposal.decision,
    issueCodes: proposal.issueCodes,
  })
}

function parseAuthorizedOutcome(
  value: unknown,
  proposal:
    AiChartD1PalaceWritingPreviewHumanReviewDecisionProposal,
): void {
  assertAiChartD1SafeGraph(value)
  const record = requireAiChartD1ExactObject(
    value,
    AUTHORIZATION_OUTCOME_FIELDS,
  )
  if (
    record.adapterMode !==
      'INJECTED_AUTHORIZATION_PROBE_ONLY' ||
    record.authorizationStatus !== 'AUTHORIZED' ||
    record.reviewerSessionStatus !== 'VERIFIED' ||
    record.permission !==
      AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PERMISSION ||
    record.proposalFingerprint !==
      proposal.proposalFingerprint ||
    record.gateFingerprint !==
      proposal.gateFingerprint ||
    record.restrictedArtifactFingerprint !==
      proposal.restrictedArtifactFingerprint ||
    record.artifactPayloadSha256 !==
      proposal.artifactPayloadSha256
  ) {
    invalid()
  }
}

function createHandoff(
  proposal:
    AiChartD1PalaceWritingPreviewHumanReviewDecisionProposal,
): AiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff {
  const handoff = freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_HANDOFF_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_HANDOFF_TASK,
    gateFingerprint: proposal.gateFingerprint,
    restrictedArtifactFingerprint:
      proposal.restrictedArtifactFingerprint,
    artifactPayloadSha256:
      proposal.artifactPayloadSha256,
    proposalFingerprint:
      proposal.proposalFingerprint,
    decision: proposal.decision,
    issueCodes: proposal.issueCodes,
    status: 'READY_NOT_CONSUMED' as const,
    capabilityScope:
      'IN_PROCESS_EXACT_OBJECT_IDENTITY' as const,
    adapterMode:
      'OFFLINE_SYNTHETIC_ADAPTER_PROBE_ONLY' as const,
    authorizationStatus:
      'SYNTHETIC_AUTHORIZED_NOT_PRODUCTION' as const,
    reviewerSessionStatus:
      'SYNTHETIC_VERIFIED' as const,
    reviewerPermission:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PERMISSION,
    reviewerPermissionStatus:
      'SYNTHETIC_GRANTED' as const,
    persistenceStatus: 'NOT_RECORDED' as const,
    customerDeliveryStatus:
      proposal.customerDeliveryStatus,
    formalReviewRecordAllowed: false as const,
    productionCallable: false as const,
    openAiRequests: 0 as const,
  })
  activeHandoffs.set(
    handoff,
    freezeAiChartD1Value({
      gateFingerprint: proposal.gateFingerprint,
      restrictedArtifactFingerprint:
        proposal.restrictedArtifactFingerprint,
      artifactPayloadSha256:
        proposal.artifactPayloadSha256,
      proposalFingerprint:
        proposal.proposalFingerprint,
      decision: proposal.decision,
      issueCodes: proposal.issueCodes,
      customerDeliveryStatus:
        proposal.customerDeliveryStatus,
    }),
  )
  return handoff
}

export async function prepareAiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff(
  input: Readonly<{
    decisionProposal: unknown
    verifyReviewerAuthorizationFake:
      AiChartD1PalaceWritingPreviewHumanReviewAuthorizationAdapterFake
  }>,
): Promise<AiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoffPreparation> {
  try {
    if (process.env.NODE_ENV !== 'test') invalid()
    const record = requireAiChartD1ExactObject(
      input,
      INPUT_FIELDS,
    )
    if (
      typeof record.verifyReviewerAuthorizationFake !==
      'function'
    ) {
      invalid()
    }
    const proposal =
      parseDecisionProposal(record.decisionProposal)
    const command = createAdapterCommand(proposal)
    const outcome = await (
      record.verifyReviewerAuthorizationFake as
        AiChartD1PalaceWritingPreviewHumanReviewAuthorizationAdapterFake
    )(command)
    parseAuthorizedOutcome(outcome, proposal)
    const handoff = createHandoff(proposal)
    return freezeAiChartD1Value({
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_HANDOFF_PREPARATION_VERSION,
      task:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_HANDOFF_PREPARATION_TASK,
      status: 'READY_STOPPED' as const,
      stage:
        'OFFLINE_AUTHORIZATION_HANDOFF_CREATED' as const,
      nextRequiredAction:
        'CONSUME_OFFLINE_HANDOFF_ONCE' as const,
      handoff,
      productionCallable: false as const,
      formalReviewRecordAllowed: false as const,
      openAiRequests: 0 as const,
    })
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoffError
    ) {
      throw error
    }
    invalid()
  }
}

export function consumeAiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff(
  handoffValue: unknown,
): AiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoffConsumption {
  if (
    typeof handoffValue !== 'object' ||
    handoffValue === null
  ) {
    invalid()
  }
  const handoff =
    handoffValue as
      AiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff
  if (consumedHandoffs.has(handoff)) {
    alreadyConsumed()
  }
  const binding = activeHandoffs.get(handoff)
  if (binding === undefined) invalid()

  activeHandoffs.delete(handoff)
  consumedHandoffs.add(handoff)

  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_HANDOFF_CONSUMPTION_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_AUTHORIZATION_HANDOFF_CONSUMPTION_TASK,
    gateFingerprint: binding.gateFingerprint,
    restrictedArtifactFingerprint:
      binding.restrictedArtifactFingerprint,
    artifactPayloadSha256:
      binding.artifactPayloadSha256,
    proposalFingerprint:
      binding.proposalFingerprint,
    decision: binding.decision,
    issueCodes: binding.issueCodes,
    status: 'CONSUMED_STOPPED' as const,
    stage:
      'OFFLINE_AUTHORIZATION_HANDOFF_CONSUMED' as const,
    capabilityScope:
      'IN_PROCESS_EXACT_OBJECT_IDENTITY' as const,
    adapterMode:
      'OFFLINE_SYNTHETIC_ADAPTER_PROBE_ONLY' as const,
    authorizationStatus:
      'SYNTHETIC_AUTHORIZED_NOT_PRODUCTION' as const,
    reviewerSessionStatus:
      'SYNTHETIC_VERIFIED' as const,
    reviewerPermission:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PERMISSION,
    reviewerPermissionStatus:
      'SYNTHETIC_GRANTED' as const,
    persistenceStatus: 'NOT_RECORDED' as const,
    customerDeliveryStatus:
      binding.customerDeliveryStatus,
    nextRequiredAction:
      'IMPLEMENT_PRODUCTION_HUMAN_REVIEW_AUTHORIZATION_ADAPTER' as const,
    formalReviewRecordAllowed: false as const,
    productionCallable: false as const,
    openAiRequests: 0 as const,
  })
}
