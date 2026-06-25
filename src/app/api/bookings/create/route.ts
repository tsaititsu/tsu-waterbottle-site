import { NextResponse } from 'next/server'
import { getBookingPlan } from '@/lib/bookingPlans'
import { getUserIdFromRequest } from '@/lib/supabase/auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createSupabaseBooking } from '@/lib/supabase/bookings'

const SLOT_UNAVAILABLE_MESSAGE = '此時段已無法預約，請重新選擇其他時段。'

type AvailabilitySlotRow = {
  id: string
  start_at: string
  end_at: string
}

export async function POST(req: Request) {
  const enableDebugErrors = process.env.NEXT_PUBLIC_ENABLE_DEBUG_ERRORS === 'true'

  const buildDebugPayload = (error: unknown) => {
    if (!(error instanceof Error)) {
      return {
        message: typeof error === 'string' ? error : '未知錯誤',
        stack: error ? `${String(error)}` : undefined
      }
    }

    return {
      message: error.message,
      stack: error.stack,
      code: (error as { code?: string }).code,
      details: (error as { details?: string }).details,
      hint: (error as { hint?: string }).hint
    }
  }

  try {
    const body = await req.json()
    const userId = await getUserIdFromRequest(req)
    const plan = getBookingPlan(body.planId)

    if (!plan) {
      return NextResponse.json({ ok: false, message: '方案不存在' }, { status: 400 })
    }
    if (!body.slotId || typeof body.slotId !== 'string') {
      return NextResponse.json({ ok: false, message: SLOT_UNAVAILABLE_MESSAGE }, { status: 409 })
    }
    if (!body.customerName || !body.customerEmail || !body.birthDate || !body.birthTime || !body.question) {
      return NextResponse.json({ ok: false, message: '預約資料不完整' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const now = new Date().toISOString()
    const { data: claimedSlot, error: claimError } = await supabase
      .from('consultation_availability_slots')
      .update({ is_available: false })
      .eq('id', body.slotId)
      .eq('is_available', true)
      .gte('start_at', now)
      .select('id,start_at,end_at')
      .maybeSingle<AvailabilitySlotRow>()

    if (claimError) {
      console.error('預約時段鎖定失敗', {
        message: claimError.message,
        code: claimError.code,
        details: claimError.details,
        hint: claimError.hint,
        slotId: body.slotId
      })
      return NextResponse.json({ ok: false, message: SLOT_UNAVAILABLE_MESSAGE }, { status: 409 })
    }

    if (!claimedSlot || new Date(claimedSlot.end_at) <= new Date(claimedSlot.start_at)) {
      return NextResponse.json({ ok: false, message: SLOT_UNAVAILABLE_MESSAGE }, { status: 409 })
    }

    let booking
    try {
      booking = await createSupabaseBooking({
        ...body,
        userId: userId ?? body.userId,
        startTime: claimedSlot.start_at,
        endTime: claimedSlot.end_at
      })
    } catch (error) {
      const { error: restoreError } = await supabase
        .from('consultation_availability_slots')
        .update({ is_available: true })
        .eq('id', claimedSlot.id)

      if (restoreError) {
        console.error('預約建立失敗後還原時段失敗', {
          message: restoreError.message,
          code: restoreError.code,
          details: restoreError.details,
          hint: restoreError.hint,
          slotId: claimedSlot.id
        })
      }

      throw error
    }

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
      stack?: string
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
              ...buildDebugPayload(err)
            }
          }
        : {})
    }

    return NextResponse.json(body, { status: 500 })
  }
}
