import { getSupabaseAdmin } from './admin'

export type ProductOrderPaymentMethod = 'bank_transfer' | 'newebpay'
export type ProductShippingMethod = 'manual' | 'convenience_store_c2c' | 'convenience_store_b2c' | 'home_delivery'

export type ProductOrderItemInput = {
  productSlug: string
  productName: string
  unitPriceTwd: number
  quantity: number
  productSnapshot?: Record<string, unknown> | null
}

export type ProductShippingInfoInput = {
  recipientName?: string | null
  recipientPhone?: string | null
  recipientEmail?: string | null
  shippingMethod: ProductShippingMethod
  postalCode?: string | null
  address?: string | null
  storeType?: string | null
  storeId?: string | null
  storeName?: string | null
  storeAddress?: string | null
  storePhone?: string | null
}

export type CreateProductOrderInput = {
  customerName?: string | null
  customerEmail?: string | null
  customerPhone?: string | null
  paymentMethod: ProductOrderPaymentMethod
  items: ProductOrderItemInput[]
  shippingInfo: ProductShippingInfoInput
  note?: string | null
}

export type ProductOrderPayload = {
  order_no: string
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  total_amount_twd: number
  payment_method: ProductOrderPaymentMethod
  payment_status: 'pending'
  order_status: 'pending_payment'
  shipping_status: 'not_shipped'
  note: string | null
  updated_at: string
}

export type ProductOrderItemPayload = {
  order_id: string
  product_slug: string
  product_name: string
  unit_price_twd: number
  quantity: number
  subtotal_twd: number
  product_snapshot: Record<string, unknown> | null
}

export type ProductShippingInfoPayload = {
  order_id: string
  recipient_name: string | null
  recipient_phone: string | null
  recipient_email: string | null
  shipping_method: ProductShippingMethod
  postal_code: string | null
  address: string | null
  store_type: string | null
  store_id: string | null
  store_name: string | null
  store_address: string | null
  store_phone: string | null
  updated_at: string
}

export type CreateProductOrderResult = {
  orderId: string
  orderNo: string
  totalAmountTwd: number
}

export type ProductOrderCreatedRow = {
  id: string
  order_no: string
  total_amount_twd: number
}

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>

const UNSAFE_PRODUCT_SNAPSHOT_KEYS = new Set([
  'TradeInfo',
  'TradeSha',
  'HashKey',
  'HashIV',
  'MerchantID',
  'Version',
  'creditCard',
  'cardNumber',
  'cardCvv',
  'cardExpiry',
  'paymentForm',
  'payment_form',
])

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed || null
}

function normalizeRequiredText(value: string, fieldName: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    throw new Error(`${fieldName} must not be blank`)
  }

  return trimmed
}

function assertValidItemAmounts(items: ProductOrderItemInput[]) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('invalid_product_order_items')
  }

  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error('invalid_product_order_items')
    }

    if (!Number.isInteger(item.unitPriceTwd) || item.unitPriceTwd < 0) {
      throw new Error('invalid_product_order_items')
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sanitizeSnapshotValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeSnapshotValue)
  }

  if (!isRecord(value)) {
    return value
  }

  return Object.entries(value).reduce<Record<string, unknown>>((result, [key, entry]) => {
    if (UNSAFE_PRODUCT_SNAPSHOT_KEYS.has(key)) {
      return result
    }

    result[key] = sanitizeSnapshotValue(entry)
    return result
  }, {})
}

function sanitizeProductSnapshot(snapshot: Record<string, unknown> | null | undefined) {
  if (!snapshot) return null
  return sanitizeSnapshotValue(snapshot) as Record<string, unknown>
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0')
}

export function buildProductOrderNo(now = new Date(), randomValue = Math.random()) {
  const timestamp = [
    now.getFullYear(),
    padDatePart(now.getMonth() + 1),
    padDatePart(now.getDate()),
    padDatePart(now.getHours()),
    padDatePart(now.getMinutes()),
    padDatePart(now.getSeconds()),
  ].join('')
  const normalizedRandom = Math.min(Math.max(randomValue, 0), 0.999999999)
  const suffix = Math.floor(normalizedRandom * 0x10000)
    .toString(16)
    .padStart(4, '0')
    .slice(0, 4)
    .toUpperCase()

  return `PO${timestamp}${suffix}`
}

export function calculateProductOrderTotal(items: ProductOrderItemInput[]) {
  assertValidItemAmounts(items)

  return items.reduce((total, item) => total + item.unitPriceTwd * item.quantity, 0)
}

