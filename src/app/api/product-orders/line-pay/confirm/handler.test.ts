import assert from 'node:assert/strict'
import {
  handleProductOrderLinePayConfirmRedirect,
  type ProductOrderLinePayConfirmPaymentContext,
  type ProductOrderLinePayConfirmProductOrderContext,
  type ProductOrderLinePayPaymentDetailsGetter,
  type ProductOrderLinePayRequestStatusChecker,
} from './handler'
import type { LinePayServerEnv } from '../../../../../lib/linePay'
import type {
  LinePayPaymentDetailsResult,
  LinePayPaymentRequestStatus,
  LinePayPaymentRequestStatusResult,
} from '../../../../../lib/linePay/statusClient'

const fullEnv: LinePayServerEnv = {
  NEXT_PUBLIC_ENABLE_LINE_PAY: 'true',
  LINE_PAY_ENV: 'sandbox',
  LINE_PAY_CHANNEL_ID: 'fake_channel_id',
  LINE_PAY_CHANNEL_SECRET: 'fake_channel_secret_for_tests',
  LINE_PAY_CONFIRM_URL: 'https://example.com/api/product-orders/line-pay/confirm',
  LINE_PAY_CANCEL_URL: 'https://example.com/api/product-orders/line-pay/cancel',
}
const orderId = 'LP_product_order_product-order-1_20260707153000'
const transactionId = '2026070700000000001'
const paymentId = 'payment-line-pay-1'
const productOrderId = 'product-order-1'
const tests: Array<{ name: string; fn: () => Promise<void> | void }> = []

function test(name: string, fn: () => Promise<void> | void) {
  tests.push({ name, fn })
}

function createRequest(query = `orderId=${orderId}&transactionId=${transactionId}`, method = 'GET') {
  return new Request(`https://example.com/api/product-orders/line-pay/confirm?${query}`, {
    method,
  })
}

function createPayment(
  override: Partial<ProductOrderLinePayConfirmPaymentContext> = {},
): ProductOrderLinePayConfirmPaymentContext {
  return {
    id: paymentId,
    provider: 'line_pay',
    status: 'pending',
    amount: 1500,
    currency: 'TWD',
    merchant_order_no: orderId,
    raw_payload: {
      linePay: {
        orderId,
        sourceType: 'product_order',
        sourceId: productOrderId,
        transactionId,
        paymentUrl: {
          web: 'https://line-pay.example.test/pay',
        },
        request: {
          returnCode: '0000',
          returnMessage: 'Success.',
        },
      },
    },
    ...override,
  }
}

function createProductOrder(
  override: Partial<ProductOrderLinePayConfirmProductOrderContext> = {},
): ProductOrderLinePayConfirmProductOrderContext {
  return {
    id: productOrderId,
    status: 'pending_payment',
    payment_status: 'pending',
    payment_id: paymentId,
    total_amount: 1500,
    currency: 'TWD',
    ...override,
  }
}

function createPaymentReader(
  payment: ProductOrderLinePayConfirmPaymentContext | null = createPayment(),
  calls: Array<{ orderId: string }> = [],
) {
  return async (input: { orderId: string }) => {
    calls.push(input)
    return payment
  }
}

function createProductOrderReader(
  order: ProductOrderLinePayConfirmProductOrderContext | null = createProductOrder(),
  calls: Array<{ productOrderId: string }> = [],
) {
  return async (input: { productOrderId: string }) => {
    calls.push(input)
    return order
  }
}

function createConfirmResult(override: Record<string, unknown> = {}) {
  return {
    returnCode: '0000',
    returnMessage: 'Success.',
    transactionId,
    orderId,
    amount: 1500,
    currency: 'TWD',
    payInfo: [
      {
        amount: 1500,
      },
    ],
    ...override,
  }
}

function createLinePayConfirmer(
  result: Record<string, unknown> = createConfirmResult(),
  calls: Array<Record<string, unknown>> = [],
  error?: unknown,
) {
  return async (input: Record<string, unknown>) => {
    calls.push(input)

    if (error) {
      throw error
    }

    return result
  }
}

function createRequestStatusChecker(
  result: LinePayPaymentRequestStatusResult = {
    returnCode: '0123',
    returnMessage: 'payment completed',
    transactionId,
    status: 'payment_completed',
  },
  calls: Array<Record<string, unknown>> = [],
  error?: unknown,
): ProductOrderLinePayRequestStatusChecker {
  return async (input) => {
    calls.push(input)

    if (error) {
      throw error
    }

    return result
  }
}

function createPaymentDetailsGetter(
  result: LinePayPaymentDetailsResult = {
    returnCode: '0000',
    returnMessage: 'Success.',
    info: [
      {
        transactionId,
        orderId,
        amount: 1500,
        currency: 'TWD',
      },
    ],
  },
  calls: Array<Record<string, unknown>> = [],
  error?: unknown,
): ProductOrderLinePayPaymentDetailsGetter {
  return async (input) => {
    calls.push(input)

    if (error) {
      throw error
    }

    return result
  }
}

