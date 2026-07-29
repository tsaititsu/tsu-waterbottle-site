import 'server-only'

import { createHash } from 'node:crypto'
import {
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import {
  consumeAiChartD1PalaceWritingTrustedDeliveryAdapterContract,
  type AiChartD1PalaceWritingTrustedDeliveryAdapterContract,
} from './d1PalaceWritingTrustedDeliveryAdapterContracts.server'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'

export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_ADAPTER_PROBE_VERSION =
  'ai-chart-d1-palace-writing-trusted-delivery-adapter-probe/v1' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_ADAPTER_PROBE_TASK =
  'D1_PALACE_WRITING_TRUSTED_DELIVERY_ADAPTER_PROBE' as const
export const AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_ADAPTER_PROBE_FAILURE_CODES =
  Object.freeze([
    'TRUSTED_DELIVERY_ADAPTER_PROBE_UNAVAILABLE',
    'DURABLE_REVIEW_LEDGER_PORT_FAILED',
    'DURABLE_REVIEW_LEDGER_OUTCOME_INVALID',
    'REPORT_DELIVERY_CLAIM_PORT_FAILED',
    'REPORT_DELIVERY_CLAIM_OUTCOME_INVALID',
    'REPORT_CONTENT_PUBLISH_PORT_FAILED',
    'REPORT_CONTENT_PUBLISH_OUTCOME_INVALID',
    'IDEMPOTENCY_CONFLICT',
    'RECONCILIATION_CONFLICT',
  ] as const)

export type AiChartD1PalaceWritingTrustedDeliveryAdapterProbeFailureCode =
  (typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_ADAPTER_PROBE_FAILURE_CODES)[number]

const ADAPTER_MODE =
  'INJECTED_OFFLINE_TRUSTED_DELIVERY_ADAPTER_PROBE_ONLY' as const
const SHA256_PATTERN = /^[a-f0-9]{64}$/u

type TrustedDeliveryCommandBase = Readonly<{
  adapterMode: typeof ADAPTER_MODE
  sequence: 1 | 2 | 3
  port:
    | 'ENSURE_DURABLE_REVIEW_LEDGER'
    | 'COMPARE_AND_SET_REPORT_DELIVERY_CLAIM'
    | 'PUBLISH_SOURCE_BOUND_REPORT_CONTENT'
  reportId: string
  reportSnapshotSha256: string
  gateFingerprint: string
  recordFingerprint: string
  recordPayloadSha256: string
  envelopeFingerprint: string
  sourceCoordinationFingerprint: string
  idempotencyKey: string
  contractFingerprint: string
}>

export type AiChartD1PalaceWritingTrustedDeliveryAdapterProbeCommand =
  | TrustedDeliveryCommandBase &
      Readonly<{
        sequence: 1
        port: 'ENSURE_DURABLE_REVIEW_LEDGER'
        durableReviewLedgerPolicy:
          AiChartD1PalaceWritingTrustedDeliveryAdapterContract['durableReviewLedgerPolicy']
      }>
  | TrustedDeliveryCommandBase &
      Readonly<{
        sequence: 2
        port: 'COMPARE_AND_SET_REPORT_DELIVERY_CLAIM'
        durableReviewLedgerReceiptFingerprint: string
        reportCompareAndSetPolicy:
          AiChartD1PalaceWritingTrustedDeliveryAdapterContract['reportCompareAndSetPolicy']
        reportCompareAndSetExpectedState:
          AiChartD1PalaceWritingTrustedDeliveryAdapterContract['reportCompareAndSetExpectedState']
      }>
  | TrustedDeliveryCommandBase &
      Readonly<{
        sequence: 3
        port: 'PUBLISH_SOURCE_BOUND_REPORT_CONTENT'
        durableReviewLedgerReceiptFingerprint: string
        deliveryClaimFingerprint: string
        reportContentSourcePolicy:
          AiChartD1PalaceWritingTrustedDeliveryAdapterContract['reportContentSourcePolicy']
      }>

type DurableReviewLedgerOutcome = Readonly<{
  adapterMode: typeof ADAPTER_MODE
  sequence: 1
  port: 'ENSURE_DURABLE_REVIEW_LEDGER'
  result: 'CREATED' | 'EXISTING_EXACT_MATCH'
  idempotencyKey: string
  contractFingerprint: string
  durableReviewLedgerReceiptFingerprint: string
}>

type ReportDeliveryClaimOutcome = Readonly<{
  adapterMode: typeof ADAPTER_MODE
  sequence: 2
  port: 'COMPARE_AND_SET_REPORT_DELIVERY_CLAIM'
  result: 'CLAIMED' | 'EXISTING_EXACT_MATCH'
  idempotencyKey: string
  contractFingerprint: string
  durableReviewLedgerReceiptFingerprint: string
  deliveryClaimFingerprint: string
}>

type ReportContentPublishOutcome = Readonly<{
  adapterMode: typeof ADAPTER_MODE
  sequence: 3
  port: 'PUBLISH_SOURCE_BOUND_REPORT_CONTENT'
  result: 'PUBLISHED' | 'EXISTING_EXACT_MATCH'
  idempotencyKey: string
  contractFingerprint: string
  durableReviewLedgerReceiptFingerprint: string
  deliveryClaimFingerprint: string
  deliveryReceiptFingerprint: string
}>

export type AiChartD1PalaceWritingTrustedDeliveryAdapterProbeOutcome =
  | DurableReviewLedgerOutcome
  | ReportDeliveryClaimOutcome
  | ReportContentPublishOutcome

export type AiChartD1PalaceWritingTrustedDeliveryAdapterProbePort =
  (
    command:
      AiChartD1PalaceWritingTrustedDeliveryAdapterProbeCommand,
  ) => Promise<unknown>

export type AiChartD1PalaceWritingTrustedDeliveryAdapterProbeResult =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_ADAPTER_PROBE_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_ADAPTER_PROBE_TASK
    adapterMode: typeof ADAPTER_MODE
    sourceContractFingerprint: string
    idempotencyKey: string
    status: 'OFFLINE_PROBE_SUCCEEDED'
    replayStatus:
      | 'NEW_DELIVERY_VERIFIED'
      | 'EXACT_REPLAY_VERIFIED'
      | 'PARTIAL_FAILURE_RECONCILED'
    partialFailureReconciliationStatus:
      | 'NOT_REQUIRED'
      | 'EXACT_REPLAY_CONFIRMED'
      | 'EARLIER_PORTS_RECONCILED'
    portResults: readonly [
      Readonly<{
        sequence: 1
        port: 'ENSURE_DURABLE_REVIEW_LEDGER'
        result:
          DurableReviewLedgerOutcome['result']
        receiptFingerprint: string
      }>,
      Readonly<{
        sequence: 2
        port:
          'COMPARE_AND_SET_REPORT_DELIVERY_CLAIM'
        result:
          ReportDeliveryClaimOutcome['result']
        receiptFingerprint: string
      }>,
      Readonly<{
        sequence: 3
        port:
          'PUBLISH_SOURCE_BOUND_REPORT_CONTENT'
        result:
          ReportContentPublishOutcome['result']
        receiptFingerprint: string
      }>,
    ]
    adapterInvocations: 3
    actualAdapterWrites: 0
    durableLedgerWrites: 0
    reportMutations: 0
    openAiRequests: 0
    retryPerformed: false
    customerDeliveryStatus:
      'BLOCKED_OFFLINE_ADAPTER_PROBE_ONLY'
    customerDeliveryAllowed: false
    productionCallable: false
    safeMetadataOnly: true
    nextRequiredAction:
      'IMPLEMENT_PRODUCTION_TRUSTED_DELIVERY_ADAPTER'
    probeFingerprint: string
  }>

