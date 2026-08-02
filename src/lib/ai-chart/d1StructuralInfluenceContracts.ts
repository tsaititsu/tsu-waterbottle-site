import {
  AI_CHART_D1_ID_PATTERN,
  AI_CHART_D1_MAX_CANDIDATES_PER_COLLECTION,
  AI_CHART_D1_MAX_LIST_ITEMS,
  AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
  assertAiChartD1SafeGraph,
  createAiChartD1ArraySchema,
  createAiChartD1StrictObjectSchema,
  createAiChartD1StringSchema,
  freezeAiChartD1Value,
  parseAiChartD1Enum,
  parseAiChartD1Id,
  parseAiChartD1StringArray,
  parseAiChartD1Text,
  requireAiChartD1ExactObject,
  type AiChartD1JsonSchema,
} from './d1CommonContracts'
import {
  AI_CHART_D1_PALACE_IDENTITIES,
  type AiChartD1PalaceId,
} from './d1N0Constants'
import {
  parseAiChartD1P1StructuralInput,
  type AiChartD1P1StructuralInput,
  type AiChartD1P1StructuralPalace,
  type AiChartD1P1StructuralStar,
} from './d1P1InputContracts'
import {
  validateAiChartD1PalaceAxisResultAgainstStructuralInput,
  type AiChartD1PalaceAxisResult,
} from './d1PalaceAxisContracts'
import {
  AI_CHART_D1_PALACE_FACET_IDS,
  isAiChartD1PalaceFacetAllowed,
  type AiChartD1PalaceFacetId,
} from './d1PalaceFacetRegistry'

export const AI_CHART_D1_STRUCTURAL_INFLUENCE_RESULT_CONTRACT_VERSION =
  'ai-chart-d1-structural-influence-result/v1' as const
export const AI_CHART_D1_STRUCTURAL_INFLUENCE_RESULT_SCHEMA_NAME =
  'ai_chart_d1_structural_influence_result_v1' as const
export const AI_CHART_D1_STRUCTURAL_INFLUENCE_RESULT_INVALID =
  'ai_chart_d1_structural_influence_result_invalid' as const

export const AI_CHART_D1_STRUCTURAL_RELATION_KINDS = Object.freeze([
  'TRINE_QUADRANT',
  'HIDDEN_COMBINATION',
] as const)
export const AI_CHART_D1_STRUCTURAL_INFLUENCE_VISIBILITIES = Object.freeze([
  'EXPLICIT',
  'LATENT',
] as const)
export const AI_CHART_D1_STRUCTURAL_INFLUENCE_MODES = Object.freeze([
  'SUPPORT',
  'AMPLIFY',
  'PRESSURE',
  'INTERFERE',
] as const)
export const AI_CHART_D1_STRUCTURAL_INFLUENCE_VALIDATION_REASONS =
  Object.freeze([
    'RESULT_SHAPE_INVALID',
    'IDENTITY_OR_AXIS_MISMATCH',
    'STRUCTURAL_RELATION_UNVERIFIED',
    'VISIBILITY_MISMATCH',
    'SOURCE_FACET_INVALID',
    'TARGET_FACET_INVALID',
    'TARGET_CLAIM_REFERENCE_INVALID',
    'SOURCE_FACT_REFERENCE_INVALID',
    'SOURCE_MODE_MISMATCH',
    'COVERAGE_MISMATCH',
  ] as const)

export type AiChartD1StructuralRelationKind =
  (typeof AI_CHART_D1_STRUCTURAL_RELATION_KINDS)[number]
export type AiChartD1StructuralInfluenceVisibility =
  (typeof AI_CHART_D1_STRUCTURAL_INFLUENCE_VISIBILITIES)[number]
export type AiChartD1StructuralInfluenceMode =
  (typeof AI_CHART_D1_STRUCTURAL_INFLUENCE_MODES)[number]
