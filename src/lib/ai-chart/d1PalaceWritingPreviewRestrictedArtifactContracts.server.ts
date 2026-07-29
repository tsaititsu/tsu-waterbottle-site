import 'server-only'

import { createHash } from 'node:crypto'
import {
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import {
  buildAiChartD1PalaceWritingAdapterBridge,
  buildAiChartD1PalaceWritingFidelityAdapterBridge,
} from './d1PalaceWritingAdapterBridgeContracts'
import {
  createAiChartD1PalaceWritingFidelityCanonicalJson,
  validateAiChartD1PalaceWritingFidelityPromptPackageAgainstSources,
} from './d1PalaceWritingFidelityPromptPackageContracts'
import {
  validateAiChartD1PalaceWritingFidelityReviewAgainstSources,
  type AiChartD1PalaceWritingFidelityReview,
} from './d1PalaceWritingFidelityReviewContracts'
import {
  parseAiChartD1PalaceWritingPreviewEvidence,
  parseAiChartD1PalaceWritingPreviewPlan,
  type AiChartD1PalaceWritingPreviewEvidence,
} from './d1PalaceWritingPreviewContracts'
import {
  AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_READBACK_TASK,
  AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_READBACK_VERSION,
} from './d1PalaceWritingPreviewEvidenceReadback.server'
import {
  parseAiChartD1PalaceWritingPreviewGatePlan,
} from './d1PalaceWritingPreviewGateContracts'
import {
  createAiChartD1PalaceWritingCanonicalJson,
  parseAiChartD1PalaceWritingPromptPackage,
} from './d1PalaceWritingPromptPackageContracts'
import {
  createAiChartD1PalaceWritingResultSha256,
  validateAiChartD1PalaceWritingResultAgainstPromptPackage,
  type AiChartD1PalaceWritingResult,
} from './d1PalaceWritingResultContracts'

export const AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_VERSION =
  'ai-chart-d1-palace-writing-preview-restricted-artifact/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_TASK =
  'D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_INVALID =
  'ai_chart_d1_palace_writing_preview_restricted_artifact_invalid' as const

const VERIFIED_EVIDENCE_FIELDS = Object.freeze([
  'contractVersion',
  'task',
  'gateFingerprint',
  'authority',
  'artifactName',
  'evidenceFingerprint',
  'status',
  'evidence',
  'restrictedResultArtifactStatus',
] as const)
const RESTRICTED_ARTIFACT_FIELDS = Object.freeze([
  'contractVersion',
  'task',
  'dataClassification',
  'fixtureId',
  'caseFingerprint',
  'previewPlanFingerprint',
  'gateFingerprint',
  'safeEvidenceFingerprint',
  'chartId',
  'runId',
  'callId',
  'targetPalaceId',
  'sourceSnapshotSha256',
  'writingPackageFingerprint',
  'writingResultSha256',
  'fidelityPackageFingerprint',
  'fidelityReviewSha256',
  'writingResult',
  'fidelityReview',
  'modelOutputIncluded',
  'promptIncluded',
  'requestBodyIncluded',
  'secretsIncluded',
  'chartSnapshotIncluded',
  'birthDataIncluded',
  'accessPolicy',
  'humanReviewStatus',
  'customerDeliveryStatus',
  'persistenceStatus',
  'storageAuthority',
  'nextRequiredAction',
  'artifactFingerprint',
] as const)
const SHA256_PATTERN = /^[a-f0-9]{64}$/u

export type AiChartD1PalaceWritingPreviewRestrictedArtifact =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_TASK
    dataClassification: 'RESTRICTED_MODEL_OUTPUT'
    fixtureId: string
    caseFingerprint: string
    previewPlanFingerprint: string
    gateFingerprint: string
    safeEvidenceFingerprint: string
    chartId: string
    runId: string
    callId: string
    targetPalaceId: string
    sourceSnapshotSha256: string
    writingPackageFingerprint: string
    writingResultSha256: string
    fidelityPackageFingerprint: string
    fidelityReviewSha256: string
    writingResult: AiChartD1PalaceWritingResult
    fidelityReview: AiChartD1PalaceWritingFidelityReview
    modelOutputIncluded: true
    promptIncluded: false
    requestBodyIncluded: false
    secretsIncluded: false
    chartSnapshotIncluded: false
    birthDataIncluded: false
    accessPolicy: 'SERVER_ONLY_EXPLICIT_HUMAN_REVIEW'
    humanReviewStatus: 'NOT_REVIEWED'
    customerDeliveryStatus:
      'BLOCKED_PENDING_HUMAN_REVIEW'
    persistenceStatus: 'NOT_PERSISTED'
    storageAuthority:
      'RESTRICTED_ARTIFACT_STORAGE_ADAPTER_REQUIRED'
    nextRequiredAction:
      'PERSIST_WITH_RESTRICTED_ARTIFACT_ADAPTER'
    artifactFingerprint: string
  }>

