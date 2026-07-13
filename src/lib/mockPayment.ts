'use client'

import { getMockUser } from './mockAuth'

const WAITLIST_KEY = 'waterbottle_course_waitlist'

export function joinCourseWaitlist() {
  const user = getMockUser()
  if (!user || typeof window === 'undefined') return false
  window.localStorage.setItem(WAITLIST_KEY, JSON.stringify({ userId: user.id, joinedAt: new Date().toISOString() }))
  return true
}

export function hasJoinedWaitlist() {
  if (typeof window === 'undefined') return false
  return Boolean(window.localStorage.getItem(WAITLIST_KEY))
}
