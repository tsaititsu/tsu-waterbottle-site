import { NextResponse } from 'next/server'
import {
  createLinePayNonce,
  getLinePayServerConfig,
  normalizeLinePayOrderId,
  resolveLinePayConfirmOutcome,
  validateLinePayTransactionId,
  type LinePayConfirmErrorInput,
  type LinePayConfirmOutcomeDecision,
  type LinePayPaymentDetailsResult,
  type LinePayPaymentRequestStatusResult,
  type LinePayServerEnv,
} from '../../../../../lib/linePay'

export type HandleProductOrderLinePayConfirmRedirectInput = {
  request: Request
  env: LinePayServerEnv
  paymentReader?: ProductOrderLinePayConfirmPaymentReader
  productOrderReader?: ProductOrderLinePayConfirmProductOrderReader
  linePayConfirmer?: ProductOrderLinePayConfirmer
  requestStatusChecker?: ProductOrderLinePayRequestStatusChecker
  paymentDetailsGetter?: ProductOrderLinePayPaymentDetailsGetter
  paymentMetadataUpdater?: ProductOrderLinePayPaymentMetadataUpdater
  paymentPaidMarker?: ProductOrderLinePayPaymentPaidMarker
  productOrderPaidSyncer?: ProductOrderLinePayProductOrderPaidSyncer
}

export type ProductOrderLinePayConfirmPaymentContext = {
  id: string
  provider: string | null
  status: string | null
  amount: number | null
  currency: string | null
  merchant_order_no: string | null
  raw_payload: Record<string, unknown> | null
}

export type ProductOrderLinePayConfirmPaymentReader = (input: {
  orderId: string
}) => Promise<ProductOrderLinePayConfirmPaymentContext | null>

export type ProductOrderLinePayConfirmProductOrderContext = {
  id: string
  status: string | null
  payment_status: string | null
  payment_id: string | null
  total_amount: number | null
  currency: string | null
}

export type ProductOrderLinePayConfirmProductOrderReader = (input: {
  productOrderId: string
}) => Promise<ProductOrderLinePayConfirmProductOrderContext | null>

export type ProductOrderLinePayConfirmerInput = {
  environment: string
  channelId: string
  channelSecret: string
  nonce: string
  transactionId: string
  payloadInput: {
    amount: number
    currency: 'TWD'
  }
}

export type ProductOrderLinePayConfirmResult = {
  returnCode?: string | null
  returnMessage?: string | null
  transactionId?: string | null
  orderId?: string | null
  amount?: number | null
  currency?: string | null
  payInfo?: unknown
  packages?: unknown
  info?: unknown
}

export type ProductOrderLinePayConfirmer = (
  input: ProductOrderLinePayConfirmerInput,
) => Promise<ProductOrderLinePayConfirmResult>

export type ProductOrderLinePayRequestStatusCheckerInput = {
  environment: string
  channelId: string
  channelSecret: string
  nonce: string
  transactionId: string
}

export type ProductOrderLinePayRequestStatusChecker = (
  input: ProductOrderLinePayRequestStatusCheckerInput,
) => Promise<LinePayPaymentRequestStatusResult>

export type ProductOrderLinePayPaymentDetailsGetterInput = {
  environment: string
  channelId: string
  channelSecret: string
  nonce: string
  transactionId: string
  orderId: string
}

export type ProductOrderLinePayPaymentDetailsGetter = (
  input: ProductOrderLinePayPaymentDetailsGetterInput,
) => Promise<LinePayPaymentDetailsResult>

export type ProductOrderLinePayPaymentMetadataUpdaterInput = {
  paymentId: string
  metadata: Record<string, unknown>
}

export type ProductOrderLinePayPaymentMetadataUpdater = (
  input: ProductOrderLinePayPaymentMetadataUpdaterInput,
) => Promise<unknown>

export type ProductOrderLinePayPaymentPaidMarkerInput = {
  paymentId: string
  provider: 'line_pay'
  transactionId: string
  orderId: string
  amount: number
  currency: 'TWD'
  metadata: Record<string, unknown>
}

