import { decryptTradeInfo, getEncryptedTradeInfoDiagnostics, verifyTradeSha } from './crypto'
import {
  syncAiChartReportAfterPayment,
  type StartPaidAiChartReportCompletionHandler,
} from './aiChartSync'
import { syncDivinationReadingAfterPayment } from './divinationSync'
import { parseNewebPayTaipeiPayTime } from './payTime'
import type { NewebPayQueryResult, QueryNewebPayTradeInput } from './query'
import type { NewebPayConfig } from './types'
import { PRODUCT_ORDER_PAYMENT_ITEM_TYPE } from '../payments/productOrderPayment'
import type { MarkBookingPaidInput, MarkBookingPaidResult } from '../supabase/bookingPayments'
import type { MarkCoursePaidInput, MarkCoursePaidResult } from '../supabase/coursePurchases'
import type { MarkPaymentPaidInput, MarkPaymentPaidResult, PaymentPaidContext, PaymentRecord } from '../supabase/payments'
import { syncProductOrderAfterPaymentPaid } from '../supabase/productOrderSync'

export type NewebPayNotifyResult = {
  status: string
  merchantId: string
  merchantOrderNo: string
  tradeNo?: string
  amount?: number
  paymentType?: string
  paymentMethod?: string
  payTime?: string
  rawResult: Record<string, unknown>
}

export type NewebPayNotifyPaymentPersistenceResult =
  | { ok: true; ignored: true; status: string }
  | { ok: true; paymentStatus: 'paid'; result: 'updated' | 'already_paid'; payment: PaymentPaidContext }
  | {
      ok: false
      error: 'payment_not_found' | 'payment_amount_missing' | 'payment_amount_mismatch' | 'payment_merchant_order_mismatch'
      result: 'not_found' | 'amount_missing' | 'amount_mismatch' | 'merchant_order_mismatch'
      localAmount?: number | null
      providerAmount?: number | null
      paymentStatus?: string | null
    }

export type NewebPayNotifyQueryFallbackResult =
  | {
      ok: true
      paymentStatus: 'paid'
      result: 'updated' | 'already_paid'
      query: NewebPayQueryResult
      payment: PaymentPaidContext
    }
  | {
      ok: true
      ignored: true
      reason:
        | 'query_not_paid'
        | 'query_amount_mismatch'
        | 'query_merchant_order_mismatch'
        | 'missing_payment_amount'
      query?: NewebPayQueryResult
    }
  | { ok: false; error: 'payment_not_found'; result: 'not_found' }

export type NewebPayBookingSyncResult =
  | { bookingSync: 'skipped_no_booking' }
  | { bookingSync: 'updated' | 'already_paid' | 'not_found'; bookingId: string }
  | { bookingSync: 'failed'; bookingId: string; error: string }

export type NewebPayCourseSyncResult =
  | { courseSync: 'skipped_not_course' }
  | { courseSync: 'skipped_missing_course_context' }
  | { courseSync: 'inserted' | 'updated' | 'already_paid'; userId: string; courseId: string }
  | { courseSync: 'failed'; userId: string | null; courseId: string | null; error: string }

export type NewebPayDivinationSyncResult =
  | { divinationSync: 'skipped_not_divination' }
  | { divinationSync: 'skipped_missing_divination_context' }
  | { divinationSync: 'updated' | 'already_paid' | 'not_found'; readingId: string }
  | { divinationSync: 'invalid_state'; readingId: string; status: string | null }
  | { divinationSync: 'failed'; readingId: string | null; error: string }

export type NewebPayAiChartSyncResult =
  | { aiChartSync: 'skipped_not_ai_chart' }
  | { aiChartSync: 'skipped_missing_ai_chart_context' }
  | { aiChartSync: 'updated' | 'already_paid' | 'not_found'; reportId: string }
  | { aiChartSync: 'invalid_state'; reportId: string; paymentStatus: string | null }
  | { aiChartSync: 'failed'; reportId: string | null; error: string }

