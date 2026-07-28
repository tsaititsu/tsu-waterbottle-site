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

export type RecordProductOrderLinePayRequestSuccessInput = {
  p_attempt_id: string
  p_environment: LinePayDatabaseEnvironment
  p_idempotency_key: string
  p_request_body_sha256: string
  p_claim_id: string
  p_upstream_transaction_id: string
  p_merchant_order_no: string
  p_sanitized_result: Record<string, string>
  p_request_id?: string | null
}

export type RecordProductOrderLinePayRequestFailureInput = {
  p_attempt_id: string
  p_environment: LinePayDatabaseEnvironment
  p_idempotency_key: string
  p_request_body_sha256: string
  p_claim_id: string
  p_error_code: string
  p_request_id?: string | null
}

export type MarkProductOrderLinePayRequestUnknownInput =
  RecordProductOrderLinePayRequestFailureInput

export type ReadProductOrderLinePayRequestResultInput = {
  p_attempt_id: string
  p_environment: LinePayDatabaseEnvironment
  p_idempotency_key: string
  p_request_body_sha256: string
}

export type ClaimProductOrderLinePayRequestResult = {
  result_code:
    | 'claimed'
    | 'already_claimed'
    | 'already_succeeded'
    | 'claim_busy'
    | 'reconciliation_required'
    | 'terminal'
  attempt_id: string
  payment_id: string
  request_state: LinePayAttemptState
  attempt_count: number
}

export type RecordProductOrderLinePayRequestSuccessResult = {
  result_code: 'recorded' | 'already_recorded'
  attempt_id: string
  payment_id: string
  request_state: 'succeeded' | 'paid'
  upstream_transaction_id: string
}

export type RecordProductOrderLinePayRequestOutcomeResult = {
  result_code: 'recorded' | 'already_recorded'
  attempt_id: string
  payment_id: string
  request_state: 'failed' | 'unknown' | 'reconciliation_required'
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

export type LinePayRequestDatabaseOperation =
  | 'claim'
  | 'record_success'
  | 'record_failure'
  | 'mark_unknown'
  | 'read_result'

export type LinePayRequestDatabaseErrorCode =
  | 'invalid_input'
  | 'rpc_failed'
  | 'contract_mismatch'

export class LinePayRequestDatabaseError extends Error {
  readonly code: LinePayRequestDatabaseErrorCode
  readonly operation: LinePayRequestDatabaseOperation

  constructor(
    code: LinePayRequestDatabaseErrorCode,
    operation: LinePayRequestDatabaseOperation,
  ) {
    super('line_pay_request_database_error')
    this.name = 'LinePayRequestDatabaseError'
    this.code = code
    this.operation = operation
  }
}

type LinePayRequestRpcResponse = {
  data: unknown
  error: unknown
}

type LinePayRequestRpcBuilder = {
  single: () => PromiseLike<LinePayRequestRpcResponse>
  maybeSingle: () => PromiseLike<LinePayRequestRpcResponse>
}

export type LinePayRequestRpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => LinePayRequestRpcBuilder
}

