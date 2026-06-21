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
