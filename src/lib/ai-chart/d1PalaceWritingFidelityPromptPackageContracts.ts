import { createHash } from 'node:crypto'
import {
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  parseAiChartD1Boolean,
  parseAiChartD1Enum,
  parseAiChartD1Id,
  parseAiChartD1StringArray,
  parseAiChartD1Text,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import {
  AI_CHART_D1_PALACE_IDENTITIES,
  type AiChartD1PalaceId,
} from './d1N0Constants'
import { AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_INSTRUCTIONS } from './d1PalaceWritingFidelityPromptInstructions'
import {
  AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_VERSION,
} from './d1PalaceWritingFidelityReviewContracts'
import {
  parseAiChartD1PalaceWritingPromptPackage,
  type AiChartD1PalaceWritingPromptPackage,
} from './d1PalaceWritingPromptPackageContracts'
import {
  AI_CHART_D1_PALACE_WRITING_RESULT_VERSION,
  createAiChartD1PalaceWritingResultSha256,
  validateAiChartD1PalaceWritingResultAgainstPromptPackage,
  type AiChartD1PalaceWritingResult,
} from './d1PalaceWritingResultContracts'

export const AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_PACKAGE_VERSION =
  'ai-chart-d1-palace-writing-fidelity-prompt-package/v1' as const
export const AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_INPUT_VERSION =
  'ai-chart-d1-palace-writing-fidelity-prompt-input/v1' as const
export const AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_VERSION =
  'ai-chart-d1-palace-writing-fidelity-prompt/v1' as const
export const AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_TASK =
  'D1_PALACE_WRITING_FIDELITY_PROMPT_PACKAGE' as const
export const AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_PACKAGE_INVALID =
  'ai_chart_d1_palace_writing_fidelity_prompt_package_invalid' as const

export const AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES =
  32_768 as const
export const AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_MAX_USER_INPUT_UTF8_BYTES =
  1_048_576 as const
export const AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_MAX_TOTAL_UTF8_BYTES =
  1_081_344 as const

export const AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_INSTRUCTIONS_SHA256 =
  createHash('sha256')
    .update(
      AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_INSTRUCTIONS,
      'utf8',
    )
    .digest('hex')

export const AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_POLICY =
  freezeAiChartD1Value({
    reviewUnit: 'CONTENT_CELL',
    sourceBinding: 'EXACT_WRITING_PACKAGE_AND_RESULT',
    preserveContradictions: true,
    reviewOnly: true,
    freeFormCommentary: false,
    rewriteCustomerText: false,
    repairScope: 'CONTENT_CELL_ONLY',
  } as const)

export type AiChartD1PalaceWritingFidelityPromptUserInput =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_INPUT_VERSION
    chartId: string
    runId: string
    callId: string
    targetPalaceId: AiChartD1PalaceId
    sourceWritingPackageVersion: string
    sourceWritingPackageFingerprint: string
    sourceWritingPromptInput: unknown
    sourceWritingResultVersion:
      typeof AI_CHART_D1_PALACE_WRITING_RESULT_VERSION
    sourceWritingResultSha256: string
    writingResult: AiChartD1PalaceWritingResult
    reviewPolicy:
      typeof AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_POLICY
  }>

export type AiChartD1PalaceWritingFidelityPromptSourceTrace =
  Readonly<{
    contentCellIds: readonly string[]
    sourceRefs: readonly string[]
    relationRefs: readonly string[]
  }>

export type AiChartD1PalaceWritingFidelityPromptBudget =
  Readonly<{
    measurement: 'utf8_bytes'
    instructionsUtf8Bytes: number
    userInputUtf8Bytes: number
    totalUtf8Bytes: number
    maxInstructionsUtf8Bytes:
      typeof AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES
    maxUserInputUtf8Bytes:
      typeof AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_MAX_USER_INPUT_UTF8_BYTES
    maxTotalUtf8Bytes:
      typeof AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_MAX_TOTAL_UTF8_BYTES
    status: 'within_budget'
  }>

