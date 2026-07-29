import { createHash } from 'node:crypto'
import {
  AI_CHART_D1_MAX_LIST_ITEMS,
  assertAiChartD1SafeGraph,
  createAiChartD1ArraySchema,
  createAiChartD1StrictObjectSchema,
  createAiChartD1StringSchema,
  freezeAiChartD1Value,
  parseAiChartD1Boolean,
  parseAiChartD1Id,
  parseAiChartD1StringArray,
  parseAiChartD1Text,
  requireAiChartD1ExactObject,
  type AiChartD1JsonSchema,
} from './d1CommonContracts'
import {
  AI_CHART_D1_FLYING_INFLUENCE_RESULT_CONTRACT_VERSION,
  AI_CHART_D1_FLYING_INFLUENCE_RESULT_JSON_SCHEMA,
  AI_CHART_D1_FLYING_INFLUENCE_RESULT_SCHEMA_NAME,
} from './d1FlyingInfluenceContracts'
import {
  AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_SET_VERSION,
  validateAiChartD1FlyingKnowledgeViewSetAgainstSources,
  type AiChartD1FlyingKnowledgeView,
  type AiChartD1FlyingKnowledgeViewSet,
} from './d1FlyingKnowledgeContracts'
import {
  AI_CHART_D1_FLYING_MODEL_INPUT_SET_VERSION,
  parseAiChartD1FlyingModelInputSet,
  type AiChartD1FlyingModelInput,
  type AiChartD1FlyingModelInputSet,
} from './d1FlyingModelInputContracts'
import { AI_CHART_D1_FLYING_PROMPT_INSTRUCTIONS } from './d1FlyingPromptInstructions'
import type { AiChartD1ActorBindingId } from './d1PalaceActorBindingRegistry'
import type { AiChartD1PalaceFacetId } from './d1PalaceFacetRegistry'

export const AI_CHART_D1_FLYING_PROMPT_PACKAGE_VERSION =
  'ai-chart-d1-flying-prompt-package/v1' as const
export const AI_CHART_D1_FLYING_PROMPT_PACKAGE_SET_VERSION =
  'ai-chart-d1-flying-prompt-package-set/v1' as const
export const AI_CHART_D1_FLYING_PROMPT_VERSION =
  'ai-chart-d1-flying-prompt/v1' as const
export const AI_CHART_D1_FLYING_PROMPT_PACKAGE_TASK =
  'D1_FLYING_PROMPT_PACKAGE' as const
export const AI_CHART_D1_FLYING_PROMPT_PACKAGE_SET_SCHEMA_NAME =
  'ai_chart_d1_flying_prompt_package_set_v1' as const
export const AI_CHART_D1_FLYING_PROMPT_PACKAGE_INVALID =
  'ai_chart_d1_flying_prompt_package_invalid' as const

export const AI_CHART_D1_FLYING_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES =
  32_768 as const
export const AI_CHART_D1_FLYING_PROMPT_MAX_USER_INPUT_UTF8_BYTES =
  262_144 as const
export const AI_CHART_D1_FLYING_PROMPT_MAX_TOTAL_UTF8_BYTES =
  294_912 as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const MAX_USER_INPUT_CHARACTERS =
  AI_CHART_D1_FLYING_PROMPT_MAX_USER_INPUT_UTF8_BYTES

export type AiChartD1FlyingPromptPackageSourceTrace = Readonly<{
  flyingFactRef: string
  sourcePalaceResultRef: string
  targetPalaceResultRef: string
  sourceActorBindingRefs: readonly AiChartD1ActorBindingId[]
  eligibleTargetFacetIds: readonly AiChartD1PalaceFacetId[]
  knowledgeRuleRefs: readonly string[]
  sourcePalaceMeaningRefs: readonly string[]
  targetPalaceMeaningRefs: readonly string[]
}>

export type AiChartD1FlyingPromptPackageBudget = Readonly<{
  measurement: 'utf8_bytes'
  instructionsUtf8Bytes: number
  userInputUtf8Bytes: number
  totalUtf8Bytes: number
  maxInstructionsUtf8Bytes:
    typeof AI_CHART_D1_FLYING_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES
  maxUserInputUtf8Bytes:
    typeof AI_CHART_D1_FLYING_PROMPT_MAX_USER_INPUT_UTF8_BYTES
  maxTotalUtf8Bytes:
    typeof AI_CHART_D1_FLYING_PROMPT_MAX_TOTAL_UTF8_BYTES
  status: 'within_budget'
}>

