import assert from 'node:assert/strict'
import {
  buildProductOrderPaidUpdatePayload,
  decideProductOrderPaidSync,
  getProductOrderPaidSyncContext,
  syncProductOrderAfterPaymentPaid,
  type ProductOrderPaidSyncContext,
  type ProductOrderPaidSyncContextRow,
} from './productOrderSync'

type MockSupabaseClient = NonNullable<Parameters<typeof getProductOrderPaidSyncContext>[1]>
type MockSupabaseCalls = {
  tables: string[]
  selects: string[]
  updates: Record<string, unknown>[]
  eqs: Array<[string, unknown]>
}

const orderId = '65e395bd-b7dd-4692-bf65-f817b1fd2caa'
const paymentId = '58b7003f-f12b-4c34-bcad-4ebe2eb86853'
const pendingRow: ProductOrderPaidSyncContextRow = {
  id: orderId,
  payment_id: paymentId,
  payment_status: 'pending',
  order_status: 'pending_payment',
  shipping_status: 'not_shipped',
}

function createMockSupabase(input: {
  selectData?: ProductOrderPaidSyncContextRow | null
  selectError?: { message: string } | null
  updateError?: { message: string } | null
}): {
  supabase: MockSupabaseClient
  calls: MockSupabaseCalls
} {
  const calls: MockSupabaseCalls = {
    tables: [],
    selects: [],
    updates: [],
    eqs: [],
  }

  const chain = {
    select(columns: string) {
      calls.selects.push(columns)
      return chain
    },
    update(payload: Record<string, unknown>) {
      calls.updates.push(payload)
      return chain
    },
    eq(column: string, value: unknown) {
      calls.eqs.push([column, value])
      return chain
    },
    async maybeSingle() {
      return {
        data: input.selectData ?? null,
        error: input.selectError ?? null,
      }
    },
    then(resolve: (value: { error: { message: string } | null }) => void) {
      resolve({
        error: input.updateError ?? null,
      })
    },
  }

  const supabase = {
    from(table: string) {
      calls.tables.push(table)
      return chain
    },
  }

  return {
    supabase: supabase as unknown as MockSupabaseClient,
    calls,
  }
}

function assertNoUnsafeAccess(value: unknown) {
  const serialized = JSON.stringify(value)

  assert.equal(serialized.includes('customer_name'), false)
  assert.equal(serialized.includes('customer_phone'), false)
  assert.equal(serialized.includes('customer_email'), false)
  assert.equal(serialized.includes('recipient_phone'), false)
  assert.equal(serialized.includes('recipient_email'), false)
  assert.equal(serialized.includes('shipping_info'), false)
  assert.equal(serialized.includes('product_shipping_info'), false)
  assert.equal(serialized.includes('product_order_items'), false)
  assert.equal(serialized.includes('product_shipments'), false)
  assert.equal(serialized.includes('TradeInfo'), false)
  assert.equal(serialized.includes('TradeSha'), false)
  assert.equal(serialized.includes('HashKey'), false)
  assert.equal(serialized.includes('HashIV'), false)
}

const pendingContext: ProductOrderPaidSyncContext = {
  id: orderId,
  paymentId,
  paymentStatus: 'pending',
  orderStatus: 'pending_payment',
  shippingStatus: 'not_shipped',
}

assert.equal(decideProductOrderPaidSync({ order: null, paymentId }), 'not_found')
assert.equal(decideProductOrderPaidSync({ order: { ...pendingContext, paymentId: null }, paymentId }), 'payment_mismatch')
assert.equal(
  decideProductOrderPaidSync({
    order: { ...pendingContext, paymentId: 'a177cf69-a750-427a-9a04-f857850ba5a3' },
    paymentId,
  }),
  'payment_mismatch',
)
assert.equal(
  decideProductOrderPaidSync({
    order: { ...pendingContext, paymentStatus: 'paid', orderStatus: 'paid' },
    paymentId,
  }),
  'already_paid',
)
assert.equal(decideProductOrderPaidSync({ order: pendingContext, paymentId }), 'synced')
assert.equal(
  decideProductOrderPaidSync({
    order: { ...pendingContext, paymentStatus: 'canceled', orderStatus: 'canceled' },
    paymentId,
  }),
  'invalid_state',
)

const paidPayload = buildProductOrderPaidUpdatePayload('2026-07-07T07:30:00.000Z')
assert.deepEqual(paidPayload, {
  payment_status: 'paid',
  order_status: 'paid',
  updated_at: '2026-07-07T07:30:00.000Z',
})
assert.equal('shipping_status' in paidPayload, false)
assert.equal('customer_phone' in paidPayload, false)
assertNoUnsafeAccess(paidPayload)

