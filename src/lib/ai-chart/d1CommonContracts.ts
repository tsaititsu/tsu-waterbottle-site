export const AI_CHART_D1_P1_F1_CONTRACT_VERSION =
  'ai-chart-d1-p1-f1/v1' as const

export const AI_CHART_D1_CONTRACT_INVALID =
  'ai_chart_d1_contract_invalid' as const

export const AI_CHART_D1_MAX_TEXT_LENGTH = 4_000 as const
export const AI_CHART_D1_MAX_SHORT_TEXT_LENGTH = 512 as const
export const AI_CHART_D1_MAX_LIST_ITEMS = 128 as const
export const AI_CHART_D1_MAX_CANDIDATES_PER_COLLECTION = 64 as const
export const AI_CHART_D1_MAX_LIFE_EXAMPLES = 12 as const

export const AI_CHART_D1_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/

export const AI_CHART_D1_PALACE_NAMES = Object.freeze([
  '命宮',
  '父母宮',
  '福德宮',
  '田宅宮',
  '官祿宮',
  '僕役宮',
  '遷移宮',
  '疾厄宮',
  '財帛宮',
  '子女宮',
  '夫妻宮',
  '兄弟宮',
] as const)

export const AI_CHART_D1_RULE_STATUSES = Object.freeze([
  'teacher_confirmed',
  'lecture_backfill',
  'working_inference',
] as const)

export const AI_CHART_D1_RESULT_STATUSES = Object.freeze([
  'complete',
  'partial',
  'incomplete',
  'invalid',
] as const)

export const AI_CHART_D1_SCOPES = Object.freeze([
  'personality',
  'values',
  'thinking',
  'behavior',
  'relationship_pattern',
  'work_pattern',
  'money_pattern',
  'family_pattern',
  'health_habit',
  'long_term_need',
] as const)

export const AI_CHART_D1_STRUCTURE_BASES = Object.freeze([
  '本宮',
  '對宮',
  '暗合',
  '三方',
  '空宮借星',
  '生年四化',
  '飛化',
  '煞忌',
  '輔星',
  '身宮',
] as const)

export const AI_CHART_D1_INTENSITIES = Object.freeze([
  'background',
  'normal',
  'strong',
] as const)

export type AiChartD1PalaceName = (typeof AI_CHART_D1_PALACE_NAMES)[number]
export type AiChartD1RuleStatus = (typeof AI_CHART_D1_RULE_STATUSES)[number]
export type AiChartD1ResultStatus = (typeof AI_CHART_D1_RESULT_STATUSES)[number]
export type AiChartD1Scope = (typeof AI_CHART_D1_SCOPES)[number]
export type AiChartD1StructureBasis =
  (typeof AI_CHART_D1_STRUCTURE_BASES)[number]
export type AiChartD1Intensity = (typeof AI_CHART_D1_INTENSITIES)[number]

export type AiChartD1Candidate = Readonly<{
  candidateId: string
  statement: string
  lifeExamples: readonly string[]
  scopes: readonly AiChartD1Scope[]
  palaceIds: readonly string[]
  starBasis: readonly string[]
  structureBasis: readonly AiChartD1StructureBasis[]
  usedRuleIds: readonly string[]
  ruleStatus: AiChartD1RuleStatus
  intensity: AiChartD1Intensity
  conflictGroupId: string | null
  d2Boundary: string | null
}>

export type AiChartD1D2Boundary = Readonly<{
  boundaryId: string
  topic: string
  prohibitedD1Conclusion: string
  allowedD1Wording: string
  reason: string
}>

export type AiChartD1TraitTension = Readonly<{
  tensionId: string
  sideA: string
  sideB: string
  coexistenceExplanation: string
  candidateIds: readonly string[]
}>

export const AI_CHART_D1_CANDIDATE_FIELDS = Object.freeze([
  'candidateId',
  'statement',
  'lifeExamples',
  'scopes',
  'palaceIds',
  'starBasis',
  'structureBasis',
  'usedRuleIds',
  'ruleStatus',
  'intensity',
  'conflictGroupId',
  'd2Boundary',
] as const)

export const AI_CHART_D1_D2_BOUNDARY_FIELDS = Object.freeze([
  'boundaryId',
  'topic',
  'prohibitedD1Conclusion',
  'allowedD1Wording',
  'reason',
] as const)

export const AI_CHART_D1_TRAIT_TENSION_FIELDS = Object.freeze([
  'tensionId',
  'sideA',
  'sideB',
  'coexistenceExplanation',
  'candidateIds',
] as const)

