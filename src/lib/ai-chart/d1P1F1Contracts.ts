import {
  AI_CHART_D1_CANDIDATE_FIELDS,
  AI_CHART_D1_CANDIDATE_SCHEMA,
  AI_CHART_D1_D2_BOUNDARY_FIELDS,
  AI_CHART_D1_D2_BOUNDARY_SCHEMA,
  AI_CHART_D1_ID_PATTERN,
  AI_CHART_D1_MAX_CANDIDATES_PER_COLLECTION,
  AI_CHART_D1_MAX_LIST_ITEMS,
  AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
  AI_CHART_D1_P1_F1_CONTRACT_VERSION,
  AI_CHART_D1_PALACE_NAMES,
  AI_CHART_D1_RESULT_STATUSES,
  AI_CHART_D1_TRAIT_TENSION_FIELDS,
  AI_CHART_D1_TRAIT_TENSION_SCHEMA,
  AiChartD1ContractError,
  assertAiChartD1SafeGraph,
  createAiChartD1ArraySchema,
  createAiChartD1StrictObjectSchema,
  createAiChartD1StringSchema,
  freezeAiChartD1Value,
  parseAiChartD1Boolean,
  parseAiChartD1CandidateFields,
  parseAiChartD1Enum,
  parseAiChartD1Id,
  parseAiChartD1NullableId,
  parseAiChartD1NullableText,
  parseAiChartD1StringArray,
  parseAiChartD1Text,
  requireAiChartD1ExactObject,
  type AiChartD1Candidate,
  type AiChartD1D2Boundary,
  type AiChartD1JsonSchema,
  type AiChartD1PalaceName,
  type AiChartD1ResultStatus,
  type AiChartD1TraitTension,
} from './d1CommonContracts'

export const AI_CHART_D1_P1_SCHEMA_NAME = 'ai_chart_d1_p1_v1' as const
export const AI_CHART_D1_F1_SCHEMA_NAME = 'ai_chart_d1_f1_v1' as const

export type AiChartD1TaskType = 'P1' | 'F1'

export type AiChartD1P1PrimaryAxis = Readonly<{
  statement: string
  majorStarCore: readonly string[]
  doubleStarCore: string | null
  borrowedStarMode: 'none' | 'borrowed'
  usedRuleIds: readonly string[]
}>

export type AiChartD1P1Coverage = Readonly<{
  directMeaningsConsidered: readonly string[]
  majorStarsCovered: readonly string[]
  minorStarsCovered: readonly string[]
  mutagensCovered: readonly string[]
  maleficsCovered: readonly string[]
  noblesCovered: readonly string[]
  oppositeProcessed: boolean
  hiddenCombinationProcessed: boolean
  trinesProcessed: boolean
  omittedItems: readonly Readonly<{
    item: string
    reason: string
  }>[]
}>

export type AiChartD1P1Result = Readonly<{
  contractVersion: typeof AI_CHART_D1_P1_F1_CONTRACT_VERSION
  task: 'P1'
  callId: string
  chartId: string
  palaceId: string
  palace: AiChartD1PalaceName
  status: AiChartD1ResultStatus
  primaryAxis: AiChartD1P1PrimaryAxis
  directCandidates: readonly AiChartD1Candidate[]
  oppositeInfluences: readonly AiChartD1Candidate[]
  hiddenCombinationInfluences: readonly AiChartD1Candidate[]
  trineInfluences: readonly AiChartD1Candidate[]
  combinedCandidates: readonly AiChartD1Candidate[]
  tensions: readonly AiChartD1TraitTension[]
  strengths: readonly AiChartD1Candidate[]
  imbalancePossibilities: readonly AiChartD1Candidate[]
  coverage: AiChartD1P1Coverage
  d2Boundaries: readonly AiChartD1D2Boundary[]
  warnings: readonly string[]
}>

export type AiChartD1F1Candidate = AiChartD1Candidate &
  Readonly<{
    sourceMeaningId: string
    destinationMeaningId: string
    bridgeMechanism: string
    sourceBehavior: string
    destinationEffect: string
  }>

export const AI_CHART_D1_F1_COVERAGE_STATUSES = Object.freeze([
  'candidate_created',
  'merged',
  'excluded',
] as const)

