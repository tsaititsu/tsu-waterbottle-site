import type {
  InitializeProductOrderLinePayCheckoutResult,
  LinePayCheckoutInitializationRpcClient,
  LinePayCheckoutInitializationRequestState,
} from './linePayCheckoutInitialization'

export type LinePaySandboxE2eInitializationErrorCode =
  | 'invalid_input'
  | 'rpc_failed'
  | 'contract_mismatch'

export type LinePaySandboxE2eInitializationReason =
  | LinePaySandboxE2eInitializationErrorCode
  | 'database_invalid_input'
  | 'database_items_total_mismatch'
  | 'database_idempotency_conflict'
  | 'database_order_link_failed'
  | 'database_audit_binding_invalid'
  | 'rpc_insufficient_privilege'
  | 'rpc_foreign_key_violation'
  | 'rpc_unique_violation'
  | 'rpc_check_violation'
  | 'rpc_contract_missing'
  | 'rpc_application_exception'

export class LinePaySandboxE2eInitializationError extends Error {
  readonly code: LinePaySandboxE2eInitializationErrorCode
  readonly reason: LinePaySandboxE2eInitializationReason

  constructor(
    code: LinePaySandboxE2eInitializationErrorCode,
    reason: LinePaySandboxE2eInitializationReason = code,
  ) {
    super('line_pay_sandbox_e2e_initialization_error')
    this.name = 'LinePaySandboxE2eInitializationError'
    this.code = code
    this.reason = reason
  }
}

export type InitializeLinePayOneDollarTestCheckoutInput = {
  client: LinePayCheckoutInitializationRpcClient
  userId: string
  environment: 'sandbox' | 'production'
  amountTwd: 1
  orderNo: string
  merchantOrderNo: string
  idempotencyKey: string
  requestBodySha256: string
  confirmTokenHash: string
  cancelTokenHash: string
  capabilityExpiresAt: string
}

export type InitializeLinePaySandboxE2eCheckoutInput =
  & Omit<InitializeLinePayOneDollarTestCheckoutInput, 'environment'>
  & { environment: 'sandbox' }

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9_:-]{1,100}$/
const SHA256_PATTERN = /^[0-9a-f]{64}$/
const RESULT_KEYS = [
  'result_code',
  'product_order_id',
  'payment_id',
  'attempt_id',
  'outbox_id',
  'confirm_capability_id',
  'cancel_capability_id',
  'merchant_order_no',
  'request_state',
] as const
const REQUEST_STATES = new Set<LinePayCheckoutInitializationRequestState>([
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
])

