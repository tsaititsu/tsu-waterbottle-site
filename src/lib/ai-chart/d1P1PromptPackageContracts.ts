import { createHash } from 'node:crypto'
import {
  AI_CHART_D1_ID_PATTERN,
  AI_CHART_D1_P1_F1_CONTRACT_VERSION,
  assertAiChartD1SafeGraph,
  createAiChartD1ArraySchema,
  createAiChartD1StrictObjectSchema,
  createAiChartD1StringSchema,
  freezeAiChartD1Value,
  parseAiChartD1Boolean,
  parseAiChartD1Id,
  parseAiChartD1StringArray,
  parseAiChartD1Text,
  requireAiChartD1ExactObject,
  type AiChartD1JsonSchema,
} from './d1CommonContracts'
import {
  AI_CHART_D1_P1_MODEL_INPUT_CONTRACT_VERSION,
  type AiChartD1P1ModelInput,
} from './d1P1ModelInputContracts'
import {
  AI_CHART_D1_P1_OUTPUT_SCHEMA,
  AI_CHART_D1_P1_SCHEMA_NAME,
} from './d1P1F1Contracts'
import { AI_CHART_D1_P1_PROMPT_INSTRUCTIONS } from './d1P1PromptInstructions'

export const AI_CHART_D1_P1_PROMPT_PACKAGE_CONTRACT_VERSION =
  'ai-chart-d1-p1-prompt-package/v1' as const
export const AI_CHART_D1_P1_PROMPT_VERSION =
  'ai-chart-d1-p1-prompt/v1' as const
export const AI_CHART_D1_P1_PROMPT_PACKAGE_SCHEMA_NAME =
  'ai_chart_d1_p1_prompt_package_v1' as const
export const AI_CHART_D1_P1_PROMPT_PACKAGE_TASK =
  'D1_P1_PROMPT_PACKAGE' as const
export const AI_CHART_D1_P1_PROMPT_PACKAGE_INVALID =
  'ai_chart_d1_p1_prompt_package_invalid' as const
export const AI_CHART_D1_P1_PROMPT_PACKAGE_NOT_READY =
  'ai_chart_d1_p1_prompt_package_not_ready' as const
export const AI_CHART_D1_P1_PROMPT_PACKAGE_BUDGET_EXCEEDED =
  'ai_chart_d1_p1_prompt_package_budget_exceeded' as const

export const AI_CHART_D1_P1_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES = 32_768 as const
export const AI_CHART_D1_P1_PROMPT_MAX_USER_INPUT_UTF8_BYTES = 262_144 as const
export const AI_CHART_D1_P1_PROMPT_MAX_TOTAL_UTF8_BYTES = 294_912 as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const PALACE_ID_PATTERN =
  /^palace:(ming|parents|fortune|property|career|friends|travel|health|wealth|children|spouse|siblings)$/
const MAX_USER_INPUT_CHARACTERS =
  AI_CHART_D1_P1_PROMPT_MAX_USER_INPUT_UTF8_BYTES

export type AiChartD1P1PromptPackageSourceTrace = Readonly<{
  modelInputFingerprint: string
  ruleIds: readonly string[]
  meaningReferences: readonly string[]
  selectionTraceRuleIds: readonly string[]
}>

export type AiChartD1P1PromptPackageBudget = Readonly<{
  measurement: 'utf8_bytes'
  instructionsUtf8Bytes: number
  userInputUtf8Bytes: number
  totalUtf8Bytes: number
  maxInstructionsUtf8Bytes: typeof AI_CHART_D1_P1_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES
  maxUserInputUtf8Bytes: typeof AI_CHART_D1_P1_PROMPT_MAX_USER_INPUT_UTF8_BYTES
  maxTotalUtf8Bytes: typeof AI_CHART_D1_P1_PROMPT_MAX_TOTAL_UTF8_BYTES
  status: 'within_budget'
}>

