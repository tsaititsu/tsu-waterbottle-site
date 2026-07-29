import { createHash } from 'node:crypto'
import {
  AI_CHART_D1_ID_PATTERN,
  assertAiChartD1SafeGraph,
  createAiChartD1ArraySchema,
  createAiChartD1StrictObjectSchema,
  createAiChartD1StringSchema,
  freezeAiChartD1Value,
  parseAiChartD1Enum,
  parseAiChartD1Id,
  parseAiChartD1Text,
  requireAiChartD1ExactObject,
  type AiChartD1JsonSchema,
} from './d1CommonContracts'
import {
  AI_CHART_D1_PALACE_IDENTITIES,
  type AiChartD1PalaceId,
} from './d1N0Constants'
import {
  AI_CHART_D1_PALACE_FACET_IDS,
  isAiChartD1PalaceFacetAllowed,
  type AiChartD1PalaceFacetId,
} from './d1PalaceFacetRegistry'
import {
  AI_CHART_D1_PALACE_WRITING_PROMPT_INPUT_VERSION,
  createAiChartD1PalaceWritingCanonicalJson,
  parseAiChartD1PalaceWritingPromptPackage,
  type AiChartD1PalaceWritingPromptPackage,
} from './d1PalaceWritingPromptPackageContracts'

export const AI_CHART_D1_PALACE_WRITING_RESULT_VERSION =
  'ai-chart-d1-palace-writing-result/v1' as const
export const AI_CHART_D1_PALACE_WRITING_RESULT_TASK =
  'D1_PALACE_WRITING' as const
export const AI_CHART_D1_PALACE_WRITING_RESULT_SCHEMA_NAME =
  'ai_chart_d1_palace_writing_result_v1' as const
export const AI_CHART_D1_PALACE_WRITING_RESULT_INVALID =
  'ai_chart_d1_palace_writing_result_invalid' as const

export const AI_CHART_D1_PALACE_WRITING_RESULT_REASONS =
  Object.freeze([
    'RESULT_SHAPE_INVALID',
    'IDENTITY_OR_SOURCE_MISMATCH',
    'CONTENT_CELL_COVERAGE_MISMATCH',
  ] as const)

export const AI_CHART_D1_PALACE_WRITING_MAX_SECTIONS = 304 as const
export const AI_CHART_D1_PALACE_WRITING_MAX_SECTION_TEXT_LENGTH =
  4_000 as const

export type AiChartD1PalaceWritingResultReason =
  (typeof AI_CHART_D1_PALACE_WRITING_RESULT_REASONS)[number]

export type AiChartD1PalaceWritingResultSection = Readonly<{
  contentCellRef: string
  facetId: AiChartD1PalaceFacetId
  customerText: string
}>

export type AiChartD1PalaceWritingResult = Readonly<{
  contractVersion: typeof AI_CHART_D1_PALACE_WRITING_RESULT_VERSION
  task: typeof AI_CHART_D1_PALACE_WRITING_RESULT_TASK
  writingResultId: string
  chartId: string
  runId: string
  callId: string
  targetPalaceId: AiChartD1PalaceId
  sourcePackageFingerprint: string
  sections: readonly AiChartD1PalaceWritingResultSection[]
  resultStatus: 'complete'
  fidelityReviewStatus: 'required'
  customerDeliveryStatus: 'blocked'
}>

export class AiChartD1PalaceWritingResultError extends Error {
  readonly code = AI_CHART_D1_PALACE_WRITING_RESULT_INVALID
  declare readonly reasonCode: AiChartD1PalaceWritingResultReason

