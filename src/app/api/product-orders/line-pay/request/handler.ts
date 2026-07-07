import { NextResponse } from 'next/server'
import { getLinePayServerConfig, type LinePayServerEnv } from '../../../../../lib/linePay'

export type HandleProductOrderLinePayRequestInput = {
  request: Request
  env: LinePayServerEnv
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

export async function handleProductOrderLinePayRequest({
  request,
  env,
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

  return createErrorResponse('line_pay_product_order_request_not_implemented', 501)
}
