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
  AI_CHART_D1_FLYING_INFLUENCE_RESULT_JSON_SCHEMA,
  parseAiChartD1FlyingInfluenceResult,
  type AiChartD1FlyingInfluenceResult,
} from './d1FlyingInfluenceContracts'
import {
  AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_SET_VERSION,
  validateAiChartD1FlyingKnowledgeViewSetAgainstSources,
  type AiChartD1FlyingKnowledgeViewSet,
} from './d1FlyingKnowledgeContracts'
import {
  AI_CHART_D1_FLYING_MODEL_INPUT_SET_VERSION,
  parseAiChartD1FlyingModelInputSet,
  type AiChartD1FlyingModelInputSet,
} from './d1FlyingModelInputContracts'
import { validateAiChartD1FlyingInfluenceResultAgainstKnowledgeSources } from './d1FlyingResultBindings'
import {
  AI_CHART_D1_PALACE_IDENTITIES,
  type AiChartD1PalaceId,
} from './d1N0Constants'

export const AI_CHART_D1_FLYING_PALACE_INTEGRATION_VERSION =
  'ai-chart-d1-flying-palace-integration/v1' as const
export const AI_CHART_D1_FLYING_PALACE_INTEGRATION_SCHEMA_NAME =
  'ai_chart_d1_flying_palace_integration_v1' as const
export const AI_CHART_D1_FLYING_PALACE_INTEGRATION_INVALID =
  'ai_chart_d1_flying_palace_integration_invalid' as const

export const AI_CHART_D1_FLYING_INTEGRATION_POLICY =
  freezeAiChartD1Value({
    preserveEveryDirectedInfluence: true,
    preserveCoexistingPossibilities: true,
    netting: 'FORBIDDEN',
    dominanceSelection: 'FORBIDDEN',
    customerWriting: 'NOT_PERFORMED',
  } as const)

export const AI_CHART_D1_FLYING_PALACE_INTEGRATION_REASONS =
  Object.freeze([
    'RESULT_SET_SHAPE_INVALID',
    'SOURCE_BINDING_INVALID',
    'COVERAGE_MISMATCH',
  ] as const)

export type AiChartD1FlyingPalaceIntegrationReason =
  (typeof AI_CHART_D1_FLYING_PALACE_INTEGRATION_REASONS)[number]

export type AiChartD1FlyingPalaceEntry = Readonly<{
  targetPalaceId: AiChartD1PalaceId
  influences: readonly AiChartD1FlyingInfluenceResult[]
}>

export type AiChartD1FlyingPalaceIntegrationCoverage = Readonly<{
  flyingInfluenceRefs: readonly string[]
  flyingFactRefs: readonly string[]
  sourcePalaceIds: readonly AiChartD1PalaceId[]
  targetPalaceIds: readonly AiChartD1PalaceId[]
}>

export type AiChartD1FlyingPalaceIntegration = Readonly<{
  contractVersion:
    typeof AI_CHART_D1_FLYING_PALACE_INTEGRATION_VERSION
  chartId: string
  runId: string
  sourceModelInputSetVersion:
    typeof AI_CHART_D1_FLYING_MODEL_INPUT_SET_VERSION
  sourceKnowledgeViewSetVersion:
    typeof AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_SET_VERSION
  catalogId: string
  catalogFingerprint: string
  sourceManifestSha256: string
  palaces: readonly AiChartD1FlyingPalaceEntry[]
  integrationPolicy: typeof AI_CHART_D1_FLYING_INTEGRATION_POLICY
  coverage: AiChartD1FlyingPalaceIntegrationCoverage
  openAiCallable: false
  validationStatus: 'validated'
}>

export class AiChartD1FlyingPalaceIntegrationError extends Error {
  readonly code = AI_CHART_D1_FLYING_PALACE_INTEGRATION_INVALID
  declare readonly reasonCode: AiChartD1FlyingPalaceIntegrationReason

  constructor(reasonCode: AiChartD1FlyingPalaceIntegrationReason) {
    super(AI_CHART_D1_FLYING_PALACE_INTEGRATION_INVALID)
    this.name = 'AiChartD1FlyingPalaceIntegrationError'
    Object.defineProperty(this, 'reasonCode', {
      value: reasonCode,
      enumerable: true,
      writable: false,
      configurable: false,
    })
    Object.freeze(this)
  }
}

