import { NextResponse } from 'next/server'
import { listSupabaseBookings } from '@/lib/supabase/bookings'

export async function GET() {
  try {
    const bookings = await listSupabaseBookings()
    return NextResponse.json({ ok: true, bookings })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : '讀取預約失敗' }, { status: 500 })
  }
}
