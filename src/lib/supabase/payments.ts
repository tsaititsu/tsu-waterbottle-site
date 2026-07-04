import { getSupabaseAdmin } from './admin'

export type PaymentProvider = 'newebpay'

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled'

export type CreatePendingPaymentInput = {
  userId?: string | null
  bookingId?: string | null
  provider: PaymentProvider
  itemType: string
  itemId?: string | null
  itemName: string
  merchantOrderNo: string
  amountTwd: number
  rawPayload?: Record<string, unknown>
}

export type MarkPaymentPaidInput = {
  merchantOrderNo: string
  providerTradeNo?: string | null
  rawPayload: Record<string, unknown>
  paidAt?: string
  notifyReceivedAt?: string
}

export type PaymentRow = {
  id: string
  user_id: string | null
  booking_id: string | null
  provider: PaymentProvider | string
  provider_payment_id: string | null
  item_type: string
  item_id: string | null
  item_name: string
  amount_twd: number
  currency: string
  status: PaymentStatus | string
  paid_at: string | null
  refunded_at: string | null
  raw_payload: Record<string, unknown> | null
  merchant_order_no: string | null
  provider_trade_no: string | null
  notify_received_at: string | null
  failure_reason: string | null
  created_at: string
  updated_at: string
}

export type PaymentRecord = {
  id: string
  userId: string | null
  bookingId: string | null
  provider: PaymentProvider | string
  providerPaymentId: string | null
  itemType: string
  itemId: string | null
  itemName: string
  amountTwd: number
  currency: string
  status: PaymentStatus | string
  paidAt: string | null
  refundedAt: string | null
  rawPayload: Record<string, unknown> | null
  merchantOrderNo: string | null
  providerTradeNo: string | null
  notifyReceivedAt: string | null
  failureReason: string | null
  createdAt: string
  updatedAt: string
}

export type PaymentPaidContext = {
  id: string
  bookingId: string | null
  provider: PaymentProvider | string
  status: PaymentStatus | string
  merchantOrderNo: string | null
  providerTradeNo: string | null
  paidAt: string | null
}

export type PendingPaymentInsertPayload = {
  user_id: string | null
  booking_id: string | null
  provider: PaymentProvider
  item_type: string
  item_id: string | null
  item_name: string
  amount_twd: number
  currency: 'TWD'
  status: 'pending'
  merchant_order_no: string
  raw_payload: Record<string, unknown> | null
}

export type PaidPaymentUpdatePayload = {
  status: 'paid'
  provider_trade_no: string | null
  paid_at: string
  notify_received_at: string
  raw_payload: Record<string, unknown>
}

export type MarkPaymentPaidDecision = 'not_found' | 'already_paid' | 'should_update'

export type MarkPaymentPaidResult =
  | { result: 'not_found'; payment: null }
  | { result: 'already_paid'; payment: PaymentPaidContext }
  | { result: 'updated'; payment: PaymentPaidContext }

function assertRequiredText(value: string, fieldName: string) {
  if (!value.trim()) {
    throw new Error(`${fieldName} 不可空白`)
  }
}

export function mapPaymentRow(row: PaymentRow): PaymentRecord {
  return {
    id: row.id,
    userId: row.user_id,
    bookingId: row.booking_id,
    provider: row.provider,
    providerPaymentId: row.provider_payment_id,
    itemType: row.item_type,
    itemId: row.item_id,
    itemName: row.item_name,
    amountTwd: row.amount_twd,
    currency: row.currency,
    status: row.status,
    paidAt: row.paid_at,
    refundedAt: row.refunded_at,
    rawPayload: row.raw_payload,
    merchantOrderNo: row.merchant_order_no,
    providerTradeNo: row.provider_trade_no,
    notifyReceivedAt: row.notify_received_at,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapPaymentPaidContext(payment: PaymentRecord): PaymentPaidContext {
  return {
    id: payment.id,
    bookingId: payment.bookingId,
    provider: payment.provider,
    status: payment.status,
    merchantOrderNo: payment.merchantOrderNo,
    providerTradeNo: payment.providerTradeNo,
    paidAt: payment.paidAt,
  }
}

export function buildPendingPaymentInsert(input: CreatePendingPaymentInput): PendingPaymentInsertPayload {
  assertRequiredText(input.itemType, 'itemType')
  assertRequiredText(input.itemName, 'itemName')
  assertRequiredText(input.merchantOrderNo, 'merchantOrderNo')

  if (!Number.isInteger(input.amountTwd) || input.amountTwd <= 0) {
    throw new Error('amountTwd 必須是正整數')
  }

  return {
    user_id: input.userId ?? null,
    booking_id: input.bookingId ?? null,
    provider: input.provider,
    item_type: input.itemType,
    item_id: input.itemId ?? null,
    item_name: input.itemName,
    amount_twd: input.amountTwd,
    currency: 'TWD',
    status: 'pending',
    merchant_order_no: input.merchantOrderNo,
    raw_payload: input.rawPayload ?? null,
  }
}

export function buildPaidPaymentUpdate(
  input: MarkPaymentPaidInput,
  now = new Date().toISOString(),
): PaidPaymentUpdatePayload {
  assertRequiredText(input.merchantOrderNo, 'merchantOrderNo')

  const paidAt = input.paidAt ?? now
  const notifyReceivedAt = input.notifyReceivedAt ?? now

  return {
    status: 'paid',
    provider_trade_no: input.providerTradeNo ?? null,
    paid_at: paidAt,
    notify_received_at: notifyReceivedAt,
    raw_payload: input.rawPayload,
  }
}

export function getMarkPaymentPaidDecision(payment: Pick<PaymentRecord, 'status'> | null): MarkPaymentPaidDecision {
  if (!payment) return 'not_found'
  if (payment.status === 'paid') return 'already_paid'
  return 'should_update'
}

export async function createPendingPayment(input: CreatePendingPaymentInput) {
  const supabase = getSupabaseAdmin()
  const insertPayload = buildPendingPaymentInsert(input)

  const { data, error } = await supabase.from('payments').insert(insertPayload).select('*').single()

  if (error) {
    throw new Error(error.message)
  }

  return mapPaymentRow(data as PaymentRow)
}

export async function getPaymentByMerchantOrderNo(merchantOrderNo: string) {
  assertRequiredText(merchantOrderNo, 'merchantOrderNo')

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('merchant_order_no', merchantOrderNo)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data ? mapPaymentRow(data as PaymentRow) : null
}

export async function markPaymentPaidByMerchantOrderNo(input: MarkPaymentPaidInput): Promise<MarkPaymentPaidResult> {
  const existingPayment = await getPaymentByMerchantOrderNo(input.merchantOrderNo)
  const decision = getMarkPaymentPaidDecision(existingPayment)

  if (decision === 'not_found') {
    return { result: 'not_found', payment: null }
  }

  if (decision === 'already_paid') {
    return { result: 'already_paid', payment: mapPaymentPaidContext(existingPayment as PaymentRecord) }
  }

  const supabase = getSupabaseAdmin()
  const updatePayload = buildPaidPaymentUpdate(input)
  const { data, error } = await supabase
    .from('payments')
    .update(updatePayload)
    .eq('merchant_order_no', input.merchantOrderNo)
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return { result: 'updated', payment: mapPaymentPaidContext(mapPaymentRow(data as PaymentRow)) }
}
