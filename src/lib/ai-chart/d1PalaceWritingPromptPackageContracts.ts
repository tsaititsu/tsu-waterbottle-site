import { createHash } from 'node:crypto'
import {
  AI_CHART_D1_ID_PATTERN,
  AI_CHART_D1_MAX_LIST_ITEMS,
  assertAiChartD1SafeGraph,
  createAiChartD1ArraySchema,
  createAiChartD1CanonicalJson,
  createAiChartD1StrictObjectSchema,
  createAiChartD1StringSchema,
  freezeAiChartD1Value,
  parseAiChartD1Boolean,
  parseAiChartD1Enum,
  parseAiChartD1Id,
  parseAiChartD1StringArray,
  parseAiChartD1Text,
  requireAiChartD1ExactObject,
  type AiChartD1JsonSchema,
} from './d1CommonContracts'
import {
  parseAiChartD1FlyingPalaceIntegration,
  type AiChartD1FlyingPalaceIntegration,
} from './d1FlyingPalaceIntegrationContracts'
import type { AiChartD1FlyingInfluenceResult } from './d1FlyingInfluenceContracts'
import {
  AI_CHART_D1_PALACE_IDENTITIES,
  type AiChartD1PalaceId,
} from './d1N0Constants'
import {
  parseAiChartD1PalaceAxisResult,
  type AiChartD1PalaceAxisClaim,
  type AiChartD1PalaceAxisResult,
} from './d1PalaceAxisContracts'
import {
  AI_CHART_D1_PALACE_CONTENT_GRID_VERSION,
  validateAiChartD1PalaceContentGridAgainstSources,
  type AiChartD1PalaceContentGrid,
  type AiChartD1PalaceContentGridEntry,
} from './d1PalaceContentGridContracts'
import {
  parseAiChartD1PalaceReasoningResult,
  type AiChartD1PalaceReasoningResult,
} from './d1PalaceIntegrationContracts'
import type { AiChartD1PalaceFacetId } from './d1PalaceFacetRegistry'
import {
  AI_CHART_D1_PALACE_WRITING_PROMPT_INSTRUCTIONS,
} from './d1PalaceWritingPromptInstructions'
import {
  AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION,
  parseAiChartD1PalaceWritingSourceSet,
  type AiChartD1PalaceWritingSourceCell,
  type AiChartD1PalaceWritingSourceKind,
  type AiChartD1PalaceWritingSourceSet,
} from './d1PalaceWritingSourceContracts'
import {
  parseAiChartD1StructuralInfluenceResult,
  type AiChartD1StructuralInfluence,
  type AiChartD1StructuralInfluenceResult,
} from './d1StructuralInfluenceContracts'
import {
  AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION,
  parseAiChartD1WholeChartRelationResult,
  type AiChartD1WholeChartRelation,
  type AiChartD1WholeChartRelationResult,
} from './d1WholeChartRelationContracts'

export const AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_VERSION =
  'ai-chart-d1-palace-writing-prompt-package/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_SET_VERSION =
  'ai-chart-d1-palace-writing-prompt-package-set/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PROMPT_INPUT_VERSION =
  'ai-chart-d1-palace-writing-prompt-input/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PROMPT_VERSION =
  'ai-chart-d1-palace-writing-prompt/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PROMPT_TASK =
  'D1_PALACE_WRITING_PROMPT_PACKAGE' as const
export const AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_SET_SCHEMA_NAME =
  'ai_chart_d1_palace_writing_prompt_package_set_v1' as const
export const AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_INVALID =
  'ai_chart_d1_palace_writing_prompt_package_invalid' as const

export const AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES =
  32_768 as const
export const AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_USER_INPUT_UTF8_BYTES =
  524_288 as const
export const AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_TOTAL_UTF8_BYTES =
  557_056 as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const REGION_PATTERN = /^[A-Z]{2}$/
const LANGUAGE_PATTERN =
  /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-(?:[A-Z]{2}|[0-9]{3}))?$/
const PALACE_IDS = AI_CHART_D1_PALACE_IDENTITIES.map(
  (identity) => identity.palaceId,
)
const MAX_CONTENT_CELLS = 1_536
const MAX_USER_INPUT_CHARACTERS =
  AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_USER_INPUT_UTF8_BYTES

export type AiChartD1PalaceWritingReportContext = Readonly<{
  primaryLifeRegion: string
  reportLanguage: string
}>

export type AiChartD1PalaceWritingSourceMaterialValue =
  | AiChartD1PalaceAxisClaim
  | AiChartD1StructuralInfluence
  | AiChartD1FlyingInfluenceResult

export type AiChartD1PalaceWritingSourceMaterial = Readonly<{
  contentCellId: string
  targetPalaceId: AiChartD1PalaceId
  facetId: AiChartD1PalaceFacetId
  sourceCellRef: string
  sourceKind: AiChartD1PalaceWritingSourceKind
  sourceRef: string
  material: AiChartD1PalaceWritingSourceMaterialValue
}>

export type AiChartD1PalaceWritingPromptUserInput = Readonly<{
  contractVersion:
    typeof AI_CHART_D1_PALACE_WRITING_PROMPT_INPUT_VERSION
  chartId: string
  runId: string
  targetPalaceId: AiChartD1PalaceId
  reportContext: AiChartD1PalaceWritingReportContext
  contentGrid: AiChartD1PalaceContentGridEntry
  sourceMaterials: readonly AiChartD1PalaceWritingSourceMaterial[]
  relationContext: readonly AiChartD1WholeChartRelation[]
  writingPolicy: typeof AI_CHART_D1_PALACE_WRITING_POLICY
}>

