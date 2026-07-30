import 'server-only'
import { createAiChartD1CanonicalSha256 } from './d1CanonicalDigest'
import { freezeAiChartD1Value } from './d1CommonContracts'
import { buildAiChartD1K0P1KnowledgeBundles } from './d1K0Selection'
import { normalizeAiChartD1N0 } from './d1N0'
import { AI_CHART_D1_PALACE_IDENTITIES } from './d1N0Constants'
import { buildAiChartD1P1AdapterBridges, type AiChartD1P1AdapterBridge } from './d1P1AdapterBridge'
import { buildAiChartD1P1ModelInputs } from './d1P1ModelInputBindings'
import { buildAiChartD1P1StructuralInputs } from './d1P1InputContracts'
import { buildAiChartD1P1PromptPackages } from './d1P1PromptPackageBuilder'
import {
  buildAiChartD1ReportWriterRuntimeCommand,
  summarizeAiChartD1P1AdapterBridgeDescriptors,
  type AiChartD1ReportWriterRuntimeP1BridgeDescriptorSummary,
} from './d1ReportWriterRuntimeContracts'
import {
  buildAiChartD1P1ReportExecutionPlan,
  createAiChartD1P1ReportExecutionPlanFingerprint,
  runAiChartD1P1ReportExecutionRuntime,
  type AiChartD1P1ReportExecutionLedger,
  type AiChartD1P1ReportExecutionRuntimePlan,
} from './d1P1ReportExecutionRuntimeContracts'
import {
  requestAiChartOpenAiStructuredResponse,
} from './openAiResponses.server'
import type { AiChartOpenAiStructuredResult } from './openAiResponses'

export const AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_CAPSULE_VERSION =
  'ai-chart-d1-p1-report-openai-runtime-capsule/v1' as const
export const AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_CAPSULE_TASK =
  'D1_P1_REPORT_OPENAI_RUNTIME_CAPSULE' as const
export const AI_CHART_D1_P1_REPORT_OPENAI_AUTHORIZATION_VERSION =
  'ai-chart-d1-p1-report-openai-authorization/v1' as const
export const AI_CHART_D1_P1_REPORT_OPENAI_AUTHORIZATION_TASK =
  'D1_P1_REPORT_OPENAI_AUTHORIZATION' as const
export const AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_CONFIRMATION =
  'EXECUTE_D1_P1_REPORT_OPENAI_REQUESTS_ONCE' as const
export const AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_INVALID =
  'ai_chart_d1_p1_report_openai_runtime_invalid' as const

export type AiChartD1P1ReportOpenAiRuntimeCapsule = Readonly<{
  contractVersion:
    typeof AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_CAPSULE_VERSION
  task: typeof AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_CAPSULE_TASK
  status: 'READY_FOR_EXPLICIT_OPENAI_AUTHORIZATION'
  stage: 'D1_P1_REPORT_OPENAI_PRE_REQUEST_READY'
  capsuleFingerprint: string
  planFingerprint: string
  writerRuntimeCommandFingerprint: string
  chartId: string
  sourceSnapshotSha256: string
  targetPalaceCount: 12
  targetPalaceIds: readonly string[]
  maxRequests: 12
  fetchHardLimit: 12
  p1AdapterBridgeDescriptorCount: 12
  p1AdapterBridgeDescriptors: readonly AiChartD1ReportWriterRuntimeP1BridgeDescriptorSummary[]
  productionCallable: false
  fetchAllowed: false
  openAiCallable: false
  retryAllowed: false
  fallbackAllowed: false
  customerDeliveryAllowed: false
  safeMetadataOnly: true
}>

export type AiChartD1P1ReportOpenAiRuntimeAuthorization =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_P1_REPORT_OPENAI_AUTHORIZATION_VERSION
    task: typeof AI_CHART_D1_P1_REPORT_OPENAI_AUTHORIZATION_TASK
    status: 'AUTHORIZED_FOR_SINGLE_PROCESS_EXECUTION'
    capsuleFingerprint: string
    planFingerprint: string
    confirmation:
      typeof AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_CONFIRMATION
    maxRequests: 12
    fetchHardLimit: 12
    retryAllowed: false
    fallbackAllowed: false
    customerDeliveryAllowed: false
    safeMetadataOnly: true
  }>

export type AiChartD1P1ReportOpenAiRuntimeInput = Readonly<{
  reportId: string
  chartSnapshot: unknown
  d1K0Catalog: unknown
}>

type StructuredRequester = typeof requestAiChartOpenAiStructuredResponse

type RuntimeBinding = Readonly<{
  plan: AiChartD1P1ReportExecutionRuntimePlan
  p1AdapterBridges: readonly AiChartD1P1AdapterBridge[]
}>

