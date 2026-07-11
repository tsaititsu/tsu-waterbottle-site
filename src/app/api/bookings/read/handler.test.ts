import assert from 'node:assert/strict'
import { handleBookingReadRequest, type BookingReadHandlerDeps } from './handler'
import type { BookingRecord } from '../../../../lib/mockBooking'

const booking = { id: 'booking-1', userId: 'user-1', paymentStatus: 'pending' } as BookingRecord

function request() {
  return new Request('http://localhost/api/bookings/read?bookingId=booking-1')
}

function deps(overrides: Partial<BookingReadHandlerDeps> = {}): BookingReadHandlerDeps {
  return {
    getRequesterFromRequest: async () => ({ id: 'user-1', email: 'member@example.com' }),
    getBookingById: async () => booking,
    adminEmailsRaw: 'boss@example.com',
    ...overrides,
  }
}

async function run() {
  let response = await handleBookingReadRequest(request(), deps({ getRequesterFromRequest: async () => null }))
  assert.equal(response.status, 401)

  response = await handleBookingReadRequest(request(), deps())
  assert.equal(response.status, 200)
  assert.equal(((await response.json()) as { booking: { id: string } }).booking.id, 'booking-1')

  response = await handleBookingReadRequest(
    request(),
    deps({ getRequesterFromRequest: async () => ({ id: 'other-user', email: 'other@example.com' }) }),
  )
  assert.equal(response.status, 404)

  response = await handleBookingReadRequest(
    request(),
    deps({ getRequesterFromRequest: async () => ({ id: 'admin-user', email: 'boss@example.com' }) }),
  )
  assert.equal(response.status, 200)

  console.log('booking read handler tests passed')
}

void run()
