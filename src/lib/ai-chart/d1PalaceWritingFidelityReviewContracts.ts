import {
  AI_CHART_D1_ID_PATTERN,
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
import {
  createAiChartD1PalaceWritingResultSha256,
  AI_CHART_D1_PALACE_WRITING_MAX_SECTIONS,
  AI_CHART_D1_PALACE_WRITING_RESULT_VERSION,
  validateAiChartD1PalaceWritingResultAgainstPromptPackage,
  type AiChartD1PalaceWritingResult,
} from './d1PalaceWritingResultContracts'

export const AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_VERSION =
  'ai-chart-d1-palace-writing-fidelity-review/v1' as const
export const AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_TASK =
  'D1_PALACE_WRITING_FIDELITY_REVIEW' as const
export const AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_SCHEMA_NAME =
  'ai_chart_d1_palace_writing_fidelity_review_v1' as const
export const AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_INVALID =
  'ai_chart_d1_palace_writing_fidelity_review_invalid' as const

export const AI_CHART_D1_PALACE_WRITING_FIDELITY_DECISIONS =
  Object.freeze(['APPROVED', 'REPAIR_REQUIRED'] as const)
export const AI_CHART_D1_PALACE_WRITING_FIDELITY_REPAIR_SCOPES =
  Object.freeze(['NONE', 'CONTENT_CELL_ONLY'] as const)
export const AI_CHART_D1_PALACE_WRITING_FIDELITY_ISSUE_CODES =
  Object.freeze([
    'SOURCE_MEANING_DISTORTED',
    'UNSUPPORTED_DIVINATION_ADDED',
    'ACTOR_CHANGED',
    'FACET_CHANGED',
    'MECHANISM_CHANGED',
    'POSSIBILITY_BECAME_CERTAINTY',
    'CONTRADICTION_DROPPED',
    'UNSUPPORTED_LIFE_EXAMPLE',
    'SENSITIVE_OR_HARMFUL_CLAIM',
    'SOCIAL_STEREOTYPE_ADDED',
    'INTERNAL_METADATA_EXPOSED',
    'REPORT_LANGUAGE_MISMATCH',
    'LIFE_REGION_CONTEXT_MISMATCH',
  ] as const)
export const AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_REASONS =
  Object.freeze([
    'RESULT_SHAPE_INVALID',
    'IDENTITY_OR_SOURCE_MISMATCH',
    'SECTION_REVIEW_COVERAGE_MISMATCH',
    'DECISION_OR_REPAIR_SCOPE_MISMATCH',
    'STATUS_MISMATCH',
  ] as const)

export type AiChartD1PalaceWritingFidelityDecision =
  (typeof AI_CHART_D1_PALACE_WRITING_FIDELITY_DECISIONS)[number]
export type AiChartD1PalaceWritingFidelityRepairScope =
  (typeof AI_CHART_D1_PALACE_WRITING_FIDELITY_REPAIR_SCOPES)[number]
export type AiChartD1PalaceWritingFidelityIssueCode =
  (typeof AI_CHART_D1_PALACE_WRITING_FIDELITY_ISSUE_CODES)[number]
export type AiChartD1PalaceWritingFidelityReviewReason =
  (typeof AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_REASONS)[number]

export type AiChartD1PalaceWritingSectionReview = Readonly<{
  contentCellRef: string
  decision: AiChartD1PalaceWritingFidelityDecision
  issueCodes: readonly AiChartD1PalaceWritingFidelityIssueCode[]
  repairScope: AiChartD1PalaceWritingFidelityRepairScope
}>

export type AiChartD1PalaceWritingFidelityReview = Readonly<{
  contractVersion:
    typeof AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_VERSION
  task: typeof AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_TASK
  fidelityReviewId: string
  chartId: string
  runId: string
  callId: string
  targetPalaceId: AiChartD1PalaceId
  sourcePackageFingerprint: string
  sourceWritingResultVersion:
    typeof AI_CHART_D1_PALACE_WRITING_RESULT_VERSION
  sourceWritingResultSha256: string
  sectionReviews: readonly AiChartD1PalaceWritingSectionReview[]
  fidelityReviewStatus: 'approved' | 'repair_required'
  customerDeliveryStatus: 'ready' | 'blocked'
  rewriteStatus: 'forbidden'
}>

export class AiChartD1PalaceWritingFidelityReviewError extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_INVALID
  declare readonly reasonCode: AiChartD1PalaceWritingFidelityReviewReason

  constructor(reasonCode: AiChartD1PalaceWritingFidelityReviewReason) {
    super(AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_INVALID)
    this.name = 'AiChartD1PalaceWritingFidelityReviewError'
    Object.defineProperty(this, 'reasonCode', {
      value: reasonCode,
      enumerable: true,
      writable: false,
      configurable: false,
    })
    Object.freeze(this)
  }
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const PALACE_IDS = AI_CHART_D1_PALACE_IDENTITIES.map(
  (identity) => identity.palaceId,
)
const SECTION_REVIEW_FIELDS = Object.freeze([
  'contentCellRef',
  'decision',
  'issueCodes',
  'repairScope',
] as const)
const REVIEW_FIELDS = Object.freeze([
  'contractVersion',
  'task',
  'fidelityReviewId',
  'chartId',
  'runId',
  'callId',
  'targetPalaceId',
  'sourcePackageFingerprint',
  'sourceWritingResultVersion',
  'sourceWritingResultSha256',
  'sectionReviews',
  'fidelityReviewStatus',
  'customerDeliveryStatus',
  'rewriteStatus',
] as const)

function invalid(
  reasonCode: AiChartD1PalaceWritingFidelityReviewReason,
): never {
  throw new AiChartD1PalaceWritingFidelityReviewError(reasonCode)
}

function parseSha(value: unknown): string {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    invalid('RESULT_SHAPE_INVALID')
  }
  return value
}

