import { AI_CHART_REPORT_AMOUNT_TWD, AI_CHART_REPORT_ITEM_KEY } from './aiChartPayment'
import { AI_DIVINATION_AMOUNT_TWD, AI_DIVINATION_ITEM_KEY } from './divinationPayment'

export type NewebPayPaymentItemKey =
  | 'booking_consultation_60'
  | 'newebpay_live_smoke_test_1'
  | typeof AI_CHART_REPORT_ITEM_KEY
  | typeof AI_DIVINATION_ITEM_KEY

export type NewebPayPaymentItem = {
  itemKey: NewebPayPaymentItemKey
  itemDesc: string
  amount: number
}

const paymentItems: Record<NewebPayPaymentItemKey, NewebPayPaymentItem> = {
  booking_consultation_60: {
    itemKey: 'booking_consultation_60',
    itemDesc: '水瓶先生論命',
    amount: 3600,
  },
  newebpay_live_smoke_test_1: {
    itemKey: 'newebpay_live_smoke_test_1',
    itemDesc: '藍新正式環境測試付款',
    amount: 1,
  },
  [AI_DIVINATION_ITEM_KEY]: {
    itemKey: AI_DIVINATION_ITEM_KEY,
    itemDesc: '紫微牌卡占卜單次',
    amount: AI_DIVINATION_AMOUNT_TWD,
  },
  [AI_CHART_REPORT_ITEM_KEY]: {
    itemKey: AI_CHART_REPORT_ITEM_KEY,
    itemDesc: 'AI 命盤分析',
    amount: AI_CHART_REPORT_AMOUNT_TWD,
  },
}

export function getNewebPayPaymentItem(itemKey: unknown): NewebPayPaymentItem | null {
  if (typeof itemKey !== 'string') return null
  return paymentItems[itemKey as NewebPayPaymentItemKey] ?? null
}
