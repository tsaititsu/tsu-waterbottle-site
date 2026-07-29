import 'server-only'

import { createHash } from 'node:crypto'
import {
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import {
  consumeAiChartD1PalaceWritingPreviewHumanReviewProductionPortContract,
} from './d1PalaceWritingPreviewHumanReviewProductionPortContracts.server'
import type {
  AiChartD1PalaceWritingPreviewHumanReviewDecision,
  AiChartD1PalaceWritingPreviewHumanReviewDecisionProposal,
  AiChartD1PalaceWritingPreviewHumanReviewIssueCode,
} from './d1PalaceWritingPreviewHumanReviewDecisionContracts.server'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'

export const AI_CHART_D1_PALACE_WRITING_PREVIEW_REPORT_ARTIFACT_BINDING_ADAPTER_COMMAND_VERSION =
  'ai-chart-d1-palace-writing-preview-report-artifact-binding-adapter-command/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_REPORT_ARTIFACT_BINDING_ADAPTER_COMMAND_TASK =
  'D1_PALACE_WRITING_PREVIEW_REPORT_ARTIFACT_BINDING_ADAPTER_COMMAND' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_REPORT_ARTIFACT_BINDING_VERSION =
  'ai-chart-d1-palace-writing-preview-report-artifact-binding/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_REPORT_ARTIFACT_BINDING_TASK =
  'D1_PALACE_WRITING_PREVIEW_REPORT_ARTIFACT_BINDING' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_REPORT_ARTIFACT_BINDING_PREPARATION_VERSION =
  'ai-chart-d1-palace-writing-preview-report-artifact-binding-preparation/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_REPORT_ARTIFACT_BINDING_PREPARATION_TASK =
  'D1_PALACE_WRITING_PREVIEW_REPORT_ARTIFACT_BINDING_PREPARATION' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_REPORT_ARTIFACT_BINDING_INVALID =
  'ai_chart_d1_palace_writing_preview_report_artifact_binding_invalid' as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const INPUT_FIELDS = Object.freeze([
  'productionPortContract',
  'resolveReportSubjectFake',
] as const)
const ADAPTER_OUTCOME_FIELDS = Object.freeze([
  'adapterMode',
  'lookupStatus',
  'reportId',
  'paymentStatus',
  'ownerBindingStatus',
  'sourceBindingStatus',
  'reportSnapshotSha256',
  'gateFingerprint',
  'restrictedArtifactFingerprint',
  'artifactPayloadSha256',
  'proposalFingerprint',
] as const)

export type AiChartD1PalaceWritingPreviewReportArtifactBindingAdapterCommand =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_REPORT_ARTIFACT_BINDING_ADAPTER_COMMAND_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_REPORT_ARTIFACT_BINDING_ADAPTER_COMMAND_TASK
    adapterMode: 'INJECTED_REPORT_SUBJECT_PROBE_ONLY'
    sequence: 1
    gateFingerprint: string
    restrictedArtifactFingerprint: string
    artifactPayloadSha256: string
    proposalFingerprint: string
  }>

export type AiChartD1PalaceWritingPreviewReportArtifactBindingAdapterFake =
  (
    command:
      AiChartD1PalaceWritingPreviewReportArtifactBindingAdapterCommand,
  ) => Promise<unknown>

export type AiChartD1PalaceWritingPreviewReportArtifactBinding =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_REPORT_ARTIFACT_BINDING_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_REPORT_ARTIFACT_BINDING_TASK
    dataClassification:
      'REPORT_ARTIFACT_BINDING_METADATA'
    reportId: string
    reportSnapshotSha256: string
    sourceProductionPortContractFingerprint: string
    gateFingerprint: string
    restrictedArtifactFingerprint: string
    artifactPayloadSha256: string
    proposalFingerprint: string
    decision:
      AiChartD1PalaceWritingPreviewHumanReviewDecision
    issueCodes:
      readonly AiChartD1PalaceWritingPreviewHumanReviewIssueCode[]
    requiredPermission:
      'AI_CHART_D1_PALACE_WRITING_HUMAN_REVIEW'
    customerDeliveryStatus:
      AiChartD1PalaceWritingPreviewHumanReviewDecisionProposal['customerDeliveryStatus']
    reportLookupStatus: 'SYNTHETIC_FOUND'
    paymentStatus:
      'SYNTHETIC_PAID_NOT_PRODUCTION'
    ownerBindingStatus:
      'SYNTHETIC_SERVER_VERIFIED_NOT_PRODUCTION'
    sourceBindingStatus:
      'SYNTHETIC_MATCHED_NOT_PRODUCTION'
    capabilityScope:
      'IN_PROCESS_EXACT_OBJECT_IDENTITY'
    productionCallable: false
    formalReviewRecordAllowed: false
    persistenceStatus: 'NOT_PERSISTED'
    customerDeliveryAllowed: false
    openAiRequests: 0
    bindingFingerprint: string
  }>