export type AiChartD1FlyingPromptPackage = Readonly<{
  contractVersion: typeof AI_CHART_D1_FLYING_PROMPT_PACKAGE_VERSION
  promptVersion: typeof AI_CHART_D1_FLYING_PROMPT_VERSION
  task: typeof AI_CHART_D1_FLYING_PROMPT_PACKAGE_TASK
  chartId: string
  runId: string
  callId: string
  flyingModelInputRef: string
  flyingKnowledgeViewRef: string
  catalogId: string
  catalogFingerprint: string
  sourceManifestSha256: string
  outputContractVersion:
    typeof AI_CHART_D1_FLYING_INFLUENCE_RESULT_CONTRACT_VERSION
  outputSchemaName:
    typeof AI_CHART_D1_FLYING_INFLUENCE_RESULT_SCHEMA_NAME
  outputSchemaSha256: string
  instructions: typeof AI_CHART_D1_FLYING_PROMPT_INSTRUCTIONS
  instructionsSha256: string
  userInput: string
  userInputSha256: string
  sourceTrace: AiChartD1FlyingPromptPackageSourceTrace
  budget: AiChartD1FlyingPromptPackageBudget
  promptStatus: 'ready'
  adapterStatus: 'adapter_bridge_required'
  openAiCallable: false
  packageFingerprint: string
}>

export type AiChartD1FlyingPromptPackageCoverage = Readonly<{
  callIds: readonly string[]
  flyingModelInputRefs: readonly string[]
  flyingKnowledgeViewRefs: readonly string[]
  packageFingerprints: readonly string[]
}>

export type AiChartD1FlyingPromptPackageSet = Readonly<{
  contractVersion: typeof AI_CHART_D1_FLYING_PROMPT_PACKAGE_SET_VERSION
  chartId: string
  runId: string
  sourceModelInputSetVersion:
    typeof AI_CHART_D1_FLYING_MODEL_INPUT_SET_VERSION
  sourceKnowledgeViewSetVersion:
    typeof AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_SET_VERSION
  catalogId: string
  catalogFingerprint: string
  sourceManifestSha256: string
  packages: readonly AiChartD1FlyingPromptPackage[]
  coverage: AiChartD1FlyingPromptPackageCoverage
  openAiCallable: false
  validationStatus: 'validated'
}>

type PackageWithoutFingerprint = Omit<
  AiChartD1FlyingPromptPackage,
  'packageFingerprint'
>

export class AiChartD1FlyingPromptPackageError extends Error {
  readonly code = AI_CHART_D1_FLYING_PROMPT_PACKAGE_INVALID

  constructor() {
    super(AI_CHART_D1_FLYING_PROMPT_PACKAGE_INVALID)
    this.name = 'AiChartD1FlyingPromptPackageError'
    Object.freeze(this)
  }
}

const SOURCE_TRACE_FIELDS = Object.freeze([
  'flyingFactRef',
  'sourcePalaceResultRef',
  'targetPalaceResultRef',
  'sourceActorBindingRefs',
  'eligibleTargetFacetIds',
  'knowledgeRuleRefs',
  'sourcePalaceMeaningRefs',
  'targetPalaceMeaningRefs',
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
  'flyingModelInputRef',
  'flyingKnowledgeViewRef',
  'catalogId',
  'catalogFingerprint',
  'sourceManifestSha256',
  'outputContractVersion',
  'outputSchemaName',
  'outputSchemaSha256',
  'instructions',
  'instructionsSha256',
  'userInput',
  'userInputSha256',
  'sourceTrace',
  'budget',
  'promptStatus',
  'adapterStatus',
  'openAiCallable',
  'packageFingerprint',
] as const)
const COVERAGE_FIELDS = Object.freeze([
  'callIds',
  'flyingModelInputRefs',
  'flyingKnowledgeViewRefs',
  'packageFingerprints',
] as const)
const SET_FIELDS = Object.freeze([
  'contractVersion',
  'chartId',
  'runId',
  'sourceModelInputSetVersion',
  'sourceKnowledgeViewSetVersion',
  'catalogId',
  'catalogFingerprint',
  'sourceManifestSha256',
  'packages',
  'coverage',
  'openAiCallable',
  'validationStatus',
] as const)

