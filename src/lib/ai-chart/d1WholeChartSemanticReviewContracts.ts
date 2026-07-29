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
  AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION,
  parseAiChartD1WholeChartRelationResult,
  validateAiChartD1WholeChartRelationResultAgainstSources,
  type AiChartD1WholeChartRelation,
  type AiChartD1WholeChartRelationResult,
} from './d1WholeChartRelationContracts'

export const AI_CHART_D1_WHOLE_CHART_SEMANTIC_REVIEW_VERSION =
  'ai-chart-d1-whole-chart-semantic-review/v1' as const
export const AI_CHART_D1_WHOLE_CHART_SEMANTIC_REVIEW_SCHEMA_NAME =
  'ai_chart_d1_whole_chart_semantic_review_v1' as const
export const AI_CHART_D1_WHOLE_CHART_SEMANTIC_REVIEW_INVALID =
  'ai_chart_d1_whole_chart_semantic_review_invalid' as const

export const AI_CHART_D1_WHOLE_CHART_SEMANTIC_REVIEW_DECISIONS =
  Object.freeze(['APPROVED', 'REPAIR_REQUIRED'] as const)
export const AI_CHART_D1_WHOLE_CHART_SEMANTIC_REPAIR_SCOPES =
  Object.freeze(['NONE', 'RELATION_ONLY'] as const)
export const AI_CHART_D1_WHOLE_CHART_SEMANTIC_ISSUE_CODES =
  Object.freeze([
    'RELATION_KIND_MISMATCH',
    'OVERALL_DIRECTION_UNSUPPORTED',
    'REPEATED_PATTERN_NOT_EQUIVALENT',
    'INNER_TENSION_NOT_GENUINE',
    'DEEP_FEELING_OVERSTATED',
    'SOURCE_CONTEXT_MISREAD',
    'SOURCE_MECHANISMS_CONFLATED',
    'CONTRADICTION_DROPPED',
    'POSSIBLE_EXPRESSION_UNSUPPORTED',
    'D1_BOUNDARY_EXCEEDED',
  ] as const)
export const AI_CHART_D1_WHOLE_CHART_SEMANTIC_REVIEW_REASONS =
  Object.freeze([
    'RESULT_SHAPE_INVALID',
    'IDENTITY_OR_SOURCE_MISMATCH',
    'RELATION_REVIEW_COVERAGE_MISMATCH',
    'DECISION_OR_REPAIR_SCOPE_MISMATCH',
    'ISSUE_CODE_RELATION_KIND_MISMATCH',
    'COVERAGE_MISMATCH',
  ] as const)

export type AiChartD1WholeChartSemanticReviewDecision =
  (typeof AI_CHART_D1_WHOLE_CHART_SEMANTIC_REVIEW_DECISIONS)[number]
export type AiChartD1WholeChartSemanticRepairScope =
  (typeof AI_CHART_D1_WHOLE_CHART_SEMANTIC_REPAIR_SCOPES)[number]
export type AiChartD1WholeChartSemanticIssueCode =
  (typeof AI_CHART_D1_WHOLE_CHART_SEMANTIC_ISSUE_CODES)[number]
export type AiChartD1WholeChartSemanticReviewReason =
  (typeof AI_CHART_D1_WHOLE_CHART_SEMANTIC_REVIEW_REASONS)[number]

export type AiChartD1WholeChartRelationSemanticReview =
  Readonly<{
    relationRef: string
    decision: AiChartD1WholeChartSemanticReviewDecision
    issueCodes: readonly AiChartD1WholeChartSemanticIssueCode[]
    repairScope: AiChartD1WholeChartSemanticRepairScope
  }>

export type AiChartD1WholeChartSemanticReviewCoverage =
  Readonly<{
    relationRefs: readonly string[]
    approvedRelationRefs: readonly string[]
    repairRelationRefs: readonly string[]
    issueCodes: readonly AiChartD1WholeChartSemanticIssueCode[]
  }>

export type AiChartD1WholeChartSemanticReview = Readonly<{
  contractVersion:
    typeof AI_CHART_D1_WHOLE_CHART_SEMANTIC_REVIEW_VERSION
  semanticReviewId: string
  chartId: string
  runId: string
  sourceWholeChartResultVersion:
    typeof AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION
  sourceWholeChartResultRef: string
  relationReviews:
    readonly AiChartD1WholeChartRelationSemanticReview[]
  coverage: AiChartD1WholeChartSemanticReviewCoverage
  semanticReviewStatus: 'approved' | 'repair_required'
  contentGridHandoffStatus: 'ready' | 'blocked'
  customerWritingStatus: 'blocked'
}>