export type AiChartD1StructuralInfluenceValidationReason =
  (typeof AI_CHART_D1_STRUCTURAL_INFLUENCE_VALIDATION_REASONS)[number]

export type AiChartD1StructuralRelationView = Readonly<{
  relationKind: AiChartD1StructuralRelationKind
  visibility: AiChartD1StructuralInfluenceVisibility
  targetPalaceId: AiChartD1PalaceId
  sourcePalaceId: AiChartD1PalaceId
  relationFactRef: string
}>

export type AiChartD1StructuralInfluence = Readonly<{
  influenceId: string
  relationKind: AiChartD1StructuralRelationKind
  visibility: AiChartD1StructuralInfluenceVisibility
  sourcePalaceId: AiChartD1PalaceId
  sourceFacetId: AiChartD1PalaceFacetId
  sourceFactRefs: readonly string[]
  targetPalaceId: AiChartD1PalaceId
  targetFacetId: AiChartD1PalaceFacetId
  targetClaimRefs: readonly string[]
  influenceMode: AiChartD1StructuralInfluenceMode
  mechanismLink: string
  possibleEffects: readonly string[]
  constraints: readonly string[]
}>

export type AiChartD1StructuralInfluenceCoverage = Readonly<{
  influenceIds: readonly string[]
  trineInfluenceIds: readonly string[]
  hiddenCombinationInfluenceIds: readonly string[]
  sourcePalaceIdsCovered: readonly AiChartD1PalaceId[]
  sourceFactRefsCovered: readonly string[]
  targetClaimRefsCovered: readonly string[]
}>

export type AiChartD1StructuralInfluenceResult = Readonly<{
  contractVersion: typeof AI_CHART_D1_STRUCTURAL_INFLUENCE_RESULT_CONTRACT_VERSION
  structuralInfluenceResultId: string
  axisResultRef: string
  chartId: string
  runId: string
  callId: string
  targetPalaceId: AiChartD1PalaceId
  influences: readonly AiChartD1StructuralInfluence[]
  coverage: AiChartD1StructuralInfluenceCoverage
  validationStatus: 'validated'
}>

export class AiChartD1StructuralInfluenceResultError extends Error {
  readonly code = AI_CHART_D1_STRUCTURAL_INFLUENCE_RESULT_INVALID
  declare readonly reasonCode: AiChartD1StructuralInfluenceValidationReason

  constructor(reasonCode: AiChartD1StructuralInfluenceValidationReason) {
    super(AI_CHART_D1_STRUCTURAL_INFLUENCE_RESULT_INVALID)
    this.name = 'AiChartD1StructuralInfluenceResultError'
    Object.defineProperty(this, 'reasonCode', {
      value: reasonCode,
      enumerable: true,
      writable: false,
      configurable: false,
    })
    Object.freeze(this)
  }
}

const INFLUENCE_FIELDS = Object.freeze([
  'influenceId',
  'relationKind',
  'visibility',
  'sourcePalaceId',
  'sourceFacetId',
  'sourceFactRefs',
  'targetPalaceId',
  'targetFacetId',
  'targetClaimRefs',
  'influenceMode',
  'mechanismLink',
  'possibleEffects',
  'constraints',
] as const)
const COVERAGE_FIELDS = Object.freeze([
  'influenceIds',
  'trineInfluenceIds',
  'hiddenCombinationInfluenceIds',
  'sourcePalaceIdsCovered',
  'sourceFactRefsCovered',
  'targetClaimRefsCovered',
] as const)
const RESULT_FIELDS = Object.freeze([
  'contractVersion',
  'structuralInfluenceResultId',
  'axisResultRef',
  'chartId',
  'runId',
  'callId',
  'targetPalaceId',
  'influences',
  'coverage',
  'validationStatus',
] as const)

function invalid(
  reasonCode: AiChartD1StructuralInfluenceValidationReason,
): never {
  throw new AiChartD1StructuralInfluenceResultError(reasonCode)
}