export type AiChartD1F1CoverageStatus =
  (typeof AI_CHART_D1_F1_COVERAGE_STATUSES)[number]

export type AiChartD1F1CoverageMatrixItem = Readonly<{
  sourceMeaningId: string
  destinationMeaningId: string
  status: AiChartD1F1CoverageStatus
  candidateId: string | null
  mergedIntoCandidateId: string | null
  exclusionReason: string | null
}>

export type AiChartD1F1MergedCandidateGroup = Readonly<{
  retainedCandidateId: string
  mergedCandidateIds: readonly string[]
  reason: string
}>

export type AiChartD1F1Result = Readonly<{
  contractVersion: typeof AI_CHART_D1_P1_F1_CONTRACT_VERSION
  task: 'F1'
  callId: string
  chartId: string
  flyingTransformId: string
  status: AiChartD1ResultStatus
  sourceSummary: string
  destinationSummary: string
  transformationCore: string
  candidates: readonly AiChartD1F1Candidate[]
  coverageMatrix: readonly AiChartD1F1CoverageMatrixItem[]
  mergedCandidateGroups: readonly AiChartD1F1MergedCandidateGroup[]
  d2Boundaries: readonly AiChartD1D2Boundary[]
  warnings: readonly string[]
}>

export const AI_CHART_D1_P1_PRIMARY_AXIS_FIELDS = Object.freeze([
  'statement',
  'majorStarCore',
  'doubleStarCore',
  'borrowedStarMode',
  'usedRuleIds',
] as const)

export const AI_CHART_D1_P1_COVERAGE_FIELDS = Object.freeze([
  'directMeaningsConsidered',
  'majorStarsCovered',
  'minorStarsCovered',
  'mutagensCovered',
  'maleficsCovered',
  'noblesCovered',
  'oppositeProcessed',
  'hiddenCombinationProcessed',
  'trinesProcessed',
  'omittedItems',
] as const)

export const AI_CHART_D1_P1_COVERAGE_DUPLICATE_FIELDS = Object.freeze([
  'directMeaningsConsidered',
  'majorStarsCovered',
  'minorStarsCovered',
  'mutagensCovered',
  'maleficsCovered',
  'noblesCovered',
] as const)

export type AiChartD1P1CoverageDuplicateField =
  (typeof AI_CHART_D1_P1_COVERAGE_DUPLICATE_FIELDS)[number]

const AI_CHART_D1_P1_COVERAGE_DUPLICATE_FIELD_SET: ReadonlySet<unknown> =
  new Set(AI_CHART_D1_P1_COVERAGE_DUPLICATE_FIELDS)

export class AiChartD1P1CoverageDuplicateError extends AiChartD1ContractError {
  declare readonly field: AiChartD1P1CoverageDuplicateField

  constructor(field: unknown) {
    super()
    if (!AI_CHART_D1_P1_COVERAGE_DUPLICATE_FIELD_SET.has(field)) {
      throw new AiChartD1ContractError()
    }
    this.name = 'AiChartD1P1CoverageDuplicateError'
    Object.defineProperty(this, 'field', {
      value: field,
      enumerable: true,
      writable: false,
      configurable: false,
    })
    Object.freeze(this)
  }
}

export const AI_CHART_D1_P1_RESULT_FIELDS = Object.freeze([
  'contractVersion',
  'task',
  'callId',
  'chartId',
  'palaceId',
  'palace',
  'status',
  'primaryAxis',
  'directCandidates',
  'oppositeInfluences',
  'hiddenCombinationInfluences',
  'trineInfluences',
  'combinedCandidates',
  'tensions',
  'strengths',
  'imbalancePossibilities',
  'coverage',
  'd2Boundaries',
  'warnings',
] as const)

export const AI_CHART_D1_F1_CANDIDATE_FIELDS = Object.freeze([
  ...AI_CHART_D1_CANDIDATE_FIELDS,
  'sourceMeaningId',
  'destinationMeaningId',
  'bridgeMechanism',
  'sourceBehavior',
  'destinationEffect',
] as const)

export const AI_CHART_D1_F1_COVERAGE_MATRIX_FIELDS = Object.freeze([
  'sourceMeaningId',
  'destinationMeaningId',
  'status',
  'candidateId',
  'mergedIntoCandidateId',
  'exclusionReason',
] as const)

