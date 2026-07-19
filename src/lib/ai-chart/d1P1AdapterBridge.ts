import {
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  type AiChartD1Candidate,
  type AiChartD1RuleStatus,
  type AiChartD1StructureBasis,
} from './d1CommonContracts'
import {
  AI_CHART_D1_MAJOR_STAR_NAMES,
  AI_CHART_D1_MODELED_SUPPORTING_STARS,
  AI_CHART_D1_MUTAGEN_TYPES,
  AI_CHART_D1_PALACE_IDENTITIES,
} from './d1N0Constants'
import {
  parseAiChartD1P1ModelInput,
} from './d1P1ModelInputBindings'
import {
  AiChartD1P1ModelInputError,
  AiChartD1P1ModelInputNotReadyError,
  type AiChartD1P1ModelInput,
  type AiChartD1P1ModelRule,
} from './d1P1ModelInputContracts'
import {
  buildAiChartD1P1PromptPackages,
  parseAiChartD1P1PromptPackage,
} from './d1P1PromptPackageBuilder'
import {
  AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256,
  AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256,
  AI_CHART_D1_P1_PROMPT_PACKAGE_CONTRACT_VERSION,
  AI_CHART_D1_P1_PROMPT_VERSION,
  AiChartD1P1PromptPackageBudgetExceededError,
  AiChartD1P1PromptPackageError,
  AiChartD1P1PromptPackageNotReadyError,
  stableAiChartD1P1PromptPackageEqual,
  type AiChartD1P1PromptPackage,
} from './d1P1PromptPackageContracts'
import {
  AI_CHART_D1_P1_ADAPTER_BRIDGE_CONTRACT_VERSION,
  AI_CHART_D1_P1_ADAPTER_BRIDGE_DESCRIPTION,
  AI_CHART_D1_P1_ADAPTER_BRIDGE_TASK,
  AiChartD1P1AdapterBridgeError,
  AiChartD1P1AdapterBridgeNotReadyError,
  AiChartD1P1AdapterBridgeResultInvalidError,
  createAiChartD1P1AdapterBridgeFingerprint,
  parseAiChartD1P1AdapterBridgeDescriptorShape,
  stableAiChartD1P1AdapterBridgeDescriptorEqual,
  type AiChartD1P1AdapterBridgeDescriptor,
  type AiChartD1P1AdapterBridgeDescriptorWithoutFingerprint,
} from './d1P1AdapterBridgeContracts'
import {
  AI_CHART_D1_P1_OUTPUT_SCHEMA,
  AI_CHART_D1_P1_SCHEMA_NAME,
  parseAiChartD1P1Result,
  type AiChartD1P1Coverage,
  type AiChartD1P1Result,
} from './d1P1F1Contracts'
import {
  AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS,
  AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
  AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
  validateAiChartOpenAiStructuredRequest,
  type ValidatedAiChartOpenAiStructuredRequest,
} from './openAiResponses'

export type AiChartD1P1AdapterBridge = Readonly<{
  descriptor: AiChartD1P1AdapterBridgeDescriptor
  request: ValidatedAiChartOpenAiStructuredRequest<AiChartD1P1Result>
}>

const P1_CANDIDATE_COLLECTION_FIELDS = Object.freeze([
  'directCandidates',
  'oppositeInfluences',
  'hiddenCombinationInfluences',
  'trineInfluences',
  'combinedCandidates',
  'strengths',
  'imbalancePossibilities',
] as const)

const P1_ALLOWED_STRUCTURE_BASES = new Set([
  '本宮',
  '對宮',
  '暗合',
  '三方',
  '空宮借星',
  '生年四化',
  '煞忌',
  '輔星',
])

const P1_NOBLE_STAR_NAMES = new Set(['左輔', '右弼', '天魁', '天鉞'])
const P1_KNOWN_STAR_NAMES = new Set([
  ...AI_CHART_D1_MAJOR_STAR_NAMES,
  ...Object.keys(AI_CHART_D1_MODELED_SUPPORTING_STARS),
])
const P1_MALEFIC_SIGNAL_TYPES = Object.freeze([
  '擎羊',
  '陀羅',
  '火星',
  '鈴星',
  '生年化忌',
] as const)

const P1_RULE_STATUS_AUTHORITY = Object.freeze({
  teacher_confirmed: 0,
  lecture_backfill: 1,
  working_inference: 2,
} satisfies Record<AiChartD1RuleStatus, number>)

type CandidateSourcePolicy = Readonly<{
  allowedPalaceIds: ReadonlySet<string>
  allowedStarNames: ReadonlySet<string>
  requiredPalaceIds?: ReadonlySet<string>
  requiredAnyPalaceIds?: ReadonlySet<string>
  requiredStructureBasis?: AiChartD1StructureBasis
  forbiddenStructureBasis?: ReadonlySet<AiChartD1StructureBasis>
}>

