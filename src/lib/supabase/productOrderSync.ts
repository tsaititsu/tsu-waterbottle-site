import { getSupabaseAdmin } from './admin'
import type { ProductOrderOrderStatus, ProductOrderPaymentStatus, ProductOrderShippingStatus } from './productOrders'

export type ProductOrderPaidSyncInput = {
  orderId: string
  paymentId: string
}

export type ProductOrderPaidSyncContext = {
  id: string
  paymentId: string | null
  paymentStatus: ProductOrderPaymentStatus | string | null
  orderStatus: ProductOrderOrderStatus | string | null
  shippingStatus: ProductOrderShippingStatus | string | null
}

export type ProductOrderPaidSyncContextRow = {
  id: string
  payment_id: string | null
  payment_status: ProductOrderPaymentStatus | string | null
  order_status: ProductOrderOrderStatus | string | null
  shipping_status: ProductOrderShippingStatus | string | null
}

export type ProductOrderPaidUpdatePayload = {
  payment_status: 'paid'
  order_status: 'paid'
  updated_at: string
}

export type ProductOrderPaidSyncResult =
  | { result: 'synced'; orderId: string }
  | { result: 'already_paid'; orderId: string }
  | { result: 'not_found'; orderId: string }
  | { result: 'payment_mismatch'; orderId: string }
  | { result: 'invalid_state'; orderId: string }
  | { result: 'failed'; orderId: string; error: string }

export type ProductOrderPaidSyncDecision = Exclude<ProductOrderPaidSyncResult['result'], 'failed'>

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  )
}

function normalizeUuid(value: string) {
  const trimmed = value.trim()
  if (!isUuid(trimmed)) {
    throw new Error('invalid_product_order_sync_input')
  }

  return trimmed
}

export function mapProductOrderPaidSyncContext(
  row: ProductOrderPaidSyncContextRow,
): ProductOrderPaidSyncContext {
  return {
    id: row.id,
    paymentId: row.payment_id,
    paymentStatus: row.payment_status,
    orderStatus: row.order_status,
    shippingStatus: row.shipping_status,
  }
}

export function buildProductOrderPaidUpdatePayload(now = new Date().toISOString()): ProductOrderPaidUpdatePayload {
  return {
    payment_status: 'paid',
    order_status: 'paid',
    updated_at: now,
  }
}

export function decideProductOrderPaidSync(input: {
  order: ProductOrderPaidSyncContext | null
  paymentId: string
}): ProductOrderPaidSyncDecision {
  if (!input.order) {
    return 'not_found'
  }

  if (!input.order.paymentId || input.order.paymentId !== input.paymentId) {
    return 'payment_mismatch'
  }

  if (input.order.paymentStatus === 'paid' && input.order.orderStatus === 'paid') {
    return 'already_paid'
  }

  if (input.order.paymentStatus === 'pending' && input.order.orderStatus === 'pending_payment') {
    return 'synced'
  }

  return 'invalid_state'
}

export async function getProductOrderPaidSyncContext(
  orderId: string,
  supabase: SupabaseAdminClient = getSupabaseAdmin(),
): Promise<ProductOrderPaidSyncContext | null> {
  const normalizedOrderId = normalizeUuid(orderId)
  const { data, error } = await supabase
    .from('product_orders')
    .select('id,payment_id,payment_status,order_status,shipping_status')
    .eq('id', normalizedOrderId)
    .maybeSingle()

  if (error) {
    throw new Error('product_order_paid_sync_read_failed')
  }

  return data ? mapProductOrderPaidSyncContext(data as ProductOrderPaidSyncContextRow) : null
}

export async function syncProductOrderAfterPaymentPaid(
  input: ProductOrderPaidSyncInput,
  supabase?: SupabaseAdminClient,
): Promise<ProductOrderPaidSyncResult> {
  let orderId: string
  let paymentId: string

  try {
    orderId = normalizeUuid(input.orderId)
    paymentId = normalizeUuid(input.paymentId)
  } catch {
    return {
      result: 'failed',
      orderId: input.orderId,
      error: 'invalid_product_order_sync_input',
    }
  }

  const supabaseClient = supabase ?? getSupabaseAdmin()
  let order: ProductOrderPaidSyncContext | null

  try {
    order = await getProductOrderPaidSyncContext(orderId, supabaseClient)
  } catch {
    return {
      result: 'failed',
      orderId,
      error: 'product_order_paid_sync_read_failed',
    }
  }

  const decision = decideProductOrderPaidSync({ order, paymentId })

  if (decision !== 'synced') {
    return {
      result: decision,
      orderId,
    }
  }

  const { error } = await supabaseClient
    .from('product_orders')
    .update(buildProductOrderPaidUpdatePayload())
    .eq('id', orderId)
    .eq('payment_id', paymentId)
    .eq('payment_status', 'pending')
    .eq('order_status', 'pending_payment')

  if (error) {
    return {
      result: 'failed',
      orderId,
      error: 'product_order_paid_sync_update_failed',
    }
  }

  return {
    result: 'synced',
    orderId,
  }
}
