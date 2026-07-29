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
  syncNewebPayAiChartAfterPayment,
  syncNewebPayBookingAfterPayment,
  syncNewebPayCourseAfterPayment,
  syncNewebPayDivinationAfterPayment,
  syncNewebPayProductOrderAfterPayment,
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
  paidAt: '2026-07-03T09:30:00.000Z',
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

const paidInputWithoutValidPayTime = buildMarkPaymentPaidInputFromNotify(
  { ...parsedQuery, payTime: 'invalid-pay-time' },
  '2026-07-03T09:31:00.000Z',
)
assert.equal(paidInputWithoutValidPayTime?.paidAt, '2026-07-03T09:31:00.000Z')

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

  let oneDollarMarkCalled = false
  const oneDollarDivinationResult = await persistNewebPayNotifyPaymentResult(
    {
      ...parsedQuery,
      amount: 1,
      paymentType: 'APPLEPAY',
      paymentMethod: 'APPLEPAY',
    },
    async () =>
      createPaymentRecord({
        itemType: 'ai_divination',
        itemId: '2df1a8da-3893-4b81-8d00-774a9cc0e472',
        itemName: '紫微占卜管理員 Apple Pay 測試｜1元測試付款',
        amountTwd: 1,
        rawPayload: {
          amount: 1,
          test_payment: true,
          one_dollar_test_mode: true,
          divination_one_dollar_test: true,
          divination_apple_pay_test: true,
          original_amount: 50,
          test_source: 'divination',
          payment_method: 'apple_pay',
          merchantOrderNo: 'WB20260703172530A1B2',
        },
      }),
    async () => {
      oneDollarMarkCalled = true
      return {
        result: 'updated',
        payment: createPaymentPaidContext({
          itemType: 'ai_divination',
          itemId: '2df1a8da-3893-4b81-8d00-774a9cc0e472',
        }),
      }
    },
  )

  assert.equal(oneDollarDivinationResult.ok, true)
  assert.equal(oneDollarMarkCalled, true)

  let oneDollarMismatchMarkedPaid = false
  const oneDollarDivinationMismatch = await persistNewebPayNotifyPaymentResult(
    {
      ...parsedQuery,
      amount: 50,
    },
    async () =>
      createPaymentRecord({
        itemType: 'ai_divination',
        itemId: '2df1a8da-3893-4b81-8d00-774a9cc0e472',
        amountTwd: 1,
        rawPayload: {
          amount: 1,
          test_payment: true,
          divination_one_dollar_test: true,
          divination_apple_pay_test: true,
          payment_method: 'apple_pay',
          merchantOrderNo: 'WB20260703172530A1B2',
        },
      }),
    async () => {
      oneDollarMismatchMarkedPaid = true
      return { result: 'updated', payment: paidContext }
    },
  )

  assert.equal(oneDollarDivinationMismatch.ok, false)
  assert.equal(
    'error' in oneDollarDivinationMismatch && oneDollarDivinationMismatch.error,
    'payment_amount_mismatch',
  )
  assert.equal(oneDollarMismatchMarkedPaid, false)

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
    paidAt: '2026-07-04T08:00:00.000Z',
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

  let fallbackDivinationSyncInput: unknown
  const divinationReadingId = '2df1a8da-3893-4b81-8d00-774a9cc0e472'
  const divinationFallback = await persistNewebPayNotifyQueryFallback({
    merchantOrderNo: 'WB20260703172530A1B2',
    config,
    getPaymentByMerchantOrderNo: async () => createPaymentRecord({
      itemType: 'ai_divination',
      itemId: divinationReadingId,
      itemName: '紫微牌卡占卜單次',
      amountTwd: 1,
      rawPayload: {
        amount: 1,
        itemType: 'ai_divination',
        readingId: divinationReadingId,
        merchantOrderNo: 'WB20260703172530A1B2',
      },
    }),
    queryNewebPayTrade: async () => successQuery,
    markPaymentPaid: async () => ({
      result: 'updated',
      payment: createPaymentPaidContext({
        itemType: 'ai_divination',
        itemId: divinationReadingId,
      }),
    }),
  })

  assert.equal(divinationFallback.ok, true)
  assert.equal('payment' in divinationFallback && divinationFallback.payment.itemType, 'ai_divination')
  if ('payment' in divinationFallback) {
    const divinationFallbackSync = await syncNewebPayDivinationAfterPayment({
      payment: divinationFallback.payment,
      merchantOrderNo: divinationFallback.query.merchantOrderNo,
      syncDivinationReading: async (input) => {
        fallbackDivinationSyncInput = input
        return { result: 'updated', readingId: input.itemId || '' }
      },
    })

    assert.deepEqual(divinationFallbackSync, {
      divinationSync: 'updated',
      readingId: divinationReadingId,
    })
    assert.deepEqual(fallbackDivinationSyncInput, {
      paymentId: 'payment-1',
      itemType: 'ai_divination',
      itemId: divinationReadingId,
      merchantOrderNo: 'WB20260703172530A1B2',
      paidAt: '2026-07-04 16:00:00',
    })
  }

  let fallbackAiChartSyncInput: unknown
  const aiChartReportId = '2df1a8da-3893-4b81-8d00-774a9cc0e472'
  const aiChartFallback = await persistNewebPayNotifyQueryFallback({
    merchantOrderNo: 'WB20260703172530A1B2',
    config,
    getPaymentByMerchantOrderNo: async () => createPaymentRecord({
      itemType: 'ai_chart_report',
      itemId: aiChartReportId,
      itemName: 'AI 命盤分析',
      amountTwd: 1,
      rawPayload: {
        amount: 1,
        itemType: 'ai_chart_report',
        reportId: aiChartReportId,
        merchantOrderNo: 'WB20260703172530A1B2',
      },
    }),
    queryNewebPayTrade: async () => successQuery,
    markPaymentPaid: async () => ({
      result: 'updated',
      payment: createPaymentPaidContext({
        itemType: 'ai_chart_report',
        itemId: aiChartReportId,
      }),
    }),
  })

  assert.equal(aiChartFallback.ok, true)
  assert.equal('payment' in aiChartFallback && aiChartFallback.payment.itemType, 'ai_chart_report')
  if ('payment' in aiChartFallback) {
    const aiChartFallbackSync = await syncNewebPayAiChartAfterPayment({
      payment: aiChartFallback.payment,
      merchantOrderNo: aiChartFallback.query.merchantOrderNo,
      syncAiChartReport: async (input) => {
        fallbackAiChartSyncInput = input
        return { result: 'updated', reportId: input.itemId || '' }
      },
    })

    assert.deepEqual(aiChartFallbackSync, {
      aiChartSync: 'updated',
      reportId: aiChartReportId,
    })
    assert.deepEqual(fallbackAiChartSyncInput, {
      paymentId: 'payment-1',
      itemType: 'ai_chart_report',
      itemId: aiChartReportId,
      merchantOrderNo: 'WB20260703172530A1B2',
      paidAt: '2026-07-04 16:00:00',
    })
  }

  let fallbackProductOrderSyncInput: unknown
  const productOrderId = '65e395bd-b7dd-4692-bf65-f817b1fd2caa'
  const productOrderFallback = await persistNewebPayNotifyQueryFallback({
    merchantOrderNo: 'WB20260703172530A1B2',
    config,
    getPaymentByMerchantOrderNo: async () => createPaymentRecord({
      itemType: 'spiritual_product_order',
      itemId: productOrderId,
      itemName: '開運商品訂單',
      amountTwd: 1,
      rawPayload: {
        amount: 1,
        itemType: 'spiritual_product_order',
        orderId: productOrderId,
        merchantOrderNo: 'WB20260703172530A1B2',
      },
    }),
    queryNewebPayTrade: async () => successQuery,
    markPaymentPaid: async () => ({
      result: 'updated',
      payment: createPaymentPaidContext({
        itemType: 'spiritual_product_order',
        itemId: productOrderId,
      }),
    }),
  })

  assert.equal(productOrderFallback.ok, true)
  assert.equal('payment' in productOrderFallback && productOrderFallback.payment.itemType, 'spiritual_product_order')
  if ('payment' in productOrderFallback) {
    const productOrderFallbackSync = await syncNewebPayProductOrderAfterPayment({
      payment: productOrderFallback.payment,
      syncProductOrder: async (input) => {
        fallbackProductOrderSyncInput = input
        return { result: 'synced', orderId: input.orderId }
      },
    })

    assert.deepEqual(productOrderFallbackSync, {
      productOrderSync: 'synced',
      orderId: productOrderId,
    })
    assert.deepEqual(fallbackProductOrderSyncInput, {
      paymentId: 'payment-1',
      orderId: productOrderId,
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

async function runDivinationSyncAssertions() {
  const readingId = '2df1a8da-3893-4b81-8d00-774a9cc0e472'
  let divinationSyncInput: unknown
  const updated = await syncNewebPayDivinationAfterPayment({
    payment: createPaymentPaidContext({
      itemType: 'ai_divination',
      itemId: readingId,
    }),
    merchantOrderNo: 'WB20260703172530A1B2',
    syncDivinationReading: async (input) => {
      divinationSyncInput = input
      return { result: 'updated', readingId: input.itemId || '' }
    },
  })

  assert.deepEqual(updated, {
    divinationSync: 'updated',
    readingId,
  })
  assert.deepEqual(divinationSyncInput, {
    paymentId: 'payment-1',
    itemType: 'ai_divination',
    itemId: readingId,
    merchantOrderNo: 'WB20260703172530A1B2',
    paidAt: '2026-07-04 16:00:00',
  })

  const alreadyPaid = await syncNewebPayDivinationAfterPayment({
    payment: createPaymentPaidContext({
      itemType: 'ai_divination',
      itemId: readingId,
    }),
    merchantOrderNo: 'WB20260703172530A1B2',
    syncDivinationReading: async (input) => ({ result: 'already_paid', readingId: input.itemId || '' }),
  })

  assert.deepEqual(alreadyPaid, {
    divinationSync: 'already_paid',
    readingId,
  })

  const notFound = await syncNewebPayDivinationAfterPayment({
    payment: createPaymentPaidContext({
      itemType: 'ai_divination',
      itemId: readingId,
    }),
    merchantOrderNo: 'WB20260703172530A1B2',
    syncDivinationReading: async (input) => ({ result: 'not_found', readingId: input.itemId || '' }),
  })

  assert.deepEqual(notFound, {
    divinationSync: 'not_found',
    readingId,
  })

  const invalidState = await syncNewebPayDivinationAfterPayment({
    payment: createPaymentPaidContext({
      itemType: 'ai_divination',
      itemId: readingId,
    }),
    merchantOrderNo: 'WB20260703172530A1B2',
    syncDivinationReading: async (input) => ({
      result: 'invalid_state',
      readingId: input.itemId || '',
      status: 'canceled',
    }),
  })

  assert.deepEqual(invalidState, {
    divinationSync: 'invalid_state',
    readingId,
    status: 'canceled',
  })

  for (const payment of [
    createPaymentPaidContext({ itemType: 'ai_divination', itemId: null }),
    createPaymentPaidContext({ itemType: 'ai_divination', itemId: '   ' }),
  ]) {
    let called = false
    const result = await syncNewebPayDivinationAfterPayment({
      payment,
      merchantOrderNo: 'WB20260703172530A1B2',
      syncDivinationReading: async () => {
        called = true
        throw new Error('should_not_call')
      },
    })

    assert.deepEqual(result, {
      divinationSync: 'skipped_missing_divination_context',
    })
    assert.equal(called, false)
  }

  let missingOrderCalled = false
  const missingOrder = await syncNewebPayDivinationAfterPayment({
    payment: createPaymentPaidContext({
      itemType: 'ai_divination',
      itemId: readingId,
    }),
    merchantOrderNo: '',
    syncDivinationReading: async () => {
      missingOrderCalled = true
      throw new Error('should_not_call')
    },
  })

  assert.deepEqual(missingOrder, {
    divinationSync: 'skipped_missing_divination_context',
  })
  assert.equal(missingOrderCalled, false)

  for (const payment of [
    createPaymentPaidContext({ bookingId: 'booking-1', itemType: 'booking', itemId: 'booking-1' }),
    createPaymentPaidContext({ userId: 'user-course-1', itemType: 'course', itemId: 'course-1' }),
    createPaymentPaidContext(),
  ]) {
    let called = false
    const result = await syncNewebPayDivinationAfterPayment({
      payment,
      merchantOrderNo: 'WB20260703172530A1B2',
      syncDivinationReading: async () => {
        called = true
        throw new Error('should_not_call')
      },
    })

    assert.deepEqual(result, {
      divinationSync: 'skipped_not_divination',
    })
    assert.equal(called, false)
  }
}

async function runAiChartSyncAssertions() {
  const reportId = '2df1a8da-3893-4b81-8d00-774a9cc0e472'
  let aiChartSyncInput: unknown
  const completionStartCalls: string[] = []
  const updated = await syncNewebPayAiChartAfterPayment({
    payment: createPaymentPaidContext({
      itemType: 'ai_chart_report',
      itemId: reportId,
    }),
    merchantOrderNo: 'WB20260703172530A1B2',
    startPaidAiChartReportCompletionInBackground: ({ reportId }) => {
      completionStartCalls.push(reportId)
    },
    syncAiChartReport: async (input, deps) => {
      aiChartSyncInput = input
      deps?.startPaidAiChartReportCompletionInBackground?.({
        reportId: input.itemId || '',
      })
      return { result: 'updated', reportId: input.itemId || '' }
    },
  })

  assert.deepEqual(updated, {
    aiChartSync: 'updated',
    reportId,
  })
  assert.deepEqual(aiChartSyncInput, {
    paymentId: 'payment-1',
    itemType: 'ai_chart_report',
    itemId: reportId,
    merchantOrderNo: 'WB20260703172530A1B2',
    paidAt: '2026-07-04 16:00:00',
  })
  assert.deepEqual(completionStartCalls, [reportId])

  const alreadyPaid = await syncNewebPayAiChartAfterPayment({
    payment: createPaymentPaidContext({
      itemType: 'ai_chart_report',
      itemId: reportId,
    }),
    merchantOrderNo: 'WB20260703172530A1B2',
    syncAiChartReport: async (input) => ({ result: 'already_paid', reportId: input.itemId || '' }),
  })

  assert.deepEqual(alreadyPaid, {
    aiChartSync: 'already_paid',
    reportId,
  })

  const notFound = await syncNewebPayAiChartAfterPayment({
    payment: createPaymentPaidContext({
      itemType: 'ai_chart_report',
      itemId: reportId,
    }),
    merchantOrderNo: 'WB20260703172530A1B2',
    syncAiChartReport: async (input) => ({ result: 'not_found', reportId: input.itemId || '' }),
  })

  assert.deepEqual(notFound, {
    aiChartSync: 'not_found',
    reportId,
  })

  const invalidState = await syncNewebPayAiChartAfterPayment({
    payment: createPaymentPaidContext({
      itemType: 'ai_chart_report',
      itemId: reportId,
    }),
    merchantOrderNo: 'WB20260703172530A1B2',
    syncAiChartReport: async (input) => ({
      result: 'invalid_state',
      reportId: input.itemId || '',
      paymentStatus: 'failed',
    }),
  })

  assert.deepEqual(invalidState, {
    aiChartSync: 'invalid_state',
    reportId,
    paymentStatus: 'failed',
  })

  for (const payment of [
    createPaymentPaidContext({ itemType: 'ai_chart_report', itemId: null }),
    createPaymentPaidContext({ itemType: 'ai_chart_report', itemId: '   ' }),
  ]) {
    let called = false
    const result = await syncNewebPayAiChartAfterPayment({
      payment,
      merchantOrderNo: 'WB20260703172530A1B2',
      syncAiChartReport: async () => {
        called = true
        throw new Error('should_not_call')
      },
    })

    assert.deepEqual(result, {
      aiChartSync: 'skipped_missing_ai_chart_context',
    })
    assert.equal(called, false)
  }

  let missingOrderCalled = false
  const missingOrder = await syncNewebPayAiChartAfterPayment({
    payment: createPaymentPaidContext({
      itemType: 'ai_chart_report',
      itemId: reportId,
    }),
    merchantOrderNo: '',
    syncAiChartReport: async () => {
      missingOrderCalled = true
      throw new Error('should_not_call')
    },
  })

  assert.deepEqual(missingOrder, {
    aiChartSync: 'skipped_missing_ai_chart_context',
  })
  assert.equal(missingOrderCalled, false)

  for (const payment of [
    createPaymentPaidContext({ bookingId: 'booking-1', itemType: 'booking', itemId: 'booking-1' }),
    createPaymentPaidContext({ userId: 'user-course-1', itemType: 'course', itemId: 'course-1' }),
    createPaymentPaidContext({ itemType: 'ai_divination', itemId: 'reading-1' }),
    createPaymentPaidContext(),
  ]) {
    let called = false
    const result = await syncNewebPayAiChartAfterPayment({
      payment,
      merchantOrderNo: 'WB20260703172530A1B2',
      syncAiChartReport: async () => {
        called = true
        throw new Error('should_not_call')
      },
    })

    assert.deepEqual(result, {
      aiChartSync: 'skipped_not_ai_chart',
    })
    assert.equal(called, false)
  }
}

async function runProductOrderSyncAssertions() {
  const orderId = '65e395bd-b7dd-4692-bf65-f817b1fd2caa'
  let productOrderSyncInput: unknown
  const synced = await syncNewebPayProductOrderAfterPayment({
    payment: createPaymentPaidContext({
      itemType: 'spiritual_product_order',
      itemId: orderId,
    }),
    syncProductOrder: async (input) => {
      productOrderSyncInput = input
      return { result: 'synced', orderId: input.orderId }
    },
  })

  assert.deepEqual(synced, {
    productOrderSync: 'synced',
    orderId,
  })
  assert.deepEqual(productOrderSyncInput, {
    paymentId: 'payment-1',
    orderId,
  })

  const alreadyPaid = await syncNewebPayProductOrderAfterPayment({
    payment: createPaymentPaidContext({
      itemType: 'spiritual_product_order',
      itemId: orderId,
    }),
    syncProductOrder: async (input) => ({ result: 'already_paid', orderId: input.orderId }),
  })

  assert.deepEqual(alreadyPaid, {
    productOrderSync: 'already_paid',
    orderId,
  })

  const notFound = await syncNewebPayProductOrderAfterPayment({
    payment: createPaymentPaidContext({
      itemType: 'spiritual_product_order',
      itemId: orderId,
    }),
    syncProductOrder: async (input) => ({ result: 'not_found', orderId: input.orderId }),
  })

  assert.deepEqual(notFound, {
    productOrderSync: 'not_found',
    orderId,
  })

  const paymentMismatch = await syncNewebPayProductOrderAfterPayment({
    payment: createPaymentPaidContext({
      itemType: 'spiritual_product_order',
      itemId: orderId,
    }),
    syncProductOrder: async (input) => ({ result: 'payment_mismatch', orderId: input.orderId }),
  })

  assert.deepEqual(paymentMismatch, {
    productOrderSync: 'payment_mismatch',
    orderId,
  })

  const invalidState = await syncNewebPayProductOrderAfterPayment({
    payment: createPaymentPaidContext({
      itemType: 'spiritual_product_order',
      itemId: orderId,
    }),
    syncProductOrder: async (input) => ({ result: 'invalid_state', orderId: input.orderId }),
  })

  assert.deepEqual(invalidState, {
    productOrderSync: 'invalid_state',
    orderId,
  })

  const failed = await syncNewebPayProductOrderAfterPayment({
    payment: createPaymentPaidContext({
      itemType: 'spiritual_product_order',
      itemId: orderId,
    }),
    syncProductOrder: async (input) => ({
      result: 'failed',
      orderId: input.orderId,
      error: 'product_order_paid_sync_update_failed',
    }),
  })

  assert.deepEqual(failed, {
    productOrderSync: 'failed',
    orderId,
    error: 'product_order_paid_sync_update_failed',
  })

  const thrown = await syncNewebPayProductOrderAfterPayment({
    payment: createPaymentPaidContext({
      itemType: 'spiritual_product_order',
      itemId: orderId,
    }),
    syncProductOrder: async () => {
      throw new Error('raw_payload TradeInfo TradeSha')
    },
  })

  assert.deepEqual(thrown, {
    productOrderSync: 'failed',
    orderId,
    error: 'product_order_paid_sync_failed',
  })
  const serializedThrown = JSON.stringify(thrown)
  assert.equal(serializedThrown.includes('raw_payload'), false)
  assert.equal(serializedThrown.includes('TradeInfo'), false)
  assert.equal(serializedThrown.includes('TradeSha'), false)
  assert.equal(serializedThrown.includes('HashKey'), false)
  assert.equal(serializedThrown.includes('HashIV'), false)

  for (const payment of [
    createPaymentPaidContext({ itemType: 'spiritual_product_order', itemId: null }),
    createPaymentPaidContext({ itemType: 'spiritual_product_order', itemId: '   ' }),
  ]) {
    let called = false
    const result = await syncNewebPayProductOrderAfterPayment({
      payment,
      syncProductOrder: async () => {
        called = true
        throw new Error('should_not_call')
      },
    })

    assert.deepEqual(result, {
      productOrderSync: 'skipped_missing_product_order_context',
    })
    assert.equal(called, false)
  }

  for (const payment of [
    createPaymentPaidContext({ bookingId: 'booking-1', itemType: 'booking', itemId: 'booking-1' }),
    createPaymentPaidContext({ userId: 'user-course-1', itemType: 'course', itemId: 'course-1' }),
    createPaymentPaidContext({ itemType: 'ai_divination', itemId: 'reading-1' }),
    createPaymentPaidContext({ itemType: 'ai_chart_report', itemId: 'report-1' }),
    createPaymentPaidContext(),
  ]) {
    let called = false
    const result = await syncNewebPayProductOrderAfterPayment({
      payment,
      syncProductOrder: async () => {
        called = true
        throw new Error('should_not_call')
      },
    })

    assert.deepEqual(result, {
      productOrderSync: 'skipped_not_product_order',
    })
    assert.equal(called, false)
  }
}

Promise.all([
  runPaymentPersistenceAssertions(),
  runQueryFallbackAssertions(),
  runBookingSyncAssertions(),
  runCourseSyncAssertions(),
  runDivinationSyncAssertions(),
  runAiChartSyncAssertions(),
  runProductOrderSyncAssertions(),
]).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
