import 'server-only'

import { createHash } from 'node:crypto'
import {
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import {
  AiChartD1PalaceWritingHumanReviewApprovalRequiredError,
  AiChartD1PalaceWritingHumanReviewRecordReadbackError,
  consumeAiChartD1PalaceWritingVerifiedHumanReviewApproval,
} from './d1PalaceWritingHumanReviewRecordReadback.server'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'

export const AI_CHART_D1_PALACE_WRITING_CUSTOMER_DELIVERY_STATE_PROBE_COMMAND_VERSION =
  'ai-chart-d1-palace-writing-customer-delivery-state-probe-command/v1' as const
export const AI_CHART_D1_PALACE_WRITING_CUSTOMER_DELIVERY_STATE_PROBE_COMMAND_TASK =
  'D1_PALACE_WRITING_CUSTOMER_DELIVERY_STATE_PROBE_COMMAND' as const
export const AI_CHART_D1_PALACE_WRITING_CUSTOMER_DELIVERY_COORDINATOR_VERSION =
  'ai-chart-d1-palace-writing-customer-delivery-coordinator/v1' as const
export const AI_CHART_D1_PALACE_WRITING_CUSTOMER_DELIVERY_COORDINATOR_TASK =
  'D1_PALACE_WRITING_CUSTOMER_DELIVERY_COORDINATOR' as const

export const AI_CHART_D1_PALACE_WRITING_CUSTOMER_DELIVERY_COORDINATOR_FAILURE_CODES =
  Object.freeze([
    'VERIFIED_APPROVAL_UNAVAILABLE',
    'HUMAN_REVIEW_APPROVAL_REQUIRED',
    'LATEST_REPORT_STATE_ADAPTER_UNAVAILABLE',
    'LATEST_REPORT_STATE_INVALID',
    'LATEST_REPORT_STATE_MISMATCH',
    'REPORT_PAYMENT_REQUIRED',
    'REPORT_OWNER_BINDING_INVALID',
    'REPORT_STATUS_INVALID',
    'REPORT_ALREADY_PUBLISHED',
    'COORDINATION_UNAVAILABLE',
  ] as const)

export type AiChartD1PalaceWritingCustomerDeliveryCoordinatorFailureCode =
  (typeof AI_CHART_D1_PALACE_WRITING_CUSTOMER_DELIVERY_COORDINATOR_FAILURE_CODES)[number]

const INPUT_FIELDS = Object.freeze([
  'verifiedHumanReviewRecord',
  'probeLatestReportDeliveryState',
] as const)
const PROBE_OUTCOME_FIELDS = Object.freeze([
  'adapterMode',
  'lookupStatus',
  'reportId',
  'reportSnapshotSha256',
  'paymentStatus',
  'reportStatus',
  'reportContentStatus',
  'ownerBindingStatus',
  'sourceBindingStatus',
  'gateFingerprint',
  'recordFingerprint',
] as const)

export type AiChartD1PalaceWritingCustomerDeliveryStateProbeCommand =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_CUSTOMER_DELIVERY_STATE_PROBE_COMMAND_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_CUSTOMER_DELIVERY_STATE_PROBE_COMMAND_TASK
    adapterMode:
      'INJECTED_LATEST_REPORT_DELIVERY_STATE_PROBE_ONLY'
    sequence: 1
    reportId: string
    reportSnapshotSha256: string
    gateFingerprint: string
    recordFingerprint: string
  }>

export type AiChartD1PalaceWritingCustomerDeliveryStateProbe =
  (
    command:
      AiChartD1PalaceWritingCustomerDeliveryStateProbeCommand,
    ) => Promise<unknown>

export type AiChartD1PalaceWritingCustomerDeliveryCoordinatorInput =
  Readonly<{
    verifiedHumanReviewRecord: unknown
    probeLatestReportDeliveryState:
      AiChartD1PalaceWritingCustomerDeliveryStateProbe
  }>

export type AiChartD1PalaceWritingCustomerDeliveryCoordination =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_CUSTOMER_DELIVERY_COORDINATOR_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_CUSTOMER_DELIVERY_COORDINATOR_TASK
    dataClassification:
      'CUSTOMER_DELIVERY_COORDINATION_METADATA'
    reportId: string
    reportSnapshotSha256: string
    gateFingerprint: string
    recordFingerprint: string
    recordPayloadSha256: string
    envelopeFingerprint: string
    decision: 'APPROVED'
    authority:
      'TRUSTED_SERVER_CUSTOMER_DELIVERY_COORDINATOR_CONTRACT'
    status: 'READY_STOPPED'
    stage:
      'LATEST_REPORT_DELIVERY_STATE_VERIFIED'
    capabilityScope:
      'IN_PROCESS_EXACT_OBJECT_IDENTITY'
    verifiedHumanReviewStatus:
      'CONSUMED_VERIFIED_APPROVAL'
    reportLookupStatus: 'SYNTHETIC_FOUND'
    paymentStatus:
      'SYNTHETIC_PAID_NOT_PRODUCTION'
    reportStatus:
      'SYNTHETIC_PENDING_NOT_PRODUCTION'
    reportContentStatus:
      'SYNTHETIC_ABSENT_NOT_PRODUCTION'
    ownerBindingStatus:
      'SYNTHETIC_SERVER_VERIFIED_NOT_PRODUCTION'
    sourceBindingStatus:
      'SYNTHETIC_MATCHED_NOT_PRODUCTION'
    deliveryAdapterStatus: 'NOT_IMPLEMENTED'
    customerDeliveryStatus:
      'BLOCKED_PENDING_TRUSTED_DELIVERY_ADAPTER'
    customerDeliveryAllowed: false
    reportMutationAllowed: false
    productionCallable: false
    reportStateReads: 1
    storageWrites: 0
    reportMutations: 0
    openAiRequests: 0
    nextRequiredAction:
      'IMPLEMENT_SEPARATELY_AUTHORIZED_TRUSTED_DELIVERY_ADAPTER'
    coordinationFingerprint: string
  }>

