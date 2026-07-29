import 'server-only'

import { createHash } from 'node:crypto'
import { lstat, mkdir, open, realpath } from 'node:fs/promises'
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
  consumeAiChartD1PalaceWritingHumanReviewRecordEnvelope,
  type AiChartD1PalaceWritingHumanReviewRecordEnvelope,
} from './d1PalaceWritingHumanReviewRecordEnvelope.server'

export const AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_WRITER_VERSION =
  'ai-chart-d1-palace-writing-human-review-record-writer/v1' as const
export const AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_WRITER_TASK =
  'D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_WRITER' as const
export const AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_ALREADY_PERSISTED =
  'ai_chart_d1_palace_writing_human_review_record_already_persisted' as const
export const AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_STORAGE_INVALID =
  'ai_chart_d1_palace_writing_human_review_record_storage_invalid' as const
export const AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_RECEIPT_UNAVAILABLE =
  'ai_chart_d1_palace_writing_human_review_record_receipt_unavailable' as const

export type AiChartD1PalaceWritingPersistedHumanReviewRecord =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_WRITER_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_WRITER_TASK
    dataClassification:
      'AUTHORIZED_HUMAN_REVIEW_RECORD_METADATA'
    gateFingerprint: string
    authority:
      'TRUSTED_SERVER_HUMAN_REVIEW_RECORD_STORAGE_ADAPTER'
    artifactName: 'human-review-record.json'
    recordFingerprint: string
    recordPayloadSha256: string
    envelopeFingerprint: string
    status: 'PERSISTED_AWAITING_VERIFIED_READBACK'
    serialization: 'CANONICAL_JSON_UTF8'
    createMode: 'EXCLUSIVE_CREATE'
    directoryMode: '0700'
    fileMode: '0600'
    overwriteAllowed: false
    retryAllowed: false
    formalReviewRecordStatus:
      'PERSISTED_NOT_VERIFIED'
    customerDeliveryStatus:
      'BLOCKED_PENDING_TRUSTED_REVIEW_RECORD'
    customerDeliveryAllowed: false
    storageWrites: 1
    openAiRequests: 0
  }>

const activeReceipts = new WeakMap<
  AiChartD1PalaceWritingPersistedHumanReviewRecord,
  AiChartD1PalaceWritingPersistedHumanReviewRecord
>()
const consumedReceipts =
  new WeakSet<AiChartD1PalaceWritingPersistedHumanReviewRecord>()

export class AiChartD1PalaceWritingHumanReviewRecordAlreadyPersistedError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_ALREADY_PERSISTED

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_ALREADY_PERSISTED,
    )
    this.name =
      'AiChartD1PalaceWritingHumanReviewRecordAlreadyPersistedError'
    Object.freeze(this)
  }
}

export class AiChartD1PalaceWritingHumanReviewRecordStorageError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_STORAGE_INVALID

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_STORAGE_INVALID,
    )
    this.name =
      'AiChartD1PalaceWritingHumanReviewRecordStorageError'
    Object.freeze(this)
  }
}

export class AiChartD1PalaceWritingHumanReviewRecordReceiptUnavailableError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_RECEIPT_UNAVAILABLE

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_RECEIPT_UNAVAILABLE,
    )
    this.name =
      'AiChartD1PalaceWritingHumanReviewRecordReceiptUnavailableError'
    Object.freeze(this)
  }
}

function alreadyPersisted(): never {
  throw new AiChartD1PalaceWritingHumanReviewRecordAlreadyPersistedError()
}

function storageInvalid(): never {
  throw new AiChartD1PalaceWritingHumanReviewRecordStorageError()
}