export type LinePayRequestDatabase = {
  claim: (
    input: ClaimProductOrderLinePayRequestInput,
  ) => Promise<ClaimProductOrderLinePayRequestResult>
  recordSuccess: (
    input: RecordProductOrderLinePayRequestSuccessInput,
  ) => Promise<RecordProductOrderLinePayRequestSuccessResult>
  recordFailure: (
    input: RecordProductOrderLinePayRequestFailureInput,
  ) => Promise<RecordProductOrderLinePayRequestOutcomeResult>
  markUnknown: (
    input: MarkProductOrderLinePayRequestUnknownInput,
  ) => Promise<RecordProductOrderLinePayRequestOutcomeResult>
  readResult: (
    input: ReadProductOrderLinePayRequestResultInput,
  ) => Promise<LinePayRequestReplayResult | null>
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SHA256_PATTERN = /^[0-9a-f]{64}$/
const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/
const SAFE_ERROR_CODE_PATTERN = /^[a-z0-9_:-]{1,64}$/
const SAFE_PROVIDER_IDENTIFIER_PATTERN = /^[A-Za-z0-9_:-]+$/
const BLOCKED_FAKE_CREDENTIAL_ERROR_CODE_PATTERN =
  /^fake_test_(token|signature|authorization)_do_not_use$/
const CLAIM_RESULT_CODES = new Set([
  'claimed',
  'already_claimed',
  'already_succeeded',
  'claim_busy',
  'reconciliation_required',
  'terminal',
])
const REQUEST_OUTCOME_RESULT_CODES = new Set(['recorded', 'already_recorded'])
const SANITIZED_RESULT_KEYS = new Set([
  'result_code',
  'provider_status',
  'transaction_id',
  'merchant_order_no',
  'response_sha256',
])

function invalidInput(operation: LinePayRequestDatabaseOperation): never {
  throw new LinePayRequestDatabaseError('invalid_input', operation)
}

function contractMismatch(operation: LinePayRequestDatabaseOperation): never {
  throw new LinePayRequestDatabaseError('contract_mismatch', operation)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readExactRecord(
  value: unknown,
  expectedKeys: readonly string[],
  operation: LinePayRequestDatabaseOperation,
) {
  if (!isRecord(value)) contractMismatch(operation)

  const actualKeys = Object.keys(value).sort()
  const sortedExpectedKeys = [...expectedKeys].sort()

  if (
    actualKeys.length !== sortedExpectedKeys.length ||
    actualKeys.some((key, index) => key !== sortedExpectedKeys[index])
  ) {
    contractMismatch(operation)
  }

  return value
}

function assertUuid(
  value: unknown,
  operation: LinePayRequestDatabaseOperation,
) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    invalidInput(operation)
  }
  return value
}

function assertEnvironment(
  value: unknown,
  operation: LinePayRequestDatabaseOperation,
): LinePayDatabaseEnvironment {
  if (value !== 'sandbox' && value !== 'production') {
    invalidInput(operation)
  }
  return value
}

function assertIdempotencyKey(
  value: unknown,
  operation: LinePayRequestDatabaseOperation,
) {
  if (
    typeof value !== 'string' ||
    value.length < 16 ||
    value.length > 200
  ) {
    invalidInput(operation)
  }
  return value
}

function assertSha256(
  value: unknown,
  operation: LinePayRequestDatabaseOperation,
) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    invalidInput(operation)
  }
  return value
}

function assertRequestId(
  value: unknown,
  operation: LinePayRequestDatabaseOperation,
) {
  if (
    value !== null &&
    value !== undefined &&
    (typeof value !== 'string' || !SAFE_REQUEST_ID_PATTERN.test(value))
  ) {
    invalidInput(operation)
  }
  return value ?? null
}

function assertErrorCode(
  value: unknown,
  operation: LinePayRequestDatabaseOperation,
) {
  if (
    typeof value !== 'string' ||
    !SAFE_ERROR_CODE_PATTERN.test(value) ||
    BLOCKED_FAKE_CREDENTIAL_ERROR_CODE_PATTERN.test(value)
  ) {
    invalidInput(operation)
  }
  return value
}

function assertProviderIdentifier(
  value: unknown,
  maxLength: number,
  operation: LinePayRequestDatabaseOperation,
) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maxLength ||
    !SAFE_PROVIDER_IDENTIFIER_PATTERN.test(value)
  ) {
    invalidInput(operation)
  }
  return value
}

function assertIsoDate(
  value: unknown,
  operation: LinePayRequestDatabaseOperation,
) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    Number.isNaN(Date.parse(value))
  ) {
    invalidInput(operation)
  }
  return value
}

function buildReadInput(
  input: ReadProductOrderLinePayRequestResultInput,
  operation: LinePayRequestDatabaseOperation,
) {
  return {
    p_attempt_id: assertUuid(input.p_attempt_id, operation),
    p_environment: assertEnvironment(input.p_environment, operation),
    p_idempotency_key: assertIdempotencyKey(
      input.p_idempotency_key,
      operation,
    ),
    p_request_body_sha256: assertSha256(
      input.p_request_body_sha256,
      operation,
    ),
  }
}

