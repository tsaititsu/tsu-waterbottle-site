import 'server-only'

import type { ProductOrderLinePayCapabilityRpcClient } from './linePayCapabilityRuntime'
import {
  createLinePayExecutorReadinessFailure,
  type LinePayExecutorReadinessFailureReason,
} from './linePayExecutorReadiness'

export {
  classifyLinePayExecutorReadinessFailure,
  type LinePayExecutorReadinessFailureReason,
} from './linePayExecutorReadiness'

type ExecutorEnv = {
  readonly [key: string]: string | undefined
  NEXT_PUBLIC_SUPABASE_URL?: string
  SUPABASE_LINE_PAY_EXECUTOR_API_KEY?: string
}

type ExecutorFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

type SafeRpcError = Readonly<{
  code: string
  message: string
}>

const EXECUTOR_RPC = 'finalize_product_order_line_pay_confirmation'
const EXECUTOR_REQUEST_TIMEOUT_MS = 5_000
const MAX_EXECUTOR_RESPONSE_BYTES = 64 * 1024
const EXPECTED_READINESS_CODE = 'P0002'
const EXPECTED_READINESS_MESSAGE = 'line_pay_confirmation_context_not_found'
const SECRET_API_KEY_PATTERN = /^sb_secret_[A-Za-z0-9_-]{20,512}$/
const SQLSTATE_PATTERN = /^[A-Z0-9]{5}$/
const SAFE_RPC_ERROR_CODES = Object.freeze({
  failed: 'line_pay_executor_rpc_failed',
  forbidden: 'line_pay_executor_rpc_forbidden',
  notFound: 'line_pay_executor_rpc_not_found',
  timeout: 'line_pay_executor_rpc_timeout',
  unauthorized: 'line_pay_executor_rpc_unauthorized',
  unavailable: 'line_pay_executor_rpc_unavailable',
})

function invalidConfig(): never {
  throw new Error('line_pay_executor_config_invalid')
}

function requireSupabaseUrl(value: string | undefined) {
  if (typeof value !== 'string') invalidConfig()

  let url: URL
  try {
    url = new URL(value)
  } catch {
    invalidConfig()
  }
  if (
    url.protocol !== 'https:'
    || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)
    || url.port !== ''
    || url.username !== ''
    || url.password !== ''
    || url.pathname !== '/'
    || url.search !== ''
    || url.hash !== ''
  ) {
    invalidConfig()
  }
  return url.origin
}

function requireExecutorApiKey(value: string | undefined) {
  if (typeof value !== 'string' || !SECRET_API_KEY_PATTERN.test(value)) {
    invalidConfig()
  }
  return value
}

function safeResponseFailureCode(status: number) {
  if (status === 401) return SAFE_RPC_ERROR_CODES.unauthorized
  if (status === 403) return SAFE_RPC_ERROR_CODES.forbidden
  if (status === 404) return SAFE_RPC_ERROR_CODES.notFound
  if (status >= 500) return SAFE_RPC_ERROR_CODES.unavailable
  return SAFE_RPC_ERROR_CODES.failed
}

function stableRpcError(value: unknown, status = 0): SafeRpcError {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return Object.freeze({
      code: safeResponseFailureCode(status),
      message: SAFE_RPC_ERROR_CODES.failed,
    })
  }
  const record = value as Record<string, unknown>
  if (
    record.code === EXPECTED_READINESS_CODE
    && record.message === EXPECTED_READINESS_MESSAGE
  ) {
    return Object.freeze({
      code: EXPECTED_READINESS_CODE,
      message: EXPECTED_READINESS_MESSAGE,
    })
  }
  return Object.freeze({
    code:
      typeof record.code === 'string' && SQLSTATE_PATTERN.test(record.code)
        ? record.code
        : safeResponseFailureCode(status),
    message: SAFE_RPC_ERROR_CODES.failed,
  })
}

function stableTransportRpcError(error: unknown): SafeRpcError {
  const code =
    error instanceof DOMException && error.name === 'AbortError'
      ? SAFE_RPC_ERROR_CODES.timeout
      : SAFE_RPC_ERROR_CODES.unavailable
  return Object.freeze({ code, message: SAFE_RPC_ERROR_CODES.failed })
}

async function parseRpcResponse(response: Response) {
  const contentLength = Number(response.headers.get('content-length'))
  if (
    Number.isFinite(contentLength)
    && contentLength > MAX_EXECUTOR_RESPONSE_BYTES
  ) {
    return { data: null, error: stableRpcError(null, response.status) }
  }

  let body: unknown
  try {
    const text = await response.text()
    if (text.length > MAX_EXECUTOR_RESPONSE_BYTES) {
      return { data: null, error: stableRpcError(null, response.status) }
    }
    body = JSON.parse(text) as unknown
  } catch {
    return { data: null, error: stableRpcError(null, response.status) }
  }

  if (!response.ok) {
    return { data: null, error: stableRpcError(body, response.status) }
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { data: null, error: stableRpcError(null, response.status) }
  }
  return { data: body, error: null }
}

