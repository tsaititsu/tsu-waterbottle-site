import { createHash } from 'node:crypto'
import {
  AI_CHART_D1_ID_PATTERN,
  AI_CHART_D1_MAX_LIST_ITEMS,
  AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
  AI_CHART_D1_MAX_TEXT_LENGTH,
  AI_CHART_D1_P1_F1_CONTRACT_VERSION,
  AI_CHART_D1_RULE_STATUSES,
  assertAiChartD1SafeGraph,
  createAiChartD1ArraySchema,
  createAiChartD1StrictObjectSchema,
  createAiChartD1StringSchema,
  freezeAiChartD1Value,
  parseAiChartD1Boolean,
  parseAiChartD1Enum,
  parseAiChartD1Id,
  parseAiChartD1NullableId,
  parseAiChartD1Text,
  requireAiChartD1ExactObject,
  type AiChartD1JsonSchema,
  type AiChartD1RuleStatus,
} from './d1CommonContracts'
import {
  AI_CHART_D1_K0_BUNDLE_VERSION,
  AI_CHART_D1_K0_CATALOG_ID,
} from './d1K0Registry'
import {
  AI_CHART_D1_K0_D1_SAFETY,
  AI_CHART_D1_K0_PALACE_ROLES,
  AI_CHART_D1_K0_RULE_KINDS,
  AI_CHART_D1_K0_SELECTION_REASONS,
  AI_CHART_D1_K0_SOURCE_AUTHORITIES,
  compareAiChartD1K0Rules,
  type AiChartD1K0RuleKind,
  type AiChartD1K0SelectedMeaning,
  type AiChartD1K0SelectionTrace,
  type AiChartD1K0SourceAuthority,
} from './d1K0Contracts'
import {
  AI_CHART_D1_MAJOR_STAR_NAMES,
  AI_CHART_D1_MODELED_SUPPORTING_STARS,
  AI_CHART_D1_MUTAGEN_TYPES,
  AI_CHART_D1_OBSERVATION_ONLY_STAR_NAMES,
  AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION,
  type AiChartD1PalaceId,
} from './d1N0Constants'
import {
  AI_CHART_D1_P1_STRUCTURAL_INPUT_JSON_SCHEMA,
  type AiChartD1P1StructuralInput,
  type AiChartD1P1StructuralPalace,
  type AiChartD1P1TargetGlobalScan,
} from './d1P1InputContracts'
import { AI_CHART_D1_P1_SCHEMA_NAME } from './d1P1F1Contracts'
import type {
  AiChartD1N0StructuralStatus,
  AiChartD1N0Warning,
} from './d1N0Parser'

export const AI_CHART_D1_P1_MODEL_INPUT_CONTRACT_VERSION =
  'ai-chart-d1-p1-model-input/v1' as const
export const AI_CHART_D1_P1_MODEL_INPUT_SCHEMA_NAME =
  'ai_chart_d1_p1_model_input_v1' as const
export const AI_CHART_D1_P1_MODEL_INPUT_TASK =
  'D1_P1_MODEL_INPUT' as const
export const AI_CHART_D1_P1_MODEL_INPUT_INVALID =
  'ai_chart_d1_p1_model_input_invalid' as const
export const AI_CHART_D1_P1_MODEL_INPUT_NOT_READY =
  'ai_chart_d1_p1_model_input_not_ready' as const

export type AiChartD1P1ModelRule = Readonly<{
  ruleId: string
  kind: AiChartD1K0RuleKind
  title: string
  content: string
  contentSha256: string
  ruleStatus: AiChartD1RuleStatus
  sourceAuthority: AiChartD1K0SourceAuthority
  priority: number
  d1Safety: typeof AI_CHART_D1_K0_D1_SAFETY
}>

export type AiChartD1P1ModelStructuralContext = Readonly<{
  targetPalace: AiChartD1P1StructuralPalace
  oppositePalace: AiChartD1P1StructuralPalace
  hiddenCombinationPalace: AiChartD1P1StructuralPalace
  otherTrinePalaces: readonly AiChartD1P1StructuralPalace[]
  targetGlobalScan: AiChartD1P1TargetGlobalScan
}>