export type AiChartD1PalaceWritingFidelityPromptPackage =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_PACKAGE_VERSION
    promptVersion:
      typeof AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_VERSION
    task: typeof AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_TASK
    chartId: string
    runId: string
    callId: string
    targetPalaceId: AiChartD1PalaceId
    sourcePackageFingerprint: string
    sourceWritingResultVersion:
      typeof AI_CHART_D1_PALACE_WRITING_RESULT_VERSION
    sourceWritingResultSha256: string
    primaryLifeRegion: string
    reportLanguage: string
    instructions:
      typeof AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_INSTRUCTIONS
    instructionsSha256:
      typeof AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_INSTRUCTIONS_SHA256
    userInput: string
    userInputSha256: string
    sourceTrace: AiChartD1PalaceWritingFidelityPromptSourceTrace
    budget: AiChartD1PalaceWritingFidelityPromptBudget
    fidelityReviewOutputContractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_VERSION
    promptStatus: 'prepared'
    adapterStatus: 'bridge_required'
    reviewStatus: 'not_generated'
    customerDeliveryStatus: 'blocked'
    openAiCallable: false
    packageFingerprint: string
  }>

type PackageWithoutFingerprint = Omit<
  AiChartD1PalaceWritingFidelityPromptPackage,
  'packageFingerprint'
>

export class AiChartD1PalaceWritingFidelityPromptPackageError extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_PACKAGE_INVALID

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_PACKAGE_INVALID,
    )
    this.name =
      'AiChartD1PalaceWritingFidelityPromptPackageError'
    Object.freeze(this)
  }
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const REGION_PATTERN = /^[A-Z]{2}$/
const LANGUAGE_PATTERN =
  /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-(?:[A-Z]{2}|[0-9]{3}))?$/
const PALACE_IDS = AI_CHART_D1_PALACE_IDENTITIES.map(
  (identity) => identity.palaceId,
)
const PACKAGE_FIELDS = Object.freeze([
  'contractVersion',
  'promptVersion',
  'task',
  'chartId',
  'runId',
  'callId',
  'targetPalaceId',
  'sourcePackageFingerprint',
  'sourceWritingResultVersion',
  'sourceWritingResultSha256',
  'primaryLifeRegion',
  'reportLanguage',
  'instructions',
  'instructionsSha256',
  'userInput',
  'userInputSha256',
  'sourceTrace',
  'budget',
  'fidelityReviewOutputContractVersion',
  'promptStatus',
  'adapterStatus',
  'reviewStatus',
  'customerDeliveryStatus',
  'openAiCallable',
  'packageFingerprint',
] as const)
const SOURCE_TRACE_FIELDS = Object.freeze([
  'contentCellIds',
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

function invalid(): never {
  throw new AiChartD1PalaceWritingFidelityPromptPackageError()
}

function parseSha(value: unknown): string {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
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

function parseBoundedInteger(
  value: unknown,
  maximum: number,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > maximum
  ) {
    invalid()
  }
  return value
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    )
  }
  return value
}

export function createAiChartD1PalaceWritingFidelityCanonicalJson(
  value: unknown,
): string {
  assertAiChartD1SafeGraph(value)
  return JSON.stringify(canonicalize(value))
}

function createFingerprint(
  value: PackageWithoutFingerprint,
): string {
  return createHash('sha256')
    .update(
      createAiChartD1PalaceWritingFidelityCanonicalJson(value),
      'utf8',
    )
    .digest('hex')
}

