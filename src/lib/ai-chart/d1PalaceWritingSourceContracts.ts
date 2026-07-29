import {
  AI_CHART_D1_ID_PATTERN,
  assertAiChartD1SafeGraph,
  createAiChartD1ArraySchema,
  createAiChartD1StrictObjectSchema,
  createAiChartD1StringSchema,
  freezeAiChartD1Value,
  parseAiChartD1Boolean,
  parseAiChartD1Enum,
  parseAiChartD1Id,
  parseAiChartD1StringArray,
  requireAiChartD1ExactObject,
  type AiChartD1JsonSchema,
} from './d1CommonContracts'
import {
  AI_CHART_D1_FLYING_PALACE_INTEGRATION_VERSION,
  parseAiChartD1FlyingPalaceIntegration,
  type AiChartD1FlyingPalaceIntegration,
} from './d1FlyingPalaceIntegrationContracts'
import {
  AI_CHART_D1_PALACE_IDENTITIES,
  type AiChartD1PalaceId,
} from './d1N0Constants'
import {
  AI_CHART_D1_PALACE_REASONING_RESULT_CONTRACT_VERSION,
  parseAiChartD1PalaceReasoningResult,
  type AiChartD1PalaceReasoningResult,
} from './d1PalaceIntegrationContracts'
import {
  AI_CHART_D1_PALACE_FACET_IDS,
  isAiChartD1PalaceFacetAllowed,
  type AiChartD1PalaceFacetId,
} from './d1PalaceFacetRegistry'

export const AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION =
  'ai-chart-d1-palace-writing-source-set/v1' as const
export const AI_CHART_D1_PALACE_WRITING_SOURCE_SCHEMA_NAME =
  'ai_chart_d1_palace_writing_source_set_v1' as const
export const AI_CHART_D1_PALACE_WRITING_SOURCE_INVALID =
  'ai_chart_d1_palace_writing_source_invalid' as const

export const AI_CHART_D1_PALACE_WRITING_SOURCE_KINDS =
  Object.freeze([
    'AXIS_CLAIM',
    'STRUCTURAL_INFLUENCE',
    'FLYING_INFLUENCE',
  ] as const)

export const AI_CHART_D1_PALACE_WRITING_HANDOFF_POLICY =
  freezeAiChartD1Value({
    preserveEverySource: true,
    preserveContradictions: true,
    semanticMerging: 'NOT_PERFORMED',
    emptyCellCreation: 'FORBIDDEN',
    wholeChartRelations: 'REQUIRED_BEFORE_WRITING',
    customerWriting: 'BLOCKED',
  } as const)

export const AI_CHART_D1_PALACE_WRITING_SOURCE_REASONS =
  Object.freeze([
    'RESULT_SHAPE_INVALID',
    'SOURCE_SET_MISMATCH',
    'IDENTITY_OR_BINDING_MISMATCH',
    'COVERAGE_MISMATCH',
  ] as const)

export type AiChartD1PalaceWritingSourceKind =
  (typeof AI_CHART_D1_PALACE_WRITING_SOURCE_KINDS)[number]
export type AiChartD1PalaceWritingSourceReason =
  (typeof AI_CHART_D1_PALACE_WRITING_SOURCE_REASONS)[number]

export type AiChartD1PalaceWritingSourceCell = Readonly<{
  sourceCellId: string
  targetPalaceId: AiChartD1PalaceId
  facetId: AiChartD1PalaceFacetId
  sourceKind: AiChartD1PalaceWritingSourceKind
  sourceRef: string
}>

export type AiChartD1PalaceWritingSourceEntry = Readonly<{
  targetPalaceId: AiChartD1PalaceId
  palaceResultRef: string
  sourceCells: readonly AiChartD1PalaceWritingSourceCell[]
}>

export type AiChartD1PalaceWritingSourceCoverage = Readonly<{
  palaceResultRefs: readonly string[]
  facetIds: readonly AiChartD1PalaceFacetId[]
  axisClaimRefs: readonly string[]
  structuralInfluenceRefs: readonly string[]
  flyingInfluenceRefs: readonly string[]
}>