function createMetadataUpdater(calls: Array<Record<string, unknown>> = [], error?: unknown) {
  return async (input: Record<string, unknown>) => {
    calls.push(input)

    if (error) {
      throw error
    }

    return {
      paymentId: input.paymentId,
    }
  }
}

function createPaymentPaidMarker(calls: Array<Record<string, unknown>> = [], error?: unknown) {
  return async (input: Record<string, unknown>) => {
    calls.push(input)

    if (error) {
      throw error
    }

    return {
      paymentId: input.paymentId,
    }
  }
}

function createProductOrderPaidSyncer(calls: Array<Record<string, unknown>> = [], error?: unknown) {
  return async (input: Record<string, unknown>) => {
    calls.push(input)

    if (error) {
      throw error
    }

    return {
      result: 'synced',
      orderId: input.productOrderId,
    }
  }
}

async function callHandler({
  request = createRequest(),
  env = fullEnv,
  ...input
}: {
  request?: Request
  env?: LinePayServerEnv
  paymentReader?: Parameters<typeof handleProductOrderLinePayConfirmRedirect>[0]['paymentReader']
  productOrderReader?: Parameters<typeof handleProductOrderLinePayConfirmRedirect>[0]['productOrderReader']
  linePayConfirmer?: Parameters<typeof handleProductOrderLinePayConfirmRedirect>[0]['linePayConfirmer']
  requestStatusChecker?: Parameters<typeof handleProductOrderLinePayConfirmRedirect>[0]['requestStatusChecker']
  paymentDetailsGetter?: Parameters<typeof handleProductOrderLinePayConfirmRedirect>[0]['paymentDetailsGetter']
  paymentMetadataUpdater?: Parameters<typeof handleProductOrderLinePayConfirmRedirect>[0]['paymentMetadataUpdater']
  paymentPaidMarker?: Parameters<typeof handleProductOrderLinePayConfirmRedirect>[0]['paymentPaidMarker']
  productOrderPaidSyncer?: Parameters<typeof handleProductOrderLinePayConfirmRedirect>[0]['productOrderPaidSyncer']
} = {}) {
  return handleProductOrderLinePayConfirmRedirect({
    request,
    env,
    paymentReader: 'paymentReader' in input ? input.paymentReader : createPaymentReader(),
    productOrderReader: 'productOrderReader' in input ? input.productOrderReader : createProductOrderReader(),
    linePayConfirmer: 'linePayConfirmer' in input ? input.linePayConfirmer : createLinePayConfirmer(),
    requestStatusChecker: 'requestStatusChecker' in input ? input.requestStatusChecker : createRequestStatusChecker(),
    paymentDetailsGetter: 'paymentDetailsGetter' in input ? input.paymentDetailsGetter : createPaymentDetailsGetter(),
    paymentMetadataUpdater:
      'paymentMetadataUpdater' in input ? input.paymentMetadataUpdater : createMetadataUpdater(),
    paymentPaidMarker: 'paymentPaidMarker' in input ? input.paymentPaidMarker : createPaymentPaidMarker(),
    productOrderPaidSyncer:
      'productOrderPaidSyncer' in input ? input.productOrderPaidSyncer : createProductOrderPaidSyncer(),
  })
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>
}

function assertSafeResponse(payload: Record<string, unknown>) {
  const text = JSON.stringify(payload)

  assert.equal(text.includes('channelSecret'), false)
  assert.equal(text.includes('fake_channel_secret_for_tests'), false)
  assert.equal(text.includes('channelId'), false)
  assert.equal(text.includes('fake_channel_id'), false)
  assert.equal(text.includes('LINE_PAY_CHANNEL_SECRET'), false)
  assert.equal(text.includes('LINE_PAY_CHANNEL_ID'), false)
  assert.equal(text.includes('TradeInfo'), false)
  assert.equal(text.includes('TradeSha'), false)
  assert.equal(text.includes('phone'), false)
  assert.equal(text.includes('email'), false)
  assert.equal(text.includes('address'), false)
}

function assertNoPaidMutation(value: unknown) {
  const text = JSON.stringify(value)

  assert.equal(text.includes('"status":"paid"'), false)
  assert.equal(text.includes('"payment_status":"paid"'), false)
  assert.equal(text.includes('"order_status":"paid"'), false)
  assert.equal(text.includes('paid_at'), false)
  assert.equal(text.includes('markPaid'), false)
}

async function assertErrorResponse(
  input: Parameters<typeof callHandler>[0],
  expectedStatus: number,
  expectedError: string,
) {
  const response = await callHandler(input)
  const json = await readJson(response)

  assert.equal(response.status, expectedStatus)
  assert.deepEqual(json, {
    ok: false,
    error: expectedError,
  })
  assertSafeResponse(json)
}