const activeReportBindingArtifacts = new WeakMap<
  AiChartD1PalaceWritingPreviewRestrictedArtifact,
  AiChartD1PalaceWritingPreviewRestrictedArtifact
>()
const consumedReportBindingArtifacts =
  new WeakSet<AiChartD1PalaceWritingPreviewRestrictedArtifact>()

export class AiChartD1PalaceWritingPreviewRestrictedArtifactError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_INVALID

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_INVALID,
    )
    Object.defineProperty(this, 'name', {
      value:
        'AiChartD1PalaceWritingPreviewRestrictedArtifactError',
      enumerable: false,
      configurable: true,
    })
    Object.freeze(this)
  }
}

function invalid(): never {
  throw new AiChartD1PalaceWritingPreviewRestrictedArtifactError()
}

function sha256Canonical(
  value: unknown,
  canonicalJson: (input: unknown) => string,
): string {
  return createHash('sha256')
    .update(canonicalJson(value), 'utf8')
    .digest('hex')
}

function parseVerifiedEvidence(
  value: unknown,
  previewPlanValue: unknown,
  gatePlanValue: unknown,
): Readonly<{
  evidenceFingerprint: string
  evidence: AiChartD1PalaceWritingPreviewEvidence
}> {
  const previewPlan =
    parseAiChartD1PalaceWritingPreviewPlan(previewPlanValue)
  const gatePlan =
    parseAiChartD1PalaceWritingPreviewGatePlan(gatePlanValue)
  assertAiChartD1SafeGraph(value)
  const record = requireAiChartD1ExactObject(
    value,
    VERIFIED_EVIDENCE_FIELDS,
  )
  const evidence =
    parseAiChartD1PalaceWritingPreviewEvidence(
      record.evidence,
      previewPlan,
    )
  const evidenceFingerprint = sha256Canonical(
    evidence,
    createAiChartD1PalaceWritingCanonicalJson,
  )
  if (
    record.contractVersion !==
      AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_READBACK_VERSION ||
    record.task !==
      AI_CHART_D1_PALACE_WRITING_PREVIEW_EVIDENCE_READBACK_TASK ||
    record.gateFingerprint !== gatePlan.gateFingerprint ||
    record.authority !==
      'TRUSTED_SERVER_EVIDENCE_READBACK_ADAPTER' ||
    record.artifactName !== 'request-succeeded.json' ||
    typeof record.evidenceFingerprint !== 'string' ||
    !SHA256_PATTERN.test(record.evidenceFingerprint) ||
    record.evidenceFingerprint !== evidenceFingerprint ||
    record.status !== 'VERIFIED' ||
    record.restrictedResultArtifactStatus !== 'NOT_READ' ||
    evidence.status !== 'SUCCEEDED' ||
    evidence.completedStage !== 'COMPLETE'
  ) {
    invalid()
  }
  return freezeAiChartD1Value({
    evidenceFingerprint,
    evidence,
  })
}

