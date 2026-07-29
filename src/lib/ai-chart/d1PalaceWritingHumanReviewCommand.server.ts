import 'server-only'

import { createHash } from 'node:crypto'
import {
  assertAiChartD1SafeGraph,
  createAiChartD1CanonicalJson,
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import {
  consumeAiChartD1PalaceWritingHumanReviewRequestAuthorization,
} from './d1PalaceWritingHumanReviewRequestAuthorization.server'
import {
  consumeAiChartD1PalaceWritingHumanReviewSourceBinding,
} from './d1PalaceWritingHumanReviewSourceBinding.server'
import {
  AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_DECISION_TASK,
  AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_DECISION_VERSION,
  AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_ISSUE_CODES,
  type AiChartD1PalaceWritingPreviewHumanReviewDecision,
  type AiChartD1PalaceWritingPreviewHumanReviewDecisionProposal,
  type AiChartD1PalaceWritingPreviewHumanReviewIssueCode,
} from './d1PalaceWritingPreviewHumanReviewDecisionContracts.server'
import {
  AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PERMISSION,
} from './d1PalaceWritingPreviewHumanReviewAuthorizationHandoff.server'

export const AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_COMMAND_VERSION =
  'ai-chart-d1-palace-writing-human-review-command/v1' as const
export const AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_COMMAND_TASK =
  'D1_PALACE_WRITING_HUMAN_REVIEW_COMMAND' as const

export const AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_COMMAND_FAILURE_CODES =
  Object.freeze([
    'DECISION_PROPOSAL_INVALID',
    'DECISION_SOURCE_BINDING_MISMATCH',
    'REQUEST_AUTHORIZATION_UNAVAILABLE',
    'SOURCE_BINDING_UNAVAILABLE',
    'REVIEW_COMMAND_UNAVAILABLE',
  ] as const)

export type AiChartD1PalaceWritingHumanReviewCommandFailureCode =
  (typeof AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_COMMAND_FAILURE_CODES)[number]

export type AiChartD1PalaceWritingHumanReviewCommand =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_COMMAND_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_COMMAND_TASK
    dataClassification:
      'AUTHORIZED_SOURCE_BOUND_HUMAN_REVIEW_METADATA'
    reportId: string
    reviewerId: string
    permission:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PERMISSION
    decision:
      AiChartD1PalaceWritingPreviewHumanReviewDecision
    issueCodes:
      readonly AiChartD1PalaceWritingPreviewHumanReviewIssueCode[]
    customerDeliveryStatus:
      AiChartD1PalaceWritingPreviewHumanReviewDecisionProposal['customerDeliveryStatus']
    reportSnapshotSha256: string
    artifactSourceSnapshotSha256: string
    restrictedArtifactFingerprint: string
    artifactPayloadSha256: string
    gateFingerprint: string
    proposalFingerprint: string
    authorizationFingerprint: string
    sourceBindingFingerprint: string
    authorizationStatus:
      'REQUEST_BOUND_SERVER_VERIFIED'
    sourceBindingStatus:
      'SERVER_VERIFIED_EXACT_SNAPSHOT_MATCH'
    commandStatus:
      'AUTHORIZED_SOURCE_BOUND_AWAITING_SERVER_CLOCK_AND_WRITE_ONCE_RECORD'
    capabilityScope:
      'IN_PROCESS_EXACT_OBJECT_IDENTITY'
    productionCallable: true
    trustedServerClockRequired: true
    writeOnceRecordWriterRequired: true
    formalReviewRecordAllowed: false
    customerDeliveryAllowed: false
    openAiRequests: 0
    commandFingerprint: string
  }>

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const INPUT_FIELDS = Object.freeze([
  'requestAuthorization',
  'sourceBinding',
  'decisionProposal',
] as const)
const SOURCE_BINDING_PREVIEW_FIELDS = Object.freeze([
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
] as const)
const DECISION_PROPOSAL_FIELDS = Object.freeze([
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
const REVIEW_DECISIONS = Object.freeze([
  'APPROVED',
  'REPAIR_REQUIRED',
  'REJECTED',
] as const)

const activeCommands = new WeakMap<
  AiChartD1PalaceWritingHumanReviewCommand,
  AiChartD1PalaceWritingHumanReviewCommand
>()
const consumedCommands =
  new WeakSet<AiChartD1PalaceWritingHumanReviewCommand>()

export class AiChartD1PalaceWritingHumanReviewCommandError
  extends Error {
  readonly code:
    AiChartD1PalaceWritingHumanReviewCommandFailureCode

  constructor(
    code:
      AiChartD1PalaceWritingHumanReviewCommandFailureCode,
  ) {
    const safeCode =
      AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_COMMAND_FAILURE_CODES.includes(
        code,
      )
        ? code
        : 'REVIEW_COMMAND_UNAVAILABLE'
    super(safeCode)
    this.name =
      'AiChartD1PalaceWritingHumanReviewCommandError'
    this.code = safeCode
    Object.freeze(this)
  }
}

function fail(
  code:
    AiChartD1PalaceWritingHumanReviewCommandFailureCode,
): never {
  throw new AiChartD1PalaceWritingHumanReviewCommandError(
    code,
  )
}

function sha256Canonical(value: unknown): string {
  return createHash('sha256')
    .update(createAiChartD1CanonicalJson(value), 'utf8')
    .digest('hex')
}

function isSha256(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    SHA256_PATTERN.test(value)
  )
}

function expectedDecisionMetadata(
  decision:
    AiChartD1PalaceWritingPreviewHumanReviewDecision,
) {
  if (decision === 'APPROVED') {
    return {
      customerDeliveryStatus:
        'BLOCKED_PENDING_TRUSTED_REVIEW_RECORD' as const,
      nextRequiredAction:
        'RECORD_APPROVAL_WITH_TRUSTED_HUMAN_REVIEW_ADAPTER' as const,
    }
  }
  if (decision === 'REPAIR_REQUIRED') {
    return {
      customerDeliveryStatus:
        'BLOCKED_REPAIR_REQUIRED' as const,
      nextRequiredAction:
        'RECORD_REPAIR_DECISION_WITH_TRUSTED_HUMAN_REVIEW_ADAPTER' as const,
    }
  }
  return {
    customerDeliveryStatus:
      'BLOCKED_REJECTED' as const,
    nextRequiredAction:
      'RECORD_REJECTION_WITH_TRUSTED_HUMAN_REVIEW_ADAPTER' as const,
  }
}

function parseDecisionProposal(
  value: unknown,
): AiChartD1PalaceWritingPreviewHumanReviewDecisionProposal {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(
      value,
      DECISION_PROPOSAL_FIELDS,
    )
    if (
      record.contractVersion !==
        AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_DECISION_VERSION ||
      record.task !==
        AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_DECISION_TASK ||
      !isSha256(record.gateFingerprint) ||
      !isSha256(record.restrictedArtifactFingerprint) ||
      !isSha256(record.artifactPayloadSha256) ||
      record.dataClassification !==
        'HUMAN_REVIEW_DECISION_METADATA' ||
      typeof record.decision !== 'string' ||
      !REVIEW_DECISIONS.includes(
        record.decision as
          AiChartD1PalaceWritingPreviewHumanReviewDecision,
      ) ||
      !Array.isArray(record.issueCodes) ||
      record.decisionStatus !== 'PROPOSED_NOT_AUTHORIZED' ||
      record.decisionAuthority !==
        'TRUSTED_HUMAN_REVIEW_ADAPTER_REQUIRED' ||
      record.reviewerIdentityStatus !== 'NOT_VERIFIED' ||
      record.persistenceStatus !== 'NOT_RECORDED' ||
      !isSha256(record.proposalFingerprint)
    ) {
      fail('DECISION_PROPOSAL_INVALID')
    }
    const decision =
      record.decision as
        AiChartD1PalaceWritingPreviewHumanReviewDecision
    const issueCodes = record.issueCodes.map((item) => {
      if (
        typeof item !== 'string' ||
        !AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_ISSUE_CODES.includes(
          item as
            AiChartD1PalaceWritingPreviewHumanReviewIssueCode,
        )
      ) {
        fail('DECISION_PROPOSAL_INVALID')
      }
      return item as
        AiChartD1PalaceWritingPreviewHumanReviewIssueCode
    })
    const selectedIssueCodes = new Set(issueCodes)
    const canonicalIssueCodes =
      AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_ISSUE_CODES.filter(
        (issueCode) => selectedIssueCodes.has(issueCode),
      )
    if (
      selectedIssueCodes.size !== issueCodes.length ||
      canonicalIssueCodes.length !== issueCodes.length ||
      canonicalIssueCodes.some(
        (issueCode, index) =>
          issueCode !== issueCodes[index],
      ) ||
      (decision === 'APPROVED' && issueCodes.length !== 0) ||
      (decision !== 'APPROVED' && issueCodes.length === 0)
    ) {
      fail('DECISION_PROPOSAL_INVALID')
    }
    const expected = expectedDecisionMetadata(decision)
    if (
      record.customerDeliveryStatus !==
        expected.customerDeliveryStatus ||
      record.nextRequiredAction !==
        expected.nextRequiredAction
    ) {
      fail('DECISION_PROPOSAL_INVALID')
    }
    const withoutFingerprint = {
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_DECISION_VERSION,
      task:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_DECISION_TASK,
      gateFingerprint: record.gateFingerprint,
      restrictedArtifactFingerprint:
        record.restrictedArtifactFingerprint,
      artifactPayloadSha256:
        record.artifactPayloadSha256,
      dataClassification:
        'HUMAN_REVIEW_DECISION_METADATA' as const,
      decision,
      issueCodes: canonicalIssueCodes,
      decisionStatus:
        'PROPOSED_NOT_AUTHORIZED' as const,
      decisionAuthority:
        'TRUSTED_HUMAN_REVIEW_ADAPTER_REQUIRED' as const,
      reviewerIdentityStatus: 'NOT_VERIFIED' as const,
      persistenceStatus: 'NOT_RECORDED' as const,
      customerDeliveryStatus:
        expected.customerDeliveryStatus,
      nextRequiredAction: expected.nextRequiredAction,
    }
    if (
      sha256Canonical(withoutFingerprint) !==
      record.proposalFingerprint
    ) {
      fail('DECISION_PROPOSAL_INVALID')
    }
    return freezeAiChartD1Value({
      ...withoutFingerprint,
      proposalFingerprint: record.proposalFingerprint,
    })
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingHumanReviewCommandError
    ) {
      throw error
    }
    fail('DECISION_PROPOSAL_INVALID')
  }
}