type ExpectedMutagenPair = Readonly<{
  key: string
  starName: string
  mutagenType: string
}>

type ExpectedCoverageSources = Readonly<{
  targetMeaningIds: ReadonlySet<string>
  targetMajorStars: ReadonlySet<string>
  targetMinorStars: ReadonlySet<string>
  targetMutagenPairs: readonly ExpectedMutagenPair[]
  relevantMaleficTypes: ReadonlySet<string>
  maleficOpaqueIds: ReadonlySet<string>
  targetNobleStars: ReadonlySet<string>
}>

function invalid(): never {
  throw new AiChartD1P1AdapterBridgeError()
}

function notReady(): never {
  throw new AiChartD1P1AdapterBridgeNotReadyError()
}

function resultInvalid(): never {
  throw new AiChartD1P1AdapterBridgeResultInvalidError()
}

function rethrowBuildError(error: unknown): never {
  if (error instanceof AiChartD1P1AdapterBridgeNotReadyError) throw error
  if (error instanceof AiChartD1P1AdapterBridgeError) throw error
  if (error instanceof AiChartD1P1ModelInputNotReadyError) notReady()
  if (error instanceof AiChartD1P1PromptPackageNotReadyError) notReady()
  if (error instanceof AiChartD1P1ModelInputError) invalid()
  if (error instanceof AiChartD1P1PromptPackageError) invalid()
  if (error instanceof AiChartD1P1PromptPackageBudgetExceededError) invalid()
  invalid()
}

function descriptorWithoutFingerprint(
  modelInput: AiChartD1P1ModelInput,
  promptPackage: AiChartD1P1PromptPackage,
): AiChartD1P1AdapterBridgeDescriptorWithoutFingerprint {
  if (
    promptPackage.chartId !== modelInput.chartId ||
    promptPackage.runId !== modelInput.runId ||
    promptPackage.callId !== modelInput.callId ||
    promptPackage.targetPalaceId !== modelInput.targetPalaceId ||
    promptPackage.modelInputFingerprint !== modelInput.inputFingerprint ||
    promptPackage.outputContractVersion !== modelInput.outputContractVersion ||
    promptPackage.outputSchemaName !== modelInput.outputSchemaName
  ) {
    invalid()
  }

  return {
    contractVersion: AI_CHART_D1_P1_ADAPTER_BRIDGE_CONTRACT_VERSION,
    task: AI_CHART_D1_P1_ADAPTER_BRIDGE_TASK,
    chartId: modelInput.chartId,
    runId: modelInput.runId,
    callId: modelInput.callId,
    targetPalaceId: modelInput.targetPalaceId,
    promptPackageContractVersion:
      AI_CHART_D1_P1_PROMPT_PACKAGE_CONTRACT_VERSION,
    promptVersion: AI_CHART_D1_P1_PROMPT_VERSION,
    packageFingerprint: promptPackage.packageFingerprint,
    modelInputFingerprint: modelInput.inputFingerprint,
    outputContractVersion: modelInput.outputContractVersion,
    outputSchemaName: AI_CHART_D1_P1_SCHEMA_NAME,
    outputSchemaSha256: AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256,
    instructionsSha256: AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256,
    userInputSha256: promptPackage.userInputSha256,
    description: AI_CHART_D1_P1_ADAPTER_BRIDGE_DESCRIPTION,
    reasoningEffort: AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
    timeoutMs: AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
    maxOutputTokens: AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS,
    requestStatus: 'ready',
    runtimeStatus: 'runtime_wiring_required',
    openAiCallable: false,
  }
}

function buildDescriptor(
  modelInput: AiChartD1P1ModelInput,
  promptPackage: AiChartD1P1PromptPackage,
): AiChartD1P1AdapterBridgeDescriptor {
  const withoutFingerprint = descriptorWithoutFingerprint(
    modelInput,
    promptPackage,
  )
  return freezeAiChartD1Value({
    ...withoutFingerprint,
    bridgeFingerprint:
      createAiChartD1P1AdapterBridgeFingerprint(withoutFingerprint),
  })
}

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length
}

export function deriveAiChartD1P1CandidateRuleStatus(
  usedRuleIds: readonly string[],
  rules: readonly Pick<AiChartD1P1ModelRule, 'ruleId' | 'ruleStatus'>[],
): AiChartD1RuleStatus {
  const ruleStatusById = new Map(
    rules.map((rule) => [rule.ruleId, rule.ruleStatus]),
  )
  if (
    usedRuleIds.length === 0 ||
    hasDuplicates(usedRuleIds) ||
    usedRuleIds.some((ruleId) => !ruleStatusById.has(ruleId))
  ) {
    resultInvalid()
  }
  return usedRuleIds
    .map((ruleId) => ruleStatusById.get(ruleId) as AiChartD1RuleStatus)
    .reduce((weakest, status) =>
      P1_RULE_STATUS_AUTHORITY[status] > P1_RULE_STATUS_AUTHORITY[weakest]
        ? status
        : weakest,
    )
}

