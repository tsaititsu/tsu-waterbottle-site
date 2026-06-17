'use client'

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

const USER_KEY = 'waterbottle_mock_user'

export function getMockUser(): UserProfile | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(USER_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as UserProfile
  } catch {
    window.localStorage.removeItem(USER_KEY)
    return null
  }
}

export function loginWithProvider(provider: 'line' | 'google'): UserProfile {
  const now = new Date().toISOString()
  const user: UserProfile = {
    id: `mock-${provider}-user`,
    provider,
    lineUserId: provider === 'line' ? 'line-waterbottle-001' : undefined,
    googleEmail: provider === 'google' ? 'member@waterbottle.example' : undefined,
    displayName: provider === 'line' ? 'LINE 會員' : 'Google 會員',
    avatarUrl: '',
    createdAt: now,
    lastLoginAt: now
  }

  window.localStorage.setItem(USER_KEY, JSON.stringify(user))
  window.dispatchEvent(new Event('mock-auth-change'))
  return user
}

export function logoutMockUser() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(USER_KEY)
  window.dispatchEvent(new Event('mock-auth-change'))
}

export function subscribeAuthChange(callback: () => void) {
  window.addEventListener('mock-auth-change', callback)
  window.addEventListener('storage', callback)

  return () => {
    window.removeEventListener('mock-auth-change', callback)
    window.removeEventListener('storage', callback)
  }
}