export type AiChartD1P1PromptPackage = Readonly<{
  contractVersion: typeof AI_CHART_D1_P1_PROMPT_PACKAGE_CONTRACT_VERSION
  promptVersion: typeof AI_CHART_D1_P1_PROMPT_VERSION
  task: typeof AI_CHART_D1_P1_PROMPT_PACKAGE_TASK
  chartId: string
  runId: string
  callId: string
  targetPalaceId: string
  bundleId: string
  catalogId: string
  catalogFingerprint: string
  sourceManifestSha256: string
  modelInputContractVersion: typeof AI_CHART_D1_P1_MODEL_INPUT_CONTRACT_VERSION
  modelInputFingerprint: string
  outputContractVersion: typeof AI_CHART_D1_P1_F1_CONTRACT_VERSION
  outputSchemaName: typeof AI_CHART_D1_P1_SCHEMA_NAME
  outputSchemaSha256: string
  instructions: typeof AI_CHART_D1_P1_PROMPT_INSTRUCTIONS
  instructionsSha256: string
  userInput: string
  userInputSha256: string
  sourceTrace: AiChartD1P1PromptPackageSourceTrace
  budget: AiChartD1P1PromptPackageBudget
  promptStatus: 'ready'
  adapterStatus: 'adapter_bridge_required'
  openAiCallable: false
  packageFingerprint: string
}>

export type AiChartD1P1PromptPackageWithoutFingerprint = Omit<
  AiChartD1P1PromptPackage,
  'packageFingerprint'
>

export class AiChartD1P1PromptPackageError extends Error {
  readonly code = AI_CHART_D1_P1_PROMPT_PACKAGE_INVALID

  constructor() {
    super(AI_CHART_D1_P1_PROMPT_PACKAGE_INVALID)
    this.name = 'AiChartD1P1PromptPackageError'
  }
}

export class AiChartD1P1PromptPackageNotReadyError extends Error {
  readonly code = AI_CHART_D1_P1_PROMPT_PACKAGE_NOT_READY

  constructor() {
    super(AI_CHART_D1_P1_PROMPT_PACKAGE_NOT_READY)
    this.name = 'AiChartD1P1PromptPackageNotReadyError'
  }
}

export class AiChartD1P1PromptPackageBudgetExceededError extends Error {
  readonly code = AI_CHART_D1_P1_PROMPT_PACKAGE_BUDGET_EXCEEDED

  constructor() {
    super(AI_CHART_D1_P1_PROMPT_PACKAGE_BUDGET_EXCEEDED)
    this.name = 'AiChartD1P1PromptPackageBudgetExceededError'
  }
}

export const AI_CHART_D1_P1_PROMPT_PACKAGE_SOURCE_TRACE_FIELDS = Object.freeze([
  'modelInputFingerprint',
  'ruleIds',
  'meaningReferences',
  'selectionTraceRuleIds',
] as const)

export const AI_CHART_D1_P1_PROMPT_PACKAGE_BUDGET_FIELDS = Object.freeze([
  'measurement',
  'instructionsUtf8Bytes',
  'userInputUtf8Bytes',
  'totalUtf8Bytes',
  'maxInstructionsUtf8Bytes',
  'maxUserInputUtf8Bytes',
  'maxTotalUtf8Bytes',
  'status',
] as const)

export const AI_CHART_D1_P1_PROMPT_PACKAGE_FIELDS = Object.freeze([
  'contractVersion',
  'promptVersion',
  'task',
  'chartId',
  'runId',
  'callId',
  'targetPalaceId',
  'bundleId',
  'catalogId',
  'catalogFingerprint',
  'sourceManifestSha256',
  'modelInputContractVersion',
  'modelInputFingerprint',
  'outputContractVersion',
  'outputSchemaName',
  'outputSchemaSha256',
  'instructions',
  'instructionsSha256',
  'userInput',
  'userInputSha256',
  'sourceTrace',
  'budget',
  'promptStatus',
  'adapterStatus',
  'openAiCallable',
  'packageFingerprint',
] as const)

function invalid(): never {
  throw new AiChartD1P1PromptPackageError()
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  )
}

export function createAiChartD1P1CanonicalJson(value: unknown): string {
  try {
    assertAiChartD1SafeGraph(value)
    return JSON.stringify(canonicalize(value))
  } catch {
    invalid()
  }
}

