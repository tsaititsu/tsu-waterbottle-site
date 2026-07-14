import { NextResponse } from 'next/server'
import { ziweiCards } from '../../../../../lib/divination/cards'
import {
  buildNewebPayApplePayTestContext,
  buildNewebPayApplePayTestPendingPaymentMetadata,
  isNewebPayApplePayTestModeEnabled,
  NEWEBPAY_APPLE_PAY_TEST_ITEM_KEY,
  NEWEBPAY_APPLE_PAY_TEST_MODE,
  NEWEBPAY_APPLE_PAY_TEST_SOURCE,
  type NewebPayApplePayTestContext,
} from '../../../../../lib/newebpay/applePayTestPayment'
import {
  buildNewebPayPendingPaymentMetadata,
  createNewebPayMpgPaymentData,
  isNewebPayPaymentMode,
  isNewebPayPaymentSource,
  PRODUCT_ORDER_APPLE_PAY_PAYMENT_MODE,
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
  PRODUCT_ORDER_PAYMENT_ITEM_KEY,
  PRODUCT_ORDER_PAYMENT_SOURCE,
  validateProductOrderPayableForNewebpay,
  type ProductOrderForPayment,
  type ProductOrderPaymentMapping,
} from '../../../../../lib/payments/productOrderPayment'
import type { CreatePendingPaymentInput } from '../../../../../lib/supabase/payments'
import type { NewebPayConfig } from '../../../../../lib/newebpay/types'
import type { DivinationReadingPaymentContext } from '../../../../../lib/supabase/divinationReadings'
import {
  AI_DIVINATION_ITEM_KEY,
  AI_DIVINATION_ITEM_TYPE,
} from '../../../../../lib/newebpay/divinationPayment'
import {
  buildDivinationOneDollarTestContext,
  resolveDivinationOneDollarTestAccess,
  type DivinationOneDollarTestUser,
} from '../../../../../lib/newebpay/divinationOneDollarTest'
import type { NewebPayOneDollarTestContext } from '../../../../../lib/newebpay/oneDollarTestMode'
import { generateNewebPayMerchantOrderNo } from '../../../../../lib/newebpay/orderNo'
import {
  classifyPaymentRepositoryError,
  type ExistingPaymentTarget,
} from '../../../../../lib/supabase/payments'

export type CreateNewebPayPaymentRequest = {
  itemKey?: unknown
  source?: unknown
  paymentMode?: unknown
  bookingId?: unknown
  readingId?: unknown
  reportId?: unknown
  orderId?: unknown
  divinationOneDollarTest?: unknown
  cardId?: unknown
  position?: unknown
}

type CreatePendingPaymentDependency = (input: CreatePendingPaymentInput) => Promise<{ id: string }>
type GetExistingPaymentByItemTargetDependency = (input: {
  provider: 'newebpay'
  itemType: string
  itemId: string
}) => Promise<ExistingPaymentTarget | null>
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
type AuthorizeAiChartReportPaymentDependency = (
  reportId: string,
) => Promise<{ ok: true; userId: string } | { ok: false; reason: 'unauthorized' | 'not_found' }>
type GetProductOrderForPaymentDependency = (orderId: string) => Promise<ProductOrderForPayment | null>
type LinkDivinationReadingPendingPaymentDependency = (input: {
  readingId: string
  paymentId: string
  merchantOrderNo: string
}) => Promise<{ result: 'linked' | 'already_linked' | 'not_found' | 'not_payable' }>
type UpdateDivinationReadingDrawSelectionDependency = (input: {
  readingId: string
  cardId: string
  cardName: string
  position: string
}) => Promise<{ result: 'updated' | 'not_found' | 'not_payable'; readingId: string }>
type LinkAiChartReportPendingPaymentDependency = (input: {
  reportId: string
  paymentId: string
  merchantOrderNo: string
}) => Promise<{ result: 'linked' | 'already_linked' | 'not_found' | 'not_payable' }>
type LinkProductOrderPaymentDependency = (input: { orderId: string; paymentId: string }) => Promise<unknown>

