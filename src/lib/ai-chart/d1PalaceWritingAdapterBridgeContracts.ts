import { createHash } from 'node:crypto'
import {
  freezeAiChartD1Value,
} from './d1CommonContracts'
import {
  AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_PACKAGE_VERSION,
  AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_VERSION,
  AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_INSTRUCTIONS_SHA256,
  createAiChartD1PalaceWritingFidelityCanonicalJson,
  validateAiChartD1PalaceWritingFidelityPromptPackageAgainstSources,
  type AiChartD1PalaceWritingFidelityPromptPackage,
} from './d1PalaceWritingFidelityPromptPackageContracts'
import {
  AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_JSON_SCHEMA,
  AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_SCHEMA_NAME,
  AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_VERSION,
  validateAiChartD1PalaceWritingFidelityReviewAgainstSources,
  type AiChartD1PalaceWritingFidelityReview,
} from './d1PalaceWritingFidelityReviewContracts'
import {
  AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_VERSION,
  AI_CHART_D1_PALACE_WRITING_PROMPT_VERSION,
  createAiChartD1PalaceWritingCanonicalJson,
  parseAiChartD1PalaceWritingPromptPackage,
  type AiChartD1PalaceWritingPromptPackage,
} from './d1PalaceWritingPromptPackageContracts'
import {
  AI_CHART_D1_PALACE_WRITING_RESULT_JSON_SCHEMA,
  AI_CHART_D1_PALACE_WRITING_RESULT_SCHEMA_NAME,
  AI_CHART_D1_PALACE_WRITING_RESULT_VERSION,
  validateAiChartD1PalaceWritingResultAgainstPromptPackage,
  type AiChartD1PalaceWritingResult,
} from './d1PalaceWritingResultContracts'
import {
  AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS,
  AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
  AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
  validateAiChartOpenAiStructuredRequest,
  type ValidatedAiChartOpenAiStructuredRequest,
} from './openAiResponses'

export const AI_CHART_D1_PALACE_WRITING_ADAPTER_BRIDGE_VERSION =
  'ai-chart-d1-palace-writing-adapter-bridge/v1' as const
export const AI_CHART_D1_PALACE_WRITING_FIDELITY_ADAPTER_BRIDGE_VERSION =
  'ai-chart-d1-palace-writing-fidelity-adapter-bridge/v1' as const
export const AI_CHART_D1_PALACE_WRITING_ADAPTER_BRIDGE_DESCRIPTION =
  'D1 本命人格單宮客戶文字' as const
export const AI_CHART_D1_PALACE_WRITING_FIDELITY_ADAPTER_BRIDGE_DESCRIPTION =
  'D1 本命人格單宮寫作忠實度審查' as const
export const AI_CHART_D1_PALACE_WRITING_MAX_OUTPUT_TOKENS =
  AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS
export const AI_CHART_D1_PALACE_WRITING_REVIEW_MAX_OUTPUT_TOKENS =
  AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS

type AdapterStage = 'WRITING' | 'FIDELITY_REVIEW'

type AdapterDescriptorBase = Readonly<{
  stage: AdapterStage
  chartId: string
  runId: string
  callId: string
  targetPalaceId: string
  promptPackageFingerprint: string
  outputSchemaSha256: string
  instructionsSha256: string
  userInputSha256: string
  reasoningEffort:
    typeof AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT
  timeoutMs: typeof AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS
  requestStatus: 'ready'
  runtimeStatus: 'runtime_wiring_required'
  openAiCallable: false
  bridgeFingerprint: string
}>

export type AiChartD1PalaceWritingAdapterBridgeDescriptor =
  AdapterDescriptorBase &
    Readonly<{
      contractVersion:
        typeof AI_CHART_D1_PALACE_WRITING_ADAPTER_BRIDGE_VERSION
      task: 'D1_PALACE_WRITING_ADAPTER_BRIDGE'
      stage: 'WRITING'
      promptPackageContractVersion:
        typeof AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_VERSION
      promptVersion:
        typeof AI_CHART_D1_PALACE_WRITING_PROMPT_VERSION
      outputContractVersion:
        typeof AI_CHART_D1_PALACE_WRITING_RESULT_VERSION
      outputSchemaName:
        typeof AI_CHART_D1_PALACE_WRITING_RESULT_SCHEMA_NAME
      description:
        typeof AI_CHART_D1_PALACE_WRITING_ADAPTER_BRIDGE_DESCRIPTION
      maxOutputTokens:
        typeof AI_CHART_D1_PALACE_WRITING_MAX_OUTPUT_TOKENS
    }>

