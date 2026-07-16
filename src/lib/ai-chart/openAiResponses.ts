import {
  AI_CHART_D1_MODEL_ENVIRONMENT_VARIABLE,
  AI_CHART_D1_MODEL_TARGET,
} from './d1Assets'

export const AI_CHART_OPENAI_RESPONSES_URL =
  'https://api.openai.com/v1/responses' as const
export const AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT = 'medium' as const
export const AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS = 120_000 as const
export const AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS = 8_192 as const
export const AI_CHART_OPENAI_MIN_TIMEOUT_MS = 1_000 as const
export const AI_CHART_OPENAI_MAX_TIMEOUT_MS = 300_000 as const
export const AI_CHART_OPENAI_MIN_OUTPUT_TOKENS = 256 as const
export const AI_CHART_OPENAI_MAX_OUTPUT_TOKENS = 32_768 as const

export const AI_CHART_OPENAI_CONFIG_INVALID =
  'ai_chart_openai_config_invalid' as const
export const AI_CHART_OPENAI_REQUEST_FAILED =
  'ai_chart_openai_request_failed' as const
export const AI_CHART_OPENAI_TIMEOUT = 'ai_chart_openai_timeout' as const
export const AI_CHART_OPENAI_RESPONSE_INVALID =
  'ai_chart_openai_response_invalid' as const

export type AiChartOpenAiErrorCode =
  | typeof AI_CHART_OPENAI_CONFIG_INVALID
  | typeof AI_CHART_OPENAI_REQUEST_FAILED
  | typeof AI_CHART_OPENAI_TIMEOUT
  | typeof AI_CHART_OPENAI_RESPONSE_INVALID

export type AiChartOpenAiReasoningEffort = 'low' | 'medium' | 'high'

export type AiChartOpenAiUsage = Readonly<{
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  totalTokens: number
}>

export type AiChartOpenAiStructuredResult<T> = Readonly<{
  data: T
  usage: AiChartOpenAiUsage | null
}>

export type AiChartOpenAiStructuredRequest<T> = {
  instructions: string
  userInput: string
  schemaName: string
  description?: string
  schema: Record<string, unknown>
  parseResult: (value: unknown) => T
  reasoningEffort?: AiChartOpenAiReasoningEffort
  timeoutMs?: number
  maxOutputTokens?: number
}

export type ValidatedAiChartOpenAiStructuredRequest<T> = Readonly<{
  instructions: string
  userInput: string
  schemaName: string
  description?: string
  schema: Readonly<Record<string, unknown>>
  parseResult: (value: unknown) => T
  reasoningEffort: AiChartOpenAiReasoningEffort
  timeoutMs: number
  maxOutputTokens: number
}>

export type AiChartOpenAiResponsesBody = Readonly<{
  model: typeof AI_CHART_D1_MODEL_TARGET
  store: false
  stream: false
  background: false
  truncation: 'disabled'
  reasoning: Readonly<{
    effort: AiChartOpenAiReasoningEffort
  }>
  max_output_tokens: number
  instructions: string
  input: ReadonlyArray<
    Readonly<{
      role: 'user'
      content: string
    }>
  >
  text: Readonly<{
    format: Readonly<{
      type: 'json_schema'
      name: string
      description?: string
      strict: true
      schema: Readonly<Record<string, unknown>>
    }>
  }>
}>

type PlainRecord = Record<string, unknown>
type FailureFactory = () => never

const SCHEMA_NAME_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
const REASONING_EFFORTS = new Set<unknown>(['low', 'medium', 'high'])

export class AiChartOpenAiError extends Error {
  readonly code: AiChartOpenAiErrorCode
  readonly retryable: boolean

  constructor(code: AiChartOpenAiErrorCode, retryable: boolean) {
    super(code)
    this.code = code
    this.retryable = retryable
  }
}

function configInvalid(): never {
  throw new AiChartOpenAiError(AI_CHART_OPENAI_CONFIG_INVALID, false)
}

function responseInvalid(): never {
  throw new AiChartOpenAiError(AI_CHART_OPENAI_RESPONSE_INVALID, false)
}

function isPlainObject(value: unknown): value is PlainRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  try {
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  } catch {
    return false
  }
}

