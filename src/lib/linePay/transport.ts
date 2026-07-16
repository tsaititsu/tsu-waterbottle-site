import { createHash, createHmac, randomUUID } from 'node:crypto'
import { getLinePayBaseUrl, normalizeLinePayEnvironment, type LinePayEnvironment } from './config'
import type { LinePayHttpMethod } from './signature'

export const LINE_PAY_GATEWAY_PROXY_PATH = '/v1/line-pay/proxy'
export const DEFAULT_LINE_PAY_GATEWAY_TIMEOUT_MS = 5_000

export type LinePayTransportMode = 'direct' | 'gateway'
export type LinePayTransportOperation = 'request' | 'confirm' | 'status' | 'paymentDetails'
export type LinePayTransportEnv = Record<string, string | undefined>

export type LinePayTransportFetchInit = {
  method: LinePayHttpMethod
  headers: Record<string, string>
  body?: string
  signal?: AbortSignal
  redirect?: 'error'
}

export type LinePayTransportResponse = {
  status?: number
  json: () => Promise<unknown>
}

export type LinePayTransportFetch = (
  url: string,
  init: LinePayTransportFetchInit,
) => Promise<LinePayTransportResponse>

export type LinePayTransportConfig =
  | {
      mode: 'direct'
    }
  | {
      mode: 'gateway'
      gatewayUrl: string
      keyId: string
      secret: string
      timeoutMs: number
    }

export type SendLinePayRequestInput = {
  operation: LinePayTransportOperation
  environment?: string | null
  method: LinePayHttpMethod
  apiPath: string
  queryString?: string
  bodyText?: string
  linePayHeaders: Record<string, string>
  transactionId?: string | null
  orderId?: string | null
  fetchFn?: LinePayTransportFetch | null
  transportEnv?: LinePayTransportEnv
  now?: () => number
  createNonce?: () => string
  createRequestId?: () => string
}

type GatewaySuccessResponse = {
  ok: true
  upstreamStatus: number
  body: unknown
}

export class LinePayTransportError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = 'LinePayTransportError'
    this.code = code
  }
}

function transportError(code: string) {
  return new LinePayTransportError(code)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getEnvValue(env: LinePayTransportEnv, key: string) {
  return env[key]?.trim() ?? ''
}

function parseGatewayTimeout(value: string) {
  if (!value) return DEFAULT_LINE_PAY_GATEWAY_TIMEOUT_MS

  const timeoutMs = Number(value)

  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30_000) {
    throw transportError('invalid_line_pay_gateway_timeout')
  }

  return timeoutMs
}

function normalizeGatewayUrl(value: string, environment: LinePayEnvironment) {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw transportError('invalid_line_pay_gateway_url')
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== '/' && url.pathname !== '')
  ) {
    throw transportError('invalid_line_pay_gateway_url')
  }

  if (environment === 'production' && url.protocol !== 'https:') {
    throw transportError('invalid_line_pay_gateway_url')
  }

  return new URL(LINE_PAY_GATEWAY_PROXY_PATH, url.origin).toString()
}

export function getLinePayTransportConfig(
  env: LinePayTransportEnv,
  environmentValue?: string | null,
): LinePayTransportConfig {
  const modeValue = getEnvValue(env, 'LINE_PAY_TRANSPORT').toLowerCase()
  const mode = modeValue || 'direct'

  if (mode === 'direct') {
    return { mode: 'direct' }
  }

  if (mode !== 'gateway') {
    throw transportError('invalid_line_pay_transport')
  }

  const environment = normalizeLinePayEnvironment(environmentValue)
  const gatewayUrlValue = getEnvValue(env, 'LINE_PAY_GATEWAY_URL')
  const keyId = getEnvValue(env, 'LINE_PAY_GATEWAY_KEY_ID')
  const secret = getEnvValue(env, 'LINE_PAY_GATEWAY_SECRET')

  if (!gatewayUrlValue || !keyId || !secret) {
    throw transportError('missing_line_pay_gateway_config')
  }

  return {
    mode: 'gateway',
    gatewayUrl: normalizeGatewayUrl(gatewayUrlValue, environment),
    keyId,
    secret,
    timeoutMs: parseGatewayTimeout(getEnvValue(env, 'LINE_PAY_GATEWAY_TIMEOUT_MS')),
  }
}

export function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function buildGatewayCanonicalString(input: {
  method: string
  requestPath: string
  timestamp: string
  nonce: string
  bodyText: string
}) {
  return [
    input.method.toUpperCase(),
    input.requestPath,
    input.timestamp,
    input.nonce,
    sha256Hex(input.bodyText),
  ].join('\n')
}

export function signGatewayRequest(secret: string, canonicalString: string) {
  const normalizedSecret = secret.trim()

  if (!normalizedSecret) {
    throw transportError('missing_line_pay_gateway_config')
  }

  return createHmac('sha256', normalizedSecret).update(canonicalString).digest('hex')
}

function normalizeTransactionId(value: string | null | undefined) {
  const normalized = value?.trim() ?? ''

  if (!/^\d{1,32}$/.test(normalized)) {
    throw transportError('invalid_line_pay_transport_target')
  }

  return normalized
}

