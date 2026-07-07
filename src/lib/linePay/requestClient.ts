import { getLinePayBaseUrl, normalizeLinePayEnvironment, stringifyLinePayJsonBody } from './config'
import { buildLinePayRequestPayload, type LinePayRequestPayloadInput } from './requestPayload'
import { parseLinePayRequestResponse, type ParsedLinePayRequestResponse } from './responseParser'
import { buildLinePayRequestHeaders } from './signature'

export const LINE_PAY_REQUEST_PAYMENT_PATH = '/v3/payments/request'

export type LinePayRequestPaymentFetchInit = {
  method: 'POST'
  headers: Record<string, string>
  body: string
}

export type LinePayRequestPaymentFetchResponse = {
  json: () => Promise<unknown>
}

export type LinePayRequestPaymentFetch = (
  url: string,
  init: LinePayRequestPaymentFetchInit,
) => Promise<LinePayRequestPaymentFetchResponse>

export type RequestLinePayPaymentInput = {
  environment?: string | null
  channelId: string
  channelSecret: string
  nonce: string
  fetchFn?: LinePayRequestPaymentFetch | null
  payloadInput: LinePayRequestPayloadInput
}

export async function requestLinePayPayment(
  input: RequestLinePayPaymentInput,
): Promise<ParsedLinePayRequestResponse> {
  if (typeof input.fetchFn !== 'function') {
    throw new Error('missing_line_pay_fetch')
  }

  const environment = normalizeLinePayEnvironment(input.environment)
  const apiPath = LINE_PAY_REQUEST_PAYMENT_PATH
  const payload = buildLinePayRequestPayload(input.payloadInput)
  const bodyText = stringifyLinePayJsonBody(payload)
  const headers = buildLinePayRequestHeaders({
    channelId: input.channelId,
    channelSecret: input.channelSecret,
    method: 'POST',
    apiPath,
    bodyText,
    nonce: input.nonce,
  })

  const response = await input.fetchFn(`${getLinePayBaseUrl(environment)}${apiPath}`, {
    method: 'POST',
    headers,
    body: bodyText,
  })

  if (!response || typeof response.json !== 'function') {
    throw new Error('invalid_line_pay_request_client_response')
  }

  let responseJson: unknown

  try {
    responseJson = await response.json()
  } catch {
    throw new Error('invalid_line_pay_request_client_response')
  }

  return parseLinePayRequestResponse(responseJson)
}