export function assertAiChartD1P1CandidateRuleAuthority(
  candidate: Pick<AiChartD1Candidate, 'usedRuleIds' | 'ruleStatus'>,
  rules: readonly Pick<AiChartD1P1ModelRule, 'ruleId' | 'ruleStatus'>[],
): void {
  if (
    candidate.ruleStatus !==
    deriveAiChartD1P1CandidateRuleStatus(candidate.usedRuleIds, rules)
  ) {
    resultInvalid()
  }
}

function assertCandidateSourceBinding(
  candidate: AiChartD1Candidate,
  rules: readonly AiChartD1P1ModelRule[],
  policy: CandidateSourcePolicy,
): void {
  if (
    hasDuplicates(candidate.palaceIds) ||
    candidate.palaceIds.some(
      (palaceId) => !policy.allowedPalaceIds.has(palaceId),
    ) ||
    [...(policy.requiredPalaceIds ?? [])].some(
      (palaceId) => !candidate.palaceIds.includes(palaceId),
    ) ||
    (policy.requiredAnyPalaceIds !== undefined &&
      !candidate.palaceIds.some((palaceId) =>
        policy.requiredAnyPalaceIds?.has(palaceId),
      )) ||
    hasDuplicates(candidate.starBasis) ||
    candidate.starBasis.some(
      (starName) => !policy.allowedStarNames.has(starName),
    ) ||
    hasDuplicates(candidate.structureBasis) ||
    candidate.structureBasis.some(
      (structure) => !P1_ALLOWED_STRUCTURE_BASES.has(structure),
    ) ||
    (policy.requiredStructureBasis !== undefined &&
      !candidate.structureBasis.includes(policy.requiredStructureBasis)) ||
    candidate.structureBasis.some((structure) =>
      policy.forbiddenStructureBasis?.has(structure),
    )
  ) {
    resultInvalid()
  }

  assertAiChartD1P1CandidateRuleAuthority(
    candidate,
    rules,
  )
}

function allCandidates(result: AiChartD1P1Result): readonly AiChartD1Candidate[] {
  return P1_CANDIDATE_COLLECTION_FIELDS.flatMap((field) => result[field])
}

function assertIdentityAndStatus(
  result: AiChartD1P1Result,
  modelInput: AiChartD1P1ModelInput,
): void {
  if (
    result.contractVersion !== modelInput.outputContractVersion ||
    result.task !== 'P1' ||
    result.callId !== modelInput.callId ||
    result.chartId !== modelInput.chartId ||
    result.palaceId !== modelInput.targetPalaceId ||
    result.palace !==
      modelInput.structuralContext.targetPalace.canonicalName ||
    result.status === 'invalid'
  ) {
    resultInvalid()
  }

  if (
    modelInput.structuralStatus === 'partial' &&
    result.status !== 'partial'
  ) {
    resultInvalid()
  }

}

function assertBorrowedStarBinding(
  result: AiChartD1P1Result,
  modelInput: AiChartD1P1ModelInput,
): void {
  const borrowStatus = modelInput.structuralContext.targetPalace.borrowStatus
  if (borrowStatus === 'opposite_empty') resultInvalid()
  const expectedMode =
    borrowStatus === 'eligible_and_borrowed' ? 'borrowed' : 'none'
  if (result.primaryAxis.borrowedStarMode !== expectedMode) resultInvalid()
}

function structuralPalaces(modelInput: AiChartD1P1ModelInput) {
  return [
    modelInput.structuralContext.targetPalace,
    modelInput.structuralContext.oppositePalace,
    modelInput.structuralContext.hiddenCombinationPalace,
    ...modelInput.structuralContext.otherTrinePalaces,
  ]
}

function starNamesForPalaces(
  palaces: readonly AiChartD1P1ModelInput['structuralContext']['targetPalace'][],
): ReadonlySet<string> {
  return new Set(
    palaces.flatMap((palace) => [
      ...palace.canonicalMajorStars.map((star) => star.name),
      ...palace.borrowedMajorStars.map((star) => star.name),
      ...palace.modeledSupportingStars.map((star) => star.name),
    ]),
  )
}

