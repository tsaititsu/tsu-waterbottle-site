export type AdminBookingStatusBucket = 'pending' | 'paid' | 'cancelled' | 'failed' | 'other'

type AdminBookingStatusInput = {
  status?: unknown
  paymentStatus?: unknown
}

function normalizeStatus(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function classifyAdminBookingStatus(booking: AdminBookingStatusInput): AdminBookingStatusBucket {
  const status = normalizeStatus(booking.status)
  const paymentStatus = normalizeStatus(booking.paymentStatus)

  if (status === 'cancelled' || status === 'canceled') return 'cancelled'
  if (status === 'failed' || paymentStatus === 'failed') return 'failed'
  if (status === 'paid' || status === 'confirmed' || paymentStatus === 'paid') return 'paid'
  if (status === 'pending_payment' || paymentStatus === 'pending') return 'pending'
  return 'other'
}
