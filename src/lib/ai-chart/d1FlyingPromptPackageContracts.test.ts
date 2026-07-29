import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  AI_CHART_D1_FLYING_PROMPT_PACKAGE_SET_VERSION,
  AI_CHART_D1_FLYING_PROMPT_PACKAGE_SET_JSON_SCHEMA,
  AI_CHART_D1_FLYING_PROMPT_PACKAGE_VERSION,
  AI_CHART_D1_FLYING_PROMPT_VERSION,
  AiChartD1FlyingPromptPackageError,
  buildAiChartD1FlyingPromptPackages,
  validateAiChartD1FlyingPromptPackageSetAgainstSources,
} from './d1FlyingPromptPackageContracts'
import { buildAiChartD1FlyingKnowledgeViews } from './d1FlyingKnowledgeContracts'
import { createAiChartD1FlyingModelInputTestFixture } from './d1FlyingModelInputTestSupport'
import { getTestCatalog } from './d1P1ModelInputTestSupport'

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

function clone<T>(value: T): T {
  return structuredClone(value)
}

async function run() {
  const fixture = createAiChartD1FlyingModelInputTestFixture()
  const catalog = await getTestCatalog()
  const knowledgeSet = buildAiChartD1FlyingKnowledgeViews(
    fixture.modelInputSet,
    catalog,
  )
  const packageSet = buildAiChartD1FlyingPromptPackages(
    fixture.modelInputSet,
    knowledgeSet,
    catalog,
  )

  check('builder creates one immutable logical Prompt Package for each of the 48 fixed Flying Facts', () => {
    assert.equal(
      packageSet.contractVersion,
      AI_CHART_D1_FLYING_PROMPT_PACKAGE_SET_VERSION,
    )
    assert.equal(packageSet.packages.length, 48)
    assert.equal(
      packageSet.packages.every(
        (entry) =>
          entry.contractVersion ===
            AI_CHART_D1_FLYING_PROMPT_PACKAGE_VERSION &&
          entry.promptVersion === AI_CHART_D1_FLYING_PROMPT_VERSION &&
          entry.openAiCallable === false,
      ),
      true,
    )
    assert.equal(
      new Set(packageSet.packages.map((entry) => entry.callId)).size,
      48,
    )
    assert.equal(
      new Set(
        packageSet.packages.map((entry) => entry.packageFingerprint),
      ).size,
      48,
    )
    assert.equal(Object.isFrozen(packageSet), true)
    assert.equal(Object.isFrozen(packageSet.packages), true)
    assert.equal(packageSet.packages.every(Object.isFrozen), true)
  })

  check('canonical user input carries only the authenticated Model Input and Knowledge View', () => {
    const first = packageSet.packages[0]
    const parsed = JSON.parse(first.userInput) as MutableRecord
    assert.deepEqual(Object.keys(parsed), ['knowledgeView', 'modelInput'])
    assert.deepEqual(parsed.modelInput, fixture.modelInputSet.inputs[0])
    assert.deepEqual(parsed.knowledgeView, knowledgeSet.views[0])
    assert.equal(first.userInput.includes('OPENAI_API_KEY'), false)
    assert.equal(first.userInput.includes('Authorization'), false)
    assert.equal(first.userInput.includes('promptOverride'), false)
  })

  check('source trace fixes complete Actors, legal target facets, palace meanings, and all three rule layers', () => {
    const first = packageSet.packages[0]
    const knowledge = knowledgeSet.views[0]
    assert.deepEqual(first.sourceTrace.sourceActorBindingRefs, [
      ...knowledge.sourceActorBindings.map((entry) => entry.bindingId),
    ])
    assert.deepEqual(
      first.sourceTrace.eligibleTargetFacetIds,
      knowledge.eligibleTargetFacetIds,
    )
    assert.deepEqual(first.sourceTrace.knowledgeRuleRefs, [
      knowledge.transformedStarCoreRule.ruleId,
      knowledge.transformationCommonRule.ruleId,
      knowledge.transformationSpecificRule.ruleId,
    ])
    assert.deepEqual(
      first.sourceTrace.sourcePalaceMeaningRefs,
      knowledge.sourcePalaceMeanings.map((meaning) => meaning.meaningId),
    )
    assert.deepEqual(
      first.sourceTrace.targetPalaceMeaningRefs,
      knowledge.targetPalaceMeanings.map((meaning) => meaning.meaningId),
    )
  })

  check('instructions fix the causal formula and forbid event claims or source narrowing', () => {
    const instructions = packageSet.packages[0].instructions
    for (const required of [
      'SOURCE_PALACE',
      'TARGET_PALACE',
      'TRANSFORMED_STAR_CORE',
      'TRANSFORMATION_ACTION',
      'PRESERVE_ALL_FACT_CANDIDATES',
      'D1_POSSIBILITY_NOT_OCCURRED_EVENT',
      'strict JSON',
    ]) {
      assert.equal(instructions.includes(required), true, required)
    }
    for (const forbidden of [
      'OPENAI_API_KEY',
      'Authorization:',
      'model=gpt',
      'temperature=',
    ]) {
      assert.equal(instructions.includes(forbidden), false)
    }
  })

  check('source validator rebuilds all hashes and rejects forged package content', () => {
    assert.deepEqual(
      validateAiChartD1FlyingPromptPackageSetAgainstSources(
        packageSet,
        fixture.modelInputSet,
        knowledgeSet,
        catalog,
      ),
      packageSet,
    )
    const forged = clone(packageSet) as unknown as MutableRecord
    const packages = forged.packages as MutableRecord[]
    packages[0].userInput = '{}'
    assert.throws(
      () =>
        validateAiChartD1FlyingPromptPackageSetAgainstSources(
          forged,
          fixture.modelInputSet,
          knowledgeSet,
          catalog,
        ),
      AiChartD1FlyingPromptPackageError,
    )
  })

  check('package fingerprints and hashes are deterministic across rebuilds', () => {
    const rebuilt = buildAiChartD1FlyingPromptPackages(
      fixture.modelInputSet,
      knowledgeSet,
      catalog,
    )
    assert.deepEqual(rebuilt, packageSet)
    assert.deepEqual(
      rebuilt.packages.map((entry) => entry.packageFingerprint),
      packageSet.packages.map((entry) => entry.packageFingerprint),
    )
  })

  check('internal Prompt Package Schema is strict, frozen, and serializable', () => {
    const schema = AI_CHART_D1_FLYING_PROMPT_PACKAGE_SET_JSON_SCHEMA
    const serialized = JSON.stringify(schema)
    assert.equal(Object.isFrozen(schema), true)
    assert.deepEqual(JSON.parse(serialized), schema)
    assert.equal(serialized.includes('uniqueItems'), false)
    const visit = (candidate: unknown): void => {
      if (candidate === null || typeof candidate !== 'object') return
      if (Array.isArray(candidate)) {
        candidate.forEach(visit)
        return
      }
      const record = candidate as MutableRecord
      if (record.type === 'object') {
        assert.equal(record.additionalProperties, false)
        const properties = record.properties as MutableRecord
        assert.deepEqual(record.required, Object.keys(properties))
      }
      Object.values(record).forEach(visit)
    }
    visit(schema)
  })

  check('Prompt Package module contains no runtime, fetch, or OpenAI request implementation', () => {
    const source = readFileSync(
      fileURLToPath(
        new URL('./d1FlyingPromptPackageContracts.ts', import.meta.url),
      ),
      'utf8',
    )
    for (const forbidden of [
      'fetch(',
      'responses.create',
      'requestAiChartOpenAiStructuredResponse',
      'process.env',
      'OPENAI_API_KEY',
    ]) {
      assert.equal(source.includes(forbidden), false, forbidden)
    }
  })

  console.log(
    `d1FlyingPromptPackageContracts tests passed (${checks} checks)`,
  )
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
