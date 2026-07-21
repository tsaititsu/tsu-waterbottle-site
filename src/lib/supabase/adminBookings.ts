import type { getSupabaseAdmin } from './admin'

export const ADMIN_BOOKING_LIMIT = 100

export const ADMIN_BOOKING_COLUMNS = [
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
  'note',
  'confirmation_email_sent_to_customer',
  'confirmation_email_sent_to_admin',
  'cancellation_email_sent_to_customer',
  'cancellation_email_sent_to_admin',
  'cancelled_at',
  'cancellation_reason',
  'created_at',
  'updated_at',
].join(',')

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
  note: string | null
  confirmation_email_sent_to_customer: boolean
  confirmation_email_sent_to_admin: boolean
  cancellation_email_sent_to_customer: boolean
  cancellation_email_sent_to_admin: boolean
  cancelled_at: string | null
  cancellation_reason: string | null
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
  note: string | null
  confirmationEmailSentToCustomer: boolean
  confirmationEmailSentToAdmin: boolean
  cancellationEmailSentToCustomer: boolean
  cancellationEmailSentToAdmin: boolean
  cancelledAt: string | null
  cancellationReason: string | null
  createdAt: string
  updatedAt: string
}

export type AdminBookingsClient = ReturnType<typeof getSupabaseAdmin>

function requiredText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function nullableText(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function mapAdminBookingRow(row: AdminBookingRow): AdminBookingListItem {
  return {
    id: requiredText(row.id),
    planName: requiredText(row.plan_name),
    amountTwd: typeof row.amount_twd === 'number' && Number.isFinite(row.amount_twd) ? row.amount_twd : 0,
    currency: requiredText(row.currency),
    status: requiredText(row.status),
    paymentStatus: requiredText(row.payment_status),
    customerName: requiredText(row.customer_name),
    customerEmail: requiredText(row.customer_email),
    customerPhone: nullableText(row.customer_phone),
    lineDisplayName: nullableText(row.line_display_name),
    startsAt: requiredText(row.starts_at),
    endsAt: requiredText(row.ends_at),
    timezone: requiredText(row.timezone),
    note: nullableText(row.note),
    confirmationEmailSentToCustomer: row.confirmation_email_sent_to_customer === true,
    confirmationEmailSentToAdmin: row.confirmation_email_sent_to_admin === true,
    cancellationEmailSentToCustomer: row.cancellation_email_sent_to_customer === true,
    cancellationEmailSentToAdmin: row.cancellation_email_sent_to_admin === true,
    cancelledAt: nullableText(row.cancelled_at),
    cancellationReason: nullableText(row.cancellation_reason),
    createdAt: requiredText(row.created_at),
    updatedAt: requiredText(row.updated_at),
  }
}

export async function listAdminBookings(supabase: AdminBookingsClient): Promise<AdminBookingListItem[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(ADMIN_BOOKING_COLUMNS)
    .order('starts_at', { ascending: false })
    .limit(ADMIN_BOOKING_LIMIT)

  if (error) throw new Error('admin_booking_list_failed')

  return ((data ?? []) as unknown as AdminBookingRow[]).map(mapAdminBookingRow)
}
