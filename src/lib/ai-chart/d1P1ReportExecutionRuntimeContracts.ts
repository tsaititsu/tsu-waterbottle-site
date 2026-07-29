import { createAiChartD1CanonicalSha256 } from './d1CanonicalDigest'
import { freezeAiChartD1Value } from './d1CommonContracts'
import {
  createAiChartD1ReportWriterRuntimeCommandFingerprint,
  prepareAiChartD1ReportWriterRuntimeAdapter,
  type AiChartD1ReportWriterRuntimeCommand,
  type AiChartD1ReportWriterRuntimeP1BridgeDescriptorSummary,
} from './d1ReportWriterRuntimeContracts'
import {
  isAiChartD1P1SourceBoundValidationReasonCode,
  type AiChartD1P1SourceBoundValidationReasonCode,
} from './d1P1SourceBoundDiagnostics'
import {
  AI_CHART_OPENAI_REQUEST_FAILED,
  AI_CHART_OPENAI_RESPONSE_INVALID,
  AiChartOpenAiError,
  type AiChartOpenAiErrorCode,
  type AiChartOpenAiResponseDiagnostic,
  type AiChartOpenAiStructuredResult,
  type AiChartOpenAiTransportDiagnostic,
  type AiChartOpenAiTransportFailureKind,
  type AiChartOpenAiUsage,
} from './openAiResponses'

export const AI_CHART_D1_P1_REPORT_EXECUTION_RUNTIME_PLAN_VERSION =
  'ai-chart-d1-p1-report-execution-runtime-plan/v1' as const
export const AI_CHART_D1_P1_REPORT_EXECUTION_RUNTIME_PLAN_TASK =
  'D1_P1_REPORT_EXECUTION_RUNTIME_PLAN' as const
export const AI_CHART_D1_P1_REPORT_EXECUTION_LEDGER_VERSION =
  'ai-chart-d1-p1-report-execution-ledger/v1' as const
export const AI_CHART_D1_P1_REPORT_EXECUTION_LEDGER_TASK =
  'D1_P1_REPORT_EXECUTION_LEDGER' as const

export type AiChartD1P1ReportExecutionRuntimePlan = Readonly<{
  contractVersion:
    typeof AI_CHART_D1_P1_REPORT_EXECUTION_RUNTIME_PLAN_VERSION
  task: typeof AI_CHART_D1_P1_REPORT_EXECUTION_RUNTIME_PLAN_TASK
  writerRuntimeCommandFingerprint: string
  chartId: string
  sourceSnapshotSha256: string
  targetPalaceCount: 12
  targetPalaceIds: readonly string[]
  executionMode: 'sequential_twelve_palaces'
  maxRequests: 12
  p1AdapterBridgeDescriptorCount: 12
  p1AdapterBridgeDescriptors: readonly AiChartD1ReportWriterRuntimeP1BridgeDescriptorSummary[]
  productionCallable: false
  fetchAllowed: false
  openAiCallable: false
  retryAllowed: false
  fallbackAllowed: false
  customerDeliveryAllowed: false
  safeMetadataOnly: true
}>

export type AiChartD1P1ReportExecutionPalaceLedgerEntry = Readonly<{
  sequenceNumber: number
  targetPalaceId: string
  callId: string
  bridgeFingerprint: string
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED'
  attemptedRequests: 0 | 1
  executedRequests: 0 | 1
  fetchCount: 0 | 1
  openAiRequests: 0 | 1
  retryPerformed: false
  resultFingerprint: string | null
  errorCode: AiChartOpenAiErrorCode | null
  retryable: boolean | null
  responseDiagnostic: AiChartOpenAiResponseDiagnostic | null
  transportDiagnostic: AiChartOpenAiTransportDiagnostic | null
  usage: AiChartOpenAiUsage | null
}>

export type AiChartD1P1ReportExecutionLedger = Readonly<{
  contractVersion: typeof AI_CHART_D1_P1_REPORT_EXECUTION_LEDGER_VERSION
  task: typeof AI_CHART_D1_P1_REPORT_EXECUTION_LEDGER_TASK
  planFingerprint: string
  status: 'READY' | 'SUCCEEDED' | 'FAILED'
  currentPalaceId: string | null
  palaceExecutionCount: 12
  palaceExecutions: readonly AiChartD1P1ReportExecutionPalaceLedgerEntry[]
  attemptedRequests: number
  executedRequests: number
  fetchCount: number
  openAiRequests: number
  retryPerformed: false
  safeMetadataOnly: true
  customerDeliveryAllowed: false
}>