export type AiChartD1PalaceWritingFidelityAdapterBridgeDescriptor =
  AdapterDescriptorBase &
    Readonly<{
      contractVersion:
        typeof AI_CHART_D1_PALACE_WRITING_FIDELITY_ADAPTER_BRIDGE_VERSION
      task: 'D1_PALACE_WRITING_FIDELITY_ADAPTER_BRIDGE'
      stage: 'FIDELITY_REVIEW'
      promptPackageContractVersion:
        typeof AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_PACKAGE_VERSION
      promptVersion:
        typeof AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_VERSION
      sourceWritingPackageFingerprint: string
      sourceWritingResultSha256: string
      outputContractVersion:
        typeof AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_VERSION
      outputSchemaName:
        typeof AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_SCHEMA_NAME
      description:
        typeof AI_CHART_D1_PALACE_WRITING_FIDELITY_ADAPTER_BRIDGE_DESCRIPTION
      maxOutputTokens:
        typeof AI_CHART_D1_PALACE_WRITING_REVIEW_MAX_OUTPUT_TOKENS
    }>

export type AiChartD1PalaceWritingAdapterBridge = Readonly<{
  descriptor: AiChartD1PalaceWritingAdapterBridgeDescriptor
  request: ValidatedAiChartOpenAiStructuredRequest<AiChartD1PalaceWritingResult>
}>

export type AiChartD1PalaceWritingFidelityAdapterBridge =
  Readonly<{
    descriptor: AiChartD1PalaceWritingFidelityAdapterBridgeDescriptor
    request: ValidatedAiChartOpenAiStructuredRequest<AiChartD1PalaceWritingFidelityReview>
  }>

function sha256Canonical(
  value: unknown,
  canonicalJson: (input: unknown) => string,
): string {
  return createHash('sha256')
    .update(canonicalJson(value), 'utf8')
    .digest('hex')
}

function buildWritingDescriptor(
  promptPackage: AiChartD1PalaceWritingPromptPackage,
): AiChartD1PalaceWritingAdapterBridgeDescriptor {
  const outputSchemaSha256 = sha256Canonical(
    AI_CHART_D1_PALACE_WRITING_RESULT_JSON_SCHEMA,
    createAiChartD1PalaceWritingCanonicalJson,
  )
  const withoutFingerprint = {
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_ADAPTER_BRIDGE_VERSION,
    task: 'D1_PALACE_WRITING_ADAPTER_BRIDGE' as const,
    stage: 'WRITING' as const,
    chartId: promptPackage.chartId,
    runId: promptPackage.runId,
    callId: promptPackage.callId,
    targetPalaceId: promptPackage.targetPalaceId,
    promptPackageContractVersion:
      AI_CHART_D1_PALACE_WRITING_PROMPT_PACKAGE_VERSION,
    promptVersion: AI_CHART_D1_PALACE_WRITING_PROMPT_VERSION,
    promptPackageFingerprint: promptPackage.packageFingerprint,
    outputContractVersion:
      AI_CHART_D1_PALACE_WRITING_RESULT_VERSION,
    outputSchemaName:
      AI_CHART_D1_PALACE_WRITING_RESULT_SCHEMA_NAME,
    outputSchemaSha256,
    instructionsSha256: promptPackage.instructionsSha256,
    userInputSha256: promptPackage.userInputSha256,
    description:
      AI_CHART_D1_PALACE_WRITING_ADAPTER_BRIDGE_DESCRIPTION,
    reasoningEffort:
      AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
    timeoutMs: AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
    maxOutputTokens:
      AI_CHART_D1_PALACE_WRITING_MAX_OUTPUT_TOKENS,
    requestStatus: 'ready' as const,
    runtimeStatus: 'runtime_wiring_required' as const,
    openAiCallable: false as const,
  }
  return freezeAiChartD1Value({
    ...withoutFingerprint,
    bridgeFingerprint: sha256Canonical(
      withoutFingerprint,
      createAiChartD1PalaceWritingCanonicalJson,
    ),
  })
}

