import 'server-only'

import { createHash } from 'node:crypto'
import {
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import {
  createAiChartD1PalaceWritingFidelityCanonicalJson,
} from './d1PalaceWritingFidelityPromptPackageContracts'
import {
  parseAiChartD1PalaceWritingFidelityReview,
} from './d1PalaceWritingFidelityReviewContracts'
import {
  parseAiChartD1PalaceWritingHumanReviewRecord,
  type AiChartD1PalaceWritingHumanReviewRecord,
} from './d1PalaceWritingHumanReviewRecordEnvelope.server'
import {
  AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_TASK,
  AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_VERSION,
} from './d1PalaceWritingPreviewRestrictedArtifactContracts.server'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'
import {
  createAiChartD1PalaceWritingResultSha256,
  parseAiChartD1PalaceWritingResult,
} from './d1PalaceWritingResultContracts'
import {
  consumeAiChartD1PalaceWritingTrustedDeliveryAdapterContract,
  type AiChartD1PalaceWritingTrustedDeliveryAdapterContract,
} from './d1PalaceWritingTrustedDeliveryAdapterContracts.server'

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_VERSION =
  'ai-chart-d1-palace-writing-trusted-delivery-repository-adapter/v1' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_TASK =
  'D1_PALACE_WRITING_TRUSTED_DELIVERY_REPOSITORY_ADAPTER' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_MODE =
  'INJECTED_OFFLINE_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_ONLY' as const

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_FAILURE_CODES =
  Object.freeze([
    'TRUSTED_DELIVERY_REPOSITORY_ADAPTER_UNAVAILABLE',
    'TRUSTED_DELIVERY_CONTRACT_UNAVAILABLE',
    'HUMAN_REVIEW_RECORD_INVALID',
    'RESTRICTED_ARTIFACT_INVALID',
    'REPORT_OWNER_LOOKUP_FAILED',
    'REPORT_OWNER_LOOKUP_INVALID',
    'ATOMIC_DELIVERY_RPC_FAILED',
    'ATOMIC_DELIVERY_RPC_RESULT_INVALID',
    'REPORT_NOT_FOUND',
    'REPORT_OWNER_MISMATCH',
    'REPORT_PAYMENT_REQUIRED',
    'REPORT_SNAPSHOT_MISMATCH',
    'DURABLE_REVIEW_LEDGER_CONFLICT',
    'REPORT_STATE_CONFLICT',
    'IDEMPOTENCY_CONFLICT',
  ] as const)

export type AiChartD1PalaceWritingTrustedDeliveryRepositoryAdapterFailureCode =
  (typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_FAILURE_CODES)[number]

const INPUT_FIELDS = Object.freeze([
  'trustedDeliveryContract',
  'reviewRecord',
  'restrictedArtifact',
] as const)
const DEPENDENCY_FIELDS = Object.freeze([
  'lookupExpectedOwner',
  'invokeAtomicDeliveryRpc',
] as const)
const OWNER_OUTCOME_FIELDS = Object.freeze([
  'adapterMode',
  'reportId',
  'ownerUserId',
] as const)
const RPC_RESULT_FIELDS = Object.freeze([
  'result_code',
  'ledger_receipt_fingerprint',
  'delivery_claim_fingerprint',
  'delivery_receipt_fingerprint',
  'report_content_sha256',
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
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

export type AiChartD1PalaceWritingExpectedOwnerLookupCommand =
  Readonly<{
    adapterMode:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_MODE
    reportId: string
  }>

export type AiChartD1PalaceWritingAtomicDeliveryRpcCommand =
  Readonly<{
    p_report_id: string
    p_expected_owner_user_id: string
    p_review_record: string
    p_report_snapshot_sha256: string
    p_gate_fingerprint: string
    p_record_fingerprint: string
    p_record_payload_sha256: string
    p_envelope_fingerprint: string
    p_contract_fingerprint: string
    p_source_coordination_fingerprint: string
    p_idempotency_key: string
    p_artifact_payload_sha256: string
    p_ledger_receipt_fingerprint: string
    p_delivery_claim_fingerprint: string
    p_delivery_receipt_fingerprint: string
    p_report_content_sha256: string
    p_report_content: string
  }>

export type AiChartD1PalaceWritingTrustedDeliveryRepositoryAdapterResult =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_TASK
    adapterMode:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_MODE
    status: 'OFFLINE_ATOMIC_RPC_MAPPING_VERIFIED'
    rpcResultCode: 'PUBLISHED' | 'EXISTING_EXACT_MATCH'
    sourceContractFingerprint: string
    idempotencyKey: string
    ledgerReceiptFingerprint: string
    deliveryClaimFingerprint: string
    deliveryReceiptFingerprint: string
    reportContentSha256: string
    ownerLookups: 1
    atomicRpcCalls: 1
    automaticRetryPerformed: false
    customerDeliveryAllowed: false
    productionCallable: false
    openAiRequests: 0
  }>

type LookupExpectedOwner = (
  command: AiChartD1PalaceWritingExpectedOwnerLookupCommand,
) => Promise<unknown>

type InvokeAtomicDeliveryRpc = (
  command: AiChartD1PalaceWritingAtomicDeliveryRpcCommand,
) => Promise<unknown>

type PreparedMaterial = Readonly<{
  contract:
    AiChartD1PalaceWritingTrustedDeliveryAdapterContract
  reviewRecord: AiChartD1PalaceWritingHumanReviewRecord
  reviewRecordJson: string
  artifactPayloadSha256: string
  reportContent: string
  reportContentSha256: string
}>

export class AiChartD1PalaceWritingTrustedDeliveryRepositoryAdapterError
  extends Error {
  readonly code:
    AiChartD1PalaceWritingTrustedDeliveryRepositoryAdapterFailureCode

  constructor(
    code:
      AiChartD1PalaceWritingTrustedDeliveryRepositoryAdapterFailureCode,
  ) {
    const safeCode =
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_FAILURE_CODES.includes(
        code,
      )
        ? code
        : 'TRUSTED_DELIVERY_REPOSITORY_ADAPTER_UNAVAILABLE'
    super(safeCode)
    this.name =
      'AiChartD1PalaceWritingTrustedDeliveryRepositoryAdapterError'
    this.code = safeCode
    Object.freeze(this)
  }
}

function fail(
  code:
    AiChartD1PalaceWritingTrustedDeliveryRepositoryAdapterFailureCode,
): never {
  throw new AiChartD1PalaceWritingTrustedDeliveryRepositoryAdapterError(
    code,
  )
}

function sha256Utf8(value: string): string {
  return createHash('sha256')
    .update(value, 'utf8')
    .digest('hex')
}

function sha256Canonical(value: unknown): string {
  return sha256Utf8(
    createAiChartD1PalaceWritingCanonicalJson(value),
  )
}

function requireSha256(
  value: unknown,
  code:
    AiChartD1PalaceWritingTrustedDeliveryRepositoryAdapterFailureCode,
): string {
  if (
    typeof value !== 'string' ||
    !SHA256_PATTERN.test(value)
  ) {
    fail(code)
  }
  return value
}

function parseReviewRecord(
  value: unknown,
): Readonly<{
  reviewRecord: AiChartD1PalaceWritingHumanReviewRecord
  reviewRecordJson: string
  recordPayloadSha256: string
}> {
  try {
    const reviewRecord =
      parseAiChartD1PalaceWritingHumanReviewRecord(value)
    if (
      reviewRecord.decision !== 'APPROVED' ||
      reviewRecord.issueCodes.length !== 0
    ) {
      fail('HUMAN_REVIEW_RECORD_INVALID')
    }
    const reviewRecordJson =
      createAiChartD1PalaceWritingCanonicalJson(
        reviewRecord,
      )
    return freezeAiChartD1Value({
      reviewRecord,
      reviewRecordJson,
      recordPayloadSha256:
        sha256Utf8(reviewRecordJson),
    })
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingTrustedDeliveryRepositoryAdapterError
    ) {
      throw error
    }
    fail('HUMAN_REVIEW_RECORD_INVALID')
  }
}

function parseRestrictedArtifact(
  value: unknown,
  reviewRecord: AiChartD1PalaceWritingHumanReviewRecord,
): Readonly<{
  artifactPayloadSha256: string
  reportContent: string
  reportContentSha256: string
}> {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(
      value,
      RESTRICTED_ARTIFACT_FIELDS,
    )
    const artifactPayloadSha256 =
      sha256Canonical(value)
    const writingResult =
      parseAiChartD1PalaceWritingResult(
        record.writingResult,
      )
    const fidelityReview =
      parseAiChartD1PalaceWritingFidelityReview(
        record.fidelityReview,
      )
    const writingResultSha256 =
      createAiChartD1PalaceWritingResultSha256(
        writingResult,
      )
    const fidelityReviewSha256 =
      sha256Utf8(
        createAiChartD1PalaceWritingFidelityCanonicalJson(
          fidelityReview,
        ),
      )
    const {
      artifactFingerprint: ignoredArtifactFingerprint,
      ...artifactWithoutFingerprint
    } = record
    void ignoredArtifactFingerprint
    if (
      record.contractVersion !==
        AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_VERSION ||
      record.task !==
        AI_CHART_D1_PALACE_WRITING_PREVIEW_RESTRICTED_ARTIFACT_TASK ||
      record.dataClassification !==
        'RESTRICTED_MODEL_OUTPUT' ||
      record.gateFingerprint !==
        reviewRecord.gateFingerprint ||
      record.sourceSnapshotSha256 !==
        reviewRecord.reportSnapshotSha256 ||
      record.sourceSnapshotSha256 !==
        reviewRecord.artifactSourceSnapshotSha256 ||
      record.artifactFingerprint !==
        reviewRecord.restrictedArtifactFingerprint ||
      artifactPayloadSha256 !==
        reviewRecord.artifactPayloadSha256 ||
      sha256Canonical(
        artifactWithoutFingerprint,
      ) !== record.artifactFingerprint ||
      record.writingResultSha256 !==
        writingResultSha256 ||
      record.fidelityReviewSha256 !==
        fidelityReviewSha256 ||
      writingResult.chartId !== record.chartId ||
      writingResult.runId !== record.runId ||
      writingResult.callId !== record.callId ||
      writingResult.targetPalaceId !==
        record.targetPalaceId ||
      writingResult.sourcePackageFingerprint !==
        record.writingPackageFingerprint ||
      fidelityReview.chartId !== record.chartId ||
      fidelityReview.runId !== record.runId ||
      fidelityReview.callId !== record.callId ||
      fidelityReview.targetPalaceId !==
        record.targetPalaceId ||
      fidelityReview.sourcePackageFingerprint !==
        record.writingPackageFingerprint ||
      fidelityReview.sourceWritingResultSha256 !==
        writingResultSha256 ||
      fidelityReview.fidelityReviewStatus !==
        'approved' ||
      fidelityReview.customerDeliveryStatus !== 'ready' ||
      record.modelOutputIncluded !== true ||
      record.promptIncluded !== false ||
      record.requestBodyIncluded !== false ||
      record.secretsIncluded !== false ||
      record.chartSnapshotIncluded !== false ||
      record.birthDataIncluded !== false ||
      record.accessPolicy !==
        'SERVER_ONLY_EXPLICIT_HUMAN_REVIEW' ||
      record.humanReviewStatus !== 'NOT_REVIEWED' ||
      record.customerDeliveryStatus !==
        'BLOCKED_PENDING_HUMAN_REVIEW' ||
      record.persistenceStatus !== 'NOT_PERSISTED' ||
      record.storageAuthority !==
        'RESTRICTED_ARTIFACT_STORAGE_ADAPTER_REQUIRED' ||
      record.nextRequiredAction !==
        'PERSIST_WITH_RESTRICTED_ARTIFACT_ADAPTER'
    ) {
      fail('RESTRICTED_ARTIFACT_INVALID')
    }
    const reportContent = writingResult.sections
      .map((section) => section.customerText)
      .join('\n\n')
    if (reportContent.trim().length === 0) {
      fail('RESTRICTED_ARTIFACT_INVALID')
    }
    return freezeAiChartD1Value({
      artifactPayloadSha256,
      reportContent,
      reportContentSha256:
        sha256Utf8(reportContent),
    })
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingTrustedDeliveryRepositoryAdapterError
    ) {
      throw error
    }
    fail('RESTRICTED_ARTIFACT_INVALID')
  }
}

