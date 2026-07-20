import 'server-only'

import {
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import { AI_CHART_D1_MODEL_TARGET } from './d1Assets'
import {
  AI_CHART_D1_PALACE_IDENTITIES,
  type AiChartD1PalaceId,
} from './d1N0Constants'
import {
  buildAiChartD1P1AdapterBridges,
  type AiChartD1P1AdapterBridge,
} from './d1P1AdapterBridge'
import {
  AI_CHART_D1_P1_ADAPTER_BRIDGE_CONTRACT_VERSION,
  AiChartD1P1AdapterBridgeNotReadyError,
} from './d1P1AdapterBridgeContracts'
import { parseAiChartD1P1ModelInput } from './d1P1ModelInputBindings'
import {
  AiChartD1P1ModelInputNotReadyError,
} from './d1P1ModelInputContracts'
import {
  AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256,
  AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256,
  AI_CHART_D1_P1_PROMPT_VERSION,
} from './d1P1PromptPackageContracts'
import {
  AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_ACKNOWLEDGEMENT,
  AI_CHART_D1_P1_PREVIEW_GATE_CONTRACT_VERSION,
  AI_CHART_D1_P1_PREVIEW_GATE_DISABLED,
  AI_CHART_D1_P1_PREVIEW_GATE_INVALID,
  AI_CHART_D1_P1_PREVIEW_GATE_NOT_READY,
  AI_CHART_D1_P1_PREVIEW_GATE_PRODUCTION_FORBIDDEN,
  AI_CHART_D1_P1_PREVIEW_GATE_REQUEST_MODE,
  AI_CHART_D1_P1_PREVIEW_GATE_TASK,
  AiChartD1P1PreviewGateError,
  createAiChartD1P1PreviewRequestPlanFingerprint,
  parseAiChartD1P1PreviewAuthorization,
  parseAiChartD1P1PreviewRequestPlanShape,
  stableAiChartD1P1PreviewRequestPlanEqual,
  type AiChartD1P1PreviewAuthorization,
  type AiChartD1P1PreviewRequestPlan,
  type AiChartD1P1PreviewRequestPlanWithoutFingerprint,
} from './d1P1PreviewRequestGateContracts'
import {
  AI_CHART_D1_P1_SCHEMA_NAME,
  type AiChartD1P1Result,
} from './d1P1F1Contracts'
import {
  AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS,
  AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
  AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
  AI_CHART_OPENAI_RESPONSE_INVALID,
  AiChartOpenAiError,
  type AiChartOpenAiStructuredRequest,
  type AiChartOpenAiStructuredResult,
  type AiChartOpenAiUsage,
} from './openAiResponses'
import {
  requestAiChartOpenAiStructuredResponse,
} from './openAiResponses.server'

type AiChartD1P1PreviewRequestImplementation = (
  request: AiChartOpenAiStructuredRequest<AiChartD1P1Result>,
) => Promise<AiChartOpenAiStructuredResult<AiChartD1P1Result>>

type AiChartD1P1PreviewRequestGateDependencies = Readonly<{
  environment: Readonly<Record<string, string | undefined>>
  requestImplementation: AiChartD1P1PreviewRequestImplementation
}>

export type AiChartD1P1PreviewExecutionResult = Readonly<{
  plan: AiChartD1P1PreviewRequestPlan
  data: AiChartD1P1Result
  usage: AiChartOpenAiUsage | null
  executedRequests: 1
}>

type AuthenticatedPlan = Readonly<{
  plan: AiChartD1P1PreviewRequestPlan
  bridge: AiChartD1P1AdapterBridge
}>

const PALACE_IDS = new Set(
  AI_CHART_D1_PALACE_IDENTITIES.map((identity) => identity.palaceId),
)

function invalid(): never {
  throw new AiChartD1P1PreviewGateError(
    AI_CHART_D1_P1_PREVIEW_GATE_INVALID,
  )
}

function disabled(): never {
  throw new AiChartD1P1PreviewGateError(
    AI_CHART_D1_P1_PREVIEW_GATE_DISABLED,
  )
}

function notReady(): never {
  throw new AiChartD1P1PreviewGateError(
    AI_CHART_D1_P1_PREVIEW_GATE_NOT_READY,
  )
}

function productionForbidden(): never {
  throw new AiChartD1P1PreviewGateError(
    AI_CHART_D1_P1_PREVIEW_GATE_PRODUCTION_FORBIDDEN,
  )
}

function rethrowGateInvalid(error: unknown): never {
  if (error instanceof AiChartD1P1PreviewGateError) throw error
  if (
    error instanceof AiChartD1P1AdapterBridgeNotReadyError ||
    error instanceof AiChartD1P1ModelInputNotReadyError
  ) {
    notReady()
  }
  invalid()
}

function responseInvalid(): never {
  throw new AiChartOpenAiError(
    AI_CHART_OPENAI_RESPONSE_INVALID,
    false,
  )
}

function parseTargetPalaceId(value: unknown): AiChartD1PalaceId {
  if (typeof value !== 'string' || !PALACE_IDS.has(value as AiChartD1PalaceId)) {
    invalid()
  }
  return value as AiChartD1PalaceId
}

function planWithoutFingerprint(
  bridge: AiChartD1P1AdapterBridge,
): AiChartD1P1PreviewRequestPlanWithoutFingerprint {
  const descriptor = bridge.descriptor
  return {
    contractVersion: AI_CHART_D1_P1_PREVIEW_GATE_CONTRACT_VERSION,
    task: AI_CHART_D1_P1_PREVIEW_GATE_TASK,
    requestMode: AI_CHART_D1_P1_PREVIEW_GATE_REQUEST_MODE,
    chartId: descriptor.chartId,
    runId: descriptor.runId,
    callId: descriptor.callId,
    targetPalaceId: descriptor.targetPalaceId,
    adapterBridgeContractVersion:
      AI_CHART_D1_P1_ADAPTER_BRIDGE_CONTRACT_VERSION,
    bridgeFingerprint: descriptor.bridgeFingerprint,
    packageFingerprint: descriptor.packageFingerprint,
    modelInputFingerprint: descriptor.modelInputFingerprint,
    promptVersion: AI_CHART_D1_P1_PROMPT_VERSION,
    instructionsSha256: AI_CHART_D1_P1_PROMPT_INSTRUCTIONS_SHA256,
    outputContractVersion: descriptor.outputContractVersion,
    outputSchemaName: AI_CHART_D1_P1_SCHEMA_NAME,
    outputSchemaSha256: AI_CHART_D1_P1_OUTPUT_SCHEMA_SHA256,
    modelTarget: AI_CHART_D1_MODEL_TARGET,
    reasoningEffort: AI_CHART_OPENAI_DEFAULT_REASONING_EFFORT,
    timeoutMs: AI_CHART_OPENAI_DEFAULT_TIMEOUT_MS,
    maxOutputTokens: AI_CHART_OPENAI_DEFAULT_MAX_OUTPUT_TOKENS,
    maxRequests: 1,
    serverOnly: true,
    environmentPolicy: 'local_development_only',
    authorizationStatus: 'authorization_required',
    routeStatus: 'route_forbidden',
    persistenceStatus: 'persistence_forbidden',
    runtimeStatus: 'preview_gate_only',
    productionCallable: false,
  }
}

function createPlan(
  bridge: AiChartD1P1AdapterBridge,
): AiChartD1P1PreviewRequestPlan {
  const withoutFingerprint = planWithoutFingerprint(bridge)
  return freezeAiChartD1Value({
    ...withoutFingerprint,
    planFingerprint:
      createAiChartD1P1PreviewRequestPlanFingerprint(withoutFingerprint),
  })
}

function assertReadyTargetModelInput(
  catalogValue: unknown,
  structuralInputValues: unknown,
  knowledgeBundleValues: unknown,
  modelInputValues: unknown,
  targetPalaceId: AiChartD1PalaceId,
): void {
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

  const index = AI_CHART_D1_PALACE_IDENTITIES.findIndex(
    (identity) => identity.palaceId === targetPalaceId,
  )
  if (index < 0) invalid()

  const modelInput = parseAiChartD1P1ModelInput(
    modelInputValues[index],
    catalogValue,
    structuralInputValues[index],
    knowledgeBundleValues[index],
  )
  const target = modelInput.structuralContext.targetPalace
  const effectiveMajorStars = (
    target.borrowStatus === 'eligible_and_borrowed'
      ? target.borrowedMajorStars
      : target.canonicalMajorStars
  ).map((star) => star.name)

  if (effectiveMajorStars.length === 0) notReady()
  if (new Set(effectiveMajorStars).size !== effectiveMajorStars.length) {
    invalid()
  }
}

function buildAuthenticatedPlan(
  planValue: unknown | undefined,
  catalogValue: unknown,
  structuralInputValues: unknown,
  knowledgeBundleValues: unknown,
  modelInputValues: unknown,
  promptPackageValues: unknown,
  targetPalaceIdValue: unknown,
): AuthenticatedPlan {
  try {
    const targetPalaceId = parseTargetPalaceId(targetPalaceIdValue)
    const bridges = buildAiChartD1P1AdapterBridges(
      catalogValue,
      structuralInputValues,
      knowledgeBundleValues,
      modelInputValues,
      promptPackageValues,
    )
    const matches = bridges.filter(
      (bridge) => bridge.descriptor.targetPalaceId === targetPalaceId,
    )
    if (bridges.length !== 12 || matches.length !== 1) invalid()

    const bridge = matches[0]
    assertReadyTargetModelInput(
      catalogValue,
      structuralInputValues,
      knowledgeBundleValues,
      modelInputValues,
      targetPalaceId,
    )
    const expected = createPlan(bridge)
    if (planValue === undefined) {
      return freezeAiChartD1Value({ plan: expected, bridge })
    }

    const supplied = parseAiChartD1P1PreviewRequestPlanShape(planValue)
    const payload = structuredClone(supplied) as unknown as Record<
      string,
      unknown
    >
    delete payload.planFingerprint
    if (
      supplied.planFingerprint !==
        createAiChartD1P1PreviewRequestPlanFingerprint(
          payload as AiChartD1P1PreviewRequestPlanWithoutFingerprint,
        ) ||
      !stableAiChartD1P1PreviewRequestPlanEqual(supplied, expected)
    ) {
      invalid()
    }

    return freezeAiChartD1Value({ plan: supplied, bridge })
  } catch (error) {
    rethrowGateInvalid(error)
  }
}

export function buildAiChartD1P1PreviewRequestPlan(
  catalogValue: unknown,
  structuralInputValues: unknown,
  knowledgeBundleValues: unknown,
  modelInputValues: unknown,
  promptPackageValues: unknown,
  targetPalaceId: unknown,
): AiChartD1P1PreviewRequestPlan {
  return buildAuthenticatedPlan(
    undefined,
    catalogValue,
    structuralInputValues,
    knowledgeBundleValues,
    modelInputValues,
    promptPackageValues,
    targetPalaceId,
  ).plan
}

export function parseAiChartD1P1PreviewRequestPlan(
  planValue: unknown,
  catalogValue: unknown,
  structuralInputValues: unknown,
  knowledgeBundleValues: unknown,
  modelInputValues: unknown,
  promptPackageValues: unknown,
  targetPalaceId: unknown,
): AiChartD1P1PreviewRequestPlan {
  return buildAuthenticatedPlan(
    planValue,
    catalogValue,
    structuralInputValues,
    knowledgeBundleValues,
    modelInputValues,
    promptPackageValues,
    targetPalaceId,
  ).plan
}

function ownDataValue(
  value: object,
  key: string,
): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
    invalid()
  }
  return descriptor.value
}

