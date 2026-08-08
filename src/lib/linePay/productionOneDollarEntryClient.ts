import {
  LINE_PAY_PRODUCTION_ONE_DOLLAR_CONFIRMATION,
  type LinePayProductionOneDollarEntrySource,
} from './productionOneDollarEntry'

type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>

export type LinePayProductionOneDollarEntryCheckoutResult =
  | Readonly<{ ok: true; paymentUrlWeb: string }>
  | Readonly<{ ok: false; error: string; status: number }>

function trustedProductionPaymentUrl(value: unknown) {
  if (typeof value !== 'string') return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (
    url.protocol !== 'https:'
    || url.hostname !== 'web-pay.line.me'
    || url.port !== ''
    || url.username !== ''
    || url.password !== ''
    || !url.pathname.startsWith('/web/')
  ) {
    return null
  }
  return url.toString()
}

export async function checkLinePayProductionOneDollarEntryAvailability(input: {
  accessToken: string
  fetchFn?: FetchLike
}) {
  if (!input.accessToken.trim()) return false
  const fetchFn = input.fetchFn ?? fetch

  try {
    const response = await fetchFn(
      '/api/admin/line-pay-production-one-dollar-test',
      {
        cache: 'no-store',
        headers: { authorization: `Bearer ${input.accessToken}` },
      },
    )
    if (!response.ok) return false
    const payload = await response.json().catch(() => null) as {
      ok?: unknown
      enabled?: unknown
    } | null
    return payload?.ok === true && payload.enabled === true
  } catch {
    return false
  }
}

export async function requestLinePayProductionOneDollarEntryCheckout(input: {
  accessToken: string
  entrySource: Exclude<LinePayProductionOneDollarEntrySource, 'admin'>
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
    const paymentUrlWeb = trustedProductionPaymentUrl(payload?.paymentUrl)
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