export function stableAiChartD1P1PromptPackageEqual(
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

export function hashAiChartD1P1PromptPackageValue(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export const AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256 =
  hashAiChartD1P1PromptPackageValue(AI_CHART_D1_P1_PROMPT_INSTRUCTIONS)

export const AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256 =
  hashAiChartD1P1PromptPackageValue(
    createAiChartD1P1CanonicalJson(AI_CHART_D1_P1_OUTPUT_SCHEMA),
  )

export function createAiChartD1P1PromptUserInput(
  modelInput: AiChartD1P1ModelInput,
): string {
  return createAiChartD1P1CanonicalJson(modelInput)
}

export function createAiChartD1P1PromptPackageBudget(
  instructions: string,
  userInput: string,
): AiChartD1P1PromptPackageBudget {
  const instructionsUtf8Bytes = Buffer.byteLength(instructions, 'utf8')
  const userInputUtf8Bytes = Buffer.byteLength(userInput, 'utf8')
  const totalUtf8Bytes = instructionsUtf8Bytes + userInputUtf8Bytes

  if (
    instructionsUtf8Bytes >
      AI_CHART_D1_P1_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES ||
    userInputUtf8Bytes > AI_CHART_D1_P1_PROMPT_MAX_USER_INPUT_UTF8_BYTES ||
    totalUtf8Bytes > AI_CHART_D1_P1_PROMPT_MAX_TOTAL_UTF8_BYTES
  ) {
    throw new AiChartD1P1PromptPackageBudgetExceededError()
  }

  return Object.freeze({
    measurement: 'utf8_bytes',
    instructionsUtf8Bytes,
    userInputUtf8Bytes,
    totalUtf8Bytes,
    maxInstructionsUtf8Bytes:
      AI_CHART_D1_P1_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES,
    maxUserInputUtf8Bytes:
      AI_CHART_D1_P1_PROMPT_MAX_USER_INPUT_UTF8_BYTES,
    maxTotalUtf8Bytes: AI_CHART_D1_P1_PROMPT_MAX_TOTAL_UTF8_BYTES,
    status: 'within_budget',
  })
}

export function createAiChartD1P1PromptPackageFingerprint(
  value: AiChartD1P1PromptPackageWithoutFingerprint,
): string {
  return hashAiChartD1P1PromptPackageValue(
    createAiChartD1P1CanonicalJson(value),
  )
}

function parseSha(value: unknown): string {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) invalid()
  return value
}

function parseInteger(value: unknown, minimum: number, maximum: number): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    invalid()
  }
  return value
}

function parseSourceTrace(
  value: unknown,
): AiChartD1P1PromptPackageSourceTrace {
  const record = requireAiChartD1ExactObject(
    value,
    AI_CHART_D1_P1_PROMPT_PACKAGE_SOURCE_TRACE_FIELDS,
  )
  return Object.freeze({
    modelInputFingerprint: parseSha(record.modelInputFingerprint),
    ruleIds: parseAiChartD1StringArray(record.ruleIds, {
      minimumItems: 1,
      maximumItems: 256,
      parseItem: parseAiChartD1Id,
    }),
    meaningReferences: parseAiChartD1StringArray(record.meaningReferences, {
      minimumItems: 1,
      maximumItems: 128,
      itemMaximumLength: 256,
    }),
    selectionTraceRuleIds: parseAiChartD1StringArray(
      record.selectionTraceRuleIds,
      {
        minimumItems: 1,
        maximumItems: 256,
        parseItem: parseAiChartD1Id,
      },
    ),
  })
}

function parseBudget(
  value: unknown,
  instructions: string,
  userInput: string,
): AiChartD1P1PromptPackageBudget {
  const record = requireAiChartD1ExactObject(
    value,
    AI_CHART_D1_P1_PROMPT_PACKAGE_BUDGET_FIELDS,
  )
  const actual = {
    instructionsUtf8Bytes: Buffer.byteLength(instructions, 'utf8'),
    userInputUtf8Bytes: Buffer.byteLength(userInput, 'utf8'),
  }
  const total = actual.instructionsUtf8Bytes + actual.userInputUtf8Bytes
  if (
    record.measurement !== 'utf8_bytes' ||
    record.status !== 'within_budget' ||
    record.maxInstructionsUtf8Bytes !==
      AI_CHART_D1_P1_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES ||
    record.maxUserInputUtf8Bytes !==
      AI_CHART_D1_P1_PROMPT_MAX_USER_INPUT_UTF8_BYTES ||
    record.maxTotalUtf8Bytes !== AI_CHART_D1_P1_PROMPT_MAX_TOTAL_UTF8_BYTES ||
    parseInteger(
      record.instructionsUtf8Bytes,
      0,
      AI_CHART_D1_P1_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES,
    ) !== actual.instructionsUtf8Bytes ||
    parseInteger(
      record.userInputUtf8Bytes,
      0,
      AI_CHART_D1_P1_PROMPT_MAX_USER_INPUT_UTF8_BYTES,
    ) !== actual.userInputUtf8Bytes ||
    parseInteger(
      record.totalUtf8Bytes,
      0,
      AI_CHART_D1_P1_PROMPT_MAX_TOTAL_UTF8_BYTES,
    ) !== total
  ) {
    invalid()
  }
  return freezeAiChartD1Value(structuredClone(value)) as AiChartD1P1PromptPackageBudget
}

