export type BookingStatus = 'pending_payment' | 'paid' | 'confirmed' | 'cancelled' | 'failed'
export type BookingPaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded'

export const MEMBER_BOOKING_PAGE_SIZE = 20
export const MEMBER_BOOKING_MAX_PAGE_SIZE = 50

export type BookingFormInput = {
  userId?: string
  slotId?: string
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
  paymentStatus?: BookingPaymentStatus
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

export type BookingMemberListItem = Pick<
  BookingRecord,
  | 'id'
  | 'planName'
  | 'startTime'
  | 'endTime'
  | 'status'
  | 'paymentStatus'
  | 'question'
  | 'googleCalendarEventId'
  | 'googleCalendarCancelled'
  | 'emailSentToCustomer'
  | 'cancellationEmailSentToCustomer'
  | 'cancellationEmailSentToAdmin'
  | 'cancelledAt'
  | 'cancellationReason'
  | 'createdAt'
  | 'updatedAt'
>