export function buildProductOrderPayload(
  input: CreateProductOrderInput,
  orderNo: string,
  totalAmountTwd: number,
  now = new Date().toISOString(),
): ProductOrderPayload {
  if (input.paymentMethod !== 'bank_transfer' && input.paymentMethod !== 'newebpay') {
    throw new Error('invalid_product_order_payment_method')
  }

  if (!Number.isInteger(totalAmountTwd) || totalAmountTwd < 0) {
    throw new Error('invalid_product_order_total')
  }

  return {
    order_no: normalizeRequiredText(orderNo, 'orderNo'),
    customer_name: normalizeOptionalText(input.customerName),
    customer_email: normalizeOptionalText(input.customerEmail),
    customer_phone: normalizeOptionalText(input.customerPhone),
    total_amount_twd: totalAmountTwd,
    payment_method: input.paymentMethod,
    payment_status: 'pending',
    order_status: 'pending_payment',
    shipping_status: 'not_shipped',
    note: normalizeOptionalText(input.note),
    updated_at: now,
  }
}

export function buildProductOrderItemPayloads(
  orderId: string,
  items: ProductOrderItemInput[],
): ProductOrderItemPayload[] {
  const normalizedOrderId = normalizeRequiredText(orderId, 'orderId')
  assertValidItemAmounts(items)

  return items.map((item) => ({
    order_id: normalizedOrderId,
    product_slug: normalizeRequiredText(item.productSlug, 'productSlug'),
    product_name: normalizeRequiredText(item.productName, 'productName'),
    unit_price_twd: item.unitPriceTwd,
    quantity: item.quantity,
    subtotal_twd: item.unitPriceTwd * item.quantity,
    product_snapshot: sanitizeProductSnapshot(item.productSnapshot),
  }))
}

export function buildProductShippingInfoPayload(
  orderId: string,
  shippingInfo: ProductShippingInfoInput,
  now = new Date().toISOString(),
): ProductShippingInfoPayload {
  const normalizedOrderId = normalizeRequiredText(orderId, 'orderId')

  if (
    shippingInfo.shippingMethod !== 'manual' &&
    shippingInfo.shippingMethod !== 'convenience_store_c2c' &&
    shippingInfo.shippingMethod !== 'convenience_store_b2c' &&
    shippingInfo.shippingMethod !== 'home_delivery'
  ) {
    throw new Error('invalid_product_shipping_method')
  }

  return {
    order_id: normalizedOrderId,
    recipient_name: normalizeOptionalText(shippingInfo.recipientName),
    recipient_phone: normalizeOptionalText(shippingInfo.recipientPhone),
    recipient_email: normalizeOptionalText(shippingInfo.recipientEmail),
    shipping_method: shippingInfo.shippingMethod,
    postal_code: normalizeOptionalText(shippingInfo.postalCode),
    address: normalizeOptionalText(shippingInfo.address),
    store_type: normalizeOptionalText(shippingInfo.storeType),
    store_id: normalizeOptionalText(shippingInfo.storeId),
    store_name: normalizeOptionalText(shippingInfo.storeName),
    store_address: normalizeOptionalText(shippingInfo.storeAddress),
    store_phone: normalizeOptionalText(shippingInfo.storePhone),
    updated_at: now,
  }
}

export async function createProductOrder(
  input: CreateProductOrderInput,
  supabase: SupabaseAdminClient = getSupabaseAdmin(),
): Promise<CreateProductOrderResult> {
  const totalAmountTwd = calculateProductOrderTotal(input.items)
  const orderNo = buildProductOrderNo()
  const orderPayload = buildProductOrderPayload(input, orderNo, totalAmountTwd)

  const { data: orderData, error: orderError } = await supabase
    .from('product_orders')
    .insert(orderPayload)
    .select('id,order_no,total_amount_twd')
    .single()

  if (orderError || !orderData) {
    throw new Error('product_order_create_failed')
  }

  const orderRow = orderData as ProductOrderCreatedRow
  const itemPayloads = buildProductOrderItemPayloads(orderRow.id, input.items)
  const { error: itemError } = await supabase
    .from('product_order_items')
    .insert(itemPayloads)

  if (itemError) {
    throw new Error('product_order_items_create_failed')
  }

  const shippingPayload = buildProductShippingInfoPayload(orderRow.id, input.shippingInfo)
  const { error: shippingError } = await supabase
    .from('product_shipping_info')
    .insert(shippingPayload)

  if (shippingError) {
    throw new Error('product_shipping_info_create_failed')
  }

  return {
    orderId: orderRow.id,
    orderNo: orderRow.order_no,
    totalAmountTwd: orderRow.total_amount_twd,
  }
}
