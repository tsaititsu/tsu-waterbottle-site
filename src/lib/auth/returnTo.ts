export const DEFAULT_AUTH_RETURN_PATH = '/account'

const RETURN_TO_VALIDATION_ORIGIN = 'https://auth-return.invalid'
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f]/
const MAX_DECODE_PASSES = 5

function normalizeReturnPath(value: unknown) {
  if (typeof value !== 'string' || !value || value !== value.trim()) return null

  let decoded = value

  for (let pass = 0; pass < MAX_DECODE_PASSES; pass += 1) {
    if (
      CONTROL_CHARACTER_PATTERN.test(decoded) ||
      decoded.includes('\\') ||
      !decoded.startsWith('/') ||
      decoded.startsWith('//')
    ) {
      return null
    }

    let nextDecoded: string
    try {
      nextDecoded = decodeURIComponent(decoded)
    } catch {
      return null
    }

    if (nextDecoded === decoded) break
    decoded = nextDecoded

    if (pass === MAX_DECODE_PASSES - 1) return null
  }

  const fragmentIndex = value.indexOf('#')
  const withoutFragment = fragmentIndex >= 0 ? value.slice(0, fragmentIndex) : value

  try {
    const base = new URL(RETURN_TO_VALIDATION_ORIGIN)
    const result = new URL(withoutFragment, base)

    if (result.origin !== base.origin) return null
    return `${result.pathname}${result.search}`
  } catch {
    return null
  }
}

export function sanitizeAuthReturnPath(
  value: unknown,
  fallback: unknown = DEFAULT_AUTH_RETURN_PATH,
) {
  return (
    normalizeReturnPath(value) ??
    normalizeReturnPath(fallback) ??
    DEFAULT_AUTH_RETURN_PATH
  )
}

function normalizeTrustedOrigin(origin: string) {
  const url = new URL(origin)

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new TypeError('Auth redirect origin must use HTTP or HTTPS')
  }

  return url.origin
}

function assertSameOrigin(url: URL, trustedOrigin: string) {
  if (url.origin !== trustedOrigin) {
    throw new TypeError('Auth redirect must remain on the trusted origin')
  }
}

export function buildSameOriginAuthCallbackUrl(origin: string, returnTo: unknown) {
  const trustedOrigin = normalizeTrustedOrigin(origin)
  const callback = new URL('/auth/callback', trustedOrigin)
  callback.searchParams.set('next', sanitizeAuthReturnPath(returnTo))
  assertSameOrigin(callback, trustedOrigin)
  return callback.toString()
}

export function buildSameOriginReturnUrl(origin: string, returnTo: unknown) {
  const trustedOrigin = normalizeTrustedOrigin(origin)
  const destination = new URL(sanitizeAuthReturnPath(returnTo), trustedOrigin)
  assertSameOrigin(destination, trustedOrigin)
  destination.hash = ''
  return destination.toString()
}
