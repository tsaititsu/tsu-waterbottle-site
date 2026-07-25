import { NextResponse } from 'next/server'
import { resolveBookingAccess, type BookingRequestUser } from '../../../../lib/bookings/bookingAccess'
import { isAdminEmail } from '../../../../lib/auth/admin'
import type { BookingRecord } from '../../../../lib/bookings/types'

export type BookingReadHandlerDeps = {
  getRequesterFromRequest: (request: Request) => Promise<BookingRequestUser | null>
  getBookingById: (
    bookingId: string,
    requesterId: string,
    requesterIsAdmin: boolean,
  ) => Promise<BookingRecord | null>
  adminEmailsRaw?: string | null
}

export async function handleBookingReadRequest(request: Request, deps: BookingReadHandlerDeps) {
  try {
    const requester = await deps.getRequesterFromRequest(request).catch(() => null)
    if (!requester) {
      return NextResponse.json({ ok: false, message: '請先登入後再查看預約。' }, { status: 401 })
    }

    const bookingId = new URL(request.url).searchParams.get('bookingId')?.trim() ?? ''
    if (!bookingId) {
      return NextResponse.json({ ok: false, message: '缺少預約編號。' }, { status: 400 })
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

    return NextResponse.json({ ok: true, booking })
  } catch {
    console.error('Booking read failed')
    return NextResponse.json({ ok: false, message: '讀取預約失敗，請稍後再試。' }, { status: 500 })
  }
}
