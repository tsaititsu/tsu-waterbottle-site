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
import { AI_CHART_D1_MODEL_TARGET } from './d1Assets'
import {
  AI_CHART_D1_PALACE_IDENTITIES,
  type AiChartD1PalaceId,
} from './d1N0Constants'
import {
  AI_CHART_D1_P1_ADAPTER_BRIDGE_CONTRACT_VERSION,
} from './d1P1AdapterBridgeContracts'
import {
  AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256,
  AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256,
  AI_CHART_D1_P1_PROMPT_VERSION,
  createAiChartD1P1CanonicalJson,
} from './d1P1PromptPackageContracts'
import { AI_CHART_D1_P1_SCHEMA_NAME } from './d1P1F1Contracts'
import {
  AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS,
  AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
  AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
} from './openAiResponses'

export const AI_CHART_D1_P1_PREVIEW_GATE_CONTRACT_VERSION =
  'ai-chart-d1-p1-preview-request-gate/v1' as const
export const AI_CHART_D1_P1_PREVIEW_GATE_SCHEMA_NAME =
  'ai_chart_d1_p1_preview_request_gate_v1' as const
export const AI_CHART_D1_P1_PREVIEW_GATE_TASK =
  'D1_P1_PREVIEW_REQUEST' as const
export const AI_CHART_D1_P1_PREVIEW_GATE_REQUEST_MODE =
  'single_palace_single_request' as const
export const AI_CHART_D1_P1_PREVIEW_GATE_INVALID =
  'ai_chart_d1_p1_preview_gate_invalid' as const
export const AI_CHART_D1_P1_PREVIEW_GATE_DISABLED =
  'ai_chart_d1_p1_preview_gate_disabled' as const
export const AI_CHART_D1_P1_PREVIEW_GATE_PRODUCTION_FORBIDDEN =
  'ai_chart_d1_p1_preview_gate_production_forbidden' as const

export const AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_VERSION =
  'ai-chart-d1-p1-preview-authorization/v1' as const
export const AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_MODE =
  'execute_once' as const
export const AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_ACKNOWLEDGEMENT =
  'EXECUTE_ONE_PAID_OPENAI_PREVIEW_REQUEST' as const

export type AiChartD1P1PreviewGateErrorCode =
  | typeof AI_CHART_D1_P1_PREVIEW_GATE_INVALID
  | typeof AI_CHART_D1_P1_PREVIEW_GATE_DISABLED
  | typeof AI_CHART_D1_P1_PREVIEW_GATE_PRODUCTION_FORBIDDEN

export class AiChartD1P1PreviewGateError extends Error {
  readonly code: AiChartD1P1PreviewGateErrorCode

  constructor(code: AiChartD1P1PreviewGateErrorCode) {
    super(code)
    this.name = 'AiChartD1P1PreviewGateError'
    this.code = code
  }
}

export type AiChartD1P1PreviewRequestPlan = Readonly<{
  contractVersion: typeof AI_CHART_D1_P1_PREVIEW_GATE_CONTRACT_VERSION
  task: typeof AI_CHART_D1_P1_PREVIEW_GATE_TASK
  requestMode: typeof AI_CHART_D1_P1_PREVIEW_GATE_REQUEST_MODE
  chartId: string
  runId: string
  callId: string
  targetPalaceId: AiChartD1PalaceId
  adapterBridgeContractVersion: typeof AI_CHART_D1_P1_ADAPTER_BRIDGE_CONTRACT_VERSION
  bridgeFingerprint: string
  packageFingerprint: string
  modelInputFingerprint: string
  promptVersion: typeof AI_CHART_D1_P1_PROMPT_VERSION
  instructionsSha256: typeof AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256
  outputContractVersion: typeof AI_CHART_D1_P1_F1_CONTRACT_VERSION
  outputSchemaName: typeof AI_CHART_D1_P1_SCHEMA_NAME
  outputSchemaSha256: typeof AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256
  modelTarget: typeof AI_CHART_D1_MODEL_TARGET
  reasoningEffort: typeof AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT
  timeoutMs: typeof AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS
  maxOutputTokens: typeof AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS
  maxRequests: 1
  serverOnly: true
  environmentPolicy: 'local_development_only'
  authorizationStatus: 'authorization_required'
  routeStatus: 'route_forbidden'
  persistenceStatus: 'persistence_forbidden'
  runtimeStatus: 'preview_gate_only'
  productionCallable: false
  planFingerprint: string
}>

