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
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import {
  parseAiChartD1PalaceWritingPreviewPlan,
} from './d1PalaceWritingPreviewContracts'
import {
  parseAiChartD1PalaceWritingPreviewGatePlan,
} from './d1PalaceWritingPreviewGateContracts'
import {
  parseAiChartD1PalaceWritingPreviewRestrictedArtifact,
  type AiChartD1PalaceWritingPreviewRestrictedArtifact,
} from './d1PalaceWritingPreviewRestrictedArtifactContracts.server'
import {
  AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_WRITER_TASK,
  AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_WRITER_VERSION,
} from './d1PalaceWritingPreviewRestrictedArtifactWriter.server'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'

export const AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_READBACK_VERSION =
  'ai-chart-d1-palace-writing-preview-restricted-artifact-readback/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_READBACK_TASK =
  'D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_READBACK' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_READBACK_INVALID =
  'ai_chart_d1_palace_writing_preview_restricted_artifact_readback_invalid' as const

const MAX_RESTRICTED_ARTIFACT_BYTES = 256 * 1024
const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const PERSISTED_RESTRICTED_ARTIFACT_FIELDS = Object.freeze([
  'contractVersion',
  'task',
  'gateFingerprint',
  'authority',
  'dataClassification',
  'artifactName',
  'restrictedArtifactFingerprint',
  'artifactPayloadSha256',
  'status',
  'serialization',
  'createMode',
  'directoryMode',
  'fileMode',
  'overwriteAllowed',
  'retryAllowed',
  'accessPolicy',
  'humanReviewStatus',
  'customerDeliveryStatus',
  'safeEvidenceArtifactStatus',
] as const)

export type AiChartD1PalaceWritingPreviewVerifiedRestrictedArtifact =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_READBACK_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_READBACK_TASK
    gateFingerprint: string
    authority:
      'TRUSTED_SERVER_RESTRICTED_ARTIFACT_READBACK_ADAPTER'
    dataClassification: 'RESTRICTED_MODEL_OUTPUT'
    artifactName: 'restricted-result.json'
    restrictedArtifactFingerprint: string
    artifactPayloadSha256: string
    status: 'VERIFIED'
    restrictedArtifact:
      AiChartD1PalaceWritingPreviewRestrictedArtifact
    accessPolicy: 'SERVER_ONLY_EXPLICIT_HUMAN_REVIEW'
    humanReviewStatus: 'NOT_REVIEWED'
    customerDeliveryStatus:
      'BLOCKED_PENDING_HUMAN_REVIEW'
    safeEvidenceArtifactStatus:
      'SEPARATE_ALREADY_VERIFIED_NOT_INCLUDED'
  }>

export class AiChartD1PalaceWritingPreviewRestrictedArtifactReadbackError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_READBACK_INVALID

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_READBACK_INVALID,
    )
    Object.defineProperty(this, 'name', {
      value:
        'AiChartD1PalaceWritingPreviewRestrictedArtifactReadbackError',
      enumerable: false,
      configurable: true,
    })
    Object.freeze(this)
  }
}

function invalid(): never {
  throw new AiChartD1PalaceWritingPreviewRestrictedArtifactReadbackError()
}

function isPathInside(root: string, candidate: string): boolean {
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

function parsePersistedRestrictedArtifactReceipt(
  value: unknown,
  gateFingerprint: string,
): Readonly<{
  restrictedArtifactFingerprint: string
  artifactPayloadSha256: string
}> {
  assertAiChartD1SafeGraph(value)
  const record = requireAiChartD1ExactObject(
    value,
    PERSISTED_RESTRICTED_ARTIFACT_FIELDS,
  )
  if (
    record.contractVersion !==
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_WRITER_VERSION ||
    record.task !==
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_WRITER_TASK ||
    record.gateFingerprint !== gateFingerprint ||
    record.authority !==
      'TRUSTED_SERVER_RESTRICTED_ARTIFACT_STORAGE_ADAPTER' ||
    record.dataClassification !== 'RESTRICTED_MODEL_OUTPUT' ||
    record.artifactName !== 'restricted-result.json' ||
    typeof record.restrictedArtifactFingerprint !== 'string' ||
    !SHA256_PATTERN.test(
      record.restrictedArtifactFingerprint,
    ) ||
    typeof record.artifactPayloadSha256 !== 'string' ||
    !SHA256_PATTERN.test(record.artifactPayloadSha256) ||
    record.status !== 'PERSISTED' ||
    record.serialization !== 'CANONICAL_JSON_UTF8' ||
    record.createMode !== 'EXCLUSIVE_CREATE' ||
    record.directoryMode !== '0700' ||
    record.fileMode !== '0600' ||
    record.overwriteAllowed !== false ||
    record.retryAllowed !== false ||
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
    restrictedArtifactFingerprint:
      record.restrictedArtifactFingerprint,
    artifactPayloadSha256: record.artifactPayloadSha256,
  })
}