export type ProductOrderLinePayPaymentPaidMarker = (
  input: ProductOrderLinePayPaymentPaidMarkerInput,
) => Promise<unknown>

export type ProductOrderLinePayProductOrderPaidSyncerInput = {
  productOrderId: string
  paymentId: string
  provider: 'line_pay'
  transactionId: string
  orderId: string
}

export type ProductOrderLinePayProductOrderPaidSyncer = (
  input: ProductOrderLinePayProductOrderPaidSyncerInput,
) => Promise<unknown>

function createErrorResponse(error: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      error,
    },
    { status },
  )
}

function getRequiredQueryParam(url: URL, name: string, missingError: string) {
  const value = url.searchParams.get(name)?.trim()

  if (!value) {
    throw new Error(missingError)
  }

  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPositiveInteger(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function getLinePayRawPayload(payment: ProductOrderLinePayConfirmPaymentContext) {
  const payload = payment.raw_payload

  if (!isRecord(payload) || !isRecord(payload.linePay)) {
    return null
  }

  const linePay = payload.linePay

  return {
    orderId: typeof linePay.orderId === 'string' ? linePay.orderId.trim() : '',
    transactionId: typeof linePay.transactionId === 'string' ? linePay.transactionId.trim() : '',
    sourceType: typeof linePay.sourceType === 'string' ? linePay.sourceType.trim() : '',
    sourceId: typeof linePay.sourceId === 'string' ? linePay.sourceId.trim() : '',
  }
}

function getString(value: unknown) {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  return null
}

function getConfirmErrorCode(error: unknown) {
  if (!error) return null
  if (typeof error === 'string') return error.trim()
  if (error instanceof Error) return error.message.toLowerCase().includes('timeout') ? 'timeout' : null
  if (isRecord(error)) return getString(error.code)?.trim() ?? null
  return null
}

function getConfirmErrorMessage(error: unknown) {
  if (!error) return null
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (isRecord(error)) return getString(error.message)
  return null
}

function normalizeConfirmErrorForOutcome(error: unknown): LinePayConfirmErrorInput | Error | string {
  if (error instanceof Error || typeof error === 'string') {
    return error
  }

  if (isRecord(error)) {
    return {
      ...(getString(error.code) ? { code: getString(error.code) } : {}),
      ...(getString(error.message) ? { message: getString(error.message) } : {}),
    }
  }

  return String(error)
}

function isRecoverableConfirmError(error: unknown) {
  const code = getConfirmErrorCode(error)
  const message = getConfirmErrorMessage(error)?.toLowerCase() ?? ''

  return code === '1172' || code === '1198' || code === 'timeout' || message.includes('timeout')
}

function sanitizeMetadataValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeMetadataValue)
  }

  if (!isRecord(value)) {
    return value
  }

  return Object.entries(value).reduce<Record<string, unknown>>((result, [key, entry]) => {
    if (/channelSecret|channelId|TradeInfo|TradeSha|HashKey|HashIV|signature|headers|phone|email|address/i.test(key)) {
      return result
    }

    result[key] = sanitizeMetadataValue(entry)
    return result
  }, {})
}

function buildConfirmMetadata(confirmResult: ProductOrderLinePayConfirmResult | null, confirmError: unknown) {
  if (confirmResult) {
    return {
      ...(confirmResult.returnCode ? { returnCode: confirmResult.returnCode } : {}),
      ...(confirmResult.returnMessage ? { returnMessage: confirmResult.returnMessage } : {}),
      ...(confirmResult.orderId ? { orderId: confirmResult.orderId } : {}),
      ...(confirmResult.transactionId ? { transactionId: confirmResult.transactionId } : {}),
      ...(confirmResult.payInfo !== undefined ? { payInfo: sanitizeMetadataValue(confirmResult.payInfo) } : {}),
    }
  }

  const returnCode = getConfirmErrorCode(confirmError)
  const returnMessage = getConfirmErrorMessage(confirmError)

  if (!returnCode && !returnMessage) {
    return null
  }

  return {
    ...(returnCode ? { returnCode } : {}),
    ...(returnMessage ? { returnMessage } : {}),
  }
}

