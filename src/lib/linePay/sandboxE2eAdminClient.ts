export type LinePaySandboxE2eAdminError =
  | 'admin_session_unavailable'
  | 'sandbox_request_failed'
  | 'sandbox_response_invalid'
  | 'invalid_sandbox_payment_url'
  | 'production_request_failed'
  | 'production_response_invalid'
  | 'invalid_production_payment_url'

const LINE_PAY_ONE_DOLLAR_INITIALIZATION_REASONS = [
  'invalid_input',
  'rpc_failed',
  'contract_mismatch',
  'database_invalid_input',
  'database_items_total_mismatch',
  'database_idempotency_conflict',
  'database_order_link_failed',
  'database_audit_binding_invalid',
  'rpc_insufficient_privilege',
  'rpc_foreign_key_violation',
  'rpc_unique_violation',
  'rpc_check_violation',
  'rpc_contract_missing',
  'rpc_application_exception',
] as const

export type LinePayOneDollarInitializationReason =
  typeof LINE_PAY_ONE_DOLLAR_INITIALIZATION_REASONS[number]

const LINE_PAY_ONE_DOLLAR_EXECUTION_REASONS = [
  'database_contract_mismatch',
  'durable_result_missing',
  'provider_rejected',
  'success_record_failed',
  'upstream_result_unknown',
  'gateway_config_invalid',
  'gateway_request_failed',
  'gateway_response_invalid',
  'gateway_timeout',
  'gateway_unavailable',
  'gateway_upstream_timeout',
  'gateway_contract_rejected',
  'gateway_environment_mismatch',
  'gateway_internal_error',
  'gateway_rate_limited',
  'gateway_replay_detected',
  'gateway_unauthorized',
  'gateway_upstream_response_invalid',
  'gateway_upstream_unavailable',
] as const

export type LinePayOneDollarExecutionReason =
  typeof LINE_PAY_ONE_DOLLAR_EXECUTION_REASONS[number]

export type LinePayOneDollarAdminDiagnostic = Readonly<
  | { stage: 'config' }
  | {
      stage: 'initialization'
      reason?: LinePayOneDollarInitializationReason
    }
  | {
      stage: 'execution'
      reason?: LinePayOneDollarExecutionReason
    }
  | { stage: 'not_ready' }
  | { stage: 'payment_url' }
>

export type LinePaySandboxE2eAdminSnapshot =
  | Readonly<{ state: 'starting' }>
  | Readonly<{ state: 'redirecting' }>
  | Readonly<{
      state: 'failed'
      error: LinePaySandboxE2eAdminError
      diagnostic?: LinePayOneDollarAdminDiagnostic
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

const START_FAILURE_STAGES = {
  sandbox: {
    line_pay_sandbox_e2e_config_failed: 'config',
    line_pay_sandbox_e2e_initialization_failed: 'initialization',
    line_pay_sandbox_e2e_execution_failed: 'execution',
    line_pay_sandbox_e2e_not_ready: 'not_ready',
    line_pay_sandbox_e2e_payment_url_failed: 'payment_url',
  },
  production: {
    line_pay_production_one_dollar_config_failed: 'config',
    line_pay_production_one_dollar_initialization_failed: 'initialization',
    line_pay_production_one_dollar_execution_failed: 'execution',
    line_pay_production_one_dollar_not_ready: 'not_ready',
    line_pay_production_one_dollar_payment_url_failed: 'payment_url',
  },
} as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseStartFailureDiagnostic(
  value: unknown,
  environment: 'sandbox' | 'production',
): LinePayOneDollarAdminDiagnostic | null {
  if (!isRecord(value) || value.ok !== false || typeof value.error !== 'string') {
    return null
  }

  const stages = START_FAILURE_STAGES[environment]
  const stage = stages[value.error as keyof typeof stages]
  if (!stage) return null
  if (stage === 'execution') {
    const reason = value.executionReason
    if (
      typeof reason === 'string'
      && (LINE_PAY_ONE_DOLLAR_EXECUTION_REASONS as readonly string[])
        .includes(reason)
    ) {
      return Object.freeze({
        stage,
        reason: reason as LinePayOneDollarExecutionReason,
      })
    }
    return Object.freeze({ stage })
  }
  if (stage !== 'initialization') return Object.freeze({ stage })

  const reason = value.initializationReason
  if (
    typeof reason === 'string'
    && (LINE_PAY_ONE_DOLLAR_INITIALIZATION_REASONS as readonly string[])
      .includes(reason)
  ) {
    return Object.freeze({
      stage,
      reason: reason as LinePayOneDollarInitializationReason,
    })
  }

  return Object.freeze({ stage })
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
          const diagnostic = parseStartFailureDiagnostic(payload, environment)
          onSnapshot(Object.freeze({
            state: 'failed',
            error: requestError,
            ...(diagnostic ? { diagnostic } : {}),
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
