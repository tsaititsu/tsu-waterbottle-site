import { AI_CHART_REPORT_PRICE_TWD } from '@/lib/ai-chart/pricing'

export const AI_CHART_REPORT_ITEM_KEY = 'ai_chart_report_single'
export const AI_CHART_REPORT_AMOUNT_TWD = AI_CHART_REPORT_PRICE_TWD
export const AI_CHART_REPORT_ITEM_TYPE = 'ai_chart_report'

export type AiChartReportPaymentMode =
  | 'credit'
  | 'apple_pay'
  | 'atm'
  | 'merchant_default'

export type AiChartReportPaymentRawPayload = {
  itemKey: typeof AI_CHART_REPORT_ITEM_KEY
  itemType: typeof AI_CHART_REPORT_ITEM_TYPE
  reportId: string
  amount: typeof AI_CHART_REPORT_AMOUNT_TWD
  source: typeof AI_CHART_REPORT_ITEM_TYPE
  paymentMode: AiChartReportPaymentMode
  merchantOrderNo: string
}

export type AiChartReportPaymentPayload = {
  itemKey: typeof AI_CHART_REPORT_ITEM_KEY
  itemType: typeof AI_CHART_REPORT_ITEM_TYPE
  itemId: string
  amount: typeof AI_CHART_REPORT_AMOUNT_TWD
  source: typeof AI_CHART_REPORT_ITEM_TYPE
  paymentMode: AiChartReportPaymentMode
  merchantOrderNo: string
  rawPayload: AiChartReportPaymentRawPayload
}

function assertRequiredText(value: string, fieldName: string) {
  if (!value.trim()) {
    throw new Error(`${fieldName} 不可空白`)
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  )
}

export function buildAiChartReportPaymentPayload(input: {
  reportId: string
  merchantOrderNo: string
  paymentMode?: AiChartReportPaymentMode
}): AiChartReportPaymentPayload {
  assertRequiredText(input.reportId, 'reportId')
  assertRequiredText(input.merchantOrderNo, 'merchantOrderNo')

  const reportId = input.reportId.trim()
  const merchantOrderNo = input.merchantOrderNo.trim()
  const paymentMode = input.paymentMode ?? 'credit'

  if (!isUuid(reportId)) {
    throw new Error('invalid_ai_chart_report_id')
  }

  return {
    itemKey: AI_CHART_REPORT_ITEM_KEY,
    itemType: AI_CHART_REPORT_ITEM_TYPE,
    itemId: reportId,
    amount: AI_CHART_REPORT_AMOUNT_TWD,
    source: AI_CHART_REPORT_ITEM_TYPE,
    paymentMode,
    merchantOrderNo,
    rawPayload: {
      itemKey: AI_CHART_REPORT_ITEM_KEY,
      itemType: AI_CHART_REPORT_ITEM_TYPE,
      reportId,
      amount: AI_CHART_REPORT_AMOUNT_TWD,
      source: AI_CHART_REPORT_ITEM_TYPE,
      paymentMode,
      merchantOrderNo,
    },
  }
}