export class AiChartD1PalaceWritingTrustedDeliveryAdapterProbeError
  extends Error {
  readonly code:
    AiChartD1PalaceWritingTrustedDeliveryAdapterProbeFailureCode

  constructor(
    code:
      AiChartD1PalaceWritingTrustedDeliveryAdapterProbeFailureCode,
  ) {
    const safeCode =
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_ADAPTER_PROBE_FAILURE_CODES.includes(
        code,
      )
        ? code
        : 'TRUSTED_DELIVERY_ADAPTER_PROBE_UNAVAILABLE'
    super(safeCode)
    this.name =
      'AiChartD1PalaceWritingTrustedDeliveryAdapterProbeError'
    this.code = safeCode
    Object.freeze(this)
  }
}

function fail(
  code:
    AiChartD1PalaceWritingTrustedDeliveryAdapterProbeFailureCode,
): never {
  throw new AiChartD1PalaceWritingTrustedDeliveryAdapterProbeError(
    code,
  )
}

function isExactProbeInput(
  value: unknown,
): value is Readonly<{
  trustedDeliveryContract: unknown
  executePort:
    AiChartD1PalaceWritingTrustedDeliveryAdapterProbePort
}> {
  try {
    if (
      value === null ||
      typeof value !== 'object' ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      return false
    }
    const keys = Reflect.ownKeys(value)
    if (
      keys.length !== 2 ||
      !keys.includes('trustedDeliveryContract') ||
      !keys.includes('executePort')
    ) {
      return false
    }
    const trustedDeliveryContractDescriptor =
      Object.getOwnPropertyDescriptor(
        value,
        'trustedDeliveryContract',
      )
    const executePortDescriptor =
      Object.getOwnPropertyDescriptor(value, 'executePort')
    return (
      trustedDeliveryContractDescriptor !== undefined &&
      'value' in trustedDeliveryContractDescriptor &&
      trustedDeliveryContractDescriptor.enumerable === true &&
      executePortDescriptor !== undefined &&
      'value' in executePortDescriptor &&
      executePortDescriptor.enumerable === true &&
      typeof executePortDescriptor.value === 'function'
    )
  } catch {
    return false
  }
}

