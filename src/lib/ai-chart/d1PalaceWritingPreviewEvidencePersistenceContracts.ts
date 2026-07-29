import { createHash } from 'node:crypto'
import {
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import {
  parseAiChartD1PalaceWritingPreviewEvidence,
  parseAiChartD1PalaceWritingPreviewPlan,
  type AiChartD1PalaceWritingPreviewEvidence,
  type AiChartD1PalaceWritingPreviewPlan,
} from './d1PalaceWritingPreviewContracts'
import {
  projectAiChartD1PalaceWritingPreviewEvidence,
} from './d1PalaceWritingPreviewEvidenceProjectionContracts'
import type {
  AiChartD1PalaceWritingPreviewExecutionLedger,
} from './d1PalaceWritingPreviewExecutionLedgerContracts'
import {
  parseAiChartD1PalaceWritingPreviewGatePlan,
} from './d1PalaceWritingPreviewGateContracts'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'

export const AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_PERSISTENCE_ENVELOPE_VERSION =
  'ai-chart-d1-palace-writing-preview-evidence-persistence-envelope/v1' as const

export const AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_PERSISTENCE_ENVELOPE_TASK =
  'D1_PALACE_WRITING_PREVIEW_EVIDENCE_PERSISTENCE_ENVELOPE' as const

export const AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_PERSISTENCE_INVALID =
  'ai_chart_d1_palace_writing_preview_evidence_persistence_invalid' as const

export type AiChartD1PalaceWritingPreviewEvidencePersistenceEnvelope =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_PERSISTENCE_ENVELOPE_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_PERSISTENCE_ENVELOPE_TASK
    fixtureId: AiChartD1PalaceWritingPreviewPlan['fixtureId']
    caseFingerprint: string
    previewPlanFingerprint: string
    gateFingerprint: string
    artifactName:
      | 'request-succeeded.json'
      | 'request-failed.json'
    evidenceFingerprint: string
    storageScope: 'GATE_FINGERPRINT'
    storageAuthority:
      'TRUSTED_SERVER_EVIDENCE_STORAGE_ADAPTER_REQUIRED'
    serialization: 'CANONICAL_JSON_UTF8'
    createMode: 'EXCLUSIVE_CREATE'
    directoryMode: '0700'
    fileMode: '0600'
    overwriteAllowed: false
    retryAllowed: false
    persistenceStatus: 'NOT_PERSISTED'
    nextRequiredAction:
      'PERSIST_WITH_TRUSTED_SERVER_ADAPTER'
    restrictedResultArtifactPolicy: 'SEPARATE_NOT_INCLUDED'
    evidence: AiChartD1PalaceWritingPreviewEvidence
  }>

const PERSISTENCE_ENVELOPE_FIELDS = Object.freeze([
  'contractVersion',
  'task',
  'fixtureId',
  'caseFingerprint',
  'previewPlanFingerprint',
  'gateFingerprint',
  'artifactName',
  'evidenceFingerprint',
  'storageScope',
  'storageAuthority',
  'serialization',
  'createMode',
  'directoryMode',
  'fileMode',
  'overwriteAllowed',
  'retryAllowed',
  'persistenceStatus',
  'nextRequiredAction',
  'restrictedResultArtifactPolicy',
  'evidence',
] as const)

const SHA256_PATTERN = /^[a-f0-9]{64}$/u

export class AiChartD1PalaceWritingPreviewEvidencePersistenceError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_PERSISTENCE_INVALID

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_PERSISTENCE_INVALID,
    )
    Object.defineProperty(this, 'name', {
      value:
        'AiChartD1PalaceWritingPreviewEvidencePersistenceError',
      enumerable: false,
      configurable: true,
    })
    Object.freeze(this)
  }
}

