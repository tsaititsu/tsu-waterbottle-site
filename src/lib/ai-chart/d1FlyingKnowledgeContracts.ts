import {
  AI_CHART_D1_MAX_LIST_ITEMS,
  AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
  AI_CHART_D1_MAX_TEXT_LENGTH,
  AI_CHART_D1_RULE_STATUSES,
  assertAiChartD1SafeGraph,
  createAiChartD1ArraySchema,
  createAiChartD1StrictObjectSchema,
  createAiChartD1StringSchema,
  freezeAiChartD1Value,
  parseAiChartD1Boolean,
  parseAiChartD1Enum,
  parseAiChartD1Id,
  parseAiChartD1StringArray,
  parseAiChartD1Text,
  requireAiChartD1ExactObject,
  type AiChartD1JsonSchema,
  type AiChartD1RuleStatus,
} from './d1CommonContracts'
import {
  AI_CHART_D1_FLYING_TRANSFORMATION_KINDS,
  type AiChartD1FlyingTransformationKind,
  type AiChartD1FlyingTransformedStarName,
} from './d1FlyingInfluenceContracts'
import {
  AI_CHART_D1_FLYING_MODEL_INPUT_SET_VERSION,
  parseAiChartD1FlyingModelInputSet,
  type AiChartD1FlyingModelInput,
  type AiChartD1FlyingModelInputSet,
} from './d1FlyingModelInputContracts'
import {
  AI_CHART_D1_K0_SOURCE_AUTHORITIES,
  parseAiChartD1K0Catalog,
  type AiChartD1K0Catalog,
  type AiChartD1K0PalaceMeaning,
  type AiChartD1K0Rule,
  type AiChartD1K0SourceAuthority,
} from './d1K0Contracts'
import {
  AI_CHART_D1_K0_MUTAGEN_SLUGS,
  getAiChartD1K0StarSlug,
} from './d1K0Registry'
import {
  AI_CHART_D1_MAJOR_STAR_NAMES,
  AI_CHART_D1_MODELED_SUPPORTING_STARS,
  AI_CHART_D1_PALACE_IDENTITIES,
  type AiChartD1MutagenType,
  type AiChartD1PalaceId,
} from './d1N0Constants'
import {
  AI_CHART_D1_ACTOR_BINDING_IDS,
  AI_CHART_D1_ACTOR_BINDING_REGISTRY,
  AI_CHART_D1_PALACE_AXIS_ACTORS,
  type AiChartD1ActorBinding,
  type AiChartD1ActorBindingId,
  type AiChartD1PalaceAxisActor,
} from './d1PalaceActorBindingRegistry'
import {
  AI_CHART_D1_PALACE_FACET_IDS,
  type AiChartD1PalaceFacetId,
} from './d1PalaceFacetRegistry'

export const AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_VERSION =
  'ai-chart-d1-flying-knowledge-view/v1' as const
export const AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_SET_VERSION =
  'ai-chart-d1-flying-knowledge-view-set/v1' as const
export const AI_CHART_D1_FLYING_FORMULA_POLICY_VERSION =
  'ai-chart-d1-flying-formula-policy/v1' as const
export const AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_SET_SCHEMA_NAME =
  'ai_chart_d1_flying_knowledge_view_set_v1' as const
export const AI_CHART_D1_FLYING_KNOWLEDGE_INVALID =
  'ai_chart_d1_flying_knowledge_invalid' as const

export const AI_CHART_D1_FLYING_KNOWLEDGE_VALIDATION_REASONS =
  Object.freeze([
    'INPUT_SET_INVALID',
    'KNOWLEDGE_NOT_READY',
    'STAR_CORE_RULE_MISMATCH',
    'KNOWLEDGE_VIEW_SHAPE_INVALID',
    'KNOWLEDGE_VIEW_MISMATCH',
  ] as const)

export type AiChartD1FlyingKnowledgeValidationReason =
  (typeof AI_CHART_D1_FLYING_KNOWLEDGE_VALIDATION_REASONS)[number]

export const AI_CHART_D1_FLYING_CAUSAL_ORDER = Object.freeze([
  'SOURCE_PALACE',
  'TARGET_PALACE',
  'TRANSFORMED_STAR_CORE',
  'TRANSFORMATION_ACTION',
] as const)
export const AI_CHART_D1_FLYING_LIFE_BRIDGE_STAGES = Object.freeze([
  'SOURCE_EXPERIENCE',
  'INNER_EFFECT',
  'REPEATED_BEHAVIOR',
  'POSSIBLE_OUTCOME',
] as const)

