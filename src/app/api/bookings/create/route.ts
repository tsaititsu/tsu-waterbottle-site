import { NextResponse } from 'next/server'
import { getBookingPlan } from '@/lib/bookingPlans'
import { getUserIdFromRequest } from '@/lib/supabase/auth'
import { createSupabaseBooking } from '@/lib/supabase/bookings'

export async function POST(req: Request) {
  const enableDebugErrors = process.env.NEXT_PUBLIC_ENABLE_DEBUG_ERRORS === 'true'

  try {
    const body = await req.json()
    const userId = await getUserIdFromRequest(req)
    const plan = getBookingPlan(body.planId)

    if (!plan) {
      return NextResponse.json({ ok: false, message: '方案不存在' }, { status: 400 })
    }
    if (!body.startTime || !body.customerName || !body.customerEmail || !body.birthDate || !body.birthTime || !body.question) {
      return NextResponse.json({ ok: false, message: '預約資料不完整' }, { status: 400 })
    }

    const booking = await createSupabaseBooking({ ...body, userId: userId ?? body.userId })
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
    const err = error as {
      message?: string
      code?: string
      details?: string
      hint?: string
    }
    console.error('建立預約失敗', {
      message: err?.message,
      code: err?.code,
      details: err?.details,
      hint: err?.hint
    })

    const body = {
      ok: false,
      message: '建立預約失敗',
      ...(enableDebugErrors
        ? {
            debug: {
              message: err?.message ?? 'Unknown error',
              code: err?.code,
              details: err?.details,
              hint: err?.hint
            }
          }
        : null)
    }

    return NextResponse.json(body, { status: 500 })
  }
}
