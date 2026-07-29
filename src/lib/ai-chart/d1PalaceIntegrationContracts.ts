import {
  AI_CHART_D1_ID_PATTERN,
  AI_CHART_D1_MAX_LIST_ITEMS,
  assertAiChartD1SafeGraph,
  createAiChartD1ArraySchema,
  createAiChartD1StrictObjectSchema,
  createAiChartD1StringSchema,
  freezeAiChartD1Value,
  parseAiChartD1Enum,
  parseAiChartD1Id,
  parseAiChartD1StringArray,
  requireAiChartD1ExactObject,
  type AiChartD1JsonSchema,
} from './d1CommonContracts'
import {
  AI_CHART_D1_PALACE_IDENTITIES,
  type AiChartD1PalaceId,
} from './d1N0Constants'
import type { AiChartD1P1StructuralInput } from './d1P1InputContracts'
import {
  validateAiChartD1PalaceAxisResultAgainstStructuralInput,
  type AiChartD1PalaceAxisClaim,
  type AiChartD1PalaceAxisResult,
} from './d1PalaceAxisContracts'
import {
  AI_CHART_D1_PALACE_FACET_IDS,
  isAiChartD1PalaceFacetAllowed,
  type AiChartD1PalaceFacetId,
} from './d1PalaceFacetRegistry'
import {
  validateAiChartD1StructuralInfluenceResultAgainstSources,
  type AiChartD1StructuralInfluence,
  type AiChartD1StructuralInfluenceResult,
} from './d1StructuralInfluenceContracts'

export const AI_CHART_D1_PALACE_REASONING_RESULT_CONTRACT_VERSION =
  'ai-chart-d1-palace-reasoning-result/v1' as const
export const AI_CHART_D1_PALACE_REASONING_RESULT_SCHEMA_NAME =
  'ai_chart_d1_palace_reasoning_result_v1' as const
export const AI_CHART_D1_PALACE_REASONING_RESULT_INVALID =
  'ai_chart_d1_palace_reasoning_result_invalid' as const

export const AI_CHART_D1_PALACE_REASONING_NODE_KINDS = Object.freeze([
  'AXIS_CLAIM',
  'STRUCTURAL_INFLUENCE',
] as const)
export const AI_CHART_D1_PALACE_REASONING_VALIDATION_REASONS =
  Object.freeze([
    'RESULT_SHAPE_INVALID',
    'IDENTITY_OR_AXIS_MISMATCH',
    'STRUCTURAL_RESULT_MISMATCH',
    'FACET_INDEX_MISMATCH',
    'SOURCE_GRAPH_MISMATCH',
    'COVERAGE_MISMATCH',
  ] as const)

export type AiChartD1PalaceReasoningNodeKind =
  (typeof AI_CHART_D1_PALACE_REASONING_NODE_KINDS)[number]
export type AiChartD1PalaceReasoningValidationReason =
  (typeof AI_CHART_D1_PALACE_REASONING_VALIDATION_REASONS)[number]

export type AiChartD1PalaceReasoningFacetIndexEntry = Readonly<{
  facetId: AiChartD1PalaceFacetId
  axisClaimRefs: readonly string[]
  structuralInfluenceRefs: readonly string[]
}>

export type AiChartD1PalaceReasoningSourceGraphEntry = Readonly<{
  nodeRef: string
  nodeKind: AiChartD1PalaceReasoningNodeKind
  sourceRefs: readonly string[]
  targetRefs: readonly string[]
}>

export type AiChartD1PalaceReasoningCoverage = Readonly<{
  facetIds: readonly AiChartD1PalaceFacetId[]
  axisClaimRefs: readonly string[]
  structuralInfluenceRefs: readonly string[]
  sourceRefs: readonly string[]
}>

export type AiChartD1PalaceReasoningResult = Readonly<{
  contractVersion: typeof AI_CHART_D1_PALACE_REASONING_RESULT_CONTRACT_VERSION
  palaceResultId: string
  chartId: string
  runId: string
  callId: string
  targetPalaceId: AiChartD1PalaceId
  axisResultRef: string
  structuralInfluenceResultRef: string
  structuralInfluenceRefs: readonly string[]
  facetIndex: readonly AiChartD1PalaceReasoningFacetIndexEntry[]
  sourceGraph: readonly AiChartD1PalaceReasoningSourceGraphEntry[]
  coverage: AiChartD1PalaceReasoningCoverage
  validationStatus: 'validated'
}>