function prepareMaterial(
  input: unknown,
): PreparedMaterial {
  let inputRecord: Record<string, unknown>
  try {
    inputRecord = requireAiChartD1ExactObject(
      input,
      INPUT_FIELDS,
    )
  } catch {
    fail('TRUSTED_DELIVERY_REPOSITORY_ADAPTER_UNAVAILABLE')
  }
  const parsedReview =
    parseReviewRecord(inputRecord.reviewRecord)
  const parsedArtifact =
    parseRestrictedArtifact(
      inputRecord.restrictedArtifact,
      parsedReview.reviewRecord,
    )
  const contractValue =
    inputRecord.trustedDeliveryContract
  if (
    contractValue === null ||
    typeof contractValue !== 'object'
  ) {
    fail('TRUSTED_DELIVERY_CONTRACT_UNAVAILABLE')
  }
  const contractRecord =
    contractValue as Record<string, unknown>
  if (
    contractRecord.reportId !==
      parsedReview.reviewRecord.reportId ||
    contractRecord.reportSnapshotSha256 !==
      parsedReview.reviewRecord.reportSnapshotSha256 ||
    contractRecord.gateFingerprint !==
      parsedReview.reviewRecord.gateFingerprint ||
    contractRecord.recordFingerprint !==
      parsedReview.reviewRecord.recordFingerprint ||
    contractRecord.recordPayloadSha256 !==
      parsedReview.recordPayloadSha256
  ) {
    fail('HUMAN_REVIEW_RECORD_INVALID')
  }

  let contract
  try {
    contract =
      consumeAiChartD1PalaceWritingTrustedDeliveryAdapterContract(
        contractValue,
      )
  } catch {
    fail('TRUSTED_DELIVERY_CONTRACT_UNAVAILABLE')
  }
  return freezeAiChartD1Value({
    contract,
    reviewRecord: parsedReview.reviewRecord,
    reviewRecordJson: parsedReview.reviewRecordJson,
    artifactPayloadSha256:
      parsedArtifact.artifactPayloadSha256,
    reportContent: parsedArtifact.reportContent,
    reportContentSha256:
      parsedArtifact.reportContentSha256,
  })
}

