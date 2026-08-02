import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { AI_CHART_D1_MODEL_TARGET } from './d1Assets'
import {
  assertAiChartD1P1CandidateRuleAuthority,
  buildAiChartD1P1AdapterBridge,
  buildAiChartD1P1AdapterBridges,
  buildAiChartD1P1LocalPreviewAdapterBridges,
  buildAiChartD1P1ReportOpenAiRuntimeAdapterBridges,
  deriveAiChartD1P1CandidateRuleStatus,
  parseAiChartD1P1AdapterBridgeDescriptor,
  type AiChartD1P1AdapterBridge,
} from './d1P1AdapterBridge'
import {
  AI_CHART_D1_P1_ADAPTER_BRIDGE_DESCRIPTION,
  AI_CHART_D1_P1_ADAPTER_BRIDGE_INVALID,
  AI_CHART_D1_P1_ADAPTER_BRIDGE_NOT_READY,
  AI_CHART_D1_P1_ADAPTER_BRIDGE_RESULT_INVALID,
  AI_CHART_D1_P1_MAX_OUTPUT_TOKENS,
  AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS,
  AiChartD1P1AdapterBridgeResultInvalidError,
  type AiChartD1P1SourceBoundValidationReasonCode,
} from './d1P1AdapterBridgeContracts'
import {
  createAdapterBridgeFixture,
  createValidAiChartD1P1Candidate,
  createValidAiChartD1P1Result,
  type AdapterBridgeFixture,
  type Mutable,
} from './d1P1AdapterBridgeTestSupport'
import type { AiChartD1StructureBasis } from './d1CommonContracts'
import { buildAiChartD1K0P1KnowledgeBundles } from './d1K0Selection'
import {
  AI_CHART_D1_MAJOR_STAR_NAMES,
  AI_CHART_D1_MODELED_SUPPORTING_STARS,
  AI_CHART_D1_PALACE_IDENTITIES,
} from './d1N0Constants'
import {
  buildAiChartD1P1PromptPackages,
} from './d1P1PromptPackageBuilder'
import {
  AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256,
  AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256,
  createAiChartD1P1CanonicalJson,
  type AiChartD1P1PromptPackage,
} from './d1P1PromptPackageContracts'
import {
  bundleIds,
  completeModelInputSnapshot,
  createModelInputFixture,
  createStructuralInputs,
  recalculateModelInputFingerprint,
  type MutableRecord,
} from './d1P1ModelInputTestSupport'
import {
  recalculatePromptPackageFingerprint,
  recalculatePromptPackageTextBindings,
} from './d1P1PromptPackageTestSupport'
import {
  AI_CHART_D1_P1_OUTPUT_SCHEMA,
  AI_CHART_D1_P1_SCHEMA_NAME,
  parseAiChartD1P1Result,
  type AiChartD1P1Result,
} from './d1P1F1Contracts'
import {
  AI_CHART_D1_P1_LOCAL_PREVIEW_TIMEOUT_MS,
  AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_TIMEOUT_MS,
} from './d1P1PreviewTimeoutContracts'
import {
  AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS,
  AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
  AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
  AI_CHART_OPENAI_MAX_OUTPUT_TOKENS,
  buildAiChartOpenAiResponsesBody,
} from './openAiResponses'

const CANDIDATE_FIELDS = [
  'directCandidates',
  'oppositeInfluences',
  'hiddenCombinationInfluences',
  'trineInfluences',
  'combinedCandidates',
  'strengths',
  'imbalancePossibilities',
] as const

let checks = 0

function check(name: string, run: () => void) {
  run()
  checks += 1
  console.log(`✓ ${name}`)
}

function assertInvalid(run: () => unknown): void {
  assert.throws(run, { message: AI_CHART_D1_P1_ADAPTER_BRIDGE_INVALID })
}

function assertNotReady(run: () => unknown): void {
  assert.throws(run, { message: AI_CHART_D1_P1_ADAPTER_BRIDGE_NOT_READY })
}

function assertResultInvalid(
  run: () => unknown,
  expectedReasonCode?: AiChartD1P1SourceBoundValidationReasonCode,
): AiChartD1P1AdapterBridgeResultInvalidError {
  try {
    run()
    assert.fail('expected source-bound result invalid')
  } catch (error) {
    assert.equal(
      error instanceof AiChartD1P1AdapterBridgeResultInvalidError,
      true,
    )
    if (!(error instanceof AiChartD1P1AdapterBridgeResultInvalidError)) {
      assert.fail('expected AiChartD1P1AdapterBridgeResultInvalidError')
    }
    assert.equal(error.message, AI_CHART_D1_P1_ADAPTER_BRIDGE_RESULT_INVALID)
    if (expectedReasonCode !== undefined) {
      assert.equal(error.reasonCode, expectedReasonCode)
    }
    return error
  }
}

function assertSafeResultInvalid(
  error: AiChartD1P1AdapterBridgeResultInvalidError,
  markers: readonly string[],
): void {
  const serialized = JSON.stringify(error)
  for (const marker of markers) {
    assert.equal(error.message.includes(marker), false)
    assert.equal(error.code.includes(marker), false)
    assert.equal(error.reasonCode.includes(marker), false)
    assert.equal(serialized.includes(marker), false)
  }
}

function assertNoFetch(run: () => void): void {
  const originalFetch = globalThis.fetch
  let fetchCount = 0
  globalThis.fetch = (async () => {
    fetchCount += 1
    throw new Error('network_forbidden')
  }) as typeof fetch
  try {
    run()
  } finally {
    globalThis.fetch = originalFetch
  }
  assert.equal(fetchCount, 0)
}

function asSchemaRecord(value: unknown): Record<string, unknown> {
  assert.equal(value !== null && typeof value === 'object', true)
  assert.equal(Array.isArray(value), false)
  return value as Record<string, unknown>
}

function primaryAxisMajorStarCoreSchema(
  schema: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const properties = asSchemaRecord(schema.properties)
  const primaryAxis = asSchemaRecord(properties.primaryAxis)
  const primaryAxisProperties = asSchemaRecord(primaryAxis.properties)
  return asSchemaRecord(primaryAxisProperties.majorStarCore)
}

function coverageMajorStarsSchema(
  schema: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const properties = asSchemaRecord(schema.properties)
  const coverage = asSchemaRecord(properties.coverage)
  const coverageProperties = asSchemaRecord(coverage.properties)
  return asSchemaRecord(coverageProperties.majorStarsCovered)
}

function coverageMinorStarsSchema(
  schema: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const properties = asSchemaRecord(schema.properties)
  const coverage = asSchemaRecord(properties.coverage)
  const coverageProperties = asSchemaRecord(coverage.properties)
  return asSchemaRecord(coverageProperties.minorStarsCovered)
}

function coverageNoblesSchema(
  schema: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const properties = asSchemaRecord(schema.properties)
  const coverage = asSchemaRecord(properties.coverage)
  const coverageProperties = asSchemaRecord(coverage.properties)
  return asSchemaRecord(coverageProperties.noblesCovered)
}

function effectiveMajorStarNames(
  modelInput: AdapterBridgeFixture['modelInputs'][number],
): readonly string[] {
  const target = modelInput.structuralContext.targetPalace
  return (
    target.borrowStatus === 'eligible_and_borrowed'
      ? target.borrowedMajorStars
      : target.canonicalMajorStars
  ).map((star) => star.name)
}

function buildFrom(
  fixture: AdapterBridgeFixture,
  modelInputs: unknown = fixture.modelInputs,
  promptPackages: unknown = fixture.promptPackages,
) {
  return buildAiChartD1P1AdapterBridges(
    fixture.catalog,
    fixture.structuralInputs,
    fixture.bundles,
    modelInputs,
    promptPackages,
  )
}

function parseResult(
  bridge: AiChartD1P1AdapterBridge,
  result: unknown,
) {
  const wireResult = structuredClone(result) as Record<string, unknown>
  if (
    wireResult !== null &&
    typeof wireResult === 'object' &&
    !Array.isArray(wireResult)
  ) {
    const primaryAxis = wireResult.primaryAxis
    if (
      primaryAxis !== null &&
      typeof primaryAxis === 'object' &&
      !Array.isArray(primaryAxis) &&
      Array.isArray((primaryAxis as Record<string, unknown>).majorStarCore)
    ) {
      ;(primaryAxis as Record<string, unknown>).majorStarCore = []
    }
    const coverage = wireResult.coverage
    if (
      coverage !== null &&
      typeof coverage === 'object' &&
      !Array.isArray(coverage)
    ) {
      const coverageRecord = coverage as Record<string, unknown>
      if (Array.isArray(coverageRecord.majorStarsCovered)) {
        coverageRecord.majorStarsCovered = []
      }
      if (Array.isArray(coverageRecord.minorStarsCovered)) {
        coverageRecord.minorStarsCovered = []
      }
      if (Array.isArray(coverageRecord.noblesCovered)) {
        coverageRecord.noblesCovered = []
      }
    }
  }
  return bridge.request.parseResult(wireResult)
}

function parseWireResult(
  bridge: AiChartD1P1AdapterBridge,
  result: unknown,
) {
  return bridge.request.parseResult(result)
}

function parseCoverageWireResult(
  bridge: AiChartD1P1AdapterBridge,
  result: unknown,
) {
  const wireResult = structuredClone(result) as Record<string, unknown>
  if (
    wireResult !== null &&
    typeof wireResult === 'object' &&
    !Array.isArray(wireResult)
  ) {
    const primaryAxis = wireResult.primaryAxis
    if (
      primaryAxis !== null &&
      typeof primaryAxis === 'object' &&
      !Array.isArray(primaryAxis) &&
      Array.isArray((primaryAxis as Record<string, unknown>).majorStarCore)
    ) {
      ;(primaryAxis as Record<string, unknown>).majorStarCore = []
    }
  }
  return bridge.request.parseResult(wireResult)
}

function parseMinorCoverageWireResult(
  bridge: AiChartD1P1AdapterBridge,
  result: unknown,
) {
  const wireResult = structuredClone(result) as Mutable<AiChartD1P1Result>
  wireResult.primaryAxis.majorStarCore = []
  wireResult.coverage.majorStarsCovered = []
  return bridge.request.parseResult(wireResult)
}

function parseNobleCoverageWireResult(
  bridge: AiChartD1P1AdapterBridge,
  result: unknown,
) {
  const wireResult = structuredClone(result) as Mutable<AiChartD1P1Result>
  wireResult.primaryAxis.majorStarCore = []
  wireResult.coverage.majorStarsCovered = []
  wireResult.coverage.minorStarsCovered = []
  return bridge.request.parseResult(wireResult)
}

function targetSupportingRuleId(
  modelInput: AdapterBridgeFixture['modelInputs'][number],
  starName: string,
): string {
  const trace = modelInput.knowledgeContext.selectionTrace.find(
    (entry) =>
      entry.reason === 'supporting_star_present' &&
      entry.palaceRole === 'target' &&
      entry.palaceId === modelInput.targetPalaceId &&
      entry.starName === starName,
  )
  assert.ok(trace)
  return trace.ruleId
}

function removeTargetSupportingEvidence(
  value: Mutable<AiChartD1P1Result>,
  modelInput: AdapterBridgeFixture['modelInputs'][number],
  starName: string,
): void {
  const ruleId = targetSupportingRuleId(modelInput, starName)
  for (const field of CANDIDATE_FIELDS) {
    value[field] = value[field].filter(
      (candidate) =>
        !(
          candidate.palaceIds.includes(modelInput.targetPalaceId) &&
          candidate.starBasis.includes(starName) &&
          candidate.usedRuleIds.includes(ruleId)
        ),
    )
  }
}

function resultWithSingleCandidate(
  modelInput: AdapterBridgeFixture['modelInputs'][number],
  field: (typeof CANDIDATE_FIELDS)[number],
): Mutable<AiChartD1P1Result> {
  const result = createValidAiChartD1P1Result(modelInput)
  const record = result as unknown as Record<string, unknown>
  const supportingEvidence = [...result.combinedCandidates]
  CANDIDATE_FIELDS.forEach((candidateField) => {
    record[candidateField] = []
  })
  record[field] = [
    createValidAiChartD1P1Candidate(
      modelInput,
      `candidate:${field}`,
      field,
    ),
    ...(field === 'combinedCandidates' ? supportingEvidence : []),
  ]
  if (field !== 'combinedCandidates') {
    record.combinedCandidates = supportingEvidence
  }
  return result
}

function sourceFilesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? sourceFilesUnder(path) : [path]
  })
}

async function customFixture(identity: string, snapshot: MutableRecord) {
  const modelFixture = await createModelInputFixture(identity, snapshot)
  const promptPackages = buildAiChartD1P1PromptPackages(
    modelFixture.catalog,
    modelFixture.structuralInputs,
    modelFixture.bundles,
    modelFixture.modelInputs,
  )
  const bridges = buildAiChartD1P1AdapterBridges(
    modelFixture.catalog,
    modelFixture.structuralInputs,
    modelFixture.bundles,
    modelFixture.modelInputs,
    promptPackages,
  )
  return { ...modelFixture, promptPackages, bridges }
}

