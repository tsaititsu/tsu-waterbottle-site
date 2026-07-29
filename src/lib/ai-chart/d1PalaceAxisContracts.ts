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
} from './d1P1InputContracts'
import {
  AI_CHART_D1_PALACE_FACET_IDS,
  AI_CHART_D1_PALACE_FACET_REGISTRY_VERSION,
  isAiChartD1PalaceFacetAllowed,
  type AiChartD1PalaceFacetId,
} from './d1PalaceFacetRegistry'
import {
  AI_CHART_D1_ACTOR_BINDING_IDS,
  AI_CHART_D1_ACTOR_BINDING_REGISTRY_VERSION,
  AI_CHART_D1_PALACE_AXIS_ACTORS,
  isAiChartD1ClaimActorBindingAllowed,
  type AiChartD1PalaceAxisActor,
} from './d1PalaceActorBindingRegistry'

export const AI_CHART_D1_PALACE_AXIS_RESULT_CONTRACT_VERSION =
  'ai-chart-d1-palace-axis-result/v1' as const
export const AI_CHART_D1_PALACE_AXIS_RESULT_SCHEMA_NAME =
  'ai_chart_d1_palace_axis_result_v1' as const
export const AI_CHART_D1_PALACE_AXIS_RESULT_INVALID =
  'ai_chart_d1_palace_axis_result_invalid' as const

export const AI_CHART_D1_PALACE_AXIS_TARGET_CORE_MODES = Object.freeze([
  'DIRECT_MAIN_STARS',
  'BORROWED_MAIN_STARS',
  'NO_MAIN_STAR',
] as const)
export const AI_CHART_D1_PALACE_AXIS_EXPRESSION_MODES = Object.freeze([
  'OPPOSITE_CHANNEL',
  'MIRRORED_SAME_CORE',
  'OPPOSITE_NOT_BORROWED',
] as const)
export const AI_CHART_D1_PALACE_AXIS_VALIDATION_REASONS = Object.freeze([
  'RESULT_SHAPE_INVALID',
  'FACET_NOT_ALLOWED',
  'AXIS_MODE_MISMATCH',
  'TARGET_CORE_SCOPE_INVALID',
  'BORROWED_STAR_DUPLICATED_AS_OPPOSITE',
  'ACTOR_BINDING_INVALID',
  'COVERAGE_MISMATCH',
  'IDENTITY_OR_RELATION_MISMATCH',
  'EMPTY_PALACE_RESOLUTION_INVALID',
  'SOURCE_REFERENCE_INVALID',
] as const)

export type AiChartD1PalaceAxisTargetCoreMode =
  (typeof AI_CHART_D1_PALACE_AXIS_TARGET_CORE_MODES)[number]
export type AiChartD1PalaceAxisExpressionMode =
  (typeof AI_CHART_D1_PALACE_AXIS_EXPRESSION_MODES)[number]
export type AiChartD1PalaceAxisValidationReason =
  (typeof AI_CHART_D1_PALACE_AXIS_VALIDATION_REASONS)[number]

export type AiChartD1PalaceAxisInteractionRoleBindings = Readonly<{
  frontStarActorBindingRef: string
  rearStarActorBindingRef: string
}>

export type AiChartD1PalaceAxisClaim = Readonly<{
  claimId: string
  facetId: AiChartD1PalaceFacetId
  actor: AiChartD1PalaceAxisActor
  actorBindingRefs: readonly string[]
  doubleStarCoreRef: string | null
  interactionRoleBindings: AiChartD1PalaceAxisInteractionRoleBindings | null
  palaceMeaningRefs: readonly string[]
  targetCoreRefs: readonly string[]
  targetLocalModifierRefs: readonly string[]
  oppositeExpressionRefs: readonly string[]
  natalModifierRefs: readonly string[]
  mechanismLink: string
  possibleExpressions: readonly string[]
  constraints: readonly string[]
}>

