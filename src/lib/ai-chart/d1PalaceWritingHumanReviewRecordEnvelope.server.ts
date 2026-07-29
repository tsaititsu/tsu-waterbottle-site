import 'server-only'

import { createHash } from 'node:crypto'
import {
  assertAiChartD1SafeGraph,
  createAiChartD1CanonicalJson,
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import {
  consumeAiChartD1PalaceWritingHumanReviewCommand,
  type AiChartD1PalaceWritingHumanReviewCommand,
} from './d1PalaceWritingHumanReviewCommand.server'
import {
  AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_ISSUE_CODES,
  type AiChartD1PalaceWritingPreviewHumanReviewDecision,
  type AiChartD1PalaceWritingPreviewHumanReviewDecisionProposal,
  type AiChartD1PalaceWritingPreviewHumanReviewIssueCode,
} from './d1PalaceWritingPreviewHumanReviewDecisionContracts.server'
import {
  AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PERMISSION,
} from './d1PalaceWritingPreviewHumanReviewAuthorizationHandoff.server'

export const AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_VERSION =
  'ai-chart-d1-palace-writing-human-review-record/v1' as const
export const AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_TASK =
  'D1_PALACE_WRITING_HUMAN_REVIEW_RECORD' as const
export const AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_ENVELOPE_VERSION =
  'ai-chart-d1-palace-writing-human-review-record-envelope/v1' as const
export const AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_ENVELOPE_TASK =
  'D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_ENVELOPE' as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const REVIEW_DECISIONS = Object.freeze([
  'APPROVED',
  'REPAIR_REQUIRED',
  'REJECTED',
] as const)
const REVIEW_RECORD_FIELDS = Object.freeze([
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
] as const)

export const AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_ENVELOPE_FAILURE_CODES =
  Object.freeze([
    'REVIEW_COMMAND_UNAVAILABLE',
    'SERVER_CLOCK_UNAVAILABLE',
    'SERVER_TIMESTAMP_INVALID',
    'REVIEW_RECORD_ENVELOPE_UNAVAILABLE',
  ] as const)

export type AiChartD1PalaceWritingHumanReviewRecordEnvelopeFailureCode =
  (typeof AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_ENVELOPE_FAILURE_CODES)[number]

export type AiChartD1PalaceWritingHumanReviewRecord =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_TASK
    dataClassification:
      'AUTHORIZED_HUMAN_REVIEW_RECORD_METADATA'
    reportId: string
    reviewerId: string
    permission:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PERMISSION
    decision:
      AiChartD1PalaceWritingPreviewHumanReviewDecision
    issueCodes:
      readonly AiChartD1PalaceWritingPreviewHumanReviewIssueCode[]
    recordedAt: string
    recordedAtAuthority: 'TRUSTED_SERVER_CLOCK'
    reportSnapshotSha256: string
    artifactSourceSnapshotSha256: string
    restrictedArtifactFingerprint: string
    artifactPayloadSha256: string
    gateFingerprint: string
    proposalFingerprint: string
    authorizationFingerprint: string
    sourceBindingFingerprint: string
    reviewCommandFingerprint: string
    sourceBindingStatus:
      'SERVER_VERIFIED_EXACT_SNAPSHOT_MATCH'
    authorizationStatus:
      'REQUEST_BOUND_SERVER_VERIFIED'
    customerDeliveryStatus:
      AiChartD1PalaceWritingPreviewHumanReviewDecisionProposal['customerDeliveryStatus']
    recordFingerprint: string
  }>