function parsePalaceId(value: unknown): AiChartD1PalaceId {
  try {
    return parseAiChartD1Enum(value, PALACE_IDS)
  } catch {
    invalid('RESULT_SHAPE_INVALID')
  }
}

function parseIssueCodes(
  value: unknown,
): readonly AiChartD1PalaceWritingFidelityIssueCode[] {
  const issueCodes = parseAiChartD1StringArray(value, {
    minimumItems: 0,
    maximumItems:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_ISSUE_CODES.length,
    parseItem: (item) =>
      parseAiChartD1Enum(
        item,
        AI_CHART_D1_PALACE_WRITING_FIDELITY_ISSUE_CODES,
      ),
  }) as readonly AiChartD1PalaceWritingFidelityIssueCode[]
  if (new Set(issueCodes).size !== issueCodes.length) {
    invalid('DECISION_OR_REPAIR_SCOPE_MISMATCH')
  }
  return issueCodes
}

function parseSectionReview(
  value: unknown,
): AiChartD1PalaceWritingSectionReview {
  const record = requireAiChartD1ExactObject(
    value,
    SECTION_REVIEW_FIELDS,
  )
  const decision = parseAiChartD1Enum(
    record.decision,
    AI_CHART_D1_PALACE_WRITING_FIDELITY_DECISIONS,
  )
  const repairScope = parseAiChartD1Enum(
    record.repairScope,
    AI_CHART_D1_PALACE_WRITING_FIDELITY_REPAIR_SCOPES,
  )
  const issueCodes = parseIssueCodes(record.issueCodes)
  if (
    (decision === 'APPROVED' &&
      (issueCodes.length !== 0 || repairScope !== 'NONE')) ||
    (decision === 'REPAIR_REQUIRED' &&
      (issueCodes.length === 0 ||
        repairScope !== 'CONTENT_CELL_ONLY'))
  ) {
    invalid('DECISION_OR_REPAIR_SCOPE_MISMATCH')
  }
  return freezeAiChartD1Value({
    contentCellRef: parseAiChartD1Id(record.contentCellRef),
    decision,
    issueCodes,
    repairScope,
  })
}

export function parseAiChartD1PalaceWritingFidelityReview(
  value: unknown,
): AiChartD1PalaceWritingFidelityReview {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(
      value,
      REVIEW_FIELDS,
    )
    if (
      record.contractVersion !==
        AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_VERSION ||
      record.task !==
        AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_TASK ||
      record.sourceWritingResultVersion !==
        AI_CHART_D1_PALACE_WRITING_RESULT_VERSION ||
      record.rewriteStatus !== 'forbidden' ||
      !Array.isArray(record.sectionReviews) ||
      record.sectionReviews.length < 1 ||
      record.sectionReviews.length >
        AI_CHART_D1_PALACE_WRITING_MAX_SECTIONS
    ) {
      invalid('RESULT_SHAPE_INVALID')
    }
    const sectionReviews = Object.freeze(
      record.sectionReviews.map(parseSectionReview),
    )
    if (
      new Set(
        sectionReviews.map((review) => review.contentCellRef),
      ).size !== sectionReviews.length
    ) {
      invalid('SECTION_REVIEW_COVERAGE_MISMATCH')
    }
    const hasRepair = sectionReviews.some(
      (review) => review.decision === 'REPAIR_REQUIRED',
    )
    const fidelityReviewStatus = hasRepair
      ? 'repair_required'
      : 'approved'
    const customerDeliveryStatus = hasRepair ? 'blocked' : 'ready'
    if (
      record.fidelityReviewStatus !== fidelityReviewStatus ||
      record.customerDeliveryStatus !== customerDeliveryStatus
    ) {
      invalid('STATUS_MISMATCH')
    }
    return freezeAiChartD1Value({
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_VERSION,
      task: AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_TASK,
      fidelityReviewId: parseAiChartD1Id(
        record.fidelityReviewId,
      ),
      chartId: parseAiChartD1Id(record.chartId),
      runId: parseAiChartD1Id(record.runId),
      callId: parseAiChartD1Id(record.callId),
      targetPalaceId: parsePalaceId(record.targetPalaceId),
      sourcePackageFingerprint: parseSha(
        record.sourcePackageFingerprint,
      ),
      sourceWritingResultVersion:
        AI_CHART_D1_PALACE_WRITING_RESULT_VERSION,
      sourceWritingResultSha256: parseSha(
        record.sourceWritingResultSha256,
      ),
      sectionReviews,
      fidelityReviewStatus,
      customerDeliveryStatus,
      rewriteStatus: 'forbidden' as const,
    })
  } catch (error) {
    if (
      error instanceof AiChartD1PalaceWritingFidelityReviewError
    ) {
      throw error
    }
    invalid('RESULT_SHAPE_INVALID')
  }
}

