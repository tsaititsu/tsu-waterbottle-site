import assert from 'node:assert/strict'
import {
  BookingEmailAdapterError,
  sendBookingCancellationEmails,
  sendBookingConfirmationEmails,
  type BookingEmailPayload,
} from './sendBookingEmails'

const payload: BookingEmailPayload = {
  bookingId: 'booking-123',
  customerName: '測試會員',
  customerEmail: 'member@example.com',
  planName: '完整命盤',
  amount: 3600,
  startTimeText: '2026/08/01 10:00',
  endTimeText: '2026/08/01 11:00',
}

const config = {
  apiKey: 'offline-api-key',
  from: 'booking@example.test',
  adminEmail: 'admin@example.test',
}

async function main() {
  let missingConfigCalls = 0
  await assert.rejects(
    sendBookingConfirmationEmails(payload, {
      getConfig: () => null,
      fetchImpl: async () => {
        missingConfigCalls += 1
        return new Response()
      },
    }),
    (error) =>
      error instanceof BookingEmailAdapterError &&
      error.message === 'booking_email_unavailable',
  )
  assert.equal(missingConfigCalls, 0)

  const requests: RequestInit[] = []
  const result = await sendBookingConfirmationEmails(payload, {
    getConfig: () => config,
    fetchImpl: async (_input, init) => {
      requests.push(init ?? {})
      return Response.json({ id: `email-${requests.length}`, providerTrace: 'must-not-leak' })
    },
  })

  assert.deepEqual(result, {
    customerEmailId: 'email-1',
    adminEmailId: 'email-2',
  })
  assert.equal('mocked' in result, false)
  assert.equal('customerEmailResult' in result, false)
  assert.equal(requests.length, 2)
  assert.ok(requests.every((request) => request.signal instanceof AbortSignal))
  assert.deepEqual(
    requests.map(
      (request) => (request.headers as Record<string, string>)['Idempotency-Key'],
    ),
    [
      'booking-confirmation-customer/booking-123',
      'booking-confirmation-admin/booking-123',
    ],
  )
  for (const request of requests) {
    const body = JSON.parse(String(request.body)) as Record<string, unknown>
    assert.equal('attachments' in body, false)
    const serialized = JSON.stringify(body)
    for (const forbidden of [
      '0912345678',
      '1990-01-01',
      '08:30',
      '工作方向',
      'birthDate',
      'birthTime',
      'customerPhone',
      'question',
    ]) {
      assert.equal(serialized.includes(forbidden), false)
    }
  }

  const cancellationKeys: string[] = []
  await sendBookingCancellationEmails(payload, {
    getConfig: () => config,
    fetchImpl: async (_input, init) => {
      cancellationKeys.push(
        (init?.headers as Record<string, string>)['Idempotency-Key'],
      )
      return Response.json({ id: `cancel-email-${cancellationKeys.length}` })
    },
  })
  assert.deepEqual(cancellationKeys, [
    'booking-cancellation-customer/booking-123',
    'booking-cancellation-admin/booking-123',
  ])

  await assert.rejects(
    sendBookingConfirmationEmails(payload, {
      getConfig: () => config,
      fetchImpl: async () =>
        Response.json(
          { message: 'Resend rejected secret key re_secret_provider_detail' },
          { status: 503 },
        ),
    }),
    (error) =>
      error instanceof BookingEmailAdapterError &&
      error.message === 'booking_email_delivery_failed',
  )

  const timedOut = await sendBookingCancellationEmails(payload, {
    getConfig: () => config,
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
  assert.ok(timedOut instanceof BookingEmailAdapterError)
  assert.equal(timedOut.message, 'booking_email_delivery_failed')

  console.log('booking email adapter offline contract passed')
}

void main()