function parsePalaceId(value: unknown): AiChartD1PalaceId {
  const palaceId = parseAiChartD1Id(value)
  if (
    !AI_CHART_D1_PALACE_IDENTITIES.some(
      (identity) => identity.palaceId === palaceId,
    )
  ) {
    invalid('RESULT_SHAPE_INVALID')
  }
  return palaceId as AiChartD1PalaceId
}

function parseIdArray(
  value: unknown,
  minimumItems = 0,
): readonly string[] {
  return parseAiChartD1StringArray(value, {
    minimumItems,
    parseItem: parseAiChartD1Id,
  })
}

function parseInfluence(
  value: unknown,
  rootTargetPalaceId: AiChartD1PalaceId,
): AiChartD1StructuralInfluence {
  const record = requireAiChartD1ExactObject(value, INFLUENCE_FIELDS)
  const sourcePalaceId = parsePalaceId(record.sourcePalaceId)
  let sourceFacetId: AiChartD1PalaceFacetId
  try {
    sourceFacetId = parseAiChartD1Enum(
      record.sourceFacetId,
      AI_CHART_D1_PALACE_FACET_IDS,
    )
  } catch {
    invalid('SOURCE_FACET_INVALID')
  }
  if (!isAiChartD1PalaceFacetAllowed(sourcePalaceId, sourceFacetId)) {
    invalid('SOURCE_FACET_INVALID')
  }
  const targetPalaceId = parsePalaceId(record.targetPalaceId)
  const targetFacetId = parseAiChartD1Enum(
    record.targetFacetId,
    AI_CHART_D1_PALACE_FACET_IDS,
  )
  if (
    targetPalaceId !== rootTargetPalaceId ||
    !isAiChartD1PalaceFacetAllowed(targetPalaceId, targetFacetId)
  ) {
    invalid('TARGET_FACET_INVALID')
  }
  const relationKind = parseAiChartD1Enum(
    record.relationKind,
    AI_CHART_D1_STRUCTURAL_RELATION_KINDS,
  )
  const visibility = parseAiChartD1Enum(
    record.visibility,
    AI_CHART_D1_STRUCTURAL_INFLUENCE_VISIBILITIES,
  )
  const expectedVisibility =
    relationKind === 'TRINE_QUADRANT' ? 'EXPLICIT' : 'LATENT'
  if (visibility !== expectedVisibility) {
    invalid('VISIBILITY_MISMATCH')
  }

  return freezeAiChartD1Value({
    influenceId: parseAiChartD1Id(record.influenceId),
    relationKind,
    visibility,
    sourcePalaceId,
    sourceFacetId,
    sourceFactRefs: parseIdArray(record.sourceFactRefs, 2),
    targetPalaceId,
    targetFacetId,
    targetClaimRefs: parseIdArray(record.targetClaimRefs),
    influenceMode: parseAiChartD1Enum(
      record.influenceMode,
      AI_CHART_D1_STRUCTURAL_INFLUENCE_MODES,
    ),
    mechanismLink: parseAiChartD1Text(
      record.mechanismLink,
      AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
    ),
    possibleEffects: parseAiChartD1StringArray(record.possibleEffects, {
      minimumItems: 1,
      maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
      itemMaximumLength: AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
    }),
    constraints: parseAiChartD1StringArray(record.constraints, {
      minimumItems: 1,
      maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
      itemMaximumLength: AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
    }),
  })
}

function parseInfluences(
  value: unknown,
  targetPalaceId: AiChartD1PalaceId,
): readonly AiChartD1StructuralInfluence[] {
  if (
    !Array.isArray(value) ||
    value.length > AI_CHART_D1_MAX_CANDIDATES_PER_COLLECTION
  ) {
    invalid('RESULT_SHAPE_INVALID')
  }
  const influences = value.map((influence) =>
    parseInfluence(influence, targetPalaceId),
  )
  if (
    new Set(influences.map((influence) => influence.influenceId)).size !==
    influences.length
  ) {
    invalid('RESULT_SHAPE_INVALID')
  }
  return Object.freeze(influences)
}

