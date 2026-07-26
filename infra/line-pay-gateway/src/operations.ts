import { GatewayHttpError } from './errors.js'
import type { GatewayEnvironment } from './security.js'

export type GatewayOperation = 'request' | 'confirm' | 'status' | 'paymentDetails'

// LINE Pay's documented read-timeout minimums plus a fixed five-second service margin.
const GATEWAY_OPERATION_UPSTREAM_TIMEOUT_MS: Readonly<Record<GatewayOperation, number>> = Object.freeze({
  request: 15_000,
  confirm: 45_000,
  status: 25_000,
  paymentDetails: 25_000,
})

export type GatewayProxyPayload = {
  operation: GatewayOperation
  environment: GatewayEnvironment
  requestId: string
  transactionId?: string
  orderId?: string
  bodyText?: string
  linePayHeaders: Record<string, string>
}

export function getGatewayOperationUpstreamTimeoutMs(
  operation: GatewayOperation,
  configuredMinimumMs: number,
) {
  return Math.max(GATEWAY_OPERATION_UPSTREAM_TIMEOUT_MS[operation], configuredMinimumMs)
}

export type LinePayTarget = {
  method: 'GET' | 'POST'
  url: URL
  headers: Record<string, string>
  bodyText?: string
}

const SANDBOX_BASE_URL = 'https://sandbox-api-pay.line.me'
const PRODUCTION_BASE_URL = 'https://api-pay.line.me'
const ALLOWED_PAYLOAD_KEYS = new Set([
  'operation',
  'environment',
  'requestId',
  'transactionId',
  'orderId',
  'bodyText',
  'linePayHeaders',
])
const ALLOWED_LINE_PAY_HEADERS = new Set([
  'content-type',
  'x-line-channelid',
  'x-line-authorization',
  'x-line-authorization-nonce',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseRequiredString(value: unknown, pattern: RegExp) {
  if (typeof value !== 'string' || !pattern.test(value)) throw new GatewayHttpError(400, 'invalid_request')
  return value
}

function parseOptionalString(value: unknown, pattern: RegExp) {
  if (value === undefined) return undefined
  return parseRequiredString(value, pattern)
}

function parseLinePayHeaders(value: unknown) {
  if (!isRecord(value)) throw new GatewayHttpError(400, 'invalid_request')
  const normalized: Record<string, string> = {}

  for (const [name, headerValue] of Object.entries(value)) {
    const normalizedName = name.toLowerCase()
    if (
      !ALLOWED_LINE_PAY_HEADERS.has(normalizedName) ||
      typeof headerValue !== 'string' ||
      !headerValue.trim() ||
      headerValue.length > 4_096 ||
      normalized[normalizedName]
    ) {
      throw new GatewayHttpError(400, 'invalid_line_pay_headers')
    }
    normalized[normalizedName] = headerValue
  }

  for (const required of ALLOWED_LINE_PAY_HEADERS) {
    if (!normalized[required]) throw new GatewayHttpError(400, 'invalid_line_pay_headers')
  }

  if (normalized['content-type']?.toLowerCase() !== 'application/json') {
    throw new GatewayHttpError(400, 'invalid_line_pay_headers')
  }
  return normalized
}

export function parseGatewayPayload(bodyText: string): GatewayProxyPayload {
  let value: unknown
  try {
    value = JSON.parse(bodyText)
  } catch {
    throw new GatewayHttpError(400, 'invalid_json')
  }

  if (!isRecord(value) || Object.keys(value).some((key) => !ALLOWED_PAYLOAD_KEYS.has(key))) {
    throw new GatewayHttpError(400, 'invalid_request')
  }

  const operation = value.operation
  if (!['request', 'confirm', 'status', 'paymentDetails'].includes(String(operation))) {
    throw new GatewayHttpError(400, 'invalid_operation')
  }
  if (value.environment !== 'sandbox' && value.environment !== 'production') {
    throw new GatewayHttpError(400, 'invalid_environment')
  }

  const payload: GatewayProxyPayload = {
    operation: operation as GatewayOperation,
    environment: value.environment,
    requestId: parseRequiredString(value.requestId, /^[A-Za-z0-9_-]{8,128}$/),
    linePayHeaders: parseLinePayHeaders(value.linePayHeaders),
  }
  const transactionId = parseOptionalString(value.transactionId, /^\d{1,32}$/)
  const orderId = parseOptionalString(value.orderId, /^[A-Za-z0-9_-]{1,100}$/)
  if (transactionId !== undefined) payload.transactionId = transactionId
  if (orderId !== undefined) payload.orderId = orderId

  if (value.bodyText !== undefined) {
    if (typeof value.bodyText !== 'string' || Buffer.byteLength(value.bodyText, 'utf8') > 60 * 1024) {
      throw new GatewayHttpError(400, 'invalid_request_body')
    }
    try {
      const parsedBody = JSON.parse(value.bodyText)
      if (!isRecord(parsedBody)) throw new Error('not_object')
    } catch {
      throw new GatewayHttpError(400, 'invalid_request_body')
    }
    payload.bodyText = value.bodyText
  }

  return payload
}

function requireTransactionId(payload: GatewayProxyPayload) {
  if (!payload.transactionId) throw new GatewayHttpError(400, 'invalid_operation_target')
  return payload.transactionId
}

function assertBody(payload: GatewayProxyPayload, required: boolean) {
  if (required !== (payload.bodyText !== undefined)) throw new GatewayHttpError(400, 'invalid_operation_target')
}

export function buildLinePayTarget(payload: GatewayProxyPayload, configuredEnvironment: GatewayEnvironment): LinePayTarget {
  if (payload.environment !== configuredEnvironment) throw new GatewayHttpError(400, 'environment_mismatch')

  const baseUrl = configuredEnvironment === 'production' ? PRODUCTION_BASE_URL : SANDBOX_BASE_URL
  let method: 'GET' | 'POST'
  let path: string

  if (payload.operation === 'request') {
    method = 'POST'
    path = '/v3/payments/request'
    assertBody(payload, true)
    if (payload.transactionId || payload.orderId) throw new GatewayHttpError(400, 'invalid_operation_target')
  } else if (payload.operation === 'confirm') {
    method = 'POST'
    path = `/v3/payments/${requireTransactionId(payload)}/confirm`
    assertBody(payload, true)
    if (payload.orderId) throw new GatewayHttpError(400, 'invalid_operation_target')
  } else if (payload.operation === 'status') {
    method = 'GET'
    path = `/v3/payments/requests/${requireTransactionId(payload)}/check`
    assertBody(payload, false)
    if (payload.orderId) throw new GatewayHttpError(400, 'invalid_operation_target')
  } else {
    method = 'GET'
    assertBody(payload, false)
    if (!payload.transactionId && !payload.orderId) throw new GatewayHttpError(400, 'invalid_operation_target')
    const query = new URLSearchParams()
    if (payload.transactionId) query.set('transactionId', payload.transactionId)
    if (payload.orderId) query.set('orderId', payload.orderId)
    path = `/v3/payments?${query.toString()}`
  }

  const url = new URL(path, baseUrl)
  const expectedHostname = configuredEnvironment === 'production' ? 'api-pay.line.me' : 'sandbox-api-pay.line.me'
  if (url.protocol !== 'https:' || url.hostname !== expectedHostname || url.port) {
    throw new GatewayHttpError(500, 'unsafe_upstream_target')
  }

  return {
    method,
    url,
    headers: payload.linePayHeaders,
    ...(payload.bodyText !== undefined ? { bodyText: payload.bodyText } : {}),
  }
}
