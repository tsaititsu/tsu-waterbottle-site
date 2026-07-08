import assert from 'node:assert/strict'
import { handleCreateNewebPayPaymentRequest } from './handler'
import { createNewebPayMpgPaymentData } from '../../../../../lib/newebpay/paymentForm'
import { PRODUCT_ORDER_PAYMENT_ITEM_KEY } from '../../../../../lib/payments/productOrderPayment'
import { ONE_DOLLAR_TEST_CONFIRMATION_VALUE } from '../../../../../lib/newebpay/oneDollarTestMode'
import type { CreatePendingPaymentInput } from '../../../../../lib/supabase/payments'
import type { ProductOrderPaymentContext } from '../../../../../lib/supabase/productOrders'
import type { NewebPayMpgPaymentData } from '../../../../../lib/newebpay/paymentForm'
import type { NewebPayConfig } from '../../../../../lib/newebpay/types'

const tests: Array<{ name: string; fn: () => Promise<void> }> = []

const orderId = 'c0bd4cbf-64db-4e2d-a1d7-e2215d96802b'
const paymentId = 'e7bd0667-9b8f-494a-9954-d889ef195f75'
const merchantOrderNo = 'WB20260707144224PROD'
const orderNo = 'PO202607071442240CDE'

const fakeConfig: NewebPayConfig = {
  env: 'test',
  merchantId: 'MS123456789',
  hashKey: '12345678901234567890123456789012',
  hashIv: '1234567890123456',
  version: '2.3',
  siteUrl: 'http://localhost:3000',
  mpgGatewayUrl: 'https://example.test/mpg',
  mpgEndpoint: 'https://example.test/mpg',
}

const payableOrder: ProductOrderPaymentContext = {
  id: orderId,
  orderNo,
  totalAmountTwd: 1500,
  paymentMethod: 'newebpay',
  paymentStatus: 'pending',
  orderStatus: 'pending_payment',
  shippingStatus: 'not_shipped',
  paymentId: null,
}

function test(name: string, fn: () => Promise<void>) {
  tests.push({ name, fn })
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    itemKey: PRODUCT_ORDER_PAYMENT_ITEM_KEY,
    source: 'product_order',
    paymentMode: 'credit',
    orderId,
    ...overrides,
  }
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>
}

function buildPaymentData(input: { itemKey: string; amount?: number }): NewebPayMpgPaymentData {
  return {
    action: 'https://example.test/mpg',
    method: 'POST',
    merchantOrderNo,
    itemKey: input.itemKey as NewebPayMpgPaymentData['itemKey'],
    amount: input.amount ?? 0,
    fields: {
      MerchantID: 'MS123456789',
      TradeInfo: 'encrypted-trade-info',
      TradeSha: 'trade-sha',
      Version: '2.3',
    },
  }
}

function createProductDeps(input: {
  order?: ProductOrderPaymentContext | null
  createPendingPaymentError?: Error
  linkProductOrderPaymentError?: Error
} = {}) {
  const calls: {
    productOrderLookups: string[]
    paymentDataInputs: Record<string, unknown>[]
    pendingPayments: CreatePendingPaymentInput[]
    productOrderLinks: Array<{ orderId: string; paymentId: string }>
    divinationLinks: unknown[]
    aiChartLinks: unknown[]
  } = {
    productOrderLookups: [],
    paymentDataInputs: [],
    pendingPayments: [],
    productOrderLinks: [],
    divinationLinks: [],
    aiChartLinks: [],
  }

  return {
    calls,
    deps: {
      getNewebPayConfig: () => fakeConfig,
      createNewebPayMpgPaymentData: (paymentInput: Parameters<typeof createNewebPayMpgPaymentData>[0]) => {
        calls.paymentDataInputs.push(paymentInput)
        return buildPaymentData(paymentInput)
      },
      getProductOrderForPayment: async (lookupOrderId: string) => {
        calls.productOrderLookups.push(lookupOrderId)
        return input.order === undefined ? payableOrder : input.order
      },
      createPendingPayment: async (paymentInput: CreatePendingPaymentInput) => {
        calls.pendingPayments.push(paymentInput)
        if (input.createPendingPaymentError) {
          throw input.createPendingPaymentError
        }

        return { id: paymentId }
      },
      linkProductOrderPayment: async (linkInput: { orderId: string; paymentId: string }) => {
        calls.productOrderLinks.push(linkInput)
        if (input.linkProductOrderPaymentError) {
          throw input.linkProductOrderPaymentError
        }

        return linkInput
      },
      linkDivinationReadingPendingPayment: async (linkInput: unknown) => {
        calls.divinationLinks.push(linkInput)
        return { result: 'linked' as const, readingId: 'unused' }
      },
      linkAiChartReportPendingPayment: async (linkInput: unknown) => {
        calls.aiChartLinks.push(linkInput)
        return { result: 'linked' as const, reportId: 'unused' }
      },
    },
  }
}