function invalid(): never {
  throw new AiChartD1FlyingPromptPackageError()
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  )
}

export function createAiChartD1FlyingCanonicalJson(
  value: unknown,
): string {
  try {
    assertAiChartD1SafeGraph(value)
    return JSON.stringify(canonicalize(value))
  } catch {
    invalid()
  }
}

function hash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export const AI_CHART_D1_FLYING_PROMPT_INSTRUCTIONS_SHA256 = hash(
  AI_CHART_D1_FLYING_PROMPT_INSTRUCTIONS,
)
export const AI_CHART_D1_FLYING_OUTPUT_SCHEMA_SHA256 = hash(
  createAiChartD1FlyingCanonicalJson(
    AI_CHART_D1_FLYING_INFLUENCE_RESULT_JSON_SCHEMA,
  ),
)

function parseSha(value: unknown): string {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    invalid()
  }
  return value
}

function parseInteger(
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

function stringArray(
  value: unknown,
  minimumItems = 1,
): readonly string[] {
  return parseAiChartD1StringArray(value, {
    minimumItems,
    maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
    parseItem: parseAiChartD1Id,
  })
}

function sourceTraceFor(
  modelInput: AiChartD1FlyingModelInput,
  knowledgeView: AiChartD1FlyingKnowledgeView,
): AiChartD1FlyingPromptPackageSourceTrace {
  return freezeAiChartD1Value({
    flyingFactRef: modelInput.flyingFact.flyingFactId,
    sourcePalaceResultRef:
      modelInput.sourcePalaceResult.palaceResultId,
    targetPalaceResultRef:
      modelInput.targetPalaceResult.palaceResultId,
    sourceActorBindingRefs: [
      ...knowledgeView.sourceActorBindings.map(
        (binding) => binding.bindingId,
      ),
    ],
    eligibleTargetFacetIds: [...knowledgeView.eligibleTargetFacetIds],
    knowledgeRuleRefs: [
      knowledgeView.transformedStarCoreRule.ruleId,
      knowledgeView.transformationCommonRule.ruleId,
      knowledgeView.transformationSpecificRule.ruleId,
    ],
    sourcePalaceMeaningRefs: knowledgeView.sourcePalaceMeanings.map(
      (meaning) => meaning.meaningId,
    ),
    targetPalaceMeaningRefs: knowledgeView.targetPalaceMeanings.map(
      (meaning) => meaning.meaningId,
    ),
  })
}

function createBudget(
  instructions: string,
  userInput: string,
): AiChartD1FlyingPromptPackageBudget {
  const instructionsUtf8Bytes = Buffer.byteLength(instructions, 'utf8')
  const userInputUtf8Bytes = Buffer.byteLength(userInput, 'utf8')
  const totalUtf8Bytes = instructionsUtf8Bytes + userInputUtf8Bytes
  if (
    instructionsUtf8Bytes >
      AI_CHART_D1_FLYING_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES ||
    userInputUtf8Bytes >
      AI_CHART_D1_FLYING_PROMPT_MAX_USER_INPUT_UTF8_BYTES ||
    totalUtf8Bytes >
      AI_CHART_D1_FLYING_PROMPT_MAX_TOTAL_UTF8_BYTES
  ) {
    invalid()
  }
  return freezeAiChartD1Value({
    measurement: 'utf8_bytes',
    instructionsUtf8Bytes,
    userInputUtf8Bytes,
    totalUtf8Bytes,
    maxInstructionsUtf8Bytes:
      AI_CHART_D1_FLYING_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES,
    maxUserInputUtf8Bytes:
      AI_CHART_D1_FLYING_PROMPT_MAX_USER_INPUT_UTF8_BYTES,
    maxTotalUtf8Bytes:
      AI_CHART_D1_FLYING_PROMPT_MAX_TOTAL_UTF8_BYTES,
    status: 'within_budget',
  })
}

function packageFingerprint(
  value: PackageWithoutFingerprint,
): string {
  return hash(createAiChartD1FlyingCanonicalJson(value))
}

function buildOne(
  modelInput: AiChartD1FlyingModelInput,
  knowledgeView: AiChartD1FlyingKnowledgeView,
  knowledgeSet: AiChartD1FlyingKnowledgeViewSet,
): AiChartD1FlyingPromptPackage {
  const userInput = createAiChartD1FlyingCanonicalJson({
    modelInput,
    knowledgeView,
  })
  const withoutFingerprint: PackageWithoutFingerprint = {
    contractVersion: AI_CHART_D1_FLYING_PROMPT_PACKAGE_VERSION,
    promptVersion: AI_CHART_D1_FLYING_PROMPT_VERSION,
    task: AI_CHART_D1_FLYING_PROMPT_PACKAGE_TASK,
    chartId: modelInput.chartId,
    runId: modelInput.runId,
    callId:
      `flying-call:${modelInput.flyingFact.sourcePalaceId}:` +
      modelInput.flyingFact.transformationKind.toLowerCase(),
    flyingModelInputRef: modelInput.flyingModelInputId,
    flyingKnowledgeViewRef: knowledgeView.flyingKnowledgeViewId,
    catalogId: knowledgeSet.catalogId,
    catalogFingerprint: knowledgeSet.catalogFingerprint,
    sourceManifestSha256: knowledgeSet.sourceManifestSha256,
    outputContractVersion:
      AI_CHART_D1_FLYING_INFLUENCE_RESULT_CONTRACT_VERSION,
    outputSchemaName:
      AI_CHART_D1_FLYING_INFLUENCE_RESULT_SCHEMA_NAME,
    outputSchemaSha256: AI_CHART_D1_FLYING_OUTPUT_SCHEMA_SHA256,
    instructions: AI_CHART_D1_FLYING_PROMPT_INSTRUCTIONS,
    instructionsSha256:
      AI_CHART_D1_FLYING_PROMPT_INSTRUCTIONS_SHA256,
    userInput,
    userInputSha256: hash(userInput),
    sourceTrace: sourceTraceFor(modelInput, knowledgeView),
    budget: createBudget(
      AI_CHART_D1_FLYING_PROMPT_INSTRUCTIONS,
      userInput,
    ),
    promptStatus: 'ready',
    adapterStatus: 'adapter_bridge_required',
    openAiCallable: false,
  }
  return freezeAiChartD1Value({
    ...withoutFingerprint,
    packageFingerprint: packageFingerprint(withoutFingerprint),
  })
}

function expectedCoverage(
  packages: readonly AiChartD1FlyingPromptPackage[],
): AiChartD1FlyingPromptPackageCoverage {
  return freezeAiChartD1Value({
    callIds: packages.map((entry) => entry.callId),
    flyingModelInputRefs: packages.map(
      (entry) => entry.flyingModelInputRef,
    ),
    flyingKnowledgeViewRefs: packages.map(
      (entry) => entry.flyingKnowledgeViewRef,
    ),
    packageFingerprints: packages.map(
      (entry) => entry.packageFingerprint,
    ),
  })
}

function parseSourceTrace(
  value: unknown,
): AiChartD1FlyingPromptPackageSourceTrace {
  const record = requireAiChartD1ExactObject(
    value,
    SOURCE_TRACE_FIELDS,
  )
  return freezeAiChartD1Value({
    flyingFactRef: parseAiChartD1Id(record.flyingFactRef),
    sourcePalaceResultRef: parseAiChartD1Id(
      record.sourcePalaceResultRef,
    ),
    targetPalaceResultRef: parseAiChartD1Id(
      record.targetPalaceResultRef,
    ),
    sourceActorBindingRefs: stringArray(
      record.sourceActorBindingRefs,
    ) as readonly AiChartD1ActorBindingId[],
    eligibleTargetFacetIds: stringArray(
      record.eligibleTargetFacetIds,
    ) as readonly AiChartD1PalaceFacetId[],
    knowledgeRuleRefs: stringArray(record.knowledgeRuleRefs),
    sourcePalaceMeaningRefs: stringArray(
      record.sourcePalaceMeaningRefs,
    ),
    targetPalaceMeaningRefs: stringArray(
      record.targetPalaceMeaningRefs,
    ),
  })
}

function parseCanonicalUserInput(value: unknown): string {
  const userInput = parseAiChartD1Text(
    value,
    MAX_USER_INPUT_CHARACTERS,
  )
  try {
    const parsed: unknown = JSON.parse(userInput)
    assertAiChartD1SafeGraph(parsed)
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed) ||
      createAiChartD1FlyingCanonicalJson(parsed) !== userInput
    ) {
      invalid()
    }
  } catch (error) {
    if (error instanceof AiChartD1FlyingPromptPackageError) throw error
    invalid()
  }
  return userInput
}

