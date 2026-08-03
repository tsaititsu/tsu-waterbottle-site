import type {
  LinePayCapabilityCallbackDiagnosticStage,
} from '../../../product-orders/line-pay/capabilityHandler'
import type {
  ProductOrderLinePayCapabilityDatabaseDiagnostic,
} from '../../../../../lib/supabase/linePayCapabilityRuntime'

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
  'confirmation_finalize_failed',
])

const SAFE_DATABASE_STAGES = new Set(['finalize_confirmation'])
const SAFE_DATABASE_RPCS = new Set([
  'finalize_product_order_line_pay_confirmation',
])
const SAFE_DATABASE_ROLES = new Set(['line_pay_payment_executor'])
const SQLSTATE_PATTERN = /^[0-9A-Z]{5}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeDatabaseDiagnostic(value: unknown) {
  if (
    !isRecord(value)
    || typeof value.stage !== 'string'
    || !SAFE_DATABASE_STAGES.has(value.stage)
    || typeof value.rpc !== 'string'
    || !SAFE_DATABASE_RPCS.has(value.rpc)
    || typeof value.databaseRole !== 'string'
    || !SAFE_DATABASE_ROLES.has(value.databaseRole)
    || (value.sqlstate !== null
      && (typeof value.sqlstate !== 'string'
        || !SQLSTATE_PATTERN.test(value.sqlstate)))
  ) {
    return null
  }

  return Object.freeze({
    stage: value.stage as ProductOrderLinePayCapabilityDatabaseDiagnostic['stage'],
    rpc: value.rpc as ProductOrderLinePayCapabilityDatabaseDiagnostic['rpc'],
    databaseRole:
      value.databaseRole as ProductOrderLinePayCapabilityDatabaseDiagnostic['databaseRole'],
    sqlstate: value.sqlstate as string | null,
  })
}

export async function buildLinePaySandboxE2eCallbackDiagnostic(
  purpose: 'confirm' | 'cancel',
  response: Response,
  observedStage?: LinePayCapabilityCallbackDiagnosticStage | null,
  databaseDiagnostic?: ProductOrderLinePayCapabilityDatabaseDiagnostic | null,
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
    database: safeDatabaseDiagnostic(databaseDiagnostic),
  })
}
