import {
  AI_CHART_D1_ID_PATTERN,
  AI_CHART_D1_MAX_LIST_ITEMS,
  AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
  assertAiChartD1SafeGraph,
  createAiChartD1ArraySchema,
  createAiChartD1StrictObjectSchema,
  createAiChartD1StringSchema,
  freezeAiChartD1Value,
  parseAiChartD1Enum,
  parseAiChartD1Id,
  parseAiChartD1NullableId,
  parseAiChartD1NullableText,
  parseAiChartD1StringArray,
  parseAiChartD1Text,
  requireAiChartD1ExactObject,
  type AiChartD1JsonSchema,
} from './d1CommonContracts'
import {
  AI_CHART_D1_MAJOR_STAR_NAMES,
  AI_CHART_D1_MODELED_SUPPORTING_STARS,
  AI_CHART_D1_PALACE_IDENTITIES,
  type AiChartD1PalaceId,
} from './d1N0Constants'
import {
  AI_CHART_D1_ACTOR_BINDING_IDS,
  type AiChartD1ActorBindingId,
} from './d1PalaceActorBindingRegistry'
import {
  AI_CHART_D1_PALACE_FACET_IDS,
  isAiChartD1PalaceFacetAllowed,
  type AiChartD1PalaceFacetId,
} from './d1PalaceFacetRegistry'
import {
  parseAiChartD1PalaceReasoningResult,
  type AiChartD1PalaceReasoningResult,
} from './d1PalaceIntegrationContracts'

export const AI_CHART_D1_FLYING_FACT_CONTRACT_VERSION =
  'ai-chart-d1-flying-fact/v1' as const
export const AI_CHART_D1_FLYING_FACT_SCHEMA_NAME =
  'ai_chart_d1_flying_fact_v1' as const
export const AI_CHART_D1_FLYING_INFLUENCE_RESULT_CONTRACT_VERSION =
  'ai-chart-d1-flying-influence-result/v1' as const
export const AI_CHART_D1_FLYING_INFLUENCE_RESULT_SCHEMA_NAME =
  'ai_chart_d1_flying_influence_result_v1' as const
export const AI_CHART_D1_FLYING_INFLUENCE_INVALID =
  'ai_chart_d1_flying_influence_invalid' as const
export const AI_CHART_D1_FLYING_FACT_SOURCE_STATUS =
  'FLYING_FACT_SOURCE_AVAILABLE' as const

export const AI_CHART_D1_FLYING_TRANSFORMATION_KINDS = Object.freeze([
  'LU',
  'QUAN',
  'KE',
  'JI',
] as const)
export const AI_CHART_D1_FLYING_NATAL_BACKGROUND_KINDS =
  Object.freeze(['NONE', 'SAME_TRANSFORMATION'] as const)
export const AI_CHART_D1_FLYING_NATAL_BACKGROUND_RELATIONS =
  Object.freeze([
    'NONE',
    'TRIGGER',
    'AMPLIFY',
    'ACTIVATE',
    'BRING_OUT',
  ] as const)
export const AI_CHART_D1_FLYING_VALIDATION_REASONS = Object.freeze([
  'FACT_SHAPE_INVALID',
  'RESULT_SHAPE_INVALID',
  'IDENTITY_OR_DIRECTION_MISMATCH',
  'SOURCE_ACTOR_SCOPE_INVALID',
  'TARGET_FACET_INVALID',
  'FLYING_STAR_BINDING_INVALID',
  'TRANSFORMATION_BINDING_INVALID',
  'KNOWLEDGE_BINDING_INVALID',
  'OPPOSITE_CAUSE_INVALID',
  'NATAL_BACKGROUND_INVALID',
  'SOURCE_TRACE_INCOMPLETE',
  'COVERAGE_MISMATCH',
] as const)

export type AiChartD1FlyingTransformationKind =
  (typeof AI_CHART_D1_FLYING_TRANSFORMATION_KINDS)[number]
export type AiChartD1FlyingNatalBackgroundKind =
  (typeof AI_CHART_D1_FLYING_NATAL_BACKGROUND_KINDS)[number]
