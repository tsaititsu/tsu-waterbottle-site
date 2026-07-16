import { timingSafeEqual } from 'node:crypto'
import { GatewayHttpError } from './errors.js'

export const GATEWAY_PROXY_TOKEN_HEADER = 'x-gateway-proxy-token'
export const PROXY_TOKEN_PATTERN = /^[0-9a-f]{64}$/

function unauthorized(): never {
  throw new GatewayHttpError(401, 'unauthorized')
}

export function authenticateProxyRequest(
  headers: Record<string, string | undefined>,
  expectedProxyToken: string,
) {
  const providedProxyToken = headers[GATEWAY_PROXY_TOKEN_HEADER]

  if (
    providedProxyToken === undefined ||
    !PROXY_TOKEN_PATTERN.test(providedProxyToken) ||
    !PROXY_TOKEN_PATTERN.test(expectedProxyToken)
  ) {
    return unauthorized()
  }

  const provided = Buffer.from(providedProxyToken, 'hex')
  const expected = Buffer.from(expectedProxyToken, 'hex')
  if (!timingSafeEqual(provided, expected)) return unauthorized()
}
