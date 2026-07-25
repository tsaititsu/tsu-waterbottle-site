import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { UserProfile } from '@/lib/auth/types'
import type { BookingRecord } from '@/lib/bookings/types'
import * as bookingCreateRoute from './route'
import { handleBookingCreateRequest } from './handler'

const tests: Array<{ name: string; fn: () => Promise<void> }> = []
const BEARER_USER_ID = '5f0b8f2e-1234-4c56-9abc-def012345678'
const LINE_USER_ID = '6f0b8f2e-1234-4c56-9abc-def012345678'

type RouteDependencies = Parameters<typeof handleBookingCreateRequest>[1]

type Calls = {
  bearer: number
  line: number
  booking: number
  bookingInputs: Array<Record<string, unknown>>
}

function test(name: string, fn: () => Promise<void>) {
  tests.push({ name, fn })
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    slotId: 'db:11111111-1111-4111-8111-111111111111',
    planId: 'waterbottle-consultation-60',
    startTime: 'attacker-start-time',
    endTime: 'attacker-end-time',
    customerName: '測試會員',
    customerEmail: 'member@example.test',
    gender: 'female',
    birthDate: '1990-01-01',
    birthTime: '12:00',
    isBirthTimeAccurate: true,
    question: '想詢問近期方向',
    ...overrides,
  }
}

