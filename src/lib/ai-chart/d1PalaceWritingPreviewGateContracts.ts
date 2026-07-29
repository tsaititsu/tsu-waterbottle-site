import { createHash } from 'node:crypto'
import {
  assertAiChartD1SafeGraph,
  freezeAiChartD1Value,
  requireAiChartD1ExactObject,
} from './d1CommonContracts'
import {
  buildAiChartD1PalaceWritingGoldenCase,
} from './d1PalaceWritingGoldenCaseContracts'
import {
  buildAiChartD1PalaceWritingPreviewPlan,
  parseAiChartD1PalaceWritingPreviewPlan,
  type AiChartD1PalaceWritingPreviewPlan,
} from './d1PalaceWritingPreviewContracts'
import {
  createAiChartD1PalaceWritingCanonicalJson,
} from './d1PalaceWritingPromptPackageContracts'

export const AI_CHART_D1_PALACE_WRITING_PREVIEW_GATE_VERSION =
  'ai-chart-d1-palace-writing-preview-gate/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_GATE_TASK =
  'D1_PALACE_WRITING_PRE_REQUEST_GATE' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_GATE_INVALID =
  'ai_chart_d1_palace_writing_preview_gate_invalid' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_VERSION =
  'ai-chart-d1-palace-writing-preview-authorization/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_TASK =
  'D1_PALACE_WRITING_PREVIEW_AUTHORIZATION' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_MODE =
  'EXECUTE_ONE_CONTROLLED_PREVIEW' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_ACKNOWLEDGEMENT =
  'EXECUTE_ONE_PAID_PALACE_WRITING_PREVIEW' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_CLAIM_OBSERVATION_VERSION =
  'ai-chart-d1-palace-writing-preview-claim-observation/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PREVIEW_CLAIM_OBSERVATION_TASK =
  'D1_PALACE_WRITING_PREVIEW_CLAIM_OBSERVATION' as const

export type AiChartD1PalaceWritingPreviewGatePlan =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_GATE_VERSION
    task: typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_GATE_TASK
    fixtureId: AiChartD1PalaceWritingPreviewPlan['fixtureId']
    caseFingerprint: string
    previewPlanFingerprint: string
    requestSequence: readonly ['WRITING', 'FIDELITY_REVIEW']
    maxRequests: 2
    fetchHardLimit: 2
    retry: false
    serverOnly: true
    environmentPolicy: 'local_development_only'
    authorizationStatus: 'authorization_required'
    atomicClaimStatus: 'not_claimed'
    claimObservationAuthority:
      'TRUSTED_ATOMIC_STORAGE_ADAPTER_REQUIRED'
    claimScope: 'GATE_FINGERPRINT'
    claimArtifactName: 'request-started.json'
    atomicCreateRequired: true
    claimRequiredBeforeFetch: true
    authorizationConsumedAt: 'ATOMIC_CLAIM_CREATED'
    reentryPolicy: 'FORBIDDEN_AFTER_CLAIM'
    runtimeStatus: 'pre_request_gate_only'
    fetchAllowed: false
    openAiCallable: false
    gateFingerprint: string
  }>

export type AiChartD1PalaceWritingPreviewAuthorization =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_TASK
    mode:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_MODE
    fixtureId: AiChartD1PalaceWritingPreviewGatePlan['fixtureId']
    caseFingerprint: string
    previewPlanFingerprint: string
    gateFingerprint: string
    maxRequests: 2
    fetchHardLimit: 2
    retry: false
    acknowledgement:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_ACKNOWLEDGEMENT
  }>

export type AiChartD1PalaceWritingPreviewClaimObservation =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_CLAIM_OBSERVATION_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_PREVIEW_CLAIM_OBSERVATION_TASK
    gateFingerprint: string
    authority: 'TRUSTED_ATOMIC_STORAGE_ADAPTER'
    claimArtifactName: 'request-started.json'
    state: 'ABSENT' | 'PRESENT'
  }>

export type AiChartD1PalaceWritingPreviewPreRequestDecision =
  Readonly<{
    gateFingerprint: string
    status:
      | 'READY_FOR_ATOMIC_CLAIM'
      | 'BLOCKED_ALREADY_CONSUMED'
    stage: 'PRE_REQUEST_VALIDATED' | 'CLAIM_ALREADY_EXISTS'
    authorizationStatus:
      | 'validated_not_consumed'
      | 'consumed_or_unavailable'
    atomicClaimStatus: 'not_claimed' | 'claimed'
    authorizationConsumed: boolean
    nextRequiredAction:
      | 'CREATE_ATOMIC_CLAIM_EXCLUSIVELY'
      | 'STOP'
    fetchAllowed: false
    openAiCallable: false
    attemptedRequests: 0
    fetchCount: 0
    openAiRequests: 0
  }>