export type AiChartD1PalaceAxisCoverage = Readonly<{
  claimIds: readonly string[]
  targetCoreRefsCovered: readonly string[]
  targetLocalModifierRefsCovered: readonly string[]
  oppositeExpressionRefsCovered: readonly string[]
  natalModifierRefsCovered: readonly string[]
}>

export type AiChartD1PalaceAxisResult = Readonly<{
  contractVersion: typeof AI_CHART_D1_PALACE_AXIS_RESULT_CONTRACT_VERSION
  axisResultId: string
  chartId: string
  runId: string
  callId: string
  targetPalaceId: AiChartD1PalaceId
  oppositePalaceId: AiChartD1PalaceId
  facetRegistryVersion: typeof AI_CHART_D1_PALACE_FACET_REGISTRY_VERSION
  actorBindingRegistryVersion: typeof AI_CHART_D1_ACTOR_BINDING_REGISTRY_VERSION
  targetCoreMode: AiChartD1PalaceAxisTargetCoreMode
  axisExpressionMode: AiChartD1PalaceAxisExpressionMode
  claims: readonly AiChartD1PalaceAxisClaim[]
  coverage: AiChartD1PalaceAxisCoverage
  validationStatus: 'validated'
}>

export class AiChartD1PalaceAxisResultError extends Error {
  readonly code = AI_CHART_D1_PALACE_AXIS_RESULT_INVALID
  declare readonly reasonCode: AiChartD1PalaceAxisValidationReason

  constructor(reasonCode: AiChartD1PalaceAxisValidationReason) {
    super(AI_CHART_D1_PALACE_AXIS_RESULT_INVALID)
    this.name = 'AiChartD1PalaceAxisResultError'
    Object.defineProperty(this, 'reasonCode', {
      value: reasonCode,
      enumerable: true,
      writable: false,
      configurable: false,
    })
    Object.freeze(this)
  }
}

export const AI_CHART_D1_PALACE_AXIS_INTERACTION_ROLE_FIELDS =
  Object.freeze([
    'frontStarActorBindingRef',
    'rearStarActorBindingRef',
  ] as const)
export const AI_CHART_D1_PALACE_AXIS_CLAIM_FIELDS = Object.freeze([
  'claimId',
  'facetId',
  'actor',
  'actorBindingRefs',
  'doubleStarCoreRef',
  'interactionRoleBindings',
  'palaceMeaningRefs',
  'targetCoreRefs',
  'targetLocalModifierRefs',
  'oppositeExpressionRefs',
  'natalModifierRefs',
  'mechanismLink',
  'possibleExpressions',
  'constraints',
] as const)
export const AI_CHART_D1_PALACE_AXIS_COVERAGE_FIELDS = Object.freeze([
  'claimIds',
  'targetCoreRefsCovered',
  'targetLocalModifierRefsCovered',
  'oppositeExpressionRefsCovered',
  'natalModifierRefsCovered',
] as const)
export const AI_CHART_D1_PALACE_AXIS_RESULT_FIELDS = Object.freeze([
  'contractVersion',
  'axisResultId',
  'chartId',
  'runId',
  'callId',
  'targetPalaceId',
  'oppositePalaceId',
  'facetRegistryVersion',
  'actorBindingRegistryVersion',
  'targetCoreMode',
  'axisExpressionMode',
  'claims',
  'coverage',
  'validationStatus',
] as const)