function normalizeOrderId(value: string | null | undefined) {
  const normalized = value?.trim() ?? ''

  if (!/^[A-Za-z0-9_-]{1,100}$/.test(normalized)) {
    throw transportError('invalid_line_pay_transport_target')
  }

  return normalized
}

function buildExpectedTarget(input: SendLinePayRequestInput) {
  if (input.operation === 'request') {
    return {
      method: 'POST' as const,
      apiPath: '/v3/payments/request',
      queryString: '',
    }
  }

  if (input.operation === 'confirm') {
    const transactionId = normalizeTransactionId(input.transactionId)

    return {
      method: 'POST' as const,
      apiPath: `/v3/payments/${transactionId}/confirm`,
      queryString: '',
    }
  }

  if (input.operation === 'status') {
    const transactionId = normalizeTransactionId(input.transactionId)

    return {
      method: 'GET' as const,
      apiPath: `/v3/payments/requests/${transactionId}/check`,
      queryString: '',
    }
  }

  const query = new URLSearchParams()

  if (input.transactionId) {
    query.set('transactionId', normalizeTransactionId(input.transactionId))
  }

  if (input.orderId) {
    query.set('orderId', normalizeOrderId(input.orderId))
  }

  if (!query.size) {
    throw transportError('invalid_line_pay_transport_target')
  }

  return {
    method: 'GET' as const,
    apiPath: '/v3/payments',
    queryString: query.toString(),
  }
}

function assertFixedTarget(input: SendLinePayRequestInput) {
  const expected = buildExpectedTarget(input)

  if (
    input.method !== expected.method ||
    input.apiPath !== expected.apiPath ||
    (input.queryString ?? '') !== expected.queryString
  ) {
    throw transportError('invalid_line_pay_transport_target')
  }
}

function buildDirectUrl(environment: LinePayEnvironment, input: SendLinePayRequestInput) {
  const query = input.queryString ? `?${input.queryString}` : ''
  return `${getLinePayBaseUrl(environment)}${input.apiPath}${query}`
}

function normalizeGatewayError(payload: unknown) {
  if (isRecord(payload) && typeof payload.error === 'string' && payload.error.includes('timeout')) {
    return 'line_pay_gateway_upstream_timeout'
  }

  return 'line_pay_gateway_request_failed'
}

export async function sendLinePayRequest(input: SendLinePayRequestInput): Promise<LinePayTransportResponse> {
  if (typeof input.fetchFn !== 'function') {
    throw transportError('missing_line_pay_fetch')
  }

  assertFixedTarget(input)

  const environment = normalizeLinePayEnvironment(input.environment)
  const config = getLinePayTransportConfig(input.transportEnv ?? process.env, environment)

  if (config.mode === 'direct') {
    return input.fetchFn(buildDirectUrl(environment, input), {
      method: input.method,
      headers: input.linePayHeaders,
      ...(input.bodyText !== undefined ? { body: input.bodyText } : {}),
    })
  }

  const requestId = (input.createRequestId ?? randomUUID)()
  const nonce = (input.createNonce ?? randomUUID)()
  const timestamp = String(Math.floor((input.now ?? Date.now)() / 1_000))
  const gatewayBody = JSON.stringify({
    operation: input.operation,
    environment,
    requestId,
    ...(input.transactionId ? { transactionId: input.transactionId } : {}),
    ...(input.orderId ? { orderId: input.orderId } : {}),
    ...(input.bodyText !== undefined ? { bodyText: input.bodyText } : {}),
    linePayHeaders: input.linePayHeaders,
  })
  const canonicalString = buildGatewayCanonicalString({
    method: 'POST',
    requestPath: LINE_PAY_GATEWAY_PROXY_PATH,
    timestamp,
    nonce,
    bodyText: gatewayBody,
  })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
  let response: LinePayTransportResponse
  let payload: unknown

  try {
    try {
      response = await input.fetchFn(config.gatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gateway-key-id': config.keyId,
          'x-gateway-timestamp': timestamp,
          'x-gateway-nonce': nonce,
          'x-gateway-request-id': requestId,
          'x-gateway-signature': signGatewayRequest(config.secret, canonicalString),
        },
        body: gatewayBody,
        signal: controller.signal,
        redirect: 'error',
      })
    } catch {
      if (controller.signal.aborted) throw transportError('line_pay_gateway_timeout')
      throw transportError('line_pay_gateway_unavailable')
    }

    try {
      payload = await response.json()
    } catch {
      if (controller.signal.aborted) throw transportError('line_pay_gateway_timeout')
      throw transportError('invalid_line_pay_gateway_response')
    }
  } finally {
    clearTimeout(timeout)
  }

  if (!isRecord(payload) || payload.ok !== true || typeof payload.upstreamStatus !== 'number' || !('body' in payload)) {
    throw transportError(normalizeGatewayError(payload))
  }

  const success = payload as unknown as GatewaySuccessResponse

  return {
    status: success.upstreamStatus,
    json: async () => success.body,
  }
}
