import 'server-only'

import {
  freezeAiChartD1Value,
} from './d1CommonContracts'
import {
  parseAiChartD1PalaceWritingGoldenCase,
  type AiChartD1PalaceWritingGoldenCase,
} from './d1PalaceWritingGoldenCaseContracts'
import {
  parseAiChartD1PalaceWritingPreviewPlan,
  type AiChartD1PalaceWritingPreviewPlan,
} from './d1PalaceWritingPreviewContracts'
import {
  probeAiChartD1PalaceWritingPreviewProductionAdapter,
} from './d1PalaceWritingPreviewProductionAdapter.server'
import {
  consumeAiChartD1PalaceWritingPreviewRuntimeHandoff,
  type AiChartD1PalaceWritingPreviewRuntimeHandoff,
  type AiChartD1PalaceWritingPreviewRuntimeHandoffConsumption,
} from './d1PalaceWritingPreviewRuntimeHandoff.server'
import {
  requestAiChartOpenAiStructuredResponse,
} from './openAiResponses.server'

export const AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_BINDING_VERSION =
  'ai-chart-d1-palace-writing-preview-runtime-binding-probe/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_BINDING_TASK =
  'D1_PALACE_WRITING_PREVIEW_RUNTIME_BINDING_PROBE' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_BINDING_INVALID =
  'ai_chart_d1_palace_writing_preview_runtime_binding_invalid' as const

type ProductionAdapterProbeResult = Awaited<
  ReturnType<
    typeof probeAiChartD1PalaceWritingPreviewProductionAdapter
  >
>

export type AiChartD1PalaceWritingPreviewRuntimeBindingResult =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_BINDING_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_BINDING_TASK
    runtimeMode:
      'HANDOFF_BOUND_OFFLINE_ADAPTER_PROBE_ONLY'
    fixtureId: AiChartD1PalaceWritingGoldenCase['fixtureId']
    caseFingerprint: string
    planFingerprint: string
    gateFingerprint: string
    status:
      ProductionAdapterProbeResult['status']
    completedStage:
      ProductionAdapterProbeResult['completedStage']
    portInvocations:
      ProductionAdapterProbeResult['portInvocations']
    attemptedRequests: 0
    executedRequests: 0
    fetchCount: 0
    openAiRequests: 0
    retryPerformed: false
    stages:
      ProductionAdapterProbeResult['stages']
    requestProjectionStatus: 'VALIDATED_NOT_PERSISTED'
    measurementStatus: 'OFFLINE_PROBE_ONLY'
    customerDeliveryStatus:
      'BLOCKED_OFFLINE_BINDING_ONLY'
    runtimeHandoffStatus:
      'CONSUMED_FOR_OFFLINE_ADAPTER_PROBE'
    productionAdapterStatus: 'NOT_IMPLEMENTED'
    restrictedArtifactPersisted: false
    safeMetadataOnly: true
  }>

export class AiChartD1PalaceWritingPreviewRuntimeBindingError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_BINDING_INVALID

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_BINDING_INVALID,
    )
    this.name =
      'AiChartD1PalaceWritingPreviewRuntimeBindingError'
    Object.freeze(this)
  }
}

type StructuredRequester =
  typeof requestAiChartOpenAiStructuredResponse

type ValidatedBindingInput = Readonly<{
  handoff: AiChartD1PalaceWritingPreviewRuntimeHandoff
  previewPlan: AiChartD1PalaceWritingPreviewPlan
  goldenCase: AiChartD1PalaceWritingGoldenCase
  requestStructuredResponseFake: StructuredRequester
}>

const INPUT_KEYS = Object.freeze([
  'handoff',
  'previewPlan',
  'goldenCase',
  'requestStructuredResponseFake',
] as const)
const HANDOFF_KEYS = Object.freeze([
  'contractVersion',
  'task',
  'fixtureId',
  'caseFingerprint',
  'previewPlanFingerprint',
  'gateFingerprint',
  'claimArtifactName',
  'status',
  'capabilityScope',
  'authorizationConsumed',
  'atomicClaimStatus',
  'runtimeAdapterStatus',
  'fetchAllowed',
  'openAiCallable',
  'attemptedRequests',
  'fetchCount',
  'openAiRequests',
] as const)

