import assert from 'node:assert/strict'
import type {
  ClaimProductOrderLinePayRequestInput,
  CompleteProductOrderLinePayConfirmationResult,
  LinePayCheckoutAttemptRow,
  LinePayRequestRpcClient,
  RecordProductOrderLinePayRequestSuccessInput,
} from './linePayDatabaseContracts'

const {
  LinePayRequestDatabaseError,
  LINE_PAY_ATTEMPT_STATES,
  LINE_PAY_DATABASE_ENVIRONMENTS,
  LINE_PAY_REQUEST_STATES,
  createLinePayRequestDatabase,
} = (await import(
  new URL('./linePayDatabaseContracts.ts', import.meta.url).href
)) as typeof import('./linePayDatabaseContracts')

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

type RpcResponse = {
  data: unknown
  error: unknown
}

function createRpcClient(responses: RpcResponse[]) {
  const calls: Array<{
    functionName: string
    args: Record<string, unknown>
    mode: 'single' | 'maybeSingle'
  }> = []
  let responseIndex = 0

  const client: LinePayRequestRpcClient = {
    rpc(functionName, args) {
      const readResponse = (mode: 'single' | 'maybeSingle') => {
        calls.push({ functionName, args, mode })
        const response = responses[responseIndex]
        responseIndex += 1

        if (!response) {
          throw new Error('unexpected_rpc_call')
        }

        return Promise.resolve(response)
      }

      return {
        single: () => readResponse('single'),
        maybeSingle: () => readResponse('maybeSingle'),
      }
    },
  }

  return { calls, client }
}

const attemptId = '60000000-0000-4000-8000-000000000001'
const paymentId = '70000000-0000-4000-8000-000000000001'
const claimId = 'a0000000-0000-4000-8000-000000000001'
const idempotencyKey = 'contract-request-idempotency-1'
const requestBodySha256 = 'a'.repeat(64)
const responseSha256 = 'e'.repeat(64)
const merchantOrderNo = 'LP-CONTRACT-ORDER-1'
const claimInput: ClaimProductOrderLinePayRequestInput = {
  p_attempt_id: attemptId,
  p_environment: 'sandbox',
  p_idempotency_key: idempotencyKey,
  p_request_body_sha256: requestBodySha256,
  p_claim_id: claimId,
  p_claim_expires_at: '2026-07-28T12:02:00.000Z',
}
const successInput: RecordProductOrderLinePayRequestSuccessInput = {
  p_attempt_id: attemptId,
  p_environment: 'sandbox',
  p_idempotency_key: idempotencyKey,
  p_request_body_sha256: requestBodySha256,
  p_claim_id: claimId,
  p_upstream_transaction_id: transactionId,
  p_merchant_order_no: merchantOrderNo,
  p_sanitized_result: {
    result_code: '0000',
    provider_status: 'success',
    transaction_id: transactionId,
    merchant_order_no: merchantOrderNo,
    response_sha256: responseSha256,
  },
  p_request_id: 'request-contract-1',
}

const rpcMock = createRpcClient([
  {
    data: {
      result_code: 'claimed',
      attempt_id: attemptId,
      payment_id: paymentId,
      request_state: 'requesting',
      attempt_count: 1,
    },
    error: null,
  },
  {
    data: {
      result_code: 'recorded',
      attempt_id: attemptId,
      payment_id: paymentId,
      request_state: 'succeeded',
      upstream_transaction_id: transactionId,
    },
    error: null,
  },
  {
    data: {
      result_code: 'already_recorded',
      attempt_id: attemptId,
      payment_id: paymentId,
      request_state: 'failed',
    },
    error: null,
  },
  {
    data: {
      result_code: 'recorded',
      attempt_id: attemptId,
      payment_id: paymentId,
      request_state: 'unknown',
    },
    error: null,
  },
  {
    data: {
      attempt_id: attemptId,
      payment_id: paymentId,
      request_state: 'succeeded',
      upstream_transaction_id: transactionId,
      merchant_order_no: merchantOrderNo,
      sanitized_result: successInput.p_sanitized_result,
      last_error_code: null,
      reconciliation_required: false,
      completed_at: '2026-07-28T12:01:00.000Z',
    },
    error: null,
  },
  {
    data: null,
    error: null,
  },
])
const requestDatabase = createLinePayRequestDatabase(rpcMock.client)

const claimResult = await requestDatabase.claim({
  ...claimInput,
  ignored_secret: 'must-not-cross-rpc-contract',
} as ClaimProductOrderLinePayRequestInput & { ignored_secret: string })
assert.equal(claimResult.result_code, 'claimed')
assert.equal(claimResult.attempt_count, 1)
assert.equal(Object.isFrozen(claimResult), true)
assert.deepEqual(rpcMock.calls[0], {
  functionName: 'claim_product_order_line_pay_request',
  args: claimInput,
  mode: 'single',
})

