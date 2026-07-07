import { createHmac } from 'node:crypto'

export type LinePayHttpMethod = 'GET' | 'POST'

export type BuildLinePaySignatureInput = {
  channelSecret: string
  method: LinePayHttpMethod | string
  apiPath: string
  queryString?: string
  bodyText?: string
  nonce: string
}

export function buildLinePaySignature(input: BuildLinePaySignatureInput) {
  const channelSecret = input.channelSecret.trim()

  if (!channelSecret) {
    throw new Error('invalid_line_pay_credentials')
  }

  if (input.method !== 'GET' && input.method !== 'POST') {
    throw new Error('invalid_line_pay_http_method')
  }

  if (!input.apiPath.startsWith('/')) {
    throw new Error('invalid_line_pay_api_path')
  }

  const nonce = input.nonce.trim()

  if (!nonce) {
    throw new Error('invalid_line_pay_nonce')
  }

  const message =
    input.method === 'GET'
      ? `${channelSecret}${input.apiPath}${input.queryString ?? ''}${nonce}`
      : `${channelSecret}${input.apiPath}${input.bodyText ?? ''}${nonce}`

  return createHmac('sha256', channelSecret).update(message).digest('base64')
}
