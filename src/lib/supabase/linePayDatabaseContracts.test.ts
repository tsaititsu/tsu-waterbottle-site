import assert from 'node:assert/strict'
import {
  LINE_PAY_ATTEMPT_STATES,
  LINE_PAY_DATABASE_ENVIRONMENTS,
  LINE_PAY_REQUEST_STATES,
  type CompleteProductOrderLinePayConfirmationResult,
  type LinePayCheckoutAttemptRow,
} from './linePayDatabaseContracts'

assert.deepEqual(LINE_PAY_DATABASE_ENVIRONMENTS, ['sandbox', 'production'])
assert.deepEqual(LINE_PAY_REQUEST_STATES, [
  'initialized',
  'requesting',
  'pending',
  'confirmation_processing',
  'paid',
  'failed',
  'canceled',
  'reconciliation_required',
])
assert.ok(LINE_PAY_ATTEMPT_STATES.includes('unknown'))
assert.ok(LINE_PAY_ATTEMPT_STATES.includes('reconciliation_required'))
assert.ok(LINE_PAY_ATTEMPT_STATES.includes('paid'))

const transactionId = '92233720368547758081234567890'
const attempt: LinePayCheckoutAttemptRow = {
  id: 'attempt-id',
  user_id: 'user-id',
  product_order_id: 'order-id',
  payment_id: 'payment-id',
  provider: 'line_pay',
  environment: 'sandbox',
  idempotency_key: 'request-idempotency-key',
  request_body_sha256: 'a'.repeat(64),
  request_state: 'succeeded',
  amount_twd: 100,
  currency: 'TWD',
  attempt_count: 1,
  next_attempt_at: null,
  claim_id: 'claim-id',
  claimed_at: '2026-07-19T00:00:00.000Z',
  claim_expires_at: '2026-07-19T00:05:00.000Z',
  upstream_transaction_id: transactionId,
  merchant_order_no: 'LP-ORDER-1',
  sanitized_result: { result_code: '0000', transaction_id: transactionId },
  last_error_code: null,
  reconciliation_required: false,
  state_version: 2,
  created_at: '2026-07-19T00:00:00.000Z',
  updated_at: '2026-07-19T00:01:00.000Z',
  completed_at: '2026-07-19T00:01:00.000Z',
}

const completion: CompleteProductOrderLinePayConfirmationResult = {
  result_code: 'completed',
  payment_id: attempt.payment_id ?? '',
  product_order_id: attempt.product_order_id,
  transaction_id: transactionId,
}

assert.equal(typeof attempt.upstream_transaction_id, 'string')
assert.equal(attempt.upstream_transaction_id, transactionId)
assert.equal(completion.transaction_id, transactionId)
