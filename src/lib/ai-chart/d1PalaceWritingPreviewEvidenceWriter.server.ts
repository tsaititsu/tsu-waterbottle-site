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
  AiChartD1PalaceWritingPreviewEvidencePersistenceError,
  parseAiChartD1PalaceWritingPreviewEvidencePersistenceEnvelope,
  type AiChartD1PalaceWritingPreviewEvidencePersistenceEnvelope,
} from './d1PalaceWritingPreviewEvidencePersistenceContracts'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'

export const AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_WRITER_VERSION =
  'ai-chart-d1-palace-writing-preview-evidence-writer/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_WRITER_TASK =
  'D1_PALACE_WRITING_PREVIEW_EVIDENCE_WRITER' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_ALREADY_PERSISTED =
  'ai_chart_d1_palace_writing_preview_evidence_already_persisted' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_STORAGE_INVALID =
  'ai_chart_d1_palace_writing_preview_evidence_storage_invalid' as const

export type AiChartD1PalaceWritingPreviewPersistedEvidence =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_WRITER_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_WRITER_TASK
    gateFingerprint: string
    authority: 'TRUSTED_SERVER_EVIDENCE_STORAGE_ADAPTER'
    artifactName:
      | 'request-succeeded.json'
      | 'request-failed.json'
    evidenceFingerprint: string
    status: 'PERSISTED'
    serialization: 'CANONICAL_JSON_UTF8'
    createMode: 'EXCLUSIVE_CREATE'
    directoryMode: '0700'
    fileMode: '0600'
    overwriteAllowed: false
    retryAllowed: false
    restrictedResultArtifactStatus: 'NOT_PERSISTED'
  }>

export class AiChartD1PalaceWritingPreviewEvidenceAlreadyPersistedError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_ALREADY_PERSISTED

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_ALREADY_PERSISTED,
    )
    this.name =
      'AiChartD1PalaceWritingPreviewEvidenceAlreadyPersistedError'
    Object.freeze(this)
  }
}

export class AiChartD1PalaceWritingPreviewEvidenceStorageError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_STORAGE_INVALID

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_STORAGE_INVALID,
    )
    this.name =
      'AiChartD1PalaceWritingPreviewEvidenceStorageError'
    Object.freeze(this)
  }
}

function alreadyPersisted(): never {
  throw new AiChartD1PalaceWritingPreviewEvidenceAlreadyPersistedError()
}

function storageInvalid(): never {
  throw new AiChartD1PalaceWritingPreviewEvidenceStorageError()
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

async function validatePrivateEvidenceFile(
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
      'ai-chart-d1-palace-writing-preview-evidence',
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

async function claimEvidenceDirectory(
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
          AiChartD1PalaceWritingPreviewEvidenceStorageError
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

function createPersistedEvidence(
  gateFingerprint: string,
  artifactName:
    | 'request-succeeded.json'
    | 'request-failed.json',
  evidenceFingerprint: string,
): AiChartD1PalaceWritingPreviewPersistedEvidence {
  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_WRITER_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_WRITER_TASK,
    gateFingerprint,
    authority:
      'TRUSTED_SERVER_EVIDENCE_STORAGE_ADAPTER' as const,
    artifactName,
    evidenceFingerprint,
    status: 'PERSISTED' as const,
    serialization: 'CANONICAL_JSON_UTF8' as const,
    createMode: 'EXCLUSIVE_CREATE' as const,
    directoryMode: '0700' as const,
    fileMode: '0600' as const,
    overwriteAllowed: false as const,
    retryAllowed: false as const,
    restrictedResultArtifactStatus: 'NOT_PERSISTED' as const,
  })
}

function parseWriterInput(
  input: unknown,
): AiChartD1PalaceWritingPreviewEvidencePersistenceEnvelope {
  try {
    assertAiChartD1SafeGraph(input)
    const record = requireAiChartD1ExactObject(input, [
      'previewPlan',
      'gatePlan',
      'envelope',
    ])
    return parseAiChartD1PalaceWritingPreviewEvidencePersistenceEnvelope(
      record.envelope,
      record.previewPlan,
      record.gatePlan,
    )
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingPreviewEvidencePersistenceError
    ) {
      throw error
    }
    throw new AiChartD1PalaceWritingPreviewEvidencePersistenceError()
  }
}

export async function persistAiChartD1PalaceWritingPreviewEvidence(
  input: Readonly<{
    previewPlan: unknown
    gatePlan: unknown
    envelope: unknown
  }>,
): Promise<AiChartD1PalaceWritingPreviewPersistedEvidence> {
  const envelope = parseWriterInput(input)
  const payload =
    createAiChartD1PalaceWritingCanonicalJson(
      envelope.evidence,
    )
  const persistedEvidence = createPersistedEvidence(
    envelope.gateFingerprint,
    envelope.artifactName,
    envelope.evidenceFingerprint,
  )

  let gateDirectory: string
  try {
    const storageRoot = await resolveStorageRoot()
    gateDirectory = await claimEvidenceDirectory(
      storageRoot,
      envelope.gateFingerprint,
    )
  } catch (error) {
    if (
      error instanceof
        AiChartD1PalaceWritingPreviewEvidenceAlreadyPersistedError ||
      error instanceof
        AiChartD1PalaceWritingPreviewEvidenceStorageError
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
  await validatePrivateEvidenceFile(artifactPath)

  return persistedEvidence
}
