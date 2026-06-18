'use client'

import type { User } from '@supabase/supabase-js'
import { getSupabaseBrowserClient, hasSupabaseBrowserConfig } from './supabase/client'

export type UserProfile = {
  id: string
  provider: 'line' | 'google'
  lineUserId?: string
  googleEmail?: string
  displayName?: string
  avatarUrl?: string
  createdAt: string
  lastLoginAt: string
}

const LEGACY_USER_KEY = 'waterbottle_mock_user'
const AUTH_CHANGE_EVENT = 'waterbottle-auth-change'

let cachedUser: UserProfile | null = null
let initialized = false

function notifyAuthChange() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT))
}

function providerFromUser(user: User): UserProfile['provider'] {
  return user.app_metadata.provider === 'line' ? 'line' : 'google'
}

function profileFromSupabaseUser(user: User): UserProfile {
  const provider = providerFromUser(user)
  const displayName =
    user.user_metadata.full_name ||
    user.user_metadata.name ||
    user.user_metadata.display_name ||
    user.email ||
    (provider === 'line' ? 'LINE 會員' : 'Google 會員')

  return {
    id: user.id,
    provider,
    lineUserId: provider === 'line' ? String(user.user_metadata.provider_id || user.user_metadata.sub || user.id) : undefined,
    googleEmail: user.email ?? undefined,
    displayName,
    avatarUrl: user.user_metadata.avatar_url || user.user_metadata.picture || '',
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

export async function refreshAuthUser() {
  if (typeof window === 'undefined' || !hasSupabaseBrowserConfig()) return cachedUser

  try {
    const supabase = getSupabaseBrowserClient()
    const { data } = await supabase.auth.getUser()
    cachedUser = data.user ? profileFromSupabaseUser(data.user) : null
  } catch {
    cachedUser = null
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
  if (initialized || typeof window === 'undefined' || !hasSupabaseBrowserConfig()) return
  initialized = true

  const supabase = getSupabaseBrowserClient()
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cachedUser = session?.user ? profileFromSupabaseUser(session.user) : null
    notifyAuthChange()
  })
  // Keep one shared auth listener for the whole tab; pages mount/unmount independently.
  void data.subscription
  void refreshAuthUser()
}

export function getMockUser(): UserProfile | null {
  ensureAuthListener()
  return cachedUser ?? getLegacyMockUser()
}

export async function loginWithProvider(provider: 'line' | 'google') {
  if (!hasSupabaseBrowserConfig()) {
    throw new Error('Supabase 登入尚未設定完成')
  }

  const supabase = getSupabaseBrowserClient()
  const currentPath = `${window.location.pathname}${window.location.search}`
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(currentPath || '/account')}`

  const { error } = await supabase.auth.signInWithOAuth({
    provider: provider as 'google',
    options: {
      redirectTo
    }
  })

  if (error) throw error
}

export function logoutMockUser() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(LEGACY_USER_KEY)
  cachedUser = null
  notifyAuthChange()

  if (hasSupabaseBrowserConfig()) {
    void getSupabaseBrowserClient().auth.signOut().finally(() => {
      cachedUser = null
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
