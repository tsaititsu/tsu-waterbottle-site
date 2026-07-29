import 'server-only'

import { createHash } from 'node:crypto'
import { O_NOFOLLOW, O_RDONLY } from 'node:constants'
import {
  lstat,
  open,
  readdir,
  realpath,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import {
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path'
import {
  createAiChartD1CanonicalJson,
  freezeAiChartD1Value,
} from './d1CommonContracts'
import {
  parseAiChartD1PalaceWritingHumanReviewRecord,
  type AiChartD1PalaceWritingHumanReviewRecord,
} from './d1PalaceWritingHumanReviewRecordEnvelope.server'
import {
  consumeAiChartD1PalaceWritingPersistedHumanReviewRecord,
  type AiChartD1PalaceWritingPersistedHumanReviewRecord,
} from './d1PalaceWritingHumanReviewRecordWriter.server'

export const AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_READBACK_VERSION =
  'ai-chart-d1-palace-writing-human-review-record-readback/v1' as const
export const AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_READBACK_TASK =
  'D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_READBACK' as const
export const AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_READBACK_INVALID =
  'ai_chart_d1_palace_writing_human_review_record_readback_invalid' as const
export const AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_APPROVAL_REQUIRED =
  'ai_chart_d1_palace_writing_human_review_approval_required' as const

const MAX_REVIEW_RECORD_BYTES = 32 * 1024
const STORAGE_DIRECTORY_NAME =
  'ai-chart-d1-palace-writing-human-review-record'

type VerifiedDecisionStatus =
  | 'VERIFIED_APPROVAL_AWAITING_DELIVERY_COORDINATOR'
  | 'VERIFIED_REPAIR_REQUIRED'
  | 'VERIFIED_REJECTED'

type VerifiedCustomerDeliveryStatus =
  | 'BLOCKED_PENDING_DELIVERY_COORDINATOR'
  | 'BLOCKED_REPAIR_REQUIRED'
  | 'BLOCKED_REJECTED'

type VerifiedNextRequiredAction =
  | 'EVALUATE_WITH_TRUSTED_CUSTOMER_DELIVERY_COORDINATOR'
  | 'RETURN_TO_REPAIR_WORKFLOW'
  | 'KEEP_REJECTED_ARTIFACT_BLOCKED'

export type AiChartD1PalaceWritingVerifiedHumanReviewRecord =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_READBACK_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_READBACK_TASK
    dataClassification:
      'AUTHORIZED_HUMAN_REVIEW_RECORD_METADATA'
    gateFingerprint: string
    authority:
      'TRUSTED_SERVER_HUMAN_REVIEW_RECORD_READBACK_ADAPTER'
    artifactName: 'human-review-record.json'
    recordFingerprint: string
    recordPayloadSha256: string
    envelopeFingerprint: string
    status: 'VERIFIED'
    formalReviewRecordStatus:
      'VERIFIED_PERSISTED_RECORD'
    decisionStatus: VerifiedDecisionStatus
    customerDeliveryStatus:
      VerifiedCustomerDeliveryStatus
    customerDeliveryAllowed: false
    storageReads: 1
    storageWrites: 0
    openAiRequests: 0
    nextRequiredAction: VerifiedNextRequiredAction
    reviewRecord:
      AiChartD1PalaceWritingHumanReviewRecord
  }>

const activeVerifiedRecords = new WeakMap<
  AiChartD1PalaceWritingVerifiedHumanReviewRecord,
  AiChartD1PalaceWritingVerifiedHumanReviewRecord
>()
const consumedVerifiedRecords =
  new WeakSet<AiChartD1PalaceWritingVerifiedHumanReviewRecord>()

export class AiChartD1PalaceWritingHumanReviewRecordReadbackError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_READBACK_INVALID

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_READBACK_INVALID,
    )
    this.name =
      'AiChartD1PalaceWritingHumanReviewRecordReadbackError'
    Object.freeze(this)
  }
}

export class AiChartD1PalaceWritingHumanReviewApprovalRequiredError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_APPROVAL_REQUIRED

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_APPROVAL_REQUIRED,
    )
    this.name =
      'AiChartD1PalaceWritingHumanReviewApprovalRequiredError'
    Object.freeze(this)
  }
}

