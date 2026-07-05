import assert from 'node:assert/strict'
import {
  AI_DIVINATION_AMOUNT_TWD,
  AI_DIVINATION_ITEM_KEY,
  AI_DIVINATION_ITEM_TYPE,
  buildDivinationPaymentPayload,
} from './divinationPayment'

const readingId = '2df1a8da-3893-4b81-8d00-774a9cc0e472'
const merchantOrderNo = 'WB20260705143000ABCD'
const creditPayload = buildDivinationPaymentPayload({
  readingId,
  merchantOrderNo,
})

assert.equal(AI_DIVINATION_ITEM_KEY, 'ai_divination_single')
assert.equal(AI_DIVINATION_AMOUNT_TWD, 50)
assert.equal(AI_DIVINATION_ITEM_TYPE, 'ai_divination')

assert.deepEqual(creditPayload, {
  itemKey: 'ai_divination_single',
  itemType: 'ai_divination',
  itemId: readingId,
  amount: 50,
  source: 'ai_divination',
  paymentMode: 'credit',
  merchantOrderNo,
  rawPayload: {
    itemKey: 'ai_divination_single',
    itemType: 'ai_divination',
    readingId,
    amount: 50,
    source: 'ai_divination',
    paymentMode: 'credit',
    merchantOrderNo,
  },
})

assert.equal(creditPayload.rawPayload.amount, 50)
assert.equal(creditPayload.rawPayload.readingId, readingId)
assert.equal(creditPayload.paymentMode, 'credit')

const merchantDefaultPayload = buildDivinationPaymentPayload({
  readingId,
  merchantOrderNo,
  paymentMode: 'merchant_default',
})

assert.equal(merchantDefaultPayload.paymentMode, 'merchant_default')
assert.equal(merchantDefaultPayload.rawPayload.paymentMode, 'merchant_default')

assert.throws(
  () =>
    buildDivinationPaymentPayload({
      readingId: 'not-a-uuid',
      merchantOrderNo,
    }),
  /invalid_divination_reading_id/,
)

assert.throws(
  () =>
    buildDivinationPaymentPayload({
      readingId: '',
      merchantOrderNo,
    }),
  /readingId/,
)

assert.throws(
  () =>
    buildDivinationPaymentPayload({
      readingId,
      merchantOrderNo: '',
    }),
  /merchantOrderNo/,
)

assert.equal('TradeInfo' in creditPayload.rawPayload, false)
assert.equal('TradeSha' in creditPayload.rawPayload, false)
assert.equal('HashKey' in creditPayload.rawPayload, false)
assert.equal('HashIV' in creditPayload.rawPayload, false)
assert.equal('card_number' in creditPayload.rawPayload, false)
assert.equal('question' in creditPayload.rawPayload, false)
assert.equal('interpretation' in creditPayload.rawPayload, false)
assert.equal('bookingId' in creditPayload.rawPayload, false)
assert.equal('courseId' in creditPayload.rawPayload, false)
assert.equal('productId' in creditPayload.rawPayload, false)
