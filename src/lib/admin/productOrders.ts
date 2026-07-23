import { maskEmail, maskPhone } from './pii'

export const PRODUCT_ORDER_STATUSES = [
  'pending_payment',
  'payment_requesting',
  'payment_pending',
  'payment_failed',
  'paid',
  'preparing',
  'shipped',
  'completed',
  'canceled',
] as const

export const ADMIN_PRODUCT_ORDER_LIST_COLUMNS = [
  'id',
  'order_no',
  'customer_name',
  'customer_email',
  'customer_phone',
  'total_amount_twd',
  'payment_status',
  'order_status',
  'shipping_status',
  'created_at',
  'product_order_items(product_name,quantity)',
].join(',')

export const ADMIN_PRODUCT_ORDER_DETAIL_COLUMNS = [
  'id',
  'order_no',
  'customer_name',
  'customer_email',
  'customer_phone',
  'total_amount_twd',
  'payment_status',
  'order_status',
  'shipping_status',
  'created_at',
  'updated_at',
  'product_order_items(id,product_name,unit_price_twd,quantity,subtotal_twd)',
  'product_shipping_info(recipient_name,recipient_phone,recipient_email,shipping_method,postal_code,address,store_type,store_name,store_address,store_phone,created_at,updated_at)',
].join(',')

export type AdminProductOrderItem = {
  id: string
  productName: string
  unitPriceTwd: number
  quantity: number
  subtotalTwd: number
}

export type AdminProductShippingInfo = {
  recipientName: string | null
  recipientPhone: string | null
  recipientEmail: string | null
  shippingMethod: string
  postalCode: string | null
  address: string | null
  storeType: string | null
  storeName: string | null
  storeAddress: string | null
  storePhone: string | null
  createdAt: string
  updatedAt: string
}

export type AdminProductOrderListItem = {
  id: string
  orderNumber: string
  createdAt: string
  customerName: string
  customerEmail: string
  customerPhone: string
  productSummary: string
  totalAmountTwd: number
  orderStatus: string
  paymentStatus: string
  shippingStatus: string
}

export type AdminProductOrderDetail = AdminProductOrderListItem & {
  updatedAt: string
  items: AdminProductOrderItem[]
  shipping: AdminProductShippingInfo | null
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function records(value: unknown) {
  if (Array.isArray(value)) return value.map(record)
  return value ? [record(value)] : []
}

function text(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function nullableText(value: unknown) {
  const normalized = text(value)
  return normalized ? normalized : null
}

function number(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function productSummary(value: unknown) {
  const items = records(value)
  if (items.length === 0) return '商品資料未提供'

  const visible = items.slice(0, 2).map((item) => {
    const name = text(item.product_name) || '未命名商品'
    return `${name} × ${number(item.quantity)}`
  })
  return items.length > 2 ? `${visible.join('、')} 等 ${items.length} 項` : visible.join('、')
}

function mapItems(value: unknown): AdminProductOrderItem[] {
  return records(value).map((item) => ({
    id: text(item.id),
    productName: text(item.product_name) || '未命名商品',
    unitPriceTwd: number(item.unit_price_twd),
    quantity: number(item.quantity),
    subtotalTwd: number(item.subtotal_twd),
  }))
}

function mapShipping(value: unknown): AdminProductShippingInfo | null {
  const shipping = records(value)[0]
  if (!shipping) return null

  return {
    recipientName: nullableText(shipping.recipient_name),
    recipientPhone: nullableText(shipping.recipient_phone),
    recipientEmail: nullableText(shipping.recipient_email),
    shippingMethod: text(shipping.shipping_method),
    postalCode: nullableText(shipping.postal_code),
    address: nullableText(shipping.address),
    storeType: nullableText(shipping.store_type),
    storeName: nullableText(shipping.store_name),
    storeAddress: nullableText(shipping.store_address),
    storePhone: nullableText(shipping.store_phone),
    createdAt: text(shipping.created_at),
    updatedAt: text(shipping.updated_at),
  }
}

export function mapAdminProductOrderListRow(value: unknown): AdminProductOrderListItem {
  const row = record(value)
  return {
    id: text(row.id),
    orderNumber: text(row.order_no),
    createdAt: text(row.created_at),
    customerName: text(row.customer_name) || '未提供',
    customerEmail: maskEmail(nullableText(row.customer_email)),
    customerPhone: maskPhone(nullableText(row.customer_phone)),
    productSummary: productSummary(row.product_order_items),
    totalAmountTwd: number(row.total_amount_twd),
    orderStatus: text(row.order_status) || 'unknown',
    paymentStatus: text(row.payment_status) || 'unknown',
    shippingStatus: text(row.shipping_status) || 'unknown',
  }
}

export function mapAdminProductOrderDetailRow(value: unknown): AdminProductOrderDetail {
  const row = record(value)
  return {
    ...mapAdminProductOrderListRow(row),
    updatedAt: text(row.updated_at),
    items: mapItems(row.product_order_items),
    shipping: mapShipping(row.product_shipping_info),
  }
}
