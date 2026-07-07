import assert from 'node:assert/strict'
import {
  buildProductOrderPaymentMapping,
  createProductOrderLinePayPendingPayment,
  PRODUCT_ORDER_PAYMENT_ITEM_KEY,
  PRODUCT_ORDER_PAYMENT_ITEM_TYPE,
  PRODUCT_ORDER_PAYMENT_SOURCE,
  updateProductOrderLinePayPaymentMetadata,
  validateProductOrderPayableForNewebpay,
  type ProductOrderForPayment,
} from './productOrderPayment'
import {
  getProductOrderForPayment,
  linkProductOrderPendingPayment,
  linkProductOrderPayment,
  type ProductOrderPaymentContextRow,
} from '../supabase/productOrders'

type MockSupabaseClient = NonNullable<Parameters<typeof getProductOrderForPayment>[1]>
type MockSupabaseResponse = {
  data: unknown | null
  error: { message: string } | null
}
type MockSupabaseCalls = {
  tables: string[]
  selects: string[]
  updates: Record<string, unknown>[]
  eqs: Array<[string, unknown]>
}

const payableOrder: ProductOrderForPayment = {
  id: 'c0bd4cbf-64db-4e2d-a1d7-e2215d96802b',
  orderNo: 'PO202607071442240CDE',
  totalAmountTwd: 1500,
  paymentMethod: 'newebpay',
  paymentStatus: 'pending',
  orderStatus: 'pending_payment',
  shippingStatus: 'not_shipped',
  paymentId: null,
}

