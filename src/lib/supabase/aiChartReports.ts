export type AiChartReportPaymentStatus = 'pending' | 'paid' | 'failed' | 'canceled' | 'refunded'

export type BuildPendingAiChartReportPayloadInput = {
  userId?: string | null
  chartProfileId?: string | null
  title: string
  productName: string
  amountTwd: number
  reportContent?: string | null
}

export type PendingAiChartReportPayload = {
  user_id: string | null
  chart_profile_id: string | null
  title: string
  product_name: string
  amount_twd: number
  status: 'pending'
  payment_status: 'pending'
  report_content: string | null
  updated_at: string
}

export type BuildAiChartReportPendingPaymentLinkPayloadInput = {
  paymentId: string
  merchantOrderNo: string
}

export type AiChartReportPendingPaymentLinkPayload = {
  payment_id: string
  merchant_order_no: string
  updated_at: string
}

export type BuildAiChartReportPaidUpdatePayloadInput = {
  paymentId: string
  merchantOrderNo: string
  paidAt?: string | null
}

export type AiChartReportPaidUpdatePayload = {
  payment_id: string
  merchant_order_no: string
  payment_status: 'paid'
  paid_at: string
  updated_at: string
  error_message: null
}

export type AiChartReportPendingPaymentLinkDecision =
  | { result: 'not_found' }
  | { result: 'should_link' }
  | { result: 'already_linked' }
  | { result: 'not_payable'; paymentStatus: AiChartReportPaymentStatus | null }

export type AiChartReportPaidDecision =
  | { result: 'not_found' }
  | { result: 'should_update' }
  | { result: 'already_paid' }
  | { result: 'invalid_state'; paymentStatus: AiChartReportPaymentStatus | null }

function assertRequiredText(value: string, fieldName: string) {
  if (!value.trim()) {
    throw new Error(`${fieldName} must not be blank`)
  }
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed || null
}

function normalizeRequiredText(value: string, fieldName: string) {
  assertRequiredText(value, fieldName)
  return value.trim()
}

function normalizeAmountTwd(amountTwd: number) {
  if (!Number.isInteger(amountTwd) || amountTwd <= 0) {
    throw new Error('amountTwd must be a positive integer')
  }

  return amountTwd
}

function resolveTimestamp(value: string | null | undefined, now: string) {
  return value?.trim() || now
}

export function buildPendingAiChartReportPayload(
  input: BuildPendingAiChartReportPayloadInput,
  now = new Date().toISOString(),
): PendingAiChartReportPayload {
  return {
    user_id: normalizeOptionalText(input.userId),
    chart_profile_id: normalizeOptionalText(input.chartProfileId),
    title: normalizeRequiredText(input.title, 'title'),
    product_name: normalizeRequiredText(input.productName, 'productName'),
    amount_twd: normalizeAmountTwd(input.amountTwd),
    status: 'pending',
    payment_status: 'pending',
    report_content: normalizeOptionalText(input.reportContent),
    updated_at: now,
  }
}

export function buildAiChartReportPendingPaymentLinkPayload(
  input: BuildAiChartReportPendingPaymentLinkPayloadInput,
  now = new Date().toISOString(),
): AiChartReportPendingPaymentLinkPayload {
  return {
    payment_id: normalizeRequiredText(input.paymentId, 'paymentId'),
    merchant_order_no: normalizeRequiredText(input.merchantOrderNo, 'merchantOrderNo'),
    updated_at: now,
  }
}

export function buildAiChartReportPaidUpdatePayload(
  input: BuildAiChartReportPaidUpdatePayloadInput,
  now = new Date().toISOString(),
): AiChartReportPaidUpdatePayload {
  return {
    payment_id: normalizeRequiredText(input.paymentId, 'paymentId'),
    merchant_order_no: normalizeRequiredText(input.merchantOrderNo, 'merchantOrderNo'),
    payment_status: 'paid',
    paid_at: resolveTimestamp(input.paidAt, now),
    updated_at: now,
    error_message: null,
  }
}

export function decideAiChartReportPendingPaymentLink(
  existing: {
    id: string
    payment_status?: AiChartReportPaymentStatus | null
    payment_id?: string | null
    merchant_order_no?: string | null
  } | null,
): AiChartReportPendingPaymentLinkDecision {
  if (!existing) return { result: 'not_found' }

  const paymentStatus = existing.payment_status ?? null

  if (paymentStatus !== 'pending' && paymentStatus !== null) {
    return { result: 'not_payable', paymentStatus }
  }

  if (existing.payment_id || existing.merchant_order_no) {
    return { result: 'already_linked' }
  }

  return { result: 'should_link' }
}

export function decideAiChartReportPaidUpdate(
  existing: {
    id: string
    payment_status?: AiChartReportPaymentStatus | null
  } | null,
): AiChartReportPaidDecision {
  if (!existing) return { result: 'not_found' }

  const paymentStatus = existing.payment_status ?? null

  if (paymentStatus === 'pending' || paymentStatus === null) {
    return { result: 'should_update' }
  }

  if (paymentStatus === 'paid') {
    return { result: 'already_paid' }
  }

  return { result: 'invalid_state', paymentStatus }
}