export type AiChartD1FlyingKnowledgeRuleView = Readonly<{
  ruleId: string
  title: string
  content: string
  contentSha256: string
  ruleStatus: AiChartD1RuleStatus
  sourceAuthority: AiChartD1K0SourceAuthority
  sourceFile: string
  sourceFileSha256: string
}>

export type AiChartD1FlyingKnowledgeMeaningView = Readonly<{
  meaningId: string
  palaceId: AiChartD1PalaceId
  text: string
  contentSha256: string
  order: number
  sourceFile: string
  sourceFileSha256: string
}>

export type AiChartD1FlyingActorBindingView = Readonly<{
  bindingId: AiChartD1ActorBindingId
  actor: AiChartD1PalaceAxisActor
  subjectKind: AiChartD1ActorBinding['subjectKind']
  ruleSourceRefs: readonly string[]
}>

export type AiChartD1FlyingFormulaPolicy = Readonly<{
  formulaVersion: typeof AI_CHART_D1_FLYING_FORMULA_POLICY_VERSION
  causalOrder: typeof AI_CHART_D1_FLYING_CAUSAL_ORDER
  lifeBridgeStages: typeof AI_CHART_D1_FLYING_LIFE_BRIDGE_STAGES
  sourceActorPolicy: 'PRESERVE_ALL_FACT_CANDIDATES'
  targetFacetPolicy: 'SELECT_ONE_REGISTRY_FACET'
  directCausePolicy: 'DIRECT_PALACE_CAUSE_FIRST'
  oppositeCausePolicy: 'ONLY_WHEN_FACT_PROVIDES_REF'
  natalBackgroundPolicy: 'TRIGGER_OR_AMPLIFY_NOT_REPLACE'
  eventBoundary: 'D1_POSSIBILITY_NOT_OCCURRED_EVENT'
}>

export type AiChartD1FlyingKnowledgeView = Readonly<{
  contractVersion: typeof AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_VERSION
  flyingKnowledgeViewId: string
  chartId: string
  runId: string
  flyingModelInputRef: string
  flyingFactRef: string
  sourcePalaceId: AiChartD1PalaceId
  targetPalaceId: AiChartD1PalaceId
  transformedStarName: AiChartD1FlyingTransformedStarName
  transformationKind: AiChartD1FlyingTransformationKind
  sourceActorBindings: readonly AiChartD1FlyingActorBindingView[]
  sourcePalaceMeanings: readonly AiChartD1FlyingKnowledgeMeaningView[]
  targetPalaceMeanings: readonly AiChartD1FlyingKnowledgeMeaningView[]
  transformedStarCoreRule: AiChartD1FlyingKnowledgeRuleView
  transformationCommonRule: AiChartD1FlyingKnowledgeRuleView
  transformationSpecificRule: AiChartD1FlyingKnowledgeRuleView
  eligibleTargetFacetIds: readonly AiChartD1PalaceFacetId[]
  formulaPolicy: AiChartD1FlyingFormulaPolicy
  knowledgeStatus: 'ready'
  openAiCallable: false
  validationStatus: 'validated'
}>

export type AiChartD1FlyingKnowledgeViewSet = Readonly<{
  contractVersion:
    typeof AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_SET_VERSION
  chartId: string
  runId: string
  sourceModelInputSetVersion:
    typeof AI_CHART_D1_FLYING_MODEL_INPUT_SET_VERSION
  catalogId: string
  catalogFingerprint: string
  sourceManifestSha256: string
  views: readonly AiChartD1FlyingKnowledgeView[]
  openAiCallable: false
  validationStatus: 'validated'
}>

export class AiChartD1FlyingKnowledgeError extends Error {
  readonly code = AI_CHART_D1_FLYING_KNOWLEDGE_INVALID
  declare readonly reasonCode: AiChartD1FlyingKnowledgeValidationReason

  constructor(reasonCode: AiChartD1FlyingKnowledgeValidationReason) {
    super(AI_CHART_D1_FLYING_KNOWLEDGE_INVALID)
    this.name = 'AiChartD1FlyingKnowledgeError'
    Object.defineProperty(this, 'reasonCode', {
      value: reasonCode,
      enumerable: true,
      writable: false,
      configurable: false,
    })
    Object.freeze(this)
  }
}

const FLYING_STAR_NAMES = Object.freeze([
  ...AI_CHART_D1_MAJOR_STAR_NAMES,
  ...Object.keys(AI_CHART_D1_MODELED_SUPPORTING_STARS).filter(
    (name) =>
      name === '文昌' ||
      name === '文曲' ||
      name === '左輔' ||
      name === '右弼',
  ),
] as readonly AiChartD1FlyingTransformedStarName[])

const TRANSFORMATION_TYPES = freezeAiChartD1Value<
  Readonly<
    Record<AiChartD1FlyingTransformationKind, AiChartD1MutagenType>
  >
