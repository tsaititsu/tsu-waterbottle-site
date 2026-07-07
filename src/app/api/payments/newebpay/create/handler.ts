import { NextResponse } from 'next/server'
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
  resolveNewebPayProductOrderIdForPayment,
  type NewebPayPaymentMode,
  type NewebPayAiChartReportPaymentContext,
  type NewebPayBookingPaymentContext,
  type NewebPayPaymentSource,
  validateNewebPayAiChartReportPayment,
  validateNewebPayBookingPayment,
} from '../../../../../lib/newebpay/paymentForm'
import { getNewebPayPaymentItem } from '../../../../../lib/newebpay/paymentItems'
import {
  buildProductOrderPaymentMapping,
  validateProductOrderPayableForNewebpay,
  type ProductOrderForPayment,
  type ProductOrderPaymentMapping,
} from '../../../../../lib/payments/productOrderPayment'
import type { CreatePendingPaymentInput } from '../../../../../lib/supabase/payments'
import type { NewebPayConfig } from '../../../../../lib/newebpay/types'
import type { DivinationReadingPaymentContext } from '../../../../../lib/supabase/divinationReadings'

export type CreateNewebPayPaymentRequest = {
  itemKey?: unknown
  source?: unknown
  paymentMode?: unknown
  bookingId?: unknown
  readingId?: unknown
  reportId?: unknown
  orderId?: unknown
}

type CreatePendingPaymentDependency = (input: CreatePendingPaymentInput) => Promise<{ id: string }>
type GetNewebPayConfigDependency = () => NewebPayConfig
type GetBookingPaymentContextDependency = (bookingId: string) => Promise<NewebPayBookingPaymentContext | null>
type GetDivinationReadingPaymentContextDependency = (
  readingId: string,
) => Promise<DivinationReadingPaymentContext | null>
type ValidateDivinationReadingPaymentDependency = (
  reading: DivinationReadingPaymentContext | null,
) => { ok: true } | { ok: false; error: string }
type GetAiChartReportPaymentContextDependency = (
  reportId: string,
) => Promise<NewebPayAiChartReportPaymentContext | null>
type GetProductOrderForPaymentDependency = (orderId: string) => Promise<ProductOrderForPayment | null>
type LinkDivinationReadingPendingPaymentDependency = (input: {
  readingId: string
  paymentId: string
  merchantOrderNo: string
}) => Promise<{ result: 'linked' | 'already_linked' | 'not_found' | 'not_payable' }>
type LinkAiChartReportPendingPaymentDependency = (input: {
  reportId: string
  paymentId: string
  merchantOrderNo: string
}) => Promise<{ result: 'linked' | 'already_linked' | 'not_found' | 'not_payable' }>
type LinkProductOrderPaymentDependency = (input: { orderId: string; paymentId: string }) => Promise<unknown>

type CreateNewebPayPaymentDependencies = {
  getNewebPayConfig?: GetNewebPayConfigDependency
  createNewebPayMpgPaymentData?: typeof createNewebPayMpgPaymentData
  buildNewebPayPendingPaymentMetadata?: typeof buildNewebPayPendingPaymentMetadata
  getSupabaseBookingPaymentContext?: GetBookingPaymentContextDependency
  getDivinationReadingPaymentContext?: GetDivinationReadingPaymentContextDependency
  validateDivinationReadingPayment?: ValidateDivinationReadingPaymentDependency
  getAiChartReportPaymentContext?: GetAiChartReportPaymentContextDependency
  getProductOrderForPayment?: GetProductOrderForPaymentDependency
  createPendingPayment?: CreatePendingPaymentDependency
  linkDivinationReadingPendingPayment?: LinkDivinationReadingPendingPaymentDependency
  linkAiChartReportPendingPayment?: LinkAiChartReportPendingPaymentDependency
  linkProductOrderPayment?: LinkProductOrderPaymentDependency
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

function productOrderPendingPaymentErrorResponse(input: { orderId: string; merchantOrderNo: string; error: unknown }) {
  console.error('建立商品訂單 pending payment 失敗', {
    orderId: input.orderId,
    merchantOrderNo: input.merchantOrderNo,
    error: 'product_order_payment_create_failed',
  })

  return NextResponse.json({ ok: false, error: 'product_order_payment_create_failed' }, { status: 500 })
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

function productOrderLookupErrorResponse(input: { orderId: string; error: unknown }) {
  console.error('藍新付款 product order 查詢失敗', {
    orderId: input.orderId,
    error: input.error instanceof Error ? input.error.message : 'unknown_error',
  })

  return NextResponse.json({ ok: false, error: 'product_order_lookup_failed' }, { status: 500 })
}

function productOrderValidationErrorResponse(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ ok: false, error: 'product_order_not_payable' }, { status: 409 })
  }

  if (error.message === 'product_order_not_found') {
    return NextResponse.json({ ok: false, error: 'product_order_not_found' }, { status: 404 })
  }

  if (error.message === 'invalid_product_order_payment_input') {
    return NextResponse.json({ ok: false, error: 'invalid_product_order_payment_input' }, { status: 400 })
  }

  return NextResponse.json({ ok: false, error: 'product_order_not_payable' }, { status: 409 })
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

