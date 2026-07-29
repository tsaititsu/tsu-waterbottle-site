import 'server-only'

import { createHash } from 'node:crypto'
import {
  freezeAiChartD1Value,
} from './d1CommonContracts'
import {
  consumeAiChartD1PalaceWritingCustomerDeliveryCoordination,
} from './d1PalaceWritingCustomerDeliveryCoordinator.server'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_ADAPTER_CONTRACT_VERSION =
  'ai-chart-d1-palace-writing-trusted-delivery-adapter-contract/v1' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_ADAPTER_CONTRACT_TASK =
  'D1_PALACE_WRITING_TRUSTED_DELIVERY_ADAPTER_CONTRACT' as const

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_ADAPTER_CONTRACT_FAILURE_CODES =
  Object.freeze([
    'COORDINATION_UNAVAILABLE',
    'DURABLE_REVIEW_LEDGER_UNAVAILABLE',
    'DURABLE_REVIEW_LEDGER_CONFLICT',
    'REPORT_COMPARE_AND_SET_UNAVAILABLE',
    'REPORT_STATE_CONFLICT',
    'RESTRICTED_ARTIFACT_UNAVAILABLE',
    'RESTRICTED_ARTIFACT_BINDING_MISMATCH',
    'REPORT_CONTENT_WRITE_FAILED',
    'IDEMPOTENCY_CONFLICT',
    'TRUSTED_DELIVERY_ADAPTER_CONTRACT_UNAVAILABLE',
  ] as const)

export type AiChartD1PalaceWritingTrustedDeliveryAdapterContractFailureCode =
  (typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_ADAPTER_CONTRACT_FAILURE_CODES)[number]

const REQUIRED_PORTS = Object.freeze([
  Object.freeze({
    sequence: 1 as const,
    port:
      'ENSURE_DURABLE_REVIEW_LEDGER' as const,
    requiredInput:
      'EXACT_APPROVAL_BINDING_AND_IDEMPOTENCY_KEY' as const,
    requiredOutput:
      'CREATED_OR_EXISTING_EXACT_MATCH' as const,
    idempotencyRule:
      'EXCLUSIVE_CREATE_OR_EXACT_MATCH' as const,
    implementationStatus: 'NOT_IMPLEMENTED' as const,
  }),
  Object.freeze({
    sequence: 2 as const,
    port:
      'COMPARE_AND_SET_REPORT_DELIVERY_CLAIM' as const,
    requiredInput:
      'EXPECTED_OWNER_PAID_PENDING_CONTENT_ABSENT_EXACT_SNAPSHOT' as const,
    requiredOutput:
      'CLAIMED_OR_ALREADY_DELIVERED_EXACT_MATCH' as const,
    idempotencyRule:
      'SAME_IDEMPOTENCY_KEY_ONLY' as const,
    implementationStatus: 'NOT_IMPLEMENTED' as const,
  }),
  Object.freeze({
    sequence: 3 as const,
    port:
      'PUBLISH_SOURCE_BOUND_REPORT_CONTENT' as const,
    requiredInput:
      'EXACT_CLAIM_AND_VERIFIED_RESTRICTED_ARTIFACT_ONLY' as const,
    requiredOutput:
      'PUBLISHED_OR_ALREADY_PUBLISHED_EXACT_MATCH' as const,
    idempotencyRule:
      'COMPARE_AND_SET_ON_REPORT_AND_IDEMPOTENCY_KEY' as const,
    implementationStatus: 'NOT_IMPLEMENTED' as const,
  }),
])

const EXPECTED_REPORT_STATE = Object.freeze({
  ownerBindingStatus: 'SERVER_VERIFIED' as const,
  paymentStatus: 'PAID' as const,
  reportStatus: 'PENDING' as const,
  reportContentStatus: 'ABSENT' as const,
  reportSnapshotStatus: 'EXACT_MATCH' as const,
})

