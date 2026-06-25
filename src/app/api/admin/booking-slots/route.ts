import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const SLOT_COLUMNS = 'id,start_at,end_at,is_available,note,created_at,updated_at'

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

function parseDateTime(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request)
    if ('error' in auth) return auth.error

    const now = new Date()
    const until = new Date(now)
    until.setDate(until.getDate() + 90)

    const { data, error } = await auth.supabase
      .from('consultation_availability_slots')
      .select(SLOT_COLUMNS)
      .gte('start_at', now.toISOString())
      .lte('start_at', until.toISOString())
      .order('start_at', { ascending: true })

    if (error) {
      console.error('Failed to list consultation availability slots', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })
      return NextResponse.json({ ok: false, error: '讀取預約時段失敗。' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, slots: data ?? [] })
  } catch (error) {
    console.error('Unexpected booking slots list error', error)
    return NextResponse.json({ ok: false, error: '讀取預約時段失敗。' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request)
    if ('error' in auth) return auth.error

    const body = (await request.json().catch(() => null)) as {
      startAt?: unknown
      endAt?: unknown
      note?: unknown
    } | null

    const startAt = parseDateTime(body?.startAt)
    const endAt = parseDateTime(body?.endAt)
    const note = typeof body?.note === 'string' && body.note.trim() ? body.note.trim() : null

    if (!startAt || !endAt) {
      return NextResponse.json({ ok: false, error: '請提供有效的開始與結束時間。' }, { status: 400 })
    }

    if (endAt <= startAt) {
      return NextResponse.json({ ok: false, error: '結束時間必須晚於開始時間。' }, { status: 400 })
    }

    const { data, error } = await auth.supabase
      .from('consultation_availability_slots')
      .insert({
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        note,
        is_available: true,
      })
      .select(SLOT_COLUMNS)
      .single()

    if (error) {
      console.error('Failed to create consultation availability slot', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })
      return NextResponse.json({ ok: false, error: '新增預約時段失敗。' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, slot: data })
  } catch (error) {
    console.error('Unexpected booking slot create error', error)
    return NextResponse.json({ ok: false, error: '新增預約時段失敗。' }, { status: 500 })
  }
}
