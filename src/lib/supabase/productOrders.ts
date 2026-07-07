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

export type ProductOrderPaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'canceled'
export type ProductOrderOrderStatus = 'pending_payment' | 'paid' | 'preparing' | 'shipped' | 'completed' | 'canceled'
export type ProductOrderShippingStatus = 'not_shipped' | 'preparing' | 'shipped' | 'delivered' | 'failed' | 'returned'

export type ProductOrderPaymentContext = {
  id: string
  orderNo: string
  totalAmountTwd: number
  paymentMethod: ProductOrderPaymentMethod | string | null
  paymentStatus: ProductOrderPaymentStatus | string | null
  orderStatus: ProductOrderOrderStatus | string | null
  shippingStatus: ProductOrderShippingStatus | string | null
  paymentId: string | null
}

export type ProductOrderPaymentContextRow = {
  id: string
  order_no: string
  total_amount_twd: number
  payment_method: ProductOrderPaymentMethod | string | null
  payment_status: ProductOrderPaymentStatus | string | null
  order_status: ProductOrderOrderStatus | string | null
  shipping_status: ProductOrderShippingStatus | string | null
  payment_id: string | null
}

export type ProductOrderPaymentLinkPayload = {
  payment_id: string
  payment_method: 'newebpay'
  updated_at: string
}

export type LinkProductOrderPaymentInput = {
  orderId: string
  paymentId: string
}

export type LinkProductOrderPaymentResult = {
  orderId: string
  paymentId: string
}

export type ProductOrderPaymentIdLinkPayload = {
  payment_id: string
  updated_at: string
}

export type ProductOrderLinePayPreflightItem = {
  name: string
  quantity: number
  amount: number
}

export type ProductOrderLinePayPreflightContext = {
  id: string
  status: string | null
  payment_status: string | null
  payment_id: string | null
  total_amount: number | null
  currency: 'TWD'
  items: ProductOrderLinePayPreflightItem[]
}

export type ProductOrderLinePayConfirmContext = {
  id: string
  status: string | null
  payment_status: string | null
  payment_id: string | null
  total_amount: number | null
  currency: 'TWD'
}

type ProductOrderLinePayPreflightRow = {
  id: string
  order_status: string | null
  payment_status: string | null
  payment_id: string | null
  total_amount_twd: number | null
}

type ProductOrderLinePayConfirmRow = {
  id: string
  order_status: string | null
  payment_status: string | null
  payment_id: string | null
  total_amount_twd: number | null
}

type ProductOrderLinePayPreflightItemRow = {
  product_name: string | null
  quantity: number | null
  unit_price_twd: number | null
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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  )
}

