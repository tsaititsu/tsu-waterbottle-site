import { NextResponse } from 'next/server'
import { decryptTradeInfo, verifyTradeSha } from '../../../../../lib/newebpay/crypto'
import type { PaymentRecord } from '../../../../../lib/supabase/payments'
import type { NewebPayConfig } from '../../../../../lib/newebpay/types'

type JsonRecord = Record<string, unknown>

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SEE_OTHER_STATUS = 303

export type NewebPayReturnHandlerDeps = {
  getNewebPayConfig?: () => NewebPayConfig
  verifyTradeSha?: (encryptedTradeInfo: string, tradeSha: string, hashKey: string, hashIv: string) => boolean
  decryptTradeInfo?: (encryptedTradeInfo: string, hashKey: string, hashIv: string) => unknown
  getPaymentByMerchantOrderNo: (merchantOrderNo: string) => Promise<PaymentRecord | null>
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getString(value: unknown) {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function getDirectMerchantOrderNo(formData: FormData) {
  return (
    getFormString(formData, 'MerchantOrderNo') ||
    getFormString(formData, 'merchantOrderNo')
  ).trim()
}

function getMerchantOrderNo(decryptedTradeInfo: unknown) {
  if (typeof decryptedTradeInfo === 'string') {
    const trimmed = decryptedTradeInfo.trim()
    if (!trimmed) return ''

    try {
      const parsed = JSON.parse(trimmed)
      return getMerchantOrderNo(parsed)
    } catch {
      const params = new URLSearchParams(trimmed)
      return getString(params.get('MerchantOrderNo')).trim()
    }
  }

  if (!isRecord(decryptedTradeInfo)) return ''
  const result = isRecord(decryptedTradeInfo.Result) ? decryptedTradeInfo.Result : decryptedTradeInfo
  return getString(result.MerchantOrderNo).trim()
}

function redirectToGenericReturn(request: Request) {
  const url = new URL('/payment/newebpay/result', request.url)
  return NextResponse.redirect(url, { status: SEE_OTHER_STATUS })
}

function redirectToDivinationResult(request: Request, readingId: string) {
  const url = new URL(`/ai-divination/result/${encodeURIComponent(readingId)}`, request.url)
  url.searchParams.set('payment', 'success')
  return NextResponse.redirect(url, { status: SEE_OTHER_STATUS })
}

export function isValidDivinationReturnReadingId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim())
}

export function buildNewebPayReturnRedirectForPayment(request: Request, payment: PaymentRecord | null) {
  if (
    payment?.provider === 'newebpay' &&
    payment.itemType === 'ai_divination' &&
    isValidDivinationReturnReadingId(payment.itemId)
  ) {
    return redirectToDivinationResult(request, payment.itemId.trim())
  }

  return null
}

export async function handleNewebPayReturnPost(
  request: Request,
  deps: NewebPayReturnHandlerDeps,
): Promise<NextResponse> {
  try {
    const formData = await request.formData()
    const directMerchantOrderNo = getDirectMerchantOrderNo(formData)
    const encryptedTradeInfo = getFormString(formData, 'TradeInfo')
    const tradeSha = getFormString(formData, 'TradeSha')
    let merchantOrderNo = directMerchantOrderNo

    if (!merchantOrderNo) {
      if (!encryptedTradeInfo || !tradeSha) {
        return redirectToGenericReturn(request)
      }

      const config = deps.getNewebPayConfig
        ? deps.getNewebPayConfig()
        : (await import('../../../../../lib/newebpay/config')).getNewebPayConfig()
      const verify = deps.verifyTradeSha ?? verifyTradeSha
      if (!verify(encryptedTradeInfo, tradeSha, config.hashKey, config.hashIv)) {
        return redirectToGenericReturn(request)
      }

      const decrypt = deps.decryptTradeInfo ?? decryptTradeInfo
      merchantOrderNo = getMerchantOrderNo(decrypt(encryptedTradeInfo, config.hashKey, config.hashIv))
    }

    if (!merchantOrderNo) {
      return redirectToGenericReturn(request)
    }

    const payment = await deps.getPaymentByMerchantOrderNo(merchantOrderNo)
    const divinationRedirect = buildNewebPayReturnRedirectForPayment(request, payment)
    if (divinationRedirect) return divinationRedirect

    return redirectToGenericReturn(request)
  } catch {
    return redirectToGenericReturn(request)
  }
}

export function handleNewebPayReturnGet(request: Request) {
  return redirectToGenericReturn(request)
}
