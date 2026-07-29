import assert from 'node:assert/strict'
import {
  AiChartD1FlyingInfluenceError,
  type AiChartD1FlyingFact,
  type AiChartD1FlyingInfluenceValidationReason,
} from './d1FlyingInfluenceContracts'
import { buildAiChartD1FlyingKnowledgeViews } from './d1FlyingKnowledgeContracts'
import type { AiChartD1FlyingModelInput } from './d1FlyingModelInputContracts'
import { createAiChartD1FlyingModelInputTestFixture } from './d1FlyingModelInputTestSupport'
import { validateAiChartD1FlyingInfluenceResultAgainstKnowledgeSources } from './d1FlyingResultBindings'
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

function sourceRefs(
  input: AiChartD1FlyingModelInput,
): readonly string[] {
  const fact = input.flyingFact
  return [
    fact.flyingFactId,
    input.sourcePalaceResult.palaceResultId,
    input.targetPalaceResult.palaceResultId,
    fact.sourcePalaceStemRef,
    fact.transformedStarRef,
    fact.transformedStarCoreRuleRef,
    fact.transformationActionRef,
    ...(fact.natalBackgroundFactRef === null
      ? []
      : [fact.natalBackgroundFactRef]),
    ...(fact.optionalOppositeCauseRef === null
      ? []
      : [fact.optionalOppositeCauseRef]),
  ]
}

function resultFixture(
  input: AiChartD1FlyingModelInput,
  knowledgeRuleRefs: readonly [string, string, string],
): MutableRecord {
  const fact = input.flyingFact
  return {
    contractVersion: 'ai-chart-d1-flying-influence-result/v1',
    flyingInfluenceId: fact.authoritativeInfluenceId,
    flyingFactRef: fact.flyingFactId,
    chartId: input.chartId,
    runId: input.runId,
    sourcePalaceResultRef:
      input.sourcePalaceResult.palaceResultId,
    sourcePalaceId: fact.sourcePalaceId,
    sourceActorBindingRefs: [...fact.sourceActorBindingRefs],
    targetPalaceResultRef:
      input.targetPalaceResult.palaceResultId,
    targetPalaceId: fact.targetPalaceId,
    targetFacetId: input.eligibleTargetFacetIds[0],
    transformationKind: fact.transformationKind,
    transformationActionRef: fact.transformationActionRef,
    transformedStarRef: fact.transformedStarRef,
    transformedStarCoreRuleRef: knowledgeRuleRefs[0],
    transformationCommonRuleRef: knowledgeRuleRefs[1],
    transformationSpecificRuleRef: knowledgeRuleRefs[2],
    directPalaceCause:
      'The authenticated source palace may shape this target facet.',
    oppositeCauseRef: fact.optionalOppositeCauseRef,
    natalBackgroundRelation:
      fact.natalBackgroundKind === 'NONE' ? 'NONE' : 'AMPLIFY',
    starSpecificMechanism:
      'The authenticated star core carries the fixed transformation action.',
    lifeBridge: {
      sourceExperience: 'A source experience may be noticed.',
      innerEffect: 'It may shape an inner response.',
      repeatedBehavior: 'The response may become a repeated behavior.',
      possibleOutcome: null,
    },
    constraints: [
      'This is a D1 possibility, not an asserted event.',
    ],
    coverage: {
      sourceRefs: sourceRefs(input),
      knowledgeRuleRefs: [...knowledgeRuleRefs],
      sourceActorBindingRefs: [...fact.sourceActorBindingRefs],
      targetFacetIds: [input.eligibleTargetFacetIds[0]],
    },
    validationStatus: 'validated',
  }
}

function expectInvalid(
  run: () => unknown,
  reasonCode: AiChartD1FlyingInfluenceValidationReason,
): void {
  try {
    run()
    assert.fail('expected source-bound rejection')
  } catch (error) {
    assert.equal(error instanceof AiChartD1FlyingInfluenceError, true)
    if (!(error instanceof AiChartD1FlyingInfluenceError)) {
      assert.fail('expected AiChartD1FlyingInfluenceError')
    }
    assert.equal(error.reasonCode, reasonCode)
    assert.equal(Object.isFrozen(error), true)
  }
}

function rulesFor(
  knowledge: {
    transformedStarCoreRule: { ruleId: string }
    transformationCommonRule: { ruleId: string }
    transformationSpecificRule: { ruleId: string }
  },
): readonly [string, string, string] {
  return [
    knowledge.transformedStarCoreRule.ruleId,
    knowledge.transformationCommonRule.ruleId,
    knowledge.transformationSpecificRule.ruleId,
  ]
}