const RUNTIME_CAPSULE_FIELDS = Object.freeze([
  'contractVersion',
  'task',
  'status',
  'stage',
  'capsuleFingerprint',
  'planFingerprint',
  'writerRuntimeCommandFingerprint',
  'chartId',
  'sourceSnapshotSha256',
  'targetPalaceCount',
  'targetPalaceIds',
  'maxRequests',
  'fetchHardLimit',
  'p1AdapterBridgeDescriptorCount',
  'p1AdapterBridgeDescriptors',
  'productionCallable',
  'fetchAllowed',
  'openAiCallable',
  'retryAllowed',
  'fallbackAllowed',
  'customerDeliveryAllowed',
  'safeMetadataOnly',
] as const)

const AUTHORIZATION_FIELDS = Object.freeze([
  'contractVersion',
  'task',
  'status',
  'capsuleFingerprint',
  'planFingerprint',
  'confirmation',
  'maxRequests',
  'fetchHardLimit',
  'retryAllowed',
  'fallbackAllowed',
  'customerDeliveryAllowed',
  'safeMetadataOnly',
] as const)

const activeRuntimeBindings = new WeakMap<
  AiChartD1P1ReportOpenAiRuntimeCapsule,
  RuntimeBinding
>()
const consumedRuntimeCapsules =
  new WeakSet<AiChartD1P1ReportOpenAiRuntimeCapsule>()

export class AiChartD1P1ReportOpenAiRuntimeError extends Error {
  readonly code = AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_INVALID

  constructor() {
    super(AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_INVALID)
    this.name = 'AiChartD1P1ReportOpenAiRuntimeError'
  }
}

function invalid(): never {
  throw new AiChartD1P1ReportOpenAiRuntimeError()
}

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasExactEnumerableDataKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
) {
  const keys = Reflect.ownKeys(value)
  return (
    keys.length === expectedKeys.length &&
    keys.every(
      (key) =>
        typeof key === 'string' && expectedKeys.includes(key),
    ) &&
    expectedKeys.every((key) => {
      const descriptor =
        Object.getOwnPropertyDescriptor(value, key)
      return (
        descriptor !== undefined &&
        descriptor.enumerable &&
        Object.hasOwn(descriptor, 'value')
      )
    })
  )
}

function reportScopedId(prefix: string, reportId: string) {
  const normalized = reportId.trim().replace(/[^A-Za-z0-9._:-]/g, '-')
  if (!normalized) invalid()
  return `${prefix}:${normalized}`.slice(0, 128)
}

function createCapsuleFingerprint(
  capsuleWithoutFingerprint: Omit<
    AiChartD1P1ReportOpenAiRuntimeCapsule,
    'capsuleFingerprint'
  >,
): string {
  return createAiChartD1CanonicalSha256(capsuleWithoutFingerprint)
}

function assertDescriptorMatchesBridge(
  descriptor: AiChartD1ReportWriterRuntimeP1BridgeDescriptorSummary,
  bridge: AiChartD1P1AdapterBridge,
) {
  const source = bridge.descriptor
  if (
    descriptor.targetPalaceId !== source.targetPalaceId ||
    descriptor.callId !== source.callId ||
    descriptor.bridgeFingerprint !== source.bridgeFingerprint ||
    descriptor.packageFingerprint !== source.packageFingerprint ||
    descriptor.modelInputFingerprint !== source.modelInputFingerprint ||
    descriptor.outputSchemaSha256 !== source.outputSchemaSha256 ||
    descriptor.reasoningEffort !== source.reasoningEffort ||
    descriptor.timeoutMs !== source.timeoutMs ||
    descriptor.maxOutputTokens !== source.maxOutputTokens ||
    descriptor.requestStatus !== source.requestStatus ||
    descriptor.runtimeStatus !== source.runtimeStatus ||
    descriptor.openAiCallable !== source.openAiCallable
  ) {
    invalid()
  }
}

