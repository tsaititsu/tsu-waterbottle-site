import 'server-only'

import { createHash } from 'node:crypto'
import {
  freezeAiChartD1Value,
} from './d1CommonContracts'
import {
  AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PERMISSION,
} from './d1PalaceWritingPreviewHumanReviewAuthorizationHandoff.server'
import {
  type AiChartD1PalaceWritingPreviewHumanReviewDecision,
  type AiChartD1PalaceWritingPreviewHumanReviewDecisionProposal,
  type AiChartD1PalaceWritingPreviewHumanReviewIssueCode,
} from './d1PalaceWritingPreviewHumanReviewDecisionContracts.server'
import {
  consumeAiChartD1PalaceWritingPreviewHumanReviewRecordPersistenceTemplate,
} from './d1PalaceWritingPreviewHumanReviewRecordPersistenceProbe.server'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'

export const AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PRODUCTION_PORT_CONTRACT_VERSION =
  'ai-chart-d1-palace-writing-preview-human-review-production-port-contract/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PRODUCTION_PORT_CONTRACT_TASK =
  'D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PRODUCTION_PORT_CONTRACT' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PRODUCTION_PORT_CONTRACT_INVALID =
  'ai_chart_d1_palace_writing_preview_human_review_production_port_contract_invalid' as const

export const AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PRODUCTION_PORT_FAILURE_CODES =
  Object.freeze([
    'AUTHORIZATION_ADAPTER_UNAVAILABLE',
    'REVIEWER_SESSION_INVALID',
    'REVIEWER_PERMISSION_DENIED',
    'REVIEWER_IDENTITY_INVALID',
    'SERVER_CLOCK_UNAVAILABLE',
    'SERVER_TIMESTAMP_INVALID',
    'RECORD_STORAGE_ADAPTER_UNAVAILABLE',
    'RECORD_ALREADY_EXISTS',
    'RECORD_WRITE_FAILED',
    'SOURCE_BINDING_MISMATCH',
  ] as const)

const REQUIRED_PORTS = Object.freeze([
  Object.freeze({
    sequence: 1 as const,
    port:
      'VERIFY_REQUEST_BOUND_REVIEWER_AUTHORIZATION' as const,
    requiredInput:
      'SOURCE_BOUND_DECISION_METADATA_ONLY' as const,
    requiredOutput:
      'VERIFIED_REVIEWER_IDENTITY_AND_FIXED_PERMISSION' as const,
    implementationStatus: 'NOT_IMPLEMENTED' as const,
  }),
  Object.freeze({
    sequence: 2 as const,
    port: 'READ_TRUSTED_SERVER_CLOCK' as const,
    requiredInput: 'NO_CALLER_TIMESTAMP' as const,
    requiredOutput:
      'RFC3339_UTC_SERVER_TIMESTAMP' as const,
    implementationStatus: 'NOT_IMPLEMENTED' as const,
  }),
  Object.freeze({
    sequence: 3 as const,
    port:
      'EXCLUSIVE_CREATE_HUMAN_REVIEW_RECORD' as const,
    requiredInput:
      'MODULE_OWNED_CANONICAL_RECORD_ONLY' as const,
    requiredOutput:
      'WRITE_ONCE_RECORD_RECEIPT' as const,
    implementationStatus: 'NOT_IMPLEMENTED' as const,
  }),
])

export type AiChartD1PalaceWritingPreviewHumanReviewProductionPortFailureCode =
  (typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PRODUCTION_PORT_FAILURE_CODES)[number]

export type AiChartD1PalaceWritingPreviewHumanReviewProductionPortContract =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PRODUCTION_PORT_CONTRACT_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PRODUCTION_PORT_CONTRACT_TASK
    dataClassification:
      'HUMAN_REVIEW_PRODUCTION_PORT_METADATA'
    sourceTemplateFingerprint: string
    gateFingerprint: string
    restrictedArtifactFingerprint: string
    artifactPayloadSha256: string
    proposalFingerprint: string
    decision:
      AiChartD1PalaceWritingPreviewHumanReviewDecision
    issueCodes:
      readonly AiChartD1PalaceWritingPreviewHumanReviewIssueCode[]
    requiredPermission:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PERMISSION
    recordArtifactName: 'human-review-record.json'
    storageScope: 'GATE_FINGERPRINT'
    serialization: 'CANONICAL_JSON_UTF8'
    createMode: 'EXCLUSIVE_CREATE'
    directoryMode: '0700'
    fileMode: '0600'
    overwriteAllowed: false
    retryAllowed: false
    requiredPorts: typeof REQUIRED_PORTS
    failureCodes:
      readonly AiChartD1PalaceWritingPreviewHumanReviewProductionPortFailureCode[]
    authorizationBoundary:
      'REQUEST_BOUND_SERVER_SESSION_ONLY'
    reviewerIdentityBoundary:
      'AUTHORIZED_SERVER_PRINCIPAL_ONLY'
    recordedAtBoundary: 'TRUSTED_SERVER_CLOCK_ONLY'
    storageBoundary:
      'TRUSTED_ADAPTER_OWNED_GATE_FINGERPRINT_SCOPE'
    sourceAuthorizationMode:
      'OFFLINE_SYNTHETIC_ADAPTER_PROBE_ONLY'
    sourceAcceptedForProduction: false
    implementationStatus:
      'PORTS_DECLARED_NOT_IMPLEMENTED'
    recordStatus: 'FORMAL_RECORD_NOT_CREATED'
    persistenceStatus: 'NOT_PERSISTED'
    customerDeliveryStatus:
      AiChartD1PalaceWritingPreviewHumanReviewDecisionProposal['customerDeliveryStatus']
    formalReviewRecordAllowed: false
    customerDeliveryAllowed: false
    productionCallable: false
    adapterInvocations: 0
    storageWrites: 0
    openAiRequests: 0
    nextRequiredAction:
      'SELECT_AND_IMPLEMENT_REQUEST_BOUND_PRODUCTION_ADAPTERS'
    contractFingerprint: string
  }>