function parseBudget(
  value: unknown,
  userInput: string,
): AiChartD1FlyingPromptPackageBudget {
  const record = requireAiChartD1ExactObject(value, BUDGET_FIELDS)
  const actual = createBudget(
    AI_CHART_D1_FLYING_PROMPT_INSTRUCTIONS,
    userInput,
  )
  if (
    record.measurement !== actual.measurement ||
    record.status !== actual.status ||
    parseInteger(
      record.instructionsUtf8Bytes,
      AI_CHART_D1_FLYING_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES,
    ) !== actual.instructionsUtf8Bytes ||
    parseInteger(
      record.userInputUtf8Bytes,
      AI_CHART_D1_FLYING_PROMPT_MAX_USER_INPUT_UTF8_BYTES,
    ) !== actual.userInputUtf8Bytes ||
    parseInteger(
      record.totalUtf8Bytes,
      AI_CHART_D1_FLYING_PROMPT_MAX_TOTAL_UTF8_BYTES,
    ) !== actual.totalUtf8Bytes ||
    record.maxInstructionsUtf8Bytes !==
      actual.maxInstructionsUtf8Bytes ||
    record.maxUserInputUtf8Bytes !== actual.maxUserInputUtf8Bytes ||
    record.maxTotalUtf8Bytes !== actual.maxTotalUtf8Bytes
  ) {
    invalid()
  }
  return actual
}