export class AiChartD1PalaceReasoningResultError extends Error {
  readonly code = AI_CHART_D1_PALACE_REASONING_RESULT_INVALID
  declare readonly reasonCode: AiChartD1PalaceReasoningValidationReason

  constructor(reasonCode: AiChartD1PalaceReasoningValidationReason) {
    super(AI_CHART_D1_PALACE_REASONING_RESULT_INVALID)
    this.name = 'AiChartD1PalaceReasoningResultError'
    Object.defineProperty(this, 'reasonCode', {
      value: reasonCode,
      enumerable: true,
      writable: false,
      configurable: false,
    })
    Object.freeze(this)
  }
}

const FACET_INDEX_FIELDS = Object.freeze([
  'facetId',
  'axisClaimRefs',
  'structuralInfluenceRefs',
] as const)
const SOURCE_GRAPH_FIELDS = Object.freeze([
  'nodeRef',
  'nodeKind',
  'sourceRefs',
  'targetRefs',
] as const)
const COVERAGE_FIELDS = Object.freeze([
  'facetIds',
  'axisClaimRefs',
  'structuralInfluenceRefs',
  'sourceRefs',
] as const)
const RESULT_FIELDS = Object.freeze([
  'contractVersion',
  'palaceResultId',
  'chartId',
  'runId',
  'callId',
  'targetPalaceId',
  'axisResultRef',
  'structuralInfluenceResultRef',
  'structuralInfluenceRefs',
  'facetIndex',
  'sourceGraph',
  'coverage',
  'validationStatus',
] as const)

function invalid(
  reasonCode: AiChartD1PalaceReasoningValidationReason,
): never {
  throw new AiChartD1PalaceReasoningResultError(reasonCode)
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

function sameStringMembers(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    left.every((value) => right.includes(value))
  )
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

function parseFacetIndexEntry(
  value: unknown,
  targetPalaceId: AiChartD1PalaceId,
): AiChartD1PalaceReasoningFacetIndexEntry {
  const record = requireAiChartD1ExactObject(value, FACET_INDEX_FIELDS)
  const facetId = parseAiChartD1Enum(
    record.facetId,
    AI_CHART_D1_PALACE_FACET_IDS,
  )
  if (!isAiChartD1PalaceFacetAllowed(targetPalaceId, facetId)) {
    invalid('FACET_INDEX_MISMATCH')
  }
  const axisClaimRefs = parseIdArray(record.axisClaimRefs)
  const structuralInfluenceRefs = parseIdArray(
    record.structuralInfluenceRefs,
  )
  if (axisClaimRefs.length + structuralInfluenceRefs.length === 0) {
    invalid('FACET_INDEX_MISMATCH')
  }
  return freezeAiChartD1Value({
    facetId,
    axisClaimRefs,
    structuralInfluenceRefs,
  })
}

function parseFacetIndex(
  value: unknown,
  targetPalaceId: AiChartD1PalaceId,
): readonly AiChartD1PalaceReasoningFacetIndexEntry[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > AI_CHART_D1_PALACE_FACET_IDS.length
  ) {
    invalid('FACET_INDEX_MISMATCH')
  }
  const entries = value.map((entry) =>
    parseFacetIndexEntry(entry, targetPalaceId),
  )
  if (
    new Set(entries.map((entry) => entry.facetId)).size !==
    entries.length
  ) {
    invalid('FACET_INDEX_MISMATCH')
  }
  return Object.freeze(entries)
}

