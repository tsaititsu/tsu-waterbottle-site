import {
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
  AI_CHART_D1_FLYING_FACT_SET_VERSION,
  validateAiChartD1FlyingFactSetAgainstN0,
  type AiChartD1FlyingFactSet,
} from './d1FlyingFactSource'
import {
  AI_CHART_D1_FLYING_FACT_JSON_SCHEMA,
  AI_CHART_D1_FLYING_TRANSFORMATION_KINDS,
  parseAiChartD1FlyingFact,
  type AiChartD1FlyingFact,
} from './d1FlyingInfluenceContracts'
import {
  AI_CHART_D1_PALACE_IDENTITIES,
  type AiChartD1PalaceId,
} from './d1N0Constants'
import {
  AI_CHART_D1_PALACE_REASONING_RESULT_CONTRACT_VERSION,
  AI_CHART_D1_PALACE_REASONING_RESULT_JSON_SCHEMA,
  parseAiChartD1PalaceReasoningResult,
  type AiChartD1PalaceReasoningResult,
} from './d1PalaceIntegrationContracts'
import {
  AI_CHART_D1_PALACE_FACET_IDS,
  AI_CHART_D1_PALACE_FACET_REGISTRY,
  isAiChartD1PalaceFacetAllowed,
  type AiChartD1PalaceFacetId,
} from './d1PalaceFacetRegistry'

export const AI_CHART_D1_FLYING_MODEL_INPUT_VERSION =
  'ai-chart-d1-flying-model-input/v1' as const
export const AI_CHART_D1_FLYING_MODEL_INPUT_SET_VERSION =
  'ai-chart-d1-flying-model-input-set/v1' as const
export const AI_CHART_D1_FLYING_MODEL_INPUT_SET_SCHEMA_NAME =
  'ai_chart_d1_flying_model_input_set_v1' as const
export const AI_CHART_D1_FLYING_MODEL_INPUT_INVALID =
  'ai_chart_d1_flying_model_input_invalid' as const

export const AI_CHART_D1_FLYING_MODEL_INPUT_VALIDATION_REASONS =
  Object.freeze([
    'INPUT_SET_SHAPE_INVALID',
    'FACT_SET_MISMATCH',
    'PALACE_RESULT_SET_INVALID',
    'PALACE_RESULT_IDENTITY_MISMATCH',
    'INPUT_SET_MISMATCH',
  ] as const)

export type AiChartD1FlyingModelInputValidationReason =
  (typeof AI_CHART_D1_FLYING_MODEL_INPUT_VALIDATION_REASONS)[number]

export type AiChartD1FlyingModelInput = Readonly<{
  contractVersion: typeof AI_CHART_D1_FLYING_MODEL_INPUT_VERSION
  flyingModelInputId: string
  chartId: string
  runId: string
  flyingFact: AiChartD1FlyingFact
  sourcePalaceResult: AiChartD1PalaceReasoningResult
  targetPalaceResult: AiChartD1PalaceReasoningResult
  eligibleTargetFacetIds: readonly AiChartD1PalaceFacetId[]
  openAiCallable: false
  validationStatus: 'validated'
}>

export type AiChartD1FlyingModelInputCoverage = Readonly<{
  flyingModelInputIds: readonly string[]
  flyingFactRefs: readonly string[]
  authoritativeInfluenceIds: readonly string[]
  sourcePalaceIds: readonly AiChartD1PalaceId[]
  targetPalaceIds: readonly AiChartD1PalaceId[]
  palaceResultRefs: readonly string[]
}>

export type AiChartD1FlyingModelInputSet = Readonly<{
  contractVersion: typeof AI_CHART_D1_FLYING_MODEL_INPUT_SET_VERSION
  chartId: string
  runId: string
  sourceFactSetVersion: typeof AI_CHART_D1_FLYING_FACT_SET_VERSION
  sourcePalaceResultContractVersion:
    typeof AI_CHART_D1_PALACE_REASONING_RESULT_CONTRACT_VERSION
  inputs: readonly AiChartD1FlyingModelInput[]
  coverage: AiChartD1FlyingModelInputCoverage
  openAiCallable: false
  validationStatus: 'validated'
}>