test('non-GET returns method_not_allowed', async () => {
  await assertErrorResponse(
    {
      request: createRequest(`orderId=${orderId}&transactionId=${transactionId}`, 'POST'),
    },
    405,
    'method_not_allowed',
  )
})

test('disabled LINE Pay returns line_pay_disabled', async () => {
  await assertErrorResponse(
    {
      env: {
        NEXT_PUBLIC_ENABLE_LINE_PAY: 'false',
      },
    },
    404,
    'line_pay_disabled',
  )
})

test('missing orderId returns missing_line_pay_order_id', async () => {
  await assertErrorResponse(
    {
      request: createRequest(`transactionId=${transactionId}`),
    },
    400,
    'missing_line_pay_order_id',
  )
})

test('blank orderId returns missing_line_pay_order_id', async () => {
  await assertErrorResponse(
    {
      request: createRequest(`orderId=%20%20&transactionId=${transactionId}`),
    },
    400,
    'missing_line_pay_order_id',
  )
})

test('invalid orderId returns invalid_line_pay_order_id', async () => {
  await assertErrorResponse(
    {
      request: createRequest(`orderId=bad/order&transactionId=${transactionId}`),
    },
    400,
    'invalid_line_pay_order_id',
  )
})

test('missing transactionId returns missing_line_pay_transaction_id', async () => {
  await assertErrorResponse(
    {
      request: createRequest(`orderId=${orderId}`),
    },
    400,
    'missing_line_pay_transaction_id',
  )
})

test('blank transactionId returns missing_line_pay_transaction_id', async () => {
  await assertErrorResponse(
    {
      request: createRequest(`orderId=${orderId}&transactionId=%20%20`),
    },
    400,
    'missing_line_pay_transaction_id',
  )
})

test('non-numeric transactionId returns invalid_line_pay_transaction_id', async () => {
  await assertErrorResponse(
    {
      request: createRequest(`orderId=${orderId}&transactionId=not-a-number`),
    },
    400,
    'invalid_line_pay_transaction_id',
  )
})

test('missing paymentReader returns line_pay_confirm_payment_reader_missing', async () => {
  await assertErrorResponse(
    {
      paymentReader: undefined,
    },
    500,
    'line_pay_confirm_payment_reader_missing',
  )
})

test('missing productOrderReader returns line_pay_confirm_product_order_reader_missing', async () => {
  await assertErrorResponse(
    {
      productOrderReader: undefined,
    },
    500,
    'line_pay_confirm_product_order_reader_missing',
  )
})

test('payment not found returns line_pay_payment_not_found', async () => {
  await assertErrorResponse(
    {
      paymentReader: createPaymentReader(null),
    },
    404,
    'line_pay_payment_not_found',
  )
})

test('payment provider mismatch returns line_pay_payment_provider_mismatch', async () => {
  await assertErrorResponse(
    {
      paymentReader: createPaymentReader(createPayment({ provider: 'newebpay' })),
    },
    409,
    'line_pay_payment_provider_mismatch',
  )
})

test('payment not pending returns line_pay_payment_not_pending', async () => {
  await assertErrorResponse(
    {
      paymentReader: createPaymentReader(createPayment({ status: 'paid' })),
    },
    409,
    'line_pay_payment_not_pending',
  )
})

test('payment merchant order mismatch returns line_pay_payment_order_id_mismatch', async () => {
  await assertErrorResponse(
    {
      paymentReader: createPaymentReader(createPayment({ merchant_order_no: 'LP_product_order_other_1' })),
    },
    409,
    'line_pay_payment_order_id_mismatch',
  )
})

test('raw payload orderId mismatch returns line_pay_payment_order_id_mismatch', async () => {
  await assertErrorResponse(
    {
      paymentReader: createPaymentReader(
        createPayment({
          raw_payload: {
            linePay: {
              orderId: 'LP_product_order_other_1',
              sourceType: 'product_order',
              sourceId: productOrderId,
              transactionId,
            },
          },
        }),
      ),
    },
    409,
    'line_pay_payment_order_id_mismatch',
  )
})

test('transactionId mismatch returns line_pay_payment_transaction_id_mismatch', async () => {
  await assertErrorResponse(
    {
      paymentReader: createPaymentReader(
        createPayment({
          raw_payload: {
            linePay: {
              orderId,
              sourceType: 'product_order',
              sourceId: productOrderId,
              transactionId: '2026070700000000002',
            },
          },
        }),
      ),
    },
    409,
    'line_pay_payment_transaction_id_mismatch',
  )
})

test('source type mismatch returns line_pay_payment_source_type_mismatch', async () => {
  await assertErrorResponse(
    {
      paymentReader: createPaymentReader(
        createPayment({
          raw_payload: {
            linePay: {
              orderId,
              sourceType: 'booking',
              sourceId: productOrderId,
              transactionId,
            },
          },
        }),
      ),
    },
    409,
    'line_pay_payment_source_type_mismatch',
  )
})