type GetRequesterWithEmailDependency = () => Promise<DivinationOneDollarTestUser | null>

const divinationPositions = new Set(['upright', 'reversed'])

type CreateNewebPayPaymentDependencies = {
  env?: Record<string, string | undefined>
  getRequesterWithEmail?: GetRequesterWithEmailDependency
  getNewebPayConfig?: GetNewebPayConfigDependency
  createNewebPayMpgPaymentData?: typeof createNewebPayMpgPaymentData
  buildNewebPayPendingPaymentMetadata?: typeof buildNewebPayPendingPaymentMetadata
  getSupabaseBookingPaymentContext?: GetBookingPaymentContextDependency
  getDivinationReadingPaymentContext?: GetDivinationReadingPaymentContextDependency
  validateDivinationReadingPayment?: ValidateDivinationReadingPaymentDependency
  getAiChartReportPaymentContext?: GetAiChartReportPaymentContextDependency
  authorizeAiChartReportPayment?: AuthorizeAiChartReportPaymentDependency
  getProductOrderForPayment?: GetProductOrderForPaymentDependency
  createPendingPayment?: CreatePendingPaymentDependency
  getExistingPaymentByItemTarget?: GetExistingPaymentByItemTargetDependency
  generateMerchantOrderNo?: typeof generateNewebPayMerchantOrderNo
  linkDivinationReadingPendingPayment?: LinkDivinationReadingPendingPaymentDependency
  updateDivinationReadingDrawSelection?: UpdateDivinationReadingDrawSelectionDependency
  linkAiChartReportPendingPayment?: LinkAiChartReportPendingPaymentDependency
  linkProductOrderPayment?: LinkProductOrderPaymentDependency
}

type PaymentFailureStage = 'payment_metadata' | 'payment_insert' | 'reading_link' | 'form_build'

function logSafePaymentFailure(input: {
  stage: PaymentFailureStage
  errorCode: string
  sourceType: string
  testMode: boolean
  amount: number
  status: number
  databaseErrorCategory?: string
}) {
  console.error('NewebPay payment stage failed', {
    stage: input.stage,
    errorCode: input.errorCode,
    provider: 'newebpay',
    sourceType: input.sourceType,
    testMode: input.testMode,
    amount: input.amount,
    status: input.status,
    ...(input.databaseErrorCategory ? { databaseErrorCategory: input.databaseErrorCategory } : {}),
  })
}

function paymentConfigErrorResponse() {
  return NextResponse.json(
    { ok: false, error: '藍新金流設定尚未完整，請確認必要環境變數。' },
    { status: 500 },
  )
}

function pendingPaymentErrorResponse(input: {
  merchantOrderNo: string
  itemKey: string
  itemType: string
  testMode: boolean
  amount: number
  error: unknown
}) {
  if (input.itemKey === AI_DIVINATION_ITEM_KEY) {
    const category = classifyPaymentRepositoryError(input.error)
    const isDuplicate = category === 'duplicate'
    const errorCode = isDuplicate ? 'payment_duplicate_conflict' : 'payment_insert_failed'
    const status = isDuplicate ? 409 : 500

    logSafePaymentFailure({
      stage: 'payment_insert',
      errorCode,
      sourceType: input.itemType,
      testMode: input.testMode,
      amount: input.amount,
      status,
      databaseErrorCategory: category,
    })

    return NextResponse.json({ ok: false, error: errorCode }, { status })
  }

  console.error('建立藍新 pending payment 失敗', {
    itemKey: input.itemKey,
    error: 'payment_insert_failed',
  })

  return NextResponse.json({ ok: false, error: '建立付款紀錄失敗，請稍後再試。' }, { status: 500 })
}

function divinationPaymentMetadataErrorResponse(input: { testMode: boolean; amount: number }) {
  logSafePaymentFailure({
    stage: 'payment_metadata',
    errorCode: 'payment_metadata_invalid',
    sourceType: AI_DIVINATION_ITEM_TYPE,
    testMode: input.testMode,
    amount: input.amount,
    status: 400,
  })

  return NextResponse.json({ ok: false, error: 'payment_metadata_invalid' }, { status: 400 })
}