function assertDecisionSourceMatch(
  decisionProposal:
    AiChartD1PalaceWritingPreviewHumanReviewDecisionProposal,
  sourceBinding: unknown,
): void {
  try {
    const record = requireAiChartD1ExactObject(
      sourceBinding,
      SOURCE_BINDING_PREVIEW_FIELDS,
    )
    if (
      decisionProposal.gateFingerprint !==
        record.gateFingerprint ||
      decisionProposal.restrictedArtifactFingerprint !==
        record.restrictedArtifactFingerprint ||
      decisionProposal.artifactPayloadSha256 !==
        record.restrictedArtifactPayloadSha256
    ) {
      fail('DECISION_SOURCE_BINDING_MISMATCH')
    }
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingHumanReviewCommandError
    ) {
      throw error
    }
    fail('SOURCE_BINDING_UNAVAILABLE')
  }
}

export function createAiChartD1PalaceWritingHumanReviewCommand(
  input: unknown,
): AiChartD1PalaceWritingHumanReviewCommand {
  try {
    const record = requireAiChartD1ExactObject(
      input,
      INPUT_FIELDS,
    )
    const decisionProposal =
      parseDecisionProposal(record.decisionProposal)
    assertDecisionSourceMatch(
      decisionProposal,
      record.sourceBinding,
    )

    let requestAuthorization
    try {
      requestAuthorization =
        consumeAiChartD1PalaceWritingHumanReviewRequestAuthorization(
          record.requestAuthorization,
        )
    } catch {
      fail('REQUEST_AUTHORIZATION_UNAVAILABLE')
    }
    let sourceBinding
    try {
      sourceBinding =
        consumeAiChartD1PalaceWritingHumanReviewSourceBinding(
          record.sourceBinding,
        )
    } catch {
      fail('SOURCE_BINDING_UNAVAILABLE')
    }
    assertDecisionSourceMatch(
      decisionProposal,
      sourceBinding,
    )

    const withoutFingerprint = {
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_COMMAND_VERSION,
      task:
        AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_COMMAND_TASK,
      dataClassification:
        'AUTHORIZED_SOURCE_BOUND_HUMAN_REVIEW_METADATA' as const,
      reportId: sourceBinding.reportId,
      reviewerId: requestAuthorization.reviewerId,
      permission: requestAuthorization.permission,
      decision: decisionProposal.decision,
      issueCodes: decisionProposal.issueCodes,
      customerDeliveryStatus:
        decisionProposal.customerDeliveryStatus,
      reportSnapshotSha256:
        sourceBinding.reportSnapshotSha256,
      artifactSourceSnapshotSha256:
        sourceBinding.artifactSourceSnapshotSha256,
      restrictedArtifactFingerprint:
        sourceBinding.restrictedArtifactFingerprint,
      artifactPayloadSha256:
        sourceBinding.restrictedArtifactPayloadSha256,
      gateFingerprint: sourceBinding.gateFingerprint,
      proposalFingerprint:
        decisionProposal.proposalFingerprint,
      authorizationFingerprint:
        requestAuthorization.authorizationFingerprint,
      sourceBindingFingerprint:
        sourceBinding.bindingFingerprint,
      authorizationStatus:
        'REQUEST_BOUND_SERVER_VERIFIED' as const,
      sourceBindingStatus:
        'SERVER_VERIFIED_EXACT_SNAPSHOT_MATCH' as const,
      commandStatus:
        'AUTHORIZED_SOURCE_BOUND_AWAITING_SERVER_CLOCK_AND_WRITE_ONCE_RECORD' as const,
      capabilityScope:
        'IN_PROCESS_EXACT_OBJECT_IDENTITY' as const,
      productionCallable: true as const,
      trustedServerClockRequired: true as const,
      writeOnceRecordWriterRequired: true as const,
      formalReviewRecordAllowed: false as const,
      customerDeliveryAllowed: false as const,
      openAiRequests: 0 as const,
    }
    const command = freezeAiChartD1Value({
      ...withoutFingerprint,
      commandFingerprint:
        sha256Canonical(withoutFingerprint),
    })
    activeCommands.set(command, command)
    return command
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingHumanReviewCommandError
    ) {
      throw error
    }
    fail('REVIEW_COMMAND_UNAVAILABLE')
  }
}

export function consumeAiChartD1PalaceWritingHumanReviewCommand(
  value: unknown,
): AiChartD1PalaceWritingHumanReviewCommand {
  try {
    if (value === null || typeof value !== 'object') {
      fail('REVIEW_COMMAND_UNAVAILABLE')
    }
    const command =
      value as AiChartD1PalaceWritingHumanReviewCommand
    if (consumedCommands.has(command)) {
      fail('REVIEW_COMMAND_UNAVAILABLE')
    }
    const activeCommand = activeCommands.get(command)
    if (activeCommand === undefined) {
      fail('REVIEW_COMMAND_UNAVAILABLE')
    }
    activeCommands.delete(command)
    consumedCommands.add(command)
    return activeCommand
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingHumanReviewCommandError
    ) {
      throw error
    }
    fail('REVIEW_COMMAND_UNAVAILABLE')
  }
}
