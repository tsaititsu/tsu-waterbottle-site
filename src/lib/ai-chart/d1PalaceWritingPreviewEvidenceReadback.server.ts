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
  parseAiChartD1PalaceWritingPreviewEvidence,
  parseAiChartD1PalaceWritingPreviewPlan,
  type AiChartD1PalaceWritingPreviewEvidence,
} from './d1PalaceWritingPreviewContracts'
import {
  parseAiChartD1PalaceWritingPreviewGatePlan,
} from './d1PalaceWritingPreviewGateContracts'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'
import {
  AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_WRITER_TASK,
  AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_WRITER_VERSION,
} from './d1PalaceWritingPreviewEvidenceWriter.server'

export const AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_READBACK_VERSION =
  'ai-chart-d1-palace-writing-preview-evidence-readback/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_READBACK_TASK =
  'D1_PALACE_WRITING_PREVIEW_EVIDENCE_READBACK' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_READBACK_INVALID =
  'ai_chart_d1_palace_writing_preview_evidence_readback_invalid' as const

const MAX_EVIDENCE_BYTES = 128 * 1024
const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const PERSISTED_EVIDENCE_FIELDS = Object.freeze([
  'contractVersion',
  'task',
  'gateFingerprint',
  'authority',
  'artifactName',
  'evidenceFingerprint',
  'status',
  'serialization',
  'createMode',
  'directoryMode',
  'fileMode',
  'overwriteAllowed',
  'retryAllowed',
  'restrictedResultArtifactStatus',
] as const)

export type AiChartD1PalaceWritingPreviewVerifiedEvidence =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_READBACK_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_READBACK_TASK
    gateFingerprint: string
    authority: 'TRUSTED_SERVER_EVIDENCE_READBACK_ADAPTER'
    artifactName:
      | 'request-succeeded.json'
      | 'request-failed.json'
    evidenceFingerprint: string
    status: 'VERIFIED'
    evidence: AiChartD1PalaceWritingPreviewEvidence
    restrictedResultArtifactStatus: 'NOT_READ'
  }>

export class AiChartD1PalaceWritingPreviewEvidenceReadbackError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_READBACK_INVALID

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_READBACK_INVALID,
    )
    Object.defineProperty(this, 'name', {
      value:
        'AiChartD1PalaceWritingPreviewEvidenceReadbackError',
      enumerable: false,
      configurable: true,
    })
    Object.freeze(this)
  }
}

function invalid(): never {
  throw new AiChartD1PalaceWritingPreviewEvidenceReadbackError()
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

function parsePersistedEvidenceReceipt(
  value: unknown,
  gateFingerprint: string,
): Readonly<{
  artifactName:
    | 'request-succeeded.json'
    | 'request-failed.json'
  evidenceFingerprint: string
}> {
  assertAiChartD1SafeGraph(value)
  const record = requireAiChartD1ExactObject(
    value,
    PERSISTED_EVIDENCE_FIELDS,
  )
  if (
    record.contractVersion !==
      AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_WRITER_VERSION ||
    record.task !==
      AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_WRITER_TASK ||
    record.gateFingerprint !== gateFingerprint ||
    record.authority !==
      'TRUSTED_SERVER_EVIDENCE_STORAGE_ADAPTER' ||
    (record.artifactName !== 'request-succeeded.json' &&
      record.artifactName !== 'request-failed.json') ||
    typeof record.evidenceFingerprint !== 'string' ||
    !SHA256_PATTERN.test(record.evidenceFingerprint) ||
    record.status !== 'PERSISTED' ||
    record.serialization !== 'CANONICAL_JSON_UTF8' ||
    record.createMode !== 'EXCLUSIVE_CREATE' ||
    record.directoryMode !== '0700' ||
    record.fileMode !== '0600' ||
    record.overwriteAllowed !== false ||
    record.retryAllowed !== false ||
    record.restrictedResultArtifactStatus !== 'NOT_PERSISTED'
  ) {
    invalid()
  }
  return freezeAiChartD1Value({
    artifactName: record.artifactName,
    evidenceFingerprint: record.evidenceFingerprint,
  })
}

async function readPrivateEvidence(
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
      metadata.size > MAX_EVIDENCE_BYTES
    ) {
      invalid()
    }
    const payload = await artifact.readFile({ encoding: 'utf8' })
    if (
      Buffer.byteLength(payload, 'utf8') !== metadata.size ||
      Buffer.byteLength(payload, 'utf8') >
        MAX_EVIDENCE_BYTES
    ) {
      invalid()
    }
    return payload
  } finally {
    await artifact.close().catch(() => undefined)
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export async function readAndVerifyAiChartD1PalaceWritingPreviewEvidence(
  input: Readonly<{
    previewPlan: unknown
    gatePlan: unknown
    persistedEvidence: unknown
  }>,
): Promise<AiChartD1PalaceWritingPreviewVerifiedEvidence> {
  try {
    assertAiChartD1SafeGraph(input)
    const record = requireAiChartD1ExactObject(input, [
      'previewPlan',
      'gatePlan',
      'persistedEvidence',
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
    const receipt = parsePersistedEvidenceReceipt(
      record.persistedEvidence,
      gatePlan.gateFingerprint,
    )
    const systemTemporaryRoot = await realpath(resolve(tmpdir()))
    const unresolvedStorageRoot = resolve(
      join(
        tmpdir(),
        'ai-chart-d1-palace-writing-preview-evidence',
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
      entries[0] !== receipt.artifactName
    ) {
      invalid()
    }
    const artifactPath = join(
      gateDirectory,
      receipt.artifactName,
    )
    if (!isPathInside(gateDirectory, artifactPath)) invalid()
    const payload = await readPrivateEvidence(artifactPath)
    const parsed = JSON.parse(payload) as unknown
    const evidence =
      parseAiChartD1PalaceWritingPreviewEvidence(
        parsed,
        previewPlan,
      )
    const canonicalPayload =
      createAiChartD1PalaceWritingCanonicalJson(evidence)
    const expectedArtifactName =
      evidence.status === 'SUCCEEDED'
        ? 'request-succeeded.json'
        : 'request-failed.json'
    if (
      payload !== canonicalPayload ||
      receipt.artifactName !== expectedArtifactName ||
      sha256(payload) !== receipt.evidenceFingerprint
    ) {
      invalid()
    }

    return freezeAiChartD1Value({
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_READBACK_VERSION,
      task:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_READBACK_TASK,
      gateFingerprint: gatePlan.gateFingerprint,
      authority:
        'TRUSTED_SERVER_EVIDENCE_READBACK_ADAPTER' as const,
      artifactName: receipt.artifactName,
      evidenceFingerprint: receipt.evidenceFingerprint,
      status: 'VERIFIED' as const,
      evidence,
      restrictedResultArtifactStatus: 'NOT_READ' as const,
    })
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingPreviewEvidenceReadbackError
    ) {
      throw error
    }
    invalid()
  }
}