function invalid(): never {
  throw new AiChartD1PalaceWritingPreviewEvidencePersistenceError()
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function buildEnvelope(
  input: Readonly<{
    previewPlan: unknown
    gatePlan: unknown
    executionLedger: unknown
  }>,
): AiChartD1PalaceWritingPreviewEvidencePersistenceEnvelope {
  const previewPlan =
    parseAiChartD1PalaceWritingPreviewPlan(input.previewPlan)
  const gatePlan =
    parseAiChartD1PalaceWritingPreviewGatePlan(input.gatePlan)
  if (
    gatePlan.fixtureId !== previewPlan.fixtureId ||
    gatePlan.caseFingerprint !== previewPlan.caseFingerprint ||
    gatePlan.previewPlanFingerprint !==
      previewPlan.planFingerprint
  ) {
    invalid()
  }

  const evidence =
    projectAiChartD1PalaceWritingPreviewEvidence({
      previewPlan,
      executionLedger: input.executionLedger,
    })
  const executionLedger =
    input.executionLedger as
      AiChartD1PalaceWritingPreviewExecutionLedger
  if (
    executionLedger.gateFingerprint !==
    gatePlan.gateFingerprint
  ) {
    invalid()
  }

  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_PERSISTENCE_ENVELOPE_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_PERSISTENCE_ENVELOPE_TASK,
    fixtureId: previewPlan.fixtureId,
    caseFingerprint: previewPlan.caseFingerprint,
    previewPlanFingerprint: previewPlan.planFingerprint,
    gateFingerprint: gatePlan.gateFingerprint,
    artifactName:
      evidence.status === 'SUCCEEDED'
        ? ('request-succeeded.json' as const)
        : ('request-failed.json' as const),
    evidenceFingerprint: sha256(
      createAiChartD1PalaceWritingCanonicalJson(evidence),
    ),
    storageScope: 'GATE_FINGERPRINT' as const,
    storageAuthority:
      'TRUSTED_SERVER_EVIDENCE_STORAGE_ADAPTER_REQUIRED' as const,
    serialization: 'CANONICAL_JSON_UTF8' as const,
    createMode: 'EXCLUSIVE_CREATE' as const,
    directoryMode: '0700' as const,
    fileMode: '0600' as const,
    overwriteAllowed: false as const,
    retryAllowed: false as const,
    persistenceStatus: 'NOT_PERSISTED' as const,
    nextRequiredAction:
      'PERSIST_WITH_TRUSTED_SERVER_ADAPTER' as const,
    restrictedResultArtifactPolicy:
      'SEPARATE_NOT_INCLUDED' as const,
    evidence,
  })
}

