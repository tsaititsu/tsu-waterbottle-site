import assert from 'node:assert/strict'
import { createCipheriv } from 'node:crypto'
import { createTradeSha, encryptTradeInfo } from './crypto'
import {
  buildNewebPayNotifyErrorMetadata,
  buildMarkPaymentPaidInputFromNotify,
  buildNewebPayNotifyRawPayload,
  parseNewebPayNotifyPayload,
  persistNewebPayNotifyQueryFallback,
  persistNewebPayNotifyPaymentResult,
  syncNewebPayBookingAfterPayment,
  syncNewebPayCourseAfterPayment,
  validateNewebPayPaymentMatch,
} from './notify'
import type { PaymentPaidContext, PaymentRecord } from '../supabase/payments'

const hashKey = '12345678901234567890123456789012'
const hashIv = '1234567890123456'
const merchantId = 'MS123456789'

function encryptText(text: string) {
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(hashKey, 'utf8'), Buffer.from(hashIv, 'utf8'))
  return cipher.update(text, 'utf8', 'hex') + cipher.final('hex')
}

function createPayload(tradeInfo: string, overrides: Partial<Parameters<typeof parseNewebPayNotifyPayload>[0]> = {}) {
  return {
    status: 'SUCCESS',
    merchantId,
    version: '2.3',
    tradeInfo,
    tradeSha: createTradeSha(tradeInfo, hashKey, hashIv),
    expectedMerchantId: merchantId,
    hashKey,
    hashIv,
    ...overrides,
  }
}

const queryTradeInfo = encryptTradeInfo(
  {
    Status: 'SUCCESS',
    MerchantID: merchantId,
    MerchantOrderNo: 'WB20260703172530A1B2',
    TradeNo: '25070317253012345',
    Amt: 3600,
    PaymentType: 'CREDIT',
    PaymentMethod: 'CREDIT',
    PayTime: '2026-07-03 17:30:00',
  },
  hashKey,
  hashIv,
)
const parsedQuery = parseNewebPayNotifyPayload(createPayload(queryTradeInfo))

assert.equal(parsedQuery.status, 'SUCCESS')
assert.equal(parsedQuery.merchantId, merchantId)
assert.equal(parsedQuery.merchantOrderNo, 'WB20260703172530A1B2')
assert.equal(parsedQuery.tradeNo, '25070317253012345')
assert.equal(parsedQuery.amount, 3600)
assert.equal(parsedQuery.paymentType, 'CREDIT')
assert.equal(parsedQuery.paymentMethod, 'CREDIT')
assert.equal(parsedQuery.payTime, '2026-07-03 17:30:00')

assert.deepEqual(buildNewebPayNotifyRawPayload(parsedQuery), {
  status: 'SUCCESS',
  merchantId,
  merchantOrderNo: 'WB20260703172530A1B2',
  tradeNo: '25070317253012345',
  amount: 3600,
  paymentType: 'CREDIT',
  paymentMethod: 'CREDIT',
  payTime: '2026-07-03 17:30:00',
})

const paidInput = buildMarkPaymentPaidInputFromNotify(parsedQuery, '2026-07-03T09:31:00.000Z')

assert.deepEqual(paidInput, {
  merchantOrderNo: 'WB20260703172530A1B2',
  providerTradeNo: '25070317253012345',
  paidAt: '2026-07-03 17:30:00',
  notifyReceivedAt: '2026-07-03T09:31:00.000Z',
  rawPayload: {
    status: 'SUCCESS',
    merchantId,
    merchantOrderNo: 'WB20260703172530A1B2',
    tradeNo: '25070317253012345',
    amount: 3600,
    paymentType: 'CREDIT',
    paymentMethod: 'CREDIT',
    payTime: '2026-07-03 17:30:00',
  },
})
assert.equal(paidInput && 'bookingId' in paidInput, false)
assert.equal(paidInput && 'bookingStatus' in paidInput.rawPayload, false)
assert.equal(paidInput && 'paymentStatus' in paidInput.rawPayload, false)
assert.equal(paidInput && 'rawResult' in paidInput.rawPayload, false)

