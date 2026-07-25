import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildBookingEmailPayload,
  handleBookingEmailRequest,
  MAX_CANCELLATION_REASON_LENGTH,
  parseBookingEmailRequestBody,
  resolveBookingEmailAccess,
  type BookingEmailPayloadFromRecord,
  type BookingEmailRequester,
  type BookingEmailSourceRecord,
  type HandleBookingEmailRequestDeps,
} from './bookingEmailRequestHandler'

const tests: Array<{ name: string; fn: () => Promise<void> | void }> = []

function test(name: string, fn: () => Promise<void> | void) {
  tests.push({ name, fn })
}

const ownerRequester: BookingEmailRequester = { id: 'user-1', email: 'customer@example.com' }

function makeBooking(overrides: Partial<BookingEmailSourceRecord> = {}): BookingEmailSourceRecord {
  return {
    id: 'booking-1',
    userId: 'user-1',
    customerName: '測試客人',
    customerEmail: 'customer@example.com',
    customerPhone: '0912345678',
    planName: '水瓶先生論命',
    amount: 3600,
    startTime: '2026-08-01T02:00:00.000Z',
    endTime: '2026-08-01T03:00:00.000Z',
    birthDate: '1990-01-01',
    birthTime: '08:30',
    question: '工作方向',
    status: 'confirmed',
    paymentStatus: 'paid',
    emailSentToCustomer: false,
    emailSentToAdmin: false,
    cancellationEmailSentToCustomer: false,
    cancellationEmailSentToAdmin: false,
    ...overrides,
  }
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/email/send-booking-confirmation', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDeps(overrides: Partial<HandleBookingEmailRequestDeps> = {}) {
  const sentPayloads: BookingEmailPayloadFromRecord[] = []
  const markedBookingIds: string[] = []
  const booking = makeBooking()

  const deps: HandleBookingEmailRequestDeps = {
    kind: 'confirmation',
    getRequesterFromRequest: async () => ownerRequester,
    getBookingById: async (bookingId) => (bookingId === booking.id ? booking : null),
    sendEmails: async (payload) => {
      sentPayloads.push(payload)
      return { mocked: true }
    },
    markEmailsSent: async (bookingId) => {
      markedBookingIds.push(bookingId)
    },
    hasBookingDataSource: () => true,
    adminEmailsRaw: 'boss@example.com',
    ...overrides,
  }

  return { deps, sentPayloads, markedBookingIds, booking }
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>
}

// --- parseBookingEmailRequestBody：只接受 bookingId ---

test('parseBookingEmailRequestBody rejects missing bookingId', () => {
  assert.equal(parseBookingEmailRequestBody(null), null)
  assert.equal(parseBookingEmailRequestBody({}), null)
  assert.equal(parseBookingEmailRequestBody({ bookingId: '' }), null)
  assert.equal(parseBookingEmailRequestBody({ bookingId: '   ' }), null)
  assert.equal(parseBookingEmailRequestBody({ to: 'attacker@example.com' }), null)
})

test('parseBookingEmailRequestBody rejects unknown recipient or content fields', () => {
  assert.equal(parseBookingEmailRequestBody({
    bookingId: 'booking-1',
    to: 'attacker@example.com',
    cc: ['attacker2@example.com'],
    bcc: 'attacker3@example.com',
    subject: '任意標題',
    html: '<script>x</script>',
    customerEmail: 'attacker4@example.com',
  }), null)
})

test('parseBookingEmailRequestBody rejects client supplied cancellationReason', () => {
  const longReason = 'a'.repeat(MAX_CANCELLATION_REASON_LENGTH + 100)
  assert.equal(parseBookingEmailRequestBody({ bookingId: 'booking-1', cancellationReason: longReason }), null)
  assert.equal(parseBookingEmailRequestBody({
    bookingId: 'booking-1',
    cancellationReason: { html: 'x' },
  }), null)
})

// --- resolveBookingEmailAccess ---

test('resolveBookingEmailAccess requires login (401)', () => {
  const decision = resolveBookingEmailAccess({ requester: null, booking: makeBooking(), adminEmailsRaw: '' })
  assert.deepEqual(decision, { allowed: false, status: 401 })
})

test('resolveBookingEmailAccess returns 404 for unknown booking', () => {
  const decision = resolveBookingEmailAccess({ requester: ownerRequester, booking: null, adminEmailsRaw: '' })
  assert.deepEqual(decision, { allowed: false, status: 404 })
})