function parseSourceGraphEntry(
  value: unknown,
): AiChartD1PalaceReasoningSourceGraphEntry {
  const record = requireAiChartD1ExactObject(value, SOURCE_GRAPH_FIELDS)
  const nodeKind = parseAiChartD1Enum(
    record.nodeKind,
    AI_CHART_D1_PALACE_REASONING_NODE_KINDS,
  )
  const sourceRefs = parseIdArray(
    record.sourceRefs,
    nodeKind === 'STRUCTURAL_INFLUENCE' ? 2 : 1,
  )
  const targetRefs = parseIdArray(record.targetRefs)
  if (nodeKind === 'AXIS_CLAIM' && targetRefs.length !== 0) {
    invalid('SOURCE_GRAPH_MISMATCH')
  }
  return freezeAiChartD1Value({
    nodeRef: parseAiChartD1Id(record.nodeRef),
    nodeKind,
    sourceRefs,
    targetRefs,
  })
}

function parseSourceGraph(
  value: unknown,
): readonly AiChartD1PalaceReasoningSourceGraphEntry[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > AI_CHART_D1_MAX_LIST_ITEMS
  ) {
    invalid('SOURCE_GRAPH_MISMATCH')
  }
  const entries = value.map(parseSourceGraphEntry)
  if (
    new Set(entries.map((entry) => entry.nodeRef)).size !== entries.length
  ) {
    invalid('SOURCE_GRAPH_MISMATCH')
  }
  return Object.freeze(entries)
}

function parseCoverage(
  value: unknown,
  targetPalaceId: AiChartD1PalaceId,
): AiChartD1PalaceReasoningCoverage {
  const record = requireAiChartD1ExactObject(value, COVERAGE_FIELDS)
  const facetIds = parseAiChartD1StringArray(record.facetIds, {
    minimumItems: 1,
    maximumItems: AI_CHART_D1_PALACE_FACET_IDS.length,
    parseItem: (item) => {
      const facetId = parseAiChartD1Enum(
        item,
        AI_CHART_D1_PALACE_FACET_IDS,
      )
      if (!isAiChartD1PalaceFacetAllowed(targetPalaceId, facetId)) {
        invalid('COVERAGE_MISMATCH')
      }
      return facetId
    },
  }) as readonly AiChartD1PalaceFacetId[]
  return freezeAiChartD1Value({
    facetIds,
    axisClaimRefs: parseIdArray(record.axisClaimRefs, 1),
    structuralInfluenceRefs: parseIdArray(
      record.structuralInfluenceRefs,
    ),
    sourceRefs: parseIdArray(record.sourceRefs, 1),
  })
}

function validateInternalConsistency(
  structuralInfluenceRefs: readonly string[],
  facetIndex: readonly AiChartD1PalaceReasoningFacetIndexEntry[],
  sourceGraph: readonly AiChartD1PalaceReasoningSourceGraphEntry[],
  coverage: AiChartD1PalaceReasoningCoverage,
): void {
  if (
    !sameStrings(
      structuralInfluenceRefs,
      coverage.structuralInfluenceRefs,
    ) ||
    !sameStrings(
      facetIndex.map((entry) => entry.facetId),
      coverage.facetIds,
    )
  ) {
    invalid('COVERAGE_MISMATCH')
  }

  const graphAxisRefs = sourceGraph
    .filter((entry) => entry.nodeKind === 'AXIS_CLAIM')
    .map((entry) => entry.nodeRef)
  const graphStructuralRefs = sourceGraph
    .filter((entry) => entry.nodeKind === 'STRUCTURAL_INFLUENCE')
    .map((entry) => entry.nodeRef)
  if (
    !sameStrings(graphAxisRefs, coverage.axisClaimRefs) ||
    !sameStrings(graphStructuralRefs, structuralInfluenceRefs) ||
    !sameStrings(
      sourceGraph.map((entry) => entry.nodeRef),
      [...graphAxisRefs, ...graphStructuralRefs],
    )
  ) {
    invalid('SOURCE_GRAPH_MISMATCH')
  }

  const indexedAxisRefs = facetIndex.flatMap(
    (entry) => entry.axisClaimRefs,
  )
  const indexedStructuralRefs = facetIndex.flatMap(
    (entry) => entry.structuralInfluenceRefs,
  )
  if (
    !sameStringMembers(indexedAxisRefs, graphAxisRefs) ||
    !sameStringMembers(indexedStructuralRefs, graphStructuralRefs)
  ) {
    invalid('FACET_INDEX_MISMATCH')
  }

  const axisRefSet = new Set(graphAxisRefs)
  for (const entry of sourceGraph) {
    if (
      entry.nodeKind === 'STRUCTURAL_INFLUENCE' &&
      entry.targetRefs.some((ref) => !axisRefSet.has(ref))
    ) {
      invalid('SOURCE_GRAPH_MISMATCH')
    }
  }
  const sourceRefs = collectUnique(
    sourceGraph.map((entry) => entry.sourceRefs),
  )
  if (!sameStrings(sourceRefs, coverage.sourceRefs)) {
    invalid('SOURCE_GRAPH_MISMATCH')
  }
}