assert.throws(
  () => parseNewebPayNotifyPayload(createPayload(queryTradeInfo, { merchantId: 'WRONG_MERCHANT' })),
  /Invalid MerchantID/,
)

assert.throws(
  () => parseNewebPayNotifyPayload(createPayload(queryTradeInfo, { tradeSha: '0'.repeat(64) })),
  /Invalid TradeSha/,
)

assert.throws(
  () => parseNewebPayNotifyPayload(createPayload('UNSAFE_RAW_TRADE_INFO_VALUE')),
  /TradeInfo must be hex encoded/,
)

const notifyErrorMetadata = buildNewebPayNotifyErrorMetadata({
  status: 'SUCCESS',
  merchantId,
  tradeInfo: 'UNSAFE_RAW_TRADE_INFO_VALUE',
  tradeSha: 'UNSAFE_RAW_TRADE_SHA_VALUE',
  formKeys: ['TradeSha', 'TradeInfo', 'Version', 'MerchantID', 'Status'],
  error: new Error('bad decrypt'),
})
const serializedNotifyErrorMetadata = JSON.stringify(notifyErrorMetadata)

assert.deepEqual(notifyErrorMetadata.formKeys, ['MerchantID', 'Status', 'TradeInfo', 'TradeSha', 'Version'])
assert.equal(serializedNotifyErrorMetadata.includes('UNSAFE_RAW_TRADE_INFO_VALUE'), false)
assert.equal(serializedNotifyErrorMetadata.includes('UNSAFE_RAW_TRADE_SHA_VALUE'), false)
assert.equal(notifyErrorMetadata.tradeShaLength, 'UNSAFE_RAW_TRADE_SHA_VALUE'.length)
assert.equal(notifyErrorMetadata.tradeShaLooksSha256, false)

const jsonTradeInfo = encryptText(JSON.stringify({
  Status: 'SUCCESS',
  Message: '付款成功',
  Result: {
    MerchantID: merchantId,
    MerchantOrderNo: 'WB20260703172530C3D4',
    TradeNo: '25070317253067890',
    Amt: '3600',
    PaymentType: 'LINEPAY',
    PaymentMethod: 'LINEPAY',
    PayTime: '2026-07-03 17:35:00',
  },
}))
const parsedJson = parseNewebPayNotifyPayload(createPayload(jsonTradeInfo))

assert.equal(parsedJson.status, 'SUCCESS')
assert.equal(parsedJson.merchantOrderNo, 'WB20260703172530C3D4')
assert.equal(parsedJson.tradeNo, '25070317253067890')
assert.equal(parsedJson.amount, 3600)
assert.equal(parsedJson.paymentType, 'LINEPAY')
assert.equal(parsedJson.paymentMethod, 'LINEPAY')

function createPaymentPaidContext(overrides: Partial<PaymentPaidContext> = {}): PaymentPaidContext {
  return {
    id: 'payment-1',
    userId: null,
    bookingId: null,
    itemType: 'newebpay_smoke_test',
    itemId: 'newebpay_live_smoke_test_1',
    provider: 'newebpay',
    status: 'paid',
    merchantOrderNo: 'WB20260703172530A1B2',
    providerTradeNo: '26070416000012345',
    paidAt: '2026-07-04 16:00:00',
    ...overrides,
  }
}

