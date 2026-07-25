import assert from 'node:assert/strict'
import {
  ADMIN_BOOKING_COLUMNS,
  ADMIN_BOOKING_LIMIT,
  listAdminBookings,
  mapAdminBookingRow,
  type AdminBookingRow,
} from './adminBookings'

const syntheticRow: AdminBookingRow = {
  id: '11111111-2222-4333-8444-555555555555',
  plan_name: '合成測試方案',
  amount_twd: 3200,
  currency: 'TWD',
  status: 'confirmed',
  payment_status: 'paid',
  customer_name: '合成測試客戶',
  customer_email: 'synthetic@example.test',
  customer_phone: null,
  line_display_name: null,
  starts_at: '2026-08-01T02:00:00.000Z',
  ends_at: '2026-08-01T03:00:00.000Z',
  timezone: 'Asia/Taipei',
  confirmation_email_sent_to_customer: true,
  confirmation_email_sent_to_admin: false,
  cancellation_email_sent_to_customer: false,
  cancellation_email_sent_to_admin: false,
  cancelled_at: null,
  created_at: '2026-07-20T02:00:00.000Z',
  updated_at: '2026-07-20T02:00:00.000Z',
}

const forbiddenKeys = [
  'userId',
  'user_id',
  'birthDate',
  'birth_date',
  'birthTime',
  'birth_time',
  'question',
  'gender',
  'googleCalendarEventId',
  'rawPayload',
]

assert.equal(ADMIN_BOOKING_COLUMNS.includes('*'), false)
assert.equal(ADMIN_BOOKING_LIMIT, 50)

const injectedRow = {
  ...syntheticRow,
  user_id: 'should-not-leak',
  birth_date: '1990-01-01',
  birth_time: '12:00:00',
  question: 'should-not-leak',
  gender: 'should-not-leak',
  google_calendar_event_id: 'should-not-leak',
  rawPayload: { should: 'not-leak' },
  injected_unknown_field: 'should-not-leak',
} as AdminBookingRow

assert.throws(() => mapAdminBookingRow(injectedRow), /admin_booking_row_invalid/)

const mapped = mapAdminBookingRow(syntheticRow) as unknown as Record<string, unknown>
for (const key of forbiddenKeys) assert.equal(key in mapped, false, `${key} 不得出現在輸出`)
assert.equal('injected_unknown_field' in mapped, false)
assert.equal(mapped.customerName, '合…戶')
assert.equal(mapped.customerEmail, 's***c@example.test')
assert.equal(mapped.customerPhone, '未提供')
assert.equal(mapped.lineDisplayName, '未提供')
assert.equal(mapped.cancelledAt, null)
assert.equal(JSON.stringify(mapped).includes('undefined'), false)
for (const invalidRow of [
  { ...syntheticRow, amount_twd: 1.5 },
  { ...syntheticRow, currency: 'USD' },
  { ...syntheticRow, timezone: 'UTC' },
  { ...syntheticRow, status: 'admin_override' },
  { ...syntheticRow, payment_status: 'manual_paid' },
]) {
  assert.throws(() => mapAdminBookingRow(invalidRow), /admin_booking_row_invalid/)
}

async function runListTest() {
  const calls = {
    table: '',
    columns: '',
    orderColumn: '',
    ascending: true,
    selectOptions: null as { count: string } | null,
    range: [] as number[],
  }

  const mockClient = {
    from(table: string) {
      calls.table = table
      return {
        select(columns: string, options: { count: string }) {
          calls.columns = columns
          calls.selectOptions = options
          return {
            order(column: string, options: { ascending: boolean }) {
              calls.orderColumn = column
              calls.ascending = options.ascending
              return {
                range(from: number, to: number) {
                  calls.range = [from, to]
                  return Promise.resolve({ data: [syntheticRow], error: null, count: 1 })
                },
              }
            },
          }
        },
      }
    },
  } as unknown as Parameters<typeof listAdminBookings>[0]

  const result = await listAdminBookings(mockClient, { limit: 25, offset: 50 })

  assert.deepEqual(calls, {
    table: 'bookings',
    columns: ADMIN_BOOKING_COLUMNS,
    orderColumn: 'starts_at',
    ascending: false,
    selectOptions: { count: 'exact' },
    range: [50, 74],
  })
  assert.equal(result.total, 1)
  assert.equal(result.bookings.length, 1)
  assert.equal('injected_unknown_field' in (result.bookings[0] as unknown as Record<string, unknown>), false)
  for (const key of forbiddenKeys) {
    assert.equal(key in (result.bookings[0] as unknown as Record<string, unknown>), false, `${key} 不得由查詢 helper 輸出`)
  }

  console.log('✓ admin booking mapper and query allowlist tests passed')
}

void runListTest()
