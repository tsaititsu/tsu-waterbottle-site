import { createAiChartD1CanonicalSha256 } from './d1CanonicalDigest'
import { freezeAiChartD1Value } from './d1CommonContracts'
import { AI_CHART_D1_PALACE_IDENTITIES } from './d1N0Constants'
import { AI_CHART_D1_P1_MAX_OUTPUT_TOKENS } from './d1P1AdapterBridgeContracts'
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
  AI_CHART_OPENAI_CONFIG_INVALID,
  AI_CHART_OPENAI_OUTPUT_JSON_INVALID,
  AI_CHART_OPENAI_OUTPUT_MISSING,
  AI_CHART_OPENAI_OUTPUT_SCHEMA_INVALID,
  AI_CHART_OPENAI_REQUEST_FAILED,
  AI_CHART_OPENAI_RESPONSE_INCOMPLETE,
  AI_CHART_OPENAI_RESPONSE_INVALID,
  AI_CHART_OPENAI_RESPONSE_REFUSED,
  AI_CHART_OPENAI_TIMEOUT,
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
export const AI_CHART_D1_P1_REPORT_EXECUTION_PLAN_INVALID =
  'ai_chart_d1_p1_report_execution_plan_invalid' as const

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

export type AiChartD1P1ReportExecutionPalaceSettlement =
  | Readonly<{
      status: 'SUCCEEDED'
      sequenceNumber: number
      targetPalaceId: string
      bridgeFingerprint: string
      result: unknown
      resultFingerprint: string
      usage: AiChartOpenAiUsage | null
    }>
  | Readonly<{
      status: 'FAILED'
      sequenceNumber: number
      targetPalaceId: string
      bridgeFingerprint: string
      result: null
      errorCode: AiChartOpenAiErrorCode
      retryable: boolean
      responseDiagnostic: AiChartOpenAiResponseDiagnostic | null
      transportDiagnostic: AiChartOpenAiTransportDiagnostic | null
      usage: AiChartOpenAiUsage | null
    }>

export type AiChartD1P1ReportExecutionRuntimeOptions = Readonly<{
  onPalaceSettled?: (
    settlement: AiChartD1P1ReportExecutionPalaceSettlement,
  ) => void | Promise<void>
}>

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
const SAFE_OPENAI_ERROR_CODES = new Set<unknown>([
  AI_CHART_OPENAI_CONFIG_INVALID,
  AI_CHART_OPENAI_REQUEST_FAILED,
  AI_CHART_OPENAI_TIMEOUT,
  AI_CHART_OPENAI_RESPONSE_INCOMPLETE,
  AI_CHART_OPENAI_RESPONSE_REFUSED,
  AI_CHART_OPENAI_OUTPUT_MISSING,
  AI_CHART_OPENAI_OUTPUT_JSON_INVALID,
  AI_CHART_OPENAI_OUTPUT_SCHEMA_INVALID,
  AI_CHART_OPENAI_RESPONSE_INVALID,
])
const TRANSPORT_FAILURE_KINDS = new Set<unknown>([
  'HTTP_ERROR',
  'NETWORK_ERROR',
  'TIMEOUT',
  'RESPONSE_BODY_INVALID',
])
const RUNTIME_PLAN_FIELDS = Object.freeze([
  'contractVersion',
  'task',
  'writerRuntimeCommandFingerprint',
  'chartId',
  'sourceSnapshotSha256',
  'targetPalaceCount',
  'targetPalaceIds',
  'executionMode',
  'maxRequests',
  'p1AdapterBridgeDescriptorCount',
  'p1AdapterBridgeDescriptors',
  'productionCallable',
  'fetchAllowed',
  'openAiCallable',
  'retryAllowed',
  'fallbackAllowed',
  'customerDeliveryAllowed',
  'safeMetadataOnly',
] as const)
const RUNTIME_DESCRIPTOR_FIELDS = Object.freeze([
  'targetPalaceId',
  'callId',
  'bridgeFingerprint',
  'packageFingerprint',
  'modelInputFingerprint',
  'outputSchemaSha256',
  'reasoningEffort',
  'timeoutMs',
  'maxOutputTokens',
  'requestStatus',
  'runtimeStatus',
  'openAiCallable',
] as const)
const CANONICAL_PALACE_IDS = Object.freeze(
  AI_CHART_D1_PALACE_IDENTITIES.map((identity) => identity.palaceId),
)

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasExactEnumerableDataKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
) {
  const keys = Reflect.ownKeys(value)
  return (
    keys.length === expectedKeys.length &&
    keys.every(
      (key) =>
        typeof key === 'string' && expectedKeys.includes(key),
    ) &&
    expectedKeys.every((key) => {
      const descriptor =
        Object.getOwnPropertyDescriptor(value, key)
      return (
        descriptor !== undefined &&
        descriptor.enumerable &&
        Object.hasOwn(descriptor, 'value')
      )
    })
  )
}

