import {
  AI_CHART_D1_P1_F1_CONTRACT_VERSION,
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
} from './d1CommonContracts'
import type {
  AiChartD1K0Catalog,
  AiChartD1K0P1Bundle,
} from './d1K0Contracts'
import { AI_CHART_D1_PALACE_IDENTITIES } from './d1N0Constants'
import type { AiChartD1P1StructuralInput } from './d1P1InputContracts'
import {
  buildAiChartD1P1ModelInputs,
  parseAiChartD1P1ModelInput,
} from './d1P1ModelInputBindings'
import {
  AI_CHART_D1_P1_MODEL_INPUT_CONTRACT_VERSION,
  AiChartD1P1ModelInputError,
  AiChartD1P1ModelInputNotReadyError,
  stableAiChartD1P1ModelInputEqual,
  type AiChartD1P1ModelInput,
} from './d1P1ModelInputContracts'
import {
  AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256,
  AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256,
  AI_CHART_D1_P1_PROMPT_PACKAGE_CONTRACT_VERSION,
  AI_CHART_D1_P1_PROMPT_PACKAGE_TASK,
  AI_CHART_D1_P1_PROMPT_VERSION,
  AiChartD1P1PromptPackageBudgetExceededError,
  AiChartD1P1PromptPackageError,
  AiChartD1P1PromptPackageNotReadyError,
  createAiChartD1P1PromptPackageBudget,
  createAiChartD1P1PromptPackageFingerprint,
  createAiChartD1P1PromptUserInput,
  hashAiChartD1P1PromptPackageValue,
  parseAiChartD1P1PromptPackageShape,
  stableAiChartD1P1PromptPackageEqual,
  type AiChartD1P1PromptPackage,
  type AiChartD1P1PromptPackageSourceTrace,
  type AiChartD1P1PromptPackageWithoutFingerprint,
} from './d1P1PromptPackageContracts'
import { AI_CHART_D1_P1_PROMPT_INSTRUCTIONS } from './d1P1PromptInstructions'
import { AI_CHART_D1_P1_SCHEMA_NAME } from './d1P1F1Contracts'

function invalid(): never {
  throw new AiChartD1P1PromptPackageError()
}

function notReady(): never {
  throw new AiChartD1P1PromptPackageNotReadyError()
}

function rethrowSafe(error: unknown): never {
  if (error instanceof AiChartD1P1PromptPackageBudgetExceededError) throw error
  if (error instanceof AiChartD1P1PromptPackageNotReadyError) throw error
  if (error instanceof AiChartD1P1PromptPackageError) throw error
  if (error instanceof AiChartD1P1ModelInputNotReadyError) notReady()
  if (error instanceof AiChartD1P1ModelInputError) invalid()
  invalid()
}

function sourceTraceFor(
  modelInput: AiChartD1P1ModelInput,
): AiChartD1P1PromptPackageSourceTrace {
  return freezeAiChartD1Value({
    modelInputFingerprint: modelInput.inputFingerprint,
    ruleIds: modelInput.knowledgeContext.rules.map((rule) => rule.ruleId),
    meaningReferences: modelInput.knowledgeContext.meanings.map(
      (meaning) => `${meaning.palaceRole}:${meaning.meaningId}`,
    ),
    selectionTraceRuleIds: modelInput.knowledgeContext.selectionTrace.map(
      (trace) => trace.ruleId,
    ),
  })
}

function buildOne(
  modelInput: AiChartD1P1ModelInput,
): AiChartD1P1PromptPackage {
  const userInput = createAiChartD1P1PromptUserInput(modelInput)
  const withoutFingerprint: AiChartD1P1PromptPackageWithoutFingerprint = {
    contractVersion: AI_CHART_D1_P1_PROMPT_PACKAGE_CONTRACT_VERSION,
    promptVersion: AI_CHART_D1_P1_PROMPT_VERSION,
    task: AI_CHART_D1_P1_PROMPT_PACKAGE_TASK,
    chartId: modelInput.chartId,
    runId: modelInput.runId,
    callId: modelInput.callId,
    targetPalaceId: modelInput.targetPalaceId,
    bundleId: modelInput.bundleId,
    catalogId: modelInput.catalogId,
    catalogFingerprint: modelInput.catalogFingerprint,
    sourceManifestSha256: modelInput.sourceManifestSha256,
    modelInputContractVersion: AI_CHART_D1_P1_MODEL_INPUT_CONTRACT_VERSION,
    modelInputFingerprint: modelInput.inputFingerprint,
    outputContractVersion: AI_CHART_D1_P1_F1_CONTRACT_VERSION,
    outputSchemaName: AI_CHART_D1_P1_SCHEMA_NAME,
    outputSchemaSha256: AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256,
    instructions: AI_CHART_D1_P1_PROMPT_INSTRUCTIONS,
    instructionsSha256: AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256,
    userInput,
    userInputSha256: hashAiChartD1P1PromptPackageValue(userInput),
    sourceTrace: sourceTraceFor(modelInput),
    budget: createAiChartD1P1PromptPackageBudget(
      AI_CHART_D1_P1_PROMPT_INSTRUCTIONS,
      userInput,
    ),
    promptStatus: 'ready',
    adapterStatus: 'adapter_bridge_required',
    openAiCallable: false,
  }
  return freezeAiChartD1Value({
    ...withoutFingerprint,
    packageFingerprint:
      createAiChartD1P1PromptPackageFingerprint(withoutFingerprint),
  })
}

function withoutFingerprint(
  promptPackage: AiChartD1P1PromptPackage,
): AiChartD1P1PromptPackageWithoutFingerprint {
  const value = structuredClone(promptPackage) as unknown as Record<
    string,
    unknown
  >
  delete value.packageFingerprint
  return value as AiChartD1P1PromptPackageWithoutFingerprint
}