function claimSourceRefs(
  claim: AiChartD1PalaceAxisClaim,
): readonly string[] {
  const roleBindingRefs =
    claim.interactionRoleBindings === null
      ? []
      : [
          claim.interactionRoleBindings.frontStarActorBindingRef,
          claim.interactionRoleBindings.rearStarActorBindingRef,
        ]
  return collectUnique([
    claim.actorBindingRefs,
    claim.doubleStarCoreRef === null ? [] : [claim.doubleStarCoreRef],
    roleBindingRefs,
    claim.palaceMeaningRefs,
    claim.targetCoreRefs,
    claim.targetLocalModifierRefs,
    claim.oppositeExpressionRefs,
    claim.natalModifierRefs,
  ])
}

function claimGraphEntry(
  claim: AiChartD1PalaceAxisClaim,
): AiChartD1PalaceReasoningSourceGraphEntry {
  return freezeAiChartD1Value({
    nodeRef: claim.claimId,
    nodeKind: 'AXIS_CLAIM' as const,
    sourceRefs: claimSourceRefs(claim),
    targetRefs: Object.freeze([] as string[]),
  })
}

function influenceGraphEntry(
  influence: AiChartD1StructuralInfluence,
): AiChartD1PalaceReasoningSourceGraphEntry {
  return freezeAiChartD1Value({
    nodeRef: influence.influenceId,
    nodeKind: 'STRUCTURAL_INFLUENCE' as const,
    sourceRefs: Object.freeze([...influence.sourceFactRefs]),
    targetRefs: Object.freeze([...influence.targetClaimRefs]),
  })
}

function buildFacetIndex(
  axisResult: AiChartD1PalaceAxisResult,
  structuralResult: AiChartD1StructuralInfluenceResult,
): readonly AiChartD1PalaceReasoningFacetIndexEntry[] {
  const facetIds = collectUnique([
    axisResult.claims.map((claim) => claim.facetId),
    structuralResult.influences.map(
      (influence) => influence.targetFacetId,
    ),
  ]) as readonly AiChartD1PalaceFacetId[]
  return freezeAiChartD1Value(
    facetIds.map((facetId) => ({
      facetId,
      axisClaimRefs: axisResult.claims
        .filter((claim) => claim.facetId === facetId)
        .map((claim) => claim.claimId),
      structuralInfluenceRefs: structuralResult.influences
        .filter((influence) => influence.targetFacetId === facetId)
        .map((influence) => influence.influenceId),
    })),
  )
}

function deriveAiChartD1PalaceReasoningResult(
  palaceResultId: string,
  axisResult: AiChartD1PalaceAxisResult,
  structuralResult: AiChartD1StructuralInfluenceResult,
): AiChartD1PalaceReasoningResult {
  const structuralInfluenceRefs = Object.freeze(
    structuralResult.influences.map(
      (influence) => influence.influenceId,
    ),
  )
  const facetIndex = buildFacetIndex(axisResult, structuralResult)
  const sourceGraph = freezeAiChartD1Value([
    ...axisResult.claims.map(claimGraphEntry),
    ...structuralResult.influences.map(influenceGraphEntry),
  ])
  const coverage = freezeAiChartD1Value({
    facetIds: facetIndex.map((entry) => entry.facetId),
    axisClaimRefs: axisResult.claims.map((claim) => claim.claimId),
    structuralInfluenceRefs,
    sourceRefs: collectUnique(
      sourceGraph.map((entry) => entry.sourceRefs),
    ),
  })

  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_REASONING_RESULT_CONTRACT_VERSION,
    palaceResultId,
    chartId: axisResult.chartId,
    runId: axisResult.runId,
    callId: axisResult.callId,
    targetPalaceId: axisResult.targetPalaceId,
    axisResultRef: axisResult.axisResultId,
    structuralInfluenceResultRef:
      structuralResult.structuralInfluenceResultId,
    structuralInfluenceRefs,
    facetIndex,
    sourceGraph,
    coverage,
    validationStatus: 'validated' as const,
  })
}

