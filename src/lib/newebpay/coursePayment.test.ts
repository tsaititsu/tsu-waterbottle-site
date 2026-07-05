import assert from 'node:assert/strict'
import {
  buildCoursePaymentInsertPayload,
  buildCoursePaymentRawPayload,
  buildNewebPayMerchantOrderUrl,
} from './coursePayment'

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

const insertPayload = buildCoursePaymentInsertPayload({
  userId: 'user-course-1',
  courseId: 'basic',
  courseTitle: '初級班',
  amount: 9800,
  merchantOrderNo,
  itemDesc: '初級班｜小白專區',
})

assert.deepEqual(insertPayload, {
  user_id: 'user-course-1',
  provider: 'newebpay',
  item_type: 'course',
  item_id: 'basic',
  item_name: '初級班',
  amount_twd: 9800,
  currency: 'TWD',
  status: 'pending',
  merchant_order_no: merchantOrderNo,
  raw_payload: {
    itemType: 'course',
    courseId: 'basic',
    amount: 9800,
    merchantOrderNo,
    source: 'course',
    paymentMode: 'credit',
    itemDesc: '初級班｜小白專區',
  },
})

assert.equal(insertPayload.raw_payload.amount, 9800)
assert.equal(insertPayload.raw_payload.source, 'course')
assert.equal(insertPayload.raw_payload.courseId, 'basic')
assert.equal('TradeInfo' in insertPayload.raw_payload, false)
assert.equal('TradeSha' in insertPayload.raw_payload, false)
assert.equal('HashKey' in insertPayload.raw_payload, false)
assert.equal('HashIV' in insertPayload.raw_payload, false)