export function validateAiChartD1PalaceWritingFidelityReviewAgainstSources(
  reviewValue: unknown,
  writingResultValue: unknown,
  promptPackageValue: unknown,
): AiChartD1PalaceWritingFidelityReview {
  let writingResult: AiChartD1PalaceWritingResult
  try {
    writingResult =
      validateAiChartD1PalaceWritingResultAgainstPromptPackage(
        writingResultValue,
        promptPackageValue,
      )
  } catch {
    invalid('IDENTITY_OR_SOURCE_MISMATCH')
  }
  const review = parseAiChartD1PalaceWritingFidelityReview(
    reviewValue,
  )
  if (
    review.chartId !== writingResult.chartId ||
    review.runId !== writingResult.runId ||
    review.callId !== writingResult.callId ||
    review.targetPalaceId !== writingResult.targetPalaceId ||
    review.sourcePackageFingerprint !==
      writingResult.sourcePackageFingerprint ||
    review.sourceWritingResultVersion !==
      writingResult.contractVersion ||
    review.sourceWritingResultSha256 !==
      createAiChartD1PalaceWritingResultSha256(writingResult)
  ) {
    invalid('IDENTITY_OR_SOURCE_MISMATCH')
  }
  if (
    JSON.stringify(
      review.sectionReviews.map(
        (sectionReview) => sectionReview.contentCellRef,
      ),
    ) !==
    JSON.stringify(
      writingResult.sections.map(
        (section) => section.contentCellRef,
      ),
    )
  ) {
    invalid('SECTION_REVIEW_COVERAGE_MISMATCH')
  }
  return review
}

const ID_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 128,
  pattern: AI_CHART_D1_ID_PATTERN.source,
})
const SHA_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 64,
  pattern: SHA256_PATTERN.source,
})
const PALACE_ID_SCHEMA = createAiChartD1StringSchema({
  enumValues: PALACE_IDS,
})
const ISSUE_CODE_SCHEMA = createAiChartD1StringSchema({
  enumValues: AI_CHART_D1_PALACE_WRITING_FIDELITY_ISSUE_CODES,
})
const SECTION_REVIEW_SCHEMA = createAiChartD1StrictObjectSchema({
  contentCellRef: ID_SCHEMA,
  decision: createAiChartD1StringSchema({
    enumValues: AI_CHART_D1_PALACE_WRITING_FIDELITY_DECISIONS,
  }),
  issueCodes: createAiChartD1ArraySchema(ISSUE_CODE_SCHEMA, {
    minimumItems: 0,
    maximumItems:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_ISSUE_CODES.length,
  }),
  repairScope: createAiChartD1StringSchema({
    enumValues: AI_CHART_D1_PALACE_WRITING_FIDELITY_REPAIR_SCOPES,
  }),
})

export const AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_JSON_SCHEMA:
  AiChartD1JsonSchema = createAiChartD1StrictObjectSchema({
    contractVersion: freezeAiChartD1Value({
      const:
        AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_VERSION,
    }),
    task: freezeAiChartD1Value({
      const: AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_TASK,
    }),
    fidelityReviewId: ID_SCHEMA,
    chartId: ID_SCHEMA,
    runId: ID_SCHEMA,
    callId: ID_SCHEMA,
    targetPalaceId: PALACE_ID_SCHEMA,
    sourcePackageFingerprint: SHA_SCHEMA,
    sourceWritingResultVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_PALACE_WRITING_RESULT_VERSION,
    }),
    sourceWritingResultSha256: SHA_SCHEMA,
    sectionReviews: createAiChartD1ArraySchema(
      SECTION_REVIEW_SCHEMA,
      {
        minimumItems: 1,
        maximumItems:
          AI_CHART_D1_PALACE_WRITING_MAX_SECTIONS,
      },
    ),
    fidelityReviewStatus: createAiChartD1StringSchema({
      enumValues: ['approved', 'repair_required'],
    }),
    customerDeliveryStatus: createAiChartD1StringSchema({
      enumValues: ['ready', 'blocked'],
    }),
    rewriteStatus: freezeAiChartD1Value({
      const: 'forbidden',
    }),
  })
