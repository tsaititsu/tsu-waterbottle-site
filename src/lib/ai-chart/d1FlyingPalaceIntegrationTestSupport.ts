import {
  buildAiChartD1FlyingKnowledgeViews,
  type AiChartD1FlyingKnowledgeView,
  type AiChartD1FlyingKnowledgeViewSet,
} from './d1FlyingKnowledgeContracts'
import type { AiChartD1FlyingModelInput } from './d1FlyingModelInputContracts'
import {
  createAiChartD1FlyingModelInputTestFixture,
  type AiChartD1FlyingModelInputTestFixture,
} from './d1FlyingModelInputTestSupport'
import {
  buildAiChartD1FlyingPalaceIntegration,
  type AiChartD1FlyingPalaceIntegration,
} from './d1FlyingPalaceIntegrationContracts'
import {
  getTestCatalog,
  type MutableRecord,
} from './d1P1ModelInputTestSupport'
import type { AiChartD1K0Catalog } from './d1K0Contracts'

function sourceRefs(
  input: AiChartD1FlyingModelInput,
): readonly string[] {
  const fact = input.flyingFact
  return [
    ...new Set([
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
    ]),
  ]
}

function resultFor(
  input: AiChartD1FlyingModelInput,
  knowledge: AiChartD1FlyingKnowledgeView,
): MutableRecord {
  const fact = input.flyingFact
  const ruleRefs = [
    knowledge.transformedStarCoreRule.ruleId,
    knowledge.transformationCommonRule.ruleId,
    knowledge.transformationSpecificRule.ruleId,
  ]
  const result: MutableRecord = {
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
    transformedStarCoreRuleRef: ruleRefs[0],
    transformationCommonRuleRef: ruleRefs[1],
    transformationSpecificRuleRef: ruleRefs[2],
    directPalaceCause:
      'The source palace may shape one authenticated target facet.',
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
      knowledgeRuleRefs: ruleRefs,
      sourceActorBindingRefs: [...fact.sourceActorBindingRefs],
      targetFacetIds: [input.eligibleTargetFacetIds[0]],
    },
    validationStatus: 'validated',
  }

  if (
    fact.sourcePalaceId === 'palace:parents' &&
    fact.targetPalaceId === 'palace:wealth' &&
    fact.transformationKind === 'LU' &&
    fact.transformedStarName === '天機'
  ) {
    result.targetFacetId = 'money.earning'
    result.directPalaceCause =
      '爸爸、重要長輩的教育方式或金錢經驗，可能影響命主看待賺錢機會。'
    result.starSpecificMechanism =
      '天機化祿讓命主更願意研究不同方法，並從資訊與規劃中看見可行機會。'
    result.lifeBridge = {
      sourceExperience:
        '成長過程接觸到長輩談論工作、收入或解決金錢問題的方法。',
      innerEffect: '命主容易相信多研究、多比較，就有機會找到更好的方法。',
      repeatedBehavior: '遇到金錢問題時，會主動蒐集資訊並規劃不同做法。',
      possibleOutcome: '可能因此比別人更容易注意到新的賺錢方向。',
    }
    ;(result.coverage as MutableRecord).targetFacetIds = [
      'money.earning',
    ]
  }

  if (
    fact.sourcePalaceId === 'palace:wealth' &&
    fact.targetPalaceId === 'palace:wealth' &&
    fact.transformationKind === 'JI' &&
    fact.transformedStarName === '天機'
  ) {
    result.targetFacetId = 'money.management'
    result.directPalaceCause =
      '命主對金錢是否足夠、方法是否可靠，容易產生反覆思考。'
    result.starSpecificMechanism =
      '天機化忌會讓找方法變成停不下來的比較與修正，卻不容易真正定案。'
    result.lifeBridge = {
      sourceExperience: '看到收入、支出或方法不如預期時，容易覺得還不夠。',
      innerEffect: '會擔心現在的方法不是最好的，想再找一個更可靠的方向。',
      repeatedBehavior: '反覆研究不同賺錢或用錢方法，常常比較後又重新調整。',
      possibleOutcome: '可能花很多時間找方法，最後仍覺得沒有找到理想答案。',
    }
    ;(result.coverage as MutableRecord).targetFacetIds = [
      'money.management',
    ]
  }

  return result
}

export type AiChartD1FlyingPalaceIntegrationTestFixture = Readonly<{
  source: AiChartD1FlyingModelInputTestFixture
  catalog: AiChartD1K0Catalog
  knowledgeSet: AiChartD1FlyingKnowledgeViewSet
  resultValues: readonly MutableRecord[]
  integration: AiChartD1FlyingPalaceIntegration
}>

export async function createAiChartD1FlyingPalaceIntegrationTestFixture():
  Promise<AiChartD1FlyingPalaceIntegrationTestFixture> {
  const source = createAiChartD1FlyingModelInputTestFixture()
  const catalog = await getTestCatalog()
  const knowledgeSet = buildAiChartD1FlyingKnowledgeViews(
    source.modelInputSet,
    catalog,
  )
  const resultValues = source.modelInputSet.inputs.map(
    (input, index) => resultFor(input, knowledgeSet.views[index]),
  )
  return Object.freeze({
    source,
    catalog,
    knowledgeSet,
    resultValues,
    integration: buildAiChartD1FlyingPalaceIntegration(
      [...resultValues].reverse(),
      source.modelInputSet,
      knowledgeSet,
      catalog,
    ),
  })
}
