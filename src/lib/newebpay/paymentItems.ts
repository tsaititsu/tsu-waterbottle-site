export type NewebPayPaymentItemKey = 'booking_consultation_60'

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
}

export function getNewebPayPaymentItem(itemKey: unknown): NewebPayPaymentItem | null {
  if (typeof itemKey !== 'string') return null
  return paymentItems[itemKey as NewebPayPaymentItemKey] ?? null
}