export class AiChartD1ContractError extends Error {
  readonly code = AI_CHART_D1_CONTRACT_INVALID

  constructor() {
    super(AI_CHART_D1_CONTRACT_INVALID)
    this.name = 'AiChartD1ContractError'
  }
}

export type AiChartD1PlainRecord = Record<string, unknown>
export type AiChartD1JsonSchema = Record<string, unknown>

function contractInvalid(): never {
  throw new AiChartD1ContractError()
}

function isPlainObject(value: unknown): value is AiChartD1PlainRecord {
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

function assertSafeGraph(
  value: unknown,
  visiting: WeakSet<object>,
  visited: WeakSet<object>,
): void {
  if (value === null || typeof value !== 'object') return
  if (visiting.has(value)) contractInvalid()
  if (visited.has(value)) return

  visiting.add(value)

  if (Array.isArray(value)) {
    const expectedKeys = new Set([
      'length',
      ...Array.from({ length: value.length }, (_, index) => String(index)),
    ])
    const keys = Reflect.ownKeys(value)

    if (
      keys.length !== expectedKeys.size ||
      keys.some((key) => typeof key !== 'string' || !expectedKeys.has(key))
    ) {
      contractInvalid()
    }

    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
        contractInvalid()
      }
      assertSafeGraph(descriptor.value, visiting, visited)
    }
  } else {
    if (!isPlainObject(value)) contractInvalid()

    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') contractInvalid()

      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
        contractInvalid()
      }
      assertSafeGraph(descriptor.value, visiting, visited)
    }
  }

  visiting.delete(value)
  visited.add(value)
}

export function assertAiChartD1SafeGraph(value: unknown): void {
  assertSafeGraph(value, new WeakSet(), new WeakSet())
}

function canonicalizeAiChartD1Value(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeAiChartD1Value)
  }
  if (value === null || typeof value !== 'object') {
    return value
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) =>
        left.localeCompare(right, 'en'),
      )
      .map(([key, entry]) => [
        key,
        canonicalizeAiChartD1Value(entry),
      ]),
  )
}

export function createAiChartD1CanonicalJson(
  value: unknown,
): string {
  assertAiChartD1SafeGraph(value)
  return JSON.stringify(canonicalizeAiChartD1Value(value))
}

export function requireAiChartD1ExactObject(
  value: unknown,
  fields: readonly string[],
): AiChartD1PlainRecord {
  if (!isPlainObject(value)) contractInvalid()

  const keys = Reflect.ownKeys(value)
  const expected = new Set(fields)
  if (
    keys.length !== expected.size ||
    keys.some((key) => typeof key !== 'string' || !expected.has(key))
  ) {
    contractInvalid()
  }

  for (const key of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
      contractInvalid()
    }
  }

  return value
}

export function parseAiChartD1Text(
  value: unknown,
  maximumLength: number = AI_CHART_D1_MAX_TEXT_LENGTH,
): string {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > maximumLength
  ) {
    contractInvalid()
  }
  return value
}

export function parseAiChartD1Id(value: unknown): string {
  if (typeof value !== 'string' || !AI_CHART_D1_ID_PATTERN.test(value)) {
    contractInvalid()
  }
  return value
}

export function parseAiChartD1NullableText(
  value: unknown,
  maximumLength: number = AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
): string | null {
  return value === null ? null : parseAiChartD1Text(value, maximumLength)
}

export function parseAiChartD1NullableId(value: unknown): string | null {
  return value === null ? null : parseAiChartD1Id(value)
}

export function parseAiChartD1Enum<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    contractInvalid()
  }
  return value as T
}

export function parseAiChartD1StringArray(
  value: unknown,
  options: Readonly<{
    minimumItems?: number
    maximumItems?: number
    itemMaximumLength?: number
    parseItem?: (item: unknown) => string
  }> = {},
): readonly string[] {
  const {
    minimumItems = 0,
    maximumItems = AI_CHART_D1_MAX_LIST_ITEMS,
    itemMaximumLength = AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
    parseItem,
  } = options

  if (
    !Array.isArray(value) ||
    value.length < minimumItems ||
    value.length > maximumItems
  ) {
    contractInvalid()
  }

  const parsed = value.map((item) =>
    parseItem === undefined
      ? parseAiChartD1Text(item, itemMaximumLength)
      : parseItem(item),
  )
  if (new Set(parsed).size !== parsed.length) contractInvalid()
  return Object.freeze(parsed)
}

