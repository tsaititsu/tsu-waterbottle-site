import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { getSupabaseAdmin, hasSupabaseAdminConfig } from '@/lib/supabase/admin'

type MetadataRecord = Record<string, unknown>

type SupabaseIdentity = {
  id?: string | null
  provider?: string | null
  identity_data?: MetadataRecord | null
}

const LINE_OAUTH_PROVIDER =
  process.env.SUPABASE_LINE_PROVIDER?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_LINE_PROVIDER?.trim() ||
  'custom:line'

function metadataText(metadata: MetadataRecord | null | undefined, keys: string[]) {
  if (!metadata) return null

  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === 'string' && value.trim()) return value
  }

  return null
}

function identityList(user: Pick<User, 'identities'>) {
  return Array.isArray(user.identities) ? (user.identities as SupabaseIdentity[]) : []
}

function isLineProvider(value: unknown) {
  return (
    typeof value === 'string' &&
    ['line', 'custom:line', LINE_OAUTH_PROVIDER].includes(value)
  )
}

function providerFromUser(user: User): 'line' | 'google' {
  const appMetadata = (user.app_metadata ?? {}) as MetadataRecord
  const providers = Array.isArray(appMetadata.providers) ? appMetadata.providers : []

  if (isLineProvider(appMetadata.provider) || providers.some(isLineProvider)) return 'line'
  return identityList(user).some((identity) => isLineProvider(identity.provider)) ? 'line' : 'google'
}

function lineUserIdFromUser(user: User) {
  const userMetadata = (user.user_metadata ?? {}) as MetadataRecord
  const metadataId = metadataText(userMetadata, ['line_user_id', 'provider_id', 'sub', 'user_id', 'userId'])

  if (metadataId) return metadataId

  const lineIdentity = identityList(user).find((identity) => isLineProvider(identity.provider))
  return metadataText(lineIdentity?.identity_data, ['provider_id', 'sub', 'user_id', 'userId']) ?? lineIdentity?.id ?? user.id
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
  const userMetadata = (user.user_metadata ?? {}) as MetadataRecord
  const provider = providerFromUser(user)
  const displayName =
    metadataText(userMetadata, ['full_name', 'name', 'display_name', 'preferred_username']) ??
    user.email ??
    (provider === 'line' ? 'LINE 會員' : 'Google 會員')
  const avatarUrl = metadataText(userMetadata, ['avatar_url', 'picture'])
  const lineUserId = provider === 'line' ? lineUserIdFromUser(user) : null

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