function invalid(reasonCode: AiChartD1PalaceAxisValidationReason): never {
  throw new AiChartD1PalaceAxisResultError(reasonCode)
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

function parseInteractionRoleBindings(
  value: unknown,
): AiChartD1PalaceAxisInteractionRoleBindings | null {
  if (value === null) return null
  const record = requireAiChartD1ExactObject(
    value,
    AI_CHART_D1_PALACE_AXIS_INTERACTION_ROLE_FIELDS,
  )
  const bindings = Object.freeze({
    frontStarActorBindingRef: parseAiChartD1Id(
      record.frontStarActorBindingRef,
    ),
    rearStarActorBindingRef: parseAiChartD1Id(
      record.rearStarActorBindingRef,
    ),
  })
  if (
    bindings.frontStarActorBindingRef ===
    bindings.rearStarActorBindingRef
  ) {
    invalid('ACTOR_BINDING_INVALID')
  }
  return bindings
}

function parseNullableId(value: unknown): string | null {
  return value === null ? null : parseAiChartD1Id(value)
}

function parseClaim(
  value: unknown,
  targetPalaceId: AiChartD1PalaceId,
): AiChartD1PalaceAxisClaim {
  const record = requireAiChartD1ExactObject(
    value,
    AI_CHART_D1_PALACE_AXIS_CLAIM_FIELDS,
  )
  const facetId = record.facetId
  if (!isAiChartD1PalaceFacetAllowed(targetPalaceId, facetId)) {
    invalid('FACET_NOT_ALLOWED')
  }

  const actor = parseAiChartD1Enum(
    record.actor,
    AI_CHART_D1_PALACE_AXIS_ACTORS,
  )
  const doubleStarCoreRef = parseNullableId(record.doubleStarCoreRef)
  const interactionRoleBindings = parseInteractionRoleBindings(
    record.interactionRoleBindings,
  )
  const actorBindingRefs = parseIdArray(record.actorBindingRefs, 1)
  if (
    !isAiChartD1ClaimActorBindingAllowed({
      facetId,
      actor,
      actorBindingRefs,
      interactionRoleBindings,
    }) ||
    (interactionRoleBindings !== null && doubleStarCoreRef === null)
  ) {
    invalid('ACTOR_BINDING_INVALID')
  }

  return Object.freeze({
    claimId: parseAiChartD1Id(record.claimId),
    facetId,
    actor,
    actorBindingRefs,
    doubleStarCoreRef,
    interactionRoleBindings,
    palaceMeaningRefs: parseIdArray(record.palaceMeaningRefs, 1),
    targetCoreRefs: parseIdArray(record.targetCoreRefs),
    targetLocalModifierRefs: parseIdArray(record.targetLocalModifierRefs),
    oppositeExpressionRefs: parseIdArray(record.oppositeExpressionRefs),
    natalModifierRefs: parseIdArray(record.natalModifierRefs),
    mechanismLink: parseAiChartD1Text(record.mechanismLink),
    possibleExpressions: parseAiChartD1StringArray(
      record.possibleExpressions,
      {
        minimumItems: 1,
        itemMaximumLength: AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
      },
    ),
    constraints: parseAiChartD1StringArray(record.constraints, {
      minimumItems: 1,
      itemMaximumLength: AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
    }),
  })
}

function parseClaims(
  value: unknown,
  targetPalaceId: AiChartD1PalaceId,
): readonly AiChartD1PalaceAxisClaim[] {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > AI_CHART_D1_MAX_CANDIDATES_PER_COLLECTION
  ) {
    invalid('RESULT_SHAPE_INVALID')
  }
  const claims = Object.freeze(
    value.map((claim) => parseClaim(claim, targetPalaceId)),
  )
  if (new Set(claims.map((claim) => claim.claimId)).size !== claims.length) {
    invalid('RESULT_SHAPE_INVALID')
  }
  return claims
}

function parseCoverage(value: unknown): AiChartD1PalaceAxisCoverage {
  const record = requireAiChartD1ExactObject(
    value,
    AI_CHART_D1_PALACE_AXIS_COVERAGE_FIELDS,
  )
  return Object.freeze({
    claimIds: parseIdArray(record.claimIds, 1),
    targetCoreRefsCovered: parseIdArray(record.targetCoreRefsCovered),
    targetLocalModifierRefsCovered: parseIdArray(
      record.targetLocalModifierRefsCovered,
    ),
    oppositeExpressionRefsCovered: parseIdArray(
      record.oppositeExpressionRefsCovered,
    ),
    natalModifierRefsCovered: parseIdArray(record.natalModifierRefsCovered),
  })
}

