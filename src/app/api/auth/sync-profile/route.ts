import { NextResponse } from 'next/server'
import { getSupabaseAdmin, hasSupabaseAdminConfig } from '@/lib/supabase/admin'

type UserMetadata = Record<string, unknown>

function metadataText(metadata: UserMetadata, keys: string[]) {
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === 'string' && value.trim()) return value
  }

  return null
}

export async function POST(req: Request) {
  if (!hasSupabaseAdminConfig()) {
    return NextResponse.json({ ok: false, message: 'Supabase 管理端尚未設定' }, { status: 500 })
  }

  const authorization = req.headers.get('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : ''

  if (!token) {
    return NextResponse.json({ ok: false, message: '尚未登入' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    return NextResponse.json({ ok: false, message: '登入狀態已失效，請重新登入' }, { status: 401 })
  }

  const user = data.user
  const userMetadata = (user.user_metadata ?? {}) as UserMetadata
  const appMetadata = (user.app_metadata ?? {}) as UserMetadata
  const provider = appMetadata.provider === 'line' ? 'line' : 'google'
  const displayName =
    metadataText(userMetadata, ['full_name', 'name', 'display_name']) ??
    user.email ??
    (provider === 'line' ? 'LINE 會員' : 'Google 會員')
  const avatarUrl = metadataText(userMetadata, ['avatar_url', 'picture'])
  const lineUserId =
    provider === 'line' ? metadataText(userMetadata, ['provider_id', 'sub']) ?? user.id : null

  const { error: upsertError } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      display_name: displayName,
      email: user.email ?? null,
      avatar_url: avatarUrl,
      line_user_id: lineUserId,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'id' }
  )

  if (upsertError) {
    return NextResponse.json({ ok: false, message: upsertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