export const AI_CHART_D1_F1_MERGED_GROUP_FIELDS = Object.freeze([
  'retainedCandidateId',
  'mergedCandidateIds',
  'reason',
] as const)

export const AI_CHART_D1_F1_RESULT_FIELDS = Object.freeze([
  'contractVersion',
  'task',
  'callId',
  'chartId',
  'flyingTransformId',
  'status',
  'sourceSummary',
  'destinationSummary',
  'transformationCore',
  'candidates',
  'coverageMatrix',
  'mergedCandidateGroups',
  'd2Boundaries',
  'warnings',
] as const)

const P1_CANDIDATE_COLLECTION_FIELDS = Object.freeze([
  'directCandidates',
  'oppositeInfluences',
  'hiddenCombinationInfluences',
  'trineInfluences',
  'combinedCandidates',
  'strengths',
  'imbalancePossibilities',
] as const)

const OMITTED_ITEM_FIELDS = Object.freeze(['item', 'reason'] as const)

function invalid(): never {
  throw new AiChartD1ContractError()
}

function parseCandidateArray(value: unknown): readonly AiChartD1Candidate[] {
  if (
    !Array.isArray(value) ||
    value.length > AI_CHART_D1_MAX_CANDIDATES_PER_COLLECTION
  ) {
    invalid()
  }
  return Object.freeze(
    value.map((candidate) => parseAiChartD1CandidateFields(candidate)),
  )
}

function parseBoundaryArray(value: unknown): readonly AiChartD1D2Boundary[] {
  if (!Array.isArray(value) || value.length > AI_CHART_D1_MAX_LIST_ITEMS) {
    invalid()
  }

  return Object.freeze(
    value.map((boundary) => {
      const record = requireAiChartD1ExactObject(
        boundary,
        AI_CHART_D1_D2_BOUNDARY_FIELDS,
      )
      return Object.freeze({
        boundaryId: parseAiChartD1Id(record.boundaryId),
        topic: parseAiChartD1Text(
          record.topic,
          AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
        ),
        prohibitedD1Conclusion: parseAiChartD1Text(
          record.prohibitedD1Conclusion,
        ),
        allowedD1Wording: parseAiChartD1Text(record.allowedD1Wording),
        reason: parseAiChartD1Text(record.reason),
      })
    }),
  )
}

function parseTensionArray(value: unknown): readonly AiChartD1TraitTension[] {
  if (!Array.isArray(value) || value.length > AI_CHART_D1_MAX_LIST_ITEMS) {
    invalid()
  }

  return Object.freeze(
    value.map((tension) => {
      const record = requireAiChartD1ExactObject(
        tension,
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
          minimumItems: 2,
          parseItem: parseAiChartD1Id,
        }),
      })
    }),
  )
}

function parsePrimaryAxis(value: unknown): AiChartD1P1PrimaryAxis {
  const record = requireAiChartD1ExactObject(
    value,
    AI_CHART_D1_P1_PRIMARY_AXIS_FIELDS,
  )

  return Object.freeze({
    statement: parseAiChartD1Text(record.statement),
    majorStarCore: parseAiChartD1StringArray(record.majorStarCore),
    doubleStarCore: parseAiChartD1NullableText(record.doubleStarCore),
    borrowedStarMode: parseAiChartD1Enum(record.borrowedStarMode, [
      'none',
      'borrowed',
    ] as const),
    usedRuleIds: parseAiChartD1StringArray(record.usedRuleIds, {
      parseItem: parseAiChartD1Id,
    }),
  })
}

type ParsedP1Coverage = Readonly<{
  value: AiChartD1P1Coverage
  duplicateField: AiChartD1P1CoverageDuplicateField | null
}>

function parseCoverageStringArray(value: unknown): Readonly<{
  value: readonly string[]
  hasDuplicate: boolean
}> {
  if (!Array.isArray(value) || value.length > AI_CHART_D1_MAX_LIST_ITEMS) {
    invalid()
  }
  const parsed = Object.freeze(
    value.map((item) =>
      parseAiChartD1Text(item, AI_CHART_D1_MAX_SHORT_TEXT_LENGTH),
    ),
  )
  return Object.freeze({
    value: parsed,
    hasDuplicate: new Set(parsed).size !== parsed.length,
  })
}

