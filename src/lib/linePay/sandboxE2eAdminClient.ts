export type LinePaySandboxE2eAdminError =
  | 'admin_session_unavailable'
  | 'sandbox_request_failed'
  | 'sandbox_response_invalid'
  | 'invalid_sandbox_payment_url'
  | 'production_request_failed'
  | 'production_response_invalid'
  | 'invalid_production_payment_url'

export type LinePaySandboxE2eAdminSnapshot =
  | Readonly<{ state: 'starting' }>
  | Readonly<{ state: 'redirecting' }>
  | Readonly<{
      state: 'failed'
      error: LinePaySandboxE2eAdminError
    }>

type SandboxE2eStartResponse = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

type LinePaySandboxE2eAdminDeps = {
  getAccessToken: () => Promise<string | null>
  fetchStart: (
    input: string,
    init: RequestInit,
  ) => Promise<SandboxE2eStartResponse>
  navigate: (url: string) => void
}

export type LinePaySandboxE2eAdminController = {
  start: () => Promise<void>
}

type StartSuccessPayload = {
  paymentUrl: string
}

function parseStartSuccessPayload(
  value: unknown,
  environment: 'sandbox' | 'production',
): StartSuccessPayload | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  const payload = value as Record<string, unknown>
  if (
    payload.ok !== true
    || payload.environment !== environment
    || payload.amountTwd !== 1
    || payload.currency !== 'TWD'
    || typeof payload.paymentUrl !== 'string'
  ) {
    return null
  }

  return { paymentUrl: payload.paymentUrl }
}

function parsePaymentUrl(
  value: string,
  environment: 'sandbox' | 'production',
) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }

  const expectedHostname = environment === 'sandbox'
    ? 'sandbox-web-pay.line.me'
    : 'web-pay.line.me'
  if (
    url.protocol !== 'https:'
    || url.hostname !== expectedHostname
    || url.port !== ''
    || url.username !== ''
    || url.password !== ''
    || (environment === 'production' && !url.pathname.startsWith('/web/'))
  ) {
    return null
  }

  return url.toString()
}

function createLinePayOneDollarAdminController(
  environment: 'sandbox' | 'production',
  deps: LinePaySandboxE2eAdminDeps,
  onSnapshot: (snapshot: LinePaySandboxE2eAdminSnapshot) => void,
): LinePaySandboxE2eAdminController {
  let started = false
  const endpoint = environment === 'sandbox'
    ? '/api/internal/line-pay/sandbox-e2e/start'
    : '/api/internal/line-pay/production-one-dollar/start'
  const confirmation = environment === 'sandbox'
    ? 'RUN_LINE_PAY_SANDBOX_E2E_NT1_ONCE'
    : 'RUN_LINE_PAY_PRODUCTION_NT1_ONCE'
  const requestError = environment === 'sandbox'
    ? 'sandbox_request_failed'
    : 'production_request_failed'
  const responseError = environment === 'sandbox'
    ? 'sandbox_response_invalid'
    : 'production_response_invalid'
  const paymentUrlError = environment === 'sandbox'
    ? 'invalid_sandbox_payment_url'
    : 'invalid_production_payment_url'

  return {
    async start() {
      if (started) return
      started = true
      onSnapshot(Object.freeze({ state: 'starting' }))

      let accessToken: string | null = null
      try {
        accessToken = await deps.getAccessToken()
        if (!accessToken) {
          onSnapshot(Object.freeze({
            state: 'failed',
            error: 'admin_session_unavailable',
          }))
          return
        }

        const response = await deps.fetchStart(
          endpoint,
          {
            method: 'POST',
            headers: {
              authorization: `Bearer ${accessToken}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              confirmation,
            }),
          },
        )
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          onSnapshot(Object.freeze({
            state: 'failed',
            error: requestError,
          }))
          return
        }

        const success = parseStartSuccessPayload(payload, environment)
        if (!success) {
          onSnapshot(Object.freeze({
            state: 'failed',
            error: responseError,
          }))
          return
        }

        const paymentUrl = parsePaymentUrl(success.paymentUrl, environment)
        if (!paymentUrl) {
          onSnapshot(Object.freeze({
            state: 'failed',
            error: paymentUrlError,
          }))
          return
        }

        onSnapshot(Object.freeze({ state: 'redirecting' }))
        deps.navigate(paymentUrl)
      } catch {
        onSnapshot(Object.freeze({
          state: 'failed',
          error: requestError,
        }))
      } finally {
        accessToken = null
      }
    },
  }
}

export function createLinePaySandboxE2eAdminController(
  deps: LinePaySandboxE2eAdminDeps,
  onSnapshot: (snapshot: LinePaySandboxE2eAdminSnapshot) => void,
) {
  return createLinePayOneDollarAdminController('sandbox', deps, onSnapshot)
}

export function createLinePayProductionOneDollarAdminController(
  deps: LinePaySandboxE2eAdminDeps,
  onSnapshot: (snapshot: LinePaySandboxE2eAdminSnapshot) => void,
) {
  return createLinePayOneDollarAdminController('production', deps, onSnapshot)
}