const PALACE_FIELDS = Object.freeze([
  'targetPalaceId',
  'influences',
] as const)
const POLICY_FIELDS = Object.freeze([
  'preserveEveryDirectedInfluence',
  'preserveCoexistingPossibilities',
  'netting',
  'dominanceSelection',
  'customerWriting',
] as const)
const COVERAGE_FIELDS = Object.freeze([
  'flyingInfluenceRefs',
  'flyingFactRefs',
  'sourcePalaceIds',
  'targetPalaceIds',
] as const)
const INTEGRATION_FIELDS = Object.freeze([
  'contractVersion',
  'chartId',
  'runId',
  'sourceModelInputSetVersion',
  'sourceKnowledgeViewSetVersion',
  'catalogId',
  'catalogFingerprint',
  'sourceManifestSha256',
  'palaces',
  'integrationPolicy',
  'coverage',
  'openAiCallable',
  'validationStatus',
] as const)
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const PALACE_IDS = AI_CHART_D1_PALACE_IDENTITIES.map(
  (identity) => identity.palaceId,
)

function invalid(
  reasonCode: AiChartD1FlyingPalaceIntegrationReason,
): never {
  throw new AiChartD1FlyingPalaceIntegrationError(reasonCode)
}

function parseSha(value: unknown): string {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    invalid('RESULT_SET_SHAPE_INVALID')
  }
  return value
}

function parsePalaceId(value: unknown): AiChartD1PalaceId {
  try {
    return parseAiChartD1Enum(value, PALACE_IDS)
  } catch {
    invalid('RESULT_SET_SHAPE_INVALID')
  }
}

function parsePalaceIdArray(
  value: unknown,
  minimumItems: number,
  maximumItems: number,
): readonly AiChartD1PalaceId[] {
  return parseAiChartD1StringArray(value, {
    minimumItems,
    maximumItems,
    parseItem: parsePalaceId,
  }) as readonly AiChartD1PalaceId[]
}

function parseIdArray(
  value: unknown,
  expectedItems: number,
): readonly string[] {
  return parseAiChartD1StringArray(value, {
    minimumItems: expectedItems,
    maximumItems: expectedItems,
    parseItem: parseAiChartD1Id,
  })
}

function parsePolicy(
  value: unknown,
): typeof AI_CHART_D1_FLYING_INTEGRATION_POLICY {
  requireAiChartD1ExactObject(value, POLICY_FIELDS)
  if (
    JSON.stringify(value) !==
    JSON.stringify(AI_CHART_D1_FLYING_INTEGRATION_POLICY)
  ) {
    invalid('RESULT_SET_SHAPE_INVALID')
  }
  return AI_CHART_D1_FLYING_INTEGRATION_POLICY
}

function parsePalaceEntry(
  value: unknown,
): AiChartD1FlyingPalaceEntry {
  const record = requireAiChartD1ExactObject(value, PALACE_FIELDS)
  if (
    !Array.isArray(record.influences) ||
    record.influences.length > 48
  ) {
    invalid('RESULT_SET_SHAPE_INVALID')
  }
  let influences: readonly AiChartD1FlyingInfluenceResult[]
  try {
    influences = Object.freeze(
      record.influences.map(parseAiChartD1FlyingInfluenceResult),
    )
  } catch {
    invalid('RESULT_SET_SHAPE_INVALID')
  }
  const targetPalaceId = parsePalaceId(record.targetPalaceId)
  if (
    influences.some(
      (influence) => influence.targetPalaceId !== targetPalaceId,
    )
  ) {
    invalid('RESULT_SET_SHAPE_INVALID')
  }
  return freezeAiChartD1Value({
    targetPalaceId,
    influences,
  })
}

function expectedCoverage(
  palaces: readonly AiChartD1FlyingPalaceEntry[],
): AiChartD1FlyingPalaceIntegrationCoverage {
  const influences = palaces.flatMap((entry) => entry.influences)
  const sourcePalaceSet = new Set(
    influences.map((influence) => influence.sourcePalaceId),
  )
  return freezeAiChartD1Value({
    flyingInfluenceRefs: influences.map(
      (influence) => influence.flyingInfluenceId,
    ),
    flyingFactRefs: influences.map(
      (influence) => influence.flyingFactRef,
    ),
    sourcePalaceIds: PALACE_IDS.filter((palaceId) =>
      sourcePalaceSet.has(palaceId),
    ),
    targetPalaceIds: [...PALACE_IDS],
  })
}

function parseCoverage(
  value: unknown,
): AiChartD1FlyingPalaceIntegrationCoverage {
  const record = requireAiChartD1ExactObject(value, COVERAGE_FIELDS)
  return freezeAiChartD1Value({
    flyingInfluenceRefs: parseIdArray(
      record.flyingInfluenceRefs,
      48,
    ),
    flyingFactRefs: parseIdArray(record.flyingFactRefs, 48),
    sourcePalaceIds: parsePalaceIdArray(
      record.sourcePalaceIds,
      12,
      12,
    ),
    targetPalaceIds: parsePalaceIdArray(
      record.targetPalaceIds,
      12,
      12,
    ),
  })
}