export type AiChartD1PalaceWritingPreviewReportArtifactBindingPreparation =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_REPORT_ARTIFACT_BINDING_PREPARATION_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_REPORT_ARTIFACT_BINDING_PREPARATION_TASK
    status: 'READY_STOPPED'
    stage:
      'OFFLINE_REPORT_ARTIFACT_BINDING_CREATED'
    nextRequiredAction:
      'IMPLEMENT_PRODUCTION_REPORT_SUBJECT_LOOKUP_ADAPTER'
    binding:
      AiChartD1PalaceWritingPreviewReportArtifactBinding
    productionCallable: false
    formalReviewRecordAllowed: false
    customerDeliveryAllowed: false
    openAiRequests: 0
  }>

const activeBindings = new WeakMap<
  AiChartD1PalaceWritingPreviewReportArtifactBinding,
  AiChartD1PalaceWritingPreviewReportArtifactBinding
>()
const consumedBindings =
  new WeakSet<AiChartD1PalaceWritingPreviewReportArtifactBinding>()

export class AiChartD1PalaceWritingPreviewReportArtifactBindingError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_PREVIEW_REPORT_ARTIFACT_BINDING_INVALID

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_PREVIEW_REPORT_ARTIFACT_BINDING_INVALID,
    )
    this.name =
      'AiChartD1PalaceWritingPreviewReportArtifactBindingError'
    Object.freeze(this)
  }
}

function invalid(): never {
  throw new AiChartD1PalaceWritingPreviewReportArtifactBindingError()
}

function sha256Canonical(value: unknown): string {
  return createHash('sha256')
    .update(
      createAiChartD1PalaceWritingCanonicalJson(value),
      'utf8',
    )
    .digest('hex')
}

function parseSha256(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !SHA256_PATTERN.test(value)
  ) {
    invalid()
  }
  return value
}

function parseAdapterOutcome(
  value: unknown,
  command:
    AiChartD1PalaceWritingPreviewReportArtifactBindingAdapterCommand,
): Readonly<{
  reportId: string
  reportSnapshotSha256: string
}> {
  assertAiChartD1SafeGraph(value)
  const record = requireAiChartD1ExactObject(
    value,
    ADAPTER_OUTCOME_FIELDS,
  )
  if (
    record.adapterMode !==
      'INJECTED_REPORT_SUBJECT_PROBE_ONLY' ||
    record.lookupStatus !== 'FOUND' ||
    typeof record.reportId !== 'string' ||
    !UUID_PATTERN.test(record.reportId) ||
    record.paymentStatus !== 'PAID' ||
    record.ownerBindingStatus !== 'SERVER_VERIFIED' ||
    record.sourceBindingStatus !== 'MATCHED' ||
    record.gateFingerprint !== command.gateFingerprint ||
    record.restrictedArtifactFingerprint !==
      command.restrictedArtifactFingerprint ||
    record.artifactPayloadSha256 !==
      command.artifactPayloadSha256 ||
    record.proposalFingerprint !==
      command.proposalFingerprint
  ) {
    invalid()
  }
  return freezeAiChartD1Value({
    reportId: record.reportId,
    reportSnapshotSha256:
      parseSha256(record.reportSnapshotSha256),
  })
}

