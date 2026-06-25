import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

async function requireAuthenticatedUser(request: Request) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    return { error: NextResponse.json({ ok: false, error: '請先登入後再使用後台。' }, { status: 401 }) }
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    return { error: NextResponse.json({ ok: false, error: '登入狀態已失效，請重新登入。' }, { status: 401 }) }
  }

  return { supabase }
}

function parseDateParts(value: unknown) {
  if (typeof value !== 'string') return null
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    value,
  }
}

function isValidTime(value: unknown) {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)
}

function addDays(date: { year: number; month: number; day: number }, days: number) {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days))
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
    value: next.toISOString().slice(0, 10),
  }
}

function compareDateValues(a: string, b: string) {
  return a.localeCompare(b)
}

function taipeiInputToIso(date: string, time: string) {
  return new Date(`${date}T${time}:00+08:00`).toISOString()
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

function taipeiPartsFromIso(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(value))

  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    date: `${lookup.year}-${lookup.month}-${lookup.day}`,
    minutes: Number(lookup.hour) * 60 + Number(lookup.minute),
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request)
    if ('error' in auth) return auth.error

    const body = (await request.json().catch(() => null)) as {
      dateFrom?: unknown
      dateTo?: unknown
      allDay?: unknown
      startTime?: unknown
      endTime?: unknown
      note?: unknown
    } | null

    const dateFrom = parseDateParts(body?.dateFrom)
    const dateTo = parseDateParts(body?.dateTo)
    const allDay = body?.allDay === true
    const startTime = typeof body?.startTime === 'string' ? body.startTime : ''
    const endTime = typeof body?.endTime === 'string' ? body.endTime : ''
    const note = typeof body?.note === 'string' && body.note.trim() ? body.note.trim() : null

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ ok: false, error: '請提供有效的日期範圍。' }, { status: 400 })
    }

    if (compareDateValues(dateFrom.value, dateTo.value) > 0) {
      return NextResponse.json({ ok: false, error: '結束日期必須晚於或等於開始日期。' }, { status: 400 })
    }

    if (!allDay && (!isValidTime(startTime) || !isValidTime(endTime))) {
      return NextResponse.json({ ok: false, error: '請提供有效的關閉時間。' }, { status: 400 })
    }

    if (!allDay && timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      return NextResponse.json({ ok: false, error: '結束時間必須晚於開始時間。' }, { status: 400 })
    }

    const rangeStart = taipeiInputToIso(dateFrom.value, '00:00')
    const rangeEnd = taipeiInputToIso(addDays(dateTo, 1).value, '00:00')
    const { data: candidates, error: selectError } = await auth.supabase
      .from('consultation_availability_slots')
      .select('id,start_at,end_at')
      .gte('start_at', rangeStart)
      .lt('start_at', rangeEnd)
      .eq('is_available', true)

    if (selectError) {
      console.error('Failed to find consultation slots for bulk close', {
        code: selectError.code,
        message: selectError.message,
        details: selectError.details,
        hint: selectError.hint,
      })
      return NextResponse.json({ ok: false, error: '查詢可關閉時段失敗。' }, { status: 500 })
    }

    const closeStartMinutes = allDay ? 0 : timeToMinutes(startTime)
    const closeEndMinutes = allDay ? 24 * 60 : timeToMinutes(endTime)
    const idsToUpdate = (candidates ?? [])
      .filter((slot) => {
        if (allDay) return true
        const start = taipeiPartsFromIso(slot.start_at)
        const end = taipeiPartsFromIso(slot.end_at)
        if (start.date !== end.date) return false
        return start.minutes < closeEndMinutes && end.minutes > closeStartMinutes
      })
      .map((slot) => slot.id)

    if (idsToUpdate.length === 0) {
      return NextResponse.json({
        ok: true,
        updatedCount: 0,
        message: '此期間沒有已開放時段，不需要關閉。',
      })
    }

    const updates: { is_available: boolean; note?: string } = { is_available: false }
    if (note) updates.note = note

    const { data, error } = await auth.supabase
      .from('consultation_availability_slots')
      .update(updates)
      .in('id', idsToUpdate)
      .select('id')

    if (error) {
      console.error('Failed to bulk close consultation slots', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })
      return NextResponse.json({ ok: false, error: '批次關閉時段失敗。' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, updatedCount: data?.length ?? 0 })
  } catch (error) {
    console.error('Unexpected booking slots bulk close error', error)
    return NextResponse.json({ ok: false, error: '批次關閉時段失敗。' }, { status: 500 })
  }
}
