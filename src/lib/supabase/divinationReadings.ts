import { getSupabaseAdmin } from './admin'

export type DivinationReadingStatus =
  | 'pending_payment'
  | 'paid'
  | 'interpreting'
  | 'completed'
  | 'failed'
  | 'canceled'

export type BuildPendingDivinationReadingPayloadInput = {
  userId?: string | null
  externalReadingId?: string | null
  question: string
  drawMode?: string | null
  cardId?: string | null
  cardName?: string | null
  position?: string | null
  source?: string
  rawPayload?: Record<string, unknown>
}

export type PendingDivinationReadingPayload = {
  user_id: string | null
  external_reading_id: string | null
  question: string
  draw_mode: string | null
  card_id: string | null
  card_name: string | null
  position: string | null
  status: 'pending_payment'
  source: string
  raw_payload: Record<string, unknown> | null
  updated_at: string
}

export type PendingDivinationReadingRow = {
  id: string
  status: 'pending_payment'
}

export type BuildDivinationPaidUpdatePayloadInput = {
  paymentId: string
  merchantOrderNo: string
  paidAt?: string | null
}

export type DivinationPaidUpdatePayload = {
  payment_id: string
  merchant_order_no: string
  status: 'paid'
  paid_at: string
  updated_at: string
}

export type BuildDivinationPendingPaymentLinkPayloadInput = {
  paymentId: string
  merchantOrderNo: string
}

export type DivinationPendingPaymentLinkPayload = {
  payment_id: string
  merchant_order_no: string
  updated_at: string
}

export type DivinationInterpretingUpdatePayload = {
  status: 'interpreting'
  updated_at: string
}

export type BuildDivinationCompletedUpdatePayloadInput = {
  interpretation: Record<string, unknown>
  resultSummary?: string | null
  interpretedAt?: string | null
}

export type DivinationCompletedUpdatePayload = {
  status: 'completed'
  interpretation: Record<string, unknown>
  interpreted_at: string
  updated_at: string
  error_message: null
  result_summary?: string
}

export type BuildDivinationFailedUpdatePayloadInput = {
  errorMessage: string
}

export type DivinationFailedUpdatePayload = {
  status: 'failed'
  error_message: string
  updated_at: string
}

export type DivinationReadingPaidSyncRow = {
  id: string
  status: DivinationReadingStatus | null
  payment_id?: string | null
}

export type DivinationReadingPaymentContext = {
  id: string
  status: DivinationReadingStatus | null
  paymentId: string | null
  merchantOrderNo: string | null
}

export type DivinationReadingPaymentContextRow = {
  id: string
  status: DivinationReadingStatus | null
  payment_id: string | null
  merchant_order_no: string | null
}

export type DivinationReadingInterpretationContext = {
  id: string
  status: DivinationReadingStatus | null
  interpretation: unknown | null
}

export type DivinationReadingInterpretationContextRow = {
  id: string
  status: DivinationReadingStatus | null
  interpretation: unknown | null
}

export type DivinationPaidDecision =
  | { result: 'not_found' }
  | { result: 'should_update' }
  | { result: 'already_paid' }
  | { result: 'invalid_state'; status: DivinationReadingStatus | null }

export type DivinationPendingPaymentLinkDecision =
  | { result: 'not_found' }
  | { result: 'should_link' }
  | { result: 'already_linked' }
  | { result: 'not_payable'; status: DivinationReadingStatus | null }

export type DivinationInterpretationStartDecision =
  | { result: 'not_found' }
  | { result: 'should_interpret' }
  | { result: 'payment_required' }
  | { result: 'already_interpreting' }
  | { result: 'already_completed'; interpretation: unknown | null }
  | { result: 'invalid_state'; status: DivinationReadingStatus | null }

export type DivinationReadingPaymentValidationResult =
  | { ok: true }
  | { ok: false; error: 'divination_reading_not_found' | 'divination_reading_not_payable' }

export type MarkDivinationReadingPaidInput = {
  readingId: string
  paymentId: string
  merchantOrderNo: string
  paidAt?: string | null
}

export type MarkDivinationReadingPaidResult =
  | { result: 'updated'; readingId: string }
  | { result: 'already_paid'; readingId: string }
  | { result: 'not_found'; readingId: string }
  | { result: 'invalid_state'; readingId: string; status: DivinationReadingStatus | null }