export type AiChartD1P1ModelKnowledgeContext = Readonly<{
  rules: readonly AiChartD1P1ModelRule[]
  meanings: readonly AiChartD1K0SelectedMeaning[]
  selectionTrace: readonly AiChartD1K0SelectionTrace[]
}>

export type AiChartD1P1ModelInput = Readonly<{
  contractVersion: typeof AI_CHART_D1_P1_MODEL_INPUT_CONTRACT_VERSION
  task: typeof AI_CHART_D1_P1_MODEL_INPUT_TASK
  chartId: string
  runId: string
  callId: string
  targetPalaceId: AiChartD1PalaceId
  structuralInputContractVersion: typeof AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION
  knowledgeBundleContractVersion: typeof AI_CHART_D1_K0_BUNDLE_VERSION
  outputContractVersion: typeof AI_CHART_D1_P1_F1_CONTRACT_VERSION
  outputSchemaName: typeof AI_CHART_D1_P1_SCHEMA_NAME
  catalogId: typeof AI_CHART_D1_K0_CATALOG_ID
  catalogFingerprint: string
  sourceManifestSha256: string
  bundleId: string
  structuralContext: AiChartD1P1ModelStructuralContext
  knowledgeContext: AiChartD1P1ModelKnowledgeContext
  structuralStatus: AiChartD1N0StructuralStatus
  knowledgeStatus: 'ready'
  promptStatus: 'prompt_builder_required'
  promptVersion: null
  openAiCallable: false
  warnings: readonly AiChartD1N0Warning[]
  inputFingerprint: string
}>

export type AiChartD1P1ModelInputWithoutFingerprint = Omit<
  AiChartD1P1ModelInput,
  'inputFingerprint'
>

export class AiChartD1P1ModelInputError extends Error {
  readonly code = AI_CHART_D1_P1_MODEL_INPUT_INVALID

  constructor() {
    super(AI_CHART_D1_P1_MODEL_INPUT_INVALID)
    this.name = 'AiChartD1P1ModelInputError'
  }
}

export class AiChartD1P1ModelInputNotReadyError extends Error {
  readonly code = AI_CHART_D1_P1_MODEL_INPUT_NOT_READY

  constructor() {
    super(AI_CHART_D1_P1_MODEL_INPUT_NOT_READY)
    this.name = 'AiChartD1P1ModelInputNotReadyError'
  }
}

export const AI_CHART_D1_P1_MODEL_RULE_FIELDS = Object.freeze([
  'ruleId',
  'kind',
  'title',
  'content',
  'contentSha256',
  'ruleStatus',
  'sourceAuthority',
  'priority',
  'd1Safety',
] as const)

export const AI_CHART_D1_P1_MODEL_STRUCTURAL_CONTEXT_FIELDS = Object.freeze([
  'targetPalace',
  'oppositePalace',
  'hiddenCombinationPalace',
  'otherTrinePalaces',
  'targetGlobalScan',
] as const)

export const AI_CHART_D1_P1_MODEL_KNOWLEDGE_CONTEXT_FIELDS = Object.freeze([
  'rules',
  'meanings',
  'selectionTrace',
] as const)

export const AI_CHART_D1_P1_MODEL_INPUT_FIELDS = Object.freeze([
  'contractVersion',
  'task',
  'chartId',
  'runId',
  'callId',
  'targetPalaceId',
  'structuralInputContractVersion',
  'knowledgeBundleContractVersion',
  'outputContractVersion',
  'outputSchemaName',
  'catalogId',
  'catalogFingerprint',
  'sourceManifestSha256',
  'bundleId',
  'structuralContext',
  'knowledgeContext',
  'structuralStatus',
  'knowledgeStatus',
  'promptStatus',
  'promptVersion',
  'openAiCallable',
  'warnings',
  'inputFingerprint',
] as const)

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const PALACE_ID_PATTERN =
  /^palace:(ming|parents|fortune|property|career|friends|travel|health|wealth|children|spouse|siblings)$/
