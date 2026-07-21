import { createHash } from 'node:crypto'
import {
  AI_CHART_D1_ID_PATTERN,
  AI_CHART_D1_P1_F1_CONTRACT_VERSION,
  assertAiChartD1SafeGraph,
  createAiChartD1StrictObjectSchema,
  createAiChartD1StringSchema,
  freezeAiChartD1Value,
  parseAiChartD1Id,
  requireAiChartD1ExactObject,
  type AiChartD1JsonSchema,
} from './d1CommonContracts'
import type { AiChartD1PalaceId } from './d1N0Constants'
import {
  AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256,
  AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256,
  AI_CHART_D1_P1_PROMPT_PACKAGE_CONTRACT_VERSION,
  AI_CHART_D1_P1_PROMPT_VERSION,
  createAiChartD1P1CanonicalJson,
} from './d1P1PromptPackageContracts'
import { AI_CHART_D1_P1_SCHEMA_NAME } from './d1P1F1Contracts'
import {
  AI_CHART_D1_P1_PREVIEW_TIMEOUT_VALUES,
  isAiChartD1P1PreviewTimeoutMs,
  type AiChartD1P1PreviewTimeoutMs,
} from './d1P1PreviewTimeoutContracts'
import {
  AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
} from './openAiResponses'

export const AI_CHART_D1_P1_ADAPTER_BRIDGE_CONTRACT_VERSION =
  'ai-chart-d1-p1-adapter-bridge/v1' as const
export const AI_CHART_D1_P1_ADAPTER_BRIDGE_SCHEMA_NAME =
  'ai_chart_d1_p1_adapter_bridge_v1' as const
export const AI_CHART_D1_P1_ADAPTER_BRIDGE_TASK =
  'D1_P1_ADAPTER_BRIDGE' as const
export const AI_CHART_D1_P1_ADAPTER_BRIDGE_DESCRIPTION =
  'D1 P1 單宮本命人格結構化推理結果' as const
export const AI_CHART_D1_P1_ADAPTER_BRIDGE_INVALID =
  'ai_chart_d1_p1_adapter_bridge_invalid' as const
export const AI_CHART_D1_P1_ADAPTER_BRIDGE_NOT_READY =
  'ai_chart_d1_p1_adapter_bridge_not_ready' as const
export const AI_CHART_D1_P1_MAX_OUTPUT_TOKENS = 16_384 as const

export {
  AI_CHART_D1_P1_ADAPTER_BRIDGE_RESULT_INVALID,
  AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS,
  AiChartD1P1AdapterBridgeResultInvalidError,
  isAiChartD1P1SourceBoundValidationReasonCode,
} from './d1P1SourceBoundDiagnostics'
export type { AiChartD1P1SourceBoundValidationReasonCode } from './d1P1SourceBoundDiagnostics'

export type AiChartD1P1AdapterBridgeDescriptor = Readonly<{
  contractVersion: typeof AI_CHART_D1_P1_ADAPTER_BRIDGE_CONTRACT_VERSION
  task: typeof AI_CHART_D1_P1_ADAPTER_BRIDGE_TASK
  chartId: string
  runId: string
  callId: string
  targetPalaceId: AiChartD1PalaceId
  promptPackageContractVersion: typeof AI_CHART_D1_P1_PROMPT_PACKAGE_CONTRACT_VERSION
  promptVersion: typeof AI_CHART_D1_P1_PROMPT_VERSION
  packageFingerprint: string
  modelInputFingerprint: string
  outputContractVersion: typeof AI_CHART_D1_P1_F1_CONTRACT_VERSION
  outputSchemaName: typeof AI_CHART_D1_P1_SCHEMA_NAME
  outputSchemaSha256: typeof AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256
  instructionsSha256: typeof AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256
  userInputSha256: string
  description: typeof AI_CHART_D1_P1_ADAPTER_BRIDGE_DESCRIPTION
  reasoningEffort: typeof AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT
  timeoutMs: AiChartD1P1PreviewTimeoutMs
  maxOutputTokens: typeof AI_CHART_D1_P1_MAX_OUTPUT_TOKENS
  requestStatus: 'ready'
  runtimeStatus: 'runtime_wiring_required'
  openAiCallable: false
  bridgeFingerprint: string
}>