async function runPaymentPersistenceAssertions() {
  let updatedInput: unknown
  const paidContext = createPaymentPaidContext({ bookingId: 'booking-1' })
  const matchingPayment = createPaymentRecord({
    bookingId: 'booking-1',
    itemType: 'booking',
    itemId: 'booking-1',
    itemName: '水瓶先生論命',
    amountTwd: 3600,
    rawPayload: {
      amount: 3600,
      itemKey: 'booking_consultation_60',
      merchantOrderNo: 'WB20260703172530A1B2',
    },
  })

  assert.deepEqual(validateNewebPayPaymentMatch({
    payment: matchingPayment,
    expectedMerchantOrderNo: 'WB20260703172530A1B2',
    providerMerchantOrderNo: 'WB20260703172530A1B2',
    providerAmount: 3600,
  }), {
    ok: true,
    payment: matchingPayment,
    localAmount: 3600,
    providerAmount: 3600,
  })

  assert.deepEqual(validateNewebPayPaymentMatch({
    payment: matchingPayment,
    expectedMerchantOrderNo: 'WB20260703172530A1B2',
    providerMerchantOrderNo: 'WB20260703172530A1B2',
    providerAmount: 3500,
  }), {
    ok: false,
    error: 'payment_amount_mismatch',
    result: 'amount_mismatch',
    localAmount: 3600,
    providerAmount: 3500,
    paymentStatus: 'pending',
  })

  const updatedResult = await persistNewebPayNotifyPaymentResult(
    parsedQuery,
    async () => matchingPayment,
    async (input) => {
      updatedInput = input
      return { result: 'updated', payment: paidContext }
    },
    '2026-07-03T09:31:00.000Z',
  )

  assert.deepEqual(updatedResult, {
    ok: true,
    paymentStatus: 'paid',
    result: 'updated',
    payment: paidContext,
  })
  assert.deepEqual(updatedInput, paidInput)
  assert.equal('rawPayload' in updatedResult.payment, false)

  const alreadyPaidResult = await persistNewebPayNotifyPaymentResult(
    parsedQuery,
    async () => createPaymentRecord({
      ...matchingPayment,
      status: 'paid',
    }),
    async () => ({
      result: 'already_paid',
      payment: paidContext,
    }),
  )

  assert.deepEqual(alreadyPaidResult, {
    ok: true,
    paymentStatus: 'paid',
    result: 'already_paid',
    payment: paidContext,
  })

  let markCalledAfterNotFound = false
  const notFoundResult = await persistNewebPayNotifyPaymentResult(
    parsedQuery,
    async () => null,
    async () => {
      markCalledAfterNotFound = true
      return { result: 'updated', payment: paidContext }
    },
  )

  assert.deepEqual(notFoundResult, {
    ok: false,
    error: 'payment_not_found',
    result: 'not_found',
    providerAmount: 3600,
    paymentStatus: null,
  })
  assert.equal(markCalledAfterNotFound, false)
  assert.equal('payment' in notFoundResult, false)

  let markCalledAfterMissingAmount = false
  const missingAmountResult = await persistNewebPayNotifyPaymentResult(
    parsedQuery,
    async () => createPaymentRecord({
      ...matchingPayment,
      rawPayload: {
        itemKey: 'booking_consultation_60',
        merchantOrderNo: 'WB20260703172530A1B2',
      },
    }),
    async () => {
      markCalledAfterMissingAmount = true
      return { result: 'updated', payment: paidContext }
    },
  )

  assert.deepEqual(missingAmountResult, {
    ok: false,
    error: 'payment_amount_missing',
    result: 'amount_missing',
    localAmount: null,
    providerAmount: 3600,
    paymentStatus: 'pending',
  })
  assert.equal(markCalledAfterMissingAmount, false)
  assert.equal('payment' in missingAmountResult, false)

  let markCalledAfterAmountMismatch = false
  const amountMismatchResult = await persistNewebPayNotifyPaymentResult(
    parsedQuery,
    async () => createPaymentRecord({
      ...matchingPayment,
      rawPayload: {
        amount: 3500,
        itemKey: 'booking_consultation_60',
        merchantOrderNo: 'WB20260703172530A1B2',
      },
    }),
    async () => {
      markCalledAfterAmountMismatch = true
      return { result: 'updated', payment: paidContext }
    },
  )

  assert.deepEqual(amountMismatchResult, {
    ok: false,
    error: 'payment_amount_mismatch',
    result: 'amount_mismatch',
    localAmount: 3500,
    providerAmount: 3600,
    paymentStatus: 'pending',
  })
  assert.equal(markCalledAfterAmountMismatch, false)
  assert.equal('payment' in amountMismatchResult, false)

  let markCalledAfterAlreadyPaidMismatch = false
  const alreadyPaidMismatchResult = await persistNewebPayNotifyPaymentResult(
    parsedQuery,
    async () => createPaymentRecord({
      ...matchingPayment,
      status: 'paid',
      rawPayload: {
        amount: 3500,
        itemKey: 'booking_consultation_60',
        merchantOrderNo: 'WB20260703172530A1B2',
      },
    }),
    async () => {
      markCalledAfterAlreadyPaidMismatch = true
      return { result: 'already_paid', payment: paidContext }
    },
  )

  assert.deepEqual(alreadyPaidMismatchResult, {
    ok: false,
    error: 'payment_amount_mismatch',
    result: 'amount_mismatch',
    localAmount: 3500,
    providerAmount: 3600,
    paymentStatus: 'paid',
  })
  assert.equal(markCalledAfterAlreadyPaidMismatch, false)
  assert.equal('payment' in alreadyPaidMismatchResult, false)

  let getPaymentCalledForNonSuccess = false
  let nonSuccessCalled = false
  const nonSuccessResult = await persistNewebPayNotifyPaymentResult(
    {
      ...parsedQuery,
      status: 'TRADE_FAIL',
    },
    async () => {
      getPaymentCalledForNonSuccess = true
      return matchingPayment
    },
    async () => {
      nonSuccessCalled = true
      return { result: 'updated', payment: {} as never }
    },
  )

  assert.deepEqual(nonSuccessResult, {
    ok: true,
    ignored: true,
    status: 'TRADE_FAIL',
  })
  assert.equal(getPaymentCalledForNonSuccess, false)
  assert.equal(nonSuccessCalled, false)
  assert.equal('payment' in nonSuccessResult, false)

  assert.throws(
    () => parseNewebPayNotifyPayload(createPayload(queryTradeInfo, { tradeSha: '1'.repeat(64) })),
    /Invalid TradeSha/,
  )
}

