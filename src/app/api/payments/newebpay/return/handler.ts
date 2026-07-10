import { NextResponse } from 'next/server'
import { decryptTradeInfo, verifyTradeSha } from '../../../../../lib/newebpay/crypto'
import type { PaymentRecord } from '../../../../../lib/supabase/payments'
import type { NewebPayConfig } from '../../../../../lib/newebpay/types'

type JsonRecord = Record<string, unknown>

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

function redirectToGenericReturn(request: Request, params: Record<string, string>) {
  const url = new URL('/payment/newebpay/return', request.url)
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  return NextResponse.redirect(url)
}

function redirectToDivinationResult(request: Request, readingId: string) {
  const url = new URL(`/ai-divination/result/${encodeURIComponent(readingId)}`, request.url)
  url.searchParams.set('payment', 'success')
  return NextResponse.redirect(url)
}

export function buildNewebPayReturnRedirectForPayment(request: Request, payment: PaymentRecord | null) {
  if (
    payment?.provider === 'newebpay' &&
    payment.itemType === 'ai_divination' &&
    typeof payment.itemId === 'string' &&
    payment.itemId.trim()
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
    const encryptedTradeInfo = getFormString(formData, 'TradeInfo')
    const tradeSha = getFormString(formData, 'TradeSha')

    if (!encryptedTradeInfo || !tradeSha) {
      return redirectToGenericReturn(request, { status: 'unknown' })
    }

    const config = deps.getNewebPayConfig
      ? deps.getNewebPayConfig()
      : (await import('../../../../../lib/newebpay/config')).getNewebPayConfig()
    const verify = deps.verifyTradeSha ?? verifyTradeSha
    if (!verify(encryptedTradeInfo, tradeSha, config.hashKey, config.hashIv)) {
      return redirectToGenericReturn(request, { status: 'unknown' })
    }

    const decrypt = deps.decryptTradeInfo ?? decryptTradeInfo
    const merchantOrderNo = getMerchantOrderNo(decrypt(encryptedTradeInfo, config.hashKey, config.hashIv))
    if (!merchantOrderNo) {
      return redirectToGenericReturn(request, { status: 'unknown' })
    }

    const payment = await deps.getPaymentByMerchantOrderNo(merchantOrderNo)
    const divinationRedirect = buildNewebPayReturnRedirectForPayment(request, payment)
    if (divinationRedirect) return divinationRedirect

    return redirectToGenericReturn(request, { merchantOrderNo })
  } catch {
    return redirectToGenericReturn(request, { status: 'unknown' })
  }
}

export function handleNewebPayReturnGet(request: Request) {
  return redirectToGenericReturn(request, { status: 'unknown' })
}