export function parseAiChartD1Boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') contractInvalid()
  return value
}

export function parseAiChartD1CandidateFields(
  value: unknown,
  exactFields: readonly string[] = AI_CHART_D1_CANDIDATE_FIELDS,
): AiChartD1Candidate {
  const record = requireAiChartD1ExactObject(value, exactFields)

  return Object.freeze({
    candidateId: parseAiChartD1Id(record.candidateId),
    statement: parseAiChartD1Text(record.statement),
    lifeExamples: parseAiChartD1StringArray(record.lifeExamples, {
      minimumItems: 1,
      maximumItems: AI_CHART_D1_MAX_LIFE_EXAMPLES,
    }),
    scopes: Object.freeze(
      parseAiChartD1StringArray(record.scopes, {
        minimumItems: 1,
        parseItem: (item) => parseAiChartD1Enum(item, AI_CHART_D1_SCOPES),
      }) as AiChartD1Scope[],
    ),
    palaceIds: parseAiChartD1StringArray(record.palaceIds, {
      minimumItems: 1,
      parseItem: parseAiChartD1Id,
    }),
    starBasis: parseAiChartD1StringArray(record.starBasis, {
      minimumItems: 1,
    }),
    structureBasis: Object.freeze(
      parseAiChartD1StringArray(record.structureBasis, {
        minimumItems: 1,
        parseItem: (item) =>
          parseAiChartD1Enum(item, AI_CHART_D1_STRUCTURE_BASES),
      }) as AiChartD1StructureBasis[],
    ),
    usedRuleIds: parseAiChartD1StringArray(record.usedRuleIds, {
      minimumItems: 1,
      parseItem: parseAiChartD1Id,
    }),
    ruleStatus: parseAiChartD1Enum(record.ruleStatus, AI_CHART_D1_RULE_STATUSES),
    intensity: parseAiChartD1Enum(record.intensity, AI_CHART_D1_INTENSITIES),
    conflictGroupId: parseAiChartD1NullableId(record.conflictGroupId),
    d2Boundary: parseAiChartD1NullableText(record.d2Boundary),
  })
}

function parseCandidate(value: unknown): AiChartD1Candidate {
  assertAiChartD1SafeGraph(value)
  return parseAiChartD1CandidateFields(value)
}

function parseBoundary(value: unknown): AiChartD1D2Boundary {
  assertAiChartD1SafeGraph(value)
  const record = requireAiChartD1ExactObject(
    value,
    AI_CHART_D1_D2_BOUNDARY_FIELDS,
  )

  return Object.freeze({
    boundaryId: parseAiChartD1Id(record.boundaryId),
    topic: parseAiChartD1Text(record.topic, AI_CHART_D1_MAX_SHORT_TEXT_LENGTH),
    prohibitedD1Conclusion: parseAiChartD1Text(
      record.prohibitedD1Conclusion,
    ),
    allowedD1Wording: parseAiChartD1Text(record.allowedD1Wording),
    reason: parseAiChartD1Text(record.reason),
  })
}

function parseTension(value: unknown): AiChartD1TraitTension {
  assertAiChartD1SafeGraph(value)
  const record = requireAiChartD1ExactObject(
    value,
    AI_CHART_D1_TRAIT_TENSION_FIELDS,
  )

  return Object.freeze({
    tensionId: parseAiChartD1Id(record.tensionId),
    sideA: parseAiChartD1Text(record.sideA),
    sideB: parseAiChartD1Text(record.sideB),
    coexistenceExplanation: parseAiChartD1Text(
      record.coexistenceExplanation,
    ),
    candidateIds: parseAiChartD1StringArray(record.candidateIds, {
      minimumItems: 1,
      parseItem: parseAiChartD1Id,
    }),
  })
}

export function parseAiChartD1Candidate(value: unknown): AiChartD1Candidate {
  try {
    return parseCandidate(value)
  } catch {
    contractInvalid()
  }
}

export function parseAiChartD1D2Boundary(value: unknown): AiChartD1D2Boundary {
  try {
    return parseBoundary(value)
  } catch {
    contractInvalid()
  }
}

export function parseAiChartD1TraitTension(
  value: unknown,
): AiChartD1TraitTension {
  try {
    return parseTension(value)
  } catch {
    contractInvalid()
  }
}

