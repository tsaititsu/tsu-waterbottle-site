import assert from 'node:assert/strict'
import { NextResponse } from 'next/server'
import type { RequireAdminUserResult } from '@/lib/auth/admin'
import type { AdminBookingListItem, AdminBookingsClient } from '@/lib/supabase/adminBookings'
import { handleAdminBookingsRequest, type AdminBookingsHandlerDeps } from './handler'

const request = new Request('https://example.test/api/admin/bookings')
const fakeSupabase = { source: 'verified-admin-client' } as unknown as AdminBookingsClient

const booking: AdminBookingListItem = {
  id: '11111111-2222-4333-8444-555555555555',
  planName: '合成測試方案',
  amountTwd: 3200,
  currency: 'TWD',
  status: 'confirmed',
  paymentStatus: 'paid',
  customerName: '合成測試客戶',
  customerEmail: 'synthetic@example.test',
  customerPhone: null,
  lineDisplayName: null,
  startsAt: '2026-08-01T02:00:00.000Z',
  endsAt: '2026-08-01T03:00:00.000Z',
  timezone: 'Asia/Taipei',
  confirmationEmailSentToCustomer: true,
  confirmationEmailSentToAdmin: false,
  cancellationEmailSentToCustomer: false,
  cancellationEmailSentToAdmin: false,
  cancelledAt: null,
  createdAt: '2026-07-20T02:00:00.000Z',
  updatedAt: '2026-07-20T02:00:00.000Z',
}

function authError(status: 401 | 403): RequireAdminUserResult {
  const error = status === 401 ? '請先登入後再使用後台。' : '沒有管理權限。'
  return { error: NextResponse.json({ ok: false, error }, { status }) }
}

function authorized(): RequireAdminUserResult {
  return { supabase: fakeSupabase, user: { id: 'admin-user', email: 'admin@example.test' } }
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>
}

async function main() {
  for (const status of [401, 403] as const) {
    let listCalls = 0
    const deps: AdminBookingsHandlerDeps = {
      requireAdmin: async () => authError(status),
      listBookings: async () => {
        listCalls += 1
        return { bookings: [booking], total: 1 }
      },
    }

    const response = await handleAdminBookingsRequest(request, deps)
    assert.equal(response.status, status)
    assert.equal(listCalls, 0, `${status} 時不得查詢預約資料`)
    assert.match(response.headers.get('cache-control') ?? '', /no-store/)
  }

  let receivedClient: AdminBookingsClient | null = null
  const success = await handleAdminBookingsRequest(request, {
    requireAdmin: async () => authorized(),
    listBookings: async (supabase, pagination) => {
      receivedClient = supabase
      assert.deepEqual(pagination, { limit: 50, offset: 0 })
      return { bookings: [booking], total: 1 }
    },
  })
  const successBody = await readJson(success)

  assert.equal(success.status, 200)
  assert.equal(receivedClient, fakeSupabase, '必須使用 requireAdminUser 回傳的 admin client')
  assert.deepEqual(successBody, {
    ok: true,
    bookings: [booking],
    meta: { count: 1, total: 1, limit: 50, offset: 0 },
  })
  assert.match(success.headers.get('cache-control') ?? '', /no-store/)

  const rawError = 'database details with synthetic@example.test'
  const logged: unknown[][] = []
  const originalConsoleError = console.error
  console.error = (...args: unknown[]) => logged.push(args)

  try {
    const failure = await handleAdminBookingsRequest(request, {
      requireAdmin: async () => authorized(),
      listBookings: async () => {
        throw new Error(rawError)
      },
    })
    const failureBody = await readJson(failure)
    const serializedFailure = JSON.stringify(failureBody)
    const serializedLog = JSON.stringify(logged)

    assert.equal(failure.status, 500)
    assert.deepEqual(failureBody, { ok: false, error: '讀取預約紀錄失敗。' })
    assert.equal(serializedFailure.includes(rawError), false)
    assert.equal(serializedLog.includes(rawError), false)
    assert.equal(serializedLog.includes('synthetic@example.test'), false)
    assert.match(failure.headers.get('cache-control') ?? '', /no-store/)
  } finally {
    console.error = originalConsoleError
  }

  console.log('✓ admin bookings handler security tests passed')
}

void main()
