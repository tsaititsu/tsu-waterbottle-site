'use client'

import type { User } from '@supabase/supabase-js'
import type { UserProfile } from './auth/types'
import { getSupabaseBrowserClient, hasSupabaseBrowserConfig } from './supabase/client'

export type { UserProfile } from './auth/types'

const LEGACY_USER_KEY = 'waterbottle_mock_user'
const AUTH_CHANGE_EVENT = 'waterbottle-auth-change'

let cachedUser: UserProfile | null = null
let initialized = false
const syncedProfileUserIds = new Set<string>()

function notifyAuthChange() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT))
}

type MetadataRecord = Record<string, unknown>

type SupabaseIdentity = {
  id?: string | null
  provider?: string | null
  identity_data?: MetadataRecord | null
}

function metadataText(metadata: MetadataRecord | null | undefined, keys: string[]) {
  if (!metadata) return undefined

  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === 'string' && value.trim()) return value
  }

  return undefined
}

function identityList(user: Pick<User, 'identities'>) {
  return Array.isArray(user.identities) ? (user.identities as SupabaseIdentity[]) : []
}

function isLineProvider(value: unknown) {
  return (
    typeof value === 'string' &&
    ['line', 'custom:line'].includes(value)
  )
}

function providerFromUser(user: User): UserProfile['provider'] {
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

function profileFromSupabaseUser(user: User): UserProfile {
  const provider = providerFromUser(user)
  const userMetadata = (user.user_metadata ?? {}) as MetadataRecord
  const displayName =
    metadataText(userMetadata, ['full_name', 'name', 'display_name', 'preferred_username']) ||
    user.email ||
    (provider === 'line' ? 'LINE 會員' : 'Google 會員')

  return {
    id: user.id,
    provider,
    lineUserId: provider === 'line' ? lineUserIdFromUser(user) : undefined,
    googleEmail: user.email ?? undefined,
    displayName,
    avatarUrl: metadataText(userMetadata, ['avatar_url', 'picture']) || '',
    createdAt: user.created_at,
    lastLoginAt: new Date().toISOString()
  }
}

function getLegacyMockUser(): UserProfile | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(LEGACY_USER_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as UserProfile
  } catch {
    window.localStorage.removeItem(LEGACY_USER_KEY)
    return null
  }
}

async function fetchLineSessionUser() {
  if (typeof window === 'undefined') return null

  try {
    const response = await fetch('/api/auth/line/session', { cache: 'no-store' })
    if (!response.ok) return null

    const data = (await response.json()) as { user?: UserProfile | null }
    return data.user ?? null
  } catch {
    return null
  }
}

async function syncProfileToServer() {
  if (typeof window === 'undefined' || !hasSupabaseBrowserConfig()) return

  let userId: string | undefined

  try {
    const supabase = getSupabaseBrowserClient()
    const { data } = await supabase.auth.getSession()
    const session = data.session
    userId = session?.user.id
    const accessToken = session?.access_token

    if (!userId || !accessToken || syncedProfileUserIds.has(userId)) return

    syncedProfileUserIds.add(userId)

    const response = await fetch('/api/auth/sync-profile', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      syncedProfileUserIds.delete(userId)
    }
  } catch {
    if (userId) syncedProfileUserIds.delete(userId)
  }
}

export async function refreshAuthUser() {
  if (typeof window === 'undefined') return cachedUser

  if (hasSupabaseBrowserConfig()) {
    try {
      const supabase = getSupabaseBrowserClient()
      const { data } = await supabase.auth.getUser()

      if (data.user) {
        cachedUser = profileFromSupabaseUser(data.user)
        void syncProfileToServer()
        notifyAuthChange()
        return cachedUser
      }
    } catch {
      // Continue to the direct LINE session below.
    }
  }

  cachedUser = await fetchLineSessionUser()
  if (!cachedUser) {
    syncedProfileUserIds.clear()
  }

  notifyAuthChange()
  return cachedUser
}

export async function getAuthAccessToken() {
  if (typeof window === 'undefined' || !hasSupabaseBrowserConfig()) return null

  const supabase = getSupabaseBrowserClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

function ensureAuthListener() {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  if (hasSupabaseBrowserConfig()) {
    const supabase = getSupabaseBrowserClient()
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        cachedUser = profileFromSupabaseUser(session.user)
        void syncProfileToServer()
        notifyAuthChange()
        return
      }

      void refreshAuthUser()
    })
    // Keep one shared auth listener for the whole tab; pages mount/unmount independently.
    void data.subscription
  }

  void refreshAuthUser()
}

export function getMockUser(): UserProfile | null {
  ensureAuthListener()
  return cachedUser ?? getLegacyMockUser()
}

export async function loginWithProvider(provider: 'line' | 'google') {
  const currentPath = `${window.location.pathname}${window.location.search}`
  const next = encodeURIComponent(currentPath || '/account')

  if (provider === 'line') {
    if (hasSupabaseBrowserConfig()) {
      await getSupabaseBrowserClient().auth.signOut()
    }

    window.location.assign(`/api/auth/line/start?next=${next}`)
    return
  }

  if (!hasSupabaseBrowserConfig()) {
    throw new Error('Supabase 登入尚未設定完成')
  }

  const supabase = getSupabaseBrowserClient()
  const redirectTo = `${window.location.origin}/auth/callback?next=${next}`

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })

  if (error) throw error
}

export function logoutMockUser() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(LEGACY_USER_KEY)
  cachedUser = null
  syncedProfileUserIds.clear()
  notifyAuthChange()

  void fetch('/api/auth/line/logout', { method: 'POST' }).finally(() => {
    cachedUser = null
    syncedProfileUserIds.clear()
    notifyAuthChange()
  })

  if (hasSupabaseBrowserConfig()) {
    void getSupabaseBrowserClient().auth.signOut().finally(() => {
      cachedUser = null
      syncedProfileUserIds.clear()
      notifyAuthChange()
    })
  }
}

export function subscribeAuthChange(callback: () => void) {
  ensureAuthListener()
  window.addEventListener(AUTH_CHANGE_EVENT, callback)
  window.addEventListener('storage', callback)

  return () => {
    window.removeEventListener(AUTH_CHANGE_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}
