import assert from 'node:assert/strict'
import {
  handleBookingUpdateRequest,
  parseBookingCancellationRequest,
  type BookingUpdateHandlerDeps,
} from './handler'
import type { BookingRecord } from '../../../../lib/bookings/types'
import type { CancelSupabaseBookingInput } from '../../../../lib/supabase/bookings'

const booking = {
  id: 'booking-1',
  userId: 'user-1',
  status: 'confirmed',
  paymentStatus: 'paid',
  startTime: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-07-31T12:00:00.000Z',
} as BookingRecord

function request(body: unknown) {
  return new Request('http://localhost/api/bookings/update', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function deps(overrides: Partial<BookingUpdateHandlerDeps> = {}) {
  const calls = {
    reads: 0,
    writes: [] as CancelSupabaseBookingInput[],
  }

  const dependencies: BookingUpdateHandlerDeps = {
    now: () => new Date('2026-08-01T00:00:00.000Z'),
    getRequesterFromRequest: async () => ({ id: 'user-1', email: 'member@example.com' }),
    getBookingById: async () => {
      calls.reads += 1
      return booking
    },
    cancelBooking: async (input) => {
      calls.writes.push(input)
      return {
        ...booking,
        status: 'cancelled',
        cancelledAt: input.cancelledAt,
        cancellationReason: input.cancellationReason,
      }
    },
    adminEmailsRaw: '',
    ...overrides,
  }

  return { calls, dependencies }
}

async function run() {
  let context = deps({ getRequesterFromRequest: async () => null })
  let response = await handleBookingUpdateRequest(
    request({ bookingId: 'booking-1', cancellationReason: '改期' }),
    context.dependencies,
  )
  assert.equal(response.status, 401)
  assert.equal(context.calls.reads, 0)
  assert.equal(context.calls.writes.length, 0)

  context = deps({
    getRequesterFromRequest: async () => ({ id: 'other-user', email: 'other@example.com' }),
  })
  response = await handleBookingUpdateRequest(
    request({ bookingId: 'booking-1', cancellationReason: '改期' }),
    context.dependencies,
  )
  assert.equal(response.status, 404)
  assert.equal(context.calls.reads, 1)
  assert.equal(context.calls.writes.length, 0)

  for (const invalidBody of [
    { bookingId: 'booking-1', updates: { status: 'cancelled' } },
    { bookingId: 'booking-1', cancellationReason: '改期', googleCalendarCancelled: true },
    { bookingId: 'booking-1', cancellationReason: '改期', cancellationEmailSentToCustomer: true },
    { bookingId: 'booking-1', cancellationReason: '改期', cancelledAt: '2020-01-01T00:00:00.000Z' },
    { bookingId: 'booking-1', cancellationReason: '' },
    { bookingId: 'booking-1', cancellationReason: 'x'.repeat(301) },
    { bookingId: '', cancellationReason: '改期' },
  ]) {
    context = deps()
    response = await handleBookingUpdateRequest(request(invalidBody), context.dependencies)
    assert.equal(response.status, 400, JSON.stringify(invalidBody))
    assert.equal(context.calls.writes.length, 0)
  }

  assert.deepEqual(parseBookingCancellationRequest({
    bookingId: ' booking-1 ',
    cancellationReason: '  改期  ',
  }), {
    ok: true,
    bookingId: 'booking-1',
    cancellationReason: '改期',
  })
  assert.deepEqual(parseBookingCancellationRequest({
    bookingId: 'booking-1',
    cancellationReason: '改期',
    status: 'cancelled',
  }), {
    ok: false,
    error: 'unknown_field',
  })

  context = deps()
  response = await handleBookingUpdateRequest(
    request({ bookingId: 'booking-1', cancellationReason: '  改期  ' }),
    context.dependencies,
  )
  assert.equal(response.status, 200)
  assert.deepEqual(context.calls.writes, [{
    bookingId: 'booking-1',
    requesterId: 'user-1',
    requesterIsAdmin: false,
    expectedStartTime: '2026-08-03T00:00:00.000Z',
    expectedUpdatedAt: '2026-07-31T12:00:00.000Z',
    cancelledAt: '2026-08-01T00:00:00.000Z',
    cancellationReason: '改期',
  }])

  context = deps({ cancelBooking: async () => null })
  response = await handleBookingUpdateRequest(
    request({ bookingId: 'booking-1', cancellationReason: '競態測試' }),
    context.dependencies,
  )
  assert.equal(response.status, 409)
  assert.equal((await response.json() as { error?: string }).error, 'booking_changed')

  context = deps({
    getBookingById: async () => ({
      ...booking,
      startTime: '2026-08-02T00:00:00.000Z',
    }),
  })
  response = await handleBookingUpdateRequest(
    request({ bookingId: 'booking-1', cancellationReason: '太晚了' }),
    context.dependencies,
  )
  assert.equal(response.status, 409)
  assert.equal(context.calls.writes.length, 0)

  context = deps({
    getBookingById: async () => ({
      ...booking,
      status: 'pending_payment',
      paymentStatus: 'pending',
    }),
  })
  response = await handleBookingUpdateRequest(
    request({ bookingId: 'booking-1', cancellationReason: '尚未付款' }),
    context.dependencies,
  )
  assert.equal(response.status, 409)
  assert.equal(context.calls.writes.length, 0)

  context = deps({
    getBookingById: async () => ({
      ...booking,
      status: 'cancelled',
      cancelledAt: '2026-07-31T00:00:00.000Z',
      cancellationReason: '已取消',
    }),
  })
  response = await handleBookingUpdateRequest(
    request({ bookingId: 'booking-1', cancellationReason: '重試' }),
    context.dependencies,
  )
  assert.equal(response.status, 200)
  assert.equal((await response.json() as { alreadyCancelled?: boolean }).alreadyCancelled, true)
  assert.equal(context.calls.writes.length, 0)

  console.log('booking update handler tests passed')
}

void run()