export class AiChartD1FlyingModelInputError extends Error {
  readonly code = AI_CHART_D1_FLYING_MODEL_INPUT_INVALID
  declare readonly reasonCode: AiChartD1FlyingModelInputValidationReason

  constructor(reasonCode: AiChartD1FlyingModelInputValidationReason) {
    super(AI_CHART_D1_FLYING_MODEL_INPUT_INVALID)
    this.name = 'AiChartD1FlyingModelInputError'
    Object.defineProperty(this, 'reasonCode', {
      value: reasonCode,
      enumerable: true,
      writable: false,
      configurable: false,
    })
    Object.freeze(this)
  }
}

const INPUT_FIELDS = Object.freeze([
  'contractVersion',
  'flyingModelInputId',
  'chartId',
  'runId',
  'flyingFact',
  'sourcePalaceResult',
  'targetPalaceResult',
  'eligibleTargetFacetIds',
  'openAiCallable',
  'validationStatus',
] as const)
const COVERAGE_FIELDS = Object.freeze([
  'flyingModelInputIds',
  'flyingFactRefs',
  'authoritativeInfluenceIds',
  'sourcePalaceIds',
  'targetPalaceIds',
  'palaceResultRefs',
] as const)
const INPUT_SET_FIELDS = Object.freeze([
  'contractVersion',
  'chartId',
  'runId',
  'sourceFactSetVersion',
  'sourcePalaceResultContractVersion',
  'inputs',
  'coverage',
  'openAiCallable',
  'validationStatus',
] as const)

function invalid(
  reasonCode: AiChartD1FlyingModelInputValidationReason,
): never {
  throw new AiChartD1FlyingModelInputError(reasonCode)
}

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function collectUnique<T extends string>(
  values: readonly T[],
): readonly T[] {
  return Object.freeze([...new Set(values)])
}

function targetFacets(
  palaceId: AiChartD1PalaceId,
): readonly AiChartD1PalaceFacetId[] {
  const entry = AI_CHART_D1_PALACE_FACET_REGISTRY.find(
    (candidate) => candidate.palaceId === palaceId,
  )
  if (entry === undefined) invalid('INPUT_SET_SHAPE_INVALID')
  return Object.freeze([...entry.facetIds])
}

