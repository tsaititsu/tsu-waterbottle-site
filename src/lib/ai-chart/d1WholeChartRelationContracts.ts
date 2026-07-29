import {
  AI_CHART_D1_ID_PATTERN,
  AI_CHART_D1_MAX_LIST_ITEMS,
  AI_CHART_D1_MAX_TEXT_LENGTH,
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
  parseAiChartD1N0,
  type AiChartD1N0,
  type AiChartD1N0PalaceScan,
  type AiChartD1N0Signal,
} from './d1N0Parser'
import {
  parseAiChartD1PalaceReasoningResult,
  type AiChartD1PalaceReasoningResult,
} from './d1PalaceIntegrationContracts'
import {
  AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION,
  buildAiChartD1PalaceWritingSourceSet,
  parseAiChartD1PalaceWritingSourceSet,
  type AiChartD1PalaceWritingSourceCell,
  type AiChartD1PalaceWritingSourceSet,
} from './d1PalaceWritingSourceContracts'

export const AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION =
  'ai-chart-d1-whole-chart-relation-result/v1' as const
export const AI_CHART_D1_WHOLE_CHART_RELATION_SCHEMA_NAME =
  'ai_chart_d1_whole_chart_relation_result_v1' as const
export const AI_CHART_D1_WHOLE_CHART_RELATION_INVALID =
  'ai_chart_d1_whole_chart_relation_invalid' as const

export const AI_CHART_D1_WHOLE_CHART_RELATION_KINDS =
  Object.freeze([
    'OVERALL_DIRECTION',
    'REPEATED_PATTERN',
    'INNER_TENSION',
    'DEEP_FEELING_THEME',
  ] as const)

export const AI_CHART_D1_WHOLE_CHART_RELATION_REASONS =
  Object.freeze([
    'RESULT_SHAPE_INVALID',
    'IDENTITY_OR_SOURCE_SET_MISMATCH',
    'RELATION_SOURCE_BINDING_MISMATCH',
    'RELATION_CARDINALITY_MISMATCH',
    'DEEP_FEELING_SIGNAL_MISMATCH',
    'COVERAGE_MISMATCH',
  ] as const)

export type AiChartD1WholeChartRelationKind =
  (typeof AI_CHART_D1_WHOLE_CHART_RELATION_KINDS)[number]
export type AiChartD1WholeChartRelationReason =
  (typeof AI_CHART_D1_WHOLE_CHART_RELATION_REASONS)[number]

export type AiChartD1WholeChartRelation = Readonly<{
  relationId: string
  relationKind: AiChartD1WholeChartRelationKind
  focusPalaceId: AiChartD1PalaceId | null
  sourceCellRefs: readonly string[]
  scanSignalRefs: readonly string[]
  mechanismLink: string
  possibleExpressions: readonly string[]
  constraints: readonly string[]
}>

export type AiChartD1WholeChartRelationCoverage = Readonly<{
  relationIds: readonly string[]
  relationKinds: readonly AiChartD1WholeChartRelationKind[]
  sourceCellRefs: readonly string[]
  scanSignalRefs: readonly string[]
}>

export type AiChartD1WholeChartRelationResult = Readonly<{
  contractVersion:
    typeof AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION
  wholeChartResultId: string
  chartId: string
  runId: string
  sourceWritingSetContractVersion:
    typeof AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION
  relations: readonly AiChartD1WholeChartRelation[]
  coverage: AiChartD1WholeChartRelationCoverage
  sourceBindingStatus: 'validated'
  semanticReviewStatus: 'required'
  customerWritingStatus: 'blocked'
}>

export class AiChartD1WholeChartRelationError extends Error {
  readonly code = AI_CHART_D1_WHOLE_CHART_RELATION_INVALID
  declare readonly reasonCode: AiChartD1WholeChartRelationReason

  constructor(reasonCode: AiChartD1WholeChartRelationReason) {
    super(AI_CHART_D1_WHOLE_CHART_RELATION_INVALID)
    this.name = 'AiChartD1WholeChartRelationError'
    Object.defineProperty(this, 'reasonCode', {
      value: reasonCode,
      enumerable: true,
      writable: false,
      configurable: false,
    })
    Object.freeze(this)
  }
}

