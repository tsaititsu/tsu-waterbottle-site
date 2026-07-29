import {
  AI_CHART_D1_ID_PATTERN,
  AI_CHART_D1_MAX_LIST_ITEMS,
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
  AI_CHART_D1_PALACE_IDENTITIES,
  type AiChartD1PalaceId,
} from './d1N0Constants'
import {
  parseAiChartD1N0,
} from './d1N0Parser'
import {
  AI_CHART_D1_PALACE_FACET_IDS,
  AI_CHART_D1_PALACE_FACET_REGISTRY,
  isAiChartD1PalaceFacetAllowed,
  type AiChartD1PalaceFacetId,
} from './d1PalaceFacetRegistry'
import {
  AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION,
  parseAiChartD1PalaceWritingSourceSet,
  type AiChartD1PalaceWritingSourceSet,
} from './d1PalaceWritingSourceContracts'
import {
  AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION,
  validateAiChartD1WholeChartRelationResultAgainstSources,
  type AiChartD1WholeChartRelationResult,
} from './d1WholeChartRelationContracts'
import {
  AI_CHART_D1_WHOLE_CHART_SEMANTIC_REVIEW_VERSION,
  validateAiChartD1WholeChartSemanticReviewAgainstSources,
  type AiChartD1WholeChartSemanticReview,
} from './d1WholeChartSemanticReviewContracts'

export const AI_CHART_D1_PALACE_CONTENT_GRID_VERSION =
  'ai-chart-d1-palace-content-grid/v1' as const
export const AI_CHART_D1_PALACE_CONTENT_GRID_SCHEMA_NAME =
  'ai_chart_d1_palace_content_grid_v1' as const
export const AI_CHART_D1_PALACE_CONTENT_GRID_INVALID =
  'ai_chart_d1_palace_content_grid_invalid' as const

export const AI_CHART_D1_PALACE_CONTENT_GRID_POLICY =
  freezeAiChartD1Value({
    canonicalPalaceOrder: true,
    canonicalFacetOrder: true,
    preserveEverySource: true,
    preserveContradictions: true,
    sourceGrouping: 'ONE_SOURCE_PER_CELL',
    semanticMerging: 'NOT_PERFORMED',
    emptyFacetCreation: 'FORBIDDEN',
    relationContext: 'APPROVED_ONLY',
    customerWriting: 'BLOCKED',
  } as const)

export const AI_CHART_D1_PALACE_CONTENT_GRID_REASONS =
  Object.freeze([
    'RESULT_SHAPE_INVALID',
    'SOURCE_CHAIN_MISMATCH',
    'SEMANTIC_REVIEW_NOT_APPROVED',
    'PALACE_OR_FACET_ORDER_MISMATCH',
    'CONTENT_CELL_COVERAGE_MISMATCH',
    'RELATION_CONTEXT_MISMATCH',
    'COVERAGE_MISMATCH',
  ] as const)

export type AiChartD1PalaceContentGridReason =
  (typeof AI_CHART_D1_PALACE_CONTENT_GRID_REASONS)[number]

export type AiChartD1PalaceContentCell = Readonly<{
  contentCellId: string
  targetPalaceId: AiChartD1PalaceId
  facetId: AiChartD1PalaceFacetId
  sourceCellRefs: readonly string[]
  relationRefs: readonly string[]
  writingStatus: 'required'
}>

export type AiChartD1PalaceContentFacetSection = Readonly<{
  facetId: AiChartD1PalaceFacetId
  contentCells: readonly AiChartD1PalaceContentCell[]
}>

export type AiChartD1PalaceContentGridEntry = Readonly<{
  targetPalaceId: AiChartD1PalaceId
  facetSections: readonly AiChartD1PalaceContentFacetSection[]
}>

export type AiChartD1PalaceContentGridCoverage = Readonly<{
  palaceIds: readonly AiChartD1PalaceId[]
  facetIds: readonly AiChartD1PalaceFacetId[]
  contentCellIds: readonly string[]
  sourceCellRefs: readonly string[]
  relationRefs: readonly string[]
}>