async function readPrivateRestrictedArtifact(
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
      metadata.size > MAX_RESTRICTED_ARTIFACT_BYTES
    ) {
      invalid()
    }
    const payload = await artifact.readFile({ encoding: 'utf8' })
    if (
      Buffer.byteLength(payload, 'utf8') !== metadata.size ||
      Buffer.byteLength(payload, 'utf8') >
        MAX_RESTRICTED_ARTIFACT_BYTES
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

export async function readAndVerifyAiChartD1PalaceWritingPreviewRestrictedArtifact(
  input: Readonly<{
    previewPlan: unknown
    gatePlan: unknown
    verifiedEvidence: unknown
    writingPromptPackage: unknown
    fidelityPromptPackage: unknown
    persistedRestrictedArtifact: unknown
  }>,
): Promise<AiChartD1PalaceWritingPreviewVerifiedRestrictedArtifact> {
  try {
    assertAiChartD1SafeGraph(input)
    const record = requireAiChartD1ExactObject(input, [
      'previewPlan',
      'gatePlan',
      'verifiedEvidence',
      'writingPromptPackage',
      'fidelityPromptPackage',
      'persistedRestrictedArtifact',
    ])
    const previewPlan =
      parseAiChartD1PalaceWritingPreviewPlan(record.previewPlan)
    const gatePlan =
      parseAiChartD1PalaceWritingPreviewGatePlan(record.gatePlan)
    if (
      gatePlan.fixtureId !== previewPlan.fixtureId ||
      gatePlan.caseFingerprint !== previewPlan.caseFingerprint ||
      gatePlan.previewPlanFingerprint !==
        previewPlan.planFingerprint
    ) {
      invalid()
    }
    const receipt = parsePersistedRestrictedArtifactReceipt(
      record.persistedRestrictedArtifact,
      gatePlan.gateFingerprint,
    )
    const systemTemporaryRoot = await realpath(resolve(tmpdir()))
    const unresolvedStorageRoot = resolve(
      join(
        tmpdir(),
        'ai-chart-d1-palace-writing-preview-restricted-artifact',
      ),
    )
    await requirePrivateDirectory(unresolvedStorageRoot)
    const storageRoot = await realpath(unresolvedStorageRoot)
    if (!isPathInside(systemTemporaryRoot, storageRoot)) {
      invalid()
    }
    const unresolvedGateDirectory = join(
      storageRoot,
      gatePlan.gateFingerprint,
    )
    if (!isPathInside(storageRoot, unresolvedGateDirectory)) {
      invalid()
    }
    await requirePrivateDirectory(unresolvedGateDirectory)
    const gateDirectory = await realpath(
      unresolvedGateDirectory,
    )
    if (!isPathInside(storageRoot, gateDirectory)) invalid()

    const entries = await readdir(gateDirectory)
    if (
      entries.length !== 1 ||
      entries[0] !== 'restricted-result.json'
    ) {
      invalid()
    }
    const artifactPath = join(
      gateDirectory,
      'restricted-result.json',
    )
    if (!isPathInside(gateDirectory, artifactPath)) invalid()
    const payload =
      await readPrivateRestrictedArtifact(artifactPath)
    const parsed = JSON.parse(payload) as unknown
    const restrictedArtifact =
      parseAiChartD1PalaceWritingPreviewRestrictedArtifact(
        parsed,
        previewPlan,
        gatePlan,
        record.verifiedEvidence,
        record.writingPromptPackage,
        record.fidelityPromptPackage,
      )
    const canonicalPayload =
      createAiChartD1PalaceWritingCanonicalJson(
        restrictedArtifact,
      )
    if (
      payload !== canonicalPayload ||
      restrictedArtifact.artifactFingerprint !==
        receipt.restrictedArtifactFingerprint ||
      sha256(payload) !== receipt.artifactPayloadSha256
    ) {
      invalid()
    }

    return freezeAiChartD1Value({
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_READBACK_VERSION,
      task:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_READBACK_TASK,
      gateFingerprint: gatePlan.gateFingerprint,
      authority:
        'TRUSTED_SERVER_RESTRICTED_ARTIFACT_READBACK_ADAPTER' as const,
      dataClassification:
        'RESTRICTED_MODEL_OUTPUT' as const,
      artifactName: 'restricted-result.json' as const,
      restrictedArtifactFingerprint:
        receipt.restrictedArtifactFingerprint,
      artifactPayloadSha256:
        receipt.artifactPayloadSha256,
      status: 'VERIFIED' as const,
      restrictedArtifact,
      accessPolicy:
        'SERVER_ONLY_EXPLICIT_HUMAN_REVIEW' as const,
      humanReviewStatus: 'NOT_REVIEWED' as const,
      customerDeliveryStatus:
        'BLOCKED_PENDING_HUMAN_REVIEW' as const,
      safeEvidenceArtifactStatus:
        'SEPARATE_ALREADY_VERIFIED_NOT_INCLUDED' as const,
    })
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingPreviewRestrictedArtifactReadbackError
    ) {
      throw error
    }
    invalid()
  }
}
