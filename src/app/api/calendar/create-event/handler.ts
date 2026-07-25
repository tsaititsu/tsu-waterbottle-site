import { NextResponse } from 'next/server'
import { resolveBookingAccess, type BookingRequestUser } from '../../../../lib/bookings/bookingAccess'
import { isAdminEmail } from '../../../../lib/auth/admin'
import { isTrustedPaidBooking } from '../../../../lib/bookings/bookingSuccess'
import type { BookingRecord } from '../../../../lib/bookings/types'

export type BookingCalendarResult = {
  eventId: string
  htmlLink: string
}

export type BookingCalendarHandlerDeps = {
  getRequesterFromRequest: (request: Request) => Promise<BookingRequestUser | null>
  getBookingById: (
    bookingId: string,
    requesterId: string,
    requesterIsAdmin: boolean,
  ) => Promise<BookingRecord | null>
  createCalendarEvent: (payload: {
    bookingId: string
    planName: string
    startTime: string
    endTime: string
    timezone: string
  }) => Promise<BookingCalendarResult>
  markCalendarCreated: (bookingId: string, result: BookingCalendarResult) => Promise<void>
  adminEmailsRaw?: string | null
}

function parseCalendarCreationRequest(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  if (Object.keys(input).some((key) => key !== 'bookingId')) return null
  const bookingId = typeof input.bookingId === 'string' ? input.bookingId.trim() : ''
  return bookingId || null
}

export async function handleBookingCalendarRequest(request: Request, deps: BookingCalendarHandlerDeps) {
  try {
    const requester = await deps.getRequesterFromRequest(request).catch(() => null)
    if (!requester) {
      return NextResponse.json({ ok: false, message: '請先登入後再建立行事曆事件。' }, { status: 401 })
    }

    const bookingId = parseCalendarCreationRequest(await request.json().catch(() => null))
    if (!bookingId) {
      return NextResponse.json({ ok: false, message: '建立行事曆資料不合法。' }, { status: 400 })
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
    if (!isTrustedPaidBooking(safeBooking)) {
      return NextResponse.json({ ok: false, error: 'payment_not_confirmed', message: '付款尚未確認。' }, { status: 409 })
    }

    if (safeBooking.googleCalendarEventId) {
      return NextResponse.json({
        ok: true,
        alreadyCreated: true,
        eventId: safeBooking.googleCalendarEventId,
        htmlLink: safeBooking.googleCalendarEventLink ?? '',
      })
    }

    const result = await deps.createCalendarEvent({
      bookingId: safeBooking.id,
      planName: safeBooking.planName,
      startTime: safeBooking.startTime,
      endTime: safeBooking.endTime,
      timezone: safeBooking.timezone,
    })
    await deps.markCalendarCreated(safeBooking.id, result)

    return NextResponse.json({ ok: true, ...result })
  } catch {
    console.error('Booking calendar creation failed')
    return NextResponse.json({ ok: false, message: '建立 Calendar 事件失敗。' }, { status: 500 })
  }
}