function parseSourceTrace(
  value: unknown,
): AiChartD1PalaceWritingFidelityPromptSourceTrace {
  const record = requireAiChartD1ExactObject(
    value,
    SOURCE_TRACE_FIELDS,
  )
  const contentCellIds = parseAiChartD1StringArray(
    record.contentCellIds,
    {
      minimumItems: 1,
      maximumItems: 304,
      parseItem: (item) => parseAiChartD1Id(item),
    },
  )
  const sourceRefs = parseAiChartD1StringArray(
    record.sourceRefs,
    {
      minimumItems: 0,
      maximumItems: 1_536,
      parseItem: (item) => parseAiChartD1Id(item),
    },
  )
  const relationRefs = parseAiChartD1StringArray(
    record.relationRefs,
    {
      minimumItems: 0,
      maximumItems: 1_536,
      parseItem: (item) => parseAiChartD1Id(item),
    },
  )
  if (
    new Set(contentCellIds).size !== contentCellIds.length ||
    new Set(sourceRefs).size !== sourceRefs.length ||
    new Set(relationRefs).size !== relationRefs.length
  ) {
    invalid()
  }
  return freezeAiChartD1Value({
    contentCellIds,
    sourceRefs,
    relationRefs,
  })
}

function parseBudget(
  value: unknown,
): AiChartD1PalaceWritingFidelityPromptBudget {
  const record = requireAiChartD1ExactObject(
    value,
    BUDGET_FIELDS,
  )
  const instructionsUtf8Bytes = parseBoundedInteger(
    record.instructionsUtf8Bytes,
    AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES,
  )
  const userInputUtf8Bytes = parseBoundedInteger(
    record.userInputUtf8Bytes,
    AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_MAX_USER_INPUT_UTF8_BYTES,
  )
  const totalUtf8Bytes = parseBoundedInteger(
    record.totalUtf8Bytes,
    AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_MAX_TOTAL_UTF8_BYTES,
  )
  if (
    record.measurement !== 'utf8_bytes' ||
    record.maxInstructionsUtf8Bytes !==
      AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES ||
    record.maxUserInputUtf8Bytes !==
      AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_MAX_USER_INPUT_UTF8_BYTES ||
    record.maxTotalUtf8Bytes !==
      AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_MAX_TOTAL_UTF8_BYTES ||
    record.status !== 'within_budget' ||
    totalUtf8Bytes !==
      instructionsUtf8Bytes + userInputUtf8Bytes
  ) {
    invalid()
  }
  return freezeAiChartD1Value({
    measurement: 'utf8_bytes' as const,
    instructionsUtf8Bytes,
    userInputUtf8Bytes,
    totalUtf8Bytes,
    maxInstructionsUtf8Bytes:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES,
    maxUserInputUtf8Bytes:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_MAX_USER_INPUT_UTF8_BYTES,
    maxTotalUtf8Bytes:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_MAX_TOTAL_UTF8_BYTES,
    status: 'within_budget' as const,
  })
}

