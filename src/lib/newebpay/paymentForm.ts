import { createTradeSha, encryptTradeInfo } from './crypto'
import { AI_CHART_REPORT_ITEM_KEY, buildAiChartReportPaymentPayload } from './aiChartPayment'
import { AI_DIVINATION_ITEM_KEY, buildDivinationPaymentPayload } from './divinationPayment'
import { generateNewebPayMerchantOrderNo } from './orderNo'
import { getNewebPayPaymentItem, type NewebPayPaymentItemKey } from './paymentItems'
import type { NewebPayConfig } from './types'

export type NewebPayPaymentSource = 'booking' | 'ai_divination' | 'ai_chart' | 'ai_chart_report' | 'manual_test'
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

export type NewebPayDivinationReadingIdResolution =
  | { ok: true; readingId: string | null }
  | {
      ok: false
      error:
        | 'divination_reading_id_required'
        | 'invalid_divination_reading_id'
        | 'divination_reading_id_not_allowed'
    }

export type NewebPayAiChartReportIdResolution =
  | { ok: true; reportId: string | null }
  | {
      ok: false
      error:
        | 'ai_chart_report_id_required'
        | 'invalid_ai_chart_report_id'
        | 'ai_chart_report_id_not_allowed'
    }

export type NewebPayBookingPaymentValidationResult =
  | { ok: true }
  | { ok: false; error: 'booking_not_found' | 'booking_amount_mismatch' | 'booking_already_paid' }

export type NewebPayAiChartReportPaymentContext = {
  id: string
  amountTwd: number | null
  paymentStatus: string | null
  paymentId?: string | null
  merchantOrderNo?: string | null
}

export type NewebPayAiChartReportPaymentValidationResult =
  | { ok: true }
  | {
      ok: false
      error: 'ai_chart_report_not_found' | 'ai_chart_report_not_payable' | 'ai_chart_report_already_linked'
    }

export type NewebPayDivinationPendingPaymentLinkResult =
  | 'linked'
  | 'already_linked'
  | 'not_found'
  | 'not_payable'

export type NewebPayDivinationPendingPaymentLinkResolution =
  | { ok: true }
  | {
      ok: false
      error:
        | 'divination_reading_already_linked'
        | 'divination_reading_not_found'
        | 'divination_reading_not_payable'
    }

export type NewebPayAiChartReportPendingPaymentLinkResult =
  | 'linked'
  | 'already_linked'
  | 'not_found'
  | 'not_payable'

export type NewebPayAiChartReportPendingPaymentLinkResolution =
  | { ok: true }
  | {
      ok: false
      error:
        | 'ai_chart_report_already_linked'
        | 'ai_chart_report_not_found'
        | 'ai_chart_report_not_payable'
    }

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
    readingId?: string
    reportId?: string
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
  readingId?: string | null
  reportId?: string | null
}

const allowedSources = new Set<NewebPayPaymentSource>([
  'booking',
  'ai_divination',
  'ai_chart',
  'ai_chart_report',
  'manual_test',
])
const allowedPaymentModes = new Set<NewebPayPaymentMode>(['credit', 'merchant_default'])

export function isNewebPayPaymentSource(source: unknown): source is NewebPayPaymentSource {
  return typeof source === 'string' && allowedSources.has(source as NewebPayPaymentSource)
}

export function isNewebPayPaymentMode(mode: unknown): mode is NewebPayPaymentMode {
  return typeof mode === 'string' && allowedPaymentModes.has(mode as NewebPayPaymentMode)
}

export function isValidNewebPayUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim())
  )
}

export function isValidNewebPayBookingId(value: unknown): value is string {
  return isValidNewebPayUuid(value)
}

export function isValidNewebPayDivinationReadingId(value: unknown): value is string {
  return isValidNewebPayUuid(value)
}

export function isValidNewebPayAiChartReportId(value: unknown): value is string {
  return isValidNewebPayUuid(value)
}

function hasNonEmptyValue(value: unknown) {
  return value !== undefined && value !== null && (typeof value !== 'string' || value.trim() !== '')
}