function invalid(): never {
  throw new AiChartD1PalaceWritingPreviewRuntimeBindingError()
}

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false
  try {
    const prototype = Object.getPrototypeOf(value)
    return (
      prototype === Object.prototype ||
      prototype === null
    )
  } catch {
    return false
  }
}

function hasExactEnumerableDataKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  try {
    const ownKeys = Reflect.ownKeys(value)
    if (
      ownKeys.length !== expectedKeys.length ||
      ownKeys.some(
        (key) =>
          typeof key !== 'string' ||
          !expectedKeys.includes(key),
      )
    ) {
      return false
    }
    return expectedKeys.every((key) => {
      const descriptor =
        Object.getOwnPropertyDescriptor(value, key)
      return (
        descriptor !== undefined &&
        descriptor.enumerable &&
        Object.hasOwn(descriptor, 'value')
      )
    })
  } catch {
    return false
  }
}

function getOwnDataProperty(
  value: Record<string, unknown>,
  key: string,
): unknown {
  try {
    const descriptor =
      Object.getOwnPropertyDescriptor(value, key)
    return descriptor !== undefined &&
      descriptor.enumerable &&
      Object.hasOwn(descriptor, 'value')
      ? descriptor.value
      : undefined
  } catch {
    return undefined
  }
}

function validateVisibleHandoff(
  handoffValue: unknown,
  previewPlan: AiChartD1PalaceWritingPreviewPlan,
  goldenCase: AiChartD1PalaceWritingGoldenCase,
): AiChartD1PalaceWritingPreviewRuntimeHandoff {
  if (
    !isPlainObject(handoffValue) ||
    !hasExactEnumerableDataKeys(handoffValue, HANDOFF_KEYS) ||
    getOwnDataProperty(handoffValue, 'contractVersion') !==
      'ai-chart-d1-palace-writing-preview-runtime-handoff/v1' ||
    getOwnDataProperty(handoffValue, 'task') !==
      'D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF' ||
    getOwnDataProperty(handoffValue, 'fixtureId') !==
      goldenCase.fixtureId ||
    getOwnDataProperty(handoffValue, 'caseFingerprint') !==
      goldenCase.caseFingerprint ||
    getOwnDataProperty(
      handoffValue,
      'previewPlanFingerprint',
    ) !== previewPlan.planFingerprint ||
    typeof getOwnDataProperty(
      handoffValue,
      'gateFingerprint',
    ) !== 'string' ||
    getOwnDataProperty(handoffValue, 'claimArtifactName') !==
      'request-started.json' ||
    getOwnDataProperty(handoffValue, 'status') !==
      'READY_NOT_CONSUMED' ||
    getOwnDataProperty(handoffValue, 'capabilityScope') !==
      'IN_PROCESS_EXACT_OBJECT_IDENTITY' ||
    getOwnDataProperty(handoffValue, 'authorizationConsumed') !==
      true ||
    getOwnDataProperty(handoffValue, 'atomicClaimStatus') !==
      'claimed' ||
    getOwnDataProperty(handoffValue, 'runtimeAdapterStatus') !==
      'not_implemented' ||
    getOwnDataProperty(handoffValue, 'fetchAllowed') !== false ||
    getOwnDataProperty(handoffValue, 'openAiCallable') !== false ||
    getOwnDataProperty(handoffValue, 'attemptedRequests') !== 0 ||
    getOwnDataProperty(handoffValue, 'fetchCount') !== 0 ||
    getOwnDataProperty(handoffValue, 'openAiRequests') !== 0
  ) {
    invalid()
  }
  return handoffValue as AiChartD1PalaceWritingPreviewRuntimeHandoff
}