export type AiChartD1PalaceWritingHumanReviewRecordEnvelope =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_ENVELOPE_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_ENVELOPE_TASK
    dataClassification:
      'AUTHORIZED_HUMAN_REVIEW_RECORD_METADATA'
    recordArtifactName: 'human-review-record.json'
    storageScope: 'GATE_FINGERPRINT'
    storageAuthority:
      'TRUSTED_SERVER_HUMAN_REVIEW_RECORD_STORAGE_ADAPTER_REQUIRED'
    serialization: 'CANONICAL_JSON_UTF8'
    createMode: 'EXCLUSIVE_CREATE'
    directoryMode: '0700'
    fileMode: '0600'
    overwriteAllowed: false
    retryAllowed: false
    recordPayloadSha256: string
    recordStatus:
      'CANONICAL_RECORD_READY_NOT_PERSISTED'
    persistenceStatus: 'NOT_PERSISTED'
    formalReviewRecordAllowed: false
    customerDeliveryAllowed: false
    productionCallable: true
    storageWrites: 0
    openAiRequests: 0
    nextRequiredAction:
      'PERSIST_WITH_TRUSTED_SERVER_HUMAN_REVIEW_RECORD_ADAPTER'
    reviewRecord:
      AiChartD1PalaceWritingHumanReviewRecord
    envelopeFingerprint: string
  }>

type ServerClock = () => Date

const activeEnvelopes = new WeakMap<
  AiChartD1PalaceWritingHumanReviewRecordEnvelope,
  AiChartD1PalaceWritingHumanReviewRecordEnvelope
>()
const consumedEnvelopes =
  new WeakSet<AiChartD1PalaceWritingHumanReviewRecordEnvelope>()

export class AiChartD1PalaceWritingHumanReviewRecordEnvelopeError
  extends Error {
  readonly code:
    AiChartD1PalaceWritingHumanReviewRecordEnvelopeFailureCode

  constructor(
    code:
      AiChartD1PalaceWritingHumanReviewRecordEnvelopeFailureCode,
  ) {
    const safeCode =
      AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_ENVELOPE_FAILURE_CODES.includes(
        code,
      )
        ? code
        : 'REVIEW_RECORD_ENVELOPE_UNAVAILABLE'
    super(safeCode)
    this.name =
      'AiChartD1PalaceWritingHumanReviewRecordEnvelopeError'
    this.code = safeCode
    Object.freeze(this)
  }
}