>({
  LU: '化祿',
  QUAN: '化權',
  KE: '化科',
  JI: '化忌',
})

export const AI_CHART_D1_FLYING_FORMULA_POLICY =
  freezeAiChartD1Value<AiChartD1FlyingFormulaPolicy>({
    formulaVersion: AI_CHART_D1_FLYING_FORMULA_POLICY_VERSION,
    causalOrder: AI_CHART_D1_FLYING_CAUSAL_ORDER,
    lifeBridgeStages: AI_CHART_D1_FLYING_LIFE_BRIDGE_STAGES,
    sourceActorPolicy: 'PRESERVE_ALL_FACT_CANDIDATES',
    targetFacetPolicy: 'SELECT_ONE_REGISTRY_FACET',
    directCausePolicy: 'DIRECT_PALACE_CAUSE_FIRST',
    oppositeCausePolicy: 'ONLY_WHEN_FACT_PROVIDES_REF',
    natalBackgroundPolicy: 'TRIGGER_OR_AMPLIFY_NOT_REPLACE',
    eventBoundary: 'D1_POSSIBILITY_NOT_OCCURRED_EVENT',
  })

const RULE_FIELDS = Object.freeze([
  'ruleId',
  'title',
  'content',
  'contentSha256',
  'ruleStatus',
  'sourceAuthority',
  'sourceFile',
  'sourceFileSha256',
] as const)
const MEANING_FIELDS = Object.freeze([
  'meaningId',
  'palaceId',
  'text',
  'contentSha256',
  'order',
  'sourceFile',
  'sourceFileSha256',
] as const)
const ACTOR_FIELDS = Object.freeze([
  'bindingId',
  'actor',
  'subjectKind',
  'ruleSourceRefs',
] as const)
const FORMULA_FIELDS = Object.freeze([
  'formulaVersion',
  'causalOrder',
  'lifeBridgeStages',
  'sourceActorPolicy',
  'targetFacetPolicy',
  'directCausePolicy',
  'oppositeCausePolicy',
  'natalBackgroundPolicy',
  'eventBoundary',
] as const)
const VIEW_FIELDS = Object.freeze([
  'contractVersion',
  'flyingKnowledgeViewId',
  'chartId',
  'runId',
  'flyingModelInputRef',
  'flyingFactRef',
  'sourcePalaceId',
  'targetPalaceId',
  'transformedStarName',
  'transformationKind',
  'sourceActorBindings',
  'sourcePalaceMeanings',
  'targetPalaceMeanings',
  'transformedStarCoreRule',
  'transformationCommonRule',
  'transformationSpecificRule',
  'eligibleTargetFacetIds',
  'formulaPolicy',
  'knowledgeStatus',
  'openAiCallable',
  'validationStatus',
] as const)
const SET_FIELDS = Object.freeze([
  'contractVersion',
  'chartId',
  'runId',
  'sourceModelInputSetVersion',
  'catalogId',
  'catalogFingerprint',
  'sourceManifestSha256',
  'views',
  'openAiCallable',
  'validationStatus',
] as const)

function invalid(
  reasonCode: AiChartD1FlyingKnowledgeValidationReason,
): never {
  throw new AiChartD1FlyingKnowledgeError(reasonCode)
}

function parseSha(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    invalid('KNOWLEDGE_VIEW_SHAPE_INVALID')
  }
  return value
}

function parseOrder(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 31
  ) {
    invalid('KNOWLEDGE_VIEW_SHAPE_INVALID')
  }
  return value
}

function parsePalaceId(value: unknown): AiChartD1PalaceId {
  return parseAiChartD1Enum(
    value,
    AI_CHART_D1_PALACE_IDENTITIES.map(
      (identity) => identity.palaceId,
    ),
  )
}

function parseRuleView(
  value: unknown,
): AiChartD1FlyingKnowledgeRuleView {
  const record = requireAiChartD1ExactObject(value, RULE_FIELDS)
  return freezeAiChartD1Value({
    ruleId: parseAiChartD1Id(record.ruleId),
    title: parseAiChartD1Text(
      record.title,
      AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
    ),
    content: parseAiChartD1Text(
      record.content,
      AI_CHART_D1_MAX_TEXT_LENGTH,
    ),
    contentSha256: parseSha(record.contentSha256),
    ruleStatus: parseAiChartD1Enum(
      record.ruleStatus,
      AI_CHART_D1_RULE_STATUSES,
    ),
    sourceAuthority: parseAiChartD1Enum(
      record.sourceAuthority,
      AI_CHART_D1_K0_SOURCE_AUTHORITIES,
    ),
    sourceFile: parseAiChartD1Text(
      record.sourceFile,
      AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
    ),
    sourceFileSha256: parseSha(record.sourceFileSha256),
  })
}