export class AiChartD1WholeChartSemanticReviewError extends Error {
  readonly code = AI_CHART_D1_WHOLE_CHART_SEMANTIC_REVIEW_INVALID
  declare readonly reasonCode: AiChartD1WholeChartSemanticReviewReason

  constructor(reasonCode: AiChartD1WholeChartSemanticReviewReason) {
    super(AI_CHART_D1_WHOLE_CHART_SEMANTIC_REVIEW_INVALID)
    this.name = 'AiChartD1WholeChartSemanticReviewError'
    Object.defineProperty(this, 'reasonCode', {
      value: reasonCode,
      enumerable: true,
      writable: false,
      configurable: false,
    })
    Object.freeze(this)
  }
}

const RELATION_REVIEW_FIELDS = Object.freeze([
  'relationRef',
  'decision',
  'issueCodes',
  'repairScope',
] as const)
const COVERAGE_FIELDS = Object.freeze([
  'relationRefs',
  'approvedRelationRefs',
  'repairRelationRefs',
  'issueCodes',
] as const)
const REVIEW_FIELDS = Object.freeze([
  'contractVersion',
  'semanticReviewId',
  'chartId',
  'runId',
  'sourceWholeChartResultVersion',
  'sourceWholeChartResultRef',
  'relationReviews',
  'coverage',
  'semanticReviewStatus',
  'contentGridHandoffStatus',
  'customerWritingStatus',
] as const)

function invalid(
  reasonCode: AiChartD1WholeChartSemanticReviewReason,
): never {
  throw new AiChartD1WholeChartSemanticReviewError(reasonCode)
}