function collectUniqueRefs(
  claims: readonly AiChartD1PalaceAxisClaim[],
  field:
    | 'targetCoreRefs'
    | 'targetLocalModifierRefs'
    | 'oppositeExpressionRefs'
    | 'natalModifierRefs',
): readonly string[] {
  const refs = new Set<string>()
  for (const claim of claims) {
    for (const ref of claim[field]) refs.add(ref)
  }
  return Object.freeze([...refs])
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
  claims: readonly AiChartD1PalaceAxisClaim[],
  coverage: AiChartD1PalaceAxisCoverage,
): void {
  const expected = {
    claimIds: claims.map((claim) => claim.claimId),
    targetCoreRefsCovered: collectUniqueRefs(claims, 'targetCoreRefs'),
    targetLocalModifierRefsCovered: collectUniqueRefs(
      claims,
      'targetLocalModifierRefs',
    ),
    oppositeExpressionRefsCovered: collectUniqueRefs(
      claims,
      'oppositeExpressionRefs',
    ),
    natalModifierRefsCovered: collectUniqueRefs(
      claims,
      'natalModifierRefs',
    ),
  }
  if (
    !sameStrings(coverage.claimIds, expected.claimIds) ||
    !sameStrings(
      coverage.targetCoreRefsCovered,
      expected.targetCoreRefsCovered,
    ) ||
    !sameStrings(
      coverage.targetLocalModifierRefsCovered,
      expected.targetLocalModifierRefsCovered,
    ) ||
    !sameStrings(
      coverage.oppositeExpressionRefsCovered,
      expected.oppositeExpressionRefsCovered,
    ) ||
    !sameStrings(
      coverage.natalModifierRefsCovered,
      expected.natalModifierRefsCovered,
    )
  ) {
    invalid('COVERAGE_MISMATCH')
  }
}

function validateAxisModes(
  targetCoreMode: AiChartD1PalaceAxisTargetCoreMode,
  axisExpressionMode: AiChartD1PalaceAxisExpressionMode,
  coverage: AiChartD1PalaceAxisCoverage,
): void {
  const expectedExpressionMode = {
    DIRECT_MAIN_STARS: 'OPPOSITE_CHANNEL',
    BORROWED_MAIN_STARS: 'MIRRORED_SAME_CORE',
    NO_MAIN_STAR: 'OPPOSITE_NOT_BORROWED',
  } as const satisfies Readonly<
    Record<
      AiChartD1PalaceAxisTargetCoreMode,
      AiChartD1PalaceAxisExpressionMode
    >
  >
  if (axisExpressionMode !== expectedExpressionMode[targetCoreMode]) {
    invalid('AXIS_MODE_MISMATCH')
  }
  if (
    targetCoreMode === 'NO_MAIN_STAR'
      ? coverage.targetCoreRefsCovered.length !== 0
      : coverage.targetCoreRefsCovered.length === 0
  ) {
    invalid('TARGET_CORE_SCOPE_INVALID')
  }
  if (
    targetCoreMode === 'BORROWED_MAIN_STARS' &&
    coverage.oppositeExpressionRefsCovered.length > 0
  ) {
    invalid('BORROWED_STAR_DUPLICATED_AS_OPPOSITE')
  }
}

function sameStringSets(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value) => right.includes(value))
  )
}

function isStringSubset(
  values: readonly string[],
  allowed: ReadonlySet<string>,
): boolean {
  return values.every((value) => allowed.has(value))
}

function directCoreRefs(
  palace: AiChartD1P1StructuralPalace,
): readonly string[] {
  return Object.freeze(
    palace.canonicalMajorStars.map((star) => star.placementId),
  )
}

function borrowedCoreRefs(
  palace: AiChartD1P1StructuralPalace,
): readonly string[] {
  return Object.freeze(
    palace.borrowedMajorStars.map((star) => star.borrowedPlacementId),
  )
}

function expectedCoreMode(
  input: AiChartD1P1StructuralInput,
): AiChartD1PalaceAxisTargetCoreMode {
  switch (input.targetPalace.borrowStatus) {
    case 'not_empty':
      return 'DIRECT_MAIN_STARS'
    case 'eligible_and_borrowed':
      return 'BORROWED_MAIN_STARS'
    case 'blocked_by_local_star':
    case 'opposite_empty':
      return 'NO_MAIN_STAR'
  }
}

