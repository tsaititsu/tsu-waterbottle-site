import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_SET_JSON_SCHEMA,
  AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_SET_VERSION,
  AiChartD1FlyingKnowledgeError,
  buildAiChartD1FlyingKnowledgeViews,
  validateAiChartD1FlyingKnowledgeViewSetAgainstSources,
  type AiChartD1FlyingKnowledgeValidationReason,
} from './d1FlyingKnowledgeContracts'
import { createAiChartD1FlyingModelInputTestFixture } from './d1FlyingModelInputTestSupport'
import { getTestCatalog } from './d1P1ModelInputTestSupport'
import { AI_CHART_D1_PALACE_FACET_REGISTRY } from './d1PalaceFacetRegistry'

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

function expectKnowledgeInvalid(
  run: () => unknown,
  reasonCode: AiChartD1FlyingKnowledgeValidationReason,
): void {
  try {
    run()
    assert.fail('expected Flying Knowledge rejection')
  } catch (error) {
    assert.equal(error instanceof AiChartD1FlyingKnowledgeError, true)
    if (!(error instanceof AiChartD1FlyingKnowledgeError)) {
      assert.fail('expected AiChartD1FlyingKnowledgeError')
    }
    assert.equal(error.message, 'ai_chart_d1_flying_knowledge_invalid')
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

async function run() {
  const fixture = createAiChartD1FlyingModelInputTestFixture()
  const catalog = await getTestCatalog()
  const knowledgeSet = buildAiChartD1FlyingKnowledgeViews(
    fixture.modelInputSet,
    catalog,
  )
  const first = knowledgeSet.views[0]

  check('builder selects one immutable source-bound knowledge view for all 48 Flying inputs', () => {
    assert.equal(
      knowledgeSet.contractVersion,
      AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_SET_VERSION,
    )
    assert.equal(knowledgeSet.views.length, 48)
    assert.deepEqual(
      knowledgeSet.views.map((view) => view.flyingModelInputRef),
      fixture.modelInputSet.inputs.map(
        (input) => input.flyingModelInputId,
      ),
    )
    assert.equal(new Set(
      knowledgeSet.views.map((view) => view.flyingKnowledgeViewId),
    ).size, 48)
    assert.equal(knowledgeSet.openAiCallable, false)
    assert.equal(Object.isFrozen(knowledgeSet), true)
    assert.equal(Object.isFrozen(knowledgeSet.views), true)
    assert.equal(knowledgeSet.views.every(Object.isFrozen), true)
  })

  check('each view binds the exact transformed star core, common transformation, and star-specific transformation rules', () => {
    assert.equal(first.transformedStarName, '廉貞')
    assert.equal(
      first.transformedStarCoreRule.ruleId,
      'rule:star:lianzhen:core',
    )
    assert.equal(
      first.transformationCommonRule.ruleId,
      'rule:mutagen:common:lu',
    )
    assert.equal(
      first.transformationSpecificRule.ruleId,
      'rule:mutagen:lianzhen:lu',
    )
    for (const view of knowledgeSet.views) {
      assert.equal(view.transformedStarCoreRule.content.length > 0, true)
      assert.equal(view.transformationCommonRule.content.length > 0, true)
      assert.equal(view.transformationSpecificRule.content.length > 0, true)
      assert.equal(Object.isFrozen(view.transformedStarCoreRule), true)
      assert.equal(Object.isFrozen(view.transformationCommonRule), true)
      assert.equal(Object.isFrozen(view.transformationSpecificRule), true)
    }
  })

  check('source and target palace meanings plus complete source actors are selected without narrowing', () => {
    assert.equal(first.sourcePalaceId, 'palace:ming')
    assert.equal(first.targetPalaceId, 'palace:spouse')
    assert.equal(first.sourcePalaceMeanings.length > 0, true)
    assert.equal(first.targetPalaceMeanings.length > 0, true)
    assert.equal(
      first.sourcePalaceMeanings.every(
        (meaning) => meaning.palaceId === first.sourcePalaceId,
      ),
      true,
    )
    assert.equal(
      first.targetPalaceMeanings.every(
        (meaning) => meaning.palaceId === first.targetPalaceId,
      ),
      true,
    )
    assert.deepEqual(
      first.sourceActorBindings.map((binding) => binding.bindingId),
      fixture.modelInputSet.inputs[0].flyingFact
        .sourceActorBindingRefs,
    )
    assert.deepEqual(
      first.eligibleTargetFacetIds,
      AI_CHART_D1_PALACE_FACET_REGISTRY.find(
        (entry) => entry.palaceId === first.targetPalaceId,
      )?.facetIds,
    )
  })

  check('formula policy fixes causal order while preserving possible outcomes', () => {
    assert.deepEqual(first.formulaPolicy, {
      formulaVersion: 'ai-chart-d1-flying-formula-policy/v1',
      causalOrder: [
        'SOURCE_PALACE',
        'TARGET_PALACE',
        'TRANSFORMED_STAR_CORE',
        'TRANSFORMATION_ACTION',
      ],
      lifeBridgeStages: [
        'SOURCE_EXPERIENCE',
        'INNER_EFFECT',
        'REPEATED_BEHAVIOR',
        'POSSIBLE_OUTCOME',
      ],
      sourceActorPolicy: 'PRESERVE_ALL_FACT_CANDIDATES',
      targetFacetPolicy: 'SELECT_ONE_REGISTRY_FACET',
      directCausePolicy: 'DIRECT_PALACE_CAUSE_FIRST',
      oppositeCausePolicy: 'ONLY_WHEN_FACT_PROVIDES_REF',
      natalBackgroundPolicy: 'TRIGGER_OR_AMPLIFY_NOT_REPLACE',
      eventBoundary: 'D1_POSSIBILITY_NOT_OCCURRED_EVENT',
    })
    assert.equal(Object.isFrozen(first.formulaPolicy), true)
    assert.equal(Object.isFrozen(first.formulaPolicy.causalOrder), true)
    assert.equal(
      Object.isFrozen(first.formulaPolicy.lifeBridgeStages),
      true,
    )
  })

  check('validator recomputes views from Model Inputs and Catalog rather than trusting supplied content', () => {
    assert.deepEqual(
      validateAiChartD1FlyingKnowledgeViewSetAgainstSources(
        knowledgeSet,
        fixture.modelInputSet,
        catalog,
      ),
      knowledgeSet,
    )
    const forged = clone(knowledgeSet) as unknown as MutableRecord
    const views = forged.views as MutableRecord[]
    const core = views[0].transformedStarCoreRule as MutableRecord
    core.content = 'forged model knowledge'
    expectKnowledgeInvalid(
      () =>
        validateAiChartD1FlyingKnowledgeViewSetAgainstSources(
          forged,
          fixture.modelInputSet,
          catalog,
        ),
      'KNOWLEDGE_VIEW_MISMATCH',
    )
  })

  check('star identity and rule reference disagreements fail closed', () => {
    const wrongName = clone(
      fixture.modelInputSet,
    ) as unknown as MutableRecord
    const inputs = wrongName.inputs as MutableRecord[]
    const fact = inputs[0].flyingFact as MutableRecord
    fact.transformedStarName = '天機'
    expectKnowledgeInvalid(
      () => buildAiChartD1FlyingKnowledgeViews(wrongName, catalog),
      'STAR_CORE_RULE_MISMATCH',
    )

    const missingSpecific = clone(catalog) as unknown as MutableRecord
    const inventory = missingSpecific.mutagenInventory as MutableRecord[]
    const item = inventory.find(
      (candidate) =>
        candidate.starName === '廉貞' &&
        candidate.mutagenType === '化祿',
    )
    assert.notEqual(item, undefined)
    item!.specificRuleId = null
    item!.sourceAuthority = null
    item!.missingReason = 'missing_specific_mutagen_rule'
    expectKnowledgeInvalid(
      () =>
        buildAiChartD1FlyingKnowledgeViews(
          fixture.modelInputSet,
          missingSpecific,
        ),
      'KNOWLEDGE_NOT_READY',
    )
  })

  check('Strict Schema remains internal-only and contains no OpenAI controls', () => {
    const properties = schemaProperties(
      AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_SET_JSON_SCHEMA,
    )
    for (const forbidden of [
      'model',
      'prompt',
      'instructions',
      'reasoning',
      'temperature',
      'maxOutputTokens',
      'retry',
    ]) {
      assert.equal(Object.hasOwn(properties, forbidden), false)
    }
    const serialized = JSON.stringify(
      AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_SET_JSON_SCHEMA,
    )
    assert.equal(serialized.includes('uniqueItems'), false)
    assert.deepEqual(
      JSON.parse(serialized),
      AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_SET_JSON_SCHEMA,
    )
    assert.equal(
      Object.isFrozen(
        AI_CHART_D1_FLYING_KNOWLEDGE_VIEW_SET_JSON_SCHEMA,
      ),
      true,
    )
  })

  check('knowledge selector has no fetch, OpenAI, environment, prompt, or prose generation path', () => {
    const source = readFileSync(
      fileURLToPath(
        new URL('./d1FlyingKnowledgeContracts.ts', import.meta.url),
      ),
      'utf8',
    )
    assert.doesNotMatch(source, /\bfetch\s*\(/u)
    assert.doesNotMatch(source, /responses\.create|chat\.completions/u)
    assert.doesNotMatch(source, /OPENAI_API_KEY|process\.env/u)
    assert.doesNotMatch(source, /instructions|systemPrompt/u)
    assert.doesNotMatch(source, /productionCallable\s*:\s*true/u)
  })

  console.log(
    `d1FlyingKnowledgeContracts tests passed: ${checks} checks`,
  )
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
