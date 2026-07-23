import { NextResponse } from 'next/server'
import { requireAdminUser, type RequireAdminUserResult } from '../../../../lib/auth/admin'
import {
  ADMIN_BOOKING_LIMIT,
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
  listBookings: (supabase: AdminBookingsClient) => Promise<AdminBookingListItem[]>
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

    const bookings = await deps.listBookings(auth.supabase)

    return NextResponse.json(
      {
        ok: true,
        bookings,
        meta: {
          count: bookings.length,
          limit: ADMIN_BOOKING_LIMIT,
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
