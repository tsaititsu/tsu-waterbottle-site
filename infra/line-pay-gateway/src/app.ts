import { GatewayHttpError } from './errors.js'
import { readProxyClientIp } from './client-address.js'
import {
  buildLinePayTarget,
  getGatewayOperationUpstreamTimeoutMs,
  parseGatewayPayload,
  type GatewayProxyPayload,
} from './operations.js'
import { authenticateProxyRequest } from './proxy-auth.js'
import {
  authenticateGatewayRequest,
  FixedWindowRateLimiter,
  GATEWAY_PROXY_PATH,
  MAX_GATEWAY_BODY_BYTES,
  ReplayCache,
  type GatewayConfig,
} from './security.js'

export type GatewayRequest = {
  method: string
  path: string
  headers: Record<string, string | undefined>
  bodyText: string
  rawBody?: Uint8Array
  bodyByteLength?: number
  remoteAddress?: string
}

export type GatewayResponse = { statusCode: number; body: Record<string, unknown> }

export type GatewayLogEntry = {
  requestId: string | null
  operation: string | null
  orderId: string | null
  transactionId: string | null
  statusCode: number
  elapsedMs: number
}

export type GatewayUpstreamResponse = { status: number; text: () => Promise<string> }

export type GatewayUpstreamFetch = (
  url: string,
  init: {
    method: 'GET' | 'POST'
    headers: Record<string, string>
    body?: string
    signal: AbortSignal
    redirect: 'error'
  },
) => Promise<GatewayUpstreamResponse>

export type GatewayTimeoutScheduler = {
  schedule: (callback: () => void, delayMs: number) => unknown
  clear: (handle: unknown) => void
}

export type GatewayDependencies = {
  fetchFn: GatewayUpstreamFetch
  now?: () => number
  replayCache?: ReplayCache
  rateLimiter?: FixedWindowRateLimiter
  logger?: (entry: GatewayLogEntry) => void
  timeoutScheduler?: GatewayTimeoutScheduler
}

const systemTimeoutScheduler: GatewayTimeoutScheduler = {
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

function isJsonContentType(value: string | undefined) {
  return value?.split(';', 1)[0]?.trim().toLowerCase() === 'application/json'
}

const LINE_PAY_NUMERIC_IDENTIFIER_KEYS = new Set([
  'transactionId',
  'refundTransactionId',
])

function isJsonWhitespace(value: string | undefined) {
  return value === ' ' || value === '\n' || value === '\r' || value === '\t'
}

function jsonStringEnd(value: string, start: number) {
  for (let index = start + 1; index < value.length; index += 1) {
    if (value[index] === '\\') {
      index += 1
      continue
    }
    if (value[index] === '"') return index
  }
  return -1
}

function preserveLinePayNumericIdentifiers(value: string) {
  let output = ''
  let copiedThrough = 0

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '"') continue

    const end = jsonStringEnd(value, index)
    if (end === -1) break

    let key: unknown = null
    try {
      key = JSON.parse(value.slice(index, end + 1))
    } catch {
      index = end
      continue
    }

    let colon = end + 1
    while (isJsonWhitespace(value[colon])) colon += 1
    if (
      typeof key !== 'string'
      || !LINE_PAY_NUMERIC_IDENTIFIER_KEYS.has(key)
      || value[colon] !== ':'
    ) {
      index = end
      continue
    }

    let numberStart = colon + 1
    while (isJsonWhitespace(value[numberStart])) numberStart += 1
    let numberEnd = numberStart
    while (/\d/.test(value[numberEnd] ?? '')) numberEnd += 1
    const digits = value.slice(numberStart, numberEnd)
    const delimiter = value[numberEnd]
    if (
      digits.length === 0
      || digits.length > 128
      || !(
        delimiter === ','
        || delimiter === '}'
        || delimiter === ']'
        || isJsonWhitespace(delimiter)
      )
    ) {
      index = end
      continue
    }

    output += value.slice(copiedThrough, numberStart)
    output += `"${digits}"`
    copiedThrough = numberEnd
    index = numberEnd - 1
  }

  return output + value.slice(copiedThrough)
}

function errorResponse(error: unknown): GatewayResponse {
  if (error instanceof GatewayHttpError) {
    return { statusCode: error.statusCode, body: { ok: false, error: error.code } }
  }
  return { statusCode: 500, body: { ok: false, error: 'internal_error' } }
}