  constructor(reasonCode: AiChartD1PalaceWritingResultReason) {
    super(AI_CHART_D1_PALACE_WRITING_RESULT_INVALID)
    this.name = 'AiChartD1PalaceWritingResultError'
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
const SECTION_FIELDS = Object.freeze([
  'contentCellRef',
  'facetId',
  'customerText',
] as const)
const RESULT_FIELDS = Object.freeze([
  'contractVersion',
  'task',
  'writingResultId',
  'chartId',
  'runId',
  'callId',
  'targetPalaceId',
  'sourcePackageFingerprint',
  'sections',
  'resultStatus',
  'fidelityReviewStatus',
  'customerDeliveryStatus',
] as const)

function invalid(reasonCode: AiChartD1PalaceWritingResultReason): never {
  throw new AiChartD1PalaceWritingResultError(reasonCode)
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
    if (error instanceof AiChartD1PalaceWritingResultError) {
      throw error
    }
    invalid('RESULT_SHAPE_INVALID')
  }
}

function parseSection(
  value: unknown,
  targetPalaceId: AiChartD1PalaceId,
): AiChartD1PalaceWritingResultSection {
  const record = requireAiChartD1ExactObject(value, SECTION_FIELDS)
  return freezeAiChartD1Value({
    contentCellRef: parseAiChartD1Id(record.contentCellRef),
    facetId: parseFacetId(record.facetId, targetPalaceId),
    customerText: parseAiChartD1Text(
      record.customerText,
      AI_CHART_D1_PALACE_WRITING_MAX_SECTION_TEXT_LENGTH,
    ),
  })
}

export function parseAiChartD1PalaceWritingResult(
  value: unknown,
): AiChartD1PalaceWritingResult {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(
      value,
      RESULT_FIELDS,
    )
    if (
      record.contractVersion !==
        AI_CHART_D1_PALACE_WRITING_RESULT_VERSION ||
      record.task !== AI_CHART_D1_PALACE_WRITING_RESULT_TASK ||
      record.resultStatus !== 'complete' ||
      record.fidelityReviewStatus !== 'required' ||
      record.customerDeliveryStatus !== 'blocked' ||
      !Array.isArray(record.sections) ||
      record.sections.length < 1 ||
      record.sections.length >
        AI_CHART_D1_PALACE_WRITING_MAX_SECTIONS
    ) {
      invalid('RESULT_SHAPE_INVALID')
    }
    const targetPalaceId = parsePalaceId(record.targetPalaceId)
    const sections = Object.freeze(
      record.sections.map((section) =>
        parseSection(section, targetPalaceId),
      ),
    )
    if (
      new Set(
        sections.map((section) => section.contentCellRef),
      ).size !== sections.length
    ) {
      invalid('CONTENT_CELL_COVERAGE_MISMATCH')
    }
    return freezeAiChartD1Value({
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_RESULT_VERSION,
      task: AI_CHART_D1_PALACE_WRITING_RESULT_TASK,
      writingResultId: parseAiChartD1Id(record.writingResultId),
      chartId: parseAiChartD1Id(record.chartId),
      runId: parseAiChartD1Id(record.runId),
      callId: parseAiChartD1Id(record.callId),
      targetPalaceId,
      sourcePackageFingerprint: parseSha(
        record.sourcePackageFingerprint,
      ),
      sections,
      resultStatus: 'complete' as const,
      fidelityReviewStatus: 'required' as const,
      customerDeliveryStatus: 'blocked' as const,
    })
  } catch (error) {
    if (error instanceof AiChartD1PalaceWritingResultError) {
      throw error
    }
    invalid('RESULT_SHAPE_INVALID')
  }
}

export function createAiChartD1PalaceWritingResultSha256(
  value: unknown,
): string {
  const parsed = parseAiChartD1PalaceWritingResult(value)
  return createHash('sha256')
    .update(
      createAiChartD1PalaceWritingCanonicalJson(parsed),
      'utf8',
    )
    .digest('hex')
}

type ExpectedSection = Readonly<{
  contentCellRef: string
  facetId: AiChartD1PalaceFacetId
}>

