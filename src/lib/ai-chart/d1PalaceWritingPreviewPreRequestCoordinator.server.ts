import 'server-only'

import { freezeAiChartD1Value } from './d1CommonContracts'
import {
  AiChartD1PalaceWritingPreviewClaimAlreadyExistsError,
  claimAiChartD1PalaceWritingPreviewExecution,
  observeAiChartD1PalaceWritingPreviewClaim,
} from './d1PalaceWritingPreviewAtomicClaim.server'
import {
  evaluateAiChartD1PalaceWritingPreviewPreRequestGate,
  parseAiChartD1PalaceWritingPreviewAuthorization,
  parseAiChartD1PalaceWritingPreviewGatePlan,
} from './d1PalaceWritingPreviewGateContracts'

export const AI_CHART_D1_PALACE_WRITING_PRE_REQUEST_COORDINATOR_VERSION =
  'ai-chart-d1-palace-writing-preview-pre-request-coordinator/v1' as const
export const AI_CHART_D1_PALACE_WRITING_PRE_REQUEST_COORDINATOR_TASK =
  'D1_PALACE_WRITING_PRE_REQUEST_COORDINATOR' as const

export type AiChartD1PalaceWritingPreviewPreRequestCoordination =
  Readonly<{
    contractVersion:
      typeof AI_CHART_D1_PALACE_WRITING_PRE_REQUEST_COORDINATOR_VERSION
    task:
      typeof AI_CHART_D1_PALACE_WRITING_PRE_REQUEST_COORDINATOR_TASK
    gateFingerprint: string
    claimArtifactName: 'request-started.json'
    authorizationConsumed: true
    atomicClaimStatus: 'claimed'
    fetchAllowed: false
    openAiCallable: false
    attemptedRequests: 0
    fetchCount: 0
    openAiRequests: 0
  } & (
    | Readonly<{
        status: 'CLAIMED_STOPPED'
        stage: 'ATOMIC_CLAIM_CREATED'
        nextRequiredAction: 'STOP_BEFORE_REQUEST_RUNTIME'
      }>
    | Readonly<{
        status: 'BLOCKED_ALREADY_CONSUMED'
        stage: 'CLAIM_ALREADY_EXISTS'
        nextRequiredAction: 'STOP'
      }>
  )>

function createBlockedCoordination(
  gateFingerprint: string,
  claimArtifactName: 'request-started.json',
): AiChartD1PalaceWritingPreviewPreRequestCoordination {
  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PRE_REQUEST_COORDINATOR_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_PRE_REQUEST_COORDINATOR_TASK,
    gateFingerprint,
    claimArtifactName,
    status: 'BLOCKED_ALREADY_CONSUMED' as const,
    stage: 'CLAIM_ALREADY_EXISTS' as const,
    authorizationConsumed: true as const,
    atomicClaimStatus: 'claimed' as const,
    nextRequiredAction: 'STOP' as const,
    fetchAllowed: false as const,
    openAiCallable: false as const,
    attemptedRequests: 0 as const,
    fetchCount: 0 as const,
    openAiRequests: 0 as const,
  })
}

export async function coordinateAiChartD1PalaceWritingPreviewPreRequest(
  gatePlanValue: unknown,
  authorizationValue: unknown,
): Promise<AiChartD1PalaceWritingPreviewPreRequestCoordination> {
  const gatePlan =
    parseAiChartD1PalaceWritingPreviewGatePlan(gatePlanValue)
  parseAiChartD1PalaceWritingPreviewAuthorization(
    authorizationValue,
    gatePlan,
  )
  const observation =
    await observeAiChartD1PalaceWritingPreviewClaim(gatePlan)
  const decision =
    evaluateAiChartD1PalaceWritingPreviewPreRequestGate(
      gatePlan,
      authorizationValue,
      observation,
    )
  if (decision.status !== 'READY_FOR_ATOMIC_CLAIM') {
    return createBlockedCoordination(
      gatePlan.gateFingerprint,
      gatePlan.claimArtifactName,
    )
  }

  let claim
  try {
    claim = await claimAiChartD1PalaceWritingPreviewExecution(
      gatePlan,
      authorizationValue,
    )
  } catch (error) {
    if (
      !(error instanceof
        AiChartD1PalaceWritingPreviewClaimAlreadyExistsError)
    ) {
      throw error
    }
    const racedObservation =
      await observeAiChartD1PalaceWritingPreviewClaim(gatePlan)
    const racedDecision =
      evaluateAiChartD1PalaceWritingPreviewPreRequestGate(
        gatePlan,
        authorizationValue,
        racedObservation,
      )
    if (racedDecision.status !== 'BLOCKED_ALREADY_CONSUMED') {
      throw error
    }
    return createBlockedCoordination(
      gatePlan.gateFingerprint,
      gatePlan.claimArtifactName,
    )
  }

  return freezeAiChartD1Value({
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PRE_REQUEST_COORDINATOR_VERSION,
    task:
      AI_CHART_D1_PALACE_WRITING_PRE_REQUEST_COORDINATOR_TASK,
    gateFingerprint: claim.gateFingerprint,
    claimArtifactName: claim.claimArtifactName,
    status: 'CLAIMED_STOPPED' as const,
    stage: 'ATOMIC_CLAIM_CREATED' as const,
    authorizationConsumed: true as const,
    atomicClaimStatus: 'claimed' as const,
    nextRequiredAction:
      'STOP_BEFORE_REQUEST_RUNTIME' as const,
    fetchAllowed: false as const,
    openAiCallable: false as const,
    attemptedRequests: 0 as const,
    fetchCount: 0 as const,
    openAiRequests: 0 as const,
  })
}
