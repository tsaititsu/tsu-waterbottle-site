import assert from 'node:assert/strict'
import {
  buildBookingPaidUpdatePayload,
  getMarkBookingPaidDecision,
  type BookingPaymentSyncRow,
  type MarkBookingPaidInput,
} from './bookingPayments'

const pendingBooking: BookingPaymentSyncRow = {
  id: 'booking-1',
  status: 'pending_payment',
  payment_status: 'pending',
}

const alreadyPaidBooking: BookingPaymentSyncRow = {
  id: 'booking-1',
  status: 'confirmed',
  payment_status: 'paid',
}

const cancelledUnpaidBooking: BookingPaymentSyncRow = {
  id: 'booking-2',
  status: 'cancelled',
  payment_status: 'pending',
}

const updatePayload = buildBookingPaidUpdatePayload('2026-07-04T09:00:00.000Z')

assert.deepEqual(updatePayload, {
  payment_status: 'paid',
  status: 'confirmed',
  updated_at: '2026-07-04T09:00:00.000Z',
})

assert.equal(getMarkBookingPaidDecision(pendingBooking), 'should_update')
assert.equal(getMarkBookingPaidDecision(alreadyPaidBooking), 'already_paid')
assert.equal(getMarkBookingPaidDecision(cancelledUnpaidBooking), 'should_update')
assert.equal(getMarkBookingPaidDecision(null), 'not_found')

assert.equal('payment_id' in updatePayload, false)
assert.equal('provider' in updatePayload, false)
assert.equal('provider_trade_no' in updatePayload, false)
assert.equal('paid_at' in updatePayload, false)
assert.equal('ai_divination' in updatePayload, false)
assert.equal('reading_id' in updatePayload, false)

const inputShape: MarkBookingPaidInput = {
  bookingId: 'booking-1',
  paymentId: 'payment-1',
  provider: 'newebpay',
  providerTradeNo: '26070416101000995',
  paidAt: '2026-07-04T16:10:38+00:00',
}

assert.deepEqual(inputShape, {
  bookingId: 'booking-1',
  paymentId: 'payment-1',
  provider: 'newebpay',
  providerTradeNo: '26070416101000995',
  paidAt: '2026-07-04T16:10:38+00:00',
})