function parseCanonicalUserInput(value: unknown): string {
  const userInput = parseAiChartD1Text(value, MAX_USER_INPUT_CHARACTERS)
  try {
    const parsed: unknown = JSON.parse(userInput)
    assertAiChartD1SafeGraph(parsed)
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed) ||
      createAiChartD1P1CanonicalJson(parsed) !== userInput
    ) {
      invalid()
    }
  } catch (error) {
    if (error instanceof AiChartD1P1PromptPackageError) throw error
    invalid()
  }
  return userInput
}

export function parseAiChartD1P1PromptPackageShape(
  value: unknown,
): AiChartD1P1PromptPackage {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(
      value,
      AI_CHART_D1_P1_PROMPT_PACKAGE_FIELDS,
    )
    if (
      record.contractVersion !==
        AI_CHART_D1_P1_PROMPT_PACKAGE_CONTRACT_VERSION ||
      record.promptVersion !== AI_CHART_D1_P1_PROMPT_VERSION ||
      record.task !== AI_CHART_D1_P1_PROMPT_PACKAGE_TASK ||
      record.modelInputContractVersion !==
        AI_CHART_D1_P1_MODEL_INPUT_CONTRACT_VERSION ||
      record.outputContractVersion !== AI_CHART_D1_P1_F1_CONTRACT_VERSION ||
      record.outputSchemaName !== AI_CHART_D1_P1_SCHEMA_NAME ||
      record.outputSchemaSha256 !== AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256 ||
      record.instructions !== AI_CHART_D1_P1_PROMPT_INSTRUCTIONS ||
      record.instructionsSha256 !==
        AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256 ||
      record.promptStatus !== 'ready' ||
      record.adapterStatus !== 'adapter_bridge_required' ||
      parseAiChartD1Boolean(record.openAiCallable) !== false
    ) {
      invalid()
    }
    const targetPalaceId = parseAiChartD1Id(record.targetPalaceId)
    if (!PALACE_ID_PATTERN.test(targetPalaceId)) invalid()
    const userInput = parseCanonicalUserInput(record.userInput)
    if (
      parseSha(record.userInputSha256) !==
      hashAiChartD1P1PromptPackageValue(userInput)
    ) {
      invalid()
    }

    return freezeAiChartD1Value({
      contractVersion: AI_CHART_D1_P1_PROMPT_PACKAGE_CONTRACT_VERSION,
      promptVersion: AI_CHART_D1_P1_PROMPT_VERSION,
      task: AI_CHART_D1_P1_PROMPT_PACKAGE_TASK,
      chartId: parseAiChartD1Id(record.chartId),
      runId: parseAiChartD1Id(record.runId),
      callId: parseAiChartD1Id(record.callId),
      targetPalaceId,
      bundleId: parseAiChartD1Id(record.bundleId),
      catalogId: parseAiChartD1Id(record.catalogId),
      catalogFingerprint: parseSha(record.catalogFingerprint),
      sourceManifestSha256: parseSha(record.sourceManifestSha256),
      modelInputContractVersion:
        AI_CHART_D1_P1_MODEL_INPUT_CONTRACT_VERSION,
      modelInputFingerprint: parseSha(record.modelInputFingerprint),
      outputContractVersion: AI_CHART_D1_P1_F1_CONTRACT_VERSION,
      outputSchemaName: AI_CHART_D1_P1_SCHEMA_NAME,
      outputSchemaSha256: AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256,
      instructions: AI_CHART_D1_P1_PROMPT_INSTRUCTIONS,
      instructionsSha256: AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256,
      userInput,
      userInputSha256: parseSha(record.userInputSha256),
      sourceTrace: parseSourceTrace(record.sourceTrace),
      budget: parseBudget(
        record.budget,
        AI_CHART_D1_P1_PROMPT_INSTRUCTIONS,
        userInput,
      ),
      promptStatus: 'ready',
      adapterStatus: 'adapter_bridge_required',
      openAiCallable: false,
      packageFingerprint: parseSha(record.packageFingerprint),
    })
  } catch (error) {
    if (error instanceof AiChartD1P1PromptPackageError) throw error
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
const SOURCE_TRACE_SCHEMA = createAiChartD1StrictObjectSchema({
  modelInputFingerprint: SHA_SCHEMA,
  ruleIds: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 1,
    maximumItems: 256,
  }),
  meaningReferences: createAiChartD1ArraySchema(
    createAiChartD1StringSchema({ maximumLength: 256 }),
    { minimumItems: 1, maximumItems: 128 },
  ),
  selectionTraceRuleIds: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 1,
    maximumItems: 256,
  }),
})
const BUDGET_SCHEMA = createAiChartD1StrictObjectSchema({
  measurement: freezeAiChartD1Value({ const: 'utf8_bytes' }),
  instructionsUtf8Bytes: freezeAiChartD1Value({
    type: 'integer',
    minimum: 0,
    maximum: AI_CHART_D1_P1_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES,
  }),
  userInputUtf8Bytes: freezeAiChartD1Value({
    type: 'integer',
    minimum: 0,
    maximum: AI_CHART_D1_P1_PROMPT_MAX_USER_INPUT_UTF8_BYTES,
  }),
  totalUtf8Bytes: freezeAiChartD1Value({
    type: 'integer',
    minimum: 0,
    maximum: AI_CHART_D1_P1_PROMPT_MAX_TOTAL_UTF8_BYTES,
  }),
  maxInstructionsUtf8Bytes: freezeAiChartD1Value({
    const: AI_CHART_D1_P1_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES,
  }),
  maxUserInputUtf8Bytes: freezeAiChartD1Value({
    const: AI_CHART_D1_P1_PROMPT_MAX_USER_INPUT_UTF8_BYTES,
  }),
  maxTotalUtf8Bytes: freezeAiChartD1Value({
    const: AI_CHART_D1_P1_PROMPT_MAX_TOTAL_UTF8_BYTES,
  }),
  status: freezeAiChartD1Value({ const: 'within_budget' }),
})

