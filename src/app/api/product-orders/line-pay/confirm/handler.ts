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

function getRequiredQueryParam(url: URL, name: string, missingError: string) {
  const value = url.searchParams.get(name)?.trim()

  if (!value) {
    throw new Error(missingError)
  }

  return value
}

export async function handleProductOrderLinePayConfirmRedirect({
  request,
  env,
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

  return NextResponse.json(
    {
      ok: false,
      error: 'line_pay_product_order_confirm_not_implemented',
      received: true,
      orderId,
      transactionId,
    },
    { status: 501 },
  )
}
