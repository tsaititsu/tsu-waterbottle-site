import { getBookingPlan } from '@/lib/bookingPlans'
import type {
  BookingFormInput,
  BookingMemberListItem,
  BookingPaymentStatus,
  BookingRecord,
  BookingStatus,
} from '@/lib/bookings/types'
import { MEMBER_BOOKING_MAX_PAGE_SIZE } from '@/lib/bookings/types'
import { readExactRecord } from '@/lib/contracts/exactRecord'
import { getSupabaseAdmin, hasSupabaseAdminConfig } from './admin'

type BookingRow = {
  id: string
  user_id: string | null
  plan_id: string | null
  plan_name: string
  amount_twd: number
  currency: 'TWD'
  status: BookingStatus
  payment_status: BookingPaymentStatus
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

const BOOKING_COLUMN_NAMES = [
  'id',
  'user_id',
  'plan_id',
  'plan_name',
  'amount_twd',
  'currency',
  'status',
  'payment_status',
  'customer_name',
  'customer_email',
  'customer_phone',
  'line_display_name',
  'gender',
  'birth_date',
  'birth_time',
  'birth_place',
  'is_birth_time_accurate',
  'question',
  'note',
  'starts_at',
  'ends_at',
  'timezone',
  'google_calendar_event_id',
  'google_calendar_event_link',
  'google_calendar_cancelled',
  'confirmation_email_sent_to_customer',
  'confirmation_email_sent_to_admin',
  'cancellation_email_sent_to_customer',
  'cancellation_email_sent_to_admin',
  'cancelled_at',
  'cancellation_reason',
  'created_at',
  'updated_at',
] as const
const BOOKING_COLUMNS = BOOKING_COLUMN_NAMES.join(',')
const MEMBER_BOOKING_COLUMN_NAMES = [
  'id',
  'plan_name',
  'status',
  'payment_status',
  'question',
  'starts_at',
  'ends_at',
  'google_calendar_event_id',
  'google_calendar_cancelled',
  'confirmation_email_sent_to_customer',
  'cancellation_email_sent_to_customer',
  'cancellation_email_sent_to_admin',
  'cancelled_at',
  'cancellation_reason',
  'created_at',
  'updated_at',
] as const
export const MEMBER_BOOKING_COLUMNS = MEMBER_BOOKING_COLUMN_NAMES.join(',')

type MemberBookingRow = {
  id: string
  plan_name: string
  status: BookingStatus
  payment_status: BookingPaymentStatus
  question: string
  starts_at: string
  ends_at: string
  google_calendar_event_id: string | null
  google_calendar_cancelled: boolean
  confirmation_email_sent_to_customer: boolean
  cancellation_email_sent_to_customer: boolean
  cancellation_email_sent_to_admin: boolean
  cancelled_at: string | null
  cancellation_reason: string | null
  created_at: string
  updated_at: string
}
const BOOKING_STATUS_VALUES = new Set<BookingStatus>([
  'pending_payment',
  'paid',
  'confirmed',
  'cancelled',
  'failed',
])
const BOOKING_GENDER_VALUES = new Set<BookingFormInput['gender']>([
  'male',
  'female',
  'other',
])
const BOOKING_PAYMENT_STATUS_VALUES = new Set<BookingPaymentStatus>([
  'pending',
  'paid',
  'failed',
  'cancelled',
  'refunded',
])
const DATABASE_SLOT_ID_PATTERN =
  /^db:([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i

const BOOKING_STRING_FIELDS = [
  'id',
  'plan_name',
  'currency',
  'status',
  'payment_status',
  'customer_name',
  'customer_email',
  'gender',
  'birth_date',
  'birth_time',
  'question',
  'starts_at',
  'ends_at',
  'timezone',
  'created_at',
  'updated_at',
] as const
const BOOKING_NULLABLE_STRING_FIELDS = [
  'user_id',
  'plan_id',
  'customer_phone',
  'line_display_name',
  'birth_place',
  'note',
  'google_calendar_event_id',
  'google_calendar_event_link',
  'cancelled_at',
  'cancellation_reason',
] as const
const BOOKING_BOOLEAN_FIELDS = [
  'is_birth_time_accurate',
  'google_calendar_cancelled',
  'confirmation_email_sent_to_customer',
  'confirmation_email_sent_to_admin',
  'cancellation_email_sent_to_customer',
  'cancellation_email_sent_to_admin',
] as const

export function readBookingRow(value: unknown): BookingRow {
  const row = readExactRecord(value, BOOKING_COLUMN_NAMES, 'booking_row')
  const mismatch = () => {
    throw new Error('booking_row_contract_mismatch')
  }

  for (const field of BOOKING_STRING_FIELDS) {
    if (typeof row[field] !== 'string' || row[field].length === 0) mismatch()
  }
  for (const field of BOOKING_NULLABLE_STRING_FIELDS) {
    if (row[field] !== null && typeof row[field] !== 'string') mismatch()
  }
  for (const field of BOOKING_BOOLEAN_FIELDS) {
    if (typeof row[field] !== 'boolean') mismatch()
  }
  if (!Number.isSafeInteger(row.amount_twd) || Number(row.amount_twd) < 0) mismatch()
  if (row.currency !== 'TWD' || row.timezone !== 'Asia/Taipei') mismatch()
  if (!BOOKING_STATUS_VALUES.has(row.status as BookingStatus)) mismatch()
  if (!BOOKING_PAYMENT_STATUS_VALUES.has(row.payment_status as BookingPaymentStatus)) mismatch()
  if (!BOOKING_GENDER_VALUES.has(row.gender as BookingFormInput['gender'])) mismatch()
  for (const field of ['starts_at', 'ends_at', 'created_at', 'updated_at'] as const) {
    if (Number.isNaN(Date.parse(String(row[field])))) mismatch()
  }
  if (
    row.cancelled_at !== null &&
    Number.isNaN(Date.parse(String(row.cancelled_at)))
  ) mismatch()

  return row as unknown as BookingRow
}

export type BookingPaymentContext = {
  id: string
  planId: string | null
  amountTwd: number
  status: string
  paymentStatus: string
}

export type BookingMemberUpdate = {
  status?: 'cancelled'
  googleCalendarEventId?: string
  googleCalendarEventLink?: string
  googleCalendarCancelled?: boolean
  emailSentToCustomer?: boolean
  emailSentToAdmin?: boolean
  cancellationEmailSentToCustomer?: boolean
  cancellationEmailSentToAdmin?: boolean
  cancelledAt?: string
  cancellationReason?: string
}

export type CreateSupabaseBookingInput = Omit<
  BookingFormInput,
  'userId' | 'startTime' | 'endTime'
> & {
  userId: string
}

type CreateSupabaseBookingDependencies = {
  hasAdminConfig: typeof hasSupabaseAdminConfig
  getAdminClient: typeof getSupabaseAdmin
}

type BookingRepositoryDependencies = Pick<
  CreateSupabaseBookingDependencies,
  'hasAdminConfig' | 'getAdminClient'
>

const bookingRepositoryDependencies: BookingRepositoryDependencies = {
  hasAdminConfig: hasSupabaseAdminConfig,
  getAdminClient: getSupabaseAdmin,
}

const createSupabaseBookingDependencies: CreateSupabaseBookingDependencies = {
  hasAdminConfig: hasSupabaseAdminConfig,
  getAdminClient: getSupabaseAdmin,
}

type BookingCreateErrorCode =
  | 'booking_plan_unavailable'
  | 'booking_slot_unavailable'
  | 'booking_repository_error'

function bookingCreateError(code: BookingCreateErrorCode) {
  return Object.assign(new Error(code), { code })
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
    paymentStatus: row.payment_status,
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

export async function createSupabaseBooking(
  input: CreateSupabaseBookingInput,
  deps: CreateSupabaseBookingDependencies = createSupabaseBookingDependencies,
) {
  const userId = typeof input.userId === 'string' ? input.userId.trim() : ''
  if (!userId) throw new Error('Booking userId 不可為空')

  if (!deps.hasAdminConfig()) return null

  if (!getBookingPlan(input.planId)) throw bookingCreateError('booking_plan_unavailable')

  const slotIdMatch = DATABASE_SLOT_ID_PATTERN.exec(input.slotId ?? '')
  if (!slotIdMatch) throw bookingCreateError('booking_slot_unavailable')

  const supabase = deps.getAdminClient()

  const { data, error } = await supabase
    .rpc('create_booking_with_available_slot', {
      p_user_id: userId,
      p_slot_id: slotIdMatch[1],
      p_plan_id: input.planId,
      p_customer_name: input.customerName,
      p_customer_email: input.customerEmail,
      p_customer_phone: input.customerPhone ?? null,
      p_line_display_name: input.lineDisplayName ?? null,
      p_gender: input.gender,
      p_birth_date: input.birthDate,
      p_birth_time: input.birthTime,
      p_birth_place: input.birthPlace ?? null,
      p_is_birth_time_accurate: input.isBirthTimeAccurate,
      p_question: input.question,
      p_note: input.note ?? null,
    })
    .single()

  if (error) {
    if (error.code === 'WB001') throw bookingCreateError('booking_plan_unavailable')
    if (error.code === 'WB002') throw bookingCreateError('booking_slot_unavailable')
    console.error('Atomic booking transaction failed')
    throw bookingCreateError('booking_repository_error')
  }
  return mapBookingRow(readBookingRow(data))
}

function readMemberBookingRow(value: unknown): MemberBookingRow {
  const row = readExactRecord(value, MEMBER_BOOKING_COLUMN_NAMES, 'member_booking_row')
  const valid =
    ['id', 'plan_name', 'payment_status', 'question', 'starts_at', 'ends_at', 'created_at', 'updated_at']
      .every((key) => typeof row[key] === 'string' && String(row[key]).length > 0) &&
    ['google_calendar_event_id', 'cancelled_at', 'cancellation_reason']
      .every((key) => row[key] === null || typeof row[key] === 'string') &&
    ['google_calendar_cancelled', 'confirmation_email_sent_to_customer', 'cancellation_email_sent_to_customer', 'cancellation_email_sent_to_admin']
      .every((key) => typeof row[key] === 'boolean') &&
    BOOKING_STATUS_VALUES.has(row.status as BookingStatus) &&
    BOOKING_PAYMENT_STATUS_VALUES.has(row.payment_status as BookingPaymentStatus) &&
    [row.starts_at, row.ends_at, row.created_at, row.updated_at]
      .every((dateValue) => !Number.isNaN(Date.parse(String(dateValue))))
  if (!valid) throw new Error('member_booking_row_invalid')
  return row as unknown as MemberBookingRow
}

function mapMemberBookingRow(row: MemberBookingRow): BookingMemberListItem {
  return {
    id: row.id,
    planName: row.plan_name,
    status: row.status,
    paymentStatus: row.payment_status,
    question: row.question,
    startTime: row.starts_at,
    endTime: row.ends_at,
    googleCalendarEventId: row.google_calendar_event_id ?? undefined,
    googleCalendarCancelled: row.google_calendar_cancelled,
    emailSentToCustomer: row.confirmation_email_sent_to_customer,
    cancellationEmailSentToCustomer: row.cancellation_email_sent_to_customer,
    cancellationEmailSentToAdmin: row.cancellation_email_sent_to_admin,
    cancelledAt: row.cancelled_at ?? undefined,
    cancellationReason: row.cancellation_reason ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listSupabaseBookings(
  userId: string,
  pagination: { limit: number; offset: number },
  deps: BookingRepositoryDependencies = bookingRepositoryDependencies,
) {
  if (!deps.hasAdminConfig()) return { bookings: [], total: 0 }
  const normalizedUserId = userId.trim()
  if (!normalizedUserId) throw new Error('booking_user_id_required')
  const limit = Math.min(
    MEMBER_BOOKING_MAX_PAGE_SIZE,
    Math.max(1, Math.trunc(pagination.limit)),
  )
  const offset = Math.max(0, Math.trunc(pagination.offset))

  const supabase = deps.getAdminClient()
  const query = supabase
    .from('bookings')
    .select(MEMBER_BOOKING_COLUMNS, { count: 'exact' })
    .eq('user_id', normalizedUserId)
    .order('starts_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) throw new Error('booking_repository_error')
  return {
    bookings: (data ?? []).map((row) => mapMemberBookingRow(readMemberBookingRow(row))),
    total: count ?? 0,
  }
}

export async function getSupabaseBooking(bookingId: string) {
  if (!hasSupabaseAdminConfig()) return null

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_COLUMNS)
    .eq('id', bookingId)
    .maybeSingle()

  if (error) throw new Error('booking_repository_error')
  return data ? mapBookingRow(readBookingRow(data)) : null
}

export async function getSupabaseBookingForRequester(
  bookingId: string,
  requesterId: string,
  requesterIsAdmin: boolean,
  deps: BookingRepositoryDependencies = bookingRepositoryDependencies,
) {
  if (!deps.hasAdminConfig()) return null
  const normalizedBookingId = bookingId.trim()
  const normalizedRequesterId = requesterId.trim()
  if (!normalizedBookingId || !normalizedRequesterId) return null

  const supabase = deps.getAdminClient()
  let query = supabase
    .from('bookings')
    .select(BOOKING_COLUMNS)
    .eq('id', normalizedBookingId)

  if (!requesterIsAdmin) {
    query = query.eq('user_id', normalizedRequesterId)
  }

  const { data, error } = await query.maybeSingle()
  if (error) throw new Error('booking_repository_error')
  return data ? mapBookingRow(readBookingRow(data)) : null
}

export type CancelSupabaseBookingInput = {
  bookingId: string
  requesterId: string
  requesterIsAdmin: boolean
  expectedStartTime: string
  expectedUpdatedAt: string
  cancelledAt: string
  cancellationReason: string
}

export async function cancelSupabaseBooking(
  input: CancelSupabaseBookingInput,
  deps: BookingRepositoryDependencies = bookingRepositoryDependencies,
) {
  if (!deps.hasAdminConfig()) return null

  const supabase = deps.getAdminClient()
  const cutoff = new Date(
    new Date(input.cancelledAt).getTime() + 24 * 60 * 60 * 1000,
  ).toISOString()
  let query = supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_at: input.cancelledAt,
      cancellation_reason: input.cancellationReason,
    })
    .eq('id', input.bookingId)
    .eq('status', 'confirmed')
    .eq('payment_status', 'paid')
    .eq('starts_at', input.expectedStartTime)
    .eq('updated_at', input.expectedUpdatedAt)
    .gt('starts_at', cutoff)

  if (!input.requesterIsAdmin) {
    query = query.eq('user_id', input.requesterId)
  }

  const { data, error } = await query.select(BOOKING_COLUMNS).maybeSingle()
  if (error) throw new Error('booking_repository_error')
  return data ? mapBookingRow(readBookingRow(data)) : null
}

export async function getSupabaseBookingPaymentContext(bookingId: string): Promise<BookingPaymentContext | null> {
  if (!hasSupabaseAdminConfig()) return null

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('bookings')
    .select('id,plan_id,amount_twd,status,payment_status')
    .eq('id', bookingId)
    .maybeSingle()

  if (error) throw new Error('booking_repository_error')
  if (!data) return null

  const row = data as {
    id: string
    plan_id: string | null
    amount_twd: number
    status: string
    payment_status: string
  }

  return {
    id: row.id,
    planId: row.plan_id,
    amountTwd: row.amount_twd,
    status: row.status,
    paymentStatus: row.payment_status,
  }
}

export async function updateSupabaseBooking(bookingId: string, updates: BookingMemberUpdate) {
  if (!hasSupabaseAdminConfig()) return null

  const patch: Record<string, unknown> = {}
  if (updates.status === 'cancelled') patch.status = 'cancelled'
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
  const { data, error } = await supabase
    .from('bookings')
    .update(patch)
    .eq('id', bookingId)
    .select(BOOKING_COLUMNS)
    .single()

  if (error) throw new Error('booking_repository_error')
  return mapBookingRow(readBookingRow(data))
}