function natalModifierRefSet(
  input: AiChartD1P1StructuralInput,
): ReadonlySet<string> {
  const refs = new Set<string>()
  for (const star of [
    ...input.targetPalace.canonicalMajorStars,
    ...input.targetPalace.modeledSupportingStars,
    ...input.oppositePalace.canonicalMajorStars,
  ]) {
    if (star.natalMutagen !== null) refs.add(star.placementId)
  }
  for (const star of input.targetPalace.borrowedMajorStars) {
    if (star.natalMutagen !== null) refs.add(star.borrowedPlacementId)
  }
  return refs
}

export function parseAiChartD1PalaceAxisResult(
  value: unknown,
): AiChartD1PalaceAxisResult {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(
      value,
      AI_CHART_D1_PALACE_AXIS_RESULT_FIELDS,
    )
    if (
      record.contractVersion !==
        AI_CHART_D1_PALACE_AXIS_RESULT_CONTRACT_VERSION ||
      record.facetRegistryVersion !==
        AI_CHART_D1_PALACE_FACET_REGISTRY_VERSION ||
      record.actorBindingRegistryVersion !==
        AI_CHART_D1_ACTOR_BINDING_REGISTRY_VERSION ||
      record.validationStatus !== 'validated'
    ) {
      invalid('RESULT_SHAPE_INVALID')
    }

    const targetPalaceId = parsePalaceId(record.targetPalaceId)
    const oppositePalaceId = parsePalaceId(record.oppositePalaceId)
    if (targetPalaceId === oppositePalaceId) {
      invalid('RESULT_SHAPE_INVALID')
    }
    const targetCoreMode = parseAiChartD1Enum(
      record.targetCoreMode,
      AI_CHART_D1_PALACE_AXIS_TARGET_CORE_MODES,
    )
    const axisExpressionMode = parseAiChartD1Enum(
      record.axisExpressionMode,
      AI_CHART_D1_PALACE_AXIS_EXPRESSION_MODES,
    )
    const claims = parseClaims(record.claims, targetPalaceId)
    const coverage = parseCoverage(record.coverage)
    validateCoverage(claims, coverage)
    validateAxisModes(targetCoreMode, axisExpressionMode, coverage)

    return freezeAiChartD1Value({
      contractVersion: AI_CHART_D1_PALACE_AXIS_RESULT_CONTRACT_VERSION,
      axisResultId: parseAiChartD1Id(record.axisResultId),
      chartId: parseAiChartD1Id(record.chartId),
      runId: parseAiChartD1Id(record.runId),
      callId: parseAiChartD1Id(record.callId),
      targetPalaceId,
      oppositePalaceId,
      facetRegistryVersion: AI_CHART_D1_PALACE_FACET_REGISTRY_VERSION,
      actorBindingRegistryVersion:
        AI_CHART_D1_ACTOR_BINDING_REGISTRY_VERSION,
      targetCoreMode,
      axisExpressionMode,
      claims,
      coverage,
      validationStatus: 'validated' as const,
    })
  } catch (error) {
    if (error instanceof AiChartD1PalaceAxisResultError) throw error
    invalid('RESULT_SHAPE_INVALID')
  }
}