function buildRuntimeBinding(
  input: AiChartD1P1ReportOpenAiRuntimeInput,
): RuntimeBinding {
  const chartId = reportScopedId('chart', input.reportId)
  const runId = reportScopedId('run:d1-report', input.reportId)
  const n0 = normalizeAiChartD1N0(input.chartSnapshot, { chartId })
  const callIds = AI_CHART_D1_PALACE_IDENTITIES.map(
    ({ palaceId }) => `${runId}:${palaceId}`,
  )
  const structuralInputs = buildAiChartD1P1StructuralInputs(n0, {
    runId,
    callIds,
  })
  if (structuralInputs.length !== 12) invalid()

  const targetPalaceIds = freezeAiChartD1Value(
    structuralInputs.map(
      (structuralInput) =>
        structuralInput.targetPalace.palaceId,
    ),
  )
  const knowledgeBundles = buildAiChartD1K0P1KnowledgeBundles(
    input.d1K0Catalog,
    structuralInputs,
    {
      bundleIds: targetPalaceIds.map(
        (palaceId) => `${runId}:bundle:${palaceId}`,
      ),
    },
  )
  const modelInputs = buildAiChartD1P1ModelInputs(
    input.d1K0Catalog,
    structuralInputs,
    knowledgeBundles,
  )
  const promptPackages = buildAiChartD1P1PromptPackages(
    input.d1K0Catalog,
    structuralInputs,
    knowledgeBundles,
    modelInputs,
  )
  const p1AdapterBridges = buildAiChartD1P1AdapterBridges(
    input.d1K0Catalog,
    structuralInputs,
    knowledgeBundles,
    modelInputs,
    promptPackages,
  )
  const p1AdapterBridgeDescriptors =
    summarizeAiChartD1P1AdapterBridgeDescriptors(
      p1AdapterBridges.map((bridge) => bridge.descriptor),
    )
  const writerRuntimeCommand =
    buildAiChartD1ReportWriterRuntimeCommand({
      pipelineVersion:
        'ai-chart-d1-report-generation-pipeline/v1',
      chartId: n0.chartId,
      sourceSnapshotSha256: n0.sourceSnapshotSha256,
      targetPalaceIds,
      p1AdapterBridgeDescriptors,
    })
  const plan =
    buildAiChartD1P1ReportExecutionPlan(writerRuntimeCommand)
  return freezeAiChartD1Value({ plan, p1AdapterBridges })
}

function createCapsuleFromBinding(
  binding: RuntimeBinding,
): AiChartD1P1ReportOpenAiRuntimeCapsule {
  const planFingerprint =
    createAiChartD1P1ReportExecutionPlanFingerprint(binding.plan)
  const capsuleWithoutFingerprint = freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_CAPSULE_VERSION,
    task: AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_CAPSULE_TASK,
    status:
      'READY_FOR_EXPLICIT_OPENAI_AUTHORIZATION' as const,
    stage: 'D1_P1_REPORT_OPENAI_PRE_REQUEST_READY' as const,
    planFingerprint,
    writerRuntimeCommandFingerprint:
      binding.plan.writerRuntimeCommandFingerprint,
    chartId: binding.plan.chartId,
    sourceSnapshotSha256: binding.plan.sourceSnapshotSha256,
    targetPalaceCount: 12 as const,
    targetPalaceIds: binding.plan.targetPalaceIds,
    maxRequests: 12 as const,
    fetchHardLimit: 12 as const,
    p1AdapterBridgeDescriptorCount: 12 as const,
    p1AdapterBridgeDescriptors:
      binding.plan.p1AdapterBridgeDescriptors,
    productionCallable: false as const,
    fetchAllowed: false as const,
    openAiCallable: false as const,
    retryAllowed: false as const,
    fallbackAllowed: false as const,
    customerDeliveryAllowed: false as const,
    safeMetadataOnly: true as const,
  })
  const capsule = freezeAiChartD1Value({
    ...capsuleWithoutFingerprint,
    capsuleFingerprint: createCapsuleFingerprint(
      capsuleWithoutFingerprint,
    ),
  })
  assertValidCapsule(capsule)
  return capsule
}

function assertValidCapsule(
  capsule: unknown,
): asserts capsule is AiChartD1P1ReportOpenAiRuntimeCapsule {
  if (
    !isPlainObject(capsule) ||
    !hasExactEnumerableDataKeys(capsule, RUNTIME_CAPSULE_FIELDS) ||
    capsule.contractVersion !==
      AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_CAPSULE_VERSION ||
    capsule.task !==
      AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_CAPSULE_TASK ||
    capsule.status !==
      'READY_FOR_EXPLICIT_OPENAI_AUTHORIZATION' ||
    capsule.stage !== 'D1_P1_REPORT_OPENAI_PRE_REQUEST_READY' ||
    typeof capsule.capsuleFingerprint !== 'string' ||
    typeof capsule.planFingerprint !== 'string' ||
    capsule.targetPalaceCount !== 12 ||
    !Array.isArray(capsule.targetPalaceIds) ||
    capsule.targetPalaceIds.length !== 12 ||
    capsule.maxRequests !== 12 ||
    capsule.fetchHardLimit !== 12 ||
    capsule.p1AdapterBridgeDescriptorCount !== 12 ||
    !Array.isArray(capsule.p1AdapterBridgeDescriptors) ||
    capsule.p1AdapterBridgeDescriptors.length !== 12 ||
    capsule.productionCallable !== false ||
    capsule.fetchAllowed !== false ||
    capsule.openAiCallable !== false ||
    capsule.retryAllowed !== false ||
    capsule.fallbackAllowed !== false ||
    capsule.customerDeliveryAllowed !== false ||
    capsule.safeMetadataOnly !== true
  ) {
    invalid()
  }
}

