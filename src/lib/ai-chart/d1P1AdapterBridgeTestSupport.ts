import {
  buildAiChartD1P1AdapterBridges,
  type AiChartD1P1AdapterBridge,
} from './d1P1AdapterBridge'
import {
  createAiChartD1P1AdapterBridgeFingerprint,
  type AiChartD1P1AdapterBridgeDescriptor,
  type AiChartD1P1AdapterBridgeDescriptorWithoutFingerprint,
} from './d1P1AdapterBridgeContracts'
import type {
  AiChartD1Candidate,
  AiChartD1Scope,
  AiChartD1StructureBasis,
} from './d1CommonContracts'
import type { AiChartD1P1ModelInput } from './d1P1ModelInputContracts'
import type { AiChartD1P1Result } from './d1P1F1Contracts'
import {
  createPromptPackageFixture,
  type Mutable,
  type PromptPackageFixture,
} from './d1P1PromptPackageTestSupport'

export type AdapterBridgeFixture = PromptPackageFixture &
  Readonly<{
    bridges: readonly AiChartD1P1AdapterBridge[]
  }>

export const AI_CHART_D1_P1_CANDIDATE_COLLECTION_FIELDS = Object.freeze([
  'directCandidates',
  'oppositeInfluences',
  'hiddenCombinationInfluences',
  'trineInfluences',
  'combinedCandidates',
  'strengths',
  'imbalancePossibilities',
] as const)

export type AiChartD1P1CandidateCollectionField =
  (typeof AI_CHART_D1_P1_CANDIDATE_COLLECTION_FIELDS)[number]

export async function createAdapterBridgeFixture(
  identity = 'adapter-bridge',
): Promise<AdapterBridgeFixture> {
  const fixture = await createPromptPackageFixture(identity)
  const bridges = buildAiChartD1P1AdapterBridges(
    fixture.catalog,
    fixture.structuralInputs,
    fixture.bundles,
    fixture.modelInputs,
    fixture.promptPackages,
  )
  return { ...fixture, bridges }
}

export function createValidAiChartD1P1Candidate(
  modelInput: AiChartD1P1ModelInput,
  candidateId = 'candidate:valid',
  collection: AiChartD1P1CandidateCollectionField = 'directCandidates',
): Mutable<AiChartD1Candidate> {
  const target = modelInput.structuralContext.targetPalace
  const opposite = modelInput.structuralContext.oppositePalace
  const hidden = modelInput.structuralContext.hiddenCombinationPalace
  const trines = modelInput.structuralContext.otherTrinePalaces
  const collectionSources = {
    directCandidates: {
      palaces: [target],
      palaceIds: [target.palaceId],
      structureBasis: ['本宮'],
    },
    oppositeInfluences: {
      palaces: [target, opposite],
      palaceIds: [opposite.palaceId],
      structureBasis: ['對宮'],
    },
    hiddenCombinationInfluences: {
      palaces: [target, hidden],
      palaceIds: [hidden.palaceId],
      structureBasis: ['暗合'],
    },
    trineInfluences: {
      palaces: [target, ...trines],
      palaceIds: [trines[0].palaceId],
      structureBasis: ['三方'],
    },
    combinedCandidates: {
      palaces: [target, opposite, hidden, ...trines],
      palaceIds: [target.palaceId],
      structureBasis: ['本宮'],
    },
    strengths: {
      palaces: [target, opposite, hidden, ...trines],
      palaceIds: [target.palaceId],
      structureBasis: ['本宮'],
    },
    imbalancePossibilities: {
      palaces: [target, opposite, hidden, ...trines],
      palaceIds: [target.palaceId],
      structureBasis: ['本宮'],
    },
  } satisfies Record<
    AiChartD1P1CandidateCollectionField,
    Readonly<{
      palaces: readonly typeof target[]
      palaceIds: readonly string[]
      structureBasis: readonly AiChartD1StructureBasis[]
    }>
  >
  const source = collectionSources[collection]
  const star = source.palaces.flatMap((palace) => [
    ...palace.canonicalMajorStars,
    ...palace.borrowedMajorStars,
    ...palace.modeledSupportingStars,
  ])[0]
  const rule = modelInput.knowledgeContext.rules[0]
  if (!star || !rule) throw new Error('synthetic_fixture_invalid')

  return {
    candidateId,
    statement: 'synthetic candidate statement',
    lifeExamples: ['synthetic life example'],
    scopes: ['personality'] as AiChartD1Scope[],
    palaceIds: [...source.palaceIds],
    starBasis: [star.name],
    structureBasis: [...source.structureBasis],
    usedRuleIds: [rule.ruleId],
    ruleStatus: rule.ruleStatus,
    intensity: 'normal' as const,
    conflictGroupId: null,
    d2Boundary: null,
  }
}