export function freezeAiChartD1Value<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === 'string') {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (descriptor && 'value' in descriptor) {
        freezeAiChartD1Value(descriptor.value)
      }
    }
  }

  return Object.isFrozen(value) ? value : Object.freeze(value)
}

export function createAiChartD1StrictObjectSchema(
  properties: Record<string, unknown>,
): AiChartD1JsonSchema {
  return freezeAiChartD1Value({
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  })
}

export function createAiChartD1StringSchema(
  options: Readonly<{
    maximumLength?: number
    pattern?: string
    enumValues?: readonly string[]
    nullable?: boolean
  }> = {},
): AiChartD1JsonSchema {
  const {
    maximumLength = AI_CHART_D1_MAX_TEXT_LENGTH,
    pattern,
    enumValues,
    nullable = false,
  } = options

  return freezeAiChartD1Value({
    type: nullable ? ['string', 'null'] : 'string',
    minLength: 1,
    maxLength: maximumLength,
    ...(pattern === undefined ? {} : { pattern }),
    ...(enumValues === undefined ? {} : { enum: [...enumValues] }),
  })
}

export function createAiChartD1ArraySchema(
  items: AiChartD1JsonSchema,
  options: Readonly<{
    minimumItems?: number
    maximumItems?: number
  }> = {},
): AiChartD1JsonSchema {
  const {
    minimumItems = 0,
    maximumItems = AI_CHART_D1_MAX_LIST_ITEMS,
  } = options

  return freezeAiChartD1Value({
    type: 'array',
    items,
    minItems: minimumItems,
    maxItems: maximumItems,
  })
}

const ID_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 128,
  pattern: AI_CHART_D1_ID_PATTERN.source,
})
const SHORT_TEXT_SCHEMA = createAiChartD1StringSchema({
  maximumLength: AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
})
const TEXT_SCHEMA = createAiChartD1StringSchema()

export const AI_CHART_D1_CANDIDATE_SCHEMA =
  createAiChartD1StrictObjectSchema({
    candidateId: ID_SCHEMA,
    statement: TEXT_SCHEMA,
    lifeExamples: createAiChartD1ArraySchema(SHORT_TEXT_SCHEMA, {
      minimumItems: 1,
      maximumItems: AI_CHART_D1_MAX_LIFE_EXAMPLES,
    }),
    scopes: createAiChartD1ArraySchema(
      createAiChartD1StringSchema({ enumValues: AI_CHART_D1_SCOPES }),
      { minimumItems: 1 },
    ),
    palaceIds: createAiChartD1ArraySchema(ID_SCHEMA, {
      minimumItems: 1,
    }),
    starBasis: createAiChartD1ArraySchema(SHORT_TEXT_SCHEMA, {
      minimumItems: 1,
    }),
    structureBasis: createAiChartD1ArraySchema(
      createAiChartD1StringSchema({
        enumValues: AI_CHART_D1_STRUCTURE_BASES,
      }),
      { minimumItems: 1 },
    ),
    usedRuleIds: createAiChartD1ArraySchema(ID_SCHEMA, {
      minimumItems: 1,
    }),
    ruleStatus: createAiChartD1StringSchema({
      enumValues: AI_CHART_D1_RULE_STATUSES,
    }),
    intensity: createAiChartD1StringSchema({
      enumValues: AI_CHART_D1_INTENSITIES,
    }),
    conflictGroupId: createAiChartD1StringSchema({
      maximumLength: 128,
      pattern: AI_CHART_D1_ID_PATTERN.source,
      nullable: true,
    }),
    d2Boundary: createAiChartD1StringSchema({
      maximumLength: AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
      nullable: true,
    }),
  })

export const AI_CHART_D1_D2_BOUNDARY_SCHEMA =
  createAiChartD1StrictObjectSchema({
    boundaryId: ID_SCHEMA,
    topic: SHORT_TEXT_SCHEMA,
    prohibitedD1Conclusion: TEXT_SCHEMA,
    allowedD1Wording: TEXT_SCHEMA,
    reason: TEXT_SCHEMA,
  })

export const AI_CHART_D1_TRAIT_TENSION_SCHEMA =
  createAiChartD1StrictObjectSchema({
    tensionId: ID_SCHEMA,
    sideA: TEXT_SCHEMA,
    sideB: TEXT_SCHEMA,
    coexistenceExplanation: TEXT_SCHEMA,
    candidateIds: createAiChartD1ArraySchema(ID_SCHEMA, {
      minimumItems: 1,
    }),
  })
