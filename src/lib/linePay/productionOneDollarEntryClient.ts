import {
  LINE_PAY_PRODUCTION_ONE_DOLLAR_CONFIRMATION,
  trustedProductionLinePayWebUrl,
  type LinePayProductionOneDollarEntrySource,
} from './productionOneDollarEntry'

type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>

export type LinePayProductionOneDollarEntryCheckoutResult =
  | Readonly<{ ok: true; paymentUrlWeb: string }>
  | Readonly<{ ok: false; error: string; status: number }>

export type LinePayProductionOneDollarEntryAvailability =
  | Readonly<{ status: 'enabled'; enabledUntil: string }>
  | Readonly<{ status: 'disabled' | 'error' }>

export async function checkLinePayProductionOneDollarEntryAvailability(input: {
  accessToken: string
  fetchFn?: FetchLike
  now?: () => Date
}) {
  if (!input.accessToken.trim()) {
    return Object.freeze({ status: 'disabled' as const })
  }
  const fetchFn = input.fetchFn ?? fetch

  try {
    const response = await fetchFn(
      '/api/admin/line-pay-production-one-dollar-test',
      {
        cache: 'no-store',
        headers: { authorization: `Bearer ${input.accessToken}` },
      },
    )
    if (response.status === 401 || response.status === 403) {
      return Object.freeze({ status: 'disabled' as const })
    }
    if (!response.ok) return Object.freeze({ status: 'error' as const })
    const payload = await response.json().catch(() => null) as {
      ok?: unknown
      enabled?: unknown
      enabledUntil?: unknown
    } | null
    if (payload?.ok !== true || typeof payload.enabled !== 'boolean') {
      return Object.freeze({ status: 'error' as const })
    }
    if (!payload.enabled) {
      return Object.freeze({ status: 'disabled' as const })
    }
    const enabledUntilMs = typeof payload.enabledUntil === 'string'
      ? Date.parse(payload.enabledUntil)
      : Number.NaN
    if (
      !Number.isFinite(enabledUntilMs)
      || new Date(enabledUntilMs).toISOString() !== payload.enabledUntil
      || enabledUntilMs <= (input.now?.() ?? new Date()).getTime()
    ) {
      return Object.freeze({ status: 'error' as const })
    }
    return Object.freeze({
      status: 'enabled' as const,
      enabledUntil: payload.enabledUntil,
    })
  } catch {
    return Object.freeze({ status: 'error' as const })
  }
}

export async function requestLinePayProductionOneDollarEntryCheckout(input: {
  accessToken: string
  entrySource: LinePayProductionOneDollarEntrySource
  fetchFn?: FetchLike
}): Promise<LinePayProductionOneDollarEntryCheckoutResult> {
  if (!input.accessToken.trim()) {
    return Object.freeze({
      ok: false,
      error: 'admin_session_unavailable',
      status: 401,
    })
  }
  const fetchFn = input.fetchFn ?? fetch

  try {
    const response = await fetchFn(
      '/api/internal/line-pay/production-one-dollar/start',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${input.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          confirmation: LINE_PAY_PRODUCTION_ONE_DOLLAR_CONFIRMATION,
          entrySource: input.entrySource,
        }),
      },
    )
    const payload = await response.json().catch(() => null) as {
      ok?: unknown
      environment?: unknown
      entrySource?: unknown
      amountTwd?: unknown
      currency?: unknown
      paymentUrl?: unknown
    } | null
    const paymentUrlWeb = trustedProductionLinePayWebUrl(payload?.paymentUrl)
    if (
      !response.ok
      || payload?.ok !== true
      || payload.environment !== 'production'
      || payload.entrySource !== input.entrySource
      || payload.amountTwd !== 1
      || payload.currency !== 'TWD'
      || !paymentUrlWeb
    ) {
      return Object.freeze({
        ok: false,
        error: 'line_pay_entry_test_request_failed',
        status: response.status,
      })
    }

    return Object.freeze({ ok: true, paymentUrlWeb })
  } catch {
    return Object.freeze({
      ok: false,
      error: 'line_pay_entry_test_request_failed',
      status: 0,
    })
  }
}
