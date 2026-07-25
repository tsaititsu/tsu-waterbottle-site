import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  cancelSupabaseBooking,
  createSupabaseBooking,
  getSupabaseBookingForRequester,
  listSupabaseBookings,
  MEMBER_BOOKING_COLUMNS,
  readBookingRow,
  type CancelSupabaseBookingInput,
  type CreateSupabaseBookingInput,
} from './bookings'

type CreateDependencies = NonNullable<Parameters<typeof createSupabaseBooking>[1]>

function validInput(): CreateSupabaseBookingInput {
  return {
    userId: '5f0b8f2e-1234-4c56-9abc-def012345678',
    slotId: 'db:11111111-1111-4111-8111-111111111111',
    planId: 'waterbottle-consultation-60',
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
    plan_id: 'waterbottle-consultation-60',
    plan_name: '資料庫正式方案',
    amount_twd: 4100,
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

assert.throws(
  () => readBookingRow({ ...bookingRow('user-1'), unexpected_sensitive_field: 'blocked' }),
  /booking_row_contract_mismatch/,
)
assert.throws(
  () => {
    const missingEmail: Record<string, unknown> = bookingRow('user-1')
    Reflect.deleteProperty(missingEmail, 'customer_email')
    return readBookingRow(missingEmail)
  },
  /booking_row_contract_mismatch/,
)
for (const invalidRow of [
  { ...bookingRow('user-1'), amount_twd: '3600' },
  { ...bookingRow('user-1'), status: 'admin_cancelled' },
  { ...bookingRow('user-1'), starts_at: 'not-a-date' },
  { ...bookingRow('user-1'), google_calendar_cancelled: 'false' },
]) {
  assert.throws(() => readBookingRow(invalidRow), /booking_row_contract_mismatch/)
}

function createDependencies() {
  const rpcCalls: Array<{ functionName: string; args: Record<string, unknown> }> = []
  let clientCreations = 0
  let rpcError: { code: string; message: string } | null = null
  const client = {
    rpc(functionName: string, args: Record<string, unknown>) {
      rpcCalls.push({ functionName, args })
      return {
        single: async () => ({
          data: rpcError ? null : bookingRow(String(args.p_user_id)),
          error: rpcError,
        }),
      }
    },
  } as unknown as ReturnType<CreateDependencies['getAdminClient']>

  const deps: CreateDependencies = {
    hasAdminConfig: () => true,
    getAdminClient: () => {
      clientCreations += 1
      return client
    },
  }

  return {
    deps,
    rpcCalls,
    setRpcError(error: { code: string; message: string } | null) {
      rpcError = error
    },
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
    assert.equal(mock.rpcCalls.length, 0)
  }
}

async function testTrustedOwnerAndAtomicRpcWhitelist() {
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
  const rpcCall = mock.rpcCalls[0]

  assert.equal(mock.getClientCreations(), 1)
  assert.equal(mock.rpcCalls.length, 1)
  assert.equal(rpcCall.functionName, 'create_booking_with_available_slot')
  assert.equal(rpcCall.args.p_user_id, '5f0b8f2e-1234-4c56-9abc-def012345678')
  assert.equal(rpcCall.args.p_slot_id, '11111111-1111-4111-8111-111111111111')
  assert.equal(rpcCall.args.p_plan_id, 'waterbottle-consultation-60')
  assert.equal(booking?.planName, '資料庫正式方案')
  assert.equal(booking?.amount, 4100)
  assert.equal(booking?.userId, '5f0b8f2e-1234-4c56-9abc-def012345678')

  assert.deepEqual(Object.keys(rpcCall.args).sort(), [
    'p_birth_date',
    'p_birth_place',
    'p_birth_time',
    'p_customer_email',
    'p_customer_name',
    'p_customer_phone',
    'p_gender',
    'p_is_birth_time_accurate',
    'p_line_display_name',
    'p_note',
    'p_plan_id',
    'p_question',
    'p_slot_id',
    'p_user_id',
  ].sort())

  for (const forbiddenField of [
    'userId',
    'amount',
    'paymentStatus',
    'refundStatus',
    'unknownField',
    'startTime',
    'endTime',
    'accepted_notice_at',
    'amount_twd',
    'plan_name',
    'status',
  ]) {
    assert.equal(forbiddenField in rpcCall.args, false)
  }
}

async function testAtomicRpcErrorMapping() {
  const slotUnavailable = createDependencies()
  slotUnavailable.setRpcError({
    code: 'WB002',
    message: 'database detail must not cross repository boundary',
  })
  await assert.rejects(
    () => createSupabaseBooking(validInput(), slotUnavailable.deps),
    (error: unknown) =>
      error instanceof Error &&
      error.message === 'booking_slot_unavailable' &&
      (error as Error & { code?: string }).code === 'booking_slot_unavailable',
  )

  const planUnavailable = createDependencies()
  planUnavailable.setRpcError({
    code: 'WB001',
    message: 'database detail must not cross repository boundary',
  })
  await assert.rejects(
    () => createSupabaseBooking(validInput(), planUnavailable.deps),
    (error: unknown) =>
      error instanceof Error &&
      error.message === 'booking_plan_unavailable' &&
      (error as Error & { code?: string }).code === 'booking_plan_unavailable',
  )
}

function repositoryDependencies(result: unknown) {
  const calls = {
    table: '',
    update: null as Record<string, unknown> | null,
    filters: [] as Array<[string, unknown]>,
    greaterThan: [] as Array<[string, unknown]>,
    select: [] as string[],
  }

  const builder = {
    select(columns: string) {
      calls.select.push(columns)
      return builder
    },
    update(patch: Record<string, unknown>) {
      calls.update = patch
      return builder
    },
    eq(column: string, value: unknown) {
      calls.filters.push([column, value])
      return builder
    },
    gt(column: string, value: unknown) {
      calls.greaterThan.push([column, value])
      return builder
    },
    maybeSingle: async () => ({ data: result, error: null }),
  }
  const client = {
    from(table: string) {
      calls.table = table
      return builder
    },
  } as unknown as ReturnType<CreateDependencies['getAdminClient']>

  return {
    calls,
    deps: {
      hasAdminConfig: () => true,
      getAdminClient: () => client,
    },
  }
}

async function testRequesterScopedRead() {
  let context = repositoryDependencies(bookingRow('user-1'))
  const ownerBooking = await getSupabaseBookingForRequester(
    'booking-1',
    'user-1',
    false,
    context.deps,
  )
  assert.equal(ownerBooking?.id, 'booking-1')
  assert.deepEqual(context.calls.filters, [
    ['id', 'booking-1'],
    ['user_id', 'user-1'],
  ])

  context = repositoryDependencies(bookingRow('other-user'))
  await getSupabaseBookingForRequester('booking-1', 'admin-user', true, context.deps)
  assert.deepEqual(context.calls.filters, [['id', 'booking-1']])
}

async function testConditionalCancellationTransition() {
  const input: CancelSupabaseBookingInput = {
    bookingId: 'booking-1',
    requesterId: 'user-1',
    requesterIsAdmin: false,
    expectedStartTime: '2026-08-03T00:00:00.000Z',
    expectedUpdatedAt: '2026-07-31T12:00:00.000Z',
    cancelledAt: '2026-08-01T00:00:00.000Z',
    cancellationReason: '改期',
  }
  const cancelledRow = {
    ...bookingRow('user-1'),
    status: 'cancelled',
    starts_at: input.expectedStartTime,
    updated_at: input.cancelledAt,
    cancelled_at: input.cancelledAt,
    cancellation_reason: input.cancellationReason,
  }
  const context = repositoryDependencies(cancelledRow)
  const result = await cancelSupabaseBooking(input, context.deps)

  assert.equal(result?.status, 'cancelled')
  assert.deepEqual(context.calls.update, {
    status: 'cancelled',
    cancelled_at: input.cancelledAt,
    cancellation_reason: input.cancellationReason,
  })
  assert.deepEqual(context.calls.filters, [
    ['id', 'booking-1'],
    ['status', 'confirmed'],
    ['payment_status', 'paid'],
    ['starts_at', input.expectedStartTime],
    ['updated_at', input.expectedUpdatedAt],
    ['user_id', 'user-1'],
  ])
  assert.deepEqual(context.calls.greaterThan, [
    ['starts_at', '2026-08-02T00:00:00.000Z'],
  ])
}

async function testMemberListProjectionAndPagination() {
  const calls = {
    columns: '',
    count: '',
    userId: '',
    order: '',
    range: [] as number[],
  }
  const memberRow = {
    id: 'booking-1',
    plan_name: '水瓶先生論命',
    status: 'confirmed',
    payment_status: 'paid',
    question: '想詢問近期方向',
    starts_at: '2026-08-01T05:00:00.000Z',
    ends_at: '2026-08-01T06:00:00.000Z',
    google_calendar_event_id: null,
    google_calendar_cancelled: false,
    confirmation_email_sent_to_customer: true,
    cancellation_email_sent_to_customer: false,
    cancellation_email_sent_to_admin: false,
    cancelled_at: null,
    cancellation_reason: null,
    created_at: '2026-07-15T00:00:00.000Z',
    updated_at: '2026-07-15T00:00:00.000Z',
  }
  const query = {
    select(columns: string, options: { count: string }) {
      calls.columns = columns
      calls.count = options.count
      return query
    },
    eq(_column: string, value: string) {
      calls.userId = value
      return query
    },
    order(column: string) {
      calls.order = column
      return query
    },
    range(from: number, to: number) {
      calls.range = [from, to]
      return Promise.resolve({ data: [memberRow], error: null, count: 31 })
    },
  }
  const result = await listSupabaseBookings(
    ' user-1 ',
    { limit: 20, offset: 20 },
    {
      hasAdminConfig: () => true,
      getAdminClient: () => ({
        from: () => query,
      } as unknown as ReturnType<CreateDependencies['getAdminClient']>),
    },
  )

  assert.deepEqual(calls, {
    columns: MEMBER_BOOKING_COLUMNS,
    count: 'exact',
    userId: 'user-1',
    order: 'starts_at',
    range: [20, 39],
  })
  assert.equal(result.total, 31)
  assert.equal(result.bookings.length, 1)
  const serialized = JSON.stringify(result.bookings[0])
  for (const forbidden of [
    'customerEmail',
    'customerPhone',
    'customerName',
    'birthDate',
    'birthTime',
    'amount',
    'userId',
  ]) {
    assert.equal(serialized.includes(forbidden), false)
  }
}

async function run() {
  await testRequiredOwnerGuard()
  await testTrustedOwnerAndAtomicRpcWhitelist()
  await testAtomicRpcErrorMapping()
  await testRequesterScopedRead()
  await testConditionalCancellationTransition()
  await testMemberListProjectionAndPagination()
  const source = readFileSync(join(process.cwd(), 'src/lib/supabase/bookings.ts'), 'utf8')
  assert.doesNotMatch(source, /\.select\(['"]\*['"]\)/)
  assert.doesNotMatch(source, /\.from\(['"]bookings['"]\)[\s\S]*?\.insert\(/)
  assert.match(source, /\.rpc\(['"]create_booking_with_available_slot['"]/)
  console.log('booking helper tests passed')
}

void run()