function isNodeErrorWithCode(
  value: unknown,
  code: string,
): boolean {
  return (
    value instanceof Error &&
    'code' in value &&
    value.code === code
  )
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

async function validatePrivateDirectory(
  directory: string,
): Promise<void> {
  const metadata = await lstat(directory)
  const currentUserId =
    typeof process.getuid === 'function'
      ? process.getuid()
      : null
  if (
    metadata.isSymbolicLink() ||
    !metadata.isDirectory() ||
    (metadata.mode & 0o777) !== 0o700 ||
    (currentUserId !== null &&
      metadata.uid !== currentUserId)
  ) {
    storageInvalid()
  }
}

async function validatePrivateRecordFile(
  artifactPath: string,
): Promise<void> {
  const metadata = await lstat(artifactPath)
  const currentUserId =
    typeof process.getuid === 'function'
      ? process.getuid()
      : null
  if (
    metadata.isSymbolicLink() ||
    !metadata.isFile() ||
    (metadata.mode & 0o777) !== 0o600 ||
    (currentUserId !== null &&
      metadata.uid !== currentUserId)
  ) {
    storageInvalid()
  }
}

async function resolveStorageRoot(): Promise<string> {
  const systemTemporaryRoot = await realpath(
    resolve(tmpdir()),
  )
  const unresolvedStorageRoot = resolve(
    join(
      tmpdir(),
      'ai-chart-d1-palace-writing-human-review-record',
    ),
  )

  try {
    await mkdir(unresolvedStorageRoot, {
      mode: 0o700,
    })
  } catch (error) {
    if (!isNodeErrorWithCode(error, 'EEXIST')) {
      storageInvalid()
    }
  }
  await validatePrivateDirectory(
    unresolvedStorageRoot,
  )
  const storageRoot = await realpath(
    unresolvedStorageRoot,
  )
  if (!isPathInside(systemTemporaryRoot, storageRoot)) {
    storageInvalid()
  }
  return storageRoot
}

async function claimRecordDirectory(
  storageRoot: string,
  gateFingerprint: string,
): Promise<string> {
  const gateDirectory = join(
    storageRoot,
    gateFingerprint,
  )
  if (!isPathInside(storageRoot, gateDirectory)) {
    storageInvalid()
  }
  try {
    await mkdir(gateDirectory, {
      mode: 0o700,
    })
  } catch (error) {
    if (isNodeErrorWithCode(error, 'EEXIST')) {
      try {
        await validatePrivateDirectory(
          gateDirectory,
        )
      } catch (metadataError) {
        if (
          metadataError instanceof
          AiChartD1PalaceWritingHumanReviewRecordStorageError
        ) {
          throw metadataError
        }
        storageInvalid()
      }
      alreadyPersisted()
    }
    storageInvalid()
  }
  await validatePrivateDirectory(gateDirectory)
  return gateDirectory
}

function sha256(value: string): string {
  return createHash('sha256')
    .update(value, 'utf8')
    .digest('hex')
}

function createReceipt(
  envelope:
    AiChartD1PalaceWritingHumanReviewRecordEnvelope,
): AiChartD1PalaceWritingPersistedHumanReviewRecord {
  const receipt = freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_WRITER_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_RECORD_WRITER_TASK,
    dataClassification:
      'AUTHORIZED_HUMAN_REVIEW_RECORD_METADATA' as const,
    gateFingerprint:
      envelope.reviewRecord.gateFingerprint,
    authority:
      'TRUSTED_SERVER_HUMAN_REVIEW_RECORD_STORAGE_ADAPTER' as const,
    artifactName:
      'human-review-record.json' as const,
    recordFingerprint:
      envelope.reviewRecord.recordFingerprint,
    recordPayloadSha256:
      envelope.recordPayloadSha256,
    envelopeFingerprint:
      envelope.envelopeFingerprint,
    status:
      'PERSISTED_AWAITING_VERIFIED_READBACK' as const,
    serialization:
      'CANONICAL_JSON_UTF8' as const,
    createMode: 'EXCLUSIVE_CREATE' as const,
    directoryMode: '0700' as const,
    fileMode: '0600' as const,
    overwriteAllowed: false as const,
    retryAllowed: false as const,
    formalReviewRecordStatus:
      'PERSISTED_NOT_VERIFIED' as const,
    customerDeliveryStatus:
      'BLOCKED_PENDING_TRUSTED_REVIEW_RECORD' as const,
    customerDeliveryAllowed: false as const,
    storageWrites: 1 as const,
    openAiRequests: 0 as const,
  })
  activeReceipts.set(receipt, receipt)
  return receipt
}

export function consumeAiChartD1PalaceWritingPersistedHumanReviewRecord(
  value: unknown,
): AiChartD1PalaceWritingPersistedHumanReviewRecord {
  if (value === null || typeof value !== 'object') {
    throw new AiChartD1PalaceWritingHumanReviewRecordReceiptUnavailableError()
  }
  const receipt =
    value as
      AiChartD1PalaceWritingPersistedHumanReviewRecord
  if (consumedReceipts.has(receipt)) {
    throw new AiChartD1PalaceWritingHumanReviewRecordReceiptUnavailableError()
  }
  const activeReceipt = activeReceipts.get(receipt)
  if (activeReceipt === undefined) {
    throw new AiChartD1PalaceWritingHumanReviewRecordReceiptUnavailableError()
  }
  activeReceipts.delete(receipt)
  consumedReceipts.add(receipt)
  return activeReceipt
}

export async function persistAiChartD1PalaceWritingHumanReviewRecord(
  envelopeValue: unknown,
): Promise<AiChartD1PalaceWritingPersistedHumanReviewRecord> {
  const envelope =
    consumeAiChartD1PalaceWritingHumanReviewRecordEnvelope(
      envelopeValue,
    )
  const payload = createAiChartD1CanonicalJson(
    envelope.reviewRecord,
  )
  if (
    sha256(payload) !==
    envelope.recordPayloadSha256
  ) {
    storageInvalid()
  }

  let gateDirectory: string
  try {
    const storageRoot = await resolveStorageRoot()
    gateDirectory = await claimRecordDirectory(
      storageRoot,
      envelope.reviewRecord.gateFingerprint,
    )
  } catch (error) {
    if (
      error instanceof
        AiChartD1PalaceWritingHumanReviewRecordAlreadyPersistedError ||
      error instanceof
        AiChartD1PalaceWritingHumanReviewRecordStorageError
    ) {
      throw error
    }
    storageInvalid()
  }

  const artifactPath = join(
    gateDirectory,
    envelope.recordArtifactName,
  )
  let artifactFile
  try {
    artifactFile = await open(
      artifactPath,
      'wx',
      0o600,
    )
  } catch (error) {
    if (isNodeErrorWithCode(error, 'EEXIST')) {
      alreadyPersisted()
    }
    storageInvalid()
  }

  try {
    await artifactFile.writeFile(payload, {
      encoding: 'utf8',
    })
    await artifactFile.sync()
  } catch {
    storageInvalid()
  } finally {
    await artifactFile
      .close()
      .catch(() => undefined)
  }
  await validatePrivateRecordFile(artifactPath)

  return createReceipt(envelope)
}
