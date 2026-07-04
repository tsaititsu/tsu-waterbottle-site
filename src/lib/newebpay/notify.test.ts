import assert from 'node:assert/strict'
import { createCipheriv } from 'node:crypto'
import { createTradeSha, encryptTradeInfo } from './crypto'
import {
  buildMarkPaymentPaidInputFromNotify,
  buildNewebPayNotifyRawPayload,
  parseNewebPayNotifyPayload,
  persistNewebPayNotifyPaymentResult,
} from './notify'

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

async function runPaymentPersistenceAssertions() {
  let updatedInput: unknown
  const updatedResult = await persistNewebPayNotifyPaymentResult(
    parsedQuery,
    async (input) => {
      updatedInput = input
      return { result: 'updated', payment: {} as never }
    },
    '2026-07-03T09:31:00.000Z',
  )

  assert.deepEqual(updatedResult, {
    ok: true,
    paymentStatus: 'paid',
    result: 'updated',
  })
  assert.deepEqual(updatedInput, paidInput)

  const alreadyPaidResult = await persistNewebPayNotifyPaymentResult(parsedQuery, async () => ({
    result: 'already_paid',
    payment: {} as never,
  }))

  assert.deepEqual(alreadyPaidResult, {
    ok: true,
    paymentStatus: 'paid',
    result: 'already_paid',
  })

  const notFoundResult = await persistNewebPayNotifyPaymentResult(parsedQuery, async () => ({
    result: 'not_found',
    payment: null,
  }))

  assert.deepEqual(notFoundResult, {
    ok: false,
    error: 'payment_not_found',
    result: 'not_found',
  })

  let nonSuccessCalled = false
  const nonSuccessResult = await persistNewebPayNotifyPaymentResult(
    {
      ...parsedQuery,
      status: 'TRADE_FAIL',
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
  assert.equal(nonSuccessCalled, false)

  assert.throws(
    () => parseNewebPayNotifyPayload(createPayload(queryTradeInfo, { tradeSha: '1'.repeat(64) })),
    /Invalid TradeSha/,
  )
}

runPaymentPersistenceAssertions().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
