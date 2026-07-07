import { NextResponse } from 'next/server'
import {
  buildLinePayRequestPaymentMetadata,
  buildLinePayOrderId,
  buildLinePayRequestPayload,
  createLinePayNonce,
  getLinePayServerConfig,
  mergeLinePayPaymentMetadata,
  type LinePayEnvironment,
  type LinePayRequestPayloadInput,
  type LinePayServerEnv,
} from '../../../../../lib/linePay'

export type ProductOrderLinePayPreflightItem = {
  name: string
  quantity: number
  amount: number
}

export type ProductOrderLinePayPreflightContext = {
  id: string
  status: string | null
  payment_status: string | null
  payment_id?: string | null
  total_amount: number | null
  currency?: string | null
  items: ProductOrderLinePayPreflightItem[]
}

export type ProductOrderLinePayReader = (
  productOrderId: string,
) => Promise<ProductOrderLinePayPreflightContext | null>

export type ProductOrderLinePayPaymentMetadata = {
  linePay: {
    orderId: string
    sourceType: 'product_order'
    sourceId: string
  }
}

export type ProductOrderLinePayPaymentCreatorInput = {
  productOrderId: string
  amount: number
  currency: 'TWD'
  provider: 'line_pay'
  merchantOrderNo: string
  metadata: ProductOrderLinePayPaymentMetadata
}

export type ProductOrderLinePayPaymentCreatorResult = {
  paymentId: string
  merchantOrderNo: string
}

export type ProductOrderLinePayPaymentCreator = (
  input: ProductOrderLinePayPaymentCreatorInput,
) => Promise<ProductOrderLinePayPaymentCreatorResult>

export type ProductOrderLinePayRequesterInput = {
  environment: LinePayEnvironment
  channelId: string
  channelSecret: string
  nonce: string
  payloadInput: LinePayRequestPayloadInput
}

export type ProductOrderLinePayRequesterResult = {
  returnCode: string
  returnMessage?: string | null
  transactionId: string
  paymentUrlWeb: string
  paymentUrlApp: string | null
}

export type ProductOrderLinePayRequester = (
  input: ProductOrderLinePayRequesterInput,
) => Promise<ProductOrderLinePayRequesterResult>

export type ProductOrderLinePayPaymentMetadataUpdaterInput = {
  paymentId: string
  metadata: Record<string, unknown>
}

export type ProductOrderLinePayPaymentMetadataUpdater = (
  input: ProductOrderLinePayPaymentMetadataUpdaterInput,
) => Promise<unknown>

export type HandleProductOrderLinePayRequestInput = {
  request: Request
  env: LinePayServerEnv
  productOrderReader?: ProductOrderLinePayReader
  paymentCreator?: ProductOrderLinePayPaymentCreator
  paymentMetadataUpdater?: ProductOrderLinePayPaymentMetadataUpdater
  linePayRequester?: ProductOrderLinePayRequester
  now?: number | string
}

type ProductOrderLinePayRequestBody = {
  productOrderId?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function createErrorResponse(error: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      error,
    },
    { status },
  )
}

function normalizeProductOrderId(body: unknown) {
  if (!isRecord(body)) return null

  const productOrderId = String((body as ProductOrderLinePayRequestBody).productOrderId ?? '').trim()
  return productOrderId || null
}