export async function prepareAiChartD1PalaceWritingPreviewReportArtifactBinding(
  input: Readonly<{
    productionPortContract: unknown
    resolveReportSubjectFake:
      AiChartD1PalaceWritingPreviewReportArtifactBindingAdapterFake
  }>,
): Promise<AiChartD1PalaceWritingPreviewReportArtifactBindingPreparation> {
  try {
    if (process.env.NODE_ENV !== 'test') invalid()
    const record = requireAiChartD1ExactObject(
      input,
      INPUT_FIELDS,
    )
    if (
      typeof record.resolveReportSubjectFake !==
      'function'
    ) {
      invalid()
    }
    const productionPortContract =
      consumeAiChartD1PalaceWritingPreviewHumanReviewProductionPortContract(
        record.productionPortContract,
      )
    const command = freezeAiChartD1Value({
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_REPORT_ARTIFACT_BINDING_ADAPTER_COMMAND_VERSION,
      task:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_REPORT_ARTIFACT_BINDING_ADAPTER_COMMAND_TASK,
      adapterMode:
        'INJECTED_REPORT_SUBJECT_PROBE_ONLY' as const,
      sequence: 1 as const,
      gateFingerprint:
        productionPortContract.gateFingerprint,
      restrictedArtifactFingerprint:
        productionPortContract.restrictedArtifactFingerprint,
      artifactPayloadSha256:
        productionPortContract.artifactPayloadSha256,
      proposalFingerprint:
        productionPortContract.proposalFingerprint,
    })
    const outcome = parseAdapterOutcome(
      await (
        record.resolveReportSubjectFake as
          AiChartD1PalaceWritingPreviewReportArtifactBindingAdapterFake
      )(command),
      command,
    )
    const withoutFingerprint = {
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_REPORT_ARTIFACT_BINDING_VERSION,
      task:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_REPORT_ARTIFACT_BINDING_TASK,
      dataClassification:
        'REPORT_ARTIFACT_BINDING_METADATA' as const,
      reportId: outcome.reportId,
      reportSnapshotSha256:
        outcome.reportSnapshotSha256,
      sourceProductionPortContractFingerprint:
        productionPortContract.contractFingerprint,
      gateFingerprint:
        productionPortContract.gateFingerprint,
      restrictedArtifactFingerprint:
        productionPortContract.restrictedArtifactFingerprint,
      artifactPayloadSha256:
        productionPortContract.artifactPayloadSha256,
      proposalFingerprint:
        productionPortContract.proposalFingerprint,
      decision: productionPortContract.decision,
      issueCodes: productionPortContract.issueCodes,
      requiredPermission:
        productionPortContract.requiredPermission,
      customerDeliveryStatus:
        productionPortContract.customerDeliveryStatus,
      reportLookupStatus: 'SYNTHETIC_FOUND' as const,
      paymentStatus:
        'SYNTHETIC_PAID_NOT_PRODUCTION' as const,
      ownerBindingStatus:
        'SYNTHETIC_SERVER_VERIFIED_NOT_PRODUCTION' as const,
      sourceBindingStatus:
        'SYNTHETIC_MATCHED_NOT_PRODUCTION' as const,
      capabilityScope:
        'IN_PROCESS_EXACT_OBJECT_IDENTITY' as const,
      productionCallable: false as const,
      formalReviewRecordAllowed: false as const,
      persistenceStatus: 'NOT_PERSISTED' as const,
      customerDeliveryAllowed: false as const,
      openAiRequests: 0 as const,
    }
    const binding = freezeAiChartD1Value({
      ...withoutFingerprint,
      bindingFingerprint:
        sha256Canonical(withoutFingerprint),
    })
    activeBindings.set(binding, binding)
    return freezeAiChartD1Value({
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_REPORT_ARTIFACT_BINDING_PREPARATION_VERSION,
      task:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_REPORT_ARTIFACT_BINDING_PREPARATION_TASK,
      status: 'READY_STOPPED' as const,
      stage:
        'OFFLINE_REPORT_ARTIFACT_BINDING_CREATED' as const,
      nextRequiredAction:
        'IMPLEMENT_PRODUCTION_REPORT_SUBJECT_LOOKUP_ADAPTER' as const,
      binding,
      productionCallable: false as const,
      formalReviewRecordAllowed: false as const,
      customerDeliveryAllowed: false as const,
      openAiRequests: 0 as const,
    })
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingPreviewReportArtifactBindingError
    ) {
      throw error
    }
    invalid()
  }
}

export function consumeAiChartD1PalaceWritingPreviewReportArtifactBinding(
  value: unknown,
): AiChartD1PalaceWritingPreviewReportArtifactBinding {
  try {
    if (
      value === null ||
      typeof value !== 'object'
    ) {
      invalid()
    }
    const binding =
      value as AiChartD1PalaceWritingPreviewReportArtifactBinding
    if (consumedBindings.has(binding)) invalid()
    const activeBinding = activeBindings.get(binding)
    if (activeBinding === undefined) invalid()
    activeBindings.delete(binding)
    consumedBindings.add(binding)
    return activeBinding
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingPreviewReportArtifactBindingError
    ) {
      throw error
    }
    invalid()
  }
}