export type AiChartD1P1ReportExecutionRuntimeExecutor = (
  descriptor: AiChartD1ReportWriterRuntimeP1BridgeDescriptorSummary,
  index: number,
) => Promise<AiChartOpenAiStructuredResult<unknown>>

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const SAFE_DIAGNOSTIC_TOKEN = /^[A-Za-z0-9_.:-]{1,80}$/u
const DIAGNOSTIC_ITEM_LIMIT = 32
const SAFE_OUTPUT_ITEM_TYPES = new Set<unknown>([
  'reasoning',
  'message',
  'invalid',
])
const SAFE_CONTENT_ITEM_TYPES = new Set<unknown>([
  'output_text',
  'refusal',
  'invalid',
])
const TRANSPORT_FAILURE_KINDS = new Set<unknown>([
  'HTTP_ERROR',
  'NETWORK_ERROR',
  'TIMEOUT',
  'RESPONSE_BODY_INVALID',
])

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function sanitizeDiagnosticToken(value: unknown): string | null {
  return typeof value === 'string' && SAFE_DIAGNOSTIC_TOKEN.test(value)
    ? value
    : null
}

function sanitizeDiagnosticItemTypes(
  value: unknown,
  allowedTypes: ReadonlySet<unknown>,
): readonly string[] {
  if (!Array.isArray(value)) return Object.freeze([])
  return Object.freeze(
    value
      .slice(0, DIAGNOSTIC_ITEM_LIMIT)
      .map((item) =>
        typeof item === 'string' && allowedTypes.has(item)
          ? item
          : 'invalid',
      ),
  )
}

function normalizeUsage(value: unknown): AiChartOpenAiUsage | null {
  if (!isPlainObject(value)) return null
  return freezeAiChartD1Value({
    inputTokens: normalizeUsageInteger(value.inputTokens),
    outputTokens: normalizeUsageInteger(value.outputTokens),
    reasoningTokens: normalizeUsageInteger(value.reasoningTokens),
    totalTokens: normalizeUsageInteger(value.totalTokens),
  })
}

function normalizeUsageInteger(value: unknown): number {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : 0
}

function normalizeResponseDiagnostic(
  value: unknown,
): AiChartOpenAiResponseDiagnostic | null {
  if (!isPlainObject(value)) return null

  const outputSchemaValidationCode =
    isAiChartD1P1SourceBoundValidationReasonCode(
      value.outputSchemaValidationCode,
    )
      ? (value.outputSchemaValidationCode as AiChartD1P1SourceBoundValidationReasonCode)
      : null

  return freezeAiChartD1Value({
    responseStatus: sanitizeDiagnosticToken(value.responseStatus),
    incompleteReason: sanitizeDiagnosticToken(value.incompleteReason),
    responseErrorCode: sanitizeDiagnosticToken(value.responseErrorCode),
    outputItemTypes: sanitizeDiagnosticItemTypes(
      value.outputItemTypes,
      SAFE_OUTPUT_ITEM_TYPES,
    ),
    contentItemTypes: sanitizeDiagnosticItemTypes(
      value.contentItemTypes,
      SAFE_CONTENT_ITEM_TYPES,
    ),
    outputTextCount:
      typeof value.outputTextCount === 'number' &&
      Number.isSafeInteger(value.outputTextCount) &&
      value.outputTextCount >= 0
        ? value.outputTextCount
        : 0,
    outputSchemaValidationCode,
    usage: normalizeUsage(value.usage),
  })
}