export function buildAiChartD1PalaceWritingAdapterBridge(
  promptPackageValue: unknown,
): AiChartD1PalaceWritingAdapterBridge {
  const promptPackage =
    parseAiChartD1PalaceWritingPromptPackage(
      promptPackageValue,
    )
  const descriptor = buildWritingDescriptor(promptPackage)
  const request = validateAiChartOpenAiStructuredRequest({
    instructions: promptPackage.instructions,
    userInput: promptPackage.userInput,
    schemaName: AI_CHART_D1_PALACE_WRITING_RESULT_SCHEMA_NAME,
    description:
      AI_CHART_D1_PALACE_WRITING_ADAPTER_BRIDGE_DESCRIPTION,
    schema: AI_CHART_D1_PALACE_WRITING_RESULT_JSON_SCHEMA,
    parseResult: (value: unknown) =>
      validateAiChartD1PalaceWritingResultAgainstPromptPackage(
        value,
        promptPackage,
      ),
    reasoningEffort:
      AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
    timeoutMs: AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
    maxOutputTokens:
      AI_CHART_D1_PALACE_WRITING_MAX_OUTPUT_TOKENS,
  })
  return Object.freeze({ descriptor, request })
}

function buildFidelityDescriptor(
  promptPackage: AiChartD1PalaceWritingFidelityPromptPackage,
): AiChartD1PalaceWritingFidelityAdapterBridgeDescriptor {
  const outputSchemaSha256 = sha256Canonical(
    AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_JSON_SCHEMA,
    createAiChartD1PalaceWritingFidelityCanonicalJson,
  )
  const withoutFingerprint = {
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_ADAPTER_BRIDGE_VERSION,
    task: 'D1_PALACE_WRITING_FIDELITY_ADAPTER_BRIDGE' as const,
    stage: 'FIDELITY_REVIEW' as const,
    chartId: promptPackage.chartId,
    runId: promptPackage.runId,
    callId: promptPackage.callId,
    targetPalaceId: promptPackage.targetPalaceId,
    promptPackageContractVersion:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_PACKAGE_VERSION,
    promptVersion:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_VERSION,
    promptPackageFingerprint: promptPackage.packageFingerprint,
    sourceWritingPackageFingerprint:
      promptPackage.sourcePackageFingerprint,
    sourceWritingResultSha256:
      promptPackage.sourceWritingResultSha256,
    outputContractVersion:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_VERSION,
    outputSchemaName:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_SCHEMA_NAME,
    outputSchemaSha256,
    instructionsSha256:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_PROMPT_INSTRUCTIONS_SHA256,
    userInputSha256: promptPackage.userInputSha256,
    description:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_ADAPTER_BRIDGE_DESCRIPTION,
    reasoningEffort:
      AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
    timeoutMs: AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
    maxOutputTokens:
      AI_CHART_D1_PALACE_WRITING_REVIEW_MAX_OUTPUT_TOKENS,
    requestStatus: 'ready' as const,
    runtimeStatus: 'runtime_wiring_required' as const,
    openAiCallable: false as const,
  }
  return freezeAiChartD1Value({
    ...withoutFingerprint,
    bridgeFingerprint: sha256Canonical(
      withoutFingerprint,
      createAiChartD1PalaceWritingFidelityCanonicalJson,
    ),
  })
}

export function buildAiChartD1PalaceWritingFidelityAdapterBridge(
  fidelityPromptPackageValue: unknown,
  writingPromptPackageValue: unknown,
  writingResultValue: unknown,
): AiChartD1PalaceWritingFidelityAdapterBridge {
  const writingPromptPackage =
    parseAiChartD1PalaceWritingPromptPackage(
      writingPromptPackageValue,
    )
  const writingResult =
    validateAiChartD1PalaceWritingResultAgainstPromptPackage(
      writingResultValue,
      writingPromptPackage,
    )
  const fidelityPromptPackage =
    validateAiChartD1PalaceWritingFidelityPromptPackageAgainstSources(
      fidelityPromptPackageValue,
      writingPromptPackage,
      writingResult,
    )
  const descriptor = buildFidelityDescriptor(
    fidelityPromptPackage,
  )
  const request = validateAiChartOpenAiStructuredRequest({
    instructions: fidelityPromptPackage.instructions,
    userInput: fidelityPromptPackage.userInput,
    schemaName:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_SCHEMA_NAME,
    description:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_ADAPTER_BRIDGE_DESCRIPTION,
    schema:
      AI_CHART_D1_PALACE_WRITING_FIDELITY_REVIEW_JSON_SCHEMA,
    parseResult: (value: unknown) =>
      validateAiChartD1PalaceWritingFidelityReviewAgainstSources(
        value,
        writingResult,
        writingPromptPackage,
      ),
    reasoningEffort:
      AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
    timeoutMs: AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
    maxOutputTokens:
      AI_CHART_D1_PALACE_WRITING_REVIEW_MAX_OUTPUT_TOKENS,
  })
  return Object.freeze({ descriptor, request })
}