function environmentBindings(planValue: unknown): Readonly<{
  targetPalaceId: string
  planFingerprint: string
}> {
  try {
    assertAiChartD1SafeGraph(planValue)
    if (typeof planValue !== 'object' || planValue === null) invalid()
    const targetPalaceId = ownDataValue(planValue, 'targetPalaceId')
    const planFingerprint = ownDataValue(planValue, 'planFingerprint')
    if (typeof targetPalaceId !== 'string' || typeof planFingerprint !== 'string') {
      invalid()
    }
    return Object.freeze({ targetPalaceId, planFingerprint })
  } catch (error) {
    rethrowGateInvalid(error)
  }
}

function validateTestDependencies(
  value: AiChartD1P1PreviewRequestGateDependencies | undefined,
): AiChartD1P1PreviewRequestGateDependencies | undefined {
  if (value === undefined) return undefined
  if (process.env.NODE_ENV !== 'test') invalid()
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid()
  }
  const keys = Reflect.ownKeys(value)
  if (
    keys.length !== 2 ||
    keys.some(
      (key) =>
        typeof key !== 'string' ||
        !['environment', 'requestImplementation'].includes(key),
    )
  ) {
    invalid()
  }
  const environment = ownDataValue(value, 'environment')
  const requestImplementation = ownDataValue(value, 'requestImplementation')
  if (
    typeof environment !== 'object' ||
    environment === null ||
    Array.isArray(environment) ||
    typeof requestImplementation !== 'function'
  ) {
    invalid()
  }
  for (const key of Reflect.ownKeys(environment)) {
    if (typeof key !== 'string') invalid()
    const entry = ownDataValue(environment, key)
    if (entry !== undefined && typeof entry !== 'string') invalid()
  }
  return value
}

