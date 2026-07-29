import { freezeAiChartD1Value } from './d1CommonContracts'
import { createAiChartD1CanonicalSha256 } from './d1CanonicalDigest'
import {
  AI_CHART_D1_P1_MAX_OUTPUT_TOKENS,
  type AiChartD1P1AdapterBridgeDescriptor,
} from './d1P1AdapterBridgeContracts'

export const AI_CHART_D1_REPORT_WRITER_RUNTIME_COMMAND_VERSION =
  'ai-chart-d1-report-writer-runtime-command/v1' as const
export const AI_CHART_D1_REPORT_WRITER_RUNTIME_COMMAND_TASK =
  'D1_REPORT_WRITER_RUNTIME_COMMAND' as const
export const AI_CHART_D1_REPORT_WRITER_RUNTIME_ADAPTER_VERSION =
  'ai-chart-d1-report-writer-runtime-adapter/v1' as const
export const AI_CHART_D1_REPORT_WRITER_RUNTIME_ADAPTER_TASK =
  'D1_REPORT_WRITER_RUNTIME_ADAPTER' as const
export const AI_CHART_D1_REPORT_WRITER_RUNTIME_ADAPTER_NOT_IMPLEMENTED =
  'AI_CHART_D1_REPORT_WRITER_RUNTIME_ADAPTER_NOT_IMPLEMENTED' as const
export const AI_CHART_D1_REPORT_WRITER_RUNTIME_MODEL_EXECUTION_REQUIRED =
  'AI_CHART_D1_REPORT_WRITER_RUNTIME_MODEL_EXECUTION_REQUIRED' as const

export type AiChartD1ReportWriterRuntimeP1BridgeDescriptorSummary =
  Readonly<{
    targetPalaceId: string
    callId: string
    bridgeFingerprint: string
    packageFingerprint: string
    modelInputFingerprint: string
    outputSchemaSha256: string
    reasoningEffort: string
    timeoutMs: number
    maxOutputTokens: typeof AI_CHART_D1_P1_MAX_OUTPUT_TOKENS
    requestStatus: 'ready'
    runtimeStatus: 'runtime_wiring_required'
    openAiCallable: false
  }>

export type AiChartD1ReportWriterRuntimeCommand = Readonly<{
  contractVersion:
    typeof AI_CHART_D1_REPORT_WRITER_RUNTIME_COMMAND_VERSION
  task: typeof AI_CHART_D1_REPORT_WRITER_RUNTIME_COMMAND_TASK
  pipelineVersion: string
  chartId: string
  sourceSnapshotSha256: string
  expectedPalaceCount: 12
  targetPalaceIds: readonly string[]
  runtimeMode: 'PRODUCTION_REPORT_WRITER'
  runtimeStatus: 'D1_P1_ADAPTER_BRIDGES_PREPARED'
  nextRequiredAction:
    'EXECUTE_D1_P1_MODEL_REQUESTS_WITH_EXPLICIT_AUTHORIZATION'
  p1AdapterBridgeDescriptorCount: 12
  p1AdapterBridgeDescriptors: readonly AiChartD1ReportWriterRuntimeP1BridgeDescriptorSummary[]
  productionCallable: false
  fetchAllowed: false
  openAiCallable: false
  attemptedRequests: 0
  executedRequests: 0
  fetchCount: 0
  openAiRequests: 0
  retryPerformed: false
  customerDeliveryAllowed: false
  safeMetadataOnly: true
}>

export type AiChartD1ReportWriterRuntimeAdapterResult =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_REPORT_WRITER_RUNTIME_ADAPTER_VERSION
    task: typeof AI_CHART_D1_REPORT_WRITER_RUNTIME_ADAPTER_TASK
    status: 'BLOCKED_D1_P1_MODEL_EXECUTION_REQUIRED'
    stage: 'D1_P1_ADAPTER_BRIDGES_PREPARED'
    commandFingerprint: string
    chartId: string
    sourceSnapshotSha256: string
    targetPalaceCount: 12
    targetPalaceIds: readonly string[]
    p1AdapterBridgeDescriptorCount: 12
    p1AdapterBridgeDescriptors: readonly AiChartD1ReportWriterRuntimeP1BridgeDescriptorSummary[]
    runtimeStatus: 'D1_P1_MODEL_EXECUTION_REQUIRED'
    error:
      typeof AI_CHART_D1_REPORT_WRITER_RUNTIME_MODEL_EXECUTION_REQUIRED
    nextRequiredAction:
      'EXECUTE_D1_P1_MODEL_REQUESTS_WITH_EXPLICIT_AUTHORIZATION'
    reportContentStatus: 'BLOCKED_PENDING_D1_P1_MODEL_OUTPUTS'
    productionCallable: false
    fetchAllowed: false
    openAiCallable: false
    attemptedRequests: 0
    executedRequests: 0
    fetchCount: 0
    openAiRequests: 0
    retryPerformed: false
    customerDeliveryAllowed: false
    safeMetadataOnly: true
  }>

