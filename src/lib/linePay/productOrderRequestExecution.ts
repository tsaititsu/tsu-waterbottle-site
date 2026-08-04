import { createHash } from 'node:crypto'
import type {
  LinePayDatabaseEnvironment,
  LinePayRequestDatabase,
} from '../supabase/linePayDatabaseContracts'
import type { LinePayRequestPayloadInput } from './requestPayload'
import type { ParsedLinePayRequestResponse } from './responseParser'
import { LinePayTransportError } from './transport'

export type LinePayProductOrderRequestExecutionErrorCode =
  | 'database_contract_mismatch'
  | 'durable_result_missing'
  | 'provider_rejected'
  | 'success_record_failed'
  | 'upstream_result_unknown'
  | 'gateway_config_invalid'
  | 'gateway_request_failed'
  | 'gateway_response_invalid'
  | 'gateway_timeout'
  | 'gateway_unavailable'
  | 'gateway_upstream_timeout'
  | 'gateway_contract_rejected'
  | 'gateway_environment_mismatch'
  | 'gateway_internal_error'
  | 'gateway_rate_limited'
  | 'gateway_replay_detected'
  | 'gateway_unauthorized'
  | 'gateway_upstream_response_invalid'
  | 'gateway_upstream_unavailable'

export class LinePayProductOrderRequestExecutionError extends Error {
  readonly code: LinePayProductOrderRequestExecutionErrorCode

  constructor(code: LinePayProductOrderRequestExecutionErrorCode) {
    super('line_pay_product_order_request_execution_error')
    this.name = 'LinePayProductOrderRequestExecutionError'
    this.code = code
  }
}

export type ExecuteInitializedProductOrderLinePayRequestInput = {
  environment: LinePayDatabaseEnvironment
  attemptId: string
  paymentId: string
  productOrderId: string
  idempotencyKey: string
  requestBodySha256: string
  merchantOrderNo: string
  claimId: string
  claimExpiresAt: string
  requestId: string
  payloadInput: LinePayRequestPayloadInput
  database: LinePayRequestDatabase
  requestPayment: () => Promise<ParsedLinePayRequestResponse>
}

export type ExecuteInitializedProductOrderLinePayRequestResult =
  | Readonly<{
      status: 'payment_url_ready'
      attemptId: string
      paymentId: string
      productOrderId: string
      merchantOrderNo: string
      transactionId: string
      paymentUrlWeb: string
      paymentUrlApp: string | null
    }>
  | Readonly<{
      status: 'already_succeeded'
      attemptId: string
      paymentId: string
      productOrderId: string
      merchantOrderNo: string
      transactionId: string
    }>
  | Readonly<{
      status:
        | 'already_claimed'
        | 'claim_busy'
        | 'reconciliation_required'
        | 'terminal'
      attemptId: string
      paymentId: string
      productOrderId: string
      merchantOrderNo: string
    }>

function executionError(
  code: LinePayProductOrderRequestExecutionErrorCode,
): never {
  throw new LinePayProductOrderRequestExecutionError(code)
}

const SAFE_GATEWAY_EXECUTION_ERRORS: Readonly<Record<
  string,
  LinePayProductOrderRequestExecutionErrorCode
>> = Object.freeze({
  invalid_line_pay_gateway_response: 'gateway_response_invalid',
  invalid_line_pay_gateway_timeout: 'gateway_config_invalid',
  invalid_line_pay_gateway_url: 'gateway_config_invalid',
  invalid_line_pay_transport: 'gateway_config_invalid',
  line_pay_gateway_request_failed: 'gateway_request_failed',
  line_pay_gateway_contract_rejected: 'gateway_contract_rejected',
  line_pay_gateway_environment_mismatch: 'gateway_environment_mismatch',
  line_pay_gateway_internal_error: 'gateway_internal_error',
  line_pay_gateway_rate_limited: 'gateway_rate_limited',
  line_pay_gateway_replay_detected: 'gateway_replay_detected',
  line_pay_gateway_timeout: 'gateway_timeout',
  line_pay_gateway_unauthorized: 'gateway_unauthorized',
  line_pay_gateway_unavailable: 'gateway_unavailable',
  line_pay_gateway_upstream_response_invalid: 'gateway_upstream_response_invalid',
  line_pay_gateway_upstream_timeout: 'gateway_upstream_timeout',
  line_pay_gateway_upstream_unavailable: 'gateway_upstream_unavailable',
  line_pay_preview_requires_gateway: 'gateway_config_invalid',
  missing_line_pay_gateway_config: 'gateway_config_invalid',
})

