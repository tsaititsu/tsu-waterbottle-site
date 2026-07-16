import { isIP } from 'node:net'
import { GatewayHttpError } from './errors.js'

export const GATEWAY_CLIENT_IP_HEADER = 'x-gateway-client-ip'

const MAX_CLIENT_IP_LENGTH = 64
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u

function invalidProxyClientIp(): never {
  throw new GatewayHttpError(400, 'invalid_proxy_client_ip')
}

export function parseProxyClientIp(value: string | undefined) {
  if (
    value === undefined ||
    value.length === 0 ||
    value.length > MAX_CLIENT_IP_LENGTH ||
    value !== value.trim() ||
    value.includes(',') ||
    value.includes('%') ||
    CONTROL_CHARACTER_PATTERN.test(value) ||
    isIP(value) === 0
  ) {
    return invalidProxyClientIp()
  }

  return value
}

export function readProxyClientIp(headers: Record<string, string | undefined>) {
  return parseProxyClientIp(headers[GATEWAY_CLIENT_IP_HEADER])
}
