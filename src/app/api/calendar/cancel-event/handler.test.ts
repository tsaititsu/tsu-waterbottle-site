import assert from 'node:assert/strict'
import { handleBookingCalendarCancellationRequest, type BookingCalendarCancellationDeps } from './handler'
import type { BookingRecord } from '../../../../lib/bookings/types'
import type { BookingMemberUpdate } from '../../../../lib/supabase/bookings'

const booking = {
  id: 'booking-1',
  userId: 'user-1',
  status: 'cancelled',
  googleCalendarEventId: 'server-event-1',
  googleCalendarCancelled: false,
} as BookingRecord

function request(body: unknown) {
  return new Request('http://localhost/api/calendar/cancel-event', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function dependencies(overrides: Partial<BookingCalendarCancellationDeps> = {}) {
  const calls = {
    reads: 0,
    cancellations: [] as string[],
    writes: [] as BookingMemberUpdate[],
  }
  const deps: BookingCalendarCancellationDeps = {
    getRequesterFromRequest: async () => ({ id: 'user-1', email: 'member@example.com' }),
    getBookingById: async () => {
      calls.reads += 1
      return booking
    },
    cancelCalendarEvent: async (eventId) => {
      calls.cancellations.push(eventId)
    },
    markCalendarCancelled: async (_bookingId, updates) => {
      calls.writes.push(updates)
      return { ...booking, ...updates }
    },
    adminEmailsRaw: '',
    ...overrides,
  }
  return { calls, deps }
}

async function run() {
  let context = dependencies({ getRequesterFromRequest: async () => null })
  let response = await handleBookingCalendarCancellationRequest(
    request({ bookingId: 'booking-1' }),
    context.deps,
  )
  assert.equal(response.status, 401)
  assert.equal(context.calls.reads, 0)
  assert.equal(context.calls.cancellations.length, 0)

  context = dependencies({
    getRequesterFromRequest: async () => ({ id: 'other-user', email: 'other@example.com' }),
  })
  response = await handleBookingCalendarCancellationRequest(
    request({ bookingId: 'booking-1' }),
    context.deps,
  )
  assert.equal(response.status, 404)
  assert.equal(context.calls.cancellations.length, 0)

  for (const invalidBody of [
    {},
    { bookingId: '' },
    { bookingId: 'booking-1', eventId: 'attacker-event' },
    { eventId: 'attacker-event' },
  ]) {
    context = dependencies()
    response = await handleBookingCalendarCancellationRequest(request(invalidBody), context.deps)
    assert.equal(response.status, 400, JSON.stringify(invalidBody))
    assert.equal(context.calls.reads, 0)
    assert.equal(context.calls.cancellations.length, 0)
  }

  context = dependencies({
    getBookingById: async () => ({ ...booking, status: 'confirmed' }),
  })
  response = await handleBookingCalendarCancellationRequest(
    request({ bookingId: 'booking-1' }),
    context.deps,
  )
  assert.equal(response.status, 409)
  assert.equal(context.calls.cancellations.length, 0)

  context = dependencies()
  response = await handleBookingCalendarCancellationRequest(
    request({ bookingId: 'booking-1' }),
    context.deps,
  )
  assert.equal(response.status, 200)
  assert.deepEqual(context.calls.cancellations, ['server-event-1'])
  assert.deepEqual(context.calls.writes, [{ googleCalendarCancelled: true }])
  assert.equal(JSON.stringify(await response.json()).includes('server-event-1'), false)

  context = dependencies({
    getBookingById: async () => ({ ...booking, googleCalendarCancelled: true }),
  })
  response = await handleBookingCalendarCancellationRequest(
    request({ bookingId: 'booking-1' }),
    context.deps,
  )
  assert.equal(response.status, 200)
  assert.equal((await response.json() as { alreadyCancelled?: boolean }).alreadyCancelled, true)
  assert.equal(context.calls.cancellations.length, 0)
  assert.equal(context.calls.writes.length, 0)

  console.log('booking calendar cancellation handler tests passed')
}

void run()
