export type ProductOrderLinePayCapabilityRpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => {
    single: () => PromiseLike<{ data: unknown; error: unknown }>
  }
}

export type ProductOrderLinePayCapabilityContextClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (name: string, value: string) => unknown
      maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }>
    }
    eq: (name: string, value: string) => unknown
    maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }>
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SHA256_PATTERN = /^[0-9a-f]{64}$/
const SAFE_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/
const CONTEXT_COLUMNS = [
  'id',
  'product_order_id',
  'checkout_attempt_id',
  'environment',
  'status',
  'request_state',
  'amount_twd',
  'currency',
  'merchant_order_no',
  'line_pay_transaction_id',
].join(',')

function databaseError(): never {
  throw new Error('line_pay_capability_database_error')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function exactRecord(value: unknown, keys: readonly string[]) {
  if (!isRecord(value)) databaseError()
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (
    actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])
  ) {
    databaseError()
  }
  return value
}

function uuid(value: unknown) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) databaseError()
  return value
}

function string(value: unknown, pattern = SAFE_ID_PATTERN) {
  if (typeof value !== 'string' || !pattern.test(value)) databaseError()
  return value
}

function integer(value: unknown) {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) databaseError()
  return Number(value)
}

async function rpc(
  client: ProductOrderLinePayCapabilityRpcClient,
  functionName: string,
  args: Record<string, unknown>,
) {
  let result: { data: unknown; error: unknown }
  try {
    result = await client.rpc(functionName, args).single()
  } catch {
    databaseError()
  }
  if (result.error) databaseError()
  return result.data
}

export async function readProductOrderLinePayCapabilityContext(
  merchantOrderNo: string,
  client: ProductOrderLinePayCapabilityContextClient,
) {
  if (!SAFE_ID_PATTERN.test(merchantOrderNo)) databaseError()

  let result: { data: unknown; error: unknown }
  try {
    const query = client.from('payments').select(CONTEXT_COLUMNS) as {
      eq: (name: string, value: string) => unknown
      maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }>
    }
    const byOrder = query.eq('merchant_order_no', merchantOrderNo) as typeof query
    const byProvider = byOrder.eq('provider', 'line_pay') as typeof query
    result = await byProvider.maybeSingle()
  } catch {
    databaseError()
  }
  if (result.error) databaseError()
  if (result.data === null) return null

  const row = exactRecord(result.data, CONTEXT_COLUMNS.split(','))
  const environment = string(row.environment)
  if (environment !== 'sandbox' && environment !== 'production') databaseError()
  if (row.currency !== 'TWD') databaseError()

  return Object.freeze({
    paymentId: uuid(row.id),
    productOrderId: uuid(row.product_order_id),
    attemptId: uuid(row.checkout_attempt_id),
    environment,
    status: string(row.status),
    requestState: string(row.request_state),
    amountTwd: integer(row.amount_twd),
    currency: 'TWD' as const,
    merchantOrderNo: string(row.merchant_order_no),
    transactionId: string(row.line_pay_transaction_id),
  })
}