const activeProductionPortContracts = new WeakMap<
  AiChartD1PalaceWritingPreviewHumanReviewProductionPortContract,
  AiChartD1PalaceWritingPreviewHumanReviewProductionPortContract
>()
const consumedProductionPortContracts =
  new WeakSet<AiChartD1PalaceWritingPreviewHumanReviewProductionPortContract>()

export class AiChartD1PalaceWritingPreviewHumanReviewProductionPortContractError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PRODUCTION_PORT_CONTRACT_INVALID

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PRODUCTION_PORT_CONTRACT_INVALID,
    )
    this.name =
      'AiChartD1PalaceWritingPreviewHumanReviewProductionPortContractError'
    Object.freeze(this)
  }
}

function invalid(): never {
  throw new AiChartD1PalaceWritingPreviewHumanReviewProductionPortContractError()
}

function sha256Canonical(value: unknown): string {
  return createHash('sha256')
    .update(
      createAiChartD1PalaceWritingCanonicalJson(value),
      'utf8',
    )
    .digest('hex')
}

export function buildAiChartD1PalaceWritingPreviewHumanReviewProductionPortContract(
  templateValue: unknown,
): AiChartD1PalaceWritingPreviewHumanReviewProductionPortContract {
  try {
    if (process.env.NODE_ENV !== 'test') invalid()
    const template =
      consumeAiChartD1PalaceWritingPreviewHumanReviewRecordPersistenceTemplate(
        templateValue,
      )
    const withoutFingerprint = {
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PRODUCTION_PORT_CONTRACT_VERSION,
      task:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PRODUCTION_PORT_CONTRACT_TASK,
      dataClassification:
        'HUMAN_REVIEW_PRODUCTION_PORT_METADATA' as const,
      sourceTemplateFingerprint:
        template.templateFingerprint,
      gateFingerprint: template.gateFingerprint,
      restrictedArtifactFingerprint:
        template.restrictedArtifactFingerprint,
      artifactPayloadSha256:
        template.artifactPayloadSha256,
      proposalFingerprint:
        template.proposalFingerprint,
      decision: template.decision,
      issueCodes: template.issueCodes,
      requiredPermission:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PERMISSION,
      recordArtifactName:
        template.recordArtifactName,
      storageScope: template.storageScope,
      serialization: template.serialization,
      createMode: template.createMode,
      directoryMode: template.directoryMode,
      fileMode: template.fileMode,
      overwriteAllowed: false as const,
      retryAllowed: false as const,
      requiredPorts: REQUIRED_PORTS,
      failureCodes:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_HUMAN_REVIEW_PRODUCTION_PORT_FAILURE_CODES,
      authorizationBoundary:
        'REQUEST_BOUND_SERVER_SESSION_ONLY' as const,
      reviewerIdentityBoundary:
        'AUTHORIZED_SERVER_PRINCIPAL_ONLY' as const,
      recordedAtBoundary:
        'TRUSTED_SERVER_CLOCK_ONLY' as const,
      storageBoundary:
        'TRUSTED_ADAPTER_OWNED_GATE_FINGERPRINT_SCOPE' as const,
      sourceAuthorizationMode:
        template.sourceAuthorizationMode,
      sourceAcceptedForProduction: false as const,
      implementationStatus:
        'PORTS_DECLARED_NOT_IMPLEMENTED' as const,
      recordStatus:
        'FORMAL_RECORD_NOT_CREATED' as const,
      persistenceStatus: 'NOT_PERSISTED' as const,
      customerDeliveryStatus:
        template.customerDeliveryStatus,
      formalReviewRecordAllowed: false as const,
      customerDeliveryAllowed: false as const,
      productionCallable: false as const,
      adapterInvocations: 0 as const,
      storageWrites: 0 as const,
      openAiRequests: 0 as const,
      nextRequiredAction:
        'SELECT_AND_IMPLEMENT_REQUEST_BOUND_PRODUCTION_ADAPTERS' as const,
    }
    const contract = freezeAiChartD1Value({
      ...withoutFingerprint,
      contractFingerprint:
        sha256Canonical(withoutFingerprint),
    })
    activeProductionPortContracts.set(contract, contract)
    return contract
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingPreviewHumanReviewProductionPortContractError
    ) {
      throw error
    }
    invalid()
  }
}

export function consumeAiChartD1PalaceWritingPreviewHumanReviewProductionPortContract(
  value: unknown,
): AiChartD1PalaceWritingPreviewHumanReviewProductionPortContract {
  try {
    if (
      value === null ||
      typeof value !== 'object'
    ) {
      invalid()
    }
    const contract =
      value as AiChartD1PalaceWritingPreviewHumanReviewProductionPortContract
    if (consumedProductionPortContracts.has(contract)) {
      invalid()
    }
    const activeContract =
      activeProductionPortContracts.get(contract)
    if (activeContract === undefined) invalid()
    activeProductionPortContracts.delete(contract)
    consumedProductionPortContracts.add(contract)
    return activeContract
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingPreviewHumanReviewProductionPortContractError
    ) {
      throw error
    }
    invalid()
  }
}