export function parseAiChartD1PalaceReasoningResult(
  value: unknown,
): AiChartD1PalaceReasoningResult {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(value, RESULT_FIELDS)
    if (
      record.contractVersion !==
        AI_CHART_D1_PALACE_REASONING_RESULT_CONTRACT_VERSION ||
      record.validationStatus !== 'validated'
    ) {
      invalid('RESULT_SHAPE_INVALID')
    }
    const targetPalaceId = parsePalaceId(record.targetPalaceId)
    const structuralInfluenceRefs = parseIdArray(
      record.structuralInfluenceRefs,
    )
    const facetIndex = parseFacetIndex(
      record.facetIndex,
      targetPalaceId,
    )
    const sourceGraph = parseSourceGraph(record.sourceGraph)
    const coverage = parseCoverage(record.coverage, targetPalaceId)
    validateInternalConsistency(
      structuralInfluenceRefs,
      facetIndex,
      sourceGraph,
      coverage,
    )

    return freezeAiChartD1Value({
      contractVersion:
        AI_CHART_D1_PALACE_REASONING_RESULT_CONTRACT_VERSION,
      palaceResultId: parseAiChartD1Id(record.palaceResultId),
      chartId: parseAiChartD1Id(record.chartId),
      runId: parseAiChartD1Id(record.runId),
      callId: parseAiChartD1Id(record.callId),
      targetPalaceId,
      axisResultRef: parseAiChartD1Id(record.axisResultRef),
      structuralInfluenceResultRef: parseAiChartD1Id(
        record.structuralInfluenceResultRef,
      ),
      structuralInfluenceRefs,
      facetIndex,
      sourceGraph,
      coverage,
      validationStatus: 'validated' as const,
    })
  } catch (error) {
    if (error instanceof AiChartD1PalaceReasoningResultError) {
      throw error
    }
    invalid('RESULT_SHAPE_INVALID')
  }
}

export function buildAiChartD1PalaceReasoningResult(
  options: Readonly<{
    palaceResultId: string
    axisResult: AiChartD1PalaceAxisResult
    structuralInfluenceResult: AiChartD1StructuralInfluenceResult
    structuralInput: AiChartD1P1StructuralInput
  }>,
): AiChartD1PalaceReasoningResult {
  let palaceResultId: string
  try {
    palaceResultId = parseAiChartD1Id(options.palaceResultId)
  } catch {
    invalid('RESULT_SHAPE_INVALID')
  }

  let axisResult: AiChartD1PalaceAxisResult
  try {
    axisResult =
      validateAiChartD1PalaceAxisResultAgainstStructuralInput(
        options.axisResult,
        options.structuralInput,
      )
  } catch {
    invalid('IDENTITY_OR_AXIS_MISMATCH')
  }

  let structuralResult: AiChartD1StructuralInfluenceResult
  try {
    structuralResult =
      validateAiChartD1StructuralInfluenceResultAgainstSources(
        options.structuralInfluenceResult,
        axisResult,
        options.structuralInput,
      )
  } catch {
    invalid('STRUCTURAL_RESULT_MISMATCH')
  }
  return parseAiChartD1PalaceReasoningResult(
    deriveAiChartD1PalaceReasoningResult(
      palaceResultId,
      axisResult,
      structuralResult,
    ),
  )
}