function sanitizeDiagnosticToken(value: unknown): string | null {
  return typeof value === 'string' && SAFE_DIAGNOSTIC_TOKEN.test(value)
    ? value
    : null
}

function normalizeOpenAiErrorCode(
  value: unknown,
): AiChartOpenAiErrorCode {
  return SAFE_OPENAI_ERROR_CODES.has(value)
    ? (value as AiChartOpenAiErrorCode)
    : AI_CHART_OPENAI_RESPONSE_INVALID
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

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && SHA256_PATTERN.test(value)
}

function assertValidRuntimeDescriptor(
  value: unknown,
  targetPalaceId: string,
) {
  if (
    !isPlainObject(value) ||
    !hasExactEnumerableDataKeys(value, RUNTIME_DESCRIPTOR_FIELDS) ||
    value.targetPalaceId !== targetPalaceId ||
    typeof value.callId !== 'string' ||
    value.callId.trim().length === 0 ||
    !isSha256(value.bridgeFingerprint) ||
    !isSha256(value.packageFingerprint) ||
    !isSha256(value.modelInputFingerprint) ||
    !isSha256(value.outputSchemaSha256) ||
    typeof value.reasoningEffort !== 'string' ||
    value.reasoningEffort.trim().length === 0 ||
    typeof value.timeoutMs !== 'number' ||
    !Number.isSafeInteger(value.timeoutMs) ||
    value.timeoutMs <= 0 ||
    value.maxOutputTokens !== AI_CHART_D1_P1_MAX_OUTPUT_TOKENS ||
    value.requestStatus !== 'ready' ||
    value.runtimeStatus !== 'runtime_wiring_required' ||
    value.openAiCallable !== false
  ) {
    throw new Error(AI_CHART_D1_P1_REPORT_EXECUTION_PLAN_INVALID)
  }
}

function assertValidRuntimePlan(
  plan: AiChartD1P1ReportExecutionRuntimePlan,
) {
  if (
    !isPlainObject(plan) ||
    !hasExactEnumerableDataKeys(plan, RUNTIME_PLAN_FIELDS) ||
    plan.contractVersion !==
      AI_CHART_D1_P1_REPORT_EXECUTION_RUNTIME_PLAN_VERSION ||
    plan.task !== AI_CHART_D1_P1_REPORT_EXECUTION_RUNTIME_PLAN_TASK ||
    !isSha256(plan.writerRuntimeCommandFingerprint) ||
    typeof plan.chartId !== 'string' ||
    plan.chartId.trim().length === 0 ||
    !isSha256(plan.sourceSnapshotSha256) ||
    plan.targetPalaceCount !== 12 ||
    !Array.isArray(plan.targetPalaceIds) ||
    plan.targetPalaceIds.length !== 12 ||
    plan.executionMode !== 'sequential_twelve_palaces' ||
    plan.maxRequests !== 12 ||
    plan.p1AdapterBridgeDescriptorCount !== 12 ||
    !Array.isArray(plan.p1AdapterBridgeDescriptors) ||
    plan.p1AdapterBridgeDescriptors.length !== 12 ||
    plan.productionCallable !== false ||
    plan.fetchAllowed !== false ||
    plan.openAiCallable !== false ||
    plan.retryAllowed !== false ||
    plan.fallbackAllowed !== false ||
    plan.customerDeliveryAllowed !== false ||
    plan.safeMetadataOnly !== true
  ) {
    throw new Error(AI_CHART_D1_P1_REPORT_EXECUTION_PLAN_INVALID)
  }

  CANONICAL_PALACE_IDS.forEach((palaceId, index) => {
    if (plan.targetPalaceIds[index] !== palaceId) {
      throw new Error(AI_CHART_D1_P1_REPORT_EXECUTION_PLAN_INVALID)
    }
    assertValidRuntimeDescriptor(
      plan.p1AdapterBridgeDescriptors[index],
      palaceId,
    )
  })
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
  assertValidRuntimePlan(plan)
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
  error: AiChartOpenAiError,
): AiChartD1P1ReportExecutionPalaceLedgerEntry {
  const errorCode = normalizeOpenAiErrorCode(error.code)
  const responseDiagnostic = normalizeResponseDiagnostic(error.diagnostic)
  return freezeAiChartD1Value({
    ...entry,
    status: 'FAILED' as const,
    attemptedRequests: 1 as const,
    executedRequests: 0 as const,
    fetchCount: 1 as const,
    openAiRequests: 1 as const,
    errorCode,
    retryable:
      errorCode === error.code ? error.retryable : false,
    responseDiagnostic,
    transportDiagnostic: normalizeTransportDiagnostic(
      error.transportDiagnostic,
    ),
    usage: responseDiagnostic?.usage ?? null,
  })
}

