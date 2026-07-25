import { NextResponse } from 'next/server'
import { requireAdminUser, type RequireAdminUserResult } from '../../../../lib/auth/admin'
import {
  ADMIN_BOOKING_LIMIT,
  ADMIN_BOOKING_MAX_LIMIT,
  listAdminBookings,
  type AdminBookingListItem,
  type AdminBookingsClient,
} from '../../../../lib/supabase/adminBookings'

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
}

export type AdminBookingsHandlerDeps = {
  requireAdmin: (request: Request) => Promise<RequireAdminUserResult>
  listBookings: (
    supabase: AdminBookingsClient,
    pagination: { limit: number; offset: number },
  ) => Promise<{ bookings: AdminBookingListItem[]; total: number }>
}

const defaultDeps: AdminBookingsHandlerDeps = {
  requireAdmin: requireAdminUser,
  listBookings: listAdminBookings,
}

function addNoStoreHeaders(response: Response) {
  for (const [name, value] of Object.entries(NO_STORE_HEADERS)) {
    response.headers.set(name, value)
  }
  return response
}

export async function handleAdminBookingsRequest(
  request: Request,
  deps: AdminBookingsHandlerDeps = defaultDeps,
) {
  try {
    const auth = await deps.requireAdmin(request)
    if ('error' in auth) return addNoStoreHeaders(auth.error)

    const params = new URL(request.url).searchParams
    const rawLimit = params.get('limit')
    const rawOffset = params.get('offset')
    const limit = rawLimit === null ? ADMIN_BOOKING_LIMIT : Number(rawLimit)
    const offset = rawOffset === null ? 0 : Number(rawOffset)
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > ADMIN_BOOKING_MAX_LIMIT ||
      !Number.isSafeInteger(offset) ||
      offset < 0
    ) {
      return NextResponse.json(
        { ok: false, error: '分頁參數不合法。' },
        { status: 400, headers: NO_STORE_HEADERS },
      )
    }

    const result = await deps.listBookings(auth.supabase, { limit, offset })

    return NextResponse.json(
      {
        ok: true,
        bookings: result.bookings,
        meta: {
          count: result.bookings.length,
          total: result.total,
          limit,
          offset,
        },
      },
      { headers: NO_STORE_HEADERS },
    )
  } catch {
    console.error('Failed to list admin bookings')
    return NextResponse.json(
      { ok: false, error: '讀取預約紀錄失敗。' },
      { status: 500, headers: NO_STORE_HEADERS },
    )
  }
}
