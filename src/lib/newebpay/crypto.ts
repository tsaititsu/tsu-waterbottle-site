import { createCipheriv, createDecipheriv, createHash, timingSafeEqual } from 'node:crypto'

export type NewebPayParamValue = string | number | boolean | null | undefined

export type EncryptedTradeInfoDiagnostics = {
  tradeInfoLength: number
  tradeInfoIsHex: boolean
  tradeInfoHexLengthIsEven: boolean
  tradeInfoHexLengthMultipleOf32: boolean
  tradeInfoFingerprint: string
  tradeShaLength: number
  tradeShaLooksSha256: boolean
}

function assertCipherSecret(name: string, value: string, bytes: number) {
  if (Buffer.byteLength(value, 'utf8') !== bytes) {
    throw new Error(`${name} must be ${bytes} bytes for AES-256-CBC`)
  }
}

function toQueryValue(value: Exclude<NewebPayParamValue, null | undefined>) {
  if (typeof value === 'boolean') return value ? '1' : '0'
  return String(value)
}

function isHex(value: string) {
  return /^[0-9a-fA-F]+$/.test(value)
}

export function normalizeEncryptedTradeInfo(input: string): string {
  const trimmed = input.trim().replace(/[\r\n]/g, '')

  if (/%[0-9a-fA-F]{2}/.test(trimmed)) {
    try {
      return decodeURIComponent(trimmed).trim().replace(/[\r\n]/g, '')
    } catch {
      return trimmed
    }
  }

  return trimmed
}

export function getEncryptedTradeInfoDiagnostics(
  encryptedTradeInfo: string,
  tradeSha = '',
): EncryptedTradeInfoDiagnostics {
  const normalizedTradeInfo = normalizeEncryptedTradeInfo(encryptedTradeInfo)
  const normalizedTradeSha = tradeSha.trim()

  return {
    tradeInfoLength: normalizedTradeInfo.length,
    tradeInfoIsHex: isHex(normalizedTradeInfo),
    tradeInfoHexLengthIsEven: normalizedTradeInfo.length % 2 === 0,
    tradeInfoHexLengthMultipleOf32: normalizedTradeInfo.length % 32 === 0,
    tradeInfoFingerprint: createHash('sha256').update(normalizedTradeInfo).digest('hex').slice(0, 12),
    tradeShaLength: normalizedTradeSha.length,
    tradeShaLooksSha256: /^[0-9a-fA-F]{64}$/.test(normalizedTradeSha),
  }
}

export function buildQueryString(params: Record<string, NewebPayParamValue>): string {
  const query = new URLSearchParams()

  for (const key of Object.keys(params).sort()) {
    const value = params[key]
    if (value === undefined || value === null) continue
    query.set(key, toQueryValue(value))
  }

  return query.toString()
}

export function encryptTradeInfo(
  params: Record<string, NewebPayParamValue>,
  hashKey: string,
  hashIv: string
): string {
  assertCipherSecret('NEWEBPAY_HASH_KEY', hashKey, 32)
  assertCipherSecret('NEWEBPAY_HASH_IV', hashIv, 16)

  const cipher = createCipheriv('aes-256-cbc', Buffer.from(hashKey, 'utf8'), Buffer.from(hashIv, 'utf8'))
  return cipher.update(buildQueryString(params), 'utf8', 'hex') + cipher.final('hex')
}

export function decryptTradeInfo(
  encryptedTradeInfo: string,
  hashKey: string,
  hashIv: string
): string {
  assertCipherSecret('NEWEBPAY_HASH_KEY', hashKey, 32)
  assertCipherSecret('NEWEBPAY_HASH_IV', hashIv, 16)

  const normalizedTradeInfo = normalizeEncryptedTradeInfo(encryptedTradeInfo)
  if (!isHex(normalizedTradeInfo)) {
    throw new Error('TradeInfo must be hex encoded')
  }
  if (normalizedTradeInfo.length % 2 !== 0) {
    throw new Error('TradeInfo hex length must be even')
  }
  if (normalizedTradeInfo.length % 32 !== 0) {
    throw new Error('TradeInfo hex length must be a multiple of 32')
  }

  const decipher = createDecipheriv('aes-256-cbc', Buffer.from(hashKey, 'utf8'), Buffer.from(hashIv, 'utf8'))
  decipher.setAutoPadding(true)
  return Buffer.concat([
    decipher.update(Buffer.from(normalizedTradeInfo, 'hex')),
    decipher.final(),
  ]).toString('utf8')
}

export function createTradeSha(
  encryptedTradeInfo: string,
  hashKey: string,
  hashIv: string
): string {
  const text = `HashKey=${hashKey}&${normalizeEncryptedTradeInfo(encryptedTradeInfo)}&HashIV=${hashIv}`
  return createHash('sha256').update(text).digest('hex').toUpperCase()
}

export function verifyTradeSha(
  encryptedTradeInfo: string,
  tradeSha: string,
  hashKey: string,
  hashIv: string
): boolean {
  const expected = createTradeSha(encryptedTradeInfo, hashKey, hashIv)
  const normalizedTradeSha = tradeSha.trim().toUpperCase()

  if (expected.length !== normalizedTradeSha.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(normalizedTradeSha))
}
