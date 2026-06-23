import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { getSupabaseAdmin, hasSupabaseAdminConfig } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const LINE_PKCE_COOKIE = 'waterbottle_line_pkce_code_verifier'

type MetadataRecord = Record<string, unknown>

type SupabaseIdentity = {
  id?: string | null
  provider?: string | null
  identity_data?: MetadataRecord | null
}

function supabaseStorageKey() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase 前台環境變數尚未設定完整')
  }

  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  return `sb-${projectRef}-auth-token`
}

function getCallbackSupabaseClient(request: NextRequest, response: NextResponse) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase 前台環境變數尚未設定完整')
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      flowType: 'pkce',
      persistSession: true,
    },
    cookies: {
      getAll() {
        const cookies = request.cookies.getAll()
        const lineCodeVerifier = request.cookies.get(LINE_PKCE_COOKIE)?.value

        if (lineCodeVerifier && !cookies.some((cookie) => cookie.name === `${supabaseStorageKey()}-code-verifier`)) {
          let codeVerifier = lineCodeVerifier
          try {
            codeVerifier = decodeURIComponent(lineCodeVerifier)
          } catch {}

          cookies.push({
            name: `${supabaseStorageKey()}-code-verifier`,
            value: codeVerifier,
          })
        }

        return cookies
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value)
        })
      },
    },
  })
}

function sanitizeNextPath(next: string | null | undefined) {
  if (!next) return '/account'

  let decoded: string
  try {
    decoded = decodeURIComponent(next)
  } catch {
    return '/account'
  }

  if (!decoded.startsWith('/') || decoded.startsWith('//')) return '/account'
  return decoded
}

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

function lineIdentityFromUser(user: User) {
  return identityList(user).find((identity) => identity.provider?.includes('line'))
}

function providerFromUser(user: User): 'line' | 'google' {
  const appMetadata = (user.app_metadata ?? {}) as MetadataRecord
  const providers = Array.isArray(appMetadata.providers) ? appMetadata.providers : []

  if (typeof appMetadata.provider === 'string' && appMetadata.provider.includes('line')) return 'line'
  if (providers.some((provider) => typeof provider === 'string' && provider.includes('line'))) return 'line'
  return lineIdentityFromUser(user) ? 'line' : 'google'
}

function lineUserIdFromUser(user: User) {
  const lineIdentity = lineIdentityFromUser(user)
  const identityData = lineIdentity?.identity_data
  const sub = metadataText(identityData, ['sub'])

  if (sub) return sub

  const metadataId = metadataText((user.user_metadata ?? {}) as MetadataRecord, [
    'line_user_id',
    'provider_id',
    'sub',
    'user_id',
    'userId',
  ])

  return metadataId ?? lineIdentity?.id ?? null
}

async function syncProfile(user: User) {
  if (!hasSupabaseAdminConfig()) {
    throw new Error('Supabase 管理端尚未設定')
  }

  const supabase = getSupabaseAdmin()
  const userMetadata = (user.user_metadata ?? {}) as MetadataRecord
  const provider = providerFromUser(user)
  const displayName =
    metadataText(userMetadata, ['full_name', 'name', 'display_name', 'preferred_username']) ??
    user.email ??
    (provider === 'line' ? 'LINE 會員' : 'Google 會員')
  const avatarUrl = metadataText(userMetadata, ['avatar_url', 'picture'])
  const lineUserId = provider === 'line' ? lineUserIdFromUser(user) : null

  const { error } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      display_name: displayName,
      email: user.email ?? null,
      avatar_url: avatarUrl,
      line_user_id: lineUserId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )

  if (error) throw new Error(error.message)
}

function redirectWithError(request: NextRequest, message: string) {
  const url = new URL('/account', request.nextUrl.origin)
  url.searchParams.set('auth_error', message)
  const response = NextResponse.redirect(url)
  response.cookies.set(LINE_PKCE_COOKIE, '', { path: '/', maxAge: 0 })

  return response
}

export async function GET(request: NextRequest) {
  const oauthError = request.nextUrl.searchParams.get('error_description') || request.nextUrl.searchParams.get('error')
  if (oauthError) return redirectWithError(request, oauthError)

  const code = request.nextUrl.searchParams.get('code')
  if (!code) return redirectWithError(request, '登入連結已失效，請重新登入。')

  try {
    const nextPath = sanitizeNextPath(request.nextUrl.searchParams.get('next'))
    const response = NextResponse.redirect(new URL(nextPath, request.nextUrl.origin))
    response.cookies.set(LINE_PKCE_COOKIE, '', { path: '/', maxAge: 0 })

    const supabase = getCallbackSupabaseClient(request, response)
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) throw error

    const user = data.user
    if (!user || !data.session) throw new Error('Supabase 沒有回傳登入狀態')

    await syncProfile(user)

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : '登入失敗，請重新登入。'
    return redirectWithError(request, message)
  }
}