function parseCoverage(
  value: unknown,
): AiChartD1StructuralInfluenceCoverage {
  const record = requireAiChartD1ExactObject(value, COVERAGE_FIELDS)
  return freezeAiChartD1Value({
    influenceIds: parseIdArray(record.influenceIds),
    trineInfluenceIds: parseIdArray(record.trineInfluenceIds),
    hiddenCombinationInfluenceIds: parseIdArray(
      record.hiddenCombinationInfluenceIds,
    ),
    sourcePalaceIdsCovered: parseAiChartD1StringArray(
      record.sourcePalaceIdsCovered,
      { parseItem: (item) => parsePalaceId(item) },
    ) as readonly AiChartD1PalaceId[],
    sourceFactRefsCovered: parseIdArray(record.sourceFactRefsCovered),
    targetClaimRefsCovered: parseIdArray(record.targetClaimRefsCovered),
  })
}

function collectUnique(
  values: readonly (readonly string[])[],
): readonly string[] {
  const collected = new Set<string>()
  for (const group of values) {
    for (const value of group) collected.add(value)
  }
  return Object.freeze([...collected])
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

function validateCoverage(
  influences: readonly AiChartD1StructuralInfluence[],
  coverage: AiChartD1StructuralInfluenceCoverage,
): void {
  const expected = {
    influenceIds: influences.map((influence) => influence.influenceId),
    trineInfluenceIds: influences
      .filter((influence) => influence.relationKind === 'TRINE_QUADRANT')
      .map((influence) => influence.influenceId),
    hiddenCombinationInfluenceIds: influences
      .filter(
        (influence) =>
          influence.relationKind === 'HIDDEN_COMBINATION',
      )
      .map((influence) => influence.influenceId),
    sourcePalaceIdsCovered: collectUnique(
      influences.map((influence) => [influence.sourcePalaceId]),
    ),
    sourceFactRefsCovered: collectUnique(
      influences.map((influence) => influence.sourceFactRefs),
    ),
    targetClaimRefsCovered: collectUnique(
      influences.map((influence) => influence.targetClaimRefs),
    ),
  }

  if (
    !sameStrings(coverage.influenceIds, expected.influenceIds) ||
    !sameStrings(
      coverage.trineInfluenceIds,
      expected.trineInfluenceIds,
    ) ||
    !sameStrings(
      coverage.hiddenCombinationInfluenceIds,
      expected.hiddenCombinationInfluenceIds,
    ) ||
    !sameStrings(
      coverage.sourcePalaceIdsCovered,
      expected.sourcePalaceIdsCovered,
    ) ||
    !sameStrings(
      coverage.sourceFactRefsCovered,
      expected.sourceFactRefsCovered,
    ) ||
    !sameStrings(
      coverage.targetClaimRefsCovered,
      expected.targetClaimRefsCovered,
    )
  ) {
    invalid('COVERAGE_MISMATCH')
  }
}

function relationFactRef(
  targetPalaceId: AiChartD1PalaceId,
  sourcePalaceId: AiChartD1PalaceId,
  relationKind: AiChartD1StructuralRelationKind,
): string {
  const relation =
    relationKind === 'TRINE_QUADRANT'
      ? 'trine'
      : 'hidden-combination'
  return `relation:${relation}:${targetPalaceId}:${sourcePalaceId}`
}

export function buildAiChartD1StructuralRelationViews(
  structuralInput: AiChartD1P1StructuralInput,
): readonly AiChartD1StructuralRelationView[] {
  const input = parseAiChartD1P1StructuralInput(structuralInput)
  return freezeAiChartD1Value([
    ...input.otherTrinePalaces.map((palace) => ({
      relationKind: 'TRINE_QUADRANT' as const,
      visibility: 'EXPLICIT' as const,
      targetPalaceId: input.targetPalace.palaceId,
      sourcePalaceId: palace.palaceId,
      relationFactRef: relationFactRef(
        input.targetPalace.palaceId,
        palace.palaceId,
        'TRINE_QUADRANT',
      ),
    })),
    {
      relationKind: 'HIDDEN_COMBINATION' as const,
      visibility: 'LATENT' as const,
      targetPalaceId: input.targetPalace.palaceId,
      sourcePalaceId: input.hiddenCombinationPalace.palaceId,
      relationFactRef: relationFactRef(
        input.targetPalace.palaceId,
        input.hiddenCombinationPalace.palaceId,
        'HIDDEN_COMBINATION',
      ),
    },
  ])
}

function sourcePalaceForRelation(
  input: AiChartD1P1StructuralInput,
  view: AiChartD1StructuralRelationView,
): AiChartD1P1StructuralPalace {
  const palace =
    view.relationKind === 'HIDDEN_COMBINATION'
      ? input.hiddenCombinationPalace
      : input.otherTrinePalaces.find(
          (candidate) => candidate.palaceId === view.sourcePalaceId,
        )
  if (palace === undefined) invalid('STRUCTURAL_RELATION_UNVERIFIED')
  return palace
}

type SourcePolarity = 'POSITIVE' | 'NEGATIVE' | 'CONTEXT_ONLY'

function placementPolarities(
  star: AiChartD1P1StructuralStar,
): readonly SourcePolarity[] {
  const polarities = new Set<SourcePolarity>()
  if (
    star.natalMutagen === '化祿' ||
    star.natalMutagen === '化權' ||
    star.natalMutagen === '化科' ||
    star.type === 'soft' ||
    star.type === 'lucun'
  ) {
    polarities.add('POSITIVE')
  }
  if (star.natalMutagen === '化忌' || star.type === 'tough') {
    polarities.add('NEGATIVE')
  }
  if (polarities.size === 0) polarities.add('CONTEXT_ONLY')
  return Object.freeze([...polarities])
}

function allowedSourceFacts(
  input: AiChartD1P1StructuralInput,
  palace: AiChartD1P1StructuralPalace,
  view: AiChartD1StructuralRelationView,
): ReadonlyMap<string, readonly SourcePolarity[]> {
  const facts = new Map<string, readonly SourcePolarity[]>()
  facts.set(view.relationFactRef, Object.freeze(['CONTEXT_ONLY']))
  for (const star of [
    ...palace.canonicalMajorStars,
    ...palace.modeledSupportingStars,
  ]) {
    facts.set(star.placementId, placementPolarities(star))
  }
  for (const signal of [
    ...input.targetGlobalScan.trineSignals,
    ...input.targetGlobalScan.hiddenCombinationSignals,
  ]) {
    if (signal.palaceId === palace.palaceId) {
      facts.set(signal.signalId, Object.freeze(['NEGATIVE']))
    }
  }
  return facts
}

function validateSourceMode(
  influence: AiChartD1StructuralInfluence,
  sourceFacts: ReadonlyMap<string, readonly SourcePolarity[]>,
  requiredRelationFactRef: string,
): void {
  if (!influence.sourceFactRefs.includes(requiredRelationFactRef)) {
    invalid('SOURCE_FACT_REFERENCE_INVALID')
  }

  let hasPositive = false
  let hasNegative = false
  for (const ref of influence.sourceFactRefs) {
    const polarities = sourceFacts.get(ref)
    if (polarities === undefined) {
      invalid('SOURCE_FACT_REFERENCE_INVALID')
    }
    if (polarities.includes('POSITIVE')) hasPositive = true
    if (polarities.includes('NEGATIVE')) hasNegative = true
  }

  const positiveMode =
    influence.influenceMode === 'SUPPORT' ||
    influence.influenceMode === 'AMPLIFY'
  if (
    hasPositive === hasNegative ||
    (positiveMode && !hasPositive) ||
    (!positiveMode && !hasNegative)
  ) {
    invalid('SOURCE_MODE_MISMATCH')
  }
}

function validateTargetClaimRefs(
  influence: AiChartD1StructuralInfluence,
  axisResult: AiChartD1PalaceAxisResult,
): void {
  for (const claimRef of influence.targetClaimRefs) {
    const claim = axisResult.claims.find(
      (candidate) => candidate.claimId === claimRef,
    )
    if (
      claim === undefined ||
      claim.facetId !== influence.targetFacetId
    ) {
      invalid('TARGET_CLAIM_REFERENCE_INVALID')
    }
  }
}

export function parseAiChartD1StructuralInfluenceResult(
  value: unknown,
): AiChartD1StructuralInfluenceResult {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(value, RESULT_FIELDS)
    if (
      record.contractVersion !==
        AI_CHART_D1_STRUCTURAL_INFLUENCE_RESULT_CONTRACT_VERSION ||
      record.validationStatus !== 'validated'
    ) {
      invalid('RESULT_SHAPE_INVALID')
    }
    const targetPalaceId = parsePalaceId(record.targetPalaceId)
    const influences = parseInfluences(
      record.influences,
      targetPalaceId,
    )
    const coverage = parseCoverage(record.coverage)
    validateCoverage(influences, coverage)

    return freezeAiChartD1Value({
      contractVersion:
        AI_CHART_D1_STRUCTURAL_INFLUENCE_RESULT_CONTRACT_VERSION,
      structuralInfluenceResultId: parseAiChartD1Id(
        record.structuralInfluenceResultId,
      ),
      axisResultRef: parseAiChartD1Id(record.axisResultRef),
      chartId: parseAiChartD1Id(record.chartId),
      runId: parseAiChartD1Id(record.runId),
      callId: parseAiChartD1Id(record.callId),
      targetPalaceId,
      influences,
      coverage,
      validationStatus: 'validated' as const,
    })
  } catch (error) {
    if (error instanceof AiChartD1StructuralInfluenceResultError) {
      throw error
    }
    invalid('RESULT_SHAPE_INVALID')
  }
}

