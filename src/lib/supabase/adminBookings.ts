import type { getSupabaseAdmin } from './admin'
import { maskEmail, maskIdentifier, maskPhone } from '@/lib/admin/pii'
import {
  hasExactKeys,
  isFiniteNumber,
  isNullableString,
  isPlainRecord,
  isString,
} from '@/lib/admin/validation'

export const ADMIN_BOOKING_LIMIT = 50
export const ADMIN_BOOKING_MAX_LIMIT = 50
const ADMIN_BOOKING_STATUSES = [
  'pending_payment',
  'paid',
  'confirmed',
  'cancelled',
  'failed',
] as const
const ADMIN_BOOKING_PAYMENT_STATUSES = [
  'pending',
  'paid',
  'failed',
  'cancelled',
  'refunded',
] as const

const ADMIN_BOOKING_COLUMN_NAMES = [
  'id',
  'plan_name',
  'amount_twd',
  'currency',
  'status',
  'payment_status',
  'customer_name',
  'customer_email',
  'customer_phone',
  'line_display_name',
  'starts_at',
  'ends_at',
  'timezone',
  'confirmation_email_sent_to_customer',
  'confirmation_email_sent_to_admin',
  'cancellation_email_sent_to_customer',
  'cancellation_email_sent_to_admin',
  'cancelled_at',
  'created_at',
  'updated_at',
] as const
export const ADMIN_BOOKING_COLUMNS = ADMIN_BOOKING_COLUMN_NAMES.join(',')

export type AdminBookingRow = {
  id: string
  plan_name: string
  amount_twd: number
  currency: string
  status: string
  payment_status: string
  customer_name: string
  customer_email: string
  customer_phone: string | null
  line_display_name: string | null
  starts_at: string
  ends_at: string
  timezone: string
  confirmation_email_sent_to_customer: boolean
  confirmation_email_sent_to_admin: boolean
  cancellation_email_sent_to_customer: boolean
  cancellation_email_sent_to_admin: boolean
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export type AdminBookingListItem = {
  id: string
  planName: string
  amountTwd: number
  currency: string
  status: string
  paymentStatus: string
  customerName: string
  customerEmail: string
  customerPhone: string | null
  lineDisplayName: string | null
  startsAt: string
  endsAt: string
  timezone: string
  confirmationEmailSentToCustomer: boolean
  confirmationEmailSentToAdmin: boolean
  cancellationEmailSentToCustomer: boolean
  cancellationEmailSentToAdmin: boolean
  cancelledAt: string | null
  createdAt: string
  updatedAt: string
}

export type AdminBookingsClient = ReturnType<typeof getSupabaseAdmin>

export function mapAdminBookingRow(value: unknown): AdminBookingListItem {
  if (!isPlainRecord(value) || !hasExactKeys(value, ADMIN_BOOKING_COLUMN_NAMES)) {
    throw new Error('admin_booking_row_invalid')
  }
  const row = value as unknown as AdminBookingRow
  const stringFields = [
    row.id,
    row.plan_name,
    row.currency,
    row.status,
    row.payment_status,
    row.customer_name,
    row.customer_email,
    row.starts_at,
    row.ends_at,
    row.timezone,
    row.created_at,
    row.updated_at,
  ]
  const booleanFields = [
    row.confirmation_email_sent_to_customer,
    row.confirmation_email_sent_to_admin,
    row.cancellation_email_sent_to_customer,
    row.cancellation_email_sent_to_admin,
  ]
  if (
    stringFields.some((field) => !isString(field) || field.length === 0) ||
    !isFiniteNumber(row.amount_twd) ||
    !Number.isSafeInteger(row.amount_twd) ||
    row.amount_twd < 0 ||
    row.currency !== 'TWD' ||
    row.timezone !== 'Asia/Taipei' ||
    !ADMIN_BOOKING_STATUSES.includes(
      row.status as (typeof ADMIN_BOOKING_STATUSES)[number],
    ) ||
    !ADMIN_BOOKING_PAYMENT_STATUSES.includes(
      row.payment_status as (typeof ADMIN_BOOKING_PAYMENT_STATUSES)[number],
    ) ||
    !isNullableString(row.customer_phone) ||
    !isNullableString(row.line_display_name) ||
    !isNullableString(row.cancelled_at) ||
    booleanFields.some((field) => typeof field !== 'boolean') ||
    [row.starts_at, row.ends_at, row.created_at, row.updated_at]
      .some((dateValue) => Number.isNaN(Date.parse(dateValue)))
  ) {
    throw new Error('admin_booking_row_invalid')
  }

  return {
    id: row.id,
    planName: row.plan_name,
    amountTwd: row.amount_twd,
    currency: row.currency,
    status: row.status,
    paymentStatus: row.payment_status,
    customerName: maskIdentifier(row.customer_name),
    customerEmail: maskEmail(row.customer_email),
    customerPhone: maskPhone(row.customer_phone),
    lineDisplayName: maskIdentifier(row.line_display_name),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone,
    confirmationEmailSentToCustomer: row.confirmation_email_sent_to_customer === true,
    confirmationEmailSentToAdmin: row.confirmation_email_sent_to_admin === true,
    cancellationEmailSentToCustomer: row.cancellation_email_sent_to_customer === true,
    cancellationEmailSentToAdmin: row.cancellation_email_sent_to_admin === true,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listAdminBookings(
  supabase: AdminBookingsClient,
  pagination: { limit: number; offset: number },
): Promise<{ bookings: AdminBookingListItem[]; total: number }> {
  const limit = Math.min(ADMIN_BOOKING_MAX_LIMIT, Math.max(1, Math.trunc(pagination.limit)))
  const offset = Math.max(0, Math.trunc(pagination.offset))
  const { data, error, count } = await supabase
    .from('bookings')
    .select(ADMIN_BOOKING_COLUMNS, { count: 'exact' })
    .order('starts_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error('admin_booking_list_failed')

  return {
    bookings: (data ?? []).map(mapAdminBookingRow),
    total: count ?? 0,
  }
}