function parsePalaceIdArray(
  value: unknown,
  minimumItems: number,
  maximumItems: number,
): readonly AiChartD1PalaceId[] {
  return parseAiChartD1StringArray(value, {
    minimumItems,
    maximumItems,
    parseItem: (item) =>
      parseAiChartD1Enum(
        item,
        AI_CHART_D1_PALACE_IDENTITIES.map(
          (identity) => identity.palaceId,
        ),
      ),
  }) as readonly AiChartD1PalaceId[]
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

function parsePalaceResultSet(
  value: unknown,
  chartId: string,
): readonly AiChartD1PalaceReasoningResult[] {
  if (!Array.isArray(value) || value.length !== 12) {
    invalid('PALACE_RESULT_SET_INVALID')
  }
  let results: readonly AiChartD1PalaceReasoningResult[]
  try {
    results = Object.freeze(
      value.map(parseAiChartD1PalaceReasoningResult),
    )
  } catch {
    invalid('PALACE_RESULT_SET_INVALID')
  }
  for (let index = 0; index < results.length; index += 1) {
    if (
      results[index].targetPalaceId !==
      AI_CHART_D1_PALACE_IDENTITIES[index].palaceId
    ) {
      invalid('PALACE_RESULT_SET_INVALID')
    }
  }
  if (
    new Set(results.map((result) => result.palaceResultId)).size !== 12
  ) {
    invalid('PALACE_RESULT_SET_INVALID')
  }
  const runId = results[0].runId
  if (
    results.some(
      (result) => result.chartId !== chartId || result.runId !== runId,
    )
  ) {
    invalid('PALACE_RESULT_IDENTITY_MISMATCH')
  }
  return results
}

function parseEligibleTargetFacets(
  value: unknown,
  targetPalaceId: AiChartD1PalaceId,
): readonly AiChartD1PalaceFacetId[] {
  const parsed = parseAiChartD1StringArray(value, {
    minimumItems: 1,
    maximumItems: AI_CHART_D1_PALACE_FACET_IDS.length,
    parseItem: (item) => {
      const facetId = parseAiChartD1Enum(
        item,
        AI_CHART_D1_PALACE_FACET_IDS,
      )
      if (!isAiChartD1PalaceFacetAllowed(targetPalaceId, facetId)) {
        invalid('INPUT_SET_SHAPE_INVALID')
      }
      return facetId
    },
  }) as readonly AiChartD1PalaceFacetId[]
  if (!sameStrings(parsed, targetFacets(targetPalaceId))) {
    invalid('INPUT_SET_SHAPE_INVALID')
  }
  return parsed
}

function parseModelInput(value: unknown): AiChartD1FlyingModelInput {
  const record = requireAiChartD1ExactObject(value, INPUT_FIELDS)
  if (
    record.contractVersion !== AI_CHART_D1_FLYING_MODEL_INPUT_VERSION ||
    parseAiChartD1Boolean(record.openAiCallable) !== false ||
    record.validationStatus !== 'validated'
  ) {
    invalid('INPUT_SET_SHAPE_INVALID')
  }
  let flyingFact: AiChartD1FlyingFact
  let sourcePalaceResult: AiChartD1PalaceReasoningResult
  let targetPalaceResult: AiChartD1PalaceReasoningResult
  try {
    flyingFact = parseAiChartD1FlyingFact(record.flyingFact)
    sourcePalaceResult = parseAiChartD1PalaceReasoningResult(
      record.sourcePalaceResult,
    )
    targetPalaceResult = parseAiChartD1PalaceReasoningResult(
      record.targetPalaceResult,
    )
  } catch {
    invalid('INPUT_SET_SHAPE_INVALID')
  }
  const chartId = parseAiChartD1Id(record.chartId)
  const runId = parseAiChartD1Id(record.runId)
  const expectedInputId =
    `flying-model-input:${flyingFact.sourcePalaceId}:` +
    flyingFact.transformationKind.toLowerCase()
  if (
    parseAiChartD1Id(record.flyingModelInputId) !== expectedInputId ||
    chartId !== flyingFact.chartId ||
    chartId !== sourcePalaceResult.chartId ||
    chartId !== targetPalaceResult.chartId ||
    runId !== sourcePalaceResult.runId ||
    runId !== targetPalaceResult.runId ||
    sourcePalaceResult.targetPalaceId !== flyingFact.sourcePalaceId ||
    targetPalaceResult.targetPalaceId !== flyingFact.targetPalaceId
  ) {
    invalid('INPUT_SET_SHAPE_INVALID')
  }
  return freezeAiChartD1Value({
    contractVersion: AI_CHART_D1_FLYING_MODEL_INPUT_VERSION,
    flyingModelInputId: expectedInputId,
    chartId,
    runId,
    flyingFact,
    sourcePalaceResult,
    targetPalaceResult,
    eligibleTargetFacetIds: parseEligibleTargetFacets(
      record.eligibleTargetFacetIds,
      flyingFact.targetPalaceId,
    ),
    openAiCallable: false as const,
    validationStatus: 'validated' as const,
  })
}

function parseCoverage(
  value: unknown,
): AiChartD1FlyingModelInputCoverage {
  const record = requireAiChartD1ExactObject(value, COVERAGE_FIELDS)
  return freezeAiChartD1Value({
    flyingModelInputIds: parseIdArray(record.flyingModelInputIds, 48, 48),
    flyingFactRefs: parseIdArray(record.flyingFactRefs, 48, 48),
    authoritativeInfluenceIds: parseIdArray(
      record.authoritativeInfluenceIds,
      48,
      48,
    ),
    sourcePalaceIds: parsePalaceIdArray(
      record.sourcePalaceIds,
      12,
      12,
    ),
    targetPalaceIds: parsePalaceIdArray(
      record.targetPalaceIds,
      1,
      12,
    ),
    palaceResultRefs: parseIdArray(record.palaceResultRefs, 12, 12),
  })
}

function expectedCoverage(
  inputs: readonly AiChartD1FlyingModelInput[],
): AiChartD1FlyingModelInputCoverage {
  const resultsByPalace = new Map<
    AiChartD1PalaceId,
    AiChartD1PalaceReasoningResult
  >()
  for (const input of inputs) {
    for (const result of [
      input.sourcePalaceResult,
      input.targetPalaceResult,
    ]) {
      const existing = resultsByPalace.get(result.targetPalaceId)
      if (
        existing !== undefined &&
        JSON.stringify(existing) !== JSON.stringify(result)
      ) {
        invalid('INPUT_SET_SHAPE_INVALID')
      }
      resultsByPalace.set(result.targetPalaceId, result)
    }
  }
  if (resultsByPalace.size !== 12) invalid('INPUT_SET_SHAPE_INVALID')
  return freezeAiChartD1Value({
    flyingModelInputIds: inputs.map(
      (input) => input.flyingModelInputId,
    ),
    flyingFactRefs: inputs.map(
      (input) => input.flyingFact.flyingFactId,
    ),
    authoritativeInfluenceIds: inputs.map(
      (input) => input.flyingFact.authoritativeInfluenceId,
    ),
    sourcePalaceIds: AI_CHART_D1_PALACE_IDENTITIES.map(
      (identity) => identity.palaceId,
    ),
    targetPalaceIds: collectUnique(
      inputs.map((input) => input.flyingFact.targetPalaceId),
    ),
    palaceResultRefs: AI_CHART_D1_PALACE_IDENTITIES.map((identity) => {
      const result = resultsByPalace.get(identity.palaceId)
      if (result === undefined) invalid('INPUT_SET_SHAPE_INVALID')
      return result.palaceResultId
    }),
  })
}

function validateInputOrder(
  inputs: readonly AiChartD1FlyingModelInput[],
): void {
  let index = 0
  for (const identity of AI_CHART_D1_PALACE_IDENTITIES) {
    for (const transformationKind of AI_CHART_D1_FLYING_TRANSFORMATION_KINDS) {
      const fact = inputs[index]?.flyingFact
      if (
        fact?.sourcePalaceId !== identity.palaceId ||
        fact.transformationKind !== transformationKind
      ) {
        invalid('INPUT_SET_SHAPE_INVALID')
      }
      index += 1
    }
  }
}

export function parseAiChartD1FlyingModelInputSet(
  value: unknown,
): AiChartD1FlyingModelInputSet {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(
      value,
      INPUT_SET_FIELDS,
    )
    if (
      record.contractVersion !==
        AI_CHART_D1_FLYING_MODEL_INPUT_SET_VERSION ||
      record.sourceFactSetVersion !==
        AI_CHART_D1_FLYING_FACT_SET_VERSION ||
      record.sourcePalaceResultContractVersion !==
        AI_CHART_D1_PALACE_REASONING_RESULT_CONTRACT_VERSION ||
      parseAiChartD1Boolean(record.openAiCallable) !== false ||
      record.validationStatus !== 'validated' ||
      !Array.isArray(record.inputs) ||
      record.inputs.length !== 48
    ) {
      invalid('INPUT_SET_SHAPE_INVALID')
    }
    const inputs = Object.freeze(record.inputs.map(parseModelInput))
    validateInputOrder(inputs)
    if (
      new Set(inputs.map((input) => input.flyingModelInputId)).size !==
        48 ||
      new Set(inputs.map((input) => input.flyingFact.flyingFactId))
        .size !== 48 ||
      new Set(
        inputs.map(
          (input) => input.flyingFact.authoritativeInfluenceId,
        ),
      ).size !== 48
    ) {
      invalid('INPUT_SET_SHAPE_INVALID')
    }
    const chartId = parseAiChartD1Id(record.chartId)
    const runId = parseAiChartD1Id(record.runId)
    if (
      inputs.some(
        (input) =>
          input.chartId !== chartId || input.runId !== runId,
      )
    ) {
      invalid('INPUT_SET_SHAPE_INVALID')
    }
    const coverage = parseCoverage(record.coverage)
    if (
      JSON.stringify(coverage) !==
      JSON.stringify(expectedCoverage(inputs))
    ) {
      invalid('INPUT_SET_SHAPE_INVALID')
    }
    return freezeAiChartD1Value({
      contractVersion: AI_CHART_D1_FLYING_MODEL_INPUT_SET_VERSION,
      chartId,
      runId,
      sourceFactSetVersion: AI_CHART_D1_FLYING_FACT_SET_VERSION,
      sourcePalaceResultContractVersion:
        AI_CHART_D1_PALACE_REASONING_RESULT_CONTRACT_VERSION,
      inputs,
      coverage,
      openAiCallable: false as const,
      validationStatus: 'validated' as const,
    })
  } catch (error) {
    if (error instanceof AiChartD1FlyingModelInputError) throw error
    invalid('INPUT_SET_SHAPE_INVALID')
  }
}