function createMockSupabase(input: {
  selectData?: ProductOrderPaymentContextRow | null
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

  const selectResponse: MockSupabaseResponse = {
    data: input.selectData ?? null,
    error: input.selectError ?? null,
  }

  const chain = {
    error: input.updateError ?? null,
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
      return selectResponse
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

function assertNoUnsafeKeys(value: unknown) {
  const serialized = JSON.stringify(value)

  assert.equal(serialized.includes('TradeInfo'), false)
  assert.equal(serialized.includes('TradeSha'), false)
  assert.equal(serialized.includes('HashKey'), false)
  assert.equal(serialized.includes('HashIV'), false)
  assert.equal(serialized.includes('creditCard'), false)
  assert.equal(serialized.includes('cardNumber'), false)
  assert.equal(serialized.includes('paymentForm'), false)
  assert.equal(serialized.includes('customer_phone'), false)
  assert.equal(serialized.includes('customerPhone'), false)
  assert.equal(serialized.includes('customer_email'), false)
  assert.equal(serialized.includes('customerEmail'), false)
  assert.equal(serialized.includes('address'), false)
  assert.equal(serialized.includes('recipient_phone'), false)
  assert.equal(serialized.includes('recipient_email'), false)
  assert.equal(serialized.includes('transactionId'), false)
  assert.equal(serialized.includes('paymentUrl'), false)
}

function assertNoSecretOrCustomerKeys(value: unknown) {
  const serialized = JSON.stringify(value)

  assert.equal(serialized.includes('TradeInfo'), false)
  assert.equal(serialized.includes('TradeSha'), false)
  assert.equal(serialized.includes('HashKey'), false)
  assert.equal(serialized.includes('HashIV'), false)
  assert.equal(serialized.includes('channelSecret'), false)
  assert.equal(serialized.includes('channelId'), false)
  assert.equal(serialized.includes('creditCard'), false)
  assert.equal(serialized.includes('cardNumber'), false)
  assert.equal(serialized.includes('paymentForm'), false)
  assert.equal(serialized.includes('customer_phone'), false)
  assert.equal(serialized.includes('customerPhone'), false)
  assert.equal(serialized.includes('customer_email'), false)
  assert.equal(serialized.includes('customerEmail'), false)
  assert.equal(serialized.includes('address'), false)
  assert.equal(serialized.includes('recipient_phone'), false)
  assert.equal(serialized.includes('recipient_email'), false)
}

assert.doesNotThrow(() => validateProductOrderPayableForNewebpay(payableOrder))

assert.throws(() => validateProductOrderPayableForNewebpay(null), /product_order_not_found/)
assert.throws(
  () => validateProductOrderPayableForNewebpay({ ...payableOrder, paymentMethod: 'bank_transfer' }),
  /product_order_not_payable/,
)
assert.throws(
  () => validateProductOrderPayableForNewebpay({ ...payableOrder, paymentStatus: 'paid' }),
  /product_order_not_payable/,
)
assert.throws(
  () => validateProductOrderPayableForNewebpay({ ...payableOrder, orderStatus: 'paid' }),
  /product_order_not_payable/,
)
assert.throws(
  () =>
    validateProductOrderPayableForNewebpay({
      ...payableOrder,
      paymentId: 'e7bd0667-9b8f-494a-9954-d889ef195f75',
    }),
  /product_order_not_payable/,
)
assert.throws(
  () => validateProductOrderPayableForNewebpay({ ...payableOrder, totalAmountTwd: 0 }),
  /invalid_product_order_payment_input/,
)
assert.throws(
  () => validateProductOrderPayableForNewebpay({ ...payableOrder, orderNo: '   ' }),
  /invalid_product_order_payment_input/,
)
assert.throws(
  () => validateProductOrderPayableForNewebpay({ ...payableOrder, id: 'not-a-uuid' }),
  /invalid_product_order_payment_input/,
)

const mapping = buildProductOrderPaymentMapping(payableOrder)

assert.equal(mapping.itemKey, PRODUCT_ORDER_PAYMENT_ITEM_KEY)
assert.equal(mapping.itemType, PRODUCT_ORDER_PAYMENT_ITEM_TYPE)
assert.equal(mapping.itemId, payableOrder.id)
assert.equal(mapping.amountTwd, payableOrder.totalAmountTwd)
assert.equal(mapping.itemDesc.includes(payableOrder.orderNo), true)
assert.equal(mapping.itemDesc.startsWith('開運商品訂單'), true)
assert.deepEqual(mapping.rawPayload, {
  itemKey: PRODUCT_ORDER_PAYMENT_ITEM_KEY,
  itemType: PRODUCT_ORDER_PAYMENT_ITEM_TYPE,
  source: PRODUCT_ORDER_PAYMENT_SOURCE,
  orderId: payableOrder.id,
  orderNo: payableOrder.orderNo,
  amount: payableOrder.totalAmountTwd,
})
assert.deepEqual(Object.keys(mapping.rawPayload).sort(), [
  'amount',
  'itemKey',
  'itemType',
  'orderId',
  'orderNo',
  'source',
])
assertNoUnsafeKeys(mapping)

const preparingShippingOrder = {
  ...payableOrder,
  shippingStatus: 'preparing',
} satisfies ProductOrderForPayment
assert.doesNotThrow(() => validateProductOrderPayableForNewebpay(preparingShippingOrder))

async function runAsyncHelperTests() {
  const selectMock = createMockSupabase({
    selectData: {
      id: payableOrder.id,
      order_no: payableOrder.orderNo,
      total_amount_twd: payableOrder.totalAmountTwd,
      payment_method: 'newebpay',
      payment_status: 'pending',
      order_status: 'pending_payment',
      shipping_status: 'not_shipped',
      payment_id: null,
    },
  })
  const selectedOrder = await getProductOrderForPayment(payableOrder.id, selectMock.supabase)

  assert.deepEqual(selectedOrder, payableOrder)
  assert.deepEqual(selectMock.calls.tables, ['product_orders'])
  assert.deepEqual(selectMock.calls.selects, [
    'id,order_no,total_amount_twd,payment_method,payment_status,order_status,shipping_status,payment_id',
  ])
  assert.deepEqual(selectMock.calls.eqs, [['id', payableOrder.id]])
  assert.equal(selectMock.calls.selects[0].includes('customer_name'), false)
  assert.equal(selectMock.calls.selects[0].includes('customer_phone'), false)
  assert.equal(selectMock.calls.selects[0].includes('customer_email'), false)
  assert.equal(selectMock.calls.selects[0].includes('address'), false)
  assert.equal(selectMock.calls.selects[0].includes('shipping'), true)
  assert.equal(selectMock.calls.selects[0].includes('product_snapshot'), false)
  assertNoUnsafeKeys(selectedOrder)

  const missingMock = createMockSupabase({ selectData: null })
  const missingOrder = await getProductOrderForPayment(payableOrder.id, missingMock.supabase)
  assert.equal(missingOrder, null)

  const selectFailureMock = createMockSupabase({
    selectError: { message: 'raw select failure' },
  })
  await assert.rejects(() => getProductOrderForPayment(payableOrder.id, selectFailureMock.supabase), /product_order_lookup_failed/)

  const paymentId = 'e7bd0667-9b8f-494a-9954-d889ef195f75'
  const linkMock = createMockSupabase({
    selectData: {
      id: payableOrder.id,
      order_no: payableOrder.orderNo,
      total_amount_twd: payableOrder.totalAmountTwd,
      payment_method: 'newebpay',
      payment_status: 'pending',
      order_status: 'pending_payment',
      shipping_status: 'not_shipped',
      payment_id: null,
    },
  })
  const linkResult = await linkProductOrderPayment(
    {
      orderId: payableOrder.id,
      paymentId,
    },
    linkMock.supabase,
  )

  assert.deepEqual(linkResult, {
    orderId: payableOrder.id,
    paymentId,
  })
  assert.deepEqual(linkMock.calls.tables, ['product_orders', 'product_orders'])
  assert.equal(linkMock.calls.updates.length, 1)
  assert.equal(linkMock.calls.updates[0].payment_id, paymentId)
  assert.equal(linkMock.calls.updates[0].payment_method, 'newebpay')
  assert.equal(typeof linkMock.calls.updates[0].updated_at, 'string')
  assert.equal('payment_status' in linkMock.calls.updates[0], false)
  assert.equal('order_status' in linkMock.calls.updates[0], false)
  assert.equal('shipping_status' in linkMock.calls.updates[0], false)
  assert.equal('customer_phone' in linkMock.calls.updates[0], false)
  assert.equal('customer_email' in linkMock.calls.updates[0], false)
  assert.deepEqual(linkMock.calls.eqs, [
    ['id', payableOrder.id],
    ['id', payableOrder.id],
    ['payment_status', 'pending'],
    ['order_status', 'pending_payment'],
  ])
  assertNoUnsafeKeys(linkMock.calls.updates[0])

  const notFoundLinkMock = createMockSupabase({ selectData: null })
  await assert.rejects(
    () => linkProductOrderPayment({ orderId: payableOrder.id, paymentId }, notFoundLinkMock.supabase),
    /product_order_not_found/,
  )
  assert.equal(notFoundLinkMock.calls.updates.length, 0)

  const notPayableLinkMock = createMockSupabase({
    selectData: {
      id: payableOrder.id,
      order_no: payableOrder.orderNo,
      total_amount_twd: payableOrder.totalAmountTwd,
      payment_method: 'newebpay',
      payment_status: 'paid',
      order_status: 'paid',
      shipping_status: 'not_shipped',
      payment_id: null,
    },
  })
  await assert.rejects(
    () => linkProductOrderPayment({ orderId: payableOrder.id, paymentId }, notPayableLinkMock.supabase),
    /product_order_not_payable/,
  )
  assert.equal(notPayableLinkMock.calls.updates.length, 0)

  const linkedDifferentPaymentMock = createMockSupabase({
    selectData: {
      id: payableOrder.id,
      order_no: payableOrder.orderNo,
      total_amount_twd: payableOrder.totalAmountTwd,
      payment_method: 'newebpay',
      payment_status: 'pending',
      order_status: 'pending_payment',
      shipping_status: 'not_shipped',
      payment_id: '0ef3ca73-230a-4ff6-a87e-e0ba6f63f262',
    },
  })
  await assert.rejects(
    () => linkProductOrderPayment({ orderId: payableOrder.id, paymentId }, linkedDifferentPaymentMock.supabase),
    /product_order_not_payable/,
  )
  assert.equal(linkedDifferentPaymentMock.calls.updates.length, 0)

  const updateFailureMock = createMockSupabase({
    selectData: {
      id: payableOrder.id,
      order_no: payableOrder.orderNo,
      total_amount_twd: payableOrder.totalAmountTwd,
      payment_method: 'newebpay',
      payment_status: 'pending',
      order_status: 'pending_payment',
      shipping_status: 'not_shipped',
      payment_id: null,
    },
    updateError: { message: 'raw update failure' },
  })
  await assert.rejects(
    () => linkProductOrderPayment({ orderId: payableOrder.id, paymentId }, updateFailureMock.supabase),
    /product_order_payment_link_failed/,
  )

  const linePayLinkMock = createMockSupabase({
    selectData: {
      id: payableOrder.id,
      order_no: payableOrder.orderNo,
      total_amount_twd: payableOrder.totalAmountTwd,
      payment_method: 'newebpay',
      payment_status: 'pending',
      order_status: 'pending_payment',
      shipping_status: 'not_shipped',
      payment_id: null,
    },
  })
  const linePayLinkResult = await linkProductOrderPendingPayment(
    {
      orderId: payableOrder.id,
      paymentId,
    },
    linePayLinkMock.supabase,
  )

  assert.deepEqual(linePayLinkResult, {
    orderId: payableOrder.id,
    paymentId,
  })
  assert.equal(linePayLinkMock.calls.updates.length, 1)
  assert.equal(linePayLinkMock.calls.updates[0].payment_id, paymentId)
  assert.equal('payment_method' in linePayLinkMock.calls.updates[0], false)
  assert.equal('payment_status' in linePayLinkMock.calls.updates[0], false)
  assert.equal('order_status' in linePayLinkMock.calls.updates[0], false)
  assertNoUnsafeKeys(linePayLinkMock.calls.updates[0])

  const linePayPaymentCalls: Record<string, unknown>[] = []
  const linePayLinkCalls: Record<string, unknown>[] = []
  const linePayResult = await createProductOrderLinePayPendingPayment(
    {
      productOrderId: payableOrder.id,
      amount: 1500,
      currency: 'TWD',
      provider: 'line_pay',
      merchantOrderNo: 'LP_product_order_c0bd4cbf-64db-4e2d-a1d7-e2215d96802b_20260707153000',
      metadata: {
        linePay: {
          orderId: 'LP_product_order_c0bd4cbf-64db-4e2d-a1d7-e2215d96802b_20260707153000',
          sourceType: 'product_order',
          sourceId: payableOrder.id,
        },
      },
    },
    {
      createPendingPayment: async (input) => {
        linePayPaymentCalls.push(input)
        return {
          id: paymentId,
        } as never
      },
      linkProductOrderPendingPayment: async (input) => {
        linePayLinkCalls.push(input)
        return input
      },
    },
  )

  assert.deepEqual(linePayResult, {
    paymentId,
    merchantOrderNo: 'LP_product_order_c0bd4cbf-64db-4e2d-a1d7-e2215d96802b_20260707153000',
  })
  assert.equal(linePayPaymentCalls.length, 1)
  assert.equal(linePayPaymentCalls[0].provider, 'line_pay')
  assert.equal(linePayPaymentCalls[0].itemType, PRODUCT_ORDER_PAYMENT_ITEM_TYPE)
  assert.equal(linePayPaymentCalls[0].itemId, payableOrder.id)
  assert.equal(linePayPaymentCalls[0].amountTwd, 1500)
  assert.equal(linePayPaymentCalls[0].merchantOrderNo, 'LP_product_order_c0bd4cbf-64db-4e2d-a1d7-e2215d96802b_20260707153000')
  assert.deepEqual(linePayPaymentCalls[0].rawPayload, {
    linePay: {
      orderId: 'LP_product_order_c0bd4cbf-64db-4e2d-a1d7-e2215d96802b_20260707153000',
      sourceType: 'product_order',
      sourceId: payableOrder.id,
    },
  })
  assertNoUnsafeKeys(linePayPaymentCalls[0])
  assert.deepEqual(linePayLinkCalls, [
    {
      orderId: payableOrder.id,
      paymentId,
    },
  ])

  await assert.rejects(
    () =>
      createProductOrderLinePayPendingPayment(
        {
          productOrderId: payableOrder.id,
          amount: 1500,
          currency: 'TWD',
          provider: 'line_pay',
          merchantOrderNo: 'LP_product_order_c0bd4cbf-64db-4e2d-a1d7-e2215d96802b_20260707153000',
          metadata: {
            linePay: {
              orderId: '',
              sourceType: 'product_order',
              sourceId: payableOrder.id,
            },
          },
        },
        {
          createPendingPayment: async () => {
            throw new Error('must not create')
          },
        },
      ),
    /invalid_product_order_line_pay_metadata/,
  )

  const metadataUpdateMock = createMockSupabase({})
  const updateResult = await updateProductOrderLinePayPaymentMetadata(
    {
      paymentId,
      metadata: {
        linePay: {
          orderId: 'LP_product_order_c0bd4cbf-64db-4e2d-a1d7-e2215d96802b_20260707153000',
          sourceType: 'product_order',
          sourceId: payableOrder.id,
          transactionId: '2026070700000000001',
          paymentUrl: {
            web: 'https://line-pay.example.com/web',
            app: 'line://pay/payment/test',
          },
          request: {
            returnCode: '0000',
            returnMessage: 'Success.',
          },
        },
      },
    },
    metadataUpdateMock.supabase,
  )

  assert.deepEqual(updateResult, {
    paymentId,
  })
  assert.deepEqual(metadataUpdateMock.calls.tables, ['payments'])
  assert.equal(metadataUpdateMock.calls.updates.length, 1)
  assert.deepEqual(metadataUpdateMock.calls.updates[0].raw_payload, {
    linePay: {
      orderId: 'LP_product_order_c0bd4cbf-64db-4e2d-a1d7-e2215d96802b_20260707153000',
      sourceType: 'product_order',
      sourceId: payableOrder.id,
      transactionId: '2026070700000000001',
      paymentUrl: {
        web: 'https://line-pay.example.com/web',
        app: 'line://pay/payment/test',
      },
      request: {
        returnCode: '0000',
        returnMessage: 'Success.',
      },
    },
  })
  assert.equal(typeof metadataUpdateMock.calls.updates[0].updated_at, 'string')
  assert.equal('status' in metadataUpdateMock.calls.updates[0], false)
  assert.equal('paid_at' in metadataUpdateMock.calls.updates[0], false)
  assert.equal('provider_trade_no' in metadataUpdateMock.calls.updates[0], false)
  assert.deepEqual(metadataUpdateMock.calls.eqs, [
    ['id', paymentId],
    ['provider', 'line_pay'],
    ['status', 'pending'],
  ])
  assertNoSecretOrCustomerKeys(metadataUpdateMock.calls.updates[0])

  await assert.rejects(
    () =>
      updateProductOrderLinePayPaymentMetadata(
        {
          paymentId,
          metadata: {
            linePay: {
              channelSecret: 'unsafe',
            },
          },
        },
        metadataUpdateMock.supabase,
      ),
    /invalid_product_order_line_pay_metadata/,
  )
}

runAsyncHelperTests().catch((error) => {
  console.error(error)
  process.exit(1)
})