export type AiChartD1PalaceWritingSourceSet = Readonly<{
  contractVersion:
    typeof AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION
  chartId: string
  runId: string
  sourcePalaceResultContractVersion:
    typeof AI_CHART_D1_PALACE_REASONING_RESULT_CONTRACT_VERSION
  sourceFlyingIntegrationVersion:
    typeof AI_CHART_D1_FLYING_PALACE_INTEGRATION_VERSION
  palaces: readonly AiChartD1PalaceWritingSourceEntry[]
  handoffPolicy: typeof AI_CHART_D1_PALACE_WRITING_HANDOFF_POLICY
  coverage: AiChartD1PalaceWritingSourceCoverage
  openAiCallable: false
  validationStatus: 'validated'
}>

export class AiChartD1PalaceWritingSourceError extends Error {
  readonly code = AI_CHART_D1_PALACE_WRITING_SOURCE_INVALID
  declare readonly reasonCode: AiChartD1PalaceWritingSourceReason

  constructor(reasonCode: AiChartD1PalaceWritingSourceReason) {
    super(AI_CHART_D1_PALACE_WRITING_SOURCE_INVALID)
    this.name = 'AiChartD1PalaceWritingSourceError'
    Object.defineProperty(this, 'reasonCode', {
      value: reasonCode,
      enumerable: true,
      writable: false,
      configurable: false,
    })
    Object.freeze(this)
  }
}

const SOURCE_CELL_FIELDS = Object.freeze([
  'sourceCellId',
  'targetPalaceId',
  'facetId',
  'sourceKind',
  'sourceRef',
] as const)
const PALACE_FIELDS = Object.freeze([
  'targetPalaceId',
  'palaceResultRef',
  'sourceCells',
] as const)
const HANDOFF_POLICY_FIELDS = Object.freeze([
  'preserveEverySource',
  'preserveContradictions',
  'semanticMerging',
  'emptyCellCreation',
  'wholeChartRelations',
  'customerWriting',
] as const)
const COVERAGE_FIELDS = Object.freeze([
  'palaceResultRefs',
  'facetIds',
  'axisClaimRefs',
  'structuralInfluenceRefs',
  'flyingInfluenceRefs',
] as const)
const SOURCE_SET_FIELDS = Object.freeze([
  'contractVersion',
  'chartId',
  'runId',
  'sourcePalaceResultContractVersion',
  'sourceFlyingIntegrationVersion',
  'palaces',
  'handoffPolicy',
  'coverage',
  'openAiCallable',
  'validationStatus',
] as const)
const PALACE_IDS = AI_CHART_D1_PALACE_IDENTITIES.map(
  (identity) => identity.palaceId,
)
const MAX_PALACE_SOURCE_CELLS = 304
const MAX_PALACE_RESULT_REFS = 12
const MAX_PALACE_REASONING_REFS = 1_536
const FLYING_INFLUENCE_COUNT = 48

function invalid(
  reasonCode: AiChartD1PalaceWritingSourceReason,
): never {
  throw new AiChartD1PalaceWritingSourceError(reasonCode)
}

function collectUnique<T extends string>(
  values: readonly T[],
): readonly T[] {
  return Object.freeze([...new Set(values)])
}

function parsePalaceId(value: unknown): AiChartD1PalaceId {
  try {
    return parseAiChartD1Enum(value, PALACE_IDS)
  } catch {
    invalid('RESULT_SHAPE_INVALID')
  }
}

function parseFacetId(
  value: unknown,
  targetPalaceId: AiChartD1PalaceId,
): AiChartD1PalaceFacetId {
  try {
    const facetId = parseAiChartD1Enum(
      value,
      AI_CHART_D1_PALACE_FACET_IDS,
    )
    if (!isAiChartD1PalaceFacetAllowed(targetPalaceId, facetId)) {
      invalid('RESULT_SHAPE_INVALID')
    }
    return facetId
  } catch (error) {
    if (error instanceof AiChartD1PalaceWritingSourceError) {
      throw error
    }
    invalid('RESULT_SHAPE_INVALID')
  }
}

