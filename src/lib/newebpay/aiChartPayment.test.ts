import assert from 'node:assert/strict'
import {
  AI_CHART_REPORT_AMOUNT_TWD,
  AI_CHART_REPORT_ITEM_KEY,
  AI_CHART_REPORT_ITEM_TYPE,
  buildAiChartReportPaymentPayload,
} from './aiChartPayment'

const reportId = '2df1a8da-3893-4b81-8d00-774a9cc0e472'
const merchantOrderNo = 'WB20260706153000AICH'
const creditPayload = buildAiChartReportPaymentPayload({
  reportId,
  merchantOrderNo,
})

assert.equal(AI_CHART_REPORT_ITEM_KEY, 'ai_chart_report_single')
assert.equal(AI_CHART_REPORT_AMOUNT_TWD, 600)
assert.equal(AI_CHART_REPORT_ITEM_TYPE, 'ai_chart_report')

assert.deepEqual(creditPayload, {
  itemKey: 'ai_chart_report_single',
  itemType: 'ai_chart_report',
  itemId: reportId,
  amount: 600,
  source: 'ai_chart_report',
  paymentMode: 'credit',
  merchantOrderNo,
  rawPayload: {
    itemKey: 'ai_chart_report_single',
    itemType: 'ai_chart_report',
    reportId,
    amount: 600,
    source: 'ai_chart_report',
    paymentMode: 'credit',
    merchantOrderNo,
  },
})

assert.equal(creditPayload.rawPayload.amount, 600)
assert.equal(creditPayload.rawPayload.reportId, reportId)
assert.equal(creditPayload.paymentMode, 'credit')

const merchantDefaultPayload = buildAiChartReportPaymentPayload({
  reportId,
  merchantOrderNo,
  paymentMode: 'merchant_default',
})

assert.equal(merchantDefaultPayload.paymentMode, 'merchant_default')
assert.equal(merchantDefaultPayload.rawPayload.paymentMode, 'merchant_default')

assert.throws(
  () =>
    buildAiChartReportPaymentPayload({
      reportId: 'not-a-uuid',
      merchantOrderNo,
    }),
  /invalid_ai_chart_report_id/,
)

assert.throws(
  () =>
    buildAiChartReportPaymentPayload({
      reportId: '',
      merchantOrderNo,
    }),
  /reportId/,
)

assert.throws(
  () =>
    buildAiChartReportPaymentPayload({
      reportId,
      merchantOrderNo: '',
    }),
  /merchantOrderNo/,
)

assert.equal('TradeInfo' in creditPayload.rawPayload, false)
assert.equal('TradeSha' in creditPayload.rawPayload, false)
assert.equal('HashKey' in creditPayload.rawPayload, false)
assert.equal('HashIV' in creditPayload.rawPayload, false)
assert.equal('card_number' in creditPayload.rawPayload, false)
assert.equal('creditCard' in creditPayload.rawPayload, false)
assert.equal('birthData' in creditPayload.rawPayload, false)
assert.equal('ziweiPayload' in creditPayload.rawPayload, false)
assert.equal('chartPayload' in creditPayload.rawPayload, false)
assert.equal('reportContent' in creditPayload.rawPayload, false)
assert.equal('paymentForm' in creditPayload.rawPayload, false)
assert.equal('bookingId' in creditPayload.rawPayload, false)
assert.equal('courseId' in creditPayload.rawPayload, false)
assert.equal('readingId' in creditPayload.rawPayload, false)
assert.equal('productId' in creditPayload.rawPayload, false)