export function buildAiChartD1PalaceWritingPreviewRestrictedArtifact(
  input: Readonly<{
    previewPlan: unknown
    gatePlan: unknown
    verifiedEvidence: unknown
    writingPromptPackage: unknown
    writingResult: unknown
    fidelityPromptPackage: unknown
    fidelityReview: unknown
  }>,
): AiChartD1PalaceWritingPreviewRestrictedArtifact {
  try {
    assertAiChartD1SafeGraph(input)
    const record = requireAiChartD1ExactObject(input, [
      'previewPlan',
      'gatePlan',
      'verifiedEvidence',
      'writingPromptPackage',
      'writingResult',
      'fidelityPromptPackage',
      'fidelityReview',
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
    const verifiedEvidence = parseVerifiedEvidence(
      record.verifiedEvidence,
      previewPlan,
      gatePlan,
    )
    const writingPromptPackage =
      parseAiChartD1PalaceWritingPromptPackage(
        record.writingPromptPackage,
      )
    const writingResult =
      validateAiChartD1PalaceWritingResultAgainstPromptPackage(
        record.writingResult,
        writingPromptPackage,
      )
    const fidelityPromptPackage =
      validateAiChartD1PalaceWritingFidelityPromptPackageAgainstSources(
        record.fidelityPromptPackage,
        writingPromptPackage,
        writingResult,
      )
    const fidelityReview =
      validateAiChartD1PalaceWritingFidelityReviewAgainstSources(
        record.fidelityReview,
        writingResult,
        writingPromptPackage,
      )
    const writingBridge =
      buildAiChartD1PalaceWritingAdapterBridge(
        writingPromptPackage,
      )
    const fidelityBridge =
      buildAiChartD1PalaceWritingFidelityAdapterBridge(
        fidelityPromptPackage,
        writingPromptPackage,
        writingResult,
      )
    const writingResultSha256 =
      createAiChartD1PalaceWritingResultSha256(writingResult)
    const fidelityReviewSha256 = sha256Canonical(
      fidelityReview,
      createAiChartD1PalaceWritingFidelityCanonicalJson,
    )
    const evidence = verifiedEvidence.evidence
    if (
      writingBridge.descriptor.bridgeFingerprint !==
        previewPlan.stages[0].bridgeFingerprint ||
      evidence.stages[0].bridgeFingerprint !==
        writingBridge.descriptor.bridgeFingerprint ||
      evidence.stages[0].resultFingerprint !==
        writingResultSha256 ||
      evidence.stages[1].bridgeFingerprint !==
        fidelityBridge.descriptor.bridgeFingerprint ||
      evidence.stages[1].resultFingerprint !==
        fidelityReviewSha256 ||
      fidelityReview.fidelityReviewStatus !== 'approved' ||
      fidelityReview.customerDeliveryStatus !== 'ready'
    ) {
      invalid()
    }

    const withoutFingerprint = {
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_VERSION,
      task:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_TASK,
      dataClassification:
        'RESTRICTED_MODEL_OUTPUT' as const,
      fixtureId: previewPlan.fixtureId,
      caseFingerprint: previewPlan.caseFingerprint,
      previewPlanFingerprint: previewPlan.planFingerprint,
      gateFingerprint: gatePlan.gateFingerprint,
      safeEvidenceFingerprint:
        verifiedEvidence.evidenceFingerprint,
      chartId: writingResult.chartId,
      runId: writingResult.runId,
      callId: writingResult.callId,
      targetPalaceId: writingResult.targetPalaceId,
      sourceSnapshotSha256:
        writingPromptPackage.sourceSnapshotSha256,
      writingPackageFingerprint:
        writingPromptPackage.packageFingerprint,
      writingResultSha256,
      fidelityPackageFingerprint:
        fidelityPromptPackage.packageFingerprint,
      fidelityReviewSha256,
      writingResult,
      fidelityReview,
      modelOutputIncluded: true as const,
      promptIncluded: false as const,
      requestBodyIncluded: false as const,
      secretsIncluded: false as const,
      chartSnapshotIncluded: false as const,
      birthDataIncluded: false as const,
      accessPolicy:
        'SERVER_ONLY_EXPLICIT_HUMAN_REVIEW' as const,
      humanReviewStatus: 'NOT_REVIEWED' as const,
      customerDeliveryStatus:
        'BLOCKED_PENDING_HUMAN_REVIEW' as const,
      persistenceStatus: 'NOT_PERSISTED' as const,
      storageAuthority:
        'RESTRICTED_ARTIFACT_STORAGE_ADAPTER_REQUIRED' as const,
      nextRequiredAction:
        'PERSIST_WITH_RESTRICTED_ARTIFACT_ADAPTER' as const,
    }
    const artifact = freezeAiChartD1Value({
      ...withoutFingerprint,
      artifactFingerprint: sha256Canonical(
        withoutFingerprint,
        createAiChartD1PalaceWritingCanonicalJson,
      ),
    })
    activeReportBindingArtifacts.set(artifact, artifact)
    return artifact
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingPreviewRestrictedArtifactError
    ) {
      throw error
    }
    invalid()
  }
}

export function consumeAiChartD1PalaceWritingPreviewRestrictedArtifactForReportBinding(
  value: unknown,
): AiChartD1PalaceWritingPreviewRestrictedArtifact {
  try {
    if (value === null || typeof value !== 'object') {
      invalid()
    }
    const artifact =
      value as AiChartD1PalaceWritingPreviewRestrictedArtifact
    if (consumedReportBindingArtifacts.has(artifact)) {
      invalid()
    }
    const activeArtifact =
      activeReportBindingArtifacts.get(artifact)
    if (activeArtifact === undefined) {
      invalid()
    }
    activeReportBindingArtifacts.delete(artifact)
    consumedReportBindingArtifacts.add(artifact)
    return activeArtifact
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingPreviewRestrictedArtifactError
    ) {
      throw error
    }
    invalid()
  }
}

export function parseAiChartD1PalaceWritingPreviewRestrictedArtifact(
  value: unknown,
  previewPlanValue: unknown,
  gatePlanValue: unknown,
  verifiedEvidenceValue: unknown,
  writingPromptPackageValue: unknown,
  fidelityPromptPackageValue: unknown,
): AiChartD1PalaceWritingPreviewRestrictedArtifact {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(
      value,
      RESTRICTED_ARTIFACT_FIELDS,
    )
    const rebuilt =
      buildAiChartD1PalaceWritingPreviewRestrictedArtifact({
        previewPlan: previewPlanValue,
        gatePlan: gatePlanValue,
        verifiedEvidence: verifiedEvidenceValue,
        writingPromptPackage: writingPromptPackageValue,
        writingResult: record.writingResult,
        fidelityPromptPackage: fidelityPromptPackageValue,
        fidelityReview: record.fidelityReview,
      })
    if (
      createAiChartD1PalaceWritingCanonicalJson(value) !==
      createAiChartD1PalaceWritingCanonicalJson(rebuilt)
    ) {
      invalid()
    }
    return rebuilt
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingPreviewRestrictedArtifactError
    ) {
      throw error
    }
    invalid()
  }
}