function fail(
  code:
    AiChartD1PalaceWritingHumanReviewRecordEnvelopeFailureCode,
): never {
  throw new AiChartD1PalaceWritingHumanReviewRecordEnvelopeError(
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

function parseSha256(value: unknown): string {
  if (!isSha256(value)) {
    fail('REVIEW_RECORD_ENVELOPE_UNAVAILABLE')
  }
  return value
}

function parseRecordedAt(value: unknown): string {
  if (typeof value !== 'string') {
    fail('REVIEW_RECORD_ENVELOPE_UNAVAILABLE')
  }
  const recordedAt = new Date(value)
  if (
    !Number.isFinite(recordedAt.getTime()) ||
    recordedAt.toISOString() !== value
  ) {
    fail('REVIEW_RECORD_ENVELOPE_UNAVAILABLE')
  }
  return value
}

function parseReviewDecision(
  value: unknown,
): AiChartD1PalaceWritingPreviewHumanReviewDecision {
  if (
    typeof value !== 'string' ||
    !REVIEW_DECISIONS.includes(
      value as AiChartD1PalaceWritingPreviewHumanReviewDecision,
    )
  ) {
    fail('REVIEW_RECORD_ENVELOPE_UNAVAILABLE')
  }
  return value as AiChartD1PalaceWritingPreviewHumanReviewDecision
}

function parseReviewIssueCodes(
  value: unknown,
  decision:
    AiChartD1PalaceWritingPreviewHumanReviewDecision,
): readonly AiChartD1PalaceWritingPreviewHumanReviewIssueCode[] {
  if (!Array.isArray(value)) {
    fail('REVIEW_RECORD_ENVELOPE_UNAVAILABLE')
  }
  const issueCodes = value.map((item) => {
    if (
      typeof item !== 'string' ||
      !AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_ISSUE_CODES.includes(
        item as AiChartD1PalaceWritingPreviewHumanReviewIssueCode,
      )
    ) {
      fail('REVIEW_RECORD_ENVELOPE_UNAVAILABLE')
    }
    return item as AiChartD1PalaceWritingPreviewHumanReviewIssueCode
  })
  if (
    new Set(issueCodes).size !== issueCodes.length ||
    (decision === 'APPROVED' && issueCodes.length !== 0) ||
    (decision !== 'APPROVED' && issueCodes.length === 0)
  ) {
    fail('REVIEW_RECORD_ENVELOPE_UNAVAILABLE')
  }
  const selected = new Set(issueCodes)
  return Object.freeze(
    AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_ISSUE_CODES.filter(
      (issueCode) => selected.has(issueCode),
    ),
  )
}

function expectedCustomerDeliveryStatus(
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

export function parseAiChartD1PalaceWritingHumanReviewRecord(
  value: unknown,
): AiChartD1PalaceWritingHumanReviewRecord {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(
      value,
      REVIEW_RECORD_FIELDS,
    )
    const decision = parseReviewDecision(record.decision)
    const issueCodes = parseReviewIssueCodes(
      record.issueCodes,
      decision,
    )
    const recordedAt = parseRecordedAt(record.recordedAt)
    const reportSnapshotSha256 =
      parseSha256(record.reportSnapshotSha256)
    const artifactSourceSnapshotSha256 =
      parseSha256(
        record.artifactSourceSnapshotSha256,
      )
    const restrictedArtifactFingerprint =
      parseSha256(
        record.restrictedArtifactFingerprint,
      )
    const artifactPayloadSha256 =
      parseSha256(record.artifactPayloadSha256)
    const gateFingerprint =
      parseSha256(record.gateFingerprint)
    const proposalFingerprint =
      parseSha256(record.proposalFingerprint)
    const authorizationFingerprint =
      parseSha256(record.authorizationFingerprint)
    const sourceBindingFingerprint =
      parseSha256(record.sourceBindingFingerprint)
    const reviewCommandFingerprint =
      parseSha256(record.reviewCommandFingerprint)
    const recordFingerprint =
      parseSha256(record.recordFingerprint)
    if (
      record.contractVersion !==
        AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_VERSION ||
      record.task !==
        AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_TASK ||
      record.dataClassification !==
        'AUTHORIZED_HUMAN_REVIEW_RECORD_METADATA' ||
      typeof record.reportId !== 'string' ||
      !UUID_PATTERN.test(record.reportId) ||
      typeof record.reviewerId !== 'string' ||
      !UUID_PATTERN.test(record.reviewerId) ||
      record.permission !==
        AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PERMISSION ||
      record.recordedAtAuthority !== 'TRUSTED_SERVER_CLOCK' ||
      record.sourceBindingStatus !==
        'SERVER_VERIFIED_EXACT_SNAPSHOT_MATCH' ||
      record.authorizationStatus !==
        'REQUEST_BOUND_SERVER_VERIFIED' ||
      record.customerDeliveryStatus !==
        expectedCustomerDeliveryStatus(decision)
    ) {
      fail('REVIEW_RECORD_ENVELOPE_UNAVAILABLE')
    }
    const withoutFingerprint = {
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_VERSION,
      task:
        AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_TASK,
      dataClassification:
        'AUTHORIZED_HUMAN_REVIEW_RECORD_METADATA' as const,
      reportId: record.reportId,
      reviewerId: record.reviewerId,
      permission:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PERMISSION,
      decision,
      issueCodes,
      recordedAt,
      recordedAtAuthority:
        'TRUSTED_SERVER_CLOCK' as const,
      reportSnapshotSha256,
      artifactSourceSnapshotSha256,
      restrictedArtifactFingerprint,
      artifactPayloadSha256,
      gateFingerprint,
      proposalFingerprint,
      authorizationFingerprint,
      sourceBindingFingerprint,
      reviewCommandFingerprint,
      sourceBindingStatus:
        'SERVER_VERIFIED_EXACT_SNAPSHOT_MATCH' as const,
      authorizationStatus:
        'REQUEST_BOUND_SERVER_VERIFIED' as const,
      customerDeliveryStatus:
        expectedCustomerDeliveryStatus(decision),
    }
    if (
      sha256Canonical(withoutFingerprint) !==
      recordFingerprint
    ) {
      fail('REVIEW_RECORD_ENVELOPE_UNAVAILABLE')
    }
    return freezeAiChartD1Value({
      ...withoutFingerprint,
      recordFingerprint,
    })
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingHumanReviewRecordEnvelopeError
    ) {
      throw error
    }
    fail('REVIEW_RECORD_ENVELOPE_UNAVAILABLE')
  }
}

function parseDependencies(
  value: unknown,
): Readonly<{ now?: ServerClock }> {
  try {
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      fail('SERVER_CLOCK_UNAVAILABLE')
    }
    const keys = Reflect.ownKeys(value)
    if (
      keys.some(
        (key) =>
          typeof key !== 'string' || key !== 'now',
      ) ||
      keys.length > 1
    ) {
      fail('SERVER_CLOCK_UNAVAILABLE')
    }
    const now = (value as { now?: unknown }).now
    if (
      now !== undefined &&
      typeof now !== 'function'
    ) {
      fail('SERVER_CLOCK_UNAVAILABLE')
    }
    if (
      now !== undefined &&
      process.env.NODE_ENV !== 'test'
    ) {
      fail('SERVER_CLOCK_UNAVAILABLE')
    }
    return now === undefined
      ? Object.freeze({})
      : Object.freeze({ now: now as ServerClock })
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingHumanReviewRecordEnvelopeError
    ) {
      throw error
    }
    fail('SERVER_CLOCK_UNAVAILABLE')
  }
}