export function validateAiChartD1PalaceAxisResultAgainstStructuralInput(
  value: unknown,
  structuralInput: AiChartD1P1StructuralInput,
): AiChartD1PalaceAxisResult {
  const result = parseAiChartD1PalaceAxisResult(value)
  let input: AiChartD1P1StructuralInput
  try {
    input = parseAiChartD1P1StructuralInput(structuralInput)
  } catch {
    invalid('SOURCE_REFERENCE_INVALID')
  }

  if (
    result.chartId !== input.chartId ||
    result.runId !== input.runId ||
    result.callId !== input.callId ||
    result.targetPalaceId !== input.targetPalace.palaceId ||
    result.oppositePalaceId !== input.oppositePalace.palaceId
  ) {
    invalid('IDENTITY_OR_RELATION_MISMATCH')
  }

  const requiredCoreMode = expectedCoreMode(input)
  if (result.targetCoreMode !== requiredCoreMode) {
    invalid('EMPTY_PALACE_RESOLUTION_INVALID')
  }

  const expectedTargetCoreRefs =
    requiredCoreMode === 'DIRECT_MAIN_STARS'
      ? directCoreRefs(input.targetPalace)
      : requiredCoreMode === 'BORROWED_MAIN_STARS'
        ? borrowedCoreRefs(input.targetPalace)
        : []
  if (
    !sameStringSets(
      result.coverage.targetCoreRefsCovered,
      expectedTargetCoreRefs,
    )
  ) {
    invalid('SOURCE_REFERENCE_INVALID')
  }

  const allowedLocalModifierRefs = new Set(
    input.targetPalace.modeledSupportingStars.map(
      (star) => star.placementId,
    ),
  )
  if (
    !isStringSubset(
      result.coverage.targetLocalModifierRefsCovered,
      allowedLocalModifierRefs,
    )
  ) {
    invalid('SOURCE_REFERENCE_INVALID')
  }

  const allowedOppositeExpressionRefs = directCoreRefs(
    input.oppositePalace,
  )
  if (
    requiredCoreMode === 'DIRECT_MAIN_STARS'
      ? !sameStringSets(
          result.coverage.oppositeExpressionRefsCovered,
          allowedOppositeExpressionRefs,
        )
      : requiredCoreMode === 'NO_MAIN_STAR' &&
        !isStringSubset(
          result.coverage.oppositeExpressionRefsCovered,
          new Set(allowedOppositeExpressionRefs),
        )
  ) {
    invalid('SOURCE_REFERENCE_INVALID')
  }

  const usedRefs = new Set([
    ...result.coverage.targetCoreRefsCovered,
    ...result.coverage.targetLocalModifierRefsCovered,
    ...result.coverage.oppositeExpressionRefsCovered,
  ])
  const allowedNatalModifierRefs = natalModifierRefSet(input)
  const expectedNatalModifierRefs = [...usedRefs].filter((ref) =>
    allowedNatalModifierRefs.has(ref),
  )
  if (
    !sameStringSets(
      result.coverage.natalModifierRefsCovered,
      expectedNatalModifierRefs,
    )
  ) {
    invalid('SOURCE_REFERENCE_INVALID')
  }

  return result
}

const ID_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 128,
  pattern: AI_CHART_D1_ID_PATTERN.source,
})
const SHORT_TEXT_SCHEMA = createAiChartD1StringSchema({
  maximumLength: AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
})
const PALACE_ID_SCHEMA = createAiChartD1StringSchema({
  enumValues: AI_CHART_D1_PALACE_IDENTITIES.map(
    (identity) => identity.palaceId,
  ),
})
const FACET_ID_SCHEMA = createAiChartD1StringSchema({
  enumValues: AI_CHART_D1_PALACE_FACET_IDS,
})
const ACTOR_BINDING_ID_SCHEMA = createAiChartD1StringSchema({
  enumValues: AI_CHART_D1_ACTOR_BINDING_IDS,
})
const ID_ARRAY_SCHEMA = createAiChartD1ArraySchema(ID_SCHEMA, {
  maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
})
const NONEMPTY_ID_ARRAY_SCHEMA = createAiChartD1ArraySchema(ID_SCHEMA, {
  minimumItems: 1,
  maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
})
const SINGLE_ACTOR_BINDING_ARRAY_SCHEMA = createAiChartD1ArraySchema(
  ACTOR_BINDING_ID_SCHEMA,
  {
    minimumItems: 1,
    maximumItems: 1,
  },
)
const NONEMPTY_SHORT_TEXT_ARRAY_SCHEMA = createAiChartD1ArraySchema(
  SHORT_TEXT_SCHEMA,
  {
    minimumItems: 1,
    maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
  },
)
const INTERACTION_ROLE_SCHEMA = createAiChartD1StrictObjectSchema({
  frontStarActorBindingRef: ACTOR_BINDING_ID_SCHEMA,
  rearStarActorBindingRef: ACTOR_BINDING_ID_SCHEMA,
})
const NULLABLE_INTERACTION_ROLE_SCHEMA = freezeAiChartD1Value({
  anyOf: [INTERACTION_ROLE_SCHEMA, freezeAiChartD1Value({ type: 'null' })],
})