function parseOwnerOutcome(
  value: unknown,
  command:
    AiChartD1PalaceWritingExpectedOwnerLookupCommand,
): string {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(
      value,
      OWNER_OUTCOME_FIELDS,
    )
    if (
      record.adapterMode !==
        AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_MODE ||
      record.reportId !== command.reportId ||
      typeof record.ownerUserId !== 'string' ||
      !UUID_PATTERN.test(record.ownerUserId)
    ) {
      fail('REPORT_OWNER_LOOKUP_INVALID')
    }
    return record.ownerUserId
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingTrustedDeliveryRepositoryAdapterError
    ) {
      throw error
    }
    fail('REPORT_OWNER_LOOKUP_INVALID')
  }
}

function classifyRpcFailure(
  error: unknown,
): AiChartD1PalaceWritingTrustedDeliveryRepositoryAdapterFailureCode {
  const message =
    error !== null &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
      ? error.message
      : null
  switch (message) {
    case 'ai_chart_report_delivery_report_not_found':
      return 'REPORT_NOT_FOUND'
    case 'ai_chart_report_delivery_owner_mismatch':
      return 'REPORT_OWNER_MISMATCH'
    case 'ai_chart_report_delivery_payment_required':
      return 'REPORT_PAYMENT_REQUIRED'
    case 'ai_chart_report_delivery_snapshot_missing':
    case 'ai_chart_report_delivery_snapshot_mismatch':
      return 'REPORT_SNAPSHOT_MISMATCH'
    case 'ai_chart_report_delivery_ledger_conflict':
      return 'DURABLE_REVIEW_LEDGER_CONFLICT'
    case 'ai_chart_report_delivery_report_state_conflict':
      return 'REPORT_STATE_CONFLICT'
    case 'ai_chart_report_delivery_idempotency_conflict':
      return 'IDEMPOTENCY_CONFLICT'
    default:
      return 'ATOMIC_DELIVERY_RPC_FAILED'
  }
}