export function parseAiChartD1PalaceWritingFidelityPromptPackage(
  value: unknown,
): AiChartD1PalaceWritingFidelityPromptPackage {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(
      value,
      PACKAGE_FIELDS,
    )
    if (
      record.contractVersion !==
        AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_PACKAGE_VERSION ||
      record.promptVersion !==
        AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_VERSION ||
      record.task !==
        AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_TASK ||
      record.sourceWritingResultVersion !==
        AI_CHART_D1_PALACE_WRITING_RESULT_VERSION ||
      record.instructions !==
        AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_INSTRUCTIONS ||
      record.instructionsSha256 !==
        AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_INSTRUCTIONS_SHA256 ||
      record.fidelityReviewOutputContractVersion !==
        AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_VERSION ||
      record.promptStatus !== 'prepared' ||
      record.adapterStatus !== 'bridge_required' ||
      record.reviewStatus !== 'not_generated' ||
      record.customerDeliveryStatus !== 'blocked' ||
      parseAiChartD1Boolean(record.openAiCallable) !== false
    ) {
      invalid()
    }
    const userInput = parseAiChartD1Text(
      record.userInput,
      AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_MAX_USER_INPUT_UTF8_BYTES,
    )
    const parsed = freezeAiChartD1Value({
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_PACKAGE_VERSION,
      promptVersion:
        AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_VERSION,
      task: AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_TASK,
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
      primaryLifeRegion: parseAiChartD1Text(
        record.primaryLifeRegion,
        2,
      ),
      reportLanguage: parseAiChartD1Text(
        record.reportLanguage,
        35,
      ),
      instructions:
        AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_INSTRUCTIONS,
      instructionsSha256:
        AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_INSTRUCTIONS_SHA256,
      userInput,
      userInputSha256: parseSha(record.userInputSha256),
      sourceTrace: parseSourceTrace(record.sourceTrace),
      budget: parseBudget(record.budget),
      fidelityReviewOutputContractVersion:
        AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_VERSION,
      promptStatus: 'prepared' as const,
      adapterStatus: 'bridge_required' as const,
      reviewStatus: 'not_generated' as const,
      customerDeliveryStatus: 'blocked' as const,
      openAiCallable: false as const,
      packageFingerprint: parseSha(record.packageFingerprint),
    })
    if (
      !REGION_PATTERN.test(parsed.primaryLifeRegion) ||
      !LANGUAGE_PATTERN.test(parsed.reportLanguage) ||
      createHash('sha256')
        .update(parsed.userInput, 'utf8')
        .digest('hex') !== parsed.userInputSha256 ||
      Buffer.byteLength(parsed.instructions, 'utf8') !==
        parsed.budget.instructionsUtf8Bytes ||
      Buffer.byteLength(parsed.userInput, 'utf8') !==
        parsed.budget.userInputUtf8Bytes
    ) {
      invalid()
    }
    const withoutFingerprint = Object.fromEntries(
      Object.entries(parsed).filter(
        ([field]) => field !== 'packageFingerprint',
      ),
    ) as PackageWithoutFingerprint
    if (
      createFingerprint(withoutFingerprint) !==
      parsed.packageFingerprint
    ) {
      invalid()
    }
    const parsedUserInput = JSON.parse(parsed.userInput)
    if (
      createAiChartD1PalaceWritingFidelityCanonicalJson(
        parsedUserInput,
      ) !== parsed.userInput
    ) {
      invalid()
    }
    return parsed
  } catch (error) {
    if (
      error instanceof
      AiChartD1PalaceWritingFidelityPromptPackageError
    ) {
      throw error
    }
    invalid()
  }
}

function buildUserInput(
  promptPackage: AiChartD1PalaceWritingPromptPackage,
  writingResult: AiChartD1PalaceWritingResult,
): AiChartD1PalaceWritingFidelityPromptUserInput {
  let sourceWritingPromptInput: unknown
  try {
    sourceWritingPromptInput = JSON.parse(promptPackage.userInput)
    assertAiChartD1SafeGraph(sourceWritingPromptInput)
  } catch {
    invalid()
  }
  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_INPUT_VERSION,
    chartId: promptPackage.chartId,
    runId: promptPackage.runId,
    callId: promptPackage.callId,
    targetPalaceId: promptPackage.targetPalaceId,
    sourceWritingPackageVersion: promptPackage.contractVersion,
    sourceWritingPackageFingerprint:
      promptPackage.packageFingerprint,
    sourceWritingPromptInput,
    sourceWritingResultVersion:
      AI_CHART_D1_PALACE_WRITING_RESULT_VERSION,
    sourceWritingResultSha256:
      createAiChartD1PalaceWritingResultSha256(writingResult),
    writingResult,
    reviewPolicy:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_POLICY,
  })
}