export type AiChartD1PalaceWritingTrustedDeliveryAdapterContract =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_ADAPTER_CONTRACT_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_ADAPTER_CONTRACT_TASK
    dataClassification:
      'CUSTOMER_DELIVERY_ADAPTER_METADATA'
    sourceCoordinationFingerprint: string
    reportId: string
    reportSnapshotSha256: string
    gateFingerprint: string
    recordFingerprint: string
    recordPayloadSha256: string
    envelopeFingerprint: string
    decision: 'APPROVED'
    authority:
      'TRUSTED_SERVER_CUSTOMER_DELIVERY_ADAPTER_CONTRACT'
    status: 'PORTS_DECLARED_NOT_IMPLEMENTED'
    capabilityScope:
      'IN_PROCESS_EXACT_OBJECT_IDENTITY'
    sourceCoordinationStatus:
      'CONSUMED_READY_STOPPED'
    idempotencyKey: string
    idempotencyScope:
      'REPORT_SNAPSHOT_GATE_RECORD_AND_COORDINATION'
    idempotencyStatus:
      'KEY_DERIVED_NOT_PERSISTED'
    replayPolicy:
      'EXACT_MATCH_ONLY_OTHERWISE_FAIL_CLOSED'
    partialFailurePolicy:
      'NO_BLIND_RETRY_RECONCILE_BY_IDEMPOTENCY_KEY'
    automaticRetryAllowed: false
    durableReviewLedgerPolicy:
      'APPEND_OR_VERIFY_EXACT_MATCH_BEFORE_ANY_REPORT_MUTATION'
    reportCompareAndSetPolicy:
      'ATOMIC_EXPECTED_OWNER_PAID_PENDING_CONTENT_ABSENT_EXACT_SNAPSHOT'
    reportCompareAndSetExpectedState:
      typeof EXPECTED_REPORT_STATE
    reportContentSourcePolicy:
      'VERIFIED_RESTRICTED_ARTIFACT_REQUIRED'
    existingReportContentGateStatus:
      'INSUFFICIENT_READ_THEN_WRITE_NOT_ATOMIC'
    requiredPorts: typeof REQUIRED_PORTS
    failureCodes:
      readonly AiChartD1PalaceWritingTrustedDeliveryAdapterContractFailureCode[]
    durableReviewLedgerStatus: 'NOT_IMPLEMENTED'
    reportCompareAndSetStatus: 'NOT_IMPLEMENTED'
    reportContentSourceStatus: 'NOT_LOADED'
    reportContentPublishStatus: 'NOT_IMPLEMENTED'
    deliveryReceiptStatus: 'NOT_CREATED'
    customerDeliveryStatus:
      'BLOCKED_PENDING_DURABLE_DELIVERY_ADAPTER'
    customerDeliveryAllowed: false
    reportMutationAllowed: false
    productionCallable: false
    adapterInvocations: 0
    durableLedgerWrites: 0
    reportMutations: 0
    openAiRequests: 0
    nextRequiredAction:
      'IMPLEMENT_DURABLE_LEDGER_REPORT_CAS_AND_ARTIFACT_DELIVERY_ADAPTER'
    contractFingerprint: string
  }>

const activeContracts = new WeakMap<
  AiChartD1PalaceWritingTrustedDeliveryAdapterContract,
  AiChartD1PalaceWritingTrustedDeliveryAdapterContract
>()
const consumedContracts =
  new WeakSet<AiChartD1PalaceWritingTrustedDeliveryAdapterContract>()

export class AiChartD1PalaceWritingTrustedDeliveryAdapterContractError
  extends Error {
  readonly code:
    AiChartD1PalaceWritingTrustedDeliveryAdapterContractFailureCode

  constructor(
    code:
      AiChartD1PalaceWritingTrustedDeliveryAdapterContractFailureCode,
  ) {
    const safeCode =
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_ADAPTER_CONTRACT_FAILURE_CODES.includes(
        code,
      )
        ? code
        : 'TRUSTED_DELIVERY_ADAPTER_CONTRACT_UNAVAILABLE'
    super(safeCode)
    this.name =
      'AiChartD1PalaceWritingTrustedDeliveryAdapterContractError'
    this.code = safeCode
    Object.freeze(this)
  }
}

