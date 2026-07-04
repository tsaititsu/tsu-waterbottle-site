import { NextResponse } from 'next/server'
import { getNewebPayConfig } from '@/lib/newebpay/config'
import {
  buildNewebPayPendingPaymentMetadata,
  createNewebPayMpgPaymentData,
  isNewebPayPaymentMode,
  isNewebPayPaymentSource,
  resolveNewebPayBookingIdForPayment,
  type NewebPayPaymentMode,
  type NewebPayPaymentSource,
  validateNewebPayBookingPayment,
} from '@/lib/newebpay/paymentForm'
import { getNewebPayPaymentItem } from '@/lib/newebpay/paymentItems'
import { getSupabaseBookingPaymentContext } from '@/lib/supabase/bookings'
import { createPendingPayment } from '@/lib/supabase/payments'

type CreateNewebPayPaymentRequest = {
  itemKey?: unknown
  source?: unknown
  paymentMode?: unknown
  bookingId?: unknown
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

function bookingLookupErrorResponse(input: { bookingId: string; error: unknown }) {
  console.error('藍新付款 booking 查詢失敗', {
    bookingId: input.bookingId,
    error: input.error instanceof Error ? input.error.message : 'unknown_error',
  })

  return NextResponse.json({ ok: false, error: 'booking_lookup_failed' }, { status: 500 })
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
  const bookingIdResolution = resolveNewebPayBookingIdForPayment({
    itemKey: item.itemKey,
    source,
    bookingId: body?.bookingId,
  })

  if (!bookingIdResolution.ok) {
    return NextResponse.json({ ok: false, error: bookingIdResolution.error }, { status: 400 })
  }

  const bookingId = bookingIdResolution.bookingId

  if (bookingId) {
    let booking

    try {
      booking = await getSupabaseBookingPaymentContext(bookingId)
    } catch (error) {
      return bookingLookupErrorResponse({ bookingId, error })
    }

    const bookingValidation = validateNewebPayBookingPayment({
      booking,
      expectedAmountTwd: item.amount,
    })

    if (!bookingValidation.ok) {
      return NextResponse.json({ ok: false, error: bookingValidation.error }, { status: 400 })
    }
  }

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
      bookingId,
    })

    try {
      await createPendingPayment({
        provider: 'newebpay',
        itemType: pendingPaymentMetadata.itemType,
        itemId: pendingPaymentMetadata.itemId,
        itemName: item.itemDesc,
        bookingId: pendingPaymentMetadata.bookingId,
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