export type LinkDivinationReadingPendingPaymentInput = {
  readingId: string
  paymentId: string
  merchantOrderNo: string
}

export type LinkDivinationReadingPendingPaymentResult =
  | { result: 'linked'; readingId: string }
  | { result: 'already_linked'; readingId: string }
  | { result: 'not_found'; readingId: string }
  | { result: 'not_payable'; readingId: string; status: DivinationReadingStatus | null }

export type MarkDivinationReadingInterpretationResult =
  | { result: 'updated'; readingId: string }
  | { result: 'not_found'; readingId: string }

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>

function assertRequiredText(value: string, fieldName: string) {
  if (!value.trim()) {
    throw new Error(`${fieldName} 不可空白`)
  }
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed || null
}

function resolveTimestamp(value: string | null | undefined, now: string) {
  return value?.trim() || now
}

function normalizeRequiredText(value: string, fieldName: string) {
  assertRequiredText(value, fieldName)
  return value.trim()
}

function sanitizeDivinationReadingRawPayload(rawPayload?: Record<string, unknown>) {
  if (!rawPayload) return null

  const unsafeKeys = new Set(['TradeInfo', 'TradeSha', 'HashKey', 'HashIV', 'interpretation', 'aiInterpretation'])
  return Object.fromEntries(Object.entries(rawPayload).filter(([key]) => !unsafeKeys.has(key)))
}

export function buildPendingDivinationReadingPayload(
  input: BuildPendingDivinationReadingPayloadInput,
  now = new Date().toISOString(),
): PendingDivinationReadingPayload {
  assertRequiredText(input.question, 'question')

  return {
    user_id: normalizeOptionalText(input.userId),
    external_reading_id: normalizeOptionalText(input.externalReadingId),
    question: input.question.trim(),
    draw_mode: normalizeOptionalText(input.drawMode),
    card_id: normalizeOptionalText(input.cardId),
    card_name: normalizeOptionalText(input.cardName),
    position: normalizeOptionalText(input.position),
    status: 'pending_payment',
    source: input.source?.trim() || 'waterbottle-ai-divination',
    raw_payload: sanitizeDivinationReadingRawPayload(input.rawPayload),
    updated_at: now,
  }
}

export async function createPendingDivinationReading(
  input: BuildPendingDivinationReadingPayloadInput,
): Promise<PendingDivinationReadingRow> {
  const supabase = getSupabaseAdmin()
  const insertPayload = buildPendingDivinationReadingPayload(input)
  const { data, error } = await supabase
    .from('divination_readings')
    .insert(insertPayload)
    .select('id,status')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as PendingDivinationReadingRow
}

export function buildDivinationPaidUpdatePayload(
  input: BuildDivinationPaidUpdatePayloadInput,
  now = new Date().toISOString(),
): DivinationPaidUpdatePayload {
  assertRequiredText(input.paymentId, 'paymentId')
  assertRequiredText(input.merchantOrderNo, 'merchantOrderNo')

  const paidAt = resolveTimestamp(input.paidAt, now)

  return {
    payment_id: input.paymentId,
    merchant_order_no: input.merchantOrderNo,
    status: 'paid',
    paid_at: paidAt,
    updated_at: now,
  }
}

export function buildDivinationPendingPaymentLinkPayload(
  input: BuildDivinationPendingPaymentLinkPayloadInput,
  now = new Date().toISOString(),
): DivinationPendingPaymentLinkPayload {
  assertRequiredText(input.paymentId, 'paymentId')
  assertRequiredText(input.merchantOrderNo, 'merchantOrderNo')

  return {
    payment_id: input.paymentId,
    merchant_order_no: input.merchantOrderNo,
    updated_at: now,
  }
}

export function buildDivinationInterpretingUpdatePayload(
  now = new Date().toISOString(),
): DivinationInterpretingUpdatePayload {
  return {
    status: 'interpreting',
    updated_at: now,
  }
}

export function buildDivinationCompletedUpdatePayload(
  input: BuildDivinationCompletedUpdatePayloadInput,
  now = new Date().toISOString(),
): DivinationCompletedUpdatePayload {
  const interpretedAt = resolveTimestamp(input.interpretedAt, now)
  const resultSummary = normalizeOptionalText(input.resultSummary)
  const payload: DivinationCompletedUpdatePayload = {
    status: 'completed',
    interpretation: input.interpretation,
    interpreted_at: interpretedAt,
    updated_at: now,
    error_message: null,
  }

  if (resultSummary) {
    payload.result_summary = resultSummary
  }

  return payload
}

