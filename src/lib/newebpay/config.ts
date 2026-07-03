import 'server-only'

import type { NewebPayConfig, NewebPayEnv } from './types'

export type { NewebPayEnv } from './types'

const testEndpoint = 'https://ccore.newebpay.com/MPG/mpg_gateway'
const productionEndpoint = 'https://core.newebpay.com/MPG/mpg_gateway'
const defaultVersion = '2.3'
const defaultSiteUrl = 'http://localhost:3000'

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required NewebPay environment variable: ${name}`)
  }
  return value
}

export function parseNewebPayEnv(value = process.env.NEWEBPAY_ENV): NewebPayEnv {
  if (!value) return 'test'
  if (value === 'test' || value === 'production') return value
  if (value === 'sandbox') return 'test'
  throw new Error('NEWEBPAY_ENV must be either "test" or "production"')
}

export function getNewebPayMpgEndpoint(env: NewebPayEnv) {
  return env === 'production' ? productionEndpoint : testEndpoint
}

function normalizeUrl(value: string) {
  return value.replace(/\/$/, '')
}

function getSiteUrl() {
  return normalizeUrl(process.env.PUBLIC_TUNNEL_URL || process.env.NEXT_PUBLIC_SITE_URL || defaultSiteUrl)
}

export function getNewebPayConfig(): NewebPayConfig {
  const env = parseNewebPayEnv()
  const hashKey = requireEnv('NEWEBPAY_HASH_KEY')
  const hashIv = requireEnv('NEWEBPAY_HASH_IV')
  const mpgGatewayUrl = getNewebPayMpgEndpoint(env)

  if (Buffer.byteLength(hashKey, 'utf8') !== 32) {
    throw new Error('NEWEBPAY_HASH_KEY must be 32 bytes for AES-256-CBC')
  }

  if (Buffer.byteLength(hashIv, 'utf8') !== 16) {
    throw new Error('NEWEBPAY_HASH_IV must be 16 bytes for AES-256-CBC')
  }

  return {
    merchantId: requireEnv('NEWEBPAY_MERCHANT_ID'),
    hashKey,
    hashIv,
    env,
    version: process.env.NEWEBPAY_VERSION || defaultVersion,
    siteUrl: getSiteUrl(),
    mpgGatewayUrl,
    mpgEndpoint: mpgGatewayUrl,
  }
}