function parseIdArray(
  value: unknown,
  minimumItems: number,
  maximumItems: number,
): readonly string[] {
  return parseAiChartD1StringArray(value, {
    minimumItems,
    maximumItems,
    parseItem: parseAiChartD1Id,
  })
}

function parseFacetIdArray(
  value: unknown,
): readonly AiChartD1PalaceFacetId[] {
  return parseAiChartD1StringArray(value, {
    minimumItems: 1,
    maximumItems: AI_CHART_D1_PALACE_FACET_IDS.length,
    parseItem: (item) =>
      parseAiChartD1Enum(item, AI_CHART_D1_PALACE_FACET_IDS),
  }) as readonly AiChartD1PalaceFacetId[]
}

function parseSourceCell(
  value: unknown,
  targetPalaceId: AiChartD1PalaceId,
): AiChartD1PalaceWritingSourceCell {
  const record = requireAiChartD1ExactObject(
    value,
    SOURCE_CELL_FIELDS,
  )
  const cellPalaceId = parsePalaceId(record.targetPalaceId)
  if (cellPalaceId !== targetPalaceId) {
    invalid('RESULT_SHAPE_INVALID')
  }
  return freezeAiChartD1Value({
    sourceCellId: parseAiChartD1Id(record.sourceCellId),
    targetPalaceId: cellPalaceId,
    facetId: parseFacetId(record.facetId, cellPalaceId),
    sourceKind: parseAiChartD1Enum(
      record.sourceKind,
      AI_CHART_D1_PALACE_WRITING_SOURCE_KINDS,
    ),
    sourceRef: parseAiChartD1Id(record.sourceRef),
  })
}

function parsePalaceEntry(
  value: unknown,
): AiChartD1PalaceWritingSourceEntry {
  const record = requireAiChartD1ExactObject(value, PALACE_FIELDS)
  const targetPalaceId = parsePalaceId(record.targetPalaceId)
  if (
    !Array.isArray(record.sourceCells) ||
    record.sourceCells.length < 1 ||
    record.sourceCells.length > MAX_PALACE_SOURCE_CELLS
  ) {
    invalid('RESULT_SHAPE_INVALID')
  }
  const sourceCells = Object.freeze(
    record.sourceCells.map((cell) =>
      parseSourceCell(cell, targetPalaceId),
    ),
  )
  if (
    sourceCells.some(
      (cell, index) =>
        cell.sourceCellId !==
        `writing-source-cell:${targetPalaceId}:${index + 1}`,
    ) ||
    new Set(sourceCells.map((cell) => cell.sourceCellId)).size !==
      sourceCells.length ||
    new Set(
      sourceCells.map(
        (cell) => `${cell.sourceKind}:${cell.sourceRef}`,
      ),
    ).size !== sourceCells.length
  ) {
    invalid('RESULT_SHAPE_INVALID')
  }
  return freezeAiChartD1Value({
    targetPalaceId,
    palaceResultRef: parseAiChartD1Id(record.palaceResultRef),
    sourceCells,
  })
}

function parseHandoffPolicy(
  value: unknown,
): typeof AI_CHART_D1_PALACE_WRITING_HANDOFF_POLICY {
  requireAiChartD1ExactObject(value, HANDOFF_POLICY_FIELDS)
  if (
    JSON.stringify(value) !==
    JSON.stringify(AI_CHART_D1_PALACE_WRITING_HANDOFF_POLICY)
  ) {
    invalid('RESULT_SHAPE_INVALID')
  }
  return AI_CHART_D1_PALACE_WRITING_HANDOFF_POLICY
}

function expectedCoverage(
  palaces: readonly AiChartD1PalaceWritingSourceEntry[],
): AiChartD1PalaceWritingSourceCoverage {
  const sourceCells = palaces.flatMap((entry) => entry.sourceCells)
  return freezeAiChartD1Value({
    palaceResultRefs: palaces.map(
      (entry) => entry.palaceResultRef,
    ),
    facetIds: collectUnique(
      sourceCells.map((cell) => cell.facetId),
    ),
    axisClaimRefs: sourceCells
      .filter((cell) => cell.sourceKind === 'AXIS_CLAIM')
      .map((cell) => cell.sourceRef),
    structuralInfluenceRefs: sourceCells
      .filter(
        (cell) => cell.sourceKind === 'STRUCTURAL_INFLUENCE',
      )
      .map((cell) => cell.sourceRef),
    flyingInfluenceRefs: sourceCells
      .filter((cell) => cell.sourceKind === 'FLYING_INFLUENCE')
      .map((cell) => cell.sourceRef),
  })
}

