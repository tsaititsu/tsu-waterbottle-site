import { decryptTradeInfo, getEncryptedTradeInfoDiagnostics, verifyTradeSha } from './crypto'
import type { NewebPayQueryResult, QueryNewebPayTradeInput } from './query'
import type { NewebPayConfig } from './types'
import type { MarkPaymentPaidInput, MarkPaymentPaidResult, PaymentRecord } from '../supabase/payments'

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
  | { ok: true; paymentStatus: 'paid'; result: 'updated' | 'already_paid' }
  | { ok: false; error: 'payment_not_found'; result: 'not_found' }

export type NewebPayNotifyQueryFallbackResult =
  | { ok: true; paymentStatus: 'paid'; result: 'updated' | 'already_paid'; query: NewebPayQueryResult }
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
    paidAt: result.payTime ?? notifyReceivedAt,
    notifyReceivedAt,
    rawPayload: buildNewebPayNotifyRawPayload(result),
  }
}

export async function persistNewebPayNotifyPaymentResult(
  result: NewebPayNotifyResult,
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
  }
}

function getPaymentRawPayloadAmount(payment: PaymentRecord) {
  const amount = payment.rawPayload?.amount
  const normalizedAmount = typeof amount === 'number' ? amount : Number(getString(amount))
  return Number.isFinite(normalizedAmount) && normalizedAmount > 0 ? normalizedAmount : null
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

  if (query.merchantOrderNo !== merchantOrderNo) {
    return {
      ok: true,
      ignored: true,
      reason: 'query_merchant_order_mismatch',
      query,
    }
  }

  if (query.amount !== amount) {
    return {
      ok: true,
      ignored: true,
      reason: 'query_amount_mismatch',
      query,
    }
  }

  const updateResult = await markPaymentPaid({
    merchantOrderNo,
    providerTradeNo: query.tradeNo ?? null,
    paidAt: query.payTime ?? notifyReceivedAt,
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