test('missing sourceId returns line_pay_payment_source_id_missing', async () => {
  await assertErrorResponse(
    {
      paymentReader: createPaymentReader(
        createPayment({
          raw_payload: {
            linePay: {
              orderId,
              sourceType: 'product_order',
              sourceId: '',
              transactionId,
            },
          },
        }),
      ),
    },
    409,
    'line_pay_payment_source_id_missing',
  )
})

test('invalid payment amount returns invalid_line_pay_confirm_amount', async () => {
  await assertErrorResponse(
    {
      paymentReader: createPaymentReader(createPayment({ amount: 0 })),
    },
    400,
    'invalid_line_pay_confirm_amount',
  )
})

test('payment currency mismatch returns line_pay_payment_currency_mismatch', async () => {
  await assertErrorResponse(
    {
      paymentReader: createPaymentReader(createPayment({ currency: 'USD' })),
    },
    409,
    'line_pay_payment_currency_mismatch',
  )
})

test('product order not found returns product_order_not_found', async () => {
  await assertErrorResponse(
    {
      productOrderReader: createProductOrderReader(null),
    },
    404,
    'product_order_not_found',
  )
})

test('product order payment_id mismatch returns line_pay_payment_product_order_mismatch', async () => {
  await assertErrorResponse(
    {
      productOrderReader: createProductOrderReader(createProductOrder({ payment_id: 'other-payment' })),
    },
    409,
    'line_pay_payment_product_order_mismatch',
  )
})

test('product order already paid returns product_order_already_paid', async () => {
  await assertErrorResponse(
    {
      productOrderReader: createProductOrderReader(createProductOrder({ payment_status: 'paid' })),
    },
    409,
    'product_order_already_paid',
  )
})

test('product order status not payable returns product_order_not_payable', async () => {
  await assertErrorResponse(
    {
      productOrderReader: createProductOrderReader(createProductOrder({ status: 'canceled' })),
    },
    409,
    'product_order_not_payable',
  )
})

test('product order invalid amount returns invalid_line_pay_confirm_amount', async () => {
  await assertErrorResponse(
    {
      productOrderReader: createProductOrderReader(createProductOrder({ total_amount: 0 })),
    },
    400,
    'invalid_line_pay_confirm_amount',
  )
})

test('product order invalid currency returns invalid_line_pay_confirm_currency', async () => {
  await assertErrorResponse(
    {
      productOrderReader: createProductOrderReader(createProductOrder({ currency: 'USD' })),
    },
    400,
    'invalid_line_pay_confirm_currency',
  )
})

test('payment amount mismatch returns line_pay_payment_amount_mismatch', async () => {
  await assertErrorResponse(
    {
      productOrderReader: createProductOrderReader(createProductOrder({ total_amount: 1600 })),
    },
    409,
    'line_pay_payment_amount_mismatch',
  )
})

test('missing linePayConfirmer returns line_pay_confirmer_missing', async () => {
  await assertErrorResponse(
    {
      linePayConfirmer: undefined,
    },
    500,
    'line_pay_confirmer_missing',
  )
})

test('missing paymentMetadataUpdater returns line_pay_confirm_metadata_update_missing', async () => {
  await assertErrorResponse(
    {
      paymentMetadataUpdater: undefined,
    },
    500,
    'line_pay_confirm_metadata_update_missing',
  )
})

test('general confirm error returns line_pay_confirm_failed', async () => {
  await assertErrorResponse(
    {
      linePayConfirmer: createLinePayConfirmer(createConfirmResult(), [], new Error('general failure')),
    },
    500,
    'line_pay_confirm_failed',
  )
})

test('confirm error 1172 queries status and payment details then marks paid when verified', async () => {
  const confirmCalls: Array<Record<string, unknown>> = []
  const statusCalls: Array<Record<string, unknown>> = []
  const detailCalls: Array<Record<string, unknown>> = []
  const metadataCalls: Array<Record<string, unknown>> = []
  const paidCalls: Array<Record<string, unknown>> = []
  const syncCalls: Array<Record<string, unknown>> = []
  const response = await callHandler({
    linePayConfirmer: createLinePayConfirmer(createConfirmResult(), confirmCalls, {
      code: '1172',
      message: 'Confirm processing unknown.',
    }),
    requestStatusChecker: createRequestStatusChecker(undefined, statusCalls),
    paymentDetailsGetter: createPaymentDetailsGetter(undefined, detailCalls),
    paymentMetadataUpdater: createMetadataUpdater(metadataCalls),
    paymentPaidMarker: createPaymentPaidMarker(paidCalls),
    productOrderPaidSyncer: createProductOrderPaidSyncer(syncCalls),
  })
  const json = await readJson(response)

  assert.equal(response.status, 200)
  assert.equal(json.outcome, 'payment_completed')
  assert.equal(json.markedPaid, true)
  assert.equal(confirmCalls.length, 1)
  assert.equal(statusCalls.length, 1)
  assert.equal(detailCalls.length, 1)
  assert.equal(statusCalls[0].transactionId, transactionId)
  assert.equal(detailCalls[0].transactionId, transactionId)
  assert.equal(detailCalls[0].orderId, orderId)
  assert.equal((metadataCalls[0].metadata as Record<string, unknown>).linePay !== undefined, true)
  assert.equal(paidCalls.length, 1)
  assert.equal(syncCalls.length, 1)
  assert.equal(paidCalls[0].transactionId, transactionId)
  assert.equal(syncCalls[0].productOrderId, productOrderId)
})