function parseCoverage(
  value: unknown,
): AiChartD1PalaceWritingSourceCoverage {
  const record = requireAiChartD1ExactObject(value, COVERAGE_FIELDS)
  return freezeAiChartD1Value({
    palaceResultRefs: parseIdArray(
      record.palaceResultRefs,
      MAX_PALACE_RESULT_REFS,
      MAX_PALACE_RESULT_REFS,
    ),
    facetIds: parseFacetIdArray(record.facetIds),
    axisClaimRefs: parseIdArray(
      record.axisClaimRefs,
      MAX_PALACE_RESULT_REFS,
      MAX_PALACE_REASONING_REFS,
    ),
    structuralInfluenceRefs: parseIdArray(
      record.structuralInfluenceRefs,
      0,
      MAX_PALACE_REASONING_REFS,
    ),
    flyingInfluenceRefs: parseIdArray(
      record.flyingInfluenceRefs,
      FLYING_INFLUENCE_COUNT,
      FLYING_INFLUENCE_COUNT,
    ),
  })
}

export function parseAiChartD1PalaceWritingSourceSet(
  value: unknown,
): AiChartD1PalaceWritingSourceSet {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(
      value,
      SOURCE_SET_FIELDS,
    )
    if (
      record.contractVersion !==
        AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION ||
      record.sourcePalaceResultContractVersion !==
        AI_CHART_D1_PALACE_REASONING_RESULT_CONTRACT_VERSION ||
      record.sourceFlyingIntegrationVersion !==
        AI_CHART_D1_FLYING_PALACE_INTEGRATION_VERSION ||
      parseAiChartD1Boolean(record.openAiCallable) !== false ||
      record.validationStatus !== 'validated' ||
      !Array.isArray(record.palaces) ||
      record.palaces.length !== 12
    ) {
      invalid('RESULT_SHAPE_INVALID')
    }
    const palaces = Object.freeze(record.palaces.map(parsePalaceEntry))
    if (
      palaces.some(
        (entry, index) =>
          entry.targetPalaceId !== PALACE_IDS[index],
      ) ||
      new Set(
        palaces.flatMap((entry) =>
          entry.sourceCells.map((cell) => cell.sourceCellId),
        ),
      ).size !==
        palaces.reduce(
          (count, entry) => count + entry.sourceCells.length,
          0,
        )
    ) {
      invalid('RESULT_SHAPE_INVALID')
    }
    const coverage = parseCoverage(record.coverage)
    if (
      JSON.stringify(coverage) !==
      JSON.stringify(expectedCoverage(palaces))
    ) {
      invalid('COVERAGE_MISMATCH')
    }
    return freezeAiChartD1Value({
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION,
      chartId: parseAiChartD1Id(record.chartId),
      runId: parseAiChartD1Id(record.runId),
      sourcePalaceResultContractVersion:
        AI_CHART_D1_PALACE_REASONING_RESULT_CONTRACT_VERSION,
      sourceFlyingIntegrationVersion:
        AI_CHART_D1_FLYING_PALACE_INTEGRATION_VERSION,
      palaces,
      handoffPolicy: parseHandoffPolicy(record.handoffPolicy),
      coverage,
      openAiCallable: false as const,
      validationStatus: 'validated' as const,
    })
  } catch (error) {
    if (error instanceof AiChartD1PalaceWritingSourceError) {
      throw error
    }
    invalid('RESULT_SHAPE_INVALID')
  }
}