async function main() {
  const readMock = createMockSupabase({ selectData: pendingRow })
  const context = await getProductOrderPaidSyncContext(orderId, readMock.supabase)

  assert.deepEqual(context, pendingContext)
  assert.deepEqual(readMock.calls.tables, ['product_orders'])
  assert.deepEqual(readMock.calls.selects, ['id,payment_id,payment_status,order_status,shipping_status'])
  assert.deepEqual(readMock.calls.eqs, [['id', orderId]])
  assertNoUnsafeAccess(readMock.calls)

  const successMock = createMockSupabase({ selectData: pendingRow })
  const synced = await syncProductOrderAfterPaymentPaid({ orderId, paymentId }, successMock.supabase)

  assert.deepEqual(synced, {
    result: 'synced',
    orderId,
  })
  assert.deepEqual(successMock.calls.tables, ['product_orders', 'product_orders'])
  assert.equal(successMock.calls.updates.length, 1)
  assert.equal(successMock.calls.updates[0].payment_status, 'paid')
  assert.equal(successMock.calls.updates[0].order_status, 'paid')
  assert.equal(typeof successMock.calls.updates[0].updated_at, 'string')
  assert.equal('shipping_status' in successMock.calls.updates[0], false)
  assert.deepEqual(successMock.calls.eqs, [
    ['id', orderId],
    ['id', orderId],
    ['payment_id', paymentId],
    ['payment_status', 'pending'],
    ['order_status', 'pending_payment'],
  ])
  assertNoUnsafeAccess(successMock.calls)

  const alreadyPaidMock = createMockSupabase({
    selectData: {
      ...pendingRow,
      payment_status: 'paid',
      order_status: 'paid',
    },
  })
  const alreadyPaid = await syncProductOrderAfterPaymentPaid({ orderId, paymentId }, alreadyPaidMock.supabase)

  assert.deepEqual(alreadyPaid, {
    result: 'already_paid',
    orderId,
  })
  assert.equal(alreadyPaidMock.calls.updates.length, 0)

  const nullPaymentMock = createMockSupabase({
    selectData: {
      ...pendingRow,
      payment_id: null,
    },
  })
  const nullPayment = await syncProductOrderAfterPaymentPaid({ orderId, paymentId }, nullPaymentMock.supabase)

  assert.deepEqual(nullPayment, {
    result: 'payment_mismatch',
    orderId,
  })
  assert.equal(nullPaymentMock.calls.updates.length, 0)

  const differentPaymentMock = createMockSupabase({
    selectData: {
      ...pendingRow,
      payment_id: 'a177cf69-a750-427a-9a04-f857850ba5a3',
    },
  })
  const differentPayment = await syncProductOrderAfterPaymentPaid({ orderId, paymentId }, differentPaymentMock.supabase)

  assert.deepEqual(differentPayment, {
    result: 'payment_mismatch',
    orderId,
  })
  assert.equal(differentPaymentMock.calls.updates.length, 0)

  const notFoundMock = createMockSupabase({ selectData: null })
  const notFound = await syncProductOrderAfterPaymentPaid({ orderId, paymentId }, notFoundMock.supabase)

  assert.deepEqual(notFound, {
    result: 'not_found',
    orderId,
  })
  assert.equal(notFoundMock.calls.updates.length, 0)

  const canceledMock = createMockSupabase({
    selectData: {
      ...pendingRow,
      payment_status: 'canceled',
      order_status: 'canceled',
    },
  })
  const canceled = await syncProductOrderAfterPaymentPaid({ orderId, paymentId }, canceledMock.supabase)

  assert.deepEqual(canceled, {
    result: 'invalid_state',
    orderId,
  })
  assert.equal(canceledMock.calls.updates.length, 0)

  const shippedInvalidMock = createMockSupabase({
    selectData: {
      ...pendingRow,
      payment_status: 'pending',
      order_status: 'shipped',
    },
  })
  const shippedInvalid = await syncProductOrderAfterPaymentPaid({ orderId, paymentId }, shippedInvalidMock.supabase)

  assert.deepEqual(shippedInvalid, {
    result: 'invalid_state',
    orderId,
  })
  assert.equal(shippedInvalidMock.calls.updates.length, 0)

  const readFailureMock = createMockSupabase({
    selectError: { message: 'raw read failure' },
  })
  const readFailure = await syncProductOrderAfterPaymentPaid({ orderId, paymentId }, readFailureMock.supabase)

  assert.deepEqual(readFailure, {
    result: 'failed',
    orderId,
    error: 'product_order_paid_sync_read_failed',
  })
  assert.equal(readFailureMock.calls.updates.length, 0)

  const updateFailureMock = createMockSupabase({
    selectData: pendingRow,
    updateError: { message: 'raw update failure' },
  })
  const updateFailure = await syncProductOrderAfterPaymentPaid({ orderId, paymentId }, updateFailureMock.supabase)

  assert.deepEqual(updateFailure, {
    result: 'failed',
    orderId,
    error: 'product_order_paid_sync_update_failed',
  })
  assert.equal(updateFailureMock.calls.updates.length, 1)

  const invalidInput = await syncProductOrderAfterPaymentPaid({
    orderId: 'not-a-uuid',
    paymentId,
  })

  assert.deepEqual(invalidInput, {
    result: 'failed',
    orderId: 'not-a-uuid',
    error: 'invalid_product_order_sync_input',
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