function parseCoverage(value: unknown): ParsedP1Coverage {
  const record = requireAiChartD1ExactObject(
    value,
    AI_CHART_D1_P1_COVERAGE_FIELDS,
  )
  if (
    !Array.isArray(record.omittedItems) ||
    record.omittedItems.length > AI_CHART_D1_MAX_LIST_ITEMS
  ) {
    invalid()
  }

  const omittedItems = Object.freeze(
    record.omittedItems.map((item) => {
      const omitted = requireAiChartD1ExactObject(item, OMITTED_ITEM_FIELDS)
      return Object.freeze({
        item: parseAiChartD1Text(
          omitted.item,
          AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
        ),
        reason: parseAiChartD1Text(omitted.reason),
      })
    }),
  )
  const omittedNames = omittedItems.map((item) => item.item)
  if (new Set(omittedNames).size !== omittedNames.length) invalid()

  const parsedArrays = Object.fromEntries(
    AI_CHART_D1_P1_COVERAGE_DUPLICATE_FIELDS.map((field) => [
      field,
      parseCoverageStringArray(record[field]),
    ]),
  ) as Record<
    AiChartD1P1CoverageDuplicateField,
    ReturnType<typeof parseCoverageStringArray>
  >
  const duplicateField =
    AI_CHART_D1_P1_COVERAGE_DUPLICATE_FIELDS.find(
      (field) => parsedArrays[field].hasDuplicate,
    ) ?? null
  const oppositeProcessed = parseAiChartD1Boolean(record.oppositeProcessed)
  const hiddenCombinationProcessed = parseAiChartD1Boolean(
    record.hiddenCombinationProcessed,
  )
  const trinesProcessed = parseAiChartD1Boolean(record.trinesProcessed)

  const coverage = Object.freeze({
    directMeaningsConsidered: parsedArrays.directMeaningsConsidered.value,
    majorStarsCovered: parsedArrays.majorStarsCovered.value,
    minorStarsCovered: parsedArrays.minorStarsCovered.value,
    mutagensCovered: parsedArrays.mutagensCovered.value,
    maleficsCovered: parsedArrays.maleficsCovered.value,
    noblesCovered: parsedArrays.noblesCovered.value,
    oppositeProcessed,
    hiddenCombinationProcessed,
    trinesProcessed,
    omittedItems,
  })

  return Object.freeze({ value: coverage, duplicateField })
}

type ParsedP1Result =
  | Readonly<{
      value: AiChartD1P1Result
      duplicateField: null
    }>
  | Readonly<{
      value: null
      duplicateField: AiChartD1P1CoverageDuplicateField
    }>