export type AiChartD1FlyingNatalBackgroundRelation =
  (typeof AI_CHART_D1_FLYING_NATAL_BACKGROUND_RELATIONS)[number]
export type AiChartD1FlyingTransformedStarName =
  | (typeof AI_CHART_D1_MAJOR_STAR_NAMES)[number]
  | '文昌'
  | '文曲'
  | '左輔'
  | '右弼'
export type AiChartD1FlyingInfluenceValidationReason =
  (typeof AI_CHART_D1_FLYING_VALIDATION_REASONS)[number]

export type AiChartD1FlyingFact = Readonly<{
  contractVersion: typeof AI_CHART_D1_FLYING_FACT_CONTRACT_VERSION
  flyingFactId: string
  authoritativeInfluenceId: string
  chartId: string
  sourcePalaceId: AiChartD1PalaceId
  sourcePalaceStemRef: string
  sourceActorBindingRefs: readonly AiChartD1ActorBindingId[]
  targetPalaceId: AiChartD1PalaceId
  transformedStarName: AiChartD1FlyingTransformedStarName
  transformedStarRef: string
  transformedStarCoreRuleRef: string
  transformationKind: AiChartD1FlyingTransformationKind
  transformationActionRef: string
  natalBackgroundKind: AiChartD1FlyingNatalBackgroundKind
  natalBackgroundFactRef: string | null
  optionalOppositeCauseRef: string | null
  validationStatus: 'validated'
}>

export type AiChartD1FlyingLifeBridge = Readonly<{
  sourceExperience: string
  innerEffect: string
  repeatedBehavior: string
  possibleOutcome: string | null
}>

export type AiChartD1FlyingInfluenceCoverage = Readonly<{
  sourceRefs: readonly string[]
  knowledgeRuleRefs: readonly string[]
  sourceActorBindingRefs: readonly AiChartD1ActorBindingId[]
  targetFacetIds: readonly AiChartD1PalaceFacetId[]
}>

export type AiChartD1FlyingInfluenceResult = Readonly<{
  contractVersion:
    typeof AI_CHART_D1_FLYING_INFLUENCE_RESULT_CONTRACT_VERSION
  flyingInfluenceId: string
  flyingFactRef: string
  chartId: string
  runId: string
  sourcePalaceResultRef: string
  sourcePalaceId: AiChartD1PalaceId
  sourceActorBindingRefs: readonly AiChartD1ActorBindingId[]
  targetPalaceResultRef: string
  targetPalaceId: AiChartD1PalaceId
  targetFacetId: AiChartD1PalaceFacetId
  transformationKind: AiChartD1FlyingTransformationKind
  transformationActionRef: string
  transformedStarRef: string
  transformedStarCoreRuleRef: string
  transformationCommonRuleRef: string
  transformationSpecificRuleRef: string
  directPalaceCause: string
  oppositeCauseRef: string | null
  natalBackgroundRelation: AiChartD1FlyingNatalBackgroundRelation
  starSpecificMechanism: string
  lifeBridge: AiChartD1FlyingLifeBridge
  constraints: readonly string[]
  coverage: AiChartD1FlyingInfluenceCoverage
  validationStatus: 'validated'
}>

export class AiChartD1FlyingInfluenceError extends Error {
  readonly code = AI_CHART_D1_FLYING_INFLUENCE_INVALID
  declare readonly reasonCode: AiChartD1FlyingInfluenceValidationReason

  constructor(reasonCode: AiChartD1FlyingInfluenceValidationReason) {
    super(AI_CHART_D1_FLYING_INFLUENCE_INVALID)
    this.name = 'AiChartD1FlyingInfluenceError'
    Object.defineProperty(this, 'reasonCode', {
      value: reasonCode,
      enumerable: true,
      writable: false,
      configurable: false,
    })
    Object.freeze(this)
  }
}

const TRANSFORMATION_ACTION_REFS = freezeAiChartD1Value<
  Readonly<Record<AiChartD1FlyingTransformationKind, string>>
