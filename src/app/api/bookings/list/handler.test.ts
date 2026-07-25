import assert from 'node:assert/strict'
import { handleBookingListRequest, type BookingListHandlerDeps } from './handler'
import type { BookingMemberListItem } from '../../../../lib/bookings/types'

const booking = {
  id: 'booking-1',
  status: 'confirmed',
} as BookingMemberListItem

function dependencies(overrides: Partial<BookingListHandlerDeps> = {}) {
  const calls = {
    reads: 0,
    userIds: [] as string[],
    pagination: [] as Array<{ limit: number; offset: number }>,
  }
  const deps: BookingListHandlerDeps = {
    getRequesterFromRequest: async () => ({ id: 'user-1', email: 'member@example.com' }),
    listBookingsByUserId: async (userId, pagination) => {
      calls.reads += 1
      calls.userIds.push(userId)
      calls.pagination.push(pagination)
      return { bookings: [booking], total: 1 }
    },
    ...overrides,
  }
  return { calls, deps }
}

async function run() {
  let context = dependencies({ getRequesterFromRequest: async () => null })
  let response = await handleBookingListRequest(
    new Request('http://localhost/api/bookings/list'),
    context.deps,
  )
  assert.equal(response.status, 401)
  assert.equal(context.calls.reads, 0)

  context = dependencies()
  response = await handleBookingListRequest(
    new Request('http://localhost/api/bookings/list'),
    context.deps,
  )
  assert.equal(response.status, 200)
  assert.deepEqual(context.calls.userIds, ['user-1'])
  assert.deepEqual(context.calls.pagination, [{ limit: 20, offset: 0 }])
  assert.deepEqual(await response.json(), {
    ok: true,
    bookings: [booking],
    meta: { total: 1, limit: 20, offset: 0 },
  })

  context = dependencies()
  response = await handleBookingListRequest(
    new Request('http://localhost/api/bookings/list?limit=50&offset=100'),
    context.deps,
  )
  assert.equal(response.status, 200)
  assert.deepEqual(context.calls.pagination, [{ limit: 50, offset: 100 }])

  for (const query of ['limit=0', 'limit=51', 'limit=1.5', 'offset=-1', 'offset=1.5']) {
    context = dependencies()
    response = await handleBookingListRequest(
      new Request(`http://localhost/api/bookings/list?${query}`),
      context.deps,
    )
    assert.equal(response.status, 400)
    assert.equal(context.calls.reads, 0)
  }

  context = dependencies({
    listBookingsByUserId: async () => {
      throw new Error('database secret detail')
    },
  })
  response = await handleBookingListRequest(
    new Request('http://localhost/api/bookings/list'),
    context.deps,
  )
  assert.equal(response.status, 500)
  assert.equal(JSON.stringify(await response.json()).includes('database secret detail'), false)

  console.log('booking list handler tests passed')
}

void run()