function createReceiptFingerprint(
  kind: string,
  material: PreparedMaterial,
  extra: Readonly<Record<string, unknown>> = {},
): string {
  return sha256Canonical({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_VERSION,
    kind,
    reportId: material.contract.reportId,
    reportSnapshotSha256:
      material.contract.reportSnapshotSha256,
    gateFingerprint:
      material.contract.gateFingerprint,
    recordFingerprint:
      material.contract.recordFingerprint,
    idempotencyKey:
      material.contract.idempotencyKey,
    contractFingerprint:
      material.contract.contractFingerprint,
    ...extra,
  })
}

function parseRpcResult(
  value: unknown,
  command: AiChartD1PalaceWritingAtomicDeliveryRpcCommand,
): Readonly<{
  resultCode: 'PUBLISHED' | 'EXISTING_EXACT_MATCH'
  ledgerReceiptFingerprint: string
  deliveryClaimFingerprint: string
  deliveryReceiptFingerprint: string
  reportContentSha256: string
}> {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(
      value,
      RPC_RESULT_FIELDS,
    )
    if (
      (
        record.result_code !== 'PUBLISHED' &&
        record.result_code !==
          'EXISTING_EXACT_MATCH'
      ) ||
      requireSha256(
        record.ledger_receipt_fingerprint,
        'ATOMIC_DELIVERY_RPC_RESULT_INVALID',
      ) !== command.p_ledger_receipt_fingerprint ||
      requireSha256(
        record.delivery_claim_fingerprint,
        'ATOMIC_DELIVERY_RPC_RESULT_INVALID',
      ) !== command.p_delivery_claim_fingerprint ||
      requireSha256(
        record.delivery_receipt_fingerprint,
        'ATOMIC_DELIVERY_RPC_RESULT_INVALID',
      ) !== command.p_delivery_receipt_fingerprint ||
      requireSha256(
        record.report_content_sha256,
        'ATOMIC_DELIVERY_RPC_RESULT_INVALID',
      ) !== command.p_report_content_sha256
    ) {
      fail('ATOMIC_DELIVERY_RPC_RESULT_INVALID')
    }
    return freezeAiChartD1Value({
      resultCode: record.result_code,
      ledgerReceiptFingerprint:
        command.p_ledger_receipt_fingerprint,
      deliveryClaimFingerprint:
        command.p_delivery_claim_fingerprint,
      deliveryReceiptFingerprint:
        command.p_delivery_receipt_fingerprint,
      reportContentSha256:
        command.p_report_content_sha256,
    })
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingTrustedDeliveryRepositoryAdapterError
    ) {
      throw error
    }
    fail('ATOMIC_DELIVERY_RPC_RESULT_INVALID')
  }
}