function assertRulePalaceAndStarBindings(
  result: AiChartD1P1Result,
  modelInput: AiChartD1P1ModelInput,
): void {
  const ruleStatusById = new Map(
    modelInput.knowledgeContext.rules.map((rule) => [
      rule.ruleId,
      rule.ruleStatus,
    ]),
  )
  const target = modelInput.structuralContext.targetPalace
  const opposite = modelInput.structuralContext.oppositePalace
  const hidden = modelInput.structuralContext.hiddenCombinationPalace
  const trines = modelInput.structuralContext.otherTrinePalaces
  const allPalaces = structuralPalaces(modelInput)
  const targetPalaceIds = new Set([target.palaceId])
  const oppositePalaceIds = new Set([target.palaceId, opposite.palaceId])
  const hiddenPalaceIds = new Set([target.palaceId, hidden.palaceId])
  const trinePalaceIds = new Set([
    target.palaceId,
    ...trines.map((palace) => palace.palaceId),
  ])
  const otherTrinePalaceIds = new Set(
    trines.map((palace) => palace.palaceId),
  )
  const allPalaceIds = new Set(allPalaces.map((palace) => palace.palaceId))
  const policies: Record<
    (typeof P1_CANDIDATE_COLLECTION_FIELDS)[number],
    CandidateSourcePolicy
  > = {
    directCandidates: {
      allowedPalaceIds: targetPalaceIds,
      allowedStarNames: starNamesForPalaces([target]),
      requiredPalaceIds: targetPalaceIds,
      requiredStructureBasis: '本宮',
      forbiddenStructureBasis: new Set(['對宮', '暗合', '三方']),
    },
    oppositeInfluences: {
      allowedPalaceIds: oppositePalaceIds,
      allowedStarNames: starNamesForPalaces([target, opposite]),
      requiredPalaceIds: new Set([opposite.palaceId]),
      requiredStructureBasis: '對宮',
    },
    hiddenCombinationInfluences: {
      allowedPalaceIds: hiddenPalaceIds,
      allowedStarNames: starNamesForPalaces([target, hidden]),
      requiredPalaceIds: new Set([hidden.palaceId]),
      requiredStructureBasis: '暗合',
    },
    trineInfluences: {
      allowedPalaceIds: trinePalaceIds,
      allowedStarNames: starNamesForPalaces([target, ...trines]),
      requiredAnyPalaceIds: otherTrinePalaceIds,
      requiredStructureBasis: '三方',
    },
    combinedCandidates: {
      allowedPalaceIds: allPalaceIds,
      allowedStarNames: starNamesForPalaces(allPalaces),
    },
    strengths: {
      allowedPalaceIds: allPalaceIds,
      allowedStarNames: starNamesForPalaces(allPalaces),
    },
    imbalancePossibilities: {
      allowedPalaceIds: allPalaceIds,
      allowedStarNames: starNamesForPalaces(allPalaces),
    },
  }

  if (
    result.primaryAxis.usedRuleIds.length === 0 ||
    hasDuplicates(result.primaryAxis.usedRuleIds) ||
    result.primaryAxis.usedRuleIds.some(
      (ruleId) => !ruleStatusById.has(ruleId),
    )
  ) {
    resultInvalid()
  }

  for (const field of P1_CANDIDATE_COLLECTION_FIELDS) {
    for (const candidate of result[field]) {
      assertCandidateSourceBinding(
        candidate,
        modelInput.knowledgeContext.rules,
        policies[field],
      )
    }
  }
}

function setEquals(
  actual: ReadonlySet<string>,
  expected: ReadonlySet<string>,
): boolean {
  return (
    actual.size === expected.size &&
    [...actual].every((value) => expected.has(value))
  )
}

function assertStringCoverageSubset(
  values: readonly string[],
  expected: ReadonlySet<string>,
): ReadonlySet<string> {
  if (hasDuplicates(values) || values.some((value) => !expected.has(value))) {
    resultInvalid()
  }
  return new Set(values)
}

function expectedCoverageSources(
  modelInput: AiChartD1P1ModelInput,
): ExpectedCoverageSources {
  const target = modelInput.structuralContext.targetPalace
  const targetMajorStars = [
    ...target.canonicalMajorStars,
    ...target.borrowedMajorStars,
  ]
  const targetCoverageStars = [
    ...targetMajorStars,
    ...target.modeledSupportingStars,
  ]
  const targetMutagenPairs = [
    ...new Map(
      targetCoverageStars.flatMap((star) =>
        star.natalMutagen === null
          ? []
          : [[
              `${star.name}\u0000${star.natalMutagen}`,
              {
                key: `${star.name}\u0000${star.natalMutagen}`,
                starName: star.name,
                mutagenType: star.natalMutagen,
              } satisfies ExpectedMutagenPair,
            ] as const],
      ),
    ).values(),
  ]
  const relevantSignals = [
    ...modelInput.structuralContext.targetGlobalScan.directSignals,
    ...modelInput.structuralContext.targetGlobalScan.oppositeSignals,
    ...modelInput.structuralContext.targetGlobalScan.hiddenCombinationSignals,
    ...modelInput.structuralContext.targetGlobalScan.trineSignals,
  ]

  return {
    targetMeaningIds: new Set(
      modelInput.knowledgeContext.meanings
        .filter((meaning) => meaning.palaceRole === 'target')
        .map((meaning) => meaning.meaningId),
    ),
    targetMajorStars: new Set(targetMajorStars.map((star) => star.name)),
    targetMinorStars: new Set(
      target.modeledSupportingStars.map((star) => star.name),
    ),
    targetMutagenPairs,
    relevantMaleficTypes: new Set(
      relevantSignals.map((signal) => signal.signalType),
    ),
    maleficOpaqueIds: new Set(
      relevantSignals.flatMap((signal) => [
        signal.signalId,
        signal.starPlacementId,
      ]),
    ),
    targetNobleStars: new Set(
      target.modeledSupportingStars
        .map((star) => star.name)
        .filter((name) => P1_NOBLE_STAR_NAMES.has(name)),
    ),
  }
}

