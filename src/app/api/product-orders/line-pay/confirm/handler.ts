import { NextResponse } from 'next/server'
import {
  getLinePayServerConfig,
  normalizeLinePayOrderId,
  validateLinePayTransactionId,
  type LinePayServerEnv,
} from '../../../../../lib/linePay'

export type HandleProductOrderLinePayConfirmRedirectInput = {
  request: Request
  env: LinePayServerEnv
  paymentReader?: ProductOrderLinePayConfirmPaymentReader
  productOrderReader?: ProductOrderLinePayConfirmProductOrderReader
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

  return NextResponse.json(
    {
      ok: false,
      error: 'line_pay_product_order_confirm_not_implemented',
      received: true,
      preflight: true,
      paymentId: payablePayment.id,
      productOrderId,
      orderId,
      transactionId,
      amount: payablePayment.amount,
      currency: payablePayment.currency,
    },
    { status: 501 },
  )
}