function cloneAndFreezeValue(
  value: unknown,
  failure: FailureFactory,
  seen: Set<object> = new Set(),
): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) failure()
    return value
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) failure()
    seen.add(value)

    const keys = Reflect.ownKeys(value)
    const expectedKeys = new Set([
      'length',
      ...Array.from({ length: value.length }, (_, index) => String(index)),
    ])
    if (
      keys.length !== expectedKeys.size ||
      keys.some((key) => typeof key !== 'string' || !expectedKeys.has(key))
    ) {
      failure()
    }

    const clone = value.map((item) => cloneAndFreezeValue(item, failure, seen))
    seen.delete(value)
    return Object.freeze(clone)
  }

  if (!isPlainObject(value)) failure()
  if (seen.has(value)) failure()
  seen.add(value)

  const clone: PlainRecord = {}
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') failure()

    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
      failure()
    }

    clone[key] = cloneAndFreezeValue(descriptor.value, failure, seen)
  }

  seen.delete(value)
  return Object.freeze(clone)
}

function cloneAndFreezeSchema(
  schema: Record<string, unknown>,
): Readonly<Record<string, unknown>> {
  return cloneAndFreezeValue(schema, configInvalid) as Readonly<
    Record<string, unknown>
  >
}

function cloneAndFreezeResult<T>(value: T): T {
  return cloneAndFreezeValue(value, responseInvalid) as T
}

function isReasoningEffort(
  value: unknown,
): value is AiChartOpenAiReasoningEffort {
  return REASONING_EFFORTS.has(value)
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number) {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  )
}

function normalizeUsageInteger(value: unknown): number {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0
    ? value
    : 0
}

export function getAiChartOpenAiModel(
  env: Record<string, string | undefined>,
): typeof AI_CHART_D1_MODEL_TARGET {
  try {
    const configuredModel = env[AI_CHART_D1_MODEL_ENVIRONMENT_VARIABLE]

    if (configuredModel === undefined) return AI_CHART_D1_MODEL_TARGET
    if (configuredModel === AI_CHART_D1_MODEL_TARGET) {
      return AI_CHART_D1_MODEL_TARGET
    }
  } catch {
    configInvalid()
  }

  configInvalid()
}

export function validateAiChartOpenAiStructuredRequest<T>(
  input: AiChartOpenAiStructuredRequest<T>,
): ValidatedAiChartOpenAiStructuredRequest<T> {
  try {
    if (!isPlainObject(input)) configInvalid()

    const {
      instructions,
      userInput,
      schemaName,
      description,
      schema,
      parseResult,
    } = input

    if (
      typeof instructions !== 'string' ||
      instructions.trim().length === 0 ||
      typeof userInput !== 'string' ||
      userInput.trim().length === 0
    ) {
      configInvalid()
    }
    if (
      typeof schemaName !== 'string' ||
      !SCHEMA_NAME_PATTERN.test(schemaName)
    ) {
      configInvalid()
    }
    if (
      description !== undefined &&
      (typeof description !== 'string' || description.trim().length === 0)
    ) {
      configInvalid()
    }
    if (!isPlainObject(schema)) configInvalid()
    if (schema.type !== 'object' || schema.additionalProperties !== false) {
      configInvalid()
    }
    if (!isPlainObject(schema.properties) || !Array.isArray(schema.required)) {
      configInvalid()
    }

    const properties = schema.properties
    const propertyKeys = Reflect.ownKeys(properties)
    if (propertyKeys.some((key) => typeof key !== 'string')) configInvalid()
    if (
      schema.required.some((field) => typeof field !== 'string') ||
      new Set(schema.required).size !== schema.required.length
    ) {
      configInvalid()
    }

    const requiredFields = new Set(schema.required as string[])
    if (
      (propertyKeys as string[]).some((field) => !requiredFields.has(field)) ||
      [...requiredFields].some((field) => !Object.hasOwn(properties, field))
    ) {
      configInvalid()
    }
    if (typeof parseResult !== 'function') configInvalid()

    const reasoningEffort =
      input.reasoningEffort === undefined
        ? AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT
        : input.reasoningEffort
    const timeoutMs =
      input.timeoutMs === undefined
        ? AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS
        : input.timeoutMs
    const maxOutputTokens =
      input.maxOutputTokens === undefined
        ? AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS
        : input.maxOutputTokens

    if (!isReasoningEffort(reasoningEffort)) configInvalid()
    if (
      !isIntegerInRange(
        timeoutMs,
        AI_CHART_OPENAI_MIN_TIMEOUT_MS,
        AI_CHART_OPENAI_MAX_TIMEOUT_MS,
      )
    ) {
      configInvalid()
    }
    if (
      !isIntegerInRange(
        maxOutputTokens,
        AI_CHART_OPENAI_MIN_OUTPUT_TOKENS,
        AI_CHART_OPENAI_MAX_OUTPUT_TOKENS,
      )
    ) {
      configInvalid()
    }

    const validated = {
      instructions,
      userInput,
      schemaName,
      ...(description === undefined ? {} : { description }),
      schema: cloneAndFreezeSchema(schema),
      parseResult,
      reasoningEffort,
      timeoutMs,
      maxOutputTokens,
    }

    return Object.freeze(validated)
  } catch {
    configInvalid()
  }
}