async function callLinePayUpstream(
  payload: GatewayProxyPayload,
  config: GatewayConfig,
  fetchFn: GatewayUpstreamFetch,
  timeoutScheduler: GatewayTimeoutScheduler,
) {
  const target = buildLinePayTarget(payload, config.environment)
  const controller = new AbortController()
  const timeout = timeoutScheduler.schedule(
    () => controller.abort(),
    getGatewayOperationUpstreamTimeoutMs(payload.operation, config.upstreamTimeoutMs),
  )
  let response: GatewayUpstreamResponse
  let responseText: string

  try {
    try {
      response = await fetchFn(target.url.toString(), {
        method: target.method,
        headers: target.headers,
        ...(target.bodyText !== undefined ? { body: target.bodyText } : {}),
        signal: controller.signal,
        redirect: 'error',
      })
      if (controller.signal.aborted) throw new GatewayHttpError(504, 'upstream_timeout')
    } catch {
      if (controller.signal.aborted) throw new GatewayHttpError(504, 'upstream_timeout')
      throw new GatewayHttpError(502, 'upstream_unavailable')
    }

    try {
      responseText = await response.text()
      if (controller.signal.aborted) throw new GatewayHttpError(504, 'upstream_timeout')
    } catch {
      if (controller.signal.aborted) throw new GatewayHttpError(504, 'upstream_timeout')
      throw new GatewayHttpError(502, 'invalid_upstream_response')
    }
  } finally {
    timeoutScheduler.clear(timeout)
  }

  let body: unknown
  try {
    body = JSON.parse(preserveLinePayNumericIdentifiers(responseText))
  } catch {
    throw new GatewayHttpError(502, 'invalid_upstream_json')
  }

  return { statusCode: 200, body: { ok: true, upstreamStatus: response.status, body } } satisfies GatewayResponse
}

export function createGatewayHandler(config: GatewayConfig, dependencies: GatewayDependencies) {
  const now = dependencies.now ?? Date.now
  const replayCache = dependencies.replayCache ?? new ReplayCache()
  const rateLimiter = dependencies.rateLimiter ?? new FixedWindowRateLimiter()
  const logger = dependencies.logger ?? ((entry: GatewayLogEntry) => console.info(JSON.stringify(entry)))
  const timeoutScheduler = dependencies.timeoutScheduler ?? systemTimeoutScheduler

  return async function handleGatewayRequest(request: GatewayRequest): Promise<GatewayResponse> {
    const startedAt = now()
    let payload: GatewayProxyPayload | null = null
    let requestId: string | null = null
    let response: GatewayResponse

    try {
      if (request.method === 'GET' && request.path === '/health') {
        return { statusCode: 200, body: { ok: true, status: 'healthy' } }
      }
      if (request.path !== GATEWAY_PROXY_PATH) throw new GatewayHttpError(404, 'not_found')
      if (request.method !== 'POST') throw new GatewayHttpError(405, 'method_not_allowed')
      if ((request.bodyByteLength ?? Buffer.byteLength(request.bodyText, 'utf8')) > MAX_GATEWAY_BODY_BYTES) {
        throw new GatewayHttpError(413, 'body_too_large')
      }
      if (!isJsonContentType(request.headers['content-type'])) {
        throw new GatewayHttpError(415, 'unsupported_media_type')
      }

      authenticateProxyRequest(request.headers, config.proxyToken)
      const effectiveClientAddress = readProxyClientIp(request.headers)
      if (!rateLimiter.take(effectiveClientAddress, startedAt, config.rateLimitWindowMs, config.rateLimitMax)) {
        throw new GatewayHttpError(429, 'rate_limited')
      }

      const rawBody = request.rawBody ?? Buffer.from(request.bodyText, 'utf8')
      if (!Buffer.from(rawBody).equals(Buffer.from(request.bodyText, 'utf8'))) {
        throw new GatewayHttpError(400, 'invalid_json_encoding')
      }

      const auth = authenticateGatewayRequest({
        config,
        headers: request.headers,
        method: request.method,
        requestPath: request.path,
        rawBody,
        nowMs: startedAt,
      })
      requestId = auth.requestId
      if (!replayCache.claim(auth.nonce, auth.requestId, startedAt, config.replayTtlSeconds)) {
        throw new GatewayHttpError(409, 'replay_detected')
      }

      payload = parseGatewayPayload(request.bodyText)
      if (payload.requestId !== auth.requestId) throw new GatewayHttpError(401, 'unauthorized')
      response = await callLinePayUpstream(payload, config, dependencies.fetchFn, timeoutScheduler)
    } catch (error) {
      response = errorResponse(error)
    }

    logger({
      requestId,
      operation: payload?.operation ?? null,
      orderId: payload?.orderId ?? null,
      transactionId: payload?.transactionId ?? null,
      statusCode: response.statusCode,
      elapsedMs: Math.max(0, now() - startedAt),
    })
    return response
  }
}