const AI_CHART_D1_REPORT_WRITER_RUNTIME_COMMAND_FIELDS =
  Object.freeze([
    'contractVersion',
    'task',
    'pipelineVersion',
    'chartId',
    'sourceSnapshotSha256',
    'expectedPalaceCount',
    'targetPalaceIds',
    'runtimeMode',
    'runtimeStatus',
    'nextRequiredAction',
    'p1AdapterBridgeDescriptorCount',
    'p1AdapterBridgeDescriptors',
    'productionCallable',
    'fetchAllowed',
    'openAiCallable',
    'attemptedRequests',
    'executedRequests',
    'fetchCount',
    'openAiRequests',
    'retryPerformed',
    'customerDeliveryAllowed',
    'safeMetadataOnly',
  ] as const)

const AI_CHART_D1_REPORT_WRITER_RUNTIME_P1_BRIDGE_DESCRIPTOR_FIELDS =
  Object.freeze([
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

const SHA256_PATTERN = /^[a-f0-9]{64}$/u

function assertNonBlankText(value: string, fieldName: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldName}_must_not_be_blank`)
  }
}

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false
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

function assertSha256(value: string, fieldName: string) {
  if (!SHA256_PATTERN.test(value)) {
    throw new Error(`${fieldName}_must_be_sha256`)
  }
}

function parseP1BridgeDescriptorSummary(
  value: unknown,
  targetPalaceId: string,
): AiChartD1ReportWriterRuntimeP1BridgeDescriptorSummary {
  if (
    !isPlainObject(value) ||
    !hasExactEnumerableDataKeys(
      value,
      AI_CHART_D1_REPORT_WRITER_RUNTIME_P1_BRIDGE_DESCRIPTOR_FIELDS,
    ) ||
    typeof value.targetPalaceId !== 'string' ||
    value.targetPalaceId !== targetPalaceId ||
    typeof value.callId !== 'string' ||
    value.callId.trim().length === 0 ||
    typeof value.bridgeFingerprint !== 'string' ||
    typeof value.packageFingerprint !== 'string' ||
    typeof value.modelInputFingerprint !== 'string' ||
    typeof value.outputSchemaSha256 !== 'string' ||
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
    throw new Error(
      AI_CHART_D1_REPORT_WRITER_RUNTIME_ADAPTER_NOT_IMPLEMENTED,
    )
  }

  assertSha256(value.bridgeFingerprint, 'bridgeFingerprint')
  assertSha256(value.packageFingerprint, 'packageFingerprint')
  assertSha256(value.modelInputFingerprint, 'modelInputFingerprint')
  assertSha256(value.outputSchemaSha256, 'outputSchemaSha256')

  return freezeAiChartD1Value({
    targetPalaceId: value.targetPalaceId,
    callId: value.callId,
    bridgeFingerprint: value.bridgeFingerprint,
    packageFingerprint: value.packageFingerprint,
    modelInputFingerprint: value.modelInputFingerprint,
    outputSchemaSha256: value.outputSchemaSha256,
    reasoningEffort: value.reasoningEffort,
    timeoutMs: value.timeoutMs,
    maxOutputTokens: AI_CHART_D1_P1_MAX_OUTPUT_TOKENS,
    requestStatus: 'ready' as const,
    runtimeStatus: 'runtime_wiring_required' as const,
    openAiCallable: false as const,
  })
}

export function summarizeAiChartD1P1AdapterBridgeDescriptors(
  descriptors: readonly AiChartD1P1AdapterBridgeDescriptor[],
): readonly AiChartD1ReportWriterRuntimeP1BridgeDescriptorSummary[] {
  if (descriptors.length !== 12) {
    throw new Error('p1AdapterBridgeDescriptors_must_contain_12_palaces')
  }

  return freezeAiChartD1Value(
    descriptors.map((descriptor) =>
      freezeAiChartD1Value({
        targetPalaceId: descriptor.targetPalaceId,
        callId: descriptor.callId,
        bridgeFingerprint: descriptor.bridgeFingerprint,
        packageFingerprint: descriptor.packageFingerprint,
        modelInputFingerprint: descriptor.modelInputFingerprint,
        outputSchemaSha256: descriptor.outputSchemaSha256,
        reasoningEffort: descriptor.reasoningEffort,
        timeoutMs: descriptor.timeoutMs,
        maxOutputTokens: AI_CHART_D1_P1_MAX_OUTPUT_TOKENS,
        requestStatus: 'ready' as const,
        runtimeStatus: 'runtime_wiring_required' as const,
        openAiCallable: false as const,
      }),
    ),
  )
}

export function buildAiChartD1ReportWriterRuntimeCommand(
  input: Readonly<{
    pipelineVersion: string
    chartId: string
    sourceSnapshotSha256: string
    targetPalaceIds: readonly string[]
    p1AdapterBridgeDescriptors: readonly AiChartD1ReportWriterRuntimeP1BridgeDescriptorSummary[]
  }>,
): AiChartD1ReportWriterRuntimeCommand {
  assertNonBlankText(input.pipelineVersion, 'pipelineVersion')
  assertNonBlankText(input.chartId, 'chartId')
  assertNonBlankText(
    input.sourceSnapshotSha256,
    'sourceSnapshotSha256',
  )

  if (input.targetPalaceIds.length !== 12) {
    throw new Error('targetPalaceIds_must_contain_12_palaces')
  }
  if (input.p1AdapterBridgeDescriptors.length !== 12) {
    throw new Error(
      'p1AdapterBridgeDescriptors_must_contain_12_palaces',
    )
  }

  const p1AdapterBridgeDescriptors = freezeAiChartD1Value(
    input.p1AdapterBridgeDescriptors.map((descriptor, index) =>
      parseP1BridgeDescriptorSummary(
        descriptor,
        input.targetPalaceIds[index],
      ),
    ),
  )

  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_REPORT_WRITER_RUNTIME_COMMAND_VERSION,
    task: AI_CHART_D1_REPORT_WRITER_RUNTIME_COMMAND_TASK,
    pipelineVersion: input.pipelineVersion,
    chartId: input.chartId,
    sourceSnapshotSha256: input.sourceSnapshotSha256,
    expectedPalaceCount: 12 as const,
    targetPalaceIds: freezeAiChartD1Value([
      ...input.targetPalaceIds,
    ]),
    runtimeMode: 'PRODUCTION_REPORT_WRITER' as const,
    runtimeStatus:
      'D1_P1_ADAPTER_BRIDGES_PREPARED' as const,
    nextRequiredAction:
      'EXECUTE_D1_P1_MODEL_REQUESTS_WITH_EXPLICIT_AUTHORIZATION' as const,
    p1AdapterBridgeDescriptorCount: 12 as const,
    p1AdapterBridgeDescriptors,
    productionCallable: false as const,
    fetchAllowed: false as const,
    openAiCallable: false as const,
    attemptedRequests: 0 as const,
    executedRequests: 0 as const,
    fetchCount: 0 as const,
    openAiRequests: 0 as const,
    retryPerformed: false as const,
    customerDeliveryAllowed: false as const,
    safeMetadataOnly: true as const,
  })
}

export function createAiChartD1ReportWriterRuntimeCommandFingerprint(
  command: AiChartD1ReportWriterRuntimeCommand,
): string {
  return createAiChartD1CanonicalSha256(command)
}

export function prepareAiChartD1ReportWriterRuntimeAdapter(
  command: unknown,
): AiChartD1ReportWriterRuntimeAdapterResult {
  if (
    !isPlainObject(command) ||
    !hasExactEnumerableDataKeys(
      command,
      AI_CHART_D1_REPORT_WRITER_RUNTIME_COMMAND_FIELDS,
    ) ||
    command.contractVersion !==
      AI_CHART_D1_REPORT_WRITER_RUNTIME_COMMAND_VERSION ||
    command.task !==
      AI_CHART_D1_REPORT_WRITER_RUNTIME_COMMAND_TASK ||
    typeof command.pipelineVersion !== 'string' ||
    command.pipelineVersion.trim().length === 0 ||
    typeof command.chartId !== 'string' ||
    command.chartId.trim().length === 0 ||
    typeof command.sourceSnapshotSha256 !== 'string' ||
    command.sourceSnapshotSha256.trim().length === 0 ||
    command.expectedPalaceCount !== 12 ||
    !Array.isArray(command.targetPalaceIds) ||
    command.targetPalaceIds.length !== 12 ||
    !command.targetPalaceIds.every(
      (palaceId) =>
        typeof palaceId === 'string' &&
        palaceId.trim().length > 0,
    ) ||
    command.runtimeMode !== 'PRODUCTION_REPORT_WRITER' ||
    command.runtimeStatus !==
      'D1_P1_ADAPTER_BRIDGES_PREPARED' ||
    command.nextRequiredAction !==
      'EXECUTE_D1_P1_MODEL_REQUESTS_WITH_EXPLICIT_AUTHORIZATION' ||
    command.p1AdapterBridgeDescriptorCount !== 12 ||
    !Array.isArray(command.p1AdapterBridgeDescriptors) ||
    command.p1AdapterBridgeDescriptors.length !== 12 ||
    command.productionCallable !== false ||
    command.fetchAllowed !== false ||
    command.openAiCallable !== false ||
    command.attemptedRequests !== 0 ||
    command.executedRequests !== 0 ||
    command.fetchCount !== 0 ||
    command.openAiRequests !== 0 ||
    command.retryPerformed !== false ||
    command.customerDeliveryAllowed !== false ||
    command.safeMetadataOnly !== true
  ) {
    throw new Error(
      AI_CHART_D1_REPORT_WRITER_RUNTIME_ADAPTER_NOT_IMPLEMENTED,
    )
  }

  const validatedCommand =
    command as AiChartD1ReportWriterRuntimeCommand
  const p1AdapterBridgeDescriptors = freezeAiChartD1Value(
    validatedCommand.p1AdapterBridgeDescriptors.map(
      (descriptor, index) =>
        parseP1BridgeDescriptorSummary(
          descriptor,
          validatedCommand.targetPalaceIds[index],
        ),
    ),
  )

  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_REPORT_WRITER_RUNTIME_ADAPTER_VERSION,
    task: AI_CHART_D1_REPORT_WRITER_RUNTIME_ADAPTER_TASK,
    status:
      'BLOCKED_D1_P1_MODEL_EXECUTION_REQUIRED' as const,
    stage:
      'D1_P1_ADAPTER_BRIDGES_PREPARED' as const,
    commandFingerprint:
      createAiChartD1ReportWriterRuntimeCommandFingerprint(
        validatedCommand,
      ),
    chartId: validatedCommand.chartId,
    sourceSnapshotSha256:
      validatedCommand.sourceSnapshotSha256,
    targetPalaceCount: 12 as const,
    targetPalaceIds: freezeAiChartD1Value([
      ...validatedCommand.targetPalaceIds,
    ]),
    p1AdapterBridgeDescriptorCount: 12 as const,
    p1AdapterBridgeDescriptors,
    runtimeStatus: 'D1_P1_MODEL_EXECUTION_REQUIRED' as const,
    error:
      AI_CHART_D1_REPORT_WRITER_RUNTIME_MODEL_EXECUTION_REQUIRED,
    nextRequiredAction:
      'EXECUTE_D1_P1_MODEL_REQUESTS_WITH_EXPLICIT_AUTHORIZATION' as const,
    reportContentStatus:
      'BLOCKED_PENDING_D1_P1_MODEL_OUTPUTS' as const,
    productionCallable: false as const,
    fetchAllowed: false as const,
    openAiCallable: false as const,
    attemptedRequests: 0 as const,
    executedRequests: 0 as const,
    fetchCount: 0 as const,
    openAiRequests: 0 as const,
    retryPerformed: false as const,
    customerDeliveryAllowed: false as const,
    safeMetadataOnly: true as const,
  })
}