export function buildAiChartOpenAiResponsesBody<T>(
  request: AiChartOpenAiStructuredRequest<T>,
): AiChartOpenAiResponsesBody {
  const validated = validateAiChartOpenAiStructuredRequest(request)
  const format = Object.freeze({
    type: 'json_schema' as const,
    name: validated.schemaName,
    ...(validated.description === undefined
      ? {}
      : { description: validated.description }),
    strict: true as const,
    schema: validated.schema,
  })

  return Object.freeze({
    model: AI_CHART_D1_MODEL_TARGET,
    store: false,
    stream: false,
    background: false,
    truncation: 'disabled' as const,
    reasoning: Object.freeze({
      effort: validated.reasoningEffort,
    }),
    max_output_tokens: validated.maxOutputTokens,
    instructions: validated.instructions,
    input: Object.freeze([
      Object.freeze({
        role: 'user' as const,
        content: validated.userInput,
      }),
    ]),
    text: Object.freeze({
      format,
    }),
  })
}

export function parseAiChartOpenAiStructuredResponse<T>(
  value: unknown,
  parseResult: (value: unknown) => T,
): AiChartOpenAiStructuredResult<T> {
  try {
    if (!isPlainObject(value) || value.status !== 'completed') {
      responseInvalid()
    }
    if (
      (value.error !== undefined && value.error !== null) ||
      (value.incomplete_details !== undefined &&
        value.incomplete_details !== null) ||
      !Array.isArray(value.output) ||
      typeof parseResult !== 'function'
    ) {
      responseInvalid()
    }

    let outputText: string | undefined

    for (const outputItem of value.output) {
      if (
        !isPlainObject(outputItem) ||
        outputItem.type !== 'message' ||
        (outputItem.status !== undefined &&
          outputItem.status !== 'completed') ||
        !Array.isArray(outputItem.content)
      ) {
        responseInvalid()
      }

      for (const contentItem of outputItem.content) {
        if (!isPlainObject(contentItem)) responseInvalid()
        if (contentItem.type === 'refusal') responseInvalid()
        if (
          contentItem.type !== 'output_text' ||
          typeof contentItem.text !== 'string' ||
          contentItem.text.trim().length === 0 ||
          outputText !== undefined
        ) {
          responseInvalid()
        }

        outputText = contentItem.text
      }
    }

    if (outputText === undefined) responseInvalid()

    const parsed = parseResult(JSON.parse(outputText) as unknown)
    const usageValue = value.usage
    let usage: AiChartOpenAiUsage | null = null

    if (usageValue !== undefined) {
      if (!isPlainObject(usageValue)) responseInvalid()

      const outputTokenDetails = isPlainObject(
        usageValue.output_tokens_details,
      )
        ? usageValue.output_tokens_details
        : undefined

      usage = Object.freeze({
        inputTokens: normalizeUsageInteger(usageValue.input_tokens),
        outputTokens: normalizeUsageInteger(usageValue.output_tokens),
        reasoningTokens: normalizeUsageInteger(
          outputTokenDetails?.reasoning_tokens,
        ),
        totalTokens: normalizeUsageInteger(usageValue.total_tokens),
      })
    }

    return Object.freeze({
      data: cloneAndFreezeResult(parsed),
      usage,
    })
  } catch {
    responseInvalid()
  }
}