function createPaymentRecord(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: 'payment-1',
    userId: null,
    bookingId: null,
    provider: 'newebpay',
    providerPaymentId: null,
    itemType: 'newebpay_smoke_test',
    itemId: 'newebpay_live_smoke_test_1',
    itemName: '藍新正式環境測試付款',
    amountTwd: 1,
    currency: 'TWD',
    status: 'pending',
    paidAt: null,
    refundedAt: null,
    rawPayload: {
      amount: 1,
      itemKey: 'newebpay_live_smoke_test_1',
      merchantOrderNo: 'WB20260703172530A1B2',
    },
    merchantOrderNo: 'WB20260703172530A1B2',
    providerTradeNo: null,
    notifyReceivedAt: null,
    failureReason: null,
    createdAt: '2026-07-03T09:00:00.000Z',
    updatedAt: '2026-07-03T09:00:00.000Z',
    ...overrides,
  }
}

async function runQueryFallbackAssertions() {
  const config = {
    merchantId,
    hashKey,
    hashIv,
    env: 'production' as const,
    version: '2.3',
    siteUrl: 'https://example.com',
    mpgGatewayUrl: 'https://core.newebpay.com/MPG/mpg_gateway',
    mpgEndpoint: 'https://core.newebpay.com/MPG/mpg_gateway',
  }
  let queryInput: unknown
  let markInput: unknown
  const successQuery = {
    status: 'SUCCESS',
    merchantOrderNo: 'WB20260703172530A1B2',
    amount: 1,
    tradeStatus: '1',
    tradeNo: '26070416000012345',
    paymentType: 'CREDIT',
    paymentMethod: 'CREDIT',
    payTime: '2026-07-04 16:00:00',
    rawResult: {},
  }

  const updated = await persistNewebPayNotifyQueryFallback({
    merchantOrderNo: 'WB20260703172530A1B2',
    config,
    getPaymentByMerchantOrderNo: async () => createPaymentRecord(),
    queryNewebPayTrade: async (input) => {
      queryInput = input
      return successQuery
    },
    markPaymentPaid: async (input) => {
      markInput = input
      return { result: 'updated', payment: createPaymentPaidContext({ bookingId: 'booking-1' }) }
    },
    notifyReceivedAt: '2026-07-04T08:01:00.000Z',
  })

  assert.deepEqual(updated, {
    ok: true,
    paymentStatus: 'paid',
    result: 'updated',
    query: successQuery,
    payment: createPaymentPaidContext({ bookingId: 'booking-1' }),
  })
  assert.deepEqual(queryInput, {
    merchantId,
    merchantOrderNo: 'WB20260703172530A1B2',
    amount: 1,
    hashKey,
    hashIv,
    env: 'production',
  })
  assert.deepEqual(markInput, {
    merchantOrderNo: 'WB20260703172530A1B2',
    providerTradeNo: '26070416000012345',
    paidAt: '2026-07-04 16:00:00',
    notifyReceivedAt: '2026-07-04T08:01:00.000Z',
    rawPayload: {
      source: 'query_fallback',
      status: 'SUCCESS',
      merchantOrderNo: 'WB20260703172530A1B2',
      tradeStatus: '1',
      tradeNo: '26070416000012345',
      amount: 1,
      paymentType: 'CREDIT',
      paymentMethod: 'CREDIT',
      payTime: '2026-07-04 16:00:00',
    },
  })
  assert.equal(markInput && 'bookingId' in (markInput as Record<string, unknown>), false)
  assert.equal(
    JSON.stringify((markInput as { rawPayload: Record<string, unknown> }).rawPayload).includes('bookingStatus'),
    false,
  )

  const alreadyPaid = await persistNewebPayNotifyQueryFallback({
    merchantOrderNo: 'WB20260703172530A1B2',
    config,
    getPaymentByMerchantOrderNo: async () => createPaymentRecord({ status: 'paid' }),
    queryNewebPayTrade: async () => successQuery,
    markPaymentPaid: async () => ({ result: 'already_paid', payment: createPaymentPaidContext({ bookingId: 'booking-1' }) }),
  })
  assert.equal(alreadyPaid.ok, true)
  assert.equal('result' in alreadyPaid && alreadyPaid.result, 'already_paid')
  assert.equal('payment' in alreadyPaid && alreadyPaid.payment.bookingId, 'booking-1')

  let fallbackCourseSyncInput: unknown
  const courseFallback = await persistNewebPayNotifyQueryFallback({
    merchantOrderNo: 'WB20260703172530A1B2',
    config,
    getPaymentByMerchantOrderNo: async () => createPaymentRecord({
      userId: 'user-course-1',
      itemType: 'course',
      itemId: 'course-1',
      itemName: '紫微斗數初階課',
      amountTwd: 1,
      rawPayload: {
        amount: 1,
        itemType: 'course',
        merchantOrderNo: 'WB20260703172530A1B2',
      },
    }),
    queryNewebPayTrade: async () => successQuery,
    markPaymentPaid: async () => ({
      result: 'updated',
      payment: createPaymentPaidContext({
        userId: 'user-course-1',
        itemType: 'course',
        itemId: 'course-1',
      }),
    }),
  })

  assert.equal(courseFallback.ok, true)
  assert.equal('payment' in courseFallback && courseFallback.payment.itemType, 'course')
  if ('payment' in courseFallback) {
    const courseFallbackSync = await syncNewebPayCourseAfterPayment({
      payment: courseFallback.payment,
      markCoursePaid: async (input) => {
        fallbackCourseSyncInput = input
        return { result: 'inserted', userId: input.userId, courseId: input.courseId }
      },
    })

    assert.deepEqual(courseFallbackSync, {
      courseSync: 'inserted',
      userId: 'user-course-1',
      courseId: 'course-1',
    })
    assert.deepEqual(fallbackCourseSyncInput, {
      paymentId: 'payment-1',
      userId: 'user-course-1',
      courseId: 'course-1',
      paidAt: '2026-07-04 16:00:00',
    })
  }

  let markCalled = false
  const notPaid = await persistNewebPayNotifyQueryFallback({
    merchantOrderNo: 'WB20260703172530A1B2',
    config,
    getPaymentByMerchantOrderNo: async () => createPaymentRecord(),
    queryNewebPayTrade: async () => ({ ...successQuery, tradeStatus: '0' }),
    markPaymentPaid: async () => {
      markCalled = true
      return { result: 'updated', payment: createPaymentPaidContext() }
    },
  })
  assert.deepEqual(notPaid, {
    ok: true,
    ignored: true,
    reason: 'query_not_paid',
    query: { ...successQuery, tradeStatus: '0' },
  })
  assert.equal(markCalled, false)

  const amountMismatch = await persistNewebPayNotifyQueryFallback({
    merchantOrderNo: 'WB20260703172530A1B2',
    config,
    getPaymentByMerchantOrderNo: async () => createPaymentRecord(),
    queryNewebPayTrade: async () => ({ ...successQuery, amount: 2 }),
    markPaymentPaid: async () => {
      throw new Error('markPaymentPaid should not be called')
    },
  })
  assert.equal(amountMismatch.ok, true)
  assert.equal('reason' in amountMismatch && amountMismatch.reason, 'query_amount_mismatch')

  const orderMismatch = await persistNewebPayNotifyQueryFallback({
    merchantOrderNo: 'WB20260703172530A1B2',
    config,
    getPaymentByMerchantOrderNo: async () => createPaymentRecord(),
    queryNewebPayTrade: async () => ({ ...successQuery, merchantOrderNo: 'WB20260703172530ZZZZ' }),
    markPaymentPaid: async () => {
      throw new Error('markPaymentPaid should not be called')
    },
  })
  assert.equal(orderMismatch.ok, true)
  assert.equal('reason' in orderMismatch && orderMismatch.reason, 'query_merchant_order_mismatch')

  let queryCalled = false
  const notFound = await persistNewebPayNotifyQueryFallback({
    merchantOrderNo: 'WB20260703172530A1B2',
    config,
    getPaymentByMerchantOrderNo: async () => null,
    queryNewebPayTrade: async () => {
      queryCalled = true
      return successQuery
    },
    markPaymentPaid: async () => {
      throw new Error('markPaymentPaid should not be called')
    },
  })
  assert.deepEqual(notFound, {
    ok: false,
    error: 'payment_not_found',
    result: 'not_found',
  })
  assert.equal(queryCalled, false)
}