function parseMeaningView(
  value: unknown,
): AiChartD1FlyingKnowledgeMeaningView {
  const record = requireAiChartD1ExactObject(value, MEANING_FIELDS)
  return freezeAiChartD1Value({
    meaningId: parseAiChartD1Id(record.meaningId),
    palaceId: parsePalaceId(record.palaceId),
    text: parseAiChartD1Text(
      record.text,
      AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
    ),
    contentSha256: parseSha(record.contentSha256),
    order: parseOrder(record.order),
    sourceFile: parseAiChartD1Text(
      record.sourceFile,
      AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
    ),
    sourceFileSha256: parseSha(record.sourceFileSha256),
  })
}

function parseActorView(
  value: unknown,
): AiChartD1FlyingActorBindingView {
  const record = requireAiChartD1ExactObject(value, ACTOR_FIELDS)
  const bindingId = parseAiChartD1Enum(
    record.bindingId,
    AI_CHART_D1_ACTOR_BINDING_IDS,
  )
  const registryBinding = AI_CHART_D1_ACTOR_BINDING_REGISTRY.find(
    (binding) => binding.bindingId === bindingId,
  )
  if (registryBinding === undefined) {
    invalid('KNOWLEDGE_VIEW_SHAPE_INVALID')
  }
  const actor = parseAiChartD1Enum(
    record.actor,
    AI_CHART_D1_PALACE_AXIS_ACTORS,
  )
  const subjectKind = parseAiChartD1Enum(
    record.subjectKind,
    AI_CHART_D1_ACTOR_BINDING_REGISTRY.map(
      (binding) => binding.subjectKind,
    ),
  )
  const ruleSourceRefs = parseAiChartD1StringArray(
    record.ruleSourceRefs,
    {
      minimumItems: 1,
      maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
      parseItem: parseAiChartD1Id,
    },
  )
  if (
    actor !== registryBinding.actor ||
    subjectKind !== registryBinding.subjectKind ||
    JSON.stringify(ruleSourceRefs) !==
      JSON.stringify(registryBinding.ruleSourceRefs)
  ) {
    invalid('KNOWLEDGE_VIEW_SHAPE_INVALID')
  }
  return freezeAiChartD1Value({
    bindingId,
    actor,
    subjectKind,
    ruleSourceRefs,
  })
}

function parseFormulaPolicy(
  value: unknown,
): AiChartD1FlyingFormulaPolicy {
  requireAiChartD1ExactObject(value, FORMULA_FIELDS)
  if (
    JSON.stringify(value) !==
    JSON.stringify(AI_CHART_D1_FLYING_FORMULA_POLICY)
  ) {
    invalid('KNOWLEDGE_VIEW_SHAPE_INVALID')
  }
  return AI_CHART_D1_FLYING_FORMULA_POLICY
}

function parseArray<T>(
  value: unknown,
  parser: (item: unknown) => T,
  minimumItems: number,
  maximumItems: number,
): readonly T[] {
  if (
    !Array.isArray(value) ||
    value.length < minimumItems ||
    value.length > maximumItems
  ) {
    invalid('KNOWLEDGE_VIEW_SHAPE_INVALID')
  }
  return Object.freeze(value.map(parser))
}

