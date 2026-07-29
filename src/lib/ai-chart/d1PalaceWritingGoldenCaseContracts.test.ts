import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { AI_CHART_D1_MODEL_TARGET } from './d1Assets'
import {
  AI_CHART_D1_PALACE_WRITING_MAX_OUTPUT_TOKENS,
  AI_CHART_D1_PALACE_WRITING_REVIEW_MAX_OUTPUT_TOKENS,
  buildAiChartD1PalaceWritingAdapterBridge,
  buildAiChartD1PalaceWritingFidelityAdapterBridge,
} from './d1PalaceWritingAdapterBridgeContracts'
import {
  AI_CHART_D1_PALACE_WRITING_GOLDEN_CASE_QUALITY_DIMENSIONS,
  AI_CHART_D1_PALACE_WRITING_GOLDEN_CASE_VERSION,
  buildAiChartD1PalaceWritingGoldenCase,
  evaluateAiChartD1PalaceWritingGoldenCase,
  parseAiChartD1PalaceWritingGoldenCase,
} from './d1PalaceWritingGoldenCaseContracts'
import {
  validateAiChartD1PalaceWritingFidelityPromptPackageAgainstSources,
} from './d1PalaceWritingFidelityPromptPackageContracts'
import {
  validateAiChartD1PalaceWritingFidelityReviewAgainstSources,
} from './d1PalaceWritingFidelityReviewContracts'
import {
  validateAiChartD1PalaceWritingResultAgainstPromptPackage,
} from './d1PalaceWritingResultContracts'
import {
  AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
  AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
} from './openAiResponses'

let checks = 0

type MutableRecord = Record<string, unknown>