function representedMutagenPairs(
  values: readonly string[],
  expectedPairs: readonly ExpectedMutagenPair[],
): ReadonlySet<string> {
  if (hasDuplicates(values)) resultInvalid()
  const represented = new Set<string>()
  for (const value of values) {
    const matches = expectedPairs.filter(
      (pair) =>
        value.includes(pair.starName) && value.includes(pair.mutagenType),
    )
    const matchedStarNames = new Set(matches.map((pair) => pair.starName))
    const matchedMutagenTypes = new Set(
      matches.map((pair) => pair.mutagenType),
    )
    if (
      matches.length === 0 ||
      [...P1_KNOWN_STAR_NAMES].some(
        (starName) =>
          value.includes(starName) && !matchedStarNames.has(starName),
      ) ||
      AI_CHART_D1_MUTAGEN_TYPES.some(
        (type) =>
          value.includes(type) && !matchedMutagenTypes.has(type),
      )
    ) {
      resultInvalid()
    }
    if (matches.some((pair) => represented.has(pair.key))) resultInvalid()
    matches.forEach((pair) => represented.add(pair.key))
  }
  return represented
}

function representedMaleficTypes(
  values: readonly string[],
  expectedTypes: ReadonlySet<string>,
  opaqueIds: ReadonlySet<string>,
): ReadonlySet<string> {
  if (hasDuplicates(values)) resultInvalid()
  const represented = new Set<string>()
  for (const value of values) {
    const matches = [...expectedTypes].filter((type) => value.includes(type))
    if (
      matches.length === 0 ||
      [...opaqueIds].some((id) => value.includes(id)) ||
      P1_MALEFIC_SIGNAL_TYPES.some(
        (type) => value.includes(type) && !expectedTypes.has(type),
      )
    ) {
      resultInvalid()
    }
    if (matches.some((type) => represented.has(type))) resultInvalid()
    matches.forEach((type) => represented.add(type))
  }
  return represented
}

function omissionTexts(coverage: AiChartD1P1Coverage): readonly string[] {
  return coverage.omittedItems.map((item) => `${item.item}\n${item.reason}`)
}

function hasOmissionTrace(
  texts: readonly string[],
  ...requiredTerms: readonly string[]
): boolean {
  return texts.some((text) =>
    requiredTerms.every((term) => text.includes(term)),
  )
}

