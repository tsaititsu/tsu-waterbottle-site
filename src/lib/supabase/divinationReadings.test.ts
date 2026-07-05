import assert from 'node:assert/strict'
import {
  buildDivinationPaidUpdatePayload,
  buildDivinationPendingPaymentLinkPayload,
  buildPendingDivinationReadingPayload,
  decideDivinationPendingPaymentLink,
  decideDivinationPaidUpdate,
  mapDivinationReadingPaymentContext,
  validateDivinationReadingPayment,
  type DivinationReadingPaidSyncRow,
  type DivinationReadingStatus,
} from './divinationReadings'

const pendingPayload = buildPendingDivinationReadingPayload(
  {
    userId: 'user-1',
    externalReadingId: 'local-reading-1',
    question: '我這週工作要注意什麼？',
    drawMode: 'manual',
    source: 'ai_divination',
    rawPayload: {
      amount: 50,
      source: 'ai_divination',
    },
  },
  '2026-07-05T12:00:00.000Z',
)

assert.deepEqual(pendingPayload, {
  user_id: 'user-1',
  external_reading_id: 'local-reading-1',
  question: '我這週工作要注意什麼？',
  draw_mode: 'manual',
  card_id: null,
  card_name: null,
  position: null,
  status: 'pending_payment',
  source: 'ai_divination',
  raw_payload: {
    amount: 50,
    source: 'ai_divination',
  },
  updated_at: '2026-07-05T12:00:00.000Z',
})

const pendingPayloadWithDraw = buildPendingDivinationReadingPayload(
  {
    question: '感情下一步怎麼做？',
    drawMode: 'auto',
    cardId: 'ziwei',
    cardName: '紫微星',
    position: 'upright',
  },
  '2026-07-05T12:10:00.000Z',
)

assert.equal(pendingPayloadWithDraw.status, 'pending_payment')
assert.equal(pendingPayloadWithDraw.card_id, 'ziwei')
assert.equal(pendingPayloadWithDraw.card_name, '紫微星')
assert.equal(pendingPayloadWithDraw.position, 'upright')
assert.equal(pendingPayloadWithDraw.user_id, null)
assert.equal(pendingPayloadWithDraw.external_reading_id, null)
assert.equal(pendingPayloadWithDraw.source, 'waterbottle-ai-divination')

const pendingPayloadForDbCreate = buildPendingDivinationReadingPayload(
  {
    externalReadingId: 'local-reading-2',
    question: '我今天適合怎麼面對工作？',
    drawMode: 'manual',
    rawPayload: {
      source: 'ai_divination',
      flow: 'readings_create',
      localReadingId: 'local-reading-2',
      amount: 50,
      TradeInfo: 'unsafe-trade-info',
      TradeSha: 'unsafe-trade-sha',
      HashKey: 'unsafe-hash-key',
      HashIV: 'unsafe-hash-iv',
      interpretation: 'unsafe-interpretation',
    },
  },
  '2026-07-05T12:20:00.000Z',
)

assert.equal(pendingPayloadForDbCreate.question, '我今天適合怎麼面對工作？')
assert.equal(pendingPayloadForDbCreate.status, 'pending_payment')
assert.equal(pendingPayloadForDbCreate.source, 'waterbottle-ai-divination')
assert.deepEqual(pendingPayloadForDbCreate.raw_payload, {
  source: 'ai_divination',
  flow: 'readings_create',
  localReadingId: 'local-reading-2',
  amount: 50,
})
assert.equal(pendingPayloadForDbCreate.card_id, null)
assert.equal(pendingPayloadForDbCreate.card_name, null)
assert.equal(pendingPayloadForDbCreate.position, null)
assert.equal('TradeInfo' in pendingPayloadForDbCreate.raw_payload, false)
assert.equal('TradeSha' in pendingPayloadForDbCreate.raw_payload, false)
assert.equal('HashKey' in pendingPayloadForDbCreate.raw_payload, false)
assert.equal('HashIV' in pendingPayloadForDbCreate.raw_payload, false)
assert.equal('interpretation' in pendingPayloadForDbCreate.raw_payload, false)

const paidPayload = buildDivinationPaidUpdatePayload(
  {
    paymentId: 'payment-1',
    merchantOrderNo: 'WB20260705121212ABCD',
    paidAt: '2026-07-05T12:12:12.000Z',
  },
  '2026-07-05T12:13:00.000Z',
)