function assertValidUuid(value: string, fieldName: string) {
  const trimmed = normalizeRequiredText(value, fieldName)

  if (!isUuid(trimmed)) {
    throw new Error('invalid_product_order_payment_input')
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

export function mapProductOrderPaymentContext(row: ProductOrderPaymentContextRow): ProductOrderPaymentContext {
  return {
    id: row.id,
    orderNo: row.order_no,
    totalAmountTwd: row.total_amount_twd,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    orderStatus: row.order_status,
    shippingStatus: row.shipping_status,
    paymentId: row.payment_id,
  }
}

export function buildProductOrderPaymentLinkPayload(
  input: Pick<LinkProductOrderPaymentInput, 'paymentId'>,
  now = new Date().toISOString(),
): ProductOrderPaymentLinkPayload {
  return {
    payment_id: assertValidUuid(input.paymentId, 'paymentId'),
    payment_method: 'newebpay',
    updated_at: now,
  }
}

export function buildProductOrderPaymentIdLinkPayload(
  input: Pick<LinkProductOrderPaymentInput, 'paymentId'>,
  now = new Date().toISOString(),
): ProductOrderPaymentIdLinkPayload {
  return {
    payment_id: assertValidUuid(input.paymentId, 'paymentId'),
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

export async function getProductOrderForPayment(
  orderId: string,
  supabase: SupabaseAdminClient = getSupabaseAdmin(),
): Promise<ProductOrderPaymentContext | null> {
  const normalizedOrderId = assertValidUuid(orderId, 'orderId')

  const { data, error } = await supabase
    .from('product_orders')
    .select('id,order_no,total_amount_twd,payment_method,payment_status,order_status,shipping_status,payment_id')
    .eq('id', normalizedOrderId)
    .maybeSingle()

  if (error) {
    throw new Error('product_order_lookup_failed')
  }

  return data ? mapProductOrderPaymentContext(data as ProductOrderPaymentContextRow) : null
}

export async function getProductOrderLinePayPreflightContext(
  orderId: string,
  supabase: SupabaseAdminClient = getSupabaseAdmin(),
): Promise<ProductOrderLinePayPreflightContext | null> {
  const normalizedOrderId = assertValidUuid(orderId, 'orderId')

  const { data: orderData, error: orderError } = await supabase
    .from('product_orders')
    .select('id,order_status,payment_status,payment_id,total_amount_twd')
    .eq('id', normalizedOrderId)
    .maybeSingle()

  if (orderError) {
    throw new Error('product_order_lookup_failed')
  }

  if (!orderData) {
    return null
  }

  const { data: itemData, error: itemError } = await supabase
    .from('product_order_items')
    .select('product_name,quantity,unit_price_twd')
    .eq('order_id', normalizedOrderId)

  if (itemError) {
    throw new Error('product_order_lookup_failed')
  }

  const order = orderData as ProductOrderLinePayPreflightRow
  const items = (itemData ?? []).map((item) => {
    const row = item as ProductOrderLinePayPreflightItemRow

    return {
      name: row.product_name ?? '',
      quantity: row.quantity ?? 0,
      amount: row.unit_price_twd ?? 0,
    }
  })

  return {
    id: order.id,
    status: order.order_status,
    payment_status: order.payment_status,
    payment_id: order.payment_id,
    total_amount: order.total_amount_twd,
    currency: 'TWD',
    items,
  }
}

export async function getProductOrderLinePayConfirmContext(
  input: { productOrderId: string },
  supabase: SupabaseAdminClient = getSupabaseAdmin(),
): Promise<ProductOrderLinePayConfirmContext | null> {
  const normalizedOrderId = assertValidUuid(input.productOrderId, 'productOrderId')

  const { data, error } = await supabase
    .from('product_orders')
    .select('id,order_status,payment_status,payment_id,total_amount_twd')
    .eq('id', normalizedOrderId)
    .maybeSingle()

  if (error) {
    throw new Error('product_order_lookup_failed')
  }

  if (!data) {
    return null
  }

  const order = data as ProductOrderLinePayConfirmRow

  return {
    id: order.id,
    status: order.order_status,
    payment_status: order.payment_status,
    payment_id: order.payment_id,
    total_amount: order.total_amount_twd,
    currency: 'TWD',
  }
}

export async function linkProductOrderPayment(
  input: LinkProductOrderPaymentInput,
  supabase: SupabaseAdminClient = getSupabaseAdmin(),
): Promise<LinkProductOrderPaymentResult> {
  const orderId = assertValidUuid(input.orderId, 'orderId')
  const paymentId = assertValidUuid(input.paymentId, 'paymentId')
  const order = await getProductOrderForPayment(orderId, supabase)

  if (!order) {
    throw new Error('product_order_not_found')
  }

  if (
    order.paymentStatus !== 'pending' ||
    order.orderStatus !== 'pending_payment' ||
    (order.paymentId !== null && order.paymentId !== paymentId)
  ) {
    throw new Error('product_order_not_payable')
  }

  const { error } = await supabase
    .from('product_orders')
    .update(buildProductOrderPaymentLinkPayload({ paymentId }))
    .eq('id', orderId)
    .eq('payment_status', 'pending')
    .eq('order_status', 'pending_payment')

  if (error) {
    throw new Error('product_order_payment_link_failed')
  }

  return {
    orderId,
    paymentId,
  }
}

export async function linkProductOrderPendingPayment(
  input: LinkProductOrderPaymentInput,
  supabase: SupabaseAdminClient = getSupabaseAdmin(),
): Promise<LinkProductOrderPaymentResult> {
  const orderId = assertValidUuid(input.orderId, 'orderId')
  const paymentId = assertValidUuid(input.paymentId, 'paymentId')
  const order = await getProductOrderForPayment(orderId, supabase)

  if (!order) {
    throw new Error('product_order_not_found')
  }

  if (
    order.paymentStatus !== 'pending' ||
    order.orderStatus !== 'pending_payment' ||
    (order.paymentId !== null && order.paymentId !== paymentId)
  ) {
    throw new Error('product_order_not_payable')
  }

  const { error } = await supabase
    .from('product_orders')
    .update(buildProductOrderPaymentIdLinkPayload({ paymentId }))
    .eq('id', orderId)
    .eq('payment_status', 'pending')
    .eq('order_status', 'pending_payment')

  if (error) {
    throw new Error('product_order_payment_link_failed')
  }

  return {
    orderId,
    paymentId,
  }
}