>({
  LU: 'rule:transformation-action:lu',
  QUAN: 'rule:transformation-action:quan',
  KE: 'rule:transformation-action:ke',
  JI: 'rule:transformation-action:ji',
})

const FACT_FIELDS = Object.freeze([
  'contractVersion',
  'flyingFactId',
  'authoritativeInfluenceId',
  'chartId',
  'sourcePalaceId',
  'sourcePalaceStemRef',
  'sourceActorBindingRefs',
  'targetPalaceId',
  'transformedStarName',
  'transformedStarRef',
  'transformedStarCoreRuleRef',
  'transformationKind',
  'transformationActionRef',
  'natalBackgroundKind',
  'natalBackgroundFactRef',
  'optionalOppositeCauseRef',
  'validationStatus',
] as const)
const LIFE_BRIDGE_FIELDS = Object.freeze([
  'sourceExperience',
  'innerEffect',
  'repeatedBehavior',
  'possibleOutcome',
] as const)
const COVERAGE_FIELDS = Object.freeze([
  'sourceRefs',
  'knowledgeRuleRefs',
  'sourceActorBindingRefs',
  'targetFacetIds',
] as const)
const RESULT_FIELDS = Object.freeze([
  'contractVersion',
  'flyingInfluenceId',
  'flyingFactRef',
  'chartId',
  'runId',
  'sourcePalaceResultRef',
  'sourcePalaceId',
  'sourceActorBindingRefs',
  'targetPalaceResultRef',
  'targetPalaceId',
  'targetFacetId',
  'transformationKind',
  'transformationActionRef',
  'transformedStarRef',
  'transformedStarCoreRuleRef',
  'transformationCommonRuleRef',
  'transformationSpecificRuleRef',
  'directPalaceCause',
  'oppositeCauseRef',
  'natalBackgroundRelation',
  'starSpecificMechanism',
  'lifeBridge',
  'constraints',
  'coverage',
  'validationStatus',
] as const)

function invalid(
  reasonCode: AiChartD1FlyingInfluenceValidationReason,
): never {
  throw new AiChartD1FlyingInfluenceError(reasonCode)
}

function parsePalaceId(
  value: unknown,
  reasonCode: 'FACT_SHAPE_INVALID' | 'RESULT_SHAPE_INVALID',
): AiChartD1PalaceId {
  const palaceId = parseAiChartD1Id(value)
  if (
    !AI_CHART_D1_PALACE_IDENTITIES.some(
      (identity) => identity.palaceId === palaceId,
    )
  ) {
    invalid(reasonCode)
  }
  return palaceId as AiChartD1PalaceId
}

function parseActorBindingRefs(
  value: unknown,
): readonly AiChartD1ActorBindingId[] {
  return parseAiChartD1StringArray(value, {
    minimumItems: 1,
    maximumItems: AI_CHART_D1_ACTOR_BINDING_IDS.length,
    parseItem: (item) =>
      parseAiChartD1Enum(item, AI_CHART_D1_ACTOR_BINDING_IDS),
  }) as readonly AiChartD1ActorBindingId[]
}

function parseTargetFacet(
  value: unknown,
  targetPalaceId: AiChartD1PalaceId,
): AiChartD1PalaceFacetId {
  const facetId = parseAiChartD1Enum(
    value,
    AI_CHART_D1_PALACE_FACET_IDS,
  )
  if (!isAiChartD1PalaceFacetAllowed(targetPalaceId, facetId)) {
    invalid('TARGET_FACET_INVALID')
  }
  return facetId
}

function parseIdArray(
  value: unknown,
  minimumItems = 0,
): readonly string[] {
  return parseAiChartD1StringArray(value, {
    minimumItems,
    maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
    parseItem: parseAiChartD1Id,
  })
}

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function collectUnique(values: readonly (string | null)[]): readonly string[] {
  const collected = new Set<string>()
  for (const value of values) {
    if (value !== null) collected.add(value)
  }
  return Object.freeze([...collected])
}

