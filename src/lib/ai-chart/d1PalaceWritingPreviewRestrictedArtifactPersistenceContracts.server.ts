import 'server-only'

import { createHash } from 'node:crypto'
import {
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import {
  parseAiChartD1PalaceWritingPreviewRestrictedArtifact,
  type AiChartD1PalaceWritingPreviewRestrictedArtifact,
} from './d1PalaceWritingPreviewRestrictedArtifactContracts.server'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'

export const AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_PERSISTENCE_ENVELOPE_VERSION =
  'ai-chart-d1-palace-writing-preview-restricted-artifact-persistence-envelope/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_PERSISTENCE_ENVELOPE_TASK =
  'D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_PERSISTENCE_ENVELOPE' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_PERSISTENCE_INVALID =
  'ai_chart_d1_palace_writing_preview_restricted_artifact_persistence_invalid' as const

export type AiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceEnvelope =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_PERSISTENCE_ENVELOPE_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_PERSISTENCE_ENVELOPE_TASK
    dataClassification: 'RESTRICTED_MODEL_OUTPUT'
    fixtureId: string
    caseFingerprint: string
    previewPlanFingerprint: string
    gateFingerprint: string
    safeEvidenceFingerprint: string
    restrictedArtifactFingerprint: string
    artifactPayloadSha256: string
    artifactName: 'restricted-result.json'
    storageScope: 'GATE_FINGERPRINT'
    storageAuthority:
      'TRUSTED_SERVER_RESTRICTED_ARTIFACT_STORAGE_ADAPTER_REQUIRED'
    serialization: 'CANONICAL_JSON_UTF8'
    createMode: 'EXCLUSIVE_CREATE'
    directoryMode: '0700'
    fileMode: '0600'
    overwriteAllowed: false
    retryAllowed: false
    persistenceStatus: 'NOT_PERSISTED'
    accessPolicy: 'SERVER_ONLY_EXPLICIT_HUMAN_REVIEW'
    humanReviewStatus: 'NOT_REVIEWED'
    customerDeliveryStatus:
      'BLOCKED_PENDING_HUMAN_REVIEW'
    safeEvidenceArtifactPolicy:
      'SEPARATE_ALREADY_VERIFIED_NOT_INCLUDED'
    nextRequiredAction:
      'PERSIST_WITH_TRUSTED_SERVER_RESTRICTED_ARTIFACT_ADAPTER'
    restrictedArtifact:
      AiChartD1PalaceWritingPreviewRestrictedArtifact
  }>

const ENVELOPE_FIELDS = Object.freeze([
  'contractVersion',
  'task',
  'dataClassification',
  'fixtureId',
  'caseFingerprint',
  'previewPlanFingerprint',
  'gateFingerprint',
  'safeEvidenceFingerprint',
  'restrictedArtifactFingerprint',
  'artifactPayloadSha256',
  'artifactName',
  'storageScope',
  'storageAuthority',
  'serialization',
  'createMode',
  'directoryMode',
  'fileMode',
  'overwriteAllowed',
  'retryAllowed',
  'persistenceStatus',
  'accessPolicy',
  'humanReviewStatus',
  'customerDeliveryStatus',
  'safeEvidenceArtifactPolicy',
  'nextRequiredAction',
  'restrictedArtifact',
] as const)
const INPUT_FIELDS = Object.freeze([
  'previewPlan',
  'gatePlan',
  'verifiedEvidence',
  'writingPromptPackage',
  'fidelityPromptPackage',
  'restrictedArtifact',
] as const)
const SHA256_PATTERN = /^[a-f0-9]{64}$/u

export class AiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_PERSISTENCE_INVALID

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_PERSISTENCE_INVALID,
    )
    Object.defineProperty(this, 'name', {
      value:
        'AiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceError',
      enumerable: false,
      configurable: true,
    })
    Object.freeze(this)
  }
}

function invalid(): never {
  throw new AiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceError()
}

function sha256Canonical(value: unknown): string {
  return createHash('sha256')
    .update(
      createAiChartD1PalaceWritingCanonicalJson(value),
      'utf8',
    )
    .digest('hex')
}