function isPositiveInteger(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function validateProductOrderPreflight(order: ProductOrderLinePayPreflightContext | null) {
  if (!order) {
    return {
      error: 'product_order_not_found',
      status: 404,
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

  if (order.payment_id) {
    return {
      error: 'product_order_not_payable',
      status: 409,
    }
  }

  if (!isPositiveInteger(order.total_amount)) {
    return {
      error: 'invalid_product_order_amount',
      status: 400,
    }
  }

  if (order.currency !== 'TWD') {
    return {
      error: 'invalid_product_order_currency',
      status: 400,
    }
  }

  if (!Array.isArray(order.items) || order.items.length === 0) {
    return {
      error: 'invalid_product_order_items',
      status: 400,
    }
  }

  let itemsTotal = 0

  for (const item of order.items) {
    if (
      typeof item.name !== 'string' ||
      !item.name.trim() ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0 ||
      !Number.isInteger(item.amount) ||
      item.amount < 0
    ) {
      return {
        error: 'invalid_product_order_items',
        status: 400,
      }
    }

    itemsTotal += item.quantity * item.amount
  }

  if (itemsTotal !== order.total_amount) {
    return {
      error: 'invalid_product_order_items_total',
      status: 400,
    }
  }

  return null
}

export async function handleProductOrderLinePayRequest({
  request,
  env,
  productOrderReader,
  paymentCreator,
  paymentMetadataUpdater,
  linePayRequester,
  now,
}: HandleProductOrderLinePayRequestInput): Promise<Response> {
  if (request.method !== 'POST') {
    return createErrorResponse('method_not_allowed', 405)
  }

  const body = await request.json().catch(() => null)
  const productOrderId = normalizeProductOrderId(body)

  if (!productOrderId) {
    return createErrorResponse('missing_product_order_id', 400)
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

  if (typeof productOrderReader !== 'function') {
    return createErrorResponse('product_order_reader_missing', 500)
  }

  let order: ProductOrderLinePayPreflightContext | null

  try {
    order = await productOrderReader(productOrderId)
  } catch {
    return createErrorResponse('product_order_lookup_failed', 500)
  }

  const preflightError = validateProductOrderPreflight(order)

  if (preflightError) {
    return createErrorResponse(preflightError.error, preflightError.status)
  }

  const payableOrder = order as ProductOrderLinePayPreflightContext & {
    total_amount: number
    currency: 'TWD'
  }
  const amount = payableOrder.total_amount
  const orderId = buildLinePayOrderId({
    sourceType: 'product_order',
    sourceId: productOrderId,
    timestamp: now ?? Date.now(),
  })
  const payloadInput: LinePayRequestPayloadInput = {
    orderId,
    amount,
    currency: 'TWD',
    products: payableOrder.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.amount,
    })),
    confirmUrl: config.confirmUrl,
    cancelUrl: config.cancelUrl,
  }
  const payload = buildLinePayRequestPayload(payloadInput)
  const metadata: ProductOrderLinePayPaymentMetadata = {
    linePay: {
      orderId,
      sourceType: 'product_order',
      sourceId: productOrderId,
    },
  }

  if (typeof paymentCreator !== 'function') {
    return createErrorResponse('product_order_payment_creator_missing', 500)
  }

  if (typeof linePayRequester !== 'function') {
    return createErrorResponse('product_order_line_pay_requester_missing', 500)
  }

  if (typeof paymentMetadataUpdater !== 'function') {
    return createErrorResponse('product_order_payment_metadata_update_missing', 500)
  }

  let pendingPayment: ProductOrderLinePayPaymentCreatorResult

  try {
    pendingPayment = await paymentCreator({
      productOrderId,
      amount,
      currency: payload.currency,
      provider: 'line_pay',
      merchantOrderNo: orderId,
      metadata,
    })
  } catch {
    return createErrorResponse('product_order_line_pay_payment_create_failed', 500)
  }

  let linePayRequest: ProductOrderLinePayRequesterResult

  try {
    linePayRequest = await linePayRequester({
      environment: config.environment,
      channelId: config.channelId,
      channelSecret: config.channelSecret,
      nonce: createLinePayNonce(),
      payloadInput,
    })
  } catch {
    return createErrorResponse('product_order_line_pay_request_failed', 500)
  }

  const requestMetadata = buildLinePayRequestPaymentMetadata({
    transactionId: linePayRequest.transactionId,
    paymentUrlWeb: linePayRequest.paymentUrlWeb,
    paymentUrlApp: linePayRequest.paymentUrlApp ?? undefined,
    returnCode: linePayRequest.returnCode,
    returnMessage: linePayRequest.returnMessage,
  })
  const mergedMetadata = mergeLinePayPaymentMetadata(metadata, requestMetadata)

  try {
    await paymentMetadataUpdater({
      paymentId: pendingPayment.paymentId,
      metadata: mergedMetadata,
    })
  } catch {
    return createErrorResponse('product_order_payment_metadata_update_failed', 500)
  }

  return NextResponse.json(
    {
      ok: true,
      provider: 'line_pay',
      paymentId: pendingPayment.paymentId,
      orderId: payload.orderId,
      transactionId: linePayRequest.transactionId,
      paymentUrl: {
        web: linePayRequest.paymentUrlWeb,
        app: linePayRequest.paymentUrlApp,
      },
      amount: payload.amount,
      currency: payload.currency,
      itemCount: payload.packages[0]?.products.length ?? 0,
    },
    { status: 200 },
  )
}
