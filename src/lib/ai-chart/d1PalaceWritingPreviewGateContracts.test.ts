import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  buildAiChartD1PalaceWritingGoldenCase,
} from './d1PalaceWritingGoldenCaseContracts'
import {
  buildAiChartD1PalaceWritingPreviewPlan,
} from './d1PalaceWritingPreviewContracts'
import {
  AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_ACKNOWLEDGEMENT,
  AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_MODE,
  AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_VERSION,
  AI_CHART_D1_PALACE_WRITING_PREVIEW_CLAIM_OBSERVATION_VERSION,
  AI_CHART_D1_PALACE_WRITING_PREVIEW_GATE_VERSION,
  buildAiChartD1PalaceWritingPreviewGatePlan,
  evaluateAiChartD1PalaceWritingPreviewPreRequestGate,
  parseAiChartD1PalaceWritingPreviewAuthorization,
  parseAiChartD1PalaceWritingPreviewGatePlan,
} from './d1PalaceWritingPreviewGateContracts'

let checks = 0

function check(name: string, run: () => void): void {
  try {
    run()
    checks += 1
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

function recursivelyFrozen(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true
  if (!Object.isFrozen(value)) return false
  return Reflect.ownKeys(value).every((key) =>
    recursivelyFrozen(
      (value as Record<PropertyKey, unknown>)[key],
    ),
  )
}

const goldenCase = buildAiChartD1PalaceWritingGoldenCase()
const previewPlan =
  buildAiChartD1PalaceWritingPreviewPlan(goldenCase)
const gatePlan =
  buildAiChartD1PalaceWritingPreviewGatePlan(previewPlan)

check('pre-request Gate Plan binds the non-callable Preview and requires an atomic claim before fetch', () => {
  const gatePlan =
    buildAiChartD1PalaceWritingPreviewGatePlan(previewPlan)

  assert.equal(
    gatePlan.contractVersion,
    AI_CHART_D1_PALACE_WRITING_PREVIEW_GATE_VERSION,
  )
  assert.equal(gatePlan.fixtureId, previewPlan.fixtureId)
  assert.equal(
    gatePlan.previewPlanFingerprint,
    previewPlan.planFingerprint,
  )
  assert.deepEqual(gatePlan.requestSequence, [
    'WRITING',
    'FIDELITY_REVIEW',
  ])
  assert.equal(gatePlan.maxRequests, 2)
  assert.equal(gatePlan.fetchHardLimit, 2)
  assert.equal(gatePlan.retry, false)
  assert.equal(gatePlan.serverOnly, true)
  assert.equal(gatePlan.environmentPolicy, 'local_development_only')
  assert.equal(gatePlan.authorizationStatus, 'authorization_required')
  assert.equal(gatePlan.atomicClaimStatus, 'not_claimed')
  assert.equal(
    gatePlan.claimObservationAuthority,
    'TRUSTED_ATOMIC_STORAGE_ADAPTER_REQUIRED',
  )
  assert.equal(gatePlan.claimScope, 'GATE_FINGERPRINT')
  assert.equal(gatePlan.claimArtifactName, 'request-started.json')
  assert.equal(gatePlan.atomicCreateRequired, true)
  assert.equal(gatePlan.claimRequiredBeforeFetch, true)
  assert.equal(
    gatePlan.authorizationConsumedAt,
    'ATOMIC_CLAIM_CREATED',
  )
  assert.equal(gatePlan.reentryPolicy, 'FORBIDDEN_AFTER_CLAIM')
  assert.equal(gatePlan.runtimeStatus, 'pre_request_gate_only')
  assert.equal(gatePlan.fetchAllowed, false)
  assert.equal(gatePlan.openAiCallable, false)
  assert.deepEqual(
    parseAiChartD1PalaceWritingPreviewGatePlan(gatePlan),
    gatePlan,
  )
  assert.equal(recursivelyFrozen(gatePlan), true)
})

function buildAuthorizationValue(): Record<string, unknown> {
  return {
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_VERSION,
    task: 'D1_PALACE_WRITING_PREVIEW_AUTHORIZATION',
    mode: AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_MODE,
    fixtureId: gatePlan.fixtureId,
    caseFingerprint: gatePlan.caseFingerprint,
    previewPlanFingerprint: gatePlan.previewPlanFingerprint,
    gateFingerprint: gatePlan.gateFingerprint,
    maxRequests: 2,
    fetchHardLimit: 2,
    retry: false,
    acknowledgement:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_ACKNOWLEDGEMENT,
  }
}

check('explicit one-shot authorization is exact, fingerprint-bound, immutable, and does not itself consume the claim', () => {
  const authorization =
    parseAiChartD1PalaceWritingPreviewAuthorization(
      buildAuthorizationValue(),
      gatePlan,
    )

  assert.equal(
    authorization.contractVersion,
    AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_VERSION,
  )
  assert.equal(
    authorization.mode,
    AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_MODE,
  )
  assert.equal(
    authorization.gateFingerprint,
    gatePlan.gateFingerprint,
  )
  assert.equal(authorization.maxRequests, 2)
  assert.equal(authorization.fetchHardLimit, 2)
  assert.equal(authorization.retry, false)
  assert.equal(
    authorization.acknowledgement,
    AI_CHART_D1_PALACE_WRITING_PREVIEW_AUTHORIZATION_ACKNOWLEDGEMENT,
  )
  assert.equal(recursivelyFrozen(authorization), true)

  const changedFingerprint = buildAuthorizationValue()
  changedFingerprint.gateFingerprint = 'f'.repeat(64)
  assert.throws(() =>
    parseAiChartD1PalaceWritingPreviewAuthorization(
      changedFingerprint,
      gatePlan,
    ),
  )

  const booleanAuthorization = buildAuthorizationValue()
  booleanAuthorization.acknowledgement = true
  assert.throws(() =>
    parseAiChartD1PalaceWritingPreviewAuthorization(
      booleanAuthorization,
      gatePlan,
    ),
  )
})

function buildClaimObservationValue(
  state: 'ABSENT' | 'PRESENT',
): Record<string, unknown> {
  return {
    contractVersion:
      AI_CHART_D1_PALACE_WRITING_PREVIEW_CLAIM_OBSERVATION_VERSION,
    task: 'D1_PALACE_WRITING_PREVIEW_CLAIM_OBSERVATION',
    gateFingerprint: gatePlan.gateFingerprint,
    authority: 'TRUSTED_ATOMIC_STORAGE_ADAPTER',
    claimArtifactName: 'request-started.json',
    state,
  }
}

check('absent claim reaches only atomic-claim readiness and never grants fetch authority', () => {
  const decision =
    evaluateAiChartD1PalaceWritingPreviewPreRequestGate(
      gatePlan,
      buildAuthorizationValue(),
      buildClaimObservationValue('ABSENT'),
    )

  assert.equal(decision.status, 'READY_FOR_ATOMIC_CLAIM')
  assert.equal(decision.stage, 'PRE_REQUEST_VALIDATED')
  assert.equal(
    decision.authorizationStatus,
    'validated_not_consumed',
  )
  assert.equal(decision.atomicClaimStatus, 'not_claimed')
  assert.equal(decision.authorizationConsumed, false)
  assert.equal(
    decision.nextRequiredAction,
    'CREATE_ATOMIC_CLAIM_EXCLUSIVELY',
  )
  assert.equal(decision.fetchAllowed, false)
  assert.equal(decision.openAiCallable, false)
  assert.equal(decision.attemptedRequests, 0)
  assert.equal(decision.fetchCount, 0)
  assert.equal(decision.openAiRequests, 0)
  assert.equal(recursivelyFrozen(decision), true)
})

check('existing claim blocks re-entry and treats the one-shot authorization as already consumed', () => {
  const decision =
    evaluateAiChartD1PalaceWritingPreviewPreRequestGate(
      gatePlan,
      buildAuthorizationValue(),
      buildClaimObservationValue('PRESENT'),
    )

  assert.equal(decision.status, 'BLOCKED_ALREADY_CONSUMED')
  assert.equal(decision.stage, 'CLAIM_ALREADY_EXISTS')
  assert.equal(
    decision.authorizationStatus,
    'consumed_or_unavailable',
  )
  assert.equal(decision.atomicClaimStatus, 'claimed')
  assert.equal(decision.authorizationConsumed, true)
  assert.equal(decision.nextRequiredAction, 'STOP')
  assert.equal(decision.fetchAllowed, false)
  assert.equal(decision.openAiRequests, 0)

  const forgedAuthority = buildClaimObservationValue('ABSENT')
  forgedAuthority.authority = 'CLIENT_REPORTED'
  assert.throws(() =>
    evaluateAiChartD1PalaceWritingPreviewPreRequestGate(
      gatePlan,
      buildAuthorizationValue(),
      forgedAuthority,
    ),
  )

  const staleObservation = buildClaimObservationValue('ABSENT')
  staleObservation.gateFingerprint = 'e'.repeat(64)
  assert.throws(() =>
    evaluateAiChartD1PalaceWritingPreviewPreRequestGate(
      gatePlan,
      buildAuthorizationValue(),
      staleObservation,
    ),
  )
})

check('Gate bindings fail closed on plan, authorization, or claim-shape tampering', () => {
  const changedPlan = structuredClone(gatePlan) as Record<
    string,
    unknown
  >
  changedPlan.fetchAllowed = true
  assert.throws(() =>
    parseAiChartD1PalaceWritingPreviewGatePlan(changedPlan),
  )

  const extraAuthorization = buildAuthorizationValue()
  extraAuthorization.apiKey = 'forbidden'
  assert.throws(() =>
    parseAiChartD1PalaceWritingPreviewAuthorization(
      extraAuthorization,
      gatePlan,
    ),
  )

  const unknownClaimState = buildClaimObservationValue('ABSENT')
  unknownClaimState.state = 'UNKNOWN'
  assert.throws(() =>
    evaluateAiChartD1PalaceWritingPreviewPreRequestGate(
      gatePlan,
      buildAuthorizationValue(),
      unknownClaimState,
    ),
  )
})

check('authorization and decisions serialize without secrets, prompts, model output, chart, or birth data', () => {
  const authorization =
    parseAiChartD1PalaceWritingPreviewAuthorization(
      buildAuthorizationValue(),
      gatePlan,
    )
  const decision =
    evaluateAiChartD1PalaceWritingPreviewPreRequestGate(
      gatePlan,
      authorization,
      buildClaimObservationValue('ABSENT'),
    )
  const serialized = JSON.stringify({ authorization, decision })

  for (const forbidden of [
    '"apiKey"',
    '"authorizationHeader"',
    '"prompt"',
    '"instructions"',
    '"userInput"',
    '"requestBody"',
    '"outputText"',
    '"output_text"',
    '"chartSnapshot"',
    '"birthDate"',
    '"birthTime"',
  ]) {
    assert.equal(
      serialized.toLowerCase().includes(forbidden.toLowerCase()),
      false,
    )
  }
})

check('Gate Contract remains pure offline policy and cannot create a claim or send a request', () => {
  const source = readFileSync(
    fileURLToPath(
      new URL(
        './d1PalaceWritingPreviewGateContracts.ts',
        import.meta.url,
      ),
    ),
    'utf8',
  )
  assert.doesNotMatch(
    source,
    /node:fs|fetch\s*\(|process\.env|OPENAI_API_KEY|authorizationHeader|Bearer\s|\.server|requestAiChartOpenAiStructuredResponse|createAtomicClaim|writeFile/,
  )
})

console.log(
  `AI Chart D1 palace-writing Preview Gate contract checks passed: ${checks}`,
)
