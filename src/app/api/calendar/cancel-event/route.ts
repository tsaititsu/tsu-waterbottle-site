import { NextResponse } from 'next/server'
import { cancelBookingCalendarEvent } from '@/lib/google/createBookingCalendarEvent'

export async function POST(req: Request) {
  try {
    const { eventId } = await req.json()
    const result = await cancelBookingCalendarEvent(eventId)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error(error)
    const message = error instanceof Error ? error.message : '取消 Calendar 事件失敗'
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
