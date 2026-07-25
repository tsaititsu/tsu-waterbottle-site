import { NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/auth/admin'

const SLOT_COLUMNS = 'id,start_at,end_at,is_available,note,created_at,updated_at'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminUser(request)
    if ('error' in auth) return auth.error

    const { id } = await context.params
    const body = (await request.json().catch(() => null)) as {
      isAvailable?: unknown
      note?: unknown
    } | null

    const updates: { is_available?: boolean; note?: string | null } = {}

    if (typeof body?.isAvailable === 'boolean') {
      updates.is_available = body.isAvailable
    }

    if (typeof body?.note === 'string') {
      updates.note = body.note.trim() ? body.note.trim() : null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: false, error: '沒有可更新的欄位。' }, { status: 400 })
    }

    const { data, error } = await auth.supabase
      .from('consultation_availability_slots')
      .update(updates)
      .eq('id', id)
      .select(SLOT_COLUMNS)
      .single()

    if (error) {
      console.error('Failed to update consultation availability slot', {
        code: error.code,
      })
      return NextResponse.json({ ok: false, error: '更新預約時段失敗。' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, slot: data })
  } catch {
    console.error('Unexpected booking slot update error')
    return NextResponse.json({ ok: false, error: '更新預約時段失敗。' }, { status: 500 })
  }
}
