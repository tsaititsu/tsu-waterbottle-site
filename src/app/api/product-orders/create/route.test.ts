import assert from 'node:assert/strict'
import { handleCreateProductOrderRequest } from './handler'

const tests: Array<{ name: string; fn: () => Promise<void> }> = []

function test(name: string, fn: () => Promise<void>) {
  tests.push({ name, fn })
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    customerName: '測試客人',
    customerEmail: 'test@example.com',
    customerPhone: '0900000000',
    paymentMethod: 'newebpay',
    items: [
      {
        productSlug: 'ren-yuan-fu',
        quantity: 1,
      },
    ],
    shippingInfo: {
      recipientName: '測試收件人',
      recipientPhone: '0900000000',
      recipientEmail: 'test@example.com',
      shippingMethod: 'manual',
      postalCode: '100',
      address: '測試地址',
    },
    note: '測試訂單',
    ...overrides,
  }
}

function assertNoUnsafeResponseKeys(payload: Record<string, unknown>) {
  assert.equal('TradeInfo' in payload, false)
  assert.equal('TradeSha' in payload, false)
  assert.equal('HashKey' in payload, false)
  assert.equal('HashIV' in payload, false)
  assert.equal('creditCard' in payload, false)
  assert.equal('cardNumber' in payload, false)
  assert.equal('paymentForm' in payload, false)
  assert.equal('rawPayload' in payload, false)
}

function assertNoUnsafeSerializedKeys(value: unknown) {
  const serialized = JSON.stringify(value)

  assert.equal(serialized.includes('TradeInfo'), false)
  assert.equal(serialized.includes('TradeSha'), false)
  assert.equal(serialized.includes('HashKey'), false)
  assert.equal(serialized.includes('HashIV'), false)
  assert.equal(serialized.includes('creditCard'), false)
  assert.equal(serialized.includes('cardNumber'), false)
  assert.equal(serialized.includes('paymentForm'), false)
  assert.equal(serialized.includes('raw_payload'), false)
}

test('creates a NewebPay product order from server product data', async () => {
  const calls: Record<string, unknown>[] = []
  const response = await handleCreateProductOrderRequest(
    validBody({
      items: [
        {
          productSlug: 'ren-yuan-fu',
          quantity: 2,
          unitPriceTwd: 1,
          productName: 'client spoofed name',
          TradeInfo: 'unsafe',
        },
      ],
    }),
    {
      createProductOrder: async (input) => {
        calls.push(input)
        return {
          orderId: 'order-1',
          orderNo: 'PO20260707143022A1B2',
          totalAmountTwd: 3000,
        }
      },
    },
  )
  const json = await readJson(response)

  assert.equal(response.status, 200)
  assert.deepEqual(json, {
    ok: true,
    orderId: 'order-1',
    orderNo: 'PO20260707143022A1B2',
    totalAmountTwd: 3000,
    paymentMethod: 'newebpay',
    paymentStatus: 'pending',
    orderStatus: 'pending_payment',
    shippingStatus: 'not_shipped',
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].paymentMethod, 'newebpay')
  assert.equal((calls[0].items as Array<Record<string, unknown>>)[0].productSlug, 'ren-yuan-fu')
  assert.equal((calls[0].items as Array<Record<string, unknown>>)[0].productName, '人緣符')
  assert.equal((calls[0].items as Array<Record<string, unknown>>)[0].unitPriceTwd, 1500)
  assert.equal((calls[0].items as Array<Record<string, unknown>>)[0].quantity, 2)
  assert.equal('paymentId' in calls[0], false)
  assert.equal('shipment' in calls[0], false)
  assert.equal('shipments' in calls[0], false)
  assertNoUnsafeSerializedKeys(calls)
  assertNoUnsafeResponseKeys(json)
})

test('rejects retired bank transfer product orders before any write', async () => {
  let createOrderCalls = 0
  const response = await handleCreateProductOrderRequest(
    validBody({ paymentMethod: 'bank_transfer' }),
    {
      createProductOrder: async () => {
        createOrderCalls += 1
        throw new Error('must_not_write')
      },
    },
  )

  assert.equal(response.status, 400)
  assert.deepEqual(await readJson(response), {
    ok: false,
    error: 'invalid_product_payment_method',
  })
  assert.equal(createOrderCalls, 0)
})