test('confirm error 1198 queries status and payment details then marks paid when verified', async () => {
  const statusCalls: Array<Record<string, unknown>> = []
  const detailCalls: Array<Record<string, unknown>> = []
  const paidCalls: Array<Record<string, unknown>> = []
  const response = await callHandler({
    linePayConfirmer: createLinePayConfirmer(createConfirmResult(), [], {
      code: '1198',
      message: 'Confirm status unknown.',
    }),
    requestStatusChecker: createRequestStatusChecker(undefined, statusCalls),
    paymentDetailsGetter: createPaymentDetailsGetter(undefined, detailCalls),
    paymentPaidMarker: createPaymentPaidMarker(paidCalls),
  })
  const json = await readJson(response)

  assert.equal(response.status, 200)
  assert.equal(json.outcome, 'payment_completed')
  assert.equal(json.markedPaid, true)
  assert.equal(statusCalls.length, 1)
  assert.equal(detailCalls.length, 1)
  assert.equal(paidCalls.length, 1)
})

test('confirm timeout queries status and payment details then marks paid when verified', async () => {
  const statusCalls: Array<Record<string, unknown>> = []
  const detailCalls: Array<Record<string, unknown>> = []
  const paidCalls: Array<Record<string, unknown>> = []
  const response = await callHandler({
    linePayConfirmer: createLinePayConfirmer(createConfirmResult(), [], {
      code: 'timeout',
      message: 'read timeout',
    }),
    requestStatusChecker: createRequestStatusChecker(undefined, statusCalls),
    paymentDetailsGetter: createPaymentDetailsGetter(undefined, detailCalls),
    paymentPaidMarker: createPaymentPaidMarker(paidCalls),
  })
  const json = await readJson(response)

  assert.equal(response.status, 200)
  assert.equal(json.outcome, 'payment_completed')
  assert.equal(json.markedPaid, true)
  assert.equal(statusCalls.length, 1)
  assert.equal(detailCalls.length, 1)
  assert.equal(paidCalls.length, 1)
})

test('status and details mismatch returns followup response and does not mark paid', async () => {
  const paidCalls: Array<Record<string, unknown>> = []
  const response = await callHandler({
    linePayConfirmer: createLinePayConfirmer(createConfirmResult(), [], {
      code: '1172',
      message: 'Confirm processing unknown.',
    }),
    requestStatusChecker: createRequestStatusChecker(),
    paymentDetailsGetter: createPaymentDetailsGetter({
      returnCode: '0000',
      returnMessage: 'Success.',
      info: [
        {
          transactionId,
          orderId,
          amount: 1499,
          currency: 'TWD',
        },
      ],
    }),
    paymentPaidMarker: createPaymentPaidMarker(paidCalls),
  })
  const json = await readJson(response)

  assert.equal(response.status, 202)
  assert.equal(json.ok, false)
  assert.equal(json.error, 'line_pay_confirm_not_safe_to_mark_paid')
  assert.equal(json.outcome, 'mismatch')
  assert.equal(json.markedPaid, false)
  assert.deepEqual(paidCalls, [])
  assertNoPaidMutation(json)
})

test('requestStatusChecker throw returns line_pay_request_status_check_failed', async () => {
  await assertErrorResponse(
    {
      linePayConfirmer: createLinePayConfirmer(createConfirmResult(), [], {
        code: '1172',
        message: 'Confirm processing unknown.',
      }),
      requestStatusChecker: createRequestStatusChecker(undefined, [], new Error('status failed')),
    },
    500,
    'line_pay_request_status_check_failed',
  )
})

test('paymentDetailsGetter throw returns line_pay_payment_details_check_failed', async () => {
  await assertErrorResponse(
    {
      linePayConfirmer: createLinePayConfirmer(createConfirmResult(), [], {
        code: '1172',
        message: 'Confirm processing unknown.',
      }),
      requestStatusChecker: createRequestStatusChecker(),
      paymentDetailsGetter: createPaymentDetailsGetter(undefined, [], new Error('details failed')),
    },
    500,
    'line_pay_payment_details_check_failed',
  )
})