function parsePalaceResults(
  value: unknown,
): readonly AiChartD1PalaceReasoningResult[] {
  if (!Array.isArray(value) || value.length !== 12) {
    invalid('SOURCE_SET_MISMATCH')
  }
  let parsed: readonly AiChartD1PalaceReasoningResult[]
  try {
    parsed = Object.freeze(
      value.map(parseAiChartD1PalaceReasoningResult),
    )
  } catch {
    invalid('SOURCE_SET_MISMATCH')
  }
  const byPalaceId = new Map(
    parsed.map((result) => [result.targetPalaceId, result]),
  )
  if (
    byPalaceId.size !== 12 ||
    new Set(parsed.map((result) => result.palaceResultId)).size !==
      12
  ) {
    invalid('SOURCE_SET_MISMATCH')
  }
  return Object.freeze(
    PALACE_IDS.map((palaceId) => {
      const result = byPalaceId.get(palaceId)
      if (result === undefined) invalid('SOURCE_SET_MISMATCH')
      return result
    }),
  )
}

function parseFlyingIntegration(
  value: unknown,
): AiChartD1FlyingPalaceIntegration {
  try {
    return parseAiChartD1FlyingPalaceIntegration(value)
  } catch {
    invalid('SOURCE_SET_MISMATCH')
  }
}

function createSourceCells(
  palaceResult: AiChartD1PalaceReasoningResult,
  flyingIntegration: AiChartD1FlyingPalaceIntegration,
): readonly AiChartD1PalaceWritingSourceCell[] {
  const flyingPalace = flyingIntegration.palaces.find(
    (entry) => entry.targetPalaceId === palaceResult.targetPalaceId,
  )
  if (
    flyingPalace === undefined ||
    flyingPalace.influences.some(
      (influence) =>
        influence.targetPalaceResultRef !==
        palaceResult.palaceResultId,
    )
  ) {
    invalid('IDENTITY_OR_BINDING_MISMATCH')
  }

  const rawCells: ReadonlyArray<
    Omit<AiChartD1PalaceWritingSourceCell, 'sourceCellId'>
  > = [
    ...palaceResult.facetIndex.flatMap((facet) =>
      facet.axisClaimRefs.map((sourceRef) => ({
        targetPalaceId: palaceResult.targetPalaceId,
        facetId: facet.facetId,
        sourceKind: 'AXIS_CLAIM' as const,
        sourceRef,
      })),
    ),
    ...palaceResult.facetIndex.flatMap((facet) =>
      facet.structuralInfluenceRefs.map((sourceRef) => ({
        targetPalaceId: palaceResult.targetPalaceId,
        facetId: facet.facetId,
        sourceKind: 'STRUCTURAL_INFLUENCE' as const,
        sourceRef,
      })),
    ),
    ...flyingPalace.influences.map((influence) => ({
      targetPalaceId: palaceResult.targetPalaceId,
      facetId: influence.targetFacetId,
      sourceKind: 'FLYING_INFLUENCE' as const,
      sourceRef: influence.flyingInfluenceId,
    })),
  ]

  return Object.freeze(
    rawCells.map((cell, index) =>
      freezeAiChartD1Value({
        sourceCellId:
          `writing-source-cell:${palaceResult.targetPalaceId}:` +
          `${index + 1}`,
        ...cell,
      }),
    ),
  )
}

export function buildAiChartD1PalaceWritingSourceSet(
  palaceResultValues: unknown,
  flyingIntegrationValue: unknown,
): AiChartD1PalaceWritingSourceSet {
  const palaceResults = parsePalaceResults(palaceResultValues)
  const flyingIntegration = parseFlyingIntegration(
    flyingIntegrationValue,
  )
  if (
    palaceResults.some(
      (result) =>
        result.chartId !== flyingIntegration.chartId ||
        result.runId !== flyingIntegration.runId,
    )
  ) {
    invalid('IDENTITY_OR_BINDING_MISMATCH')
  }
  const palaces = palaceResults.map((palaceResult) => ({
    targetPalaceId: palaceResult.targetPalaceId,
    palaceResultRef: palaceResult.palaceResultId,
    sourceCells: createSourceCells(
      palaceResult,
      flyingIntegration,
    ),
  }))
  return parseAiChartD1PalaceWritingSourceSet({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION,
    chartId: flyingIntegration.chartId,
    runId: flyingIntegration.runId,
    sourcePalaceResultContractVersion:
      AI_CHART_D1_PALACE_REASONING_RESULT_CONTRACT_VERSION,
    sourceFlyingIntegrationVersion:
      AI_CHART_D1_FLYING_PALACE_INTEGRATION_VERSION,
    palaces,
    handoffPolicy: AI_CHART_D1_PALACE_WRITING_HANDOFF_POLICY,
    coverage: expectedCoverage(palaces),
    openAiCallable: false,
    validationStatus: 'validated',
  })
}

