import assert from 'node:assert/strict'
import { handleBookingCalendarRequest, type BookingCalendarHandlerDeps } from './handler'
import type { BookingRecord } from '../../../../lib/bookings/types'

function makeBooking(overrides: Partial<BookingRecord> = {}) {
  return {
    id: 'booking-1',
    userId: 'user-1',
    status: 'confirmed',
    paymentStatus: 'paid',
    customerName: '測試會員',
    customerEmail: 'member@example.com',
    planName: '水瓶先生論命',
    startTime: '2026-08-01T02:00:00.000Z',
    endTime: '2026-08-01T03:00:00.000Z',
    timezone: 'Asia/Taipei',
    ...overrides,
  } as BookingRecord
}

function request(body: Record<string, unknown> = { bookingId: 'booking-1' }) {
  return new Request('http://localhost/api/calendar/create-event', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDeps(booking: BookingRecord, overrides: Partial<BookingCalendarHandlerDeps> = {}) {
  const calls = { created: 0, marked: 0, payload: null as Record<string, unknown> | null }
  const deps: BookingCalendarHandlerDeps = {
    getRequesterFromRequest: async () => ({ id: 'user-1', email: 'member@example.com' }),
    getBookingById: async () => booking,
    createCalendarEvent: async (payload) => {
      calls.created += 1
      calls.payload = payload
      return { eventId: 'event-1', htmlLink: 'https://calendar.example/event-1' }
    },
    markCalendarCreated: async () => {
      calls.marked += 1
    },
    adminEmailsRaw: '',
    ...overrides,
  }
  return { deps, calls }
}

async function run() {
  let context = makeDeps(makeBooking(), { getRequesterFromRequest: async () => null })
  let response = await handleBookingCalendarRequest(request(), context.deps)
  assert.equal(response.status, 401)
  assert.equal(context.calls.created, 0)

  context = makeDeps(makeBooking())
  response = await handleBookingCalendarRequest(
    request({ bookingId: 'booking-1', customerEmail: 'attacker@example.com' }),
    context.deps,
  )
  assert.equal(response.status, 400)
  assert.equal(context.calls.created, 0)
  assert.equal(context.calls.marked, 0)

  context = makeDeps(makeBooking({ status: 'pending_payment', paymentStatus: 'pending' }))
  response = await handleBookingCalendarRequest(request(), context.deps)
  assert.equal(response.status, 409)
  assert.equal(context.calls.created, 0)
  assert.equal(context.calls.marked, 0)

  context = makeDeps(makeBooking())
  response = await handleBookingCalendarRequest(request(), context.deps)
  assert.equal(response.status, 200)
  assert.equal(context.calls.created, 1)
  assert.equal(context.calls.marked, 1)
  assert.deepEqual(context.calls.payload, {
    bookingId: 'booking-1',
    planName: '水瓶先生論命',
    startTime: '2026-08-01T02:00:00.000Z',
    endTime: '2026-08-01T03:00:00.000Z',
    timezone: 'Asia/Taipei',
  })
  assert.equal(JSON.stringify(context.calls.payload).includes('member@example.com'), false)
  assert.equal(JSON.stringify(context.calls.payload).includes('測試會員'), false)
  assert.equal(JSON.stringify(context.calls.payload).includes('attacker@example.com'), false)

  console.log('booking calendar handler tests passed')
}

void run()