function createSuccessSettlement(
  entry: AiChartD1P1ReportExecutionPalaceLedgerEntry,
  result: AiChartOpenAiStructuredResult<unknown>,
): AiChartD1P1ReportExecutionPalaceSettlement {
  if (
    entry.status !== 'SUCCEEDED' ||
    entry.resultFingerprint === null
  ) {
    throw new Error(
      AI_CHART_D1_P1_REPORT_EXECUTION_PLAN_INVALID,
    )
  }

  return freezeAiChartD1Value({
    status: 'SUCCEEDED' as const,
    sequenceNumber: entry.sequenceNumber,
    targetPalaceId: entry.targetPalaceId,
    bridgeFingerprint: entry.bridgeFingerprint,
    result: result.data,
    resultFingerprint: entry.resultFingerprint,
    usage: entry.usage,
  })
}

function createFailureSettlement(
  entry: AiChartD1P1ReportExecutionPalaceLedgerEntry,
): AiChartD1P1ReportExecutionPalaceSettlement {
  if (
    entry.status !== 'FAILED' ||
    entry.errorCode === null ||
    entry.retryable === null
  ) {
    throw new Error(
      AI_CHART_D1_P1_REPORT_EXECUTION_PLAN_INVALID,
    )
  }

  return freezeAiChartD1Value({
    status: 'FAILED' as const,
    sequenceNumber: entry.sequenceNumber,
    targetPalaceId: entry.targetPalaceId,
    bridgeFingerprint: entry.bridgeFingerprint,
    result: null,
    errorCode: entry.errorCode,
    retryable: entry.retryable,
    responseDiagnostic: entry.responseDiagnostic,
    transportDiagnostic: entry.transportDiagnostic,
    usage: entry.usage,
  })
}

export async function runAiChartD1P1ReportExecutionRuntime(
  plan: AiChartD1P1ReportExecutionRuntimePlan,
  executor: AiChartD1P1ReportExecutionRuntimeExecutor,
  options: AiChartD1P1ReportExecutionRuntimeOptions = {},
): Promise<AiChartD1P1ReportExecutionLedger> {
  assertValidRuntimePlan(plan)
  const palaceExecutions =
    plan.p1AdapterBridgeDescriptors.map(createPendingEntry)
  let firstFailedPalaceId: string | null = null

  for (
    let index = 0;
    index < plan.p1AdapterBridgeDescriptors.length;
    index += 1
  ) {
    const descriptor = plan.p1AdapterBridgeDescriptors[index]
    let result: AiChartOpenAiStructuredResult<unknown>
    try {
      result = await executor(descriptor, index)
    } catch (error) {
      if (!(error instanceof AiChartOpenAiError)) {
        throw error
      }
      const entry = createFailureEntry(
        palaceExecutions[index],
        error,
      )
      palaceExecutions[index] = entry
      firstFailedPalaceId ??= descriptor.targetPalaceId
      await options.onPalaceSettled?.(
        createFailureSettlement(entry),
      )
      continue
    }

    const entry = createSuccessEntry(
      palaceExecutions[index],
      result,
    )
    palaceExecutions[index] = entry
    await options.onPalaceSettled?.(
      createSuccessSettlement(entry, result),
    )
  }

  return buildLedger(plan, {
    status:
      firstFailedPalaceId === null ? 'SUCCEEDED' : 'FAILED',
    currentPalaceId: firstFailedPalaceId,
    palaceExecutions,
  })
}
