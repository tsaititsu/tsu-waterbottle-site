import assert from 'node:assert/strict'
import { buildCoursePaymentRawPayload, buildNewebPayMerchantOrderUrl } from './coursePayment'

const merchantOrderNo = 'COURSELQ1ABCD1234'
const notifyUrl = buildNewebPayMerchantOrderUrl(
  'https://example.com',
  '/api/payments/newebpay/notify',
  merchantOrderNo,
)
const returnUrl = buildNewebPayMerchantOrderUrl(
  'https://example.com/',
  '/api/payments/newebpay/return',
  merchantOrderNo,
)

assert.equal(
  notifyUrl,
  `https://example.com/api/payments/newebpay/notify?merchantOrderNo=${merchantOrderNo}`,
)
assert.equal(
  returnUrl,
  `https://example.com/api/payments/newebpay/return?merchantOrderNo=${merchantOrderNo}`,
)

const rawPayload = buildCoursePaymentRawPayload({
  courseId: 'basic',
  amount: 9800,
  merchantOrderNo,
  itemDesc: '初級班｜小白專區',
})

assert.deepEqual(rawPayload, {
  itemType: 'course',
  courseId: 'basic',
  amount: 9800,
  merchantOrderNo,
  source: 'course',
  paymentMode: 'credit',
  itemDesc: '初級班｜小白專區',
})

assert.equal('TradeInfo' in rawPayload, false)
assert.equal('TradeSha' in rawPayload, false)
assert.equal('HashKey' in rawPayload, false)
assert.equal('HashIV' in rawPayload, false)
assert.equal('bookingId' in rawPayload, false)
assert.equal('spiritual_product' in rawPayload, false)
