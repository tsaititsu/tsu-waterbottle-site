import { normalizeLinePayEnvironment, stringifyLinePayJsonBody } from './config'
import { buildLinePayRequestPayload, type LinePayRequestPayloadInput } from './requestPayload'
import { parseLinePayRequestResponse, type ParsedLinePayRequestResponse } from './responseParser'
import { buildLinePayRequestHeaders } from './signature'
import {
  sendLinePayRequest,
  type LinePayTransportEnv,
  type LinePayTransportFetch,
  type LinePayTransportFetchInit,
  type LinePayTransportResponse,
} from './transport'

export const LINE_PAY_REQUEST_PAYMENT_PATH = '/v3/payments/request'

export type LinePayRequestPaymentFetchInit = LinePayTransportFetchInit
export type LinePayRequestPaymentFetchResponse = LinePayTransportResponse
export type LinePayRequestPaymentFetch = LinePayTransportFetch

export type RequestLinePayPaymentInput = {
  environment?: string | null
  channelId: string
  channelSecret: string
  nonce: string
  fetchFn?: LinePayRequestPaymentFetch | null
  transportEnv?: LinePayTransportEnv
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

  const response = await sendLinePayRequest({
    operation: 'request',
    environment,
    method: 'POST',
    apiPath,
    bodyText,
    linePayHeaders: headers,
    fetchFn: input.fetchFn,
    transportEnv: input.transportEnv,
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
