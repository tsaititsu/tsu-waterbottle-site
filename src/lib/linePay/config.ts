export type LinePayEnvironment = 'sandbox' | 'production'

export const LINE_PAY_SANDBOX_BASE_URL = 'https://sandbox-api-pay.line.me'
export const LINE_PAY_PRODUCTION_BASE_URL = 'https://api-pay.line.me'

export function normalizeLinePayEnvironment(value?: string | null): LinePayEnvironment {
  const normalized = value?.trim().toLowerCase()

  if (!normalized || normalized === 'sandbox' || normalized === 'test' || normalized === 'development') {
    return 'sandbox'
  }

  if (normalized === 'production' || normalized === 'prod' || normalized === 'formal') {
    return 'production'
  }

  throw new Error('invalid_line_pay_environment')
}

export function getLinePayBaseUrl(env: LinePayEnvironment) {
  return env === 'production' ? LINE_PAY_PRODUCTION_BASE_URL : LINE_PAY_SANDBOX_BASE_URL
}

export function createLinePayNonce() {
  return crypto.randomUUID()
}

export function stringifyLinePayJsonBody(body: unknown) {
  return body === undefined ? '' : JSON.stringify(body)
}
