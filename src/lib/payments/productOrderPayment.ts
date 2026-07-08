import type { ProductOrderPaymentContext } from '../supabase/productOrders'
import { createPendingPayment, type PaymentRecord } from '../supabase/payments'
import { linkProductOrderPendingPayment } from '../supabase/productOrders'
import { getSupabaseAdmin } from '../supabase/admin'

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

export type ProductOrderLinePayPaymentMetadata = {
  linePay: {
    orderId: string
    sourceType: 'product_order'
    sourceId: string
  }
}

export type CreateProductOrderLinePayPendingPaymentInput = {
  productOrderId: string
  amount: number
  currency: 'TWD'
  provider: 'line_pay'
  merchantOrderNo: string
  metadata: ProductOrderLinePayPaymentMetadata
}

export type CreateProductOrderLinePayPendingPaymentResult = {
  paymentId: string
  merchantOrderNo: string
}

export type CreateProductOrderLinePayPendingPaymentDeps = {
  createPendingPayment?: typeof createPendingPayment
  linkProductOrderPendingPayment?: typeof linkProductOrderPendingPayment
}

export type UpdateProductOrderLinePayPaymentMetadataInput = {
  paymentId: string
  metadata: Record<string, unknown>
}

export type UpdateProductOrderLinePayPaymentMetadataResult = {
  paymentId: string
}

export type MarkProductOrderLinePayPaymentPaidInput = {
  paymentId: string
  provider: 'line_pay'
  transactionId: string
  orderId: string
  amount: number
  currency: 'TWD'
  metadata: Record<string, unknown>
  paidAt?: string | null
}

export type MarkProductOrderLinePayPaymentPaidResult = {
  paymentId: string
}

export type ProductOrderLinePayConfirmPaymentContext = {
  id: string
  provider: string | null
  status: string | null
  amount: number | null
  currency: string | null
  merchant_order_no: string | null
  raw_payload: Record<string, unknown> | null
}

export type ProductOrderLinePayCancelPaymentContext = {
  id: string
  provider: string | null
  status: string | null
  merchant_order_no: string | null
  raw_payload: Record<string, unknown> | null
}

type ProductOrderLinePayConfirmPaymentRow = {
  id: string
  provider: string | null
  status: string | null
  amount_twd: number | null
  currency: string | null
  merchant_order_no: string | null
  raw_payload: Record<string, unknown> | null
}

type ProductOrderLinePayCancelPaymentRow = {
  id: string
  provider: string | null
  status: string | null
  merchant_order_no: string | null
  raw_payload: Record<string, unknown> | null
}

const PRODUCT_ORDER_ITEM_DESC_MAX_LENGTH = 50
const BLOCKED_LINE_PAY_METADATA_KEY_PATTERN =
  /channelSecret|channelId|TradeInfo|TradeSha|HashKey|HashIV|signature|headers|phone|email|address|creditCard|cardNumber|paymentForm/i

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  )
}

function assertUuid(value: string, errorCode: string) {
  const trimmed = normalizeRequiredText(value, errorCode)

  if (!isUuid(trimmed)) {
    throw new Error(errorCode)
  }

  return trimmed
}

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value
}

function normalizeRequiredText(value: string, errorCode: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    throw new Error(errorCode)
  }

  return trimmed
}