export type AiChartD1PalaceContentGrid = Readonly<{
  contractVersion: typeof AI_CHART_D1_PALACE_CONTENT_GRID_VERSION
  chartId: string
  runId: string
  sourceSnapshotSha256: string
  sourceWritingSetVersion:
    typeof AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION
  sourceWholeChartResultVersion:
    typeof AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION
  sourceSemanticReviewVersion:
    typeof AI_CHART_D1_WHOLE_CHART_SEMANTIC_REVIEW_VERSION
  sourceWholeChartResultRef: string
  sourceSemanticReviewRef: string
  palaces: readonly AiChartD1PalaceContentGridEntry[]
  gridPolicy: typeof AI_CHART_D1_PALACE_CONTENT_GRID_POLICY
  coverage: AiChartD1PalaceContentGridCoverage
  writingPackageHandoffStatus: 'ready'
  customerWritingStatus: 'blocked'
  openAiCallable: false
  validationStatus: 'validated'
}>

export class AiChartD1PalaceContentGridError extends Error {
  readonly code = AI_CHART_D1_PALACE_CONTENT_GRID_INVALID
  declare readonly reasonCode: AiChartD1PalaceContentGridReason

  constructor(reasonCode: AiChartD1PalaceContentGridReason) {
    super(AI_CHART_D1_PALACE_CONTENT_GRID_INVALID)
    this.name = 'AiChartD1PalaceContentGridError'
    Object.defineProperty(this, 'reasonCode', {
      value: reasonCode,
      enumerable: true,
      writable: false,
      configurable: false,
    })
    Object.freeze(this)
  }
}

const CONTENT_CELL_FIELDS = Object.freeze([
  'contentCellId',
  'targetPalaceId',
  'facetId',
  'sourceCellRefs',
  'relationRefs',
  'writingStatus',
] as const)
const FACET_SECTION_FIELDS = Object.freeze([
  'facetId',
  'contentCells',
] as const)
const PALACE_FIELDS = Object.freeze([
  'targetPalaceId',
  'facetSections',
] as const)
const GRID_POLICY_FIELDS = Object.freeze([
  'canonicalPalaceOrder',
  'canonicalFacetOrder',
  'preserveEverySource',
  'preserveContradictions',
  'sourceGrouping',
  'semanticMerging',
  'emptyFacetCreation',
  'relationContext',
  'customerWriting',
] as const)
const COVERAGE_FIELDS = Object.freeze([
  'palaceIds',
  'facetIds',
  'contentCellIds',
  'sourceCellRefs',
  'relationRefs',
] as const)
const GRID_FIELDS = Object.freeze([
  'contractVersion',
  'chartId',
  'runId',
  'sourceSnapshotSha256',
  'sourceWritingSetVersion',
  'sourceWholeChartResultVersion',
  'sourceSemanticReviewVersion',
  'sourceWholeChartResultRef',
  'sourceSemanticReviewRef',
  'palaces',
  'gridPolicy',
  'coverage',
  'writingPackageHandoffStatus',
  'customerWritingStatus',
  'openAiCallable',
  'validationStatus',
] as const)
const PALACE_IDS = AI_CHART_D1_PALACE_IDENTITIES.map(
  (identity) => identity.palaceId,
)
const MAX_CONTENT_CELLS_PER_PALACE = 304
const MAX_CONTENT_CELLS = 1_536
const MAX_RELATIONS = AI_CHART_D1_MAX_LIST_ITEMS
const SHA256_PATTERN = /^[a-f0-9]{64}$/u

