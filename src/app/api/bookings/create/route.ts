import { NextResponse } from 'next/server'
import { getBookingPlan } from '@/lib/bookingPlans'
import { resolveDefaultBookingSlotId } from '@/lib/defaultBookingSlots'
import { getUserIdFromRequest } from '@/lib/supabase/auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createSupabaseBooking } from '@/lib/supabase/bookings'

const SLOT_UNAVAILABLE_MESSAGE = '此時段已無法預約，請重新選擇其他時段。'

type AvailabilitySlotRow = {
  id: string
  start_at: string
  end_at: string
}

type BookingSlotClaim = {
  id: string | null
  startAt: string
  endAt: string
  restore: () => Promise<void>
}

async function claimDbSlot(supabase: ReturnType<typeof getSupabaseAdmin>, slotId: string, now: string): Promise<BookingSlotClaim | null> {
  const dbId = slotId.startsWith('db:') ? slotId.slice(3) : slotId
  if (!dbId) return null

  const { data: claimedSlot, error: claimError } = await supabase
    .from('consultation_availability_slots')
    .update({ is_available: false })
    .eq('id', dbId)
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
      slotId,
    })
    return null
  }

  if (!claimedSlot || new Date(claimedSlot.end_at) <= new Date(claimedSlot.start_at)) return null

  return {
    id: claimedSlot.id,
    startAt: claimedSlot.start_at,
    endAt: claimedSlot.end_at,
    restore: async () => {
      const { error } = await supabase
        .from('consultation_availability_slots')
        .update({ is_available: true })
        .eq('id', claimedSlot.id)

      if (error) {
        console.error('預約建立失敗後還原時段失敗', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          slotId: claimedSlot.id,
        })
      }
    },
  }
}

async function claimDefaultSlot(supabase: ReturnType<typeof getSupabaseAdmin>, slotId: string, now: Date): Promise<BookingSlotClaim | null> {
  const defaultSlot = resolveDefaultBookingSlotId(slotId, now)
  if (!defaultSlot) return null

  const { data: closedSlot, error: closedError } = await supabase
    .from('consultation_availability_slots')
    .select('id')
    .eq('start_at', defaultSlot.startAt)
    .eq('end_at', defaultSlot.endAt)
    .eq('is_available', false)
    .maybeSingle()

  if (closedError) {
    console.error('預約固定時段關閉狀態查詢失敗', {
      message: closedError.message,
      code: closedError.code,
      details: closedError.details,
      hint: closedError.hint,
      slotId,
    })
    return null
  }

  if (closedSlot) return null

  const { data: existingBooking, error: bookingError } = await supabase
    .from('bookings')
    .select('id,status')
    .eq('starts_at', defaultSlot.startAt)
    .eq('ends_at', defaultSlot.endAt)
    .not('status', 'in', '(cancelled,failed)')
    .limit(1)
    .maybeSingle()

  if (bookingError) {
    console.error('預約固定時段既有 booking 查詢失敗', {
      message: bookingError.message,
      code: bookingError.code,
      details: bookingError.details,
      hint: bookingError.hint,
      slotId,
    })
    return null
  }

  if (existingBooking) return null

  const { data: closedMarker, error: insertError } = await supabase
    .from('consultation_availability_slots')
    .insert({
      start_at: defaultSlot.startAt,
      end_at: defaultSlot.endAt,
      is_available: false,
      note: '已被預約',
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('預約固定時段關閉標記建立失敗', {
      message: insertError.message,
      code: insertError.code,
      details: insertError.details,
      hint: insertError.hint,
      slotId,
    })
    return null
  }

  return {
    id: closedMarker.id,
    startAt: defaultSlot.startAt,
    endAt: defaultSlot.endAt,
    restore: async () => {
      const { error } = await supabase
        .from('consultation_availability_slots')
        .delete()
        .eq('id', closedMarker.id)

      if (error) {
        console.error('預約建立失敗後移除固定時段關閉標記失敗', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          slotId: closedMarker.id,
        })
      }
    },
  }
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
    const now = new Date()
    const slotId = body.slotId as string
    const claimedSlot = slotId.startsWith('default:')
      ? await claimDefaultSlot(supabase, slotId, now)
      : await claimDbSlot(supabase, slotId, now.toISOString())

    if (!claimedSlot) {
      return NextResponse.json({ ok: false, message: SLOT_UNAVAILABLE_MESSAGE }, { status: 409 })
    }

    let booking
    try {
      booking = await createSupabaseBooking({
        ...body,
        userId: userId ?? body.userId,
        startTime: claimedSlot.startAt,
        endTime: claimedSlot.endAt
      })
    } catch (error) {
      await claimedSlot.restore()
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