test('paymentMetadataUpdater throw returns line_pay_confirm_metadata_update_failed', async () => {
  await assertErrorResponse(
    {
      paymentMetadataUpdater: createMetadataUpdater([], new Error('metadata failed')),
    },
    500,
    'line_pay_confirm_metadata_update_failed',
  )
})

test('missing paymentPaidMarker returns line_pay_payment_paid_marker_missing when safe to mark paid', async () => {
  await assertErrorResponse(
    {
      paymentPaidMarker: undefined,
    },
    500,
    'line_pay_payment_paid_marker_missing',
  )
})

test('missing productOrderPaidSyncer returns line_pay_product_order_paid_syncer_missing when safe to mark paid', async () => {
  await assertErrorResponse(
    {
      productOrderPaidSyncer: undefined,
    },
    500,
    'line_pay_product_order_paid_syncer_missing',
  )
})

test('paymentPaidMarker throw returns line_pay_payment_mark_paid_failed and does not sync order', async () => {
  const syncCalls: Array<Record<string, unknown>> = []

  await assertErrorResponse(
    {
      paymentPaidMarker: createPaymentPaidMarker([], new Error('mark paid failed')),
      productOrderPaidSyncer: createProductOrderPaidSyncer(syncCalls),
    },
    500,
    'line_pay_payment_mark_paid_failed',
  )
  assert.deepEqual(syncCalls, [])
})

test('productOrderPaidSyncer throw returns line_pay_product_order_sync_paid_failed', async () => {
  await assertErrorResponse(
    {
      productOrderPaidSyncer: createProductOrderPaidSyncer([], new Error('sync failed')),
    },
    500,
    'line_pay_product_order_sync_paid_failed',
  )
})

test('productOrderPaidSyncer unsafe result returns line_pay_product_order_sync_paid_failed', async () => {
  await assertErrorResponse(
    {
      productOrderPaidSyncer: async () => ({
        result: 'payment_mismatch',
      }),
    },
    500,
    'line_pay_product_order_sync_paid_failed',
  )
})

test('preflight errors do not call linePayConfirmer', async () => {
  const confirmCalls: Array<Record<string, unknown>> = []
  const response = await callHandler({
    paymentReader: createPaymentReader(createPayment({ status: 'paid' })),
    linePayConfirmer: createLinePayConfirmer(createConfirmResult(), confirmCalls),
  })

  assert.equal(response.status, 409)
  assert.deepEqual(confirmCalls, [])
})

test('preflight errors do not call paymentPaidMarker', async () => {
  const paidCalls: Array<Record<string, unknown>> = []
  const response = await callHandler({
    paymentReader: createPaymentReader(createPayment({ status: 'paid' })),
    paymentPaidMarker: createPaymentPaidMarker(paidCalls),
  })

  assert.equal(response.status, 409)
  assert.deepEqual(paidCalls, [])
})

test('LINE Pay disabled does not call linePayConfirmer', async () => {
  const confirmCalls: Array<Record<string, unknown>> = []
  const response = await callHandler({
    env: {
      NEXT_PUBLIC_ENABLE_LINE_PAY: 'false',
    },
    linePayConfirmer: createLinePayConfirmer(createConfirmResult(), confirmCalls),
  })

  assert.equal(response.status, 404)
  assert.deepEqual(confirmCalls, [])
})

test('LINE Pay disabled does not call paymentPaidMarker', async () => {
  const paidCalls: Array<Record<string, unknown>> = []
  const response = await callHandler({
    env: {
      NEXT_PUBLIC_ENABLE_LINE_PAY: 'false',
    },
    paymentPaidMarker: createPaymentPaidMarker(paidCalls),
  })

  assert.equal(response.status, 404)
  assert.deepEqual(paidCalls, [])
})

test('product order already paid does not call linePayConfirmer', async () => {
  const confirmCalls: Array<Record<string, unknown>> = []
  const response = await callHandler({
    productOrderReader: createProductOrderReader(createProductOrder({ payment_status: 'paid' })),
    linePayConfirmer: createLinePayConfirmer(createConfirmResult(), confirmCalls),
  })

  assert.equal(response.status, 409)
  assert.deepEqual(confirmCalls, [])
})

test('product order already paid does not call paymentPaidMarker', async () => {
  const paidCalls: Array<Record<string, unknown>> = []
  const response = await callHandler({
    productOrderReader: createProductOrderReader(createProductOrder({ payment_status: 'paid' })),
    paymentPaidMarker: createPaymentPaidMarker(paidCalls),
  })

  assert.equal(response.status, 409)
  assert.deepEqual(paidCalls, [])
})