export async function executeAiChartD1PalaceWritingTrustedDeliveryRepositoryAdapter(
  input: unknown,
  dependencies: Readonly<{
    lookupExpectedOwner: LookupExpectedOwner
    invokeAtomicDeliveryRpc: InvokeAtomicDeliveryRpc
  }>,
): Promise<AiChartD1PalaceWritingTrustedDeliveryRepositoryAdapterResult> {
  let dependenciesRecord: Record<string, unknown>
  try {
    dependenciesRecord =
      requireAiChartD1ExactObject(
        dependencies,
        DEPENDENCY_FIELDS,
      )
  } catch {
    fail('TRUSTED_DELIVERY_REPOSITORY_ADAPTER_UNAVAILABLE')
  }
  if (
    process.env.NODE_ENV !== 'test' ||
    typeof dependenciesRecord.lookupExpectedOwner !==
      'function' ||
    typeof dependenciesRecord.invokeAtomicDeliveryRpc !==
      'function'
  ) {
    fail('TRUSTED_DELIVERY_REPOSITORY_ADAPTER_UNAVAILABLE')
  }

  const material = prepareMaterial(input)
  const ownerLookupCommand = freezeAiChartD1Value({
    adapterMode:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_MODE,
    reportId: material.contract.reportId,
  })
  let ownerOutcome: unknown
  try {
    ownerOutcome = await (
      dependenciesRecord.lookupExpectedOwner as
        LookupExpectedOwner
    )(ownerLookupCommand)
  } catch {
    fail('REPORT_OWNER_LOOKUP_FAILED')
  }
  const ownerUserId =
    parseOwnerOutcome(
      ownerOutcome,
      ownerLookupCommand,
    )

  const ledgerReceiptFingerprint =
    createReceiptFingerprint(
      'DURABLE_REVIEW_LEDGER_RECEIPT',
      material,
      {
        recordPayloadSha256:
          material.contract.recordPayloadSha256,
      },
    )
  const deliveryClaimFingerprint =
    createReceiptFingerprint(
      'REPORT_DELIVERY_CLAIM',
      material,
      {
        expectedOwnerUserId: ownerUserId,
        ledgerReceiptFingerprint,
      },
    )
  const deliveryReceiptFingerprint =
    createReceiptFingerprint(
      'REPORT_DELIVERY_RECEIPT',
      material,
      {
        artifactPayloadSha256:
          material.artifactPayloadSha256,
        deliveryClaimFingerprint,
        reportContentSha256:
          material.reportContentSha256,
      },
    )
  const rpcCommand = freezeAiChartD1Value({
    p_report_id: material.contract.reportId,
    p_expected_owner_user_id: ownerUserId,
    p_review_record: material.reviewRecordJson,
    p_report_snapshot_sha256:
      material.contract.reportSnapshotSha256,
    p_gate_fingerprint:
      material.contract.gateFingerprint,
    p_record_fingerprint:
      material.contract.recordFingerprint,
    p_record_payload_sha256:
      material.contract.recordPayloadSha256,
    p_envelope_fingerprint:
      material.contract.envelopeFingerprint,
    p_contract_fingerprint:
      material.contract.contractFingerprint,
    p_source_coordination_fingerprint:
      material.contract.sourceCoordinationFingerprint,
    p_idempotency_key:
      material.contract.idempotencyKey,
    p_artifact_payload_sha256:
      material.artifactPayloadSha256,
    p_ledger_receipt_fingerprint:
      ledgerReceiptFingerprint,
    p_delivery_claim_fingerprint:
      deliveryClaimFingerprint,
    p_delivery_receipt_fingerprint:
      deliveryReceiptFingerprint,
    p_report_content_sha256:
      material.reportContentSha256,
    p_report_content: material.reportContent,
  })

  let rpcValue: unknown
  try {
    rpcValue = await (
      dependenciesRecord.invokeAtomicDeliveryRpc as
        InvokeAtomicDeliveryRpc
    )(rpcCommand)
  } catch (error) {
    fail(classifyRpcFailure(error))
  }
  const rpcResult =
    parseRpcResult(rpcValue, rpcCommand)

  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_TASK,
    adapterMode:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_REPOSITORY_ADAPTER_MODE,
    status:
      'OFFLINE_ATOMIC_RPC_MAPPING_VERIFIED' as const,
    rpcResultCode: rpcResult.resultCode,
    sourceContractFingerprint:
      material.contract.contractFingerprint,
    idempotencyKey:
      material.contract.idempotencyKey,
    ledgerReceiptFingerprint:
      rpcResult.ledgerReceiptFingerprint,
    deliveryClaimFingerprint:
      rpcResult.deliveryClaimFingerprint,
    deliveryReceiptFingerprint:
      rpcResult.deliveryReceiptFingerprint,
    reportContentSha256:
      rpcResult.reportContentSha256,
    ownerLookups: 1 as const,
    atomicRpcCalls: 1 as const,
    automaticRetryPerformed: false as const,
    customerDeliveryAllowed: false as const,
    productionCallable: false as const,
    openAiRequests: 0 as const,
  })
}
