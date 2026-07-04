import assert from 'node:assert/strict'
import {
  buildCoursePaidInsertPayload,
  buildCoursePaidUpdatePayload,
  getMarkCoursePaidDecision,
  type CoursePurchaseSyncRow,
  type MarkCoursePaidInput,
} from './coursePurchases'

const pendingPurchase: CoursePurchaseSyncRow = {
  id: 'purchase-1',
  status: 'pending',
}

const failedPurchase: CoursePurchaseSyncRow = {
  id: 'purchase-2',
  status: 'failed',
}

const alreadyPaidPurchase: CoursePurchaseSyncRow = {
  id: 'purchase-3',
  status: 'paid',
}

const paidInput: MarkCoursePaidInput = {
  paymentId: 'payment-1',
  userId: 'user-1',
  courseId: 'basic',
  paidAt: '2026-07-05T12:00:00.000Z',
}

const insertPayload = buildCoursePaidInsertPayload(paidInput, '2026-07-05T13:00:00.000Z')

assert.deepEqual(insertPayload, {
  user_id: 'user-1',
  course_id: 'basic',
  payment_id: 'payment-1',
  status: 'paid',
  purchased_at: '2026-07-05T12:00:00.000Z',
})

const insertPayloadWithDefaultDate = buildCoursePaidInsertPayload(
  {
    paymentId: 'payment-2',
    userId: 'user-1',
    courseId: 'advanced',
    paidAt: null,
  },
  '2026-07-05T13:00:00.000Z',
)

assert.equal(insertPayloadWithDefaultDate.purchased_at, '2026-07-05T13:00:00.000Z')

const updatePayload = buildCoursePaidUpdatePayload(paidInput, '2026-07-05T13:00:00.000Z')

assert.deepEqual(updatePayload, {
  payment_id: 'payment-1',
  status: 'paid',
  purchased_at: '2026-07-05T12:00:00.000Z',
})

assert.equal(getMarkCoursePaidDecision(null), 'insert')
assert.equal(getMarkCoursePaidDecision(pendingPurchase), 'update')
assert.equal(getMarkCoursePaidDecision(failedPurchase), 'update')
assert.equal(getMarkCoursePaidDecision(alreadyPaidPurchase), 'already_paid')

assert.equal('booking_id' in insertPayload, false)
assert.equal('booking_status' in updatePayload, false)
assert.equal('spiritual_product' in insertPayload, false)
assert.equal('divination_reading_id' in insertPayload, false)
assert.equal('ai_chart_report_id' in insertPayload, false)

assert.throws(
  () =>
    buildCoursePaidInsertPayload({
      paymentId: '',
      userId: 'user-1',
      courseId: 'basic',
    }),
  /paymentId/,
)

assert.throws(
  () =>
    buildCoursePaidUpdatePayload({
      paymentId: 'payment-1',
      userId: '',
      courseId: 'basic',
    }),
  /userId/,
)
