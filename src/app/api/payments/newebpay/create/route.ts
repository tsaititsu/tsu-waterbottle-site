import { NextResponse } from 'next/server'
import { getNewebPayConfig } from '@/lib/newebpay/config'
import {
  buildNewebPayPendingPaymentMetadata,
  createNewebPayMpgPaymentData,
  isNewebPayPaymentMode,
  isNewebPayPaymentSource,
  resolveNewebPayAiChartReportPendingPaymentLink,
  resolveNewebPayAiChartReportIdForPayment,
  resolveNewebPayDivinationPendingPaymentLink,
  resolveNewebPayBookingIdForPayment,
  resolveNewebPayDivinationReadingIdForPayment,
  type NewebPayPaymentMode,
  type NewebPayPaymentSource,
  validateNewebPayAiChartReportPayment,
  validateNewebPayBookingPayment,
} from '@/lib/newebpay/paymentForm'
import { getNewebPayPaymentItem } from '@/lib/newebpay/paymentItems'
import { getSupabaseBookingPaymentContext } from '@/lib/supabase/bookings'
import { getAiChartReportPaymentContext, linkAiChartReportPendingPayment } from '@/lib/supabase/aiChartReports'
import {
  getDivinationReadingPaymentContext,
  linkDivinationReadingPendingPayment,
  validateDivinationReadingPayment,
} from '@/lib/supabase/divinationReadings'
import { createPendingPayment } from '@/lib/supabase/payments'