export function validateAiChartD1StructuralInfluenceResultAgainstSources(
  value: unknown,
  axisValue: AiChartD1PalaceAxisResult,
  structuralInput: AiChartD1P1StructuralInput,
): AiChartD1StructuralInfluenceResult {
  const result = parseAiChartD1StructuralInfluenceResult(value)
  let input: AiChartD1P1StructuralInput
  let axisResult: AiChartD1PalaceAxisResult
  try {
    input = parseAiChartD1P1StructuralInput(structuralInput)
    axisResult =
      validateAiChartD1PalaceAxisResultAgainstStructuralInput(
        axisValue,
        input,
      )
  } catch {
    invalid('IDENTITY_OR_AXIS_MISMATCH')
  }

  if (
    result.axisResultRef !== axisResult.axisResultId ||
    result.chartId !== axisResult.chartId ||
    result.runId !== axisResult.runId ||
    result.callId !== axisResult.callId ||
    result.targetPalaceId !== axisResult.targetPalaceId
  ) {
    invalid('IDENTITY_OR_AXIS_MISMATCH')
  }

  const views = buildAiChartD1StructuralRelationViews(input)
  for (const influence of result.influences) {
    const view = views.find(
      (candidate) =>
        candidate.relationKind === influence.relationKind &&
        candidate.sourcePalaceId === influence.sourcePalaceId,
    )
    if (view === undefined) invalid('STRUCTURAL_RELATION_UNVERIFIED')
    if (influence.visibility !== view.visibility) {
      invalid('VISIBILITY_MISMATCH')
    }
    const palace = sourcePalaceForRelation(input, view)
    validateSourceMode(
      influence,
      allowedSourceFacts(input, palace, view),
      view.relationFactRef,
    )
    validateTargetClaimRefs(influence, axisResult)
  }

  return result
}