test('resolveBookingEmailAccess hides other users bookings behind 404', () => {
  const decision = resolveBookingEmailAccess({
    requester: { id: 'someone-else', email: 'other@example.com' },
    booking: makeBooking(),
    adminEmailsRaw: '',
  })
  assert.deepEqual(decision, { allowed: false, status: 404 })
})

test('resolveBookingEmailAccess allows only the booking owner by user id', () => {
  assert.deepEqual(
    resolveBookingEmailAccess({ requester: ownerRequester, booking: makeBooking(), adminEmailsRaw: '' }),
    { allowed: true, isAdmin: false },
  )

  assert.deepEqual(
    resolveBookingEmailAccess({
      requester: { id: 'other-id', email: 'Customer@Example.com' },
      booking: makeBooking({ userId: null }),
      adminEmailsRaw: '',
    }),
    { allowed: false, status: 404 },
  )
})

test('resolveBookingEmailAccess allows ADMIN_EMAILS members to resend any booking', () => {
  const decision = resolveBookingEmailAccess({
    requester: { id: 'admin-id', email: 'boss@example.com' },
    booking: makeBooking(),
    adminEmailsRaw: 'boss@example.com',
  })
  assert.deepEqual(decision, { allowed: true, isAdmin: true })
})

// --- handleBookingEmailRequest：API 行為 ---

test('unauthenticated requests cannot read a booking or trigger email', async () => {
  let bookingReads = 0
  const { deps, sentPayloads } = makeDeps({
    getRequesterFromRequest: async () => null,
    getBookingById: async () => {
      bookingReads += 1
      return makeBooking()
    },
  })
  const response = await handleBookingEmailRequest(
    makeRequest({ bookingId: 'booking-1' }),
    deps,
  )

  assert.equal(response.status, 401)
  assert.equal(bookingReads, 0)
  assert.equal(sentPayloads.length, 0)
})

test('request body recipient and content fields fail closed', async () => {
  const { deps, sentPayloads } = makeDeps()
  const response = await handleBookingEmailRequest(
    makeRequest({
      bookingId: 'booking-1',
      to: 'attacker@example.com',
      cc: 'attacker@example.com',
      bcc: 'attacker@example.com',
      customerEmail: 'attacker@example.com',
      html: '<b>spam</b>',
    }),
    deps,
  )

  assert.equal(response.status, 400)
  assert.equal(sentPayloads.length, 0)
})

test('missing bookingId sends nothing (400)', async () => {
  const { deps, sentPayloads } = makeDeps()
  const response = await handleBookingEmailRequest(makeRequest({ to: 'attacker@example.com' }), deps)

  assert.equal(response.status, 400)
  assert.equal(sentPayloads.length, 0)
})

test('unknown bookingId sends nothing (404)', async () => {
  const { deps, sentPayloads } = makeDeps()
  const response = await handleBookingEmailRequest(makeRequest({ bookingId: 'not-exist' }), deps)

  assert.equal(response.status, 404)
  assert.equal(sentPayloads.length, 0)
})

test('customer email is derived from the booking record only', async () => {
  const { deps, sentPayloads } = makeDeps()
  await handleBookingEmailRequest(makeRequest({ bookingId: 'booking-1' }), deps)

  assert.equal(sentPayloads.length, 1)
  assert.equal(sentPayloads[0].customerEmail, 'customer@example.com')
  assert.equal(sentPayloads[0].customerName, '測試客人')
})

test('payload contains no admin recipient field (admin email comes from server env in sender)', async () => {
  const { deps, sentPayloads } = makeDeps()
  await handleBookingEmailRequest(makeRequest({ bookingId: 'booking-1' }), deps)

  assert.equal(sentPayloads.length, 1)
  assert.equal('adminEmail' in sentPayloads[0], false)
  assert.equal('to' in sentPayloads[0], false)
})

test('a logged-in non-admin cannot infer or resend another user booking email', async () => {
  const { deps, sentPayloads } = makeDeps({
    getRequesterFromRequest: async () => ({ id: 'someone-else', email: 'other@example.com' }),
  })
  const response = await handleBookingEmailRequest(makeRequest({ bookingId: 'booking-1' }), deps)

  assert.equal(response.status, 404)
  assert.equal(sentPayloads.length, 0)
})