function collectUnique<T extends string>(
  values: readonly T[],
): readonly T[] {
  return Object.freeze([...new Set(values)])
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
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

function parseIssueCodes(
  value: unknown,
  minimumItems: number,
): readonly AiChartD1WholeChartSemanticIssueCode[] {
  return parseAiChartD1StringArray(value, {
    minimumItems,
    maximumItems:
      AI_CHART_D1_WHOLE_CHART_SEMANTIC_ISSUE_CODES.length,
    parseItem: (item) =>
      parseAiChartD1Enum(
        item,
        AI_CHART_D1_WHOLE_CHART_SEMANTIC_ISSUE_CODES,
      ),
  }) as readonly AiChartD1WholeChartSemanticIssueCode[]
}

function parseRelationReview(
  value: unknown,
): AiChartD1WholeChartRelationSemanticReview {
  const record = requireAiChartD1ExactObject(
    value,
    RELATION_REVIEW_FIELDS,
  )
  const decision = parseAiChartD1Enum(
    record.decision,
    AI_CHART_D1_WHOLE_CHART_SEMANTIC_REVIEW_DECISIONS,
  )
  const repairScope = parseAiChartD1Enum(
    record.repairScope,
    AI_CHART_D1_WHOLE_CHART_SEMANTIC_REPAIR_SCOPES,
  )
  const issueCodes = parseIssueCodes(
    record.issueCodes,
    decision === 'APPROVED' ? 0 : 1,
  )
  if (
    (decision === 'APPROVED' &&
      (issueCodes.length !== 0 || repairScope !== 'NONE')) ||
    (decision === 'REPAIR_REQUIRED' &&
      (issueCodes.length === 0 ||
        repairScope !== 'RELATION_ONLY'))
  ) {
    invalid('DECISION_OR_REPAIR_SCOPE_MISMATCH')
  }
  return freezeAiChartD1Value({
    relationRef: parseAiChartD1Id(record.relationRef),
    decision,
    issueCodes,
    repairScope,
  })
}

function expectedCoverage(
  relationReviews:
    readonly AiChartD1WholeChartRelationSemanticReview[],
): AiChartD1WholeChartSemanticReviewCoverage {
  return freezeAiChartD1Value({
    relationRefs: relationReviews.map(
      (review) => review.relationRef,
    ),
    approvedRelationRefs: relationReviews
      .filter((review) => review.decision === 'APPROVED')
      .map((review) => review.relationRef),
    repairRelationRefs: relationReviews
      .filter((review) => review.decision === 'REPAIR_REQUIRED')
      .map((review) => review.relationRef),
    issueCodes: collectUnique(
      relationReviews.flatMap((review) => review.issueCodes),
    ),
  })
}

function parseCoverage(
  value: unknown,
): AiChartD1WholeChartSemanticReviewCoverage {
  const record = requireAiChartD1ExactObject(value, COVERAGE_FIELDS)
  return freezeAiChartD1Value({
    relationRefs: parseIdArray(record.relationRefs, 1),
    approvedRelationRefs: parseIdArray(
      record.approvedRelationRefs,
    ),
    repairRelationRefs: parseIdArray(record.repairRelationRefs),
    issueCodes: parseIssueCodes(record.issueCodes, 0),
  })
}

export function parseAiChartD1WholeChartSemanticReview(
  value: unknown,
): AiChartD1WholeChartSemanticReview {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(
      value,
      REVIEW_FIELDS,
    )
    if (
      record.contractVersion !==
        AI_CHART_D1_WHOLE_CHART_SEMANTIC_REVIEW_VERSION ||
      record.sourceWholeChartResultVersion !==
        AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION ||
      record.customerWritingStatus !== 'blocked' ||
      !Array.isArray(record.relationReviews) ||
      record.relationReviews.length < 1 ||
      record.relationReviews.length > AI_CHART_D1_MAX_LIST_ITEMS
    ) {
      invalid('RESULT_SHAPE_INVALID')
    }
    const relationReviews = Object.freeze(
      record.relationReviews.map(parseRelationReview),
    )
    if (
      new Set(
        relationReviews.map((review) => review.relationRef),
      ).size !== relationReviews.length
    ) {
      invalid('RELATION_REVIEW_COVERAGE_MISMATCH')
    }
    const hasRepair = relationReviews.some(
      (review) => review.decision === 'REPAIR_REQUIRED',
    )
    const expectedSemanticStatus = hasRepair
      ? 'repair_required'
      : 'approved'
    const expectedHandoffStatus = hasRepair ? 'blocked' : 'ready'
    if (
      record.semanticReviewStatus !== expectedSemanticStatus ||
      record.contentGridHandoffStatus !== expectedHandoffStatus
    ) {
      invalid('DECISION_OR_REPAIR_SCOPE_MISMATCH')
    }
    const coverage = parseCoverage(record.coverage)
    if (!sameJson(coverage, expectedCoverage(relationReviews))) {
      invalid('COVERAGE_MISMATCH')
    }
    return freezeAiChartD1Value({
      contractVersion:
        AI_CHART_D1_WHOLE_CHART_SEMANTIC_REVIEW_VERSION,
      semanticReviewId: parseAiChartD1Id(record.semanticReviewId),
      chartId: parseAiChartD1Id(record.chartId),
      runId: parseAiChartD1Id(record.runId),
      sourceWholeChartResultVersion:
        AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION,
      sourceWholeChartResultRef: parseAiChartD1Id(
        record.sourceWholeChartResultRef,
      ),
      relationReviews,
      coverage,
      semanticReviewStatus: expectedSemanticStatus,
      contentGridHandoffStatus: expectedHandoffStatus,
      customerWritingStatus: 'blocked' as const,
    })
  } catch (error) {
    if (error instanceof AiChartD1WholeChartSemanticReviewError) {
      throw error
    }
    invalid('RESULT_SHAPE_INVALID')
  }
}

const RELATION_SPECIFIC_ISSUE = freezeAiChartD1Value({
  OVERALL_DIRECTION: 'OVERALL_DIRECTION_UNSUPPORTED',
  REPEATED_PATTERN: 'REPEATED_PATTERN_NOT_EQUIVALENT',
  INNER_TENSION: 'INNER_TENSION_NOT_GENUINE',
  DEEP_FEELING_THEME: 'DEEP_FEELING_OVERSTATED',
} as const)

function validateIssueKinds(
  review: AiChartD1WholeChartRelationSemanticReview,
  relation: AiChartD1WholeChartRelation,
): void {
  const allowedSpecificIssue =
    RELATION_SPECIFIC_ISSUE[relation.relationKind]
  const specificIssues = new Set(
    Object.values(RELATION_SPECIFIC_ISSUE),
  )
  if (
    review.issueCodes.some(
      (issueCode) =>
        specificIssues.has(
          issueCode as (typeof RELATION_SPECIFIC_ISSUE)[keyof typeof RELATION_SPECIFIC_ISSUE],
        ) && issueCode !== allowedSpecificIssue,
    )
  ) {
    invalid('ISSUE_CODE_RELATION_KIND_MISMATCH')
  }
}

