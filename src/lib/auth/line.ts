import 'server-only'

import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import type { User } from '@supabase/supabase-js'
import type { UserProfile } from './types'
import { getSupabaseAdmin } from '../supabase/admin'

export const LINE_STATE_COOKIE = 'waterbottle_line_state'
export const LINE_NONCE_COOKIE = 'waterbottle_line_nonce'
export const LINE_NEXT_COOKIE = 'waterbottle_line_next'
export const LINE_SESSION_COOKIE = 'waterbottle_line_session'

const LINE_AUTHORIZE_URL = 'https://access.line.me/oauth2/v2.1/authorize'
const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token'
const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify'
const LINE_PROFILE_URL = 'https://api.line.me/v2/profile'

type LineTokenResponse = {
  access_token: string
  expires_in?: number
  id_token?: string
  refresh_token?: string
  scope?: string
  token_type?: string
}

type LineIdTokenPayload = {
  sub: string
  name?: string
  picture?: string
  email?: string
  nonce?: string
}

type LineApiProfile = {
  userId: string
  displayName?: string
  pictureUrl?: string
}

function readEnv(keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim()
    if (value) return value
  }

  return ''
}

function getLineConfig() {
  const channelId = readEnv([
    'LINE_LOGIN_CHANNEL_ID',
    'NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID',
    'LINE_CHANNEL_ID',
  ])
  const channelSecret = readEnv(['LINE_LOGIN_CHANNEL_SECRET', 'LINE_CHANNEL_SECRET'])

  if (!channelId || !channelSecret) {
    throw new Error('LINE 登入環境變數尚未設定完整')
  }

  return { channelId, channelSecret }
}

function getLineSessionSecret() {
  return readEnv([
    'LINE_SESSION_SECRET',
    'SUPABASE_SERVICE_ROLE_KEY',
    'LINE_LOGIN_CHANNEL_SECRET',
    'LINE_CHANNEL_SECRET',
  ])
}

export function sanitizeNextPath(next: string | null | undefined) {
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

function makeRandomToken() {
  return randomBytes(24).toString('hex')
}

export function buildLineAuthorizeUrl({
  redirectUri,
  next,
}: {
  redirectUri: string
  next?: string | null
}) {
  const { channelId } = getLineConfig()
  const state = makeRandomToken()
  const nonce = makeRandomToken()
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: channelId,
    redirect_uri: redirectUri,
    state,
    scope: 'openid profile',
    nonce,
  })

  return {
    url: `${LINE_AUTHORIZE_URL}?${params.toString()}`,
    state,
    nonce,
    next: sanitizeNextPath(next),
  }
}

export async function exchangeLineCode({
  code,
  redirectUri,
}: {
  code: string
  redirectUri: string
}) {
  const { channelId, channelSecret } = getLineConfig()
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: channelId,
    client_secret: channelSecret,
  })

  const response = await fetch(LINE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    throw new Error(`LINE token 換取失敗：${await response.text()}`)
  }

  const tokens = (await response.json()) as LineTokenResponse
  if (!tokens.access_token) throw new Error('LINE 沒有回傳 access token')

  return tokens
}

export async function verifyLineIdToken(idToken: string) {
  const { channelId } = getLineConfig()
  const response = await fetch(LINE_VERIFY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: channelId,
    }),
  })

  if (!response.ok) {
    throw new Error(`LINE ID token 驗證失敗：${await response.text()}`)
  }

  const payload = (await response.json()) as LineIdTokenPayload
  if (!payload.sub) throw new Error('LINE ID token 沒有會員 ID')

  return payload
}

export async function fetchLineProfile(accessToken: string) {
  const response = await fetch(LINE_PROFILE_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`LINE 會員資料取得失敗：${await response.text()}`)
  }

  const profile = (await response.json()) as LineApiProfile
  if (!profile.userId) throw new Error('LINE 沒有回傳會員 ID')

  return profile
}

function displayNameFallback(value?: string) {
  return value?.trim() || 'LINE 會員'
}

function syntheticLineEmail(lineUserId: string) {
  return `line-${lineUserId}@line.tsu-waterbottle.local`
}

function isSameLineUser(user: User, lineUserId: string, email: string) {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
  return metadata.line_user_id === lineUserId || user.email === email
}

export async function upsertLineSupabaseUser({
  lineUserId,
  displayName,
  avatarUrl,
}: {
  lineUserId: string
  displayName?: string
  avatarUrl?: string
}) {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const email = syntheticLineEmail(lineUserId)
  const name = displayNameFallback(displayName)
  const metadata = {
    provider: 'line',
    line_user_id: lineUserId,
    full_name: name,
    name,
    avatar_url: avatarUrl ?? '',
    picture: avatarUrl ?? '',
  }

  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })

  if (listError) throw new Error(`查詢會員失敗：${listError.message}`)

  const existing = usersData.users.find((user) => isSameLineUser(user, lineUserId, email))
  let authUser: User | undefined

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      user_metadata: metadata,
    })

    if (error) throw new Error(`更新 LINE 會員失敗：${error.message}`)
    authUser = data.user ?? existing
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: metadata,
    })

    if (error) throw new Error(`建立 LINE 會員失敗：${error.message}`)
    authUser = data.user ?? undefined
  }

  if (!authUser) throw new Error('Supabase 沒有回傳會員資料')

  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: authUser.id,
      display_name: name,
      email: null,
      avatar_url: avatarUrl ?? '',
      line_user_id: lineUserId,
      updated_at: now,
    },
    { onConflict: 'id' },
  )

  if (profileError) {
    throw new Error(`儲存 LINE 會員資料失敗：${profileError.message}`)
  }

  return {
    id: authUser.id,
    provider: 'line',
    lineUserId,
    displayName: name,
    avatarUrl: avatarUrl ?? '',
    createdAt: authUser.created_at ?? now,
    lastLoginAt: now,
  } satisfies UserProfile
}

function toBase64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '=',
  )

  return Buffer.from(padded, 'base64')
}

function signPayload(payload: string) {
  const secret = getLineSessionSecret()
  if (!secret) throw new Error('LINE session secret 尚未設定')

  return toBase64Url(createHmac('sha256', secret).update(payload).digest())
}

export function createLineSessionCookieValue(user: UserProfile) {
  const payload = toBase64Url(JSON.stringify({ user, iat: Date.now() }))
  return `${payload}.${signPayload(payload)}`
}

export function readLineSessionCookieValue(value?: string | null) {
  if (!value) return null

  const [payload, signature] = value.split('.')
  if (!payload || !signature) return null

  let expected: Buffer
  let provided: Buffer
  try {
    expected = fromBase64Url(signPayload(payload))
    provided = fromBase64Url(signature)
  } catch {
    return null
  }

  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return null
  }

  try {
    const parsed = JSON.parse(fromBase64Url(payload).toString('utf8')) as {
      user?: UserProfile
    }

    return parsed.user?.provider === 'line' ? parsed.user : null
  } catch {
    return null
  }
}