assert.deepEqual(paidPayload, {
  payment_id: 'payment-1',
  merchant_order_no: 'WB20260705121212ABCD',
  status: 'paid',
  paid_at: '2026-07-05T12:12:12.000Z',
  updated_at: '2026-07-05T12:13:00.000Z',
})

const pendingPaymentLinkPayload = buildDivinationPendingPaymentLinkPayload(
  {
    paymentId: 'payment-link-1',
    merchantOrderNo: 'WB20260705130000LINK',
  },
  '2026-07-05T13:00:00.000Z',
)

assert.deepEqual(pendingPaymentLinkPayload, {
  payment_id: 'payment-link-1',
  merchant_order_no: 'WB20260705130000LINK',
  updated_at: '2026-07-05T13:00:00.000Z',
})
assert.equal('status' in pendingPaymentLinkPayload, false)
assert.equal('question' in pendingPaymentLinkPayload, false)
assert.equal('interpretation' in pendingPaymentLinkPayload, false)
assert.equal('paid_at' in pendingPaymentLinkPayload, false)
assert.equal('interpreted_at' in pendingPaymentLinkPayload, false)
assert.equal('TradeInfo' in pendingPaymentLinkPayload, false)
assert.equal('TradeSha' in pendingPaymentLinkPayload, false)
assert.equal('HashKey' in pendingPaymentLinkPayload, false)
assert.equal('HashIV' in pendingPaymentLinkPayload, false)
assert.equal('booking_id' in pendingPaymentLinkPayload, false)
assert.equal('course_id' in pendingPaymentLinkPayload, false)
assert.equal('product_id' in pendingPaymentLinkPayload, false)

const paidPayloadWithDefaultDate = buildDivinationPaidUpdatePayload(
  {
    paymentId: 'payment-2',
    merchantOrderNo: 'WB20260705121300DCBA',
    paidAt: null,
  },
  '2026-07-05T12:13:00.000Z',
)

assert.equal(paidPayloadWithDefaultDate.paid_at, '2026-07-05T12:13:00.000Z')

const pendingReading: DivinationReadingPaidSyncRow = {
  id: 'reading-1',
  status: 'pending_payment',
  payment_id: null,
}

const nullStatusReading: DivinationReadingPaidSyncRow = {
  id: 'reading-2',
  status: null,
}

const paidReading: DivinationReadingPaidSyncRow = {
  id: 'reading-3',
  status: 'paid',
  payment_id: 'payment-1',
}

const interpretingReading: DivinationReadingPaidSyncRow = {
  id: 'reading-4',
  status: 'interpreting',
}

const completedReading: DivinationReadingPaidSyncRow = {
  id: 'reading-5',
  status: 'completed',
}

const failedReading: DivinationReadingPaidSyncRow = {
  id: 'reading-6',
  status: 'failed',
}

const canceledReading: DivinationReadingPaidSyncRow = {
  id: 'reading-7',
  status: 'canceled',
}

assert.deepEqual(decideDivinationPaidUpdate(null), { result: 'not_found' })
assert.deepEqual(decideDivinationPaidUpdate(pendingReading), { result: 'should_update' })
assert.deepEqual(decideDivinationPaidUpdate(nullStatusReading), { result: 'should_update' })
assert.deepEqual(decideDivinationPaidUpdate(paidReading), { result: 'already_paid' })
assert.deepEqual(decideDivinationPaidUpdate(interpretingReading), { result: 'already_paid' })
assert.deepEqual(decideDivinationPaidUpdate(completedReading), { result: 'already_paid' })
assert.deepEqual(decideDivinationPaidUpdate(failedReading), { result: 'already_paid' })
assert.deepEqual(decideDivinationPaidUpdate(canceledReading), {
  result: 'invalid_state',
  status: 'canceled',
})

assert.deepEqual(decideDivinationPendingPaymentLink(null), { result: 'not_found' })
assert.deepEqual(
  decideDivinationPendingPaymentLink({
    id: 'reading-link-1',
    status: 'pending_payment',
    payment_id: null,
    merchant_order_no: null,
  }),
  { result: 'should_link' },
)
assert.deepEqual(
  decideDivinationPendingPaymentLink({
    id: 'reading-link-2',
    status: null,
    payment_id: null,
    merchant_order_no: null,
  }),
  { result: 'should_link' },
)
assert.deepEqual(
  decideDivinationPendingPaymentLink({
    id: 'reading-link-3',
    status: 'pending_payment',
    payment_id: 'payment-link-3',
    merchant_order_no: null,
  }),
  { result: 'already_linked' },
)
assert.deepEqual(
  decideDivinationPendingPaymentLink({
    id: 'reading-link-4',
    status: 'pending_payment',
    payment_id: null,
    merchant_order_no: 'WB20260705130400LINK',
  }),
  { result: 'already_linked' },
)

