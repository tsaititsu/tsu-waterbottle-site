export type LinePaySandboxE2eAdminError =
  | 'admin_session_unavailable'
  | 'sandbox_request_failed'
  | 'sandbox_response_invalid'
  | 'invalid_sandbox_payment_url'

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

function parseStartSuccessPayload(value: unknown): StartSuccessPayload | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  const payload = value as Record<string, unknown>
  if (
    payload.ok !== true
    || payload.environment !== 'sandbox'
    || payload.amountTwd !== 50
    || payload.currency !== 'TWD'
    || typeof payload.paymentUrl !== 'string'
  ) {
    return null
  }

  return { paymentUrl: payload.paymentUrl }
}

function parseSandboxPaymentUrl(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }

  if (
    url.protocol !== 'https:'
    || url.hostname !== 'sandbox-web-pay.line.me'
    || url.port !== ''
    || url.username !== ''
    || url.password !== ''
  ) {
    return null
  }

  return url.toString()
}

export function createLinePaySandboxE2eAdminController(
  deps: LinePaySandboxE2eAdminDeps,
  onSnapshot: (snapshot: LinePaySandboxE2eAdminSnapshot) => void,
): LinePaySandboxE2eAdminController {
  let started = false

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
          '/api/internal/line-pay/sandbox-e2e/start',
          {
            method: 'POST',
            headers: {
              authorization: `Bearer ${accessToken}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              confirmation: 'RUN_LINE_PAY_SANDBOX_E2E_NT50_ONCE',
            }),
          },
        )
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          onSnapshot(Object.freeze({
            state: 'failed',
            error: 'sandbox_request_failed',
          }))
          return
        }

        const success = parseStartSuccessPayload(payload)
        if (!success) {
          onSnapshot(Object.freeze({
            state: 'failed',
            error: 'sandbox_response_invalid',
          }))
          return
        }

        const paymentUrl = parseSandboxPaymentUrl(success.paymentUrl)
        if (!paymentUrl) {
          onSnapshot(Object.freeze({
            state: 'failed',
            error: 'invalid_sandbox_payment_url',
          }))
          return
        }

        onSnapshot(Object.freeze({ state: 'redirecting' }))
        deps.navigate(paymentUrl)
      } catch {
        onSnapshot(Object.freeze({
          state: 'failed',
          error: 'sandbox_request_failed',
        }))
      } finally {
        accessToken = null
      }
    },
  }
}