function buildLinePayMetadata(input: {
  existingMetadata: Record<string, unknown> | null
  orderId: string
  productOrderId: string
  transactionId: string
  confirmResult: ProductOrderLinePayConfirmResult | null
  confirmError: unknown
  requestStatusResult: LinePayPaymentRequestStatusResult | null
  paymentDetailsResult: LinePayPaymentDetailsResult | null
  outcome: LinePayConfirmOutcomeDecision
}) {
  const existing = isRecord(input.existingMetadata) ? input.existingMetadata : {}
  const existingLinePay = isRecord(existing.linePay) ? existing.linePay : {}
  const confirm = buildConfirmMetadata(input.confirmResult, input.confirmError)

  return {
    ...existing,
    linePay: {
      ...existingLinePay,
      orderId: input.orderId,
      sourceType: 'product_order',
      sourceId: input.productOrderId,
      transactionId: input.transactionId,
      ...(confirm ? { confirm } : {}),
      ...(input.requestStatusResult
        ? {
            statusCheck: {
              returnCode: input.requestStatusResult.returnCode,
              ...(input.requestStatusResult.returnMessage
                ? { returnMessage: input.requestStatusResult.returnMessage }
                : {}),
              status: input.requestStatusResult.status,
            },
          }
        : {}),
      ...(input.paymentDetailsResult
        ? {
            paymentDetails: {
              returnCode: input.paymentDetailsResult.returnCode,
              ...(input.paymentDetailsResult.returnMessage
                ? { returnMessage: input.paymentDetailsResult.returnMessage }
                : {}),
              matched: input.outcome.outcome === 'payment_completed',
            },
          }
        : {}),
      outcome: input.outcome,
    },
  }
}

function buildPaidMetadata(input: {
  metadata: Record<string, unknown>
  orderId: string
  transactionId: string
  markedAt?: string
}) {
  const linePay = isRecord(input.metadata.linePay) ? input.metadata.linePay : {}
  const markedAt = input.markedAt ?? new Date().toISOString()

  return {
    ...input.metadata,
    linePay: {
      ...linePay,
      paid: {
        markedAt,
        provider: 'line_pay',
        transactionId: input.transactionId,
        orderId: input.orderId,
      },
    },
  }
}

function validateSafeToMarkPaid(input: {
  payment: ProductOrderLinePayConfirmPaymentContext
  order: ProductOrderLinePayConfirmProductOrderContext
  linePay: ReturnType<typeof getLinePayRawPayload>
  orderId: string
  transactionId: string
  outcome: LinePayConfirmOutcomeDecision
}) {
  if (
    !input.outcome.shouldMarkPaid ||
    (input.outcome.outcome !== 'confirmed_paid' && input.outcome.outcome !== 'payment_completed')
  ) {
    return {
      ok: false as const,
      error: 'line_pay_confirm_not_safe_to_mark_paid',
    }
  }

  if (input.payment.provider !== 'line_pay' || input.payment.status !== 'pending') {
    return {
      ok: false as const,
      error: 'line_pay_confirm_paid_provider_mismatch',
    }
  }

  if (input.payment.amount !== input.order.total_amount) {
    return {
      ok: false as const,
      error: 'line_pay_confirm_paid_amount_mismatch',
    }
  }

  if (input.payment.currency !== 'TWD' || input.order.currency !== 'TWD') {
    return {
      ok: false as const,
      error: 'line_pay_confirm_paid_currency_mismatch',
    }
  }

  if (input.order.payment_id !== input.payment.id || input.order.payment_status === 'paid') {
    return {
      ok: false as const,
      error: 'line_pay_confirm_not_safe_to_mark_paid',
    }
  }

  if (!input.linePay || input.linePay.transactionId !== input.transactionId) {
    return {
      ok: false as const,
      error: 'line_pay_confirm_paid_transaction_id_mismatch',
    }
  }

  if (input.payment.merchant_order_no !== input.orderId || input.linePay.orderId !== input.orderId) {
    return {
      ok: false as const,
      error: 'line_pay_confirm_paid_order_id_mismatch',
    }
  }

  return {
    ok: true as const,
  }
}