const SUPPORTING_STAR_NAMES = Object.freeze(
  Object.keys(AI_CHART_D1_MODELED_SUPPORTING_STARS),
)

const FORBIDDEN_DATA_KEYS = new Set([
  'solarDate',
  'lunarDate',
  'timeIndex',
  'gender',
  'fixLeap',
  'fiveElementsClass',
  'decadal',
  'ages',
  'birthInput',
  'completeSnapshot',
  'userId',
  'user_id',
  'reportId',
  'report_id',
  'chartProfileId',
  'payment',
  'merchantOrderNo',
  'email',
  'phone',
  'cookie',
  'bearer',
  'token',
  'sourceFile',
  'sourceLocator',
  'sourcePath',
])

const FORBIDDEN_PROMPT_KEYS = new Set([
  'messages',
  'input',
  'instructions',
  'system',
  'developer',
  'user',
  'model',
  'response_format',
  'temperature',
  'max_output_tokens',
  'tools',
  'tool_choice',
  'store',
  'metadata',
])

type SemanticPathSegment = string | number

function invalid(): never {
  throw new AiChartD1P1ModelInputError()
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

function parseNullableEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null {
  return value === null ? null : parseAiChartD1Enum(value, allowed)
}

function isAllowedStarNamePath(path: readonly SemanticPathSegment[]): boolean {
  const isStarCollection = (value: SemanticPathSegment | undefined) =>
    value === 'canonicalMajorStars' ||
    value === 'modeledSupportingStars' ||
    value === 'observationOnlyStars' ||
    value === 'borrowedMajorStars'

  if (
    path.length === 5 &&
    path[0] === 'structuralContext' &&
    (path[1] === 'targetPalace' ||
      path[1] === 'oppositePalace' ||
      path[1] === 'hiddenCombinationPalace') &&
    isStarCollection(path[2]) &&
    typeof path[3] === 'number' &&
    path[4] === 'name'
  ) {
    return true
  }

  return (
    path.length === 6 &&
    path[0] === 'structuralContext' &&
    path[1] === 'otherTrinePalaces' &&
    typeof path[2] === 'number' &&
    isStarCollection(path[3]) &&
    typeof path[4] === 'number' &&
    path[5] === 'name'
  )
}

function assertAllowedStarNameValue(
  path: readonly SemanticPathSegment[],
  value: unknown,
): void {
  const collection = path[path.length - 3]
  if (
    typeof value !== 'string' ||
    (collection === 'modeledSupportingStars'
      ? !SUPPORTING_STAR_NAMES.includes(value)
      : collection === 'observationOnlyStars'
        ? !AI_CHART_D1_OBSERVATION_ONLY_STAR_NAMES.includes(
            value as (typeof AI_CHART_D1_OBSERVATION_ONLY_STAR_NAMES)[number],
          )
        : !AI_CHART_D1_MAJOR_STAR_NAMES.includes(
          value as (typeof AI_CHART_D1_MAJOR_STAR_NAMES)[number],
        ))
  ) {
    invalid()
  }
}

function assertNoForbiddenData(
  value: unknown,
  path: readonly SemanticPathSegment[],
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertNoForbiddenData(entry, [...path, index]),
    )
    return
  }
  if (value === null || typeof value !== 'object') return

  for (const [key, entry] of Object.entries(value)) {
    const entryPath = [...path, key]
    if (key === 'name') {
      if (!isAllowedStarNamePath(entryPath)) invalid()
      assertAllowedStarNameValue(entryPath, entry)
    } else if (FORBIDDEN_DATA_KEYS.has(key) || FORBIDDEN_PROMPT_KEYS.has(key)) {
      invalid()
    }
    assertNoForbiddenData(entry, entryPath)
  }
}

export function assertAiChartD1P1ModelInputHasNoForbiddenData(
  value: unknown,
): void {
  try {
    assertAiChartD1SafeGraph(value)
    assertNoForbiddenData(value, [])
  } catch (error) {
    if (error instanceof AiChartD1P1ModelInputError) throw error
    invalid()
  }
}

