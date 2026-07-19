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
): Mutable<AiChartD1Candidate> {
  const target = modelInput.structuralContext.targetPalace
  const star = [
    ...target.canonicalMajorStars,
    ...target.borrowedMajorStars,
    ...target.modeledSupportingStars,
    ...modelInput.structuralContext.oppositePalace.canonicalMajorStars,
  ][0]
  const rule = modelInput.knowledgeContext.rules[0]
  if (!star || !rule) throw new Error('synthetic_fixture_invalid')

  return {
    candidateId,
    statement: 'synthetic candidate statement',
    lifeExamples: ['synthetic life example'],
    scopes: ['personality'] as AiChartD1Scope[],
    palaceIds: [target.palaceId],
    starBasis: [star.name],
    structureBasis: ['本宮'] as AiChartD1StructureBasis[],
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
  const majorStars = [
    ...target.canonicalMajorStars,
    ...target.borrowedMajorStars,
  ].map((star) => star.name)
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
      majorStarCore: majorStars,
      doubleStarCore: null,
      borrowedStarMode:
        target.borrowStatus === 'eligible_and_borrowed' ? 'borrowed' : 'none',
      usedRuleIds: [modelInput.knowledgeContext.rules[0].ruleId],
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
      directMeaningsConsidered: [],
      majorStarsCovered: majorStars,
      minorStarsCovered: [],
      mutagensCovered: [],
      maleficsCovered: [],
      noblesCovered: [],
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