export function createProductOrderLinePayCapabilityDatabase(
  serviceRoleClient: ProductOrderLinePayCapabilityRpcClient,
  executorClient?: ProductOrderLinePayCapabilityRpcClient,
) {
  return Object.freeze({
    async claimCapability(input: {
      tokenHash: string
      environment: 'sandbox' | 'production'
      purpose: 'confirm' | 'cancel'
      paymentId: string
      productOrderId: string
      attemptId: string
      claimId: string
      claimExpiresAt: string
    }) {
      const row = exactRecord(
        await rpc(serviceRoleClient, 'claim_line_pay_callback_capability', {
          p_token_hash: input.tokenHash,
          p_environment: input.environment,
          p_purpose: input.purpose,
          p_payment_id: input.paymentId,
          p_product_order_id: input.productOrderId,
          p_attempt_id: input.attemptId,
          p_claim_id: input.claimId,
          p_claim_expires_at: input.claimExpiresAt,
        }),
        [
          'result_code',
          'capability_id',
          'callback_event_id',
          'payment_id',
          'product_order_id',
          'purpose',
          'expires_at',
        ],
      )
      const resultCode = string(row.result_code)
      if (![
        'claimed',
        'already_claimed',
        'already_consumed',
        'claim_busy',
      ].includes(resultCode)) databaseError()
      if (
        uuid(row.payment_id) !== input.paymentId
        || uuid(row.product_order_id) !== input.productOrderId
        || row.purpose !== input.purpose
        || Number.isNaN(Date.parse(string(row.expires_at, /^.{1,64}$/)))
      ) databaseError()
      return Object.freeze({
        resultCode: resultCode as
          | 'claimed'
          | 'already_claimed'
          | 'already_consumed'
          | 'claim_busy',
        capabilityId: uuid(row.capability_id),
        callbackEventId: uuid(row.callback_event_id),
      })
    },

    async claimConfirmation(input: {
      environment: 'sandbox' | 'production'
      paymentId: string
      productOrderId: string
      attemptId: string
      capabilityId: string
      callbackEventId: string
      callbackClaimId: string
      transactionId: string
      requestId: string
    }) {
      const row = exactRecord(
        await rpc(serviceRoleClient, 'claim_product_order_line_pay_confirmation', {
          p_environment: input.environment,
          p_payment_id: input.paymentId,
          p_product_order_id: input.productOrderId,
          p_attempt_id: input.attemptId,
          p_capability_id: input.capabilityId,
          p_callback_event_id: input.callbackEventId,
          p_callback_claim_id: input.callbackClaimId,
          p_transaction_id: input.transactionId,
          p_request_id: input.requestId,
        }),
        ['result_code', 'payment_id', 'product_order_id', 'request_state'],
      )
      const resultCode = string(row.result_code)
      if (!['claimed', 'already_claimed', 'already_paid'].includes(resultCode)) {
        databaseError()
      }
      return Object.freeze({ resultCode }) as {
        resultCode: 'claimed' | 'already_claimed' | 'already_paid'
      }
    },

    async finalizeConfirmation(input: {
      environment: 'sandbox' | 'production'
      paymentId: string
      productOrderId: string
      attemptId: string
      merchantOrderNo: string
      transactionId: string
      amountTwd: number
      currency: 'TWD'
      capabilityId: string
      callbackEventId: string
      callbackClaimId: string
      confirmResultSha256: string
      requestId: string
    }) {
      if (!executorClient) databaseError()
      const row = exactRecord(
        await rpc(executorClient, 'finalize_product_order_line_pay_confirmation', {
          p_environment: input.environment,
          p_payment_id: input.paymentId,
          p_product_order_id: input.productOrderId,
          p_attempt_id: input.attemptId,
          p_merchant_order_no: input.merchantOrderNo,
          p_transaction_id: input.transactionId,
          p_amount_twd: input.amountTwd,
          p_currency: input.currency,
          p_capability_id: input.capabilityId,
          p_callback_event_id: input.callbackEventId,
          p_callback_claim_id: input.callbackClaimId,
          p_confirm_result_sha256: string(
            input.confirmResultSha256,
            SHA256_PATTERN,
          ),
          p_request_id: input.requestId,
        }),
        ['result_code', 'payment_id', 'product_order_id', 'transaction_id'],
      )
      const resultCode = string(row.result_code)
      if (!['completed', 'already_completed'].includes(resultCode)) databaseError()
      return Object.freeze({
        resultCode,
        transactionId: string(row.transaction_id),
      }) as {
        resultCode: 'completed' | 'already_completed'
        transactionId: string
      }
    },

    async cancelPayment(input: {
      environment: 'sandbox' | 'production'
      paymentId: string
      productOrderId: string
      attemptId: string
      capabilityId: string
      callbackEventId: string
      callbackClaimId: string
      requestId: string
      reasonCode: 'payment_canceled' | 'cancel_after_paid'
    }) {
      const row = exactRecord(
        await rpc(serviceRoleClient, 'cancel_product_order_line_pay_payment', {
          p_environment: input.environment,
          p_payment_id: input.paymentId,
          p_product_order_id: input.productOrderId,
          p_attempt_id: input.attemptId,
          p_capability_id: input.capabilityId,
          p_callback_event_id: input.callbackEventId,
          p_callback_claim_id: input.callbackClaimId,
          p_request_id: input.requestId,
          p_reason_code: input.reasonCode,
        }),
        ['result_code', 'payment_id', 'product_order_id', 'request_state'],
      )
      const resultCode = string(row.result_code)
      if (!['canceled', 'already_canceled', 'already_paid'].includes(resultCode)) {
        databaseError()
      }
      return Object.freeze({
        resultCode,
        requestState: string(row.request_state),
      }) as {
        resultCode: 'canceled' | 'already_canceled' | 'already_paid'
        requestState: string
      }
    },

    async markReconciliation(input: {
      environment: 'sandbox' | 'production'
      paymentId: string
      productOrderId: string
      attemptId: string
      reasonCode: string
      requestId: string
    }) {
      const row = exactRecord(
        await rpc(serviceRoleClient, 'mark_product_order_line_pay_reconciliation', {
          p_environment: input.environment,
          p_payment_id: input.paymentId,
          p_product_order_id: input.productOrderId,
          p_attempt_id: input.attemptId,
          p_reason_code: input.reasonCode,
          p_request_id: input.requestId,
        }),
        ['result_code', 'payment_id', 'product_order_id', 'request_state'],
      )
      const resultCode = string(row.result_code)
      if (!['marked', 'already_marked'].includes(resultCode)) databaseError()
      return Object.freeze({
        resultCode,
        requestState: string(row.request_state),
      }) as {
        resultCode: 'marked' | 'already_marked'
        requestState: string
      }
    },
  })
}
