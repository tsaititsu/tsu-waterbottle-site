const MISSING_VALUE = '未提供'

function normalize(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : ''
}

function characters(value: string) {
  return Array.from(value)
}

export function maskIdentifier(value: string | null | undefined) {
  const normalized = normalize(value)
  if (!normalized) return MISSING_VALUE

  const parts = characters(normalized)
  if (parts.length <= 2) return '•'.repeat(parts.length)
  if (parts.length <= 8) return `${parts[0]}…${parts.at(-1)}`
  return `${parts.slice(0, 4).join('')}…${parts.slice(-4).join('')}`
}

export function maskEmail(value: string | null | undefined) {
  const normalized = normalize(value)
  if (!normalized) return MISSING_VALUE

  const atIndex = normalized.lastIndexOf('@')
  if (atIndex <= 0 || atIndex === normalized.length - 1) {
    return maskIdentifier(normalized)
  }

  const local = characters(normalized.slice(0, atIndex))
  const domain = normalized.slice(atIndex + 1)
  const maskedLocal = local.length === 1 ? '*' : `${local[0]}***${local.at(-1)}`
  return `${maskedLocal}@${domain}`
}

export function maskPhone(value: string | null | undefined) {
  const normalized = normalize(value)
  if (!normalized) return MISSING_VALUE

  const digits = normalized.replace(/\D/gu, '')
  if (digits.length < 4) return maskIdentifier(normalized)
  return `${digits.slice(0, 2)}••••${digits.slice(-4)}`
}

export function summarizeAddress(value: string | null | undefined) {
  const normalized = normalize(value)
  if (!normalized) return MISSING_VALUE

  const taiwanRegion = normalized.match(/^(.{2,3}[縣市])(.{1,4}(?:區|鄉|鎮|市))/u)
  if (taiwanRegion) return `${taiwanRegion[1]}${taiwanRegion[2]}（其餘已遮蔽）`

  const prefix = characters(normalized).slice(0, 3).join('')
  return `${prefix}…（其餘已遮蔽）`
}