function invalid(reasonCode: AiChartD1PalaceContentGridReason): never {
  throw new AiChartD1PalaceContentGridError(reasonCode)
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
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
    if (error instanceof AiChartD1PalaceContentGridError) {
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

function parseSha256(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !SHA256_PATTERN.test(value)
  ) {
    invalid('RESULT_SHAPE_INVALID')
  }
  return value
}

function parsePalaceIdArray(
  value: unknown,
): readonly AiChartD1PalaceId[] {
  return parseAiChartD1StringArray(value, {
    minimumItems: 12,
    maximumItems: 12,
    parseItem: parsePalaceId,
  }) as readonly AiChartD1PalaceId[]
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

function parseContentCell(
  value: unknown,
  targetPalaceId: AiChartD1PalaceId,
  facetId: AiChartD1PalaceFacetId,
): AiChartD1PalaceContentCell {
  const record = requireAiChartD1ExactObject(
    value,
    CONTENT_CELL_FIELDS,
  )
  const cellPalaceId = parsePalaceId(record.targetPalaceId)
  const cellFacetId = parseFacetId(record.facetId, cellPalaceId)
  if (
    cellPalaceId !== targetPalaceId ||
    cellFacetId !== facetId ||
    record.writingStatus !== 'required'
  ) {
    invalid('RESULT_SHAPE_INVALID')
  }
  return freezeAiChartD1Value({
    contentCellId: parseAiChartD1Id(record.contentCellId),
    targetPalaceId: cellPalaceId,
    facetId: cellFacetId,
    sourceCellRefs: parseIdArray(record.sourceCellRefs, 1, 1),
    relationRefs: parseIdArray(
      record.relationRefs,
      0,
      MAX_RELATIONS,
    ),
    writingStatus: 'required' as const,
  })
}

function parseFacetSection(
  value: unknown,
  targetPalaceId: AiChartD1PalaceId,
): AiChartD1PalaceContentFacetSection {
  const record = requireAiChartD1ExactObject(
    value,
    FACET_SECTION_FIELDS,
  )
  const facetId = parseFacetId(record.facetId, targetPalaceId)
  if (
    !Array.isArray(record.contentCells) ||
    record.contentCells.length < 1 ||
    record.contentCells.length > MAX_CONTENT_CELLS_PER_PALACE
  ) {
    invalid('RESULT_SHAPE_INVALID')
  }
  return freezeAiChartD1Value({
    facetId,
    contentCells: Object.freeze(
      record.contentCells.map((cell) =>
        parseContentCell(cell, targetPalaceId, facetId),
      ),
    ),
  })
}

function parsePalaceEntry(
  value: unknown,
): AiChartD1PalaceContentGridEntry {
  const record = requireAiChartD1ExactObject(value, PALACE_FIELDS)
  const targetPalaceId = parsePalaceId(record.targetPalaceId)
  if (
    !Array.isArray(record.facetSections) ||
    record.facetSections.length < 1 ||
    record.facetSections.length >
      AI_CHART_D1_PALACE_FACET_IDS.length
  ) {
    invalid('RESULT_SHAPE_INVALID')
  }
  const facetSections = Object.freeze(
    record.facetSections.map((section) =>
      parseFacetSection(section, targetPalaceId),
    ),
  )
  if (
    new Set(facetSections.map((section) => section.facetId)).size !==
    facetSections.length
  ) {
    invalid('PALACE_OR_FACET_ORDER_MISMATCH')
  }
  const expectedFacetOrder =
    AI_CHART_D1_PALACE_FACET_REGISTRY.find(
      (entry) => entry.palaceId === targetPalaceId,
    )!.facetIds.filter((facetId) =>
      facetSections.some((section) => section.facetId === facetId),
    )
  if (
    !sameJson(
      facetSections.map((section) => section.facetId),
      expectedFacetOrder,
    )
  ) {
    invalid('PALACE_OR_FACET_ORDER_MISMATCH')
  }
  const contentCells = facetSections.flatMap(
    (section) => section.contentCells,
  )
  if (
    contentCells.some(
      (cell, index) =>
        cell.contentCellId !==
        `content-grid-cell:${targetPalaceId}:${index + 1}`,
    )
  ) {
    invalid('CONTENT_CELL_COVERAGE_MISMATCH')
  }
  return freezeAiChartD1Value({
    targetPalaceId,
    facetSections,
  })
}

function parseGridPolicy(
  value: unknown,
): typeof AI_CHART_D1_PALACE_CONTENT_GRID_POLICY {
  requireAiChartD1ExactObject(value, GRID_POLICY_FIELDS)
  if (
    !sameJson(value, AI_CHART_D1_PALACE_CONTENT_GRID_POLICY)
  ) {
    invalid('RESULT_SHAPE_INVALID')
  }
  return AI_CHART_D1_PALACE_CONTENT_GRID_POLICY
}

function expectedCoverage(
  palaces: readonly AiChartD1PalaceContentGridEntry[],
): AiChartD1PalaceContentGridCoverage {
  const sections = palaces.flatMap(
    (palace) => palace.facetSections,
  )
  const cells = sections.flatMap((section) => section.contentCells)
  return freezeAiChartD1Value({
    palaceIds: palaces.map((palace) => palace.targetPalaceId),
    facetIds: collectUnique(
      sections.map((section) => section.facetId),
    ),
    contentCellIds: cells.map((cell) => cell.contentCellId),
    sourceCellRefs: cells.flatMap((cell) => cell.sourceCellRefs),
    relationRefs: collectUnique(
      cells.flatMap((cell) => cell.relationRefs),
    ),
  })
}

function parseCoverage(
  value: unknown,
): AiChartD1PalaceContentGridCoverage {
  const record = requireAiChartD1ExactObject(value, COVERAGE_FIELDS)
  return freezeAiChartD1Value({
    palaceIds: parsePalaceIdArray(record.palaceIds),
    facetIds: parseFacetIdArray(record.facetIds),
    contentCellIds: parseIdArray(
      record.contentCellIds,
      12,
      MAX_CONTENT_CELLS,
    ),
    sourceCellRefs: parseIdArray(
      record.sourceCellRefs,
      12,
      MAX_CONTENT_CELLS,
    ),
    relationRefs: parseIdArray(
      record.relationRefs,
      1,
      MAX_RELATIONS,
    ),
  })
}

export function parseAiChartD1PalaceContentGrid(
  value: unknown,
): AiChartD1PalaceContentGrid {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(value, GRID_FIELDS)
    if (
      record.contractVersion !==
        AI_CHART_D1_PALACE_CONTENT_GRID_VERSION ||
      record.sourceWritingSetVersion !==
        AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION ||
      record.sourceWholeChartResultVersion !==
        AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION ||
      record.sourceSemanticReviewVersion !==
        AI_CHART_D1_WHOLE_CHART_SEMANTIC_REVIEW_VERSION ||
      record.writingPackageHandoffStatus !== 'ready' ||
      record.customerWritingStatus !== 'blocked' ||
      parseAiChartD1Boolean(record.openAiCallable) !== false ||
      record.validationStatus !== 'validated' ||
      !Array.isArray(record.palaces) ||
      record.palaces.length !== 12
    ) {
      invalid('RESULT_SHAPE_INVALID')
    }
    const palaces = Object.freeze(
      record.palaces.map(parsePalaceEntry),
    )
    if (
      !sameJson(
        palaces.map((palace) => palace.targetPalaceId),
        PALACE_IDS,
      )
    ) {
      invalid('PALACE_OR_FACET_ORDER_MISMATCH')
    }
    const cells = palaces.flatMap((palace) =>
      palace.facetSections.flatMap(
        (section) => section.contentCells,
      ),
    )
    if (
      new Set(cells.map((cell) => cell.contentCellId)).size !==
        cells.length ||
      new Set(cells.flatMap((cell) => cell.sourceCellRefs)).size !==
        cells.length
    ) {
      invalid('CONTENT_CELL_COVERAGE_MISMATCH')
    }
    const coverage = parseCoverage(record.coverage)
    if (!sameJson(coverage, expectedCoverage(palaces))) {
      invalid('COVERAGE_MISMATCH')
    }
    return freezeAiChartD1Value({
      contractVersion: AI_CHART_D1_PALACE_CONTENT_GRID_VERSION,
      chartId: parseAiChartD1Id(record.chartId),
      runId: parseAiChartD1Id(record.runId),
      sourceSnapshotSha256: parseSha256(
        record.sourceSnapshotSha256,
      ),
      sourceWritingSetVersion:
        AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION,
      sourceWholeChartResultVersion:
        AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION,
      sourceSemanticReviewVersion:
        AI_CHART_D1_WHOLE_CHART_SEMANTIC_REVIEW_VERSION,
      sourceWholeChartResultRef: parseAiChartD1Id(
        record.sourceWholeChartResultRef,
      ),
      sourceSemanticReviewRef: parseAiChartD1Id(
        record.sourceSemanticReviewRef,
      ),
      palaces,
      gridPolicy: parseGridPolicy(record.gridPolicy),
      coverage,
      writingPackageHandoffStatus: 'ready' as const,
      customerWritingStatus: 'blocked' as const,
      openAiCallable: false as const,
      validationStatus: 'validated' as const,
    })
  } catch (error) {
    if (error instanceof AiChartD1PalaceContentGridError) {
      throw error
    }
    invalid('RESULT_SHAPE_INVALID')
  }
}

type ValidatedSourceChain = Readonly<{
  sourceSet: AiChartD1PalaceWritingSourceSet
  relationResult: AiChartD1WholeChartRelationResult
  semanticReview: AiChartD1WholeChartSemanticReview
  sourceSnapshotSha256: string
}>

function validateSourceChain(
  sourceSetValue: unknown,
  relationResultValue: unknown,
  semanticReviewValue: unknown,
  palaceResultValues: unknown,
  flyingIntegrationValue: unknown,
  n0Value: unknown,
): ValidatedSourceChain {
  let sourceSet: AiChartD1PalaceWritingSourceSet
  let relationResult: AiChartD1WholeChartRelationResult
  let semanticReview: AiChartD1WholeChartSemanticReview
  let sourceSnapshotSha256: string
  try {
    const n0 = parseAiChartD1N0(n0Value)
    sourceSnapshotSha256 = n0.sourceSnapshotSha256
    sourceSet = parseAiChartD1PalaceWritingSourceSet(sourceSetValue)
    relationResult =
      validateAiChartD1WholeChartRelationResultAgainstSources(
        relationResultValue,
        sourceSet,
        palaceResultValues,
        flyingIntegrationValue,
        n0,
      )
    semanticReview =
      validateAiChartD1WholeChartSemanticReviewAgainstSources(
        semanticReviewValue,
        relationResult,
        sourceSet,
        palaceResultValues,
        flyingIntegrationValue,
        n0,
      )
  } catch {
    invalid('SOURCE_CHAIN_MISMATCH')
  }
  if (
    semanticReview.semanticReviewStatus !== 'approved' ||
    semanticReview.contentGridHandoffStatus !== 'ready' ||
    semanticReview.coverage.repairRelationRefs.length !== 0
  ) {
    invalid('SEMANTIC_REVIEW_NOT_APPROVED')
  }
  return freezeAiChartD1Value({
    sourceSet,
    relationResult,
    semanticReview,
    sourceSnapshotSha256,
  })
}

function buildFromValidatedSourceChain(
  sourceChain: ValidatedSourceChain,
): AiChartD1PalaceContentGrid {
  const relationRefsBySource = new Map<string, readonly string[]>()
  for (const palace of sourceChain.sourceSet.palaces) {
    for (const sourceCell of palace.sourceCells) {
      relationRefsBySource.set(
        sourceCell.sourceCellId,
        Object.freeze(
          sourceChain.relationResult.relations
            .filter((relation) =>
              relation.sourceCellRefs.includes(
                sourceCell.sourceCellId,
              ),
            )
            .map((relation) => relation.relationId),
        ),
      )
    }
  }

  const palaces = sourceChain.sourceSet.palaces.map((palace) => {
    const registry = AI_CHART_D1_PALACE_FACET_REGISTRY.find(
      (entry) => entry.palaceId === palace.targetPalaceId,
    )!
    let contentCellIndex = 0
    const facetSections = registry.facetIds.flatMap((facetId) => {
      const sourceCells = palace.sourceCells.filter(
        (sourceCell) => sourceCell.facetId === facetId,
      )
      if (sourceCells.length === 0) return []
      return [
        {
          facetId,
          contentCells: sourceCells.map((sourceCell) => {
            contentCellIndex += 1
            return {
              contentCellId:
                `content-grid-cell:${palace.targetPalaceId}:` +
                `${contentCellIndex}`,
              targetPalaceId: palace.targetPalaceId,
              facetId,
              sourceCellRefs: [sourceCell.sourceCellId],
              relationRefs:
                relationRefsBySource.get(sourceCell.sourceCellId) ??
                [],
              writingStatus: 'required' as const,
            }
          }),
        },
      ]
    })
    return {
      targetPalaceId: palace.targetPalaceId,
      facetSections,
    }
  })
  const coverage = expectedCoverage(
    palaces as readonly AiChartD1PalaceContentGridEntry[],
  )
  if (
    !sameJson(
      collectUnique(coverage.relationRefs),
      coverage.relationRefs,
    ) ||
    coverage.relationRefs.length !==
      sourceChain.relationResult.relations.length
  ) {
    invalid('RELATION_CONTEXT_MISMATCH')
  }
  return parseAiChartD1PalaceContentGrid({
    contractVersion: AI_CHART_D1_PALACE_CONTENT_GRID_VERSION,
    chartId: sourceChain.sourceSet.chartId,
    runId: sourceChain.sourceSet.runId,
    sourceSnapshotSha256:
      sourceChain.sourceSnapshotSha256,
    sourceWritingSetVersion:
      AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION,
    sourceWholeChartResultVersion:
      AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION,
    sourceSemanticReviewVersion:
      AI_CHART_D1_WHOLE_CHART_SEMANTIC_REVIEW_VERSION,
    sourceWholeChartResultRef:
      sourceChain.relationResult.wholeChartResultId,
    sourceSemanticReviewRef:
      sourceChain.semanticReview.semanticReviewId,
    palaces,
    gridPolicy: AI_CHART_D1_PALACE_CONTENT_GRID_POLICY,
    coverage,
    writingPackageHandoffStatus: 'ready',
    customerWritingStatus: 'blocked',
    openAiCallable: false,
    validationStatus: 'validated',
  })
}

export function buildAiChartD1PalaceContentGrid(
  sourceSetValue: unknown,
  relationResultValue: unknown,
  semanticReviewValue: unknown,
  palaceResultValues: unknown,
  flyingIntegrationValue: unknown,
  n0Value: unknown,
): AiChartD1PalaceContentGrid {
  return buildFromValidatedSourceChain(
    validateSourceChain(
      sourceSetValue,
      relationResultValue,
      semanticReviewValue,
      palaceResultValues,
      flyingIntegrationValue,
      n0Value,
    ),
  )
}

export function validateAiChartD1PalaceContentGridAgainstSources(
  gridValue: unknown,
  sourceSetValue: unknown,
  relationResultValue: unknown,
  semanticReviewValue: unknown,
  palaceResultValues: unknown,
  flyingIntegrationValue: unknown,
  n0Value: unknown,
): AiChartD1PalaceContentGrid {
  const grid = parseAiChartD1PalaceContentGrid(gridValue)
  const expected = buildFromValidatedSourceChain(
    validateSourceChain(
      sourceSetValue,
      relationResultValue,
      semanticReviewValue,
      palaceResultValues,
      flyingIntegrationValue,
      n0Value,
    ),
  )
  if (!sameJson(grid, expected)) {
    invalid('SOURCE_CHAIN_MISMATCH')
  }
  return grid
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
const CONTENT_CELL_SCHEMA = createAiChartD1StrictObjectSchema({
  contentCellId: ID_SCHEMA,
  targetPalaceId: PALACE_ID_SCHEMA,
  facetId: FACET_ID_SCHEMA,
  sourceCellRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 1,
    maximumItems: 1,
  }),
  relationRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 0,
    maximumItems: MAX_RELATIONS,
  }),
  writingStatus: freezeAiChartD1Value({ const: 'required' }),
})
const FACET_SECTION_SCHEMA = createAiChartD1StrictObjectSchema({
  facetId: FACET_ID_SCHEMA,
  contentCells: createAiChartD1ArraySchema(CONTENT_CELL_SCHEMA, {
    minimumItems: 1,
    maximumItems: MAX_CONTENT_CELLS_PER_PALACE,
  }),
})
const PALACE_SCHEMA = createAiChartD1StrictObjectSchema({
  targetPalaceId: PALACE_ID_SCHEMA,
  facetSections: createAiChartD1ArraySchema(
    FACET_SECTION_SCHEMA,
    {
      minimumItems: 1,
      maximumItems: AI_CHART_D1_PALACE_FACET_IDS.length,
    },
  ),
})
const GRID_POLICY_SCHEMA = createAiChartD1StrictObjectSchema({
  canonicalPalaceOrder: freezeAiChartD1Value({ const: true }),
  canonicalFacetOrder: freezeAiChartD1Value({ const: true }),
  preserveEverySource: freezeAiChartD1Value({ const: true }),
  preserveContradictions: freezeAiChartD1Value({ const: true }),
  sourceGrouping: freezeAiChartD1Value({
    const: 'ONE_SOURCE_PER_CELL',
  }),
  semanticMerging: freezeAiChartD1Value({
    const: 'NOT_PERFORMED',
  }),
  emptyFacetCreation: freezeAiChartD1Value({
    const: 'FORBIDDEN',
  }),
  relationContext: freezeAiChartD1Value({
    const: 'APPROVED_ONLY',
  }),
  customerWriting: freezeAiChartD1Value({
    const: 'BLOCKED',
  }),
})
const COVERAGE_SCHEMA = createAiChartD1StrictObjectSchema({
  palaceIds: createAiChartD1ArraySchema(PALACE_ID_SCHEMA, {
    minimumItems: 12,
    maximumItems: 12,
  }),
  facetIds: createAiChartD1ArraySchema(FACET_ID_SCHEMA, {
    minimumItems: 1,
    maximumItems: AI_CHART_D1_PALACE_FACET_IDS.length,
  }),
  contentCellIds: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 12,
    maximumItems: MAX_CONTENT_CELLS,
  }),
  sourceCellRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 12,
    maximumItems: MAX_CONTENT_CELLS,
  }),
  relationRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 1,
    maximumItems: MAX_RELATIONS,
  }),
})