function applePayTestBody(overrides: Record<string, unknown> = {}) {
  return {
    itemKey: 'newebpay_live_smoke_test_1',
    source: 'manual_test',
    paymentMode: 'apple_pay_test',
    ...overrides,
  }
}

function createApplePayTestDeps(input: {
  env?: Record<string, string | undefined>
  createPendingPaymentError?: Error
} = {}) {
  const calls: {
    configs: number
    paymentDataInputs: Record<string, unknown>[]
    pendingPayments: CreatePendingPaymentInput[]
    productOrderLookups: string[]
    productOrderLinks: Array<{ orderId: string; paymentId: string }>
    divinationLinks: unknown[]
    aiChartLinks: unknown[]
  } = {
    configs: 0,
    paymentDataInputs: [],
    pendingPayments: [],
    productOrderLookups: [],
    productOrderLinks: [],
    divinationLinks: [],
    aiChartLinks: [],
  }

  return {
    calls,
    deps: {
      env: input.env ?? {},
      getNewebPayConfig: () => {
        calls.configs += 1
        return fakeConfig
      },
      createNewebPayMpgPaymentData: (paymentInput: Parameters<typeof createNewebPayMpgPaymentData>[0]) => {
        calls.paymentDataInputs.push(paymentInput)
        return buildPaymentData({
          itemKey: paymentInput.itemKey,
          amount: paymentInput.amount,
        })
      },
      getProductOrderForPayment: async (lookupOrderId: string) => {
        calls.productOrderLookups.push(lookupOrderId)
        return null
      },
      createPendingPayment: async (paymentInput: CreatePendingPaymentInput) => {
        calls.pendingPayments.push(paymentInput)
        if (input.createPendingPaymentError) {
          throw input.createPendingPaymentError
        }

        return { id: paymentId }
      },
      linkProductOrderPayment: async (linkInput: { orderId: string; paymentId: string }) => {
        calls.productOrderLinks.push(linkInput)
        return linkInput
      },
      linkDivinationReadingPendingPayment: async (linkInput: unknown) => {
        calls.divinationLinks.push(linkInput)
        return { result: 'linked' as const, readingId: 'unused' }
      },
      linkAiChartReportPendingPayment: async (linkInput: unknown) => {
        calls.aiChartLinks.push(linkInput)
        return { result: 'linked' as const, reportId: 'unused' }
      },
    },
  }
}

function assertNoUnsafeSerializedKeys(value: unknown) {
  const serialized = JSON.stringify(value)

  assert.equal(serialized.includes('HashKey'), false)
  assert.equal(serialized.includes('HashIV'), false)
  assert.equal(serialized.includes('service_role'), false)
  assert.equal(serialized.includes('customer_phone'), false)
  assert.equal(serialized.includes('customerPhone'), false)
  assert.equal(serialized.includes('customer_email'), false)
  assert.equal(serialized.includes('customerEmail'), false)
  assert.equal(serialized.includes('address'), false)
  assert.equal(serialized.includes('recipient_phone'), false)
  assert.equal(serialized.includes('recipient_email'), false)
  assert.equal(serialized.includes('shipment'), false)
  assert.equal(serialized.includes('logistics'), false)
}