export class AiChartD1PalaceWritingPreviewGateError extends Error {
  readonly code =
    AI_CHART_D1_PALACE_WRITING_PREVIEW_GATE_INVALID

  constructor() {
    super(AI_CHART_D1_PALACE_WRITING_PREVIEW_GATE_INVALID)
    this.name = 'AiChartD1PalaceWritingPreviewGateError'
    Object.freeze(this)
  }
}

function invalid(): never {
  throw new AiChartD1PalaceWritingPreviewGateError()
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function createGatePlan(
  previewPlan: AiChartD1PalaceWritingPreviewPlan,
): AiChartD1PalaceWritingPreviewGatePlan {
  const withoutFingerprint = {
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_GATE_VERSION,
    task: AI_CHART_D1_PALACE_WRITING_PREVIEW_GATE_TASK,
    fixtureId: previewPlan.fixtureId,
    caseFingerprint: previewPlan.caseFingerprint,
    previewPlanFingerprint: previewPlan.planFingerprint,
    requestSequence: ['WRITING', 'FIDELITY_REVIEW'],
    maxRequests: 2,
    fetchHardLimit: 2,
    retry: false,
    serverOnly: true,
    environmentPolicy: 'local_development_only',
    authorizationStatus: 'authorization_required',
    atomicClaimStatus: 'not_claimed',
    claimObservationAuthority:
      'TRUSTED_ATOMIC_STORAGE_ADAPTER_REQUIRED',
    claimScope: 'GATE_FINGERPRINT',
    claimArtifactName: 'request-started.json',
    atomicCreateRequired: true,
    claimRequiredBeforeFetch: true,
    authorizationConsumedAt: 'ATOMIC_CLAIM_CREATED',
    reentryPolicy: 'FORBIDDEN_AFTER_CLAIM',
    runtimeStatus: 'pre_request_gate_only',
    fetchAllowed: false,
    openAiCallable: false,
  } as const

  return freezeAiChartD1Value({
    ...withoutFingerprint,
    gateFingerprint: sha256(
      createAiChartD1PalaceWritingCanonicalJson(
        withoutFingerprint,
      ),
    ),
  })
}

const PREVIEW_PLAN = buildAiChartD1PalaceWritingPreviewPlan(
  buildAiChartD1PalaceWritingGoldenCase(),
)
const GATE_PLAN = createGatePlan(PREVIEW_PLAN)
const GATE_PLAN_CANONICAL_JSON =
  createAiChartD1PalaceWritingCanonicalJson(GATE_PLAN)

const AUTHORIZATION_FIELDS = [
  'contractVersion',
  'task',
  'mode',
  'fixtureId',
  'caseFingerprint',
  'previewPlanFingerprint',
  'gateFingerprint',
  'maxRequests',
  'fetchHardLimit',
  'retry',
  'acknowledgement',
] as const

const CLAIM_OBSERVATION_FIELDS = [
  'contractVersion',
  'task',
  'gateFingerprint',
  'authority',
  'claimArtifactName',
  'state',
] as const

export function buildAiChartD1PalaceWritingPreviewGatePlan(
  previewPlanValue: unknown,
): AiChartD1PalaceWritingPreviewGatePlan {
  parseAiChartD1PalaceWritingPreviewPlan(previewPlanValue)
  return GATE_PLAN
}

export function parseAiChartD1PalaceWritingPreviewGatePlan(
  value: unknown,
): AiChartD1PalaceWritingPreviewGatePlan {
  try {
    if (
      createAiChartD1PalaceWritingCanonicalJson(value) !==
      GATE_PLAN_CANONICAL_JSON
    ) {
      invalid()
    }
    return GATE_PLAN
  } catch (error) {
    if (
      error instanceof AiChartD1PalaceWritingPreviewGateError
    ) {
      throw error
    }
    invalid()
  }
}

export function parseAiChartD1PalaceWritingPreviewAuthorization(
  value: unknown,
  gatePlanValue: unknown,
): AiChartD1PalaceWritingPreviewAuthorization {
  try {
    const gatePlan =
      parseAiChartD1PalaceWritingPreviewGatePlan(gatePlanValue)
    assertAiChartD1SafeGraph(value)
    const record = requireAiChartD1ExactObject(
      value,
      AUTHORIZATION_FIELDS,
    )
    if (
      record.contractVersion !==
        AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_VERSION ||
      record.task !==
        AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_TASK ||
      record.mode !==
        AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_MODE ||
      record.fixtureId !== gatePlan.fixtureId ||
      record.caseFingerprint !== gatePlan.caseFingerprint ||
      record.previewPlanFingerprint !==
        gatePlan.previewPlanFingerprint ||
      record.gateFingerprint !== gatePlan.gateFingerprint ||
      record.maxRequests !== gatePlan.maxRequests ||
      record.fetchHardLimit !== gatePlan.fetchHardLimit ||
      record.retry !== false ||
      record.acknowledgement !==
        AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_ACKNOWLEDGEMENT
    ) {
      invalid()
    }

    return freezeAiChartD1Value({
      contractVersion:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_VERSION,
      task:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_TASK,
      mode:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_MODE,
      fixtureId: gatePlan.fixtureId,
      caseFingerprint: gatePlan.caseFingerprint,
      previewPlanFingerprint: gatePlan.previewPlanFingerprint,
      gateFingerprint: gatePlan.gateFingerprint,
      maxRequests: 2 as const,
      fetchHardLimit: 2 as const,
      retry: false as const,
      acknowledgement:
        AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_ACKNOWLEDGEMENT,
    })
  } catch (error) {
    if (
      error instanceof AiChartD1PalaceWritingPreviewGateError
    ) {
      throw error
    }
    invalid()
  }
}

function parseClaimObservation(
  value: unknown,
  gatePlan: AiChartD1PalaceWritingPreviewGatePlan,
): AiChartD1PalaceWritingPreviewClaimObservation {
  assertAiChartD1SafeGraph(value)
  const record = requireAiChartD1ExactObject(
    value,
    CLAIM_OBSERVATION_FIELDS,
  )
  if (
    record.contractVersion !==
      AI_CHART_D1_PALACE_WRITING_PREVIEW_CLAIM_OBSERVATION_VERSION ||
    record.task !==
      AI_CHART_D1_PALACE_WRITING_PREVIEW_CLAIM_OBSERVATION_TASK ||
    record.gateFingerprint !== gatePlan.gateFingerprint ||
    record.authority !== 'TRUSTED_ATOMIC_STORAGE_ADAPTER' ||
    record.claimArtifactName !== gatePlan.claimArtifactName ||
    (record.state !== 'ABSENT' && record.state !== 'PRESENT')
  ) {
    invalid()
  }
  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_CLAIM_OBSERVATION_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_CLAIM_OBSERVATION_TASK,
    gateFingerprint: gatePlan.gateFingerprint,
    authority: 'TRUSTED_ATOMIC_STORAGE_ADAPTER' as const,
    claimArtifactName: gatePlan.claimArtifactName,
    state: record.state,
  })
}