test('confirm mismatch does not call paymentPaidMarker', async () => {
  const paidCalls: Array<Record<string, unknown>> = []
  const response = await callHandler({
    linePayConfirmer: createLinePayConfirmer(createConfirmResult({ amount: 1499 })),
    paymentPaidMarker: createPaymentPaidMarker(paidCalls),
  })
  const json = await readJson(response)

  assert.equal(response.status, 202)
  assert.equal(json.error, 'line_pay_confirm_not_safe_to_mark_paid')
  assert.equal(json.outcome, 'mismatch')
  assert.deepEqual(paidCalls, [])
})

test('confirm failed does not call paymentPaidMarker', async () => {
  const paidCalls: Array<Record<string, unknown>> = []
  const response = await callHandler({
    linePayConfirmer: createLinePayConfirmer(createConfirmResult({ returnCode: '1101' })),
    paymentPaidMarker: createPaymentPaidMarker(paidCalls),
  })
  const json = await readJson(response)

  assert.equal(response.status, 202)
  assert.equal(json.error, 'line_pay_confirm_not_safe_to_mark_paid')
  assert.equal(json.outcome, 'confirm_failed')
  assert.deepEqual(paidCalls, [])
})

test('request status non-paid outcomes do not call paymentPaidMarker', async () => {
  const statuses = [
    ['authentication_pending', 'authentication_pending'],
    ['authentication_completed', 'authentication_completed_needs_confirm'],
    ['authentication_canceled_or_expired', 'authentication_canceled_or_expired'],
    ['payment_failed', 'payment_failed'],
    ['unknown_status', 'confirm_ambiguous'],
  ]

  for (const [status, expectedOutcome] of statuses) {
    const paidCalls: Array<Record<string, unknown>> = []
    const response = await callHandler({
      linePayConfirmer: createLinePayConfirmer(createConfirmResult(), [], {
        code: '1172',
        message: 'Confirm processing unknown.',
      }),
      requestStatusChecker: createRequestStatusChecker({
        returnCode: '9999',
        returnMessage: status,
        transactionId,
        // 測試刻意包含非列舉值（unknown_status），模擬 LINE Pay 回傳未知狀態。
        status: status as LinePayPaymentRequestStatus,
      }),
      paymentPaidMarker: createPaymentPaidMarker(paidCalls),
    })
    const json = await readJson(response)

    assert.equal(response.status, 202)
    assert.equal(json.error, 'line_pay_confirm_not_safe_to_mark_paid')
    assert.equal(json.outcome, expectedOutcome)
    assert.deepEqual(paidCalls, [])
  }
})

test('payment completed without matching details does not call paymentPaidMarker', async () => {
  const paidCalls: Array<Record<string, unknown>> = []
  const response = await callHandler({
    linePayConfirmer: createLinePayConfirmer(createConfirmResult(), [], {
      code: '1172',
      message: 'Confirm processing unknown.',
    }),
    requestStatusChecker: createRequestStatusChecker(),
    paymentDetailsGetter: createPaymentDetailsGetter({
      returnCode: '0000',
      returnMessage: 'Success.',
      info: [],
    }),
    paymentPaidMarker: createPaymentPaidMarker(paidCalls),
  })
  const json = await readJson(response)

  assert.equal(response.status, 202)
  assert.equal(json.error, 'line_pay_confirm_not_safe_to_mark_paid')
  assert.equal(json.outcome, 'needs_payment_details_check')
  assert.deepEqual(paidCalls, [])
})

test('successful preflight calls linePayConfirmer with transactionId amount and currency', async () => {
  const paymentReaderCalls: Array<{ orderId: string }> = []
  const productOrderReaderCalls: Array<{ productOrderId: string }> = []
  const confirmCalls: Array<Record<string, unknown>> = []
  const metadataCalls: Array<Record<string, unknown>> = []
  const paidCalls: Array<Record<string, unknown>> = []
  const syncCalls: Array<Record<string, unknown>> = []
  const response = await callHandler({
    request: createRequest(`orderId=%20${orderId}%20&transactionId=${transactionId}`),
    paymentReader: createPaymentReader(createPayment(), paymentReaderCalls),
    productOrderReader: createProductOrderReader(createProductOrder(), productOrderReaderCalls),
    linePayConfirmer: createLinePayConfirmer(createConfirmResult(), confirmCalls),
    paymentMetadataUpdater: createMetadataUpdater(metadataCalls),
    paymentPaidMarker: createPaymentPaidMarker(paidCalls),
    productOrderPaidSyncer: createProductOrderPaidSyncer(syncCalls),
  })
  const json = await readJson(response)

  assert.equal(response.status, 200)
  assert.deepEqual(json, {
    ok: true,
    provider: 'line_pay',
    confirmed: true,
    markedPaid: true,
    paymentId,
    productOrderId,
    orderId,
    transactionId,
    amount: 1500,
    currency: 'TWD',
    outcome: 'confirmed_paid',
  })
  assert.deepEqual(paymentReaderCalls, [{ orderId }])
  assert.deepEqual(productOrderReaderCalls, [{ productOrderId }])
  assert.equal(confirmCalls.length, 1)
  assert.equal(confirmCalls[0].transactionId, transactionId)
  assert.deepEqual(confirmCalls[0].payloadInput, {
    amount: 1500,
    currency: 'TWD',
  })
  assert.equal(typeof json.transactionId, 'string')
  assertSafeResponse(json)
  assert.equal(metadataCalls.length, 1)
  assert.equal(paidCalls.length, 1)
  assert.equal(paidCalls[0].provider, 'line_pay')
  assert.equal(paidCalls[0].transactionId, transactionId)
  assert.equal(paidCalls[0].orderId, orderId)
  assert.equal(paidCalls[0].amount, 1500)
  assert.equal(paidCalls[0].currency, 'TWD')
  assert.equal(syncCalls.length, 1)
  assert.deepEqual(syncCalls[0], {
    productOrderId,
    paymentId,
    provider: 'line_pay',
    transactionId,
    orderId,
  })
})