export function parseAiChartD1FlyingPalaceIntegration(
  value: unknown,
): AiChartD1FlyingPalaceIntegration {
  try {
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(
      value,
      INTEGRATION_FIELDS,
    )
    if (
      record.contractVersion !==
        AI_CHART_D1_FLYING_PALACE_INTEGRATION_VERSION ||
      record.sourceModelInputSetVersion !==
        AI_CHART_D1_FLYING_MODEL_INPUT_SET_VERSION ||
      record.sourceKnowledgeViewSetVersion !==
        AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_SET_VERSION ||
      parseAiChartD1Boolean(record.openAiCallable) !== false ||
      record.validationStatus !== 'validated' ||
      !Array.isArray(record.palaces) ||
      record.palaces.length !== 12
    ) {
      invalid('RESULT_SET_SHAPE_INVALID')
    }
    const palaces = Object.freeze(record.palaces.map(parsePalaceEntry))
    if (
      palaces.some(
        (entry, index) =>
          entry.targetPalaceId !== PALACE_IDS[index],
      )
    ) {
      invalid('RESULT_SET_SHAPE_INVALID')
    }
    const influences = palaces.flatMap(
      (entry) => entry.influences,
    )
    const chartId = parseAiChartD1Id(record.chartId)
    const runId = parseAiChartD1Id(record.runId)
    if (
      influences.length !== 48 ||
      new Set(
        influences.map(
          (influence) => influence.flyingInfluenceId,
        ),
      ).size !== 48 ||
      new Set(
        influences.map((influence) => influence.flyingFactRef),
      ).size !== 48 ||
      influences.some(
        (influence) =>
          influence.chartId !== chartId ||
          influence.runId !== runId,
      )
    ) {
      invalid('RESULT_SET_SHAPE_INVALID')
    }
    const coverage = parseCoverage(record.coverage)
    if (
      JSON.stringify(coverage) !==
      JSON.stringify(expectedCoverage(palaces))
    ) {
      invalid('COVERAGE_MISMATCH')
    }
    return freezeAiChartD1Value({
      contractVersion:
        AI_CHART_D1_FLYING_PALACE_INTEGRATION_VERSION,
      chartId,
      runId,
      sourceModelInputSetVersion:
        AI_CHART_D1_FLYING_MODEL_INPUT_SET_VERSION,
      sourceKnowledgeViewSetVersion:
        AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_SET_VERSION,
      catalogId: parseAiChartD1Id(record.catalogId),
      catalogFingerprint: parseSha(record.catalogFingerprint),
      sourceManifestSha256: parseSha(record.sourceManifestSha256),
      palaces,
      integrationPolicy: parsePolicy(record.integrationPolicy),
      coverage,
      openAiCallable: false as const,
      validationStatus: 'validated' as const,
    })
  } catch (error) {
    if (error instanceof AiChartD1FlyingPalaceIntegrationError) {
      throw error
    }
    invalid('RESULT_SET_SHAPE_INVALID')
  }
}

function parseTrustedSources(
  modelInputSetValue: unknown,
  knowledgeViewSetValue: unknown,
  catalogValue: unknown,
): Readonly<{
  inputSet: AiChartD1FlyingModelInputSet
  knowledgeSet: AiChartD1FlyingKnowledgeViewSet
}> {
  try {
    const inputSet = parseAiChartD1FlyingModelInputSet(
      modelInputSetValue,
    )
    const knowledgeSet =
      validateAiChartD1FlyingKnowledgeViewSetAgainstSources(
        knowledgeViewSetValue,
        inputSet,
        catalogValue,
      )
    return Object.freeze({ inputSet, knowledgeSet })
  } catch {
    invalid('SOURCE_BINDING_INVALID')
  }
}

function sourceBoundResults(
  value: unknown,
  inputSet: AiChartD1FlyingModelInputSet,
  knowledgeSet: AiChartD1FlyingKnowledgeViewSet,
): readonly AiChartD1FlyingInfluenceResult[] {
  if (!Array.isArray(value) || value.length !== 48) {
    invalid('RESULT_SET_SHAPE_INVALID')
  }
  let parsed: readonly AiChartD1FlyingInfluenceResult[]
  try {
    parsed = Object.freeze(
      value.map(parseAiChartD1FlyingInfluenceResult),
    )
  } catch {
    invalid('RESULT_SET_SHAPE_INVALID')
  }
  const byInfluenceId = new Map(
    parsed.map((result) => [result.flyingInfluenceId, result]),
  )
  if (byInfluenceId.size !== 48) {
    invalid('RESULT_SET_SHAPE_INVALID')
  }
  try {
    return Object.freeze(
      inputSet.inputs.map((input, index) => {
        const result = byInfluenceId.get(
          input.flyingFact.authoritativeInfluenceId,
        )
        if (result === undefined) invalid('RESULT_SET_SHAPE_INVALID')
        return validateAiChartD1FlyingInfluenceResultAgainstKnowledgeSources(
          result,
          input.flyingFact,
          input.sourcePalaceResult,
          input.targetPalaceResult,
          knowledgeSet.views[index],
        )
      }),
    )
  } catch (error) {
    if (
      error instanceof AiChartD1FlyingPalaceIntegrationError &&
      error.reasonCode === 'RESULT_SET_SHAPE_INVALID'
    ) {
      throw error
    }
    invalid('SOURCE_BINDING_INVALID')
  }
}