export const AI_CHART_D1_PALACE_WRITING_POLICY =
  freezeAiChartD1Value({
    onePalacePerPackage: true,
    contentCellOrder: 'CANONICAL_GRID_ORDER',
    sourceMaterialResolution: 'SERVER_BOUND',
    relationContext: 'APPROVED_REFS_ONLY',
    preserveContradictions: true,
    technicalChapters: 'FORBIDDEN',
    socialContextMayChangeSemantics: false,
    customerWriting: 'NOT_GENERATED',
  } as const)

export type AiChartD1PalaceWritingPromptSourceTrace = Readonly<{
  sourceSnapshotSha256: string
  contentGridSha256: string
  contentCellIds: readonly string[]
  sourceCellRefs: readonly string[]
  sourceRefs: readonly string[]
  relationRefs: readonly string[]
}>

export type AiChartD1PalaceWritingPromptBudget = Readonly<{
  measurement: 'utf8_bytes'
  instructionsUtf8Bytes: number
  userInputUtf8Bytes: number
  totalUtf8Bytes: number
  maxInstructionsUtf8Bytes:
    typeof AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES
  maxUserInputUtf8Bytes:
    typeof AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_USER_INPUT_UTF8_BYTES
  maxTotalUtf8Bytes:
    typeof AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_TOTAL_UTF8_BYTES
  status: 'within_budget'
}>

export type AiChartD1PalaceWritingPromptPackage = Readonly<{
  contractVersion:
    typeof AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_VERSION
  promptVersion: typeof AI_CHART_D1_PALACE_WRITING_PROMPT_VERSION
  task: typeof AI_CHART_D1_PALACE_WRITING_PROMPT_TASK
  chartId: string
  runId: string
  callId: string
  targetPalaceId: AiChartD1PalaceId
  sourceSnapshotSha256: string
  sourceContentGridVersion:
    typeof AI_CHART_D1_PALACE_CONTENT_GRID_VERSION
  sourceContentGridSha256: string
  sourceWritingSetVersion:
    typeof AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION
  sourceWholeChartResultVersion:
    typeof AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION
  primaryLifeRegion: string
  reportLanguage: string
  instructions:
    typeof AI_CHART_D1_PALACE_WRITING_PROMPT_INSTRUCTIONS
  instructionsSha256: string
  userInput: string
  userInputSha256: string
  sourceTrace: AiChartD1PalaceWritingPromptSourceTrace
  budget: AiChartD1PalaceWritingPromptBudget
  writingOutputContractStatus: 'available'
  promptStatus: 'prepared'
  adapterStatus: 'bridge_required'
  customerWritingStatus: 'not_generated'
  openAiCallable: false
  packageFingerprint: string
}>

export type AiChartD1PalaceWritingPromptCoverage = Readonly<{
  callIds: readonly string[]
  palaceIds: readonly AiChartD1PalaceId[]
  contentCellIds: readonly string[]
  sourceCellRefs: readonly string[]
  sourceRefs: readonly string[]
  relationRefs: readonly string[]
  packageFingerprints: readonly string[]
}>

export type AiChartD1PalaceWritingPromptPackageSet = Readonly<{
  contractVersion:
    typeof AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_SET_VERSION
  chartId: string
  runId: string
  sourceSnapshotSha256: string
  sourceContentGridVersion:
    typeof AI_CHART_D1_PALACE_CONTENT_GRID_VERSION
  sourceWritingSetVersion:
    typeof AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION
  sourceWholeChartResultVersion:
    typeof AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION
  packages: readonly AiChartD1PalaceWritingPromptPackage[]
  coverage: AiChartD1PalaceWritingPromptCoverage
  writingOutputContractStatus: 'available'
  customerWritingStatus: 'not_generated'
  openAiCallable: false
  validationStatus: 'validated'
}>

export type AiChartD1PalaceWritingPromptPackageSources =
  Readonly<{
    contentGrid: unknown
    sourceSet: unknown
    relationResult: unknown
    semanticReview: unknown
    palaceResults: unknown
    axisResults: unknown
    structuralResults: unknown
    flyingIntegration: unknown
    n0: unknown
    reportContext: unknown
  }>

type PackageWithoutFingerprint = Omit<
  AiChartD1PalaceWritingPromptPackage,
  'packageFingerprint'
>

export class AiChartD1PalaceWritingPromptPackageError extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_INVALID

  constructor() {
    super(AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_INVALID)
    this.name = 'AiChartD1PalaceWritingPromptPackageError'
    Object.freeze(this)
  }
}

const SOURCE_TRACE_FIELDS = Object.freeze([
  'sourceSnapshotSha256',
  'contentGridSha256',
  'contentCellIds',
  'sourceCellRefs',
  'sourceRefs',
  'relationRefs',
] as const)
const BUDGET_FIELDS = Object.freeze([
  'measurement',
  'instructionsUtf8Bytes',
  'userInputUtf8Bytes',
  'totalUtf8Bytes',
  'maxInstructionsUtf8Bytes',
  'maxUserInputUtf8Bytes',
  'maxTotalUtf8Bytes',
  'status',
] as const)
const PACKAGE_FIELDS = Object.freeze([
  'contractVersion',
  'promptVersion',
  'task',
  'chartId',
  'runId',
  'callId',
  'targetPalaceId',
  'sourceSnapshotSha256',
  'sourceContentGridVersion',
  'sourceContentGridSha256',
  'sourceWritingSetVersion',
  'sourceWholeChartResultVersion',
  'primaryLifeRegion',
  'reportLanguage',
  'instructions',
  'instructionsSha256',
  'userInput',
  'userInputSha256',
  'sourceTrace',
  'budget',
  'writingOutputContractStatus',
  'promptStatus',
  'adapterStatus',
  'customerWritingStatus',
  'openAiCallable',
  'packageFingerprint',
] as const)
const COVERAGE_FIELDS = Object.freeze([
  'callIds',
  'palaceIds',
  'contentCellIds',
  'sourceCellRefs',
  'sourceRefs',
  'relationRefs',
  'packageFingerprints',
] as const)
const SET_FIELDS = Object.freeze([
  'contractVersion',
  'chartId',
  'runId',
  'sourceSnapshotSha256',
  'sourceContentGridVersion',
  'sourceWritingSetVersion',
  'sourceWholeChartResultVersion',
  'packages',
  'coverage',
  'writingOutputContractStatus',
  'customerWritingStatus',
  'openAiCallable',
  'validationStatus',
] as const)