function parseExpectedSections(
  promptPackage: AiChartD1PalaceWritingPromptPackage,
): readonly ExpectedSection[] {
  try {
    const input = JSON.parse(promptPackage.userInput)
    const inputRecord = requireAiChartD1ExactObject(input, [
      'contractVersion',
      'chartId',
      'runId',
      'targetPalaceId',
      'reportContext',
      'contentGrid',
      'sourceMaterials',
      'relationContext',
      'writingPolicy',
    ])
    if (
      inputRecord.contractVersion !==
        AI_CHART_D1_PALACE_WRITING_PROMPT_INPUT_VERSION ||
      inputRecord.chartId !== promptPackage.chartId ||
      inputRecord.runId !== promptPackage.runId ||
      inputRecord.targetPalaceId !== promptPackage.targetPalaceId
    ) {
      invalid('IDENTITY_OR_SOURCE_MISMATCH')
    }
    const grid = requireAiChartD1ExactObject(
      inputRecord.contentGrid,
      ['targetPalaceId', 'facetSections'],
    )
    if (
      grid.targetPalaceId !== promptPackage.targetPalaceId ||
      !Array.isArray(grid.facetSections) ||
      grid.facetSections.length < 1
    ) {
      invalid('IDENTITY_OR_SOURCE_MISMATCH')
    }
    const expectedSections = grid.facetSections.flatMap(
      (sectionValue) => {
        const section = requireAiChartD1ExactObject(
          sectionValue,
          ['facetId', 'contentCells'],
        )
        const facetId = parseFacetId(
          section.facetId,
          promptPackage.targetPalaceId,
        )
        if (
          !Array.isArray(section.contentCells) ||
          section.contentCells.length < 1
        ) {
          invalid('IDENTITY_OR_SOURCE_MISMATCH')
        }
        return section.contentCells.map((cellValue) => {
          const cell = requireAiChartD1ExactObject(cellValue, [
            'contentCellId',
            'targetPalaceId',
            'facetId',
            'sourceCellRefs',
            'relationRefs',
            'writingStatus',
          ])
          if (
            cell.targetPalaceId !== promptPackage.targetPalaceId ||
            cell.facetId !== facetId ||
            cell.writingStatus !== 'required'
          ) {
            invalid('IDENTITY_OR_SOURCE_MISMATCH')
          }
          return freezeAiChartD1Value({
            contentCellRef: parseAiChartD1Id(
              cell.contentCellId,
            ),
            facetId,
          })
        })
      },
    )
    if (
      expectedSections.length < 1 ||
      expectedSections.length >
        AI_CHART_D1_PALACE_WRITING_MAX_SECTIONS ||
      JSON.stringify(
        expectedSections.map((section) => section.contentCellRef),
      ) !==
        JSON.stringify(promptPackage.sourceTrace.contentCellIds)
    ) {
      invalid('IDENTITY_OR_SOURCE_MISMATCH')
    }
    return Object.freeze(expectedSections)
  } catch (error) {
    if (error instanceof AiChartD1PalaceWritingResultError) {
      throw error
    }
    invalid('IDENTITY_OR_SOURCE_MISMATCH')
  }
}

export function validateAiChartD1PalaceWritingResultAgainstPromptPackage(
  resultValue: unknown,
  promptPackageValue: unknown,
): AiChartD1PalaceWritingResult {
  const result = parseAiChartD1PalaceWritingResult(resultValue)
  let promptPackage: AiChartD1PalaceWritingPromptPackage
  try {
    promptPackage = parseAiChartD1PalaceWritingPromptPackage(
      promptPackageValue,
    )
  } catch {
    invalid('IDENTITY_OR_SOURCE_MISMATCH')
  }
  if (
    result.chartId !== promptPackage.chartId ||
    result.runId !== promptPackage.runId ||
    result.callId !== promptPackage.callId ||
    result.targetPalaceId !== promptPackage.targetPalaceId ||
    result.sourcePackageFingerprint !==
      promptPackage.packageFingerprint
  ) {
    invalid('IDENTITY_OR_SOURCE_MISMATCH')
  }
  const expectedSections = parseExpectedSections(promptPackage)
  if (
    JSON.stringify(
      result.sections.map((section) => ({
        contentCellRef: section.contentCellRef,
        facetId: section.facetId,
      })),
    ) !== JSON.stringify(expectedSections)
  ) {
    invalid('CONTENT_CELL_COVERAGE_MISMATCH')
  }
  return result
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
const FACET_ID_SCHEMA = createAiChartD1StringSchema({
  enumValues: AI_CHART_D1_PALACE_FACET_IDS,
})
const SECTION_SCHEMA = createAiChartD1StrictObjectSchema({
  contentCellRef: ID_SCHEMA,
  facetId: FACET_ID_SCHEMA,
  customerText: createAiChartD1StringSchema({
    maximumLength:
      AI_CHART_D1_PALACE_WRITING_MAX_SECTION_TEXT_LENGTH,
  }),
})

export const AI_CHART_D1_PALACE_WRITING_RESULT_JSON_SCHEMA:
  AiChartD1JsonSchema = createAiChartD1StrictObjectSchema({
    contractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_PALACE_WRITING_RESULT_VERSION,
    }),
    task: freezeAiChartD1Value({
      const: AI_CHART_D1_PALACE_WRITING_RESULT_TASK,
    }),
    writingResultId: ID_SCHEMA,
    chartId: ID_SCHEMA,
    runId: ID_SCHEMA,
    callId: ID_SCHEMA,
    targetPalaceId: PALACE_ID_SCHEMA,
    sourcePackageFingerprint: SHA_SCHEMA,
    sections: createAiChartD1ArraySchema(SECTION_SCHEMA, {
      minimumItems: 1,
      maximumItems: AI_CHART_D1_PALACE_WRITING_MAX_SECTIONS,
    }),
    resultStatus: freezeAiChartD1Value({
      const: 'complete',
    }),
    fidelityReviewStatus: freezeAiChartD1Value({
      const: 'required',
    }),
    customerDeliveryStatus: freezeAiChartD1Value({
      const: 'blocked',
    }),
  })