function assertCoverageSourceBinding(
  result: AiChartD1P1Result,
  modelInput: AiChartD1P1ModelInput,
): void {
  const expected = expectedCoverageSources(modelInput)
  const directMeanings = assertStringCoverageSubset(
    result.coverage.directMeaningsConsidered,
    expected.targetMeaningIds,
  )
  const majorStars = assertStringCoverageSubset(
    result.coverage.majorStarsCovered,
    expected.targetMajorStars,
  )
  const minorStars = assertStringCoverageSubset(
    result.coverage.minorStarsCovered,
    expected.targetMinorStars,
  )
  const mutagenPairs = representedMutagenPairs(
    result.coverage.mutagensCovered,
    expected.targetMutagenPairs,
  )
  const maleficTypes = representedMaleficTypes(
    result.coverage.maleficsCovered,
    expected.relevantMaleficTypes,
    expected.maleficOpaqueIds,
  )
  const nobleStars = assertStringCoverageSubset(
    result.coverage.noblesCovered,
    expected.targetNobleStars,
  )
  const expectedMutagenPairKeys = new Set(
    expected.targetMutagenPairs.map((pair) => pair.key),
  )

  if (result.status === 'complete') {
    if (
      !setEquals(directMeanings, expected.targetMeaningIds) ||
      !setEquals(majorStars, expected.targetMajorStars) ||
      !setEquals(minorStars, expected.targetMinorStars) ||
      !setEquals(mutagenPairs, expectedMutagenPairKeys) ||
      !setEquals(maleficTypes, expected.relevantMaleficTypes) ||
      !setEquals(nobleStars, expected.targetNobleStars) ||
      !result.coverage.oppositeProcessed ||
      !result.coverage.hiddenCombinationProcessed ||
      !result.coverage.trinesProcessed ||
      result.coverage.omittedItems.length !== 0 ||
      result.warnings.length !== 0
    ) {
      resultInvalid()
    }
    return
  }

  if (
    (result.status !== 'partial' && result.status !== 'incomplete') ||
    result.coverage.omittedItems.length === 0
  ) {
    resultInvalid()
  }

  const omissions = omissionTexts(result.coverage)
  for (const meaningId of expected.targetMeaningIds) {
    if (!directMeanings.has(meaningId) && !hasOmissionTrace(omissions, meaningId)) {
      resultInvalid()
    }
  }
  for (const starName of expected.targetMajorStars) {
    if (!majorStars.has(starName) && !hasOmissionTrace(omissions, starName)) {
      resultInvalid()
    }
  }
  for (const starName of expected.targetMinorStars) {
    if (!minorStars.has(starName) && !hasOmissionTrace(omissions, starName)) {
      resultInvalid()
    }
  }
  for (const pair of expected.targetMutagenPairs) {
    if (
      !mutagenPairs.has(pair.key) &&
      !hasOmissionTrace(omissions, pair.starName, pair.mutagenType)
    ) {
      resultInvalid()
    }
  }
  for (const signalType of expected.relevantMaleficTypes) {
    if (
      !maleficTypes.has(signalType) &&
      !hasOmissionTrace(omissions, signalType)
    ) {
      resultInvalid()
    }
  }
  for (const starName of expected.targetNobleStars) {
    if (!nobleStars.has(starName) && !hasOmissionTrace(omissions, starName)) {
      resultInvalid()
    }
  }
}

function assertWarningTraceability(
  result: AiChartD1P1Result,
  modelInput: AiChartD1P1ModelInput,
): void {
  const traceText = [
    ...result.warnings,
    ...result.coverage.omittedItems.flatMap((item) => [item.item, item.reason]),
  ]
  if (
    modelInput.warnings.some(
      (warning) => !traceText.some((text) => text.includes(warning.code)),
    )
  ) {
    resultInvalid()
  }
}

function semanticText(result: AiChartD1P1Result): readonly string[] {
  return [
    result.primaryAxis.statement,
    ...allCandidates(result).flatMap((candidate) => [
      candidate.statement,
      ...candidate.lifeExamples,
      ...candidate.starBasis,
      ...candidate.usedRuleIds,
      ...(candidate.d2Boundary === null ? [] : [candidate.d2Boundary]),
    ]),
    ...result.tensions.flatMap((tension) => [
      tension.sideA,
      tension.sideB,
      tension.coexistenceExplanation,
    ]),
    ...result.d2Boundaries.flatMap((boundary) => [
      boundary.topic,
      boundary.prohibitedD1Conclusion,
      boundary.allowedD1Wording,
      boundary.reason,
    ]),
    ...result.coverage.omittedItems.flatMap((item) => [item.item, item.reason]),
  ]
}

function assertMetadataIsolation(
  result: AiChartD1P1Result,
  modelInput: AiChartD1P1ModelInput,
  promptPackage: AiChartD1P1PromptPackage,
): void {
  const auditValues = [
    modelInput.runId,
    modelInput.bundleId,
    modelInput.catalogId,
    modelInput.catalogFingerprint,
    modelInput.sourceManifestSha256,
    modelInput.inputFingerprint,
    promptPackage.packageFingerprint,
    promptPackage.instructionsSha256,
    promptPackage.userInputSha256,
    promptPackage.outputSchemaSha256,
  ]
  const text = semanticText(result)
  if (
    auditValues.some((auditValue) =>
      text.some((semanticValue) => semanticValue.includes(auditValue)),
    )
  ) {
    resultInvalid()
  }
}

function createAiChartD1P1SourceBoundResultParser(
  modelInput: AiChartD1P1ModelInput,
  promptPackage: AiChartD1P1PromptPackage,
): (value: unknown) => AiChartD1P1Result {
  return (value: unknown) => {
    try {
      const result = parseAiChartD1P1Result(value)
      assertIdentityAndStatus(result, modelInput)
      assertBorrowedStarBinding(result, modelInput)
      assertRulePalaceAndStarBindings(result, modelInput)
      assertCoverageSourceBinding(result, modelInput)
      assertWarningTraceability(result, modelInput)
      assertMetadataIsolation(result, modelInput, promptPackage)
      return freezeAiChartD1Value(result)
    } catch (error) {
      if (error instanceof AiChartD1P1AdapterBridgeResultInvalidError) {
        throw error
      }
      resultInvalid()
    }
  }
}

