const MISSING_VALUE = '未提供'

function normalize(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : ''
}

function characters(value: string) {
  return Array.from(value)
}

function graphemes(value: string) {
  if (typeof Intl.Segmenter !== 'function') return value ? [value] : []

  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  return Array.from(segmenter.segment(value), ({ segment }) => segment)
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

  const local = graphemes(normalized.slice(0, atIndex))
  const domain = normalized.slice(atIndex + 1)
  const maskedLocal = local.length === 1
    ? '*'
    : local.length === 2
      ? `${local[0]}*`
      : local.length === 3
        ? `${local[0]}*${local.at(-1)}`
        : `${local[0]}***${local.at(-1)}`
  return `${maskedLocal}@${domain}`
}

export function maskPhone(value: string | null | undefined) {
  const normalized = normalize(value)
  if (!normalized) return MISSING_VALUE

  const digits = normalized.replace(/\D/gu, '')
  if (digits.length === 0) return '•'.repeat(Math.max(1, characters(normalized).length))
  if (digits.length <= 2) return '•'.repeat(digits.length)
  if (digits.length <= 6) return `${'•'.repeat(digits.length - 1)}${digits.at(-1)}`
  return `${digits.slice(0, 2)}${'•'.repeat(digits.length - 4)}${digits.slice(-2)}`
}