function readRecordedAt(clock: ServerClock): string {
  let value: unknown
  try {
    value = clock()
  } catch {
    fail('SERVER_CLOCK_UNAVAILABLE')
  }
  if (!(value instanceof Date)) {
    fail('SERVER_TIMESTAMP_INVALID')
  }
  try {
    const milliseconds =
      Date.prototype.getTime.call(value)
    if (!Number.isFinite(milliseconds)) {
      fail('SERVER_TIMESTAMP_INVALID')
    }
    return Date.prototype.toISOString.call(value)
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingHumanReviewRecordEnvelopeError
    ) {
      throw error
    }
    fail('SERVER_TIMESTAMP_INVALID')
  }
}

function buildReviewRecord(
  command:
    AiChartD1PalaceWritingHumanReviewCommand,
  recordedAt: string,
): AiChartD1PalaceWritingHumanReviewRecord {
  const withoutFingerprint = {
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_TASK,
    dataClassification:
      'AUTHORIZED_HUMAN_REVIEW_RECORD_METADATA' as const,
    reportId: command.reportId,
    reviewerId: command.reviewerId,
    permission: command.permission,
    decision: command.decision,
    issueCodes: command.issueCodes,
    recordedAt,
    recordedAtAuthority:
      'TRUSTED_SERVER_CLOCK' as const,
    reportSnapshotSha256:
      command.reportSnapshotSha256,
    artifactSourceSnapshotSha256:
      command.artifactSourceSnapshotSha256,
    restrictedArtifactFingerprint:
      command.restrictedArtifactFingerprint,
    artifactPayloadSha256:
      command.artifactPayloadSha256,
    gateFingerprint: command.gateFingerprint,
    proposalFingerprint: command.proposalFingerprint,
    authorizationFingerprint:
      command.authorizationFingerprint,
    sourceBindingFingerprint:
      command.sourceBindingFingerprint,
    reviewCommandFingerprint:
      command.commandFingerprint,
    sourceBindingStatus: command.sourceBindingStatus,
    authorizationStatus:
      command.authorizationStatus,
    customerDeliveryStatus:
      command.customerDeliveryStatus,
  }
  return freezeAiChartD1Value({
    ...withoutFingerprint,
    recordFingerprint:
      sha256Canonical(withoutFingerprint),
  })
}

