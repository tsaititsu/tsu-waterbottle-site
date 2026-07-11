import { NextResponse } from 'next/server'
import { resolveBookingAccess, type BookingRequestUser } from '../../../../lib/bookings/bookingAccess'
import type { BookingRecord } from '../../../../lib/mockBooking'
import type { BookingMemberUpdate } from '../../../../lib/supabase/bookings'

const FORBIDDEN_PAYMENT_FIELDS = new Set([
  'paymentId',
  'payment_id',
  'paymentStatus',
  'payment_status',
  'paid',
  'paidAt',
  'paid_at',
  'transactionId',
  'transaction_id',
  'tradeNo',
  'trade_no',
])

const ALLOWED_UPDATE_FIELDS = new Set([
  'status',
  'googleCalendarCancelled',
  'cancellationEmailSentToCustomer',
  'cancellationEmailSentToAdmin',
  'cancelledAt',
  'cancellationReason',
])

const BOOLEAN_FIELDS = new Set([
  'googleCalendarCancelled',
  'cancellationEmailSentToCustomer',
  'cancellationEmailSentToAdmin',
])

export type BookingUpdateHandlerDeps = {
  getRequesterFromRequest: (request: Request) => Promise<BookingRequestUser | null>
  getBookingById: (bookingId: string) => Promise<BookingRecord | null>
  updateBookingById: (bookingId: string, updates: BookingMemberUpdate) => Promise<BookingRecord | null>
  adminEmailsRaw?: string | null
}

export type ParseBookingMemberUpdateResult =
  | { ok: true; updates: BookingMemberUpdate }
  | { ok: false; error: 'forbidden_payment_field' | 'unknown_field' | 'invalid_update' }

export function parseBookingMemberUpdate(value: unknown): ParseBookingMemberUpdateResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'invalid_update' }
  }

  const input = value as Record<string, unknown>
  const keys = Object.keys(input)
  if (keys.length === 0) return { ok: false, error: 'invalid_update' }
  if (keys.some((key) => FORBIDDEN_PAYMENT_FIELDS.has(key))) {
    return { ok: false, error: 'forbidden_payment_field' }
  }
  if (keys.some((key) => !ALLOWED_UPDATE_FIELDS.has(key))) {
    return { ok: false, error: 'unknown_field' }
  }

  if ('status' in input && input.status !== 'cancelled') {
    return { ok: false, error: 'forbidden_payment_field' }
  }

  for (const key of BOOLEAN_FIELDS) {
    if (key in input && typeof input[key] !== 'boolean') {
      return { ok: false, error: 'invalid_update' }
    }
  }

  for (const key of ['cancelledAt', 'cancellationReason']) {
    if (key in input && typeof input[key] !== 'string') {
      return { ok: false, error: 'invalid_update' }
    }
  }

  const cancellationReason = typeof input.cancellationReason === 'string' ? input.cancellationReason.trim() : undefined
  if (cancellationReason !== undefined && (!cancellationReason || cancellationReason.length > 300)) {
    return { ok: false, error: 'invalid_update' }
  }

  return {
    ok: true,
    updates: {
      ...(input.status === 'cancelled' ? { status: 'cancelled' as const } : {}),
      ...(typeof input.googleCalendarCancelled === 'boolean' ? { googleCalendarCancelled: input.googleCalendarCancelled } : {}),
      ...(typeof input.cancellationEmailSentToCustomer === 'boolean'
        ? { cancellationEmailSentToCustomer: input.cancellationEmailSentToCustomer }
        : {}),
      ...(typeof input.cancellationEmailSentToAdmin === 'boolean'
        ? { cancellationEmailSentToAdmin: input.cancellationEmailSentToAdmin }
        : {}),
      ...(typeof input.cancelledAt === 'string' ? { cancelledAt: input.cancelledAt } : {}),
      ...(cancellationReason !== undefined ? { cancellationReason } : {}),
    },
  }
}

export async function handleBookingUpdateRequest(request: Request, deps: BookingUpdateHandlerDeps) {
  try {
    const requester = await deps.getRequesterFromRequest(request).catch(() => null)
    if (!requester) {
      return NextResponse.json({ ok: false, message: '請先登入後再更新預約。' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, message: '預約更新資料不完整。' }, { status: 400 })
    }

    const record = body as Record<string, unknown>
    const bookingId = typeof record.bookingId === 'string' ? record.bookingId.trim() : ''
    if (!bookingId) {
      return NextResponse.json({ ok: false, message: '預約更新資料不完整。' }, { status: 400 })
    }

    const booking = await deps.getBookingById(bookingId)
    const access = resolveBookingAccess({
      requester,
      booking,
      adminEmailsRaw: deps.adminEmailsRaw !== undefined ? deps.adminEmailsRaw : process.env.ADMIN_EMAILS,
    })
    if (!access.allowed) {
      return NextResponse.json({ ok: false, message: '找不到這筆預約。' }, { status: access.status })
    }

    const parsed = parseBookingMemberUpdate(record.updates)
    if (!parsed.ok) {
      const message =
        parsed.error === 'forbidden_payment_field'
          ? '這支 API 不允許修改付款狀態。'
          : '預約更新欄位不合法。'
      return NextResponse.json({ ok: false, error: parsed.error, message }, { status: 400 })
    }

    const updated = await deps.updateBookingById(bookingId, parsed.updates)
    return NextResponse.json({ ok: true, booking: updated })
  } catch (error) {
    console.error('Booking update failed', error instanceof Error ? error.message : 'unknown_error')
    return NextResponse.json({ ok: false, message: '更新預約失敗，請稍後再試。' }, { status: 500 })
  }
}