function invalid(): never {
  throw new AiChartD1PalaceWritingHumanReviewRecordReadbackError()
}

function isPathInside(
  root: string,
  candidate: string,
): boolean {
  const relativePath = relative(root, candidate)
  return (
    relativePath.length > 0 &&
    relativePath !== '..' &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  )
}

function isOwnedByCurrentUser(userId: number): boolean {
  return (
    typeof process.getuid !== 'function' ||
    userId === process.getuid()
  )
}

async function requirePrivateDirectory(
  directory: string,
): Promise<void> {
  const metadata = await lstat(directory)
  if (
    metadata.isSymbolicLink() ||
    !metadata.isDirectory() ||
    (metadata.mode & 0o777) !== 0o700 ||
    !isOwnedByCurrentUser(metadata.uid)
  ) {
    invalid()
  }
}

async function readPrivateReviewRecord(
  artifactPath: string,
): Promise<string> {
  const linkMetadata = await lstat(artifactPath)
  if (linkMetadata.isSymbolicLink()) invalid()

  const artifact = await open(
    artifactPath,
    O_RDONLY | O_NOFOLLOW,
  )
  try {
    const metadata = await artifact.stat()
    if (
      !metadata.isFile() ||
      (metadata.mode & 0o777) !== 0o600 ||
      !isOwnedByCurrentUser(metadata.uid) ||
      metadata.size <= 0 ||
      metadata.size > MAX_REVIEW_RECORD_BYTES
    ) {
      invalid()
    }
    const payload = await artifact.readFile({
      encoding: 'utf8',
    })
    const payloadBytes = Buffer.byteLength(
      payload,
      'utf8',
    )
    if (
      payloadBytes !== metadata.size ||
      payloadBytes > MAX_REVIEW_RECORD_BYTES
    ) {
      invalid()
    }
    return payload
  } finally {
    await artifact.close().catch(() => undefined)
  }
}

function sha256(value: string): string {
  return createHash('sha256')
    .update(value, 'utf8')
    .digest('hex')
}

function decisionMetadata(
  reviewRecord:
    AiChartD1PalaceWritingHumanReviewRecord,
): Readonly<{
  decisionStatus: VerifiedDecisionStatus
  customerDeliveryStatus:
    VerifiedCustomerDeliveryStatus
  nextRequiredAction: VerifiedNextRequiredAction
}> {
  if (reviewRecord.decision === 'APPROVED') {
    return Object.freeze({
      decisionStatus:
        'VERIFIED_APPROVAL_AWAITING_DELIVERY_COORDINATOR',
      customerDeliveryStatus:
        'BLOCKED_PENDING_DELIVERY_COORDINATOR',
      nextRequiredAction:
        'EVALUATE_WITH_TRUSTED_CUSTOMER_DELIVERY_COORDINATOR',
    })
  }
  if (reviewRecord.decision === 'REPAIR_REQUIRED') {
    return Object.freeze({
      decisionStatus: 'VERIFIED_REPAIR_REQUIRED',
      customerDeliveryStatus:
        'BLOCKED_REPAIR_REQUIRED',
      nextRequiredAction: 'RETURN_TO_REPAIR_WORKFLOW',
    })
  }
  return Object.freeze({
    decisionStatus: 'VERIFIED_REJECTED',
    customerDeliveryStatus: 'BLOCKED_REJECTED',
    nextRequiredAction:
      'KEEP_REJECTED_ARTIFACT_BLOCKED',
  })
}

async function resolveRecordDirectory(
  receipt:
    AiChartD1PalaceWritingPersistedHumanReviewRecord,
): Promise<string> {
  const systemTemporaryRoot = await realpath(
    resolve(tmpdir()),
  )
  const unresolvedStorageRoot = resolve(
    join(tmpdir(), STORAGE_DIRECTORY_NAME),
  )
  await requirePrivateDirectory(unresolvedStorageRoot)
  const storageRoot = await realpath(
    unresolvedStorageRoot,
  )
  if (!isPathInside(systemTemporaryRoot, storageRoot)) {
    invalid()
  }

  const unresolvedGateDirectory = join(
    storageRoot,
    receipt.gateFingerprint,
  )
  if (
    !isPathInside(
      storageRoot,
      unresolvedGateDirectory,
    )
  ) {
    invalid()
  }
  await requirePrivateDirectory(
    unresolvedGateDirectory,
  )
  const gateDirectory = await realpath(
    unresolvedGateDirectory,
  )
  if (!isPathInside(storageRoot, gateDirectory)) {
    invalid()
  }
  return gateDirectory
}

