import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  AI_CHART_D1_FLYING_PALACE_INTEGRATION_JSON_SCHEMA,
  AI_CHART_D1_FLYING_PALACE_INTEGRATION_VERSION,
  AiChartD1FlyingPalaceIntegrationError,
  buildAiChartD1FlyingPalaceIntegration,
  parseAiChartD1FlyingPalaceIntegration,
} from './d1FlyingPalaceIntegrationContracts'
import { createAiChartD1FlyingPalaceIntegrationTestFixture } from './d1FlyingPalaceIntegrationTestSupport'

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

function expectInvalid(run: () => unknown): void {
  assert.throws(run, AiChartD1FlyingPalaceIntegrationError)
}

async function run() {
  const fixture =
    await createAiChartD1FlyingPalaceIntegrationTestFixture()
  const { integration, knowledgeSet, catalog } = fixture
  const { modelInputSet } = fixture.source
  const results = structuredClone(fixture.resultValues)
  const wealth = integration.palaces.find(
    (entry) => entry.targetPalaceId === 'palace:wealth',
  )

  check('integration creates twelve immutable palace slots and preserves all 48 directed results', () => {
    assert.equal(
      integration.contractVersion,
      AI_CHART_D1_FLYING_PALACE_INTEGRATION_VERSION,
    )
    assert.equal(integration.palaces.length, 12)
    assert.equal(
      integration.palaces.reduce(
        (count, entry) => count + entry.influences.length,
        0,
      ),
      48,
    )
    assert.equal(integration.coverage.flyingInfluenceRefs.length, 48)
    assert.equal(
      new Set(integration.coverage.flyingInfluenceRefs).size,
      48,
    )
    assert.equal(Object.isFrozen(integration), true)
    assert.equal(Object.isFrozen(integration.palaces), true)
    assert.equal(
      integration.palaces.every(
        (entry) =>
          Object.isFrozen(entry) &&
          Object.isFrozen(entry.influences),
      ),
      true,
    )
  })

  check('wealth gold case keeps all eight source chains in canonical Fact order', () => {
    assert.notEqual(wealth, undefined)
    assert.equal(wealth!.influences.length, 8)
    assert.deepEqual(
      wealth!.influences.map(
        (influence) =>
          `${influence.sourcePalaceId}:${influence.transformationKind}:` +
          influence.flyingFactRef,
      ),
      [
        'palace:siblings:LU:flying-fact:palace:siblings:lu',
        'palace:spouse:QUAN:flying-fact:palace:spouse:quan',
        'palace:children:KE:flying-fact:palace:children:ke',
        'palace:children:JI:flying-fact:palace:children:ji',
        'palace:wealth:JI:flying-fact:palace:wealth:ji',
        'palace:friends:LU:flying-fact:palace:friends:lu',
        'palace:property:QUAN:flying-fact:palace:property:quan',
        'palace:parents:LU:flying-fact:palace:parents:lu',
      ],
    )
  })

  check('positive and difficult Tianji money possibilities coexist without cancelling each other', () => {
    const parentLu = wealth!.influences.find(
      (entry) =>
        entry.sourcePalaceId === 'palace:parents' &&
        entry.transformationKind === 'LU',
    )
    const wealthJi = wealth!.influences.find(
      (entry) =>
        entry.sourcePalaceId === 'palace:wealth' &&
        entry.transformationKind === 'JI',
    )
    assert.notEqual(parentLu, undefined)
    assert.notEqual(wealthJi, undefined)
    assert.equal(parentLu!.targetFacetId, 'money.earning')
    assert.equal(wealthJi!.targetFacetId, 'money.management')
    assert.equal(
      parentLu!.lifeBridge.repeatedBehavior,
      '遇到金錢問題時，會主動蒐集資訊並規劃不同做法。',
    )
    assert.equal(
      wealthJi!.lifeBridge.repeatedBehavior,
      '反覆研究不同賺錢或用錢方法，常常比較後又重新調整。',
    )
  })

  check('integration exposes no net score, dominant winner, or merged conclusion', () => {
    const serialized = JSON.stringify(integration)
    for (const forbidden of [
      'netScore',
      'netEffect',
      'dominantInfluenceRef',
      'mergedConclusion',
      'cancelledInfluenceRefs',
    ]) {
      assert.equal(serialized.includes(forbidden), false)
    }
    assert.deepEqual(integration.integrationPolicy, {
      preserveEveryDirectedInfluence: true,
      preserveCoexistingPossibilities: true,
      netting: 'FORBIDDEN',
      dominanceSelection: 'FORBIDDEN',
      customerWriting: 'NOT_PERFORMED',
    })
  })

  check('missing, duplicate, or extra results fail closed instead of returning a partial report', () => {
    expectInvalid(() =>
      buildAiChartD1FlyingPalaceIntegration(
        results.slice(1),
        modelInputSet,
        knowledgeSet,
        catalog,
      ),
    )
    expectInvalid(() =>
      buildAiChartD1FlyingPalaceIntegration(
        [...results.slice(0, 47), results[0]],
        modelInputSet,
        knowledgeSet,
        catalog,
      ),
    )
    expectInvalid(() =>
      buildAiChartD1FlyingPalaceIntegration(
        [...results, results[0]],
        modelInputSet,
        knowledgeSet,
        catalog,
      ),
    )
  })

  check('a result bound to the wrong Fact or Knowledge View fails before indexing', () => {
    const forged = structuredClone(results)
    forged[0].transformationCommonRuleRef =
      'rule:mutagen:common:forged'
    ;(forged[0].coverage as MutableRecord).knowledgeRuleRefs = [
      knowledgeSet.views[0].transformedStarCoreRule.ruleId,
      'rule:mutagen:common:forged',
      knowledgeSet.views[0].transformationSpecificRule.ruleId,
    ]
    expectInvalid(() =>
      buildAiChartD1FlyingPalaceIntegration(
        forged,
        modelInputSet,
        knowledgeSet,
        catalog,
      ),
    )
  })

  check('an empty target palace remains explicit rather than being omitted', () => {
    const travel = integration.palaces.find(
      (entry) => entry.targetPalaceId === 'palace:travel',
    )
    assert.notEqual(travel, undefined)
    assert.deepEqual(travel!.influences, [])
  })

  check('integration parser rejects summaries or scoring fields not owned by this layer', () => {
    const forged = {
      ...structuredClone(integration),
      mergedConclusion: 'forbidden synthetic summary',
    }
    expectInvalid(() =>
      parseAiChartD1FlyingPalaceIntegration(forged),
    )
  })

  check('integration Schema is strict, frozen, serializable, and contains no uniqueness keyword', () => {
    const schema =
      AI_CHART_D1_FLYING_PALACE_INTEGRATION_JSON_SCHEMA
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

  check('integration module has no runtime, fetch, OpenAI request, or customer-writing implementation', () => {
    const source = readFileSync(
      fileURLToPath(
        new URL(
          './d1FlyingPalaceIntegrationContracts.ts',
          import.meta.url,
        ),
      ),
      'utf8',
    )
    for (const forbidden of [
      'fetch(',
      'responses.create',
      'requestAiChartOpenAiStructuredResponse',
      'process.env',
      'OPENAI_API_KEY',
      'customerReport',
    ]) {
      assert.equal(source.includes(forbidden), false, forbidden)
    }
  })

  console.log(
    `d1FlyingPalaceIntegrationContracts tests passed (${checks} checks)`,
  )
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