function fail(
  code:
    AiChartD1PalaceWritingTrustedDeliveryAdapterContractFailureCode,
): never {
  throw new AiChartD1PalaceWritingTrustedDeliveryAdapterContractError(
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

export function buildAiChartD1PalaceWritingTrustedDeliveryAdapterContract(
  coordinationValue: unknown,
): AiChartD1PalaceWritingTrustedDeliveryAdapterContract {
  let coordination
  try {
    coordination =
      consumeAiChartD1PalaceWritingCustomerDeliveryCoordination(
        coordinationValue,
      )
  } catch {
    fail('COORDINATION_UNAVAILABLE')
  }

  const idempotencyKey = sha256Canonical({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_ADAPTER_CONTRACT_VERSION,
    idempotencyScope:
      'REPORT_SNAPSHOT_GATE_RECORD_AND_COORDINATION',
    reportId: coordination.reportId,
    reportSnapshotSha256:
      coordination.reportSnapshotSha256,
    gateFingerprint: coordination.gateFingerprint,
    recordFingerprint:
      coordination.recordFingerprint,
    recordPayloadSha256:
      coordination.recordPayloadSha256,
    envelopeFingerprint:
      coordination.envelopeFingerprint,
    coordinationFingerprint:
      coordination.coordinationFingerprint,
  })
  const withoutFingerprint = {
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_ADAPTER_CONTRACT_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_ADAPTER_CONTRACT_TASK,
    dataClassification:
      'CUSTOMER_DELIVERY_ADAPTER_METADATA' as const,
    sourceCoordinationFingerprint:
      coordination.coordinationFingerprint,
    reportId: coordination.reportId,
    reportSnapshotSha256:
      coordination.reportSnapshotSha256,
    gateFingerprint: coordination.gateFingerprint,
    recordFingerprint:
      coordination.recordFingerprint,
    recordPayloadSha256:
      coordination.recordPayloadSha256,
    envelopeFingerprint:
      coordination.envelopeFingerprint,
    decision: 'APPROVED' as const,
    authority:
      'TRUSTED_SERVER_CUSTOMER_DELIVERY_ADAPTER_CONTRACT' as const,
    status:
      'PORTS_DECLARED_NOT_IMPLEMENTED' as const,
    capabilityScope:
      'IN_PROCESS_EXACT_OBJECT_IDENTITY' as const,
    sourceCoordinationStatus:
      'CONSUMED_READY_STOPPED' as const,
    idempotencyKey,
    idempotencyScope:
      'REPORT_SNAPSHOT_GATE_RECORD_AND_COORDINATION' as const,
    idempotencyStatus:
      'KEY_DERIVED_NOT_PERSISTED' as const,
    replayPolicy:
      'EXACT_MATCH_ONLY_OTHERWISE_FAIL_CLOSED' as const,
    partialFailurePolicy:
      'NO_BLIND_RETRY_RECONCILE_BY_IDEMPOTENCY_KEY' as const,
    automaticRetryAllowed: false as const,
    durableReviewLedgerPolicy:
      'APPEND_OR_VERIFY_EXACT_MATCH_BEFORE_ANY_REPORT_MUTATION' as const,
    reportCompareAndSetPolicy:
      'ATOMIC_EXPECTED_OWNER_PAID_PENDING_CONTENT_ABSENT_EXACT_SNAPSHOT' as const,
    reportCompareAndSetExpectedState:
      EXPECTED_REPORT_STATE,
    reportContentSourcePolicy:
      'VERIFIED_RESTRICTED_ARTIFACT_REQUIRED' as const,
    existingReportContentGateStatus:
      'INSUFFICIENT_READ_THEN_WRITE_NOT_ATOMIC' as const,
    requiredPorts: REQUIRED_PORTS,
    failureCodes:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_ADAPTER_CONTRACT_FAILURE_CODES,
    durableReviewLedgerStatus:
      'NOT_IMPLEMENTED' as const,
    reportCompareAndSetStatus:
      'NOT_IMPLEMENTED' as const,
    reportContentSourceStatus:
      'NOT_LOADED' as const,
    reportContentPublishStatus:
      'NOT_IMPLEMENTED' as const,
    deliveryReceiptStatus:
      'NOT_CREATED' as const,
    customerDeliveryStatus:
      'BLOCKED_PENDING_DURABLE_DELIVERY_ADAPTER' as const,
    customerDeliveryAllowed: false as const,
    reportMutationAllowed: false as const,
    productionCallable: false as const,
    adapterInvocations: 0 as const,
    durableLedgerWrites: 0 as const,
    reportMutations: 0 as const,
    openAiRequests: 0 as const,
    nextRequiredAction:
      'IMPLEMENT_DURABLE_LEDGER_REPORT_CAS_AND_ARTIFACT_DELIVERY_ADAPTER' as const,
  }
  const contract = freezeAiChartD1Value({
    ...withoutFingerprint,
    contractFingerprint:
      sha256Canonical(withoutFingerprint),
  })
  activeContracts.set(contract, contract)
  return contract
}

export function consumeAiChartD1PalaceWritingTrustedDeliveryAdapterContract(
  value: unknown,
): AiChartD1PalaceWritingTrustedDeliveryAdapterContract {
  if (
    value === null ||
    typeof value !== 'object'
  ) {
    fail('TRUSTED_DELIVERY_ADAPTER_CONTRACT_UNAVAILABLE')
  }
  const contract =
    value as AiChartD1PalaceWritingTrustedDeliveryAdapterContract
  if (consumedContracts.has(contract)) {
    fail('TRUSTED_DELIVERY_ADAPTER_CONTRACT_UNAVAILABLE')
  }
  const active = activeContracts.get(contract)
  if (active === undefined) {
    fail('TRUSTED_DELIVERY_ADAPTER_CONTRACT_UNAVAILABLE')
  }
  activeContracts.delete(contract)
  consumedContracts.add(contract)
  return active
}
