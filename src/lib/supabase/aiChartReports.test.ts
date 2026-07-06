import assert from 'node:assert/strict'
import {
  buildAiChartReportPaidUpdatePayload,
  buildAiChartReportPendingPaymentLinkPayload,
  buildPendingAiChartReportPayload,
  decideAiChartReportPaidUpdate,
  decideAiChartReportPendingPaymentLink,
  type AiChartReportPaymentStatus,
} from './aiChartReports'

function assertNoUnsafePaymentKeys(payload: Record<string, unknown>) {
  assert.equal('TradeInfo' in payload, false)
  assert.equal('TradeSha' in payload, false)
  assert.equal('HashKey' in payload, false)
  assert.equal('HashIV' in payload, false)
  assert.equal('creditCard' in payload, false)
  assert.equal('cardNumber' in payload, false)
  assert.equal('birthData' in payload, false)
  assert.equal('raw_payload' in payload, false)
  assert.equal('payment_form' in payload, false)
}

function assertNoOtherProductKeys(payload: Record<string, unknown>) {
  assert.equal('booking_id' in payload, false)
  assert.equal('course_id' in payload, false)
  assert.equal('divination_reading_id' in payload, false)
  assert.equal('spiritual_product_id' in payload, false)
  assert.equal('product_id' in payload, false)
}

const pendingReportPayload = buildPendingAiChartReportPayload(
  {
    userId: 'user-1',
    chartProfileId: 'chart-profile-1',
    title: '紫微命盤完整分析',
    productName: 'AI 命盤分析',
    amountTwd: 100,
    reportContent: null,
  },
  '2026-07-06T10:00:00.000Z',
)

assert.deepEqual(pendingReportPayload, {
  user_id: 'user-1',
  chart_profile_id: 'chart-profile-1',
  title: '紫微命盤完整分析',
  product_name: 'AI 命盤分析',
  amount_twd: 100,
  status: 'pending',
  payment_status: 'pending',
  report_content: null,
  updated_at: '2026-07-06T10:00:00.000Z',
})
assertNoUnsafePaymentKeys(pendingReportPayload)
assertNoOtherProductKeys(pendingReportPayload)

const pendingReportPayloadWithTrimmedText = buildPendingAiChartReportPayload(
  {
    userId: '  ',
    chartProfileId: null,
    title: '  AI 命盤分析  ',
    productName: '  紫微命盤完整分析  ',
    amountTwd: 100,
    reportContent: '  付款前安全摘要  ',
  },
  '2026-07-06T10:05:00.000Z',
)

assert.equal(pendingReportPayloadWithTrimmedText.user_id, null)
assert.equal(pendingReportPayloadWithTrimmedText.chart_profile_id, null)
assert.equal(pendingReportPayloadWithTrimmedText.title, 'AI 命盤分析')
assert.equal(pendingReportPayloadWithTrimmedText.product_name, '紫微命盤完整分析')
assert.equal(pendingReportPayloadWithTrimmedText.report_content, '付款前安全摘要')

const pendingPaymentLinkPayload = buildAiChartReportPendingPaymentLinkPayload(
  {
    paymentId: 'payment-1',
    merchantOrderNo: 'WB20260706101010AICH',
  },
  '2026-07-06T10:10:00.000Z',
)

assert.deepEqual(pendingPaymentLinkPayload, {
  payment_id: 'payment-1',
  merchant_order_no: 'WB20260706101010AICH',
  updated_at: '2026-07-06T10:10:00.000Z',
})
assert.equal('payment_status' in pendingPaymentLinkPayload, false)
assert.equal('paid_at' in pendingPaymentLinkPayload, false)
assert.equal('completed_at' in pendingPaymentLinkPayload, false)
assert.equal('report_content' in pendingPaymentLinkPayload, false)
assertNoUnsafePaymentKeys(pendingPaymentLinkPayload)
assertNoOtherProductKeys(pendingPaymentLinkPayload)

const paidUpdatePayload = buildAiChartReportPaidUpdatePayload(
  {
    paymentId: 'payment-2',
    merchantOrderNo: 'WB20260706102020AICH',
    paidAt: '2026-07-06T10:20:00.000Z',
  },
  '2026-07-06T10:21:00.000Z',
)