function parseLifeBridge(value: unknown): AiChartD1FlyingLifeBridge {
  const record = requireAiChartD1ExactObject(
    value,
    LIFE_BRIDGE_FIELDS,
  )
  return freezeAiChartD1Value({
    sourceExperience: parseAiChartD1Text(
      record.sourceExperience,
      AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
    ),
    innerEffect: parseAiChartD1Text(
      record.innerEffect,
      AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
    ),
    repeatedBehavior: parseAiChartD1Text(
      record.repeatedBehavior,
      AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
    ),
    possibleOutcome: parseAiChartD1NullableText(
      record.possibleOutcome,
    ),
  })
}

function parseCoverage(
  value: unknown,
): AiChartD1FlyingInfluenceCoverage {
  const record = requireAiChartD1ExactObject(value, COVERAGE_FIELDS)
  return freezeAiChartD1Value({
    sourceRefs: parseIdArray(record.sourceRefs, 1),
    knowledgeRuleRefs: parseIdArray(record.knowledgeRuleRefs, 3),
    sourceActorBindingRefs: parseActorBindingRefs(
      record.sourceActorBindingRefs,
    ),
    targetFacetIds: parseAiChartD1StringArray(
      record.targetFacetIds,
      {
        minimumItems: 1,
        maximumItems: AI_CHART_D1_PALACE_FACET_IDS.length,
        parseItem: (item) =>
          parseAiChartD1Enum(item, AI_CHART_D1_PALACE_FACET_IDS),
      },
    ) as readonly AiChartD1PalaceFacetId[],
  })
}

function expectedSourceRefs(
  fact: AiChartD1FlyingFact,
  sourceResult: AiChartD1PalaceReasoningResult,
  targetResult: AiChartD1PalaceReasoningResult,
): readonly string[] {
  return collectUnique([
    fact.flyingFactId,
    sourceResult.palaceResultId,
    targetResult.palaceResultId,
    fact.sourcePalaceStemRef,
    fact.transformedStarRef,
    fact.transformedStarCoreRuleRef,
    fact.transformationActionRef,
    fact.natalBackgroundFactRef,
    fact.optionalOppositeCauseRef,
  ])
}

export function parseAiChartD1FlyingFact(
  value: unknown,
): AiChartD1FlyingFact {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(value, FACT_FIELDS)
    if (
      record.contractVersion !==
        AI_CHART_D1_FLYING_FACT_CONTRACT_VERSION ||
      record.validationStatus !== 'validated'
    ) {
      invalid('FACT_SHAPE_INVALID')
    }

    const transformationKind = parseAiChartD1Enum(
      record.transformationKind,
      AI_CHART_D1_FLYING_TRANSFORMATION_KINDS,
    )
    const transformationActionRef = parseAiChartD1Id(
      record.transformationActionRef,
    )
    if (
      transformationActionRef !==
      TRANSFORMATION_ACTION_REFS[transformationKind]
    ) {
      invalid('FACT_SHAPE_INVALID')
    }

    const natalBackgroundKind = parseAiChartD1Enum(
      record.natalBackgroundKind,
      AI_CHART_D1_FLYING_NATAL_BACKGROUND_KINDS,
    )
    const natalBackgroundFactRef = parseAiChartD1NullableId(
      record.natalBackgroundFactRef,
    )
    if (
      (natalBackgroundKind === 'NONE' &&
        natalBackgroundFactRef !== null) ||
      (natalBackgroundKind === 'SAME_TRANSFORMATION' &&
        natalBackgroundFactRef === null)
    ) {
      invalid('FACT_SHAPE_INVALID')
    }

    return freezeAiChartD1Value({
      contractVersion: AI_CHART_D1_FLYING_FACT_CONTRACT_VERSION,
      flyingFactId: parseAiChartD1Id(record.flyingFactId),
      authoritativeInfluenceId: parseAiChartD1Id(
        record.authoritativeInfluenceId,
      ),
      chartId: parseAiChartD1Id(record.chartId),
      sourcePalaceId: parsePalaceId(
        record.sourcePalaceId,
        'FACT_SHAPE_INVALID',
      ),
      sourcePalaceStemRef: parseAiChartD1Id(
        record.sourcePalaceStemRef,
      ),
      sourceActorBindingRefs: parseActorBindingRefs(
        record.sourceActorBindingRefs,
      ),
      targetPalaceId: parsePalaceId(
        record.targetPalaceId,
        'FACT_SHAPE_INVALID',
      ),
      transformedStarName: parseAiChartD1Enum(
        record.transformedStarName,
        [
          ...AI_CHART_D1_MAJOR_STAR_NAMES,
          ...Object.keys(AI_CHART_D1_MODELED_SUPPORTING_STARS).filter(
            (name) =>
              name === '文昌' ||
              name === '文曲' ||
              name === '左輔' ||
              name === '右弼',
          ),
        ] as readonly AiChartD1FlyingTransformedStarName[],
      ),
      transformedStarRef: parseAiChartD1Id(
        record.transformedStarRef,
      ),
      transformedStarCoreRuleRef: parseAiChartD1Id(
        record.transformedStarCoreRuleRef,
      ),
      transformationKind,
      transformationActionRef,
      natalBackgroundKind,
      natalBackgroundFactRef,
      optionalOppositeCauseRef: parseAiChartD1NullableId(
        record.optionalOppositeCauseRef,
      ),
      validationStatus: 'validated' as const,
    })
  } catch (error) {
    if (error instanceof AiChartD1FlyingInfluenceError) throw error
    invalid('FACT_SHAPE_INVALID')
  }
}