test('an ADMIN_EMAILS member can trigger emails for any booking', async () => {
  const { deps, sentPayloads } = makeDeps({
    getRequesterFromRequest: async () => ({ id: 'admin-id', email: 'boss@example.com' }),
  })
  const response = await handleBookingEmailRequest(makeRequest({ bookingId: 'booking-1' }), deps)

  assert.equal(response.status, 200)
  assert.equal(sentPayloads.length, 1)
})

test('already-sent emails are not sent again', async () => {
  const alreadySentBooking = makeBooking({ emailSentToCustomer: true, emailSentToAdmin: true })
  const { deps, sentPayloads } = makeDeps({
    getBookingById: async () => alreadySentBooking,
  })
  const response = await handleBookingEmailRequest(makeRequest({ bookingId: 'booking-1' }), deps)
  const json = await readJson(response)

  assert.equal(response.status, 200)
  assert.equal(json.alreadySent, true)
  assert.equal(sentPayloads.length, 0)
})

test('fails closed with 503 when booking data source is unavailable', async () => {
  const { deps, sentPayloads } = makeDeps({ hasBookingDataSource: () => false })
  const response = await handleBookingEmailRequest(makeRequest({ bookingId: 'booking-1' }), deps)

  assert.equal(response.status, 503)
  assert.equal(sentPayloads.length, 0)
})

test('successful send marks booking flags via injected function', async () => {
  const { deps, markedBookingIds } = makeDeps()
  const response = await handleBookingEmailRequest(makeRequest({ bookingId: 'booking-1' }), deps)

  assert.equal(response.status, 200)
  assert.deepEqual(markedBookingIds, ['booking-1'])
})

test('marking sent flags is part of success and fails closed', async () => {
  const { deps } = makeDeps({
    markEmailsSent: async () => {
      throw new Error('database secret detail')
    },
  })
  const response = await handleBookingEmailRequest(makeRequest({ bookingId: 'booking-1' }), deps)
  const body = JSON.stringify(await readJson(response))

  assert.equal(response.status, 500)
  assert.equal(body.includes('database secret detail'), false)
})

test('unpaid bookings cannot trigger confirmation email', async () => {
  const unpaidBooking = makeBooking({ status: 'pending_payment', paymentStatus: 'pending' })
  const { deps, sentPayloads, markedBookingIds } = makeDeps({
    getBookingById: async () => unpaidBooking,
    requireTrustedPaidBooking: true,
  })
  const response = await handleBookingEmailRequest(makeRequest({ bookingId: 'booking-1' }), deps)

  assert.equal(response.status, 409)
  assert.equal(sentPayloads.length, 0)
  assert.equal(markedBookingIds.length, 0)
})

test('trusted paid booking can trigger confirmation email', async () => {
  const { deps, sentPayloads } = makeDeps({ requireTrustedPaidBooking: true })
  const response = await handleBookingEmailRequest(makeRequest({ bookingId: 'booking-1' }), deps)

  assert.equal(response.status, 200)
  assert.equal(sentPayloads.length, 1)
})

test('cancellation email requires cancelled state and derives stored reason', async () => {
  const cancellation = makeDeps({
    kind: 'cancellation',
    getBookingById: async () => makeBooking({
      status: 'cancelled',
      cancellationReason: '資料庫中的取消原因',
    }),
  })
  const response = await handleBookingEmailRequest(makeRequest({ bookingId: 'booking-1' }), cancellation.deps)
  assert.equal(response.status, 200)
  assert.equal(cancellation.sentPayloads.length, 1)
  assert.equal(cancellation.sentPayloads[0].cancellationReason, '資料庫中的取消原因')

  const notCancelled = makeDeps({ kind: 'cancellation' })
  const rejected = await handleBookingEmailRequest(makeRequest({ bookingId: 'booking-1' }), notCancelled.deps)
  assert.equal(rejected.status, 409)
  assert.equal(notCancelled.sentPayloads.length, 0)

  const injectedReason = makeDeps({
    kind: 'cancellation',
    getBookingById: async () => makeBooking({ status: 'cancelled', cancellationReason: '可信原因' }),
  })
  const invalid = await handleBookingEmailRequest(
    makeRequest({ bookingId: 'booking-1', cancellationReason: '攻擊者原因' }),
    injectedReason.deps,
  )
  assert.equal(invalid.status, 400)
  assert.equal(injectedReason.sentPayloads.length, 0)
})