const notPayableLinkStatuses: DivinationReadingStatus[] = [
  'paid',
  'interpreting',
  'completed',
  'failed',
  'canceled',
]

for (const status of notPayableLinkStatuses) {
  assert.deepEqual(
    decideDivinationPendingPaymentLink({
      id: `reading-link-${status}`,
      status,
      payment_id: null,
      merchant_order_no: null,
    }),
    {
      result: 'not_payable',
      status,
    },
  )
}

const paymentContext = mapDivinationReadingPaymentContext({
  id: '2df1a8da-3893-4b81-8d00-774a9cc0e472',
  status: 'pending_payment',
  payment_id: null,
  merchant_order_no: null,
})

assert.deepEqual(paymentContext, {
  id: '2df1a8da-3893-4b81-8d00-774a9cc0e472',
  status: 'pending_payment',
  paymentId: null,
  merchantOrderNo: null,
})
assert.deepEqual(validateDivinationReadingPayment(null), {
  ok: false,
  error: 'divination_reading_not_found',
})
assert.deepEqual(validateDivinationReadingPayment(paymentContext), { ok: true })
assert.deepEqual(
  validateDivinationReadingPayment({
    ...paymentContext,
    status: null,
  }),
  { ok: true },
)
assert.deepEqual(
  validateDivinationReadingPayment({
    ...paymentContext,
    status: 'paid',
  }),
  { ok: false, error: 'divination_reading_not_payable' },
)
assert.deepEqual(
  validateDivinationReadingPayment({
    ...paymentContext,
    status: 'completed',
  }),
  { ok: false, error: 'divination_reading_not_payable' },
)
assert.deepEqual(
  validateDivinationReadingPayment({
    ...paymentContext,
    paymentId: '4db88892-e602-40e3-9bcd-4595a0dcfb95',
  }),
  { ok: false, error: 'divination_reading_not_payable' },
)
assert.deepEqual(
  validateDivinationReadingPayment({
    ...paymentContext,
    merchantOrderNo: 'WB20260705143000ABCD',
  }),
  { ok: false, error: 'divination_reading_not_payable' },
)

assert.equal('TradeInfo' in pendingPayload, false)
assert.equal('TradeSha' in pendingPayload, false)
assert.equal('HashKey' in pendingPayload, false)
assert.equal('HashIV' in pendingPayload, false)
assert.equal('card_number' in pendingPayload, false)
assert.equal('booking_id' in pendingPayload, false)
assert.equal('course_id' in pendingPayload, false)
assert.equal('product_id' in pendingPayload, false)
assert.equal('booking_status' in paidPayload, false)
assert.equal('course_purchase_id' in paidPayload, false)
assert.equal('spiritual_product' in paidPayload, false)
assert.equal('booking_status' in pendingPaymentLinkPayload, false)
assert.equal('course_purchase_id' in pendingPaymentLinkPayload, false)
assert.equal('spiritual_product' in pendingPaymentLinkPayload, false)

assert.throws(
  () =>
    buildPendingDivinationReadingPayload({
      question: '',
    }),
  /question/,
)

assert.throws(
  () =>
    buildDivinationPaidUpdatePayload({
      paymentId: '',
      merchantOrderNo: 'WB20260705121212ABCD',
    }),
  /paymentId/,
)

assert.throws(
  () =>
    buildDivinationPaidUpdatePayload({
      paymentId: 'payment-1',
      merchantOrderNo: '',
    }),
  /merchantOrderNo/,
)

assert.throws(
  () =>
    buildDivinationPendingPaymentLinkPayload({
      paymentId: '',
      merchantOrderNo: 'WB20260705121212ABCD',
    }),
  /paymentId/,
)

assert.throws(
  () =>
    buildDivinationPendingPaymentLinkPayload({
      paymentId: 'payment-1',
      merchantOrderNo: '',
    }),
  /merchantOrderNo/,
)
