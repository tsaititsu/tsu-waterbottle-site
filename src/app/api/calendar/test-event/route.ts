import { NextResponse } from 'next/server'
import { createBookingCalendarEvent } from '@/lib/google/createBookingCalendarEvent'

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ ok: false, message: 'Test endpoint disabled in production' }, { status: 404 })
  }

  try {
    const result = await createBookingCalendarEvent({
      bookingId: `test-booking-${Date.now()}`,
      customerName: 'WATERBOTTLE 測試',
      customerEmail: process.env.ADMIN_NOTIFY_EMAIL || 'test@example.com',
      planName: '水瓶先生論命',
      startTime: '2026-06-18T14:00:00+08:00',
      endTime: '2026-06-18T15:00:00+08:00',
      timezone: 'Asia/Taipei',
      question: '這是本機測試 Google Calendar 串接建立的測試事件，確認成功後可以刪除。'
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : '建立測試事件失敗' },
      { status: 500 }
    )
  }
}