function assertEnvironmentPolicy(
  planValue: unknown,
  dependencies: AiChartD1P1PreviewRequestGateDependencies | undefined,
): Readonly<{
  requestImplementation: AiChartD1P1PreviewRequestImplementation
}> {
  const bindings = environmentBindings(planValue)
  const testDependencies = validateTestDependencies(dependencies)
  const environment = testDependencies?.environment ?? process.env

  if (
    environment.NODE_ENV === 'production' ||
    environment.CI === 'true' ||
    environment.CI === '1' ||
    environment.VERCEL !== undefined ||
    environment.VERCEL_ENV !== undefined
  ) {
    productionForbidden()
  }
  if (environment.NODE_ENV !== 'development') disabled()
  if (
    environment.AI_CHART_D1_P1_PREVIEW_ENABLED !== '1' ||
    environment.AI_CHART_D1_P1_PREVIEW_TARGET_PALACE_ID !==
      bindings.targetPalaceId ||
    environment.AI_CHART_D1_P1_PREVIEW_PLAN_FINGERPRINT !==
      bindings.planFingerprint ||
    environment.AI_CHART_D1_P1_PREVIEW_CONFIRM !==
      AI_CHART_D1_P1_PREVIEW_AUTHORIZATION_ACKNOWLEDGEMENT
  ) {
    disabled()
  }

  return Object.freeze({
    requestImplementation:
      testDependencies?.requestImplementation ??
      requestAiChartOpenAiStructuredResponse,
  })
}