test('send failures return a fixed message without key / env / stack details', async () => {
  const { deps } = makeDeps({
    sendEmails: async () => {
      throw new Error('Resend rejected key re_secret_12345 at https://api.resend.com/emails')
    },
  })
  const response = await handleBookingEmailRequest(makeRequest({ bookingId: 'booking-1' }), deps)
  const serialized = JSON.stringify(await readJson(response))

  assert.equal(response.status, 500)
  assert.equal(serialized.includes('re_secret_12345'), false)
  assert.equal(serialized.includes('resend'), false)
  assert.equal(serialized.includes('stack'), false)
  assert.equal(serialized.includes('RESEND_API_KEY'), false)
})

test('error responses for 400/401/404 contain no env details', async () => {
  const cases: Array<{ deps: HandleBookingEmailRequestDeps; body: unknown }> = [
    { deps: makeDeps().deps, body: {} },
    { deps: makeDeps({ getRequesterFromRequest: async () => null }).deps, body: { bookingId: 'booking-1' } },
    {
      deps: makeDeps({ getRequesterFromRequest: async () => ({ id: 'x', email: 'other@example.com' }) }).deps,
      body: { bookingId: 'booking-1' },
    },
    { deps: makeDeps().deps, body: { bookingId: 'not-exist' } },
  ]

  for (const { deps, body } of cases) {
    const response = await handleBookingEmailRequest(makeRequest(body), deps)
    const serialized = JSON.stringify(await readJson(response))
    assert.equal(serialized.includes('ADMIN_EMAILS'), false)
    assert.equal(serialized.includes('ADMIN_NOTIFY_EMAIL'), false)
    assert.equal(serialized.includes('boss@example.com'), false)
    assert.equal(serialized.includes('stack'), false)
  }
})

// --- buildBookingEmailPayload ---

test('buildBookingEmailPayload derives every field from the booking record', () => {
  const payload = buildBookingEmailPayload(makeBooking())

  assert.equal(payload.bookingId, 'booking-1')
  assert.equal(payload.customerEmail, 'customer@example.com')
  assert.equal(payload.amount, 3600)
  assert.equal(payload.startTimeText.includes('2026'), true)
  assert.equal(payload.endTimeText.includes('2026'), true)
  assert.deepEqual(Object.keys(payload).sort(), [
    'amount',
    'bookingId',
    'customerEmail',
    'customerName',
    'endTimeText',
    'planName',
    'startTimeText',
  ])
  for (const forbidden of [
    'customerPhone',
    'birthDate',
    'birthTime',
    'birthPlace',
    'gender',
    'isBirthTimeAccurate',
    'question',
  ]) {
    assert.equal(forbidden in payload, false)
  }
})

// --- 路由與寄信模組 source-level 檢查 ---

const projectRoot = process.cwd()

test('email routes only pass bookingId through the safe handler', () => {
  const routeFiles = [
    'src/app/api/email/send-booking-confirmation/route.ts',
    'src/app/api/email/send-booking-cancellation/route.ts',
  ]

  for (const routeFile of routeFiles) {
    const source = readFileSync(join(projectRoot, routeFile), 'utf8')
    assert.equal(source.includes('handleBookingEmailRequest'), true, `${routeFile} 應使用安全 handler`)
    assert.equal(source.includes('req.json()'), false, `${routeFile} 不應直接把 body 傳給寄信函式`)
  }
})

test('admin notification recipient comes from server env inside the mail sender', () => {
  const source = readFileSync(join(projectRoot, 'src/lib/email/sendBookingEmails.ts'), 'utf8')
  assert.equal(source.includes('process.env.ADMIN_NOTIFY_EMAIL'), true)
})

test('the request handler itself never talks to Resend directly', () => {
  const source = readFileSync(join(projectRoot, 'src/lib/email/bookingEmailRequestHandler.ts'), 'utf8')
  assert.equal(source.includes('api.resend.com'), false)
  assert.equal(source.includes('RESEND_API_KEY'), false)
})

async function runTests() {
  for (const { name, fn } of tests) {
    try {
      await fn()
      console.log(`✓ ${name}`)
    } catch (error) {
      console.error(`✗ ${name}`)
      throw error
    }
  }
}

void runTests()
