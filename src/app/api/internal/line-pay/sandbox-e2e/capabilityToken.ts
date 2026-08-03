const CAPABILITY_COOKIE_NAMES = {
  confirm: '__Host-line-pay-sandbox-e2e-confirm',
  cancel: '__Host-line-pay-sandbox-e2e-cancel',
} as const

export const LINE_PAY_SANDBOX_E2E_CAPABILITY_COOKIE_OPTIONS = Object.freeze({
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 30 * 60,
})

export function linePaySandboxE2eCapabilityCookieName(
  purpose: 'confirm' | 'cancel',
) {
  return CAPABILITY_COOKIE_NAMES[purpose]
}

export function readLinePaySandboxE2eCapabilityCookie(
  request: Request,
  purpose: 'confirm' | 'cancel',
) {
  const expectedName = linePaySandboxE2eCapabilityCookieName(purpose)
  const cookieHeader = request.headers.get('cookie') ?? ''

  for (const cookie of cookieHeader.split(';')) {
    const separatorIndex = cookie.indexOf('=')
    if (separatorIndex < 0) continue

    const name = cookie.slice(0, separatorIndex).trim()
    if (name !== expectedName) continue

    const value = cookie.slice(separatorIndex + 1).trim()
    return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null
  }

  return null
}