export type AiChartD1P1AdapterBridgeDescriptorWithoutFingerprint = Omit<
  AiChartD1P1AdapterBridgeDescriptor,
  'bridgeFingerprint'
>

export class AiChartD1P1AdapterBridgeError extends Error {
  readonly code = AI_CHART_D1_P1_ADAPTER_BRIDGE_INVALID

  constructor() {
    super(AI_CHART_D1_P1_ADAPTER_BRIDGE_INVALID)
    this.name = 'AiChartD1P1AdapterBridgeError'
  }
}

export class AiChartD1P1AdapterBridgeNotReadyError extends Error {
  readonly code = AI_CHART_D1_P1_ADAPTER_BRIDGE_NOT_READY

  constructor() {
    super(AI_CHART_D1_P1_ADAPTER_BRIDGE_NOT_READY)
    this.name = 'AiChartD1P1AdapterBridgeNotReadyError'
  }
}

export const AI_CHART_D1_P1_ADAPTER_BRIDGE_FIELDS = Object.freeze([
  'contractVersion',
  'task',
  'chartId',
  'runId',
  'callId',
  'targetPalaceId',
  'promptPackageContractVersion',
  'promptVersion',
  'packageFingerprint',
  'modelInputFingerprint',
  'outputContractVersion',
  'outputSchemaName',
  'outputSchemaSha256',
  'instructionsSha256',
  'userInputSha256',
  'description',
  'reasoningEffort',
  'timeoutMs',
  'maxOutputTokens',
  'requestStatus',
  'runtimeStatus',
  'openAiCallable',
  'bridgeFingerprint',
] as const)

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const PALACE_ID_PATTERN =
  /^palace:(ming|parents|fortune|property|career|friends|travel|health|wealth|children|spouse|siblings)$/

function invalid(): never {
  throw new AiChartD1P1AdapterBridgeError()
}

function parseSha(value: unknown): string {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) invalid()
  return value
}

function parsePreviewTimeout(value: unknown): AiChartD1P1PreviewTimeoutMs {
  if (!isAiChartD1P1PreviewTimeoutMs(value)) invalid()
  return value
}

export function createAiChartD1P1AdapterBridgeFingerprint(
  value: AiChartD1P1AdapterBridgeDescriptorWithoutFingerprint,
): string {
  try {
    return createHash('sha256')
      .update(createAiChartD1P1CanonicalJson(value), 'utf8')
      .digest('hex')
  } catch {
    invalid()
  }
}

export function stableAiChartD1P1AdapterBridgeDescriptorEqual(
  left: unknown,
  right: unknown,
): boolean {
  try {
    return (
      createAiChartD1P1CanonicalJson(left) ===
      createAiChartD1P1CanonicalJson(right)
    )
  } catch {
    return false
  }
}

