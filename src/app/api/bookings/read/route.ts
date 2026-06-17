import { NextResponse } from 'next/server'
import { getSupabaseBooking } from '@/lib/supabase/bookings'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const bookingId = searchParams.get('bookingId')

    if (!bookingId) {
      return NextResponse.json({ ok: false, message: '缺少預約編號' }, { status: 400 })
    }

    const booking = await getSupabaseBooking(bookingId)
    return NextResponse.json({ ok: true, booking })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : '讀取預約失敗' }, { status: 500 })
  }
}