function buildProductOrderLinePayRawPayload(
  input: CreateProductOrderLinePayPendingPaymentInput,
): ProductOrderLinePayPaymentMetadata {
  const orderId = normalizeRequiredText(input.metadata.linePay.orderId, 'invalid_product_order_line_pay_metadata')
  const sourceId = normalizeRequiredText(input.metadata.linePay.sourceId, 'invalid_product_order_line_pay_metadata')

  if (input.metadata.linePay.sourceType !== 'product_order') {
    throw new Error('invalid_product_order_line_pay_metadata')
  }

  return {
    linePay: {
      orderId,
      sourceType: 'product_order',
      sourceId,
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertSafeLinePayMetadata(value: unknown): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error('invalid_product_order_line_pay_metadata')
  }

  for (const [key, entry] of Object.entries(value)) {
    if (BLOCKED_LINE_PAY_METADATA_KEY_PATTERN.test(key)) {
      throw new Error('invalid_product_order_line_pay_metadata')
    }

    if (Array.isArray(entry)) {
      for (const item of entry) {
        if (isRecord(item)) {
          assertSafeLinePayMetadata(item)
        }
      }
    } else if (isRecord(entry)) {
      assertSafeLinePayMetadata(entry)
    }
  }
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

export async function createProductOrderLinePayPendingPayment(
  input: CreateProductOrderLinePayPendingPaymentInput,
  deps: CreateProductOrderLinePayPendingPaymentDeps = {},
): Promise<CreateProductOrderLinePayPendingPaymentResult> {
  const productOrderId = normalizeRequiredText(input.productOrderId, 'invalid_product_order_line_pay_input')
  const merchantOrderNo = normalizeRequiredText(input.merchantOrderNo, 'invalid_product_order_line_pay_input')

  if (input.provider !== 'line_pay' || input.currency !== 'TWD') {
    throw new Error('invalid_product_order_line_pay_input')
  }

  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error('invalid_product_order_line_pay_input')
  }

  const rawPayload = buildProductOrderLinePayRawPayload(input)
  const createPayment = deps.createPendingPayment ?? createPendingPayment
  const linkOrderPayment = deps.linkProductOrderPendingPayment ?? linkProductOrderPendingPayment
  const payment = (await createPayment({
    provider: 'line_pay',
    itemType: PRODUCT_ORDER_PAYMENT_ITEM_TYPE,
    itemId: productOrderId,
    itemName: truncateText(`開運商品訂單 ${merchantOrderNo}`, PRODUCT_ORDER_ITEM_DESC_MAX_LENGTH),
    merchantOrderNo,
    amountTwd: input.amount,
    rawPayload,
  })) as Pick<PaymentRecord, 'id'>

  await linkOrderPayment({
    orderId: productOrderId,
    paymentId: payment.id,
  })

  return {
    paymentId: payment.id,
    merchantOrderNo,
  }
}

export async function updateProductOrderLinePayPaymentMetadata(
  input: UpdateProductOrderLinePayPaymentMetadataInput,
  supabase = getSupabaseAdmin(),
): Promise<UpdateProductOrderLinePayPaymentMetadataResult> {
  const paymentId = assertUuid(input.paymentId, 'invalid_product_order_line_pay_payment_id')

  assertSafeLinePayMetadata(input.metadata)

  const { error } = await supabase
    .from('payments')
    .update({
      raw_payload: input.metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId)
    .eq('provider', 'line_pay')
    .eq('status', 'pending')

  if (error) {
    throw new Error('product_order_payment_metadata_update_failed')
  }

  return {
    paymentId,
  }
}

export async function markProductOrderLinePayPaymentPaid(
  input: MarkProductOrderLinePayPaymentPaidInput,
  supabase = getSupabaseAdmin(),
): Promise<MarkProductOrderLinePayPaymentPaidResult> {
  const paymentId = assertUuid(input.paymentId, 'invalid_product_order_line_pay_payment_id')
  const orderId = normalizeRequiredText(input.orderId, 'invalid_product_order_line_pay_input')
  const transactionId = normalizeRequiredText(input.transactionId, 'invalid_product_order_line_pay_input')

  if (input.provider !== 'line_pay' || input.currency !== 'TWD') {
    throw new Error('invalid_product_order_line_pay_input')
  }

  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error('invalid_product_order_line_pay_input')
  }

  assertSafeLinePayMetadata(input.metadata)

  const paidAt = input.paidAt ?? new Date().toISOString()
  const { error } = await supabase
    .from('payments')
    .update({
      status: 'paid',
      provider_trade_no: transactionId,
      paid_at: paidAt,
      raw_payload: input.metadata,
      updated_at: paidAt,
    })
    .eq('id', paymentId)
    .eq('provider', 'line_pay')
    .eq('status', 'pending')
    .eq('amount_twd', input.amount)
    .eq('currency', 'TWD')
    .eq('merchant_order_no', orderId)

  if (error) {
    throw new Error('product_order_line_pay_payment_mark_paid_failed')
  }

  return {
    paymentId,
  }
}

export async function getProductOrderLinePayConfirmPaymentContext(
  input: { orderId: string },
  supabase = getSupabaseAdmin(),
): Promise<ProductOrderLinePayConfirmPaymentContext | null> {
  const orderId = normalizeRequiredText(input.orderId, 'invalid_line_pay_order_id')

  const { data, error } = await supabase
    .from('payments')
    .select('id,provider,status,amount_twd,currency,merchant_order_no,raw_payload')
    .eq('merchant_order_no', orderId)
    .eq('provider', 'line_pay')
    .maybeSingle()

  if (error) {
    throw new Error('line_pay_payment_lookup_failed')
  }

  if (!data) {
    return null
  }

  const row = data as ProductOrderLinePayConfirmPaymentRow

  return {
    id: row.id,
    provider: row.provider,
    status: row.status,
    amount: row.amount_twd,
    currency: row.currency,
    merchant_order_no: row.merchant_order_no,
    raw_payload: row.raw_payload,
  }
}

export async function getProductOrderLinePayCancelContext(
  input: { orderId?: string | null; transactionId?: string | null },
  supabase = getSupabaseAdmin(),
): Promise<ProductOrderLinePayCancelPaymentContext | null> {
  const orderId = input.orderId?.trim() || null
  const transactionId = input.transactionId?.trim() || null

  if (!orderId && !transactionId) {
    throw new Error('invalid_line_pay_cancel_lookup')
  }

  let query = supabase
    .from('payments')
    .select('id,provider,status,merchant_order_no,raw_payload')
    .eq('provider', 'line_pay')

  query = orderId
    ? query.eq('merchant_order_no', orderId)
    : query.eq('raw_payload->linePay->>transactionId', transactionId)

  const { data, error } = await query.maybeSingle()

  if (error) {
    throw new Error('line_pay_cancel_payment_lookup_failed')
  }

  if (!data) {
    return null
  }

  const row = data as ProductOrderLinePayCancelPaymentRow

  return {
    id: row.id,
    provider: row.provider,
    status: row.status,
    merchant_order_no: row.merchant_order_no,
    raw_payload: row.raw_payload,
  }
}