test('confirm success writes confirm, outcome, and paid metadata', async () => {
  const metadataCalls: Array<Record<string, unknown>> = []
  const paidCalls: Array<Record<string, unknown>> = []
  const response = await callHandler({
    paymentMetadataUpdater: createMetadataUpdater(metadataCalls),
    paymentPaidMarker: createPaymentPaidMarker(paidCalls),
  })
  const json = await readJson(response)
  const metadata = metadataCalls[0].metadata as Record<string, unknown>
  const linePay = metadata.linePay as Record<string, unknown>
  const confirm = linePay.confirm as Record<string, unknown>
  const outcome = linePay.outcome as Record<string, unknown>
  const paidMetadata = paidCalls[0].metadata as Record<string, unknown>
  const paidLinePay = paidMetadata.linePay as Record<string, unknown>
  const paid = paidLinePay.paid as Record<string, unknown>

  assert.equal(response.status, 200)
  assert.equal(json.confirmed, true)
  assert.equal(json.markedPaid, true)
  assert.equal(confirm.returnCode, '0000')
  assert.equal(confirm.returnMessage, 'Success.')
  assert.equal(confirm.orderId, orderId)
  assert.equal(confirm.transactionId, transactionId)
  assert.deepEqual(confirm.payInfo, [{ amount: 1500 }])
  assert.equal(outcome.outcome, 'confirmed_paid')
  assert.equal(outcome.shouldMarkPaid, true)
  assert.equal(paid.provider, 'line_pay')
  assert.equal(paid.transactionId, transactionId)
  assert.equal(paid.orderId, orderId)
  assert.equal(typeof paid.markedAt, 'string')
  assertSafeResponse(paidMetadata)
})

test('19 digit transactionId stays string', async () => {
  const response = await callHandler()
  const json = await readJson(response)

  assert.equal(json.transactionId, transactionId)
  assert.equal(typeof json.transactionId, 'string')
})

test('pre-query errors do not call payment or product order readers', async () => {
  const paymentReaderCalls: Array<{ orderId: string }> = []
  const productOrderReaderCalls: Array<{ productOrderId: string }> = []
  const response = await callHandler({
    request: createRequest(`orderId=bad/order&transactionId=${transactionId}`),
    paymentReader: createPaymentReader(createPayment(), paymentReaderCalls),
    productOrderReader: createProductOrderReader(createProductOrder(), productOrderReaderCalls),
  })

  assert.equal(response.status, 400)
  assert.deepEqual(paymentReaderCalls, [])
  assert.deepEqual(productOrderReaderCalls, [])
})

test('payment preflight errors do not call product order reader', async () => {
  const productOrderReaderCalls: Array<{ productOrderId: string }> = []
  const response = await callHandler({
    paymentReader: createPaymentReader(createPayment({ status: 'paid' })),
    productOrderReader: createProductOrderReader(createProductOrder(), productOrderReaderCalls),
  })

  assert.equal(response.status, 409)
  assert.deepEqual(productOrderReaderCalls, [])
})

test('handler does not call LINE Pay API or global fetch', async () => {
  const originalFetch = globalThis.fetch
  let called = false

  globalThis.fetch = (async () => {
    called = true
    throw new Error('global fetch must not be called')
  }) as typeof fetch

  try {
    const response = await callHandler()
    const json = await readJson(response)

    assert.equal(response.status, 200)
    assert.equal(json.confirmed, true)
    assert.equal(called, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('handler source does not include direct DB update behavior', () => {
  const source = String(handleProductOrderLinePayConfirmRedirect)

  assert.equal(source.includes('confirmLinePayPayment'), false)
  assert.equal(source.includes('requestLinePayPayment'), false)
  assert.equal(source.includes('fetch('), false)
  assert.equal(source.includes('from('), false)
  assert.equal(source.includes('update('), false)
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