function productOrderPaymentLinkErrorResponse(input: {
  orderId: string
  paymentId: string
  merchantOrderNo: string
  error: unknown
}) {
  console.error('藍新商品訂單 payment link 失敗', {
    orderId: input.orderId,
    paymentId: input.paymentId,
    merchantOrderNo: input.merchantOrderNo,
    error: 'product_order_payment_link_failed',
  })

  return NextResponse.json({ ok: false, error: 'product_order_payment_link_failed' }, { status: 500 })
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

export async function handleCreateNewebPayPaymentRequest(
  body: CreateNewebPayPaymentRequest | null,
  deps: CreateNewebPayPaymentDependencies = {},
): Promise<Response> {
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
  const orderIdResolution = resolveNewebPayProductOrderIdForPayment({
    itemKey: item.itemKey,
    orderId: body?.orderId,
  })

  if (!orderIdResolution.ok) {
    return NextResponse.json({ ok: false, error: orderIdResolution.error }, { status: 400 })
  }

  const orderId = orderIdResolution.orderId
  let productOrderPayment: ProductOrderPaymentMapping | null = null

  if (bookingId) {
    let booking

    try {
      const getBookingPaymentContext =
        deps.getSupabaseBookingPaymentContext ??
        (await import('../../../../../lib/supabase/bookings')).getSupabaseBookingPaymentContext
      booking = await getBookingPaymentContext(bookingId)
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
      const getReadingPaymentContext =
        deps.getDivinationReadingPaymentContext ??
        (await import('../../../../../lib/supabase/divinationReadings')).getDivinationReadingPaymentContext
      reading = await getReadingPaymentContext(readingId)
    } catch (error) {
      return divinationReadingLookupErrorResponse({ readingId, error })
    }

    const validateReadingPayment =
      deps.validateDivinationReadingPayment ??
      (await import('../../../../../lib/supabase/divinationReadings')).validateDivinationReadingPayment
    const readingValidation = validateReadingPayment(reading)

    if (!readingValidation.ok) {
      return NextResponse.json({ ok: false, error: readingValidation.error }, { status: 400 })
    }
  }

  if (reportId) {
    let report

    try {
      const getAiChartPaymentContext =
        deps.getAiChartReportPaymentContext ??
        (await import('../../../../../lib/supabase/aiChartReports')).getAiChartReportPaymentContext
      report = await getAiChartPaymentContext(reportId)
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

  if (orderId) {
    let order

    try {
      const getProductOrder =
        deps.getProductOrderForPayment ??
        (await import('../../../../../lib/supabase/productOrders')).getProductOrderForPayment
      order = await getProductOrder(orderId)
    } catch (error) {
      return productOrderLookupErrorResponse({ orderId, error })
    }

    try {
      validateProductOrderPayableForNewebpay(order)
      if (!order) {
        throw new Error('product_order_not_found')
      }
      productOrderPayment = buildProductOrderPaymentMapping(order)
    } catch (error) {
      return productOrderValidationErrorResponse(error)
    }
  }

  try {
    const getConfig =
      deps.getNewebPayConfig ?? (await import('../../../../../lib/newebpay/config')).getNewebPayConfig
    const config = getConfig()
    const paymentData = (deps.createNewebPayMpgPaymentData ?? createNewebPayMpgPaymentData)({
      itemKey: item.itemKey,
      config,
      paymentMode,
      amount: productOrderPayment?.amountTwd,
      itemDesc: productOrderPayment?.itemDesc,
    })
    const pendingPaymentMetadata = (deps.buildNewebPayPendingPaymentMetadata ?? buildNewebPayPendingPaymentMetadata)({
      itemKey: item.itemKey,
      source,
      paymentMode,
      merchantOrderNo: paymentData.merchantOrderNo,
      bookingId,
      readingId,
      reportId,
      productOrderPayment,
    })
    const itemName = productOrderPayment?.itemDesc ?? item.itemDesc
    const amountTwd = productOrderPayment?.amountTwd ?? item.amount
    let pendingPayment: { id: string }

    try {
      const createPayment =
        deps.createPendingPayment ?? (await import('../../../../../lib/supabase/payments')).createPendingPayment
      pendingPayment = await createPayment({
        provider: 'newebpay',
        itemType: pendingPaymentMetadata.itemType,
        itemId: pendingPaymentMetadata.itemId,
        itemName,
        bookingId: pendingPaymentMetadata.bookingId,
        merchantOrderNo: paymentData.merchantOrderNo,
        amountTwd,
        rawPayload: pendingPaymentMetadata.rawPayload,
      })
    } catch (error) {
      if (orderId) {
        return productOrderPendingPaymentErrorResponse({
          orderId,
          merchantOrderNo: paymentData.merchantOrderNo,
          error,
        })
      }

      return pendingPaymentErrorResponse({
        merchantOrderNo: paymentData.merchantOrderNo,
        itemKey: item.itemKey,
        error,
      })
    }

    if (readingId) {
      try {
        const linkDivinationPayment =
          deps.linkDivinationReadingPendingPayment ??
          (await import('../../../../../lib/supabase/divinationReadings')).linkDivinationReadingPendingPayment
        const linkResult = await linkDivinationPayment({
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
        const linkAiChartPayment =
          deps.linkAiChartReportPendingPayment ??
          (await import('../../../../../lib/supabase/aiChartReports')).linkAiChartReportPendingPayment
        const linkResult = await linkAiChartPayment({
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

    if (orderId) {
      try {
        const linkProductPayment =
          deps.linkProductOrderPayment ??
          (await import('../../../../../lib/supabase/productOrders')).linkProductOrderPayment
        await linkProductPayment({
          orderId,
          paymentId: pendingPayment.id,
        })
      } catch (error) {
        return productOrderPaymentLinkErrorResponse({
          orderId,
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
