import type {
  InitializeProductOrderLinePayCheckoutResult,
  LinePayCheckoutInitializationRpcClient,
  LinePayCheckoutInitializationRequestState,
} from './linePayCheckoutInitialization'

export type LinePaySandboxE2eInitializationErrorCode =
  | 'invalid_input'
  | 'rpc_failed'
  | 'contract_mismatch'

export class LinePaySandboxE2eInitializationError extends Error {
  readonly code: LinePaySandboxE2eInitializationErrorCode

  constructor(code: LinePaySandboxE2eInitializationErrorCode) {
    super('line_pay_sandbox_e2e_initialization_error')
    this.name = 'LinePaySandboxE2eInitializationError'
    this.code = code
  }
}

export type InitializeLinePaySandboxE2eCheckoutInput = {
  client: LinePayCheckoutInitializationRpcClient
  userId: string
  environment: 'sandbox'
  amountTwd: 50
  orderNo: string
  merchantOrderNo: string
  idempotencyKey: string
  requestBodySha256: string
  confirmTokenHash: string
  cancelTokenHash: string
  capabilityExpiresAt: string
}

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

function fail(code: LinePaySandboxE2eInitializationErrorCode): never {
  throw new LinePaySandboxE2eInitializationError(code)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validText(value: unknown, maxLength: number, pattern?: RegExp) {
  return (
    typeof value === 'string'
    && value.length > 0
    && value.length <= maxLength
    && (!pattern || pattern.test(value))
  )
}

function validateInput(input: InitializeLinePaySandboxE2eCheckoutInput) {
  if (
    !isRecord(input)
    || input.environment !== 'sandbox'
    || input.amountTwd !== 50
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

export async function initializeLinePaySandboxE2eCheckout(
  input: InitializeLinePaySandboxE2eCheckoutInput,
): Promise<InitializeProductOrderLinePayCheckoutResult> {
  validateInput(input)

  const payload = {
    user_id: input.userId,
    environment: 'sandbox',
    order_no: input.orderNo,
    merchant_order_no: input.merchantOrderNo,
    customer_name: 'LINE Pay Sandbox E2E',
    customer_email: null,
    customer_phone: null,
    note: 'Preview-only LINE Pay Sandbox NT$50 E2E',
    items: [
      {
        product_slug: 'line-pay-sandbox-e2e-nt50',
        product_name: 'LINE Pay Sandbox E2E 測試',
        unit_price_twd: 50,
        quantity: 1,
        product_snapshot: {
          slug: 'line-pay-sandbox-e2e-nt50',
          name: 'LINE Pay Sandbox E2E 測試',
          category: '符咒商品',
          priceTwd: 50,
        },
      },
    ],
    shipping_info: {
      recipient_name: null,
      recipient_phone: null,
      recipient_email: null,
      shipping_method: 'manual',
      postal_code: null,
      address: null,
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
      .rpc('initialize_product_order_line_pay_checkout', {
        p_payload: payload,
      })
      .single()
  } catch {
    fail('rpc_failed')
  }

  if (response.error) fail('rpc_failed')
  return parseResult(response.data, input.merchantOrderNo)
}