function cloneValue<T>(value: T): T {
  return structuredClone(value)
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

export function stableAiChartD1P1ModelInputEqual(
  left: unknown,
  right: unknown,
): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right))
}

export function createAiChartD1P1ModelInputFingerprint(
  input: AiChartD1P1ModelInputWithoutFingerprint,
): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(input)), 'utf8')
    .digest('hex')
}

function parseModelRule(value: unknown): AiChartD1P1ModelRule {
  const record = requireAiChartD1ExactObject(
    value,
    AI_CHART_D1_P1_MODEL_RULE_FIELDS,
  )
  if (record.d1Safety !== AI_CHART_D1_K0_D1_SAFETY) invalid()
  return Object.freeze({
    ruleId: parseAiChartD1Id(record.ruleId),
    kind: parseAiChartD1Enum(record.kind, AI_CHART_D1_K0_RULE_KINDS),
    title: parseAiChartD1Text(record.title, AI_CHART_D1_MAX_SHORT_TEXT_LENGTH),
    content: parseAiChartD1Text(record.content, AI_CHART_D1_MAX_TEXT_LENGTH),
    contentSha256: parseSha(record.contentSha256),
    ruleStatus: parseAiChartD1Enum(record.ruleStatus, AI_CHART_D1_RULE_STATUSES),
    sourceAuthority: parseAiChartD1Enum(
      record.sourceAuthority,
      AI_CHART_D1_K0_SOURCE_AUTHORITIES,
    ),
    priority: parseInteger(record.priority, -10_000, 10_000),
    d1Safety: AI_CHART_D1_K0_D1_SAFETY,
  })
}

function parseSelectedMeaning(value: unknown): AiChartD1K0SelectedMeaning {
  const record = requireAiChartD1ExactObject(value, [
    'palaceRole',
    'palaceId',
    'meaningId',
    'text',
    'contentSha256',
    'order',
  ])
  const palaceId = parseAiChartD1Id(record.palaceId)
  if (!PALACE_ID_PATTERN.test(palaceId)) invalid()
  return Object.freeze({
    palaceRole: parseAiChartD1Enum(record.palaceRole, AI_CHART_D1_K0_PALACE_ROLES),
    palaceId: palaceId as AiChartD1PalaceId,
    meaningId: parseAiChartD1Id(record.meaningId),
    text: parseAiChartD1Text(record.text, AI_CHART_D1_MAX_SHORT_TEXT_LENGTH),
    contentSha256: parseSha(record.contentSha256),
    order: parseInteger(record.order, 0, 127),
  })
}

function parseSelectionTrace(value: unknown): AiChartD1K0SelectionTrace {
  const record = requireAiChartD1ExactObject(value, [
    'ruleId',
    'reason',
    'palaceRole',
    'palaceId',
    'placementId',
    'starName',
    'mutagenType',
    'structuralReference',
  ])
  const palaceId = parseAiChartD1NullableId(record.palaceId)
  if (palaceId !== null && !PALACE_ID_PATTERN.test(palaceId)) invalid()
  const starName =
    record.starName === null
      ? null
      : parseAiChartD1Text(record.starName, AI_CHART_D1_MAX_SHORT_TEXT_LENGTH)
  return Object.freeze({
    ruleId: parseAiChartD1Id(record.ruleId),
    reason: parseAiChartD1Enum(record.reason, AI_CHART_D1_K0_SELECTION_REASONS),
    palaceRole: parseNullableEnum(record.palaceRole, AI_CHART_D1_K0_PALACE_ROLES),
    palaceId: palaceId as AiChartD1PalaceId | null,
    placementId: parseAiChartD1NullableId(record.placementId),
    starName,
    mutagenType: parseNullableEnum(record.mutagenType, AI_CHART_D1_MUTAGEN_TYPES),
    structuralReference: parseAiChartD1Id(record.structuralReference),
  })
}

function parseArray<T>(
  value: unknown,
  parser: (entry: unknown) => T,
  maximumItems: number,
): readonly T[] {
  if (!Array.isArray(value) || value.length > maximumItems) invalid()
  return Object.freeze(value.map(parser))
}

