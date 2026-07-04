import { createTradeSha, encryptTradeInfo } from './crypto'
import { generateNewebPayMerchantOrderNo } from './orderNo'
import { getNewebPayPaymentItem, type NewebPayPaymentItemKey } from './paymentItems'
import type { NewebPayConfig } from './types'

export type NewebPayPaymentSource = 'booking' | 'ai_divination' | 'ai_chart' | 'manual_test'
export type NewebPayPaymentMode = 'credit' | 'merchant_default'

export type NewebPayBookingPaymentContext = {
  id: string
  amountTwd: number
  status: string
  paymentStatus: string
  planId?: string | null
}

export type NewebPayBookingIdResolution =
  | { ok: true; bookingId: string | null }
  | { ok: false; error: 'booking_id_required' | 'invalid_booking_id' | 'booking_id_not_allowed' }

export type NewebPayBookingPaymentValidationResult =
  | { ok: true }
  | { ok: false; error: 'booking_not_found' | 'booking_amount_mismatch' | 'booking_already_paid' }

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
  bookingId: string | null
  rawPayload: {
    itemKey: NewebPayPaymentItemKey
    source: NewebPayPaymentSource | null
    paymentMode: NewebPayPaymentMode
    amount: number
    itemDesc: string
    merchantOrderNo: string
    bookingId?: string
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
  bookingId?: string | null
}

const allowedSources = new Set<NewebPayPaymentSource>(['booking', 'ai_divination', 'ai_chart', 'manual_test'])
const allowedPaymentModes = new Set<NewebPayPaymentMode>(['credit', 'merchant_default'])

export function isNewebPayPaymentSource(source: unknown): source is NewebPayPaymentSource {
  return typeof source === 'string' && allowedSources.has(source as NewebPayPaymentSource)
}

export function isNewebPayPaymentMode(mode: unknown): mode is NewebPayPaymentMode {
  return typeof mode === 'string' && allowedPaymentModes.has(mode as NewebPayPaymentMode)
}

export function isValidNewebPayBookingId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim())
  )
}

export function resolveNewebPayBookingIdForPayment(input: {
  itemKey: NewebPayPaymentItemKey
  source?: NewebPayPaymentSource
  bookingId?: unknown
}): NewebPayBookingIdResolution {
  const hasBookingId =
    input.bookingId !== undefined &&
    input.bookingId !== null &&
    (typeof input.bookingId !== 'string' || input.bookingId.trim() !== '')

  if (input.itemKey === 'newebpay_live_smoke_test_1') {
    return hasBookingId ? { ok: false, error: 'booking_id_not_allowed' } : { ok: true, bookingId: null }
  }

  if (hasBookingId && input.source !== 'booking') {
    return { ok: false, error: 'booking_id_not_allowed' }
  }

  if (input.source !== 'booking') {
    return { ok: true, bookingId: null }
  }

  if (!hasBookingId) {
    return { ok: false, error: 'booking_id_required' }
  }

  if (!isValidNewebPayBookingId(input.bookingId)) {
    return { ok: false, error: 'invalid_booking_id' }
  }

  return { ok: true, bookingId: input.bookingId.trim() }
}

export function validateNewebPayBookingPayment(input: {
  booking: NewebPayBookingPaymentContext | null
  expectedAmountTwd: number
}): NewebPayBookingPaymentValidationResult {
  if (!input.booking) {
    return { ok: false, error: 'booking_not_found' }
  }

  if (input.booking.amountTwd !== input.expectedAmountTwd) {
    return { ok: false, error: 'booking_amount_mismatch' }
  }

  if (input.booking.status !== 'pending_payment' || input.booking.paymentStatus !== 'pending') {
    return { ok: false, error: 'booking_already_paid' }
  }

  return { ok: true }
}

function getPendingPaymentTarget(itemKey: NewebPayPaymentItemKey, bookingId?: string | null) {
  if (itemKey === 'newebpay_live_smoke_test_1') {
    return {
      itemType: 'newebpay_smoke_test',
      itemId: itemKey,
      bookingId: null,
    }
  }

  return {
    itemType: 'booking',
    itemId: bookingId ?? itemKey,
    bookingId: bookingId ?? null,
  }
}

function buildMerchantOrderUrl(siteUrl: string, pathname: string, merchantOrderNo: string) {
  const url = new URL(pathname, `${siteUrl}/`)
  url.searchParams.set('merchantOrderNo', merchantOrderNo)
  return url.toString()
}

export function buildNewebPayPendingPaymentMetadata({
  itemKey,
  source,
  paymentMode,
  merchantOrderNo,
  bookingId,
}: BuildNewebPayPendingPaymentMetadataInput): NewebPayPendingPaymentMetadata {
  const item = getNewebPayPaymentItem(itemKey)
  if (!item) {
    throw new Error('Unsupported NewebPay payment item')
  }

  const target = getPendingPaymentTarget(item.itemKey, bookingId)

  return {
    ...target,
    rawPayload: {
      itemKey: item.itemKey,
      source: source ?? null,
      paymentMode,
      amount: item.amount,
      itemDesc: item.itemDesc,
      merchantOrderNo,
      ...(target.bookingId ? { bookingId: target.bookingId } : {}),
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
    ReturnURL: buildMerchantOrderUrl(config.siteUrl, '/payment/newebpay/return', merchantOrderNo),
    NotifyURL: buildMerchantOrderUrl(config.siteUrl, '/api/payments/newebpay/notify', merchantOrderNo),
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