function sha256Canonical(value: unknown): string {
  return createHash('sha256')
    .update(
      createAiChartD1PalaceWritingCanonicalJson(value),
      'utf8',
    )
    .digest('hex')
}

function commandBase(
  contract:
    AiChartD1PalaceWritingTrustedDeliveryAdapterContract,
): Omit<
  TrustedDeliveryCommandBase,
  'sequence' | 'port'
> {
  return {
    adapterMode: ADAPTER_MODE,
    reportId: contract.reportId,
    reportSnapshotSha256:
      contract.reportSnapshotSha256,
    gateFingerprint: contract.gateFingerprint,
    recordFingerprint: contract.recordFingerprint,
    recordPayloadSha256:
      contract.recordPayloadSha256,
    envelopeFingerprint:
      contract.envelopeFingerprint,
    sourceCoordinationFingerprint:
      contract.sourceCoordinationFingerprint,
    idempotencyKey: contract.idempotencyKey,
    contractFingerprint:
      contract.contractFingerprint,
  }
}

function requireSha256(
  value: unknown,
  failureCode:
    | 'DURABLE_REVIEW_LEDGER_OUTCOME_INVALID'
    | 'REPORT_DELIVERY_CLAIM_OUTCOME_INVALID'
    | 'REPORT_CONTENT_PUBLISH_OUTCOME_INVALID',
): string {
  if (
    typeof value !== 'string' ||
    !SHA256_PATTERN.test(value)
  ) {
    fail(failureCode)
  }
  return value
}

function parseLedgerOutcome(
  value: unknown,
  contract:
    AiChartD1PalaceWritingTrustedDeliveryAdapterContract,
): DurableReviewLedgerOutcome {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(
      value,
      [
        'adapterMode',
        'sequence',
        'port',
        'result',
        'idempotencyKey',
        'contractFingerprint',
        'durableReviewLedgerReceiptFingerprint',
      ],
    )
    if (
      record.adapterMode !== ADAPTER_MODE ||
      record.sequence !== 1 ||
      record.port !==
        'ENSURE_DURABLE_REVIEW_LEDGER' ||
      (
        record.result !== 'CREATED' &&
        record.result !== 'EXISTING_EXACT_MATCH'
      )
    ) {
      fail('DURABLE_REVIEW_LEDGER_OUTCOME_INVALID')
    }
    if (
      record.idempotencyKey !==
        contract.idempotencyKey ||
      record.contractFingerprint !==
        contract.contractFingerprint
    ) {
      fail('IDEMPOTENCY_CONFLICT')
    }
    const durableReviewLedgerReceiptFingerprint =
      requireSha256(
        record.durableReviewLedgerReceiptFingerprint,
        'DURABLE_REVIEW_LEDGER_OUTCOME_INVALID',
      )
    return freezeAiChartD1Value({
      adapterMode: ADAPTER_MODE,
      sequence: 1 as const,
      port:
        'ENSURE_DURABLE_REVIEW_LEDGER' as const,
      result: record.result,
      idempotencyKey: contract.idempotencyKey,
      contractFingerprint:
        contract.contractFingerprint,
      durableReviewLedgerReceiptFingerprint,
    })
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingTrustedDeliveryAdapterProbeError
    ) {
      throw error
    }
    fail('DURABLE_REVIEW_LEDGER_OUTCOME_INVALID')
  }
}

