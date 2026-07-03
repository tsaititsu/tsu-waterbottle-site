import { NextResponse } from 'next/server'
import { getNewebPayConfig } from '@/lib/newebpay/config'
import {
  createNewebPayMpgPaymentData,
  isNewebPayPaymentMode,
  isNewebPayPaymentSource,
  type NewebPayPaymentMode,
} from '@/lib/newebpay/paymentForm'
import { getNewebPayPaymentItem } from '@/lib/newebpay/paymentItems'

type CreateNewebPayPaymentRequest = {
  itemKey?: unknown
  source?: unknown
  paymentMode?: unknown
}

function paymentConfigErrorResponse() {
  return NextResponse.json(
    { ok: false, error: '藍新金流設定尚未完整，請確認必要環境變數。' },
    { status: 500 },
  )
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateNewebPayPaymentRequest | null
  const item = getNewebPayPaymentItem(body?.itemKey)

  if (!item) {
    return NextResponse.json({ ok: false, error: '不支援的付款項目。' }, { status: 400 })
  }

  if (body?.source !== undefined && !isNewebPayPaymentSource(body.source)) {
    return NextResponse.json({ ok: false, error: '不支援的付款來源。' }, { status: 400 })
  }

  if (body?.paymentMode === 'linepay') {
    return NextResponse.json({ ok: false, error: 'linepay_not_enabled' }, { status: 400 })
  }

  if (body?.paymentMode !== undefined && !isNewebPayPaymentMode(body.paymentMode)) {
    return NextResponse.json({ ok: false, error: '不支援的付款模式。' }, { status: 400 })
  }

  const paymentMode: NewebPayPaymentMode = body?.paymentMode ?? 'credit'

  try {
    const config = getNewebPayConfig()
    const paymentData = createNewebPayMpgPaymentData({
      itemKey: item.itemKey,
      config,
      paymentMode,
    })

    return NextResponse.json({
      ok: true,
      ...paymentData,
    })
  } catch {
    return paymentConfigErrorResponse()
  }
}