function check(name: string, run: () => void): void {
  try {
    run()
    checks += 1
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

function recursivelyFrozen(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true
  if (!Object.isFrozen(value)) return false
  return Reflect.ownKeys(value).every((key) =>
    recursivelyFrozen(
      (value as Record<PropertyKey, unknown>)[key],
    ),
  )
}

const goldenCase = buildAiChartD1PalaceWritingGoldenCase()

check('Golden Case is a deterministic sanitized one-palace reference with no person or birth identity', () => {
  const repeated = buildAiChartD1PalaceWritingGoldenCase()
  assert.deepEqual(repeated, goldenCase)
  assert.deepEqual(
    parseAiChartD1PalaceWritingGoldenCase(goldenCase),
    goldenCase,
  )
  assert.equal(
    goldenCase.contractVersion,
    AI_CHART_D1_PALACE_WRITING_GOLDEN_CASE_VERSION,
  )
  assert.equal(goldenCase.fixtureId, 'golden-case:ziwei-ming:v1')
  assert.equal(goldenCase.targetPalaceId, 'palace:ming')
  assert.equal(goldenCase.privacy.dataClassification, 'SYNTHETIC')
  assert.equal(goldenCase.privacy.containsPersonIdentity, false)
  assert.equal(goldenCase.privacy.containsBirthData, false)
  assert.equal(goldenCase.privacy.containsChartSnapshot, false)
  assert.equal(goldenCase.privacy.containsSecrets, false)
  assert.equal(recursivelyFrozen(goldenCase), true)
})

check('Golden Case carries two source-bound content cells and direct customer writing without internal identifiers', () => {
  const input = JSON.parse(goldenCase.writingPromptPackage.userInput)
  assert.equal(input.reportContext.primaryLifeRegion, 'TW')
  assert.equal(input.reportContext.reportLanguage, 'zh-Hant-TW')
  assert.deepEqual(
    input.contentGrid.facetSections.map(
      (section: { facetId: string }) => section.facetId,
    ),
    ['life.core_personality', 'life.values_direction'],
  )
  assert.equal(input.sourceMaterials.length, 2)
  assert.equal(
    input.sourceMaterials.every(
      (source: { material: unknown }) =>
        JSON.stringify(source.material).includes('紫微'),
    ),
    true,
  )

  assert.equal(goldenCase.expectedWritingResult.sections.length, 2)
  const customerText = goldenCase.expectedWritingResult.sections
    .map((section) => section.customerText)
    .join('\n')
  assert.match(customerText, /紫微/)
  assert.match(customerText, /面子/)
  assert.match(customerText, /尊重/)
  assert.match(customerText, /可能/)
  assert.doesNotMatch(
    customerText,
    /content-grid-cell:|writing-source-cell:|axis-claim:/,
  )
})

check('Golden writing, fidelity package, and approved review are fully recomputable from their bound sources', () => {
  assert.deepEqual(
    validateAiChartD1PalaceWritingResultAgainstPromptPackage(
      goldenCase.expectedWritingResult,
      goldenCase.writingPromptPackage,
    ),
    goldenCase.expectedWritingResult,
  )
  assert.deepEqual(
    validateAiChartD1PalaceWritingFidelityPromptPackageAgainstSources(
      goldenCase.fidelityPromptPackage,
      goldenCase.writingPromptPackage,
      goldenCase.expectedWritingResult,
    ),
    goldenCase.fidelityPromptPackage,
  )
  assert.deepEqual(
    validateAiChartD1PalaceWritingFidelityReviewAgainstSources(
      goldenCase.expectedFidelityReview,
      goldenCase.expectedWritingResult,
      goldenCase.writingPromptPackage,
    ),
    goldenCase.expectedFidelityReview,
  )
  assert.equal(
    goldenCase.expectedFidelityReview.fidelityReviewStatus,
    'approved',
  )
  assert.equal(
    goldenCase.expectedFidelityReview.customerDeliveryStatus,
    'ready',
  )
})

check('Benchmark Plan binds exactly two sequential non-runtime stages and leaves token and duration measurements honest', () => {
  const writingBridge = buildAiChartD1PalaceWritingAdapterBridge(
    goldenCase.writingPromptPackage,
  )
  const fidelityBridge =
    buildAiChartD1PalaceWritingFidelityAdapterBridge(
      goldenCase.fidelityPromptPackage,
      goldenCase.writingPromptPackage,
      goldenCase.expectedWritingResult,
    )
  assert.equal(goldenCase.benchmarkPlan.modelTarget, AI_CHART_D1_MODEL_TARGET)
  assert.equal(goldenCase.benchmarkPlan.maxRequests, 2)
  assert.equal(goldenCase.benchmarkPlan.retry, false)
  assert.equal(goldenCase.benchmarkPlan.executionMode, 'SEQUENTIAL')
  assert.equal(goldenCase.benchmarkPlan.executionStatus, 'not_executed')
  assert.equal(goldenCase.benchmarkPlan.measurementStatus, 'not_measured')
  assert.equal(goldenCase.benchmarkPlan.openAiCallable, false)
  assert.deepEqual(
    goldenCase.benchmarkPlan.stages.map((stage) => stage.stage),
    ['WRITING', 'FIDELITY_REVIEW'],
  )
  assert.deepEqual(
    goldenCase.benchmarkPlan.stages.map(
      (stage) => stage.bridgeFingerprint,
    ),
    [
      writingBridge.descriptor.bridgeFingerprint,
      fidelityBridge.descriptor.bridgeFingerprint,
    ],
  )
  assert.deepEqual(
    goldenCase.benchmarkPlan.stages.map(
      (stage) => stage.timeoutMs,
    ),
    [
      AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
      AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
    ],
  )
  assert.deepEqual(
    goldenCase.benchmarkPlan.stages.map(
      (stage) => stage.maxOutputTokens,
    ),
    [
      AI_CHART_D1_PALACE_WRITING_MAX_OUTPUT_TOKENS,
      AI_CHART_D1_PALACE_WRITING_REVIEW_MAX_OUTPUT_TOKENS,
    ],
  )
  assert.equal(
    goldenCase.benchmarkPlan.stages.every(
      (stage) =>
        stage.reasoningEffort ===
          AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT &&
        stage.durationMs === null &&
        stage.usage === null,
    ),
    true,
  )
  assert.deepEqual(
    goldenCase.benchmarkPlan.qualityDimensions,
    AI_CHART_D1_PALACE_WRITING_GOLDEN_CASE_QUALITY_DIMENSIONS,
  )
})

check('Offline evaluator validates source fidelity and readiness without pretending runtime measurements exist', () => {
  const evaluation =
    evaluateAiChartD1PalaceWritingGoldenCase(goldenCase)
  assert.equal(evaluation.contractStatus, 'validated')
  assert.equal(evaluation.sourceBindingStatus, 'validated')
  assert.equal(evaluation.fidelityStatus, 'approved')
  assert.equal(evaluation.customerDeliveryStatus, 'ready')
  assert.equal(evaluation.goldenBaselineStatus, 'approved_reference')
  assert.equal(evaluation.runtimeMeasurementStatus, 'not_measured')
  assert.equal(evaluation.readyForControlledPreview, true)
  assert.equal(evaluation.openAiRequests, 0)
  assert.equal(recursivelyFrozen(evaluation), true)
})

check('Golden Case rejects result, bridge, or case fingerprint tampering', () => {
  const changedText = structuredClone(
    goldenCase,
  ) as unknown as MutableRecord
  const changedResult =
    changedText.expectedWritingResult as MutableRecord
  const changedSections =
    changedResult.sections as MutableRecord[]
  changedSections[0].customerText = '被竄改的內容'
  assert.throws(() =>
    parseAiChartD1PalaceWritingGoldenCase(changedText),
  )

  const changedBridge = structuredClone(
    goldenCase,
  ) as unknown as MutableRecord
  const changedPlan =
    changedBridge.benchmarkPlan as MutableRecord
  const changedStages = changedPlan.stages as MutableRecord[]
  changedStages[0].bridgeFingerprint = 'f'.repeat(64)
  assert.throws(() =>
    evaluateAiChartD1PalaceWritingGoldenCase(changedBridge),
  )

  const changedFingerprint = structuredClone(
    goldenCase,
  ) as unknown as MutableRecord
  changedFingerprint.caseFingerprint = 'a'.repeat(64)
  assert.throws(() =>
    parseAiChartD1PalaceWritingGoldenCase(changedFingerprint),
  )
})

check('Golden Case serialization contains no real identity, birth data, secrets, or raw request fields', () => {
  const serialized = JSON.stringify(goldenCase)
  for (const forbidden of [
    '"name"',
    '"email"',
    '"phone"',
    '"userId"',
    '"user_id"',
    '"birthDate"',
    '"birthTime"',
    '"birthday"',
    '"apiKey"',
    '"authorization"',
    '"requestBody"',
    '"outputText"',
  ]) {
    assert.equal(serialized.toLowerCase().includes(forbidden.toLowerCase()), false)
  }
})

check('Golden Case module remains a pure offline contract with no server runtime, fetch, env, or secret access', () => {
  const source = readFileSync(
    fileURLToPath(
      new URL(
        './d1PalaceWritingGoldenCaseContracts.ts',
        import.meta.url,
      ),
    ),
    'utf8',
  )
  assert.doesNotMatch(
    source,
    /fetch\s*\(|process\.env|OPENAI_API_KEY|Authorization|\.server/,
  )
})

console.log(
  `AI Chart D1 palace-writing golden-case contract checks passed: ${checks}`,
)