const RELATION_FIELDS = Object.freeze([
  'relationId',
  'relationKind',
  'focusPalaceId',
  'sourceCellRefs',
  'scanSignalRefs',
  'mechanismLink',
  'possibleExpressions',
  'constraints',
] as const)
const COVERAGE_FIELDS = Object.freeze([
  'relationIds',
  'relationKinds',
  'sourceCellRefs',
  'scanSignalRefs',
] as const)
const RESULT_FIELDS = Object.freeze([
  'contractVersion',
  'wholeChartResultId',
  'chartId',
  'runId',
  'sourceWritingSetContractVersion',
  'relations',
  'coverage',
  'sourceBindingStatus',
  'semanticReviewStatus',
  'customerWritingStatus',
] as const)
const PALACE_IDS = AI_CHART_D1_PALACE_IDENTITIES.map(
  (identity) => identity.palaceId,
)
const MAX_RELATIONS = AI_CHART_D1_MAX_LIST_ITEMS
const MAX_RELATION_SOURCE_REFS = AI_CHART_D1_MAX_LIST_ITEMS
const MAX_RELATION_SIGNAL_REFS = AI_CHART_D1_MAX_LIST_ITEMS

function invalid(
  reasonCode: AiChartD1WholeChartRelationReason,
): never {
  throw new AiChartD1WholeChartRelationError(reasonCode)
}

function collectUnique<T extends string>(
  values: readonly T[],
): readonly T[] {
  return Object.freeze([...new Set(values)])
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function parsePalaceId(value: unknown): AiChartD1PalaceId {
  try {
    return parseAiChartD1Enum(value, PALACE_IDS)
  } catch {
    invalid('RESULT_SHAPE_INVALID')
  }
}

function parseNullablePalaceId(
  value: unknown,
): AiChartD1PalaceId | null {
  return value === null ? null : parsePalaceId(value)
}

function parseIdArray(
  value: unknown,
  minimumItems: number = 0,
  maximumItems: number = AI_CHART_D1_MAX_LIST_ITEMS,
): readonly string[] {
  return parseAiChartD1StringArray(value, {
    minimumItems,
    maximumItems,
    parseItem: parseAiChartD1Id,
  })
}

function parseRelation(
  value: unknown,
): AiChartD1WholeChartRelation {
  const record = requireAiChartD1ExactObject(
    value,
    RELATION_FIELDS,
  )
  const relationKind = parseAiChartD1Enum(
    record.relationKind,
    AI_CHART_D1_WHOLE_CHART_RELATION_KINDS,
  )
  const focusPalaceId = parseNullablePalaceId(
    record.focusPalaceId,
  )
  const sourceCellRefs = parseIdArray(
    record.sourceCellRefs,
    1,
    MAX_RELATION_SOURCE_REFS,
  )
  const scanSignalRefs = parseIdArray(
    record.scanSignalRefs,
    relationKind === 'DEEP_FEELING_THEME' ? 1 : 0,
    MAX_RELATION_SIGNAL_REFS,
  )

  if (
    (relationKind === 'OVERALL_DIRECTION' &&
      (focusPalaceId !== 'palace:ming' ||
        scanSignalRefs.length !== 0)) ||
    ((relationKind === 'REPEATED_PATTERN' ||
      relationKind === 'INNER_TENSION') &&
      (focusPalaceId !== null ||
        scanSignalRefs.length !== 0 ||
        sourceCellRefs.length < 2)) ||
    (relationKind === 'DEEP_FEELING_THEME' &&
      focusPalaceId === null)
  ) {
    invalid('RELATION_CARDINALITY_MISMATCH')
  }

  return freezeAiChartD1Value({
    relationId: parseAiChartD1Id(record.relationId),
    relationKind,
    focusPalaceId,
    sourceCellRefs,
    scanSignalRefs,
    mechanismLink: parseAiChartD1Text(
      record.mechanismLink,
      AI_CHART_D1_MAX_TEXT_LENGTH,
    ),
    possibleExpressions: parseAiChartD1StringArray(
      record.possibleExpressions,
      {
        minimumItems: 1,
        maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
        itemMaximumLength: AI_CHART_D1_MAX_TEXT_LENGTH,
      },
    ),
    constraints: parseAiChartD1StringArray(record.constraints, {
      minimumItems: 1,
      maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
      itemMaximumLength: AI_CHART_D1_MAX_TEXT_LENGTH,
    }),
  })
}

function expectedCoverage(
  relations: readonly AiChartD1WholeChartRelation[],
): AiChartD1WholeChartRelationCoverage {
  return freezeAiChartD1Value({
    relationIds: relations.map((relation) => relation.relationId),
    relationKinds: collectUnique(
      relations.map((relation) => relation.relationKind),
    ),
    sourceCellRefs: collectUnique(
      relations.flatMap((relation) => relation.sourceCellRefs),
    ),
    scanSignalRefs: collectUnique(
      relations.flatMap((relation) => relation.scanSignalRefs),
    ),
  })
}

function parseCoverage(
  value: unknown,
): AiChartD1WholeChartRelationCoverage {
  const record = requireAiChartD1ExactObject(value, COVERAGE_FIELDS)
  return freezeAiChartD1Value({
    relationIds: parseIdArray(record.relationIds, 1, MAX_RELATIONS),
    relationKinds: parseAiChartD1StringArray(
      record.relationKinds,
      {
        minimumItems: 1,
        maximumItems:
          AI_CHART_D1_WHOLE_CHART_RELATION_KINDS.length,
        parseItem: (item) =>
          parseAiChartD1Enum(
            item,
            AI_CHART_D1_WHOLE_CHART_RELATION_KINDS,
          ),
      },
    ) as readonly AiChartD1WholeChartRelationKind[],
    sourceCellRefs: parseIdArray(
      record.sourceCellRefs,
      1,
      MAX_RELATIONS * MAX_RELATION_SOURCE_REFS,
    ),
    scanSignalRefs: parseIdArray(
      record.scanSignalRefs,
      0,
      MAX_RELATIONS * MAX_RELATION_SIGNAL_REFS,
    ),
  })
}

export function parseAiChartD1WholeChartRelationResult(
  value: unknown,
): AiChartD1WholeChartRelationResult {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(
      value,
      RESULT_FIELDS,
    )
    if (
      record.contractVersion !==
        AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION ||
      record.sourceWritingSetContractVersion !==
        AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION ||
      record.sourceBindingStatus !== 'validated' ||
      record.semanticReviewStatus !== 'required' ||
      record.customerWritingStatus !== 'blocked' ||
      !Array.isArray(record.relations) ||
      record.relations.length < 1 ||
      record.relations.length > MAX_RELATIONS
    ) {
      invalid('RESULT_SHAPE_INVALID')
    }
    const relations = Object.freeze(record.relations.map(parseRelation))
    if (
      new Set(relations.map((relation) => relation.relationId))
        .size !== relations.length ||
      !relations.some(
        (relation) =>
          relation.relationKind === 'OVERALL_DIRECTION',
      )
    ) {
      invalid('RELATION_CARDINALITY_MISMATCH')
    }
    const coverage = parseCoverage(record.coverage)
    if (!sameJson(coverage, expectedCoverage(relations))) {
      invalid('COVERAGE_MISMATCH')
    }
    return freezeAiChartD1Value({
      contractVersion:
        AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION,
      wholeChartResultId: parseAiChartD1Id(
        record.wholeChartResultId,
      ),
      chartId: parseAiChartD1Id(record.chartId),
      runId: parseAiChartD1Id(record.runId),
      sourceWritingSetContractVersion:
        AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION,
      relations,
      coverage,
      sourceBindingStatus: 'validated' as const,
      semanticReviewStatus: 'required' as const,
      customerWritingStatus: 'blocked' as const,
    })
  } catch (error) {
    if (error instanceof AiChartD1WholeChartRelationError) {
      throw error
    }
    invalid('RESULT_SHAPE_INVALID')
  }
}

