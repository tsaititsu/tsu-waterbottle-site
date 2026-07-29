import 'server-only'

import { createHash } from 'node:crypto'
import {
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import {
  consumeAiChartD1PalaceWritingHumanReviewReportSubject,
} from './d1PalaceWritingHumanReviewReportSubject.server'
import {
  consumeAiChartD1PalaceWritingPreviewRestrictedArtifactForReportBinding,
} from './d1PalaceWritingPreviewRestrictedArtifactContracts.server'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'

export const AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_SOURCE_BINDING_VERSION =
  'ai-chart-d1-palace-writing-human-review-source-binding/v1' as const
export const AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_SOURCE_BINDING_TASK =
  'D1_PALACE_WRITING_HUMAN_REVIEW_SOURCE_BINDING' as const

export const AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_SOURCE_BINDING_FAILURE_CODES =
  Object.freeze([
    'REPORT_SUBJECT_UNAVAILABLE',
    'ARTIFACT_SOURCE_UNAVAILABLE',
    'ARTIFACT_SNAPSHOT_MISMATCH',
  ] as const)

export type AiChartD1PalaceWritingHumanReviewSourceBindingFailureCode =
  (typeof AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_SOURCE_BINDING_FAILURE_CODES)[number]

export type AiChartD1PalaceWritingHumanReviewSourceBinding =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_SOURCE_BINDING_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_SOURCE_BINDING_TASK
    dataClassification:
      'REPORT_ARTIFACT_SOURCE_BINDING_METADATA'
    reportId: string
    reportSnapshotSha256: string
    artifactSourceSnapshotSha256: string
    reportSubjectFingerprint: string
    restrictedArtifactFingerprint: string
    restrictedArtifactPayloadSha256: string
    gateFingerprint: string
    sourceBindingStatus:
      'SERVER_VERIFIED_EXACT_SNAPSHOT_MATCH'
    capabilityScope:
      'IN_PROCESS_EXACT_OBJECT_IDENTITY'
    productionCallable: true
    formalReviewRecordAllowed: false
    customerDeliveryAllowed: false
    openAiRequests: 0
    bindingFingerprint: string
  }>

const activeBindings = new WeakMap<
  AiChartD1PalaceWritingHumanReviewSourceBinding,
  AiChartD1PalaceWritingHumanReviewSourceBinding
>()
const consumedBindings =
  new WeakSet<AiChartD1PalaceWritingHumanReviewSourceBinding>()

export class AiChartD1PalaceWritingHumanReviewSourceBindingError
  extends Error {
  readonly code:
    AiChartD1PalaceWritingHumanReviewSourceBindingFailureCode

  constructor(
    code:
      AiChartD1PalaceWritingHumanReviewSourceBindingFailureCode,
  ) {
    const safeCode =
      AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_SOURCE_BINDING_FAILURE_CODES.includes(
        code,
      )
        ? code
        : 'ARTIFACT_SOURCE_UNAVAILABLE'
    super(safeCode)
    this.name =
      'AiChartD1PalaceWritingHumanReviewSourceBindingError'
    this.code = safeCode
    Object.freeze(this)
  }
}

function fail(
  code:
    AiChartD1PalaceWritingHumanReviewSourceBindingFailureCode,
): never {
  throw new AiChartD1PalaceWritingHumanReviewSourceBindingError(
    code,
  )
}

function sha256Canonical(value: unknown): string {
  return createHash('sha256')
    .update(
      createAiChartD1PalaceWritingCanonicalJson(value),
      'utf8',
    )
    .digest('hex')
}

export function bindAiChartD1PalaceWritingHumanReviewSource(
  input: unknown,
): AiChartD1PalaceWritingHumanReviewSourceBinding {
  let reportSubject
  let restrictedArtifact
  try {
    const record = requireAiChartD1ExactObject(input, [
      'reportSubject',
      'restrictedArtifact',
    ])
    try {
      reportSubject =
        consumeAiChartD1PalaceWritingHumanReviewReportSubject(
          record.reportSubject,
        )
    } catch {
      fail('REPORT_SUBJECT_UNAVAILABLE')
    }
    try {
      restrictedArtifact =
        consumeAiChartD1PalaceWritingPreviewRestrictedArtifactForReportBinding(
          record.restrictedArtifact,
        )
    } catch {
      fail('ARTIFACT_SOURCE_UNAVAILABLE')
    }
    if (
      reportSubject.reportSnapshotSha256 !==
      restrictedArtifact.sourceSnapshotSha256
    ) {
      fail('ARTIFACT_SNAPSHOT_MISMATCH')
    }

    const withoutFingerprint = {
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_SOURCE_BINDING_VERSION,
      task:
        AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW_SOURCE_BINDING_TASK,
      dataClassification:
        'REPORT_ARTIFACT_SOURCE_BINDING_METADATA' as const,
      reportId: reportSubject.reportId,
      reportSnapshotSha256:
        reportSubject.reportSnapshotSha256,
      artifactSourceSnapshotSha256:
        restrictedArtifact.sourceSnapshotSha256,
      reportSubjectFingerprint:
        reportSubject.subjectFingerprint,
      restrictedArtifactFingerprint:
        restrictedArtifact.artifactFingerprint,
      restrictedArtifactPayloadSha256:
        sha256Canonical(restrictedArtifact),
      gateFingerprint: restrictedArtifact.gateFingerprint,
      sourceBindingStatus:
        'SERVER_VERIFIED_EXACT_SNAPSHOT_MATCH' as const,
      capabilityScope:
        'IN_PROCESS_EXACT_OBJECT_IDENTITY' as const,
      productionCallable: true as const,
      formalReviewRecordAllowed: false as const,
      customerDeliveryAllowed: false as const,
      openAiRequests: 0 as const,
    }
    const binding = freezeAiChartD1Value({
      ...withoutFingerprint,
      bindingFingerprint:
        sha256Canonical(withoutFingerprint),
    })
    activeBindings.set(binding, binding)
    return binding
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingHumanReviewSourceBindingError
    ) {
      throw error
    }
    fail('ARTIFACT_SOURCE_UNAVAILABLE')
  }
}

export function consumeAiChartD1PalaceWritingHumanReviewSourceBinding(
  value: unknown,
): AiChartD1PalaceWritingHumanReviewSourceBinding {
  try {
    if (value === null || typeof value !== 'object') {
      fail('ARTIFACT_SOURCE_UNAVAILABLE')
    }
    const binding =
      value as AiChartD1PalaceWritingHumanReviewSourceBinding
    if (consumedBindings.has(binding)) {
      fail('ARTIFACT_SOURCE_UNAVAILABLE')
    }
    const activeBinding = activeBindings.get(binding)
    if (activeBinding === undefined) {
      fail('ARTIFACT_SOURCE_UNAVAILABLE')
    }
    activeBindings.delete(binding)
    consumedBindings.add(binding)
    return activeBinding
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingHumanReviewSourceBindingError
    ) {
      throw error
    }
    fail('ARTIFACT_SOURCE_UNAVAILABLE')
  }
}
