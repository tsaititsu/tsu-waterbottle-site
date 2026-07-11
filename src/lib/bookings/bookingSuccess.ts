export type BookingPaymentState = {
  status?: string | null
  paymentStatus?: string | null
}

export function isTrustedPaidBooking(booking: BookingPaymentState | null | undefined): boolean {
  return booking?.paymentStatus === 'paid' && booking.status === 'confirmed'
}
