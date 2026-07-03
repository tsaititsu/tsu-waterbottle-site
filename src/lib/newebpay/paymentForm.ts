import { createTradeSha, encryptTradeInfo } from './crypto'
import { generateNewebPayMerchantOrderNo } from './orderNo'
import { getNewebPayPaymentItem, type NewebPayPaymentItemKey } from './paymentItems'
import type { NewebPayConfig } from './types'

export type NewebPayPaymentSource = 'booking' | 'ai_divination' | 'ai_chart' | 'manual_test'
export type NewebPayPaymentMode = 'credit' | 'merchant_default'

export type NewebPayMpgPaymentFields = {
  MerchantID: string
  TradeInfo: string
  TradeSha: string
  Version: string
}

export type NewebPayMpgPaymentData = {
  action: string
  method: 'POST'
  merchantOrderNo: string
  itemKey: NewebPayPaymentItemKey
  amount: number
  fields: NewebPayMpgPaymentFields
}

export type NewebPayPendingPaymentMetadata = {
  itemType: string
  itemId: string
  rawPayload: {
    itemKey: NewebPayPaymentItemKey
    source: NewebPayPaymentSource | null
    paymentMode: NewebPayPaymentMode
    amount: number
    itemDesc: string
    merchantOrderNo: string
  }
}

type CreateNewebPayMpgPaymentDataInput = {
  itemKey: NewebPayPaymentItemKey
  config: NewebPayConfig
  paymentMode?: NewebPayPaymentMode
  now?: Date
  merchantOrderNo?: string
}

type BuildNewebPayPendingPaymentMetadataInput = {
  itemKey: NewebPayPaymentItemKey
  source?: NewebPayPaymentSource
  paymentMode: NewebPayPaymentMode
  merchantOrderNo: string
}

const allowedSources = new Set<NewebPayPaymentSource>(['booking', 'ai_divination', 'ai_chart', 'manual_test'])
const allowedPaymentModes = new Set<NewebPayPaymentMode>(['credit', 'merchant_default'])

export function isNewebPayPaymentSource(source: unknown): source is NewebPayPaymentSource {
  return typeof source === 'string' && allowedSources.has(source as NewebPayPaymentSource)
}

export function isNewebPayPaymentMode(mode: unknown): mode is NewebPayPaymentMode {
  return typeof mode === 'string' && allowedPaymentModes.has(mode as NewebPayPaymentMode)
}

function getPendingPaymentTarget(itemKey: NewebPayPaymentItemKey) {
  if (itemKey === 'newebpay_live_smoke_test_1') {
    return {
      itemType: 'newebpay_smoke_test',
      itemId: itemKey,
    }
  }

  return {
    itemType: 'booking',
    itemId: itemKey,
  }
}

export function buildNewebPayPendingPaymentMetadata({
  itemKey,
  source,
  paymentMode,
  merchantOrderNo,
}: BuildNewebPayPendingPaymentMetadataInput): NewebPayPendingPaymentMetadata {
  const item = getNewebPayPaymentItem(itemKey)
  if (!item) {
    throw new Error('Unsupported NewebPay payment item')
  }

  return {
    ...getPendingPaymentTarget(item.itemKey),
    rawPayload: {
      itemKey: item.itemKey,
      source: source ?? null,
      paymentMode,
      amount: item.amount,
      itemDesc: item.itemDesc,
      merchantOrderNo,
    },
  }
}

export function createNewebPayMpgPaymentData({
  itemKey,
  config,
  paymentMode = 'credit',
  now = new Date(),
  merchantOrderNo = generateNewebPayMerchantOrderNo(now),
}: CreateNewebPayMpgPaymentDataInput): NewebPayMpgPaymentData {
  const item = getNewebPayPaymentItem(itemKey)
  if (!item) {
    throw new Error('Unsupported NewebPay payment item')
  }

  const tradeInfoParams: Record<string, string | number> = {
    MerchantID: config.merchantId,
    RespondType: 'JSON',
    TimeStamp: Math.floor(now.getTime() / 1000),
    Version: config.version,
    MerchantOrderNo: merchantOrderNo,
    Amt: item.amount,
    ItemDesc: item.itemDesc,
    ReturnURL: `${config.siteUrl}/payment/newebpay/return`,
    NotifyURL: `${config.siteUrl}/api/payments/newebpay/notify`,
    ClientBackURL: `${config.siteUrl}/booking`,
    LangType: 'zh-tw',
  }

  if (paymentMode === 'credit') {
    tradeInfoParams.CREDIT = 1
  }

  const tradeInfo = encryptTradeInfo(tradeInfoParams, config.hashKey, config.hashIv)

  return {
    action: config.mpgGatewayUrl,
    method: 'POST',
    merchantOrderNo,
    itemKey: item.itemKey,
    amount: item.amount,
    fields: {
      MerchantID: config.merchantId,
      TradeInfo: tradeInfo,
      TradeSha: createTradeSha(tradeInfo, config.hashKey, config.hashIv),
      Version: config.version,
    },
  }
}
