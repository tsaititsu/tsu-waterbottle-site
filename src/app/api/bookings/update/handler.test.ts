import assert from 'node:assert/strict'
import { handleBookingUpdateRequest, parseBookingMemberUpdate, type BookingUpdateHandlerDeps } from './handler'
import type { BookingRecord } from '../../../../lib/mockBooking'
import type { BookingMemberUpdate } from '../../../../lib/supabase/bookings'

const booking = { id: 'booking-1', userId: 'user-1' } as BookingRecord
const writes: BookingMemberUpdate[] = []

function request(updates: unknown) {
  return new Request('http://localhost/api/bookings/update', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bookingId: 'booking-1', updates }),
  })
}

function deps(overrides: Partial<BookingUpdateHandlerDeps> = {}): BookingUpdateHandlerDeps {
  return {
    getRequesterFromRequest: async () => ({ id: 'user-1', email: 'member@example.com' }),
    getBookingById: async () => booking,
    updateBookingById: async (_bookingId, updates) => {
      writes.push(updates)
      return booking
    },
    adminEmailsRaw: '',
    ...overrides,
  }
}

async function run() {
  let response = await handleBookingUpdateRequest(
    request({ status: 'cancelled' }),
    deps({ getRequesterFromRequest: async () => null }),
  )
  assert.equal(response.status, 401)

  response = await handleBookingUpdateRequest(
    request({ status: 'cancelled' }),
    deps({ getRequesterFromRequest: async () => ({ id: 'other-user', email: 'other@example.com' }) }),
  )
  assert.equal(response.status, 404)

  for (const forbidden of [
    { paymentId: 'fake-payment' },
    { payment_id: 'fake-payment' },
    { paymentStatus: 'paid' },
    { payment_status: 'paid' },
    { paid: true },
    { paidAt: new Date().toISOString() },
    { transactionId: 'fake-transaction' },
    { tradeNo: 'fake-trade' },
    { status: 'paid' },
    { status: 'success' },
    { status: 'completed' },
  ]) {
    response = await handleBookingUpdateRequest(request(forbidden), deps())
    assert.equal(response.status, 400, JSON.stringify(forbidden))
  }
  assert.equal(writes.length, 0)

  assert.deepEqual(parseBookingMemberUpdate({ unexpected: 'value' }), { ok: false, error: 'unknown_field' })
  assert.deepEqual(parseBookingMemberUpdate({ googleCalendarEventId: 'spoofed-event' }), {
    ok: false,
    error: 'unknown_field',
  })
  assert.deepEqual(parseBookingMemberUpdate({ emailSentToCustomer: true }), {
    ok: false,
    error: 'unknown_field',
  })

  response = await handleBookingUpdateRequest(
    request({ status: 'cancelled', cancellationReason: '  改期  ', googleCalendarCancelled: true }),
    deps(),
  )
  assert.equal(response.status, 200)
  assert.deepEqual(writes, [{ status: 'cancelled', googleCalendarCancelled: true, cancellationReason: '改期' }])

  console.log('booking update handler tests passed')
}

void run()
