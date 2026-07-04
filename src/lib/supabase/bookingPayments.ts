import { getSupabaseAdmin } from './admin'

export type MarkBookingPaidInput = {
  bookingId: string
  paymentId?: string | null
  provider?: 'newebpay'
  providerTradeNo?: string | null
  paidAt?: string | null
}

export type MarkBookingPaidResult =
  | { result: 'updated'; bookingId: string }
  | { result: 'already_paid'; bookingId: string }
  | { result: 'not_found'; bookingId: string }

export type BookingPaymentSyncRow = {
  id: string
  status: string
  payment_status: string
}

export type BookingPaidUpdatePayload = {
  payment_status: 'paid'
  status: 'confirmed'
  updated_at: string
}

export type MarkBookingPaidDecision = 'not_found' | 'already_paid' | 'should_update'

function assertRequiredText(value: string, fieldName: string) {
  if (!value.trim()) {
    throw new Error(`${fieldName} 不可空白`)
  }
}

export function getMarkBookingPaidDecision(
  booking: Pick<BookingPaymentSyncRow, 'status' | 'payment_status'> | null,
): MarkBookingPaidDecision {
  if (!booking) return 'not_found'
  if (booking.payment_status === 'paid' && booking.status === 'confirmed') return 'already_paid'
  return 'should_update'
}

export function buildBookingPaidUpdatePayload(now = new Date().toISOString()): BookingPaidUpdatePayload {
  return {
    payment_status: 'paid',
    status: 'confirmed',
    updated_at: now,
  }
}

export async function markBookingPaidById(input: MarkBookingPaidInput): Promise<MarkBookingPaidResult> {
  assertRequiredText(input.bookingId, 'bookingId')

  const supabase = getSupabaseAdmin()
  const { data: existingBooking, error: selectError } = await supabase
    .from('bookings')
    .select('id,status,payment_status')
    .eq('id', input.bookingId)
    .maybeSingle()

  if (selectError) {
    throw new Error(selectError.message)
  }

  const decision = getMarkBookingPaidDecision(existingBooking as BookingPaymentSyncRow | null)

  if (decision === 'not_found') {
    return {
      result: 'not_found',
      bookingId: input.bookingId,
    }
  }

  if (decision === 'already_paid') {
    return {
      result: 'already_paid',
      bookingId: input.bookingId,
    }
  }

  const { error: updateError } = await supabase
    .from('bookings')
    .update(buildBookingPaidUpdatePayload())
    .eq('id', input.bookingId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  return {
    result: 'updated',
    bookingId: input.bookingId,
  }
}