export function resolveNewebPayBookingIdForPayment(input: {
  itemKey: NewebPayPaymentItemKey
  source?: NewebPayPaymentSource
  bookingId?: unknown
}): NewebPayBookingIdResolution {
  const hasBookingId = hasNonEmptyValue(input.bookingId)

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

export function resolveNewebPayDivinationReadingIdForPayment(input: {
  itemKey: NewebPayPaymentItemKey
  readingId?: unknown
}): NewebPayDivinationReadingIdResolution {
  const hasReadingId = hasNonEmptyValue(input.readingId)

  if (input.itemKey !== AI_DIVINATION_ITEM_KEY) {
    return hasReadingId
      ? { ok: false, error: 'divination_reading_id_not_allowed' }
      : { ok: true, readingId: null }
  }

  if (!hasReadingId) {
    return { ok: false, error: 'divination_reading_id_required' }
  }

  if (!isValidNewebPayDivinationReadingId(input.readingId)) {
    return { ok: false, error: 'invalid_divination_reading_id' }
  }

  return { ok: true, readingId: input.readingId.trim() }
}

export function resolveNewebPayAiChartReportIdForPayment(input: {
  itemKey: NewebPayPaymentItemKey
  reportId?: unknown
}): NewebPayAiChartReportIdResolution {
  const hasReportId = hasNonEmptyValue(input.reportId)

  if (input.itemKey !== AI_CHART_REPORT_ITEM_KEY) {
    return hasReportId
      ? { ok: false, error: 'ai_chart_report_id_not_allowed' }
      : { ok: true, reportId: null }
  }

  if (!hasReportId) {
    return { ok: false, error: 'ai_chart_report_id_required' }
  }

  if (!isValidNewebPayAiChartReportId(input.reportId)) {
    return { ok: false, error: 'invalid_ai_chart_report_id' }
  }

  return { ok: true, reportId: input.reportId.trim() }
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

export function validateNewebPayAiChartReportPayment(input: {
  report: NewebPayAiChartReportPaymentContext | null
  expectedAmountTwd: number
}): NewebPayAiChartReportPaymentValidationResult {
  if (!input.report) {
    return { ok: false, error: 'ai_chart_report_not_found' }
  }

  if (input.report.amountTwd !== input.expectedAmountTwd) {
    return { ok: false, error: 'ai_chart_report_not_payable' }
  }

  if (input.report.paymentId || input.report.merchantOrderNo) {
    return { ok: false, error: 'ai_chart_report_already_linked' }
  }

  if (input.report.paymentStatus !== 'pending' && input.report.paymentStatus !== null) {
    return { ok: false, error: 'ai_chart_report_not_payable' }
  }

  return { ok: true }
}

export function resolveNewebPayDivinationPendingPaymentLink(
  result: NewebPayDivinationPendingPaymentLinkResult,
): NewebPayDivinationPendingPaymentLinkResolution {
  if (result === 'linked') {
    return { ok: true }
  }

  const errorByResult = {
    already_linked: 'divination_reading_already_linked',
    not_found: 'divination_reading_not_found',
    not_payable: 'divination_reading_not_payable',
  } as const

  return {
    ok: false,
    error: errorByResult[result],
  }
}

export function resolveNewebPayAiChartReportPendingPaymentLink(
  result: NewebPayAiChartReportPendingPaymentLinkResult,
): NewebPayAiChartReportPendingPaymentLinkResolution {
  if (result === 'linked') {
    return { ok: true }
  }

  const errorByResult = {
    already_linked: 'ai_chart_report_already_linked',
    not_found: 'ai_chart_report_not_found',
    not_payable: 'ai_chart_report_not_payable',
  } as const

  return {
    ok: false,
    error: errorByResult[result],
  }
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

function buildClientBackUrl(siteUrl: string, itemKey: NewebPayPaymentItemKey) {
  if (itemKey === AI_DIVINATION_ITEM_KEY) {
    return `${siteUrl}/ai-divination`
  }

  if (itemKey === AI_CHART_REPORT_ITEM_KEY) {
    return `${siteUrl}/ai-chart`
  }

  return `${siteUrl}/booking`
}

export function buildNewebPayPendingPaymentMetadata({
  itemKey,
  source,
  paymentMode,
  merchantOrderNo,
  bookingId,
  readingId,
  reportId,
}: BuildNewebPayPendingPaymentMetadataInput): NewebPayPendingPaymentMetadata {
  const item = getNewebPayPaymentItem(itemKey)
  if (!item) {
    throw new Error('Unsupported NewebPay payment item')
  }

  if (item.itemKey === AI_DIVINATION_ITEM_KEY) {
    const divinationPayload = buildDivinationPaymentPayload({
      readingId: readingId ?? '',
      merchantOrderNo,
      paymentMode,
    })

    return {
      itemType: divinationPayload.itemType,
      itemId: divinationPayload.itemId,
      bookingId: null,
      rawPayload: {
        ...divinationPayload.rawPayload,
        itemDesc: item.itemDesc,
      },
    }
  }

  if (item.itemKey === AI_CHART_REPORT_ITEM_KEY) {
    const aiChartPayload = buildAiChartReportPaymentPayload({
      reportId: reportId ?? '',
      merchantOrderNo,
      paymentMode,
    })

    return {
      itemType: aiChartPayload.itemType,
      itemId: aiChartPayload.itemId,
      bookingId: null,
      rawPayload: {
        ...aiChartPayload.rawPayload,
        itemDesc: item.itemDesc,
      },
    }
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
    ClientBackURL: buildClientBackUrl(config.siteUrl, item.itemKey),
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
