import { NextResponse } from 'next/server'
import { decryptTradeInfo, verifyTradeSha } from '@/lib/newebpay/mpg'

type JsonRecord = Record<string, unknown>

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
  if (!isRecord(decryptedTradeInfo)) return ''
  const result = isRecord(decryptedTradeInfo.Result) ? decryptedTradeInfo.Result : decryptedTradeInfo
  return getString(result.MerchantOrderNo)
}

function redirectToResult(request: Request, params: Record<string, string>) {
  const url = new URL('/payment/newebpay/return', request.url)
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  return NextResponse.redirect(url)
}

export async function GET(request: Request) {
  return redirectToResult(request, { status: 'unknown' })
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const encryptedTradeInfo = getFormString(formData, 'TradeInfo')
    const tradeSha = getFormString(formData, 'TradeSha')

    if (!encryptedTradeInfo || !tradeSha) {
      return redirectToResult(request, { status: 'unknown' })
    }

    if (!verifyTradeSha(encryptedTradeInfo, tradeSha)) {
      return redirectToResult(request, { status: 'unknown' })
    }

    const merchantOrderNo = getMerchantOrderNo(decryptTradeInfo(encryptedTradeInfo))
    if (!merchantOrderNo) {
      return redirectToResult(request, { status: 'unknown' })
    }

    return redirectToResult(request, { merchantOrderNo })
  } catch {
    return redirectToResult(request, { status: 'unknown' })
  }
}