export function buildAiChartD1FlyingPalaceIntegration(
  resultValues: unknown,
  modelInputSetValue: unknown,
  knowledgeViewSetValue: unknown,
  catalogValue: unknown,
): AiChartD1FlyingPalaceIntegration {
  const { inputSet, knowledgeSet } = parseTrustedSources(
    modelInputSetValue,
    knowledgeViewSetValue,
    catalogValue,
  )
  const results = sourceBoundResults(
    resultValues,
    inputSet,
    knowledgeSet,
  )
  const palaces = AI_CHART_D1_PALACE_IDENTITIES.map(
    ({ palaceId }) => ({
      targetPalaceId: palaceId,
      influences: results.filter(
        (result) => result.targetPalaceId === palaceId,
      ),
    }),
  )
  return parseAiChartD1FlyingPalaceIntegration({
    contractVersion:
      AI_CHART_D1_FLYING_PALACE_INTEGRATION_VERSION,
    chartId: inputSet.chartId,
    runId: inputSet.runId,
    sourceModelInputSetVersion: inputSet.contractVersion,
    sourceKnowledgeViewSetVersion: knowledgeSet.contractVersion,
    catalogId: knowledgeSet.catalogId,
    catalogFingerprint: knowledgeSet.catalogFingerprint,
    sourceManifestSha256: knowledgeSet.sourceManifestSha256,
    palaces,
    integrationPolicy: AI_CHART_D1_FLYING_INTEGRATION_POLICY,
    coverage: expectedCoverage(palaces),
    openAiCallable: false,
    validationStatus: 'validated',
  })
}

const ID_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 128,
  pattern: '^[A-Za-z0-9._:-]{1,128}$',
})
const SHA_SCHEMA = createAiChartD1StringSchema({
  maximumLength: 64,
  pattern: SHA256_PATTERN.source,
})
const PALACE_ID_SCHEMA = createAiChartD1StringSchema({
  enumValues: PALACE_IDS,
})
const POLICY_SCHEMA = createAiChartD1StrictObjectSchema({
  preserveEveryDirectedInfluence: freezeAiChartD1Value({
    const: true,
  }),
  preserveCoexistingPossibilities: freezeAiChartD1Value({
    const: true,
  }),
  netting: freezeAiChartD1Value({ const: 'FORBIDDEN' }),
  dominanceSelection: freezeAiChartD1Value({
    const: 'FORBIDDEN',
  }),
  customerWriting: freezeAiChartD1Value({
    const: 'NOT_PERFORMED',
  }),
})
const PALACE_SCHEMA = createAiChartD1StrictObjectSchema({
  targetPalaceId: PALACE_ID_SCHEMA,
  influences: createAiChartD1ArraySchema(
    AI_CHART_D1_FLYING_INFLUENCE_RESULT_JSON_SCHEMA,
    {
      minimumItems: 0,
      maximumItems: 48,
    },
  ),
})
const COVERAGE_SCHEMA = createAiChartD1StrictObjectSchema({
  flyingInfluenceRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 48,
    maximumItems: 48,
  }),
  flyingFactRefs: createAiChartD1ArraySchema(ID_SCHEMA, {
    minimumItems: 48,
    maximumItems: 48,
  }),
  sourcePalaceIds: createAiChartD1ArraySchema(PALACE_ID_SCHEMA, {
    minimumItems: 12,
    maximumItems: 12,
  }),
  targetPalaceIds: createAiChartD1ArraySchema(PALACE_ID_SCHEMA, {
    minimumItems: 12,
    maximumItems: 12,
  }),
})

export const AI_CHART_D1_FLYING_PALACE_INTEGRATION_JSON_SCHEMA:
  AiChartD1JsonSchema = createAiChartD1StrictObjectSchema({
    contractVersion: freezeAiChartD1Value({
      const: AI_CHART_D1_FLYING_PALACE_INTEGRATION_VERSION,
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
    palaces: createAiChartD1ArraySchema(PALACE_SCHEMA, {
      minimumItems: 12,
      maximumItems: 12,
    }),
    integrationPolicy: POLICY_SCHEMA,
    coverage: COVERAGE_SCHEMA,
    openAiCallable: freezeAiChartD1Value({ const: false }),
    validationStatus: freezeAiChartD1Value({
      const: 'validated',
    }),
  })