function parsePackage(value: unknown): AiChartD1FlyingPromptPackage {
  const record = requireAiChartD1ExactObject(value, PACKAGE_FIELDS)
  if (
    record.contractVersion !==
      AI_CHART_D1_FLYING_PROMPT_PACKAGE_VERSION ||
    record.promptVersion !== AI_CHART_D1_FLYING_PROMPT_VERSION ||
    record.task !== AI_CHART_D1_FLYING_PROMPT_PACKAGE_TASK ||
    record.outputContractVersion !==
      AI_CHART_D1_FLYING_INFLUENCE_RESULT_CONTRACT_VERSION ||
    record.outputSchemaName !==
      AI_CHART_D1_FLYING_INFLUENCE_RESULT_SCHEMA_NAME ||
    record.outputSchemaSha256 !==
      AI_CHART_D1_FLYING_OUTPUT_SCHEMA_SHA256 ||
    record.instructions !== AI_CHART_D1_FLYING_PROMPT_INSTRUCTIONS ||
    record.instructionsSha256 !==
      AI_CHART_D1_FLYING_PROMPT_INSTRUCTIONS_SHA256 ||
    record.promptStatus !== 'ready' ||
    record.adapterStatus !== 'adapter_bridge_required' ||
    parseAiChartD1Boolean(record.openAiCallable) !== false
  ) {
    invalid()
  }
  const userInput = parseCanonicalUserInput(record.userInput)
  if (
    parseSha(record.userInputSha256) !== hash(userInput)
  ) {
    invalid()
  }
  const packageValue = freezeAiChartD1Value({
    contractVersion: AI_CHART_D1_FLYING_PROMPT_PACKAGE_VERSION,
    promptVersion: AI_CHART_D1_FLYING_PROMPT_VERSION,
    task: AI_CHART_D1_FLYING_PROMPT_PACKAGE_TASK,
    chartId: parseAiChartD1Id(record.chartId),
    runId: parseAiChartD1Id(record.runId),
    callId: parseAiChartD1Id(record.callId),
    flyingModelInputRef: parseAiChartD1Id(
      record.flyingModelInputRef,
    ),
    flyingKnowledgeViewRef: parseAiChartD1Id(
      record.flyingKnowledgeViewRef,
    ),
    catalogId: parseAiChartD1Id(record.catalogId),
    catalogFingerprint: parseSha(record.catalogFingerprint),
    sourceManifestSha256: parseSha(record.sourceManifestSha256),
    outputContractVersion:
      AI_CHART_D1_FLYING_INFLUENCE_RESULT_CONTRACT_VERSION,
    outputSchemaName:
      AI_CHART_D1_FLYING_INFLUENCE_RESULT_SCHEMA_NAME,
    outputSchemaSha256: AI_CHART_D1_FLYING_OUTPUT_SCHEMA_SHA256,
    instructions: AI_CHART_D1_FLYING_PROMPT_INSTRUCTIONS,
    instructionsSha256:
      AI_CHART_D1_FLYING_PROMPT_INSTRUCTIONS_SHA256,
    userInput,
    userInputSha256: parseSha(record.userInputSha256),
    sourceTrace: parseSourceTrace(record.sourceTrace),
    budget: parseBudget(record.budget, userInput),
    promptStatus: 'ready' as const,
    adapterStatus: 'adapter_bridge_required' as const,
    openAiCallable: false as const,
    packageFingerprint: parseSha(record.packageFingerprint),
  })
  const {
    packageFingerprint: suppliedFingerprint,
    ...withoutFingerprint
  } = packageValue
  if (
    suppliedFingerprint !==
    packageFingerprint(withoutFingerprint)
  ) {
    invalid()
  }
  return packageValue
}