function parsePalaceResults(
  value: unknown,
): readonly AiChartD1PalaceReasoningResult[] {
  if (!Array.isArray(value) || value.length !== 12) {
    invalid('IDENTITY_OR_SOURCE_SET_MISMATCH')
  }
  try {
    const parsed = value.map(parseAiChartD1PalaceReasoningResult)
    const byPalaceId = new Map(
      parsed.map((result) => [result.targetPalaceId, result]),
    )
    if (
      byPalaceId.size !== 12 ||
      new Set(parsed.map((result) => result.palaceResultId)).size !==
        12
    ) {
      invalid('IDENTITY_OR_SOURCE_SET_MISMATCH')
    }
    return Object.freeze(
      PALACE_IDS.map((palaceId) => {
        const result = byPalaceId.get(palaceId)
        if (result === undefined) {
          invalid('IDENTITY_OR_SOURCE_SET_MISMATCH')
        }
        return result
      }),
    )
  } catch (error) {
    if (error instanceof AiChartD1WholeChartRelationError) {
      throw error
    }
    invalid('IDENTITY_OR_SOURCE_SET_MISMATCH')
  }
}

function parseSourceSet(
  value: unknown,
): AiChartD1PalaceWritingSourceSet {
  try {
    return parseAiChartD1PalaceWritingSourceSet(value)
  } catch {
    invalid('IDENTITY_OR_SOURCE_SET_MISMATCH')
  }
}