function buildOne(
  modelInput: AiChartD1P1ModelInput,
  promptPackage: AiChartD1P1PromptPackage,
): AiChartD1P1AdapterBridge {
  if (modelInput.structuralContext.targetPalace.borrowStatus === 'opposite_empty') {
    notReady()
  }
  const descriptor = buildDescriptor(modelInput, promptPackage)
  const request = validateAiChartOpenAiStructuredRequest<AiChartD1P1Result>({
    instructions: promptPackage.instructions,
    userInput: promptPackage.userInput,
    schemaName: promptPackage.outputSchemaName,
    description: AI_CHART_D1_P1_ADAPTER_BRIDGE_DESCRIPTION,
    schema: AI_CHART_D1_P1_OUTPUT_SCHEMA,
    parseResult: createAiChartD1P1SourceBoundResultParser(
      modelInput,
      promptPackage,
    ),
    reasoningEffort: AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
    timeoutMs: AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
    maxOutputTokens: AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS,
  })
  return Object.freeze({ descriptor, request })
}

function authenticateModelInput(
  value: unknown,
  catalogValue: unknown,
  structuralInputValue: unknown,
  knowledgeBundleValue: unknown,
): AiChartD1P1ModelInput {
  return parseAiChartD1P1ModelInput(
    value,
    catalogValue,
    structuralInputValue,
    knowledgeBundleValue,
  )
}

function assertFixedBridgeInvariants(
  bridges: readonly AiChartD1P1AdapterBridge[],
  modelInputs: readonly AiChartD1P1ModelInput[],
  promptPackages: readonly AiChartD1P1PromptPackage[],
): void {
  if (
    bridges.length !== 12 ||
    modelInputs.length !== 12 ||
    promptPackages.length !== 12 ||
    new Set(bridges.map((bridge) => bridge.descriptor.callId)).size !== 12 ||
    new Set(
      bridges.map((bridge) => bridge.descriptor.targetPalaceId),
    ).size !== 12 ||
    new Set(
      bridges.map((bridge) => bridge.descriptor.packageFingerprint),
    ).size !== 12 ||
    new Set(
      bridges.map((bridge) => bridge.descriptor.modelInputFingerprint),
    ).size !== 12 ||
    new Set(
      bridges.map((bridge) => bridge.descriptor.bridgeFingerprint),
    ).size !== 12 ||
    new Set(bridges.map((bridge) => bridge.descriptor.chartId)).size !== 1 ||
    new Set(bridges.map((bridge) => bridge.descriptor.runId)).size !== 1 ||
    new Set(bridges.map((bridge) => bridge.request.schemaName)).size !== 1 ||
    new Set(bridges.map((bridge) => bridge.request.reasoningEffort)).size !==
      1 ||
    new Set(bridges.map((bridge) => bridge.request.timeoutMs)).size !== 1 ||
    new Set(bridges.map((bridge) => bridge.request.maxOutputTokens)).size !== 1
  ) {
    invalid()
  }

  bridges.forEach((bridge, index) => {
    const descriptor = bridge.descriptor
    const request = bridge.request
    const modelInput = modelInputs[index]
    const promptPackage = promptPackages[index]
    if (
      descriptor.targetPalaceId !==
        AI_CHART_D1_PALACE_IDENTITIES[index].palaceId ||
      descriptor.callId !== modelInput.callId ||
      descriptor.targetPalaceId !== modelInput.targetPalaceId ||
      descriptor.packageFingerprint !== promptPackage.packageFingerprint ||
      descriptor.modelInputFingerprint !== modelInput.inputFingerprint ||
      descriptor.outputSchemaName !== AI_CHART_D1_P1_SCHEMA_NAME ||
      descriptor.outputSchemaSha256 !== AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256 ||
      descriptor.instructionsSha256 !==
        AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256 ||
      request.instructions !== promptPackage.instructions ||
      request.userInput !== promptPackage.userInput ||
      request.schemaName !== promptPackage.outputSchemaName ||
      request.description !== AI_CHART_D1_P1_ADAPTER_BRIDGE_DESCRIPTION ||
      request.reasoningEffort !== AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT ||
      request.timeoutMs !== AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS ||
      request.maxOutputTokens !==
        AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS ||
      typeof request.parseResult !== 'function' ||
      !stableAiChartD1P1AdapterBridgeDescriptorEqual(
        request.schema,
        AI_CHART_D1_P1_OUTPUT_SCHEMA,
      )
    ) {
      invalid()
    }
  })
}