export const AI_CHART_D1_PALACE_AXIS_CLAIM_JSON_SCHEMA =
  createAiChartD1StrictObjectSchema({
    claimId: ID_SCHEMA,
    facetId: FACET_ID_SCHEMA,
    actor: createAiChartD1StringSchema({
      enumValues: AI_CHART_D1_PALACE_AXIS_ACTORS,
    }),
    actorBindingRefs: SINGLE_ACTOR_BINDING_ARRAY_SCHEMA,
    doubleStarCoreRef: createAiChartD1StringSchema({
      maximumLength: 128,
      pattern: AI_CHART_D1_ID_PATTERN.source,
      nullable: true,
    }),
    interactionRoleBindings: NULLABLE_INTERACTION_ROLE_SCHEMA,
    palaceMeaningRefs: NONEMPTY_ID_ARRAY_SCHEMA,
    targetCoreRefs: ID_ARRAY_SCHEMA,
    targetLocalModifierRefs: ID_ARRAY_SCHEMA,
    oppositeExpressionRefs: ID_ARRAY_SCHEMA,
    natalModifierRefs: ID_ARRAY_SCHEMA,
    mechanismLink: createAiChartD1StringSchema(),
    possibleExpressions: NONEMPTY_SHORT_TEXT_ARRAY_SCHEMA,
    constraints: NONEMPTY_SHORT_TEXT_ARRAY_SCHEMA,
  })

export const AI_CHART_D1_PALACE_AXIS_COVERAGE_JSON_SCHEMA =
  createAiChartD1StrictObjectSchema({
    claimIds: NONEMPTY_ID_ARRAY_SCHEMA,
    targetCoreRefsCovered: ID_ARRAY_SCHEMA,
    targetLocalModifierRefsCovered: ID_ARRAY_SCHEMA,
    oppositeExpressionRefsCovered: ID_ARRAY_SCHEMA,
    natalModifierRefsCovered: ID_ARRAY_SCHEMA,
  })

export const AI_CHART_D1_PALACE_AXIS_RESULT_JSON_SCHEMA: AiChartD1JsonSchema =
  createAiChartD1StrictObjectSchema({
    contractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_PALACE_AXIS_RESULT_CONTRACT_VERSION,
    }),
    axisResultId: ID_SCHEMA,
    chartId: ID_SCHEMA,
    runId: ID_SCHEMA,
    callId: ID_SCHEMA,
    targetPalaceId: PALACE_ID_SCHEMA,
    oppositePalaceId: PALACE_ID_SCHEMA,
    facetRegistryVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_PALACE_FACET_REGISTRY_VERSION,
    }),
    actorBindingRegistryVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_ACTOR_BINDING_REGISTRY_VERSION,
    }),
    targetCoreMode: createAiChartD1StringSchema({
      enumValues: AI_CHART_D1_PALACE_AXIS_TARGET_CORE_MODES,
    }),
    axisExpressionMode: createAiChartD1StringSchema({
      enumValues: AI_CHART_D1_PALACE_AXIS_EXPRESSION_MODES,
    }),
    claims: createAiChartD1ArraySchema(
      AI_CHART_D1_PALACE_AXIS_CLAIM_JSON_SCHEMA,
      {
        minimumItems: 1,
        maximumItems: AI_CHART_D1_MAX_CANDIDATES_PER_COLLECTION,
      },
    ),
    coverage: AI_CHART_D1_PALACE_AXIS_COVERAGE_JSON_SCHEMA,
    validationStatus: freezeAiChartD1Value({ const: 'validated' }),
  })