function parseStructuralContext(
  value: unknown,
): AiChartD1P1ModelStructuralContext {
  requireAiChartD1ExactObject(
    value,
    AI_CHART_D1_P1_MODEL_STRUCTURAL_CONTEXT_FIELDS,
  )
  return freezeAiChartD1Value(
    cloneValue(value) as AiChartD1P1ModelStructuralContext,
  )
}

function parseWarnings(value: unknown): readonly AiChartD1N0Warning[] {
  if (!Array.isArray(value) || value.length > AI_CHART_D1_MAX_LIST_ITEMS) {
    invalid()
  }
  return freezeAiChartD1Value(cloneValue(value) as AiChartD1N0Warning[])
}

export function parseAiChartD1P1ModelInputShape(
  value: unknown,
): AiChartD1P1ModelInput {
  try {
    assertAiChartD1SafeGraph(value)
    assertAiChartD1P1ModelInputHasNoForbiddenData(value)
    const record = requireAiChartD1ExactObject(
      value,
      AI_CHART_D1_P1_MODEL_INPUT_FIELDS,
    )
    const knowledgeRecord = requireAiChartD1ExactObject(
      record.knowledgeContext,
      AI_CHART_D1_P1_MODEL_KNOWLEDGE_CONTEXT_FIELDS,
    )
    const rules = parseArray(knowledgeRecord.rules, parseModelRule, 256)
    const meanings = parseArray(
      knowledgeRecord.meanings,
      parseSelectedMeaning,
      128,
    )
    const selectionTrace = parseArray(
      knowledgeRecord.selectionTrace,
      parseSelectionTrace,
      256,
    )
    const ruleIds = rules.map((rule) => rule.ruleId)
    const meaningIds = meanings.map((meaning) => meaning.meaningId)
    const roleMeaningIds = meanings.map(
      (meaning) => `${meaning.palaceRole}\u0000${meaning.meaningId}`,
    )
    const traceRuleIds = selectionTrace.map((trace) => trace.ruleId)
    if (
      new Set(ruleIds).size !== ruleIds.length ||
      new Set(meaningIds).size !== meaningIds.length ||
      new Set(roleMeaningIds).size !== roleMeaningIds.length ||
      new Set(traceRuleIds).size !== traceRuleIds.length ||
      rules.some(
        (rule, index) =>
          index > 0 && compareAiChartD1K0Rules(rules[index - 1], rule) > 0,
      )
    ) {
      invalid()
    }
    if (
      record.contractVersion !== AI_CHART_D1_P1_MODEL_INPUT_CONTRACT_VERSION ||
      record.task !== AI_CHART_D1_P1_MODEL_INPUT_TASK ||
      record.structuralInputContractVersion !==
        AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION ||
      record.knowledgeBundleContractVersion !== AI_CHART_D1_K0_BUNDLE_VERSION ||
      record.outputContractVersion !== AI_CHART_D1_P1_F1_CONTRACT_VERSION ||
      record.outputSchemaName !== AI_CHART_D1_P1_SCHEMA_NAME ||
      record.catalogId !== AI_CHART_D1_K0_CATALOG_ID ||
      record.knowledgeStatus !== 'ready' ||
      record.promptStatus !== 'prompt_builder_required' ||
      record.promptVersion !== null ||
      parseAiChartD1Boolean(record.openAiCallable) !== false
    ) {
      invalid()
    }
    const targetPalaceId = parseAiChartD1Id(record.targetPalaceId)
    if (!PALACE_ID_PATTERN.test(targetPalaceId)) invalid()

    return freezeAiChartD1Value({
      contractVersion: AI_CHART_D1_P1_MODEL_INPUT_CONTRACT_VERSION,
      task: AI_CHART_D1_P1_MODEL_INPUT_TASK,
      chartId: parseAiChartD1Id(record.chartId),
      runId: parseAiChartD1Id(record.runId),
      callId: parseAiChartD1Id(record.callId),
      targetPalaceId: targetPalaceId as AiChartD1PalaceId,
      structuralInputContractVersion:
        AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION,
      knowledgeBundleContractVersion: AI_CHART_D1_K0_BUNDLE_VERSION,
      outputContractVersion: AI_CHART_D1_P1_F1_CONTRACT_VERSION,
      outputSchemaName: AI_CHART_D1_P1_SCHEMA_NAME,
      catalogId: AI_CHART_D1_K0_CATALOG_ID,
      catalogFingerprint: parseSha(record.catalogFingerprint),
      sourceManifestSha256: parseSha(record.sourceManifestSha256),
      bundleId: parseAiChartD1Id(record.bundleId),
      structuralContext: parseStructuralContext(record.structuralContext),
      knowledgeContext: Object.freeze({ rules, meanings, selectionTrace }),
      structuralStatus: parseAiChartD1Enum(record.structuralStatus, [
        'ready',
        'partial',
      ] as const),
      knowledgeStatus: 'ready',
      promptStatus: 'prompt_builder_required',
      promptVersion: null,
      openAiCallable: false,
      warnings: parseWarnings(record.warnings),
      inputFingerprint: parseSha(record.inputFingerprint),
    })
  } catch (error) {
    if (error instanceof AiChartD1P1ModelInputError) throw error
    invalid()
  }
}

