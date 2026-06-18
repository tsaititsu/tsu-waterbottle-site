import { getBookingPlan } from '@/lib/bookingPlans'
import type { BookingFormInput, BookingRecord, BookingStatus } from '@/lib/mockBooking'
import { getSupabaseAdmin, hasSupabaseAdminConfig } from './admin'

type BookingRow = {
  id: string
  user_id: string | null
  plan_id: string | null
  plan_name: string
  amount_twd: number
  currency: 'TWD'
  status: BookingStatus
  payment_status: string
  customer_name: string
  customer_email: string
  customer_phone: string | null
  line_display_name: string | null
  gender: BookingFormInput['gender']
  birth_date: string
  birth_time: string
  birth_place: string | null
  is_birth_time_accurate: boolean
  question: string
  note: string | null
  starts_at: string
  ends_at: string
  timezone: 'Asia/Taipei'
  google_calendar_event_id: string | null
  google_calendar_event_link: string | null
  google_calendar_cancelled: boolean
  confirmation_email_sent_to_customer: boolean
  confirmation_email_sent_to_admin: boolean
  cancellation_email_sent_to_customer: boolean
  cancellation_email_sent_to_admin: boolean
  cancelled_at: string | null
  cancellation_reason: string | null
  created_at: string
  updated_at: string
}

function normalizeBirthTime(value: string) {
  return value.length === 5 ? `${value}:00` : value
}

export function mapBookingRow(row: BookingRow): BookingRecord {
  return {
    id: row.id,
    userId: row.user_id ?? 'supabase',
    planId: row.plan_id ?? '',
    planName: row.plan_name,
    durationMinutes: getBookingPlan(row.plan_id ?? '')?.durationMinutes ?? 60,
    amount: row.amount_twd,
    currency: row.currency,
    timezone: row.timezone,
    status: row.status,
    startTime: row.starts_at,
    endTime: row.ends_at,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone ?? undefined,
    lineDisplayName: row.line_display_name ?? undefined,
    gender: row.gender,
    birthDate: row.birth_date,
    birthTime: row.birth_time.slice(0, 5),
    birthPlace: row.birth_place ?? undefined,
    isBirthTimeAccurate: row.is_birth_time_accurate,
    question: row.question,
    note: row.note ?? undefined,
    googleCalendarEventId: row.google_calendar_event_id ?? undefined,
    googleCalendarEventLink: row.google_calendar_event_link ?? undefined,
    googleCalendarCancelled: row.google_calendar_cancelled,
    emailSentToCustomer: row.confirmation_email_sent_to_customer,
    emailSentToAdmin: row.confirmation_email_sent_to_admin,
    cancellationEmailSentToCustomer: row.cancellation_email_sent_to_customer,
    cancellationEmailSentToAdmin: row.cancellation_email_sent_to_admin,
    cancelledAt: row.cancelled_at ?? undefined,
    cancellationReason: row.cancellation_reason ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export async function createSupabaseBooking(input: BookingFormInput) {
  if (!hasSupabaseAdminConfig()) return null

  const plan = getBookingPlan(input.planId)
  if (!plan) throw new Error('方案不存在')

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      plan_id: input.planId,
      user_id: input.userId ?? null,
      plan_name: plan.name,
      amount_twd: plan.price,
      currency: 'TWD',
      status: 'pending_payment',
      payment_status: 'pending',
      customer_name: input.customerName,
      customer_email: input.customerEmail,
      customer_phone: input.customerPhone ?? null,
      line_display_name: input.lineDisplayName ?? null,
      gender: input.gender,
      birth_date: input.birthDate,
      birth_time: normalizeBirthTime(input.birthTime),
      birth_place: input.birthPlace ?? null,
      is_birth_time_accurate: input.isBirthTimeAccurate,
      question: input.question,
      note: input.note ?? null,
      starts_at: input.startTime,
      ends_at: input.endTime,
      timezone: 'Asia/Taipei',
      accepted_notice_at: new Date().toISOString()
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return mapBookingRow(data as BookingRow)
}

export async function listSupabaseBookings(userId?: string) {
  if (!hasSupabaseAdminConfig()) return []

  const supabase = getSupabaseAdmin()
  let query = supabase
    .from('bookings')
    .select('*')
    .order('starts_at', { ascending: false })
    .limit(100)

  if (userId) {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)
  return (data as BookingRow[]).map(mapBookingRow)
}

export async function getSupabaseBooking(bookingId: string) {
  if (!hasSupabaseAdminConfig()) return null

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapBookingRow(data as BookingRow) : null
}

export async function updateSupabaseBooking(bookingId: string, updates: Partial<BookingRecord>) {
  if (!hasSupabaseAdminConfig()) return null

  const patch: Record<string, unknown> = {}
  if (updates.status) patch.status = updates.status
  if (updates.paymentId) {
    patch.payment_status = 'paid'
    patch.status = updates.status ?? 'confirmed'
  }
  if (updates.googleCalendarEventId !== undefined) patch.google_calendar_event_id = updates.googleCalendarEventId
  if (updates.googleCalendarEventLink !== undefined) patch.google_calendar_event_link = updates.googleCalendarEventLink
  if (updates.googleCalendarCancelled !== undefined) patch.google_calendar_cancelled = updates.googleCalendarCancelled
  if (updates.emailSentToCustomer !== undefined) patch.confirmation_email_sent_to_customer = updates.emailSentToCustomer
  if (updates.emailSentToAdmin !== undefined) patch.confirmation_email_sent_to_admin = updates.emailSentToAdmin
  if (updates.cancellationEmailSentToCustomer !== undefined) patch.cancellation_email_sent_to_customer = updates.cancellationEmailSentToCustomer
  if (updates.cancellationEmailSentToAdmin !== undefined) patch.cancellation_email_sent_to_admin = updates.cancellationEmailSentToAdmin
  if (updates.cancelledAt !== undefined) patch.cancelled_at = updates.cancelledAt
  if (updates.cancellationReason !== undefined) patch.cancellation_reason = updates.cancellationReason

  if (Object.keys(patch).length === 0) return getSupabaseBooking(bookingId)

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('bookings').update(patch).eq('id', bookingId).select('*').single()

  if (error) throw new Error(error.message)
  return mapBookingRow(data as BookingRow)
}