const successResult = await requestDatabase.recordSuccess(successInput)
assert.equal(successResult.upstream_transaction_id, transactionId)
assert.equal(typeof successResult.upstream_transaction_id, 'string')
assert.equal(Object.isFrozen(successResult), true)
assert.deepEqual(rpcMock.calls[1], {
  functionName: 'record_product_order_line_pay_request_success',
  args: successInput,
  mode: 'single',
})

const failureResult = await requestDatabase.recordFailure({
  ...claimInput,
  p_error_code: 'upstream_declined',
  p_request_id: 'request-failure-1',
})
assert.equal(failureResult.request_state, 'failed')
assert.deepEqual(rpcMock.calls[2], {
  functionName: 'record_product_order_line_pay_request_failure',
  args: {
    p_attempt_id: attemptId,
    p_environment: 'sandbox',
    p_idempotency_key: idempotencyKey,
    p_request_body_sha256: requestBodySha256,
    p_claim_id: claimId,
    p_error_code: 'upstream_declined',
    p_request_id: 'request-failure-1',
  },
  mode: 'single',
})

const unknownResult = await requestDatabase.markUnknown({
  ...claimInput,
  p_error_code: 'upstream_result_unknown',
})
assert.equal(unknownResult.request_state, 'unknown')
assert.deepEqual(rpcMock.calls[3], {
  functionName: 'mark_product_order_line_pay_request_unknown',
  args: {
    p_attempt_id: attemptId,
    p_environment: 'sandbox',
    p_idempotency_key: idempotencyKey,
    p_request_body_sha256: requestBodySha256,
    p_claim_id: claimId,
    p_error_code: 'upstream_result_unknown',
    p_request_id: null,
  },
  mode: 'single',
})

const replayResult = await requestDatabase.readResult({
  p_attempt_id: attemptId,
  p_environment: 'sandbox',
  p_idempotency_key: idempotencyKey,
  p_request_body_sha256: requestBodySha256,
})
assert.equal(replayResult?.upstream_transaction_id, transactionId)
assert.equal(typeof replayResult?.upstream_transaction_id, 'string')
assert.equal(Object.isFrozen(replayResult), true)
assert.equal(Object.isFrozen(replayResult?.sanitized_result), true)
assert.equal(
  await requestDatabase.readResult({
    p_attempt_id: attemptId,
    p_environment: 'sandbox',
    p_idempotency_key: idempotencyKey,
    p_request_body_sha256: 'b'.repeat(64),
  }),
  null,
)
assert.deepEqual(
  rpcMock.calls.slice(4).map(({ functionName, mode }) => ({
    functionName,
    mode,
  })),
  [
    {
      functionName: 'read_product_order_line_pay_request_result',
      mode: 'maybeSingle',
    },
    {
      functionName: 'read_product_order_line_pay_request_result',
      mode: 'maybeSingle',
    },
  ],
)

const invalidInputMock = createRpcClient([])
const invalidInputDatabase = createLinePayRequestDatabase(invalidInputMock.client)
await assert.rejects(
  () =>
    invalidInputDatabase.claim({
      ...claimInput,
      p_request_body_sha256: 'not-a-sha256',
    }),
  (error: unknown) =>
    error instanceof LinePayRequestDatabaseError &&
    error.code === 'invalid_input' &&
    error.message === 'line_pay_request_database_error',
)
assert.equal(invalidInputMock.calls.length, 0)

const databaseErrorMock = createRpcClient([
  {
    data: null,
    error: {
      code: '42501',
      message: 'sensitive-provider-diagnostic',
    },
  },
])
await assert.rejects(
  () => createLinePayRequestDatabase(databaseErrorMock.client).claim(claimInput),
  (error: unknown) =>
    error instanceof LinePayRequestDatabaseError &&
    error.code === 'rpc_failed' &&
    error.message === 'line_pay_request_database_error' &&
    !JSON.stringify(error).includes('sensitive-provider-diagnostic'),
)

const contractMismatchMock = createRpcClient([
  {
    data: {
      result_code: 'claimed',
      attempt_id: attemptId,
      payment_id: paymentId,
      request_state: 'requesting',
      attempt_count: 1,
      unexpected_payload: 'must-fail-closed',
    },
    error: null,
  },
])
await assert.rejects(
  () => createLinePayRequestDatabase(contractMismatchMock.client).claim(claimInput),
  (error: unknown) =>
    error instanceof LinePayRequestDatabaseError &&
    error.code === 'contract_mismatch' &&
    error.message === 'line_pay_request_database_error',
)