export type NewebPayProductOrderSyncResult =
  | { productOrderSync: 'skipped_not_product_order' }
  | { productOrderSync: 'skipped_missing_product_order_context' }
  | {
      productOrderSync: 'synced' | 'already_paid' | 'not_found' | 'payment_mismatch' | 'invalid_state'
      orderId: string
    }
  | { productOrderSync: 'failed'; orderId: string | null; error: string }

export type NewebPayNotifyErrorMetadata = {
  status: string
  merchantId: string
  tradeInfoLength: number
  tradeInfoIsHex: boolean
  tradeInfoHexLengthIsEven: boolean
  tradeInfoHexLengthMultipleOf32: boolean
  tradeInfoFingerprint: string
  tradeShaLength: number
  tradeShaLooksSha256: boolean
  formKeys: string[]
  errorName: string
  errorMessage: string
}

type MarkPaymentPaidHandler = (input: MarkPaymentPaidInput) => Promise<MarkPaymentPaidResult>
type GetPaymentByMerchantOrderNoHandler = (merchantOrderNo: string) => Promise<PaymentRecord | null>
type QueryNewebPayTradeHandler = (input: QueryNewebPayTradeInput) => Promise<NewebPayQueryResult>
type MarkBookingPaidHandler = (input: MarkBookingPaidInput) => Promise<MarkBookingPaidResult>
type MarkCoursePaidHandler = (input: MarkCoursePaidInput) => Promise<MarkCoursePaidResult>
type SyncDivinationReadingHandler = typeof syncDivinationReadingAfterPayment
type SyncAiChartReportHandler = typeof syncAiChartReportAfterPayment
type SyncProductOrderHandler = typeof syncProductOrderAfterPaymentPaid

type NewebPayPaymentMatchValidationResult =
  | { ok: true; payment: PaymentRecord; localAmount: number; providerAmount: number }
  | {
      ok: false
      error: 'payment_not_found' | 'payment_amount_missing' | 'payment_amount_mismatch' | 'payment_merchant_order_mismatch'
      result: 'not_found' | 'amount_missing' | 'amount_mismatch' | 'merchant_order_mismatch'
      localAmount?: number | null
      providerAmount?: number | null
      paymentStatus?: string | null
    }