export function parseAiChartD1FlyingKnowledgeView(
  value: unknown,
): AiChartD1FlyingKnowledgeView {
  const record = requireAiChartD1ExactObject(value, VIEW_FIELDS)
  if (
    record.contractVersion !==
      AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_VERSION ||
    parseAiChartD1Boolean(record.openAiCallable) !== false ||
    record.knowledgeStatus !== 'ready' ||
    record.validationStatus !== 'validated'
  ) {
    invalid('KNOWLEDGE_VIEW_SHAPE_INVALID')
  }
  return freezeAiChartD1Value({
    contractVersion: AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_VERSION,
    flyingKnowledgeViewId: parseAiChartD1Id(
      record.flyingKnowledgeViewId,
    ),
    chartId: parseAiChartD1Id(record.chartId),
    runId: parseAiChartD1Id(record.runId),
    flyingModelInputRef: parseAiChartD1Id(
      record.flyingModelInputRef,
    ),
    flyingFactRef: parseAiChartD1Id(record.flyingFactRef),
    sourcePalaceId: parsePalaceId(record.sourcePalaceId),
    targetPalaceId: parsePalaceId(record.targetPalaceId),
    transformedStarName: parseAiChartD1Enum(
      record.transformedStarName,
      FLYING_STAR_NAMES,
    ),
    transformationKind: parseAiChartD1Enum(
      record.transformationKind,
      AI_CHART_D1_FLYING_TRANSFORMATION_KINDS,
    ),
    sourceActorBindings: parseArray(
      record.sourceActorBindings,
      parseActorView,
      1,
      AI_CHART_D1_ACTOR_BINDING_IDS.length,
    ),
    sourcePalaceMeanings: parseArray(
      record.sourcePalaceMeanings,
      parseMeaningView,
      1,
      AI_CHART_D1_MAX_LIST_ITEMS,
    ),
    targetPalaceMeanings: parseArray(
      record.targetPalaceMeanings,
      parseMeaningView,
      1,
      AI_CHART_D1_MAX_LIST_ITEMS,
    ),
    transformedStarCoreRule: parseRuleView(
      record.transformedStarCoreRule,
    ),
    transformationCommonRule: parseRuleView(
      record.transformationCommonRule,
    ),
    transformationSpecificRule: parseRuleView(
      record.transformationSpecificRule,
    ),
    eligibleTargetFacetIds: parseAiChartD1StringArray(
      record.eligibleTargetFacetIds,
      {
        minimumItems: 1,
        maximumItems: AI_CHART_D1_PALACE_FACET_IDS.length,
        parseItem: (item) =>
          parseAiChartD1Enum(item, AI_CHART_D1_PALACE_FACET_IDS),
      },
    ) as readonly AiChartD1PalaceFacetId[],
    formulaPolicy: parseFormulaPolicy(record.formulaPolicy),
    knowledgeStatus: 'ready' as const,
    openAiCallable: false as const,
    validationStatus: 'validated' as const,
  })
}

export function parseAiChartD1FlyingKnowledgeViewSet(
  value: unknown,
): AiChartD1FlyingKnowledgeViewSet {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(value, SET_FIELDS)
    if (
      record.contractVersion !==
        AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_SET_VERSION ||
      record.sourceModelInputSetVersion !==
        AI_CHART_D1_FLYING_MODEL_INPUT_SET_VERSION ||
      parseAiChartD1Boolean(record.openAiCallable) !== false ||
      record.validationStatus !== 'validated'
    ) {
      invalid('KNOWLEDGE_VIEW_SHAPE_INVALID')
    }
    const views = parseArray(
      record.views,
      parseAiChartD1FlyingKnowledgeView,
      48,
      48,
    )
    const chartId = parseAiChartD1Id(record.chartId)
    const runId = parseAiChartD1Id(record.runId)
    if (
      new Set(views.map((view) => view.flyingKnowledgeViewId))
        .size !== 48 ||
      views.some(
        (view) =>
          view.chartId !== chartId || view.runId !== runId,
      )
    ) {
      invalid('KNOWLEDGE_VIEW_SHAPE_INVALID')
    }
    return freezeAiChartD1Value({
      contractVersion:
        AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_SET_VERSION,
      chartId,
      runId,
      sourceModelInputSetVersion:
        AI_CHART_D1_FLYING_MODEL_INPUT_SET_VERSION,
      catalogId: parseAiChartD1Id(record.catalogId),
      catalogFingerprint: parseSha(record.catalogFingerprint),
      sourceManifestSha256: parseSha(record.sourceManifestSha256),
      views,
      openAiCallable: false as const,
      validationStatus: 'validated' as const,
    })
  } catch (error) {
    if (error instanceof AiChartD1FlyingKnowledgeError) {
      throw error
    }
    invalid('KNOWLEDGE_VIEW_SHAPE_INVALID')
  }
}

function parseTrustedInputSet(
  value: unknown,
): AiChartD1FlyingModelInputSet {
  try {
    return parseAiChartD1FlyingModelInputSet(value)
  } catch {
    invalid('INPUT_SET_INVALID')
  }
}

function parseTrustedCatalog(value: unknown): AiChartD1K0Catalog {
  try {
    return parseAiChartD1K0Catalog(value)
  } catch {
    invalid('KNOWLEDGE_NOT_READY')
  }
}

function expectedStarCoreRuleId(
  starName: AiChartD1FlyingTransformedStarName,
): string {
  const slug = getAiChartD1K0StarSlug(starName)
  if (slug === null) invalid('KNOWLEDGE_NOT_READY')
  return AI_CHART_D1_MAJOR_STAR_NAMES.includes(
    starName as (typeof AI_CHART_D1_MAJOR_STAR_NAMES)[number],
  )
    ? `rule:star:${slug}:core`
    : `rule:supporting:${slug}:core`
}

function requiredRule(
  catalog: AiChartD1K0Catalog,
  ruleId: string,
): AiChartD1K0Rule {
  const rule = catalog.rules.find(
    (candidate) => candidate.ruleId === ruleId,
  )
  if (rule === undefined) invalid('KNOWLEDGE_NOT_READY')
  return rule
}

