import { NextResponse } from 'next/server'
import { getNewebPayConfig } from '@/lib/newebpay/config'
import {
  buildNewebPayPendingPaymentMetadata,
  createNewebPayMpgPaymentData,
  isNewebPayPaymentMode,
  isNewebPayPaymentSource,
  type NewebPayPaymentMode,
  type NewebPayPaymentSource,
} from '@/lib/newebpay/paymentForm'
import { getNewebPayPaymentItem } from '@/lib/newebpay/paymentItems'
import { createPendingPayment } from '@/lib/supabase/payments'

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

function pendingPaymentErrorResponse(input: { merchantOrderNo: string; itemKey: string; error: unknown }) {
  console.error('建立藍新 pending payment 失敗', {
    merchantOrderNo: input.merchantOrderNo,
    itemKey: input.itemKey,
    error: input.error instanceof Error ? input.error.message : 'unknown_error',
  })

  return NextResponse.json({ ok: false, error: '建立付款紀錄失敗，請稍後再試。' }, { status: 500 })
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
  const source = body?.source as NewebPayPaymentSource | undefined

  try {
    const config = getNewebPayConfig()
    const paymentData = createNewebPayMpgPaymentData({
      itemKey: item.itemKey,
      config,
      paymentMode,
    })
    const pendingPaymentMetadata = buildNewebPayPendingPaymentMetadata({
      itemKey: item.itemKey,
      source,
      paymentMode,
      merchantOrderNo: paymentData.merchantOrderNo,
    })

    try {
      await createPendingPayment({
        provider: 'newebpay',
        itemType: pendingPaymentMetadata.itemType,
        itemId: pendingPaymentMetadata.itemId,
        itemName: item.itemDesc,
        merchantOrderNo: paymentData.merchantOrderNo,
        amountTwd: item.amount,
        rawPayload: pendingPaymentMetadata.rawPayload,
      })
    } catch (error) {
      return pendingPaymentErrorResponse({
        merchantOrderNo: paymentData.merchantOrderNo,
        itemKey: item.itemKey,
        error,
      })
    }

    return NextResponse.json({
      ok: true,
      ...paymentData,
    })
  } catch {
    return paymentConfigErrorResponse()
  }
}
