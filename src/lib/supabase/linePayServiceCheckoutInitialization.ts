import 'server-only'

import type {
  InitializeProductOrderLinePayCheckoutResult,
  LinePayCheckoutInitializationEnvironment,
  LinePayCheckoutInitializationRequestState,
  LinePayCheckoutInitializationRpcClient,
  LinePayCheckoutInitializationTrustedServerContext,
} from './linePayCheckoutInitialization'
import type { LinePayServiceTarget } from '../linePay/serviceCheckout'

export type InitializeServiceLinePayCheckoutInput = {
  orderNo: string
  merchantOrderNo: string
  target: LinePayServiceTarget
  idempotencyKey: string
  requestBodySha256: string
  confirmTokenHash: string
  cancelTokenHash: string
  capabilityExpiresAt: string
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9_:-]{1,100}$/
const SAFE_SOURCE_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/
const SHA256_PATTERN = /^[0-9a-f]{64}$/
const SAFE_RETURN_PATH_PATTERN = /^\/[A-Za-z0-9/_-]{1,300}$/
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

export class LinePayServiceCheckoutInitializationError extends Error {
  readonly code: 'invalid_input' | 'rpc_failed' | 'contract_mismatch'

  constructor(code: 'invalid_input' | 'rpc_failed' | 'contract_mismatch') {
    super('line_pay_service_checkout_initialization_error')
    this.name = 'LinePayServiceCheckoutInitializationError'
    this.code = code
  }
}

function invalidInput(): never {
  throw new LinePayServiceCheckoutInitializationError('invalid_input')
}

function contractMismatch(): never {
  throw new LinePayServiceCheckoutInitializationError('contract_mismatch')
}

function requiredText(value: unknown, maxLength: number, pattern?: RegExp) {
  if (typeof value !== 'string') invalidInput()
  const normalized = value.trim()
  if (
    !normalized
    || normalized.length > maxLength
    || (pattern && !pattern.test(normalized))
  ) {
    invalidInput()
  }
  return normalized
}

function buildPayload(
  input: InitializeServiceLinePayCheckoutInput,
  context: LinePayCheckoutInitializationTrustedServerContext,
) {
  const userId = requiredText(context.authenticatedUserId, 36, UUID_PATTERN)
  if (context.environment !== 'sandbox' && context.environment !== 'production') {
    invalidInput()
  }
  const orderNo = requiredText(input.orderNo, 100, SAFE_IDENTIFIER_PATTERN)
  const merchantOrderNo = requiredText(
    input.merchantOrderNo,
    100,
    SAFE_IDENTIFIER_PATTERN,
  )
  const idempotencyKey = requiredText(input.idempotencyKey, 200)
  if (idempotencyKey.length < 16 || /\s/.test(idempotencyKey)) invalidInput()
  const requestBodySha256 = requiredText(
    input.requestBodySha256,
    64,
    SHA256_PATTERN,
  )
  const confirmTokenHash = requiredText(input.confirmTokenHash, 64, SHA256_PATTERN)
  const cancelTokenHash = requiredText(input.cancelTokenHash, 64, SHA256_PATTERN)
  if (confirmTokenHash === cancelTokenHash) invalidInput()
  const capabilityExpiresAt = requiredText(input.capabilityExpiresAt, 64)
  if (Number.isNaN(Date.parse(capabilityExpiresAt))) invalidInput()

  const target = input.target
  if (
    !target
    || !['ai_chart_report', 'ai_divination', 'booking', 'course'].includes(target.source)
    || target.itemType !== target.source
    || !Number.isSafeInteger(target.amountTwd)
    || target.amountTwd <= 0
  ) {
    invalidInput()
  }

  const sourceId = requiredText(target.sourceId, 100, SAFE_SOURCE_ID_PATTERN)
  const itemName = requiredText(target.itemName, 500)
  const returnPath = requiredText(
    target.returnPath,
    300,
    SAFE_RETURN_PATH_PATTERN,
  )
  const bookingId = target.bookingId === null
    ? null
    : requiredText(target.bookingId, 36, UUID_PATTERN)
  if ((target.source === 'booking') !== (bookingId !== null)) invalidInput()

  return {
    user_id: userId,
    environment: context.environment as LinePayCheckoutInitializationEnvironment,
    order_no: orderNo,
    merchant_order_no: merchantOrderNo,
    source_type: target.source,
    source_id: sourceId,
    item_name: itemName,
    amount_twd: target.amountTwd,
    booking_id: bookingId,
    return_path: returnPath,
    idempotency_key: idempotencyKey,
    request_body_sha256: requestBodySha256,
    confirm_token_hash: confirmTokenHash,
    cancel_token_hash: cancelTokenHash,
    capability_expires_at: capabilityExpiresAt,
  }
}

function parseResult(
  value: unknown,
  expectedMerchantOrderNo: string,
): InitializeProductOrderLinePayCheckoutResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    contractMismatch()
  }
  const row = value as Record<string, unknown>
  const keys = Object.keys(row).sort()
  const expectedKeys = [...RESULT_KEYS].sort()
  if (
    keys.length !== expectedKeys.length
    || keys.some((key, index) => key !== expectedKeys[index])
    || (row.result_code !== 'initialized' && row.result_code !== 'already_initialized')
    || typeof row.request_state !== 'string'
    || !REQUEST_STATES.has(row.request_state as LinePayCheckoutInitializationRequestState)
    || row.merchant_order_no !== expectedMerchantOrderNo
  ) {
    contractMismatch()
  }
  for (const key of [
    'product_order_id',
    'payment_id',
    'attempt_id',
    'outbox_id',
    'confirm_capability_id',
    'cancel_capability_id',
  ] as const) {
    if (typeof row[key] !== 'string' || !UUID_PATTERN.test(row[key])) {
      contractMismatch()
    }
  }
  return Object.freeze(row) as unknown as InitializeProductOrderLinePayCheckoutResult
}

export async function initializeServiceLinePayCheckout(
  input: InitializeServiceLinePayCheckoutInput,
  trustedContext: LinePayCheckoutInitializationTrustedServerContext,
  client: LinePayCheckoutInitializationRpcClient,
) {
  const payload = buildPayload(input, trustedContext)
  let response: { data: unknown; error: unknown }
  try {
    response = await client
      .rpc('initialize_service_line_pay_checkout', { p_payload: payload })
      .single()
  } catch {
    throw new LinePayServiceCheckoutInitializationError('rpc_failed')
  }
  if (response.error) {
    throw new LinePayServiceCheckoutInitializationError('rpc_failed')
  }
  return parseResult(response.data, payload.merchant_order_no)
}
