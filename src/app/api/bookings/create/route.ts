import { NextResponse } from 'next/server'
import { getBookingPlan } from '@/lib/bookingPlans'
import { createSupabaseBooking } from '@/lib/supabase/bookings'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const plan = getBookingPlan(body.planId)

    if (!plan) {
      return NextResponse.json({ ok: false, message: '方案不存在' }, { status: 400 })
    }
    if (!body.startTime || !body.customerName || !body.customerEmail || !body.birthDate || !body.birthTime || !body.question) {
      return NextResponse.json({ ok: false, message: '預約資料不完整' }, { status: 400 })
    }

    const booking = await createSupabaseBooking(body)
    const bookingId = booking?.id ?? `mock-booking-${Date.now()}`
    const paymentId = `mock-payment-${Date.now()}`

    return NextResponse.json({
      ok: true,
      bookingId,
      paymentId,
      planName: plan.name,
      amount: plan.price,
      persisted: Boolean(booking),
      mockCheckoutUrl: `/booking/checkout?bookingId=${bookingId}`
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ ok: false, message: '建立預約失敗' }, { status: 500 })
  }
}
