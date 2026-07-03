export type NewebPayPaymentItemKey = 'booking_consultation_60' | 'newebpay_live_smoke_test_1'

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
}

export function getNewebPayPaymentItem(itemKey: unknown): NewebPayPaymentItem | null {
  if (typeof itemKey !== 'string') return null
  return paymentItems[itemKey as NewebPayPaymentItemKey] ?? null
}