type CreateNewebPayPaymentRequest = {
  itemKey?: unknown
  source?: unknown
  paymentMode?: unknown
  bookingId?: unknown
  readingId?: unknown
  reportId?: unknown
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

function divinationReadingLookupErrorResponse(input: { readingId: string; error: unknown }) {
  console.error('藍新付款占卜 reading 查詢失敗', {
    readingId: input.readingId,
    error: input.error instanceof Error ? input.error.message : 'unknown_error',
  })

  return NextResponse.json({ ok: false, error: 'divination_reading_lookup_failed' }, { status: 500 })
}

function aiChartReportLookupErrorResponse(input: { reportId: string; error: unknown }) {
  console.error('藍新付款 AI 命盤 report 查詢失敗', {
    reportId: input.reportId,
    error: input.error instanceof Error ? input.error.message : 'unknown_error',
  })

  return NextResponse.json({ ok: false, error: 'ai_chart_report_lookup_failed' }, { status: 500 })
}

function divinationPaymentLinkErrorResponse(input: {
  readingId: string
  paymentId: string
  merchantOrderNo: string
  error: unknown
}) {
  console.error('藍新占卜 payment link 失敗', {
    readingId: input.readingId,
    paymentId: input.paymentId,
    merchantOrderNo: input.merchantOrderNo,
    error: input.error instanceof Error ? input.error.message : 'unknown_error',
  })

  return NextResponse.json({ ok: false, error: 'divination_payment_link_failed' }, { status: 500 })
}

function aiChartPaymentLinkErrorResponse(input: {
  reportId: string
  paymentId: string
  merchantOrderNo: string
  error: unknown
}) {
  console.error('藍新 AI 命盤 payment link 失敗', {
    reportId: input.reportId,
    paymentId: input.paymentId,
    merchantOrderNo: input.merchantOrderNo,
    error: input.error instanceof Error ? input.error.message : 'unknown_error',
  })

  return NextResponse.json({ ok: false, error: 'ai_chart_payment_link_failed' }, { status: 500 })
}

function divinationPaymentLinkResultResponse(input: {
  readingId: string
  paymentId: string
  merchantOrderNo: string
  result: 'already_linked' | 'not_found' | 'not_payable'
}) {
  const resolution = resolveNewebPayDivinationPendingPaymentLink(input.result)

  console.warn('藍新占卜 payment link 未完成', {
    readingId: input.readingId,
    paymentId: input.paymentId,
    merchantOrderNo: input.merchantOrderNo,
    result: input.result,
  })

  return NextResponse.json(
    { ok: false, error: resolution.ok ? 'divination_payment_link_failed' : resolution.error },
    { status: 400 },
  )
}

function aiChartPaymentLinkResultResponse(input: {
  reportId: string
  paymentId: string
  merchantOrderNo: string
  result: 'already_linked' | 'not_found' | 'not_payable'
}) {
  const resolution = resolveNewebPayAiChartReportPendingPaymentLink(input.result)

  console.warn('藍新 AI 命盤 payment link 未完成', {
    reportId: input.reportId,
    paymentId: input.paymentId,
    merchantOrderNo: input.merchantOrderNo,
    result: input.result,
  })

  return NextResponse.json(
    { ok: false, error: resolution.ok ? 'ai_chart_payment_link_failed' : resolution.error },
    { status: 400 },
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
  const readingIdResolution = resolveNewebPayDivinationReadingIdForPayment({
    itemKey: item.itemKey,
    readingId: body?.readingId,
  })

  if (!readingIdResolution.ok) {
    return NextResponse.json({ ok: false, error: readingIdResolution.error }, { status: 400 })
  }

  const readingId = readingIdResolution.readingId
  const reportIdResolution = resolveNewebPayAiChartReportIdForPayment({
    itemKey: item.itemKey,
    reportId: body?.reportId,
  })

  if (!reportIdResolution.ok) {
    return NextResponse.json({ ok: false, error: reportIdResolution.error }, { status: 400 })
  }

  const reportId = reportIdResolution.reportId

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

  if (readingId) {
    let reading

    try {
      reading = await getDivinationReadingPaymentContext(readingId)
    } catch (error) {
      return divinationReadingLookupErrorResponse({ readingId, error })
    }

    const readingValidation = validateDivinationReadingPayment(reading)

    if (!readingValidation.ok) {
      return NextResponse.json({ ok: false, error: readingValidation.error }, { status: 400 })
    }
  }

  if (reportId) {
    let report

    try {
      report = await getAiChartReportPaymentContext(reportId)
    } catch (error) {
      return aiChartReportLookupErrorResponse({ reportId, error })
    }

    const reportValidation = validateNewebPayAiChartReportPayment({
      report,
      expectedAmountTwd: item.amount,
    })

    if (!reportValidation.ok) {
      return NextResponse.json({ ok: false, error: reportValidation.error }, { status: 400 })
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
      readingId,
      reportId,
    })

    let pendingPayment: Awaited<ReturnType<typeof createPendingPayment>>

    try {
      pendingPayment = await createPendingPayment({
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

    if (readingId) {
      try {
        const linkResult = await linkDivinationReadingPendingPayment({
          readingId,
          paymentId: pendingPayment.id,
          merchantOrderNo: paymentData.merchantOrderNo,
        })

        if (linkResult.result !== 'linked') {
          return divinationPaymentLinkResultResponse({
            readingId,
            paymentId: pendingPayment.id,
            merchantOrderNo: paymentData.merchantOrderNo,
            result: linkResult.result,
          })
        }
      } catch (error) {
        return divinationPaymentLinkErrorResponse({
          readingId,
          paymentId: pendingPayment.id,
          merchantOrderNo: paymentData.merchantOrderNo,
          error,
        })
      }
    }

    if (reportId) {
      try {
        const linkResult = await linkAiChartReportPendingPayment({
          reportId,
          paymentId: pendingPayment.id,
          merchantOrderNo: paymentData.merchantOrderNo,
        })

        if (linkResult.result !== 'linked') {
          return aiChartPaymentLinkResultResponse({
            reportId,
            paymentId: pendingPayment.id,
            merchantOrderNo: paymentData.merchantOrderNo,
            result: linkResult.result,
          })
        }
      } catch (error) {
        return aiChartPaymentLinkErrorResponse({
          reportId,
          paymentId: pendingPayment.id,
          merchantOrderNo: paymentData.merchantOrderNo,
          error,
        })
      }
    }

    return NextResponse.json({
      ok: true,
      ...paymentData,
    })
  } catch {
    return paymentConfigErrorResponse()
  }
}