function isSuccessfulProductOrderPaidSyncResult(value: unknown) {
  if (!isRecord(value) || typeof value.result !== 'string') {
    return true
  }

  return value.result === 'synced' || value.result === 'already_paid'
}

function validatePaymentPreflight(
  payment: ProductOrderLinePayConfirmPaymentContext | null,
  orderId: string,
  transactionId: string,
) {
  if (!payment) {
    return {
      error: 'line_pay_payment_not_found',
      status: 404,
    }
  }

  if (payment.provider !== 'line_pay') {
    return {
      error: 'line_pay_payment_provider_mismatch',
      status: 409,
    }
  }

  if (payment.status !== 'pending') {
    return {
      error: 'line_pay_payment_not_pending',
      status: 409,
    }
  }

  if (payment.merchant_order_no !== orderId) {
    return {
      error: 'line_pay_payment_order_id_mismatch',
      status: 409,
    }
  }

  const linePay = getLinePayRawPayload(payment)

  if (!linePay || linePay.orderId !== orderId) {
    return {
      error: 'line_pay_payment_order_id_mismatch',
      status: 409,
    }
  }

  if (linePay.transactionId !== transactionId) {
    return {
      error: 'line_pay_payment_transaction_id_mismatch',
      status: 409,
    }
  }

  if (linePay.sourceType !== 'product_order') {
    return {
      error: 'line_pay_payment_source_type_mismatch',
      status: 409,
    }
  }

  if (!linePay.sourceId) {
    return {
      error: 'line_pay_payment_source_id_missing',
      status: 409,
    }
  }

  if (!isPositiveInteger(payment.amount)) {
    return {
      error: 'invalid_line_pay_confirm_amount',
      status: 400,
    }
  }

  if (payment.currency !== 'TWD') {
    return {
      error: 'line_pay_payment_currency_mismatch',
      status: 409,
    }
  }

  return null
}

function validateProductOrderPreflight(
  order: ProductOrderLinePayConfirmProductOrderContext | null,
  payment: ProductOrderLinePayConfirmPaymentContext,
) {
  if (!order) {
    return {
      error: 'product_order_not_found',
      status: 404,
    }
  }

  if (order.payment_id !== payment.id) {
    return {
      error: 'line_pay_payment_product_order_mismatch',
      status: 409,
    }
  }

  if (order.payment_status === 'paid') {
    return {
      error: 'product_order_already_paid',
      status: 409,
    }
  }

  if (order.status !== 'pending_payment' || order.payment_status !== 'pending') {
    return {
      error: 'product_order_not_payable',
      status: 409,
    }
  }

  if (!isPositiveInteger(order.total_amount)) {
    return {
      error: 'invalid_line_pay_confirm_amount',
      status: 400,
    }
  }

  if (order.currency !== 'TWD') {
    return {
      error: 'invalid_line_pay_confirm_currency',
      status: 400,
    }
  }

  if (payment.amount !== order.total_amount) {
    return {
      error: 'line_pay_payment_amount_mismatch',
      status: 409,
    }
  }

  return null
}

