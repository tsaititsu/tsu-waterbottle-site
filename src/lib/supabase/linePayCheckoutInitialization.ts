import 'server-only'
import { spiritualProducts } from '../spiritualProducts'

export type LinePayCheckoutInitializationEnvironment = 'sandbox' | 'production'

export type LinePayCheckoutInitializationItem = {
  productSlug: string
  quantity: number
}

export type LinePayCheckoutInitializationShippingInfo = {
  recipientName?: string | null
  recipientPhone?: string | null
  recipientEmail?: string | null
  shippingMethod:
    | 'manual'
    | 'convenience_store_c2c'
    | 'convenience_store_b2c'
    | 'home_delivery'
  postalCode?: string | null
  address?: string | null
  storeType?: string | null
  storeId?: string | null
  storeName?: string | null
  storeAddress?: string | null
  storePhone?: string | null
}

export type InitializeProductOrderLinePayCheckoutInput = {
  orderNo: string
  merchantOrderNo: string
  customerName?: string | null
  customerEmail?: string | null
  customerPhone?: string | null
  note?: string | null
  items: LinePayCheckoutInitializationItem[]
  shippingInfo: LinePayCheckoutInitializationShippingInfo
  idempotencyKey: string
  requestBodySha256: string
  confirmTokenHash: string
  cancelTokenHash: string
  capabilityExpiresAt: string
}

export type LinePayCheckoutInitializationTrustedServerContext = {
  authenticatedUserId: string
  environment: LinePayCheckoutInitializationEnvironment
}

export type LinePayCheckoutInitializationRequestState =
  | 'initialized'
  | 'queued'
  | 'claimed'
  | 'requesting'
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'unknown'
  | 'reconciliation_required'
  | 'confirmation_processing'
  | 'paid'
  | 'canceled'

export type InitializeProductOrderLinePayCheckoutResult = {
  result_code: 'initialized' | 'already_initialized'
  product_order_id: string
  payment_id: string
  attempt_id: string
  outbox_id: string
  confirm_capability_id: string
  cancel_capability_id: string
  merchant_order_no: string
  request_state: LinePayCheckoutInitializationRequestState
}

type LinePayCheckoutInitializationRpcResponse = {
  data: unknown
  error: unknown
}

export type LinePayCheckoutInitializationRpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => {
    single: () => PromiseLike<LinePayCheckoutInitializationRpcResponse>
  }
}

export type LinePayCheckoutInitializationErrorCode =
  | 'invalid_input'
  | 'rpc_failed'
  | 'contract_mismatch'

export class LinePayCheckoutInitializationError extends Error {
  readonly code: LinePayCheckoutInitializationErrorCode

