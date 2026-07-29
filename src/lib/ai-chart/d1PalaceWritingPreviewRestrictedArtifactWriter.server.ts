import 'server-only'

import { lstat, mkdir, open, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import {
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import {
  AiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceError,
  parseAiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceEnvelope,
  type AiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceEnvelope,
} from './d1PalaceWritingPreviewRestrictedArtifactPersistenceContracts.server'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'

export const AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_WRITER_VERSION =
  'ai-chart-d1-palace-writing-preview-restricted-artifact-writer/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_WRITER_TASK =
  'D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_WRITER' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_ALREADY_PERSISTED =
  'ai_chart_d1_palace_writing_preview_restricted_artifact_already_persisted' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_STORAGE_INVALID =
  'ai_chart_d1_palace_writing_preview_restricted_artifact_storage_invalid' as const

export type AiChartD1PalaceWritingPreviewPersistedRestrictedArtifact =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_WRITER_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_WRITER_TASK
    gateFingerprint: string
    authority:
      'TRUSTED_SERVER_RESTRICTED_ARTIFACT_STORAGE_ADAPTER'
    dataClassification: 'RESTRICTED_MODEL_OUTPUT'
    artifactName: 'restricted-result.json'
    restrictedArtifactFingerprint: string
    artifactPayloadSha256: string
    status: 'PERSISTED'
    serialization: 'CANONICAL_JSON_UTF8'
    createMode: 'EXCLUSIVE_CREATE'
    directoryMode: '0700'
    fileMode: '0600'
    overwriteAllowed: false
    retryAllowed: false
    accessPolicy: 'SERVER_ONLY_EXPLICIT_HUMAN_REVIEW'
    humanReviewStatus: 'NOT_REVIEWED'
    customerDeliveryStatus:
      'BLOCKED_PENDING_HUMAN_REVIEW'
    safeEvidenceArtifactStatus:
      'SEPARATE_ALREADY_VERIFIED_NOT_INCLUDED'
  }>

export class AiChartD1PalaceWritingPreviewRestrictedArtifactAlreadyPersistedError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_ALREADY_PERSISTED

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_ALREADY_PERSISTED,
    )
    this.name =
      'AiChartD1PalaceWritingPreviewRestrictedArtifactAlreadyPersistedError'
    Object.freeze(this)
  }
}

export class AiChartD1PalaceWritingPreviewRestrictedArtifactStorageError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_STORAGE_INVALID

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_STORAGE_INVALID,
    )
    this.name =
      'AiChartD1PalaceWritingPreviewRestrictedArtifactStorageError'
    Object.freeze(this)
  }
}

function alreadyPersisted(): never {
  throw new AiChartD1PalaceWritingPreviewRestrictedArtifactAlreadyPersistedError()
}