export function buildDivinationFailedUpdatePayload(
  input: BuildDivinationFailedUpdatePayloadInput,
  now = new Date().toISOString(),
): DivinationFailedUpdatePayload {
  return {
    status: 'failed',
    error_message: normalizeRequiredText(input.errorMessage, 'errorMessage'),
    updated_at: now,
  }
}

export function decideDivinationPaidUpdate(
  existing: Pick<DivinationReadingPaidSyncRow, 'id' | 'status' | 'payment_id'> | null,
): DivinationPaidDecision {
  if (!existing) return { result: 'not_found' }
  if (existing.status === 'pending_payment' || existing.status === null) return { result: 'should_update' }
  if (existing.status === 'canceled') return { result: 'invalid_state', status: existing.status }

  return { result: 'already_paid' }
}

export function decideDivinationPendingPaymentLink(
  existing: {
    id: string
    status: DivinationReadingStatus | null
    payment_id?: string | null
    merchant_order_no?: string | null
  } | null,
): DivinationPendingPaymentLinkDecision {
  if (!existing) return { result: 'not_found' }

  if (existing.status !== 'pending_payment' && existing.status !== null) {
    return { result: 'not_payable', status: existing.status }
  }

  if (existing.payment_id || existing.merchant_order_no) {
    return { result: 'already_linked' }
  }

  return { result: 'should_link' }
}

export function decideDivinationInterpretationStart(
  existing: {
    id: string
    status: DivinationReadingStatus | null
    interpretation?: unknown | null
  } | null,
): DivinationInterpretationStartDecision {
  if (!existing) return { result: 'not_found' }

  if (existing.status === 'paid') {
    return { result: 'should_interpret' }
  }

  if (existing.status === 'pending_payment' || existing.status === null) {
    return { result: 'payment_required' }
  }

  if (existing.status === 'interpreting') {
    return { result: 'already_interpreting' }
  }

  if (existing.status === 'completed') {
    return {
      result: 'already_completed',
      interpretation: existing.interpretation ?? null,
    }
  }

  return { result: 'invalid_state', status: existing.status }
}

export function mapDivinationReadingPaymentContext(
  row: DivinationReadingPaymentContextRow,
): DivinationReadingPaymentContext {
  return {
    id: row.id,
    status: row.status,
    paymentId: row.payment_id,
    merchantOrderNo: row.merchant_order_no,
  }
}

export function mapDivinationReadingInterpretationContext(
  row: DivinationReadingInterpretationContextRow,
): DivinationReadingInterpretationContext {
  return {
    id: row.id,
    status: row.status,
    interpretation: row.interpretation ?? null,
  }
}

export function validateDivinationReadingPayment(
  reading: DivinationReadingPaymentContext | null,
): DivinationReadingPaymentValidationResult {
  if (!reading) {
    return { ok: false, error: 'divination_reading_not_found' }
  }

  if (
    reading.paymentId !== null ||
    reading.merchantOrderNo !== null ||
    (reading.status !== 'pending_payment' && reading.status !== null)
  ) {
    return { ok: false, error: 'divination_reading_not_payable' }
  }

  return { ok: true }
}

