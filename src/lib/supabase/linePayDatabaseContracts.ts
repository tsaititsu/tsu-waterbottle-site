export const LINE_PAY_DATABASE_ENVIRONMENTS = ['sandbox', 'production'] as const
export type LinePayDatabaseEnvironment = (typeof LINE_PAY_DATABASE_ENVIRONMENTS)[number]

export const LINE_PAY_REQUEST_STATES = [
  'initialized',
  'requesting',
  'pending',
  'confirmation_processing',
  'paid',
  'failed',
  'canceled',
  'reconciliation_required',
] as const
export type LinePayRequestState = (typeof LINE_PAY_REQUEST_STATES)[number]

export const LINE_PAY_ATTEMPT_STATES = [
  'initialized',
  'queued',
  'claimed',
  'requesting',
  'pending',
  'succeeded',
  'failed',
  'unknown',
  'reconciliation_required',
  'confirmation_processing',
  'paid',
  'canceled',
] as const
export type LinePayAttemptState = (typeof LINE_PAY_ATTEMPT_STATES)[number]

export type LinePayCallbackPurpose = 'confirm' | 'cancel'
export type LinePayCallbackEventState =
  | 'received'
  | 'claimed'
  | 'provider_verified'
  | 'completed'
  | 'failed'
  | 'reconciliation_required'

export type LinePayCheckoutAttemptRow = {
  id: string
  user_id: string
  product_order_id: string
  payment_id: string | null
  provider: 'line_pay'
  environment: LinePayDatabaseEnvironment
  idempotency_key: string
  request_body_sha256: string
  request_state: LinePayAttemptState
  amount_twd: number
  currency: 'TWD'
  attempt_count: number
  next_attempt_at: string | null
  claim_id: string | null
  claimed_at: string | null
  claim_expires_at: string | null
  upstream_transaction_id: string | null
  merchant_order_no: string
  sanitized_result: Record<string, string | number | boolean | null> | null
  last_error_code: string | null
  reconciliation_required: boolean
  state_version: number
  created_at: string
  updated_at: string
  completed_at: string | null
}

export type ClaimProductOrderLinePayRequestInput = {
  p_attempt_id: string
  p_environment: LinePayDatabaseEnvironment
  p_idempotency_key: string
  p_request_body_sha256: string
  p_claim_id: string
  p_claim_expires_at: string
}

export type LinePayRequestReplayResult = {
  attempt_id: string
  payment_id: string | null
  request_state: LinePayAttemptState
  upstream_transaction_id: string | null
  merchant_order_no: string
  sanitized_result: Record<string, string | number | boolean | null> | null
  last_error_code: string | null
  reconciliation_required: boolean
  completed_at: string | null
}

export type LinePayCallbackEventRow = {
  id: string
  capability_id: string
  payment_id: string
  product_order_id: string
  checkout_attempt_id: string
  environment: LinePayDatabaseEnvironment
  purpose: LinePayCallbackPurpose
  state: LinePayCallbackEventState
  claim_id: string | null
  claimed_at: string | null
  claim_expires_at: string | null
  provider_result_sha256: string | null
  safe_result_code: string | null
  last_error_code: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export type CompleteProductOrderLinePayConfirmationInput = {
  p_environment: LinePayDatabaseEnvironment
  p_payment_id: string
  p_product_order_id: string
  p_attempt_id: string
  p_merchant_order_no: string
  p_transaction_id: string
  p_amount_twd: number
  p_currency: 'TWD'
  p_capability_id: string
  p_callback_event_id: string
  p_callback_claim_id: string
  p_confirm_result_sha256: string
  p_request_id: string
  p_audit_evidence: Record<string, string | number | boolean | null>
  p_paid_at?: string | null
}

export type CompleteProductOrderLinePayConfirmationResult = {
  result_code: 'completed' | 'already_completed'
  payment_id: string
  product_order_id: string
  transaction_id: string
}

export type CancelProductOrderLinePayPaymentInput = {
  p_environment: LinePayDatabaseEnvironment
  p_payment_id: string
  p_product_order_id: string
  p_attempt_id: string
  p_capability_id: string
  p_callback_event_id: string
  p_callback_claim_id: string
  p_request_id: string
  p_reason_code: 'payment_canceled' | 'cancel_after_paid'
}

export type MarkProductOrderLinePayReconciliationInput = {
  p_environment: LinePayDatabaseEnvironment
  p_payment_id: string
  p_product_order_id: string
  p_attempt_id: string
  p_reason_code: string
  p_request_id: string
}

export type ProductOrderLinePayStateTransitionResult = {
  result_code: string
  payment_id: string
  product_order_id: string
  request_state: LinePayRequestState
}