function parseClaimOutcome(
  value: unknown,
  contract:
    AiChartD1PalaceWritingTrustedDeliveryAdapterContract,
  durableReviewLedgerReceiptFingerprint: string,
): ReportDeliveryClaimOutcome {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(
      value,
      [
        'adapterMode',
        'sequence',
        'port',
        'result',
        'idempotencyKey',
        'contractFingerprint',
        'durableReviewLedgerReceiptFingerprint',
        'deliveryClaimFingerprint',
      ],
    )
    if (
      record.adapterMode !== ADAPTER_MODE ||
      record.sequence !== 2 ||
      record.port !==
        'COMPARE_AND_SET_REPORT_DELIVERY_CLAIM' ||
      (
        record.result !== 'CLAIMED' &&
        record.result !== 'EXISTING_EXACT_MATCH'
      )
    ) {
      fail('REPORT_DELIVERY_CLAIM_OUTCOME_INVALID')
    }
    if (
      record.idempotencyKey !==
        contract.idempotencyKey ||
      record.contractFingerprint !==
        contract.contractFingerprint
    ) {
      fail('IDEMPOTENCY_CONFLICT')
    }
    if (
      record.durableReviewLedgerReceiptFingerprint !==
        durableReviewLedgerReceiptFingerprint
    ) {
      fail('REPORT_DELIVERY_CLAIM_OUTCOME_INVALID')
    }
    const deliveryClaimFingerprint =
      requireSha256(
        record.deliveryClaimFingerprint,
        'REPORT_DELIVERY_CLAIM_OUTCOME_INVALID',
      )
    return freezeAiChartD1Value({
      adapterMode: ADAPTER_MODE,
      sequence: 2 as const,
      port:
        'COMPARE_AND_SET_REPORT_DELIVERY_CLAIM' as const,
      result: record.result,
      idempotencyKey: contract.idempotencyKey,
      contractFingerprint:
        contract.contractFingerprint,
      durableReviewLedgerReceiptFingerprint,
      deliveryClaimFingerprint,
    })
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingTrustedDeliveryAdapterProbeError
    ) {
      throw error
    }
    fail('REPORT_DELIVERY_CLAIM_OUTCOME_INVALID')
  }
}

function parsePublishOutcome(
  value: unknown,
  contract:
    AiChartD1PalaceWritingTrustedDeliveryAdapterContract,
  durableReviewLedgerReceiptFingerprint: string,
  deliveryClaimFingerprint: string,
): ReportContentPublishOutcome {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(
      value,
      [
        'adapterMode',
        'sequence',
        'port',
        'result',
        'idempotencyKey',
        'contractFingerprint',
        'durableReviewLedgerReceiptFingerprint',
        'deliveryClaimFingerprint',
        'deliveryReceiptFingerprint',
      ],
    )
    if (
      record.adapterMode !== ADAPTER_MODE ||
      record.sequence !== 3 ||
      record.port !==
        'PUBLISH_SOURCE_BOUND_REPORT_CONTENT' ||
      (
        record.result !== 'PUBLISHED' &&
        record.result !== 'EXISTING_EXACT_MATCH'
      )
    ) {
      fail('REPORT_CONTENT_PUBLISH_OUTCOME_INVALID')
    }
    if (
      record.idempotencyKey !==
        contract.idempotencyKey ||
      record.contractFingerprint !==
        contract.contractFingerprint
    ) {
      fail('IDEMPOTENCY_CONFLICT')
    }
    if (
      record.durableReviewLedgerReceiptFingerprint !==
        durableReviewLedgerReceiptFingerprint ||
      record.deliveryClaimFingerprint !==
        deliveryClaimFingerprint
    ) {
      fail('REPORT_CONTENT_PUBLISH_OUTCOME_INVALID')
    }
    const deliveryReceiptFingerprint =
      requireSha256(
        record.deliveryReceiptFingerprint,
        'REPORT_CONTENT_PUBLISH_OUTCOME_INVALID',
      )
    return freezeAiChartD1Value({
      adapterMode: ADAPTER_MODE,
      sequence: 3 as const,
      port:
        'PUBLISH_SOURCE_BOUND_REPORT_CONTENT' as const,
      result: record.result,
      idempotencyKey: contract.idempotencyKey,
      contractFingerprint:
        contract.contractFingerprint,
      durableReviewLedgerReceiptFingerprint,
      deliveryClaimFingerprint,
      deliveryReceiptFingerprint,
    })
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingTrustedDeliveryAdapterProbeError
    ) {
      throw error
    }
    fail('REPORT_CONTENT_PUBLISH_OUTCOME_INVALID')
  }
}