  constructor(code: LinePayCheckoutInitializationErrorCode) {
    super('line_pay_checkout_initialization_error')
    this.name = 'LinePayCheckoutInitializationError'
    this.code = code
  }
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
const LINE_PAY_CHECKOUT_INITIALIZATION_REQUEST_STATES =
  new Set<LinePayCheckoutInitializationRequestState>([
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
const productBySlug = new Map(
  spiritualProducts.map((product) => [product.slug, product]),
)
const MAX_RPC_PAYLOAD_BYTES = 65536

function invalidInput(): never {
  throw new LinePayCheckoutInitializationError('invalid_input')
}

function contractMismatch(): never {
  throw new LinePayCheckoutInitializationError('contract_mismatch')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeOptionalText(
  value: string | null | undefined,
  maxLength: number,
) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') invalidInput()

  const normalized = value.trim()
  if (normalized.length > maxLength) invalidInput()
  return normalized || null
}

function normalizeRequiredText(
  value: unknown,
  maxLength: number,
  pattern?: RegExp,
) {
  if (typeof value !== 'string') invalidInput()

  const normalized = value.trim()
  if (
    normalized.length === 0
    || normalized.length > maxLength
    || (pattern && !pattern.test(normalized))
  ) {
    invalidInput()
  }
  return normalized
}

function buildPayload(
  input: InitializeProductOrderLinePayCheckoutInput,
  trustedContext: LinePayCheckoutInitializationTrustedServerContext,
) {
  if (!isRecord(input)) invalidInput()
  if (!isRecord(trustedContext)) invalidInput()

  const userId = normalizeRequiredText(
    trustedContext.authenticatedUserId,
    36,
    UUID_PATTERN,
  )
  if (
    trustedContext.environment !== 'sandbox'
    && trustedContext.environment !== 'production'
  ) {
    invalidInput()
  }

  const orderNo = normalizeRequiredText(
    input.orderNo,
    100,
    SAFE_IDENTIFIER_PATTERN,
  )
  const merchantOrderNo = normalizeRequiredText(
    input.merchantOrderNo,
    100,
    SAFE_IDENTIFIER_PATTERN,
  )
  const idempotencyKey = normalizeRequiredText(input.idempotencyKey, 200)
  if (idempotencyKey.length < 16 || /\s/.test(idempotencyKey)) invalidInput()

  const requestBodySha256 = normalizeRequiredText(
    input.requestBodySha256,
    64,
    SHA256_PATTERN,
  )
  const confirmTokenHash = normalizeRequiredText(
    input.confirmTokenHash,
    64,
    SHA256_PATTERN,
  )
  const cancelTokenHash = normalizeRequiredText(
    input.cancelTokenHash,
    64,
    SHA256_PATTERN,
  )
  if (confirmTokenHash === cancelTokenHash) invalidInput()

  const capabilityExpiresAt = normalizeRequiredText(
    input.capabilityExpiresAt,
    64,
  )
  if (Number.isNaN(Date.parse(capabilityExpiresAt))) invalidInput()

  if (
    !Array.isArray(input.items)
    || input.items.length === 0
    || input.items.length > 100
  ) {
    invalidInput()
  }

  let totalAmountTwd = 0
  const items = input.items.map((item) => {
    if (!isRecord(item)) invalidInput()
    const productSlug = normalizeRequiredText(item.productSlug, 200)
    const product = productBySlug.get(productSlug)
    if (
      !product
      || !Number.isSafeInteger(item.quantity)
      || item.quantity <= 0
      || item.quantity > 2147483647
    ) {
      invalidInput()
    }

    const subtotal = product.priceTwd * item.quantity
    if (!Number.isSafeInteger(subtotal) || subtotal > 2147483647) {
      invalidInput()
    }
    totalAmountTwd += subtotal

    return {
      product_slug: product.slug,
      product_name: product.name,
      unit_price_twd: product.priceTwd,
      quantity: item.quantity,
      product_snapshot: {
        slug: product.slug,
        name: product.name,
        category: product.category,
        priceTwd: product.priceTwd,
      },
    }
  })

  if (
    !Number.isSafeInteger(totalAmountTwd)
    || totalAmountTwd <= 0
    || totalAmountTwd > 2147483647
  ) {
    invalidInput()
  }

  if (!isRecord(input.shippingInfo)) invalidInput()
  const shippingInfo = {
    recipient_name: normalizeOptionalText(
      input.shippingInfo.recipientName,
      200,
    ),
    recipient_phone: normalizeOptionalText(
      input.shippingInfo.recipientPhone,
      64,
    ),
    recipient_email: normalizeOptionalText(
      input.shippingInfo.recipientEmail,
      320,
    ),
    shipping_method: input.shippingInfo.shippingMethod,
    postal_code: normalizeOptionalText(input.shippingInfo.postalCode, 32),
    address: normalizeOptionalText(input.shippingInfo.address, 500),
    store_type: normalizeOptionalText(input.shippingInfo.storeType, 64),
    store_id: normalizeOptionalText(input.shippingInfo.storeId, 128),
    store_name: normalizeOptionalText(input.shippingInfo.storeName, 200),
    store_address: normalizeOptionalText(
      input.shippingInfo.storeAddress,
      500,
    ),
    store_phone: normalizeOptionalText(input.shippingInfo.storePhone, 64),
  }
  if (
    shippingInfo.shipping_method !== 'manual'
    && shippingInfo.shipping_method !== 'convenience_store_c2c'
    && shippingInfo.shipping_method !== 'convenience_store_b2c'
    && shippingInfo.shipping_method !== 'home_delivery'
  ) {
    invalidInput()
  }

  const payload = {
    user_id: userId,
    environment: trustedContext.environment,
    order_no: orderNo,
    merchant_order_no: merchantOrderNo,
    customer_name: normalizeOptionalText(input.customerName, 200),
    customer_email: normalizeOptionalText(input.customerEmail, 320),
    customer_phone: normalizeOptionalText(input.customerPhone, 64),
    note: normalizeOptionalText(input.note, 1000),
    items,
    shipping_info: shippingInfo,
    idempotency_key: idempotencyKey,
    request_body_sha256: requestBodySha256,
    confirm_token_hash: confirmTokenHash,
    cancel_token_hash: cancelTokenHash,
    capability_expires_at: capabilityExpiresAt,
  }

  if (
    new TextEncoder().encode(JSON.stringify(payload)).byteLength
    > MAX_RPC_PAYLOAD_BYTES
  ) {
    invalidInput()
  }

  return payload
}

function parseResult(
  value: unknown,
  expectedMerchantOrderNo: string,
): InitializeProductOrderLinePayCheckoutResult {
  if (!isRecord(value)) contractMismatch()

  const keys = Object.keys(value).sort()
  const expectedKeys = [...RESULT_KEYS].sort()
  if (
    keys.length !== expectedKeys.length
    || keys.some((key, index) => key !== expectedKeys[index])
  ) {
    contractMismatch()
  }

  if (
    (value.result_code !== 'initialized'
      && value.result_code !== 'already_initialized')
    || typeof value.request_state !== 'string'
    || !LINE_PAY_CHECKOUT_INITIALIZATION_REQUEST_STATES.has(
      value.request_state as LinePayCheckoutInitializationRequestState,
    )
    || (value.result_code === 'initialized' && value.request_state !== 'queued')
    || value.merchant_order_no !== expectedMerchantOrderNo
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
    if (typeof value[key] !== 'string' || !UUID_PATTERN.test(value[key])) {
      contractMismatch()
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

export async function initializeProductOrderLinePayCheckout(
  input: InitializeProductOrderLinePayCheckoutInput,
  trustedContext: LinePayCheckoutInitializationTrustedServerContext,
  client: LinePayCheckoutInitializationRpcClient,
): Promise<InitializeProductOrderLinePayCheckoutResult> {
  const payload = buildPayload(input, trustedContext)
  let response: LinePayCheckoutInitializationRpcResponse

  try {
    response = await client
      .rpc('initialize_product_order_line_pay_checkout', {
        p_payload: payload,
      })
      .single()
  } catch {
    throw new LinePayCheckoutInitializationError('rpc_failed')
  }

  if (response.error) {
    throw new LinePayCheckoutInitializationError('rpc_failed')
  }

  return parseResult(response.data, payload.merchant_order_no)
}