const ID_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 128,
  pattern: AI_CHART_D1_ID_PATTERN.source,
})
const PALACE_ID_SCHEMA = createAiChartD1StringSchema({
  enumValues: AI_CHART_D1_PALACE_IDENTITIES.map(
    (identity) => identity.palaceId,
  ),
})
const FACET_ID_SCHEMA = createAiChartD1StringSchema({
  enumValues: AI_CHART_D1_PALACE_FACET_IDS,
})
const SHORT_TEXT_SCHEMA = createAiChartD1StringSchema({
  maximumLength: AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
})
const ID_ARRAY_SCHEMA = createAiChartD1ArraySchema(ID_SCHEMA, {
  maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
})
const NONEMPTY_SHORT_TEXT_ARRAY_SCHEMA = createAiChartD1ArraySchema(
  SHORT_TEXT_SCHEMA,
  {
    minimumItems: 1,
    maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
  },
)
const INFLUENCE_SCHEMA = createAiChartD1StrictObjectSchema({
  influenceId: ID_SCHEMA,
  relationKind: createAiChartD1StringSchema({
    enumValues: AI_CHART_D1_STRUCTURAL_RELATION_KINDS,
  }),
  visibility: createAiChartD1StringSchema({
    enumValues: AI_CHART_D1_STRUCTURAL_INFLUENCE_VISIBILITIES,
  }),
  sourcePalaceId: PALACE_ID_SCHEMA,
  sourceFacetId: FACET_ID_SCHEMA,
  sourceFactRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 2,
    maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
  }),
  targetPalaceId: PALACE_ID_SCHEMA,
  targetFacetId: FACET_ID_SCHEMA,
  targetClaimRefs: ID_ARRAY_SCHEMA,
  influenceMode: createAiChartD1StringSchema({
    enumValues: AI_CHART_D1_STRUCTURAL_INFLUENCE_MODES,
  }),
  mechanismLink: SHORT_TEXT_SCHEMA,
  possibleEffects: NONEMPTY_SHORT_TEXT_ARRAY_SCHEMA,
  constraints: NONEMPTY_SHORT_TEXT_ARRAY_SCHEMA,
})
const COVERAGE_SCHEMA = createAiChartD1StrictObjectSchema({
  influenceIds: ID_ARRAY_SCHEMA,
  trineInfluenceIds: ID_ARRAY_SCHEMA,
  hiddenCombinationInfluenceIds: ID_ARRAY_SCHEMA,
  sourcePalaceIdsCovered: createAiChartD1ArraySchema(PALACE_ID_SCHEMA),
  sourceFactRefsCovered: ID_ARRAY_SCHEMA,
  targetClaimRefsCovered: ID_ARRAY_SCHEMA,
})

export const AI_CHART_D1_STRUCTURAL_INFLUENCE_RESULT_JSON_SCHEMA: AiChartD1JsonSchema =
  createAiChartD1StrictObjectSchema({
    contractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_STRUCTURAL_INFLUENCE_RESULT_CONTRACT_VERSION,
    }),
    structuralInfluenceResultId: ID_SCHEMA,
    axisResultRef: ID_SCHEMA,
    chartId: ID_SCHEMA,
    runId: ID_SCHEMA,
    callId: ID_SCHEMA,
    targetPalaceId: PALACE_ID_SCHEMA,
    influences: createAiChartD1ArraySchema(INFLUENCE_SCHEMA, {
      maximumItems: AI_CHART_D1_MAX_CANDIDATES_PER_COLLECTION,
    }),
    coverage: COVERAGE_SCHEMA,
    validationStatus: freezeAiChartD1Value({ const: 'validated' }),
  })