function selectMeanings(
  catalog: AiChartD1K0Catalog,
  palaceId: AiChartD1PalaceId,
): readonly AiChartD1K0PalaceMeaning[] {
  const meanings = catalog.palaceMeanings.filter(
    (meaning) => meaning.palaceId === palaceId,
  )
  if (meanings.length === 0) invalid('KNOWLEDGE_NOT_READY')
  return meanings
}

function compactRule(
  rule: AiChartD1K0Rule,
): AiChartD1FlyingKnowledgeRuleView {
  return freezeAiChartD1Value({
    ruleId: rule.ruleId,
    title: rule.title,
    content: rule.content,
    contentSha256: rule.contentSha256,
    ruleStatus: rule.ruleStatus,
    sourceAuthority: rule.sourceAuthority,
    sourceFile: rule.sourceFile,
    sourceFileSha256: rule.sourceFileSha256,
  })
}

function compactMeaning(
  meaning: AiChartD1K0PalaceMeaning,
): AiChartD1FlyingKnowledgeMeaningView {
  return freezeAiChartD1Value({
    meaningId: meaning.meaningId,
    palaceId: meaning.palaceId,
    text: meaning.text,
    contentSha256: meaning.contentSha256,
    order: meaning.order,
    sourceFile: meaning.sourceFile,
    sourceFileSha256: meaning.sourceFileSha256,
  })
}

function selectActors(
  input: AiChartD1FlyingModelInput,
): readonly AiChartD1FlyingActorBindingView[] {
  return freezeAiChartD1Value(
    input.flyingFact.sourceActorBindingRefs.map((bindingId) => {
      const binding = AI_CHART_D1_ACTOR_BINDING_REGISTRY.find(
        (candidate) => candidate.bindingId === bindingId,
      )
      if (binding === undefined) invalid('KNOWLEDGE_NOT_READY')
      return {
        bindingId: binding.bindingId,
        actor: binding.actor,
        subjectKind: binding.subjectKind,
        ruleSourceRefs: [...binding.ruleSourceRefs],
      }
    }),
  )
}

function selectSpecificRule(
  input: AiChartD1FlyingModelInput,
  catalog: AiChartD1K0Catalog,
): AiChartD1K0Rule {
  const mutagenType =
    TRANSFORMATION_TYPES[input.flyingFact.transformationKind]
  const inventory = catalog.mutagenInventory.find(
    (item) =>
      item.starName === input.flyingFact.transformedStarName &&
      item.mutagenType === mutagenType,
  )
  if (
    inventory === undefined ||
    inventory.specificRuleId === null ||
    inventory.sourceAuthority === null ||
    inventory.missingReason !== null
  ) {
    invalid('KNOWLEDGE_NOT_READY')
  }
  const rule = requiredRule(catalog, inventory.specificRuleId)
  if (rule.sourceAuthority !== inventory.sourceAuthority) {
    invalid('KNOWLEDGE_NOT_READY')
  }
  return rule
}

function buildView(
  input: AiChartD1FlyingModelInput,
  catalog: AiChartD1K0Catalog,
): AiChartD1FlyingKnowledgeView {
  const expectedCoreRuleId = expectedStarCoreRuleId(
    input.flyingFact.transformedStarName,
  )
  if (
    input.flyingFact.transformedStarCoreRuleRef !==
    expectedCoreRuleId
  ) {
    invalid('STAR_CORE_RULE_MISMATCH')
  }
  const mutagenType =
    TRANSFORMATION_TYPES[input.flyingFact.transformationKind]
  const commonRuleId =
    `rule:mutagen:common:${AI_CHART_D1_K0_MUTAGEN_SLUGS[mutagenType]}`

  return freezeAiChartD1Value({
    contractVersion: AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_VERSION,
    flyingKnowledgeViewId:
      `flying-knowledge-view:${input.flyingFact.sourcePalaceId}:` +
      input.flyingFact.transformationKind.toLowerCase(),
    chartId: input.chartId,
    runId: input.runId,
    flyingModelInputRef: input.flyingModelInputId,
    flyingFactRef: input.flyingFact.flyingFactId,
    sourcePalaceId: input.flyingFact.sourcePalaceId,
    targetPalaceId: input.flyingFact.targetPalaceId,
    transformedStarName: input.flyingFact.transformedStarName,
    transformationKind: input.flyingFact.transformationKind,
    sourceActorBindings: selectActors(input),
    sourcePalaceMeanings: selectMeanings(
      catalog,
      input.flyingFact.sourcePalaceId,
    ).map(compactMeaning),
    targetPalaceMeanings: selectMeanings(
      catalog,
      input.flyingFact.targetPalaceId,
    ).map(compactMeaning),
    transformedStarCoreRule: compactRule(
      requiredRule(catalog, expectedCoreRuleId),
    ),
    transformationCommonRule: compactRule(
      requiredRule(catalog, commonRuleId),
    ),
    transformationSpecificRule: compactRule(
      selectSpecificRule(input, catalog),
    ),
    eligibleTargetFacetIds: [...input.eligibleTargetFacetIds],
    formulaPolicy: AI_CHART_D1_FLYING_FORMULA_POLICY,
    knowledgeStatus: 'ready' as const,
    openAiCallable: false as const,
    validationStatus: 'validated' as const,
  })
}