function parseP1(value: unknown): ParsedP1Result {
  assertAiChartD1SafeGraph(value)
  const record = requireAiChartD1ExactObject(
    value,
    AI_CHART_D1_P1_RESULT_FIELDS,
  )

  if (
    record.contractVersion !== AI_CHART_D1_P1_F1_CONTRACT_VERSION ||
    record.task !== 'P1'
  ) {
    invalid()
  }

  const candidateCollections = Object.fromEntries(
    P1_CANDIDATE_COLLECTION_FIELDS.map((field) => [
      field,
      parseCandidateArray(record[field]),
    ]),
  ) as Record<
    (typeof P1_CANDIDATE_COLLECTION_FIELDS)[number],
    readonly AiChartD1Candidate[]
  >
  const allCandidates = P1_CANDIDATE_COLLECTION_FIELDS.flatMap(
    (field) => candidateCollections[field],
  )
  const candidateIds = allCandidates.map((candidate) => candidate.candidateId)
  if (new Set(candidateIds).size !== candidateIds.length) invalid()
  const candidateIdSet = new Set(candidateIds)

  const tensions = parseTensionArray(record.tensions)
  const tensionIds = tensions.map((tension) => tension.tensionId)
  if (
    new Set(tensionIds).size !== tensionIds.length ||
    tensions.some((tension) =>
      tension.candidateIds.some((candidateId) => !candidateIdSet.has(candidateId)),
    )
  ) {
    invalid()
  }

  const boundaries = parseBoundaryArray(record.d2Boundaries)
  const boundaryIds = boundaries.map((boundary) => boundary.boundaryId)
  if (new Set(boundaryIds).size !== boundaryIds.length) invalid()

  const callId = parseAiChartD1Id(record.callId)
  const chartId = parseAiChartD1Id(record.chartId)
  const palaceId = parseAiChartD1Id(record.palaceId)
  const palace = parseAiChartD1Enum(record.palace, AI_CHART_D1_PALACE_NAMES)
  const status = parseAiChartD1Enum(record.status, AI_CHART_D1_RESULT_STATUSES)
  const primaryAxis = parsePrimaryAxis(record.primaryAxis)
  const coverage = parseCoverage(record.coverage)
  const warnings = parseAiChartD1StringArray(record.warnings)

  if (coverage.duplicateField !== null) {
    return Object.freeze({ value: null, duplicateField: coverage.duplicateField })
  }

  const parsed = Object.freeze({
    contractVersion: AI_CHART_D1_P1_F1_CONTRACT_VERSION,
    task: 'P1',
    callId,
    chartId,
    palaceId,
    palace,
    status,
    primaryAxis,
    directCandidates: candidateCollections.directCandidates,
    oppositeInfluences: candidateCollections.oppositeInfluences,
    hiddenCombinationInfluences:
      candidateCollections.hiddenCombinationInfluences,
    trineInfluences: candidateCollections.trineInfluences,
    combinedCandidates: candidateCollections.combinedCandidates,
    tensions,
    strengths: candidateCollections.strengths,
    imbalancePossibilities: candidateCollections.imbalancePossibilities,
    coverage: coverage.value,
    d2Boundaries: boundaries,
    warnings,
  })
  return Object.freeze({ value: parsed, duplicateField: null })
}

function parseF1Candidate(value: unknown): AiChartD1F1Candidate {
  const base = parseAiChartD1CandidateFields(
    value,
    AI_CHART_D1_F1_CANDIDATE_FIELDS,
  )
  const record = value as Record<string, unknown>

  return Object.freeze({
    ...base,
    sourceMeaningId: parseAiChartD1Id(record.sourceMeaningId),
    destinationMeaningId: parseAiChartD1Id(record.destinationMeaningId),
    bridgeMechanism: parseAiChartD1Text(record.bridgeMechanism),
    sourceBehavior: parseAiChartD1Text(record.sourceBehavior),
    destinationEffect: parseAiChartD1Text(record.destinationEffect),
  })
}

function parseCoverageMatrix(
  value: unknown,
): readonly AiChartD1F1CoverageMatrixItem[] {
  if (!Array.isArray(value) || value.length > AI_CHART_D1_MAX_LIST_ITEMS) {
    invalid()
  }

  return Object.freeze(
    value.map((item) => {
      const record = requireAiChartD1ExactObject(
        item,
        AI_CHART_D1_F1_COVERAGE_MATRIX_FIELDS,
      )
      return Object.freeze({
        sourceMeaningId: parseAiChartD1Id(record.sourceMeaningId),
        destinationMeaningId: parseAiChartD1Id(record.destinationMeaningId),
        status: parseAiChartD1Enum(
          record.status,
          AI_CHART_D1_F1_COVERAGE_STATUSES,
        ),
        candidateId: parseAiChartD1NullableId(record.candidateId),
        mergedIntoCandidateId: parseAiChartD1NullableId(
          record.mergedIntoCandidateId,
        ),
        exclusionReason: parseAiChartD1NullableText(record.exclusionReason),
      })
    }),
  )
}

function parseMergedGroups(
  value: unknown,
): readonly AiChartD1F1MergedCandidateGroup[] {
  if (!Array.isArray(value) || value.length > AI_CHART_D1_MAX_LIST_ITEMS) {
    invalid()
  }

  return Object.freeze(
    value.map((group) => {
      const record = requireAiChartD1ExactObject(
        group,
        AI_CHART_D1_F1_MERGED_GROUP_FIELDS,
      )
      return Object.freeze({
        retainedCandidateId: parseAiChartD1Id(record.retainedCandidateId),
        mergedCandidateIds: parseAiChartD1StringArray(
          record.mergedCandidateIds,
          { minimumItems: 1, parseItem: parseAiChartD1Id },
        ),
        reason: parseAiChartD1Text(record.reason),
      })
    }),
  )
}