function authenticateModelInput(
  modelInputValue: unknown,
  catalogValue: unknown,
  structuralInputValue: unknown,
  knowledgeBundleValue: unknown,
): AiChartD1P1ModelInput {
  return parseAiChartD1P1ModelInput(
    modelInputValue,
    catalogValue,
    structuralInputValue,
    knowledgeBundleValue,
  )
}

export function parseAiChartD1P1PromptPackage(
  packageValue: unknown,
  catalogValue: unknown,
  structuralInputValue: unknown,
  knowledgeBundleValue: unknown,
  modelInputValue: unknown,
): AiChartD1P1PromptPackage {
  try {
    assertAiChartD1SafeGraph(packageValue)
    assertAiChartD1SafeGraph(modelInputValue)
    const modelInput = authenticateModelInput(
      modelInputValue,
      catalogValue,
      structuralInputValue,
      knowledgeBundleValue,
    )
    const expected = buildOne(modelInput)
    const supplied = parseAiChartD1P1PromptPackageShape(packageValue)
    if (!stableAiChartD1P1PromptPackageEqual(supplied, expected)) invalid()
    if (
      supplied.packageFingerprint !==
      createAiChartD1P1PromptPackageFingerprint(withoutFingerprint(supplied))
    ) {
      invalid()
    }
    return freezeAiChartD1Value(supplied)
  } catch (error) {
    rethrowSafe(error)
  }
}

function authenticateFixedModelInputs(
  catalogValue: unknown,
  structuralInputValues: unknown,
  knowledgeBundleValues: unknown,
  modelInputValues: unknown,
): readonly AiChartD1P1ModelInput[] {
  if (
    !Array.isArray(structuralInputValues) ||
    structuralInputValues.length !== 12 ||
    !Array.isArray(knowledgeBundleValues) ||
    knowledgeBundleValues.length !== 12 ||
    !Array.isArray(modelInputValues) ||
    modelInputValues.length !== 12
  ) {
    invalid()
  }

  const expected = buildAiChartD1P1ModelInputs(
    catalogValue,
    structuralInputValues,
    knowledgeBundleValues,
  )
  const supplied = modelInputValues.map((modelInput, index) =>
    authenticateModelInput(
      modelInput,
      catalogValue,
      structuralInputValues[index],
      knowledgeBundleValues[index],
    ),
  )
  if (
    supplied.some(
      (modelInput, index) =>
        !stableAiChartD1P1ModelInputEqual(modelInput, expected[index]),
    )
  ) {
    invalid()
  }
  return expected
}

function assertFixedPackageInvariants(
  promptPackages: readonly AiChartD1P1PromptPackage[],
  modelInputs: readonly AiChartD1P1ModelInput[],
): void {
  if (
    promptPackages.length !== 12 ||
    modelInputs.length !== 12 ||
    new Set(promptPackages.map((entry) => entry.callId)).size !== 12 ||
    new Set(promptPackages.map((entry) => entry.bundleId)).size !== 12 ||
    new Set(promptPackages.map((entry) => entry.chartId)).size !== 1 ||
    new Set(promptPackages.map((entry) => entry.runId)).size !== 1 ||
    new Set(promptPackages.map((entry) => entry.targetPalaceId)).size !== 12 ||
    new Set(promptPackages.map((entry) => entry.modelInputFingerprint)).size !==
      12 ||
    new Set(promptPackages.map((entry) => entry.packageFingerprint)).size !==
      12 ||
    new Set(promptPackages.map((entry) => entry.promptVersion)).size !== 1 ||
    new Set(promptPackages.map((entry) => entry.outputContractVersion)).size !==
      1 ||
    new Set(promptPackages.map((entry) => entry.outputSchemaName)).size !== 1 ||
    new Set(promptPackages.map((entry) => entry.outputSchemaSha256)).size !== 1
  ) {
    invalid()
  }

  promptPackages.forEach((entry, index) => {
    const modelInput = modelInputs[index]
    if (
      entry.targetPalaceId !==
        AI_CHART_D1_PALACE_IDENTITIES[index].palaceId ||
      entry.callId !== modelInput.callId ||
      entry.bundleId !== modelInput.bundleId ||
      entry.targetPalaceId !== modelInput.targetPalaceId ||
      entry.modelInputFingerprint !== modelInput.inputFingerprint ||
      entry.outputSchemaSha256 !== AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256
    ) {
      invalid()
    }
  })
}

export function buildAiChartD1P1PromptPackages(
  catalogValue: unknown,
  structuralInputValues: unknown,
  knowledgeBundleValues: unknown,
  modelInputValues: unknown,
): readonly AiChartD1P1PromptPackage[] {
  try {
    assertAiChartD1SafeGraph(catalogValue)
    assertAiChartD1SafeGraph(structuralInputValues)
    assertAiChartD1SafeGraph(knowledgeBundleValues)
    assertAiChartD1SafeGraph(modelInputValues)
    const modelInputs = authenticateFixedModelInputs(
      catalogValue,
      structuralInputValues,
      knowledgeBundleValues,
      modelInputValues,
    )
    const promptPackages = Object.freeze(modelInputs.map(buildOne))
    assertFixedPackageInvariants(promptPackages, modelInputs)
    return promptPackages
  } catch (error) {
    rethrowSafe(error)
  }
}

export type AiChartD1P1PromptPackageSources = Readonly<{
  catalog: AiChartD1K0Catalog
  structuralInputs: readonly AiChartD1P1StructuralInput[]
  knowledgeBundles: readonly AiChartD1K0P1Bundle[]
  modelInputs: readonly AiChartD1P1ModelInput[]
}>