function validateInput(
  input: Readonly<{
    handoff: unknown
    previewPlan: unknown
    goldenCase: unknown
    requestStructuredResponseFake: StructuredRequester
  }>,
): ValidatedBindingInput {
  if (
    process.env.NODE_ENV !== 'test' ||
    !isPlainObject(input) ||
    !hasExactEnumerableDataKeys(input, INPUT_KEYS)
  ) {
    invalid()
  }

  const requester = getOwnDataProperty(
    input,
    'requestStructuredResponseFake',
  )
  if (
    typeof requester !== 'function' ||
    requester === requestAiChartOpenAiStructuredResponse
  ) {
    invalid()
  }

  let previewPlan: AiChartD1PalaceWritingPreviewPlan
  let goldenCase: AiChartD1PalaceWritingGoldenCase
  try {
    previewPlan =
      parseAiChartD1PalaceWritingPreviewPlan(
        getOwnDataProperty(input, 'previewPlan'),
      )
    goldenCase =
      parseAiChartD1PalaceWritingGoldenCase(
        getOwnDataProperty(input, 'goldenCase'),
      )
  } catch {
    invalid()
  }

  if (
    previewPlan.fixtureId !== goldenCase.fixtureId ||
    previewPlan.caseFingerprint !== goldenCase.caseFingerprint
  ) {
    invalid()
  }

  return Object.freeze({
    handoff: validateVisibleHandoff(
      getOwnDataProperty(input, 'handoff'),
      previewPlan,
      goldenCase,
    ),
    previewPlan,
    goldenCase,
    requestStructuredResponseFake:
      requester as StructuredRequester,
  })
}

function validateConsumption(
  consumption: AiChartD1PalaceWritingPreviewRuntimeHandoffConsumption,
  input: ValidatedBindingInput,
): void {
  if (
    consumption.fixtureId !== input.goldenCase.fixtureId ||
    consumption.caseFingerprint !==
      input.goldenCase.caseFingerprint ||
    consumption.previewPlanFingerprint !==
      input.previewPlan.planFingerprint
  ) {
    invalid()
  }
}

function createResult(
  consumption: AiChartD1PalaceWritingPreviewRuntimeHandoffConsumption,
  probe: ProductionAdapterProbeResult,
): AiChartD1PalaceWritingPreviewRuntimeBindingResult {
  if (
    consumption.fixtureId !== probe.fixtureId ||
    consumption.caseFingerprint !== probe.caseFingerprint ||
    consumption.previewPlanFingerprint !==
      probe.planFingerprint
  ) {
    invalid()
  }

  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_BINDING_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_BINDING_TASK,
    runtimeMode:
      'HANDOFF_BOUND_OFFLINE_ADAPTER_PROBE_ONLY' as const,
    fixtureId: probe.fixtureId,
    caseFingerprint: probe.caseFingerprint,
    planFingerprint: probe.planFingerprint,
    gateFingerprint: consumption.gateFingerprint,
    status: probe.status,
    completedStage: probe.completedStage,
    portInvocations: probe.portInvocations,
    attemptedRequests: 0 as const,
    executedRequests: 0 as const,
    fetchCount: 0 as const,
    openAiRequests: 0 as const,
    retryPerformed: false as const,
    stages: probe.stages,
    requestProjectionStatus:
      'VALIDATED_NOT_PERSISTED' as const,
    measurementStatus: 'OFFLINE_PROBE_ONLY' as const,
    customerDeliveryStatus:
      'BLOCKED_OFFLINE_BINDING_ONLY' as const,
    runtimeHandoffStatus:
      'CONSUMED_FOR_OFFLINE_ADAPTER_PROBE' as const,
    productionAdapterStatus: 'NOT_IMPLEMENTED' as const,
    restrictedArtifactPersisted: false as const,
    safeMetadataOnly: true as const,
  })
}

export async function probeAiChartD1PalaceWritingPreviewRuntimeBinding(
  input: Readonly<{
    handoff: unknown
    previewPlan: unknown
    goldenCase: unknown
    requestStructuredResponseFake: StructuredRequester
  }>,
): Promise<AiChartD1PalaceWritingPreviewRuntimeBindingResult> {
  const validated = validateInput(input)
  const consumption =
    consumeAiChartD1PalaceWritingPreviewRuntimeHandoff(
      validated.handoff,
    )
  validateConsumption(consumption, validated)

  let probe: ProductionAdapterProbeResult
  try {
    probe =
      await probeAiChartD1PalaceWritingPreviewProductionAdapter({
        previewPlan: validated.previewPlan,
        goldenCase: validated.goldenCase,
        requestStructuredResponseFake:
          validated.requestStructuredResponseFake,
      })
  } catch {
    invalid()
  }

  return createResult(consumption, probe)
}