async function run() {
  const fixture = createAiChartD1FlyingModelInputTestFixture()
  const catalog = await getTestCatalog()
  const knowledgeSet = buildAiChartD1FlyingKnowledgeViews(
    fixture.modelInputSet,
    catalog,
  )
  const input = fixture.modelInputSet.inputs[0]
  const knowledge = knowledgeSet.views[0]
  const rules = rulesFor(knowledge)

  check('result validator accepts output bound to Fact, Palace Results, and all three fixed Knowledge rules', () => {
    const parsed =
      validateAiChartD1FlyingInfluenceResultAgainstKnowledgeSources(
        resultFixture(input, rules),
        input.flyingFact,
        input.sourcePalaceResult,
        input.targetPalaceResult,
        knowledge,
      )
    assert.deepEqual(parsed.coverage.knowledgeRuleRefs, rules)
    assert.equal(
      parsed.transformationCommonRuleRef,
      knowledge.transformationCommonRule.ruleId,
    )
    assert.equal(
      parsed.transformationSpecificRuleRef,
      knowledge.transformationSpecificRule.ruleId,
    )
    assert.equal(Object.isFrozen(parsed), true)
    assert.equal(Object.isFrozen(parsed.coverage), true)
    assert.equal(
      Object.isFrozen(parsed.coverage.knowledgeRuleRefs),
      true,
    )
  })

  check('model cannot replace the common transformation rule while keeping self-consistent coverage', () => {
    const forged = resultFixture(input, [
      rules[0],
      'rule:mutagen:common:forged',
      rules[2],
    ])
    expectInvalid(
      () =>
        validateAiChartD1FlyingInfluenceResultAgainstKnowledgeSources(
          forged,
          input.flyingFact,
          input.sourcePalaceResult,
          input.targetPalaceResult,
          knowledge,
        ),
      'KNOWLEDGE_BINDING_INVALID',
    )
  })

  check('model cannot replace the star-specific transformation rule while keeping self-consistent coverage', () => {
    const forged = resultFixture(input, [
      rules[0],
      rules[1],
      'rule:mutagen:forged:lu',
    ])
    expectInvalid(
      () =>
        validateAiChartD1FlyingInfluenceResultAgainstKnowledgeSources(
          forged,
          input.flyingFact,
          input.sourcePalaceResult,
          input.targetPalaceResult,
          knowledge,
        ),
      'KNOWLEDGE_BINDING_INVALID',
    )
  })

  check('a Knowledge View from another Flying Fact cannot authorize the result', () => {
    expectInvalid(
      () =>
        validateAiChartD1FlyingInfluenceResultAgainstKnowledgeSources(
          resultFixture(input, rules),
          input.flyingFact,
          input.sourcePalaceResult,
          input.targetPalaceResult,
          knowledgeSet.views[1],
        ),
      'KNOWLEDGE_BINDING_INVALID',
    )
  })

  check('safe rejection never serializes forged model text', () => {
    const marker = 'synthetic-sensitive-model-output'
    const forged = resultFixture(input, [
      rules[0],
      rules[1],
      `rule:mutagen:${marker}:lu`,
    ])
    try {
      validateAiChartD1FlyingInfluenceResultAgainstKnowledgeSources(
        forged,
        input.flyingFact,
        input.sourcePalaceResult,
        input.targetPalaceResult,
        knowledge,
      )
      assert.fail('expected safe rejection')
    } catch (error) {
      assert.equal(error instanceof AiChartD1FlyingInfluenceError, true)
      assert.equal((error as Error).message.includes(marker), false)
      assert.equal(JSON.stringify(error).includes(marker), false)
    }
  })

  check('result binding does not mutate Fact, Palace Results, or Knowledge View', () => {
    const factBefore = JSON.stringify(
      input.flyingFact as AiChartD1FlyingFact,
    )
    const sourceBefore = JSON.stringify(input.sourcePalaceResult)
    const targetBefore = JSON.stringify(input.targetPalaceResult)
    const knowledgeBefore = JSON.stringify(knowledge)
    validateAiChartD1FlyingInfluenceResultAgainstKnowledgeSources(
      resultFixture(input, rules),
      input.flyingFact,
      input.sourcePalaceResult,
      input.targetPalaceResult,
      knowledge,
    )
    assert.equal(JSON.stringify(input.flyingFact), factBefore)
    assert.equal(JSON.stringify(input.sourcePalaceResult), sourceBefore)
    assert.equal(JSON.stringify(input.targetPalaceResult), targetBefore)
    assert.equal(JSON.stringify(knowledge), knowledgeBefore)
  })

  console.log(`d1FlyingResultBindings tests passed (${checks} checks)`)
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
