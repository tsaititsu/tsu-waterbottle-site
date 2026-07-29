import 'server-only'

import { createHash } from 'node:crypto'
import {
  freezeAiChartD1Value,
} from './d1CommonContracts'
import {
  consumeAiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff,
} from './d1PalaceWritingPreviewHumanReviewAuthorizationHandoff.server'
import {
  type AiChartD1PalaceWritingPreviewHumanReviewDecision,
  type AiChartD1PalaceWritingPreviewHumanReviewDecisionProposal,
  type AiChartD1PalaceWritingPreviewHumanReviewIssueCode,
} from './d1PalaceWritingPreviewHumanReviewDecisionContracts.server'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'

export const AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_RECORD_PERSISTENCE_PROBE_VERSION =
  'ai-chart-d1-palace-writing-preview-human-review-record-persistence-probe/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_RECORD_PERSISTENCE_PROBE_TASK =
  'D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_RECORD_PERSISTENCE_PROBE' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_RECORD_PERSISTENCE_PROBE_INVALID =
  'ai_chart_d1_palace_writing_preview_human_review_record_persistence_probe_invalid' as const

export type AiChartD1PalaceWritingPreviewHumanReviewRecordPersistenceTemplate =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_RECORD_PERSISTENCE_PROBE_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_RECORD_PERSISTENCE_PROBE_TASK
    dataClassification: 'HUMAN_REVIEW_RECORD_METADATA'
    gateFingerprint: string
    restrictedArtifactFingerprint: string
    artifactPayloadSha256: string
    proposalFingerprint: string
    decision:
      AiChartD1PalaceWritingPreviewHumanReviewDecision
    issueCodes:
      readonly AiChartD1PalaceWritingPreviewHumanReviewIssueCode[]
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
    sourceAuthorizationMode:
      'OFFLINE_SYNTHETIC_ADAPTER_PROBE_ONLY'
    authorizationBindingStatus:
      'PRODUCTION_HUMAN_REVIEW_AUTHORIZATION_REQUIRED'
    reviewerIdentityBindingStatus:
      'PRODUCTION_REVIEWER_IDENTITY_REQUIRED'
    recordedAtBindingStatus:
      'PRODUCTION_SERVER_CLOCK_REQUIRED'
    recordStatus: 'TEMPLATE_NOT_FORMAL_RECORD'
    persistenceStatus: 'NOT_PERSISTED'
    customerDeliveryStatus:
      AiChartD1PalaceWritingPreviewHumanReviewDecisionProposal['customerDeliveryStatus']
    formalReviewRecordAllowed: false
    customerDeliveryAllowed: false
    productionCallable: false
    openAiRequests: 0
    nextRequiredAction:
      'IMPLEMENT_PRODUCTION_HUMAN_REVIEW_AUTHORIZATION_AND_RECORD_WRITER'
    templateFingerprint: string
  }>

const activeTemplates = new WeakMap<
  AiChartD1PalaceWritingPreviewHumanReviewRecordPersistenceTemplate,
  AiChartD1PalaceWritingPreviewHumanReviewRecordPersistenceTemplate
>()
const consumedTemplates =
  new WeakSet<AiChartD1PalaceWritingPreviewHumanReviewRecordPersistenceTemplate>()

export class AiChartD1PalaceWritingPreviewHumanReviewRecordPersistenceProbeError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_RECORD_PERSISTENCE_PROBE_INVALID

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_RECORD_PERSISTENCE_PROBE_INVALID,
    )
    this.name =
      'AiChartD1PalaceWritingPreviewHumanReviewRecordPersistenceProbeError'
    Object.freeze(this)
  }
}

function invalid(): never {
  throw new AiChartD1PalaceWritingPreviewHumanReviewRecordPersistenceProbeError()
}

function sha256Canonical(value: unknown): string {
  return createHash('sha256')
    .update(
      createAiChartD1PalaceWritingCanonicalJson(value),
      'utf8',
    )
    .digest('hex')
}

export function probeAiChartD1PalaceWritingPreviewHumanReviewRecordPersistence(
  handoffValue: unknown,
): AiChartD1PalaceWritingPreviewHumanReviewRecordPersistenceTemplate {
  try {
    if (process.env.NODE_ENV !== 'test') invalid()
    const consumed =
      consumeAiChartD1PalaceWritingPreviewHumanReviewAuthorizationHandoff(
        handoffValue,
      )
    const withoutFingerprint = {
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_RECORD_PERSISTENCE_PROBE_VERSION,
      task:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_RECORD_PERSISTENCE_PROBE_TASK,
      dataClassification:
        'HUMAN_REVIEW_RECORD_METADATA' as const,
      gateFingerprint: consumed.gateFingerprint,
      restrictedArtifactFingerprint:
        consumed.restrictedArtifactFingerprint,
      artifactPayloadSha256:
        consumed.artifactPayloadSha256,
      proposalFingerprint:
        consumed.proposalFingerprint,
      decision: consumed.decision,
      issueCodes: consumed.issueCodes,
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
      sourceAuthorizationMode:
        'OFFLINE_SYNTHETIC_ADAPTER_PROBE_ONLY' as const,
      authorizationBindingStatus:
        'PRODUCTION_HUMAN_REVIEW_AUTHORIZATION_REQUIRED' as const,
      reviewerIdentityBindingStatus:
        'PRODUCTION_REVIEWER_IDENTITY_REQUIRED' as const,
      recordedAtBindingStatus:
        'PRODUCTION_SERVER_CLOCK_REQUIRED' as const,
      recordStatus:
        'TEMPLATE_NOT_FORMAL_RECORD' as const,
      persistenceStatus: 'NOT_PERSISTED' as const,
      customerDeliveryStatus:
        consumed.customerDeliveryStatus,
      formalReviewRecordAllowed: false as const,
      customerDeliveryAllowed: false as const,
      productionCallable: false as const,
      openAiRequests: 0 as const,
      nextRequiredAction:
        'IMPLEMENT_PRODUCTION_HUMAN_REVIEW_AUTHORIZATION_AND_RECORD_WRITER' as const,
    }
    const template = freezeAiChartD1Value({
      ...withoutFingerprint,
      templateFingerprint:
        sha256Canonical(withoutFingerprint),
    })
    activeTemplates.set(template, template)
    return template
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingPreviewHumanReviewRecordPersistenceProbeError
    ) {
      throw error
    }
    invalid()
  }
}

export function consumeAiChartD1PalaceWritingPreviewHumanReviewRecordPersistenceTemplate(
  value: unknown,
): AiChartD1PalaceWritingPreviewHumanReviewRecordPersistenceTemplate {
  try {
    if (
      value === null ||
      typeof value !== 'object'
    ) {
      invalid()
    }
    const template =
      value as AiChartD1PalaceWritingPreviewHumanReviewRecordPersistenceTemplate
    if (consumedTemplates.has(template)) invalid()
    const activeTemplate = activeTemplates.get(template)
    if (activeTemplate === undefined) invalid()
    activeTemplates.delete(template)
    consumedTemplates.add(template)
    return activeTemplate
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingPreviewHumanReviewRecordPersistenceProbeError
    ) {
      throw error
    }
    invalid()
  }
}