async function runBookingSyncAssertions() {
  let bookingSyncCalled = false
  const skipped = await syncNewebPayBookingAfterPayment({
    payment: createPaymentPaidContext({ bookingId: null }),
    markBookingPaid: async () => {
      bookingSyncCalled = true
      return { result: 'updated', bookingId: 'booking-1' }
    },
  })

  assert.deepEqual(skipped, {
    bookingSync: 'skipped_no_booking',
  })
  assert.equal(bookingSyncCalled, false)

  let markBookingInput: unknown
  const updated = await syncNewebPayBookingAfterPayment({
    payment: createPaymentPaidContext({ bookingId: 'booking-1' }),
    markBookingPaid: async (input) => {
      markBookingInput = input
      return { result: 'updated', bookingId: input.bookingId }
    },
  })

  assert.deepEqual(updated, {
    bookingSync: 'updated',
    bookingId: 'booking-1',
  })
  assert.deepEqual(markBookingInput, {
    bookingId: 'booking-1',
    paymentId: 'payment-1',
    provider: 'newebpay',
    providerTradeNo: '26070416000012345',
    paidAt: '2026-07-04 16:00:00',
  })
  assert.equal(markBookingInput && 'readingId' in (markBookingInput as Record<string, unknown>), false)
  assert.equal(markBookingInput && 'aiDivination' in (markBookingInput as Record<string, unknown>), false)

  const alreadyPaid = await syncNewebPayBookingAfterPayment({
    payment: createPaymentPaidContext({ bookingId: 'booking-1' }),
    markBookingPaid: async (input) => ({ result: 'already_paid', bookingId: input.bookingId }),
  })

  assert.deepEqual(alreadyPaid, {
    bookingSync: 'already_paid',
    bookingId: 'booking-1',
  })

  const notFound = await syncNewebPayBookingAfterPayment({
    payment: createPaymentPaidContext({ bookingId: 'booking-missing' }),
    markBookingPaid: async (input) => ({ result: 'not_found', bookingId: input.bookingId }),
  })

  assert.deepEqual(notFound, {
    bookingSync: 'not_found',
    bookingId: 'booking-missing',
  })

  const failed = await syncNewebPayBookingAfterPayment({
    payment: createPaymentPaidContext({ bookingId: 'booking-1' }),
    markBookingPaid: async () => {
      throw new Error('booking update failed')
    },
  })

  assert.deepEqual(failed, {
    bookingSync: 'failed',
    bookingId: 'booking-1',
    error: 'booking update failed',
  })
}