test('apple_pay_test is disabled when all flags are off', async () => {
  const { calls, deps } = createApplePayTestDeps()
  const response = await handleCreateNewebPayPaymentRequest(applePayTestBody(), deps)
  const json = await readJson(response)

  assert.equal(response.status, 403)
  assert.deepEqual(json, { ok: false, error: 'apple_pay_test_disabled' })
  assert.equal(calls.configs, 0)
  assert.deepEqual(calls.pendingPayments, [])
})

test('apple_pay_test is disabled when one dollar test mode is off', async () => {
  const { calls, deps } = createApplePayTestDeps({
    env: {
      ENABLE_NEWEBPAY_APPLE_PAY_TEST_MODE: 'true',
      ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_MODE: 'false',
      NEWEBPAY_ENV: 'test',
    },
  })
  const response = await handleCreateNewebPayPaymentRequest(applePayTestBody(), deps)
  const json = await readJson(response)

  assert.equal(response.status, 403)
  assert.deepEqual(json, { ok: false, error: 'apple_pay_test_disabled' })
  assert.equal(calls.configs, 0)
  assert.deepEqual(calls.pendingPayments, [])
})

test('apple_pay_test production requires one dollar confirmation', async () => {
  const { calls, deps } = createApplePayTestDeps({
    env: {
      ENABLE_NEWEBPAY_APPLE_PAY_TEST_MODE: 'true',
      ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_MODE: 'true',
      NEWEBPAY_ENV: 'production',
    },
  })
  const response = await handleCreateNewebPayPaymentRequest(applePayTestBody(), deps)
  const json = await readJson(response)

  assert.equal(response.status, 403)
  assert.deepEqual(json, { ok: false, error: 'apple_pay_test_disabled' })
  assert.equal(calls.configs, 0)
  assert.deepEqual(calls.pendingPayments, [])
})

test('apple_pay_test requires the smoke test item and manual source', async () => {
  const { calls, deps } = createApplePayTestDeps({
    env: {
      ENABLE_NEWEBPAY_APPLE_PAY_TEST_MODE: 'true',
      ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_MODE: 'true',
      NEWEBPAY_ENV: 'test',
    },
  })
  const response = await handleCreateNewebPayPaymentRequest(
    applePayTestBody({
      itemKey: PRODUCT_ORDER_PAYMENT_ITEM_KEY,
      source: 'product_order',
      orderId,
    }),
    deps,
  )
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, { ok: false, error: 'invalid_apple_pay_test_request' })
  assert.deepEqual(calls.productOrderLookups, [])
  assert.deepEqual(calls.pendingPayments, [])
})

test('apple_pay_test creates a one dollar Apple Pay pending payment when flags are enabled', async () => {
  const { calls, deps } = createApplePayTestDeps({
    env: {
      ENABLE_NEWEBPAY_APPLE_PAY_TEST_MODE: 'true',
      ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_MODE: 'true',
      NEWEBPAY_ENV: 'production',
      NEWEBPAY_ONE_DOLLAR_TEST_PRODUCTION_CONFIRMATION: ONE_DOLLAR_TEST_CONFIRMATION_VALUE,
    },
  })
  const response = await handleCreateNewebPayPaymentRequest(applePayTestBody(), deps)
  const json = await readJson(response)

  assert.equal(response.status, 200)
  assert.equal(json.ok, true)
  assert.equal(json.amount, 1)
  assert.equal(json.itemKey, 'newebpay_live_smoke_test_1')
  assert.equal(calls.configs, 1)
  assert.deepEqual(calls.productOrderLookups, [])
  assert.deepEqual(calls.productOrderLinks, [])
  assert.deepEqual(calls.divinationLinks, [])
  assert.deepEqual(calls.aiChartLinks, [])
  assert.equal(calls.paymentDataInputs.length, 1)
  assert.equal(calls.paymentDataInputs[0].itemKey, 'newebpay_live_smoke_test_1')
  assert.equal(calls.paymentDataInputs[0].paymentMode, 'apple_pay_test')
  assert.equal(calls.paymentDataInputs[0].amount, 1)
  assert.equal(calls.paymentDataInputs[0].itemDesc, 'Apple Pay 1 元測試付款｜1元測試付款')
  assert.equal(calls.pendingPayments.length, 1)

  const paymentInput = calls.pendingPayments[0]

  assert.equal(paymentInput.provider, 'newebpay')
  assert.equal(paymentInput.itemType, 'newebpay_smoke_test')
  assert.equal(paymentInput.itemId, 'newebpay_live_smoke_test_1')
  assert.equal(paymentInput.bookingId, null)
  assert.equal(paymentInput.itemName, 'Apple Pay 1 元測試付款｜1元測試付款')
  assert.equal(paymentInput.amountTwd, 1)
  assert.equal(paymentInput.rawPayload?.paymentMode, 'apple_pay_test')
  assert.equal(paymentInput.rawPayload?.amount, 1)
  assert.equal(paymentInput.rawPayload?.test_payment, true)
  assert.equal(paymentInput.rawPayload?.one_dollar_test_mode, true)
  assert.equal(paymentInput.rawPayload?.apple_pay_test, true)
  assert.equal(paymentInput.rawPayload?.original_amount, 1)
  assert.equal(paymentInput.rawPayload?.test_source, 'apple_pay_test')
  assert.equal('productOrderId' in (paymentInput.rawPayload ?? {}), false)
  assert.equal('courseId' in (paymentInput.rawPayload ?? {}), false)
  assert.equal('readingId' in (paymentInput.rawPayload ?? {}), false)
  assert.equal('reportId' in (paymentInput.rawPayload ?? {}), false)
  assertNoUnsafeSerializedKeys(paymentInput.rawPayload)
  assertNoUnsafeSerializedKeys(json)
})

