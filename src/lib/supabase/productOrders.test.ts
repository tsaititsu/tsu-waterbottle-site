import assert from 'node:assert/strict'
import {
  buildProductOrderItemPayloads,
  buildProductOrderNo,
  buildProductOrderPayload,
  buildProductShippingInfoPayload,
  calculateProductOrderTotal,
  createProductOrder,
  type CreateProductOrderInput,
} from './productOrders'

type MockSupabaseClient = NonNullable<Parameters<typeof createProductOrder>[1]>
type MockSupabaseResponse = {
  data: unknown | null
  error: { message: string } | null
}
type MockSupabaseCalls = {
  tables: string[]
  selects: string[]
  inserts: Array<{
    table: string
    payload: unknown
  }>
}

const validItems = [
  {
    productSlug: 'ren-yuan-fu',
    productName: '人緣符',
    unitPriceTwd: 1500,
    quantity: 2,
    productSnapshot: {
      slug: 'ren-yuan-fu',
      name: '人緣符',
      priceTwd: 1500,
      TradeInfo: 'unsafe-trade-info',
      nested: {
        HashKey: 'unsafe-hash-key',
        usage: '隨身攜帶',
      },
    },
  },
  {
    productSlug: 'li-jing-ying-fu',
    productName: '利經營符',
    unitPriceTwd: 6600,
    quantity: 1,
    productSnapshot: {
      slug: 'li-jing-ying-fu',
      name: '利經營符',
      priceTwd: 6600,
    },
  },
]

const validShipping = {
  recipientName: '測試收件人',
  recipientPhone: '0912345678',
  recipientEmail: 'test@example.com',
  shippingMethod: 'manual' as const,
  postalCode: '100',
  address: '台北市測試路 1 號',
}

const validInput: CreateProductOrderInput = {
  customerName: ' 測試客戶 ',
  customerEmail: ' customer@example.com ',
  customerPhone: ' 0911111111 ',
  paymentMethod: 'bank_transfer',
  items: validItems,
  shippingInfo: validShipping,
  note: ' 請人工出貨 ',
}

function createMockSupabase(responses: Partial<Record<string, MockSupabaseResponse>>): {
  supabase: MockSupabaseClient
  calls: MockSupabaseCalls
} {
  const calls: MockSupabaseCalls = {
    tables: [],
    selects: [],
    inserts: [],
  }

  const defaultResponse: MockSupabaseResponse = {
    data: null,
    error: null,
  }

  const supabase = {
    from(table: string) {
      calls.tables.push(table)

      return {
        insert(payload: unknown) {
          calls.inserts.push({
            table,
            payload,
          })

          if (table === 'product_orders') {
            return {
              select(columns: string) {
                calls.selects.push(columns)
                return {
                  async single() {
                    return responses[table] ?? defaultResponse
                  },
                }
              },
            }
          }

          return Promise.resolve(responses[table] ?? defaultResponse)
        },
      }
    },
  }

  return {
    supabase: supabase as unknown as MockSupabaseClient,
    calls,
  }
}

function assertNoUnsafePaymentKeys(value: unknown) {
  const serialized = JSON.stringify(value)

  assert.equal(serialized.includes('TradeInfo'), false)
  assert.equal(serialized.includes('TradeSha'), false)
  assert.equal(serialized.includes('HashKey'), false)
  assert.equal(serialized.includes('HashIV'), false)
  assert.equal(serialized.includes('creditCard'), false)
  assert.equal(serialized.includes('cardNumber'), false)
  assert.equal(serialized.includes('paymentForm'), false)
}

function assertNoOtherDomainKeys(value: Record<string, unknown>) {
  assert.equal('booking_id' in value, false)
  assert.equal('course_id' in value, false)
  assert.equal('divination_reading_id' in value, false)
  assert.equal('ai_chart_report_id' in value, false)
  assert.equal('payment_id' in value, false)
  assert.equal('merchant_order_no' in value, false)
}

assert.equal(calculateProductOrderTotal(validItems), 9600)

assert.throws(() => calculateProductOrderTotal([]), /invalid_product_order_items/)
assert.throws(
  () =>
    calculateProductOrderTotal([
      {
        productSlug: 'bad-quantity',
        productName: '數量錯誤',
        unitPriceTwd: 100,
        quantity: 0,
      },
    ]),
  /invalid_product_order_items/,
)
assert.throws(
  () =>
    calculateProductOrderTotal([
      {
        productSlug: 'bad-price',
        productName: '價格錯誤',
        unitPriceTwd: -1,
        quantity: 1,
      },
    ]),
  /invalid_product_order_items/,
)

const orderNo = buildProductOrderNo(new Date(2026, 6, 7, 14, 30, 22), 0xa1b2 / 0x10000)
assert.equal(orderNo, 'PO20260707143022A1B2')
assert.match(buildProductOrderNo(), /^PO\d{14}[0-9A-F]{4}$/)

const orderPayload = buildProductOrderPayload(
  validInput,
  'PO20260707143022A1B2',
  9600,
  '2026-07-07T06:30:22.000Z',
)

assert.deepEqual(orderPayload, {
  order_no: 'PO20260707143022A1B2',
  customer_name: '測試客戶',
  customer_email: 'customer@example.com',
  customer_phone: '0911111111',
  total_amount_twd: 9600,
  payment_method: 'bank_transfer',
  payment_status: 'pending',
  order_status: 'pending_payment',
  shipping_status: 'not_shipped',
  note: '請人工出貨',
  updated_at: '2026-07-07T06:30:22.000Z',
})
assertNoOtherDomainKeys(orderPayload)
assertNoUnsafePaymentKeys(orderPayload)