function divinationPaymentDuplicateResponse(input: { testMode: boolean; amount: number }) {
  logSafePaymentFailure({
    stage: 'payment_insert',
    errorCode: 'payment_duplicate_conflict',
    sourceType: AI_DIVINATION_ITEM_TYPE,
    testMode: input.testMode,
    amount: input.amount,
    status: 409,
  })

  return NextResponse.json({ ok: false, error: 'payment_duplicate_conflict' }, { status: 409 })
}

function divinationPaymentFormErrorResponse(input: { testMode: boolean; amount: number }) {
  logSafePaymentFailure({
    stage: 'form_build',
    errorCode: 'payment_form_create_failed',
    sourceType: AI_DIVINATION_ITEM_TYPE,
    testMode: input.testMode,
    amount: input.amount,
    status: 500,
  })

  return NextResponse.json({ ok: false, error: 'payment_form_create_failed' }, { status: 500 })
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
  logSafePaymentFailure({
    stage: 'payment_metadata',
    errorCode: 'divination_reading_lookup_failed',
    sourceType: AI_DIVINATION_ITEM_TYPE,
    testMode: false,
    amount: 0,
    status: 500,
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

function applePayTestDisabledResponse() {
  return NextResponse.json({ ok: false, error: 'apple_pay_test_disabled' }, { status: 403 })
}

function applePayTestInvalidRequestResponse() {
  return NextResponse.json({ ok: false, error: 'invalid_apple_pay_test_request' }, { status: 400 })
}

function productOrderApplePayInvalidRequestResponse() {
  return NextResponse.json({ ok: false, error: 'invalid_product_order_apple_pay_request' }, { status: 400 })
}

function invalidDivinationDrawSelectionResponse() {
  return NextResponse.json({ ok: false, error: 'invalid_divination_draw_selection' }, { status: 400 })
}

function missingDivinationDrawSelectionResponse() {
  return NextResponse.json({ ok: false, error: 'reading_card_data_missing' }, { status: 400 })
}

function divinationDrawSelectionUpdateErrorResponse(input: { readingId: string; error: unknown }) {
  logSafePaymentFailure({
    stage: 'payment_metadata',
    errorCode: 'divination_draw_selection_update_failed',
    sourceType: AI_DIVINATION_ITEM_TYPE,
    testMode: false,
    amount: 0,
    status: 500,
  })

  return NextResponse.json({ ok: false, error: 'divination_draw_selection_update_failed' }, { status: 500 })
}

function divinationPaymentLinkErrorResponse(input: {
  readingId: string
  paymentId: string
  merchantOrderNo: string
  error: unknown
  testMode: boolean
  amount: number
}) {
  logSafePaymentFailure({
    stage: 'reading_link',
    errorCode: 'payment_reading_link_failed',
    sourceType: AI_DIVINATION_ITEM_TYPE,
    testMode: input.testMode,
    amount: input.amount,
    status: 500,
  })

  return NextResponse.json({ ok: false, error: 'payment_reading_link_failed' }, { status: 500 })
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
  testMode: boolean
  amount: number
}) {
  const resolution = resolveNewebPayDivinationPendingPaymentLink(input.result)
  const duplicate = !resolution.ok && resolution.error === 'divination_reading_already_linked'
  const error = duplicate ? 'payment_duplicate_conflict' : 'payment_reading_link_failed'
  const status = duplicate ? 409 : 500

  logSafePaymentFailure({
    stage: 'reading_link',
    errorCode: error,
    sourceType: AI_DIVINATION_ITEM_TYPE,
    testMode: input.testMode,
    amount: input.amount,
    status,
  })

  return NextResponse.json({ ok: false, error }, { status })
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
  let applePayTestContext: NewebPayApplePayTestContext | null = null

  if (
    paymentMode === PRODUCT_ORDER_APPLE_PAY_PAYMENT_MODE &&
    (item.itemKey !== PRODUCT_ORDER_PAYMENT_ITEM_KEY ||
      source !== PRODUCT_ORDER_PAYMENT_SOURCE ||
      body?.orderId === undefined ||
      body?.bookingId !== undefined ||
      body?.readingId !== undefined ||
      body?.reportId !== undefined)
  ) {
    return productOrderApplePayInvalidRequestResponse()
  }

  if (paymentMode === NEWEBPAY_APPLE_PAY_TEST_MODE) {
    const env = deps.env ?? process.env

    if (
      item.itemKey !== NEWEBPAY_APPLE_PAY_TEST_ITEM_KEY ||
      source !== NEWEBPAY_APPLE_PAY_TEST_SOURCE ||
      body?.bookingId !== undefined ||
      body?.readingId !== undefined ||
      body?.reportId !== undefined ||
      body?.orderId !== undefined
    ) {
      return applePayTestInvalidRequestResponse()
    }

    if (!isNewebPayApplePayTestModeEnabled(env)) {
      return applePayTestDisabledResponse()
    }

    try {
      applePayTestContext = buildNewebPayApplePayTestContext(env)
    } catch {
      return applePayTestDisabledResponse()
    }
  }

  // --- 紫微占卜管理員限定 NT$1 實刷測試模式（22J-45）---
  // server 端重新驗證：登入 + ADMIN_EMAILS + 雙 flag（含 production confirmation）。
  // 任一不符即拒絕，不會退回 NT$50 靜默執行，避免管理員誤以為在測試。
  let divinationOneDollarTestContext: NewebPayOneDollarTestContext | null = null
  let divinationOneDollarTestRequester: DivinationOneDollarTestUser | null = null

  if (body?.divinationOneDollarTest !== undefined) {
    if (
      body.divinationOneDollarTest !== true ||
      item.itemKey !== AI_DIVINATION_ITEM_KEY ||
      source !== AI_DIVINATION_ITEM_TYPE ||
      paymentMode !== 'credit' ||
      body?.readingId === undefined ||
      body?.bookingId !== undefined ||
      body?.reportId !== undefined ||
      body?.orderId !== undefined
    ) {
      return NextResponse.json(
        { ok: false, error: 'divination_one_dollar_test_invalid_request' },
        { status: 400 },
      )
    }

    const env = deps.env ?? process.env

    let requester: DivinationOneDollarTestUser | null = null
    try {
      requester = deps.getRequesterWithEmail ? await deps.getRequesterWithEmail() : null
    } catch {
      requester = null
    }

    const access = resolveDivinationOneDollarTestAccess({ env, user: requester })

    if (!access.allowed) {
      const errorByReason = {
        unauthenticated: 'unauthorized',
        not_admin: 'admin_required',
        test_mode_disabled: 'test_mode_disabled',
      } as const

      return NextResponse.json(
        { ok: false, error: errorByReason[access.reason] },
        { status: access.status },
      )
    }

    const testContext = buildDivinationOneDollarTestContext(env)

    if (!testContext.enabled) {
      return NextResponse.json(
        { ok: false, error: 'divination_one_dollar_test_disabled' },
        { status: 403 },
      )
    }

    divinationOneDollarTestContext = testContext
    divinationOneDollarTestRequester = requester
  }

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
  let divinationPaymentUserId: string | null = null
  let aiChartReportPaymentUserId: string | null = null

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
      if (readingValidation.error === 'payment_already_exists') {
        return divinationPaymentDuplicateResponse({
          testMode: Boolean(divinationOneDollarTestContext),
          amount: divinationOneDollarTestContext?.amount ?? item.amount,
        })
      }

      const status = readingValidation.error === 'divination_reading_not_found' ? 404 : 400
      return NextResponse.json({ ok: false, error: readingValidation.error }, { status })
    }

    if (
      divinationOneDollarTestContext &&
      (!divinationOneDollarTestRequester ||
        !reading?.userId ||
        reading.userId !== divinationOneDollarTestRequester.id)
    ) {
      return NextResponse.json({ ok: false, error: 'reading_not_owned' }, { status: 404 })
    }

    divinationPaymentUserId = reading?.userId ?? null

    const requestCardId = typeof body?.cardId === 'string' ? body.cardId.trim() : ''
    const requestPosition = typeof body?.position === 'string' ? body.position.trim() : ''
    const cardId = requestCardId || reading?.cardId?.trim() || ''
    const position = requestPosition || reading?.position?.trim() || ''
    const selectedCard = cardId ? ziweiCards.find((card) => card.id === cardId) : null

    if (!cardId || !position) {
      return missingDivinationDrawSelectionResponse()
    }

    if (!selectedCard || !divinationPositions.has(position)) {
      return invalidDivinationDrawSelectionResponse()
    }

    try {
      const updateDrawSelection =
        deps.updateDivinationReadingDrawSelection ??
        (await import('../../../../../lib/supabase/divinationReadings')).updateDivinationReadingDrawSelection
      const updateResult = await updateDrawSelection({
        readingId,
        cardId: selectedCard.id,
        cardName: selectedCard.name,
        position,
      })

      if (updateResult.result !== 'updated') {
        return divinationPaymentDuplicateResponse({
          testMode: Boolean(divinationOneDollarTestContext),
          amount: divinationOneDollarTestContext?.amount ?? item.amount,
        })
      }
    } catch (error) {
      return divinationDrawSelectionUpdateErrorResponse({ readingId, error })
    }
  }

  if (reportId) {
    let authorization: Awaited<ReturnType<AuthorizeAiChartReportPaymentDependency>>

    try {
      authorization = deps.authorizeAiChartReportPayment
        ? await deps.authorizeAiChartReportPayment(reportId)
        : { ok: false, reason: 'unauthorized' }
    } catch (error) {
      return aiChartReportLookupErrorResponse({ reportId, error })
    }

    if (!authorization.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: authorization.reason === 'unauthorized' ? 'unauthorized' : 'ai_chart_report_not_found',
        },
        { status: authorization.reason === 'unauthorized' ? 401 : 404 },
      )
    }

    aiChartReportPaymentUserId = authorization.userId

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
    // Client 仍傳既有 credit request shape；只有通過 server 管理員驗證的測試請求會在這裡改用 Apple Pay。
    const effectivePaymentMode = divinationOneDollarTestContext
      ? NEWEBPAY_APPLE_PAY_TEST_MODE
      : paymentMode
    const amountTwd =
      applePayTestContext?.amount ??
      divinationOneDollarTestContext?.amount ??
      productOrderPayment?.amountTwd ??
      item.amount
    const testMode = Boolean(divinationOneDollarTestContext)
    let paymentData: ReturnType<typeof createNewebPayMpgPaymentData> | null = null
    let merchantOrderNo: string

    if (readingId) {
      merchantOrderNo = (deps.generateMerchantOrderNo ?? generateNewebPayMerchantOrderNo)()
    } else {
      try {
        paymentData = (deps.createNewebPayMpgPaymentData ?? createNewebPayMpgPaymentData)({
          itemKey: item.itemKey,
          config,
          paymentMode: effectivePaymentMode,
          amount: applePayTestContext?.amount ?? productOrderPayment?.amountTwd,
          itemDesc: applePayTestContext?.itemDesc ?? productOrderPayment?.itemDesc,
        })
        merchantOrderNo = paymentData.merchantOrderNo
      } catch {
        return NextResponse.json({ ok: false, error: 'payment_form_create_failed' }, { status: 500 })
      }
    }

    let pendingPaymentMetadata

    try {
      pendingPaymentMetadata = applePayTestContext
        ? buildNewebPayApplePayTestPendingPaymentMetadata({
            context: applePayTestContext,
            merchantOrderNo,
          })
        : (deps.buildNewebPayPendingPaymentMetadata ?? buildNewebPayPendingPaymentMetadata)({
            itemKey: item.itemKey,
            source,
            paymentMode,
            merchantOrderNo,
            bookingId,
            readingId,
            reportId,
            productOrderPayment,
          })
    } catch {
      if (readingId) {
        return divinationPaymentMetadataErrorResponse({ testMode, amount: amountTwd })
      }
      return paymentConfigErrorResponse()
    }

    // NT$1 測試：payment 紀錄金額與 NewebPay Amt 一律同源（context.amount），
    // rawPayload 併入測試標記（test_payment / original_amount 等）。
    const pendingPaymentRawPayload = divinationOneDollarTestContext
      ? {
          ...pendingPaymentMetadata.rawPayload,
          paymentMode: effectivePaymentMode,
          amount: divinationOneDollarTestContext.amount,
          itemDesc: divinationOneDollarTestContext.itemDesc,
          ...divinationOneDollarTestContext.metadata,
        }
      : pendingPaymentMetadata.rawPayload
    // DB-facing item_name 沿用正式占卜名稱；測試標記只放 raw_payload，避免新增資料庫識別值。
    const itemName =
      applePayTestContext?.itemDesc ??
      productOrderPayment?.itemDesc ??
      item.itemDesc

    if (readingId && pendingPaymentMetadata.itemId) {
      try {
        const findExistingPayment =
          deps.getExistingPaymentByItemTarget ??
          (await import('../../../../../lib/supabase/payments')).getExistingPaymentByItemTarget
        const existingPayment = await findExistingPayment({
          provider: 'newebpay',
          itemType: pendingPaymentMetadata.itemType,
          itemId: pendingPaymentMetadata.itemId,
        })

        if (existingPayment) {
          return divinationPaymentDuplicateResponse({ testMode, amount: amountTwd })
        }
      } catch (error) {
        return pendingPaymentErrorResponse({
          merchantOrderNo,
          itemKey: item.itemKey,
          itemType: pendingPaymentMetadata.itemType,
          testMode,
          amount: amountTwd,
          error,
        })
      }
    }

    let pendingPayment: { id: string }

    try {
      const createPayment =
        deps.createPendingPayment ?? (await import('../../../../../lib/supabase/payments')).createPendingPayment
      pendingPayment = await createPayment({
        provider: 'newebpay',
        userId: aiChartReportPaymentUserId ?? divinationPaymentUserId,
        itemType: pendingPaymentMetadata.itemType,
        itemId: pendingPaymentMetadata.itemId,
        itemName,
        bookingId: pendingPaymentMetadata.bookingId,
        merchantOrderNo,
        amountTwd,
        rawPayload: pendingPaymentRawPayload,
      })
    } catch (error) {
      if (orderId) {
        return productOrderPendingPaymentErrorResponse({
          orderId,
          merchantOrderNo,
          error,
        })
      }

      return pendingPaymentErrorResponse({
        merchantOrderNo,
        itemKey: item.itemKey,
        itemType: pendingPaymentMetadata.itemType,
        testMode,
        amount: amountTwd,
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
          merchantOrderNo,
        })

        if (linkResult.result !== 'linked') {
          return divinationPaymentLinkResultResponse({
            readingId,
            paymentId: pendingPayment.id,
            merchantOrderNo,
            result: linkResult.result,
            testMode,
            amount: amountTwd,
          })
        }
      } catch (error) {
        return divinationPaymentLinkErrorResponse({
          readingId,
          paymentId: pendingPayment.id,
          merchantOrderNo,
          error,
          testMode,
          amount: amountTwd,
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
          merchantOrderNo,
        })

        if (linkResult.result !== 'linked') {
          return aiChartPaymentLinkResultResponse({
            reportId,
            paymentId: pendingPayment.id,
            merchantOrderNo,
            result: linkResult.result,
          })
        }
      } catch (error) {
        return aiChartPaymentLinkErrorResponse({
          reportId,
          paymentId: pendingPayment.id,
          merchantOrderNo,
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
          merchantOrderNo,
          error,
        })
      }
    }

    if (!paymentData) {
      try {
        paymentData = (deps.createNewebPayMpgPaymentData ?? createNewebPayMpgPaymentData)({
          itemKey: item.itemKey,
          config,
          paymentMode: effectivePaymentMode,
          amount: divinationOneDollarTestContext?.amount,
          itemDesc: divinationOneDollarTestContext?.itemDesc,
          merchantOrderNo,
        })
      } catch {
        return divinationPaymentFormErrorResponse({ testMode, amount: amountTwd })
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
