import { NextResponse } from 'next/server'
import type { BookingRequestUser } from '../../../../lib/bookings/bookingAccess'
import {
  MEMBER_BOOKING_MAX_PAGE_SIZE,
  MEMBER_BOOKING_PAGE_SIZE,
  type BookingMemberListItem,
} from '../../../../lib/bookings/types'

export type BookingListHandlerDeps = {
  getRequesterFromRequest: (request: Request) => Promise<BookingRequestUser | null>
  listBookingsByUserId: (
    userId: string,
    pagination: { limit: number; offset: number },
  ) => Promise<{ bookings: BookingMemberListItem[]; total: number }>
}

function readPagination(request: Request) {
  const params = new URL(request.url).searchParams
  const rawLimit = params.get('limit')
  const rawOffset = params.get('offset')
  const limit = rawLimit === null ? MEMBER_BOOKING_PAGE_SIZE : Number(rawLimit)
  const offset = rawOffset === null ? 0 : Number(rawOffset)
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > MEMBER_BOOKING_MAX_PAGE_SIZE ||
    !Number.isSafeInteger(offset) ||
    offset < 0
  ) {
    return null
  }
  return { limit, offset }
}

export async function handleBookingListRequest(request: Request, deps: BookingListHandlerDeps) {
  try {
    const requester = await deps.getRequesterFromRequest(request).catch(() => null)
    if (!requester) {
      return NextResponse.json({ ok: false, message: '請先登入後再查看預約。' }, { status: 401 })
    }

    const pagination = readPagination(request)
    if (!pagination) {
      return NextResponse.json(
        { ok: false, message: '分頁參數不合法。' },
        { status: 400 },
      )
    }

    const result = await deps.listBookingsByUserId(requester.id, pagination)
    return NextResponse.json({
      ok: true,
      bookings: result.bookings,
      meta: {
        total: result.total,
        limit: pagination.limit,
        offset: pagination.offset,
      },
    })
  } catch {
    console.error('Booking list failed')
    return NextResponse.json({ ok: false, message: '讀取預約失敗，請稍後再試。' }, { status: 500 })
  }
}
