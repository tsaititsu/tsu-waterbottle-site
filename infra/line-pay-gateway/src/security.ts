import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { GatewayHttpError } from './errors.js'
import { PROXY_TOKEN_PATTERN } from './proxy-auth.js'

export const GATEWAY_PROXY_PATH = '/v1/line-pay/proxy'
export const MAX_GATEWAY_BODY_BYTES = 64 * 1024

export type GatewayEnvironment = 'sandbox' | 'production'

export type GatewayConfig = {
  port: number
  environment: GatewayEnvironment
  keyId: string
  secret: string
  proxyToken: string
  upstreamTimeoutMs: number
  timestampToleranceSeconds: number
  replayTtlSeconds: number
  rateLimitWindowMs: number
  rateLimitMax: number
}

type StringEnv = Record<string, string | undefined>

function readRequired(env: StringEnv, name: string) {
  const value = env[name]?.trim() ?? ''
  if (!value) throw new Error(`missing_${name.toLowerCase()}`)
  return value
}

function readInteger(env: StringEnv, name: string, defaultValue: number, minimum: number, maximum: number) {
  const rawValue = env[name]?.trim()
  const value = rawValue ? Number(rawValue) : defaultValue

  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`invalid_${name.toLowerCase()}`)
  }

  return value
}

export function loadGatewayConfig(env: StringEnv): GatewayConfig {
  const environment = readRequired(env, 'LINE_PAY_GATEWAY_ENV')
  const secret = readRequired(env, 'LINE_PAY_GATEWAY_SECRET')
  const proxyToken = readRequired(env, 'LINE_PAY_GATEWAY_PROXY_TOKEN')
  if (environment !== 'sandbox' && environment !== 'production') throw new Error('invalid_line_pay_gateway_env')
  if (!PROXY_TOKEN_PATTERN.test(proxyToken)) throw new Error('invalid_line_pay_gateway_proxy_token')
  if (proxyToken === secret) throw new Error('proxy_token_must_differ_from_gateway_secret')

  return {
    port: readInteger(env, 'PORT', 3000, 1, 65_535),
    environment,
    keyId: readRequired(env, 'LINE_PAY_GATEWAY_KEY_ID'),
    secret,
    proxyToken,
    upstreamTimeoutMs: readInteger(env, 'LINE_PAY_UPSTREAM_TIMEOUT_MS', 5_000, 100, 30_000),
    timestampToleranceSeconds: readInteger(env, 'GATEWAY_TIMESTAMP_TOLERANCE_SECONDS', 60, 1, 300),
    replayTtlSeconds: readInteger(env, 'GATEWAY_REPLAY_TTL_SECONDS', 120, 60, 600),
    rateLimitWindowMs: readInteger(env, 'GATEWAY_RATE_LIMIT_WINDOW_MS', 60_000, 1_000, 600_000),
    rateLimitMax: readInteger(env, 'GATEWAY_RATE_LIMIT_MAX', 120, 1, 10_000),
  }
}

export function sha256Hex(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

export function buildCanonicalString(input: {
  method: string
  requestPath: string
  timestamp: string
  nonce: string
  rawBody: string | Uint8Array
}) {
  return [input.method.toUpperCase(), input.requestPath, input.timestamp, input.nonce, sha256Hex(input.rawBody)].join(
    '\n',
  )
}

function readAuthHeader(headers: Record<string, string | undefined>, name: string) {
  const value = headers[name]?.trim() ?? ''
  if (!value) throw new GatewayHttpError(401, 'unauthorized')
  return value
}

export function authenticateGatewayRequest(input: {
  config: GatewayConfig
  headers: Record<string, string | undefined>
  method: string
  requestPath: string
  rawBody: Uint8Array
  nowMs: number
}) {
  const keyId = readAuthHeader(input.headers, 'x-gateway-key-id')
  const timestamp = readAuthHeader(input.headers, 'x-gateway-timestamp')
  const nonce = readAuthHeader(input.headers, 'x-gateway-nonce')
  const requestId = readAuthHeader(input.headers, 'x-gateway-request-id')
  const signature = readAuthHeader(input.headers, 'x-gateway-signature')
  const timestampNumber = Number(timestamp)

  if (
    keyId !== input.config.keyId ||
    !/^\d{10}$/.test(timestamp) ||
    !Number.isSafeInteger(timestampNumber) ||
    Math.abs(Math.floor(input.nowMs / 1_000) - timestampNumber) > input.config.timestampToleranceSeconds ||
    !/^[A-Za-z0-9_-]{8,128}$/.test(nonce) ||
    !/^[A-Za-z0-9_-]{8,128}$/.test(requestId) ||
    !/^[a-f0-9]{64}$/.test(signature)
  ) {
    throw new GatewayHttpError(401, 'unauthorized')
  }

  const canonical = buildCanonicalString({
    method: input.method,
    requestPath: input.requestPath,
    timestamp,
    nonce,
    rawBody: input.rawBody,
  })
  const expected = createHmac('sha256', input.config.secret).update(canonical).digest()
  const provided = Buffer.from(signature, 'hex')

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new GatewayHttpError(401, 'unauthorized')
  }

  return { nonce, requestId }
}

export class ReplayCache {
  private readonly entries = new Map<string, number>()

  claim(nonce: string, requestId: string, nowMs: number, ttlSeconds: number) {
    for (const [key, expiresAt] of this.entries) {
      if (expiresAt <= nowMs) this.entries.delete(key)
    }

    const nonceKey = `nonce:${nonce}`
    const requestIdKey = `request:${requestId}`
    if (this.entries.has(nonceKey) || this.entries.has(requestIdKey)) return false

    const expiresAt = nowMs + ttlSeconds * 1_000
    this.entries.set(nonceKey, expiresAt)
    this.entries.set(requestIdKey, expiresAt)
    return true
  }
}

type RateBucket = { startedAt: number; count: number }

export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, RateBucket>()

  take(key: string, nowMs: number, windowMs: number, maximum: number) {
    for (const [bucketKey, bucket] of this.buckets) {
      if (nowMs - bucket.startedAt >= windowMs) this.buckets.delete(bucketKey)
    }

    const existing = this.buckets.get(key)

    if (!existing || nowMs - existing.startedAt >= windowMs) {
      this.buckets.set(key, { startedAt: nowMs, count: 1 })
      return true
    }

    if (existing.count >= maximum) return false
    existing.count += 1
    return true
  }
}
