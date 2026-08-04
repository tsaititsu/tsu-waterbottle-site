import { createHash, createHmac, randomUUID } from 'node:crypto'
import { isIP } from 'node:net'
import { getLinePayBaseUrl, normalizeLinePayEnvironment, type LinePayEnvironment } from './config'
import type { LinePayHttpMethod } from './signature'

export const LINE_PAY_GATEWAY_PROXY_PATH = '/v1/line-pay/proxy'
export const DEFAULT_LINE_PAY_GATEWAY_TIMEOUT_MS = 5_000

export type LinePayTransportMode = 'direct' | 'gateway'
export type LinePayTransportOperation = 'request' | 'confirm' | 'status' | 'paymentDetails'
export type LinePayTransportEnv = Record<string, string | undefined>

// LINE Pay's documented read-timeout minimums plus a fixed five-second service margin.
const LINE_PAY_DIRECT_TIMEOUT_MS: Readonly<Record<LinePayTransportOperation, number>> = Object.freeze({
  request: 15_000,
  confirm: 45_000,
  status: 25_000,
  paymentDetails: 25_000,
})

// The Gateway configured minimum is capped at 30 seconds; retain another five seconds for its response.
const LINE_PAY_GATEWAY_OPERATION_TIMEOUT_MS: Readonly<Record<LinePayTransportOperation, number>> = Object.freeze({
  request: 35_000,
  confirm: 50_000,
  status: 35_000,
  paymentDetails: 35_000,
})

export type LinePayTimeoutScheduler = {
  schedule: (callback: () => void, delayMs: number) => unknown
  clear: (handle: unknown) => void
}

const systemTimeoutScheduler: LinePayTimeoutScheduler = {
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

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
  timeoutScheduler?: LinePayTimeoutScheduler
}

type GatewaySuccessResponse = {
  ok: true
  upstreamStatus: number
  body: unknown
}

type GatewayConfig = Extract<LinePayTransportConfig, { mode: 'gateway' }>

type SignedGatewayResponse = {
  status?: number
  payload: unknown
}

