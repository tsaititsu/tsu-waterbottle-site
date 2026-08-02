import type {
  LinePayCapabilityCallbackDiagnosticStage,
} from '../../../product-orders/line-pay/capabilityHandler'

const SAFE_CALLBACK_ERRORS = new Set([
  'invalid_line_pay_callback',
  'line_pay_callback_consumed',
  'line_pay_callback_in_progress',
  'line_pay_callback_lookup_failed',
  'line_pay_callback_not_found',
  'line_pay_cancel_failed',
  'line_pay_config_invalid',
  'line_pay_confirmation_claim_failed',
  'line_pay_confirmation_reconciliation_required',
  'line_pay_disabled',
])

const SAFE_CALLBACK_STAGES = new Set<LinePayCapabilityCallbackDiagnosticStage>([
  'callback_order_id_invalid',
  'callback_capability_invalid',
  'callback_transaction_id_invalid',
  'callback_context_mismatch',
  'capability_claim_failed',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function buildLinePaySandboxE2eCallbackDiagnostic(
  purpose: 'confirm' | 'cancel',
  response: Response,
  observedStage?: LinePayCapabilityCallbackDiagnosticStage | null,
) {
  let payload: unknown = null
  try {
    payload = await response.clone().json()
  } catch {
    payload = null
  }

  let outcome = 'unknown_failure'
  if (isRecord(payload) && payload.ok === true) {
    outcome = purpose === 'confirm' ? 'confirmed' : 'canceled'
  } else if (
    isRecord(payload)
    && typeof payload.error === 'string'
    && SAFE_CALLBACK_ERRORS.has(payload.error)
  ) {
    outcome = payload.error
  }

  return Object.freeze({
    purpose,
    httpStatus: response.status,
    outcome,
    stage:
      observedStage && SAFE_CALLBACK_STAGES.has(observedStage)
        ? observedStage
        : 'not_observed',
  })
}