function buildClaimIdentityInput(
  input:
    | ClaimProductOrderLinePayRequestInput
    | RecordProductOrderLinePayRequestSuccessInput
    | RecordProductOrderLinePayRequestFailureInput,
  operation: LinePayRequestDatabaseOperation,
) {
  return {
    ...buildReadInput(input, operation),
    p_claim_id: assertUuid(input.p_claim_id, operation),
  }
}

function readSanitizedResult(
  value: unknown,
  operation: LinePayRequestDatabaseOperation,
) {
  if (!isRecord(value)) invalidInput(operation)

  const keys = Object.keys(value)
  if (
    keys.some((key) => !SANITIZED_RESULT_KEYS.has(key)) ||
    !keys.includes('result_code') ||
    !keys.includes('transaction_id') ||
    !keys.includes('merchant_order_no') ||
    !keys.includes('response_sha256') ||
    Object.values(value).some((entry) => typeof entry !== 'string') ||
    value.result_code !== '0000' ||
    (value.provider_status !== undefined &&
      value.provider_status !== 'success') ||
    typeof value.transaction_id !== 'string' ||
    !SAFE_PROVIDER_IDENTIFIER_PATTERN.test(value.transaction_id) ||
    value.transaction_id.length > 128 ||
    typeof value.merchant_order_no !== 'string' ||
    !SAFE_PROVIDER_IDENTIFIER_PATTERN.test(value.merchant_order_no) ||
    value.merchant_order_no.length > 100 ||
    typeof value.response_sha256 !== 'string' ||
    !SHA256_PATTERN.test(value.response_sha256)
  ) {
    invalidInput(operation)
  }

  return Object.freeze(
    Object.fromEntries(keys.map((key) => [key, value[key] as string])),
  )
}

function readUuidResult(
  value: unknown,
  operation: LinePayRequestDatabaseOperation,
) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    contractMismatch(operation)
  }
  return value
}

function readStringResult(
  value: unknown,
  operation: LinePayRequestDatabaseOperation,
) {
  if (typeof value !== 'string' || value.length === 0) {
    contractMismatch(operation)
  }
  return value
}

function readNullableStringResult(
  value: unknown,
  operation: LinePayRequestDatabaseOperation,
) {
  if (value !== null && typeof value !== 'string') {
    contractMismatch(operation)
  }
  return value
}

function readAttemptState(
  value: unknown,
  operation: LinePayRequestDatabaseOperation,
) {
  if (
    typeof value !== 'string' ||
    !(LINE_PAY_ATTEMPT_STATES as readonly string[]).includes(value)
  ) {
    contractMismatch(operation)
  }
  return value as LinePayAttemptState
}

function parseClaimResult(
  value: unknown,
): ClaimProductOrderLinePayRequestResult {
  const operation = 'claim'
  const row = readExactRecord(
    value,
    [
      'result_code',
      'attempt_id',
      'payment_id',
      'request_state',
      'attempt_count',
    ],
    operation,
  )
  const resultCode = readStringResult(row.result_code, operation)
  const requestState = readAttemptState(row.request_state, operation)

  if (
    !CLAIM_RESULT_CODES.has(resultCode) ||
    !Number.isInteger(row.attempt_count) ||
    Number(row.attempt_count) < 0 ||
    ((resultCode === 'claimed' || resultCode === 'already_claimed') &&
      requestState !== 'requesting') ||
    (resultCode === 'already_succeeded' &&
      requestState !== 'succeeded' &&
      requestState !== 'paid') ||
    (resultCode === 'reconciliation_required' &&
      requestState !== 'unknown' &&
      requestState !== 'reconciliation_required') ||
    (resultCode === 'terminal' &&
      requestState !== 'failed' &&
      requestState !== 'canceled') ||
    (resultCode === 'claim_busy' &&
      requestState !== 'requesting' &&
      requestState !== 'claimed')
  ) {
    contractMismatch(operation)
  }

  return Object.freeze({
    result_code:
      resultCode as ClaimProductOrderLinePayRequestResult['result_code'],
    attempt_id: readUuidResult(row.attempt_id, operation),
    payment_id: readUuidResult(row.payment_id, operation),
    request_state: requestState,
    attempt_count: Number(row.attempt_count),
  })
}

