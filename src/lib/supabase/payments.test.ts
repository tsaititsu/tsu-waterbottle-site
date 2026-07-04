import assert from 'node:assert/strict'
import {
  buildPaidPaymentUpdate,
  buildPendingPaymentInsert,
  getMarkPaymentPaidDecision,
  mapPaymentPaidContext,
  mapPaymentRow,
  type PaymentRecord,
  type PaymentRow,
} from './payments'

const pendingPayload = buildPendingPaymentInsert({
  userId: 'user-1',
  bookingId: 'booking-1',
  provider: 'newebpay',
  itemType: 'booking',
  itemId: 'booking-1',
  itemName: '水瓶先生論命',
  merchantOrderNo: 'WB202607032025252082',
  amountTwd: 3600,
  rawPayload: {
    source: 'newebpay_create',
  },
})

assert.deepEqual(pendingPayload, {
  user_id: 'user-1',
  booking_id: 'booking-1',
  provider: 'newebpay',
  item_type: 'booking',
  item_id: 'booking-1',
  item_name: '水瓶先生論命',
  amount_twd: 3600,
  currency: 'TWD',
  status: 'pending',
  merchant_order_no: 'WB202607032025252082',
  raw_payload: {
    source: 'newebpay_create',
  },
})

const nullablePendingPayload = buildPendingPaymentInsert({
  provider: 'newebpay',
  itemType: 'newebpay_test',
  itemName: '藍新正式環境測試付款',
  merchantOrderNo: 'WB202607032025252083',
  amountTwd: 1,
})

assert.equal(nullablePendingPayload.user_id, null)
assert.equal(nullablePendingPayload.booking_id, null)
assert.equal(nullablePendingPayload.item_id, null)
assert.equal(nullablePendingPayload.raw_payload, null)

const paidUpdate = buildPaidPaymentUpdate(
  {
    merchantOrderNo: 'WB202607032025252082',
    providerTradeNo: '26070320270019132',
    paidAt: '2026-07-03T12:27:00.000Z',
    notifyReceivedAt: '2026-07-03T12:28:00.000Z',
    rawPayload: {
      Status: 'SUCCESS',
      Amt: 3600,
      PaymentType: 'CREDIT',
      PaymentMethod: 'CREDIT',
    },
  },
  '2026-07-03T12:29:00.000Z',
)

assert.deepEqual(paidUpdate, {
  status: 'paid',
  provider_trade_no: '26070320270019132',
  paid_at: '2026-07-03T12:27:00.000Z',
  notify_received_at: '2026-07-03T12:28:00.000Z',
  raw_payload: {
    Status: 'SUCCESS',
    Amt: 3600,
    PaymentType: 'CREDIT',
    PaymentMethod: 'CREDIT',
  },
})

const paidUpdateWithDefaults = buildPaidPaymentUpdate(
  {
    merchantOrderNo: 'WB202607032025252082',
    rawPayload: { Status: 'SUCCESS' },
  },
  '2026-07-03T12:29:00.000Z',
)

assert.equal(paidUpdateWithDefaults.provider_trade_no, null)
assert.equal(paidUpdateWithDefaults.paid_at, '2026-07-03T12:29:00.000Z')
assert.equal(paidUpdateWithDefaults.notify_received_at, '2026-07-03T12:29:00.000Z')

const row: PaymentRow = {
  id: 'payment-1',
  user_id: 'user-1',
  booking_id: 'booking-1',
  provider: 'newebpay',
  provider_payment_id: null,
  item_type: 'booking',
  item_id: 'booking-1',
  item_name: '水瓶先生論命',
  amount_twd: 3600,
  currency: 'TWD',
  status: 'pending',
  paid_at: null,
  refunded_at: null,
  raw_payload: { source: 'test' },
  merchant_order_no: 'WB202607032025252082',
  provider_trade_no: null,
  notify_received_at: null,
  failure_reason: null,
  created_at: '2026-07-03T12:00:00.000Z',
  updated_at: '2026-07-03T12:00:00.000Z',
}
const record = mapPaymentRow(row)

assert.deepEqual(record, {
  id: 'payment-1',
  userId: 'user-1',
  bookingId: 'booking-1',
  provider: 'newebpay',
  providerPaymentId: null,
  itemType: 'booking',
  itemId: 'booking-1',
  itemName: '水瓶先生論命',
  amountTwd: 3600,
  currency: 'TWD',
  status: 'pending',
  paidAt: null,
  refundedAt: null,
  rawPayload: { source: 'test' },
  merchantOrderNo: 'WB202607032025252082',
  providerTradeNo: null,
  notifyReceivedAt: null,
  failureReason: null,
  createdAt: '2026-07-03T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z',
})

const paidContext = mapPaymentPaidContext({
  ...record,
  status: 'paid',
  providerTradeNo: '26070320270019132',
  paidAt: '2026-07-03T12:27:00.000Z',
})

assert.deepEqual(paidContext, {
  id: 'payment-1',
  bookingId: 'booking-1',
  provider: 'newebpay',
  status: 'paid',
  merchantOrderNo: 'WB202607032025252082',
  providerTradeNo: '26070320270019132',
  paidAt: '2026-07-03T12:27:00.000Z',
})
assert.equal('rawPayload' in paidContext, false)
assert.equal('customerEmail' in paidContext, false)

const pendingRecord: Pick<PaymentRecord, 'status'> = { status: 'pending' }
const paidRecord: Pick<PaymentRecord, 'status'> = { status: 'paid' }

assert.equal(getMarkPaymentPaidDecision(null), 'not_found')
assert.equal(getMarkPaymentPaidDecision(paidRecord), 'already_paid')
assert.equal(getMarkPaymentPaidDecision(pendingRecord), 'should_update')

assert.throws(
  () =>
    buildPendingPaymentInsert({
      provider: 'newebpay',
      itemType: 'booking',
      itemName: '',
      merchantOrderNo: 'WB202607032025252084',
      amountTwd: 3600,
    }),
  /itemName/,
)

assert.throws(
  () =>
    buildPendingPaymentInsert({
      provider: 'newebpay',
      itemType: 'booking',
      itemName: '水瓶先生論命',
      merchantOrderNo: 'WB202607032025252084',
      amountTwd: 0,
    }),
  /amountTwd/,
)
