import assert from 'node:assert/strict'
import { classifyAdminBookingStatus, type AdminBookingStatusBucket } from './bookingStatus'

const cases: Array<{
  booking: { status?: unknown; paymentStatus?: unknown }
  expected: AdminBookingStatusBucket
}> = [
  { booking: { status: 'cancelled', paymentStatus: 'pending' }, expected: 'cancelled' },
  { booking: { status: 'cancelled', paymentStatus: 'paid' }, expected: 'cancelled' },
  { booking: { status: 'canceled', paymentStatus: 'failed' }, expected: 'cancelled' },
  { booking: { status: 'failed', paymentStatus: 'paid' }, expected: 'failed' },
  { booking: { status: 'confirmed', paymentStatus: 'pending' }, expected: 'paid' },
  { booking: { status: 'paid', paymentStatus: 'pending' }, expected: 'paid' },
  { booking: { status: 'pending_payment', paymentStatus: 'pending' }, expected: 'pending' },
  { booking: { status: 'unknown', paymentStatus: 'pending' }, expected: 'pending' },
  { booking: { status: 'unknown', paymentStatus: 'unknown' }, expected: 'other' },
  { booking: { status: '  CaNcElLeD  ', paymentStatus: '  PaId  ' }, expected: 'cancelled' },
  { booking: { status: '  unknown  ', paymentStatus: '  PeNdInG  ' }, expected: 'pending' },
  { booking: { status: null, paymentStatus: 42 }, expected: 'other' },
]

for (const { booking, expected } of cases) {
  assert.equal(classifyAdminBookingStatus(booking), expected)
}

const syntheticBookings = [
  { status: 'pending_payment', paymentStatus: 'pending' },
  { status: 'confirmed', paymentStatus: 'pending' },
  { status: 'cancelled', paymentStatus: 'pending' },
  { status: 'failed', paymentStatus: 'paid' },
  { status: 'unknown', paymentStatus: 'unknown' },
]

const bucketCounts: Record<AdminBookingStatusBucket, number> = {
  pending: 0,
  paid: 0,
  cancelled: 0,
  failed: 0,
  other: 0,
}

for (const booking of syntheticBookings) {
  bucketCounts[classifyAdminBookingStatus(booking)] += 1
}

assert.deepEqual(bucketCounts, {
  pending: 1,
  paid: 1,
  cancelled: 1,
  failed: 1,
  other: 1,
})
assert.equal(Object.values(bucketCounts).reduce((total, count) => total + count, 0), syntheticBookings.length)
assert.equal(classifyAdminBookingStatus({ status: 'cancelled', paymentStatus: 'pending' }), 'cancelled')
assert.equal(bucketCounts.pending, 1, 'cancelled + pending 不得重複計入 pending')

console.log('✓ admin booking status classification tests passed')
