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

export type DivinationReadingPaidSyncRow = {
  id: string
  status: DivinationReadingStatus | null
  payment_id?: string | null
}

export type DivinationPaidDecision =
  | { result: 'not_found' }
  | { result: 'should_update' }
  | { result: 'already_paid' }
  | { result: 'invalid_state'; status: DivinationReadingStatus | null }

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
    raw_payload: input.rawPayload ?? null,
    updated_at: now,
  }
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

export function decideDivinationPaidUpdate(
  existing: Pick<DivinationReadingPaidSyncRow, 'id' | 'status' | 'payment_id'> | null,
): DivinationPaidDecision {
  if (!existing) return { result: 'not_found' }
  if (existing.status === 'pending_payment' || existing.status === null) return { result: 'should_update' }
  if (existing.status === 'canceled') return { result: 'invalid_state', status: existing.status }

  return { result: 'already_paid' }
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