export function buildAiChartD1PalaceWritingFidelityPromptPackage(
  promptPackageValue: unknown,
  writingResultValue: unknown,
): AiChartD1PalaceWritingFidelityPromptPackage {
  let promptPackage: AiChartD1PalaceWritingPromptPackage
  let writingResult: AiChartD1PalaceWritingResult
  try {
    promptPackage = parseAiChartD1PalaceWritingPromptPackage(
      promptPackageValue,
    )
    writingResult =
      validateAiChartD1PalaceWritingResultAgainstPromptPackage(
        writingResultValue,
        promptPackage,
      )
  } catch {
    invalid()
  }
  const userInput =
    createAiChartD1PalaceWritingFidelityCanonicalJson(
      buildUserInput(promptPackage, writingResult),
    )
  const instructionsUtf8Bytes = Buffer.byteLength(
    AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_INSTRUCTIONS,
    'utf8',
  )
  const userInputUtf8Bytes = Buffer.byteLength(userInput, 'utf8')
  const totalUtf8Bytes =
    instructionsUtf8Bytes + userInputUtf8Bytes
  if (
    instructionsUtf8Bytes >
      AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES ||
    userInputUtf8Bytes >
      AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_MAX_USER_INPUT_UTF8_BYTES ||
    totalUtf8Bytes >
      AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_MAX_TOTAL_UTF8_BYTES
  ) {
    invalid()
  }
  const withoutFingerprint: PackageWithoutFingerprint = {
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_PACKAGE_VERSION,
    promptVersion:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_VERSION,
    task: AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_TASK,
    chartId: promptPackage.chartId,
    runId: promptPackage.runId,
    callId: promptPackage.callId,
    targetPalaceId: promptPackage.targetPalaceId,
    sourcePackageFingerprint: promptPackage.packageFingerprint,
    sourceWritingResultVersion:
      AI_CHART_D1_PALACE_WRITING_RESULT_VERSION,
    sourceWritingResultSha256:
      createAiChartD1PalaceWritingResultSha256(writingResult),
    primaryLifeRegion: promptPackage.primaryLifeRegion,
    reportLanguage: promptPackage.reportLanguage,
    instructions:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_INSTRUCTIONS,
    instructionsSha256:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_INSTRUCTIONS_SHA256,
    userInput,
    userInputSha256: createHash('sha256')
      .update(userInput, 'utf8')
      .digest('hex'),
    sourceTrace: freezeAiChartD1Value({
      contentCellIds: promptPackage.sourceTrace.contentCellIds,
      sourceRefs: promptPackage.sourceTrace.sourceRefs,
      relationRefs: promptPackage.sourceTrace.relationRefs,
    }),
    budget: freezeAiChartD1Value({
      measurement: 'utf8_bytes' as const,
      instructionsUtf8Bytes,
      userInputUtf8Bytes,
      totalUtf8Bytes,
      maxInstructionsUtf8Bytes:
        AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES,
      maxUserInputUtf8Bytes:
        AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_MAX_USER_INPUT_UTF8_BYTES,
      maxTotalUtf8Bytes:
        AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_MAX_TOTAL_UTF8_BYTES,
      status: 'within_budget' as const,
    }),
    fidelityReviewOutputContractVersion:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_VERSION,
    promptStatus: 'prepared',
    adapterStatus: 'bridge_required',
    reviewStatus: 'not_generated',
    customerDeliveryStatus: 'blocked',
    openAiCallable: false,
  }
  return parseAiChartD1PalaceWritingFidelityPromptPackage({
    ...withoutFingerprint,
    packageFingerprint: createFingerprint(withoutFingerprint),
  })
}

export function validateAiChartD1PalaceWritingFidelityPromptPackageAgainstSources(
  packageValue: unknown,
  promptPackageValue: unknown,
  writingResultValue: unknown,
): AiChartD1PalaceWritingFidelityPromptPackage {
  const actual =
    parseAiChartD1PalaceWritingFidelityPromptPackage(packageValue)
  const expected =
    buildAiChartD1PalaceWritingFidelityPromptPackage(
      promptPackageValue,
      writingResultValue,
    )
  if (
    createAiChartD1PalaceWritingFidelityCanonicalJson(actual) !==
    createAiChartD1PalaceWritingFidelityCanonicalJson(expected)
  ) {
    invalid()
  }
  return actual
}
