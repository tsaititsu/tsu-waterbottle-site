import 'server-only'

import type { NewebPayConfig, NewebPayEnv } from './types'

const sandboxEndpoint = 'https://ccore.newebpay.com/MPG/mpg_gateway'
const productionEndpoint = 'https://core.newebpay.com/MPG/mpg_gateway'

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required NewebPay environment variable: ${name}`)
  }
  return value
}

export function parseNewebPayEnv(value = process.env.NEWEBPAY_ENV): NewebPayEnv {
  if (!value) return 'sandbox'
  if (value === 'sandbox' || value === 'production') return value
  throw new Error('NEWEBPAY_ENV must be either "sandbox" or "production"')
}

export function getNewebPayMpgEndpoint(env: NewebPayEnv) {
  return env === 'production' ? productionEndpoint : sandboxEndpoint
}

export function getNewebPayConfig(): NewebPayConfig {
  const env = parseNewebPayEnv()
  const hashKey = requireEnv('NEWEBPAY_HASH_KEY')
  const hashIv = requireEnv('NEWEBPAY_HASH_IV')

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
    siteUrl: requireEnv('NEXT_PUBLIC_SITE_URL').replace(/\/$/, ''),
    mpgEndpoint: getNewebPayMpgEndpoint(env),
  }
}
