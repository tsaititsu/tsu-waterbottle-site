import { createTradeSha, encryptTradeInfo } from './crypto'
import { generateNewebPayMerchantOrderNo } from './orderNo'
import { getNewebPayPaymentItem, type NewebPayPaymentItemKey } from './paymentItems'
import type { NewebPayConfig } from './types'

export type NewebPayPaymentSource = 'booking' | 'ai_divination' | 'ai_chart' | 'manual_test'

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

type CreateNewebPayMpgPaymentDataInput = {
  itemKey: NewebPayPaymentItemKey
  config: NewebPayConfig
  now?: Date
  merchantOrderNo?: string
}

const allowedSources = new Set<NewebPayPaymentSource>(['booking', 'ai_divination', 'ai_chart', 'manual_test'])

export function isNewebPayPaymentSource(source: unknown): source is NewebPayPaymentSource {
  return typeof source === 'string' && allowedSources.has(source as NewebPayPaymentSource)
}

export function createNewebPayMpgPaymentData({
  itemKey,
  config,
  now = new Date(),
  merchantOrderNo = generateNewebPayMerchantOrderNo(now),
}: CreateNewebPayMpgPaymentDataInput): NewebPayMpgPaymentData {
  const item = getNewebPayPaymentItem(itemKey)
  if (!item) {
    throw new Error('Unsupported NewebPay payment item')
  }

  const tradeInfo = encryptTradeInfo(
    {
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
      LINEPAY: 1,
    },
    config.hashKey,
    config.hashIv,
  )

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