export async function readAndVerifyAiChartD1PalaceWritingHumanReviewRecord(
  receiptValue: unknown,
): Promise<AiChartD1PalaceWritingVerifiedHumanReviewRecord> {
  try {
    const receipt =
      consumeAiChartD1PalaceWritingPersistedHumanReviewRecord(
        receiptValue,
      )
    const gateDirectory =
      await resolveRecordDirectory(receipt)
    const entries = await readdir(gateDirectory)
    if (
      entries.length !== 1 ||
      entries[0] !== receipt.artifactName
    ) {
      invalid()
    }

    const artifactPath = join(
      gateDirectory,
      receipt.artifactName,
    )
    if (!isPathInside(gateDirectory, artifactPath)) {
      invalid()
    }
    const payload =
      await readPrivateReviewRecord(artifactPath)
    const parsed = JSON.parse(payload) as unknown
    const reviewRecord =
      parseAiChartD1PalaceWritingHumanReviewRecord(
        parsed,
      )
    const canonicalPayload =
      createAiChartD1CanonicalJson(reviewRecord)
    if (
      payload !== canonicalPayload ||
      sha256(payload) !==
        receipt.recordPayloadSha256 ||
      reviewRecord.recordFingerprint !==
        receipt.recordFingerprint ||
      reviewRecord.gateFingerprint !==
        receipt.gateFingerprint
    ) {
      invalid()
    }
    const decision = decisionMetadata(reviewRecord)

    const verified = freezeAiChartD1Value({
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_READBACK_VERSION,
      task:
        AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_READBACK_TASK,
      dataClassification:
        'AUTHORIZED_HUMAN_REVIEW_RECORD_METADATA' as const,
      gateFingerprint: receipt.gateFingerprint,
      authority:
        'TRUSTED_SERVER_HUMAN_REVIEW_RECORD_READBACK_ADAPTER' as const,
      artifactName: receipt.artifactName,
      recordFingerprint:
        receipt.recordFingerprint,
      recordPayloadSha256:
        receipt.recordPayloadSha256,
      envelopeFingerprint:
        receipt.envelopeFingerprint,
      status: 'VERIFIED' as const,
      formalReviewRecordStatus:
        'VERIFIED_PERSISTED_RECORD' as const,
      decisionStatus: decision.decisionStatus,
      customerDeliveryStatus:
        decision.customerDeliveryStatus,
      customerDeliveryAllowed: false as const,
      storageReads: 1 as const,
      storageWrites: 0 as const,
      openAiRequests: 0 as const,
      nextRequiredAction:
        decision.nextRequiredAction,
      reviewRecord,
    })
    activeVerifiedRecords.set(verified, verified)
    return verified
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingHumanReviewRecordReadbackError
    ) {
      throw error
    }
    invalid()
  }
}

export function consumeAiChartD1PalaceWritingVerifiedHumanReviewApproval(
  value: unknown,
): AiChartD1PalaceWritingVerifiedHumanReviewRecord {
  if (
    value === null ||
    typeof value !== 'object'
  ) {
    invalid()
  }
  const verified =
    value as AiChartD1PalaceWritingVerifiedHumanReviewRecord
  if (consumedVerifiedRecords.has(verified)) {
    invalid()
  }
  const active = activeVerifiedRecords.get(verified)
  if (active === undefined) {
    invalid()
  }
  if (
    active.reviewRecord.decision !== 'APPROVED' ||
    active.decisionStatus !==
      'VERIFIED_APPROVAL_AWAITING_DELIVERY_COORDINATOR' ||
    active.customerDeliveryStatus !==
      'BLOCKED_PENDING_DELIVERY_COORDINATOR'
  ) {
    throw new AiChartD1PalaceWritingHumanReviewApprovalRequiredError()
  }
  activeVerifiedRecords.delete(verified)
  consumedVerifiedRecords.add(verified)
  return active
}