const PREVIEW_RESPONSE_FIELDS = Object.freeze(['data', 'usage'] as const)
const USAGE_FIELDS = Object.freeze([
  'inputTokens',
  'outputTokens',
  'reasoningTokens',
  'totalTokens',
] as const)

function parseUsage(value: unknown): AiChartOpenAiUsage | null {
  if (value === null) return null
  try {
    const record = requireAiChartD1ExactObject(value, USAGE_FIELDS)
    const parsed = Object.fromEntries(
      USAGE_FIELDS.map((field) => {
        const tokenCount = record[field]
        if (
          typeof tokenCount !== 'number' ||
          !Number.isFinite(tokenCount) ||
          !Number.isInteger(tokenCount) ||
          tokenCount < 0
        ) {
          responseInvalid()
        }
        return [field, tokenCount]
      }),
    ) as unknown as AiChartOpenAiUsage
    return freezeAiChartD1Value(parsed)
  } catch (error) {
    if (error instanceof AiChartOpenAiError) throw error
    responseInvalid()
  }
}

function parseAiChartD1P1PreviewExecutionResponse(
  value: unknown,
  bridge: AiChartD1P1AdapterBridge,
): Readonly<{
  data: AiChartD1P1Result
  usage: AiChartOpenAiUsage | null
}> {
  let record: Record<string, unknown>
  try {
    assertAiChartD1SafeGraph(value)
    record = requireAiChartD1ExactObject(value, PREVIEW_RESPONSE_FIELDS)
  } catch {
    responseInvalid()
  }

  const data = bridge.request.parseResult(record.data)
  const usage = parseUsage(record.usage)
  return freezeAiChartD1Value({ data, usage })
}

export async function executeAiChartD1P1PreviewRequest(
  planValue: unknown,
  authorizationValue: unknown,
  catalogValue: unknown,
  structuralInputValues: unknown,
  knowledgeBundleValues: unknown,
  modelInputValues: unknown,
  promptPackageValues: unknown,
  targetPalaceId: unknown,
  dependencies?: AiChartD1P1PreviewRequestGateDependencies,
): Promise<AiChartD1P1PreviewExecutionResult> {
  const environment = assertEnvironmentPolicy(planValue, dependencies)
  const authenticated = buildAuthenticatedPlan(
    planValue,
    catalogValue,
    structuralInputValues,
    knowledgeBundleValues,
    modelInputValues,
    promptPackageValues,
    targetPalaceId,
  )
  const authorization: AiChartD1P1PreviewAuthorization =
    parseAiChartD1P1PreviewAuthorization(
      authorizationValue,
      authenticated.plan,
    )
  if (
    authorization.targetPalaceId !== authenticated.plan.targetPalaceId ||
    authorization.planFingerprint !== authenticated.plan.planFingerprint
  ) {
    invalid()
  }

  const responseValue = await environment.requestImplementation(
    authenticated.bridge.request,
  )
  const response = parseAiChartD1P1PreviewExecutionResponse(
    responseValue,
    authenticated.bridge,
  )
  return freezeAiChartD1Value({
    plan: authenticated.plan,
    data: response.data,
    usage: response.usage,
    executedRequests: 1 as const,
  })
}
