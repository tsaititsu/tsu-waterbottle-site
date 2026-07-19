import {
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  type AiChartD1Candidate,
} from './d1CommonContracts'
import { AI_CHART_D1_PALACE_IDENTITIES } from './d1N0Constants'
import {
  parseAiChartD1P1ModelInput,
} from './d1P1ModelInputBindings'
import {
  AiChartD1P1ModelInputError,
  AiChartD1P1ModelInputNotReadyError,
  type AiChartD1P1ModelInput,
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

function assertCandidateSourceBinding(
  candidate: AiChartD1Candidate,
  allowedRuleIds: ReadonlySet<string>,
  allowedPalaceIds: ReadonlySet<string>,
  allowedStarNames: ReadonlySet<string>,
): void {
  if (
    hasDuplicates(candidate.usedRuleIds) ||
    candidate.usedRuleIds.some((ruleId) => !allowedRuleIds.has(ruleId)) ||
    hasDuplicates(candidate.palaceIds) ||
    candidate.palaceIds.some((palaceId) => !allowedPalaceIds.has(palaceId)) ||
    hasDuplicates(candidate.starBasis) ||
    candidate.starBasis.some((starName) => !allowedStarNames.has(starName)) ||
    hasDuplicates(candidate.structureBasis) ||
    candidate.structureBasis.some(
      (structure) => !P1_ALLOWED_STRUCTURE_BASES.has(structure),
    )
  ) {
    resultInvalid()
  }
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

  if (
    result.status === 'complete' &&
    (!result.coverage.oppositeProcessed ||
      !result.coverage.hiddenCombinationProcessed ||
      !result.coverage.trinesProcessed ||
      result.coverage.omittedItems.length !== 0 ||
      result.warnings.length !== 0)
  ) {
    resultInvalid()
  }

  if (
    (result.status === 'partial' || result.status === 'incomplete') &&
    result.coverage.omittedItems.length === 0
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

function assertRulePalaceAndStarBindings(
  result: AiChartD1P1Result,
  modelInput: AiChartD1P1ModelInput,
): void {
  const allowedRuleIds = new Set(
    modelInput.knowledgeContext.rules.map((rule) => rule.ruleId),
  )
  const palaces = structuralPalaces(modelInput)
  const allowedPalaceIds = new Set(palaces.map((palace) => palace.palaceId))
  const allowedStarNames = new Set(
    palaces.flatMap((palace) => [
      ...palace.canonicalMajorStars.map((star) => star.name),
      ...palace.borrowedMajorStars.map((star) => star.name),
      ...palace.modeledSupportingStars.map((star) => star.name),
    ]),
  )

  if (
    result.primaryAxis.usedRuleIds.length === 0 ||
    hasDuplicates(result.primaryAxis.usedRuleIds) ||
    result.primaryAxis.usedRuleIds.some(
      (ruleId) => !allowedRuleIds.has(ruleId),
    )
  ) {
    resultInvalid()
  }

  for (const candidate of allCandidates(result)) {
    assertCandidateSourceBinding(
      candidate,
      allowedRuleIds,
      allowedPalaceIds,
      allowedStarNames,
    )
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