export function buildAiChartD1P1AdapterBridge(
  catalogValue: unknown,
  structuralInputValue: unknown,
  knowledgeBundleValue: unknown,
  modelInputValue: unknown,
  promptPackageValue: unknown,
): AiChartD1P1AdapterBridge {
  try {
    assertAiChartD1SafeGraph(catalogValue)
    assertAiChartD1SafeGraph(structuralInputValue)
    assertAiChartD1SafeGraph(knowledgeBundleValue)
    assertAiChartD1SafeGraph(modelInputValue)
    assertAiChartD1SafeGraph(promptPackageValue)
    const modelInput = authenticateModelInput(
      modelInputValue,
      catalogValue,
      structuralInputValue,
      knowledgeBundleValue,
    )
    const promptPackage = parseAiChartD1P1PromptPackage(
      promptPackageValue,
      catalogValue,
      structuralInputValue,
      knowledgeBundleValue,
      modelInputValue,
    )
    return buildOne(modelInput, promptPackage)
  } catch (error) {
    rethrowBuildError(error)
  }
}

export function buildAiChartD1P1AdapterBridges(
  catalogValue: unknown,
  structuralInputValues: unknown,
  knowledgeBundleValues: unknown,
  modelInputValues: unknown,
  promptPackageValues: unknown,
): readonly AiChartD1P1AdapterBridge[] {
  try {
    assertAiChartD1SafeGraph(catalogValue)
    assertAiChartD1SafeGraph(structuralInputValues)
    assertAiChartD1SafeGraph(knowledgeBundleValues)
    assertAiChartD1SafeGraph(modelInputValues)
    assertAiChartD1SafeGraph(promptPackageValues)
    if (
      !Array.isArray(structuralInputValues) ||
      structuralInputValues.length !== 12 ||
      !Array.isArray(knowledgeBundleValues) ||
      knowledgeBundleValues.length !== 12 ||
      !Array.isArray(modelInputValues) ||
      modelInputValues.length !== 12 ||
      !Array.isArray(promptPackageValues) ||
      promptPackageValues.length !== 12
    ) {
      invalid()
    }

    const expectedPromptPackages = buildAiChartD1P1PromptPackages(
      catalogValue,
      structuralInputValues,
      knowledgeBundleValues,
      modelInputValues,
    )
    const modelInputs = modelInputValues.map((modelInput, index) =>
      authenticateModelInput(
        modelInput,
        catalogValue,
        structuralInputValues[index],
        knowledgeBundleValues[index],
      ),
    )
    const suppliedPromptPackages = promptPackageValues.map(
      (promptPackage, index) =>
        parseAiChartD1P1PromptPackage(
          promptPackage,
          catalogValue,
          structuralInputValues[index],
          knowledgeBundleValues[index],
          modelInputValues[index],
        ),
    )
    if (
      suppliedPromptPackages.some(
        (promptPackage, index) =>
          !stableAiChartD1P1PromptPackageEqual(
            promptPackage,
            expectedPromptPackages[index],
          ),
      )
    ) {
      invalid()
    }

    const bridges = Object.freeze(
      expectedPromptPackages.map((promptPackage, index) =>
        buildOne(modelInputs[index], promptPackage),
      ),
    )
    assertFixedBridgeInvariants(
      bridges,
      modelInputs,
      expectedPromptPackages,
    )
    return bridges
  } catch (error) {
    rethrowBuildError(error)
  }
}

export function parseAiChartD1P1AdapterBridgeDescriptor(
  descriptorValue: unknown,
  catalogValue: unknown,
  structuralInputValue: unknown,
  knowledgeBundleValue: unknown,
  modelInputValue: unknown,
  promptPackageValue: unknown,
): AiChartD1P1AdapterBridgeDescriptor {
  try {
    const modelInput = authenticateModelInput(
      modelInputValue,
      catalogValue,
      structuralInputValue,
      knowledgeBundleValue,
    )
    const promptPackage = parseAiChartD1P1PromptPackage(
      promptPackageValue,
      catalogValue,
      structuralInputValue,
      knowledgeBundleValue,
      modelInputValue,
    )
    const expected = buildDescriptor(modelInput, promptPackage)
    const supplied = parseAiChartD1P1AdapterBridgeDescriptorShape(
      descriptorValue,
    )
    if (!stableAiChartD1P1AdapterBridgeDescriptorEqual(supplied, expected)) {
      invalid()
    }
    const fingerprintPayload = structuredClone(supplied) as unknown as Record<
      string,
      unknown
    >
    delete fingerprintPayload.bridgeFingerprint
    if (
      supplied.bridgeFingerprint !==
      createAiChartD1P1AdapterBridgeFingerprint(
        fingerprintPayload as AiChartD1P1AdapterBridgeDescriptorWithoutFingerprint,
      )
    ) {
      invalid()
    }
    return freezeAiChartD1Value(supplied)
  } catch (error) {
    rethrowBuildError(error)
  }
}
