import { getSupabaseAdmin } from './admin'

export type AiChartReportPaymentStatus = 'pending' | 'paid' | 'failed' | 'canceled' | 'refunded'
export const AI_CHART_REPORT_DEFAULT_AMOUNT_TWD = 100

export type BuildPendingAiChartReportPayloadInput = {
  userId?: string | null
  chartProfileId?: string | null
  title: string
  productName: string
  amountTwd: number
  reportContent?: string | null
}

export type CreatePendingAiChartReportInput = {
  userId?: string | null
  chartProfileId?: string | null
  title: string
  productName: string
  amountTwd?: number
  reportContent?: string | null
}

export type CreatePendingAiChartReportResult = {
  id: string
  paymentStatus: AiChartReportPaymentStatus | null
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

export type BuildAiChartReportCompletedPayloadInput = {
  reportContent: string
  completedAt?: string | null
}

export type AiChartReportCompletedPayload = {
  status: 'completed'
  report_content: string
  completed_at: string
  updated_at: string
  error_message: null
}

export type BuildAiChartReportFailedPayloadInput = {
  errorMessage: string
}

export type AiChartReportFailedPayload = {
  status: 'failed'
  error_message: string
  updated_at: string
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

export type MarkAiChartReportPaidInput = {
  reportId: string
  paymentId: string
  merchantOrderNo: string
  paidAt?: string | null
}

export type MarkAiChartReportPaidResult =
  | { result: 'updated'; reportId: string }
  | { result: 'already_paid'; reportId: string }
  | { result: 'not_found'; reportId: string }
  | { result: 'invalid_state'; reportId: string; paymentStatus: AiChartReportPaymentStatus | null }

export type AiChartReportPaymentContext = {
  id: string
  paymentStatus: AiChartReportPaymentStatus | null
  paymentId: string | null
  merchantOrderNo: string | null
  amountTwd: number | null
}

export type AiChartReportPaymentContextRow = {
  id: string
  payment_status: AiChartReportPaymentStatus | null
  payment_id: string | null
  merchant_order_no: string | null
  amount_twd: number | null
}

export type AiChartReportResultContext = {
  id: string
  title: string | null
  productName: string | null
  amountTwd: number | null
  status: string | null
  paymentStatus: AiChartReportPaymentStatus | null
  reportContent: string | null
  paidAt: string | null
  completedAt: string | null
  errorMessage: string | null
}

export type AiChartReportResultContextRow = {
  id: string
  title: string | null
  product_name: string | null
  amount_twd: number | null
  status: string | null
  payment_status: AiChartReportPaymentStatus | null
  report_content: string | null
  paid_at: string | null
  completed_at: string | null
  error_message: string | null
}

export type AiChartReportResultAccessDecision =
  | { result: 'not_found' }
  | { result: 'payment_required' }
  | { result: 'paid_missing_content' }
  | { result: 'ready'; reportContent: string }
  | { result: 'invalid_state'; paymentStatus: AiChartReportPaymentStatus | null }

export type AiChartReportContentUpdateDecision =
  | { result: 'not_found' }
  | { result: 'payment_required' }
  | { result: 'should_update' }
  | { result: 'already_completed' }
  | {
      result: 'invalid_state'
      status: string | null
      paymentStatus: AiChartReportPaymentStatus | null
    }

export type LinkAiChartReportPendingPaymentInput = {
  reportId: string
  paymentId: string
  merchantOrderNo: string
}

export type LinkAiChartReportPendingPaymentResult =
  | { result: 'linked'; reportId: string }
  | { result: 'already_linked'; reportId: string }
  | { result: 'not_found'; reportId: string }
  | { result: 'not_payable'; reportId: string; paymentStatus: AiChartReportPaymentStatus | null }

export type CreatePendingAiChartReportRow = {
  id: string
  payment_status: AiChartReportPaymentStatus | null
}

export type MarkAiChartReportCompletedInput = {
  reportId: string
  reportContent: string
  completedAt?: string | null
}

export type MarkAiChartReportCompletedResult =
  | { result: 'updated'; reportId: string }
  | { result: 'already_completed'; reportId: string }
  | { result: 'payment_required'; reportId: string }
  | { result: 'not_found'; reportId: string }
  | {
      result: 'invalid_state'
      reportId: string
      status: string | null
      paymentStatus: AiChartReportPaymentStatus | null
    }

export type MarkAiChartReportFailedInput = {
  reportId: string
  errorMessage: string
}

export type MarkAiChartReportFailedResult =
  | { result: 'updated'; reportId: string }
  | { result: 'not_found'; reportId: string }

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>

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

export function buildAiChartReportCompletedPayload(
  input: BuildAiChartReportCompletedPayloadInput,
  now = new Date().toISOString(),
): AiChartReportCompletedPayload {
  return {
    status: 'completed',
    report_content: normalizeRequiredText(input.reportContent, 'reportContent'),
    completed_at: resolveTimestamp(input.completedAt, now),
    updated_at: now,
    error_message: null,
  }
}

export function buildAiChartReportFailedPayload(
  input: BuildAiChartReportFailedPayloadInput,
  now = new Date().toISOString(),
): AiChartReportFailedPayload {
  return {
    status: 'failed',
    error_message: normalizeRequiredText(input.errorMessage, 'errorMessage'),
    updated_at: now,
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

export function decideAiChartReportContentUpdate(
  existing: {
    id: string
    payment_status?: AiChartReportPaymentStatus | null
    status?: string | null
    report_content?: string | null
  } | null,
): AiChartReportContentUpdateDecision {
  if (!existing) return { result: 'not_found' }

  const paymentStatus = existing.payment_status ?? null
  const status = existing.status ?? null

  if (paymentStatus !== 'paid') {
    return { result: 'payment_required' }
  }

  if (status === 'failed' || status === 'canceled') {
    return {
      result: 'invalid_state',
      status,
      paymentStatus,
    }
  }

  if (existing.report_content?.trim()) {
    return { result: 'already_completed' }
  }

  return { result: 'should_update' }
}

export function mapAiChartReportPaymentContext(
  row: AiChartReportPaymentContextRow,
): AiChartReportPaymentContext {
  return {
    id: row.id,
    paymentStatus: row.payment_status,
    paymentId: row.payment_id,
    merchantOrderNo: row.merchant_order_no,
    amountTwd: row.amount_twd,
  }
}

export function mapAiChartReportResultContext(
  row: AiChartReportResultContextRow,
): AiChartReportResultContext {
  return {
    id: row.id,
    title: row.title,
    productName: row.product_name,
    amountTwd: row.amount_twd,
    status: row.status,
    paymentStatus: row.payment_status,
    reportContent: row.report_content,
    paidAt: row.paid_at,
    completedAt: row.completed_at,
    errorMessage: row.error_message,
  }
}

export function decideAiChartReportResultAccess(
  report: AiChartReportResultContext | null,
): AiChartReportResultAccessDecision {
  if (!report) return { result: 'not_found' }

  if (report.paymentStatus === 'pending' || report.paymentStatus === null) {
    return { result: 'payment_required' }
  }

  if (report.paymentStatus === 'paid') {
    if (report.reportContent?.trim()) {
      return {
        result: 'ready',
        reportContent: report.reportContent,
      }
    }

    return { result: 'paid_missing_content' }
  }

  return {
    result: 'invalid_state',
    paymentStatus: report.paymentStatus,
  }
}

export async function createPendingAiChartReport(
  input: CreatePendingAiChartReportInput,
  supabase: SupabaseAdminClient = getSupabaseAdmin(),
): Promise<CreatePendingAiChartReportResult> {
  const payload = buildPendingAiChartReportPayload({
    userId: input.userId,
    chartProfileId: input.chartProfileId,
    title: input.title,
    productName: input.productName,
    amountTwd: input.amountTwd ?? AI_CHART_REPORT_DEFAULT_AMOUNT_TWD,
    reportContent: input.reportContent,
  })

  const { data, error } = await supabase
    .from('ai_chart_reports')
    .insert(payload)
    .select('id,payment_status')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error('ai_chart_report_create_failed')
  }

  const row = data as CreatePendingAiChartReportRow

  return {
    id: row.id,
    paymentStatus: row.payment_status,
  }
}

export async function getAiChartReportPaymentContext(
  reportId: string,
  supabase: SupabaseAdminClient = getSupabaseAdmin(),
): Promise<AiChartReportPaymentContext | null> {
  assertRequiredText(reportId, 'reportId')

  const { data, error } = await supabase
    .from('ai_chart_reports')
    .select('id,payment_status,payment_id,merchant_order_no,amount_twd')
    .eq('id', reportId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data ? mapAiChartReportPaymentContext(data as AiChartReportPaymentContextRow) : null
}

export async function getAiChartReportResultById(
  reportId: string,
  supabase: SupabaseAdminClient = getSupabaseAdmin(),
): Promise<AiChartReportResultContext | null> {
  assertRequiredText(reportId, 'reportId')

  const { data, error } = await supabase
    .from('ai_chart_reports')
    .select('id,title,product_name,amount_twd,status,payment_status,report_content,paid_at,completed_at,error_message')
    .eq('id', reportId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data ? mapAiChartReportResultContext(data as AiChartReportResultContextRow) : null
}

export async function linkAiChartReportPendingPayment(
  input: LinkAiChartReportPendingPaymentInput,
  supabase: SupabaseAdminClient = getSupabaseAdmin(),
): Promise<LinkAiChartReportPendingPaymentResult> {
  assertRequiredText(input.reportId, 'reportId')
  assertRequiredText(input.paymentId, 'paymentId')
  assertRequiredText(input.merchantOrderNo, 'merchantOrderNo')

  const existingReport = await getAiChartReportPaymentContext(input.reportId, supabase)
  const decision = decideAiChartReportPendingPaymentLink(
    existingReport
      ? {
          id: existingReport.id,
          payment_status: existingReport.paymentStatus,
          payment_id: existingReport.paymentId,
          merchant_order_no: existingReport.merchantOrderNo,
        }
      : null,
  )

  if (decision.result === 'not_found') {
    return {
      result: 'not_found',
      reportId: input.reportId,
    }
  }

  if (decision.result === 'already_linked') {
    return {
      result: 'already_linked',
      reportId: input.reportId,
    }
  }

  if (decision.result === 'not_payable') {
    return {
      result: 'not_payable',
      reportId: input.reportId,
      paymentStatus: decision.paymentStatus,
    }
  }

  const { error: updateError } = await supabase
    .from('ai_chart_reports')
    .update(
      buildAiChartReportPendingPaymentLinkPayload({
        paymentId: input.paymentId,
        merchantOrderNo: input.merchantOrderNo,
      }),
    )
    .eq('id', input.reportId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  return {
    result: 'linked',
    reportId: input.reportId,
  }
}

export async function markAiChartReportPaidByPayment(
  input: MarkAiChartReportPaidInput,
  supabase: SupabaseAdminClient = getSupabaseAdmin(),
): Promise<MarkAiChartReportPaidResult> {
  assertRequiredText(input.reportId, 'reportId')
  assertRequiredText(input.paymentId, 'paymentId')
  assertRequiredText(input.merchantOrderNo, 'merchantOrderNo')

  const { data: existingReport, error: selectError } = await supabase
    .from('ai_chart_reports')
    .select('id,payment_status')
    .eq('id', input.reportId)
    .maybeSingle()

  if (selectError) {
    throw new Error(selectError.message)
  }

  const decision = decideAiChartReportPaidUpdate(
    existingReport as { id: string; payment_status?: AiChartReportPaymentStatus | null } | null,
  )

  if (decision.result === 'not_found') {
    return {
      result: 'not_found',
      reportId: input.reportId,
    }
  }

  if (decision.result === 'already_paid') {
    return {
      result: 'already_paid',
      reportId: input.reportId,
    }
  }

  if (decision.result === 'invalid_state') {
    return {
      result: 'invalid_state',
      reportId: input.reportId,
      paymentStatus: decision.paymentStatus,
    }
  }

  const { error: updateError } = await supabase
    .from('ai_chart_reports')
    .update(
      buildAiChartReportPaidUpdatePayload({
        paymentId: input.paymentId,
        merchantOrderNo: input.merchantOrderNo,
        paidAt: input.paidAt,
      }),
    )
    .eq('id', input.reportId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  return {
    result: 'updated',
    reportId: input.reportId,
  }
}

export async function markAiChartReportCompleted(
  input: MarkAiChartReportCompletedInput,
  supabase: SupabaseAdminClient = getSupabaseAdmin(),
): Promise<MarkAiChartReportCompletedResult> {
  assertRequiredText(input.reportId, 'reportId')
  assertRequiredText(input.reportContent, 'reportContent')

  const { data: existingReport, error: selectError } = await supabase
    .from('ai_chart_reports')
    .select('id,payment_status,status,report_content')
    .eq('id', input.reportId)
    .maybeSingle()

  if (selectError) {
    throw new Error(selectError.message)
  }

  const decision = decideAiChartReportContentUpdate(
    existingReport as {
      id: string
      payment_status?: AiChartReportPaymentStatus | null
      status?: string | null
      report_content?: string | null
    } | null,
  )

  if (decision.result === 'not_found') {
    return {
      result: 'not_found',
      reportId: input.reportId,
    }
  }

  if (decision.result === 'payment_required') {
    return {
      result: 'payment_required',
      reportId: input.reportId,
    }
  }

  if (decision.result === 'already_completed') {
    return {
      result: 'already_completed',
      reportId: input.reportId,
    }
  }

  if (decision.result === 'invalid_state') {
    return {
      result: 'invalid_state',
      reportId: input.reportId,
      status: decision.status,
      paymentStatus: decision.paymentStatus,
    }
  }

  const { error: updateError } = await supabase
    .from('ai_chart_reports')
    .update(
      buildAiChartReportCompletedPayload({
        reportContent: input.reportContent,
        completedAt: input.completedAt,
      }),
    )
    .eq('id', input.reportId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  return {
    result: 'updated',
    reportId: input.reportId,
  }
}

export async function markAiChartReportFailed(
  input: MarkAiChartReportFailedInput,
  supabase: SupabaseAdminClient = getSupabaseAdmin(),
): Promise<MarkAiChartReportFailedResult> {
  assertRequiredText(input.reportId, 'reportId')
  assertRequiredText(input.errorMessage, 'errorMessage')

  const { data: existingReport, error: selectError } = await supabase
    .from('ai_chart_reports')
    .select('id')
    .eq('id', input.reportId)
    .maybeSingle()

  if (selectError) {
    throw new Error(selectError.message)
  }

  if (!existingReport) {
    return {
      result: 'not_found',
      reportId: input.reportId,
    }
  }

  const { error: updateError } = await supabase
    .from('ai_chart_reports')
    .update(
      buildAiChartReportFailedPayload({
        errorMessage: input.errorMessage,
      }),
    )
    .eq('id', input.reportId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  return {
    result: 'updated',
    reportId: input.reportId,
  }
}