function normalizeTransportDiagnostic(
  value: unknown,
): AiChartOpenAiTransportDiagnostic | null {
  if (!isPlainObject(value)) return null
  const failureKind = value.failureKind
  if (!TRANSPORT_FAILURE_KINDS.has(failureKind)) return null

  const httpStatus = value.httpStatus
  if (
    !(
      httpStatus === null ||
      (typeof httpStatus === 'number' &&
        Number.isInteger(httpStatus) &&
        httpStatus >= 100 &&
        httpStatus <= 599)
    )
  ) {
    return null
  }

  const clientRequestId = sanitizeDiagnosticToken(value.clientRequestId)
  if (clientRequestId === null) return null

  return freezeAiChartD1Value({
    failureKind: failureKind as AiChartOpenAiTransportFailureKind,
    httpStatus,
    requestId: sanitizeDiagnosticToken(value.requestId),
    clientRequestId,
    responseErrorType: sanitizeDiagnosticToken(value.responseErrorType),
    responseErrorCode: sanitizeDiagnosticToken(value.responseErrorCode),
    responseErrorParam: sanitizeDiagnosticToken(value.responseErrorParam),
  })
}

function assertSha256(value: string, fieldName: string) {
  if (!SHA256_PATTERN.test(value)) {
    throw new Error(`${fieldName}_must_be_sha256`)
  }
}

export function buildAiChartD1P1ReportExecutionPlan(
  command: AiChartD1ReportWriterRuntimeCommand,
): AiChartD1P1ReportExecutionRuntimePlan {
  const adapterResult =
    prepareAiChartD1ReportWriterRuntimeAdapter(command)
  const writerRuntimeCommandFingerprint =
    createAiChartD1ReportWriterRuntimeCommandFingerprint(command)
  assertSha256(
    writerRuntimeCommandFingerprint,
    'writerRuntimeCommandFingerprint',
  )

  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_P1_REPORT_EXECUTION_RUNTIME_PLAN_VERSION,
    task: AI_CHART_D1_P1_REPORT_EXECUTION_RUNTIME_PLAN_TASK,
    writerRuntimeCommandFingerprint,
    chartId: adapterResult.chartId,
    sourceSnapshotSha256: adapterResult.sourceSnapshotSha256,
    targetPalaceCount: 12 as const,
    targetPalaceIds: freezeAiChartD1Value([
      ...adapterResult.targetPalaceIds,
    ]),
    executionMode: 'sequential_twelve_palaces' as const,
    maxRequests: 12 as const,
    p1AdapterBridgeDescriptorCount: 12 as const,
    p1AdapterBridgeDescriptors:
      adapterResult.p1AdapterBridgeDescriptors,
    productionCallable: false as const,
    fetchAllowed: false as const,
    openAiCallable: false as const,
    retryAllowed: false as const,
    fallbackAllowed: false as const,
    customerDeliveryAllowed: false as const,
    safeMetadataOnly: true as const,
  })
}

export function createAiChartD1P1ReportExecutionPlanFingerprint(
  plan: AiChartD1P1ReportExecutionRuntimePlan,
): string {
  return createAiChartD1CanonicalSha256(plan)
}

function createPendingEntry(
  descriptor: AiChartD1ReportWriterRuntimeP1BridgeDescriptorSummary,
  index: number,
): AiChartD1P1ReportExecutionPalaceLedgerEntry {
  return freezeAiChartD1Value({
    sequenceNumber: index + 1,
    targetPalaceId: descriptor.targetPalaceId,
    callId: descriptor.callId,
    bridgeFingerprint: descriptor.bridgeFingerprint,
    status: 'PENDING' as const,
    attemptedRequests: 0 as const,
    executedRequests: 0 as const,
    fetchCount: 0 as const,
    openAiRequests: 0 as const,
    retryPerformed: false as const,
    resultFingerprint: null,
    errorCode: null,
    retryable: null,
    responseDiagnostic: null,
    transportDiagnostic: null,
    usage: null,
  })
}