function classifyReconciliation(
  ledgerResult: DurableReviewLedgerOutcome['result'],
  claimResult: ReportDeliveryClaimOutcome['result'],
  publishResult: ReportContentPublishOutcome['result'],
): Readonly<{
  replayStatus:
    AiChartD1PalaceWritingTrustedDeliveryAdapterProbeResult['replayStatus']
  partialFailureReconciliationStatus:
    AiChartD1PalaceWritingTrustedDeliveryAdapterProbeResult['partialFailureReconciliationStatus']
}> {
  if (
    ledgerResult === 'CREATED' &&
    claimResult === 'CLAIMED' &&
    publishResult === 'PUBLISHED'
  ) {
    return {
      replayStatus: 'NEW_DELIVERY_VERIFIED',
      partialFailureReconciliationStatus:
        'NOT_REQUIRED',
    }
  }
  if (
    ledgerResult === 'EXISTING_EXACT_MATCH' &&
    claimResult === 'EXISTING_EXACT_MATCH' &&
    publishResult === 'EXISTING_EXACT_MATCH'
  ) {
    return {
      replayStatus: 'EXACT_REPLAY_VERIFIED',
      partialFailureReconciliationStatus:
        'EXACT_REPLAY_CONFIRMED',
    }
  }
  if (
    ledgerResult === 'EXISTING_EXACT_MATCH' &&
    publishResult === 'PUBLISHED' &&
    (
      claimResult === 'CLAIMED' ||
      claimResult === 'EXISTING_EXACT_MATCH'
    )
  ) {
    return {
      replayStatus:
        'PARTIAL_FAILURE_RECONCILED',
      partialFailureReconciliationStatus:
        'EARLIER_PORTS_RECONCILED',
    }
  }
  fail('RECONCILIATION_CONFLICT')
}

async function invokePort(
  executePort:
    AiChartD1PalaceWritingTrustedDeliveryAdapterProbePort,
  command:
    AiChartD1PalaceWritingTrustedDeliveryAdapterProbeCommand,
  failureCode:
    | 'DURABLE_REVIEW_LEDGER_PORT_FAILED'
    | 'REPORT_DELIVERY_CLAIM_PORT_FAILED'
    | 'REPORT_CONTENT_PUBLISH_PORT_FAILED',
): Promise<unknown> {
  try {
    return await executePort(command)
  } catch {
    fail(failureCode)
  }
}

