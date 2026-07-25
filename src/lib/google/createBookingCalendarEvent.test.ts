import assert from 'node:assert/strict'
import {
  BookingCalendarAdapterError,
  cancelBookingCalendarEvent,
  createBookingCalendarEvent,
  type CreateBookingCalendarEventPayload,
} from './createBookingCalendarEvent'

const payload: CreateBookingCalendarEventPayload = {
  bookingId: 'booking-123',
  planName: '完整命盤',
  startTime: '2026-08-01T10:00:00+08:00',
  endTime: '2026-08-01T11:00:00+08:00',
  timezone: 'Asia/Taipei',
}

const config = {
  clientEmail: 'calendar@example.test',
  privateKey: 'not-used-by-injected-token-provider',
  calendarId: 'calendar-id',
  timezone: 'Asia/Taipei',
}

async function main() {
  let missingConfigCalls = 0
  await assert.rejects(
    createBookingCalendarEvent(payload, {
      getConfig: () => null,
      fetchImpl: async () => {
        missingConfigCalls += 1
        return new Response()
      },
    }),
    (error) =>
      error instanceof BookingCalendarAdapterError &&
      error.message === 'booking_calendar_unavailable',
  )
  assert.equal(missingConfigCalls, 0)

  const requests: Array<{ url: string; init?: RequestInit }> = []
  const created = await createBookingCalendarEvent(payload, {
    getConfig: () => config,
    getAccessToken: async () => 'access-token',
    fetchImpl: async (input, init) => {
      requests.push({ url: String(input), init })
      return Response.json({
        id: 'event-123',
        htmlLink: 'https://calendar.example.test/event-123',
        providerInternalPayload: 'must-not-leak',
      })
    },
  })

  assert.deepEqual(created, {
    eventId: 'event-123',
    htmlLink: 'https://calendar.example.test/event-123',
  })
  assert.equal('raw' in created, false)
  assert.equal('mocked' in created, false)
  assert.equal(requests.length, 1)
  assert.equal(requests[0]?.init?.method, 'POST')
  assert.ok(requests[0]?.init?.signal instanceof AbortSignal)
  assert.equal(
    (requests[0]?.init?.headers as Record<string, string>).Authorization,
    'Bearer access-token',
  )
  const requestBody = JSON.parse(String(requests[0]?.init?.body)) as Record<string, unknown>
  assert.equal(typeof requestBody.id, 'string')
  assert.match(String(requestBody.id), /^[0-9a-f]{64}$/)
  assert.equal(String(requestBody.summary).includes('測試會員'), false)
  assert.equal(JSON.stringify(requestBody).includes('member@example.com'), false)
  assert.equal(JSON.stringify(requestBody).includes('客戶姓名'), false)
  assert.equal(JSON.stringify(requestBody).includes('諮詢問題'), false)

  const conflictRequests: Array<{ url: string; init?: RequestInit }> = []
  const existing = await createBookingCalendarEvent(payload, {
    getConfig: () => config,
    getAccessToken: async () => 'access-token',
    fetchImpl: async (input, init) => {
      conflictRequests.push({ url: String(input), init })
      if (init?.method === 'POST') return Response.json({}, { status: 409 })
      return Response.json({
        id: requestBody.id,
        htmlLink: 'https://calendar.example.test/existing',
      })
    },
  })
  assert.deepEqual(existing, {
    eventId: requestBody.id,
    htmlLink: 'https://calendar.example.test/existing',
  })
  assert.equal(conflictRequests.length, 2)
  assert.equal(conflictRequests[1]?.init?.method, 'GET')
  assert.ok(conflictRequests[1]?.url.endsWith(`/${requestBody.id}`))

  await assert.rejects(
    createBookingCalendarEvent(payload, {
      getConfig: () => config,
      getAccessToken: async () => 'access-token',
      fetchImpl: async () =>
        Response.json(
          { error: { message: 'provider secret diagnostics must not escape' } },
          { status: 503 },
        ),
    }),
    (error) =>
      error instanceof BookingCalendarAdapterError &&
      error.message === 'booking_calendar_request_failed',
  )

  const timedOut = await createBookingCalendarEvent(payload, {
    getConfig: () => config,
    getAccessToken: async () => 'access-token',
    timeoutMs: 1,
    fetchImpl: (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal
        if (!signal) return reject(new Error('missing signal'))
        if (signal.aborted) return reject(new Error('provider timeout details'))
        signal.addEventListener('abort', () => reject(new Error('provider timeout details')), {
          once: true,
        })
      }),
  }).then(
    () => 'unexpected_success',
    (error: unknown) => error,
  )
  assert.ok(timedOut instanceof BookingCalendarAdapterError)
  assert.equal(timedOut.message, 'booking_calendar_request_failed')

  const cancelled = await cancelBookingCalendarEvent('event-123', {
    getConfig: () => config,
    getAccessToken: async () => 'access-token',
    fetchImpl: async (_input, init) => {
      assert.equal(init?.method, 'DELETE')
      assert.ok(init?.signal instanceof AbortSignal)
      return new Response(null, { status: 404 })
    },
  })
  assert.deepEqual(cancelled, { cancelled: true })
  assert.deepEqual(await cancelBookingCalendarEvent(''), {
    cancelled: false,
    skipped: true,
  })

  console.log('booking Google Calendar adapter offline contract passed')
}

void main()