export function validateAiChartD1PalaceReasoningResultAgainstSources(
  value: unknown,
  axisValue: AiChartD1PalaceAxisResult,
  structuralValue: AiChartD1StructuralInfluenceResult,
  structuralInput: AiChartD1P1StructuralInput,
): AiChartD1PalaceReasoningResult {
  const result = parseAiChartD1PalaceReasoningResult(value)
  let axisResult: AiChartD1PalaceAxisResult
  try {
    axisResult =
      validateAiChartD1PalaceAxisResultAgainstStructuralInput(
        axisValue,
        structuralInput,
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

  let structuralResult: AiChartD1StructuralInfluenceResult
  try {
    structuralResult =
      validateAiChartD1StructuralInfluenceResultAgainstSources(
        structuralValue,
        axisResult,
        structuralInput,
      )
  } catch {
    invalid('STRUCTURAL_RESULT_MISMATCH')
  }
  if (
    result.structuralInfluenceResultRef !==
      structuralResult.structuralInfluenceResultId ||
    !sameStrings(
      result.structuralInfluenceRefs,
      structuralResult.influences.map(
        (influence) => influence.influenceId,
      ),
    )
  ) {
    invalid('STRUCTURAL_RESULT_MISMATCH')
  }

  const expected = deriveAiChartD1PalaceReasoningResult(
    result.palaceResultId,
    axisResult,
    structuralResult,
  )
  if (
    JSON.stringify(result.facetIndex) !==
    JSON.stringify(expected.facetIndex)
  ) {
    invalid('FACET_INDEX_MISMATCH')
  }
  if (
    JSON.stringify(result.sourceGraph) !==
    JSON.stringify(expected.sourceGraph)
  ) {
    invalid('SOURCE_GRAPH_MISMATCH')
  }
  if (
    JSON.stringify(result.coverage) !==
    JSON.stringify(expected.coverage)
  ) {
    invalid('COVERAGE_MISMATCH')
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
const ID_ARRAY_SCHEMA = createAiChartD1ArraySchema(ID_SCHEMA, {
  maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
})
const FACET_INDEX_SCHEMA = createAiChartD1StrictObjectSchema({
  facetId: FACET_ID_SCHEMA,
  axisClaimRefs: ID_ARRAY_SCHEMA,
  structuralInfluenceRefs: ID_ARRAY_SCHEMA,
})
const SOURCE_GRAPH_SCHEMA = createAiChartD1StrictObjectSchema({
  nodeRef: ID_SCHEMA,
  nodeKind: createAiChartD1StringSchema({
    enumValues: AI_CHART_D1_PALACE_REASONING_NODE_KINDS,
  }),
  sourceRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 1,
    maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
  }),
  targetRefs: ID_ARRAY_SCHEMA,
})
const COVERAGE_SCHEMA = createAiChartD1StrictObjectSchema({
  facetIds: createAiChartD1ArraySchema(FACET_ID_SCHEMA, {
    minimumItems: 1,
    maximumItems: AI_CHART_D1_PALACE_FACET_IDS.length,
  }),
  axisClaimRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 1,
    maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
  }),
  structuralInfluenceRefs: ID_ARRAY_SCHEMA,
  sourceRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 1,
    maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
  }),
})

export const AI_CHART_D1_PALACE_REASONING_RESULT_JSON_SCHEMA: AiChartD1JsonSchema =
  createAiChartD1StrictObjectSchema({
    contractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_PALACE_REASONING_RESULT_CONTRACT_VERSION,
    }),
    palaceResultId: ID_SCHEMA,
    chartId: ID_SCHEMA,
    runId: ID_SCHEMA,
    callId: ID_SCHEMA,
    targetPalaceId: PALACE_ID_SCHEMA,
    axisResultRef: ID_SCHEMA,
    structuralInfluenceResultRef: ID_SCHEMA,
    structuralInfluenceRefs: ID_ARRAY_SCHEMA,
    facetIndex: createAiChartD1ArraySchema(FACET_INDEX_SCHEMA, {
      minimumItems: 1,
      maximumItems: AI_CHART_D1_PALACE_FACET_IDS.length,
    }),
    sourceGraph: createAiChartD1ArraySchema(SOURCE_GRAPH_SCHEMA, {
      minimumItems: 1,
      maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
    }),
    coverage: COVERAGE_SCHEMA,
    validationStatus: freezeAiChartD1Value({
      const: 'validated',
    }),
  })
