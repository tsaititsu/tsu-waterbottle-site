import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

type AvailabilitySlotRow = {
  id: string
  start_at: string
  end_at: string
  is_available: boolean
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
      })
      return NextResponse.json({ ok: false, error: '讀取可預約時段失敗。' }, { status: 500 })
    }

    const validAvailabilityRows = ((availabilityRows ?? []) as AvailabilitySlotRow[]).filter(
      (slot) =>
        slot.is_available &&
        new Date(slot.end_at) > new Date(slot.start_at),
    )
    const slots = validAvailabilityRows
      .map((slot) => ({
        id: `db:${slot.id}`,
        startAt: slot.start_at,
        endAt: slot.end_at,
      }))
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .map((slot) => ({
        id: slot.id,
        startAt: slot.startAt,
        endAt: slot.endAt,
        label: formatSlotLabel(slot.startAt, slot.endAt),
      }))

    return NextResponse.json({ ok: true, slots })
  } catch {
    console.error('Unexpected public booking slots error')
    return NextResponse.json({ ok: false, error: '讀取可預約時段失敗。' }, { status: 500 })
  }
}
