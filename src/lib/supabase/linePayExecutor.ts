import 'server-only'

import { createClient } from '@supabase/supabase-js'
import type { ProductOrderLinePayCapabilityRpcClient } from './linePayCapabilityRuntime'

type ExecutorEnv = {
  readonly [key: string]: string | undefined
  NEXT_PUBLIC_SUPABASE_URL?: string
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string
  SUPABASE_LINE_PAY_EXECUTOR_JWT?: string
}

type ExecutorClientOptions = {
  auth: {
    autoRefreshToken: false
    persistSession: false
  }
  global: {
    headers: { Authorization: string }
  }
}

type SupabaseClientFactory = (
  url: string,
  anonKey: string,
  options: ExecutorClientOptions,
) => ProductOrderLinePayCapabilityRpcClient

const JWT_ALGORITHMS = new Set(['ES256', 'HS256', 'RS256'])

function invalidConfig(): never {
  throw new Error('line_pay_executor_config_invalid')
}

function decodeJwtPart(value: string) {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    )
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      invalidConfig()
    }
    return parsed as Record<string, unknown>
  } catch {
    invalidConfig()
  }
}

function requireExecutorJwt(value: string | undefined) {
  if (typeof value !== 'string' || value.length < 32 || value.length > 8192) {
    invalidConfig()
  }
  const parts = value.split('.')
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    invalidConfig()
  }
  const header = decodeJwtPart(parts[0]!)
  const claims = decodeJwtPart(parts[1]!)
  const nowSeconds = Math.floor(Date.now() / 1000)
  if (
    typeof header.alg !== 'string'
    || !JWT_ALGORITHMS.has(header.alg)
    || claims.aud !== 'authenticated'
    || claims.role !== 'line_pay_payment_executor'
    || typeof claims.exp !== 'number'
    || !Number.isSafeInteger(claims.exp)
    || claims.exp <= nowSeconds
  ) {
    invalidConfig()
  }
  return value
}

export function createLinePayExecutorClient(
  env: ExecutorEnv = process.env,
  createClientFn: SupabaseClientFactory = (url, anonKey, options) =>
    createClient(url, anonKey, options),
) {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (
    typeof supabaseUrl !== 'string'
    || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabaseUrl)
    || typeof anonKey !== 'string'
    || anonKey.length === 0
  ) {
    invalidConfig()
  }
  const executorJwt = requireExecutorJwt(env.SUPABASE_LINE_PAY_EXECUTOR_JWT)

  return createClientFn(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: `Bearer ${executorJwt}` },
    },
  })
}