function validateCoverageSemantics(
  candidates: readonly AiChartD1F1Candidate[],
  matrix: readonly AiChartD1F1CoverageMatrixItem[],
  groups: readonly AiChartD1F1MergedCandidateGroup[],
): void {
  const candidateIds = new Set(candidates.map((candidate) => candidate.candidateId))
  if (candidateIds.size !== candidates.length) invalid()

  const matrixPairs = matrix.map(
    (item) => `${item.sourceMeaningId}\u0000${item.destinationMeaningId}`,
  )
  if (new Set(matrixPairs).size !== matrixPairs.length) invalid()

  const referencedCandidates = new Set<string>()
  for (const item of matrix) {
    if (item.status === 'candidate_created') {
      if (
        item.candidateId === null ||
        !candidateIds.has(item.candidateId) ||
        item.mergedIntoCandidateId !== null ||
        item.exclusionReason !== null
      ) {
        invalid()
      }
      referencedCandidates.add(item.candidateId)
    } else if (item.status === 'merged') {
      if (
        item.candidateId !== null ||
        item.mergedIntoCandidateId === null ||
        !candidateIds.has(item.mergedIntoCandidateId) ||
        item.exclusionReason !== null
      ) {
        invalid()
      }
      referencedCandidates.add(item.mergedIntoCandidateId)
    } else if (
      item.candidateId !== null ||
      item.mergedIntoCandidateId !== null ||
      item.exclusionReason === null
    ) {
      invalid()
    }
  }

  for (const candidate of candidates) {
    const matchingReference = matrix.some(
      (item) =>
        item.sourceMeaningId === candidate.sourceMeaningId &&
        item.destinationMeaningId === candidate.destinationMeaningId &&
        (item.candidateId === candidate.candidateId ||
          item.mergedIntoCandidateId === candidate.candidateId),
    )
    if (!matchingReference || !referencedCandidates.has(candidate.candidateId)) {
      invalid()
    }
  }

  const mergedIds = new Set<string>()
  for (const group of groups) {
    if (!candidateIds.has(group.retainedCandidateId)) invalid()
    for (const mergedId of group.mergedCandidateIds) {
      if (
        mergedId === group.retainedCandidateId ||
        mergedIds.has(mergedId)
      ) {
        invalid()
      }
      mergedIds.add(mergedId)
    }
  }
}

function parseF1(value: unknown): AiChartD1F1Result {
  assertAiChartD1SafeGraph(value)
  const record = requireAiChartD1ExactObject(
    value,
    AI_CHART_D1_F1_RESULT_FIELDS,
  )

  if (
    record.contractVersion !== AI_CHART_D1_P1_F1_CONTRACT_VERSION ||
    record.task !== 'F1' ||
    !Array.isArray(record.candidates) ||
    record.candidates.length > AI_CHART_D1_MAX_CANDIDATES_PER_COLLECTION
  ) {
    invalid()
  }

  const candidates = Object.freeze(record.candidates.map(parseF1Candidate))
  const matrix = parseCoverageMatrix(record.coverageMatrix)
  const groups = parseMergedGroups(record.mergedCandidateGroups)
  validateCoverageSemantics(candidates, matrix, groups)

  const boundaries = parseBoundaryArray(record.d2Boundaries)
  const boundaryIds = boundaries.map((boundary) => boundary.boundaryId)
  if (new Set(boundaryIds).size !== boundaryIds.length) invalid()

  return Object.freeze({
    contractVersion: AI_CHART_D1_P1_F1_CONTRACT_VERSION,
    task: 'F1',
    callId: parseAiChartD1Id(record.callId),
    chartId: parseAiChartD1Id(record.chartId),
    flyingTransformId: parseAiChartD1Id(record.flyingTransformId),
    status: parseAiChartD1Enum(record.status, AI_CHART_D1_RESULT_STATUSES),
    sourceSummary: parseAiChartD1Text(record.sourceSummary),
    destinationSummary: parseAiChartD1Text(record.destinationSummary),
    transformationCore: parseAiChartD1Text(record.transformationCore),
    candidates,
    coverageMatrix: matrix,
    mergedCandidateGroups: groups,
    d2Boundaries: boundaries,
    warnings: parseAiChartD1StringArray(record.warnings),
  })
}