export function createLinePayExecutorClient(
  env: ExecutorEnv = process.env,
  fetchFn: ExecutorFetch = fetch,
): ProductOrderLinePayCapabilityRpcClient {
  const supabaseUrl = requireSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL)
  const executorApiKey = requireExecutorApiKey(
    env.SUPABASE_LINE_PAY_EXECUTOR_API_KEY,
  )

  return Object.freeze({
    rpc(functionName: string, args: Record<string, unknown>) {
      if (functionName !== EXECUTOR_RPC) {
        throw new Error('line_pay_executor_rpc_not_allowed')
      }

      return Object.freeze({
        async single() {
          const controller = new AbortController()
          const timeout = setTimeout(
            () => controller.abort(),
            EXECUTOR_REQUEST_TIMEOUT_MS,
          )
          try {
            const response = await fetchFn(
              `${supabaseUrl}/rest/v1/rpc/${EXECUTOR_RPC}`,
              {
                method: 'POST',
                headers: {
                  accept: 'application/vnd.pgrst.object+json',
                  apikey: executorApiKey,
                  'content-type': 'application/json',
                },
                body: JSON.stringify(args),
                cache: 'no-store',
                redirect: 'error',
                signal: controller.signal,
              },
            )
            return await parseRpcResponse(response)
          } catch (error) {
            return { data: null, error: stableTransportRpcError(error) }
          } finally {
            clearTimeout(timeout)
          }
        },
      })
    },
  })
}

const READINESS_ARGS = Object.freeze({
  p_environment: 'sandbox',
  p_payment_id: '00000000-0000-4000-8000-000000000001',
  p_product_order_id: '00000000-0000-4000-8000-000000000002',
  p_attempt_id: '00000000-0000-4000-8000-000000000003',
  p_merchant_order_no: 'LINE_PAY_EXECUTOR_READINESS',
  p_transaction_id: 'LINE_PAY_EXECUTOR_READINESS',
  p_amount_twd: 1,
  p_currency: 'TWD',
  p_capability_id: '00000000-0000-4000-8000-000000000004',
  p_callback_event_id: '00000000-0000-4000-8000-000000000005',
  p_callback_claim_id: '00000000-0000-4000-8000-000000000006',
  p_confirm_result_sha256: '0'.repeat(64),
  p_request_id: 'line-pay-executor-readiness',
})

export async function probeLinePayExecutorCallbackReadiness(
  client: ProductOrderLinePayCapabilityRpcClient,
) {
  let result: { data: unknown; error: unknown }
  try {
    result = await client.rpc(EXECUTOR_RPC, READINESS_ARGS).single()
  } catch {
    throw createLinePayExecutorReadinessFailure('rpc_failed')
  }
  if (
    typeof result.error !== 'object'
    || result.error === null
    || Array.isArray(result.error)
  ) {
    throw createLinePayExecutorReadinessFailure('rpc_unexpected_result')
  }
  const error = result.error as Record<string, unknown>
  if (
    result.data !== null
    || error.code !== EXPECTED_READINESS_CODE
    || error.message !== EXPECTED_READINESS_MESSAGE
  ) {
    throw createLinePayExecutorReadinessFailure(
      safeReadinessFailureReason(error),
    )
  }
  return Object.freeze({
    ok: true,
    authenticated: true,
    upstreamCalled: false,
    databaseWrites: false,
  })
}

function safeReadinessFailureReason(
  error: Record<string, unknown>,
): LinePayExecutorReadinessFailureReason {
  switch (error.code) {
    case '42501':
      return 'rpc_insufficient_privilege'
    case '42883':
    case '42P01':
    case SAFE_RPC_ERROR_CODES.notFound:
      return 'rpc_contract_missing'
    case SAFE_RPC_ERROR_CODES.unauthorized:
      return 'rpc_unauthorized'
    case SAFE_RPC_ERROR_CODES.forbidden:
      return 'rpc_forbidden'
    case SAFE_RPC_ERROR_CODES.timeout:
      return 'rpc_timeout'
    case SAFE_RPC_ERROR_CODES.unavailable:
      return 'rpc_unavailable'
    case SAFE_RPC_ERROR_CODES.failed:
      return 'rpc_failed'
    default:
      return 'rpc_unexpected_result'
  }
}