export function evaluateAiChartD1PalaceWritingPreviewPreRequestGate(
  gatePlanValue: unknown,
  authorizationValue: unknown,
  claimObservationValue: unknown,
): AiChartD1PalaceWritingPreviewPreRequestDecision {
  try {
    const gatePlan =
      parseAiChartD1PalaceWritingPreviewGatePlan(gatePlanValue)
    parseAiChartD1PalaceWritingPreviewAuthorization(
      authorizationValue,
      gatePlan,
    )
    const claimObservation = parseClaimObservation(
      claimObservationValue,
      gatePlan,
    )

    const common = {
      gateFingerprint: gatePlan.gateFingerprint,
      fetchAllowed: false as const,
      openAiCallable: false as const,
      attemptedRequests: 0 as const,
      fetchCount: 0 as const,
      openAiRequests: 0 as const,
    }
    if (claimObservation.state === 'ABSENT') {
      return freezeAiChartD1Value({
        ...common,
        status: 'READY_FOR_ATOMIC_CLAIM' as const,
        stage: 'PRE_REQUEST_VALIDATED' as const,
        authorizationStatus:
          'validated_not_consumed' as const,
        atomicClaimStatus: 'not_claimed' as const,
        authorizationConsumed: false,
        nextRequiredAction:
          'CREATE_ATOMIC_CLAIM_EXCLUSIVELY' as const,
      })
    }

    return freezeAiChartD1Value({
      ...common,
      status: 'BLOCKED_ALREADY_CONSUMED' as const,
      stage: 'CLAIM_ALREADY_EXISTS' as const,
      authorizationStatus:
        'consumed_or_unavailable' as const,
      atomicClaimStatus: 'claimed' as const,
      authorizationConsumed: true,
      nextRequiredAction: 'STOP' as const,
    })
  } catch (error) {
    if (
      error instanceof AiChartD1PalaceWritingPreviewGateError
    ) {
      throw error
    }
    invalid()
  }
}
