import 'server-only'

import { freezeAiChartD1Value } from './d1CommonContracts'
import {
  parseAiChartD1PalaceWritingPreviewGatePlan,
  type AiChartD1PalaceWritingPreviewGatePlan,
} from './d1PalaceWritingPreviewGateContracts'
import {
  coordinateAiChartD1PalaceWritingPreviewPreRequest,
} from './d1PalaceWritingPreviewPreRequestCoordinator.server'

export const AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_VERSION =
  'ai-chart-d1-palace-writing-preview-runtime-handoff/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_TASK =
  'D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_PREPARATION_VERSION =
  'ai-chart-d1-palace-writing-preview-runtime-handoff-preparation/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_PREPARATION_TASK =
  'D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_PREPARATION' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_CONSUMPTION_VERSION =
  'ai-chart-d1-palace-writing-preview-runtime-handoff-consumption/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_CONSUMPTION_TASK =
  'D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_CONSUMPTION' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_INVALID =
  'ai_chart_d1_palace_writing_preview_runtime_handoff_invalid' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_ALREADY_CONSUMED =
  'ai_chart_d1_palace_writing_preview_runtime_handoff_already_consumed' as const

export type AiChartD1PalaceWritingPreviewRuntimeHandoff =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_TASK
    fixtureId: AiChartD1PalaceWritingPreviewGatePlan['fixtureId']
    caseFingerprint: string
    previewPlanFingerprint: string
    gateFingerprint: string
    claimArtifactName: 'request-started.json'
    status: 'READY_NOT_CONSUMED'
    capabilityScope: 'IN_PROCESS_EXACT_OBJECT_IDENTITY'
    authorizationConsumed: true
    atomicClaimStatus: 'claimed'
    runtimeAdapterStatus: 'not_implemented'
    fetchAllowed: false
    openAiCallable: false
    attemptedRequests: 0
    fetchCount: 0
    openAiRequests: 0
  }>

export type AiChartD1PalaceWritingPreviewRuntimeHandoffPreparation =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_PREPARATION_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_PREPARATION_TASK
    gateFingerprint: string
    authorizationConsumed: true
    atomicClaimStatus: 'claimed'
    fetchAllowed: false
    openAiCallable: false
    attemptedRequests: 0
    fetchCount: 0
    openAiRequests: 0
  } & (
    | Readonly<{
        status: 'READY_STOPPED'
        stage: 'RUNTIME_HANDOFF_CREATED'
        nextRequiredAction: 'CONSUME_HANDOFF_ONCE'
        handoff: AiChartD1PalaceWritingPreviewRuntimeHandoff
      }>
    | Readonly<{
        status: 'BLOCKED_ALREADY_CONSUMED'
        stage: 'CLAIM_ALREADY_EXISTS'
        nextRequiredAction: 'STOP'
        handoff: null
      }>
  )>

export type AiChartD1PalaceWritingPreviewRuntimeHandoffConsumption =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_CONSUMPTION_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_CONSUMPTION_TASK
    fixtureId: AiChartD1PalaceWritingPreviewGatePlan['fixtureId']
    caseFingerprint: string
    previewPlanFingerprint: string
    gateFingerprint: string
    status: 'CONSUMED_STOPPED'
    stage: 'RUNTIME_HANDOFF_CONSUMED'
    capabilityScope: 'IN_PROCESS_EXACT_OBJECT_IDENTITY'
    authorizationConsumed: true
    atomicClaimStatus: 'claimed'
    runtimeAdapterStatus: 'not_implemented'
    nextRequiredAction:
      'STOP_BEFORE_PRODUCTION_RUNTIME_ADAPTER'
    fetchAllowed: false
    openAiCallable: false
    attemptedRequests: 0
    fetchCount: 0
    openAiRequests: 0
  }>

type RuntimeHandoffBinding = Readonly<{
  fixtureId: AiChartD1PalaceWritingPreviewGatePlan['fixtureId']
  caseFingerprint: string
  previewPlanFingerprint: string
  gateFingerprint: string
}>

const activeRuntimeHandoffs = new WeakMap<
  AiChartD1PalaceWritingPreviewRuntimeHandoff,
  RuntimeHandoffBinding
>()
const consumedRuntimeHandoffs =
  new WeakSet<AiChartD1PalaceWritingPreviewRuntimeHandoff>()

export class AiChartD1PalaceWritingPreviewRuntimeHandoffInvalidError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_INVALID

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_INVALID,
    )
    this.name =
      'AiChartD1PalaceWritingPreviewRuntimeHandoffInvalidError'
    Object.freeze(this)
  }
}

export class AiChartD1PalaceWritingPreviewRuntimeHandoffAlreadyConsumedError
  extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_ALREADY_CONSUMED

  constructor() {
    super(
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_ALREADY_CONSUMED,
    )
    this.name =
      'AiChartD1PalaceWritingPreviewRuntimeHandoffAlreadyConsumedError'
    Object.freeze(this)
  }
}

function invalidHandoff(): never {
  throw new AiChartD1PalaceWritingPreviewRuntimeHandoffInvalidError()
}

function alreadyConsumed(): never {
  throw new AiChartD1PalaceWritingPreviewRuntimeHandoffAlreadyConsumedError()
}

