import { getLinePayBaseUrl, normalizeLinePayEnvironment, stringifyLinePayJsonBody } from './config'
import {
  buildLinePayConfirmPayload,
  validateLinePayTransactionId,
  type LinePayConfirmPayloadInput,
} from './confirmPayload'
import { parseLinePayConfirmResponse, type ParsedLinePayConfirmResponse } from './responseParser'
import { buildLinePayRequestHeaders } from './signature'

export type LinePayConfirmPaymentFetchInit = {
  method: 'POST'
  headers: Record<string, string>
  body: string
}

export type LinePayConfirmPaymentFetchResponse = {
  json: () => Promise<unknown>
}

export type LinePayConfirmPaymentFetch = (
  url: string,
  init: LinePayConfirmPaymentFetchInit,
) => Promise<LinePayConfirmPaymentFetchResponse>

export type ConfirmLinePayPaymentInput = {
  environment?: string | null
  channelId: string
  channelSecret: string
  nonce: string
  fetchFn?: LinePayConfirmPaymentFetch | null
  transactionId: unknown
  payloadInput: LinePayConfirmPayloadInput
}

export function buildLinePayConfirmPath(transactionId: unknown) {
  return `/v3/payments/${validateLinePayTransactionId(transactionId)}/confirm`
}

export async function confirmLinePayPayment(
  input: ConfirmLinePayPaymentInput,
): Promise<ParsedLinePayConfirmResponse> {
  if (typeof input.fetchFn !== 'function') {
    throw new Error('missing_line_pay_fetch')
  }

  const environment = normalizeLinePayEnvironment(input.environment)
  const apiPath = buildLinePayConfirmPath(input.transactionId)
  const payload = buildLinePayConfirmPayload(input.payloadInput)
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
    throw new Error('invalid_line_pay_confirm_client_response')
  }

  let responseJson: unknown

  try {
    responseJson = await response.json()
  } catch {
    throw new Error('invalid_line_pay_confirm_client_response')
  }

  return parseLinePayConfirmResponse(responseJson)
}