const activeCoordinations = new WeakMap<
  AiChartD1PalaceWritingCustomerDeliveryCoordination,
  AiChartD1PalaceWritingCustomerDeliveryCoordination
>()
const consumedCoordinations =
  new WeakSet<AiChartD1PalaceWritingCustomerDeliveryCoordination>()

export class AiChartD1PalaceWritingCustomerDeliveryCoordinatorError
  extends Error {
  readonly code:
    AiChartD1PalaceWritingCustomerDeliveryCoordinatorFailureCode

  constructor(
    code:
      AiChartD1PalaceWritingCustomerDeliveryCoordinatorFailureCode,
  ) {
    const safeCode =
      AI_CHART_D1_PALACE_WRITING_CUSTOMER_DELIVERY_COORDINATOR_FAILURE_CODES.includes(
        code,
      )
        ? code
        : 'LATEST_REPORT_STATE_INVALID'
    super(safeCode)
    this.name =
      'AiChartD1PalaceWritingCustomerDeliveryCoordinatorError'
    this.code = safeCode
    Object.freeze(this)
  }
}

function fail(
  code:
    AiChartD1PalaceWritingCustomerDeliveryCoordinatorFailureCode,
): never {
  throw new AiChartD1PalaceWritingCustomerDeliveryCoordinatorError(
    code,
  )
}

function parseProbeOutcome(
  value: unknown,
  command:
    AiChartD1PalaceWritingCustomerDeliveryStateProbeCommand,
): void {
  let record: Record<string, unknown>
  try {
    assertAiChartD1SafeGraph(value)
    record = requireAiChartD1ExactObject(
      value,
      PROBE_OUTCOME_FIELDS,
    )
  } catch {
    fail('LATEST_REPORT_STATE_INVALID')
  }

  if (
    record.adapterMode !==
      'INJECTED_LATEST_REPORT_DELIVERY_STATE_PROBE_ONLY' ||
    record.lookupStatus !== 'FOUND' ||
    record.sourceBindingStatus !== 'MATCHED'
  ) {
    fail('LATEST_REPORT_STATE_INVALID')
  }
  if (
    record.reportId !== command.reportId ||
    record.reportSnapshotSha256 !==
      command.reportSnapshotSha256 ||
    record.gateFingerprint !==
      command.gateFingerprint ||
    record.recordFingerprint !==
      command.recordFingerprint
  ) {
    fail('LATEST_REPORT_STATE_MISMATCH')
  }
  if (record.paymentStatus !== 'PAID') {
    fail('REPORT_PAYMENT_REQUIRED')
  }
  if (
    record.ownerBindingStatus !==
    'SERVER_VERIFIED'
  ) {
    fail('REPORT_OWNER_BINDING_INVALID')
  }
  if (record.reportStatus !== 'PENDING') {
    fail('REPORT_STATUS_INVALID')
  }
  if (record.reportContentStatus !== 'ABSENT') {
    fail('REPORT_ALREADY_PUBLISHED')
  }
}

function createFingerprint(value: unknown): string {
  return createHash('sha256')
    .update(
      createAiChartD1PalaceWritingCanonicalJson(value),
      'utf8',
    )
    .digest('hex')
}