function parseCoverage(
  value: unknown,
): AiChartD1FlyingPromptPackageCoverage {
  const record = requireAiChartD1ExactObject(value, COVERAGE_FIELDS)
  return freezeAiChartD1Value({
    callIds: stringArray(record.callIds, 48),
    flyingModelInputRefs: stringArray(
      record.flyingModelInputRefs,
      48,
    ),
    flyingKnowledgeViewRefs: stringArray(
      record.flyingKnowledgeViewRefs,
      48,
    ),
    packageFingerprints: parseAiChartD1StringArray(
      record.packageFingerprints,
      {
        minimumItems: 48,
        maximumItems: 48,
        parseItem: parseSha,
      },
    ),
  })
}

export function parseAiChartD1FlyingPromptPackageSet(
  value: unknown,
): AiChartD1FlyingPromptPackageSet {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(value, SET_FIELDS)
    if (
      record.contractVersion !==
        AI_CHART_D1_FLYING_PROMPT_PACKAGE_SET_VERSION ||
      record.sourceModelInputSetVersion !==
        AI_CHART_D1_FLYING_MODEL_INPUT_SET_VERSION ||
      record.sourceKnowledgeViewSetVersion !==
        AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_SET_VERSION ||
      parseAiChartD1Boolean(record.openAiCallable) !== false ||
      record.validationStatus !== 'validated' ||
      !Array.isArray(record.packages) ||
      record.packages.length !== 48
    ) {
      invalid()
    }
    const packages = Object.freeze(record.packages.map(parsePackage))
    const chartId = parseAiChartD1Id(record.chartId)
    const runId = parseAiChartD1Id(record.runId)
    if (
      packages.some(
        (entry) =>
          entry.chartId !== chartId || entry.runId !== runId,
      ) ||
      new Set(packages.map((entry) => entry.callId)).size !== 48 ||
      new Set(packages.map((entry) => entry.packageFingerprint))
        .size !== 48
    ) {
      invalid()
    }
    const coverage = parseCoverage(record.coverage)
    if (
      JSON.stringify(coverage) !==
      JSON.stringify(expectedCoverage(packages))
    ) {
      invalid()
    }
    return freezeAiChartD1Value({
      contractVersion:
        AI_CHART_D1_FLYING_PROMPT_PACKAGE_SET_VERSION,
      chartId,
      runId,
      sourceModelInputSetVersion:
        AI_CHART_D1_FLYING_MODEL_INPUT_SET_VERSION,
      sourceKnowledgeViewSetVersion:
        AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_SET_VERSION,
      catalogId: parseAiChartD1Id(record.catalogId),
      catalogFingerprint: parseSha(record.catalogFingerprint),
      sourceManifestSha256: parseSha(record.sourceManifestSha256),
      packages,
      coverage,
      openAiCallable: false as const,
      validationStatus: 'validated' as const,
    })
  } catch (error) {
    if (error instanceof AiChartD1FlyingPromptPackageError) throw error
    invalid()
  }
}