export async function handleProductOrderLinePayConfirmRedirect({
  request,
  env,
  paymentReader,
  productOrderReader,
  linePayConfirmer,
  requestStatusChecker,
  paymentDetailsGetter,
  paymentMetadataUpdater,
  paymentPaidMarker,
  productOrderPaidSyncer,
}: HandleProductOrderLinePayConfirmRedirectInput): Promise<Response> {
  if (request.method !== 'GET') {
    return createErrorResponse('method_not_allowed', 405)
  }

  let config

  try {
    config = getLinePayServerConfig(env)
  } catch (error) {
    return createErrorResponse(error instanceof Error ? error.message : 'line_pay_config_invalid', 500)
  }

  if (!config.enabled) {
    return createErrorResponse('line_pay_disabled', 404)
  }

  const url = new URL(request.url)
  let orderId: string
  let transactionId: string

  try {
    orderId = normalizeLinePayOrderId(getRequiredQueryParam(url, 'orderId', 'missing_line_pay_order_id'))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid_line_pay_order_id'
    return createErrorResponse(
      message === 'missing_line_pay_order_id' ? 'missing_line_pay_order_id' : 'invalid_line_pay_order_id',
      400,
    )
  }

  try {
    transactionId = validateLinePayTransactionId(
      getRequiredQueryParam(url, 'transactionId', 'missing_line_pay_transaction_id'),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid_line_pay_transaction_id'
    return createErrorResponse(
      message === 'missing_line_pay_transaction_id'
        ? 'missing_line_pay_transaction_id'
        : 'invalid_line_pay_transaction_id',
      400,
    )
  }

  if (typeof paymentReader !== 'function') {
    return createErrorResponse('line_pay_confirm_payment_reader_missing', 500)
  }

  let payment: ProductOrderLinePayConfirmPaymentContext | null

  try {
    payment = await paymentReader({ orderId })
  } catch {
    return createErrorResponse('line_pay_payment_not_found', 404)
  }

  const paymentError = validatePaymentPreflight(payment, orderId, transactionId)

  if (paymentError) {
    return createErrorResponse(paymentError.error, paymentError.status)
  }

  const payablePayment = payment as ProductOrderLinePayConfirmPaymentContext & {
    amount: number
    currency: 'TWD'
  }
  const linePay = getLinePayRawPayload(payablePayment)
  const productOrderId = linePay?.sourceId ?? ''

  if (typeof productOrderReader !== 'function') {
    return createErrorResponse('line_pay_confirm_product_order_reader_missing', 500)
  }

  let productOrder: ProductOrderLinePayConfirmProductOrderContext | null

  try {
    productOrder = await productOrderReader({ productOrderId })
  } catch {
    return createErrorResponse('product_order_not_found', 404)
  }

  const productOrderError = validateProductOrderPreflight(productOrder, payablePayment)

  if (productOrderError) {
    return createErrorResponse(productOrderError.error, productOrderError.status)
  }

  if (typeof linePayConfirmer !== 'function') {
    return createErrorResponse('line_pay_confirmer_missing', 500)
  }

  if (typeof paymentMetadataUpdater !== 'function') {
    return createErrorResponse('line_pay_confirm_metadata_update_missing', 500)
  }

  const payableOrder = productOrder as ProductOrderLinePayConfirmProductOrderContext & {
    total_amount: number
    currency: 'TWD'
  }
  let confirmResult: ProductOrderLinePayConfirmResult | null = null
  let confirmError: LinePayConfirmErrorInput | Error | string | null = null
  let requestStatusResult: LinePayPaymentRequestStatusResult | null = null
  let paymentDetailsResult: LinePayPaymentDetailsResult | null = null
  const expected = {
    transactionId,
    orderId,
    amount: payableOrder.total_amount,
    currency: 'TWD',
  }

  try {
    confirmResult = await linePayConfirmer({
      environment: config.environment,
      channelId: config.channelId,
      channelSecret: config.channelSecret,
      nonce: createLinePayNonce(),
      transactionId,
      payloadInput: {
        amount: payableOrder.total_amount,
        currency: 'TWD',
      },
    })
  } catch (error) {
    confirmError = normalizeConfirmErrorForOutcome(error)

    if (!isRecoverableConfirmError(error)) {
      return createErrorResponse('line_pay_confirm_failed', 500)
    }
  }

  let outcome = resolveLinePayConfirmOutcome({
    confirmResult,
    confirmError,
    expected,
  })

  if (outcome.shouldQueryStatus) {
    if (typeof requestStatusChecker !== 'function') {
      return createErrorResponse('line_pay_request_status_check_failed', 500)
    }

    try {
      requestStatusResult = await requestStatusChecker({
        environment: config.environment,
        channelId: config.channelId,
        channelSecret: config.channelSecret,
        nonce: createLinePayNonce(),
        transactionId,
      })
    } catch {
      return createErrorResponse('line_pay_request_status_check_failed', 500)
    }
  }

  if (outcome.shouldQueryPaymentDetails) {
    if (typeof paymentDetailsGetter !== 'function') {
      return createErrorResponse('line_pay_payment_details_check_failed', 500)
    }

    try {
      paymentDetailsResult = await paymentDetailsGetter({
        environment: config.environment,
        channelId: config.channelId,
        channelSecret: config.channelSecret,
        nonce: createLinePayNonce(),
        transactionId,
        orderId,
      })
    } catch {
      return createErrorResponse('line_pay_payment_details_check_failed', 500)
    }
  }

  if (requestStatusResult || paymentDetailsResult) {
    outcome = resolveLinePayConfirmOutcome({
      requestStatusResult,
      paymentDetailsResult,
      expected,
    })
  }

  const metadata = buildLinePayMetadata({
    existingMetadata: payablePayment.raw_payload,
    orderId,
    productOrderId,
    transactionId,
    confirmResult,
    confirmError,
    requestStatusResult,
    paymentDetailsResult,
    outcome,
  })

  try {
    await paymentMetadataUpdater({
      paymentId: payablePayment.id,
      metadata,
    })
  } catch {
    return createErrorResponse('line_pay_confirm_metadata_update_failed', 500)
  }

  const verifiedPaid = outcome.shouldMarkPaid
  const paidSafety = validateSafeToMarkPaid({
    payment: payablePayment,
    order: payableOrder,
    linePay,
    orderId,
    transactionId,
    outcome,
  })

  if (!paidSafety.ok) {
    return NextResponse.json(
      {
        ok: false,
        provider: 'line_pay',
        error: paidSafety.error,
        confirmed: false,
        markedPaid: false,
        paymentId: payablePayment.id,
        productOrderId,
        orderId,
        transactionId,
        amount: payableOrder.total_amount,
        currency: 'TWD',
        outcome: outcome.outcome,
      },
      { status: 202 },
    )
  }

  if (typeof paymentPaidMarker !== 'function') {
    return createErrorResponse('line_pay_payment_paid_marker_missing', 500)
  }

  if (typeof productOrderPaidSyncer !== 'function') {
    return createErrorResponse('line_pay_product_order_paid_syncer_missing', 500)
  }

  const paidMetadata = buildPaidMetadata({
    metadata,
    orderId,
    transactionId,
  })

  try {
    await paymentPaidMarker({
      paymentId: payablePayment.id,
      provider: 'line_pay',
      transactionId,
      orderId,
      amount: payableOrder.total_amount,
      currency: 'TWD',
      metadata: paidMetadata,
    })
  } catch {
    return createErrorResponse('line_pay_payment_mark_paid_failed', 500)
  }

  try {
    const syncResult = await productOrderPaidSyncer({
      productOrderId,
      paymentId: payablePayment.id,
      provider: 'line_pay',
      transactionId,
      orderId,
    })

    if (!isSuccessfulProductOrderPaidSyncResult(syncResult)) {
      return createErrorResponse('line_pay_product_order_sync_paid_failed', 500)
    }
  } catch {
    return createErrorResponse('line_pay_product_order_sync_paid_failed', 500)
  }

  return NextResponse.json(
    {
      ok: true,
      provider: 'line_pay',
      confirmed: verifiedPaid,
      markedPaid: true,
      paymentId: payablePayment.id,
      productOrderId,
      orderId,
      transactionId,
      amount: payableOrder.total_amount,
      currency: 'TWD',
      outcome: outcome.outcome,
    },
    { status: 200 },
  )
}
