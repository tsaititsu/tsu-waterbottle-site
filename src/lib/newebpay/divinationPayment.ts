import { DIVINATION_READING_PRICE_TWD } from '../divination/pricing'

export const AI_DIVINATION_ITEM_KEY = 'ai_divination_single'
export const AI_DIVINATION_AMOUNT_TWD = DIVINATION_READING_PRICE_TWD
export const AI_DIVINATION_ITEM_TYPE = 'ai_divination'

export type DivinationPaymentMode = 'credit' | 'merchant_default'

export type DivinationPaymentRawPayload = {
  itemKey: typeof AI_DIVINATION_ITEM_KEY
  itemType: typeof AI_DIVINATION_ITEM_TYPE
  readingId: string
  amount: typeof AI_DIVINATION_AMOUNT_TWD
  source: typeof AI_DIVINATION_ITEM_TYPE
  paymentMode: DivinationPaymentMode
  merchantOrderNo: string
}

export type DivinationPaymentPayload = {
  itemKey: typeof AI_DIVINATION_ITEM_KEY
  itemType: typeof AI_DIVINATION_ITEM_TYPE
  itemId: string
  amount: typeof AI_DIVINATION_AMOUNT_TWD
  source: typeof AI_DIVINATION_ITEM_TYPE
  paymentMode: DivinationPaymentMode
  merchantOrderNo: string
  rawPayload: DivinationPaymentRawPayload
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

export function buildDivinationPaymentPayload(input: {
  readingId: string
  merchantOrderNo: string
  paymentMode?: DivinationPaymentMode
}): DivinationPaymentPayload {
  assertRequiredText(input.readingId, 'readingId')
  assertRequiredText(input.merchantOrderNo, 'merchantOrderNo')

  const readingId = input.readingId.trim()
  const merchantOrderNo = input.merchantOrderNo.trim()
  const paymentMode = input.paymentMode ?? 'credit'

  if (!isUuid(readingId)) {
    throw new Error('invalid_divination_reading_id')
  }

  return {
    itemKey: AI_DIVINATION_ITEM_KEY,
    itemType: AI_DIVINATION_ITEM_TYPE,
    itemId: readingId,
    amount: AI_DIVINATION_AMOUNT_TWD,
    source: AI_DIVINATION_ITEM_TYPE,
    paymentMode,
    merchantOrderNo,
    rawPayload: {
      itemKey: AI_DIVINATION_ITEM_KEY,
      itemType: AI_DIVINATION_ITEM_TYPE,
      readingId,
      amount: AI_DIVINATION_AMOUNT_TWD,
      source: AI_DIVINATION_ITEM_TYPE,
      paymentMode,
      merchantOrderNo,
    },
  }
}