test('product order success creates a pending payment and links the order', async () => {
  const { calls, deps } = createProductDeps()
  const response = await handleCreateNewebPayPaymentRequest(validBody(), deps)
  const json = await readJson(response)

  assert.equal(response.status, 200)
  assert.equal(json.ok, true)
  assert.equal(json.merchantOrderNo, merchantOrderNo)
  assert.equal(json.amount, payableOrder.totalAmountTwd)
  assert.equal(json.itemKey, PRODUCT_ORDER_PAYMENT_ITEM_KEY)
  assert.deepEqual(calls.productOrderLookups, [orderId])
  assert.equal(calls.pendingPayments.length, 1)
  assert.deepEqual(calls.productOrderLinks, [{ orderId, paymentId }])
  assert.deepEqual(calls.divinationLinks, [])
  assert.deepEqual(calls.aiChartLinks, [])

  const paymentInput = calls.pendingPayments[0]

  assert.equal(paymentInput.provider, 'newebpay')
  assert.equal(paymentInput.itemType, 'spiritual_product_order')
  assert.equal(paymentInput.itemId, orderId)
  assert.equal(paymentInput.bookingId, null)
  assert.equal(paymentInput.amountTwd, payableOrder.totalAmountTwd)
  assert.equal(paymentInput.itemName, `開運商品訂單 ${orderNo}`)
  assert.equal(paymentInput.merchantOrderNo, merchantOrderNo)
  assert.equal(paymentInput.rawPayload?.itemKey, PRODUCT_ORDER_PAYMENT_ITEM_KEY)
  assert.equal(paymentInput.rawPayload?.itemType, 'spiritual_product_order')
  assert.equal(paymentInput.rawPayload?.source, 'product_order')
  assert.equal(paymentInput.rawPayload?.orderId, orderId)
  assert.equal(paymentInput.rawPayload?.orderNo, orderNo)
  assert.equal(paymentInput.rawPayload?.amount, payableOrder.totalAmountTwd)
  assert.equal(calls.paymentDataInputs[0].amount, payableOrder.totalAmountTwd)
  assert.equal(calls.paymentDataInputs[0].itemDesc, `開運商品訂單 ${orderNo}`)
  assertNoUnsafeSerializedKeys(paymentInput.rawPayload)
  assertNoUnsafeSerializedKeys(json)
})

test('missing orderId is rejected before payment creation', async () => {
  const { calls, deps } = createProductDeps()
  const response = await handleCreateNewebPayPaymentRequest(validBody({ orderId: undefined }), deps)
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, { ok: false, error: 'invalid_product_order_payment_input' })
  assert.deepEqual(calls.pendingPayments, [])
  assert.deepEqual(calls.productOrderLinks, [])
})

