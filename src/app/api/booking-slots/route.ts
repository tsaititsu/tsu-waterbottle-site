import { NextResponse } from 'next/server'
import { listDefaultBookingSlots } from '@/lib/defaultBookingSlots'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

type AvailabilitySlotRow = {
  id: string
  start_at: string
  end_at: string
  is_available: boolean
}

type BookingRow = {
  starts_at: string
  ends_at: string
  status: string
}

const taipeiDateTimeFormatter = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const taipeiTimeFormatter = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function formatSlotLabel(startAt: string, endAt: string) {
  const start = new Date(startAt)
  const end = new Date(endAt)
  return `${taipeiDateTimeFormatter.format(start)}–${taipeiTimeFormatter.format(end)}`
}

export async function GET() {
  try {
    const now = new Date()
    const until = new Date(now)
    until.setDate(until.getDate() + 90)

    const supabase = getSupabaseAdmin()
    const { data: availabilityRows, error: availabilityError } = await supabase
      .from('consultation_availability_slots')
      .select('id,start_at,end_at,is_available')
      .gte('start_at', now.toISOString())
      .lte('start_at', until.toISOString())
      .order('start_at', { ascending: true })

    if (availabilityError) {
      console.error('Failed to list public booking slots', {
        code: availabilityError.code,
        message: availabilityError.message,
        details: availabilityError.details,
        hint: availabilityError.hint,
      })
      return NextResponse.json({ ok: false, error: '讀取可預約時段失敗。' }, { status: 500 })
    }

    const { data: bookingRows, error: bookingError } = await supabase
      .from('bookings')
      .select('starts_at,ends_at,status')
      .gte('starts_at', now.toISOString())
      .lte('starts_at', until.toISOString())

    if (bookingError) {
      console.error('Failed to list bookings for public booking slots', {
        code: bookingError.code,
        message: bookingError.message,
        details: bookingError.details,
        hint: bookingError.hint,
      })
      return NextResponse.json({ ok: false, error: '讀取可預約時段失敗。' }, { status: 500 })
    }

    const keyFor = (startAt: string, endAt: string) => `${startAt}|${endAt}`
    const validAvailabilityRows = ((availabilityRows ?? []) as AvailabilitySlotRow[]).filter(
      (slot) => new Date(slot.end_at) > new Date(slot.start_at),
    )
    const closedKeys = new Set(
      validAvailabilityRows
        .filter((slot) => !slot.is_available)
        .map((slot) => keyFor(slot.start_at, slot.end_at)),
    )
    const bookedKeys = new Set(
      ((bookingRows ?? []) as BookingRow[])
        .filter((booking) => !['cancelled', 'failed'].includes(booking.status))
        .map((booking) => keyFor(booking.starts_at, booking.ends_at)),
    )
    const mergedSlots = new Map<string, { id: string; startAt: string; endAt: string }>()

    for (const slot of listDefaultBookingSlots(now)) {
      const key = keyFor(slot.startAt, slot.endAt)
      if (closedKeys.has(key) || bookedKeys.has(key)) continue
      mergedSlots.set(key, slot)
    }

    for (const slot of validAvailabilityRows.filter((row) => row.is_available)) {
      const key = keyFor(slot.start_at, slot.end_at)
      if (closedKeys.has(key) || bookedKeys.has(key)) continue
      mergedSlots.set(key, {
        id: `db:${slot.id}`,
        startAt: slot.start_at,
        endAt: slot.end_at,
      })
    }

    const slots = Array.from(mergedSlots.values())
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .map((slot) => ({
        id: slot.id,
        startAt: slot.startAt,
        endAt: slot.endAt,
        label: formatSlotLabel(slot.startAt, slot.endAt),
      }))

    return NextResponse.json({ ok: true, slots })
  } catch (error) {
    console.error('Unexpected public booking slots error', error)
    return NextResponse.json({ ok: false, error: '讀取可預約時段失敗。' }, { status: 500 })
  }
}