function parseEnvelope(
  value: unknown,
  previewPlanValue: unknown,
  gatePlanValue: unknown,
): AiChartD1PalaceWritingPreviewEvidencePersistenceEnvelope {
  const previewPlan =
    parseAiChartD1PalaceWritingPreviewPlan(previewPlanValue)
  const gatePlan =
    parseAiChartD1PalaceWritingPreviewGatePlan(gatePlanValue)
  const record = requireAiChartD1ExactObject(
    value,
    PERSISTENCE_ENVELOPE_FIELDS,
  )
  const evidence =
    parseAiChartD1PalaceWritingPreviewEvidence(
      record.evidence,
      previewPlan,
    )
  const expectedArtifactName =
    evidence.status === 'SUCCEEDED'
      ? ('request-succeeded.json' as const)
      : ('request-failed.json' as const)
  const evidenceFingerprint = sha256(
    createAiChartD1PalaceWritingCanonicalJson(evidence),
  )

  if (
    gatePlan.fixtureId !== previewPlan.fixtureId ||
    gatePlan.caseFingerprint !== previewPlan.caseFingerprint ||
    gatePlan.previewPlanFingerprint !==
      previewPlan.planFingerprint ||
    record.contractVersion !==
      AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_PERSISTENCE_ENVELOPE_VERSION ||
    record.task !==
      AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_PERSISTENCE_ENVELOPE_TASK ||
    record.fixtureId !== previewPlan.fixtureId ||
    record.caseFingerprint !== previewPlan.caseFingerprint ||
    record.previewPlanFingerprint !==
      previewPlan.planFingerprint ||
    record.gateFingerprint !== gatePlan.gateFingerprint ||
    record.artifactName !== expectedArtifactName ||
    typeof record.evidenceFingerprint !== 'string' ||
    !SHA256_PATTERN.test(record.evidenceFingerprint) ||
    record.evidenceFingerprint !== evidenceFingerprint ||
    record.storageScope !== 'GATE_FINGERPRINT' ||
    record.storageAuthority !==
      'TRUSTED_SERVER_EVIDENCE_STORAGE_ADAPTER_REQUIRED' ||
    record.serialization !== 'CANONICAL_JSON_UTF8' ||
    record.createMode !== 'EXCLUSIVE_CREATE' ||
    record.directoryMode !== '0700' ||
    record.fileMode !== '0600' ||
    record.overwriteAllowed !== false ||
    record.retryAllowed !== false ||
    record.persistenceStatus !== 'NOT_PERSISTED' ||
    record.nextRequiredAction !==
      'PERSIST_WITH_TRUSTED_SERVER_ADAPTER' ||
    record.restrictedResultArtifactPolicy !==
      'SEPARATE_NOT_INCLUDED'
  ) {
    invalid()
  }

  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_PERSISTENCE_ENVELOPE_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_PERSISTENCE_ENVELOPE_TASK,
    fixtureId: previewPlan.fixtureId,
    caseFingerprint: previewPlan.caseFingerprint,
    previewPlanFingerprint: previewPlan.planFingerprint,
    gateFingerprint: gatePlan.gateFingerprint,
    artifactName: expectedArtifactName,
    evidenceFingerprint,
    storageScope: 'GATE_FINGERPRINT' as const,
    storageAuthority:
      'TRUSTED_SERVER_EVIDENCE_STORAGE_ADAPTER_REQUIRED' as const,
    serialization: 'CANONICAL_JSON_UTF8' as const,
    createMode: 'EXCLUSIVE_CREATE' as const,
    directoryMode: '0700' as const,
    fileMode: '0600' as const,
    overwriteAllowed: false as const,
    retryAllowed: false as const,
    persistenceStatus: 'NOT_PERSISTED' as const,
    nextRequiredAction:
      'PERSIST_WITH_TRUSTED_SERVER_ADAPTER' as const,
    restrictedResultArtifactPolicy:
      'SEPARATE_NOT_INCLUDED' as const,
    evidence,
  })
}

export function parseAiChartD1PalaceWritingPreviewEvidencePersistenceEnvelope(
  value: unknown,
  previewPlanValue: unknown,
  gatePlanValue: unknown,
): AiChartD1PalaceWritingPreviewEvidencePersistenceEnvelope {
  try {
    assertAiChartD1SafeGraph({
      value,
      previewPlanValue,
      gatePlanValue,
    })
    return parseEnvelope(
      value,
      previewPlanValue,
      gatePlanValue,
    )
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingPreviewEvidencePersistenceError
    ) {
      throw error
    }
    invalid()
  }
}

export function buildAiChartD1PalaceWritingPreviewEvidencePersistenceEnvelope(
  input: Readonly<{
    previewPlan: unknown
    gatePlan: unknown
    executionLedger: unknown
  }>,
): AiChartD1PalaceWritingPreviewEvidencePersistenceEnvelope {
  try {
    assertAiChartD1SafeGraph(input)
    const record = requireAiChartD1ExactObject(input, [
      'previewPlan',
      'gatePlan',
      'executionLedger',
    ])
    return buildEnvelope({
      previewPlan: record.previewPlan,
      gatePlan: record.gatePlan,
      executionLedger: record.executionLedger,
    })
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingPreviewEvidencePersistenceError
    ) {
      throw error
    }
    invalid()
  }
}
