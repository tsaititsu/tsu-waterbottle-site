import { createCipheriv, createDecipheriv, createHash, timingSafeEqual } from 'node:crypto'

export type NewebPayParamValue = string | number | boolean | null | undefined

function assertCipherSecret(name: string, value: string, bytes: number) {
  if (Buffer.byteLength(value, 'utf8') !== bytes) {
    throw new Error(`${name} must be ${bytes} bytes for AES-256-CBC`)
  }
}

function toQueryValue(value: Exclude<NewebPayParamValue, null | undefined>) {
  if (typeof value === 'boolean') return value ? '1' : '0'
  return String(value)
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

  const decipher = createDecipheriv('aes-256-cbc', Buffer.from(hashKey, 'utf8'), Buffer.from(hashIv, 'utf8'))
  return decipher.update(encryptedTradeInfo, 'hex', 'utf8') + decipher.final('utf8')
}

export function createTradeSha(
  encryptedTradeInfo: string,
  hashKey: string,
  hashIv: string
): string {
  const text = `HashKey=${hashKey}&${encryptedTradeInfo}&HashIV=${hashIv}`
  return createHash('sha256').update(text).digest('hex').toUpperCase()
}

export function verifyTradeSha(
  encryptedTradeInfo: string,
  tradeSha: string,
  hashKey: string,
  hashIv: string
): boolean {
  const expected = createTradeSha(encryptedTradeInfo, hashKey, hashIv)
  const normalizedTradeSha = tradeSha.toUpperCase()

  if (expected.length !== normalizedTradeSha.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(normalizedTradeSha))
}