function storageInvalid(): never {
  throw new AiChartD1PalaceWritingPreviewRestrictedArtifactStorageError()
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

function isPathInside(root: string, candidate: string): boolean {
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
    typeof process.getuid === 'function' ? process.getuid() : null
  if (
    metadata.isSymbolicLink() ||
    !metadata.isDirectory() ||
    (metadata.mode & 0o777) !== 0o700 ||
    (currentUserId !== null && metadata.uid !== currentUserId)
  ) {
    storageInvalid()
  }
}

async function validatePrivateRestrictedArtifactFile(
  artifactPath: string,
): Promise<void> {
  const metadata = await lstat(artifactPath)
  const currentUserId =
    typeof process.getuid === 'function' ? process.getuid() : null
  if (
    metadata.isSymbolicLink() ||
    !metadata.isFile() ||
    (metadata.mode & 0o777) !== 0o600 ||
    (currentUserId !== null && metadata.uid !== currentUserId)
  ) {
    storageInvalid()
  }
}

async function resolveStorageRoot(): Promise<string> {
  const systemTemporaryRoot = await realpath(resolve(tmpdir()))
  const unresolvedStorageRoot = resolve(
    join(
      tmpdir(),
      'ai-chart-d1-palace-writing-preview-restricted-artifact',
    ),
  )

  try {
    await mkdir(unresolvedStorageRoot, { mode: 0o700 })
  } catch (error) {
    if (!isNodeErrorWithCode(error, 'EEXIST')) {
      storageInvalid()
    }
  }
  await validatePrivateDirectory(unresolvedStorageRoot)
  const storageRoot = await realpath(unresolvedStorageRoot)
  if (!isPathInside(systemTemporaryRoot, storageRoot)) {
    storageInvalid()
  }
  return storageRoot
}

async function claimRestrictedArtifactDirectory(
  storageRoot: string,
  gateFingerprint: string,
): Promise<string> {
  const gateDirectory = join(storageRoot, gateFingerprint)
  if (!isPathInside(storageRoot, gateDirectory)) {
    storageInvalid()
  }
  try {
    await mkdir(gateDirectory, { mode: 0o700 })
  } catch (error) {
    if (isNodeErrorWithCode(error, 'EEXIST')) {
      try {
        await validatePrivateDirectory(gateDirectory)
      } catch (metadataError) {
        if (
          metadataError instanceof
          AiChartD1PalaceWritingPreviewRestrictedArtifactStorageError
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

function createPersistedRestrictedArtifact(
  envelope:
    AiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceEnvelope,
): AiChartD1PalaceWritingPreviewPersistedRestrictedArtifact {
  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_WRITER_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_WRITER_TASK,
    gateFingerprint: envelope.gateFingerprint,
    authority:
      'TRUSTED_SERVER_RESTRICTED_ARTIFACT_STORAGE_ADAPTER' as const,
    dataClassification:
      'RESTRICTED_MODEL_OUTPUT' as const,
    artifactName: 'restricted-result.json' as const,
    restrictedArtifactFingerprint:
      envelope.restrictedArtifactFingerprint,
    artifactPayloadSha256: envelope.artifactPayloadSha256,
    status: 'PERSISTED' as const,
    serialization: 'CANONICAL_JSON_UTF8' as const,
    createMode: 'EXCLUSIVE_CREATE' as const,
    directoryMode: '0700' as const,
    fileMode: '0600' as const,
    overwriteAllowed: false as const,
    retryAllowed: false as const,
    accessPolicy:
      'SERVER_ONLY_EXPLICIT_HUMAN_REVIEW' as const,
    humanReviewStatus: 'NOT_REVIEWED' as const,
    customerDeliveryStatus:
      'BLOCKED_PENDING_HUMAN_REVIEW' as const,
    safeEvidenceArtifactStatus:
      'SEPARATE_ALREADY_VERIFIED_NOT_INCLUDED' as const,
  })
}

function parseWriterInput(
  input: unknown,
): AiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceEnvelope {
  try {
    assertAiChartD1SafeGraph(input)
    const record = requireAiChartD1ExactObject(input, [
      'previewPlan',
      'gatePlan',
      'verifiedEvidence',
      'writingPromptPackage',
      'fidelityPromptPackage',
      'envelope',
    ])
    return parseAiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceEnvelope(
      record.envelope,
      {
        previewPlan: record.previewPlan,
        gatePlan: record.gatePlan,
        verifiedEvidence: record.verifiedEvidence,
        writingPromptPackage: record.writingPromptPackage,
        fidelityPromptPackage: record.fidelityPromptPackage,
      },
    )
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceError
    ) {
      throw error
    }
    throw new AiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceError()
  }
}

export async function persistAiChartD1PalaceWritingPreviewRestrictedArtifact(
  input: Readonly<{
    previewPlan: unknown
    gatePlan: unknown
    verifiedEvidence: unknown
    writingPromptPackage: unknown
    fidelityPromptPackage: unknown
    envelope: unknown
  }>,
): Promise<AiChartD1PalaceWritingPreviewPersistedRestrictedArtifact> {
  const envelope = parseWriterInput(input)
  const payload =
    createAiChartD1PalaceWritingCanonicalJson(
      envelope.restrictedArtifact,
    )
  const persistedRestrictedArtifact =
    createPersistedRestrictedArtifact(envelope)

  let gateDirectory: string
  try {
    const storageRoot = await resolveStorageRoot()
    gateDirectory = await claimRestrictedArtifactDirectory(
      storageRoot,
      envelope.gateFingerprint,
    )
  } catch (error) {
    if (
      error instanceof
        AiChartD1PalaceWritingPreviewRestrictedArtifactAlreadyPersistedError ||
      error instanceof
        AiChartD1PalaceWritingPreviewRestrictedArtifactStorageError
    ) {
      throw error
    }
    storageInvalid()
  }

  const artifactPath = join(
    gateDirectory,
    envelope.artifactName,
  )
  let artifactFile
  try {
    artifactFile = await open(artifactPath, 'wx', 0o600)
  } catch (error) {
    if (isNodeErrorWithCode(error, 'EEXIST')) {
      alreadyPersisted()
    }
    storageInvalid()
  }

  try {
    await artifactFile.writeFile(payload, { encoding: 'utf8' })
    await artifactFile.sync()
  } catch {
    storageInvalid()
  } finally {
    await artifactFile.close().catch(() => undefined)
  }
  await validatePrivateRestrictedArtifactFile(artifactPath)

  return persistedRestrictedArtifact
}
