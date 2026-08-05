export const NEWEBPAY_ADMIN_ONE_DOLLAR_TEST_CHANNELS = [
  'credit',
  'apple_pay',
  'atm',
] as const

export type NewebPayAdminOneDollarTestChannel =
  (typeof NEWEBPAY_ADMIN_ONE_DOLLAR_TEST_CHANNELS)[number]

type NewebPayAdminOneDollarTestClientDependencies = {
  getAccessToken: () => Promise<string | null>
  fetchStart: (input: string, init?: RequestInit) => Promise<Response>
  navigate: (url: string) => void
}

export type NewebPayAdminOneDollarTestClientResult =
  | {
      ok: true
      channel: NewebPayAdminOneDollarTestChannel
    }
  | {
      ok: false
      channel: NewebPayAdminOneDollarTestChannel
      error:
        | 'admin_session_unavailable'
        | 'payment_request_failed'
        | 'payment_response_invalid'
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
}

export async function startNewebPayAdminOneDollarTest(
  channel: NewebPayAdminOneDollarTestChannel,
  dependencies: NewebPayAdminOneDollarTestClientDependencies,
): Promise<NewebPayAdminOneDollarTestClientResult> {
  const accessToken = await dependencies.getAccessToken().catch(() => null)
  if (!accessToken) {
    return { ok: false, channel, error: 'admin_session_unavailable' }
  }

  let response: Response
  try {
    response = await dependencies.fetchStart(
      '/api/payments/newebpay/test/start',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ channel }),
      },
    )
  } catch {
    return { ok: false, channel, error: 'payment_request_failed' }
  }

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    return { ok: false, channel, error: 'payment_request_failed' }
  }

  if (!isRecord(body) || body.ok !== true || !isUuid(body.paymentId)) {
    return { ok: false, channel, error: 'payment_response_invalid' }
  }

  dependencies.navigate(
    `/payment/newebpay/redirect?paymentId=${encodeURIComponent(body.paymentId)}`,
  )
  return { ok: true, channel }
}