export const AI_CHART_D1_PALACE_CONTENT_GRID_JSON_SCHEMA:
  AiChartD1JsonSchema = createAiChartD1StrictObjectSchema({
    contractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_PALACE_CONTENT_GRID_VERSION,
    }),
    chartId: ID_SCHEMA,
    runId: ID_SCHEMA,
    sourceSnapshotSha256: createAiChartD1StringSchema({
      maximumLength: 64,
      pattern: SHA256_PATTERN.source,
    }),
    sourceWritingSetVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION,
    }),
    sourceWholeChartResultVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION,
    }),
    sourceSemanticReviewVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_WHOLE_CHART_SEMANTIC_REVIEW_VERSION,
    }),
    sourceWholeChartResultRef: ID_SCHEMA,
    sourceSemanticReviewRef: ID_SCHEMA,
    palaces: createAiChartD1ArraySchema(PALACE_SCHEMA, {
      minimumItems: 12,
      maximumItems: 12,
    }),
    gridPolicy: GRID_POLICY_SCHEMA,
    coverage: COVERAGE_SCHEMA,
    writingPackageHandoffStatus: freezeAiChartD1Value({
      const: 'ready',
    }),
    customerWritingStatus: freezeAiChartD1Value({
      const: 'blocked',
    }),
    openAiCallable: freezeAiChartD1Value({ const: false }),
    validationStatus: freezeAiChartD1Value({
      const: 'validated',
    }),
  })
