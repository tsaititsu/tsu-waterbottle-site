import assert from 'node:assert/strict'
import type { BookingFormInput } from '@/lib/mockBooking'
import {
  createSupabaseBooking,
  type CreateSupabaseBookingInput,
} from './bookings'

type CreateDependencies = NonNullable<Parameters<typeof createSupabaseBooking>[1]>

function validInput(): CreateSupabaseBookingInput {
  return {
    userId: '5f0b8f2e-1234-4c56-9abc-def012345678',
    slotId: 'db:slot-1',
    planId: 'ziwei-consultation-60',
    startTime: '2026-08-01T05:00:00.000Z',
    endTime: '2026-08-01T06:00:00.000Z',
    customerName: '測試會員',
    customerEmail: 'member@example.test',
    customerPhone: '0912345678',
    lineDisplayName: 'LINE 測試會員',
    gender: 'female',
    birthDate: '1990-01-01',
    birthTime: '12:00',
    birthPlace: '台北市',
    isBirthTimeAccurate: true,
    question: '想詢問近期方向',
    note: '測試備註',
  }
}

function bookingRow(userId: string) {
  return {
    id: 'booking-1',
    user_id: userId,
    plan_id: 'ziwei-consultation-60',
    plan_name: '水瓶先生論命',
    amount_twd: 3600,
    currency: 'TWD',
    status: 'pending_payment',
    payment_status: 'pending',
    customer_name: '測試會員',
    customer_email: 'member@example.test',
    customer_phone: '0912345678',
    line_display_name: 'LINE 測試會員',
    gender: 'female',
    birth_date: '1990-01-01',
    birth_time: '12:00:00',
    birth_place: '台北市',
    is_birth_time_accurate: true,
    question: '想詢問近期方向',
    note: '測試備註',
    starts_at: '2026-08-01T05:00:00.000Z',
    ends_at: '2026-08-01T06:00:00.000Z',
    timezone: 'Asia/Taipei',
    google_calendar_event_id: null,
    google_calendar_event_link: null,
    google_calendar_cancelled: false,
    confirmation_email_sent_to_customer: false,
    confirmation_email_sent_to_admin: false,
    cancellation_email_sent_to_customer: false,
    cancellation_email_sent_to_admin: false,
    cancelled_at: null,
    cancellation_reason: null,
    created_at: '2026-07-15T00:00:00.000Z',
    updated_at: '2026-07-15T00:00:00.000Z',
  }
}

function createDependencies() {
  const inserts: Array<Record<string, unknown>> = []
  let clientCreations = 0
  const client = {
    from(table: string) {
      if (table === 'consultation_plans') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'ziwei-consultation-60',
                  name: '水瓶先生論命',
                  duration_minutes: 60,
                  price_twd: 3600,
                  is_active: true,
                },
                error: null,
              }),
            }),
          }),
        }
      }

      if (table === 'bookings') {
        return {
          insert: (payload: Record<string, unknown>) => {
            inserts.push(payload)
            return {
              select: () => ({
                single: async () => ({
                  data: bookingRow(String(payload.user_id)),
                  error: null,
                }),
              }),
            }
          },
        }
      }

      throw new Error(`unexpected table: ${table}`)
    },
  } as unknown as ReturnType<CreateDependencies['getAdminClient']>

  const deps: CreateDependencies = {
    hasAdminConfig: () => true,
    getAdminClient: () => {
      clientCreations += 1
      return client
    },
    now: () => new Date('2026-07-15T00:00:00.000Z'),
  }

  return {
    deps,
    inserts,
    getClientCreations: () => clientCreations,
  }
}

async function testRequiredOwnerGuard() {
  for (const invalidUserId of [undefined, null, '', '   ']) {
    const mock = createDependencies()
    const input = {
      ...validInput(),
      userId: invalidUserId,
    } as unknown as CreateSupabaseBookingInput

    await assert.rejects(
      () => createSupabaseBooking(input, mock.deps),
      /userId/,
    )
    assert.equal(mock.getClientCreations(), 0)
    assert.equal(mock.inserts.length, 0)
  }
}

async function testTrustedOwnerAndInsertWhitelist() {
  const mock = createDependencies()
  const input = {
    ...validInput(),
    userId: '  5f0b8f2e-1234-4c56-9abc-def012345678  ',
    amount: 1,
    status: 'confirmed',
    paymentStatus: 'paid',
    refundStatus: 'refunded',
    unknownField: 'must-not-persist',
  } as CreateSupabaseBookingInput & Record<string, unknown>

  const booking = await createSupabaseBooking(input, mock.deps)
  const payload = mock.inserts[0]

  assert.equal(mock.getClientCreations(), 1)
  assert.equal(mock.inserts.length, 1)
  assert.equal(payload.user_id, '5f0b8f2e-1234-4c56-9abc-def012345678')
  assert.equal(payload.amount_twd, 3600)
  assert.equal(payload.status, 'pending_payment')
  assert.equal(payload.payment_status, 'pending')
  assert.equal(payload.currency, 'TWD')
  assert.equal(booking?.userId, '5f0b8f2e-1234-4c56-9abc-def012345678')

  assert.deepEqual(Object.keys(payload).sort(), [
    'accepted_notice_at',
    'amount_twd',
    'birth_date',
    'birth_place',
    'birth_time',
    'currency',
    'customer_email',
    'customer_name',
    'customer_phone',
    'ends_at',
    'gender',
    'is_birth_time_accurate',
    'line_display_name',
    'note',
    'payment_status',
    'plan_id',
    'plan_name',
    'question',
    'starts_at',
    'status',
    'timezone',
    'user_id',
  ].sort())

  for (const forbiddenField of [
    'userId',
    'amount',
    'paymentStatus',
    'refundStatus',
    'unknownField',
    'slotId',
  ]) {
    assert.equal(forbiddenField in payload, false)
  }
}

async function run() {
  await testRequiredOwnerGuard()
  await testTrustedOwnerAndInsertWhitelist()
  console.log('booking helper tests passed')
}

void run()