const structuralInputProperties =
  AI_CHART_D1_P1_STRUCTURAL_INPUT_JSON_SCHEMA.properties as Record<
    string,
    AiChartD1JsonSchema
  >
const ID_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 128,
  pattern: AI_CHART_D1_ID_PATTERN.source,
})
const SHA_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 64,
  pattern: SHA256_PATTERN.source,
})
const PALACE_ID_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 128,
  pattern: PALACE_ID_PATTERN.source,
})
const NULL_SCHEMA = freezeAiChartD1Value({ type: 'null' })
const MODEL_RULE_SCHEMA = createAiChartD1StrictObjectSchema({
  ruleId: ID_SCHEMA,
  kind: createAiChartD1StringSchema({ enumValues: AI_CHART_D1_K0_RULE_KINDS }),
  title: createAiChartD1StringSchema({
    maximumLength: AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
  }),
  content: createAiChartD1StringSchema({
    maximumLength: AI_CHART_D1_MAX_TEXT_LENGTH,
  }),
  contentSha256: SHA_SCHEMA,
  ruleStatus: createAiChartD1StringSchema({ enumValues: AI_CHART_D1_RULE_STATUSES }),
  sourceAuthority: createAiChartD1StringSchema({
    enumValues: AI_CHART_D1_K0_SOURCE_AUTHORITIES,
  }),
  priority: freezeAiChartD1Value({
    type: 'integer',
    minimum: -10_000,
    maximum: 10_000,
  }),
  d1Safety: freezeAiChartD1Value({ const: AI_CHART_D1_K0_D1_SAFETY }),
})
const SELECTED_MEANING_SCHEMA = createAiChartD1StrictObjectSchema({
  palaceRole: createAiChartD1StringSchema({
    enumValues: AI_CHART_D1_K0_PALACE_ROLES,
  }),
  palaceId: PALACE_ID_SCHEMA,
  meaningId: ID_SCHEMA,
  text: createAiChartD1StringSchema({
    maximumLength: AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
  }),
  contentSha256: SHA_SCHEMA,
  order: freezeAiChartD1Value({ type: 'integer', minimum: 0, maximum: 127 }),
})
const NULLABLE_ID_SCHEMA = freezeAiChartD1Value({
  anyOf: [ID_SCHEMA, { type: 'null' }],
})
const NULLABLE_PALACE_ID_SCHEMA = freezeAiChartD1Value({
  anyOf: [PALACE_ID_SCHEMA, { type: 'null' }],
})
const NULLABLE_SHORT_TEXT_SCHEMA = freezeAiChartD1Value({
  anyOf: [
    createAiChartD1StringSchema({
      maximumLength: AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
    }),
    { type: 'null' },
  ],
})
const NULLABLE_MUTAGEN_SCHEMA = freezeAiChartD1Value({
  anyOf: [
    createAiChartD1StringSchema({ enumValues: AI_CHART_D1_MUTAGEN_TYPES }),
    { type: 'null' },
  ],
})
const SELECTION_TRACE_SCHEMA = createAiChartD1StrictObjectSchema({
  ruleId: ID_SCHEMA,
  reason: createAiChartD1StringSchema({
    enumValues: AI_CHART_D1_K0_SELECTION_REASONS,
  }),
  palaceRole: freezeAiChartD1Value({
    anyOf: [
      createAiChartD1StringSchema({ enumValues: AI_CHART_D1_K0_PALACE_ROLES }),
      { type: 'null' },
    ],
  }),
  palaceId: NULLABLE_PALACE_ID_SCHEMA,
  placementId: NULLABLE_ID_SCHEMA,
  starName: NULLABLE_SHORT_TEXT_SCHEMA,
  mutagenType: NULLABLE_MUTAGEN_SCHEMA,
  structuralReference: ID_SCHEMA,
})

