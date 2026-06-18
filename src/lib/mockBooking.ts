'use client'

import { getMockUser } from './mockAuth'
import { getBookingPlan } from './bookingPlans'

export type BookingStatus = 'pending_payment' | 'paid' | 'confirmed' | 'cancelled' | 'failed'

export type BookingFormInput = {
  userId?: string
  planId: string
  startTime: string
  endTime: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  lineDisplayName?: string
  gender: 'male' | 'female' | 'other'
  birthDate: string
  birthTime: string
  birthPlace?: string
  isBirthTimeAccurate: boolean
  question: string
  note?: string
}

export type BookingRecord = BookingFormInput & {
  id: string
  userId: string
  planName: string
  durationMinutes: number
  amount: number
  currency: 'TWD'
  timezone: 'Asia/Taipei'
  status: BookingStatus
  paymentId?: string
  googleCalendarEventId?: string
  googleCalendarEventLink?: string
  googleCalendarCancelled?: boolean
  emailSentToCustomer: boolean
  emailSentToAdmin: boolean
  cancellationEmailSentToCustomer?: boolean
  cancellationEmailSentToAdmin?: boolean
  cancelledAt?: string
  cancellationReason?: string
  createdAt: string
  updatedAt: string
}

const BOOKING_RECORDS_KEY = 'waterbottle_mock_bookings'
const PENDING_BOOKING_KEY = 'waterbottle_pending_booking'

export function getBookingRecords(): BookingRecord[] {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(BOOKING_RECORDS_KEY)
  if (!raw) return []

  try {
    return JSON.parse(raw) as BookingRecord[]
  } catch {
    window.localStorage.removeItem(BOOKING_RECORDS_KEY)
    return []
  }
}

export function getBookingById(id: string) {
  return getBookingRecords().find((booking) => booking.id === id)
}

export function getUserBookingRecords(): BookingRecord[] {
  const user = getMockUser()
  if (!user) return []
  return getBookingRecords().filter((booking) => booking.userId === user.id)
}

export function savePendingBooking(input: BookingFormInput, forcedId?: string) {
  const user = getMockUser()
  const plan = getBookingPlan(input.planId)
  if (!user || !plan || typeof window === 'undefined') return null

  const now = new Date().toISOString()
  const pending: BookingRecord = {
    ...input,
    id: forcedId ?? `booking-${Date.now()}`,
    userId: user.id,
    planName: plan.name,
    durationMinutes: plan.durationMinutes,
    amount: plan.price,
    currency: 'TWD',
    timezone: 'Asia/Taipei',
    status: 'pending_payment',
    emailSentToCustomer: false,
    emailSentToAdmin: false,
    createdAt: now,
    updatedAt: now
  }

  window.localStorage.setItem(PENDING_BOOKING_KEY, JSON.stringify(pending))
  return pending
}

export function getPendingBooking(): BookingRecord | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(PENDING_BOOKING_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as BookingRecord
  } catch {
    window.localStorage.removeItem(PENDING_BOOKING_KEY)
    return null
  }
}

export function confirmPendingBooking(paymentId: string) {
  const pending = getPendingBooking()
  if (!pending || typeof window === 'undefined') return null

  const existing = getBookingRecords().find((booking) => booking.id === pending.id)
  if (existing?.status === 'confirmed') return existing

  const now = new Date().toISOString()
  const confirmed: BookingRecord = {
    ...pending,
    status: 'confirmed',
    paymentId,
    emailSentToCustomer: false,
    emailSentToAdmin: false,
    updatedAt: now
  }
  const others = getBookingRecords().filter((booking) => booking.id !== confirmed.id)

  window.localStorage.setItem(BOOKING_RECORDS_KEY, JSON.stringify([confirmed, ...others]))
  window.localStorage.removeItem(PENDING_BOOKING_KEY)
  window.dispatchEvent(new Event('mock-booking-change'))
  return confirmed
}

export function updateBookingRecord(bookingId: string, updates: Partial<BookingRecord>) {
  if (typeof window === 'undefined') return null

  const records = getBookingRecords()
  const existing = records.find((booking) => booking.id === bookingId)
  if (!existing) return null

  const updated: BookingRecord = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString()
  }
  const nextRecords = records.map((booking) => (booking.id === bookingId ? updated : booking))

  window.localStorage.setItem(BOOKING_RECORDS_KEY, JSON.stringify(nextRecords))
  window.dispatchEvent(new Event('mock-booking-change'))
  return updated
}

export function hasBookingConflict(startTime: string, endTime: string, excludeBookingId?: string) {
  const start = new Date(startTime).getTime()
  const end = new Date(endTime).getTime()

  return getBookingRecords().some((booking) => {
    if (booking.id === excludeBookingId) return false
    if (!['paid', 'confirmed'].includes(booking.status)) return false
    const bookingStart = new Date(booking.startTime).getTime()
    const bookingEnd = new Date(booking.endTime).getTime()
    return bookingStart < end && bookingEnd > start
  })
}

export function subscribeBookingChange(callback: () => void) {
  window.addEventListener('mock-booking-change', callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener('mock-booking-change', callback)
    window.removeEventListener('storage', callback)
  }
}