export async function getDivinationReadingForInterpretation(
  readingId: string,
  supabase: SupabaseAdminClient = getSupabaseAdmin(),
): Promise<DivinationReadingInterpretationContext | null> {
  assertRequiredText(readingId, 'readingId')

  const { data, error } = await supabase
    .from('divination_readings')
    .select('id,status,interpretation')
    .eq('id', readingId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data ? mapDivinationReadingInterpretationContext(data as DivinationReadingInterpretationContextRow) : null
}

export async function getDivinationReadingPaymentContext(
  readingId: string,
): Promise<DivinationReadingPaymentContext | null> {
  assertRequiredText(readingId, 'readingId')

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('divination_readings')
    .select('id,status,payment_id,merchant_order_no')
    .eq('id', readingId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data ? mapDivinationReadingPaymentContext(data as DivinationReadingPaymentContextRow) : null
}

async function updateDivinationReadingForInterpretation(
  input: {
    readingId: string
    payload: DivinationInterpretingUpdatePayload | DivinationCompletedUpdatePayload | DivinationFailedUpdatePayload
  },
  supabase: SupabaseAdminClient,
): Promise<MarkDivinationReadingInterpretationResult> {
  assertRequiredText(input.readingId, 'readingId')

  const { data, error } = await supabase
    .from('divination_readings')
    .update(input.payload)
    .eq('id', input.readingId)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data ? { result: 'updated', readingId: input.readingId } : { result: 'not_found', readingId: input.readingId }
}

export async function markDivinationReadingInterpreting(
  readingId: string,
  supabase: SupabaseAdminClient = getSupabaseAdmin(),
): Promise<MarkDivinationReadingInterpretationResult> {
  return updateDivinationReadingForInterpretation(
    {
      readingId,
      payload: buildDivinationInterpretingUpdatePayload(),
    },
    supabase,
  )
}

export async function markDivinationReadingCompleted(
  input: {
    readingId: string
    interpretation: Record<string, unknown>
    resultSummary?: string | null
    interpretedAt?: string | null
  },
  supabase: SupabaseAdminClient = getSupabaseAdmin(),
): Promise<MarkDivinationReadingInterpretationResult> {
  return updateDivinationReadingForInterpretation(
    {
      readingId: input.readingId,
      payload: buildDivinationCompletedUpdatePayload(input),
    },
    supabase,
  )
}

export async function markDivinationReadingFailed(
  input: {
    readingId: string
    errorMessage: string
  },
  supabase: SupabaseAdminClient = getSupabaseAdmin(),
): Promise<MarkDivinationReadingInterpretationResult> {
  return updateDivinationReadingForInterpretation(
    {
      readingId: input.readingId,
      payload: buildDivinationFailedUpdatePayload(input),
    },
    supabase,
  )
}

export async function linkDivinationReadingPendingPayment(
  input: LinkDivinationReadingPendingPaymentInput,
): Promise<LinkDivinationReadingPendingPaymentResult> {
  assertRequiredText(input.readingId, 'readingId')
  assertRequiredText(input.paymentId, 'paymentId')
  assertRequiredText(input.merchantOrderNo, 'merchantOrderNo')

  const supabase = getSupabaseAdmin()
  const { data: existingReading, error: selectError } = await supabase
    .from('divination_readings')
    .select('id,status,payment_id,merchant_order_no')
    .eq('id', input.readingId)
    .maybeSingle()

  if (selectError) {
    throw new Error(selectError.message)
  }

  const decision = decideDivinationPendingPaymentLink(
    existingReading as DivinationReadingPaymentContextRow | null,
  )

  if (decision.result === 'not_found') {
    return {
      result: 'not_found',
      readingId: input.readingId,
    }
  }

  if (decision.result === 'not_payable') {
    return {
      result: 'not_payable',
      readingId: input.readingId,
      status: decision.status,
    }
  }

  if (decision.result === 'already_linked') {
    return {
      result: 'already_linked',
      readingId: input.readingId,
    }
  }

  const { error: updateError } = await supabase
    .from('divination_readings')
    .update(
      buildDivinationPendingPaymentLinkPayload({
        paymentId: input.paymentId,
        merchantOrderNo: input.merchantOrderNo,
      }),
    )
    .eq('id', input.readingId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  return {
    result: 'linked',
    readingId: input.readingId,
  }
}

// --- 會員本人 read-only 查詢（22J-42：我的占卜紀錄）---
// 安全原則：
// - 一律以 Supabase auth user id 過濾，user_id 為 null 的匿名紀錄不可能被列出。
// - 列表不查 interpretation / raw_payload / payment 欄位。
// - 單筆只在 status = completed 時輸出 interpretation。

export const ACCOUNT_DIVINATION_LIST_DEFAULT_LIMIT = 20
export const ACCOUNT_DIVINATION_LIST_MAX_LIMIT = 50

const ACCOUNT_DIVINATION_LIST_COLUMNS =
  'id,question,card_name,position,draw_mode,status,created_at,interpreted_at,result_summary'
const ACCOUNT_DIVINATION_DETAIL_COLUMNS = `${ACCOUNT_DIVINATION_LIST_COLUMNS},interpretation`

export type AccountDivinationReadingListRow = {
  id: string
  question: string
  card_name: string | null
  position: string | null
  draw_mode: string | null
  status: DivinationReadingStatus | null
  created_at: string | null
  interpreted_at: string | null
  result_summary: string | null
}

export type AccountDivinationReadingDetailRow = AccountDivinationReadingListRow & {
  interpretation: unknown | null
}

export type AccountDivinationReadingListItem = {
  id: string
  question: string
  cardName: string | null
  position: string | null
  drawMode: string | null
  status: DivinationReadingStatus | null
  createdAt: string | null
  interpretedAt: string | null
  hasInterpretation: boolean
  resultSummary: string | null
}

export type AccountDivinationReadingDetail = AccountDivinationReadingListItem & {
  interpretation: unknown | null
}

export function normalizeAccountDivinationListLimit(value: unknown): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN

  if (!Number.isFinite(parsed) || parsed <= 0) return ACCOUNT_DIVINATION_LIST_DEFAULT_LIMIT

  return Math.min(Math.floor(parsed), ACCOUNT_DIVINATION_LIST_MAX_LIMIT)
}

export function mapAccountDivinationReadingListItem(
  row: AccountDivinationReadingListRow,
): AccountDivinationReadingListItem {
  return {
    id: row.id,
    question: row.question,
    cardName: row.card_name ?? null,
    position: row.position ?? null,
    drawMode: row.draw_mode ?? null,
    status: row.status ?? null,
    createdAt: row.created_at ?? null,
    interpretedAt: row.interpreted_at ?? null,
    hasInterpretation: row.status === 'completed',
    resultSummary: row.result_summary ?? null,
  }
}

export function mapAccountDivinationReadingDetail(
  row: AccountDivinationReadingDetailRow,
): AccountDivinationReadingDetail {
  return {
    ...mapAccountDivinationReadingListItem(row),
    // completed 才輸出 interpretation；其他狀態一律 null。
    interpretation: row.status === 'completed' ? (row.interpretation ?? null) : null,
  }
}

export async function listDivinationReadingsForUser(
  userId: string,
  options: { limit?: unknown } = {},
  supabase: SupabaseAdminClient = getSupabaseAdmin(),
): Promise<AccountDivinationReadingListItem[]> {
  assertRequiredText(userId, 'userId')

  const limit = normalizeAccountDivinationListLimit(options.limit)
  const { data, error } = await supabase
    .from('divination_readings')
    .select(ACCOUNT_DIVINATION_LIST_COLUMNS)
    .eq('user_id', userId.trim())
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as AccountDivinationReadingListRow[]).map(mapAccountDivinationReadingListItem)
}

export async function getDivinationReadingForUser(
  readingId: string,
  userId: string,
  supabase: SupabaseAdminClient = getSupabaseAdmin(),
): Promise<AccountDivinationReadingDetail | null> {
  assertRequiredText(readingId, 'readingId')
  assertRequiredText(userId, 'userId')

  const { data, error } = await supabase
    .from('divination_readings')
    .select(ACCOUNT_DIVINATION_DETAIL_COLUMNS)
    .eq('id', readingId.trim())
    .eq('user_id', userId.trim())
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data ? mapAccountDivinationReadingDetail(data as AccountDivinationReadingDetailRow) : null
}

export async function markDivinationReadingPaidByPayment(
  input: MarkDivinationReadingPaidInput,
): Promise<MarkDivinationReadingPaidResult> {
  assertRequiredText(input.readingId, 'readingId')
  assertRequiredText(input.paymentId, 'paymentId')
  assertRequiredText(input.merchantOrderNo, 'merchantOrderNo')

  const supabase = getSupabaseAdmin()
  const { data: existingReading, error: selectError } = await supabase
    .from('divination_readings')
    .select('id,status,payment_id')
    .eq('id', input.readingId)
    .maybeSingle()

  if (selectError) {
    throw new Error(selectError.message)
  }

  const decision = decideDivinationPaidUpdate(existingReading as DivinationReadingPaidSyncRow | null)

  if (decision.result === 'not_found') {
    return {
      result: 'not_found',
      readingId: input.readingId,
    }
  }

  if (decision.result === 'invalid_state') {
    return {
      result: 'invalid_state',
      readingId: input.readingId,
      status: decision.status,
    }
  }

  if (decision.result === 'already_paid') {
    return {
      result: 'already_paid',
      readingId: input.readingId,
    }
  }

  const { error: updateError } = await supabase
    .from('divination_readings')
    .update(buildDivinationPaidUpdatePayload(input))
    .eq('id', input.readingId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  return {
    result: 'updated',
    readingId: input.readingId,
  }
}
