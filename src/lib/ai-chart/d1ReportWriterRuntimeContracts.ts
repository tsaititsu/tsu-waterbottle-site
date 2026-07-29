import { freezeAiChartD1Value } from './d1CommonContracts'
import { createAiChartD1CanonicalSha256 } from './d1CanonicalDigest'

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
  runtimeStatus: 'DISABLED_PENDING_IMPLEMENTATION'
  nextRequiredAction:
    'IMPLEMENT_D1_REPORT_WRITER_RUNTIME_ADAPTER'
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
    status: 'BLOCKED_RUNTIME_ADAPTER_NOT_IMPLEMENTED'
    stage: 'REPORT_WRITER_RUNTIME_ADAPTER_DECLARED'
    commandFingerprint: string
    chartId: string
    sourceSnapshotSha256: string
    targetPalaceCount: 12
    targetPalaceIds: readonly string[]
    runtimeStatus: 'NOT_IMPLEMENTED'
    error:
      typeof AI_CHART_D1_REPORT_WRITER_RUNTIME_ADAPTER_NOT_IMPLEMENTED
    nextRequiredAction:
      'IMPLEMENT_D1_REPORT_WRITER_RUNTIME_ADAPTER'
    reportContentStatus: 'NOT_CREATED'
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

export function buildAiChartD1ReportWriterRuntimeCommand(
  input: Readonly<{
    pipelineVersion: string
    chartId: string
    sourceSnapshotSha256: string
    targetPalaceIds: readonly string[]
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
      'DISABLED_PENDING_IMPLEMENTATION' as const,
    nextRequiredAction:
      'IMPLEMENT_D1_REPORT_WRITER_RUNTIME_ADAPTER' as const,
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
      'DISABLED_PENDING_IMPLEMENTATION' ||
    command.nextRequiredAction !==
      'IMPLEMENT_D1_REPORT_WRITER_RUNTIME_ADAPTER' ||
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

  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_REPORT_WRITER_RUNTIME_ADAPTER_VERSION,
    task: AI_CHART_D1_REPORT_WRITER_RUNTIME_ADAPTER_TASK,
    status:
      'BLOCKED_RUNTIME_ADAPTER_NOT_IMPLEMENTED' as const,
    stage:
      'REPORT_WRITER_RUNTIME_ADAPTER_DECLARED' as const,
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
    runtimeStatus: 'NOT_IMPLEMENTED' as const,
    error:
      AI_CHART_D1_REPORT_WRITER_RUNTIME_ADAPTER_NOT_IMPLEMENTED,
    nextRequiredAction:
      'IMPLEMENT_D1_REPORT_WRITER_RUNTIME_ADAPTER' as const,
    reportContentStatus: 'NOT_CREATED' as const,
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