export function createValidAiChartD1P1Result(
  modelInput: AiChartD1P1ModelInput,
): Mutable<AiChartD1P1Result> {
  const target = modelInput.structuralContext.targetPalace
  const coverageMajorStars = [
    ...target.canonicalMajorStars,
    ...target.borrowedMajorStars,
  ].map((star) => star.name)
  const effectiveMajorStars = (
    target.borrowStatus === 'eligible_and_borrowed'
      ? target.borrowedMajorStars
      : target.canonicalMajorStars
  ).map((star) => star.name)
  const primaryRuleIds = modelInput.knowledgeContext.selectionTrace
    .filter(
      (trace) =>
        trace.palaceRole === 'target' &&
        [
          'major_star_present',
          'borrowed_major_star_present',
          'double_star_present',
        ].includes(trace.reason),
    )
    .map((trace) => trace.ruleId)
  const hasAuthenticatedDoubleRule = modelInput.knowledgeContext.selectionTrace
    .some(
      (trace) =>
        trace.palaceRole === 'target' &&
        trace.reason === 'double_star_present' &&
        modelInput.knowledgeContext.rules.some(
          (rule) =>
            rule.ruleId === trace.ruleId && rule.kind === 'double_star',
        ),
    )
  const supportingStars = target.modeledSupportingStars.map((star) => star.name)
  const coverageStars = [
    ...target.canonicalMajorStars,
    ...target.borrowedMajorStars,
    ...target.modeledSupportingStars,
  ]
  const targetMeaningIds = modelInput.knowledgeContext.meanings
    .filter((meaning) => meaning.palaceRole === 'target')
    .map((meaning) => meaning.meaningId)
  const mutagensCovered = coverageStars.flatMap((star) =>
    star.natalMutagen === null
      ? []
      : [`${star.name} ${star.natalMutagen}`],
  )
  const maleficsCovered = [
    ...new Set([
      ...modelInput.structuralContext.targetGlobalScan.directSignals,
      ...modelInput.structuralContext.targetGlobalScan.oppositeSignals,
      ...modelInput.structuralContext.targetGlobalScan.hiddenCombinationSignals,
      ...modelInput.structuralContext.targetGlobalScan.trineSignals,
    ].map((signal) => signal.signalType)),
  ]
  const nobleStars = new Set(['左輔', '右弼', '天魁', '天鉞'])
  const noblesCovered = supportingStars.filter((name) => nobleStars.has(name))
  const warningCodes = modelInput.warnings.map((warning) => warning.code)
  const isPartial = modelInput.structuralStatus === 'partial'
  const omittedItems = isPartial
    ? (warningCodes.length === 0 ? ['STRUCTURAL_PARTIAL'] : warningCodes).map(
        (code) => ({
          item: code,
          reason: `${code} remains unprocessed`,
        }),
      )
    : []

  return {
    contractVersion: modelInput.outputContractVersion,
    task: 'P1',
    callId: modelInput.callId,
    chartId: modelInput.chartId,
    palaceId: modelInput.targetPalaceId,
    palace: target.canonicalName,
    status: isPartial ? 'partial' : 'complete',
    primaryAxis: {
      statement: 'synthetic primary axis',
      majorStarCore: effectiveMajorStars,
      doubleStarCore: hasAuthenticatedDoubleRule
        ? `以${effectiveMajorStars.join('與')}為核心`
        : null,
      borrowedStarMode:
        target.borrowStatus === 'eligible_and_borrowed' ? 'borrowed' : 'none',
      usedRuleIds: primaryRuleIds,
    },
    directCandidates: [createValidAiChartD1P1Candidate(modelInput)],
    oppositeInfluences: [],
    hiddenCombinationInfluences: [],
    trineInfluences: [],
    combinedCandidates: [],
    tensions: [],
    strengths: [],
    imbalancePossibilities: [],
    coverage: {
      directMeaningsConsidered: targetMeaningIds,
      majorStarsCovered: coverageMajorStars,
      minorStarsCovered: supportingStars,
      mutagensCovered,
      maleficsCovered,
      noblesCovered,
      oppositeProcessed: !isPartial,
      hiddenCombinationProcessed: !isPartial,
      trinesProcessed: !isPartial,
      omittedItems,
    },
    d2Boundaries: [],
    warnings: warningCodes,
  }
}

export function recalculateAdapterBridgeDescriptorFingerprint(
  descriptor: Mutable<AiChartD1P1AdapterBridgeDescriptor>,
): void {
  const payload = structuredClone(descriptor) as unknown as Record<
    string,
    unknown
  >
  delete payload.bridgeFingerprint
  descriptor.bridgeFingerprint = createAiChartD1P1AdapterBridgeFingerprint(
    payload as AiChartD1P1AdapterBridgeDescriptorWithoutFingerprint,
  )
}

export type { Mutable }