function buildLedger(
  plan: AiChartD1P1ReportExecutionRuntimePlan,
  input: Readonly<{
    status: 'READY' | 'SUCCEEDED' | 'FAILED'
    currentPalaceId: string | null
    palaceExecutions: readonly AiChartD1P1ReportExecutionPalaceLedgerEntry[]
  }>,
): AiChartD1P1ReportExecutionLedger {
  const attemptedRequests = input.palaceExecutions.reduce(
    (sum, entry) => sum + entry.attemptedRequests,
    0,
  )
  const executedRequests = input.palaceExecutions.reduce(
    (sum, entry) => sum + entry.executedRequests,
    0,
  )
  const fetchCount = input.palaceExecutions.reduce(
    (sum, entry) => sum + entry.fetchCount,
    0,
  )

  return freezeAiChartD1Value({
    contractVersion: AI_CHART_D1_P1_REPORT_EXECUTION_LEDGER_VERSION,
    task: AI_CHART_D1_P1_REPORT_EXECUTION_LEDGER_TASK,
    planFingerprint:
      createAiChartD1P1ReportExecutionPlanFingerprint(plan),
    status: input.status,
    currentPalaceId: input.currentPalaceId,
    palaceExecutionCount: 12 as const,
    palaceExecutions: freezeAiChartD1Value([
      ...input.palaceExecutions,
    ]),
    attemptedRequests,
    executedRequests,
    fetchCount,
    openAiRequests: fetchCount,
    retryPerformed: false as const,
    safeMetadataOnly: true as const,
    customerDeliveryAllowed: false as const,
  })
}

export function createAiChartD1P1ReportExecutionLedger(
  plan: AiChartD1P1ReportExecutionRuntimePlan,
): AiChartD1P1ReportExecutionLedger {
  return buildLedger(plan, {
    status: 'READY',
    currentPalaceId: null,
    palaceExecutions:
      plan.p1AdapterBridgeDescriptors.map(createPendingEntry),
  })
}

function createSuccessEntry(
  entry: AiChartD1P1ReportExecutionPalaceLedgerEntry,
  result: AiChartOpenAiStructuredResult<unknown>,
): AiChartD1P1ReportExecutionPalaceLedgerEntry {
  return freezeAiChartD1Value({
    ...entry,
    status: 'SUCCEEDED' as const,
    attemptedRequests: 1 as const,
    executedRequests: 1 as const,
    fetchCount: 1 as const,
    openAiRequests: 1 as const,
    resultFingerprint: createAiChartD1CanonicalSha256(result.data),
    usage: normalizeUsage(result.usage),
  })
}

function createFailureEntry(
  entry: AiChartD1P1ReportExecutionPalaceLedgerEntry,
  error: unknown,
): AiChartD1P1ReportExecutionPalaceLedgerEntry {
  if (error instanceof AiChartOpenAiError) {
    const responseDiagnostic = normalizeResponseDiagnostic(error.diagnostic)
    return freezeAiChartD1Value({
      ...entry,
      status: 'FAILED' as const,
      attemptedRequests: 1 as const,
      executedRequests: 0 as const,
      fetchCount: 1 as const,
      openAiRequests: 1 as const,
      errorCode: error.code,
      retryable: error.retryable,
      responseDiagnostic,
      transportDiagnostic: normalizeTransportDiagnostic(
        error.transportDiagnostic,
      ),
      usage: responseDiagnostic?.usage ?? null,
    })
  }

  return freezeAiChartD1Value({
    ...entry,
    status: 'FAILED' as const,
    attemptedRequests: 1 as const,
    executedRequests: 0 as const,
    fetchCount: 1 as const,
    openAiRequests: 1 as const,
    errorCode:
      error instanceof Error
        ? AI_CHART_OPENAI_RESPONSE_INVALID
        : AI_CHART_OPENAI_REQUEST_FAILED,
    retryable: false,
  })
}

export async function runAiChartD1P1ReportExecutionRuntime(
  plan: AiChartD1P1ReportExecutionRuntimePlan,
  executor: AiChartD1P1ReportExecutionRuntimeExecutor,
): Promise<AiChartD1P1ReportExecutionLedger> {
  const palaceExecutions =
    plan.p1AdapterBridgeDescriptors.map(createPendingEntry)

  for (
    let index = 0;
    index < plan.p1AdapterBridgeDescriptors.length;
    index += 1
  ) {
    const descriptor = plan.p1AdapterBridgeDescriptors[index]
    try {
      palaceExecutions[index] = createSuccessEntry(
        palaceExecutions[index],
        await executor(descriptor, index),
      )
    } catch (error) {
      palaceExecutions[index] = createFailureEntry(
        palaceExecutions[index],
        error,
      )
      return buildLedger(plan, {
        status: 'FAILED',
        currentPalaceId: descriptor.targetPalaceId,
        palaceExecutions,
      })
    }
  }

  return buildLedger(plan, {
    status: 'SUCCEEDED',
    currentPalaceId: null,
    palaceExecutions,
  })
}