function parseTrustedFactSet(
  factSetValue: unknown,
  n0Value: unknown,
): AiChartD1FlyingFactSet {
  try {
    return validateAiChartD1FlyingFactSetAgainstN0(
      factSetValue,
      n0Value,
    )
  } catch {
    invalid('FACT_SET_MISMATCH')
  }
}

export function buildAiChartD1FlyingModelInputs(
  n0Value: unknown,
  factSetValue: unknown,
  palaceResultValues: unknown,
): AiChartD1FlyingModelInputSet {
  const factSet = parseTrustedFactSet(factSetValue, n0Value)
  const palaceResults = parsePalaceResultSet(
    palaceResultValues,
    factSet.chartId,
  )
  const resultsByPalace = new Map(
    palaceResults.map((result) => [result.targetPalaceId, result]),
  )
  const runId = palaceResults[0].runId
  const inputs = factSet.facts.map((flyingFact) => {
    const sourcePalaceResult = resultsByPalace.get(
      flyingFact.sourcePalaceId,
    )
    const targetPalaceResult = resultsByPalace.get(
      flyingFact.targetPalaceId,
    )
    if (
      sourcePalaceResult === undefined ||
      targetPalaceResult === undefined
    ) {
      invalid('PALACE_RESULT_SET_INVALID')
    }
    return {
      contractVersion: AI_CHART_D1_FLYING_MODEL_INPUT_VERSION,
      flyingModelInputId:
        `flying-model-input:${flyingFact.sourcePalaceId}:` +
        flyingFact.transformationKind.toLowerCase(),
      chartId: factSet.chartId,
      runId,
      flyingFact,
      sourcePalaceResult,
      targetPalaceResult,
      eligibleTargetFacetIds: targetFacets(
        flyingFact.targetPalaceId,
      ),
      openAiCallable: false,
      validationStatus: 'validated',
    }
  })
  const parsedInputs = inputs.map(parseModelInput)
  return parseAiChartD1FlyingModelInputSet({
    contractVersion: AI_CHART_D1_FLYING_MODEL_INPUT_SET_VERSION,
    chartId: factSet.chartId,
    runId,
    sourceFactSetVersion: factSet.contractVersion,
    sourcePalaceResultContractVersion:
      AI_CHART_D1_PALACE_REASONING_RESULT_CONTRACT_VERSION,
    inputs: parsedInputs,
    coverage: expectedCoverage(parsedInputs),
    openAiCallable: false,
    validationStatus: 'validated',
  })
}