function buildEnvelope(
  restrictedArtifact:
    AiChartD1PalaceWritingPreviewRestrictedArtifact,
): AiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceEnvelope {
  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_PERSISTENCE_ENVELOPE_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_PERSISTENCE_ENVELOPE_TASK,
    dataClassification: 'RESTRICTED_MODEL_OUTPUT' as const,
    fixtureId: restrictedArtifact.fixtureId,
    caseFingerprint: restrictedArtifact.caseFingerprint,
    previewPlanFingerprint:
      restrictedArtifact.previewPlanFingerprint,
    gateFingerprint: restrictedArtifact.gateFingerprint,
    safeEvidenceFingerprint:
      restrictedArtifact.safeEvidenceFingerprint,
    restrictedArtifactFingerprint:
      restrictedArtifact.artifactFingerprint,
    artifactPayloadSha256:
      sha256Canonical(restrictedArtifact),
    artifactName: 'restricted-result.json' as const,
    storageScope: 'GATE_FINGERPRINT' as const,
    storageAuthority:
      'TRUSTED_SERVER_RESTRICTED_ARTIFACT_STORAGE_ADAPTER_REQUIRED' as const,
    serialization: 'CANONICAL_JSON_UTF8' as const,
    createMode: 'EXCLUSIVE_CREATE' as const,
    directoryMode: '0700' as const,
    fileMode: '0600' as const,
    overwriteAllowed: false as const,
    retryAllowed: false as const,
    persistenceStatus: 'NOT_PERSISTED' as const,
    accessPolicy:
      'SERVER_ONLY_EXPLICIT_HUMAN_REVIEW' as const,
    humanReviewStatus: 'NOT_REVIEWED' as const,
    customerDeliveryStatus:
      'BLOCKED_PENDING_HUMAN_REVIEW' as const,
    safeEvidenceArtifactPolicy:
      'SEPARATE_ALREADY_VERIFIED_NOT_INCLUDED' as const,
    nextRequiredAction:
      'PERSIST_WITH_TRUSTED_SERVER_RESTRICTED_ARTIFACT_ADAPTER' as const,
    restrictedArtifact,
  })
}

function parseRestrictedArtifactFromInput(
  record: Readonly<Record<string, unknown>>,
): AiChartD1PalaceWritingPreviewRestrictedArtifact {
  return parseAiChartD1PalaceWritingPreviewRestrictedArtifact(
    record.restrictedArtifact,
    record.previewPlan,
    record.gatePlan,
    record.verifiedEvidence,
    record.writingPromptPackage,
    record.fidelityPromptPackage,
  )
}

export function buildAiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceEnvelope(
  input: Readonly<{
    previewPlan: unknown
    gatePlan: unknown
    verifiedEvidence: unknown
    writingPromptPackage: unknown
    fidelityPromptPackage: unknown
    restrictedArtifact: unknown
  }>,
): AiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceEnvelope {
  try {
    assertAiChartD1SafeGraph(input)
    const record = requireAiChartD1ExactObject(
      input,
      INPUT_FIELDS,
    )
    return buildEnvelope(
      parseRestrictedArtifactFromInput(record),
    )
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceError
    ) {
      throw error
    }
    invalid()
  }
}

export function parseAiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceEnvelope(
  value: unknown,
  sourceInput: Readonly<{
    previewPlan: unknown
    gatePlan: unknown
    verifiedEvidence: unknown
    writingPromptPackage: unknown
    fidelityPromptPackage: unknown
  }>,
): AiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceEnvelope {
  try {
    assertAiChartD1SafeGraph({
      value,
      sourceInput,
    })
    const sourceRecord = requireAiChartD1ExactObject(
      sourceInput,
      [
        'previewPlan',
        'gatePlan',
        'verifiedEvidence',
        'writingPromptPackage',
        'fidelityPromptPackage',
      ],
    )
    const record = requireAiChartD1ExactObject(
      value,
      ENVELOPE_FIELDS,
    )
    const restrictedArtifact =
      parseRestrictedArtifactFromInput({
        ...sourceRecord,
        restrictedArtifact: record.restrictedArtifact,
      })
    const rebuilt = buildEnvelope(restrictedArtifact)
    if (
      typeof record.restrictedArtifactFingerprint !==
        'string' ||
      !SHA256_PATTERN.test(
        record.restrictedArtifactFingerprint,
      ) ||
      typeof record.artifactPayloadSha256 !== 'string' ||
      !SHA256_PATTERN.test(record.artifactPayloadSha256) ||
      createAiChartD1PalaceWritingCanonicalJson(value) !==
        createAiChartD1PalaceWritingCanonicalJson(rebuilt)
    ) {
      invalid()
    }
    return rebuilt
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingPreviewRestrictedArtifactPersistenceError
    ) {
      throw error
    }
    invalid()
  }
}