export function parseAiChartD1P1Result(value: unknown): AiChartD1P1Result {
  let parsed: ParsedP1Result
  try {
    parsed = parseP1(value)
  } catch {
    invalid()
  }
  if (parsed.duplicateField !== null) {
    throw new AiChartD1P1CoverageDuplicateError(parsed.duplicateField)
  }
  return parsed.value
}

export function parseAiChartD1F1Result(value: unknown): AiChartD1F1Result {
  try {
    return parseF1(value)
  } catch {
    invalid()
  }
}

const ID_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 128,
  pattern: AI_CHART_D1_ID_PATTERN.source,
})
const SHORT_TEXT_SCHEMA = createAiChartD1StringSchema({
  maximumLength: AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
})
const TEXT_SCHEMA = createAiChartD1StringSchema()
const STATUS_SCHEMA = createAiChartD1StringSchema({
  enumValues: AI_CHART_D1_RESULT_STATUSES,
})
const WARNING_ARRAY_SCHEMA = createAiChartD1ArraySchema(SHORT_TEXT_SCHEMA)
const BOUNDARY_ARRAY_SCHEMA = createAiChartD1ArraySchema(
  AI_CHART_D1_D2_BOUNDARY_SCHEMA,
)

const P1_PRIMARY_AXIS_SCHEMA = createAiChartD1StrictObjectSchema({
  statement: TEXT_SCHEMA,
  majorStarCore: createAiChartD1ArraySchema(SHORT_TEXT_SCHEMA),
  doubleStarCore: createAiChartD1StringSchema({
    maximumLength: AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
    nullable: true,
  }),
  borrowedStarMode: createAiChartD1StringSchema({
    enumValues: ['none', 'borrowed'],
  }),
  usedRuleIds: createAiChartD1ArraySchema(ID_SCHEMA),
})

const OMITTED_ITEM_SCHEMA = createAiChartD1StrictObjectSchema({
  item: SHORT_TEXT_SCHEMA,
  reason: TEXT_SCHEMA,
})

const P1_COVERAGE_SCHEMA = createAiChartD1StrictObjectSchema({
  directMeaningsConsidered: createAiChartD1ArraySchema(SHORT_TEXT_SCHEMA),
  majorStarsCovered: createAiChartD1ArraySchema(SHORT_TEXT_SCHEMA),
  minorStarsCovered: createAiChartD1ArraySchema(SHORT_TEXT_SCHEMA),
  mutagensCovered: createAiChartD1ArraySchema(SHORT_TEXT_SCHEMA),
  maleficsCovered: createAiChartD1ArraySchema(SHORT_TEXT_SCHEMA),
  noblesCovered: createAiChartD1ArraySchema(SHORT_TEXT_SCHEMA),
  oppositeProcessed: freezeAiChartD1Value({ type: 'boolean' }),
  hiddenCombinationProcessed: freezeAiChartD1Value({ type: 'boolean' }),
  trinesProcessed: freezeAiChartD1Value({ type: 'boolean' }),
  omittedItems: createAiChartD1ArraySchema(OMITTED_ITEM_SCHEMA),
})

const CANDIDATE_ARRAY_SCHEMA = createAiChartD1ArraySchema(
  AI_CHART_D1_CANDIDATE_SCHEMA,
  { maximumItems: AI_CHART_D1_MAX_CANDIDATES_PER_COLLECTION },
)

const P1_TENSION_SCHEMA = createAiChartD1StrictObjectSchema({
  ...(AI_CHART_D1_TRAIT_TENSION_SCHEMA.properties as Record<
    string,
    unknown
  >),
  candidateIds: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 2,
  }),
})