export const AI_CHART_D1_P1_MODEL_INPUT_INTERNAL_JSON_SCHEMA: AiChartD1JsonSchema =
  createAiChartD1StrictObjectSchema({
    contractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_MODEL_INPUT_CONTRACT_VERSION,
    }),
    task: freezeAiChartD1Value({ const: AI_CHART_D1_P1_MODEL_INPUT_TASK }),
    chartId: ID_SCHEMA,
    runId: ID_SCHEMA,
    callId: ID_SCHEMA,
    targetPalaceId: PALACE_ID_SCHEMA,
    structuralInputContractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_STRUCTURAL_INPUT_CONTRACT_VERSION,
    }),
    knowledgeBundleContractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_K0_BUNDLE_VERSION,
    }),
    outputContractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_P1_F1_CONTRACT_VERSION,
    }),
    outputSchemaName: freezeAiChartD1Value({ const: AI_CHART_D1_P1_SCHEMA_NAME }),
    catalogId: freezeAiChartD1Value({ const: AI_CHART_D1_K0_CATALOG_ID }),
    catalogFingerprint: SHA_SCHEMA,
    sourceManifestSha256: SHA_SCHEMA,
    bundleId: ID_SCHEMA,
    structuralContext: createAiChartD1StrictObjectSchema({
      targetPalace: structuralInputProperties.targetPalace,
      oppositePalace: structuralInputProperties.oppositePalace,
      hiddenCombinationPalace: structuralInputProperties.hiddenCombinationPalace,
      otherTrinePalaces: structuralInputProperties.otherTrinePalaces,
      targetGlobalScan: structuralInputProperties.targetGlobalScan,
    }),
    knowledgeContext: createAiChartD1StrictObjectSchema({
      rules: createAiChartD1ArraySchema(MODEL_RULE_SCHEMA, {
        maximumItems: 256,
      }),
      meanings: createAiChartD1ArraySchema(SELECTED_MEANING_SCHEMA, {
        maximumItems: 128,
      }),
      selectionTrace: createAiChartD1ArraySchema(SELECTION_TRACE_SCHEMA, {
        maximumItems: 256,
      }),
    }),
    structuralStatus: createAiChartD1StringSchema({
      enumValues: ['ready', 'partial'],
    }),
    knowledgeStatus: freezeAiChartD1Value({ const: 'ready' }),
    promptStatus: freezeAiChartD1Value({ const: 'prompt_builder_required' }),
    promptVersion: NULL_SCHEMA,
    openAiCallable: freezeAiChartD1Value({ const: false }),
    warnings: structuralInputProperties.warnings,
    inputFingerprint: SHA_SCHEMA,
  })

export function toAiChartD1P1ModelStructuralContext(
  structuralInput: AiChartD1P1StructuralInput,
): AiChartD1P1ModelStructuralContext {
  return freezeAiChartD1Value(
    cloneValue({
      targetPalace: structuralInput.targetPalace,
      oppositePalace: structuralInput.oppositePalace,
      hiddenCombinationPalace: structuralInput.hiddenCombinationPalace,
      otherTrinePalaces: structuralInput.otherTrinePalaces,
      targetGlobalScan: structuralInput.targetGlobalScan,
    }),
  )
}