function validateRelationReviewCoverage(
  review: AiChartD1WholeChartSemanticReview,
  relationResult: AiChartD1WholeChartRelationResult,
): void {
  const relationRefs = relationResult.relations.map(
    (relation) => relation.relationId,
  )
  if (
    !sameJson(
      review.relationReviews.map(
        (relationReview) => relationReview.relationRef,
      ),
      relationRefs,
    )
  ) {
    invalid('RELATION_REVIEW_COVERAGE_MISMATCH')
  }
  for (let index = 0; index < relationRefs.length; index += 1) {
    validateIssueKinds(
      review.relationReviews[index],
      relationResult.relations[index],
    )
  }
}

export function validateAiChartD1WholeChartSemanticReviewAgainstSources(
  reviewValue: unknown,
  relationResultValue: unknown,
  writingSourceSetValue: unknown,
  palaceResultValues: unknown,
  flyingIntegrationValue: unknown,
  n0Value: unknown,
): AiChartD1WholeChartSemanticReview {
  const review = parseAiChartD1WholeChartSemanticReview(reviewValue)
  let relationResult: AiChartD1WholeChartRelationResult
  try {
    const parsedRelationResult =
      parseAiChartD1WholeChartRelationResult(relationResultValue)
    relationResult =
      validateAiChartD1WholeChartRelationResultAgainstSources(
        parsedRelationResult,
        writingSourceSetValue,
        palaceResultValues,
        flyingIntegrationValue,
        n0Value,
      )
  } catch {
    invalid('IDENTITY_OR_SOURCE_MISMATCH')
  }
  if (
    review.chartId !== relationResult.chartId ||
    review.runId !== relationResult.runId ||
    review.sourceWholeChartResultVersion !==
      relationResult.contractVersion ||
    review.sourceWholeChartResultRef !==
      relationResult.wholeChartResultId
  ) {
    invalid('IDENTITY_OR_SOURCE_MISMATCH')
  }
  validateRelationReviewCoverage(review, relationResult)
  return review
}

const ID_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 128,
  pattern: AI_CHART_D1_ID_PATTERN.source,
})
const DECISION_SCHEMA = createAiChartD1StringSchema({
  enumValues: AI_CHART_D1_WHOLE_CHART_SEMANTIC_REVIEW_DECISIONS,
})
const REPAIR_SCOPE_SCHEMA = createAiChartD1StringSchema({
  enumValues: AI_CHART_D1_WHOLE_CHART_SEMANTIC_REPAIR_SCOPES,
})
const ISSUE_CODE_SCHEMA = createAiChartD1StringSchema({
  enumValues: AI_CHART_D1_WHOLE_CHART_SEMANTIC_ISSUE_CODES,
})
const RELATION_REVIEW_SCHEMA = createAiChartD1StrictObjectSchema({
  relationRef: ID_SCHEMA,
  decision: DECISION_SCHEMA,
  issueCodes: createAiChartD1ArraySchema(ISSUE_CODE_SCHEMA, {
    minimumItems: 0,
    maximumItems:
      AI_CHART_D1_WHOLE_CHART_SEMANTIC_ISSUE_CODES.length,
  }),
  repairScope: REPAIR_SCOPE_SCHEMA,
})
const COVERAGE_SCHEMA = createAiChartD1StrictObjectSchema({
  relationRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 1,
    maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
  }),
  approvedRelationRefs: createAiChartD1ArraySchema(ID_SCHEMA),
  repairRelationRefs: createAiChartD1ArraySchema(ID_SCHEMA),
  issueCodes: createAiChartD1ArraySchema(ISSUE_CODE_SCHEMA, {
    maximumItems:
      AI_CHART_D1_WHOLE_CHART_SEMANTIC_ISSUE_CODES.length,
  }),
})

export const AI_CHART_D1_WHOLE_CHART_SEMANTIC_REVIEW_JSON_SCHEMA:
  AiChartD1JsonSchema = createAiChartD1StrictObjectSchema({
    contractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_WHOLE_CHART_SEMANTIC_REVIEW_VERSION,
    }),
    semanticReviewId: ID_SCHEMA,
    chartId: ID_SCHEMA,
    runId: ID_SCHEMA,
    sourceWholeChartResultVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION,
    }),
    sourceWholeChartResultRef: ID_SCHEMA,
    relationReviews: createAiChartD1ArraySchema(
      RELATION_REVIEW_SCHEMA,
      {
        minimumItems: 1,
        maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
      },
    ),
    coverage: COVERAGE_SCHEMA,
    semanticReviewStatus: createAiChartD1StringSchema({
      enumValues: ['approved', 'repair_required'],
    }),
    contentGridHandoffStatus: createAiChartD1StringSchema({
      enumValues: ['ready', 'blocked'],
    }),
    customerWritingStatus: freezeAiChartD1Value({
      const: 'blocked',
    }),
  })