export function buildAiChartD1FlyingKnowledgeViews(
  inputSetValue: unknown,
  catalogValue: unknown,
): AiChartD1FlyingKnowledgeViewSet {
  const inputSet = parseTrustedInputSet(inputSetValue)
  const catalog = parseTrustedCatalog(catalogValue)
  return parseAiChartD1FlyingKnowledgeViewSet({
    contractVersion:
      AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_SET_VERSION,
    chartId: inputSet.chartId,
    runId: inputSet.runId,
    sourceModelInputSetVersion: inputSet.contractVersion,
    catalogId: catalog.catalogId,
    catalogFingerprint: catalog.catalogFingerprint,
    sourceManifestSha256: catalog.sourceManifestSha256,
    views: inputSet.inputs.map((input) =>
      buildView(input, catalog),
    ),
    openAiCallable: false,
    validationStatus: 'validated',
  })
}

export function validateAiChartD1FlyingKnowledgeViewSetAgainstSources(
  value: unknown,
  inputSetValue: unknown,
  catalogValue: unknown,
): AiChartD1FlyingKnowledgeViewSet {
  const supplied = parseAiChartD1FlyingKnowledgeViewSet(value)
  const expected = buildAiChartD1FlyingKnowledgeViews(
    inputSetValue,
    catalogValue,
  )
  if (JSON.stringify(supplied) !== JSON.stringify(expected)) {
    invalid('KNOWLEDGE_VIEW_MISMATCH')
  }
  return supplied
}

const ID_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 128,
  pattern: '^[A-Za-z0-9._:-]{1,128}$',
})
const SHA_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 64,
  pattern: '^[a-f0-9]{64}$',
})
const SHORT_TEXT_SCHEMA = createAiChartD1StringSchema({
  maximumLength: AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
})
const TEXT_SCHEMA = createAiChartD1StringSchema({
  maximumLength: AI_CHART_D1_MAX_TEXT_LENGTH,
})
const PALACE_ID_SCHEMA = createAiChartD1StringSchema({
  enumValues: AI_CHART_D1_PALACE_IDENTITIES.map(
    (identity) => identity.palaceId,
  ),
})

const RULE_VIEW_SCHEMA = createAiChartD1StrictObjectSchema({
  ruleId: ID_SCHEMA,
  title: SHORT_TEXT_SCHEMA,
  content: TEXT_SCHEMA,
  contentSha256: SHA_SCHEMA,
  ruleStatus: createAiChartD1StringSchema({
    enumValues: AI_CHART_D1_RULE_STATUSES,
  }),
  sourceAuthority: createAiChartD1StringSchema({
    enumValues: AI_CHART_D1_K0_SOURCE_AUTHORITIES,
  }),
  sourceFile: SHORT_TEXT_SCHEMA,
  sourceFileSha256: SHA_SCHEMA,
})

const MEANING_VIEW_SCHEMA = createAiChartD1StrictObjectSchema({
  meaningId: ID_SCHEMA,
  palaceId: PALACE_ID_SCHEMA,
  text: SHORT_TEXT_SCHEMA,
  contentSha256: SHA_SCHEMA,
  order: freezeAiChartD1Value({
    type: 'integer',
    minimum: 0,
    maximum: 31,
  }),
  sourceFile: SHORT_TEXT_SCHEMA,
  sourceFileSha256: SHA_SCHEMA,
})

const ACTOR_VIEW_SCHEMA = createAiChartD1StrictObjectSchema({
  bindingId: createAiChartD1StringSchema({
    enumValues: AI_CHART_D1_ACTOR_BINDING_IDS,
  }),
  actor: createAiChartD1StringSchema({
    enumValues: AI_CHART_D1_PALACE_AXIS_ACTORS,
  }),
  subjectKind: createAiChartD1StringSchema({
    enumValues: AI_CHART_D1_ACTOR_BINDING_REGISTRY.map(
      (binding) => binding.subjectKind,
    ),
  }),
  ruleSourceRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 1,
    maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
  }),
})

