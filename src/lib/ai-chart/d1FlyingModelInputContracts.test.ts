import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { AI_CHART_D1_PALACE_IDENTITIES } from './d1N0Constants'
import type { AiChartD1FlyingFactSet } from './d1FlyingFactSource'
import {
  AI_CHART_D1_FLYING_MODEL_INPUT_SET_JSON_SCHEMA,
  AI_CHART_D1_FLYING_MODEL_INPUT_SET_SCHEMA_NAME,
  AI_CHART_D1_FLYING_MODEL_INPUT_SET_VERSION,
  AiChartD1FlyingModelInputError,
  buildAiChartD1FlyingModelInputs,
  validateAiChartD1FlyingModelInputSetAgainstSources,
  type AiChartD1FlyingModelInputValidationReason,
} from './d1FlyingModelInputContracts'
import { AI_CHART_D1_PALACE_FACET_REGISTRY } from './d1PalaceFacetRegistry'
import { createAiChartD1FlyingModelInputTestFixture } from './d1FlyingModelInputTestSupport'

type MutableRecord = Record<string, unknown>

let checks = 0

function check(name: string, run: () => void) {
  try {
    run()
    checks += 1
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

function createSources() {
  const fixture = createAiChartD1FlyingModelInputTestFixture()
  return {
    n0: fixture.n0,
    factSet: fixture.factSet,
    palaceResults: fixture.palaceResults,
  }
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function expectModelInputInvalid(
  run: () => unknown,
  reasonCode: AiChartD1FlyingModelInputValidationReason,
): void {
  try {
    run()
    assert.fail('expected Flying Model Input rejection')
  } catch (error) {
    assert.equal(error instanceof AiChartD1FlyingModelInputError, true)
    if (!(error instanceof AiChartD1FlyingModelInputError)) {
      assert.fail('expected AiChartD1FlyingModelInputError')
    }
    assert.equal(error.message, 'ai_chart_d1_flying_model_input_invalid')
    assert.equal(error.reasonCode, reasonCode)
    assert.equal(Object.isFrozen(error), true)
  }
}

function schemaProperties(value: unknown): MutableRecord {
  assert.equal(typeof value, 'object')
  assert.notEqual(value, null)
  const properties = (value as MutableRecord).properties
  assert.equal(typeof properties, 'object')
  assert.notEqual(properties, null)
  return properties as MutableRecord
}

check('assembler deterministically pairs 48 Facts with the correct source and target Palace Results', () => {
  const { n0, factSet, palaceResults } = createSources()
  const result = buildAiChartD1FlyingModelInputs(
    n0,
    factSet,
    palaceResults,
  )

  assert.equal(
    result.contractVersion,
    AI_CHART_D1_FLYING_MODEL_INPUT_SET_VERSION,
  )
  assert.equal(result.inputs.length, 48)
  assert.equal(result.openAiCallable, false)
  assert.equal(result.validationStatus, 'validated')
  assert.deepEqual(
    result.inputs.map((input) => input.flyingFact.flyingFactId),
    factSet.facts.map((fact) => fact.flyingFactId),
  )
  for (const input of result.inputs) {
    assert.equal(
      input.sourcePalaceResult.targetPalaceId,
      input.flyingFact.sourcePalaceId,
    )
    assert.equal(
      input.targetPalaceResult.targetPalaceId,
      input.flyingFact.targetPalaceId,
    )
    assert.deepEqual(
      input.eligibleTargetFacetIds,
      AI_CHART_D1_PALACE_FACET_REGISTRY.find(
        (entry) => entry.palaceId === input.flyingFact.targetPalaceId,
      )?.facetIds,
    )
    assert.equal(input.openAiCallable, false)
    assert.equal(Object.isFrozen(input), true)
    assert.equal(Object.isFrozen(input.eligibleTargetFacetIds), true)
    assert.equal(Object.isFrozen(input.flyingFact), true)
    assert.equal(Object.isFrozen(input.sourcePalaceResult), true)
    assert.equal(Object.isFrozen(input.targetPalaceResult), true)
  }
  assert.deepEqual(
    result.coverage.sourcePalaceIds,
    AI_CHART_D1_PALACE_IDENTITIES.map((identity) => identity.palaceId),
  )
  assert.deepEqual(
    result.coverage.palaceResultRefs,
    palaceResults.map((palaceResult) => palaceResult.palaceResultId),
  )
  assert.equal(Object.isFrozen(result), true)
  assert.equal(Object.isFrozen(result.inputs), true)
  assert.equal(Object.isFrozen(result.coverage), true)
})

check('all twelve Palace Results are required once in canonical order', () => {
  const { n0, factSet, palaceResults } = createSources()

  expectModelInputInvalid(
    () =>
      buildAiChartD1FlyingModelInputs(
        n0,
        factSet,
        palaceResults.slice(0, 11),
      ),
    'PALACE_RESULT_SET_INVALID',
  )
  expectModelInputInvalid(
    () =>
      buildAiChartD1FlyingModelInputs(n0, factSet, [
        palaceResults[1],
        palaceResults[0],
        ...palaceResults.slice(2),
      ]),
    'PALACE_RESULT_SET_INVALID',
  )
  expectModelInputInvalid(
    () =>
      buildAiChartD1FlyingModelInputs(n0, factSet, [
        palaceResults[0],
        palaceResults[0],
        ...palaceResults.slice(2),
      ]),
    'PALACE_RESULT_SET_INVALID',
  )
})

check('Palace Results must share the authoritative chart and one run', () => {
  const { n0, factSet, palaceResults } = createSources()
  const wrongChart = clone(palaceResults)
  ;(wrongChart[4] as unknown as MutableRecord).chartId =
    'chart:other'
  expectModelInputInvalid(
    () => buildAiChartD1FlyingModelInputs(n0, factSet, wrongChart),
    'PALACE_RESULT_IDENTITY_MISMATCH',
  )

  const wrongRun = clone(palaceResults)
  ;(wrongRun[7] as unknown as MutableRecord).runId = 'run:other'
  expectModelInputInvalid(
    () => buildAiChartD1FlyingModelInputs(n0, factSet, wrongRun),
    'PALACE_RESULT_IDENTITY_MISMATCH',
  )
})

check('assembler revalidates the supplied Fact Set against N0 rather than trusting its status flag', () => {
  const { n0, factSet, palaceResults } = createSources()
  const forged = clone(factSet) as unknown as MutableRecord
  const facts = forged.facts as MutableRecord[]
  facts[0].transformedStarRef = facts[1].transformedStarRef

  expectModelInputInvalid(
    () =>
      buildAiChartD1FlyingModelInputs(
        n0,
        forged as AiChartD1FlyingFactSet,
        palaceResults,
      ),
    'FACT_SET_MISMATCH',
  )
})

check('validator recomputes the complete set and rejects omissions, reordering, or forged pairings', () => {
  const { n0, factSet, palaceResults } = createSources()
  const result = buildAiChartD1FlyingModelInputs(
    n0,
    factSet,
    palaceResults,
  )
  assert.deepEqual(
    validateAiChartD1FlyingModelInputSetAgainstSources(
      result,
      n0,
      factSet,
      palaceResults,
    ),
    result,
  )

  const reordered = clone(result) as unknown as MutableRecord
  const reorderedInputs = reordered.inputs as MutableRecord[]
  ;[reorderedInputs[0], reorderedInputs[1]] = [
    reorderedInputs[1],
    reorderedInputs[0],
  ]
  expectModelInputInvalid(
    () =>
      validateAiChartD1FlyingModelInputSetAgainstSources(
        reordered,
        n0,
        factSet,
        palaceResults,
      ),
    'INPUT_SET_SHAPE_INVALID',
  )

  const forged = clone(result) as unknown as MutableRecord
  const forgedInputs = forged.inputs as MutableRecord[]
  const differentTarget = forgedInputs.find(
    (input) =>
      (input.targetPalaceResult as MutableRecord).targetPalaceId !==
      (forgedInputs[0].targetPalaceResult as MutableRecord)
        .targetPalaceId,
  )
  assert.notEqual(differentTarget, undefined)
  forgedInputs[0].targetPalaceResult =
    differentTarget!.targetPalaceResult
  expectModelInputInvalid(
    () =>
      validateAiChartD1FlyingModelInputSetAgainstSources(
        forged,
        n0,
        factSet,
        palaceResults,
      ),
    'INPUT_SET_SHAPE_INVALID',
  )

  const sourceDrift = clone(result) as unknown as MutableRecord
  const sourceDriftInputs = sourceDrift.inputs as MutableRecord[]
  for (const input of sourceDriftInputs) {
    for (const field of [
      'sourcePalaceResult',
      'targetPalaceResult',
    ] as const) {
      const palaceResult = input[field] as MutableRecord
      if (palaceResult.targetPalaceId === 'palace:ming') {
        palaceResult.callId = 'call:palace:ming:forged'
      }
    }
  }
  expectModelInputInvalid(
    () =>
      validateAiChartD1FlyingModelInputSetAgainstSources(
        sourceDrift,
        n0,
        factSet,
        palaceResults,
      ),
    'INPUT_SET_MISMATCH',
  )
})

check('strict schema documents a server-owned non-OpenAI handoff', () => {
  assert.equal(
    AI_CHART_D1_FLYING_MODEL_INPUT_SET_SCHEMA_NAME,
    'ai_chart_d1_flying_model_input_set_v1',
  )
  const properties = schemaProperties(
    AI_CHART_D1_FLYING_MODEL_INPUT_SET_JSON_SCHEMA,
  )
  for (const forbidden of [
    'model',
    'prompt',
    'instructions',
    'temperature',
    'reasoning',
    'maxOutputTokens',
    'retry',
  ]) {
    assert.equal(Object.hasOwn(properties, forbidden), false)
  }
  const serialized = JSON.stringify(
    AI_CHART_D1_FLYING_MODEL_INPUT_SET_JSON_SCHEMA,
  )
  assert.equal(serialized.includes('uniqueItems'), false)
  assert.deepEqual(
    JSON.parse(serialized),
    AI_CHART_D1_FLYING_MODEL_INPUT_SET_JSON_SCHEMA,
  )
  assert.equal(
    Object.isFrozen(AI_CHART_D1_FLYING_MODEL_INPUT_SET_JSON_SCHEMA),
    true,
  )
})

check('assembler has no runtime, fetch, OpenAI, environment, or prose generation path', () => {
  const source = readFileSync(
    fileURLToPath(
      new URL('./d1FlyingModelInputContracts.ts', import.meta.url),
    ),
    'utf8',
  )
  assert.doesNotMatch(source, /\bfetch\s*\(/u)
  assert.doesNotMatch(source, /responses\.create|chat\.completions/u)
  assert.doesNotMatch(source, /OPENAI_API_KEY|process\.env/u)
  assert.doesNotMatch(source, /directPalaceCause|lifeBridge/u)
  assert.doesNotMatch(source, /productionCallable\s*:\s*true/u)
})

console.log(
  `d1FlyingModelInputContracts tests passed: ${checks} checks`,
)