function parseN0(value: unknown): AiChartD1N0 {
  try {
    return parseAiChartD1N0(value)
  } catch {
    invalid('IDENTITY_OR_SOURCE_SET_MISMATCH')
  }
}

function rebuildSourceSet(
  palaceResults: readonly AiChartD1PalaceReasoningResult[],
  flyingIntegrationValue: unknown,
): AiChartD1PalaceWritingSourceSet {
  try {
    return buildAiChartD1PalaceWritingSourceSet(
      palaceResults,
      flyingIntegrationValue,
    )
  } catch {
    invalid('IDENTITY_OR_SOURCE_SET_MISMATCH')
  }
}

function relevantSignalIds(
  scan: AiChartD1N0PalaceScan,
): ReadonlySet<string> {
  return new Set([
    ...scan.directSignals,
    ...scan.oppositeSignals,
    ...scan.hiddenCombinationSignals,
    ...scan.trineSignals,
  ])
}

function hasAxisEvidenceForSignal(
  relationCells: readonly AiChartD1PalaceWritingSourceCell[],
  palaceResult: AiChartD1PalaceReasoningResult,
  signal: AiChartD1N0Signal,
): boolean {
  const relationAxisRefs = new Set(
    relationCells
      .filter((cell) => cell.sourceKind === 'AXIS_CLAIM')
      .map((cell) => cell.sourceRef),
  )
  return palaceResult.sourceGraph.some(
    (entry) =>
      entry.nodeKind === 'AXIS_CLAIM' &&
      relationAxisRefs.has(entry.nodeRef) &&
      entry.sourceRefs.includes(signal.starPlacementId),
  )
}

function validateRelationSources(
  relation: AiChartD1WholeChartRelation,
  sourceCellsById: ReadonlyMap<
    string,
    AiChartD1PalaceWritingSourceCell
  >,
  palaceResultsById: ReadonlyMap<
    AiChartD1PalaceId,
    AiChartD1PalaceReasoningResult
  >,
  n0: AiChartD1N0,
): void {
  const relationCells = relation.sourceCellRefs.map((sourceCellRef) => {
    const cell = sourceCellsById.get(sourceCellRef)
    if (cell === undefined) {
      invalid('RELATION_SOURCE_BINDING_MISMATCH')
    }
    return cell
  })

  if (relation.relationKind === 'OVERALL_DIRECTION') {
    if (
      !relationCells.some(
        (cell) =>
          cell.targetPalaceId === 'palace:ming' &&
          cell.sourceKind === 'AXIS_CLAIM',
      )
    ) {
      invalid('RELATION_CARDINALITY_MISMATCH')
    }
    return
  }

  if (
    relation.relationKind === 'REPEATED_PATTERN' ||
    relation.relationKind === 'INNER_TENSION'
  ) {
    if (
      new Set(relationCells.map((cell) => cell.targetPalaceId))
        .size < 2
    ) {
      invalid('RELATION_CARDINALITY_MISMATCH')
    }
    return
  }

  const focusPalaceId = relation.focusPalaceId
  if (
    focusPalaceId === null ||
    relationCells.some(
      (cell) => cell.targetPalaceId !== focusPalaceId,
    )
  ) {
    invalid('DEEP_FEELING_SIGNAL_MISMATCH')
  }
  const scan = n0.globalScan.palaceScans.find(
    (candidate) => candidate.palaceId === focusPalaceId,
  )
  const palaceResult = palaceResultsById.get(focusPalaceId)
  if (scan === undefined || palaceResult === undefined) {
    invalid('DEEP_FEELING_SIGNAL_MISMATCH')
  }
  const relevantIds = relevantSignalIds(scan)
  for (const signalRef of relation.scanSignalRefs) {
    const signal = n0.globalScan.signals.find(
      (candidate) => candidate.signalId === signalRef,
    )
    if (
      signal === undefined ||
      !relevantIds.has(signal.signalId) ||
      !hasAxisEvidenceForSignal(
        relationCells,
        palaceResult,
        signal,
      )
    ) {
      invalid('DEEP_FEELING_SIGNAL_MISMATCH')
    }
  }
}

