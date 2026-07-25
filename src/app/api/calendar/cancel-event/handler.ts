import { NextResponse } from 'next/server'
import { resolveBookingAccess, type BookingRequestUser } from '../../../../lib/bookings/bookingAccess'
import { isAdminEmail } from '../../../../lib/auth/admin'
import type { BookingRecord } from '../../../../lib/bookings/types'
import type { BookingMemberUpdate } from '../../../../lib/supabase/bookings'

export type BookingCalendarCancellationDeps = {
  getRequesterFromRequest: (request: Request) => Promise<BookingRequestUser | null>
  getBookingById: (
    bookingId: string,
    requesterId: string,
    requesterIsAdmin: boolean,
  ) => Promise<BookingRecord | null>
  cancelCalendarEvent: (eventId: string) => Promise<unknown>
  markCalendarCancelled: (
    bookingId: string,
    updates: BookingMemberUpdate,
  ) => Promise<BookingRecord | null>
  adminEmailsRaw?: string | null
}

function parseCancellationRequest(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  if (Object.keys(input).some((key) => key !== 'bookingId')) return null
  const bookingId = typeof input.bookingId === 'string' ? input.bookingId.trim() : ''
  return bookingId || null
}

export async function handleBookingCalendarCancellationRequest(
  request: Request,
  deps: BookingCalendarCancellationDeps,
) {
  try {
    const requester = await deps.getRequesterFromRequest(request).catch(() => null)
    if (!requester) {
      return NextResponse.json({ ok: false, message: '請先登入後再取消行事曆事件。' }, { status: 401 })
    }

    const bookingId = parseCancellationRequest(await request.json().catch(() => null))
    if (!bookingId) {
      return NextResponse.json({ ok: false, message: '取消行事曆資料不合法。' }, { status: 400 })
    }

    const adminEmailsRaw = deps.adminEmailsRaw !== undefined ? deps.adminEmailsRaw : process.env.ADMIN_EMAILS
    const requesterIsAdmin = isAdminEmail(requester.email, adminEmailsRaw)
    const booking = await deps.getBookingById(bookingId, requester.id, requesterIsAdmin)
    const access = resolveBookingAccess({
      requester,
      booking,
      adminEmailsRaw,
    })
    if (!access.allowed) {
      return NextResponse.json({ ok: false, message: '找不到這筆預約。' }, { status: access.status })
    }

    const safeBooking = booking as BookingRecord
    if (safeBooking.status !== 'cancelled') {
      return NextResponse.json(
        { ok: false, error: 'booking_not_cancelled', message: '預約尚未取消。' },
        { status: 409 },
      )
    }

    if (safeBooking.googleCalendarCancelled || !safeBooking.googleCalendarEventId) {
      return NextResponse.json({ ok: true, alreadyCancelled: true })
    }

    await deps.cancelCalendarEvent(safeBooking.googleCalendarEventId)
    const updated = await deps.markCalendarCancelled(bookingId, { googleCalendarCancelled: true })
    if (!updated) {
      return NextResponse.json({ ok: false, message: '取消行事曆事件失敗，請稍後再試。' }, { status: 503 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    console.error('Booking calendar cancellation failed')
    return NextResponse.json({ ok: false, message: '取消行事曆事件失敗，請稍後再試。' }, { status: 500 })
  }
}