export const AI_CHART_D1_P1_OUTPUT_SCHEMA =
  createAiChartD1StrictObjectSchema({
    contractVersion: createAiChartD1StringSchema({
      enumValues: [AI_CHART_D1_P1_F1_CONTRACT_VERSION],
    }),
    task: createAiChartD1StringSchema({ enumValues: ['P1'] }),
    callId: ID_SCHEMA,
    chartId: ID_SCHEMA,
    palaceId: ID_SCHEMA,
    palace: createAiChartD1StringSchema({
      enumValues: AI_CHART_D1_PALACE_NAMES,
    }),
    status: STATUS_SCHEMA,
    primaryAxis: P1_PRIMARY_AXIS_SCHEMA,
    directCandidates: CANDIDATE_ARRAY_SCHEMA,
    oppositeInfluences: CANDIDATE_ARRAY_SCHEMA,
    hiddenCombinationInfluences: CANDIDATE_ARRAY_SCHEMA,
    trineInfluences: CANDIDATE_ARRAY_SCHEMA,
    combinedCandidates: CANDIDATE_ARRAY_SCHEMA,
    tensions: createAiChartD1ArraySchema(P1_TENSION_SCHEMA),
    strengths: CANDIDATE_ARRAY_SCHEMA,
    imbalancePossibilities: CANDIDATE_ARRAY_SCHEMA,
    coverage: P1_COVERAGE_SCHEMA,
    d2Boundaries: BOUNDARY_ARRAY_SCHEMA,
    warnings: WARNING_ARRAY_SCHEMA,
  })

const F1_CANDIDATE_PROPERTIES = {
  ...(AI_CHART_D1_CANDIDATE_SCHEMA.properties as Record<string, unknown>),
  sourceMeaningId: ID_SCHEMA,
  destinationMeaningId: ID_SCHEMA,
  bridgeMechanism: TEXT_SCHEMA,
  sourceBehavior: TEXT_SCHEMA,
  destinationEffect: TEXT_SCHEMA,
}
const F1_CANDIDATE_SCHEMA =
  createAiChartD1StrictObjectSchema(F1_CANDIDATE_PROPERTIES)

const F1_MATRIX_SCHEMA = createAiChartD1StrictObjectSchema({
  sourceMeaningId: ID_SCHEMA,
  destinationMeaningId: ID_SCHEMA,
  status: createAiChartD1StringSchema({
    enumValues: AI_CHART_D1_F1_COVERAGE_STATUSES,
  }),
  candidateId: createAiChartD1StringSchema({
    maximumLength: 128,
    pattern: AI_CHART_D1_ID_PATTERN.source,
    nullable: true,
  }),
  mergedIntoCandidateId: createAiChartD1StringSchema({
    maximumLength: 128,
    pattern: AI_CHART_D1_ID_PATTERN.source,
    nullable: true,
  }),
  exclusionReason: createAiChartD1StringSchema({
    maximumLength: AI_CHART_D1_MAX_SHORT_TEXT_LENGTH,
    nullable: true,
  }),
})

const F1_MERGED_GROUP_SCHEMA = createAiChartD1StrictObjectSchema({
  retainedCandidateId: ID_SCHEMA,
  mergedCandidateIds: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 1,
  }),
  reason: TEXT_SCHEMA,
})

export const AI_CHART_D1_F1_OUTPUT_SCHEMA =
  createAiChartD1StrictObjectSchema({
    contractVersion: createAiChartD1StringSchema({
      enumValues: [AI_CHART_D1_P1_F1_CONTRACT_VERSION],
    }),
    task: createAiChartD1StringSchema({ enumValues: ['F1'] }),
    callId: ID_SCHEMA,
    chartId: ID_SCHEMA,
    flyingTransformId: ID_SCHEMA,
    status: STATUS_SCHEMA,
    sourceSummary: TEXT_SCHEMA,
    destinationSummary: TEXT_SCHEMA,
    transformationCore: TEXT_SCHEMA,
    candidates: createAiChartD1ArraySchema(F1_CANDIDATE_SCHEMA, {
      maximumItems: AI_CHART_D1_MAX_CANDIDATES_PER_COLLECTION,
    }),
    coverageMatrix: createAiChartD1ArraySchema(F1_MATRIX_SCHEMA),
    mergedCandidateGroups: createAiChartD1ArraySchema(
      F1_MERGED_GROUP_SCHEMA,
    ),
    d2Boundaries: BOUNDARY_ARRAY_SCHEMA,
    warnings: WARNING_ARRAY_SCHEMA,
  }) satisfies AiChartD1JsonSchema