type ParseNewebPayNotifyPayloadInput = {
  status: string
  merchantId: string
  version?: string
  tradeInfo: string
  tradeSha: string
  expectedMerchantId: string
  hashKey: string
  hashIv: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getString(value: unknown) {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

function getOptionalString(value: unknown) {
  const text = getString(value).trim()
  return text || undefined
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function getAmount(value: unknown) {
  const amount = Number(getString(value))
  return Number.isFinite(amount) ? amount : undefined
}

function parseDecryptedTradeInfo(decryptedTradeInfo: string): Record<string, unknown> {
  const trimmed = decryptedTradeInfo.trim()

  if (!trimmed) {
    throw new Error('Empty decrypted TradeInfo')
  }

  try {
    const parsed = JSON.parse(trimmed)
    if (isRecord(parsed)) return parsed
  } catch {
    // Fall through to query string parsing.
  }

  const params = new URLSearchParams(trimmed)
  const record = Object.fromEntries(params.entries())

  if (Object.keys(record).length === 0) {
    throw new Error('Invalid decrypted TradeInfo')
  }

  return record
}

function getResultRecord(root: Record<string, unknown>) {
  return isRecord(root.Result) ? root.Result : root
}

export function buildNewebPayNotifyErrorMetadata({
  status,
  merchantId,
  tradeInfo,
  tradeSha,
  formKeys = [],
  error,
}: {
  status: string
  merchantId: string
  tradeInfo: string
  tradeSha: string
  formKeys?: string[]
  error: unknown
}): NewebPayNotifyErrorMetadata {
  const diagnostics = getEncryptedTradeInfoDiagnostics(tradeInfo, tradeSha)

  return {
    status,
    merchantId,
    ...diagnostics,
    formKeys: [...formKeys].sort(),
    errorName: error instanceof Error ? error.name : 'Error',
    errorMessage: error instanceof Error ? error.message : 'Invalid NewebPay notify payload',
  }
}

export function buildNewebPayNotifyRawPayload(result: NewebPayNotifyResult): Record<string, unknown> {
  return {
    status: result.status,
    merchantId: result.merchantId,
    merchantOrderNo: result.merchantOrderNo,
    tradeNo: result.tradeNo ?? null,
    amount: result.amount ?? null,
    paymentType: result.paymentType ?? null,
    paymentMethod: result.paymentMethod ?? null,
    payTime: result.payTime ?? null,
  }
}

export function buildNewebPayQueryFallbackRawPayload(result: NewebPayQueryResult): Record<string, unknown> {
  return {
    source: 'query_fallback',
    status: result.status,
    merchantOrderNo: result.merchantOrderNo,
    tradeStatus: result.tradeStatus ?? null,
    tradeNo: result.tradeNo ?? null,
    amount: result.amount,
    paymentType: result.paymentType ?? null,
    paymentMethod: result.paymentMethod ?? null,
    payTime: result.payTime ?? null,
  }
}

export function buildMarkPaymentPaidInputFromNotify(
  result: NewebPayNotifyResult,
  notifyReceivedAt = new Date().toISOString(),
): MarkPaymentPaidInput | null {
  if (result.status !== 'SUCCESS') {
    return null
  }

  return {
    merchantOrderNo: result.merchantOrderNo,
    providerTradeNo: result.tradeNo ?? null,
    paidAt: parseNewebPayTaipeiPayTime(result.payTime) ?? notifyReceivedAt,
    notifyReceivedAt,
    rawPayload: buildNewebPayNotifyRawPayload(result),
  }
}

export async function persistNewebPayNotifyPaymentResult(
  result: NewebPayNotifyResult,
  getPaymentByMerchantOrderNo: GetPaymentByMerchantOrderNoHandler,
  markPaymentPaid: MarkPaymentPaidHandler,
  notifyReceivedAt = new Date().toISOString(),
): Promise<NewebPayNotifyPaymentPersistenceResult> {
  const input = buildMarkPaymentPaidInputFromNotify(result, notifyReceivedAt)

  if (!input) {
    return {
      ok: true,
      ignored: true,
      status: result.status,
    }
  }

  const payment = await getPaymentByMerchantOrderNo(result.merchantOrderNo)
  const validation = validateNewebPayPaymentMatch({
    payment,
    expectedMerchantOrderNo: result.merchantOrderNo,
    providerMerchantOrderNo: result.merchantOrderNo,
    providerAmount: result.amount,
  })

  if (!validation.ok) {
    return validation
  }

  const updateResult = await markPaymentPaid(input)

  if (updateResult.result === 'not_found') {
    return {
      ok: false,
      error: 'payment_not_found',
      result: 'not_found',
    }
  }

  return {
    ok: true,
    paymentStatus: 'paid',
    result: updateResult.result,
    payment: updateResult.payment,
  }
}

export async function syncNewebPayBookingAfterPayment({
  payment,
  markBookingPaid,
}: {
  payment: PaymentPaidContext
  markBookingPaid: MarkBookingPaidHandler
}): Promise<NewebPayBookingSyncResult> {
  if (!payment.bookingId) {
    return {
      bookingSync: 'skipped_no_booking',
    }
  }

  try {
    const result = await markBookingPaid({
      bookingId: payment.bookingId,
      paymentId: payment.id,
      provider: 'newebpay',
      providerTradeNo: payment.providerTradeNo,
      paidAt: payment.paidAt,
    })

    return {
      bookingSync: result.result,
      bookingId: result.bookingId,
    }
  } catch (error) {
    return {
      bookingSync: 'failed',
      bookingId: payment.bookingId,
      error: error instanceof Error ? error.message : 'unknown_error',
    }
  }
}

export async function syncNewebPayCourseAfterPayment({
  payment,
  markCoursePaid,
}: {
  payment: PaymentPaidContext
  markCoursePaid: MarkCoursePaidHandler
}): Promise<NewebPayCourseSyncResult> {
  if (payment.itemType !== 'course') {
    return {
      courseSync: 'skipped_not_course',
    }
  }

  if (!payment.userId || !payment.itemId) {
    return {
      courseSync: 'skipped_missing_course_context',
    }
  }

  try {
    const result = await markCoursePaid({
      paymentId: payment.id,
      userId: payment.userId,
      courseId: payment.itemId,
      paidAt: payment.paidAt,
    })

    return {
      courseSync: result.result,
      userId: result.userId,
      courseId: result.courseId,
    }
  } catch (error) {
    return {
      courseSync: 'failed',
      userId: payment.userId,
      courseId: payment.itemId,
      error: error instanceof Error ? error.message : 'unknown_error',
    }
  }
}

export async function syncNewebPayDivinationAfterPayment({
  payment,
  merchantOrderNo,
  syncDivinationReading = syncDivinationReadingAfterPayment,
}: {
  payment: PaymentPaidContext
  merchantOrderNo: string
  syncDivinationReading?: SyncDivinationReadingHandler
}): Promise<NewebPayDivinationSyncResult> {
  if (payment.itemType !== 'ai_divination') {
    return {
      divinationSync: 'skipped_not_divination',
    }
  }

  if (!hasText(payment.id) || !hasText(payment.itemId) || !hasText(merchantOrderNo)) {
    return {
      divinationSync: 'skipped_missing_divination_context',
    }
  }

  try {
    const result = await syncDivinationReading({
      paymentId: payment.id,
      itemType: payment.itemType,
      itemId: payment.itemId,
      merchantOrderNo,
      paidAt: payment.paidAt,
    })

    if (result.result === 'skipped_not_divination') {
      return {
        divinationSync: 'skipped_not_divination',
      }
    }

    if (result.result === 'skipped_missing_divination_context') {
      return {
        divinationSync: 'skipped_missing_divination_context',
      }
    }

    if (result.result === 'invalid_state') {
      return {
        divinationSync: 'invalid_state',
        readingId: result.readingId,
        status: result.status,
      }
    }

    return {
      divinationSync: result.result,
      readingId: result.readingId,
    }
  } catch (error) {
    return {
      divinationSync: 'failed',
      readingId: payment.itemId,
      error: error instanceof Error ? error.message : 'unknown_error',
    }
  }
}

export async function syncNewebPayAiChartAfterPayment({
  payment,
  merchantOrderNo,
  syncAiChartReport = syncAiChartReportAfterPayment,
  startPaidAiChartReportCompletionInBackground,
}: {
  payment: PaymentPaidContext
  merchantOrderNo: string
  syncAiChartReport?: SyncAiChartReportHandler
  startPaidAiChartReportCompletionInBackground?:
    StartPaidAiChartReportCompletionHandler
}): Promise<NewebPayAiChartSyncResult> {
  if (payment.itemType !== 'ai_chart_report') {
    return {
      aiChartSync: 'skipped_not_ai_chart',
    }
  }

  if (!hasText(payment.id) || !hasText(payment.itemId) || !hasText(merchantOrderNo)) {
    return {
      aiChartSync: 'skipped_missing_ai_chart_context',
    }
  }

  try {
    const result = await syncAiChartReport({
      paymentId: payment.id,
      itemType: payment.itemType,
      itemId: payment.itemId,
      merchantOrderNo,
      paidAt: payment.paidAt,
    }, {
      startPaidAiChartReportCompletionInBackground,
    })

    if (result.result === 'skipped_not_ai_chart') {
      return {
        aiChartSync: 'skipped_not_ai_chart',
      }
    }

    if (result.result === 'skipped_missing_ai_chart_context') {
      return {
        aiChartSync: 'skipped_missing_ai_chart_context',
      }
    }

    if (result.result === 'invalid_state') {
      return {
        aiChartSync: 'invalid_state',
        reportId: result.reportId,
        paymentStatus: result.paymentStatus,
      }
    }

    return {
      aiChartSync: result.result,
      reportId: result.reportId,
    }
  } catch (error) {
    return {
      aiChartSync: 'failed',
      reportId: payment.itemId,
      error: error instanceof Error ? error.message : 'unknown_error',
    }
  }
}

export async function syncNewebPayProductOrderAfterPayment({
  payment,
  syncProductOrder = syncProductOrderAfterPaymentPaid,
}: {
  payment: PaymentPaidContext
  syncProductOrder?: SyncProductOrderHandler
}): Promise<NewebPayProductOrderSyncResult> {
  if (payment.itemType !== PRODUCT_ORDER_PAYMENT_ITEM_TYPE) {
    return {
      productOrderSync: 'skipped_not_product_order',
    }
  }

  if (!hasText(payment.id) || !hasText(payment.itemId)) {
    return {
      productOrderSync: 'skipped_missing_product_order_context',
    }
  }

  try {
    const result = await syncProductOrder({
      paymentId: payment.id,
      orderId: payment.itemId,
    })

    if (result.result === 'failed') {
      return {
        productOrderSync: 'failed',
        orderId: result.orderId,
        error: result.error,
      }
    }

    return {
      productOrderSync: result.result,
      orderId: result.orderId,
    }
  } catch {
    return {
      productOrderSync: 'failed',
      orderId: payment.itemId,
      error: 'product_order_paid_sync_failed',
    }
  }
}

function getPaymentRawPayloadAmount(payment: PaymentRecord) {
  const amount = payment.rawPayload?.amount
  const normalizedAmount = typeof amount === 'number' ? amount : Number(getString(amount))
  return Number.isFinite(normalizedAmount) && normalizedAmount > 0 ? normalizedAmount : null
}

export function validateNewebPayPaymentMatch({
  payment,
  expectedMerchantOrderNo,
  providerMerchantOrderNo,
  providerAmount,
}: {
  payment: PaymentRecord | null
  expectedMerchantOrderNo: string
  providerMerchantOrderNo: string
  providerAmount?: number | null
}): NewebPayPaymentMatchValidationResult {
  if (!payment) {
    return {
      ok: false,
      error: 'payment_not_found',
      result: 'not_found',
      providerAmount: providerAmount ?? null,
      paymentStatus: null,
    }
  }

  const localAmount = getPaymentRawPayloadAmount(payment)
  const paymentStatus = payment.status ?? null
  if (payment.merchantOrderNo !== providerMerchantOrderNo || providerMerchantOrderNo !== expectedMerchantOrderNo) {
    return {
      ok: false,
      error: 'payment_merchant_order_mismatch',
      result: 'merchant_order_mismatch',
      localAmount,
      providerAmount: providerAmount ?? null,
      paymentStatus,
    }
  }

  if (!localAmount || !providerAmount) {
    return {
      ok: false,
      error: 'payment_amount_missing',
      result: 'amount_missing',
      localAmount,
      providerAmount: providerAmount ?? null,
      paymentStatus,
    }
  }

  if (localAmount !== providerAmount) {
    return {
      ok: false,
      error: 'payment_amount_mismatch',
      result: 'amount_mismatch',
      localAmount,
      providerAmount,
      paymentStatus,
    }
  }

  return {
    ok: true,
    payment,
    localAmount,
    providerAmount,
  }
}

export function isNewebPayTradeInfoDecryptError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  return (
    message.includes('bad decrypt') ||
    message.startsWith('TradeInfo must be') ||
    message.startsWith('TradeInfo hex length')
  )
}

export async function persistNewebPayNotifyQueryFallback({
  merchantOrderNo,
  config,
  getPaymentByMerchantOrderNo,
  queryNewebPayTrade,
  markPaymentPaid,
  notifyReceivedAt = new Date().toISOString(),
}: {
  merchantOrderNo: string
  config: NewebPayConfig
  getPaymentByMerchantOrderNo: GetPaymentByMerchantOrderNoHandler
  queryNewebPayTrade: QueryNewebPayTradeHandler
  markPaymentPaid: MarkPaymentPaidHandler
  notifyReceivedAt?: string
}): Promise<NewebPayNotifyQueryFallbackResult> {
  const payment = await getPaymentByMerchantOrderNo(merchantOrderNo)

  if (!payment) {
    return {
      ok: false,
      error: 'payment_not_found',
      result: 'not_found',
    }
  }

  const amount = getPaymentRawPayloadAmount(payment)
  if (!amount) {
    return {
      ok: true,
      ignored: true,
      reason: 'missing_payment_amount',
    }
  }

  const query = await queryNewebPayTrade({
    merchantId: config.merchantId,
    merchantOrderNo,
    amount,
    hashKey: config.hashKey,
    hashIv: config.hashIv,
    env: config.env,
  })

  if (query.status !== 'SUCCESS' || query.tradeStatus !== '1') {
    return {
      ok: true,
      ignored: true,
      reason: 'query_not_paid',
      query,
    }
  }

  const validation = validateNewebPayPaymentMatch({
    payment,
    expectedMerchantOrderNo: merchantOrderNo,
    providerMerchantOrderNo: query.merchantOrderNo,
    providerAmount: query.amount,
  })

  if (!validation.ok && validation.error === 'payment_merchant_order_mismatch') {
    return {
      ok: true,
      ignored: true,
      reason: 'query_merchant_order_mismatch',
      query,
    }
  }

  if (!validation.ok && validation.error === 'payment_amount_mismatch') {
    return {
      ok: true,
      ignored: true,
      reason: 'query_amount_mismatch',
      query,
    }
  }

  if (!validation.ok) {
    return {
      ok: true,
      ignored: true,
      reason: 'missing_payment_amount',
      query,
    }
  }

  const updateResult = await markPaymentPaid({
    merchantOrderNo,
    providerTradeNo: query.tradeNo ?? null,
    paidAt: parseNewebPayTaipeiPayTime(query.payTime) ?? notifyReceivedAt,
    notifyReceivedAt,
    rawPayload: buildNewebPayQueryFallbackRawPayload(query),
  })

  if (updateResult.result === 'not_found') {
    return {
      ok: false,
      error: 'payment_not_found',
      result: 'not_found',
    }
  }

  return {
    ok: true,
    paymentStatus: 'paid',
    result: updateResult.result,
    query,
    payment: updateResult.payment,
  }
}

export function parseNewebPayNotifyPayload({
  status,
  merchantId,
  tradeInfo,
  tradeSha,
  expectedMerchantId,
  hashKey,
  hashIv,
}: ParseNewebPayNotifyPayloadInput): NewebPayNotifyResult {
  if (!merchantId || merchantId !== expectedMerchantId) {
    throw new Error('Invalid MerchantID')
  }

  if (!verifyTradeSha(tradeInfo, tradeSha, hashKey, hashIv)) {
    throw new Error('Invalid TradeSha')
  }

  const root = parseDecryptedTradeInfo(decryptTradeInfo(tradeInfo, hashKey, hashIv))
  const result = getResultRecord(root)
  const resolvedStatus = getString(root.Status || result.Status || status)
  const resolvedMerchantId = getString(root.MerchantID || result.MerchantID || merchantId)
  const merchantOrderNo = getString(result.MerchantOrderNo || root.MerchantOrderNo)

  if (!resolvedStatus) {
    throw new Error('Missing Status')
  }

  if (resolvedMerchantId !== expectedMerchantId) {
    throw new Error('Invalid decrypted MerchantID')
  }

  if (!merchantOrderNo) {
    throw new Error('Missing MerchantOrderNo')
  }

  return {
    status: resolvedStatus,
    merchantId: resolvedMerchantId,
    merchantOrderNo,
    tradeNo: getOptionalString(result.TradeNo),
    amount: getAmount(result.Amt || root.Amt),
    paymentType: getOptionalString(result.PaymentType),
    paymentMethod: getOptionalString(result.PaymentMethod),
    payTime: getOptionalString(result.PayTime),
    rawResult: root,
  }
}
