import type { LinePayServiceSource } from './serviceCheckout'

export type ServiceLinePayCheckoutResult =
  | { ok: true; paymentUrlWeb: string }
  | { ok: false; error: string; status: number }

export async function requestServiceLinePayCheckout(input: {
  accessToken: string
  source: LinePayServiceSource
  sourceId: string
  idempotencyKey: string
  cardId?: string | null
  position?: string | null
  adminOneDollarTest?: boolean
  fetchFn?: typeof fetch
}): Promise<ServiceLinePayCheckoutResult> {
  const fetchFn = input.fetchFn ?? fetch
  let response: Response
  try {
    response = await fetchFn('/api/payments/line-pay/request', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: input.source,
        sourceId: input.sourceId,
        idempotencyKey: input.idempotencyKey,
        ...(input.cardId ? { cardId: input.cardId } : {}),
        ...(input.position ? { position: input.position } : {}),
        ...(input.adminOneDollarTest === true
          ? { adminOneDollarTest: true }
          : {}),
      }),
    })
  } catch {
    return { ok: false, error: 'line_pay_service_request_failed', status: 0 }
  }

  const payload = await response.json().catch(() => null) as {
    ok?: unknown
    error?: unknown
    paymentUrl?: { web?: unknown }
  } | null
  if (
    !response.ok
    || payload?.ok !== true
    || typeof payload.paymentUrl?.web !== 'string'
    || !payload.paymentUrl.web.trim()
  ) {
    return {
      ok: false,
      error:
        typeof payload?.error === 'string'
          ? payload.error
          : 'line_pay_service_request_failed',
      status: response.status,
    }
  }

  return { ok: true, paymentUrlWeb: payload.paymentUrl.web }
}

export function getServiceLinePayErrorMessage(result: Extract<ServiceLinePayCheckoutResult, { ok: false }>) {
  if (result.status === 401 || result.error === 'line_pay_login_required') {
    return '請先登入會員後再使用 LINE Pay。'
  }
  if (result.error === 'line_pay_disabled') {
    return 'LINE Pay 目前暫時無法使用，請改選其他付款方式。'
  }
  if (result.error === 'line_pay_service_not_payable') {
    return '這筆服務目前無法建立 LINE Pay 付款，請重新確認付款狀態。'
  }
  return 'LINE Pay 付款資料建立失敗，請稍後再試。'
}