function invalid(): never {
  throw new AiChartD1PalaceWritingPromptPackageError()
}

export function createAiChartD1PalaceWritingCanonicalJson(
  value: unknown,
): string {
  try {
    return createAiChartD1CanonicalJson(value)
  } catch {
    invalid()
  }
}

function hash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export const AI_CHART_D1_PALACE_WRITING_PROMPT_INSTRUCTIONS_SHA256 =
  hash(AI_CHART_D1_PALACE_WRITING_PROMPT_INSTRUCTIONS)

function parseSha(value: unknown): string {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    invalid()
  }
  return value
}

function parseInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    invalid()
  }
  return value
}

function parsePalaceId(value: unknown): AiChartD1PalaceId {
  try {
    return parseAiChartD1Enum(value, PALACE_IDS)
  } catch {
    invalid()
  }
}

function parseRegion(value: unknown): string {
  const region = parseAiChartD1Text(value, 2)
  if (!REGION_PATTERN.test(region)) invalid()
  return region
}

function parseLanguage(value: unknown): string {
  const language = parseAiChartD1Text(value, 15)
  if (!LANGUAGE_PATTERN.test(language)) invalid()
  return language
}

function parseReportContext(
  value: unknown,
): AiChartD1PalaceWritingReportContext {
  try {
    const record = requireAiChartD1ExactObject(value, [
      'primaryLifeRegion',
      'reportLanguage',
    ])
    return freezeAiChartD1Value({
      primaryLifeRegion: parseRegion(record.primaryLifeRegion),
      reportLanguage: parseLanguage(record.reportLanguage),
    })
  } catch (error) {
    if (
      error instanceof AiChartD1PalaceWritingPromptPackageError
    ) {
      throw error
    }
    invalid()
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

function parseSourceTrace(
  value: unknown,
): AiChartD1PalaceWritingPromptSourceTrace {
  const record = requireAiChartD1ExactObject(
    value,
    SOURCE_TRACE_FIELDS,
  )
  return freezeAiChartD1Value({
    sourceSnapshotSha256: parseSha(
      record.sourceSnapshotSha256,
    ),
    contentGridSha256: parseSha(record.contentGridSha256),
    contentCellIds: parseIdArray(
      record.contentCellIds,
      1,
      MAX_CONTENT_CELLS,
    ),
    sourceCellRefs: parseIdArray(
      record.sourceCellRefs,
      1,
      MAX_CONTENT_CELLS,
    ),
    sourceRefs: parseIdArray(
      record.sourceRefs,
      1,
      MAX_CONTENT_CELLS,
    ),
    relationRefs: parseIdArray(
      record.relationRefs,
      0,
      AI_CHART_D1_MAX_LIST_ITEMS,
    ),
  })
}

function createBudget(
  instructions: string,
  userInput: string,
): AiChartD1PalaceWritingPromptBudget {
  const instructionsUtf8Bytes = Buffer.byteLength(
    instructions,
    'utf8',
  )
  const userInputUtf8Bytes = Buffer.byteLength(userInput, 'utf8')
  const totalUtf8Bytes =
    instructionsUtf8Bytes + userInputUtf8Bytes
  if (
    instructionsUtf8Bytes >
      AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES ||
    userInputUtf8Bytes >
      AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_USER_INPUT_UTF8_BYTES ||
    totalUtf8Bytes >
      AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_TOTAL_UTF8_BYTES
  ) {
    invalid()
  }
  return freezeAiChartD1Value({
    measurement: 'utf8_bytes' as const,
    instructionsUtf8Bytes,
    userInputUtf8Bytes,
    totalUtf8Bytes,
    maxInstructionsUtf8Bytes:
      AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES,
    maxUserInputUtf8Bytes:
      AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_USER_INPUT_UTF8_BYTES,
    maxTotalUtf8Bytes:
      AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_TOTAL_UTF8_BYTES,
    status: 'within_budget' as const,
  })
}

function parseBudget(
  value: unknown,
): AiChartD1PalaceWritingPromptBudget {
  const record = requireAiChartD1ExactObject(value, BUDGET_FIELDS)
  if (
    record.measurement !== 'utf8_bytes' ||
    record.maxInstructionsUtf8Bytes !==
      AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES ||
    record.maxUserInputUtf8Bytes !==
      AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_USER_INPUT_UTF8_BYTES ||
    record.maxTotalUtf8Bytes !==
      AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_TOTAL_UTF8_BYTES ||
    record.status !== 'within_budget'
  ) {
    invalid()
  }
  return freezeAiChartD1Value({
    measurement: 'utf8_bytes' as const,
    instructionsUtf8Bytes: parseInteger(
      record.instructionsUtf8Bytes,
      1,
      AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES,
    ),
    userInputUtf8Bytes: parseInteger(
      record.userInputUtf8Bytes,
      1,
      AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_USER_INPUT_UTF8_BYTES,
    ),
    totalUtf8Bytes: parseInteger(
      record.totalUtf8Bytes,
      2,
      AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_TOTAL_UTF8_BYTES,
    ),
    maxInstructionsUtf8Bytes:
      AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES,
    maxUserInputUtf8Bytes:
      AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_USER_INPUT_UTF8_BYTES,
    maxTotalUtf8Bytes:
      AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_TOTAL_UTF8_BYTES,
    status: 'within_budget' as const,
  })
}

function packageFingerprint(
  value: PackageWithoutFingerprint,
): string {
  return hash(createAiChartD1PalaceWritingCanonicalJson(value))
}

function parsePackage(
  value: unknown,
): AiChartD1PalaceWritingPromptPackage {
  const record = requireAiChartD1ExactObject(value, PACKAGE_FIELDS)
  if (
    record.contractVersion !==
      AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_VERSION ||
    record.promptVersion !==
      AI_CHART_D1_PALACE_WRITING_PROMPT_VERSION ||
    record.task !== AI_CHART_D1_PALACE_WRITING_PROMPT_TASK ||
    record.sourceContentGridVersion !==
      AI_CHART_D1_PALACE_CONTENT_GRID_VERSION ||
    record.sourceWritingSetVersion !==
      AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION ||
    record.sourceWholeChartResultVersion !==
      AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION ||
    record.instructions !==
      AI_CHART_D1_PALACE_WRITING_PROMPT_INSTRUCTIONS ||
    record.instructionsSha256 !==
      AI_CHART_D1_PALACE_WRITING_PROMPT_INSTRUCTIONS_SHA256 ||
    record.writingOutputContractStatus !== 'available' ||
    record.promptStatus !== 'prepared' ||
    record.adapterStatus !== 'bridge_required' ||
    record.customerWritingStatus !== 'not_generated' ||
    parseAiChartD1Boolean(record.openAiCallable) !== false
  ) {
    invalid()
  }
  const userInput = parseAiChartD1Text(
    record.userInput,
    MAX_USER_INPUT_CHARACTERS,
  )
  try {
    const parsed = JSON.parse(userInput)
    assertAiChartD1SafeGraph(parsed)
    if (
      createAiChartD1PalaceWritingCanonicalJson(parsed) !==
      userInput
    ) {
      invalid()
    }
  } catch (error) {
    if (
      error instanceof AiChartD1PalaceWritingPromptPackageError
    ) {
      throw error
    }
    invalid()
  }
  const sourceTrace = parseSourceTrace(record.sourceTrace)
  const budget = parseBudget(record.budget)
  if (
    hash(userInput) !== record.userInputSha256 ||
    !Object.is(
      budget.instructionsUtf8Bytes,
      Buffer.byteLength(
        AI_CHART_D1_PALACE_WRITING_PROMPT_INSTRUCTIONS,
        'utf8',
      ),
    ) ||
    budget.userInputUtf8Bytes !==
      Buffer.byteLength(userInput, 'utf8') ||
    budget.totalUtf8Bytes !==
      budget.instructionsUtf8Bytes + budget.userInputUtf8Bytes
  ) {
    invalid()
  }
  const withoutFingerprint: PackageWithoutFingerprint = {
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_VERSION,
    promptVersion: AI_CHART_D1_PALACE_WRITING_PROMPT_VERSION,
    task: AI_CHART_D1_PALACE_WRITING_PROMPT_TASK,
    chartId: parseAiChartD1Id(record.chartId),
    runId: parseAiChartD1Id(record.runId),
    callId: parseAiChartD1Id(record.callId),
    targetPalaceId: parsePalaceId(record.targetPalaceId),
    sourceSnapshotSha256: parseSha(
      record.sourceSnapshotSha256,
    ),
    sourceContentGridVersion:
      AI_CHART_D1_PALACE_CONTENT_GRID_VERSION,
    sourceContentGridSha256: parseSha(
      record.sourceContentGridSha256,
    ),
    sourceWritingSetVersion:
      AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION,
    sourceWholeChartResultVersion:
      AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION,
    primaryLifeRegion: parseRegion(record.primaryLifeRegion),
    reportLanguage: parseLanguage(record.reportLanguage),
    instructions:
      AI_CHART_D1_PALACE_WRITING_PROMPT_INSTRUCTIONS,
    instructionsSha256:
      AI_CHART_D1_PALACE_WRITING_PROMPT_INSTRUCTIONS_SHA256,
    userInput,
    userInputSha256: parseSha(record.userInputSha256),
    sourceTrace,
    budget,
    writingOutputContractStatus: 'available',
    promptStatus: 'prepared',
    adapterStatus: 'bridge_required',
    customerWritingStatus: 'not_generated',
    openAiCallable: false,
  }
  if (
    withoutFingerprint.sourceContentGridSha256 !==
      sourceTrace.contentGridSha256 ||
    withoutFingerprint.sourceSnapshotSha256 !==
      sourceTrace.sourceSnapshotSha256 ||
    packageFingerprint(withoutFingerprint) !==
      record.packageFingerprint
  ) {
    invalid()
  }
  return freezeAiChartD1Value({
    ...withoutFingerprint,
    packageFingerprint: parseSha(record.packageFingerprint),
  })
}

export function parseAiChartD1PalaceWritingPromptPackage(
  value: unknown,
): AiChartD1PalaceWritingPromptPackage {
  try {
    assertAiChartD1SafeGraph(value)
    return parsePackage(value)
  } catch (error) {
    if (
      error instanceof AiChartD1PalaceWritingPromptPackageError
    ) {
      throw error
    }
    invalid()
  }
}

function expectedCoverage(
  packages: readonly AiChartD1PalaceWritingPromptPackage[],
): AiChartD1PalaceWritingPromptCoverage {
  return freezeAiChartD1Value({
    callIds: packages.map((entry) => entry.callId),
    palaceIds: packages.map((entry) => entry.targetPalaceId),
    contentCellIds: packages.flatMap(
      (entry) => entry.sourceTrace.contentCellIds,
    ),
    sourceCellRefs: packages.flatMap(
      (entry) => entry.sourceTrace.sourceCellRefs,
    ),
    sourceRefs: packages.flatMap(
      (entry) => entry.sourceTrace.sourceRefs,
    ),
    relationRefs: [
      ...new Set(
        packages.flatMap(
          (entry) => entry.sourceTrace.relationRefs,
        ),
      ),
    ],
    packageFingerprints: packages.map(
      (entry) => entry.packageFingerprint,
    ),
  })
}

function parseCoverage(
  value: unknown,
): AiChartD1PalaceWritingPromptCoverage {
  const record = requireAiChartD1ExactObject(
    value,
    COVERAGE_FIELDS,
  )
  return freezeAiChartD1Value({
    callIds: parseIdArray(record.callIds, 12, 12),
    palaceIds: parseAiChartD1StringArray(record.palaceIds, {
      minimumItems: 12,
      maximumItems: 12,
      parseItem: parsePalaceId,
    }) as readonly AiChartD1PalaceId[],
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
    sourceRefs: parseIdArray(
      record.sourceRefs,
      12,
      MAX_CONTENT_CELLS,
    ),
    relationRefs: parseIdArray(
      record.relationRefs,
      1,
      AI_CHART_D1_MAX_LIST_ITEMS,
    ),
    packageFingerprints: parseAiChartD1StringArray(
      record.packageFingerprints,
      {
        minimumItems: 12,
        maximumItems: 12,
        parseItem: parseSha,
      },
    ),
  })
}

export function parseAiChartD1PalaceWritingPromptPackageSet(
  value: unknown,
): AiChartD1PalaceWritingPromptPackageSet {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(value, SET_FIELDS)
    if (
      record.contractVersion !==
        AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_SET_VERSION ||
      record.sourceContentGridVersion !==
        AI_CHART_D1_PALACE_CONTENT_GRID_VERSION ||
      record.sourceWritingSetVersion !==
        AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION ||
      record.sourceWholeChartResultVersion !==
        AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION ||
      record.writingOutputContractStatus !== 'available' ||
      record.customerWritingStatus !== 'not_generated' ||
      parseAiChartD1Boolean(record.openAiCallable) !== false ||
      record.validationStatus !== 'validated' ||
      !Array.isArray(record.packages) ||
      record.packages.length !== 12
    ) {
      invalid()
    }
    const chartId = parseAiChartD1Id(record.chartId)
    const runId = parseAiChartD1Id(record.runId)
    const sourceSnapshotSha256 = parseSha(
      record.sourceSnapshotSha256,
    )
    const packages = Object.freeze(record.packages.map(parsePackage))
    if (
      packages.some(
        (entry) =>
          entry.chartId !== chartId || entry.runId !== runId,
      ) ||
      packages.some(
        (entry) =>
          entry.sourceSnapshotSha256 !==
          sourceSnapshotSha256,
      ) ||
      JSON.stringify(
        packages.map((entry) => entry.targetPalaceId),
      ) !== JSON.stringify(PALACE_IDS) ||
      new Set(packages.map((entry) => entry.callId)).size !== 12 ||
      new Set(
        packages.map((entry) => entry.packageFingerprint),
      ).size !== 12
    ) {
      invalid()
    }
    const coverage = parseCoverage(record.coverage)
    if (
      createAiChartD1PalaceWritingCanonicalJson(coverage) !==
      createAiChartD1PalaceWritingCanonicalJson(
        expectedCoverage(packages),
      )
    ) {
      invalid()
    }
    return freezeAiChartD1Value({
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_SET_VERSION,
      chartId,
      runId,
      sourceSnapshotSha256,
      sourceContentGridVersion:
        AI_CHART_D1_PALACE_CONTENT_GRID_VERSION,
      sourceWritingSetVersion:
        AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION,
      sourceWholeChartResultVersion:
        AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION,
      packages,
      coverage,
      writingOutputContractStatus: 'available' as const,
      customerWritingStatus: 'not_generated' as const,
      openAiCallable: false as const,
      validationStatus: 'validated' as const,
    })
  } catch (error) {
    if (
      error instanceof AiChartD1PalaceWritingPromptPackageError
    ) {
      throw error
    }
    invalid()
  }
}

type ValidatedSources = Readonly<{
  contentGrid: AiChartD1PalaceContentGrid
  sourceSet: AiChartD1PalaceWritingSourceSet
  relationResult: AiChartD1WholeChartRelationResult
  palaceResults: readonly AiChartD1PalaceReasoningResult[]
  axisResults: readonly AiChartD1PalaceAxisResult[]
  structuralResults: readonly AiChartD1StructuralInfluenceResult[]
  flyingIntegration: AiChartD1FlyingPalaceIntegration
  reportContext: AiChartD1PalaceWritingReportContext
}>

function parseCanonicalTwelve<T>(
  value: unknown,
  parse: (entry: unknown) => T,
  getPalaceId: (entry: T) => AiChartD1PalaceId,
): readonly T[] {
  if (!Array.isArray(value) || value.length !== 12) invalid()
  const parsed = Object.freeze(value.map(parse))
  if (
    JSON.stringify(parsed.map(getPalaceId)) !==
    JSON.stringify(PALACE_IDS)
  ) {
    invalid()
  }
  return parsed
}

function validateSources(
  sources: AiChartD1PalaceWritingPromptPackageSources,
): ValidatedSources {
  try {
    const contentGrid =
      validateAiChartD1PalaceContentGridAgainstSources(
        sources.contentGrid,
        sources.sourceSet,
        sources.relationResult,
        sources.semanticReview,
        sources.palaceResults,
        sources.flyingIntegration,
        sources.n0,
      )
    const sourceSet = parseAiChartD1PalaceWritingSourceSet(
      sources.sourceSet,
    )
    const relationResult =
      parseAiChartD1WholeChartRelationResult(
        sources.relationResult,
      )
    const palaceResults = parseCanonicalTwelve(
      sources.palaceResults,
      parseAiChartD1PalaceReasoningResult,
      (entry) => entry.targetPalaceId,
    )
    const axisResults = parseCanonicalTwelve(
      sources.axisResults,
      parseAiChartD1PalaceAxisResult,
      (entry) => entry.targetPalaceId,
    )
    const structuralResults = parseCanonicalTwelve(
      sources.structuralResults,
      parseAiChartD1StructuralInfluenceResult,
      (entry) => entry.targetPalaceId,
    )
    const flyingIntegration =
      parseAiChartD1FlyingPalaceIntegration(
        sources.flyingIntegration,
      )
    const reportContext = parseReportContext(sources.reportContext)
    for (let index = 0; index < 12; index += 1) {
      const palaceResult = palaceResults[index]
      const axisResult = axisResults[index]
      const structuralResult = structuralResults[index]
      if (
        axisResult.axisResultId !== palaceResult.axisResultRef ||
        axisResult.chartId !== palaceResult.chartId ||
        axisResult.runId !== palaceResult.runId ||
        axisResult.callId !== palaceResult.callId ||
        structuralResult.structuralInfluenceResultId !==
          palaceResult.structuralInfluenceResultRef ||
        structuralResult.axisResultRef !== axisResult.axisResultId ||
        structuralResult.chartId !== palaceResult.chartId ||
        structuralResult.runId !== palaceResult.runId ||
        structuralResult.callId !== palaceResult.callId ||
        JSON.stringify(axisResult.coverage.claimIds) !==
          JSON.stringify(palaceResult.coverage.axisClaimRefs) ||
        JSON.stringify(structuralResult.coverage.influenceIds) !==
          JSON.stringify(
            palaceResult.coverage.structuralInfluenceRefs,
          )
      ) {
        invalid()
      }
    }
    return freezeAiChartD1Value({
      contentGrid,
      sourceSet,
      relationResult,
      palaceResults,
      axisResults,
      structuralResults,
      flyingIntegration,
      reportContext,
    })
  } catch (error) {
    if (
      error instanceof AiChartD1PalaceWritingPromptPackageError
    ) {
      throw error
    }
    invalid()
  }
}

function sourceMaterialMaps(sources: ValidatedSources) {
  const axis = new Map<string, AiChartD1PalaceAxisClaim>()
  const structural = new Map<
    string,
    AiChartD1StructuralInfluence
  >()
  const flying = new Map<string, AiChartD1FlyingInfluenceResult>()
  for (const result of sources.axisResults) {
    for (const claim of result.claims) axis.set(claim.claimId, claim)
  }
  for (const result of sources.structuralResults) {
    for (const influence of result.influences) {
      structural.set(influence.influenceId, influence)
    }
  }
  for (const palace of sources.flyingIntegration.palaces) {
    for (const influence of palace.influences) {
      flying.set(influence.flyingInfluenceId, influence)
    }
  }
  return { axis, structural, flying }
}

function resolveMaterial(
  sourceCell: AiChartD1PalaceWritingSourceCell,
  maps: ReturnType<typeof sourceMaterialMaps>,
): AiChartD1PalaceWritingSourceMaterialValue {
  const material =
    sourceCell.sourceKind === 'AXIS_CLAIM'
      ? maps.axis.get(sourceCell.sourceRef)
      : sourceCell.sourceKind === 'STRUCTURAL_INFLUENCE'
        ? maps.structural.get(sourceCell.sourceRef)
        : maps.flying.get(sourceCell.sourceRef)
  if (material === undefined) invalid()
  return material
}

function materialFacetId(
  sourceKind: AiChartD1PalaceWritingSourceKind,
  material: AiChartD1PalaceWritingSourceMaterialValue,
): AiChartD1PalaceFacetId {
  return sourceKind === 'AXIS_CLAIM'
    ? (material as AiChartD1PalaceAxisClaim).facetId
    : sourceKind === 'STRUCTURAL_INFLUENCE'
      ? (material as AiChartD1StructuralInfluence).targetFacetId
      : (material as AiChartD1FlyingInfluenceResult).targetFacetId
}

function buildOne(
  palace: AiChartD1PalaceContentGridEntry,
  sources: ValidatedSources,
  contentGridSha256: string,
  maps: ReturnType<typeof sourceMaterialMaps>,
): AiChartD1PalaceWritingPromptPackage {
  const sourceEntry = sources.sourceSet.palaces.find(
    (entry) => entry.targetPalaceId === palace.targetPalaceId,
  )
  if (sourceEntry === undefined) invalid()
  const sourceCells = new Map(
    sourceEntry.sourceCells.map((cell) => [
      cell.sourceCellId,
      cell,
    ]),
  )
  const contentCells = palace.facetSections.flatMap(
    (section) => section.contentCells,
  )
  const sourceMaterials = contentCells.map((cell) => {
    const sourceCell = sourceCells.get(cell.sourceCellRefs[0])
    if (
      sourceCell === undefined ||
      sourceCell.targetPalaceId !== palace.targetPalaceId ||
      sourceCell.facetId !== cell.facetId
    ) {
      invalid()
    }
    const material = resolveMaterial(sourceCell, maps)
    if (materialFacetId(sourceCell.sourceKind, material) !== cell.facetId) {
      invalid()
    }
    return freezeAiChartD1Value({
      contentCellId: cell.contentCellId,
      targetPalaceId: palace.targetPalaceId,
      facetId: cell.facetId,
      sourceCellRef: sourceCell.sourceCellId,
      sourceKind: sourceCell.sourceKind,
      sourceRef: sourceCell.sourceRef,
      material,
    })
  })
  const relationRefs = [
    ...new Set(contentCells.flatMap((cell) => cell.relationRefs)),
  ]
  const relationContext = sources.relationResult.relations.filter(
    (relation) => relationRefs.includes(relation.relationId),
  )
  if (
    JSON.stringify(
      relationContext.map((relation) => relation.relationId),
    ) !== JSON.stringify(relationRefs)
  ) {
    invalid()
  }
  const userInputValue: AiChartD1PalaceWritingPromptUserInput =
    freezeAiChartD1Value({
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_PROMPT_INPUT_VERSION,
      chartId: sources.contentGrid.chartId,
      runId: sources.contentGrid.runId,
      targetPalaceId: palace.targetPalaceId,
      reportContext: sources.reportContext,
      contentGrid: palace,
      sourceMaterials,
      relationContext,
      writingPolicy: AI_CHART_D1_PALACE_WRITING_POLICY,
    })
  const userInput =
    createAiChartD1PalaceWritingCanonicalJson(userInputValue)
  const sourceTrace =
    freezeAiChartD1Value<AiChartD1PalaceWritingPromptSourceTrace>({
      sourceSnapshotSha256:
        sources.contentGrid.sourceSnapshotSha256,
      contentGridSha256,
      contentCellIds: contentCells.map(
        (cell) => cell.contentCellId,
      ),
      sourceCellRefs: sourceMaterials.map(
        (material) => material.sourceCellRef,
      ),
      sourceRefs: sourceMaterials.map(
        (material) => material.sourceRef,
      ),
      relationRefs,
    })
  const withoutFingerprint: PackageWithoutFingerprint = {
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_VERSION,
    promptVersion: AI_CHART_D1_PALACE_WRITING_PROMPT_VERSION,
    task: AI_CHART_D1_PALACE_WRITING_PROMPT_TASK,
    chartId: sources.contentGrid.chartId,
    runId: sources.contentGrid.runId,
    callId: `palace-writing-call:${palace.targetPalaceId}`,
    targetPalaceId: palace.targetPalaceId,
    sourceSnapshotSha256:
      sources.contentGrid.sourceSnapshotSha256,
    sourceContentGridVersion:
      AI_CHART_D1_PALACE_CONTENT_GRID_VERSION,
    sourceContentGridSha256: contentGridSha256,
    sourceWritingSetVersion:
      AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION,
    sourceWholeChartResultVersion:
      AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION,
    primaryLifeRegion:
      sources.reportContext.primaryLifeRegion,
    reportLanguage: sources.reportContext.reportLanguage,
    instructions:
      AI_CHART_D1_PALACE_WRITING_PROMPT_INSTRUCTIONS,
    instructionsSha256:
      AI_CHART_D1_PALACE_WRITING_PROMPT_INSTRUCTIONS_SHA256,
    userInput,
    userInputSha256: hash(userInput),
    sourceTrace,
    budget: createBudget(
      AI_CHART_D1_PALACE_WRITING_PROMPT_INSTRUCTIONS,
      userInput,
    ),
    writingOutputContractStatus: 'available',
    promptStatus: 'prepared',
    adapterStatus: 'bridge_required',
    customerWritingStatus: 'not_generated',
    openAiCallable: false,
  }
  return parsePackage({
    ...withoutFingerprint,
    packageFingerprint: packageFingerprint(withoutFingerprint),
  })
}

export function buildAiChartD1PalaceWritingPromptPackageSet(
  sourceValues: AiChartD1PalaceWritingPromptPackageSources,
): AiChartD1PalaceWritingPromptPackageSet {
  const sources = validateSources(sourceValues)
  const contentGridSha256 = hash(
    createAiChartD1PalaceWritingCanonicalJson(sources.contentGrid),
  )
  const maps = sourceMaterialMaps(sources)
  const packages = sources.contentGrid.palaces.map((palace) =>
    buildOne(palace, sources, contentGridSha256, maps),
  )
  return parseAiChartD1PalaceWritingPromptPackageSet({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_SET_VERSION,
    chartId: sources.contentGrid.chartId,
    runId: sources.contentGrid.runId,
    sourceSnapshotSha256:
      sources.contentGrid.sourceSnapshotSha256,
    sourceContentGridVersion:
      AI_CHART_D1_PALACE_CONTENT_GRID_VERSION,
    sourceWritingSetVersion:
      AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION,
    sourceWholeChartResultVersion:
      AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION,
    packages,
    coverage: expectedCoverage(packages),
    writingOutputContractStatus: 'available',
    customerWritingStatus: 'not_generated',
    openAiCallable: false,
    validationStatus: 'validated',
  })
}

export function validateAiChartD1PalaceWritingPromptPackageSetAgainstSources(
  value: unknown,
  sources: AiChartD1PalaceWritingPromptPackageSources,
): AiChartD1PalaceWritingPromptPackageSet {
  const supplied =
    parseAiChartD1PalaceWritingPromptPackageSet(value)
  const expected =
    buildAiChartD1PalaceWritingPromptPackageSet(sources)
  if (
    createAiChartD1PalaceWritingCanonicalJson(supplied) !==
    createAiChartD1PalaceWritingCanonicalJson(expected)
  ) {
    invalid()
  }
  return supplied
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
const REGION_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 2,
  pattern: REGION_PATTERN.source,
})
const LANGUAGE_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 15,
  pattern: LANGUAGE_PATTERN.source,
})
const SOURCE_TRACE_SCHEMA = createAiChartD1StrictObjectSchema({
  sourceSnapshotSha256: SHA_SCHEMA,
  contentGridSha256: SHA_SCHEMA,
  contentCellIds: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 1,
    maximumItems: MAX_CONTENT_CELLS,
  }),
  sourceCellRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 1,
    maximumItems: MAX_CONTENT_CELLS,
  }),
  sourceRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 1,
    maximumItems: MAX_CONTENT_CELLS,
  }),
  relationRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 0,
    maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
  }),
})
const BUDGET_SCHEMA = createAiChartD1StrictObjectSchema({
  measurement: freezeAiChartD1Value({ const: 'utf8_bytes' }),
  instructionsUtf8Bytes: freezeAiChartD1Value({
    type: 'integer',
    minimum: 1,
    maximum:
      AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES,
  }),
  userInputUtf8Bytes: freezeAiChartD1Value({
    type: 'integer',
    minimum: 1,
    maximum:
      AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_USER_INPUT_UTF8_BYTES,
  }),
  totalUtf8Bytes: freezeAiChartD1Value({
    type: 'integer',
    minimum: 2,
    maximum:
      AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_TOTAL_UTF8_BYTES,
  }),
  maxInstructionsUtf8Bytes: freezeAiChartD1Value({
    const:
      AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES,
  }),
  maxUserInputUtf8Bytes: freezeAiChartD1Value({
    const:
      AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_USER_INPUT_UTF8_BYTES,
  }),
  maxTotalUtf8Bytes: freezeAiChartD1Value({
    const:
      AI_CHART_D1_PALACE_WRITING_PROMPT_MAX_TOTAL_UTF8_BYTES,
  }),
  status: freezeAiChartD1Value({ const: 'within_budget' }),
})
const PACKAGE_SCHEMA = createAiChartD1StrictObjectSchema({
  contractVersion: freezeAiChartD1Value({
    const: AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_VERSION,
  }),
  promptVersion: freezeAiChartD1Value({
    const: AI_CHART_D1_PALACE_WRITING_PROMPT_VERSION,
  }),
  task: freezeAiChartD1Value({
    const: AI_CHART_D1_PALACE_WRITING_PROMPT_TASK,
  }),
  chartId: ID_SCHEMA,
  runId: ID_SCHEMA,
  callId: ID_SCHEMA,
  targetPalaceId: PALACE_ID_SCHEMA,
  sourceSnapshotSha256: SHA_SCHEMA,
  sourceContentGridVersion: freezeAiChartD1Value({
    const: AI_CHART_D1_PALACE_CONTENT_GRID_VERSION,
  }),
  sourceContentGridSha256: SHA_SCHEMA,
  sourceWritingSetVersion: freezeAiChartD1Value({
    const: AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION,
  }),
  sourceWholeChartResultVersion: freezeAiChartD1Value({
    const: AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION,
  }),
  primaryLifeRegion: REGION_SCHEMA,
  reportLanguage: LANGUAGE_SCHEMA,
  instructions: freezeAiChartD1Value({
    const: AI_CHART_D1_PALACE_WRITING_PROMPT_INSTRUCTIONS,
  }),
  instructionsSha256: SHA_SCHEMA,
  userInput: createAiChartD1StringSchema({
    maximumLength: MAX_USER_INPUT_CHARACTERS,
  }),
  userInputSha256: SHA_SCHEMA,
  sourceTrace: SOURCE_TRACE_SCHEMA,
  budget: BUDGET_SCHEMA,
  writingOutputContractStatus: freezeAiChartD1Value({
    const: 'available',
  }),
  promptStatus: freezeAiChartD1Value({ const: 'prepared' }),
  adapterStatus: freezeAiChartD1Value({
    const: 'bridge_required',
  }),
  customerWritingStatus: freezeAiChartD1Value({
    const: 'not_generated',
  }),
  openAiCallable: freezeAiChartD1Value({ const: false }),
  packageFingerprint: SHA_SCHEMA,
})
const COVERAGE_SCHEMA = createAiChartD1StrictObjectSchema({
  callIds: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 12,
    maximumItems: 12,
  }),
  palaceIds: createAiChartD1ArraySchema(PALACE_ID_SCHEMA, {
    minimumItems: 12,
    maximumItems: 12,
  }),
  contentCellIds: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 12,
    maximumItems: MAX_CONTENT_CELLS,
  }),
  sourceCellRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 12,
    maximumItems: MAX_CONTENT_CELLS,
  }),
  sourceRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 12,
    maximumItems: MAX_CONTENT_CELLS,
  }),
  relationRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 1,
    maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
  }),
  packageFingerprints: createAiChartD1ArraySchema(SHA_SCHEMA, {
    minimumItems: 12,
    maximumItems: 12,
  }),
})

export const AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_SET_JSON_SCHEMA:
  AiChartD1JsonSchema = createAiChartD1StrictObjectSchema({
    contractVersion: freezeAiChartD1Value({
      const:
        AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_SET_VERSION,
    }),
    chartId: ID_SCHEMA,
    runId: ID_SCHEMA,
    sourceSnapshotSha256: SHA_SCHEMA,
    sourceContentGridVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_PALACE_CONTENT_GRID_VERSION,
    }),
    sourceWritingSetVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_PALACE_WRITING_SOURCE_SET_VERSION,
    }),
    sourceWholeChartResultVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_WHOLE_CHART_RELATION_RESULT_VERSION,
    }),
    packages: createAiChartD1ArraySchema(PACKAGE_SCHEMA, {
      minimumItems: 12,
      maximumItems: 12,
    }),
    coverage: COVERAGE_SCHEMA,
    writingOutputContractStatus: freezeAiChartD1Value({
      const: 'available',
    }),
    customerWritingStatus: freezeAiChartD1Value({
      const: 'not_generated',
    }),
    openAiCallable: freezeAiChartD1Value({ const: false }),
    validationStatus: freezeAiChartD1Value({
      const: 'validated',
    }),
  })
