import { GatewayHttpError } from './errors.js'
import { buildLinePayTarget, parseGatewayPayload, type GatewayProxyPayload } from './operations.js'
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

export type GatewayDependencies = {
  fetchFn: GatewayUpstreamFetch
  now?: () => number
  replayCache?: ReplayCache
  rateLimiter?: FixedWindowRateLimiter
  logger?: (entry: GatewayLogEntry) => void
}

function isJsonContentType(value: string | undefined) {
  return value?.split(';', 1)[0]?.trim().toLowerCase() === 'application/json'
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
) {
  const target = buildLinePayTarget(payload, config.environment)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.upstreamTimeoutMs)
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
    } catch {
      if (controller.signal.aborted) throw new GatewayHttpError(504, 'upstream_timeout')
      throw new GatewayHttpError(502, 'upstream_unavailable')
    }

    try {
      responseText = await response.text()
    } catch {
      if (controller.signal.aborted) throw new GatewayHttpError(504, 'upstream_timeout')
      throw new GatewayHttpError(502, 'invalid_upstream_response')
    }
  } finally {
    clearTimeout(timeout)
  }

  let body: unknown
  try {
    body = JSON.parse(responseText)
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

      const rawBody = request.rawBody ?? Buffer.from(request.bodyText, 'utf8')
      if (!Buffer.from(rawBody).equals(Buffer.from(request.bodyText, 'utf8'))) {
        throw new GatewayHttpError(400, 'invalid_json_encoding')
      }

      const rateLimitKey = request.remoteAddress ?? 'unknown'
      if (!rateLimiter.take(rateLimitKey, startedAt, config.rateLimitWindowMs, config.rateLimitMax)) {
        throw new GatewayHttpError(429, 'rate_limited')
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
      response = await callLinePayUpstream(payload, config, dependencies.fetchFn)
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