export function buildAiChartD1FlyingPromptPackages(
  modelInputSetValue: unknown,
  knowledgeViewSetValue: unknown,
  catalogValue: unknown,
): AiChartD1FlyingPromptPackageSet {
  let inputSet: AiChartD1FlyingModelInputSet
  let knowledgeSet: AiChartD1FlyingKnowledgeViewSet
  try {
    inputSet = parseAiChartD1FlyingModelInputSet(modelInputSetValue)
    knowledgeSet =
      validateAiChartD1FlyingKnowledgeViewSetAgainstSources(
        knowledgeViewSetValue,
        inputSet,
        catalogValue,
      )
  } catch {
    invalid()
  }
  if (
    inputSet.chartId !== knowledgeSet.chartId ||
    inputSet.runId !== knowledgeSet.runId
  ) {
    invalid()
  }
  const packages = inputSet.inputs.map((modelInput, index) => {
    const knowledgeView = knowledgeSet.views[index]
    if (
      knowledgeView.flyingModelInputRef !==
        modelInput.flyingModelInputId ||
      knowledgeView.flyingFactRef !==
        modelInput.flyingFact.flyingFactId
    ) {
      invalid()
    }
    return buildOne(modelInput, knowledgeView, knowledgeSet)
  })
  return parseAiChartD1FlyingPromptPackageSet({
    contractVersion:
      AI_CHART_D1_FLYING_PROMPT_PACKAGE_SET_VERSION,
    chartId: inputSet.chartId,
    runId: inputSet.runId,
    sourceModelInputSetVersion: inputSet.contractVersion,
    sourceKnowledgeViewSetVersion: knowledgeSet.contractVersion,
    catalogId: knowledgeSet.catalogId,
    catalogFingerprint: knowledgeSet.catalogFingerprint,
    sourceManifestSha256: knowledgeSet.sourceManifestSha256,
    packages,
    coverage: expectedCoverage(packages),
    openAiCallable: false,
    validationStatus: 'validated',
  })
}

export function validateAiChartD1FlyingPromptPackageSetAgainstSources(
  value: unknown,
  modelInputSetValue: unknown,
  knowledgeViewSetValue: unknown,
  catalogValue: unknown,
): AiChartD1FlyingPromptPackageSet {
  const supplied = parseAiChartD1FlyingPromptPackageSet(value)
  const expected = buildAiChartD1FlyingPromptPackages(
    modelInputSetValue,
    knowledgeViewSetValue,
    catalogValue,
  )
  if (
    createAiChartD1FlyingCanonicalJson(supplied) !==
    createAiChartD1FlyingCanonicalJson(expected)
  ) {
    invalid()
  }
  return supplied
}