async function runCourseSyncAssertions() {
  let courseSyncInput: unknown
  const inserted = await syncNewebPayCourseAfterPayment({
    payment: createPaymentPaidContext({
      userId: 'user-course-1',
      itemType: 'course',
      itemId: 'course-1',
    }),
    markCoursePaid: async (input) => {
      courseSyncInput = input
      return { result: 'inserted', userId: input.userId, courseId: input.courseId }
    },
  })

  assert.deepEqual(inserted, {
    courseSync: 'inserted',
    userId: 'user-course-1',
    courseId: 'course-1',
  })
  assert.deepEqual(courseSyncInput, {
    paymentId: 'payment-1',
    userId: 'user-course-1',
    courseId: 'course-1',
    paidAt: '2026-07-04 16:00:00',
  })

  const updated = await syncNewebPayCourseAfterPayment({
    payment: createPaymentPaidContext({
      userId: 'user-course-1',
      itemType: 'course',
      itemId: 'course-1',
    }),
    markCoursePaid: async (input) => ({ result: 'updated', userId: input.userId, courseId: input.courseId }),
  })

  assert.deepEqual(updated, {
    courseSync: 'updated',
    userId: 'user-course-1',
    courseId: 'course-1',
  })

  const alreadyPaid = await syncNewebPayCourseAfterPayment({
    payment: createPaymentPaidContext({
      userId: 'user-course-1',
      itemType: 'course',
      itemId: 'course-1',
    }),
    markCoursePaid: async (input) => ({ result: 'already_paid', userId: input.userId, courseId: input.courseId }),
  })

  assert.deepEqual(alreadyPaid, {
    courseSync: 'already_paid',
    userId: 'user-course-1',
    courseId: 'course-1',
  })

  let missingUserCalled = false
  const missingUser = await syncNewebPayCourseAfterPayment({
    payment: createPaymentPaidContext({
      userId: null,
      itemType: 'course',
      itemId: 'course-1',
    }),
    markCoursePaid: async () => {
      missingUserCalled = true
      return { result: 'inserted', userId: 'user-course-1', courseId: 'course-1' }
    },
  })

  assert.deepEqual(missingUser, {
    courseSync: 'skipped_missing_course_context',
  })
  assert.equal(missingUserCalled, false)

  let missingCourseCalled = false
  const missingCourse = await syncNewebPayCourseAfterPayment({
    payment: createPaymentPaidContext({
      userId: 'user-course-1',
      itemType: 'course',
      itemId: null,
    }),
    markCoursePaid: async () => {
      missingCourseCalled = true
      return { result: 'inserted', userId: 'user-course-1', courseId: 'course-1' }
    },
  })

  assert.deepEqual(missingCourse, {
    courseSync: 'skipped_missing_course_context',
  })
  assert.equal(missingCourseCalled, false)

  let bookingCourseSyncCalled = false
  const booking = await syncNewebPayCourseAfterPayment({
    payment: createPaymentPaidContext({
      bookingId: 'booking-1',
      itemType: 'booking',
      itemId: 'booking-1',
    }),
    markCoursePaid: async () => {
      bookingCourseSyncCalled = true
      return { result: 'inserted', userId: 'user-course-1', courseId: 'course-1' }
    },
  })

  assert.deepEqual(booking, {
    courseSync: 'skipped_not_course',
  })
  assert.equal(bookingCourseSyncCalled, false)

  let smokeCourseSyncCalled = false
  const smoke = await syncNewebPayCourseAfterPayment({
    payment: createPaymentPaidContext(),
    markCoursePaid: async () => {
      smokeCourseSyncCalled = true
      return { result: 'inserted', userId: 'user-course-1', courseId: 'course-1' }
    },
  })

  assert.deepEqual(smoke, {
    courseSync: 'skipped_not_course',
  })
  assert.equal(smokeCourseSyncCalled, false)
}

Promise.all([
  runPaymentPersistenceAssertions(),
  runQueryFallbackAssertions(),
  runBookingSyncAssertions(),
  runCourseSyncAssertions(),
]).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
