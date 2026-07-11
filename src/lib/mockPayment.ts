'use client'

import { getMockUser } from './mockAuth'
import type { ChartInput } from '@/features/ziwei-chart/package'

export type ChartOrderInput = ChartInput & {
  category?: string
  birthOrder?: string
  analysisTitle?: string
}

export type PaymentRecord = {
  id: string
  resultId?: string
  bookingId?: string
  userId: string
  itemType: 'ai-chart' | 'ai-divination' | 'booking' | 'course'
  itemName: string
  amount: number
  currency: 'TWD'
  status: 'paid' | 'failed' | 'pending'
  createdAt: string
  paidAt?: string
}

const PAYMENT_KEY = 'waterbottle_mock_payments'
const WAITLIST_KEY = 'waterbottle_course_waitlist'
const PENDING_CHART_INPUT_KEY = 'waterbottle_pending_chart_input'

export function getPaymentRecords(): PaymentRecord[] {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(PAYMENT_KEY)
  if (!raw) return []

  try {
    return JSON.parse(raw) as PaymentRecord[]
  } catch {
    window.localStorage.removeItem(PAYMENT_KEY)
    return []
  }
}

export function savePendingChartInput(input: ChartOrderInput) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PENDING_CHART_INPUT_KEY, JSON.stringify(input))
}

export function getPendingChartInput(): ChartOrderInput | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(PENDING_CHART_INPUT_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as ChartOrderInput
  } catch {
    window.localStorage.removeItem(PENDING_CHART_INPUT_KEY)
    return null
  }
}

export function clearPendingChartInput() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(PENDING_CHART_INPUT_KEY)
}

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