export type AiChartD1P1PreviewRequestPlanWithoutFingerprint = Omit<
  AiChartD1P1PreviewRequestPlan,
  'planFingerprint'
>

export type AiChartD1P1PreviewAuthorization = Readonly<{
  contractVersion: typeof AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_VERSION
  mode: typeof AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_MODE
  planFingerprint: string
  targetPalaceId: AiChartD1PalaceId
  acknowledgement: typeof AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_ACKNOWLEDGEMENT
}>

export const AI_CHART_D1_P1_PREVIEW_GATE_FIELDS = Object.freeze([
  'contractVersion',
  'task',
  'requestMode',
  'chartId',
  'runId',
  'callId',
  'targetPalaceId',
  'adapterBridgeContractVersion',
  'bridgeFingerprint',
  'packageFingerprint',
  'modelInputFingerprint',
  'promptVersion',
  'instructionsSha256',
  'outputContractVersion',
  'outputSchemaName',
  'outputSchemaSha256',
  'modelTarget',
  'reasoningEffort',
  'timeoutMs',
  'maxOutputTokens',
  'maxRequests',
  'serverOnly',
  'environmentPolicy',
  'authorizationStatus',
  'routeStatus',
  'persistenceStatus',
  'runtimeStatus',
  'productionCallable',
  'planFingerprint',
] as const)

export const AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_FIELDS = Object.freeze([
  'contractVersion',
  'mode',
  'planFingerprint',
  'targetPalaceId',
  'acknowledgement',
] as const)

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const PALACE_IDS = new Set(
  AI_CHART_D1_PALACE_IDENTITIES.map((identity) => identity.palaceId),
)
const PALACE_ID_PATTERN =
  /^palace:(ming|siblings|spouse|children|wealth|health|travel|friends|career|property|fortune|parents)$/

function invalid(): never {
  throw new AiChartD1P1PreviewGateError(
    AI_CHART_D1_P1_PREVIEW_GATE_INVALID,
  )
}

function parseSha256(value: unknown): string {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) invalid()
  return value
}

function parsePalaceId(value: unknown): AiChartD1PalaceId {
  const palaceId = parseAiChartD1Id(value)
  if (!PALACE_IDS.has(palaceId as AiChartD1PalaceId)) invalid()
  return palaceId as AiChartD1PalaceId
}

function parseFixedInteger(value: unknown, expected: number): number {
  if (!Number.isInteger(value) || value !== expected) invalid()
  return value as number
}

export function createAiChartD1P1PreviewRequestPlanFingerprint(
  value: AiChartD1P1PreviewRequestPlanWithoutFingerprint,
): string {
  try {
    return createHash('sha256')
      .update(createAiChartD1P1CanonicalJson(value), 'utf8')
      .digest('hex')
  } catch {
    invalid()
  }
}

