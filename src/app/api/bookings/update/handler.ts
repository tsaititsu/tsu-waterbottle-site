import { NextResponse } from 'next/server'
import { resolveBookingAccess, type BookingRequestUser } from '../../../../lib/bookings/bookingAccess'
import { isAdminEmail } from '../../../../lib/auth/admin'
import type { BookingRecord } from '../../../../lib/bookings/types'
import type { CancelSupabaseBookingInput } from '../../../../lib/supabase/bookings'

const CANCELLATION_REASON_MAX_LENGTH = 300
const CANCELLATION_WINDOW_MILLISECONDS = 24 * 60 * 60 * 1000
const CANCELLATION_REQUEST_FIELDS = new Set(['bookingId', 'cancellationReason'])

export type BookingUpdateHandlerDeps = {
  getRequesterFromRequest: (request: Request) => Promise<BookingRequestUser | null>
  getBookingById: (
    bookingId: string,
    requesterId: string,
    requesterIsAdmin: boolean,
  ) => Promise<BookingRecord | null>
  cancelBooking: (input: CancelSupabaseBookingInput) => Promise<BookingRecord | null>
  now: () => Date
  adminEmailsRaw?: string | null
}

export type ParseBookingCancellationResult =
  | { ok: true; bookingId: string; cancellationReason: string }
  | { ok: false; error: 'invalid_request' | 'unknown_field' }

export function parseBookingCancellationRequest(value: unknown): ParseBookingCancellationResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'invalid_request' }
  }

  const input = value as Record<string, unknown>
  if (Object.keys(input).some((key) => !CANCELLATION_REQUEST_FIELDS.has(key))) {
    return { ok: false, error: 'unknown_field' }
  }

  const bookingId = typeof input.bookingId === 'string' ? input.bookingId.trim() : ''
  const cancellationReason =
    typeof input.cancellationReason === 'string' ? input.cancellationReason.trim() : ''

  if (
    !bookingId ||
    !cancellationReason ||
    cancellationReason.length > CANCELLATION_REASON_MAX_LENGTH
  ) {
    return { ok: false, error: 'invalid_request' }
  }

  return { ok: true, bookingId, cancellationReason }
}

function isCancellationWindowOpen(booking: BookingRecord, now: Date) {
  const startsAt = new Date(booking.startTime).getTime()
  return Number.isFinite(startsAt) && startsAt - now.getTime() > CANCELLATION_WINDOW_MILLISECONDS
}

export async function handleBookingUpdateRequest(request: Request, deps: BookingUpdateHandlerDeps) {
  try {
    const requester = await deps.getRequesterFromRequest(request).catch(() => null)
    if (!requester) {
      return NextResponse.json({ ok: false, message: '請先登入後再更新預約。' }, { status: 401 })
    }

    const parsed = parseBookingCancellationRequest(await request.json().catch(() => null))
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, error: parsed.error, message: '取消預約資料不合法。' },
        { status: 400 },
      )
    }

    const adminEmailsRaw = deps.adminEmailsRaw !== undefined ? deps.adminEmailsRaw : process.env.ADMIN_EMAILS
    const requesterIsAdmin = isAdminEmail(requester.email, adminEmailsRaw)
    const booking = await deps.getBookingById(parsed.bookingId, requester.id, requesterIsAdmin)
    const access = resolveBookingAccess({
      requester,
      booking,
      adminEmailsRaw,
    })
    if (!access.allowed) {
      return NextResponse.json({ ok: false, message: '找不到這筆預約。' }, { status: access.status })
    }

    const safeBooking = booking as BookingRecord
    if (safeBooking.status === 'cancelled') {
      return NextResponse.json({ ok: true, alreadyCancelled: true, booking: safeBooking })
    }

    if (safeBooking.status !== 'confirmed' || safeBooking.paymentStatus !== 'paid') {
      return NextResponse.json(
        { ok: false, error: 'cancellation_not_allowed', message: '這筆預約目前不能取消。' },
        { status: 409 },
      )
    }

    const now = deps.now()
    if (!isCancellationWindowOpen(safeBooking, now)) {
      return NextResponse.json(
        { ok: false, error: 'cancellation_window_closed', message: '距離預約開始 24 小時內不能自行取消。' },
        { status: 409 },
      )
    }

    const updated = await deps.cancelBooking({
      bookingId: parsed.bookingId,
      requesterId: requester.id,
      requesterIsAdmin,
      expectedStartTime: safeBooking.startTime,
      expectedUpdatedAt: safeBooking.updatedAt,
      cancelledAt: now.toISOString(),
      cancellationReason: parsed.cancellationReason,
    })
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: 'booking_changed', message: '預約狀態已變更，請重新整理後再試。' },
        { status: 409 },
      )
    }

    return NextResponse.json({ ok: true, booking: updated })
  } catch {
    console.error('Booking cancellation failed')
    return NextResponse.json({ ok: false, message: '更新預約失敗，請稍後再試。' }, { status: 500 })
  }
}