const FORMULA_POLICY_SCHEMA = createAiChartD1StrictObjectSchema({
  formulaVersion: freezeAiChartD1Value({
    const: AI_CHART_D1_FLYING_FORMULA_POLICY_VERSION,
  }),
  causalOrder: createAiChartD1ArraySchema(
    createAiChartD1StringSchema({
      enumValues: AI_CHART_D1_FLYING_CAUSAL_ORDER,
    }),
    { minimumItems: 4, maximumItems: 4 },
  ),
  lifeBridgeStages: createAiChartD1ArraySchema(
    createAiChartD1StringSchema({
      enumValues: AI_CHART_D1_FLYING_LIFE_BRIDGE_STAGES,
    }),
    { minimumItems: 4, maximumItems: 4 },
  ),
  sourceActorPolicy: freezeAiChartD1Value({
    const: 'PRESERVE_ALL_FACT_CANDIDATES',
  }),
  targetFacetPolicy: freezeAiChartD1Value({
    const: 'SELECT_ONE_REGISTRY_FACET',
  }),
  directCausePolicy: freezeAiChartD1Value({
    const: 'DIRECT_PALACE_CAUSE_FIRST',
  }),
  oppositeCausePolicy: freezeAiChartD1Value({
    const: 'ONLY_WHEN_FACT_PROVIDES_REF',
  }),
  natalBackgroundPolicy: freezeAiChartD1Value({
    const: 'TRIGGER_OR_AMPLIFY_NOT_REPLACE',
  }),
  eventBoundary: freezeAiChartD1Value({
    const: 'D1_POSSIBILITY_NOT_OCCURRED_EVENT',
  }),
})

export const AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_JSON_SCHEMA: AiChartD1JsonSchema =
  createAiChartD1StrictObjectSchema({
    contractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_VERSION,
    }),
    flyingKnowledgeViewId: ID_SCHEMA,
    chartId: ID_SCHEMA,
    runId: ID_SCHEMA,
    flyingModelInputRef: ID_SCHEMA,
    flyingFactRef: ID_SCHEMA,
    sourcePalaceId: PALACE_ID_SCHEMA,
    targetPalaceId: PALACE_ID_SCHEMA,
    transformedStarName: createAiChartD1StringSchema({
      enumValues: FLYING_STAR_NAMES,
    }),
    transformationKind: createAiChartD1StringSchema({
      enumValues: AI_CHART_D1_FLYING_TRANSFORMATION_KINDS,
    }),
    sourceActorBindings: createAiChartD1ArraySchema(
      ACTOR_VIEW_SCHEMA,
      {
        minimumItems: 1,
        maximumItems: AI_CHART_D1_ACTOR_BINDING_IDS.length,
      },
    ),
    sourcePalaceMeanings: createAiChartD1ArraySchema(
      MEANING_VIEW_SCHEMA,
      {
        minimumItems: 1,
        maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
      },
    ),
    targetPalaceMeanings: createAiChartD1ArraySchema(
      MEANING_VIEW_SCHEMA,
      {
        minimumItems: 1,
        maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
      },
    ),
    transformedStarCoreRule: RULE_VIEW_SCHEMA,
    transformationCommonRule: RULE_VIEW_SCHEMA,
    transformationSpecificRule: RULE_VIEW_SCHEMA,
    eligibleTargetFacetIds: createAiChartD1ArraySchema(
      createAiChartD1StringSchema({
        enumValues: AI_CHART_D1_PALACE_FACET_IDS,
      }),
      {
        minimumItems: 1,
        maximumItems: AI_CHART_D1_PALACE_FACET_IDS.length,
      },
    ),
    formulaPolicy: FORMULA_POLICY_SCHEMA,
    knowledgeStatus: freezeAiChartD1Value({
      const: 'ready',
    }),
    openAiCallable: freezeAiChartD1Value({
      const: false,
    }),
    validationStatus: freezeAiChartD1Value({
      const: 'validated',
    }),
  })

export const AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_SET_JSON_SCHEMA: AiChartD1JsonSchema =
  createAiChartD1StrictObjectSchema({
    contractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_SET_VERSION,
    }),
    chartId: ID_SCHEMA,
    runId: ID_SCHEMA,
    sourceModelInputSetVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_FLYING_MODEL_INPUT_SET_VERSION,
    }),
    catalogId: ID_SCHEMA,
    catalogFingerprint: SHA_SCHEMA,
    sourceManifestSha256: SHA_SCHEMA,
    views: createAiChartD1ArraySchema(
      AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_JSON_SCHEMA,
      { minimumItems: 48, maximumItems: 48 },
    ),
    openAiCallable: freezeAiChartD1Value({
      const: false,
    }),
    validationStatus: freezeAiChartD1Value({
      const: 'validated',
    }),
  })