function assertValidAuthorization(
  authorization: unknown,
  capsule: AiChartD1P1ReportOpenAiRuntimeCapsule,
): asserts authorization is AiChartD1P1ReportOpenAiRuntimeAuthorization {
  if (
    !isPlainObject(authorization) ||
    !hasExactEnumerableDataKeys(authorization, AUTHORIZATION_FIELDS) ||
    authorization.contractVersion !==
      AI_CHART_D1_P1_REPORT_OPENAI_AUTHORIZATION_VERSION ||
    authorization.task !==
      AI_CHART_D1_P1_REPORT_OPENAI_AUTHORIZATION_TASK ||
    authorization.status !==
      'AUTHORIZED_FOR_SINGLE_PROCESS_EXECUTION' ||
    authorization.capsuleFingerprint !==
      capsule.capsuleFingerprint ||
    authorization.planFingerprint !== capsule.planFingerprint ||
    authorization.confirmation !==
      AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_CONFIRMATION ||
    authorization.maxRequests !== 12 ||
    authorization.fetchHardLimit !== 12 ||
    authorization.retryAllowed !== false ||
    authorization.fallbackAllowed !== false ||
    authorization.customerDeliveryAllowed !== false ||
    authorization.safeMetadataOnly !== true
  ) {
    invalid()
  }
}

export function prepareAiChartD1P1ReportOpenAiRuntimeCapsule(
  input: AiChartD1P1ReportOpenAiRuntimeInput,
): AiChartD1P1ReportOpenAiRuntimeCapsule {
  const binding = buildRuntimeBinding(input)
  const capsule = createCapsuleFromBinding(binding)
  activeRuntimeBindings.set(capsule, binding)
  return capsule
}

export function createAiChartD1P1ReportOpenAiRuntimeAuthorization(input: {
  capsule: AiChartD1P1ReportOpenAiRuntimeCapsule
  confirmation:
    typeof AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_CONFIRMATION
}): AiChartD1P1ReportOpenAiRuntimeAuthorization {
  assertValidCapsule(input.capsule)
  if (
    input.confirmation !==
    AI_CHART_D1_P1_REPORT_OPENAI_RUNTIME_CONFIRMATION
  ) {
    invalid()
  }
  const authorization = freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_P1_REPORT_OPENAI_AUTHORIZATION_VERSION,
    task: AI_CHART_D1_P1_REPORT_OPENAI_AUTHORIZATION_TASK,
    status: 'AUTHORIZED_FOR_SINGLE_PROCESS_EXECUTION' as const,
    capsuleFingerprint: input.capsule.capsuleFingerprint,
    planFingerprint: input.capsule.planFingerprint,
    confirmation: input.confirmation,
    maxRequests: 12 as const,
    fetchHardLimit: 12 as const,
    retryAllowed: false as const,
    fallbackAllowed: false as const,
    customerDeliveryAllowed: false as const,
    safeMetadataOnly: true as const,
  })
  assertValidAuthorization(authorization, input.capsule)
  return authorization
}

export async function executeAiChartD1P1ReportOpenAiRuntime(
  capsule: AiChartD1P1ReportOpenAiRuntimeCapsule,
  authorization: AiChartD1P1ReportOpenAiRuntimeAuthorization,
  dependencies: Readonly<{
    requestStructuredResponse?: StructuredRequester
  }> = {},
): Promise<AiChartD1P1ReportExecutionLedger> {
  assertValidCapsule(capsule)
  assertValidAuthorization(authorization, capsule)

  const binding = activeRuntimeBindings.get(capsule)
  if (binding === undefined || consumedRuntimeCapsules.has(capsule)) {
    invalid()
  }
  if (binding.p1AdapterBridges.length !== 12) invalid()

  consumedRuntimeCapsules.add(capsule)
  const requester =
    dependencies.requestStructuredResponse ??
    requestAiChartOpenAiStructuredResponse

  return runAiChartD1P1ReportExecutionRuntime(
    binding.plan,
    async (descriptor, index): Promise<AiChartOpenAiStructuredResult<unknown>> => {
      const bridge = binding.p1AdapterBridges[index]
      if (bridge === undefined) invalid()
      assertDescriptorMatchesBridge(descriptor, bridge)
      return requester(bridge.request)
    },
  )
}