export function buildAiChartD1PalaceWritingHumanReviewRecordEnvelope(
  commandValue: unknown,
  dependencyValue: Readonly<{
    now?: ServerClock
  }> = {},
): AiChartD1PalaceWritingHumanReviewRecordEnvelope {
  try {
    const dependencies =
      parseDependencies(dependencyValue)
    const recordedAt = readRecordedAt(
      dependencies.now ?? (() => new Date()),
    )
    let command
    try {
      command =
        consumeAiChartD1PalaceWritingHumanReviewCommand(
          commandValue,
        )
    } catch {
      fail('REVIEW_COMMAND_UNAVAILABLE')
    }
    const reviewRecord =
      buildReviewRecord(command, recordedAt)
    const recordPayloadSha256 =
      sha256Canonical(reviewRecord)
    const withoutFingerprint = {
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_ENVELOPE_VERSION,
      task:
        AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_ENVELOPE_TASK,
      dataClassification:
        'AUTHORIZED_HUMAN_REVIEW_RECORD_METADATA' as const,
      recordArtifactName:
        'human-review-record.json' as const,
      storageScope: 'GATE_FINGERPRINT' as const,
      storageAuthority:
        'TRUSTED_SERVER_HUMAN_REVIEW_RECORD_STORAGE_ADAPTER_REQUIRED' as const,
      serialization: 'CANONICAL_JSON_UTF8' as const,
      createMode: 'EXCLUSIVE_CREATE' as const,
      directoryMode: '0700' as const,
      fileMode: '0600' as const,
      overwriteAllowed: false as const,
      retryAllowed: false as const,
      recordPayloadSha256,
      recordStatus:
        'CANONICAL_RECORD_READY_NOT_PERSISTED' as const,
      persistenceStatus: 'NOT_PERSISTED' as const,
      formalReviewRecordAllowed: false as const,
      customerDeliveryAllowed: false as const,
      productionCallable: true as const,
      storageWrites: 0 as const,
      openAiRequests: 0 as const,
      nextRequiredAction:
        'PERSIST_WITH_TRUSTED_SERVER_HUMAN_REVIEW_RECORD_ADAPTER' as const,
      reviewRecord,
    }
    const envelope = freezeAiChartD1Value({
      ...withoutFingerprint,
      envelopeFingerprint:
        sha256Canonical(withoutFingerprint),
    })
    activeEnvelopes.set(envelope, envelope)
    return envelope
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingHumanReviewRecordEnvelopeError
    ) {
      throw error
    }
    fail('REVIEW_RECORD_ENVELOPE_UNAVAILABLE')
  }
}

export function consumeAiChartD1PalaceWritingHumanReviewRecordEnvelope(
  value: unknown,
): AiChartD1PalaceWritingHumanReviewRecordEnvelope {
  try {
    if (value === null || typeof value !== 'object') {
      fail('REVIEW_RECORD_ENVELOPE_UNAVAILABLE')
    }
    const envelope =
      value as
        AiChartD1PalaceWritingHumanReviewRecordEnvelope
    if (consumedEnvelopes.has(envelope)) {
      fail('REVIEW_RECORD_ENVELOPE_UNAVAILABLE')
    }
    const activeEnvelope = activeEnvelopes.get(envelope)
    if (activeEnvelope === undefined) {
      fail('REVIEW_RECORD_ENVELOPE_UNAVAILABLE')
    }
    activeEnvelopes.delete(envelope)
    consumedEnvelopes.add(envelope)
    return activeEnvelope
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingHumanReviewRecordEnvelopeError
    ) {
      throw error
    }
    fail('REVIEW_RECORD_ENVELOPE_UNAVAILABLE')
  }
}