export async function probeAiChartD1PalaceWritingTrustedDeliveryAdapter(
  input: Readonly<{
    trustedDeliveryContract: unknown
    executePort:
      AiChartD1PalaceWritingTrustedDeliveryAdapterProbePort
  }>,
): Promise<AiChartD1PalaceWritingTrustedDeliveryAdapterProbeResult> {
  if (
    process.env.NODE_ENV !== 'test' ||
    !isExactProbeInput(input)
  ) {
    fail('TRUSTED_DELIVERY_ADAPTER_PROBE_UNAVAILABLE')
  }

  let contract:
    AiChartD1PalaceWritingTrustedDeliveryAdapterContract
  try {
    contract =
      consumeAiChartD1PalaceWritingTrustedDeliveryAdapterContract(
        input.trustedDeliveryContract,
      )
  } catch {
    fail('TRUSTED_DELIVERY_ADAPTER_PROBE_UNAVAILABLE')
  }

  const base = commandBase(contract)
  const ledgerCommand = freezeAiChartD1Value({
    ...base,
    sequence: 1 as const,
    port:
      'ENSURE_DURABLE_REVIEW_LEDGER' as const,
    durableReviewLedgerPolicy:
      contract.durableReviewLedgerPolicy,
  })
  const ledgerOutcome = parseLedgerOutcome(
    await invokePort(
      input.executePort,
      ledgerCommand,
      'DURABLE_REVIEW_LEDGER_PORT_FAILED',
    ),
    contract,
  )

  const claimCommand = freezeAiChartD1Value({
    ...base,
    sequence: 2 as const,
    port:
      'COMPARE_AND_SET_REPORT_DELIVERY_CLAIM' as const,
    durableReviewLedgerReceiptFingerprint:
      ledgerOutcome.durableReviewLedgerReceiptFingerprint,
    reportCompareAndSetPolicy:
      contract.reportCompareAndSetPolicy,
    reportCompareAndSetExpectedState:
      contract.reportCompareAndSetExpectedState,
  })
  const claimOutcome = parseClaimOutcome(
    await invokePort(
      input.executePort,
      claimCommand,
      'REPORT_DELIVERY_CLAIM_PORT_FAILED',
    ),
    contract,
    ledgerOutcome.durableReviewLedgerReceiptFingerprint,
  )

  const publishCommand = freezeAiChartD1Value({
    ...base,
    sequence: 3 as const,
    port:
      'PUBLISH_SOURCE_BOUND_REPORT_CONTENT' as const,
    durableReviewLedgerReceiptFingerprint:
      ledgerOutcome.durableReviewLedgerReceiptFingerprint,
    deliveryClaimFingerprint:
      claimOutcome.deliveryClaimFingerprint,
    reportContentSourcePolicy:
      contract.reportContentSourcePolicy,
  })
  const publishOutcome = parsePublishOutcome(
    await invokePort(
      input.executePort,
      publishCommand,
      'REPORT_CONTENT_PUBLISH_PORT_FAILED',
    ),
    contract,
    ledgerOutcome.durableReviewLedgerReceiptFingerprint,
    claimOutcome.deliveryClaimFingerprint,
  )

  const reconciliation = classifyReconciliation(
    ledgerOutcome.result,
    claimOutcome.result,
    publishOutcome.result,
  )
  const withoutFingerprint = {
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_ADAPTER_PROBE_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_TRUSTED_DELIVERY_ADAPTER_PROBE_TASK,
    adapterMode: ADAPTER_MODE,
    sourceContractFingerprint:
      contract.contractFingerprint,
    idempotencyKey: contract.idempotencyKey,
    status: 'OFFLINE_PROBE_SUCCEEDED' as const,
    ...reconciliation,
    portResults: [
      {
        sequence: 1 as const,
        port:
          'ENSURE_DURABLE_REVIEW_LEDGER' as const,
        result: ledgerOutcome.result,
        receiptFingerprint:
          ledgerOutcome.durableReviewLedgerReceiptFingerprint,
      },
      {
        sequence: 2 as const,
        port:
          'COMPARE_AND_SET_REPORT_DELIVERY_CLAIM' as const,
        result: claimOutcome.result,
        receiptFingerprint:
          claimOutcome.deliveryClaimFingerprint,
      },
      {
        sequence: 3 as const,
        port:
          'PUBLISH_SOURCE_BOUND_REPORT_CONTENT' as const,
        result: publishOutcome.result,
        receiptFingerprint:
          publishOutcome.deliveryReceiptFingerprint,
      },
    ] as const,
    adapterInvocations: 3 as const,
    actualAdapterWrites: 0 as const,
    durableLedgerWrites: 0 as const,
    reportMutations: 0 as const,
    openAiRequests: 0 as const,
    retryPerformed: false as const,
    customerDeliveryStatus:
      'BLOCKED_OFFLINE_ADAPTER_PROBE_ONLY' as const,
    customerDeliveryAllowed: false as const,
    productionCallable: false as const,
    safeMetadataOnly: true as const,
    nextRequiredAction:
      'IMPLEMENT_PRODUCTION_TRUSTED_DELIVERY_ADAPTER' as const,
  }
  return freezeAiChartD1Value({
    ...withoutFingerprint,
    probeFingerprint:
      sha256Canonical(withoutFingerprint),
  })
}