export function parseAiChartD1FlyingInfluenceResult(
  value: unknown,
): AiChartD1FlyingInfluenceResult {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(value, RESULT_FIELDS)
    if (
      record.contractVersion !==
        AI_CHART_D1_FLYING_INFLUENCE_RESULT_CONTRACT_VERSION ||
      record.validationStatus !== 'validated'
    ) {
      invalid('RESULT_SHAPE_INVALID')
    }

    const targetPalaceId = parsePalaceId(
      record.targetPalaceId,
      'RESULT_SHAPE_INVALID',
    )
    const targetFacetId = parseTargetFacet(
      record.targetFacetId,
      targetPalaceId,
    )
    const transformationKind = parseAiChartD1Enum(
      record.transformationKind,
      AI_CHART_D1_FLYING_TRANSFORMATION_KINDS,
    )
    const transformationActionRef = parseAiChartD1Id(
      record.transformationActionRef,
    )
    if (
      transformationActionRef !==
      TRANSFORMATION_ACTION_REFS[transformationKind]
    ) {
      invalid('TRANSFORMATION_BINDING_INVALID')
    }
    const sourceActorBindingRefs = parseActorBindingRefs(
      record.sourceActorBindingRefs,
    )
    const coverage = parseCoverage(record.coverage)
    if (
      !sameStrings(
        coverage.sourceActorBindingRefs,
        sourceActorBindingRefs,
      ) ||
      !sameStrings(coverage.targetFacetIds, [targetFacetId])
    ) {
      invalid('COVERAGE_MISMATCH')
    }

    const flyingFactRef = parseAiChartD1Id(record.flyingFactRef)
    const sourcePalaceResultRef = parseAiChartD1Id(
      record.sourcePalaceResultRef,
    )
    const targetPalaceResultRef = parseAiChartD1Id(
      record.targetPalaceResultRef,
    )
    const transformedStarRef = parseAiChartD1Id(
      record.transformedStarRef,
    )
    const transformedStarCoreRuleRef = parseAiChartD1Id(
      record.transformedStarCoreRuleRef,
    )
    const transformationCommonRuleRef = parseAiChartD1Id(
      record.transformationCommonRuleRef,
    )
    const transformationSpecificRuleRef = parseAiChartD1Id(
      record.transformationSpecificRuleRef,
    )
    if (
      !sameStrings(coverage.knowledgeRuleRefs, [
        transformedStarCoreRuleRef,
        transformationCommonRuleRef,
        transformationSpecificRuleRef,
      ])
    ) {
      invalid('COVERAGE_MISMATCH')
    }
    for (const requiredRef of [
      flyingFactRef,
      sourcePalaceResultRef,
      targetPalaceResultRef,
      transformedStarRef,
      transformedStarCoreRuleRef,
      transformationActionRef,
    ]) {
      if (!coverage.sourceRefs.includes(requiredRef)) {
        invalid('SOURCE_TRACE_INCOMPLETE')
      }
    }

    return freezeAiChartD1Value({
      contractVersion:
        AI_CHART_D1_FLYING_INFLUENCE_RESULT_CONTRACT_VERSION,
      flyingInfluenceId: parseAiChartD1Id(record.flyingInfluenceId),
      flyingFactRef,
      chartId: parseAiChartD1Id(record.chartId),
      runId: parseAiChartD1Id(record.runId),
      sourcePalaceResultRef,
      sourcePalaceId: parsePalaceId(
        record.sourcePalaceId,
        'RESULT_SHAPE_INVALID',
      ),
      sourceActorBindingRefs,
      targetPalaceResultRef,
      targetPalaceId,
      targetFacetId,
      transformationKind,
      transformationActionRef,
      transformedStarRef,
      transformedStarCoreRuleRef,
      transformationCommonRuleRef,
      transformationSpecificRuleRef,
      directPalaceCause: parseAiChartD1Text(
        record.directPalaceCause,
        AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
      ),
      oppositeCauseRef: parseAiChartD1NullableId(
        record.oppositeCauseRef,
      ),
      natalBackgroundRelation: parseAiChartD1Enum(
        record.natalBackgroundRelation,
        AI_CHART_D1_FLYING_NATAL_BACKGROUND_RELATIONS,
      ),
      starSpecificMechanism: parseAiChartD1Text(
        record.starSpecificMechanism,
        AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
      ),
      lifeBridge: parseLifeBridge(record.lifeBridge),
      constraints: parseAiChartD1StringArray(record.constraints, {
        minimumItems: 1,
      }),
      coverage,
      validationStatus: 'validated' as const,
    })
  } catch (error) {
    if (error instanceof AiChartD1FlyingInfluenceError) throw error
    invalid('RESULT_SHAPE_INVALID')
  }
}