async function run() {
  const fixture = await createAdapterBridgeFixture('bridge-builder')
  const { bridges, modelInputs, promptPackages } = fixture
  const localPreviewBridges = buildAiChartD1P1LocalPreviewAdapterBridges(
    fixture.catalog,
    fixture.structuralInputs,
    fixture.bundles,
    fixture.modelInputs,
    fixture.promptPackages,
  )
  const reportRuntimeBridges =
    buildAiChartD1P1ReportOpenAiRuntimeAdapterBridges(
      fixture.catalog,
      fixture.structuralInputs,
      fixture.bundles,
      fixture.modelInputs,
      fixture.promptPackages,
    )
  const bridge = bridges[0]
  const modelInput = modelInputs[0]

  check('fixed builder creates exactly twelve Runtime Bridges', () => {
    assert.equal(bridges.length, 12)
  })
  check('Runtime Bridge array is frozen', () => {
    assert.equal(Object.isFrozen(bridges), true)
  })
  check('fixed Bridges use canonical palace order', () => {
    assert.deepEqual(
      bridges.map((entry) => entry.descriptor.targetPalaceId),
      AI_CHART_D1_PALACE_IDENTITIES.map((identity) => identity.palaceId),
    )
  })
  check('Bridge target palace ids are complete and unique', () => {
    assert.equal(
      new Set(bridges.map((entry) => entry.descriptor.targetPalaceId)).size,
      12,
    )
  })
  check('Bridge call ids are unique', () => {
    assert.equal(
      new Set(bridges.map((entry) => entry.descriptor.callId)).size,
      12,
    )
  })
  check('Bridge package fingerprints are unique', () => {
    assert.equal(
      new Set(
        bridges.map((entry) => entry.descriptor.packageFingerprint),
      ).size,
      12,
    )
  })
  check('Bridge Model Input fingerprints are unique', () => {
    assert.equal(
      new Set(
        bridges.map((entry) => entry.descriptor.modelInputFingerprint),
      ).size,
      12,
    )
  })
  check('Bridge fingerprints are unique', () => {
    assert.equal(
      new Set(
        bridges.map((entry) => entry.descriptor.bridgeFingerprint),
      ).size,
      12,
    )
  })
  check('all Bridges share one chart identity', () => {
    assert.equal(
      new Set(bridges.map((entry) => entry.descriptor.chartId)).size,
      1,
    )
  })
  check('all Bridges share one run identity', () => {
    assert.equal(
      new Set(bridges.map((entry) => entry.descriptor.runId)).size,
      1,
    )
  })
  check('Bridge index maps to Package index', () => {
    bridges.forEach((entry, index) => {
      assert.equal(
        entry.descriptor.packageFingerprint,
        promptPackages[index].packageFingerprint,
      )
    })
  })
  check('Bridge index maps to Model Input index', () => {
    bridges.forEach((entry, index) => {
      assert.equal(entry.descriptor.callId, modelInputs[index].callId)
      assert.equal(
        entry.descriptor.modelInputFingerprint,
        modelInputs[index].inputFingerprint,
      )
    })
  })
  check('all request configurations are identical', () => {
    assert.equal(
      new Set(
        bridges.map(
          (entry) =>
            `${entry.request.reasoningEffort}:${entry.request.timeoutMs}:${entry.request.maxOutputTokens}`,
        ),
      ).size,
      1,
    )
  })
  check('all 12 Bridges use the dedicated D1 P1 output budget', () => {
    assert.equal(AI_CHART_D1_P1_MAX_OUTPUT_TOKENS, 16_384)
    assert.equal(AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS, 8_192)
    assert.equal(AI_CHART_OPENAI_MAX_OUTPUT_TOKENS, 32_768)
    for (const entry of bridges) {
      assert.equal(
        entry.descriptor.maxOutputTokens,
        AI_CHART_D1_P1_MAX_OUTPUT_TOKENS,
      )
      assert.equal(
        entry.request.maxOutputTokens,
        AI_CHART_D1_P1_MAX_OUTPUT_TOKENS,
      )
      assert.equal(
        entry.request.maxOutputTokens,
        entry.descriptor.maxOutputTokens,
      )
    }
  })
  check('all requests share the formal P1 schema name', () => {
    assert.deepEqual(
      [...new Set(bridges.map((entry) => entry.request.schemaName))],
      [AI_CHART_D1_P1_SCHEMA_NAME],
    )
  })
  check('all requests preserve their own authenticated userInput', () => {
    bridges.forEach((entry, index) => {
      assert.equal(entry.request.userInput, promptPackages[index].userInput)
    })
  })

  check('request instructions map exactly from the Prompt Package', () => {
    assert.equal(bridge.request.instructions, promptPackages[0].instructions)
  })
  check('request userInput maps exactly from the Prompt Package', () => {
    assert.equal(bridge.request.userInput, promptPackages[0].userInput)
  })
  check('request Schema name maps exactly from the Prompt Package', () => {
    assert.equal(bridge.request.schemaName, promptPackages[0].outputSchemaName)
  })
  check('request description is the locked Bridge description', () => {
    assert.equal(
      bridge.request.description,
      AI_CHART_D1_P1_ADAPTER_BRIDGE_DESCRIPTION,
    )
  })
  check('request uses a source-bound specialization of the formal P1 Output Schema', () => {
    assert.notDeepEqual(bridge.request.schema, AI_CHART_D1_P1_OUTPUT_SCHEMA)
    const sourceBound = structuredClone(bridge.request.schema)
    const formal = structuredClone(AI_CHART_D1_P1_OUTPUT_SCHEMA)
    const sourceBoundMajorStarCore = primaryAxisMajorStarCoreSchema(sourceBound)
    const formalMajorStarCore = primaryAxisMajorStarCoreSchema(formal)
    const sourceBoundCoverageMajorStars = coverageMajorStarsSchema(sourceBound)
    const formalCoverageMajorStars = coverageMajorStarsSchema(formal)
    const sourceBoundCoverageMinorStars = coverageMinorStarsSchema(sourceBound)
    const formalCoverageMinorStars = coverageMinorStarsSchema(formal)
    const sourceBoundCoverageNobles = coverageNoblesSchema(sourceBound)
    const formalCoverageNobles = coverageNoblesSchema(formal)
    Object.assign(sourceBoundMajorStarCore, formalMajorStarCore)
    Object.assign(sourceBoundCoverageMajorStars, formalCoverageMajorStars)
    Object.assign(sourceBoundCoverageMinorStars, formalCoverageMinorStars)
    Object.assign(sourceBoundCoverageNobles, formalCoverageNobles)
    assert.deepEqual(sourceBound, formal)
  })
  check('each request Schema reserves primaryAxis majorStarCore for Server injection', () => {
    bridges.forEach((entry, index) => {
      const expectedMajorStars = effectiveMajorStarNames(modelInputs[index])
      const majorStarCore = primaryAxisMajorStarCoreSchema(entry.request.schema)
      const items = asSchemaRecord(majorStarCore.items)
      assert.deepEqual(items.enum, expectedMajorStars)
      assert.equal(majorStarCore.minItems, 0)
      assert.equal(majorStarCore.maxItems, 0)
    })
  })
  check('each request Schema reserves coverage majorStarsCovered for Server injection', () => {
    bridges.forEach((entry, index) => {
      const expectedMajorStars = effectiveMajorStarNames(modelInputs[index])
      const majorStarsCovered = coverageMajorStarsSchema(entry.request.schema)
      const items = asSchemaRecord(majorStarsCovered.items)
      assert.deepEqual(items.enum, expectedMajorStars)
      assert.equal(majorStarsCovered.minItems, 0)
      assert.equal(majorStarsCovered.maxItems, 0)
    })
  })
  check('each request Schema reserves coverage minorStarsCovered for Server derivation', () => {
    bridges.forEach((entry, index) => {
      const expectedSupportingStars = modelInputs[
        index
      ].structuralContext.targetPalace.modeledSupportingStars.map(
        (star) => star.name,
      )
      const minorStarsCovered = coverageMinorStarsSchema(entry.request.schema)
      const items = asSchemaRecord(minorStarsCovered.items)
      assert.deepEqual(
        items.enum,
        expectedSupportingStars.length === 0
          ? undefined
          : expectedSupportingStars,
      )
      assert.equal(minorStarsCovered.minItems, 0)
      assert.equal(minorStarsCovered.maxItems, 0)
    })
  })
  check('each request Schema reserves coverage noblesCovered for Server derivation', () => {
    bridges.forEach((entry, index) => {
      const expectedNobles = modelInputs[
        index
      ].structuralContext.targetPalace.modeledSupportingStars
        .map((star) => star.name)
        .filter((starName) =>
          ['左輔', '右弼', '天魁', '天鉞'].includes(starName),
        )
      const noblesCovered = coverageNoblesSchema(entry.request.schema)
      const items = asSchemaRecord(noblesCovered.items)
      assert.deepEqual(
        items.enum,
        expectedNobles.length === 0 ? undefined : expectedNobles,
      )
      assert.equal(noblesCovered.minItems, 0)
      assert.equal(noblesCovered.maxItems, 0)
    })
  })
  check('request Schema admits no model-authored primary-axis star value', () => {
    const expectedMajorStars = effectiveMajorStarNames(modelInput)
    const majorStarCore = primaryAxisMajorStarCoreSchema(bridge.request.schema)
    const items = asSchemaRecord(majorStarCore.items)
    const allowed = items.enum
    assert.ok(Array.isArray(allowed))
    for (const starName of expectedMajorStars) {
      assert.equal(allowed.includes(`${starName}星`), false)
      assert.equal(allowed.includes(`${starName}化權`), false)
    }
  })
  check('request parser injects the exact Server-owned major-star set for all twelve palaces', () => {
    bridges.forEach((entry, index) => {
      const wireResult = createValidAiChartD1P1Result(modelInputs[index])
      wireResult.primaryAxis.majorStarCore = []
      wireResult.coverage.majorStarsCovered = []
      wireResult.coverage.minorStarsCovered = []
      wireResult.coverage.noblesCovered = []
      const parsed = entry.request.parseResult(wireResult)
      const expected = effectiveMajorStarNames(modelInputs[index])
      const expectedSupportingStars =
        modelInputs[index].structuralContext.targetPalace.modeledSupportingStars.map(
          (star) => star.name,
        )
      const expectedNobles = expectedSupportingStars.filter((starName) =>
        ['左輔', '右弼', '天魁', '天鉞'].includes(starName),
      )
      assert.deepEqual(parsed.primaryAxis.majorStarCore, expected)
      assert.deepEqual(parsed.coverage.majorStarsCovered, expected)
      assert.deepEqual(
        parsed.coverage.minorStarsCovered,
        expectedSupportingStars,
      )
      assert.deepEqual(parsed.coverage.noblesCovered, expectedNobles)
    })
  })
  check('request parser is a function', () => {
    assert.equal(typeof bridge.request.parseResult, 'function')
  })
  check('request reasoning uses the Adapter default', () => {
    assert.equal(
      bridge.request.reasoningEffort,
      AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
    )
  })
  check('request timeout uses the Adapter default', () => {
    assert.equal(bridge.request.timeoutMs, AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS)
  })
  check('Local Preview Bridges bind 300 seconds to Descriptor and request', () => {
    assert.equal(localPreviewBridges.length, 12)
    for (const localPreviewBridge of localPreviewBridges) {
      assert.equal(
        localPreviewBridge.descriptor.timeoutMs,
        AI_CHART_D1_P1_LOCAL_PREVIEW_TIMEOUT_MS,
      )
      assert.equal(
        localPreviewBridge.request.timeoutMs,
        AI_CHART_D1_P1_LOCAL_PREVIEW_TIMEOUT_MS,
      )
      assert.equal(localPreviewBridge.descriptor.openAiCallable, false)
    }
  })
  check('Report OpenAI Runtime Bridges bind 300 seconds to Descriptor and request', () => {
    assert.equal(reportRuntimeBridges.length, 12)
    for (const reportRuntimeBridge of reportRuntimeBridges) {
      assert.equal(
        reportRuntimeBridge.descriptor.timeoutMs,
        AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_TIMEOUT_MS,
      )
      assert.equal(
        reportRuntimeBridge.request.timeoutMs,
        AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_TIMEOUT_MS,
      )
      assert.equal(reportRuntimeBridge.descriptor.openAiCallable, false)
    }
  })
  check('Local Preview timeout changes every Bridge fingerprint', () => {
    bridges.forEach((entry, index) => {
      assert.notEqual(
        localPreviewBridges[index].descriptor.bridgeFingerprint,
        entry.descriptor.bridgeFingerprint,
      )
    })
  })
  check('Report OpenAI Runtime timeout changes every Bridge fingerprint without changing model policy', () => {
    bridges.forEach((entry, index) => {
      const reportRuntimeBridge = reportRuntimeBridges[index]
      assert.notEqual(
        reportRuntimeBridge.descriptor.bridgeFingerprint,
        entry.descriptor.bridgeFingerprint,
      )
      assert.equal(
        reportRuntimeBridge.request.reasoningEffort,
        entry.request.reasoningEffort,
      )
      assert.equal(
        reportRuntimeBridge.request.maxOutputTokens,
        entry.request.maxOutputTokens,
      )
      assert.equal(
        reportRuntimeBridge.request.schemaName,
        entry.request.schemaName,
      )
      assert.equal(
        reportRuntimeBridge.request.description,
        entry.request.description,
      )
    })
  })
  check('request token budget uses the D1 P1 policy', () => {
    assert.equal(
      bridge.request.maxOutputTokens,
      AI_CHART_D1_P1_MAX_OUTPUT_TOKENS,
    )
  })
  check('validated request is frozen', () => {
    assert.equal(Object.isFrozen(bridge.request), true)
  })
  check('validated request Schema is recursively frozen', () => {
    assert.equal(Object.isFrozen(bridge.request.schema), true)
    assert.equal(Object.isFrozen(bridge.request.schema.properties), true)
  })
  check('Runtime Bridge is frozen', () => {
    assert.equal(Object.isFrozen(bridge), true)
  })
  check('Runtime Bridge Descriptor is frozen', () => {
    assert.equal(Object.isFrozen(bridge.descriptor), true)
  })
  check('same authenticated sources rebuild equal Descriptor values', () => {
    const rebuilt = buildFrom(fixture)
    assert.deepEqual(
      rebuilt.map((entry) => entry.descriptor),
      bridges.map((entry) => entry.descriptor),
    )
  })
  check('same authenticated sources rebuild equal request projections', () => {
    const project = (entry: AiChartD1P1AdapterBridge) => ({
      instructions: entry.request.instructions,
      userInput: entry.request.userInput,
      schemaName: entry.request.schemaName,
      description: entry.request.description,
      schema: entry.request.schema,
      reasoningEffort: entry.request.reasoningEffort,
      timeoutMs: entry.request.timeoutMs,
      maxOutputTokens: entry.request.maxOutputTokens,
    })
    assert.deepEqual(buildFrom(fixture).map(project), bridges.map(project))
  })
  check('caller source mutation cannot change an existing Bridge', () => {
    const suppliedPackages = structuredClone(promptPackages) as Mutable<
      AiChartD1P1PromptPackage
    >[]
    const built = buildFrom(fixture, undefined, suppliedPackages)
    ;(suppliedPackages[0] as unknown as Record<string, unknown>).instructions =
      'mutated after build'
    assert.equal(built[0].request.instructions, promptPackages[0].instructions)
  })

  const body = buildAiChartOpenAiResponsesBody(bridge.request)
  const localPreviewBody = buildAiChartOpenAiResponsesBody(
    localPreviewBridges[0].request,
  )
  check('Local Preview timeout does not change the Responses body contract', () => {
    assert.deepEqual(localPreviewBody, body)
  })
  check('Responses body model uses the existing target', () => {
    assert.equal(body.model, AI_CHART_D1_MODEL_TARGET)
  })
  check('Responses body disables store', () => {
    assert.equal(body.store, false)
  })
  check('Responses body disables stream', () => {
    assert.equal(body.stream, false)
  })
  check('Responses body disables background', () => {
    assert.equal(body.background, false)
  })
  check('Responses body disables truncation', () => {
    assert.equal(body.truncation, 'disabled')
  })
  check('Responses body reasoning is exact', () => {
    assert.equal(body.reasoning.effort, AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT)
  })
  check('Responses body token budget is exact', () => {
    assert.equal(
      body.max_output_tokens,
      AI_CHART_D1_P1_MAX_OUTPUT_TOKENS,
    )
  })
  check('Responses body instructions are exact', () => {
    assert.equal(body.instructions, promptPackages[0].instructions)
  })
  check('Responses body contains exactly one user input item', () => {
    assert.equal(body.input.length, 1)
    assert.equal(body.input[0].role, 'user')
  })
  check('Responses body user content is exact', () => {
    assert.equal(body.input[0].content, promptPackages[0].userInput)
  })
  check('Responses format uses json_schema', () => {
    assert.equal(body.text.format.type, 'json_schema')
  })
  check('Responses format name is exact', () => {
    assert.equal(body.text.format.name, AI_CHART_D1_P1_SCHEMA_NAME)
  })
  check('Responses format description is exact', () => {
    assert.equal(
      body.text.format.description,
      AI_CHART_D1_P1_ADAPTER_BRIDGE_DESCRIPTION,
    )
  })
  check('Responses format is strict', () => {
    assert.equal(body.text.format.strict, true)
  })
  check('Responses format uses the source-bound P1 Schema', () => {
    assert.deepEqual(body.text.format.schema, bridge.request.schema)
  })
  for (const key of [
    'temperature',
    'top_p',
    'tools',
    'tool_choice',
    'previous_response_id',
    'apiKey',
  ]) {
    check(`Responses body excludes ${key}`, () => {
      assert.equal(Object.hasOwn(body, key), false)
    })
  }

  check('individual builder authenticates one exact Prompt Package', () => {
    const individual = buildAiChartD1P1AdapterBridge(
      fixture.catalog,
      fixture.structuralInputs[0],
      fixture.bundles[0],
      fixture.modelInputs[0],
      fixture.promptPackages[0],
    )
    assert.deepEqual(individual.descriptor, bridge.descriptor)
  })
  check('individual builder rejects another palace Package', () => {
    assertInvalid(() =>
      buildAiChartD1P1AdapterBridge(
        fixture.catalog,
        fixture.structuralInputs[0],
        fixture.bundles[0],
        fixture.modelInputs[0],
        fixture.promptPackages[1],
      ),
    )
  })
  check('eleven supplied Prompt Packages are rejected atomically', () => {
    assertInvalid(() => buildFrom(fixture, undefined, promptPackages.slice(0, 11)))
  })
  check('thirteen supplied Prompt Packages are rejected atomically', () => {
    assertInvalid(() =>
      buildFrom(fixture, undefined, [...promptPackages, promptPackages[0]]),
    )
  })
  check('reordered Prompt Packages are rejected', () => {
    assertInvalid(() =>
      buildFrom(fixture, undefined, [promptPackages[1], promptPackages[0], ...promptPackages.slice(2)]),
    )
  })
  check('modified instructions with recomputed hashes are rejected', () => {
    const supplied = structuredClone(promptPackages) as Mutable<
      AiChartD1P1PromptPackage
    >[]
    ;(supplied[0] as unknown as Record<string, unknown>).instructions =
      `${supplied[0].instructions}\nattacker`
    recalculatePromptPackageTextBindings(supplied[0])
    assertInvalid(() => buildFrom(fixture, undefined, supplied))
  })
  check('modified userInput with recomputed hashes is rejected', () => {
    const supplied = structuredClone(promptPackages) as Mutable<
      AiChartD1P1PromptPackage
    >[]
    const input = JSON.parse(supplied[0].userInput) as Record<string, unknown>
    input.chartId = 'chart:attacker'
    supplied[0].userInput = createAiChartD1P1CanonicalJson(input)
    recalculatePromptPackageTextBindings(supplied[0])
    assertInvalid(() => buildFrom(fixture, undefined, supplied))
  })
  check('modified Package sourceTrace is rejected', () => {
    const supplied = structuredClone(promptPackages) as Mutable<
      AiChartD1P1PromptPackage
    >[]
    supplied[0].sourceTrace.ruleIds.reverse()
    recalculatePromptPackageFingerprint(supplied[0])
    assertInvalid(() => buildFrom(fixture, undefined, supplied))
  })
  check('modified Package budget is rejected', () => {
    const supplied = structuredClone(promptPackages) as Mutable<
      AiChartD1P1PromptPackage
    >[]
    supplied[0].budget.totalUtf8Bytes += 1
    recalculatePromptPackageFingerprint(supplied[0])
    assertInvalid(() => buildFrom(fixture, undefined, supplied))
  })
  check('modified Model Input with recomputed fingerprint is rejected', () => {
    const supplied = structuredClone(modelInputs) as Mutable<
      (typeof modelInputs)[number]
    >[]
    supplied[0].chartId = 'chart:attacker'
    recalculateModelInputFingerprint(supplied[0])
    assertInvalid(() => buildFrom(fixture, supplied))
  })
  const otherFixture = await createAdapterBridgeFixture('bridge-other')
  check('mixed chart sources are rejected', () => {
    const supplied = [...promptPackages]
    supplied[0] = otherFixture.promptPackages[0]
    assertInvalid(() => buildFrom(fixture, undefined, supplied))
  })
  check('mixed run Model Input is rejected', () => {
    const supplied = [...modelInputs]
    supplied[0] = otherFixture.modelInputs[0]
    assertInvalid(() => buildFrom(fixture, supplied))
  })
  check('caller cannot override request configuration with an extra argument', () => {
    const invoke = buildAiChartD1P1AdapterBridges as unknown as (
      ...args: unknown[]
    ) => readonly AiChartD1P1AdapterBridge[]
    const built = invoke(
      fixture.catalog,
      fixture.structuralInputs,
      fixture.bundles,
      fixture.modelInputs,
      fixture.promptPackages,
      {
        instructions: 'attacker',
        userInput: 'attacker',
        schema: {},
        parseResult: () => null,
        reasoningEffort: 'high',
        timeoutMs: 1_000,
        maxOutputTokens: 256,
      },
    )
    assert.equal(built[0].request.instructions, promptPackages[0].instructions)
    assert.equal(built[0].request.userInput, promptPackages[0].userInput)
    assert.equal(built[0].request.reasoningEffort, 'medium')
    assert.equal(built[0].request.timeoutMs, 120_000)
    assert.equal(
      built[0].request.maxOutputTokens,
      AI_CHART_D1_P1_MAX_OUTPUT_TOKENS,
    )
  })

  const validResult = createValidAiChartD1P1Result(modelInput)
  check('valid synthetic P1 Result passes the source-bound parser', () => {
    assert.deepEqual(parseResult(bridge, validResult), validResult)
  })
  check('parsed Result is recursively frozen', () => {
    const parsed = parseResult(bridge, validResult)
    assert.equal(Object.isFrozen(parsed), true)
    assert.equal(Object.isFrozen(parsed.primaryAxis), true)
    assert.equal(Object.isFrozen(parsed.directCandidates), true)
    assert.equal(Object.isFrozen(parsed.directCandidates[0]), true)
    assert.equal(Object.isFrozen(parsed.coverage), true)
  })
  check('caller mutation cannot change a parsed Result', () => {
    const supplied = createValidAiChartD1P1Result(modelInput)
    const parsed = parseResult(bridge, supplied)
    supplied.primaryAxis.statement = 'mutated'
    assert.equal(parsed.primaryAxis.statement, 'synthetic primary axis')
  })

  for (const [name, mutate] of [
    ['contractVersion', (value: Mutable<AiChartD1P1Result>) => {
      ;(value as unknown as Record<string, unknown>).contractVersion = 'output/v2'
    }],
    ['task', (value: Mutable<AiChartD1P1Result>) => {
      ;(value as unknown as Record<string, unknown>).task = 'F1'
    }],
    ['callId', (value: Mutable<AiChartD1P1Result>) => {
      value.callId = 'call:other'
    }],
    ['chartId', (value: Mutable<AiChartD1P1Result>) => {
      value.chartId = 'chart:other'
    }],
    ['palaceId', (value: Mutable<AiChartD1P1Result>) => {
      value.palaceId = modelInputs[1].targetPalaceId
    }],
    ['palace name', (value: Mutable<AiChartD1P1Result>) => {
      value.palace = modelInputs[1].structuralContext.targetPalace.canonicalName
    }],
  ] as const) {
    check(`wrong Result ${name} is rejected`, () => {
      const value = createValidAiChartD1P1Result(modelInput)
      mutate(value)
      assertResultInvalid(() => parseResult(bridge, value))
    })
  }
  check('another palace Result cannot enter this parser', () => {
    const otherResult = createValidAiChartD1P1Result(modelInputs[1])
    assertResultInvalid(() => parseResult(bridge, otherResult))
  })
  check('status invalid is rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.status = 'invalid'
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.IDENTITY_OR_STATUS_MISMATCH,
    )
  })
  check('invalid Result shape has a fixed safe reason', () => {
    const value = createValidAiChartD1P1Result(modelInput) as unknown as Record<
      string,
      unknown
    >
    value.primaryAxis = null
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.RESULT_SHAPE_INVALID,
    )
  })
  const malformedDuplicateMarker = 'synthetic-malformed-duplicate-marker'
  for (const [name, mutate] of [
    [
      'missing top-level field',
      (value: Mutable<AiChartD1P1Result>) => {
        delete (value as unknown as Record<string, unknown>).callId
      },
    ],
    [
      'missing coverage field',
      (value: Mutable<AiChartD1P1Result>) => {
        delete (value.coverage as unknown as Record<string, unknown>)
          .noblesCovered
      },
    ],
    [
      'invalid primary axis',
      (value: Mutable<AiChartD1P1Result>) => {
        ;(value as unknown as Record<string, unknown>).primaryAxis = null
      },
    ],
    [
      'invalid candidate',
      (value: Mutable<AiChartD1P1Result>) => {
        value.directCandidates[0].candidateId = `${malformedDuplicateMarker} invalid`
      },
    ],
    [
      'invalid boundary',
      (value: Mutable<AiChartD1P1Result>) => {
        value.d2Boundaries.push({
          boundaryId: `${malformedDuplicateMarker} invalid`,
          topic: 'synthetic topic',
          prohibitedD1Conclusion: 'synthetic prohibited conclusion',
          allowedD1Wording: 'synthetic allowed wording',
          reason: 'synthetic reason',
        })
      },
    ],
    [
      'invalid warnings',
      (value: Mutable<AiChartD1P1Result>) => {
        value.warnings = [malformedDuplicateMarker, malformedDuplicateMarker]
      },
    ],
  ] as const) {
    check(`${name} takes precedence over coverage duplicates`, () => {
      const value = createValidAiChartD1P1Result(modelInput)
      value.coverage.majorStarsCovered = [
        malformedDuplicateMarker,
        malformedDuplicateMarker,
      ]
      mutate(value)
      const error = assertResultInvalid(
        () => parseCoverageWireResult(bridge, value),
        AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.RESULT_SHAPE_INVALID,
      )
      assertSafeResultInvalid(error, [malformedDuplicateMarker])
    })
  }
  check('mixed-type coverage duplicate remains a shape error', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    ;(value.coverage as unknown as Record<string, unknown>).majorStarsCovered = [
      malformedDuplicateMarker,
      malformedDuplicateMarker,
      42,
    ]
    const error = assertResultInvalid(
      () => parseCoverageWireResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.RESULT_SHAPE_INVALID,
    )
    assertSafeResultInvalid(error, [malformedDuplicateMarker])
  })
  const coveragePriorityInput = modelInputs[2]
  const coveragePriorityBridge = bridges[2]
  const coverageDuplicateAdjacentPairMatrix = [
    [
      'directMeaningsConsidered',
      'majorStarsCovered',
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_DIRECT_MEANINGS_DUPLICATE,
    ],
    [
      'majorStarsCovered',
      'minorStarsCovered',
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MAJOR_STARS_MISMATCH,
    ],
    [
      'minorStarsCovered',
      'mutagensCovered',
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MINOR_STARS_MISMATCH,
    ],
    [
      'mutagensCovered',
      'maleficsCovered',
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MUTAGENS_MISMATCH,
    ],
    [
      'maleficsCovered',
      'noblesCovered',
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MALEFICS_MISMATCH,
    ],
  ] as const
  for (const [
    firstField,
    secondField,
    expectedReasonCode,
  ] of coverageDuplicateAdjacentPairMatrix) {
    check(`multiple coverage duplicates prioritize ${firstField} over ${secondField}`, () => {
      assertNoFetch(() => {
        const value = createValidAiChartD1P1Result(coveragePriorityInput)
        const firstValue = value.coverage[firstField][0]
        const secondValue = value.coverage[secondField][0]
        assert.equal(value.coverage[firstField].length > 0, true)
        assert.equal(value.coverage[secondField].length > 0, true)
        assert.ok(firstValue)
        assert.ok(secondValue)
        value.coverage[firstField].push(firstValue)
        value.coverage[secondField].push(secondValue)
        const error = assertResultInvalid(
          () => parseCoverageWireResult(coveragePriorityBridge, value),
          expectedReasonCode,
        )
        assertSafeResultInvalid(error, [firstValue, secondValue])
        assert.equal(Object.isFrozen(error), true)
      })
    })
  }
  check('all-six coverage duplicates select direct meanings first', () => {
    assertNoFetch(() => {
      const value = createValidAiChartD1P1Result(coveragePriorityInput)
      const duplicateValues: string[] = []
      for (const field of [
        'directMeaningsConsidered',
        'majorStarsCovered',
        'minorStarsCovered',
        'mutagensCovered',
        'maleficsCovered',
        'noblesCovered',
      ] as const) {
        const firstValue = value.coverage[field][0]
        assert.equal(value.coverage[field].length > 0, true)
        assert.ok(firstValue)
        duplicateValues.push(firstValue)
        value.coverage[field].push(firstValue)
      }
      const error = assertResultInvalid(
        () => parseCoverageWireResult(coveragePriorityBridge, value),
        AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_DIRECT_MEANINGS_DUPLICATE,
      )
      assertSafeResultInvalid(error, duplicateValues)
      assert.equal(Object.isFrozen(error), true)
    })
  })
  check('source-bound parser matches formal parser top-level traversal count', () => {
    const formalValue = createValidAiChartD1P1Result(modelInput)
    let formalOwnKeysCount = 0
    const formalProxy = new Proxy(formalValue, {
      ownKeys(target) {
        formalOwnKeysCount += 1
        if (formalOwnKeysCount > 2) throw new Error('unexpected traversal')
        return Reflect.ownKeys(target)
      },
    })
    assert.doesNotThrow(() => parseAiChartD1P1Result(formalProxy))

    const sourceBoundValue = createValidAiChartD1P1Result(modelInput)
    let sourceBoundOwnKeysCount = 0
    const sourceBoundProxy = new Proxy(sourceBoundValue, {
      ownKeys(target) {
        sourceBoundOwnKeysCount += 1
        if (sourceBoundOwnKeysCount > formalOwnKeysCount) {
          throw new Error('unexpected traversal')
        }
        return Reflect.ownKeys(target)
      },
    })
    assert.throws(
      () => parseWireResult(bridge, sourceBoundProxy),
      AiChartD1P1AdapterBridgeResultInvalidError,
    )
    assert.equal(formalOwnKeysCount, 2)
    assert.equal(sourceBoundOwnKeysCount, formalOwnKeysCount)
  })
  check('source-bound parser rejects an accessor without executing it', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    let accessorExecuted = false
    Object.defineProperty(value, 'callId', {
      enumerable: true,
      configurable: true,
      get() {
        accessorExecuted = true
        return malformedDuplicateMarker
      },
    })
    const error = assertResultInvalid(
      () => parseWireResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.RESULT_SHAPE_INVALID,
    )
    assert.equal(accessorExecuted, false)
    assertSafeResultInvalid(error, [malformedDuplicateMarker])
  })
  check('source-bound parser rejects a symbol key', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const marker = Symbol(malformedDuplicateMarker)
    ;(value as unknown as Record<PropertyKey, unknown>)[marker] = true
    const error = assertResultInvalid(
      () => parseWireResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.RESULT_SHAPE_INVALID,
    )
    assertSafeResultInvalid(error, [malformedDuplicateMarker])
  })
  check('source-bound parser rejects a cyclic result graph', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    ;(value.warnings as unknown[]).push(value)
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.RESULT_SHAPE_INVALID,
    )
  })
  check('complete Result with omitted items is rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.coverage.omittedItems.push({ item: 'missing', reason: 'missing' })
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_STATUS_OMISSIONS_MISMATCH,
    )
  })
  for (const field of [
    'oppositeProcessed',
    'hiddenCombinationProcessed',
    'trinesProcessed',
  ] as const) {
    check(`complete Result requires ${field}`, () => {
      const value = createValidAiChartD1P1Result(modelInput)
      value.coverage[field] = false
      assertResultInvalid(
        () => parseResult(bridge, value),
        AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_PROCESSING_FLAGS_MISMATCH,
      )
    })
  }
  check('complete Result with warnings is rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.warnings.push('synthetic warning')
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_STATUS_OMISSIONS_MISMATCH,
    )
  })
  check('incomplete Result without omissions is rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.status = 'incomplete'
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_STATUS_OMISSIONS_MISMATCH,
    )
  })
  check('incomplete Result with omissions passes', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.status = 'incomplete'
    value.coverage.omittedItems.push({ item: 'known gap', reason: 'not processed' })
    assert.equal(parseResult(bridge, value).status, 'incomplete')
  })
  check('partial Result without omissions is rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.status = 'partial'
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_STATUS_OMISSIONS_MISMATCH,
    )
  })
  check('ready input may return partial with explicit omissions', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.status = 'partial'
    value.coverage.omittedItems.push({ item: 'known gap', reason: 'not processed' })
    assert.equal(parseResult(bridge, value).status, 'partial')
  })

  check('complete fixture carries exact authenticated coverage', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    assert.equal(value.coverage.directMeaningsConsidered.length > 0, true)
    assert.equal(value.coverage.majorStarsCovered.length > 0, true)
    assert.equal(value.coverage.minorStarsCovered.length > 0, true)
    assert.doesNotThrow(() => parseResult(bridge, value))
  })
  check('remaining model-authored coverage is order-insensitive', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.coverage.directMeaningsConsidered.reverse()
    value.coverage.mutagensCovered.reverse()
    value.coverage.maleficsCovered.reverse()
    assert.doesNotThrow(() => parseResult(bridge, value))
  })
  check('complete Result rejects an empty direct meaning set as missing', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const sensitiveMeaningIds = [...value.coverage.directMeaningsConsidered]
    assert.equal(sensitiveMeaningIds.length > 0, true)
    value.coverage.directMeaningsConsidered = []
    const error = assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_DIRECT_MEANINGS_COMPLETE_SET_MISSING,
    )
    assertSafeResultInvalid(error, sensitiveMeaningIds)
  })
  check('complete Result rejects one missing direct meaning as missing', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const missingMeaningId = value.coverage.directMeaningsConsidered.shift()
    assert.ok(missingMeaningId)
    const error = assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_DIRECT_MEANINGS_COMPLETE_SET_MISSING,
    )
    assertSafeResultInvalid(error, [missingMeaningId])
  })
  check('direct meanings reject duplicate entries with a fixed safe reason', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const duplicateMeaningId = value.coverage.directMeaningsConsidered[0]
    assert.ok(duplicateMeaningId)
    value.coverage.directMeaningsConsidered.push(duplicateMeaningId)
    const error = assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_DIRECT_MEANINGS_DUPLICATE,
    )
    assertSafeResultInvalid(error, [duplicateMeaningId])
  })
  for (const [name, field, reasonCode] of [
    [
      'target natal mutagens',
      'mutagensCovered',
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MUTAGENS_MISMATCH,
    ],
    [
      'relevant malefic signals',
      'maleficsCovered',
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MALEFICS_MISMATCH,
    ],
  ] as const) {
    check(`complete Result rejects empty ${name}`, () => {
      const value = createValidAiChartD1P1Result(modelInput)
      assert.equal(value.coverage[field].length > 0, true)
      value.coverage[field] = []
      assertResultInvalid(() => parseResult(bridge, value), reasonCode)
    })
    check(`complete Result rejects one missing ${name} source`, () => {
      const value = createValidAiChartD1P1Result(modelInput)
      assert.equal(value.coverage[field].length > 0, true)
      value.coverage[field] = value.coverage[field].slice(1)
      assertResultInvalid(() => parseResult(bridge, value), reasonCode)
    })
    check(`${name} rejects duplicate entries`, () => {
      const value = createValidAiChartD1P1Result(modelInput)
      const first = value.coverage[field][0]
      assert.ok(first)
      value.coverage[field] = [...value.coverage[field], first]
      assertResultInvalid(() => parseResult(bridge, value), reasonCode)
    })
  }
  check('complete Result rejects missing target supporting-star evidence', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const star =
      modelInput.structuralContext.targetPalace.modeledSupportingStars[0]
    assert.ok(star)
    removeTargetSupportingEvidence(value, modelInput, star.name)
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MINOR_STARS_MISMATCH,
    )
  })
  const oppositeMeaning = fixture.catalog.palaceMeanings.find(
    (meaning) =>
      meaning.palaceId ===
      modelInput.structuralContext.oppositePalace.palaceId,
  )
  assert.ok(oppositeMeaning)
  assert.equal(
    modelInput.knowledgeContext.meanings.some(
      (meaning) => meaning.meaningId === oppositeMeaning.meaningId,
    ),
    false,
  )
  const unexpectedMeaningId = 'meaning:invented'
  check('invented meaningId is rejected from direct coverage', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.coverage.directMeaningsConsidered = [unexpectedMeaningId]
    const error = assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_DIRECT_MEANINGS_UNEXPECTED,
    )
    assertSafeResultInvalid(error, [unexpectedMeaningId])
  })
  check('opposite meaningId is rejected from direct coverage', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.coverage.directMeaningsConsidered = [oppositeMeaning.meaningId]
    const error = assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_DIRECT_MEANINGS_UNEXPECTED,
    )
    assertSafeResultInvalid(error, [oppositeMeaning.meaningId])
  })
  check('duplicate precedes unexpected regardless of array order', () => {
    const expectedMeaningId = modelInput.knowledgeContext.meanings.find(
      (meaning) => meaning.palaceRole === 'target',
    )?.meaningId
    assert.ok(expectedMeaningId)
    for (const directMeaningsConsidered of [
      [unexpectedMeaningId, unexpectedMeaningId, expectedMeaningId],
      [expectedMeaningId, unexpectedMeaningId, unexpectedMeaningId],
    ]) {
      const value = createValidAiChartD1P1Result(modelInput)
      value.coverage.directMeaningsConsidered = directMeaningsConsidered
      assertResultInvalid(
        () => parseResult(bridge, value),
        AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_DIRECT_MEANINGS_DUPLICATE,
      )
    }
  })
  check('duplicate precedes complete exact-set missing', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const expectedMeaningId = value.coverage.directMeaningsConsidered[0]
    assert.ok(expectedMeaningId)
    value.coverage.directMeaningsConsidered = [
      expectedMeaningId,
      expectedMeaningId,
    ]
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_DIRECT_MEANINGS_DUPLICATE,
    )
  })
  check('unexpected precedes complete exact-set missing', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.coverage.directMeaningsConsidered = [unexpectedMeaningId]
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_DIRECT_MEANINGS_UNEXPECTED,
    )
  })
  check('partial duplicate precedes omission trace missing', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const expectedMeaningId = value.coverage.directMeaningsConsidered[0]
    assert.ok(expectedMeaningId)
    value.status = 'partial'
    value.coverage.directMeaningsConsidered = [
      expectedMeaningId,
      expectedMeaningId,
    ]
    value.coverage.omittedItems = [
      { item: 'unrelated omission', reason: 'not processed' },
    ]
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_DIRECT_MEANINGS_DUPLICATE,
    )
  })
  check('partial unexpected precedes omission trace missing', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.status = 'partial'
    value.coverage.directMeaningsConsidered = [unexpectedMeaningId]
    value.coverage.omittedItems = [
      { item: 'unrelated omission', reason: 'not processed' },
    ]
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_DIRECT_MEANINGS_UNEXPECTED,
    )
  })
  const otherMajorStar = modelInputs[1].structuralContext.targetPalace
    .canonicalMajorStars[0]
  assert.ok(otherMajorStar)
  check('wire coverage rejects another palace model-authored major star', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.coverage.majorStarsCovered = [otherMajorStar.name]
    assertResultInvalid(
      () => parseCoverageWireResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MAJOR_STARS_MISMATCH,
    )
  })
  check('wire coverage rejects an unseen model-authored major star', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.coverage.majorStarsCovered = ['紫微']
    assertResultInvalid(
      () => parseCoverageWireResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MAJOR_STARS_MISMATCH,
    )
  })
  const otherSupportingStar = modelInputs[1].structuralContext.targetPalace
    .modeledSupportingStars[0]
  assert.ok(otherSupportingStar)
  check('another palace supporting star is rejected from coverage', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.coverage.minorStarsCovered = [otherSupportingStar.name]
    assertResultInvalid(
      () => parseMinorCoverageWireResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MINOR_STARS_MISMATCH,
    )
  })
  check('an unseen supporting star is rejected from coverage', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.coverage.minorStarsCovered = ['天刑']
    assertResultInvalid(
      () => parseMinorCoverageWireResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MINOR_STARS_MISMATCH,
    )
  })
  check('an actual natal-mutagen pair may use descriptive wording', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const targetStar = modelInput.structuralContext.targetPalace
      .canonicalMajorStars[0]
    assert.ok(targetStar?.natalMutagen)
    value.coverage.mutagensCovered = [
      `已覆蓋 ${targetStar.name} 的 ${targetStar.natalMutagen}`,
    ]
    assert.doesNotThrow(() => parseResult(bridge, value))
  })
  check('a mismatched star and natal-mutagen pair is rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const targetStar = modelInput.structuralContext.targetPalace
      .canonicalMajorStars[0]
    assert.ok(targetStar)
    value.coverage.mutagensCovered = [`${targetStar.name} 化權`]
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MUTAGENS_MISMATCH,
    )
  })
  check('another palace natal-mutagen pair is rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const otherStar = modelInputs[1].structuralContext.targetPalace
      .canonicalMajorStars[0]
    assert.ok(otherStar?.natalMutagen)
    value.coverage.mutagensCovered = [
      `${otherStar.name} ${otherStar.natalMutagen}`,
    ]
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MUTAGENS_MISMATCH,
    )
  })
  check('valid natal-mutagen wording cannot append another palace pair', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const targetPair = value.coverage.mutagensCovered[0]
    const otherStar = modelInputs[1].structuralContext.targetPalace
      .canonicalMajorStars[0]
    assert.ok(targetPair)
    assert.ok(otherStar?.natalMutagen)
    value.coverage.mutagensCovered = [
      `${targetPair}；${otherStar.name} ${otherStar.natalMutagen}`,
    ]
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MUTAGENS_MISMATCH,
    )
  })
  check('two wordings cannot duplicate one natal-mutagen source', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const pair = value.coverage.mutagensCovered[0]
    assert.ok(pair)
    value.coverage.mutagensCovered = [pair, `已覆蓋 ${pair}`]
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MUTAGENS_MISMATCH,
    )
  })
  check('actual malefic signal types may use descriptive wording', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.coverage.maleficsCovered = value.coverage.maleficsCovered.map(
      (signalType) => `已覆蓋 ${signalType} 訊號`,
    )
    assert.doesNotThrow(() => parseResult(bridge, value))
  })
  check('an unobserved malefic signal type is rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const observed = new Set(value.coverage.maleficsCovered)
    const unobserved = ['擎羊', '陀羅', '火星', '鈴星', '生年化忌'].find(
      (type) => !observed.has(type),
    )
    assert.ok(unobserved)
    value.coverage.maleficsCovered = [unobserved]
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MALEFICS_MISMATCH,
    )
  })
  check('valid malefic wording cannot append an unobserved signal type', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const observed = value.coverage.maleficsCovered[0]
    const observedSet = new Set(value.coverage.maleficsCovered)
    const unobserved = ['擎羊', '陀羅', '火星', '鈴星', '生年化忌'].find(
      (type) => !observedSet.has(type),
    )
    assert.ok(observed)
    assert.ok(unobserved)
    value.coverage.maleficsCovered = [
      `${observed} 並誤列 ${unobserved}`,
      ...value.coverage.maleficsCovered.slice(1),
    ]
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MALEFICS_MISMATCH,
    )
  })
  check('two wordings cannot duplicate one malefic source', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const first = value.coverage.maleficsCovered[0]
    assert.ok(first)
    value.coverage.maleficsCovered = [
      first,
      `已覆蓋 ${first}`,
      ...value.coverage.maleficsCovered.slice(1),
    ]
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MALEFICS_MISMATCH,
    )
  })
  check('a signal placementId cannot replace malefic coverage semantics', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const signal = [
      ...modelInput.structuralContext.targetGlobalScan.directSignals,
      ...modelInput.structuralContext.targetGlobalScan.oppositeSignals,
      ...modelInput.structuralContext.targetGlobalScan.hiddenCombinationSignals,
      ...modelInput.structuralContext.targetGlobalScan.trineSignals,
    ][0]
    assert.ok(signal)
    value.coverage.maleficsCovered = [signal.starPlacementId]
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MALEFICS_MISMATCH,
    )
  })
  check('a signalId cannot replace malefic coverage semantics', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const signal = [
      ...modelInput.structuralContext.targetGlobalScan.directSignals,
      ...modelInput.structuralContext.targetGlobalScan.oppositeSignals,
      ...modelInput.structuralContext.targetGlobalScan.hiddenCombinationSignals,
      ...modelInput.structuralContext.targetGlobalScan.trineSignals,
    ][0]
    assert.ok(signal)
    value.coverage.maleficsCovered = [signal.signalId]
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MALEFICS_MISMATCH,
    )
  })

  const nobleIndex = modelInputs.findIndex(
    (input) => input.structuralContext.targetPalace.modeledSupportingStars
      .some((star) => ['左輔', '右弼', '天魁', '天鉞'].includes(star.name)),
  )
  assert.notEqual(nobleIndex, -1)
  const nobleInput = modelInputs[nobleIndex]
  const nobleBridge = bridges[nobleIndex]
  check('an actual target noble star passes coverage binding', () => {
    const value = createValidAiChartD1P1Result(nobleInput)
    assert.equal(value.coverage.noblesCovered.length > 0, true)
    assert.doesNotThrow(() => parseResult(nobleBridge, value))
  })
  check('coverage derives exact noble stars from validated candidate evidence', () => {
    const value = createValidAiChartD1P1Result(nobleInput)
    value.coverage.noblesCovered = []
    assert.deepEqual(
      parseResult(nobleBridge, value).coverage.noblesCovered,
      nobleInput.structuralContext.targetPalace.modeledSupportingStars
        .map((star) => star.name)
        .filter((starName) =>
          ['左輔', '右弼', '天魁', '天鉞'].includes(starName),
        ),
    )
  })
  check('wire parser rejects a model-authored noble coverage value', () => {
    const value = createValidAiChartD1P1Result(nobleInput)
    assertResultInvalid(
      () => parseNobleCoverageWireResult(nobleBridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_NOBLES_MISMATCH,
    )
  })

  const coverageDiagnosticMutationMatrix = [
    [
      'direct meanings',
      bridge,
      modelInput,
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_DIRECT_MEANINGS_DUPLICATE,
      (value: Mutable<AiChartD1P1Result>) => {
        const first = value.coverage.directMeaningsConsidered[0]
        assert.ok(first)
        value.coverage.directMeaningsConsidered.push(first)
      },
    ],
    [
      'major stars',
      bridge,
      modelInput,
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MAJOR_STARS_MISMATCH,
      (value: Mutable<AiChartD1P1Result>) => {
        const first = value.coverage.majorStarsCovered[0]
        assert.ok(first)
        value.coverage.majorStarsCovered.push(first)
      },
    ],
    [
      'minor stars',
      bridge,
      modelInput,
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MINOR_STARS_MISMATCH,
      (value: Mutable<AiChartD1P1Result>) => {
        const first = value.coverage.minorStarsCovered[0]
        assert.ok(first)
        value.coverage.minorStarsCovered.push(first)
      },
    ],
    [
      'mutagens',
      bridge,
      modelInput,
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MUTAGENS_MISMATCH,
      (value: Mutable<AiChartD1P1Result>) => {
        const first = value.coverage.mutagensCovered[0]
        assert.ok(first)
        value.coverage.mutagensCovered.push(first)
      },
    ],
    [
      'malefics',
      bridge,
      modelInput,
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MALEFICS_MISMATCH,
      (value: Mutable<AiChartD1P1Result>) => {
        const first = value.coverage.maleficsCovered[0]
        assert.ok(first)
        value.coverage.maleficsCovered.push(first)
      },
    ],
    [
      'nobles',
      nobleBridge,
      nobleInput,
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_NOBLES_MISMATCH,
      (value: Mutable<AiChartD1P1Result>) => {
        const first = value.coverage.noblesCovered[0]
        assert.ok(first)
        value.coverage.noblesCovered.push(first)
      },
    ],
    [
      'processing flags',
      bridge,
      modelInput,
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_PROCESSING_FLAGS_MISMATCH,
      (value: Mutable<AiChartD1P1Result>) => {
        value.coverage.oppositeProcessed = false
      },
    ],
    [
      'status and omissions',
      bridge,
      modelInput,
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_STATUS_OMISSIONS_MISMATCH,
      (value: Mutable<AiChartD1P1Result>) => {
        value.coverage.omittedItems.push({
          item: 'synthetic-gap',
          reason: 'synthetic-gap',
        })
      },
    ],
  ] as const

  for (const [
    name,
    matrixBridge,
    matrixInput,
    expectedReasonCode,
    mutate,
  ] of coverageDiagnosticMutationMatrix) {
    check(`coverage diagnostic matrix maps ${name}`, () => {
      const value = createValidAiChartD1P1Result(matrixInput)
      mutate(value)
      assertResultInvalid(
        () =>
          name === 'major stars'
            ? parseCoverageWireResult(matrixBridge, value)
            : name === 'minor stars'
              ? parseMinorCoverageWireResult(matrixBridge, value)
              : name === 'nobles'
                ? parseNobleCoverageWireResult(matrixBridge, value)
            : parseResult(matrixBridge, value),
        expectedReasonCode,
      )
    })
  }

  const coverageInput = modelInputs[2]
  const coverageBridge = bridges[2]
  function createSubsetResult(status: 'partial' | 'incomplete') {
    const value = createValidAiChartD1P1Result(coverageInput)
    value.status = status
    const missingMeaning = value.coverage.directMeaningsConsidered.shift()
    const missingMinor = value.coverage.minorStarsCovered[0]
    const missingMutagen = value.coverage.mutagensCovered.shift()
    const missingMalefic = value.coverage.maleficsCovered.shift()
    assert.ok(missingMeaning)
    assert.ok(missingMinor)
    assert.ok(missingMutagen)
    assert.ok(missingMalefic)
    removeTargetSupportingEvidence(value, coverageInput, missingMinor)
    value.coverage.omittedItems = [
      { item: missingMeaning, reason: 'target meaning omitted' },
      {
        item: missingMinor,
        reason: 'target supporting star omitted',
      },
      { item: missingMutagen, reason: 'target natal mutagen omitted' },
      { item: missingMalefic, reason: 'relevant malefic omitted' },
    ]
    return value
  }
  check('partial authenticated subsets pass with exact omission traces', () => {
    assert.equal(
      parseResult(coverageBridge, createSubsetResult('partial')).status,
      'partial',
    )
  })
  check('incomplete authenticated subsets pass with exact omission traces', () => {
    assert.equal(
      parseResult(coverageBridge, createSubsetResult('incomplete')).status,
      'incomplete',
    )
  })
  for (const status of ['partial', 'incomplete'] as const) {
    for (const suffix of ['A', 'z', '0', '_', '-', '.', ':']) {
      check(`${status} opaque meaningId rejects a longer valid-ID suffix ${suffix}`, () => {
        const value = createSubsetResult(status)
        const meaningOmission = value.coverage.omittedItems[0]
        assert.ok(meaningOmission)
        meaningOmission.item = `${meaningOmission.item}${suffix}long`
        assertResultInvalid(
          () => parseResult(coverageBridge, value),
          AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_DIRECT_MEANINGS_OMISSION_TRACE_MISSING,
        )
      })
    }
    for (const prefix of ['A', 'z', '0', '_', '-', '.', ':']) {
      check(`${status} opaque meaningId rejects a longer valid-ID prefix ${prefix}`, () => {
        const value = createSubsetResult(status)
        const meaningOmission = value.coverage.omittedItems[0]
        assert.ok(meaningOmission)
        meaningOmission.item = `${prefix}${meaningOmission.item}`
        assertResultInvalid(
          () => parseResult(coverageBridge, value),
          AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_DIRECT_MEANINGS_OMISSION_TRACE_MISSING,
        )
      })
    }
  }
  for (const separator of [' ', '\n', '，', '。']) {
    check(`opaque meaningId accepts a complete token before ${JSON.stringify(separator)}`, () => {
      const value = createSubsetResult('partial')
      const meaningOmission = value.coverage.omittedItems[0]
      assert.ok(meaningOmission)
      meaningOmission.item =
        `未處理${separator}${meaningOmission.item}${separator}因資料不足`
      assert.equal(parseResult(coverageBridge, value).status, 'partial')
    })
  }
  check('opaque meaningId may be traced exactly inside an omission reason', () => {
    const value = createSubsetResult('partial')
    const meaningOmission = value.coverage.omittedItems[0]
    assert.ok(meaningOmission)
    const missingMeaningId = meaningOmission.item
    meaningOmission.item = 'target meaning 未處理'
    meaningOmission.reason = `未處理 ${missingMeaningId}，因資料不足`
    assert.equal(parseResult(coverageBridge, value).status, 'partial')
  })
  check('one omitted item can trace multiple complete opaque meaningIds', () => {
    const value = createValidAiChartD1P1Result(coverageInput)
    value.status = 'partial'
    const firstMissingMeaningId =
      value.coverage.directMeaningsConsidered.shift()
    const secondMissingMeaningId =
      value.coverage.directMeaningsConsidered.shift()
    assert.ok(firstMissingMeaningId)
    assert.ok(secondMissingMeaningId)
    value.coverage.omittedItems = [
      {
        item: `${firstMissingMeaningId}、${secondMissingMeaningId}`,
        reason: '兩項 target meanings 因資料不足未處理',
      },
    ]
    assert.equal(parseResult(coverageBridge, value).status, 'partial')
  })
  for (const status of ['partial', 'incomplete'] as const) {
    check(`${status} subset rejects a missing meaning omission trace`, () => {
      const value = createSubsetResult(status)
      value.coverage.omittedItems = value.coverage.omittedItems.slice(1)
      assertResultInvalid(
        () => parseResult(coverageBridge, value),
        AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_DIRECT_MEANINGS_OMISSION_TRACE_MISSING,
      )
    })
    check(`${status} subset rejects a missing mutagen omission trace`, () => {
      const value = createSubsetResult(status)
      value.coverage.omittedItems = value.coverage.omittedItems.filter(
        (item) => !item.reason.includes('natal mutagen'),
      )
      assertResultInvalid(
        () => parseResult(coverageBridge, value),
        AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MUTAGENS_MISMATCH,
      )
    })
    check(`${status} wire coverage rejects a model-authored major star`, () => {
      const value = createSubsetResult(status)
      value.coverage.majorStarsCovered.push('紫微')
      assertResultInvalid(
        () => parseCoverageWireResult(coverageBridge, value),
        AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MAJOR_STARS_MISMATCH,
      )
    })
  }
  const omissionTraceMatrix = [
    [
      'direct meanings',
      coverageBridge,
      coverageInput,
      'directMeaningsConsidered',
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_DIRECT_MEANINGS_OMISSION_TRACE_MISSING,
    ],
    [
      'mutagens',
      coverageBridge,
      coverageInput,
      'mutagensCovered',
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MUTAGENS_MISMATCH,
    ],
    [
      'malefics',
      coverageBridge,
      coverageInput,
      'maleficsCovered',
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MALEFICS_MISMATCH,
    ],
  ] as const
  for (const status of ['partial', 'incomplete'] as const) {
    for (const [
      name,
      matrixBridge,
      matrixInput,
      field,
      expectedReasonCode,
    ] of omissionTraceMatrix) {
      check(`${status} ${name} require an exact omission trace`, () => {
        const value = createValidAiChartD1P1Result(matrixInput)
        assert.equal(value.coverage[field].length > 0, true)
        const missingSource = value.coverage[field].shift()
        assert.ok(missingSource)
        value.status = status
        value.coverage.omittedItems = [
          {
            item: 'synthetic unrelated omission',
            reason: 'synthetic unrelated omission',
          },
        ]
        assertResultInvalid(
          () => parseResult(matrixBridge, value),
          expectedReasonCode,
        )

        value.coverage.omittedItems.push({
          item: missingSource,
          reason: `omitted authenticated source ${missingSource}`,
        })
        assert.equal(parseResult(matrixBridge, value).status, status)
      })
    }
    check(`${status} minor stars require an exact omission trace`, () => {
      const value = createValidAiChartD1P1Result(coverageInput)
      const missingSource = value.coverage.minorStarsCovered[0]
      assert.ok(missingSource)
      removeTargetSupportingEvidence(value, coverageInput, missingSource)
      value.status = status
      value.coverage.omittedItems = [
        {
          item: 'synthetic unrelated omission',
          reason: 'synthetic unrelated omission',
        },
      ]
      assertResultInvalid(
        () => parseResult(coverageBridge, value),
        AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MINOR_STARS_MISMATCH,
      )

      value.coverage.omittedItems.push({
        item: missingSource,
        reason: `omitted authenticated source ${missingSource}`,
      })
      assert.equal(parseResult(coverageBridge, value).status, status)
    })
  }
  check('partial coverage cannot omit a source without naming it', () => {
    const value = createValidAiChartD1P1Result(coverageInput)
    value.status = 'partial'
    const missingMeaningId = value.coverage.directMeaningsConsidered.shift()
    assert.ok(missingMeaningId)
    value.coverage.omittedItems = [{ item: 'known gap', reason: 'not processed' }]
    const error = assertResultInvalid(
      () => parseResult(coverageBridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_DIRECT_MEANINGS_OMISSION_TRACE_MISSING,
    )
    assertSafeResultInvalid(error, [missingMeaningId])
  })
  check('partial coverage cannot trace an omitted meaning by meaning text alone', () => {
    const value = createValidAiChartD1P1Result(coverageInput)
    value.status = 'partial'
    const missingMeaningId = value.coverage.directMeaningsConsidered.shift()
    assert.ok(missingMeaningId)
    const missingMeaning = coverageInput.knowledgeContext.meanings.find(
      (meaning) => meaning.meaningId === missingMeaningId,
    )
    assert.ok(missingMeaning)
    value.coverage.omittedItems = [
      {
        item: missingMeaning.text,
        reason: 'target meaning text was not processed',
      },
    ]
    const error = assertResultInvalid(
      () => parseResult(coverageBridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_DIRECT_MEANINGS_OMISSION_TRACE_MISSING,
    )
    assertSafeResultInvalid(error, [missingMeaningId, missingMeaning.text])
  })
  check('complete Result cannot use empty coverage and empty omissions', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.coverage.directMeaningsConsidered = []
    value.coverage.majorStarsCovered = []
    value.coverage.minorStarsCovered = []
    value.coverage.mutagensCovered = []
    value.coverage.maleficsCovered = []
    value.coverage.noblesCovered = []
    value.coverage.omittedItems = []
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_DIRECT_MEANINGS_COMPLETE_SET_MISSING,
    )
  })

  const partialSnapshot = completeModelInputSnapshot()
  const partialPalaces = partialSnapshot.palaces as MutableRecord[]
  partialPalaces[3].majorStars = [
    { name: '太陽', type: 'major', scope: 'origin' },
  ]
  partialPalaces[0].minorStars = [
    ...(partialPalaces[0].minorStars as unknown[]),
    { name: '地空', type: 'tough', scope: 'origin' },
  ]
  const partialFixture = await customFixture('bridge-partial', partialSnapshot)
  const partialIndex = partialFixture.modelInputs.findIndex(
    (input) => input.structuralStatus === 'partial',
  )
  assert.notEqual(partialIndex, -1)
  const partialBridge = partialFixture.bridges[partialIndex]
  const partialInput = partialFixture.modelInputs[partialIndex]
  check('Structural partial Result remains partial and passes', () => {
    const value = createValidAiChartD1P1Result(partialInput)
    assert.equal(parseResult(partialBridge, value).status, 'partial')
  })
  check('Structural partial Result cannot claim complete', () => {
    const value = createValidAiChartD1P1Result(partialInput)
    value.status = 'complete'
    value.coverage.oppositeProcessed = true
    value.coverage.hiddenCombinationProcessed = true
    value.coverage.trinesProcessed = true
    value.coverage.omittedItems = []
    value.warnings = []
    assertResultInvalid(() => parseResult(partialBridge, value))
  })

  const borrowSnapshot = completeModelInputSnapshot()
  const borrowPalaces = borrowSnapshot.palaces as MutableRecord[]
  borrowPalaces[0].majorStars = []
  borrowPalaces[0].minorStars = []
  const borrowFixture = await customFixture('bridge-borrow', borrowSnapshot)
  const borrowBridge = borrowFixture.bridges[0]
  const borrowInput = borrowFixture.modelInputs[0]
  check('eligible borrowed source requires borrowed mode', () => {
    assert.equal(
      parseResult(
        borrowBridge,
        createValidAiChartD1P1Result(borrowInput),
      ).primaryAxis.borrowedStarMode,
      'borrowed',
    )
  })
  check('eligible borrowed source rejects none mode', () => {
    const value = createValidAiChartD1P1Result(borrowInput)
    value.primaryAxis.borrowedStarMode = 'none'
    assertResultInvalid(
      () => parseResult(borrowBridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.BORROWED_STAR_BINDING_MISMATCH,
    )
  })
  check('non-empty source rejects borrowed mode', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.borrowedStarMode = 'borrowed'
    assertResultInvalid(() => parseResult(bridge, value))
  })

  const blockedSnapshot = completeModelInputSnapshot()
  const blockedPalaces = blockedSnapshot.palaces as MutableRecord[]
  blockedPalaces[0].majorStars = []
  blockedPalaces[0].minorStars = [
    {
      name: '文昌',
      type: AI_CHART_D1_MODELED_SUPPORTING_STARS.文昌,
      scope: 'origin',
    },
  ]
  const blockedFixture = await customFixture('bridge-blocked', blockedSnapshot)
  check('blocked empty source cannot supply a nonempty effective major core', () => {
    const value = createValidAiChartD1P1Result(blockedFixture.modelInputs[0])
    assertResultInvalid(() => parseResult(blockedFixture.bridges[0], value))
  })
  check('blocked empty source rejects borrowed mode', () => {
    const value = createValidAiChartD1P1Result(blockedFixture.modelInputs[0])
    value.primaryAxis.borrowedStarMode = 'borrowed'
    assertResultInvalid(() => parseResult(blockedFixture.bridges[0], value))
  })

  check('primaryAxis accepts a selected Rule ID', () => {
    assert.doesNotThrow(() => parseResult(bridge, validResult))
  })
  check('primaryAxis rejects an unknown Rule ID', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.usedRuleIds = ['rule:unknown']
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.PRIMARY_AXIS_RULE_BINDING_MISMATCH,
    )
  })
  check('primaryAxis rejects empty Rule IDs', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.usedRuleIds = []
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('primaryAxis rejects duplicate Rule IDs', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const ruleId = modelInput.knowledgeContext.rules[0].ruleId
    value.primaryAxis.usedRuleIds = [ruleId, ruleId]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('primaryAxis majorStarCore is exact for canonical target stars', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    assert.deepEqual(
      parseResult(bridge, value).primaryAxis.majorStarCore,
      modelInput.structuralContext.targetPalace.canonicalMajorStars.map(
        (star) => star.name,
      ),
    )
  })
  check('wire parser rejects an exact model-authored majorStarCore', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    assertResultInvalid(
      () => parseWireResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.PRIMARY_AXIS_MAJOR_STAR_BINDING_MISMATCH,
    )
  })
  check('primaryAxis injects Server-owned major stars for an empty wire field', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.majorStarCore = []
    assert.deepEqual(
      parseResult(bridge, value).primaryAxis.majorStarCore,
      modelInput.structuralContext.targetPalace.canonicalMajorStars.map(
        (star) => star.name,
      ),
    )
  })
  check('coverage injects Server-owned major stars for an empty wire field', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.majorStarCore = []
    value.coverage.majorStarsCovered = []
    value.coverage.minorStarsCovered = []
    value.coverage.noblesCovered = []
    assert.deepEqual(
      bridge.request.parseResult(value).coverage.majorStarsCovered,
      effectiveMajorStarNames(modelInput),
    )
  })
  check('each request Schema reserves minorStarsCovered for Server derivation', () => {
    const expectedSupportingStars =
      modelInput.structuralContext.targetPalace.modeledSupportingStars.map(
        (star) => star.name,
      )
    const schema = coverageMinorStarsSchema(bridge.request.schema)
    assert.equal(schema.minItems, 0)
    assert.equal(schema.maxItems, 0)
    assert.deepEqual(asSchemaRecord(schema.items).enum, expectedSupportingStars)
  })
  check('coverage derives exact minor stars from validated candidate evidence', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.coverage.minorStarsCovered = []
    assert.deepEqual(
      parseResult(bridge, value).coverage.minorStarsCovered,
      modelInput.structuralContext.targetPalace.modeledSupportingStars.map(
        (star) => star.name,
      ),
    )
  })
  check('wire parser rejects an exact model-authored minor-star list', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.majorStarCore = []
    value.coverage.majorStarsCovered = []
    assertResultInvalid(
      () => parseWireResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MINOR_STARS_MISMATCH,
    )
  })
  check('complete coverage requires candidate evidence for every target minor star', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const targetStar =
      modelInput.structuralContext.targetPalace.modeledSupportingStars[0]
    const targetTrace = modelInput.knowledgeContext.selectionTrace.find(
      (trace) =>
        trace.reason === 'supporting_star_present' &&
        trace.palaceRole === 'target' &&
        trace.starName === targetStar.name,
    )
    assert.ok(targetTrace)
    for (const field of CANDIDATE_FIELDS) {
      value[field] = value[field].filter(
        (candidate) =>
          !(
            candidate.palaceIds.includes(modelInput.targetPalaceId) &&
            candidate.starBasis.includes(targetStar.name) &&
            candidate.usedRuleIds.includes(targetTrace.ruleId)
          ),
      )
    }
    value.coverage.minorStarsCovered = []
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MINOR_STARS_MISMATCH,
    )
  })
  const targetSupportingStar =
    modelInput.structuralContext.targetPalace.modeledSupportingStars[0]
  assert.ok(targetSupportingStar)
  const targetSupportingRule = targetSupportingRuleId(
    modelInput,
    targetSupportingStar.name,
  )
  function targetSupportingEvidenceCandidate(
    value: Mutable<AiChartD1P1Result>,
  ) {
    const candidate = value.combinedCandidates.find(
      (entry) =>
        entry.palaceIds.includes(modelInput.targetPalaceId) &&
        entry.starBasis.includes(targetSupportingStar.name) &&
        entry.usedRuleIds.includes(targetSupportingRule),
    )
    assert.ok(candidate)
    return candidate
  }
  check('minor-star evidence requires the star and Rule in the same Candidate', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const candidate = targetSupportingEvidenceCandidate(value)
    const replacementRule = modelInput.knowledgeContext.rules.find(
      (rule) => rule.ruleId !== targetSupportingRule,
    )
    assert.ok(replacementRule)
    candidate.usedRuleIds = [replacementRule.ruleId]
    candidate.ruleStatus = replacementRule.ruleStatus
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MINOR_STARS_MISMATCH,
    )
  })
  check('minor-star evidence requires the target star name in starBasis', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const candidate = targetSupportingEvidenceCandidate(value)
    const replacementStar =
      modelInput.structuralContext.targetPalace.canonicalMajorStars[0]
    assert.ok(replacementStar)
    candidate.starBasis = [replacementStar.name]
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MINOR_STARS_MISMATCH,
    )
  })
  check('minor-star evidence requires target palaceId in the same Candidate', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const candidate = targetSupportingEvidenceCandidate(value)
    candidate.palaceIds = [
      modelInput.structuralContext.oppositePalace.palaceId,
    ]
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MINOR_STARS_MISMATCH,
    )
  })
  check('wire parser rejects an exact model-authored coverage major-star list', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.majorStarCore = []
    assertResultInvalid(
      () => parseWireResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.COVERAGE_MAJOR_STARS_MISMATCH,
    )
  })
  check('primaryAxis rejects an extra major star', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.majorStarCore.push('紫微')
    assertResultInvalid(() => parseWireResult(bridge, value))
  })
  check('primaryAxis rejects duplicate major stars', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.majorStarCore.push(value.primaryAxis.majorStarCore[0])
    assertResultInvalid(() => parseWireResult(bridge, value))
  })
  check('primaryAxis rejects another palace major star', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.majorStarCore = [
      modelInput.structuralContext.oppositePalace.canonicalMajorStars[0].name,
    ]
    assertResultInvalid(() => parseWireResult(bridge, value))
  })
  check('primaryAxis rejects a supporting star', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.majorStarCore = [
      modelInput.structuralContext.targetPalace.modeledSupportingStars[0].name,
    ]
    assertResultInvalid(() => parseWireResult(bridge, value))
  })
  check('borrowed primaryAxis uses the exact borrowed major stars', () => {
    const value = createValidAiChartD1P1Result(borrowInput)
    assert.deepEqual(
      parseResult(borrowBridge, value).primaryAxis.majorStarCore,
      borrowInput.structuralContext.targetPalace.borrowedMajorStars.map(
        (star) => star.name,
      ),
    )
  })
  check('borrowed primaryAxis rejects a nonexistent local major star', () => {
    const value = createValidAiChartD1P1Result(borrowInput)
    value.primaryAxis.majorStarCore = [
      modelInput.structuralContext.targetPalace.canonicalMajorStars[0].name,
    ]
    assertResultInvalid(() => parseWireResult(borrowBridge, value))
  })
  check('non-borrowed primaryAxis rejects an opposite borrowed star', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.majorStarCore = [
      modelInput.structuralContext.oppositePalace.canonicalMajorStars[0].name,
    ]
    assertResultInvalid(() => parseWireResult(bridge, value))
  })
  check('target primary star Rule completeness passes', () => {
    assert.doesNotThrow(() =>
      parseResult(bridge, createValidAiChartD1P1Result(modelInput)),
    )
  })
  check('missing one target primary star Rule is rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.usedRuleIds = value.primaryAxis.usedRuleIds.slice(1)
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.PRIMARY_AXIS_RULE_BINDING_MISMATCH,
    )
  })
  for (const role of ['opposite', 'hidden_combination', 'trine_1'] as const) {
    check(`${role} Rule is rejected from primaryAxis`, () => {
      const trace = modelInput.knowledgeContext.selectionTrace.find(
        (entry) => entry.palaceRole === role,
      )
      assert.ok(trace)
      const value = createValidAiChartD1P1Result(modelInput)
      value.primaryAxis.usedRuleIds.push(trace.ruleId)
      assertResultInvalid(
        () => parseResult(bridge, value),
        AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.RULE_PALACE_STAR_BINDING_MISMATCH,
      )
    })
  }
  check('common Rule may coexist with target primary Rules', () => {
    const trace = modelInput.knowledgeContext.selectionTrace.find(
      (entry) => entry.palaceRole === null,
    )
    assert.ok(trace)
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.usedRuleIds.push(trace.ruleId)
    assert.doesNotThrow(() => parseResult(bridge, value))
  })

  const doubleSnapshot = completeModelInputSnapshot()
  const doublePalaces = doubleSnapshot.palaces as MutableRecord[]
  doublePalaces[0].majorStars = [
    { name: '廉貞', type: 'major', scope: 'origin', mutagen: '化祿' },
    { name: '七殺', type: 'major', scope: 'origin' },
  ]
  const doubleFixture = await customFixture('bridge-double-axis', doubleSnapshot)
  const doubleInput = doubleFixture.modelInputs[0]
  const doubleBridge = doubleFixture.bridges[0]
  const doubleRuleTrace = doubleInput.knowledgeContext.selectionTrace.find(
    (trace) =>
      trace.palaceRole === 'target' && trace.reason === 'double_star_present',
  )
  assert.ok(doubleRuleTrace)
  const doubleRule = doubleInput.knowledgeContext.rules.find(
    (rule) => rule.ruleId === doubleRuleTrace.ruleId,
  )
  const doublePlacementId =
    doubleInput.structuralContext.targetPalace.canonicalMajorStars[0]
      .placementId
  const doublePromptPackage = doubleFixture.promptPackages[0]
  assert.ok(doubleRule)
  check('authenticated double-star core passes', () => {
    const value = createValidAiChartD1P1Result(doubleInput)
    assert.doesNotThrow(() => parseResult(doubleBridge, value))
  })
  for (const [name, metadata] of [
    ['package fingerprint', doublePromptPackage.packageFingerprint],
    ['Model Input fingerprint', doubleInput.inputFingerprint],
    ['Catalog fingerprint', doubleInput.catalogFingerprint],
    ['instructions SHA', doublePromptPackage.instructionsSha256],
    ['output Schema SHA', doublePromptPackage.outputSchemaSha256],
    ['Rule content SHA', doubleRule.contentSha256],
    ['placement id', doublePlacementId],
    ['call id', doubleInput.callId],
  ] as const) {
    check(`doubleStarCore rejects authenticated ${name}`, () => {
      const value = createValidAiChartD1P1Result(doubleInput)
      value.primaryAxis.doubleStarCore =
        `${value.primaryAxis.doubleStarCore} ${metadata}`
      assertResultInvalid(() => parseResult(doubleBridge, value))
    })
  }
  for (const [name, metadata] of [
    ['package fingerprint', doublePromptPackage.packageFingerprint],
    ['call id', doubleInput.callId],
  ] as const) {
    check(`primaryAxis statement rejects authenticated ${name}`, () => {
      const value = createValidAiChartD1P1Result(doubleInput)
      value.primaryAxis.statement = `${value.primaryAxis.statement} ${metadata}`
      assertResultInvalid(() => parseResult(doubleBridge, value))
    })
  }
  check('Primary Axis metadata error exposes only fixed result-invalid', () => {
    const value = createValidAiChartD1P1Result(doubleInput)
    value.primaryAxis.doubleStarCore =
      `${value.primaryAxis.doubleStarCore} ${doublePromptPackage.packageFingerprint}`
    assert.throws(
      () => parseResult(doubleBridge, value),
      (error) => {
        assert.equal(
          (error as Error).message,
          AI_CHART_D1_P1_ADAPTER_BRIDGE_RESULT_INVALID,
        )
        assert.doesNotMatch(
          String(error),
          new RegExp(doublePromptPackage.packageFingerprint, 'u'),
        )
        return true
      },
    )
  })
  check('metadata isolation preserves exact effective major-star binding', () => {
    const parsed = parseResult(
      doubleBridge,
      createValidAiChartD1P1Result(doubleInput),
    )
    assert.deepEqual(
      new Set(parsed.primaryAxis.majorStarCore),
      new Set(
        doubleInput.structuralContext.targetPalace.canonicalMajorStars.map(
          (star) => star.name,
        ),
      ),
    )
  })
  check('metadata isolation preserves authenticated double-star semantics', () => {
    const parsed = parseResult(
      doubleBridge,
      createValidAiChartD1P1Result(doubleInput),
    )
    assert.ok(parsed.primaryAxis.doubleStarCore)
    for (const star of parsed.primaryAxis.majorStarCore) {
      assert.match(parsed.primaryAxis.doubleStarCore, new RegExp(star, 'u'))
    }
  })
  check('primaryAxis rejects a missing effective major star', () => {
    const value = createValidAiChartD1P1Result(doubleInput)
    value.primaryAxis.majorStarCore = [value.primaryAxis.majorStarCore[0]]
    assertResultInvalid(() => parseWireResult(doubleBridge, value))
  })
  check('wire parser rejects model-controlled double-star ordering', () => {
    const value = createValidAiChartD1P1Result(doubleInput)
    value.primaryAxis.majorStarCore.reverse()
    assertResultInvalid(
      () => parseWireResult(doubleBridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.PRIMARY_AXIS_MAJOR_STAR_BINDING_MISMATCH,
    )
  })
  check('missing authenticated double-star Rule is rejected', () => {
    const value = createValidAiChartD1P1Result(doubleInput)
    value.primaryAxis.usedRuleIds = value.primaryAxis.usedRuleIds.filter(
      (ruleId) => ruleId !== doubleRuleTrace.ruleId,
    )
    assertResultInvalid(() => parseResult(doubleBridge, value))
  })
  check('null doubleStarCore with an authenticated double Rule is rejected', () => {
    const value = createValidAiChartD1P1Result(doubleInput)
    value.primaryAxis.doubleStarCore = null
    assertResultInvalid(
      () => parseResult(doubleBridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.PRIMARY_AXIS_DOUBLE_STAR_BINDING_MISMATCH,
    )
  })
  check('doubleStarCore missing one effective star name is rejected', () => {
    const value = createValidAiChartD1P1Result(doubleInput)
    value.primaryAxis.doubleStarCore = value.primaryAxis.majorStarCore[0]
    assertResultInvalid(() => parseResult(doubleBridge, value))
  })
  check('doubleStarCore containing a third major star is rejected', () => {
    const value = createValidAiChartD1P1Result(doubleInput)
    const third = AI_CHART_D1_MAJOR_STAR_NAMES.find(
      (starName) => !value.primaryAxis.majorStarCore.includes(starName),
    )
    assert.ok(third)
    value.primaryAxis.doubleStarCore = `${value.primaryAxis.doubleStarCore}${third}`
    assertResultInvalid(() => parseResult(doubleBridge, value))
  })
  check('doubleStarCore is rejected without an authenticated double Rule', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.doubleStarCore = '廉貞與七殺'
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('primaryAxis metadata leakage is rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.statement =
      `leak ${modelInput.knowledgeContext.rules[0].ruleId}`
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.PRIMARY_AXIS_FORBIDDEN_METADATA,
    )
  })
  check('Catalog Rule not selected for this call is rejected', () => {
    const selected = new Set(
      modelInput.knowledgeContext.rules.map((rule) => rule.ruleId),
    )
    const unselected = fixture.catalog.rules.find(
      (rule) => !selected.has(rule.ruleId),
    )
    assert.ok(unselected)
    const value = createValidAiChartD1P1Result(modelInput)
    value.primaryAxis.usedRuleIds = [unselected.ruleId]
    assertResultInvalid(() => parseResult(bridge, value))
  })

  for (const field of CANDIDATE_FIELDS) {
    check(`${field} accepts selected Rule IDs`, () => {
      assert.doesNotThrow(() =>
        parseResult(bridge, resultWithSingleCandidate(modelInput, field)),
      )
    })
    check(`${field} rejects unknown Rule IDs`, () => {
      const value = resultWithSingleCandidate(modelInput, field)
      value[field][0].usedRuleIds = ['rule:unknown']
      assertResultInvalid(() => parseResult(bridge, value))
    })
    check(`${field} rejects duplicate Rule IDs`, () => {
      const value = resultWithSingleCandidate(modelInput, field)
      const ruleId = value[field][0].usedRuleIds[0]
      value[field][0].usedRuleIds = [ruleId, ruleId]
      assertResultInvalid(() => parseResult(bridge, value))
    })
    check(`${field} rejects empty Rule IDs`, () => {
      const value = resultWithSingleCandidate(modelInput, field)
      value[field][0].usedRuleIds = []
      assertResultInvalid(() => parseResult(bridge, value))
    })
  }

  const teacherRule = modelInput.knowledgeContext.rules.find(
    (rule) => rule.ruleStatus === 'teacher_confirmed',
  )
  const lectureRule = modelInput.knowledgeContext.rules.find(
    (rule) => rule.ruleStatus === 'lecture_backfill',
  )
  assert.ok(teacherRule)
  assert.ok(lectureRule)
  check('teacher-only Candidate with teacher status passes', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.directCandidates[0].usedRuleIds = [teacherRule.ruleId]
    value.directCandidates[0].ruleStatus = 'teacher_confirmed'
    assert.doesNotThrow(() => parseResult(bridge, value))
  })
  check('teacher-only Candidate cannot report working status', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.directCandidates[0].usedRuleIds = [teacherRule.ruleId]
    value.directCandidates[0].ruleStatus = 'working_inference'
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.CANDIDATE_RULE_AUTHORITY_MISMATCH,
    )
  })
  check('lecture-only Candidate with lecture status passes', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.directCandidates[0].usedRuleIds = [lectureRule.ruleId]
    value.directCandidates[0].ruleStatus = 'lecture_backfill'
    assert.doesNotThrow(() => parseResult(bridge, value))
  })
  check('lecture-only Candidate cannot promote to teacher status', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.directCandidates[0].usedRuleIds = [lectureRule.ruleId]
    value.directCandidates[0].ruleStatus = 'teacher_confirmed'
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('teacher plus lecture derives lecture status', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.directCandidates[0].usedRuleIds = [
      teacherRule.ruleId,
      lectureRule.ruleId,
    ]
    value.directCandidates[0].ruleStatus = 'lecture_backfill'
    assert.doesNotThrow(() => parseResult(bridge, value))
  })
  check('teacher plus lecture cannot promote to teacher status', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.directCandidates[0].usedRuleIds = [
      teacherRule.ruleId,
      lectureRule.ruleId,
    ]
    value.directCandidates[0].ruleStatus = 'teacher_confirmed'
    assertResultInvalid(() => parseResult(bridge, value))
  })
  const syntheticAuthorityRules = [
    { ruleId: 'rule:teacher', ruleStatus: 'teacher_confirmed' },
    { ruleId: 'rule:lecture', ruleStatus: 'lecture_backfill' },
    { ruleId: 'rule:working', ruleStatus: 'working_inference' },
  ] as const
  for (const [name, ruleIds, expected] of [
    ['teacher-only', ['rule:teacher'], 'teacher_confirmed'],
    ['lecture-only', ['rule:lecture'], 'lecture_backfill'],
    ['working-only', ['rule:working'], 'working_inference'],
    ['teacher plus lecture', ['rule:teacher', 'rule:lecture'], 'lecture_backfill'],
    ['teacher plus working', ['rule:teacher', 'rule:working'], 'working_inference'],
    ['lecture plus working', ['rule:lecture', 'rule:working'], 'working_inference'],
  ] as const) {
    check(`${name} authority derives ${expected}`, () => {
      assert.equal(
        deriveAiChartD1P1CandidateRuleStatus(ruleIds, syntheticAuthorityRules),
        expected,
      )
    })
  }
  for (const [name, ruleIds, validStatus, promotedStatus] of [
    ['teacher-only', ['rule:teacher'], 'teacher_confirmed', 'working_inference'],
    ['lecture-only', ['rule:lecture'], 'lecture_backfill', 'teacher_confirmed'],
    ['working-only', ['rule:working'], 'working_inference', 'teacher_confirmed'],
    [
      'teacher plus lecture',
      ['rule:teacher', 'rule:lecture'],
      'lecture_backfill',
      'teacher_confirmed',
    ],
    [
      'teacher plus working',
      ['rule:teacher', 'rule:working'],
      'working_inference',
      'teacher_confirmed',
    ],
  ] as const) {
    check(`${name} Candidate authority accepts ${validStatus}`, () => {
      assert.doesNotThrow(() =>
        assertAiChartD1P1CandidateRuleAuthority(
          { usedRuleIds: ruleIds, ruleStatus: validStatus },
          syntheticAuthorityRules,
        ),
      )
    })
    check(`${name} Candidate authority rejects ${promotedStatus}`, () => {
      assertResultInvalid(() =>
        assertAiChartD1P1CandidateRuleAuthority(
          { usedRuleIds: ruleIds, ruleStatus: promotedStatus },
          syntheticAuthorityRules,
        ),
      )
    })
  }
  check('authority derivation rejects empty usedRuleIds', () => {
    assertResultInvalid(() =>
      deriveAiChartD1P1CandidateRuleStatus([], syntheticAuthorityRules),
    )
  })
  check('authority derivation rejects duplicate usedRuleIds', () => {
    assertResultInvalid(() =>
      deriveAiChartD1P1CandidateRuleStatus(
        ['rule:teacher', 'rule:teacher'],
        syntheticAuthorityRules,
      ),
    )
  })
  check('authority derivation rejects an unknown Rule ID', () => {
    assertResultInvalid(() =>
      deriveAiChartD1P1CandidateRuleStatus(
        ['rule:unknown'],
        syntheticAuthorityRules,
      ),
    )
  })
  for (const field of CANDIDATE_FIELDS) {
    check(`${field} rejects lecture-to-teacher authority promotion`, () => {
      const value = resultWithSingleCandidate(modelInput, field)
      value[field][0].usedRuleIds = [lectureRule.ruleId]
      value[field][0].ruleStatus = 'teacher_confirmed'
      assertResultInvalid(() => parseResult(bridge, value))
    })
  }

  const structuralPalaces = [
    modelInput.structuralContext.targetPalace,
    modelInput.structuralContext.oppositePalace,
    modelInput.structuralContext.hiddenCombinationPalace,
    ...modelInput.structuralContext.otherTrinePalaces,
  ]
  const targetPalace = modelInput.structuralContext.targetPalace
  const oppositePalace = modelInput.structuralContext.oppositePalace
  const hiddenPalace = modelInput.structuralContext.hiddenCombinationPalace
  const trinePalaces = modelInput.structuralContext.otherTrinePalaces
  const firstStarName = (
    palace: typeof targetPalace,
  ) => [
    ...palace.canonicalMajorStars,
    ...palace.borrowedMajorStars,
    ...palace.modeledSupportingStars,
  ][0]?.name

  for (const [role, palace] of [
    ['opposite', oppositePalace],
    ['hidden', hiddenPalace],
    ['trine one', trinePalaces[0]],
    ['trine two', trinePalaces[1]],
  ] as const) {
    check(`directCandidates rejects ${role} palaceId`, () => {
      const value = createValidAiChartD1P1Result(modelInput)
      value.directCandidates[0].palaceIds = [palace.palaceId]
      assertResultInvalid(
        () => parseResult(bridge, value),
        AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.CANDIDATE_SOURCE_BINDING_MISMATCH,
      )
    })
  }
  for (const [role, palace] of [
    ['opposite', oppositePalace],
    ['hidden', hiddenPalace],
    ['trine', trinePalaces[0]],
  ] as const) {
    const starName = firstStarName(palace)
    assert.ok(starName)
    check(`directCandidates rejects ${role} star`, () => {
      const value = createValidAiChartD1P1Result(modelInput)
      value.directCandidates[0].starBasis = [starName]
      assertResultInvalid(() => parseResult(bridge, value))
    })
  }
  for (const structure of ['對宮', '暗合', '三方'] as const) {
    check(`directCandidates rejects ${structure} basis`, () => {
      const value = createValidAiChartD1P1Result(modelInput)
      value.directCandidates[0].structureBasis = ['本宮', structure]
      assertResultInvalid(() => parseResult(bridge, value))
    })
  }
  check('directCandidates requires target palaceId', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.directCandidates[0].palaceIds = []
    assertResultInvalid(
      () => parseResult(bridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.RESULT_SHAPE_INVALID,
    )
  })
  check('directCandidates requires 本宮 basis', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.directCandidates[0].structureBasis = ['輔星']
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('oppositeInfluences requires opposite palaceId', () => {
    const value = resultWithSingleCandidate(modelInput, 'oppositeInfluences')
    value.oppositeInfluences[0].palaceIds = [targetPalace.palaceId]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('oppositeInfluences rejects hidden palaceId', () => {
    const value = resultWithSingleCandidate(modelInput, 'oppositeInfluences')
    value.oppositeInfluences[0].palaceIds = [hiddenPalace.palaceId]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('oppositeInfluences rejects a hidden palace star', () => {
    const value = resultWithSingleCandidate(modelInput, 'oppositeInfluences')
    const starName = firstStarName(hiddenPalace)
    assert.ok(starName)
    value.oppositeInfluences[0].starBasis = [starName]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('oppositeInfluences requires 對宮 basis', () => {
    const value = resultWithSingleCandidate(modelInput, 'oppositeInfluences')
    value.oppositeInfluences[0].structureBasis = ['本宮']
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('hiddenCombinationInfluences requires hidden palaceId', () => {
    const value = resultWithSingleCandidate(
      modelInput,
      'hiddenCombinationInfluences',
    )
    value.hiddenCombinationInfluences[0].palaceIds = [targetPalace.palaceId]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('hiddenCombinationInfluences rejects trine palaceId', () => {
    const value = resultWithSingleCandidate(
      modelInput,
      'hiddenCombinationInfluences',
    )
    value.hiddenCombinationInfluences[0].palaceIds = [trinePalaces[0].palaceId]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('hiddenCombinationInfluences rejects a trine palace star', () => {
    const value = resultWithSingleCandidate(
      modelInput,
      'hiddenCombinationInfluences',
    )
    const starName = firstStarName(trinePalaces[0])
    assert.ok(starName)
    value.hiddenCombinationInfluences[0].starBasis = [starName]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('hiddenCombinationInfluences requires 暗合 basis', () => {
    const value = resultWithSingleCandidate(
      modelInput,
      'hiddenCombinationInfluences',
    )
    value.hiddenCombinationInfluences[0].structureBasis = ['本宮']
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('trineInfluences requires at least one other trine palaceId', () => {
    const value = resultWithSingleCandidate(modelInput, 'trineInfluences')
    value.trineInfluences[0].palaceIds = [targetPalace.palaceId]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('trineInfluences rejects opposite palaceId', () => {
    const value = resultWithSingleCandidate(modelInput, 'trineInfluences')
    value.trineInfluences[0].palaceIds = [oppositePalace.palaceId]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('trineInfluences rejects an opposite palace star', () => {
    const value = resultWithSingleCandidate(modelInput, 'trineInfluences')
    const starName = firstStarName(oppositePalace)
    assert.ok(starName)
    value.trineInfluences[0].starBasis = [starName]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('trineInfluences requires 三方 basis', () => {
    const value = resultWithSingleCandidate(modelInput, 'trineInfluences')
    value.trineInfluences[0].structureBasis = ['本宮']
    assertResultInvalid(() => parseResult(bridge, value))
  })
  for (const field of [
    'combinedCandidates',
    'strengths',
    'imbalancePossibilities',
  ] as const) {
    check(`${field} accepts the legal five-palace union`, () => {
      const value = resultWithSingleCandidate(modelInput, field)
      value[field][0].palaceIds = structuralPalaces.map(
        (palace) => palace.palaceId,
      )
      value[field][0].starBasis = [
        ...new Set(structuralPalaces.flatMap((palace) => [
          ...palace.canonicalMajorStars.map((star) => star.name),
          ...palace.borrowedMajorStars.map((star) => star.name),
          ...palace.modeledSupportingStars.map((star) => star.name),
        ])),
      ]
      assert.doesNotThrow(() => parseResult(bridge, value))
    })
    for (const structure of ['飛化', '身宮'] as const) {
      check(`${field} rejects ${structure} basis`, () => {
        const value = resultWithSingleCandidate(modelInput, field)
        value[field][0].structureBasis = [structure]
        assertResultInvalid(() => parseResult(bridge, value))
      })
    }
  }
  check('another canonical palace outside the five views is rejected', () => {
    const allowed = new Set(structuralPalaces.map((palace) => palace.palaceId))
    const outside = AI_CHART_D1_PALACE_IDENTITIES.find(
      (identity) => !allowed.has(identity.palaceId),
    )
    assert.ok(outside)
    const value = createValidAiChartD1P1Result(modelInput)
    value.directCandidates[0].palaceIds = [outside.palaceId]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('non-source chart palace identifier is rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.directCandidates[0].palaceIds = ['palace:other-chart']
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('duplicate Candidate palace IDs are rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    const palaceId = modelInput.targetPalaceId
    value.directCandidates[0].palaceIds = [palaceId, palaceId]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  check('top-level opposite palace is rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.palaceId = modelInput.structuralContext.oppositePalace.palaceId
    value.palace = modelInput.structuralContext.oppositePalace.canonicalName
    assertResultInvalid(() => parseResult(bridge, value))
  })
  for (const field of CANDIDATE_FIELDS) {
    check(`${field} rejects a palace outside the five views`, () => {
      const allowed = new Set(structuralPalaces.map((palace) => palace.palaceId))
      const outside = AI_CHART_D1_PALACE_IDENTITIES.find(
        (identity) => !allowed.has(identity.palaceId),
      )
      assert.ok(outside)
      const value = resultWithSingleCandidate(modelInput, field)
      value[field][0].palaceIds = [outside.palaceId]
      assertResultInvalid(() => parseResult(bridge, value))
    })
  }

  const canonicalStar = structuralPalaces
    .flatMap((palace) => palace.canonicalMajorStars)
    .at(0)
  const supportingStar = structuralPalaces
    .flatMap((palace) => palace.modeledSupportingStars)
    .at(0)
  assert.ok(canonicalStar)
  assert.ok(supportingStar)
  check('actual canonical major star is accepted', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.directCandidates[0].starBasis = [canonicalStar.name]
    assert.doesNotThrow(() => parseResult(bridge, value))
  })
  check('actual supporting star is accepted', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.directCandidates[0].starBasis = [supportingStar.name]
    assert.doesNotThrow(() => parseResult(bridge, value))
  })
  check('actual borrowed star is accepted', () => {
    const value = createValidAiChartD1P1Result(borrowInput)
    value.directCandidates[0].starBasis = [
      borrowInput.structuralContext.targetPalace.borrowedMajorStars[0].name,
    ]
    assert.doesNotThrow(() => parseResult(borrowBridge, value))
  })
  for (const [name, starName] of [
    ['unseen major star', '紫微'],
    ['unseen supporting star', '天刑'],
    ['placement id', modelInput.structuralContext.targetPalace.canonicalMajorStars[0].placementId],
  ] as const) {
    check(`${name} is rejected from starBasis`, () => {
      const value = createValidAiChartD1P1Result(modelInput)
      value.directCandidates[0].starBasis = [starName]
      assertResultInvalid(() => parseResult(bridge, value))
    })
  }
  check('duplicate starBasis values are rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.directCandidates[0].starBasis = [canonicalStar.name, canonicalStar.name]
    assertResultInvalid(() => parseResult(bridge, value))
  })
  for (const field of CANDIDATE_FIELDS) {
    check(`${field} rejects an unseen star`, () => {
      const value = resultWithSingleCandidate(modelInput, field)
      value[field][0].starBasis = ['不存在星曜']
      assertResultInvalid(() => parseResult(bridge, value))
    })
  }

  for (const structure of [
    '空宮借星',
    '生年四化',
    '煞忌',
    '輔星',
  ] as const) {
    check(`directCandidates accepts optional P1 structure ${structure}`, () => {
      const value = createValidAiChartD1P1Result(modelInput)
      value.directCandidates[0].structureBasis = ['本宮', structure]
      assert.doesNotThrow(() => parseResult(bridge, value))
    })
  }
  for (const structure of ['飛化', '身宮'] as const) {
    check(`P1 structure ${structure} is rejected`, () => {
      const value = createValidAiChartD1P1Result(modelInput)
      value.directCandidates[0].structureBasis = [structure]
      assertResultInvalid(() => parseResult(bridge, value))
    })
  }
  check('duplicate P1 structureBasis values are rejected', () => {
    const value = createValidAiChartD1P1Result(modelInput)
    value.directCandidates[0].structureBasis = [
      '本宮',
      '本宮',
    ] as AiChartD1StructureBasis[]
    assertResultInvalid(() => parseResult(bridge, value))
  })

  check('Result with no upstream warnings passes without warning text', () => {
    assert.equal(modelInput.warnings.length, 0)
    assert.doesNotThrow(() => parseResult(bridge, validResult))
  })
  check('upstream warning code may be traced in Result warnings', () => {
    const value = createValidAiChartD1P1Result(partialInput)
    value.coverage.omittedItems = [{ item: 'known gap', reason: 'known gap' }]
    value.warnings = partialInput.warnings.map(
      (warning) => `trace ${warning.code}`,
    )
    assert.doesNotThrow(() => parseResult(partialBridge, value))
  })
  check('upstream warning code may be traced in an omitted item', () => {
    const value = createValidAiChartD1P1Result(partialInput)
    value.warnings = []
    value.coverage.omittedItems = partialInput.warnings.map((warning) => ({
      item: warning.code,
      reason: `omitted because ${warning.code}`,
    }))
    assert.doesNotThrow(() => parseResult(partialBridge, value))
  })
  check('missing upstream warning trace is rejected', () => {
    const value = createValidAiChartD1P1Result(partialInput)
    value.warnings = []
    value.coverage.omittedItems = [{ item: 'known gap', reason: 'known gap' }]
    assertResultInvalid(
      () => parseResult(partialBridge, value),
      AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS.OTHER_SOURCE_BOUND_BINDING_MISMATCH,
    )
  })
  check('missing one of multiple upstream warning codes is rejected', () => {
    assert.equal(partialInput.warnings.length >= 2, true)
    const value = createValidAiChartD1P1Result(partialInput)
    const first = partialInput.warnings[0].code
    value.warnings = [first]
    value.coverage.omittedItems = [{ item: first, reason: first }]
    assertResultInvalid(() => parseResult(partialBridge, value))
  })
  check('warning traceability failure exposes only the fixed safe error', () => {
    const value = createValidAiChartD1P1Result(partialInput)
    value.warnings = []
    value.coverage.omittedItems = [{ item: 'known gap', reason: 'known gap' }]
    try {
      parseResult(partialBridge, value)
      assert.fail('expected result invalid')
    } catch (error) {
      assert.equal(
        (error as Error).message,
        AI_CHART_D1_P1_ADAPTER_BRIDGE_RESULT_INVALID,
      )
      assert.doesNotMatch(String(error), /warning:|palace:|chart:|call:/u)
    }
  })

  for (const [name, auditValue, mutate] of [
    ['runId in primary statement', modelInput.runId, (value: Mutable<AiChartD1P1Result>, audit: string) => {
      value.primaryAxis.statement = `leak ${audit}`
    }],
    ['bundleId in lifeExamples', modelInput.bundleId, (value: Mutable<AiChartD1P1Result>, audit: string) => {
      value.directCandidates[0].lifeExamples = [`leak ${audit}`]
    }],
    ['catalogId in Candidate statement', modelInput.catalogId, (value: Mutable<AiChartD1P1Result>, audit: string) => {
      value.directCandidates[0].statement = `leak ${audit}`
    }],
    ['catalog fingerprint in tension', modelInput.catalogFingerprint, (value: Mutable<AiChartD1P1Result>, audit: string) => {
      value.tensions = [{
        tensionId: 'tension:leak',
        sideA: `leak ${audit}`,
        sideB: 'side b',
        coexistenceExplanation: 'coexistence',
        candidateIds: ['candidate:valid', 'candidate:second'],
      }]
      value.strengths = [
        createValidAiChartD1P1Candidate(modelInput, 'candidate:second'),
      ]
    }],
    ['source Manifest SHA in D2 reason', modelInput.sourceManifestSha256, (value: Mutable<AiChartD1P1Result>, audit: string) => {
      value.d2Boundaries = [{
        boundaryId: 'boundary:leak',
        topic: 'topic',
        prohibitedD1Conclusion: 'prohibited',
        allowedD1Wording: 'allowed',
        reason: `leak ${audit}`,
      }]
    }],
    ['Model Input fingerprint in omitted reason', modelInput.inputFingerprint, (value: Mutable<AiChartD1P1Result>, audit: string) => {
      value.status = 'partial'
      value.coverage.omittedItems = [{ item: 'gap', reason: `leak ${audit}` }]
    }],
    ['Package fingerprint in D2 topic', promptPackages[0].packageFingerprint, (value: Mutable<AiChartD1P1Result>, audit: string) => {
      value.d2Boundaries = [{
        boundaryId: 'boundary:leak',
        topic: `leak ${audit}`,
        prohibitedD1Conclusion: 'prohibited',
        allowedD1Wording: 'allowed',
        reason: 'reason',
      }]
    }],
    ['Instructions SHA in Candidate d2Boundary', AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256, (value: Mutable<AiChartD1P1Result>, audit: string) => {
      value.directCandidates[0].d2Boundary = `leak ${audit}`
    }],
    ['userInput SHA in D2 allowed wording', promptPackages[0].userInputSha256, (value: Mutable<AiChartD1P1Result>, audit: string) => {
      value.d2Boundaries = [{
        boundaryId: 'boundary:leak',
        topic: 'topic',
        prohibitedD1Conclusion: 'prohibited',
        allowedD1Wording: `leak ${audit}`,
        reason: 'reason',
      }]
    }],
    ['Output Schema SHA in tension coexistence', AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256, (value: Mutable<AiChartD1P1Result>, audit: string) => {
      value.tensions = [{
        tensionId: 'tension:leak',
        sideA: 'side a',
        sideB: 'side b',
        coexistenceExplanation: `leak ${audit}`,
        candidateIds: ['candidate:valid', 'candidate:second'],
      }]
      value.strengths = [
        createValidAiChartD1P1Candidate(modelInput, 'candidate:second'),
      ]
    }],
  ] as const) {
    check(`${name} is rejected as semantic metadata leakage`, () => {
      const value = createValidAiChartD1P1Result(modelInput)
      mutate(value, auditValue)
      assertResultInvalid(() => parseResult(bridge, value))
    })
  }
  check('opaque identity fields remain valid in their Contract locations', () => {
    const parsed = parseResult(bridge, validResult)
    assert.equal(parsed.callId, modelInput.callId)
    assert.equal(parsed.chartId, modelInput.chartId)
  })

  const oppositeEmptySnapshot = completeModelInputSnapshot()
  const oppositeEmptyPalaces = oppositeEmptySnapshot.palaces as MutableRecord[]
  oppositeEmptyPalaces[0].majorStars = []
  oppositeEmptyPalaces[0].minorStars = []
  oppositeEmptyPalaces[6].majorStars = []
  const oppositeStructures = createStructuralInputs(
    oppositeEmptySnapshot,
    'bridge-opposite-empty',
  )
  const oppositeBundles = buildAiChartD1K0P1KnowledgeBundles(
    fixture.catalog,
    oppositeStructures,
    { bundleIds: bundleIds('bridge-opposite-empty') },
  )
  check('opposite_empty upstream is mapped to Bridge not-ready', () => {
    assert.equal(oppositeStructures[0].targetPalace.borrowStatus, 'opposite_empty')
    assertNotReady(() =>
      buildAiChartD1P1AdapterBridges(
        fixture.catalog,
        oppositeStructures,
        oppositeBundles,
        fixture.modelInputs,
        fixture.promptPackages,
      ),
    )
  })
  check('not-ready fixed-12 build returns no partial subset', () => {
    let returned: readonly AiChartD1P1AdapterBridge[] | undefined
    assertNotReady(() => {
      returned = buildAiChartD1P1AdapterBridges(
        fixture.catalog,
        oppositeStructures,
        oppositeBundles,
        fixture.modelInputs,
        fixture.promptPackages,
      )
    })
    assert.equal(returned, undefined)
  })
  check('not-ready error exposes no source identity or missing reason', () => {
    try {
      buildAiChartD1P1AdapterBridges(
        fixture.catalog,
        oppositeStructures,
        oppositeBundles,
        fixture.modelInputs,
        fixture.promptPackages,
      )
      assert.fail('expected not ready')
    } catch (error) {
      assert.equal((error as Error).message, AI_CHART_D1_P1_ADAPTER_BRIDGE_NOT_READY)
      assert.doesNotMatch(String(error), /chart:|run:|call:|palace:|bundle:/u)
    }
  })

  check('Bridge construction performs no fetch', () => {
    assertNoFetch(() => {
      buildFrom(fixture)
    })
  })
  check('Descriptor parsing performs no fetch', () => {
    assertNoFetch(() => {
      parseAiChartD1P1AdapterBridgeDescriptor(
        bridge.descriptor,
        fixture.catalog,
        fixture.structuralInputs[0],
        fixture.bundles[0],
        fixture.modelInputs[0],
        fixture.promptPackages[0],
      )
    })
  })
  check('Responses body compatibility build performs no fetch', () => {
    assertNoFetch(() => {
      buildAiChartOpenAiResponsesBody(bridge.request)
    })
  })

  const repositoryRoot = process.cwd()
  const sourceFiles = sourceFilesUnder(join(repositoryRoot, 'src'))
  const bridgeSource = readFileSync(
    join(repositoryRoot, 'src/lib/ai-chart/d1P1AdapterBridge.ts'),
    'utf8',
  )
  check('every resultInvalid call site uses a fixed or controlled reason code', () => {
    const sourceFile = ts.createSourceFile(
      'src/lib/ai-chart/d1P1AdapterBridge.ts',
      bridgeSource,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    )
    const callSites: ts.CallExpression[] = []
    const stringCoverageCallSites: ts.CallExpression[] = []

    function visit(node: ts.Node): void {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'resultInvalid'
      ) {
        callSites.push(node)
      }
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'assertStringCoverageSubset'
      ) {
        stringCoverageCallSites.push(node)
      }
      ts.forEachChild(node, visit)
    }

    visit(sourceFile)
    assert.equal(callSites.length, 46)

    const allowedReasonNames = new Set(
      Object.keys(AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS),
    )
    let controlledHelperReasons = 0
    let controlledDuplicateMappingReasons = 0
    let directFixedReasons = 0
    for (const [index, callSite] of callSites.entries()) {
      assert.equal(
        callSite.arguments.length,
        1,
        `resultInvalid call ${index + 1} must have exactly one argument`,
      )
      const argument = callSite.arguments[0]
      if (ts.isIdentifier(argument)) {
        let ancestor: ts.Node | undefined = callSite.parent
        while (ancestor !== undefined && !ts.isFunctionDeclaration(ancestor)) {
          ancestor = ancestor.parent
        }
        assert.equal(
          argument.text === 'reasonCode' &&
            ancestor !== undefined &&
            ts.isFunctionDeclaration(ancestor) &&
            ancestor.name?.text === 'assertStringCoverageSubset',
          true,
          `resultInvalid call ${index + 1} has uncontrolled reason identifier ${argument.text}`,
        )
        controlledHelperReasons += 1
        continue
      }
      if (ts.isElementAccessExpression(argument)) {
        assert.equal(
          ts.isIdentifier(argument.expression) &&
            argument.expression.text === 'P1_COVERAGE_DUPLICATE_REASON_BY_FIELD',
          true,
          `resultInvalid call ${index + 1} must use the fixed duplicate mapping`,
        )
        assert.equal(
          argument.argumentExpression !== undefined &&
            ts.isPropertyAccessExpression(argument.argumentExpression) &&
            ts.isIdentifier(argument.argumentExpression.expression) &&
            argument.argumentExpression.expression.text === 'error' &&
            argument.argumentExpression.name.text === 'field',
          true,
          `resultInvalid call ${index + 1} must index the fixed mapping with error.field`,
        )
        controlledDuplicateMappingReasons += 1
        continue
      }
      assert.equal(
        ts.isPropertyAccessExpression(argument),
        true,
        `resultInvalid call ${index + 1} has argument kind ${ts.SyntaxKind[argument.kind]}`,
      )
      if (!ts.isPropertyAccessExpression(argument)) continue
      directFixedReasons += 1
      assert.equal(
        ts.isIdentifier(argument.expression) &&
          argument.expression.text ===
            'AI_CHART_D1_P1_SOURCE_BOUND_VALIDATION_REASONS',
        true,
        `resultInvalid call ${index + 1} must use the fixed reason constants`,
      )
      assert.equal(
        ts.isIdentifier(argument.name),
        true,
        `resultInvalid call ${index + 1} must use a reason identifier`,
      )
      assert.equal(
        allowedReasonNames.has(argument.name.text),
        true,
        `resultInvalid call ${index + 1} has unknown reason ${argument.name.text}`,
      )
    }
    assert.equal(controlledHelperReasons, 1)
    assert.equal(controlledDuplicateMappingReasons, 1)
    assert.equal(directFixedReasons, 44)

    assert.equal(stringCoverageCallSites.length, 3)
    assert.deepEqual(
      new Set(
        stringCoverageCallSites.map((callSite, index) => {
          assert.equal(
            callSite.arguments.length,
            3,
            `assertStringCoverageSubset call ${index + 1} must have three arguments`,
          )
          const reasonArgument = callSite.arguments[2]
          assert.equal(
            ts.isPropertyAccessExpression(reasonArgument),
            true,
            `assertStringCoverageSubset call ${index + 1} must use a fixed reason constant`,
          )
          if (!ts.isPropertyAccessExpression(reasonArgument)) return ''
          return reasonArgument.name.text
        }),
      ),
      new Set([
        'COVERAGE_MAJOR_STARS_MISMATCH',
        'COVERAGE_MINOR_STARS_MISMATCH',
        'COVERAGE_NOBLES_MISMATCH',
      ]),
    )
  })
  check('default Adapter Bridge production consumer is only Preview Gate', () => {
    const consumers = sourceFiles
      .filter((path) => path.endsWith('.ts') || path.endsWith('.tsx'))
      .filter((path) =>
        readFileSync(path, 'utf8').includes('buildAiChartD1P1AdapterBridges'),
      )
      .map((path) => relative(repositoryRoot, path))
      .filter(
        (path) =>
          !path.endsWith('d1P1AdapterBridge.ts') &&
          !path.endsWith('d1P1AdapterBridge.test.ts') &&
          !path.endsWith('d1P1AdapterBridgeContracts.test.ts') &&
          !path.endsWith('d1P1AdapterBridgeTestSupport.ts') &&
          !path.endsWith('d1P1PreviewRequestGate.server.test.ts'),
      )
    assert.deepEqual(consumers, [
      'src/lib/ai-chart/d1P1PreviewRequestGate.server.ts',
    ])
  })
  check('Report OpenAI Runtime Bridge builder production consumers are only the Report pipeline and runtime', () => {
    const consumers = sourceFiles
      .filter((path) => path.endsWith('.ts') || path.endsWith('.tsx'))
      .filter((path) =>
        readFileSync(path, 'utf8').includes(
          'buildAiChartD1P1ReportOpenAiRuntimeAdapterBridges',
        ),
      )
      .map((path) => relative(repositoryRoot, path))
      .filter(
        (path) =>
          !path.endsWith('d1P1AdapterBridge.ts') &&
          !path.endsWith('d1P1AdapterBridge.test.ts') &&
          !path.endsWith('d1P1AdapterBridgeContracts.test.ts') &&
          !path.endsWith('d1P1PreviewRequestGate.server.test.ts'),
      )
    assert.deepEqual(consumers, [
      'src/lib/ai-chart/d1P1ReportOpenAiRuntime.server.ts',
      'src/lib/ai-chart/reportGenerationPipeline.ts',
    ])
  })
  check('Local Preview Bridge builder production consumer is only Preview Gate', () => {
    const consumers = sourceFiles
      .filter((path) => path.endsWith('.ts') || path.endsWith('.tsx'))
      .filter((path) =>
        readFileSync(path, 'utf8').includes(
          'buildAiChartD1P1LocalPreviewAdapterBridges',
        ),
      )
      .map((path) => relative(repositoryRoot, path))
      .filter(
        (path) =>
          !path.endsWith('d1P1AdapterBridge.ts') &&
          !path.endsWith('d1P1AdapterBridge.test.ts') &&
          !path.endsWith('d1P1AdapterBridgeContracts.test.ts') &&
          !path.endsWith('d1P1PreviewRequestGate.server.test.ts'),
      )
    assert.deepEqual(consumers, [
      'src/lib/ai-chart/d1P1PreviewRequestGate.server.ts',
    ])
  })
  check('Prompt Package builder production consumers are Bridge, Report pipeline, and Report OpenAI runtime', () => {
    const consumers = sourceFiles
      .filter((path) => path.endsWith('.ts') || path.endsWith('.tsx'))
      .filter((path) =>
        readFileSync(path, 'utf8').includes('buildAiChartD1P1PromptPackages'),
      )
      .map((path) => relative(repositoryRoot, path))
      .filter(
        (path) =>
          !path.endsWith('d1P1PromptPackageBuilder.ts') &&
          !path.endsWith('d1P1PromptPackageBuilder.test.ts') &&
          !path.endsWith('d1P1PromptPackageTestSupport.ts') &&
          !path.endsWith('d1P1AdapterBridge.test.ts') &&
          !path.endsWith('d1P1AdapterBridgeTestSupport.ts') &&
          !path.endsWith('d1P1PreviewRequestGate.server.test.ts'),
      )
    assert.deepEqual(consumers, [
      'src/lib/ai-chart/d1P1AdapterBridge.ts',
      'src/lib/ai-chart/d1P1ReportOpenAiRuntime.server.ts',
      'src/lib/ai-chart/reportGenerationPipeline.ts',
    ])
  })
  check('src/app imports no Adapter Bridge', () => {
    const appFiles = sourceFilesUnder(join(repositoryRoot, 'src', 'app'))
    assert.equal(
      appFiles.some((path) =>
        readFileSync(path, 'utf8').includes('d1P1AdapterBridge'),
      ),
      false,
    )
  })
  check('Report modules import no Adapter Bridge', () => {
    for (const path of [
      'src/lib/ai-chart/reportGenerator.ts',
      'src/lib/ai-chart/reportCompletion.ts',
    ]) {
      assert.doesNotMatch(
        readFileSync(join(repositoryRoot, path), 'utf8'),
        /d1P1AdapterBridge/u,
      )
    }
  })
  check('Payment modules import no Adapter Bridge', () => {
    const paymentFiles = sourceFiles.filter((path) => /payment/iu.test(path))
    assert.equal(
      paymentFiles.some((path) =>
        readFileSync(path, 'utf8').includes('d1P1AdapterBridge'),
      ),
      false,
    )
  })
  check('Supabase modules import no Adapter Bridge', () => {
    const supabaseFiles = sourceFiles.filter((path) => /supabase/iu.test(path))
    assert.equal(
      supabaseFiles.some((path) =>
        readFileSync(path, 'utf8').includes('d1P1AdapterBridge'),
      ),
      false,
    )
  })
  check('Server request imports no Adapter Bridge', () => {
    assert.doesNotMatch(
      readFileSync(
        join(repositoryRoot, 'src/lib/ai-chart/openAiResponses.server.ts'),
        'utf8',
      ),
      /d1P1AdapterBridge/u,
    )
  })
  check('Adapter Bridge imports no Server request module', () => {
    assert.doesNotMatch(bridgeSource, /openAiResponses\.server/u)
    assert.doesNotMatch(bridgeSource, /requestAiChartOpenAiStructuredResponse/u)
  })
  check('Adapter Bridge contains no fetch call', () => {
    assert.doesNotMatch(bridgeSource, /\bfetch\s*\(/u)
    assert.doesNotMatch(bridgeSource, /globalThis\.fetch/u)
  })
  check('Adapter Bridge contains no API key or environment read', () => {
    assert.doesNotMatch(bridgeSource, /OPENAI_API_KEY|process\.env|Authorization/u)
  })
  check('Adapter Bridge contains no timeout or abort implementation', () => {
    assert.doesNotMatch(bridgeSource, /AbortController|setTimeout/u)
  })
  check('Adapter Bridge contains no Responses body builder', () => {
    assert.doesNotMatch(bridgeSource, /buildAiChartOpenAiResponsesBody/u)
  })
  check('Repository contains no runtimeEnabled=true wiring', () => {
    assert.equal(
      sourceFiles
        .filter((path) => !path.endsWith('.test.ts'))
        .filter((path) => !path.endsWith('TestSupport.ts'))
        .some((path) =>
          /runtimeEnabled\s*[:=]\s*true/u.test(readFileSync(path, 'utf8')),
        ),
      false,
    )
  })
  check('F1 remains blocked in the D1 README', () => {
    const readme = readFileSync(
      join(repositoryRoot, 'content/ai-chart/d1-v1/README.md'),
      'utf8',
    )
    assert.match(readme, /F1_BLOCKED_BY_MISSING_FLYING_TRANSFORM_SOURCE/u)
  })
  check('no F1 Input module was created', () => {
    assert.equal(
      sourceFiles.some((path) => /d1F1Input/u.test(path)),
      false,
    )
  })

  console.log(`\n${checks} D1 P1 Adapter Bridge checks passed.`)
}

void run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