export async function coordinateAiChartD1PalaceWritingCustomerDelivery(
  input:
    AiChartD1PalaceWritingCustomerDeliveryCoordinatorInput,
): Promise<AiChartD1PalaceWritingCustomerDeliveryCoordination> {
  let inputRecord: Record<string, unknown>
  try {
    inputRecord = requireAiChartD1ExactObject(
      input,
      INPUT_FIELDS,
    )
  } catch {
    fail('LATEST_REPORT_STATE_ADAPTER_UNAVAILABLE')
  }
  if (
    process.env.NODE_ENV !== 'test' ||
    typeof inputRecord.probeLatestReportDeliveryState !==
      'function'
  ) {
    fail('LATEST_REPORT_STATE_ADAPTER_UNAVAILABLE')
  }

  let verified
  try {
    verified =
      consumeAiChartD1PalaceWritingVerifiedHumanReviewApproval(
        inputRecord.verifiedHumanReviewRecord,
      )
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingHumanReviewApprovalRequiredError
    ) {
      fail('HUMAN_REVIEW_APPROVAL_REQUIRED')
    }
    if (
      error instanceof
      AiChartD1PalaceWritingHumanReviewRecordReadbackError
    ) {
      fail('VERIFIED_APPROVAL_UNAVAILABLE')
    }
    fail('VERIFIED_APPROVAL_UNAVAILABLE')
  }

  const command = freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_CUSTOMER_DELIVERY_STATE_PROBE_COMMAND_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_CUSTOMER_DELIVERY_STATE_PROBE_COMMAND_TASK,
    adapterMode:
      'INJECTED_LATEST_REPORT_DELIVERY_STATE_PROBE_ONLY' as const,
    sequence: 1 as const,
    reportId: verified.reviewRecord.reportId,
    reportSnapshotSha256:
      verified.reviewRecord.reportSnapshotSha256,
    gateFingerprint: verified.gateFingerprint,
    recordFingerprint: verified.recordFingerprint,
  })

  let outcome: unknown
  try {
    outcome = await (
      inputRecord.probeLatestReportDeliveryState as
        AiChartD1PalaceWritingCustomerDeliveryStateProbe
    )(command)
  } catch {
    fail('LATEST_REPORT_STATE_ADAPTER_UNAVAILABLE')
  }
  parseProbeOutcome(outcome, command)

  const withoutFingerprint = {
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_CUSTOMER_DELIVERY_COORDINATOR_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_CUSTOMER_DELIVERY_COORDINATOR_TASK,
    dataClassification:
      'CUSTOMER_DELIVERY_COORDINATION_METADATA' as const,
    reportId: command.reportId,
    reportSnapshotSha256:
      command.reportSnapshotSha256,
    gateFingerprint: command.gateFingerprint,
    recordFingerprint: command.recordFingerprint,
    recordPayloadSha256:
      verified.recordPayloadSha256,
    envelopeFingerprint:
      verified.envelopeFingerprint,
    decision: 'APPROVED' as const,
    authority:
      'TRUSTED_SERVER_CUSTOMER_DELIVERY_COORDINATOR_CONTRACT' as const,
    status: 'READY_STOPPED' as const,
    stage:
      'LATEST_REPORT_DELIVERY_STATE_VERIFIED' as const,
    capabilityScope:
      'IN_PROCESS_EXACT_OBJECT_IDENTITY' as const,
    verifiedHumanReviewStatus:
      'CONSUMED_VERIFIED_APPROVAL' as const,
    reportLookupStatus:
      'SYNTHETIC_FOUND' as const,
    paymentStatus:
      'SYNTHETIC_PAID_NOT_PRODUCTION' as const,
    reportStatus:
      'SYNTHETIC_PENDING_NOT_PRODUCTION' as const,
    reportContentStatus:
      'SYNTHETIC_ABSENT_NOT_PRODUCTION' as const,
    ownerBindingStatus:
      'SYNTHETIC_SERVER_VERIFIED_NOT_PRODUCTION' as const,
    sourceBindingStatus:
      'SYNTHETIC_MATCHED_NOT_PRODUCTION' as const,
    deliveryAdapterStatus:
      'NOT_IMPLEMENTED' as const,
    customerDeliveryStatus:
      'BLOCKED_PENDING_TRUSTED_DELIVERY_ADAPTER' as const,
    customerDeliveryAllowed: false as const,
    reportMutationAllowed: false as const,
    productionCallable: false as const,
    reportStateReads: 1 as const,
    storageWrites: 0 as const,
    reportMutations: 0 as const,
    openAiRequests: 0 as const,
    nextRequiredAction:
      'IMPLEMENT_SEPARATELY_AUTHORIZED_TRUSTED_DELIVERY_ADAPTER' as const,
  }
  const coordination = freezeAiChartD1Value({
    ...withoutFingerprint,
    coordinationFingerprint:
      createFingerprint(withoutFingerprint),
  })
  activeCoordinations.set(
    coordination,
    coordination,
  )
  return coordination
}

export function consumeAiChartD1PalaceWritingCustomerDeliveryCoordination(
  value: unknown,
): AiChartD1PalaceWritingCustomerDeliveryCoordination {
  if (
    value === null ||
    typeof value !== 'object'
  ) {
    fail('COORDINATION_UNAVAILABLE')
  }
  const coordination =
    value as AiChartD1PalaceWritingCustomerDeliveryCoordination
  if (consumedCoordinations.has(coordination)) {
    fail('COORDINATION_UNAVAILABLE')
  }
  const active =
    activeCoordinations.get(coordination)
  if (active === undefined) {
    fail('COORDINATION_UNAVAILABLE')
  }
  activeCoordinations.delete(coordination)
  consumedCoordinations.add(coordination)
  return active
}
