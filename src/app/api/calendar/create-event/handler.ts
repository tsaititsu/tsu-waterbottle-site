import { NextResponse } from 'next/server'
import { resolveBookingAccess, type BookingRequestUser } from '../../../../lib/bookings/bookingAccess'
import { isTrustedPaidBooking } from '../../../../lib/bookings/bookingSuccess'
import type { BookingRecord } from '../../../../lib/mockBooking'

export type BookingCalendarResult = {
  eventId: string
  htmlLink: string
}

export type BookingCalendarHandlerDeps = {
  getRequesterFromRequest: (request: Request) => Promise<BookingRequestUser | null>
  getBookingById: (bookingId: string) => Promise<BookingRecord | null>
  createCalendarEvent: (payload: {
    bookingId: string
    customerName: string
    customerEmail: string
    customerPhone?: string
    planName: string
    startTime: string
    endTime: string
    timezone: string
    birthDate?: string
    birthTime?: string
    birthPlace?: string
    gender?: string
    question?: string
  }) => Promise<BookingCalendarResult>
  markCalendarCreated: (bookingId: string, result: BookingCalendarResult) => Promise<void>
  adminEmailsRaw?: string | null
}

export async function handleBookingCalendarRequest(request: Request, deps: BookingCalendarHandlerDeps) {
  try {
    const requester = await deps.getRequesterFromRequest(request).catch(() => null)
    if (!requester) {
      return NextResponse.json({ ok: false, message: '請先登入後再建立行事曆事件。' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const bookingId =
      body && typeof body === 'object' && typeof (body as Record<string, unknown>).bookingId === 'string'
        ? ((body as Record<string, unknown>).bookingId as string).trim()
        : ''
    if (!bookingId) {
      return NextResponse.json({ ok: false, message: '請提供有效的預約編號。' }, { status: 400 })
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
      customerName: safeBooking.customerName,
      customerEmail: safeBooking.customerEmail,
      customerPhone: safeBooking.customerPhone,
      planName: safeBooking.planName,
      startTime: safeBooking.startTime,
      endTime: safeBooking.endTime,
      timezone: safeBooking.timezone,
      birthDate: safeBooking.birthDate,
      birthTime: safeBooking.birthTime,
      birthPlace: safeBooking.birthPlace,
      gender: safeBooking.gender,
      question: safeBooking.question,
    })
    await deps.markCalendarCreated(safeBooking.id, result)

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('Booking calendar creation failed', error instanceof Error ? error.message : 'unknown_error')
    return NextResponse.json({ ok: false, message: '建立 Calendar 事件失敗。' }, { status: 500 })
  }
}