function parseSuccessResult(
  value: unknown,
): RecordProductOrderLinePayRequestSuccessResult {
  const operation = 'record_success'
  const row = readExactRecord(
    value,
    [
      'result_code',
      'attempt_id',
      'payment_id',
      'request_state',
      'upstream_transaction_id',
    ],
    operation,
  )
  const resultCode = readStringResult(row.result_code, operation)
  const requestState = readStringResult(row.request_state, operation)
  const transactionId = readStringResult(
    row.upstream_transaction_id,
    operation,
  )

  if (
    !REQUEST_OUTCOME_RESULT_CODES.has(resultCode) ||
    (requestState !== 'succeeded' && requestState !== 'paid') ||
    transactionId.length > 128 ||
    !SAFE_PROVIDER_IDENTIFIER_PATTERN.test(transactionId)
  ) {
    contractMismatch(operation)
  }

  return Object.freeze({
    result_code:
      resultCode as RecordProductOrderLinePayRequestSuccessResult['result_code'],
    attempt_id: readUuidResult(row.attempt_id, operation),
    payment_id: readUuidResult(row.payment_id, operation),
    request_state:
      requestState as RecordProductOrderLinePayRequestSuccessResult['request_state'],
    upstream_transaction_id: transactionId,
  })
}

function parseOutcomeResult(
  value: unknown,
  operation: 'record_failure' | 'mark_unknown',
): RecordProductOrderLinePayRequestOutcomeResult {
  const row = readExactRecord(
    value,
    ['result_code', 'attempt_id', 'payment_id', 'request_state'],
    operation,
  )
  const resultCode = readStringResult(row.result_code, operation)
  const requestState = readStringResult(row.request_state, operation)
  const stateIsValid =
    operation === 'record_failure'
      ? requestState === 'failed'
      : requestState === 'unknown' ||
        requestState === 'reconciliation_required'

  if (!REQUEST_OUTCOME_RESULT_CODES.has(resultCode) || !stateIsValid) {
    contractMismatch(operation)
  }

  return Object.freeze({
    result_code:
      resultCode as RecordProductOrderLinePayRequestOutcomeResult['result_code'],
    attempt_id: readUuidResult(row.attempt_id, operation),
    payment_id: readUuidResult(row.payment_id, operation),
    request_state:
      requestState as RecordProductOrderLinePayRequestOutcomeResult['request_state'],
  })
}

function parseReplayResult(value: unknown): LinePayRequestReplayResult {
  const operation = 'read_result'
  const row = readExactRecord(
    value,
    [
      'attempt_id',
      'payment_id',
      'request_state',
      'upstream_transaction_id',
      'merchant_order_no',
      'sanitized_result',
      'last_error_code',
      'reconciliation_required',
      'completed_at',
    ],
    operation,
  )
  const paymentId =
    row.payment_id === null
      ? null
      : readUuidResult(row.payment_id, operation)
  const completedAt =
    row.completed_at === null
      ? null
      : (() => {
          if (
            typeof row.completed_at !== 'string' ||
            Number.isNaN(Date.parse(row.completed_at))
          ) {
            contractMismatch(operation)
          }
          return row.completed_at
        })()
  const sanitizedResult =
    row.sanitized_result === null
      ? null
      : (() => {
          try {
            return readSanitizedResult(row.sanitized_result, operation)
          } catch {
            contractMismatch(operation)
          }
        })()

  if (typeof row.reconciliation_required !== 'boolean') {
    contractMismatch(operation)
  }

  return Object.freeze({
    attempt_id: readUuidResult(row.attempt_id, operation),
    payment_id: paymentId,
    request_state: readAttemptState(row.request_state, operation),
    upstream_transaction_id: readNullableStringResult(
      row.upstream_transaction_id,
      operation,
    ),
    merchant_order_no: readStringResult(row.merchant_order_no, operation),
    sanitized_result: sanitizedResult,
    last_error_code: readNullableStringResult(
      row.last_error_code,
      operation,
    ),
    reconciliation_required: row.reconciliation_required,
    completed_at: completedAt,
  })
}