export function validateAiChartD1FlyingModelInputSetAgainstSources(
  value: unknown,
  n0Value: unknown,
  factSetValue: unknown,
  palaceResultValues: unknown,
): AiChartD1FlyingModelInputSet {
  const supplied = parseAiChartD1FlyingModelInputSet(value)
  const expected = buildAiChartD1FlyingModelInputs(
    n0Value,
    factSetValue,
    palaceResultValues,
  )
  if (JSON.stringify(supplied) !== JSON.stringify(expected)) {
    invalid('INPUT_SET_MISMATCH')
  }
  return supplied
}

const ID_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 128,
  pattern: '^[A-Za-z0-9._:-]{1,128}$',
})
const PALACE_ID_SCHEMA = createAiChartD1StringSchema({
  enumValues: AI_CHART_D1_PALACE_IDENTITIES.map(
    (identity) => identity.palaceId,
  ),
})
const FACET_ID_SCHEMA = createAiChartD1StringSchema({
  enumValues: AI_CHART_D1_PALACE_FACET_IDS,
})

export const AI_CHART_D1_FLYING_MODEL_INPUT_JSON_SCHEMA: AiChartD1JsonSchema =
  createAiChartD1StrictObjectSchema({
    contractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_FLYING_MODEL_INPUT_VERSION,
    }),
    flyingModelInputId: ID_SCHEMA,
    chartId: ID_SCHEMA,
    runId: ID_SCHEMA,
    flyingFact: AI_CHART_D1_FLYING_FACT_JSON_SCHEMA,
    sourcePalaceResult:
      AI_CHART_D1_PALACE_REASONING_RESULT_JSON_SCHEMA,
    targetPalaceResult:
      AI_CHART_D1_PALACE_REASONING_RESULT_JSON_SCHEMA,
    eligibleTargetFacetIds: createAiChartD1ArraySchema(
      FACET_ID_SCHEMA,
      {
        minimumItems: 1,
        maximumItems: AI_CHART_D1_PALACE_FACET_IDS.length,
      },
    ),
    openAiCallable: freezeAiChartD1Value({
      const: false,
    }),
    validationStatus: freezeAiChartD1Value({
      const: 'validated',
    }),
  })

