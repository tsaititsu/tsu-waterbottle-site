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
  note: null,
  confirmation_email_sent_to_customer: true,
  confirmation_email_sent_to_admin: false,
  cancellation_email_sent_to_customer: false,
  cancellation_email_sent_to_admin: false,
  cancelled_at: null,
  cancellation_reason: null,
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
assert.equal(ADMIN_BOOKING_LIMIT, 100)

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

const mapped = mapAdminBookingRow(injectedRow) as unknown as Record<string, unknown>
for (const key of forbiddenKeys) assert.equal(key in mapped, false, `${key} 不得出現在輸出`)
assert.equal('injected_unknown_field' in mapped, false)
assert.equal(mapped.customerPhone, null)
assert.equal(mapped.lineDisplayName, null)
assert.equal(mapped.note, null)
assert.equal(mapped.cancelledAt, null)
assert.equal(mapped.cancellationReason, null)
assert.equal(JSON.stringify(mapped).includes('undefined'), false)

async function runListTest() {
  const calls = {
    table: '',
    columns: '',
    orderColumn: '',
    ascending: true,
    limit: 0,
  }

  const mockClient = {
    from(table: string) {
      calls.table = table
      return {
        select(columns: string) {
          calls.columns = columns
          return {
            order(column: string, options: { ascending: boolean }) {
              calls.orderColumn = column
              calls.ascending = options.ascending
              return {
                limit(limit: number) {
                  calls.limit = limit
                  return Promise.resolve({ data: [injectedRow], error: null })
                },
              }
            },
          }
        },
      }
    },
  } as unknown as Parameters<typeof listAdminBookings>[0]

  const result = await listAdminBookings(mockClient)

  assert.deepEqual(calls, {
    table: 'bookings',
    columns: ADMIN_BOOKING_COLUMNS,
    orderColumn: 'starts_at',
    ascending: false,
    limit: 100,
  })
  assert.equal(result.length, 1)
  assert.equal('injected_unknown_field' in (result[0] as unknown as Record<string, unknown>), false)
  for (const key of forbiddenKeys) {
    assert.equal(key in (result[0] as unknown as Record<string, unknown>), false, `${key} 不得由查詢 helper 輸出`)
  }

  console.log('✓ admin booking mapper and query allowlist tests passed')
}

void runListTest()