function safeGatewayExecutionError(error: unknown) {
  if (!(error instanceof LinePayTransportError)) return null
  return SAFE_GATEWAY_EXECUTION_ERRORS[error.code] ?? null
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function buildResponseSha256(
  response: ParsedLinePayRequestResponse,
  merchantOrderNo: string,
) {
  return sha256(
    JSON.stringify({
      returnCode: response.returnCode,
      returnMessage: response.returnMessage,
      transactionId: response.transactionId,
      merchantOrderNo,
      paymentUrlWeb: response.paymentUrlWeb,
      paymentUrlApp: response.paymentUrlApp,
    }),
  )
}

async function bestEffortMarkUnknown(
  input: ExecuteInitializedProductOrderLinePayRequestInput,
  errorCode: string,
) {
  try {
    await input.database.markUnknown({
      p_attempt_id: input.attemptId,
      p_environment: input.environment,
      p_idempotency_key: input.idempotencyKey,
      p_request_body_sha256: input.requestBodySha256,
      p_claim_id: input.claimId,
      p_error_code: errorCode,
      p_request_id: input.requestId,
    })
    return true
  } catch {
    return false
  }
}

function assertClaimIdentity(
  input: ExecuteInitializedProductOrderLinePayRequestInput,
  result: { attempt_id: string; payment_id: string },
) {
  if (
    result.attempt_id !== input.attemptId
    || result.payment_id !== input.paymentId
  ) {
    executionError('database_contract_mismatch')
  }
}

export async function executeInitializedProductOrderLinePayRequest(
  input: ExecuteInitializedProductOrderLinePayRequestInput,
): Promise<ExecuteInitializedProductOrderLinePayRequestResult> {
  const claim = await input.database.claim({
    p_attempt_id: input.attemptId,
    p_environment: input.environment,
    p_idempotency_key: input.idempotencyKey,
    p_request_body_sha256: input.requestBodySha256,
    p_claim_id: input.claimId,
    p_claim_expires_at: input.claimExpiresAt,
  })
  assertClaimIdentity(input, claim)

  if (claim.result_code === 'already_succeeded') {
    const replay = await input.database.readResult({
      p_attempt_id: input.attemptId,
      p_environment: input.environment,
      p_idempotency_key: input.idempotencyKey,
      p_request_body_sha256: input.requestBodySha256,
    })

    if (
      replay?.request_state !== 'succeeded'
      || replay.attempt_id !== input.attemptId
      || replay.payment_id !== input.paymentId
      || replay.merchant_order_no !== input.merchantOrderNo
      || !replay.upstream_transaction_id
    ) {
      executionError('durable_result_missing')
    }

    return Object.freeze({
      status: 'already_succeeded',
      attemptId: input.attemptId,
      paymentId: input.paymentId,
      productOrderId: input.productOrderId,
      merchantOrderNo: input.merchantOrderNo,
      transactionId: replay.upstream_transaction_id,
    })
  }

  if (claim.result_code !== 'claimed') {
    return Object.freeze({
      status: claim.result_code,
      attemptId: input.attemptId,
      paymentId: input.paymentId,
      productOrderId: input.productOrderId,
      merchantOrderNo: input.merchantOrderNo,
    })
  }

  let providerResult: ParsedLinePayRequestResponse
  try {
    providerResult = await input.requestPayment()
  } catch (error) {
    if (
      error instanceof Error
      && error.message === 'line_pay_request_failed'
    ) {
      try {
        await input.database.recordFailure({
          p_attempt_id: input.attemptId,
          p_environment: input.environment,
          p_idempotency_key: input.idempotencyKey,
          p_request_body_sha256: input.requestBodySha256,
          p_claim_id: input.claimId,
          p_error_code: 'provider_request_rejected',
          p_request_id: input.requestId,
        })
      } catch {
        await bestEffortMarkUnknown(
          input,
          'provider_rejection_record_failed',
        )
      }
      executionError('provider_rejected')
    }

    const gatewayError = safeGatewayExecutionError(error)
    if (gatewayError) {
      await bestEffortMarkUnknown(input, gatewayError)
      executionError(gatewayError)
    }

    await bestEffortMarkUnknown(input, 'upstream_result_unknown')
    executionError('upstream_result_unknown')
  }

  try {
    const recorded = await input.database.recordSuccess({
      p_attempt_id: input.attemptId,
      p_environment: input.environment,
      p_idempotency_key: input.idempotencyKey,
      p_request_body_sha256: input.requestBodySha256,
      p_claim_id: input.claimId,
      p_upstream_transaction_id: providerResult.transactionId,
      p_merchant_order_no: input.merchantOrderNo,
      p_sanitized_result: {
        result_code: providerResult.returnCode,
        provider_status: 'success',
        transaction_id: providerResult.transactionId,
        merchant_order_no: input.merchantOrderNo,
        response_sha256: buildResponseSha256(
          providerResult,
          input.merchantOrderNo,
        ),
      },
      p_request_id: input.requestId,
    })
    assertClaimIdentity(input, recorded)
    if (recorded.upstream_transaction_id !== providerResult.transactionId) {
      executionError('database_contract_mismatch')
    }
  } catch (error) {
    if (error instanceof LinePayProductOrderRequestExecutionError) throw error
    await bestEffortMarkUnknown(input, 'request_success_record_failed')
    executionError('success_record_failed')
  }

  return Object.freeze({
    status: 'payment_url_ready',
    attemptId: input.attemptId,
    paymentId: input.paymentId,
    productOrderId: input.productOrderId,
    merchantOrderNo: input.merchantOrderNo,
    transactionId: providerResult.transactionId,
    paymentUrlWeb: providerResult.paymentUrlWeb,
    paymentUrlApp: providerResult.paymentUrlApp,
  })
}