const COVERAGE_JSON_SCHEMA = createAiChartD1StrictObjectSchema({
  flyingModelInputIds: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 48,
    maximumItems: 48,
  }),
  flyingFactRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 48,
    maximumItems: 48,
  }),
  authoritativeInfluenceIds: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 48,
    maximumItems: 48,
  }),
  sourcePalaceIds: createAiChartD1ArraySchema(PALACE_ID_SCHEMA, {
    minimumItems: 12,
    maximumItems: 12,
  }),
  targetPalaceIds: createAiChartD1ArraySchema(PALACE_ID_SCHEMA, {
    minimumItems: 1,
    maximumItems: 12,
  }),
  palaceResultRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 12,
    maximumItems: 12,
  }),
})

export const AI_CHART_D1_FLYING_MODEL_INPUT_SET_JSON_SCHEMA: AiChartD1JsonSchema =
  createAiChartD1StrictObjectSchema({
    contractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_FLYING_MODEL_INPUT_SET_VERSION,
    }),
    chartId: ID_SCHEMA,
    runId: ID_SCHEMA,
    sourceFactSetVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_FLYING_FACT_SET_VERSION,
    }),
    sourcePalaceResultContractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_PALACE_REASONING_RESULT_CONTRACT_VERSION,
    }),
    inputs: createAiChartD1ArraySchema(
      AI_CHART_D1_FLYING_MODEL_INPUT_JSON_SCHEMA,
      {
        minimumItems: 48,
        maximumItems: 48,
      },
    ),
    coverage: COVERAGE_JSON_SCHEMA,
    openAiCallable: freezeAiChartD1Value({
      const: false,
    }),
    validationStatus: freezeAiChartD1Value({
      const: 'validated',
    }),
  })
