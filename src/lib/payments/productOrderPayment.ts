import type { ProductOrderPaymentContext } from '../supabase/productOrders'

export const PRODUCT_ORDER_PAYMENT_ITEM_KEY = 'spiritual_product_order'
export const PRODUCT_ORDER_PAYMENT_ITEM_TYPE = 'spiritual_product_order'
export const PRODUCT_ORDER_PAYMENT_SOURCE = 'product_order'

export type ProductOrderForPayment = ProductOrderPaymentContext

export type ProductOrderPaymentRawPayload = {
  itemKey: typeof PRODUCT_ORDER_PAYMENT_ITEM_KEY
  itemType: typeof PRODUCT_ORDER_PAYMENT_ITEM_TYPE
  source: typeof PRODUCT_ORDER_PAYMENT_SOURCE
  orderId: string
  orderNo: string
  amount: number
}

export type ProductOrderPaymentMapping = {
  itemKey: typeof PRODUCT_ORDER_PAYMENT_ITEM_KEY
  itemType: typeof PRODUCT_ORDER_PAYMENT_ITEM_TYPE
  itemId: string
  amountTwd: number
  itemDesc: string
  rawPayload: ProductOrderPaymentRawPayload
}

const PRODUCT_ORDER_ITEM_DESC_MAX_LENGTH = 50

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  )
}

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value
}

export function validateProductOrderPayableForNewebpay(order: ProductOrderForPayment | null) {
  if (!order) {
    throw new Error('product_order_not_found')
  }

  const orderId = order.id.trim()
  const orderNo = order.orderNo.trim()

  if (!isUuid(orderId) || !orderNo || !Number.isInteger(order.totalAmountTwd) || order.totalAmountTwd <= 0) {
    throw new Error('invalid_product_order_payment_input')
  }

  if (
    order.paymentMethod !== 'newebpay' ||
    order.paymentStatus !== 'pending' ||
    order.orderStatus !== 'pending_payment' ||
    (order.shippingStatus !== 'not_shipped' && order.shippingStatus !== 'preparing') ||
    order.paymentId !== null
  ) {
    throw new Error('product_order_not_payable')
  }
}

export function buildProductOrderPaymentMapping(order: ProductOrderForPayment): ProductOrderPaymentMapping {
  validateProductOrderPayableForNewebpay(order)

  const orderId = order.id.trim()
  const orderNo = order.orderNo.trim()
  const itemDesc = truncateText(`開運商品訂單 ${orderNo}`, PRODUCT_ORDER_ITEM_DESC_MAX_LENGTH)

  return {
    itemKey: PRODUCT_ORDER_PAYMENT_ITEM_KEY,
    itemType: PRODUCT_ORDER_PAYMENT_ITEM_TYPE,
    itemId: orderId,
    amountTwd: order.totalAmountTwd,
    itemDesc,
    rawPayload: {
      itemKey: PRODUCT_ORDER_PAYMENT_ITEM_KEY,
      itemType: PRODUCT_ORDER_PAYMENT_ITEM_TYPE,
      source: PRODUCT_ORDER_PAYMENT_SOURCE,
      orderId,
      orderNo,
      amount: order.totalAmountTwd,
    },
  }
}
