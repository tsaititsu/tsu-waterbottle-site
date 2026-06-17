'use client'

import { getMockUser } from './mockAuth'
import { confirmPendingBooking } from './mockBooking'
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
const RECORD_KEY = 'waterbottle_mock_records'
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

export function createMockPayment(item: Omit<PaymentRecord, 'id' | 'userId' | 'currency' | 'status' | 'createdAt' | 'paidAt'>) {
  const user = getMockUser()
  if (!user) return null

  const now = new Date().toISOString()
  const paymentId = `pay-${Date.now()}`
  const resultId = item.itemType === 'ai-chart' ? `result-${paymentId}` : undefined
  const booking = item.itemType === 'booking' ? confirmPendingBooking(paymentId) : null
  const payment: PaymentRecord = {
    id: paymentId,
    resultId,
    bookingId: booking?.id,
    userId: user.id,
    itemType: item.itemType,
    itemName: item.itemName,
    amount: item.amount,
    currency: 'TWD',
    status: 'paid',
    createdAt: now,
    paidAt: now
  }

  const payments = [payment, ...getPaymentRecords()]
  window.localStorage.setItem(PAYMENT_KEY, JSON.stringify(payments))
  appendMockRecord(payment, item.itemType === 'ai-chart' ? getPendingChartInput() : null)
  if (item.itemType === 'ai-chart') clearPendingChartInput()
  return payment
}

export function appendMockRecord(payment: PaymentRecord, chartInput?: ChartOrderInput | null) {
  if (typeof window === 'undefined') return
  const raw = window.localStorage.getItem(RECORD_KEY)
  const records = raw ? JSON.parse(raw) : []
  records.unshift({
    id: payment.resultId ?? `record-${Date.now()}`,
    paymentId: payment.id,
    amount: payment.amount,
    type: payment.itemType,
    title: payment.itemName,
    createdAt: payment.paidAt,
    summary: getResultSummary(payment.itemType),
    ...(chartInput && { chartInput })
  })
  window.localStorage.setItem(RECORD_KEY, JSON.stringify(records))
}

export type MockResultRecord = {
  id: string
  paymentId?: string
  amount?: number
  type: PaymentRecord['itemType']
  title: string
  createdAt?: string
  summary: string
  chartInput?: ChartOrderInput
}

export function getMockRecords(): MockResultRecord[] {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(RECORD_KEY)
  if (!raw) return []

  try {
    return JSON.parse(raw) as MockResultRecord[]
  } catch {
    window.localStorage.removeItem(RECORD_KEY)
    return []
  }
}

export function getMockRecordById(id: string) {
  return getMockRecords().find((record) => record.id === id)
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

function getResultSummary(type: PaymentRecord['itemType']) {
  const summaries = {
    'ai-chart': '已產生紫微命盤與 AI 分析報告',
    'ai-divination': '已產生占卜指引與行動建議',
    booking: '已建立水瓶先生論命預約',
    course: '已加入紫微課程候補名單'
  }

  return summaries[type]
}