const ID_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 128,
  pattern: AI_CHART_D1_ID_PATTERN.source,
})
const PALACE_ID_SCHEMA = createAiChartD1StringSchema({
  enumValues: PALACE_IDS,
})
const FACET_ID_SCHEMA = createAiChartD1StringSchema({
  enumValues: AI_CHART_D1_PALACE_FACET_IDS,
})
const SOURCE_KIND_SCHEMA = createAiChartD1StringSchema({
  enumValues: AI_CHART_D1_PALACE_WRITING_SOURCE_KINDS,
})
const SOURCE_CELL_SCHEMA = createAiChartD1StrictObjectSchema({
  sourceCellId: ID_SCHEMA,
  targetPalaceId: PALACE_ID_SCHEMA,
  facetId: FACET_ID_SCHEMA,
  sourceKind: SOURCE_KIND_SCHEMA,
  sourceRef: ID_SCHEMA,
})
const PALACE_SCHEMA = createAiChartD1StrictObjectSchema({
  targetPalaceId: PALACE_ID_SCHEMA,
  palaceResultRef: ID_SCHEMA,
  sourceCells: createAiChartD1ArraySchema(SOURCE_CELL_SCHEMA, {
    minimumItems: 1,
    maximumItems: MAX_PALACE_SOURCE_CELLS,
  }),
})
const HANDOFF_POLICY_SCHEMA = createAiChartD1StrictObjectSchema({
  preserveEverySource: freezeAiChartD1Value({ const: true }),
  preserveContradictions: freezeAiChartD1Value({ const: true }),
  semanticMerging: freezeAiChartD1Value({
    const: 'NOT_PERFORMED',
  }),
  emptyCellCreation: freezeAiChartD1Value({
    const: 'FORBIDDEN',
  }),
  wholeChartRelations: freezeAiChartD1Value({
    const: 'REQUIRED_BEFORE_WRITING',
  }),
  customerWriting: freezeAiChartD1Value({
    const: 'BLOCKED',
  }),
})
const COVERAGE_SCHEMA = createAiChartD1StrictObjectSchema({
  palaceResultRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: MAX_PALACE_RESULT_REFS,
    maximumItems: MAX_PALACE_RESULT_REFS,
  }),
  facetIds: createAiChartD1ArraySchema(FACET_ID_SCHEMA, {
    minimumItems: 1,
    maximumItems: AI_CHART_D1_PALACE_FACET_IDS.length,
  }),
  axisClaimRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: MAX_PALACE_RESULT_REFS,
    maximumItems: MAX_PALACE_REASONING_REFS,
  }),
  structuralInfluenceRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 0,
    maximumItems: MAX_PALACE_REASONING_REFS,
  }),
  flyingInfluenceRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: FLYING_INFLUENCE_COUNT,
    maximumItems: FLYING_INFLUENCE_COUNT,
  }),
})

export const AI_CHART_D1_PALACE_WRITING_SOURCE_JSON_SCHEMA:
  AiChartD1JsonSchema = createAiChartD1StrictObjectSchema({
    contractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION,
    }),
    chartId: ID_SCHEMA,
    runId: ID_SCHEMA,
    sourcePalaceResultContractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_PALACE_REASONING_RESULT_CONTRACT_VERSION,
    }),
    sourceFlyingIntegrationVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_FLYING_PALACE_INTEGRATION_VERSION,
    }),
    palaces: createAiChartD1ArraySchema(PALACE_SCHEMA, {
      minimumItems: 12,
      maximumItems: 12,
    }),
    handoffPolicy: HANDOFF_POLICY_SCHEMA,
    coverage: COVERAGE_SCHEMA,
    openAiCallable: freezeAiChartD1Value({ const: false }),
    validationStatus: freezeAiChartD1Value({
      const: 'validated',
    }),
  })
