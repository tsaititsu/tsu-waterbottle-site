import { NextResponse } from 'next/server'
import { createBookingCalendarEvent } from '@/lib/google/createBookingCalendarEvent'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const result = await createBookingCalendarEvent(body)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ ok: false, message: '建立 Calendar 事件失敗' }, { status: 500 })
  }
}
