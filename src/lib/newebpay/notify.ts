import { decryptTradeInfo, verifyTradeSha } from './crypto'
import type { MarkPaymentPaidInput, MarkPaymentPaidResult } from '../supabase/payments'

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

type MarkPaymentPaidHandler = (input: MarkPaymentPaidInput) => Promise<MarkPaymentPaidResult>

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