export function validateAiChartD1FlyingInfluenceResultAgainstSources(
  value: unknown,
  factValue: unknown,
  sourcePalaceValue: unknown,
  targetPalaceValue: unknown,
): AiChartD1FlyingInfluenceResult {
  const result = parseAiChartD1FlyingInfluenceResult(value)
  const fact = parseAiChartD1FlyingFact(factValue)
  let sourceResult: AiChartD1PalaceReasoningResult
  let targetResult: AiChartD1PalaceReasoningResult
  try {
    sourceResult = parseAiChartD1PalaceReasoningResult(
      sourcePalaceValue,
    )
    targetResult = parseAiChartD1PalaceReasoningResult(
      targetPalaceValue,
    )
  } catch {
    invalid('IDENTITY_OR_DIRECTION_MISMATCH')
  }

  if (
    result.flyingInfluenceId !== fact.authoritativeInfluenceId ||
    result.flyingFactRef !== fact.flyingFactId ||
    result.chartId !== fact.chartId ||
    result.chartId !== sourceResult.chartId ||
    result.chartId !== targetResult.chartId ||
    result.runId !== sourceResult.runId ||
    result.runId !== targetResult.runId ||
    result.sourcePalaceResultRef !== sourceResult.palaceResultId ||
    result.targetPalaceResultRef !== targetResult.palaceResultId ||
    result.sourcePalaceId !== fact.sourcePalaceId ||
    result.sourcePalaceId !== sourceResult.targetPalaceId ||
    result.targetPalaceId !== fact.targetPalaceId ||
    result.targetPalaceId !== targetResult.targetPalaceId
  ) {
    invalid('IDENTITY_OR_DIRECTION_MISMATCH')
  }

  if (
    !sameStrings(
      result.sourceActorBindingRefs,
      fact.sourceActorBindingRefs,
    )
  ) {
    invalid('SOURCE_ACTOR_SCOPE_INVALID')
  }
  if (result.transformedStarRef !== fact.transformedStarRef) {
    invalid('FLYING_STAR_BINDING_INVALID')
  }
  if (
    result.transformationKind !== fact.transformationKind ||
    result.transformationActionRef !== fact.transformationActionRef ||
    result.transformedStarCoreRuleRef !==
      fact.transformedStarCoreRuleRef
  ) {
    invalid('TRANSFORMATION_BINDING_INVALID')
  }

  if (
    (fact.optionalOppositeCauseRef === null &&
      result.oppositeCauseRef !== null) ||
    (result.oppositeCauseRef !== null &&
      result.oppositeCauseRef !== fact.optionalOppositeCauseRef)
  ) {
    invalid('OPPOSITE_CAUSE_INVALID')
  }
  if (
    (fact.natalBackgroundKind === 'NONE' &&
      result.natalBackgroundRelation !== 'NONE') ||
    (fact.natalBackgroundKind === 'SAME_TRANSFORMATION' &&
      result.natalBackgroundRelation === 'NONE')
  ) {
    invalid('NATAL_BACKGROUND_INVALID')
  }

  const expectedRefs = expectedSourceRefs(
    fact,
    sourceResult,
    targetResult,
  )
  if (
    !sameStrings(result.coverage.sourceRefs, expectedRefs) ||
    !sameStrings(
      result.coverage.sourceActorBindingRefs,
      result.sourceActorBindingRefs,
    ) ||
    !sameStrings(result.coverage.targetFacetIds, [
      result.targetFacetId,
    ])
  ) {
    invalid('COVERAGE_MISMATCH')
  }
  return result
}