export const AI_CHART_D1_P1_PROMPT_PACKAGE_INTERNAL_JSON_SCHEMA: AiChartD1JsonSchema =
  createAiChartD1StrictObjectSchema({
    contractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_PROMPT_PACKAGE_CONTRACT_VERSION,
    }),
    promptVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_PROMPT_VERSION,
    }),
    task: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_PROMPT_PACKAGE_TASK,
    }),
    chartId: ID_SCHEMA,
    runId: ID_SCHEMA,
    callId: ID_SCHEMA,
    targetPalaceId: PALACE_ID_SCHEMA,
    bundleId: ID_SCHEMA,
    catalogId: ID_SCHEMA,
    catalogFingerprint: SHA_SCHEMA,
    sourceManifestSha256: SHA_SCHEMA,
    modelInputContractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_MODEL_INPUT_CONTRACT_VERSION,
    }),
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
    instructions: freezeAiChartD1Value({
      type: 'string',
      const: AI_CHART_D1_P1_PROMPT_INSTRUCTIONS,
      minLength: 1,
      maxLength: AI_CHART_D1_P1_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES,
    }),
    instructionsSha256: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256,
    }),
    userInput: createAiChartD1StringSchema({
      maximumLength: MAX_USER_INPUT_CHARACTERS,
    }),
    userInputSha256: SHA_SCHEMA,
    sourceTrace: SOURCE_TRACE_SCHEMA,
    budget: BUDGET_SCHEMA,
    promptStatus: freezeAiChartD1Value({ const: 'ready' }),
    adapterStatus: freezeAiChartD1Value({
      const: 'adapter_bridge_required',
    }),
    openAiCallable: freezeAiChartD1Value({ const: false }),
    packageFingerprint: SHA_SCHEMA,
  })
