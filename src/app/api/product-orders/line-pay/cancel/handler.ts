import { NextResponse } from 'next/server'
import {
  getLinePayServerConfig,
  normalizeLinePayOrderId,
  validateLinePayTransactionId,
  type LinePayServerEnv,
} from '../../../../../lib/linePay'

export type HandleProductOrderLinePayCancelRedirectInput = {
  request: Request
  env: LinePayServerEnv
  paymentReader?: ProductOrderLinePayCancelPaymentReader
  paymentMetadataUpdater?: ProductOrderLinePayCancelPaymentMetadataUpdater
  now?: string
}

export type ProductOrderLinePayCancelPaymentContext = {
  id: string
  provider: string | null
  status: string | null
  merchant_order_no: string | null
  raw_payload: Record<string, unknown> | null
}

export type ProductOrderLinePayCancelPaymentReader = (input: {
  orderId: string | null
  transactionId: string | null
}) => Promise<ProductOrderLinePayCancelPaymentContext | null>

export type ProductOrderLinePayCancelPaymentMetadataUpdater = (input: {
  paymentId: string
  metadata: Record<string, unknown>
}) => Promise<unknown>

function createErrorResponse(error: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      error,
    },
    { status },
  )
}

function getOptionalQueryParam(url: URL, name: string) {
  const value = url.searchParams.get(name)?.trim()
  return value || null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getLinePayRawPayload(payment: ProductOrderLinePayCancelPaymentContext) {
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

function buildCancelMetadata(input: {
  existingMetadata: Record<string, unknown> | null
  orderId: string | null
  transactionId: string | null
  canceledAt: string
}) {
  const existing = isRecord(input.existingMetadata) ? input.existingMetadata : {}
  const linePay = isRecord(existing.linePay) ? existing.linePay : {}

  return {
    ...existing,
    linePay: {
      ...linePay,
      cancel: {
        canceledAt: input.canceledAt,
        orderId: input.orderId,
        transactionId: input.transactionId,
        reason: 'customer_canceled_on_line_pay_page',
      },
    },
  }
}

export async function handleProductOrderLinePayCancelRedirect({
  request,
  env,
  paymentReader,
  paymentMetadataUpdater,
  now,
}: HandleProductOrderLinePayCancelRedirectInput): Promise<Response> {
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
  const rawOrderId = getOptionalQueryParam(url, 'orderId')
  const rawTransactionId = getOptionalQueryParam(url, 'transactionId')
  let orderId: string | null = null
  let transactionId: string | null = null

  if (rawOrderId) {
    try {
      orderId = normalizeLinePayOrderId(rawOrderId)
    } catch {
      return createErrorResponse('invalid_line_pay_order_id', 400)
    }
  }

  if (rawTransactionId) {
    try {
      transactionId = validateLinePayTransactionId(rawTransactionId)
    } catch {
      return createErrorResponse('invalid_line_pay_transaction_id', 400)
    }
  }

  if (!orderId && !transactionId) {
    return NextResponse.json(
      {
        ok: false,
        canceled: true,
        provider: 'line_pay',
        metadataUpdated: false,
        orderId: null,
        transactionId: null,
        error: 'line_pay_cancel_lookup_key_missing',
      },
      { status: 200 },
    )
  }

  if (typeof paymentReader !== 'function') {
    return createErrorResponse('line_pay_cancel_payment_reader_missing', 500)
  }

  let payment: ProductOrderLinePayCancelPaymentContext | null

  try {
    payment = await paymentReader({
      orderId,
      transactionId,
    })
  } catch {
    return createErrorResponse('line_pay_cancel_payment_not_found', 404)
  }

  if (!payment) {
    return createErrorResponse('line_pay_cancel_payment_not_found', 404)
  }

  if (payment.provider !== 'line_pay') {
    return createErrorResponse('line_pay_cancel_provider_mismatch', 409)
  }

  if (payment.status === 'paid') {
    return createErrorResponse('line_pay_cancel_payment_already_paid', 409)
  }

  const linePay = getLinePayRawPayload(payment)

  if (orderId && payment.merchant_order_no && payment.merchant_order_no !== orderId) {
    return createErrorResponse('line_pay_cancel_order_id_mismatch', 409)
  }

  if (orderId && linePay?.orderId && linePay.orderId !== orderId) {
    return createErrorResponse('line_pay_cancel_order_id_mismatch', 409)
  }

  if (transactionId && linePay?.transactionId && linePay.transactionId !== transactionId) {
    return createErrorResponse('line_pay_cancel_transaction_id_mismatch', 409)
  }

  if (linePay?.sourceType && linePay.sourceType !== 'product_order') {
    return createErrorResponse('line_pay_cancel_source_type_mismatch', 409)
  }

  if (typeof paymentMetadataUpdater !== 'function') {
    return createErrorResponse('line_pay_cancel_metadata_updater_missing', 500)
  }

  const resolvedOrderId = orderId ?? linePay?.orderId ?? payment.merchant_order_no ?? null
  const resolvedTransactionId = transactionId ?? linePay?.transactionId ?? null
  const metadata = buildCancelMetadata({
    existingMetadata: payment.raw_payload,
    orderId: resolvedOrderId,
    transactionId: resolvedTransactionId,
    canceledAt: now ?? new Date().toISOString(),
  })

  try {
    await paymentMetadataUpdater({
      paymentId: payment.id,
      metadata,
    })
  } catch {
    return createErrorResponse('line_pay_cancel_metadata_update_failed', 500)
  }

  return NextResponse.json(
    {
      ok: false,
      canceled: true,
      provider: 'line_pay',
      metadataUpdated: true,
      paymentId: payment.id,
      orderId: resolvedOrderId,
      transactionId: resolvedTransactionId,
      error: 'line_pay_product_order_cancel_recorded',
    },
    { status: 200 },
  )
}