function request(
  body: Record<string, unknown>,
  options: { authorization?: string; lineCookie?: string } = {},
) {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (options.authorization !== undefined) {
    headers.set('authorization', options.authorization)
  }
  if (options.lineCookie !== undefined) {
    headers.set('cookie', `waterbottle_line_session=${options.lineCookie}`)
  }

  return new Request('https://example.test/api/bookings/create', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

function lineUser(id = LINE_USER_ID): UserProfile {
  return {
    id,
    provider: 'line',
    lineUserId: 'line-provider-id',
    displayName: 'LINE 會員',
    createdAt: '2026-07-01T00:00:00.000Z',
    lastLoginAt: '2026-07-15T00:00:00.000Z',
  }
}

function dependencies(input: {
  bearerUserId?: string | null
  lineCookieResult?: UserProfile | null
} = {}) {
  const calls: Calls = {
    bearer: 0,
    line: 0,
    booking: 0,
    bookingInputs: [],
  }

  const deps: RouteDependencies = {
    getBearerUserId: async () => {
      calls.bearer += 1
      return input.bearerUserId === undefined ? BEARER_USER_ID : input.bearerUserId
    },
    readLineSession: () => {
      calls.line += 1
      return input.lineCookieResult === undefined ? lineUser() : input.lineCookieResult
    },
    getPlan: (planId) => planId === 'waterbottle-consultation-60'
      ? {
          id: planId,
          name: '水瓶先生論命',
          durationMinutes: 60,
          price: 3600,
          description: '測試方案',
        }
      : undefined,
    createBooking: async (bookingInput) => {
      calls.booking += 1
      calls.bookingInputs.push(bookingInput as unknown as Record<string, unknown>)
      return {
        id: 'booking-1',
        planName: '資料庫正式方案',
        amount: 4100,
      } as BookingRecord
    },
  }

  return { calls, deps }
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>
}

function internalTestError() {
  const error = new Error('internal-test-error') as Error & {
    code?: string
    details?: string
    hint?: string
  }
  error.stack = 'internal-test-stack'
  error.code = 'TEST_DB_CODE'
  error.details = 'test constraint details'
  error.hint = 'test hint'
  return error
}

async function withDebugErrorsEnabled(run: () => Promise<void>) {
  const previousValue = process.env.NEXT_PUBLIC_ENABLE_DEBUG_ERRORS
  process.env.NEXT_PUBLIC_ENABLE_DEBUG_ERRORS = 'true'

  try {
    await run()
  } finally {
    if (previousValue === undefined) {
      delete process.env.NEXT_PUBLIC_ENABLE_DEBUG_ERRORS
    } else {
      process.env.NEXT_PUBLIC_ENABLE_DEBUG_ERRORS = previousValue
    }
  }
}

async function assertSafeInternalErrorResponse(response: Response) {
  assert.equal(response.status, 500)

  const body = await readJson(response)
  assert.deepEqual(body, {
    ok: false,
    message: '建立預約失敗',
  })

  const serializedBody = JSON.stringify(body)
  for (const internalDetail of [
    'internal-test-error',
    'internal-test-stack',
    'TEST_DB_CODE',
    'test constraint details',
    'test hint',
  ]) {
    assert.equal(serializedBody.includes(internalDetail), false)
  }
}

function assertNoWriteSideEffects(calls: Calls) {
  assert.equal(calls.booking, 0)
}

test('有效 Bearer 使用驗證後 owner 並維持成功 response contract', async () => {
  const { calls, deps } = dependencies()
  const response = await handleBookingCreateRequest(
    request(validBody(), { authorization: 'Bearer valid-token' }),
    deps,
  )

  assert.equal(response.status, 200)
  assert.equal(calls.bearer, 1)
  assert.equal(calls.line, 0)
  assert.equal(calls.bookingInputs[0].userId, BEARER_USER_ID)
  assert.equal(calls.bookingInputs[0].slotId, 'db:11111111-1111-4111-8111-111111111111')
  assert.equal('startTime' in calls.bookingInputs[0], false)
  assert.equal('endTime' in calls.bookingInputs[0], false)
  assert.deepEqual(await readJson(response), {
    ok: true,
    bookingId: 'booking-1',
    planName: '資料庫正式方案',
    amount: 4100,
  })
})

test('有效 Bearer 只要 body 出現 userId 就在任何寫入前回 400', async () => {
  for (const userId of ['other-user', '', null]) {
    const { calls, deps } = dependencies()
    const response = await handleBookingCreateRequest(
      request(validBody({ userId }), { authorization: 'Bearer valid-token' }),
      deps,
    )

    assert.equal(response.status, 400)
    assertNoWriteSideEffects(calls)
  }
})

test('沒有 Bearer 時有效 LINE Cookie 使用 Session 的 Supabase user ID', async () => {
  const { calls, deps } = dependencies({ lineCookieResult: lineUser() })
  const response = await handleBookingCreateRequest(
    request(validBody(), { lineCookie: 'valid-line-cookie' }),
    deps,
  )

  assert.equal(response.status, 200)
  assert.equal(calls.bearer, 0)
  assert.equal(calls.line, 1)
  assert.equal(calls.bookingInputs[0].userId, LINE_USER_ID)
})

test('沒有 Bearer 與 LINE Cookie 時回 401 且不建立 service client', async () => {
  const { calls, deps } = dependencies()
  const response = await handleBookingCreateRequest(request(validBody()), deps)

  assert.equal(response.status, 401)
  assert.equal(calls.line, 0)
  assertNoWriteSideEffects(calls)
})

test('無效 LINE Cookie 時回 401 且沒有寫入副作用', async () => {
  const { calls, deps } = dependencies({ lineCookieResult: null })
  const response = await handleBookingCreateRequest(
    request(validBody(), { lineCookie: 'invalid-line-cookie' }),
    deps,
  )

  assert.equal(response.status, 401)
  assert.equal(calls.line, 1)
  assertNoWriteSideEffects(calls)
})

test('過期 LINE Cookie 由 verifier 拒絕並在 service client 前回 401', async () => {
  const { calls, deps } = dependencies({ lineCookieResult: null })
  const response = await handleBookingCreateRequest(
    request(validBody(), { lineCookie: 'expired-line-cookie' }),
    deps,
  )

  assert.equal(response.status, 401)
  assertNoWriteSideEffects(calls)
})

test('無效 Bearer 即使有有效 LINE Cookie也回 401 且不 fallback', async () => {
  const { calls, deps } = dependencies({ bearerUserId: null, lineCookieResult: lineUser() })
  const response = await handleBookingCreateRequest(
    request(validBody(), {
      authorization: 'Bearer invalid-token',
      lineCookie: 'valid-line-cookie',
    }),
    deps,
  )

  assert.equal(response.status, 401)
  assert.equal(calls.bearer, 1)
  assert.equal(calls.line, 0)
  assertNoWriteSideEffects(calls)
})

test('過期 Bearer 回 401 且沒有寫入副作用', async () => {
  const { calls, deps } = dependencies({ bearerUserId: null })
  const response = await handleBookingCreateRequest(
    request(validBody(), { authorization: 'Bearer expired-token' }),
    deps,
  )

  assert.equal(response.status, 401)
  assertNoWriteSideEffects(calls)
})

test('格式錯誤 Authorization Header 回 401 且不呼叫驗證或 LINE fallback', async () => {
  for (const authorization of ['Basic token', 'Bearer', 'Bearer  token', 'bearer token']) {
    const { calls, deps } = dependencies({ lineCookieResult: lineUser() })
    const response = await handleBookingCreateRequest(
      request(validBody(), { authorization, lineCookie: 'valid-line-cookie' }),
      deps,
    )

    assert.equal(response.status, 401)
    assert.equal(calls.bearer, 0)
    assert.equal(calls.line, 0)
    assertNoWriteSideEffects(calls)
  }
})

test('未登入即使 body 帶 userId 仍先回 401', async () => {
  const { calls, deps } = dependencies()
  const response = await handleBookingCreateRequest(
    request(validBody({ userId: 'attacker-owner' })),
    deps,
  )

  assert.equal(response.status, 401)
  assertNoWriteSideEffects(calls)
})

test('Route 對未知欄位 fail closed 且不建立資料', async () => {
  const { calls, deps } = dependencies()
  const response = await handleBookingCreateRequest(
    request(validBody({
      amount: 1,
      planName: '攻擊者方案',
      status: 'confirmed',
      paymentStatus: 'paid',
      refundStatus: 'refunded',
      currency: 'USD',
      createdAt: 'attacker-created-at',
      unknownField: 'must-not-reach-helper',
    }), { authorization: 'Bearer valid-token' }),
    deps,
  )

  assert.equal(response.status, 400)
  assertNoWriteSideEffects(calls)
})

test('Debug flag 開啟且方案依賴失敗時 500 仍固定且不洩漏', async () => {
  await withDebugErrorsEnabled(async () => {
    const { calls, deps } = dependencies()

    const response = await handleBookingCreateRequest(
      request(validBody(), { authorization: 'Bearer valid-token' }),
      {
        ...deps,
        getPlan: () => {
          throw internalTestError()
        },
      },
    )

    await assertSafeInternalErrorResponse(response)
    assertNoWriteSideEffects(calls)
  })
})

test('Debug flag 開啟且 atomic Booking RPC 失敗時 500 仍固定', async () => {
  await withDebugErrorsEnabled(async () => {
    const { deps } = dependencies()

    const response = await handleBookingCreateRequest(
      request(validBody(), { authorization: 'Bearer valid-token' }),
      {
        ...deps,
        createBooking: async () => {
          throw internalTestError()
        },
      },
    )

    await assertSafeInternalErrorResponse(response)
  })
})

test('Booking data source unavailable returns 503 without a separate slot mutation', async () => {
  const { deps } = dependencies()

  const response = await handleBookingCreateRequest(
    request(validBody(), { authorization: 'Bearer valid-token' }),
    {
      ...deps,
      createBooking: async () => null,
    },
  )

  assert.equal(response.status, 503)
  assert.equal(JSON.stringify(await readJson(response)).includes('mock-booking'), false)
})

test('Atomic RPC 回報 slot unavailable 時固定映射 409 且只呼叫單一寫入邊界', async () => {
  const { calls, deps } = dependencies()
  const error = Object.assign(new Error('internal database detail'), {
    code: 'booking_slot_unavailable',
  })

  const response = await handleBookingCreateRequest(
    request(validBody(), { authorization: 'Bearer valid-token' }),
    {
      ...deps,
      createBooking: async (bookingInput) => {
        calls.booking += 1
        calls.bookingInputs.push(bookingInput as unknown as Record<string, unknown>)
        throw error
      },
    },
  )

  assert.equal(response.status, 409)
  assert.equal(calls.booking, 1)
  assert.deepEqual(await readJson(response), {
    ok: false,
    message: '此時段已無法預約，請重新選擇其他時段。',
  })
})

test('Route entry 只匯出合法 POST 且 production POST 使用受測 handler', async () => {
  const exportKeys = Object.keys(bookingCreateRoute)
    .filter((key) => key !== 'default')
    .sort()

  assert.deepEqual(exportKeys, ['POST'])

  const response = await bookingCreateRoute.POST(request(validBody()))
  assert.equal(response.status, 401)
  assert.deepEqual(await readJson(response), {
    ok: false,
    message: '請先登入會員，再建立預約。',
  })

  const source = readFileSync(join(process.cwd(), 'src/app/api/bookings/create/route.ts'), 'utf8')
  assert.doesNotMatch(source, /\.from\(|\.insert\(|\.update\(|\.delete\(/)
  assert.match(source, /defaultBookingCreateDependencies/)

  const dependencySource = readFileSync(
    join(process.cwd(), 'src/lib/bookings/createBookingDependencies.server.ts'),
    'utf8',
  )
  assert.doesNotMatch(dependencySource, /claimDbSlot|claimDefaultSlot|\.from\(/)
  assert.match(dependencySource, /createSupabaseBooking/)

  const publicSlotSource = readFileSync(
    join(process.cwd(), 'src/app/api/booking-slots/route.ts'),
    'utf8',
  )
  assert.doesNotMatch(publicSlotSource, /listDefaultBookingSlots|default:/)
  assert.match(publicSlotSource, /id:\s*`db:\$\{slot\.id\}`/)
})

test('BookingForm create request 不再傳 userId 且保留 Bearer 邏輯與 API 路徑', async () => {
  const source = readFileSync(join(process.cwd(), 'src/components/BookingForm.tsx'), 'utf8')

  assert.match(source, /fetch\('\/api\/bookings\/create'/)
  assert.match(source, /Authorization: `Bearer \$\{accessToken\}`/)
  assert.match(source, /body: JSON\.stringify\(input\)/)
  assert.doesNotMatch(source, /\n\s*userId:\s*user\.id,/)
})

async function run() {
  for (const entry of tests) {
    await entry.fn()
  }

  console.log(`booking create route tests passed (${tests.length})`)
}

void run()
