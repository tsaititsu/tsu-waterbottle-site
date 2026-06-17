import { NextResponse } from 'next/server'
import { updateSupabaseBooking } from '@/lib/supabase/bookings'

export async function POST(req: Request) {
  try {
    const { bookingId, updates } = await req.json()

    if (!bookingId || !updates) {
      return NextResponse.json({ ok: false, message: '預約更新資料不完整' }, { status: 400 })
    }

    const booking = await updateSupabaseBooking(bookingId, updates)
    return NextResponse.json({ ok: true, booking })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : '更新預約失敗' }, { status: 500 })
  }
}
