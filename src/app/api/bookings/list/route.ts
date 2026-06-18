import { NextResponse } from 'next/server'
import { getUserIdFromRequest } from '@/lib/supabase/auth'
import { listSupabaseBookings } from '@/lib/supabase/bookings'

export async function GET(req: Request) {
  try {
    const userId = await getUserIdFromRequest(req)
    if (!userId) {
      return NextResponse.json({ ok: true, bookings: [] })
    }
    const bookings = await listSupabaseBookings(userId)
    return NextResponse.json({ ok: true, bookings })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : '讀取預約失敗' }, { status: 500 })
  }
}