const itemPayloads = buildProductOrderItemPayloads('order-1', validItems)

assert.equal(itemPayloads.length, 2)
assert.deepEqual(itemPayloads[0], {
  order_id: 'order-1',
  product_slug: 'ren-yuan-fu',
  product_name: '人緣符',
  unit_price_twd: 1500,
  quantity: 2,
  subtotal_twd: 3000,
  product_snapshot: {
    slug: 'ren-yuan-fu',
    name: '人緣符',
    priceTwd: 1500,
    nested: {
      usage: '隨身攜帶',
    },
  },
})
assert.equal(itemPayloads[1].subtotal_twd, 6600)
assertNoUnsafePaymentKeys(itemPayloads)
for (const payload of itemPayloads) {
  assertNoOtherDomainKeys(payload)
}

const shippingPayload = buildProductShippingInfoPayload(
  'order-1',
  validShipping,
  '2026-07-07T06:30:22.000Z',
)

assert.deepEqual(shippingPayload, {
  order_id: 'order-1',
  recipient_name: '測試收件人',
  recipient_phone: '0912345678',
  recipient_email: 'test@example.com',
  shipping_method: 'manual',
  postal_code: '100',
  address: '台北市測試路 1 號',
  store_type: null,
  store_id: null,
  store_name: null,
  store_address: null,
  store_phone: null,
  updated_at: '2026-07-07T06:30:22.000Z',
})
assertNoUnsafePaymentKeys(shippingPayload)

const storeShippingPayload = buildProductShippingInfoPayload('order-2', {
  shippingMethod: 'convenience_store_c2c',
  storeType: 'UNIMART',
  storeId: '123456',
  storeName: '測試門市',
  storeAddress: '台北市門市路 1 號',
})

assert.equal(storeShippingPayload.address, null)
assert.equal(storeShippingPayload.store_type, 'UNIMART')
assert.equal(storeShippingPayload.store_id, '123456')
assert.equal(storeShippingPayload.store_name, '測試門市')
assert.equal(storeShippingPayload.store_address, '台北市門市路 1 號')

async function runAsyncHelperTests() {
  const successMock = createMockSupabase({
    product_orders: {
      data: {
        id: 'order-created-1',
        order_no: 'PO20260707143022A1B2',
        total_amount_twd: 9600,
      },
      error: null,
    },
    product_order_items: {
      data: null,
      error: null,
    },
    product_shipping_info: {
      data: null,
      error: null,
    },
  })

  const createResult = await createProductOrder(validInput, successMock.supabase)

  assert.deepEqual(createResult, {
    orderId: 'order-created-1',
    orderNo: 'PO20260707143022A1B2',
    totalAmountTwd: 9600,
  })
  assert.deepEqual(successMock.calls.tables, [
    'product_orders',
    'product_order_items',
    'product_shipping_info',
  ])
  assert.deepEqual(successMock.calls.selects, ['id,order_no,total_amount_twd'])
  assert.equal(successMock.calls.inserts.length, 3)
  assert.equal(successMock.calls.inserts[0].table, 'product_orders')
  assert.equal((successMock.calls.inserts[0].payload as Record<string, unknown>).total_amount_twd, 9600)
  assert.equal((successMock.calls.inserts[0].payload as Record<string, unknown>).payment_status, 'pending')
  assert.equal((successMock.calls.inserts[0].payload as Record<string, unknown>).order_status, 'pending_payment')
  assert.equal((successMock.calls.inserts[0].payload as Record<string, unknown>).shipping_status, 'not_shipped')
  assert.equal(successMock.calls.inserts[1].table, 'product_order_items')
  assert.equal(Array.isArray(successMock.calls.inserts[1].payload), true)
  assert.equal(successMock.calls.inserts[2].table, 'product_shipping_info')
  assertNoUnsafePaymentKeys(successMock.calls.inserts)

  const orderFailureMock = createMockSupabase({
    product_orders: {
      data: null,
      error: { message: 'raw_order_insert_failed' },
    },
  })

  await assert.rejects(() => createProductOrder(validInput, orderFailureMock.supabase), /product_order_create_failed/)
  assert.deepEqual(orderFailureMock.calls.tables, ['product_orders'])

  const itemFailureMock = createMockSupabase({
    product_orders: {
      data: {
        id: 'order-created-2',
        order_no: 'PO20260707143022B2C3',
        total_amount_twd: 9600,
      },
      error: null,
    },
    product_order_items: {
      data: null,
      error: { message: 'raw_item_insert_failed' },
    },
  })

  await assert.rejects(
    () => createProductOrder(validInput, itemFailureMock.supabase),
    /product_order_items_create_failed/,
  )
  assert.deepEqual(itemFailureMock.calls.tables, ['product_orders', 'product_order_items'])

  const shippingFailureMock = createMockSupabase({
    product_orders: {
      data: {
        id: 'order-created-3',
        order_no: 'PO20260707143022C3D4',
        total_amount_twd: 9600,
      },
      error: null,
    },
    product_order_items: {
      data: null,
      error: null,
    },
    product_shipping_info: {
      data: null,
      error: { message: 'raw_shipping_insert_failed' },
    },
  })

  await assert.rejects(
    () => createProductOrder(validInput, shippingFailureMock.supabase),
    /product_shipping_info_create_failed/,
  )
  assert.deepEqual(shippingFailureMock.calls.tables, [
    'product_orders',
    'product_order_items',
    'product_shipping_info',
  ])
}

runAsyncHelperTests().catch((error) => {
  console.error(error)
  process.exit(1)
})