function createHandoff(
  gatePlan: AiChartD1PalaceWritingPreviewGatePlan,
): AiChartD1PalaceWritingPreviewRuntimeHandoff {
  const handoff = freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_TASK,
    fixtureId: gatePlan.fixtureId,
    caseFingerprint: gatePlan.caseFingerprint,
    previewPlanFingerprint: gatePlan.previewPlanFingerprint,
    gateFingerprint: gatePlan.gateFingerprint,
    claimArtifactName: gatePlan.claimArtifactName,
    status: 'READY_NOT_CONSUMED' as const,
    capabilityScope:
      'IN_PROCESS_EXACT_OBJECT_IDENTITY' as const,
    authorizationConsumed: true as const,
    atomicClaimStatus: 'claimed' as const,
    runtimeAdapterStatus: 'not_implemented' as const,
    fetchAllowed: false as const,
    openAiCallable: false as const,
    attemptedRequests: 0 as const,
    fetchCount: 0 as const,
    openAiRequests: 0 as const,
  })
  activeRuntimeHandoffs.set(
    handoff,
    freezeAiChartD1Value({
      fixtureId: gatePlan.fixtureId,
      caseFingerprint: gatePlan.caseFingerprint,
      previewPlanFingerprint: gatePlan.previewPlanFingerprint,
      gateFingerprint: gatePlan.gateFingerprint,
    }),
  )
  return handoff
}

function createBlockedPreparation(
  gateFingerprint: string,
): AiChartD1PalaceWritingPreviewRuntimeHandoffPreparation {
  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_PREPARATION_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_PREPARATION_TASK,
    gateFingerprint,
    status: 'BLOCKED_ALREADY_CONSUMED' as const,
    stage: 'CLAIM_ALREADY_EXISTS' as const,
    authorizationConsumed: true as const,
    atomicClaimStatus: 'claimed' as const,
    nextRequiredAction: 'STOP' as const,
    handoff: null,
    fetchAllowed: false as const,
    openAiCallable: false as const,
    attemptedRequests: 0 as const,
    fetchCount: 0 as const,
    openAiRequests: 0 as const,
  })
}

export async function prepareAiChartD1PalaceWritingPreviewRuntimeHandoff(
  gatePlanValue: unknown,
  authorizationValue: unknown,
): Promise<AiChartD1PalaceWritingPreviewRuntimeHandoffPreparation> {
  const gatePlan =
    parseAiChartD1PalaceWritingPreviewGatePlan(gatePlanValue)
  const coordination =
    await coordinateAiChartD1PalaceWritingPreviewPreRequest(
      gatePlan,
      authorizationValue,
    )
  if (coordination.status === 'BLOCKED_ALREADY_CONSUMED') {
    return createBlockedPreparation(gatePlan.gateFingerprint)
  }

  const handoff = createHandoff(gatePlan)
  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_PREPARATION_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_PREPARATION_TASK,
    gateFingerprint: gatePlan.gateFingerprint,
    status: 'READY_STOPPED' as const,
    stage: 'RUNTIME_HANDOFF_CREATED' as const,
    authorizationConsumed: true as const,
    atomicClaimStatus: 'claimed' as const,
    nextRequiredAction: 'CONSUME_HANDOFF_ONCE' as const,
    handoff,
    fetchAllowed: false as const,
    openAiCallable: false as const,
    attemptedRequests: 0 as const,
    fetchCount: 0 as const,
    openAiRequests: 0 as const,
  })
}

export function consumeAiChartD1PalaceWritingPreviewRuntimeHandoff(
  handoffValue: unknown,
): AiChartD1PalaceWritingPreviewRuntimeHandoffConsumption {
  if (
    typeof handoffValue !== 'object' ||
    handoffValue === null
  ) {
    invalidHandoff()
  }
  const handoff =
    handoffValue as AiChartD1PalaceWritingPreviewRuntimeHandoff
  if (consumedRuntimeHandoffs.has(handoff)) {
    alreadyConsumed()
  }
  const binding = activeRuntimeHandoffs.get(handoff)
  if (binding === undefined) {
    invalidHandoff()
  }

  activeRuntimeHandoffs.delete(handoff)
  consumedRuntimeHandoffs.add(handoff)

  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_CONSUMPTION_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_RUNTIME_HANDOFF_CONSUMPTION_TASK,
    fixtureId: binding.fixtureId,
    caseFingerprint: binding.caseFingerprint,
    previewPlanFingerprint: binding.previewPlanFingerprint,
    gateFingerprint: binding.gateFingerprint,
    status: 'CONSUMED_STOPPED' as const,
    stage: 'RUNTIME_HANDOFF_CONSUMED' as const,
    capabilityScope:
      'IN_PROCESS_EXACT_OBJECT_IDENTITY' as const,
    authorizationConsumed: true as const,
    atomicClaimStatus: 'claimed' as const,
    runtimeAdapterStatus: 'not_implemented' as const,
    nextRequiredAction:
      'STOP_BEFORE_PRODUCTION_RUNTIME_ADAPTER' as const,
    fetchAllowed: false as const,
    openAiCallable: false as const,
    attemptedRequests: 0 as const,
    fetchCount: 0 as const,
    openAiRequests: 0 as const,
  })
}