export function stableAiChartD1P1PreviewRequestPlanEqual(
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

export function parseAiChartD1P1PreviewRequestPlanShape(
  value: unknown,
): AiChartD1P1PreviewRequestPlan {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(
      value,
      AI_CHART_D1_P1_PREVIEW_GATE_FIELDS,
    )

    if (
      record.contractVersion !==
        AI_CHART_D1_P1_PREVIEW_GATE_CONTRACT_VERSION ||
      record.task !== AI_CHART_D1_P1_PREVIEW_GATE_TASK ||
      record.requestMode !== AI_CHART_D1_P1_PREVIEW_GATE_REQUEST_MODE ||
      record.adapterBridgeContractVersion !==
        AI_CHART_D1_P1_ADAPTER_BRIDGE_CONTRACT_VERSION ||
      record.promptVersion !== AI_CHART_D1_P1_PROMPT_VERSION ||
      record.instructionsSha256 !==
        AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256 ||
      record.outputContractVersion !== AI_CHART_D1_P1_F1_CONTRACT_VERSION ||
      record.outputSchemaName !== AI_CHART_D1_P1_SCHEMA_NAME ||
      record.outputSchemaSha256 !== AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256 ||
      record.modelTarget !== AI_CHART_D1_MODEL_TARGET ||
      record.reasoningEffort !==
        AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT ||
      record.serverOnly !== true ||
      record.environmentPolicy !== 'local_development_only' ||
      record.authorizationStatus !== 'authorization_required' ||
      record.routeStatus !== 'route_forbidden' ||
      record.persistenceStatus !== 'persistence_forbidden' ||
      record.runtimeStatus !== 'preview_gate_only' ||
      record.productionCallable !== false
    ) {
      invalid()
    }

    return freezeAiChartD1Value({
      contractVersion: AI_CHART_D1_P1_PREVIEW_GATE_CONTRACT_VERSION,
      task: AI_CHART_D1_P1_PREVIEW_GATE_TASK,
      requestMode: AI_CHART_D1_P1_PREVIEW_GATE_REQUEST_MODE,
      chartId: parseAiChartD1Id(record.chartId),
      runId: parseAiChartD1Id(record.runId),
      callId: parseAiChartD1Id(record.callId),
      targetPalaceId: parsePalaceId(record.targetPalaceId),
      adapterBridgeContractVersion:
        AI_CHART_D1_P1_ADAPTER_BRIDGE_CONTRACT_VERSION,
      bridgeFingerprint: parseSha256(record.bridgeFingerprint),
      packageFingerprint: parseSha256(record.packageFingerprint),
      modelInputFingerprint: parseSha256(record.modelInputFingerprint),
      promptVersion: AI_CHART_D1_P1_PROMPT_VERSION,
      instructionsSha256: AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256,
      outputContractVersion: AI_CHART_D1_P1_F1_CONTRACT_VERSION,
      outputSchemaName: AI_CHART_D1_P1_SCHEMA_NAME,
      outputSchemaSha256: AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256,
      modelTarget: AI_CHART_D1_MODEL_TARGET,
      reasoningEffort: AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
      timeoutMs: parseFixedInteger(
        record.timeoutMs,
        AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
      ) as typeof AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
      maxOutputTokens: parseFixedInteger(
        record.maxOutputTokens,
        AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS,
      ) as typeof AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS,
      maxRequests: parseFixedInteger(record.maxRequests, 1) as 1,
      serverOnly: true as const,
      environmentPolicy: 'local_development_only' as const,
      authorizationStatus: 'authorization_required' as const,
      routeStatus: 'route_forbidden' as const,
      persistenceStatus: 'persistence_forbidden' as const,
      runtimeStatus: 'preview_gate_only' as const,
      productionCallable: false as const,
      planFingerprint: parseSha256(record.planFingerprint),
    })
  } catch (error) {
    if (error instanceof AiChartD1P1PreviewGateError) throw error
    invalid()
  }
}

export function createAiChartD1P1PreviewAuthorization(
  plan: AiChartD1P1PreviewRequestPlan,
): AiChartD1P1PreviewAuthorization {
  const validatedPlan = parseAiChartD1P1PreviewRequestPlanShape(plan)
  return freezeAiChartD1Value({
    contractVersion: AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_VERSION,
    mode: AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_MODE,
    planFingerprint: validatedPlan.planFingerprint,
    targetPalaceId: validatedPlan.targetPalaceId,
    acknowledgement:
      AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_ACKNOWLEDGEMENT,
  })
}