test('invalid orderId is rejected before payment creation', async () => {
  const { calls, deps } = createProductDeps()
  const response = await handleCreateNewebPayPaymentRequest(validBody({ orderId: 'not-a-uuid' }), deps)
  const json = await readJson(response)

  assert.equal(response.status, 400)
  assert.deepEqual(json, { ok: false, error: 'invalid_product_order_payment_input' })
  assert.deepEqual(calls.productOrderLookups, [])
  assert.deepEqual(calls.pendingPayments, [])
})

test('missing product order returns not found', async () => {
  const { calls, deps } = createProductDeps({ order: null })
  const response = await handleCreateNewebPayPaymentRequest(validBody(), deps)
  const json = await readJson(response)

  assert.equal(response.status, 404)
  assert.deepEqual(json, { ok: false, error: 'product_order_not_found' })
  assert.deepEqual(calls.pendingPayments, [])
})

test('bank transfer product order is not payable by NewebPay', async () => {
  const { calls, deps } = createProductDeps({
    order: {
      ...payableOrder,
      paymentMethod: 'bank_transfer',
    },
  })
  const response = await handleCreateNewebPayPaymentRequest(validBody(), deps)
  const json = await readJson(response)

  assert.equal(response.status, 409)
  assert.deepEqual(json, { ok: false, error: 'product_order_not_payable' })
  assert.deepEqual(calls.pendingPayments, [])
})

test('paid product order is not payable again', async () => {
  const { calls, deps } = createProductDeps({
    order: {
      ...payableOrder,
      paymentStatus: 'paid',
      orderStatus: 'paid',
    },
  })
  const response = await handleCreateNewebPayPaymentRequest(validBody(), deps)
  const json = await readJson(response)

  assert.equal(response.status, 409)
  assert.deepEqual(json, { ok: false, error: 'product_order_not_payable' })
  assert.deepEqual(calls.pendingPayments, [])
})

test('linked product order is not payable again', async () => {
  const { calls, deps } = createProductDeps({
    order: {
      ...payableOrder,
      paymentId,
    },
  })
  const response = await handleCreateNewebPayPaymentRequest(validBody(), deps)
  const json = await readJson(response)

  assert.equal(response.status, 409)
  assert.deepEqual(json, { ok: false, error: 'product_order_not_payable' })
  assert.deepEqual(calls.pendingPayments, [])
})

test('pending payment creation failure returns safe product error', async () => {
  const { calls, deps } = createProductDeps({
    createPendingPaymentError: new Error('raw database failure'),
  })
  const response = await handleCreateNewebPayPaymentRequest(validBody(), deps)
  const json = await readJson(response)

  assert.equal(response.status, 500)
  assert.deepEqual(json, { ok: false, error: 'product_order_payment_create_failed' })
  assert.deepEqual(calls.productOrderLinks, [])
  assertNoUnsafeSerializedKeys(json)
})

test('payment link failure does not return Form Post fields', async () => {
  const { calls, deps } = createProductDeps({
    linkProductOrderPaymentError: new Error('raw link failure'),
  })
  const response = await handleCreateNewebPayPaymentRequest(validBody(), deps)
  const json = await readJson(response)

  assert.equal(response.status, 500)
  assert.deepEqual(json, { ok: false, error: 'product_order_payment_link_failed' })
  assert.equal(calls.pendingPayments.length, 1)
  assert.equal('fields' in json, false)
  assert.equal('TradeInfo' in json, false)
  assert.equal('TradeSha' in json, false)
  assertNoUnsafeSerializedKeys(json)
})

test('product order response does not expose backend secrets or raw payload', async () => {
  const { deps } = createProductDeps()
  const response = await handleCreateNewebPayPaymentRequest(validBody(), deps)
  const json = await readJson(response)

  assert.equal(response.status, 200)
  assert.equal('HashKey' in json, false)
  assert.equal('HashIV' in json, false)
  assert.equal('serviceRoleKey' in json, false)
  assert.equal('rawPayload' in json, false)
  assert.equal('customerPhone' in json, false)
  assert.equal('customerEmail' in json, false)
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