const ID_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 128,
  pattern: AI_CHART_D1_ID_PATTERN.source,
})
const NULLABLE_ID_SCHEMA = freezeAiChartD1Value({
  type: ['string', 'null'],
  minLength: 1,
  maxLength: 128,
  pattern: AI_CHART_D1_ID_PATTERN.source,
})
const PALACE_ID_SCHEMA = createAiChartD1StringSchema({
  enumValues: AI_CHART_D1_PALACE_IDENTITIES.map(
    (identity) => identity.palaceId,
  ),
})
const ACTOR_BINDING_ID_SCHEMA = createAiChartD1StringSchema({
  enumValues: AI_CHART_D1_ACTOR_BINDING_IDS,
})
const FACET_ID_SCHEMA = createAiChartD1StringSchema({
  enumValues: AI_CHART_D1_PALACE_FACET_IDS,
})
const TRANSFORMATION_KIND_SCHEMA = createAiChartD1StringSchema({
  enumValues: AI_CHART_D1_FLYING_TRANSFORMATION_KINDS,
})
const TRANSFORMED_STAR_NAME_SCHEMA = createAiChartD1StringSchema({
  enumValues: [
    ...AI_CHART_D1_MAJOR_STAR_NAMES,
    '文昌',
    '文曲',
    '左輔',
    '右弼',
  ],
})
const TRANSFORMATION_ACTION_SCHEMA = createAiChartD1StringSchema({
  enumValues: Object.values(TRANSFORMATION_ACTION_REFS),
})
const SHORT_TEXT_SCHEMA = createAiChartD1StringSchema({
  maximumLength: AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
})
const NULLABLE_SHORT_TEXT_SCHEMA = createAiChartD1StringSchema({
  maximumLength: AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
  nullable: true,
})
const LIFE_BRIDGE_SCHEMA = createAiChartD1StrictObjectSchema({
  sourceExperience: SHORT_TEXT_SCHEMA,
  innerEffect: SHORT_TEXT_SCHEMA,
  repeatedBehavior: SHORT_TEXT_SCHEMA,
  possibleOutcome: NULLABLE_SHORT_TEXT_SCHEMA,
})
const COVERAGE_SCHEMA = createAiChartD1StrictObjectSchema({
  sourceRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 1,
    maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
  }),
  knowledgeRuleRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 3,
    maximumItems: 3,
  }),
  sourceActorBindingRefs: createAiChartD1ArraySchema(
    ACTOR_BINDING_ID_SCHEMA,
    {
      minimumItems: 1,
      maximumItems: AI_CHART_D1_ACTOR_BINDING_IDS.length,
    },
  ),
  targetFacetIds: createAiChartD1ArraySchema(FACET_ID_SCHEMA, {
    minimumItems: 1,
    maximumItems: AI_CHART_D1_PALACE_FACET_IDS.length,
  }),
})