assert.deepEqual(paidUpdatePayload, {
  payment_id: 'payment-2',
  merchant_order_no: 'WB20260706102020AICH',
  payment_status: 'paid',
  paid_at: '2026-07-06T10:20:00.000Z',
  updated_at: '2026-07-06T10:21:00.000Z',
  error_message: null,
})
assert.equal('report_content' in paidUpdatePayload, false)
assert.equal('completed_at' in paidUpdatePayload, false)
assertNoUnsafePaymentKeys(paidUpdatePayload)
assertNoOtherProductKeys(paidUpdatePayload)

const paidUpdatePayloadWithDefaultDate = buildAiChartReportPaidUpdatePayload(
  {
    paymentId: 'payment-3',
    merchantOrderNo: 'WB20260706102220AICH',
    paidAt: null,
  },
  '2026-07-06T10:22:00.000Z',
)

assert.equal(paidUpdatePayloadWithDefaultDate.paid_at, '2026-07-06T10:22:00.000Z')

assert.deepEqual(decideAiChartReportPendingPaymentLink(null), { result: 'not_found' })
assert.deepEqual(
  decideAiChartReportPendingPaymentLink({
    id: 'report-1',
    payment_status: 'pending',
    payment_id: null,
    merchant_order_no: null,
  }),
  { result: 'should_link' },
)
assert.deepEqual(
  decideAiChartReportPendingPaymentLink({
    id: 'report-2',
    payment_status: null,
    payment_id: null,
    merchant_order_no: null,
  }),
  { result: 'should_link' },
)
assert.deepEqual(
  decideAiChartReportPendingPaymentLink({
    id: 'report-3',
    payment_status: 'pending',
    payment_id: 'payment-1',
    merchant_order_no: null,
  }),
  { result: 'already_linked' },
)
assert.deepEqual(
  decideAiChartReportPendingPaymentLink({
    id: 'report-4',
    payment_status: 'pending',
    payment_id: null,
    merchant_order_no: 'WB20260706103000AICH',
  }),
  { result: 'already_linked' },
)

for (const paymentStatus of ['paid', 'failed', 'canceled', 'refunded'] satisfies AiChartReportPaymentStatus[]) {
  assert.deepEqual(
    decideAiChartReportPendingPaymentLink({
      id: `report-${paymentStatus}`,
      payment_status: paymentStatus,
      payment_id: null,
      merchant_order_no: null,
    }),
    {
      result: 'not_payable',
      paymentStatus,
    },
  )
}

assert.deepEqual(decideAiChartReportPaidUpdate(null), { result: 'not_found' })
assert.deepEqual(
  decideAiChartReportPaidUpdate({
    id: 'report-paid-1',
    payment_status: 'pending',
  }),
  { result: 'should_update' },
)
assert.deepEqual(
  decideAiChartReportPaidUpdate({
    id: 'report-paid-2',
    payment_status: null,
  }),
  { result: 'should_update' },
)
assert.deepEqual(
  decideAiChartReportPaidUpdate({
    id: 'report-paid-3',
    payment_status: 'paid',
  }),
  { result: 'already_paid' },
)

for (const paymentStatus of ['failed', 'canceled', 'refunded'] satisfies AiChartReportPaymentStatus[]) {
  assert.deepEqual(
    decideAiChartReportPaidUpdate({
      id: `report-paid-${paymentStatus}`,
      payment_status: paymentStatus,
    }),
    {
      result: 'invalid_state',
      paymentStatus,
    },
  )
}

assert.throws(
  () =>
    buildPendingAiChartReportPayload({
      title: '',
      productName: 'AI 命盤分析',
      amountTwd: 100,
    }),
  /title/,
)
assert.throws(
  () =>
    buildPendingAiChartReportPayload({
      title: '紫微命盤完整分析',
      productName: 'AI 命盤分析',
      amountTwd: 0,
    }),
  /amountTwd/,
)
assert.throws(
  () =>
    buildAiChartReportPendingPaymentLinkPayload({
      paymentId: '',
      merchantOrderNo: 'WB20260706104000AICH',
    }),
  /paymentId/,
)
assert.throws(
  () =>
    buildAiChartReportPaidUpdatePayload({
      paymentId: 'payment-4',
      merchantOrderNo: '',
    }),
  /merchantOrderNo/,
)
