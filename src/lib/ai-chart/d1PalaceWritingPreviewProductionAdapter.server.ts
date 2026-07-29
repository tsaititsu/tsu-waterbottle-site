import 'server-only'

import {
  freezeAiChartD1Value,
} from './d1CommonContracts'
import {
  probeAiChartD1PalaceWritingPreviewRuntimePort,
  type AiChartD1PalaceWritingPreviewRuntimePortCommand,
  type AiChartD1PalaceWritingPreviewRuntimePortProbeResult,
} from './d1PalaceWritingPreviewRuntimePort.server'
import {
  requestAiChartOpenAiStructuredResponse,
} from './openAiResponses.server'
import {
  type AiChartOpenAiUsage,
} from './openAiResponses'

export const AI_CHART_D1_PALACE_WRITING_PREVIEW_PRODUCTION_ADAPTER_VERSION =
  'ai-chart-d1-palace-writing-preview-production-adapter-probe/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_PRODUCTION_ADAPTER_TASK =
  'D1_PALACE_WRITING_PREVIEW_PRODUCTION_ADAPTER_PROBE' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_PRODUCTION_ADAPTER_INVALID =
  'ai_chart_d1_palace_writing_preview_production_adapter_invalid' as const

export class AiChartD1PalaceWritingPreviewProductionAdapterError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_PREVIEW_PRODUCTION_ADAPTER_INVALID

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_PREVIEW_PRODUCTION_ADAPTER_INVALID,
    )
    this.name =
      'AiChartD1PalaceWritingPreviewProductionAdapterError'
    Object.freeze(this)
  }
}

function invalid(): never {
  throw new AiChartD1PalaceWritingPreviewProductionAdapterError()
}

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false
  try {
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  } catch {
    return false
  }
}

function hasExactEnumerableDataKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  try {
    const ownKeys = Reflect.ownKeys(value)
    if (
      ownKeys.length !== expectedKeys.length ||
      ownKeys.some(
        (key) =>
          typeof key !== 'string' ||
          !expectedKeys.includes(key),
      )
    ) {
      return false
    }
    return expectedKeys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      return (
        descriptor !== undefined &&
        descriptor.enumerable &&
        Object.hasOwn(descriptor, 'value')
      )
    })
  } catch {
    return false
  }
}

function getOwnDataProperty(
  value: Record<string, unknown>,
  key: string,
): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    return descriptor !== undefined &&
      descriptor.enumerable &&
      Object.hasOwn(descriptor, 'value')
      ? descriptor.value
      : undefined
  } catch {
    return undefined
  }
}

function parseNonNegativeInteger(
  value: unknown,
): number | null {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= Number.MAX_SAFE_INTEGER
    ? value
    : null
}

function parseUsage(value: unknown): AiChartOpenAiUsage | null {
  if (
    !isPlainObject(value) ||
    !hasExactEnumerableDataKeys(value, [
      'inputTokens',
      'outputTokens',
      'reasoningTokens',
      'totalTokens',
    ])
  ) {
    return null
  }
  const inputTokens = parseNonNegativeInteger(
    getOwnDataProperty(value, 'inputTokens'),
  )
  const outputTokens = parseNonNegativeInteger(
    getOwnDataProperty(value, 'outputTokens'),
  )
  const reasoningTokens = parseNonNegativeInteger(
    getOwnDataProperty(value, 'reasoningTokens'),
  )
  const totalTokens = parseNonNegativeInteger(
    getOwnDataProperty(value, 'totalTokens'),
  )
  if (
    inputTokens === null ||
    outputTokens === null ||
    reasoningTokens === null ||
    totalTokens === null ||
    reasoningTokens > outputTokens ||
    totalTokens !== inputTokens + outputTokens
  ) {
    return null
  }
  return freezeAiChartD1Value({
    inputTokens,
    outputTokens,
    reasoningTokens,
    totalTokens,
  })
}

function readMonotonicTime(): number {
  const value = globalThis.performance.now()
  if (!Number.isFinite(value) || value < 0) invalid()
  return value
}

function measureDurationMs(startedAt: number): number {
  const finishedAt = readMonotonicTime()
  if (finishedAt < startedAt) invalid()
  const durationMs = Math.max(
    1,
    Math.ceil(finishedAt - startedAt),
  )
  if (!Number.isSafeInteger(durationMs)) invalid()
  return durationMs
}

function createFailedOutcome(durationMs: number) {
  return freezeAiChartD1Value({
    status: 'REQUEST_FAILED' as const,
    durationMs,
    usage: null,
  })
}

function parseStructuredResult(
  value: unknown,
): Readonly<{
  data: unknown
  usage: AiChartOpenAiUsage
}> | null {
  if (
    !isPlainObject(value) ||
    !hasExactEnumerableDataKeys(value, ['data', 'usage'])
  ) {
    return null
  }
  const usage = parseUsage(
    getOwnDataProperty(value, 'usage'),
  )
  if (usage === null) return null
  return Object.freeze({
    data: getOwnDataProperty(value, 'data'),
    usage,
  })
}

async function executeAdapterStage(
  command: AiChartD1PalaceWritingPreviewRuntimePortCommand,
  input: Readonly<{
    requestStructuredResponseFake:
      typeof requestAiChartOpenAiStructuredResponse
  }>,
) {
  const startedAt = readMonotonicTime()
  let rawResult: unknown
  try {
    rawResult =
      await input.requestStructuredResponseFake<unknown>(
        command.request,
      )
  } catch {
    return createFailedOutcome(
      measureDurationMs(startedAt),
    )
  }

  const durationMs = measureDurationMs(startedAt)
  const result = parseStructuredResult(rawResult)
  if (result === null) {
    return createFailedOutcome(durationMs)
  }
  return Object.freeze({
    status: 'SUCCEEDED' as const,
    durationMs,
    usage: result.usage,
    output: result.data,
  })
}

export async function probeAiChartD1PalaceWritingPreviewProductionAdapter(
  input: Readonly<{
    previewPlan: unknown
    goldenCase: unknown
    requestStructuredResponseFake:
      typeof requestAiChartOpenAiStructuredResponse
  }>,
): Promise<AiChartD1PalaceWritingPreviewRuntimePortProbeResult> {
  if (
    !isPlainObject(input) ||
    !hasExactEnumerableDataKeys(input, [
      'previewPlan',
      'goldenCase',
      'requestStructuredResponseFake',
    ]) ||
    typeof input.requestStructuredResponseFake !== 'function' ||
    input.requestStructuredResponseFake ===
      requestAiChartOpenAiStructuredResponse ||
    process.env.NODE_ENV !== 'test'
  ) {
    invalid()
  }

  try {
    return await probeAiChartD1PalaceWritingPreviewRuntimePort({
      previewPlan: input.previewPlan,
      goldenCase: input.goldenCase,
      executeStage: (command) =>
        executeAdapterStage(command, input),
    })
  } catch {
    invalid()
  }
}