export const AI_CHART_D1_FLYING_FACT_JSON_SCHEMA: AiChartD1JsonSchema =
  createAiChartD1StrictObjectSchema({
    contractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_FLYING_FACT_CONTRACT_VERSION,
    }),
    flyingFactId: ID_SCHEMA,
    authoritativeInfluenceId: ID_SCHEMA,
    chartId: ID_SCHEMA,
    sourcePalaceId: PALACE_ID_SCHEMA,
    sourcePalaceStemRef: ID_SCHEMA,
    sourceActorBindingRefs: createAiChartD1ArraySchema(
      ACTOR_BINDING_ID_SCHEMA,
      {
        minimumItems: 1,
        maximumItems: AI_CHART_D1_ACTOR_BINDING_IDS.length,
      },
    ),
    targetPalaceId: PALACE_ID_SCHEMA,
    transformedStarName: TRANSFORMED_STAR_NAME_SCHEMA,
    transformedStarRef: ID_SCHEMA,
    transformedStarCoreRuleRef: ID_SCHEMA,
    transformationKind: TRANSFORMATION_KIND_SCHEMA,
    transformationActionRef: TRANSFORMATION_ACTION_SCHEMA,
    natalBackgroundKind: createAiChartD1StringSchema({
      enumValues: AI_CHART_D1_FLYING_NATAL_BACKGROUND_KINDS,
    }),
    natalBackgroundFactRef: NULLABLE_ID_SCHEMA,
    optionalOppositeCauseRef: NULLABLE_ID_SCHEMA,
    validationStatus: freezeAiChartD1Value({
      const: 'validated',
    }),
  })

export const AI_CHART_D1_FLYING_INFLUENCE_RESULT_JSON_SCHEMA: AiChartD1JsonSchema =
  createAiChartD1StrictObjectSchema({
    contractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_FLYING_INFLUENCE_RESULT_CONTRACT_VERSION,
    }),
    flyingInfluenceId: ID_SCHEMA,
    flyingFactRef: ID_SCHEMA,
    chartId: ID_SCHEMA,
    runId: ID_SCHEMA,
    sourcePalaceResultRef: ID_SCHEMA,
    sourcePalaceId: PALACE_ID_SCHEMA,
    sourceActorBindingRefs: createAiChartD1ArraySchema(
      ACTOR_BINDING_ID_SCHEMA,
      {
        minimumItems: 1,
        maximumItems: AI_CHART_D1_ACTOR_BINDING_IDS.length,
      },
    ),
    targetPalaceResultRef: ID_SCHEMA,
    targetPalaceId: PALACE_ID_SCHEMA,
    targetFacetId: FACET_ID_SCHEMA,
    transformationKind: TRANSFORMATION_KIND_SCHEMA,
    transformationActionRef: TRANSFORMATION_ACTION_SCHEMA,
    transformedStarRef: ID_SCHEMA,
    transformedStarCoreRuleRef: ID_SCHEMA,
    transformationCommonRuleRef: ID_SCHEMA,
    transformationSpecificRuleRef: ID_SCHEMA,
    directPalaceCause: SHORT_TEXT_SCHEMA,
    oppositeCauseRef: NULLABLE_ID_SCHEMA,
    natalBackgroundRelation: createAiChartD1StringSchema({
      enumValues: AI_CHART_D1_FLYING_NATAL_BACKGROUND_RELATIONS,
    }),
    starSpecificMechanism: SHORT_TEXT_SCHEMA,
    lifeBridge: LIFE_BRIDGE_SCHEMA,
    constraints: createAiChartD1ArraySchema(SHORT_TEXT_SCHEMA, {
      minimumItems: 1,
      maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
    }),
    coverage: COVERAGE_SCHEMA,
    validationStatus: freezeAiChartD1Value({
      const: 'validated',
    }),
  })
