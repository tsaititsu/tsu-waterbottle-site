import {
  AiChartD1FlyingInfluenceError,
  parseAiChartD1FlyingFact,
  validateAiChartD1FlyingInfluenceResultAgainstSources,
  type AiChartD1FlyingInfluenceResult,
} from './d1FlyingInfluenceContracts'
import {
  parseAiChartD1FlyingKnowledgeView,
  type AiChartD1FlyingKnowledgeView,
} from './d1FlyingKnowledgeContracts'

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function knowledgeInvalid(): never {
  throw new AiChartD1FlyingInfluenceError(
    'KNOWLEDGE_BINDING_INVALID',
  )
}

function parseKnowledge(
  value: unknown,
): AiChartD1FlyingKnowledgeView {
  try {
    return parseAiChartD1FlyingKnowledgeView(value)
  } catch {
    knowledgeInvalid()
  }
}

export function validateAiChartD1FlyingInfluenceResultAgainstKnowledgeSources(
  value: unknown,
  factValue: unknown,
  sourcePalaceValue: unknown,
  targetPalaceValue: unknown,
  knowledgeViewValue: unknown,
): AiChartD1FlyingInfluenceResult {
  const result = validateAiChartD1FlyingInfluenceResultAgainstSources(
    value,
    factValue,
    sourcePalaceValue,
    targetPalaceValue,
  )
  const fact = parseAiChartD1FlyingFact(factValue)
  const knowledge = parseKnowledge(knowledgeViewValue)
  const expectedKnowledgeRuleRefs = [
    knowledge.transformedStarCoreRule.ruleId,
    knowledge.transformationCommonRule.ruleId,
    knowledge.transformationSpecificRule.ruleId,
  ]

  if (
    knowledge.chartId !== result.chartId ||
    knowledge.runId !== result.runId ||
    knowledge.flyingFactRef !== fact.flyingFactId ||
    knowledge.sourcePalaceId !== fact.sourcePalaceId ||
    knowledge.targetPalaceId !== fact.targetPalaceId ||
    knowledge.transformedStarName !== fact.transformedStarName ||
    knowledge.transformationKind !== fact.transformationKind ||
    knowledge.transformedStarCoreRule.ruleId !==
      fact.transformedStarCoreRuleRef ||
    !sameStrings(
      knowledge.sourceActorBindings.map(
        (binding) => binding.bindingId,
      ),
      fact.sourceActorBindingRefs,
    )
  ) {
    knowledgeInvalid()
  }

  if (
    result.transformedStarCoreRuleRef !==
      knowledge.transformedStarCoreRule.ruleId ||
    result.transformationCommonRuleRef !==
      knowledge.transformationCommonRule.ruleId ||
    result.transformationSpecificRuleRef !==
      knowledge.transformationSpecificRule.ruleId ||
    !sameStrings(
      result.coverage.knowledgeRuleRefs,
      expectedKnowledgeRuleRefs,
    ) ||
    !knowledge.eligibleTargetFacetIds.includes(result.targetFacetId)
  ) {
    knowledgeInvalid()
  }

  return result
}