const ID_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 128,
  pattern: '^[A-Za-z0-9._:-]{1,128}$',
})
const SHA_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 64,
  pattern: SHA256_PATTERN.source,
})
const ID_ARRAY_SCHEMA = createAiChartD1ArraySchema(ID_SCHEMA, {
  minimumItems: 1,
  maximumItems: AI_CHART_D1_MAX_LIST_ITEMS,
})
const SOURCE_TRACE_SCHEMA = createAiChartD1StrictObjectSchema({
  flyingFactRef: ID_SCHEMA,
  sourcePalaceResultRef: ID_SCHEMA,
  targetPalaceResultRef: ID_SCHEMA,
  sourceActorBindingRefs: ID_ARRAY_SCHEMA,
  eligibleTargetFacetIds: ID_ARRAY_SCHEMA,
  knowledgeRuleRefs: ID_ARRAY_SCHEMA,
  sourcePalaceMeaningRefs: ID_ARRAY_SCHEMA,
  targetPalaceMeaningRefs: ID_ARRAY_SCHEMA,
})
const BUDGET_SCHEMA = createAiChartD1StrictObjectSchema({
  measurement: freezeAiChartD1Value({ const: 'utf8_bytes' }),
  instructionsUtf8Bytes: freezeAiChartD1Value({
    type: 'integer',
    minimum: 0,
    maximum: AI_CHART_D1_FLYING_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES,
  }),
  userInputUtf8Bytes: freezeAiChartD1Value({
    type: 'integer',
    minimum: 0,
    maximum: AI_CHART_D1_FLYING_PROMPT_MAX_USER_INPUT_UTF8_BYTES,
  }),
  totalUtf8Bytes: freezeAiChartD1Value({
    type: 'integer',
    minimum: 0,
    maximum: AI_CHART_D1_FLYING_PROMPT_MAX_TOTAL_UTF8_BYTES,
  }),
  maxInstructionsUtf8Bytes: freezeAiChartD1Value({
    const: AI_CHART_D1_FLYING_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES,
  }),
  maxUserInputUtf8Bytes: freezeAiChartD1Value({
    const: AI_CHART_D1_FLYING_PROMPT_MAX_USER_INPUT_UTF8_BYTES,
  }),
  maxTotalUtf8Bytes: freezeAiChartD1Value({
    const: AI_CHART_D1_FLYING_PROMPT_MAX_TOTAL_UTF8_BYTES,
  }),
  status: freezeAiChartD1Value({ const: 'within_budget' }),
})
const PACKAGE_SCHEMA = createAiChartD1StrictObjectSchema({
  contractVersion: freezeAiChartD1Value({
    const: AI_CHART_D1_FLYING_PROMPT_PACKAGE_VERSION,
  }),
  promptVersion: freezeAiChartD1Value({
    const: AI_CHART_D1_FLYING_PROMPT_VERSION,
  }),
  task: freezeAiChartD1Value({
    const: AI_CHART_D1_FLYING_PROMPT_PACKAGE_TASK,
  }),
  chartId: ID_SCHEMA,
  runId: ID_SCHEMA,
  callId: ID_SCHEMA,
  flyingModelInputRef: ID_SCHEMA,
  flyingKnowledgeViewRef: ID_SCHEMA,
  catalogId: ID_SCHEMA,
  catalogFingerprint: SHA_SCHEMA,
  sourceManifestSha256: SHA_SCHEMA,
  outputContractVersion: freezeAiChartD1Value({
    const: AI_CHART_D1_FLYING_INFLUENCE_RESULT_CONTRACT_VERSION,
  }),
  outputSchemaName: freezeAiChartD1Value({
    const: AI_CHART_D1_FLYING_INFLUENCE_RESULT_SCHEMA_NAME,
  }),
  outputSchemaSha256: SHA_SCHEMA,
  instructions: createAiChartD1StringSchema({
    maximumLength:
      AI_CHART_D1_FLYING_PROMPT_MAX_INSTRUCTIONS_UTF8_BYTES,
  }),
  instructionsSha256: SHA_SCHEMA,
  userInput: createAiChartD1StringSchema({
    maximumLength:
      AI_CHART_D1_FLYING_PROMPT_MAX_USER_INPUT_UTF8_BYTES,
  }),
  userInputSha256: SHA_SCHEMA,
  sourceTrace: SOURCE_TRACE_SCHEMA,
  budget: BUDGET_SCHEMA,
  promptStatus: freezeAiChartD1Value({ const: 'ready' }),
  adapterStatus: freezeAiChartD1Value({
    const: 'adapter_bridge_required',
  }),
  openAiCallable: freezeAiChartD1Value({ const: false }),
  packageFingerprint: SHA_SCHEMA,
})
const COVERAGE_SCHEMA = createAiChartD1StrictObjectSchema({
  callIds: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 48,
    maximumItems: 48,
  }),
  flyingModelInputRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 48,
    maximumItems: 48,
  }),
  flyingKnowledgeViewRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 48,
    maximumItems: 48,
  }),
  packageFingerprints: createAiChartD1ArraySchema(SHA_SCHEMA, {
    minimumItems: 48,
    maximumItems: 48,
  }),
})

export const AI_CHART_D1_FLYING_PROMPT_PACKAGE_SET_JSON_SCHEMA:
  AiChartD1JsonSchema = createAiChartD1StrictObjectSchema({
    contractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_FLYING_PROMPT_PACKAGE_SET_VERSION,
    }),
    chartId: ID_SCHEMA,
    runId: ID_SCHEMA,
    sourceModelInputSetVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_FLYING_MODEL_INPUT_SET_VERSION,
    }),
    sourceKnowledgeViewSetVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_SET_VERSION,
    }),
    catalogId: ID_SCHEMA,
    catalogFingerprint: SHA_SCHEMA,
    sourceManifestSha256: SHA_SCHEMA,
    packages: createAiChartD1ArraySchema(PACKAGE_SCHEMA, {
      minimumItems: 48,
      maximumItems: 48,
    }),
    coverage: COVERAGE_SCHEMA,
    openAiCallable: freezeAiChartD1Value({ const: false }),
    validationStatus: freezeAiChartD1Value({
      const: 'validated',
    }),
  })