export function parseAiChartD1P1PreviewAuthorization(
  value: unknown,
  expectedPlan: AiChartD1P1PreviewRequestPlan,
): AiChartD1P1PreviewAuthorization {
  try {
    const validatedPlan = parseAiChartD1P1PreviewRequestPlanShape(expectedPlan)
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(
      value,
      AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_FIELDS,
    )
    if (
      record.contractVersion !==
        AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_VERSION ||
      record.mode !== AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_MODE ||
      record.acknowledgement !==
        AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_ACKNOWLEDGEMENT ||
      record.planFingerprint !== validatedPlan.planFingerprint ||
      record.targetPalaceId !== validatedPlan.targetPalaceId
    ) {
      invalid()
    }

    return freezeAiChartD1Value({
      contractVersion: AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_VERSION,
      mode: AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_MODE,
      planFingerprint: parseSha256(record.planFingerprint),
      targetPalaceId: parsePalaceId(record.targetPalaceId),
      acknowledgement:
        AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_ACKNOWLEDGEMENT,
    })
  } catch (error) {
    if (error instanceof AiChartD1P1PreviewGateError) throw error
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
const SHA256_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 64,
  pattern: SHA256_PATTERN.source,
})

export const AI_CHART_D1_P1_PREVIEW_GATE_INTERNAL_JSON_SCHEMA: AiChartD1JsonSchema =
  createAiChartD1StrictObjectSchema({
    contractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_PREVIEW_GATE_CONTRACT_VERSION,
    }),
    task: freezeAiChartD1Value({ const: AI_CHART_D1_P1_PREVIEW_GATE_TASK }),
    requestMode: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_PREVIEW_GATE_REQUEST_MODE,
    }),
    chartId: ID_SCHEMA,
    runId: ID_SCHEMA,
    callId: ID_SCHEMA,
    targetPalaceId: PALACE_ID_SCHEMA,
    adapterBridgeContractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_ADAPTER_BRIDGE_CONTRACT_VERSION,
    }),
    bridgeFingerprint: SHA256_SCHEMA,
    packageFingerprint: SHA256_SCHEMA,
    modelInputFingerprint: SHA256_SCHEMA,
    promptVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_PROMPT_VERSION,
    }),
    instructionsSha256: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256,
    }),
    outputContractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_F1_CONTRACT_VERSION,
    }),
    outputSchemaName: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_SCHEMA_NAME,
    }),
    outputSchemaSha256: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256,
    }),
    modelTarget: freezeAiChartD1Value({ const: AI_CHART_D1_MODEL_TARGET }),
    reasoningEffort: freezeAiChartD1Value({
      const: AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
    }),
    timeoutMs: freezeAiChartD1Value({
      type: 'integer',
      minimum: AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
      maximum: AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
    }),
    maxOutputTokens: freezeAiChartD1Value({
      type: 'integer',
      minimum: AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS,
      maximum: AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS,
    }),
    maxRequests: freezeAiChartD1Value({
      type: 'integer',
      minimum: 1,
      maximum: 1,
    }),
    serverOnly: freezeAiChartD1Value({ const: true }),
    environmentPolicy: freezeAiChartD1Value({
      const: 'local_development_only',
    }),
    authorizationStatus: freezeAiChartD1Value({
      const: 'authorization_required',
    }),
    routeStatus: freezeAiChartD1Value({ const: 'route_forbidden' }),
    persistenceStatus: freezeAiChartD1Value({
      const: 'persistence_forbidden',
    }),
    runtimeStatus: freezeAiChartD1Value({ const: 'preview_gate_only' }),
    productionCallable: freezeAiChartD1Value({ const: false }),
    planFingerprint: SHA256_SCHEMA,
  })

export const AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_INTERNAL_JSON_SCHEMA: AiChartD1JsonSchema =
  createAiChartD1StrictObjectSchema({
    contractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_VERSION,
    }),
    mode: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_MODE,
    }),
    planFingerprint: SHA256_SCHEMA,
    targetPalaceId: PALACE_ID_SCHEMA,
    acknowledgement: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_ACKNOWLEDGEMENT,
    }),
  })
