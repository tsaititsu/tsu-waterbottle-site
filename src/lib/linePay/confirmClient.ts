import { normalizeLinePayEnvironment, stringifyLinePayJsonBody } from './config'
import {
  buildLinePayConfirmPayload,
  validateLinePayTransactionId,
  type LinePayConfirmPayloadInput,
} from './confirmPayload'
import { parseLinePayConfirmResponse, type ParsedLinePayConfirmResponse } from './responseParser'
import { buildLinePayRequestHeaders } from './signature'
import {
  sendLinePayRequest,
  type LinePayTransportEnv,
  type LinePayTransportFetch,
  type LinePayTransportFetchInit,
  type LinePayTransportResponse,
} from './transport'

export type LinePayConfirmPaymentFetchInit = LinePayTransportFetchInit
export type LinePayConfirmPaymentFetchResponse = LinePayTransportResponse
export type LinePayConfirmPaymentFetch = LinePayTransportFetch

export type ConfirmLinePayPaymentInput = {
  environment?: string | null
  channelId: string
  channelSecret: string
  nonce: string
  fetchFn?: LinePayConfirmPaymentFetch | null
  transportEnv?: LinePayTransportEnv
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
  const transactionId = validateLinePayTransactionId(input.transactionId)
  const apiPath = buildLinePayConfirmPath(transactionId)
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

  const response = await sendLinePayRequest({
    operation: 'confirm',
    environment,
    method: 'POST',
    apiPath,
    bodyText,
    linePayHeaders: headers,
    transactionId,
    fetchFn: input.fetchFn,
    transportEnv: input.transportEnv,
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