async function executeRpc<T>(
  client: LinePayRequestRpcClient,
  operation: LinePayRequestDatabaseOperation,
  functionName: string,
  args: Record<string, unknown>,
  mode: 'single' | 'maybeSingle',
  parse: (value: unknown) => T,
): Promise<T | null> {
  let response: LinePayRequestRpcResponse

  try {
    const builder = client.rpc(functionName, args)
    response =
      mode === 'single'
        ? await builder.single()
        : await builder.maybeSingle()
  } catch {
    throw new LinePayRequestDatabaseError('rpc_failed', operation)
  }

  if (response.error) {
    throw new LinePayRequestDatabaseError('rpc_failed', operation)
  }

  if (mode === 'maybeSingle' && response.data === null) return null

  try {
    return parse(response.data)
  } catch (error) {
    if (
      error instanceof LinePayRequestDatabaseError &&
      error.code === 'contract_mismatch'
    ) {
      throw error
    }
    throw new LinePayRequestDatabaseError('contract_mismatch', operation)
  }
}

export function createLinePayRequestDatabase(
  client: LinePayRequestRpcClient,
): LinePayRequestDatabase {
  return Object.freeze({
    async claim(input) {
      const operation = 'claim'
      const args = {
        ...buildClaimIdentityInput(input, operation),
        p_claim_expires_at: assertIsoDate(
          input.p_claim_expires_at,
          operation,
        ),
      }
      const result = await executeRpc(
        client,
        operation,
        'claim_product_order_line_pay_request',
        args,
        'single',
        parseClaimResult,
      )
      if (!result) contractMismatch(operation)
      return result
    },

    async recordSuccess(input) {
      const operation = 'record_success'
      const sanitizedResult = readSanitizedResult(
        input.p_sanitized_result,
        operation,
      )
      const transactionId = assertProviderIdentifier(
        input.p_upstream_transaction_id,
        128,
        operation,
      )
      const merchantOrderNo = assertProviderIdentifier(
        input.p_merchant_order_no,
        100,
        operation,
      )

      if (
        sanitizedResult.transaction_id !== transactionId ||
        sanitizedResult.merchant_order_no !== merchantOrderNo
      ) {
        invalidInput(operation)
      }

      const args = {
        ...buildClaimIdentityInput(input, operation),
        p_upstream_transaction_id: transactionId,
        p_merchant_order_no: merchantOrderNo,
        p_sanitized_result: sanitizedResult,
        p_request_id: assertRequestId(input.p_request_id, operation),
      }
      const result = await executeRpc(
        client,
        operation,
        'record_product_order_line_pay_request_success',
        args,
        'single',
        parseSuccessResult,
      )
      if (!result) contractMismatch(operation)
      return result
    },

    async recordFailure(input) {
      const operation = 'record_failure'
      const args = {
        ...buildClaimIdentityInput(input, operation),
        p_error_code: assertErrorCode(input.p_error_code, operation),
        p_request_id: assertRequestId(input.p_request_id, operation),
      }
      const result = await executeRpc(
        client,
        operation,
        'record_product_order_line_pay_request_failure',
        args,
        'single',
        (value) => parseOutcomeResult(value, operation),
      )
      if (!result) contractMismatch(operation)
      return result
    },

    async markUnknown(input) {
      const operation = 'mark_unknown'
      const args = {
        ...buildClaimIdentityInput(input, operation),
        p_error_code: assertErrorCode(input.p_error_code, operation),
        p_request_id: assertRequestId(input.p_request_id, operation),
      }
      const result = await executeRpc(
        client,
        operation,
        'mark_product_order_line_pay_request_unknown',
        args,
        'single',
        (value) => parseOutcomeResult(value, operation),
      )
      if (!result) contractMismatch(operation)
      return result
    },

    async readResult(input) {
      const operation = 'read_result'
      return executeRpc(
        client,
        operation,
        'read_product_order_line_pay_request_result',
        buildReadInput(input, operation),
        'maybeSingle',
        parseReplayResult,
      )
    },
  })
}
