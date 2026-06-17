import { NextResponse } from 'next/server'
import { createBookingCalendarEvent } from '@/lib/google/createBookingCalendarEvent'
import { sendBookingConfirmationEmails } from '@/lib/email/sendBookingEmails'

export async function POST(req: Request) {
  try {
    const { bookingId } = await req.json()

    if (!bookingId) {
      return NextResponse.json({ ok: false, message: 'Missing bookingId' }, { status: 400 })
    }

    const calendarResult = await createBookingCalendarEvent({
      bookingId,
      customerName: 'Mock Customer',
      customerEmail: 'customer@example.com',
      planName: '60分鐘完整命盤',
      startTime: '2026-07-01T19:00:00+08:00',
      endTime: '2026-07-01T20:00:00+08:00',
      timezone: 'Asia/Taipei'
    })

    await sendBookingConfirmationEmails({
      bookingId,
      customerName: 'Mock Customer',
      customerEmail: 'customer@example.com',
      planName: '60分鐘完整命盤',
      amount: 2880,
      startTimeText: '2026/07/01 19:00',
      endTimeText: '2026/07/01 20:00'
    })

    return NextResponse.json({
      ok: true,
      calendarEventId: calendarResult.eventId,
      calendarEventLink: calendarResult.htmlLink
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ ok: false, message: '確認預約失敗' }, { status: 500 })
  }
}
