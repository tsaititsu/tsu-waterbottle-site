import { NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/auth/admin'

const SLOT_COLUMNS = 'id,start_at,end_at,is_available,note,created_at,updated_at'

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

function weekdayForDate(date: { year: number; month: number; day: number }) {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay()
}

function taipeiInputToIso(date: string, time: string) {
  return new Date(`${date}T${time}:00+08:00`).toISOString()
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminUser(request)
    if ('error' in auth) return auth.error

    const body = (await request.json().catch(() => null)) as {
      dateFrom?: unknown
      dateTo?: unknown
      weekdays?: unknown
      startTime?: unknown
      endTime?: unknown
      note?: unknown
    } | null

    const dateFrom = parseDateParts(body?.dateFrom)
    const dateTo = parseDateParts(body?.dateTo)
    const weekdays = Array.isArray(body?.weekdays)
      ? body.weekdays.filter((value): value is number => Number.isInteger(value) && value >= 0 && value <= 6)
      : []
    const startTime = typeof body?.startTime === 'string' ? body.startTime : ''
    const endTime = typeof body?.endTime === 'string' ? body.endTime : ''
    const note = typeof body?.note === 'string' && body.note.trim() ? body.note.trim() : null

    if (!dateFrom || !dateTo || !isValidTime(startTime) || !isValidTime(endTime) || weekdays.length === 0) {
      return NextResponse.json({ ok: false, error: '請提供有效的日期、星期與時間。' }, { status: 400 })
    }

    if (compareDateValues(dateFrom.value, dateTo.value) > 0) {
      return NextResponse.json({ ok: false, error: '結束日期必須晚於或等於開始日期。' }, { status: 400 })
    }

    const generated: Array<{ start_at: string; end_at: string; is_available: boolean; note: string | null }> = []
    let current = dateFrom

    while (compareDateValues(current.value, dateTo.value) <= 0) {
      if (weekdays.includes(weekdayForDate(current))) {
        const startAt = taipeiInputToIso(current.value, startTime)
        const endAt = taipeiInputToIso(current.value, endTime)

        if (new Date(endAt) <= new Date(startAt)) {
          return NextResponse.json({ ok: false, error: '每日結束時間必須晚於開始時間。' }, { status: 400 })
        }

        generated.push({
          start_at: startAt,
          end_at: endAt,
          is_available: true,
          note,
        })
      }

      current = addDays(current, 1)
    }

    if (generated.length === 0) {
      return NextResponse.json({ ok: true, createdCount: 0, skippedCount: 0, slots: [] })
    }

    const rangeStart = generated[0].start_at
    const rangeEnd = generated[generated.length - 1].end_at
    const { data: existingRows, error: existingError } = await auth.supabase
      .from('consultation_availability_slots')
      .select('start_at,end_at')
      .gte('start_at', rangeStart)
      .lte('start_at', rangeEnd)

    if (existingError) {
      console.error('Failed to check existing consultation availability slots', {
        code: existingError.code,
        message: existingError.message,
        details: existingError.details,
        hint: existingError.hint,
      })
      return NextResponse.json({ ok: false, error: '檢查重複時段失敗。' }, { status: 500 })
    }

    const existingKeys = new Set((existingRows ?? []).map((row) => `${row.start_at}|${row.end_at}`))
    const seenKeys = new Set<string>()
    const rowsToInsert = generated.filter((row) => {
      const key = `${row.start_at}|${row.end_at}`
      if (existingKeys.has(key) || seenKeys.has(key)) return false
      seenKeys.add(key)
      return true
    })

    if (rowsToInsert.length === 0) {
      return NextResponse.json({
        ok: true,
        createdCount: 0,
        skippedCount: generated.length,
        slots: [],
      })
    }

    const { data, error } = await auth.supabase
      .from('consultation_availability_slots')
      .insert(rowsToInsert)
      .select(SLOT_COLUMNS)

    if (error) {
      console.error('Failed to batch create consultation availability slots', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })
      return NextResponse.json({ ok: false, error: '批次新增預約時段失敗。' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      createdCount: data?.length ?? 0,
      skippedCount: generated.length - (data?.length ?? 0),
      slots: data ?? [],
    })
  } catch (error) {
    console.error('Unexpected booking slots batch create error', error)
    return NextResponse.json({ ok: false, error: '批次新增預約時段失敗。' }, { status: 500 })
  }
}