test('creates a newebpay product order without creating a payment', async () => {
  const calls: Record<string, unknown>[] = []
  let paymentApiCalled = false
  const originalFetch = globalThis.fetch

  globalThis.fetch = (async () => {
    paymentApiCalled = true
    return new Response('{}')
  }) as typeof fetch

  try {
    const response = await handleCreateProductOrderRequest(
      validBody({
        paymentMethod: 'newebpay',
      }),
      {
        createProductOrder: async (input) => {
          calls.push(input)
          return {
            orderId: 'order-newebpay-1',
            orderNo: 'PO20260707143022B2C3',
            totalAmountTwd: 1500,
          }
        },
      },
    )
    const json = await readJson(response)

    assert.equal(response.status, 200)
    assert.equal(json.paymentMethod, 'newebpay')
    assert.equal(calls.length, 1)
    assert.equal(calls[0].paymentMethod, 'newebpay')
    assert.equal('paymentId' in calls[0], false)
    assert.equal('merchantOrderNo' in calls[0], false)
    assert.equal('shipment' in calls[0], false)
    assert.equal(paymentApiCalled, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('empty items are rejected', async () => {
  const response = await handleCreateProductOrderRequest(
    validBody({
      items: [],
    }),
  )
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, {
    ok: false,
    error: 'invalid_product_order_items',
  })
})

test('unknown productSlug is rejected', async () => {
  const response = await handleCreateProductOrderRequest(
    validBody({
      items: [
        {
          productSlug: 'missing-product',
          quantity: 1,
        },
      ],
    }),
  )
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, {
    ok: false,
    error: 'invalid_product_order_items',
  })
})

test('removed 五雷壓煞符 slug is rejected before order or payment writes', async () => {
  let createOrderCalls = 0
  let paymentApiCalls = 0
  const originalFetch = globalThis.fetch

  globalThis.fetch = (async () => {
    paymentApiCalls += 1
    throw new Error('payment_api_must_not_be_called')
  }) as typeof fetch

  try {
    const response = await handleCreateProductOrderRequest(
      validBody({
        items: [
          {
            productSlug: 'wu-lei-ya-sha-fu',
            quantity: 1,
          },
        ],
      }),
      {
        createProductOrder: async () => {
          createOrderCalls += 1
          throw new Error('product_order_must_not_be_created')
        },
      },
    )

    assert.equal(response.status, 400)
    assert.deepEqual(await readJson(response), {
      ok: false,
      error: 'invalid_product_order_items',
    })
    assert.equal(createOrderCalls, 0)
    assert.equal(paymentApiCalls, 0)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('non-positive quantity is rejected', async () => {
  const response = await handleCreateProductOrderRequest(
    validBody({
      items: [
        {
          productSlug: 'ren-yuan-fu',
          quantity: 0,
        },
      ],
    }),
  )
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, {
    ok: false,
    error: 'invalid_product_order_items',
  })
})

test('missing customerName is rejected', async () => {
  const response = await handleCreateProductOrderRequest(
    validBody({
      customerName: '',
    }),
  )
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, {
    ok: false,
    error: 'invalid_product_order_customer',
  })
})

test('missing customerPhone is rejected', async () => {
  const response = await handleCreateProductOrderRequest(
    validBody({
      customerPhone: '',
    }),
  )
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, {
    ok: false,
    error: 'invalid_product_order_customer',
  })
})

test('invalid customer email is rejected', async () => {
  const response = await handleCreateProductOrderRequest(
    validBody({
      customerEmail: 'not-an-email',
    }),
  )
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, {
    ok: false,
    error: 'invalid_product_order_customer',
  })
})

test('non-manual shipping method is rejected for the first version', async () => {
  const response = await handleCreateProductOrderRequest(
    validBody({
      shippingInfo: {
        recipientName: '測試收件人',
        recipientPhone: '0900000000',
        shippingMethod: 'convenience_store_c2c',
        address: '測試地址',
      },
    }),
  )
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, {
    ok: false,
    error: 'invalid_product_shipping_info',
  })
})

test('missing shipping address is rejected', async () => {
  const response = await handleCreateProductOrderRequest(
    validBody({
      shippingInfo: {
        recipientName: '測試收件人',
        recipientPhone: '0900000000',
        shippingMethod: 'manual',
        address: '',
      },
    }),
  )
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, {
    ok: false,
    error: 'invalid_product_shipping_info',
  })
})

test('invalid paymentMethod is rejected', async () => {
  const response = await handleCreateProductOrderRequest(
    validBody({
      paymentMethod: 'credit_card',
    }),
  )
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, {
    ok: false,
    error: 'invalid_product_payment_method',
  })
})

test('createProductOrder failure returns a safe error', async () => {
  const response = await handleCreateProductOrderRequest(
    validBody(),
    {
      createProductOrder: async () => {
        throw new Error('raw supabase detail')
      },
    },
  )
  const json = await readJson(response)

  assert.equal(response.status, 500)
  assert.deepEqual(json, {
    ok: false,
    error: 'product_order_create_failed',
  })
  assertNoUnsafeResponseKeys(json)
})

async function runTests() {
  for (const { name, fn } of tests) {
    try {
      await fn()
      console.log(`✓ ${name}`)
    } catch (error) {
      console.error(`✗ ${name}`)
      throw error
    }
  }
}

void runTests()
