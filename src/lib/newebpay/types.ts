export type NewebPayEnv = 'test' | 'production'

export type NewebPayConfig = {
  merchantId: string
  hashKey: string
  hashIv: string
  env: NewebPayEnv
  version: string
  siteUrl: string
  mpgGatewayUrl: string
  /** @deprecated Use mpgGatewayUrl. Kept for the existing course payment helper. */
  mpgEndpoint: string
}

export type NewebPayMpgForm = {
  MerchantID: string
  TradeInfo: string
  TradeSha: string
  Version: string
  actionUrl: string
}

export type CoursePaymentPayload = {
  merchantOrderNo: string
  amount: number
  itemDesc: string
  email?: string | null
  notifyUrl: string
  returnUrl: string
  clientBackUrl: string
}

export type NewebPayTradeInfoFields = {
  MerchantID: string
  RespondType: 'JSON'
  TimeStamp: string
  Version: string
  MerchantOrderNo: string
  Amt: string
  ItemDesc: string
  Email?: string
  LoginType: '0'
  NotifyURL: string
  ReturnURL: string
  ClientBackURL: string
  CREDIT: '1'
}
