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

function getOptionalQueryParam(url: URL, name: string) {
  const value = url.searchParams.get(name)?.trim()
  return value || null
}

export async function handleProductOrderLinePayCancelRedirect({
  request,
  env,
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

  return NextResponse.json(
    {
      ok: false,
      canceled: true,
      provider: 'line_pay',
      orderId,
      transactionId,
      error: 'line_pay_product_order_cancel_not_implemented',
    },
    { status: 501 },
  )
}