export function validateAiChartD1WholeChartRelationResultAgainstSources(
  value: unknown,
  writingSourceSetValue: unknown,
  palaceResultValues: unknown,
  flyingIntegrationValue: unknown,
  n0Value: unknown,
): AiChartD1WholeChartRelationResult {
  const result = parseAiChartD1WholeChartRelationResult(value)
  const writingSourceSet = parseSourceSet(writingSourceSetValue)
  const palaceResults = parsePalaceResults(palaceResultValues)
  const rebuiltSourceSet = rebuildSourceSet(
    palaceResults,
    flyingIntegrationValue,
  )
  const n0 = parseN0(n0Value)

  if (
    !sameJson(writingSourceSet, rebuiltSourceSet) ||
    result.chartId !== writingSourceSet.chartId ||
    result.runId !== writingSourceSet.runId ||
    result.sourceWritingSetContractVersion !==
      writingSourceSet.contractVersion ||
    n0.chartId !== writingSourceSet.chartId
  ) {
    invalid('IDENTITY_OR_SOURCE_SET_MISMATCH')
  }

  const sourceCellsById = new Map(
    writingSourceSet.palaces.flatMap((entry) =>
      entry.sourceCells.map(
        (cell) => [cell.sourceCellId, cell] as const,
      ),
    ),
  )
  const palaceResultsById = new Map(
    palaceResults.map(
      (palaceResult) =>
        [palaceResult.targetPalaceId, palaceResult] as const,
    ),
  )
  for (const relation of result.relations) {
    validateRelationSources(
      relation,
      sourceCellsById,
      palaceResultsById,
      n0,
    )
  }
  return result
}

const ID_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 128,
  pattern: AI_CHART_D1_ID_PATTERN.source,
})
const PALACE_ID_SCHEMA = createAiChartD1StringSchema({
  enumValues: PALACE_IDS,
  nullable: true,
})
const TEXT_SCHEMA = createAiChartD1StringSchema({
  maximumLength: AI_CHART_D1_MAX_TEXT_LENGTH,
})
const RELATION_KIND_SCHEMA = createAiChartD1StringSchema({
  enumValues: AI_CHART_D1_WHOLE_CHART_RELATION_KINDS,
})
const RELATION_SCHEMA = createAiChartD1StrictObjectSchema({
  relationId: ID_SCHEMA,
  relationKind: RELATION_KIND_SCHEMA,
  focusPalaceId: PALACE_ID_SCHEMA,
  sourceCellRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 1,
    maximumItems: MAX_RELATION_SOURCE_REFS,
  }),
  scanSignalRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 0,
    maximumItems: MAX_RELATION_SIGNAL_REFS,
  }),
  mechanismLink: TEXT_SCHEMA,
  possibleExpressions: createAiChartD1ArraySchema(TEXT_SCHEMA, {
    minimumItems: 1,
    maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
  }),
  constraints: createAiChartD1ArraySchema(TEXT_SCHEMA, {
    minimumItems: 1,
    maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
  }),
})
const COVERAGE_SCHEMA = createAiChartD1StrictObjectSchema({
  relationIds: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 1,
    maximumItems: MAX_RELATIONS,
  }),
  relationKinds: createAiChartD1ArraySchema(
    RELATION_KIND_SCHEMA,
    {
      minimumItems: 1,
      maximumItems:
        AI_CHART_D1_WHOLE_CHART_RELATION_KINDS.length,
    },
  ),
  sourceCellRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 1,
    maximumItems: MAX_RELATIONS * MAX_RELATION_SOURCE_REFS,
  }),
  scanSignalRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 0,
    maximumItems: MAX_RELATIONS * MAX_RELATION_SIGNAL_REFS,
  }),
})

export const AI_CHART_D1_WHOLE_CHART_RELATION_JSON_SCHEMA:
  AiChartD1JsonSchema = createAiChartD1StrictObjectSchema({
    contractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION,
    }),
    wholeChartResultId: ID_SCHEMA,
    chartId: ID_SCHEMA,
    runId: ID_SCHEMA,
    sourceWritingSetContractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION,
    }),
    relations: createAiChartD1ArraySchema(RELATION_SCHEMA, {
      minimumItems: 1,
      maximumItems: MAX_RELATIONS,
    }),
    coverage: COVERAGE_SCHEMA,
    sourceBindingStatus: freezeAiChartD1Value({
      const: 'validated',
    }),
    semanticReviewStatus: freezeAiChartD1Value({
      const: 'required',
    }),
    customerWritingStatus: freezeAiChartD1Value({
      const: 'blocked',
    }),
  })