export type LinePayGatewaySmokeResult = {
  ok: true
  authenticated: true
  upstreamCalled: false
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

function parseRawHttpsOrigin(value: string) {
  if (
    !/^https:\/\//i.test(value) ||
    /[\u0000-\u001f\u007f]/u.test(value) ||
    /\s/u.test(value) ||
    value.includes('%') ||
    value.includes('\\') ||
    value.includes('?') ||
    value.includes('#')
  ) {
    throw transportError('invalid_line_pay_gateway_url')
  }

  const authority = value.slice('https://'.length)
  if (!authority || authority.includes('/') || authority.includes('@')) {
    throw transportError('invalid_line_pay_gateway_url')
  }

  if (authority.startsWith('[')) {
    const closingBracket = authority.indexOf(']')
    if (closingBracket <= 1 || closingBracket !== authority.length - 1) {
      throw transportError('invalid_line_pay_gateway_url')
    }
  } else if (authority.includes(':') || authority.includes('[') || authority.includes(']')) {
    throw transportError('invalid_line_pay_gateway_url')
  }

  return value
}

function normalizeGatewayUrl(value: string) {
  let url: URL

  try {
    url = new URL(parseRawHttpsOrigin(value))
  } catch {
    throw transportError('invalid_line_pay_gateway_url')
  }

  if (
    url.protocol !== 'https:' ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.port ||
    url.pathname !== '/'
  ) {
    throw transportError('invalid_line_pay_gateway_url')
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (
    hostname.endsWith('.') ||
    isIP(hostname) !== 0 ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost')
  ) {
    throw transportError('invalid_line_pay_gateway_url')
  }

  return new URL(LINE_PAY_GATEWAY_PROXY_PATH, url.origin).toString()
}

export function getLinePayTransportConfig(
  env: LinePayTransportEnv,
  environmentValue?: string | null,
): LinePayTransportConfig {
  const modeValue = getEnvValue(env, 'LINE_PAY_TRANSPORT').toLowerCase()
  const isPreview = getEnvValue(env, 'VERCEL_ENV').toLowerCase() === 'preview'

  if (isPreview && modeValue !== 'gateway') {
    throw transportError('line_pay_preview_requires_gateway')
  }

  const mode = modeValue || 'direct'

  if (mode === 'direct') {
    return { mode: 'direct' }
  }

  if (mode !== 'gateway') {
    throw transportError('invalid_line_pay_transport')
  }

  normalizeLinePayEnvironment(environmentValue)
  const gatewayUrlValue = env.LINE_PAY_GATEWAY_URL ?? ''
  const keyId = getEnvValue(env, 'LINE_PAY_GATEWAY_KEY_ID')
  const secret = getEnvValue(env, 'LINE_PAY_GATEWAY_SECRET')

  if (!gatewayUrlValue.trim() || !keyId || !secret) {
    throw transportError('missing_line_pay_gateway_config')
  }

  return {
    mode: 'gateway',
    gatewayUrl: normalizeGatewayUrl(gatewayUrlValue),
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

function getGatewayOperationTimeoutMs(operation: LinePayTransportOperation, configuredMinimumMs: number) {
  return Math.max(LINE_PAY_GATEWAY_OPERATION_TIMEOUT_MS[operation], configuredMinimumMs)
}

async function sendDirectLinePayRequest(
  environment: LinePayEnvironment,
  input: SendLinePayRequestInput,
  fetchFn: LinePayTransportFetch,
): Promise<LinePayTransportResponse> {
  const timeoutScheduler = input.timeoutScheduler ?? systemTimeoutScheduler
  const controller = new AbortController()
  const timeout = timeoutScheduler.schedule(
    () => controller.abort(),
    LINE_PAY_DIRECT_TIMEOUT_MS[input.operation],
  )
  let response: LinePayTransportResponse

  try {
    response = await fetchFn(buildDirectUrl(environment, input), {
      method: input.method,
      headers: input.linePayHeaders,
      ...(input.bodyText !== undefined ? { body: input.bodyText } : {}),
      signal: controller.signal,
      redirect: 'error',
    })
    if (controller.signal.aborted) throw transportError('line_pay_upstream_timeout')
  } catch {
    timeoutScheduler.clear(timeout)
    if (controller.signal.aborted) throw transportError('line_pay_upstream_timeout')
    throw transportError('line_pay_upstream_unavailable')
  }

  return {
    status: response.status,
    json: async () => {
      try {
        const payload = await response.json()
        if (controller.signal.aborted) throw transportError('line_pay_upstream_timeout')
        return payload
      } catch (error) {
        if (controller.signal.aborted) throw transportError('line_pay_upstream_timeout')
        throw error
      } finally {
        timeoutScheduler.clear(timeout)
      }
    },
  }
}

const SAFE_GATEWAY_RESPONSE_ERRORS: Readonly<Record<string, string>> = Object.freeze({
  body_too_large: 'line_pay_gateway_contract_rejected',
  environment_mismatch: 'line_pay_gateway_environment_mismatch',
  internal_error: 'line_pay_gateway_internal_error',
  invalid_environment: 'line_pay_gateway_contract_rejected',
  invalid_json: 'line_pay_gateway_contract_rejected',
  invalid_json_encoding: 'line_pay_gateway_contract_rejected',
  invalid_line_pay_headers: 'line_pay_gateway_contract_rejected',
  invalid_operation: 'line_pay_gateway_contract_rejected',
  invalid_operation_target: 'line_pay_gateway_contract_rejected',
  invalid_proxy_client_ip: 'line_pay_gateway_contract_rejected',
  invalid_request: 'line_pay_gateway_contract_rejected',
  invalid_request_body: 'line_pay_gateway_contract_rejected',
  invalid_upstream_json: 'line_pay_gateway_upstream_response_invalid',
  invalid_upstream_response: 'line_pay_gateway_upstream_response_invalid',
  method_not_allowed: 'line_pay_gateway_contract_rejected',
  not_found: 'line_pay_gateway_contract_rejected',
  rate_limited: 'line_pay_gateway_rate_limited',
  replay_detected: 'line_pay_gateway_replay_detected',
  unauthorized: 'line_pay_gateway_unauthorized',
  unsafe_upstream_target: 'line_pay_gateway_internal_error',
  unsupported_media_type: 'line_pay_gateway_contract_rejected',
  upstream_timeout: 'line_pay_gateway_upstream_timeout',
  upstream_unavailable: 'line_pay_gateway_upstream_unavailable',
})

function normalizeGatewayError(payload: unknown) {
  if (
    isRecord(payload)
    && typeof payload.error === 'string'
    && Object.hasOwn(SAFE_GATEWAY_RESPONSE_ERRORS, payload.error)
  ) {
    return SAFE_GATEWAY_RESPONSE_ERRORS[payload.error]
  }

  return 'line_pay_gateway_request_failed'
}

async function sendSignedGatewayBody(input: {
  config: GatewayConfig
  bodyText: string
  requestId: string
  fetchFn: LinePayTransportFetch
  now?: () => number
  createNonce?: () => string
  timeoutMs?: number
  timeoutScheduler?: LinePayTimeoutScheduler
}): Promise<SignedGatewayResponse> {
  const nonce = (input.createNonce ?? randomUUID)()
  const timestamp = String(Math.floor((input.now ?? Date.now)() / 1_000))
  const canonicalString = buildGatewayCanonicalString({
    method: 'POST',
    requestPath: LINE_PAY_GATEWAY_PROXY_PATH,
    timestamp,
    nonce,
    bodyText: input.bodyText,
  })
  const controller = new AbortController()
  const timeoutScheduler = input.timeoutScheduler ?? systemTimeoutScheduler
  const timeout = timeoutScheduler.schedule(
    () => controller.abort(),
    input.timeoutMs ?? input.config.timeoutMs,
  )
  let response: LinePayTransportResponse
  let payload: unknown

  try {
    try {
      response = await input.fetchFn(input.config.gatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gateway-key-id': input.config.keyId,
          'x-gateway-timestamp': timestamp,
          'x-gateway-nonce': nonce,
          'x-gateway-request-id': input.requestId,
          'x-gateway-signature': signGatewayRequest(input.config.secret, canonicalString),
        },
        body: input.bodyText,
        signal: controller.signal,
        redirect: 'error',
      })
      if (controller.signal.aborted) throw transportError('line_pay_gateway_timeout')
    } catch {
      if (controller.signal.aborted) throw transportError('line_pay_gateway_timeout')
      throw transportError('line_pay_gateway_unavailable')
    }

    try {
      payload = await response.json()
      if (controller.signal.aborted) throw transportError('line_pay_gateway_timeout')
    } catch {
      if (controller.signal.aborted) throw transportError('line_pay_gateway_timeout')
      throw transportError('invalid_line_pay_gateway_response')
    }
  } finally {
    timeoutScheduler.clear(timeout)
  }

  return { status: response.status, payload }
}

export async function probeLinePayGatewayAuthentication(input: {
  fetchFn?: LinePayTransportFetch | null
  transportEnv?: LinePayTransportEnv
  now?: () => number
  createNonce?: () => string
  createRequestId?: () => string
}): Promise<LinePayGatewaySmokeResult> {
  if (typeof input.fetchFn !== 'function') {
    throw transportError('missing_line_pay_fetch')
  }

  const transportEnv = input.transportEnv ?? process.env
  if (
    getEnvValue(transportEnv, 'VERCEL_ENV').toLowerCase() !== 'preview' ||
    getEnvValue(transportEnv, 'LINE_PAY_GATEWAY_SMOKE_ENABLED').toLowerCase() !== 'true'
  ) {
    throw transportError('line_pay_gateway_smoke_unavailable')
  }

  const config = getLinePayTransportConfig(transportEnv, 'sandbox')
  if (config.mode !== 'gateway') {
    throw transportError('line_pay_gateway_smoke_requires_gateway')
  }

  const requestId = (input.createRequestId ?? randomUUID)()
  const bodyText = JSON.stringify({
    operation: 'gatewayAuthenticationSmoke',
    environment: 'sandbox',
    requestId,
    linePayHeaders: {},
  })
  const { status, payload } = await sendSignedGatewayBody({
    config,
    bodyText,
    requestId,
    fetchFn: input.fetchFn,
    now: input.now,
    createNonce: input.createNonce,
  })

  if (
    status !== 400 ||
    !isRecord(payload) ||
    payload.ok !== false ||
    payload.error !== 'invalid_operation'
  ) {
    throw transportError('line_pay_gateway_smoke_failed')
  }

  return { ok: true, authenticated: true, upstreamCalled: false }
}

export async function sendLinePayRequest(input: SendLinePayRequestInput): Promise<LinePayTransportResponse> {
  if (typeof input.fetchFn !== 'function') {
    throw transportError('missing_line_pay_fetch')
  }

  assertFixedTarget(input)

  const environment = normalizeLinePayEnvironment(input.environment)
  const config = getLinePayTransportConfig(input.transportEnv ?? process.env, environment)

  if (config.mode === 'direct') {
    return sendDirectLinePayRequest(environment, input, input.fetchFn)
  }

  const requestId = (input.createRequestId ?? randomUUID)()
  const gatewayBody = JSON.stringify({
    operation: input.operation,
    environment,
    requestId,
    ...(input.transactionId ? { transactionId: input.transactionId } : {}),
    ...(input.orderId ? { orderId: input.orderId } : {}),
    ...(input.bodyText !== undefined ? { bodyText: input.bodyText } : {}),
    linePayHeaders: input.linePayHeaders,
  })
  const { payload } = await sendSignedGatewayBody({
    config,
    bodyText: gatewayBody,
    requestId,
    fetchFn: input.fetchFn,
    now: input.now,
    createNonce: input.createNonce,
    timeoutMs: getGatewayOperationTimeoutMs(input.operation, config.timeoutMs),
    timeoutScheduler: input.timeoutScheduler,
  })

  if (!isRecord(payload) || payload.ok !== true || typeof payload.upstreamStatus !== 'number' || !('body' in payload)) {
    throw transportError(normalizeGatewayError(payload))
  }

  const success = payload as unknown as GatewaySuccessResponse

  return {
    status: success.upstreamStatus,
    json: async () => success.body,
  }
}