function fail(
  code: LinePaySandboxE2eInitializationErrorCode,
  reason: LinePaySandboxE2eInitializationReason = code,
): never {
  throw new LinePaySandboxE2eInitializationError(code, reason)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeRpcFailureReason(
  value: unknown,
): LinePaySandboxE2eInitializationReason {
  if (!isRecord(value)) return 'rpc_failed'

  const message = typeof value.message === 'string' ? value.message : ''
  const knownMessages = {
    line_pay_initialization_invalid_input: 'database_invalid_input',
    line_pay_initialization_items_total_mismatch:
      'database_items_total_mismatch',
    line_pay_initialization_idempotency_conflict:
      'database_idempotency_conflict',
    line_pay_initialization_order_link_failed: 'database_order_link_failed',
    line_pay_initialization_audit_binding_invalid:
      'database_audit_binding_invalid',
  } as const
  if (message in knownMessages) {
    return knownMessages[message as keyof typeof knownMessages]
  }

  switch (value.code) {
    case '42501':
      return 'rpc_insufficient_privilege'
    case '23503':
      return 'rpc_foreign_key_violation'
    case '23505':
      return 'rpc_unique_violation'
    case '23514':
      return 'rpc_check_violation'
    case '22023':
      return 'database_invalid_input'
    case '42883':
    case '42P01':
      return 'rpc_contract_missing'
    case 'P0001':
      return 'rpc_application_exception'
    default:
      return 'rpc_failed'
  }
}

function validText(value: unknown, maxLength: number, pattern?: RegExp) {
  return (
    typeof value === 'string'
    && value.length > 0
    && value.length <= maxLength
    && (!pattern || pattern.test(value))
  )
}

function validateInput(input: InitializeLinePayOneDollarTestCheckoutInput) {
  if (
    !isRecord(input)
    || (input.environment !== 'sandbox' && input.environment !== 'production')
    || input.amountTwd !== 1
    || !validText(input.userId, 36, UUID_PATTERN)
    || !validText(input.orderNo, 100, SAFE_IDENTIFIER_PATTERN)
    || !validText(input.merchantOrderNo, 100, SAFE_IDENTIFIER_PATTERN)
    || !validText(input.idempotencyKey, 200)
    || input.idempotencyKey.length < 16
    || /\s/.test(input.idempotencyKey)
    || !validText(input.requestBodySha256, 64, SHA256_PATTERN)
    || !validText(input.confirmTokenHash, 64, SHA256_PATTERN)
    || !validText(input.cancelTokenHash, 64, SHA256_PATTERN)
    || input.confirmTokenHash === input.cancelTokenHash
    || !validText(input.capabilityExpiresAt, 64)
    || Number.isNaN(Date.parse(input.capabilityExpiresAt))
    || !input.client
    || typeof input.client.rpc !== 'function'
  ) {
    fail('invalid_input')
  }
}

function parseResult(
  value: unknown,
  merchantOrderNo: string,
): InitializeProductOrderLinePayCheckoutResult {
  if (!isRecord(value)) fail('contract_mismatch')

  const actualKeys = Object.keys(value).sort()
  const expectedKeys = [...RESULT_KEYS].sort()
  if (
    actualKeys.length !== expectedKeys.length
    || actualKeys.some((key, index) => key !== expectedKeys[index])
    || (
      value.result_code !== 'initialized'
      && value.result_code !== 'already_initialized'
    )
    || value.merchant_order_no !== merchantOrderNo
    || typeof value.request_state !== 'string'
    || !REQUEST_STATES.has(
      value.request_state as LinePayCheckoutInitializationRequestState,
    )
    || (value.result_code === 'initialized' && value.request_state !== 'queued')
  ) {
    fail('contract_mismatch')
  }

  for (const key of [
    'product_order_id',
    'payment_id',
    'attempt_id',
    'outbox_id',
    'confirm_capability_id',
    'cancel_capability_id',
  ] as const) {
    if (typeof value[key] !== 'string' || !UUID_PATTERN.test(value[key])) {
      fail('contract_mismatch')
    }
  }

  return Object.freeze({
    result_code: value.result_code,
    product_order_id: value.product_order_id,
    payment_id: value.payment_id,
    attempt_id: value.attempt_id,
    outbox_id: value.outbox_id,
    confirm_capability_id: value.confirm_capability_id,
    cancel_capability_id: value.cancel_capability_id,
    merchant_order_no: value.merchant_order_no,
    request_state: value.request_state,
  }) as InitializeProductOrderLinePayCheckoutResult
}

export async function initializeLinePayOneDollarTestCheckout(
  input: InitializeLinePayOneDollarTestCheckoutInput,
): Promise<InitializeProductOrderLinePayCheckoutResult> {
  validateInput(input)

  const production = input.environment === 'production'
  const productSlug = production
    ? 'line-pay-production-one-dollar-test'
    : 'line-pay-sandbox-e2e-nt1'
  const productName = production
    ? 'LINE Pay Production NT$1 測試（不出貨）'
    : 'LINE Pay Sandbox E2E 測試'

  const payload = {
    user_id: input.userId,
    environment: input.environment,
    order_no: input.orderNo,
    merchant_order_no: input.merchantOrderNo,
    customer_name: production
      ? 'LINE Pay Production NT$1 測試'
      : 'LINE Pay Sandbox E2E',
    customer_email: null,
    customer_phone: production ? '0900000000' : null,
    note: production
      ? 'Production 管理員 NT$1 金流測試，請勿出貨'
      : 'Preview-only LINE Pay Sandbox NT$1 E2E',
    items: [
      {
        product_slug: productSlug,
        product_name: productName,
        unit_price_twd: 1,
        quantity: 1,
        product_snapshot: {
          slug: productSlug,
          name: productName,
          category: '符咒商品',
          priceTwd: 1,
        },
      },
    ],
    shipping_info: {
      recipient_name: production ? 'LINE Pay NT$1 測試（請勿出貨）' : null,
      recipient_phone: production ? '0900000000' : null,
      recipient_email: null,
      shipping_method: 'manual',
      postal_code: null,
      address: production ? '內部金流測試訂單，請勿出貨' : null,
      store_type: null,
      store_id: null,
      store_name: null,
      store_address: null,
      store_phone: null,
    },
    idempotency_key: input.idempotencyKey,
    request_body_sha256: input.requestBodySha256,
    confirm_token_hash: input.confirmTokenHash,
    cancel_token_hash: input.cancelTokenHash,
    capability_expires_at: input.capabilityExpiresAt,
  }

  let response: { data: unknown; error: unknown }
  try {
    response = await input.client
      .rpc(production
        ? 'initialize_line_pay_one_dollar_product_order_test'
        : 'initialize_product_order_line_pay_checkout', {
        p_payload: payload,
      })
      .single()
  } catch {
    fail('rpc_failed')
  }

  if (response.error) fail('rpc_failed', safeRpcFailureReason(response.error))
  return parseResult(response.data, input.merchantOrderNo)
}

export async function initializeLinePaySandboxE2eCheckout(
  input: InitializeLinePaySandboxE2eCheckoutInput,
): Promise<InitializeProductOrderLinePayCheckoutResult> {
  if (input.environment !== 'sandbox') fail('invalid_input')
  return initializeLinePayOneDollarTestCheckout(input)
}
