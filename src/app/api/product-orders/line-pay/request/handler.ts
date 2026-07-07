import { NextResponse } from 'next/server'
import {
  buildLinePayOrderId,
  buildLinePayRequestPayload,
  getLinePayServerConfig,
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
  total_amount: number | null
  currency?: string | null
  items: ProductOrderLinePayPreflightItem[]
}

export type ProductOrderLinePayReader = (
  productOrderId: string,
) => Promise<ProductOrderLinePayPreflightContext | null>

export type HandleProductOrderLinePayRequestInput = {
  request: Request
  env: LinePayServerEnv
  productOrderReader?: ProductOrderLinePayReader
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
  const payload = buildLinePayRequestPayload({
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
  })

  return NextResponse.json(
    {
      ok: false,
      error: 'line_pay_product_order_request_not_implemented',
      preflight: true,
      dryRun: true,
      orderId: payload.orderId,
      amount: payload.amount,
      currency: payload.currency,
      itemCount: payload.packages[0]?.products.length ?? 0,
    },
    { status: 501 },
  )
}
