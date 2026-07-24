import { maskEmail, maskPhone } from './pii'
import {
  hasExactKeys,
  isFiniteNumber,
  isNullableString,
  isPlainRecord,
  isPositiveSafeInteger,
  isString,
} from './validation'

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
].join(',')

export const ADMIN_PRODUCT_ORDER_DETAIL_COLUMNS = [
  ADMIN_PRODUCT_ORDER_LIST_COLUMNS,
  'updated_at',
].join(',')

export const ADMIN_PRODUCT_ORDER_LIST_ITEM_COLUMNS =
  'id,order_id,product_name,quantity,created_at'

export const ADMIN_PRODUCT_ORDER_DETAIL_ITEM_COLUMNS =
  'id,order_id,product_name,unit_price_twd,quantity,subtotal_twd,created_at'

export const ADMIN_PRODUCT_ORDER_SHIPPING_COLUMNS = [
  'order_id',
  'recipient_name',
  'recipient_phone',
  'recipient_email',
  'shipping_method',
  'postal_code',
  'address',
  'store_type',
  'store_name',
  'store_address',
  'store_phone',
  'created_at',
  'updated_at',
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

const ADMIN_PRODUCT_ORDER_LIST_KEYS = [
  'id',
  'orderNumber',
  'createdAt',
  'customerName',
  'customerEmail',
  'customerPhone',
  'productSummary',
  'totalAmountTwd',
  'orderStatus',
  'paymentStatus',
  'shippingStatus',
] as const

const ADMIN_PRODUCT_ORDER_ITEM_KEYS = [
  'id',
  'productName',
  'unitPriceTwd',
  'quantity',
  'subtotalTwd',
] as const

const ADMIN_PRODUCT_SHIPPING_KEYS = [
  'recipientName',
  'recipientPhone',
  'recipientEmail',
  'shippingMethod',
  'postalCode',
  'address',
  'storeType',
  'storeName',
  'storeAddress',
  'storePhone',
  'createdAt',
  'updatedAt',
] as const

const ADMIN_PRODUCT_ORDER_DETAIL_KEYS = [
  ...ADMIN_PRODUCT_ORDER_LIST_KEYS,
  'updatedAt',
  'items',
  'shipping',
] as const

function isAdminProductOrderItem(value: unknown): value is AdminProductOrderItem {
  return (
    isPlainRecord(value) &&
    hasExactKeys(value, ADMIN_PRODUCT_ORDER_ITEM_KEYS) &&
    isString(value.id) &&
    isString(value.productName) &&
    isFiniteNumber(value.unitPriceTwd) &&
    isPositiveSafeInteger(value.quantity) &&
    isFiniteNumber(value.subtotalTwd)
  )
}

function isAdminProductShippingInfo(
  value: unknown,
): value is AdminProductShippingInfo {
  return (
    isPlainRecord(value) &&
    hasExactKeys(value, ADMIN_PRODUCT_SHIPPING_KEYS) &&
    isNullableString(value.recipientName) &&
    isNullableString(value.recipientPhone) &&
    isNullableString(value.recipientEmail) &&
    isString(value.shippingMethod) &&
    isNullableString(value.postalCode) &&
    isNullableString(value.address) &&
    isNullableString(value.storeType) &&
    isNullableString(value.storeName) &&
    isNullableString(value.storeAddress) &&
    isNullableString(value.storePhone) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  )
}

export function isAdminProductOrderListItem(
  value: unknown,
): value is AdminProductOrderListItem {
  return (
    isPlainRecord(value) &&
    hasExactKeys(value, ADMIN_PRODUCT_ORDER_LIST_KEYS) &&
    isString(value.id) &&
    isString(value.orderNumber) &&
    isString(value.createdAt) &&
    isString(value.customerName) &&
    isString(value.customerEmail) &&
    isString(value.customerPhone) &&
    isString(value.productSummary) &&
    isFiniteNumber(value.totalAmountTwd) &&
    isString(value.orderStatus) &&
    isString(value.paymentStatus) &&
    isString(value.shippingStatus)
  )
}

export function isAdminProductOrderDetail(
  value: unknown,
): value is AdminProductOrderDetail {
  return (
    isPlainRecord(value) &&
    hasExactKeys(value, ADMIN_PRODUCT_ORDER_DETAIL_KEYS) &&
    isString(value.id) &&
    isString(value.orderNumber) &&
    isString(value.createdAt) &&
    isString(value.customerName) &&
    isString(value.customerEmail) &&
    isString(value.customerPhone) &&
    isString(value.productSummary) &&
    isFiniteNumber(value.totalAmountTwd) &&
    isString(value.orderStatus) &&
    isString(value.paymentStatus) &&
    isString(value.shippingStatus) &&
    isString(value.updatedAt) &&
    Array.isArray(value.items) &&
    value.items.every(isAdminProductOrderItem) &&
    (value.shipping === null || isAdminProductShippingInfo(value.shipping))
  )
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

function compareItems(left: Record<string, unknown>, right: Record<string, unknown>) {
  return (
    text(left.created_at).localeCompare(text(right.created_at)) ||
    text(left.id).localeCompare(text(right.id))
  )
}

export function sortAdminProductOrderItemRows(value: unknown) {
  return records(value).sort(compareItems)
}

function productSummary(value: unknown) {
  const items = sortAdminProductOrderItemRows(value)
  if (items.length === 0) return '商品資料未提供'

  const visible = items.slice(0, 2).map((item) => {
    const name = text(item.product_name) || '未命名商品'
    return `${name} × ${number(item.quantity)}`
  })
  return items.length > 2 ? `${visible.join('、')} 等 ${items.length} 項` : visible.join('、')
}

function mapItems(value: unknown): AdminProductOrderItem[] {
  return sortAdminProductOrderItemRows(value).map((item) => ({
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

export function mapAdminProductOrderListRow(
  value: unknown,
  itemRows: unknown = [],
): AdminProductOrderListItem {
  const row = record(value)
  return {
    id: text(row.id),
    orderNumber: text(row.order_no),
    createdAt: text(row.created_at),
    customerName: text(row.customer_name) || '未提供',
    customerEmail: maskEmail(nullableText(row.customer_email)),
    customerPhone: maskPhone(nullableText(row.customer_phone)),
    productSummary: productSummary(itemRows),
    totalAmountTwd: number(row.total_amount_twd),
    orderStatus: text(row.order_status) || 'unknown',
    paymentStatus: text(row.payment_status) || 'unknown',
    shippingStatus: text(row.shipping_status) || 'unknown',
  }
}

export function mapAdminProductOrderDetailRow(
  value: unknown,
  itemRows: unknown = [],
  shippingRow: unknown = null,
): AdminProductOrderDetail {
  const row = record(value)
  return {
    ...mapAdminProductOrderListRow(row, itemRows),
    updatedAt: text(row.updated_at),
    items: mapItems(itemRows),
    shipping: mapShipping(shippingRow),
  }
}