export function parseAiChartD1P1AdapterBridgeDescriptorShape(
  value: unknown,
): AiChartD1P1AdapterBridgeDescriptor {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(
      value,
      AI_CHART_D1_P1_ADAPTER_BRIDGE_FIELDS,
    )
    if (
      record.contractVersion !==
        AI_CHART_D1_P1_ADAPTER_BRIDGE_CONTRACT_VERSION ||
      record.task !== AI_CHART_D1_P1_ADAPTER_BRIDGE_TASK ||
      record.promptPackageContractVersion !==
        AI_CHART_D1_P1_PROMPT_PACKAGE_CONTRACT_VERSION ||
      record.promptVersion !== AI_CHART_D1_P1_PROMPT_VERSION ||
      record.outputContractVersion !== AI_CHART_D1_P1_F1_CONTRACT_VERSION ||
      record.outputSchemaName !== AI_CHART_D1_P1_SCHEMA_NAME ||
      record.outputSchemaSha256 !== AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256 ||
      record.instructionsSha256 !==
        AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256 ||
      record.description !== AI_CHART_D1_P1_ADAPTER_BRIDGE_DESCRIPTION ||
      record.reasoningEffort !==
        AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT ||
      !isAiChartD1P1PreviewTimeoutMs(record.timeoutMs) ||
      record.maxOutputTokens !== AI_CHART_D1_P1_MAX_OUTPUT_TOKENS ||
      record.requestStatus !== 'ready' ||
      record.runtimeStatus !== 'runtime_wiring_required' ||
      record.openAiCallable !== false
    ) {
      invalid()
    }

    const targetPalaceId = parseAiChartD1Id(record.targetPalaceId)
    if (!PALACE_ID_PATTERN.test(targetPalaceId)) invalid()

    const descriptor = freezeAiChartD1Value({
      contractVersion: AI_CHART_D1_P1_ADAPTER_BRIDGE_CONTRACT_VERSION,
      task: AI_CHART_D1_P1_ADAPTER_BRIDGE_TASK,
      chartId: parseAiChartD1Id(record.chartId),
      runId: parseAiChartD1Id(record.runId),
      callId: parseAiChartD1Id(record.callId),
      targetPalaceId: targetPalaceId as AiChartD1PalaceId,
      promptPackageContractVersion:
        AI_CHART_D1_P1_PROMPT_PACKAGE_CONTRACT_VERSION,
      promptVersion: AI_CHART_D1_P1_PROMPT_VERSION,
      packageFingerprint: parseSha(record.packageFingerprint),
      modelInputFingerprint: parseSha(record.modelInputFingerprint),
      outputContractVersion: AI_CHART_D1_P1_F1_CONTRACT_VERSION,
      outputSchemaName: AI_CHART_D1_P1_SCHEMA_NAME,
      outputSchemaSha256: AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256,
      instructionsSha256: AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256,
      userInputSha256: parseSha(record.userInputSha256),
      description: AI_CHART_D1_P1_ADAPTER_BRIDGE_DESCRIPTION,
      reasoningEffort: AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
      timeoutMs: parsePreviewTimeout(record.timeoutMs),
      maxOutputTokens: AI_CHART_D1_P1_MAX_OUTPUT_TOKENS,
      requestStatus: 'ready' as const,
      runtimeStatus: 'runtime_wiring_required' as const,
      openAiCallable: false as const,
      bridgeFingerprint: parseSha(record.bridgeFingerprint),
    })

    return descriptor
  } catch (error) {
    if (error instanceof AiChartD1P1AdapterBridgeError) throw error
    invalid()
  }
}

const ID_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 128,
  pattern: AI_CHART_D1_ID_PATTERN.source,
})
const PALACE_ID_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 128,
  pattern: PALACE_ID_PATTERN.source,
})
const SHA_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 64,
  pattern: SHA256_PATTERN.source,
})

export const AI_CHART_D1_P1_ADAPTER_BRIDGE_INTERNAL_JSON_SCHEMA: AiChartD1JsonSchema =
  createAiChartD1StrictObjectSchema({
    contractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_ADAPTER_BRIDGE_CONTRACT_VERSION,
    }),
    task: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_ADAPTER_BRIDGE_TASK,
    }),
    chartId: ID_SCHEMA,
    runId: ID_SCHEMA,
    callId: ID_SCHEMA,
    targetPalaceId: PALACE_ID_SCHEMA,
    promptPackageContractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_PROMPT_PACKAGE_CONTRACT_VERSION,
    }),
    promptVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_PROMPT_VERSION,
    }),
    packageFingerprint: SHA_SCHEMA,
    modelInputFingerprint: SHA_SCHEMA,
    outputContractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_F1_CONTRACT_VERSION,
    }),
    outputSchemaName: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_SCHEMA_NAME,
    }),
    outputSchemaSha256: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256,
    }),
    instructionsSha256: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256,
    }),
    userInputSha256: SHA_SCHEMA,
    description: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_ADAPTER_BRIDGE_DESCRIPTION,
    }),
    reasoningEffort: freezeAiChartD1Value({
      const: AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
    }),
    timeoutMs: freezeAiChartD1Value({
      type: 'integer',
      enum: AI_CHART_D1_P1_PREVIEW_TIMEOUT_VALUES,
    }),
    maxOutputTokens: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_MAX_OUTPUT_TOKENS,
    }),
    requestStatus: freezeAiChartD1Value({ const: 'ready' }),
    runtimeStatus: freezeAiChartD1Value({
      const: 'runtime_wiring_required',
    }),
    openAiCallable: freezeAiChartD1Value({ const: false }),
    bridgeFingerprint: SHA_SCHEMA,
  })
