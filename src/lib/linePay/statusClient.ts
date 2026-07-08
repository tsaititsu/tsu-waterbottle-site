import { getLinePayBaseUrl, normalizeLinePayEnvironment } from './config'
import { validateLinePayTransactionId } from './confirmPayload'
import { normalizeLinePayOrderId } from './orderId'
import { buildLinePayRequestHeaders } from './signature'

export const LINE_PAY_PAYMENT_REQUEST_STATUS_PATH_PREFIX = '/v3/payments/requests'
export const LINE_PAY_PAYMENT_DETAILS_PATH = '/v3/payments'

export type LinePayPaymentRequestStatus =
  | 'authentication_pending'
  | 'authentication_completed'
  | 'authentication_canceled_or_expired'
  | 'payment_failed'
  | 'payment_completed'
  | 'unknown'

export type LinePayStatusFetchInit = {
  method: 'GET'
  headers: Record<string, string>
}

export type LinePayStatusFetchResponse = {
  json: () => Promise<unknown>
}

export type LinePayStatusFetch = (
  url: string,
  init: LinePayStatusFetchInit,
) => Promise<LinePayStatusFetchResponse>

export type CheckLinePayPaymentRequestStatusInput = {
  environment?: string | null
  channelId: string
  channelSecret: string
  nonce: string
  fetchFn?: LinePayStatusFetch | null
  transactionId: unknown
}

export type LinePayPaymentRequestStatusResult = {
  returnCode: string
  returnMessage: string | null
  transactionId: string
  status: LinePayPaymentRequestStatus
}

export type GetLinePayPaymentDetailsInput = {
  environment?: string | null
  channelId: string
  channelSecret: string
  nonce: string
  fetchFn?: LinePayStatusFetch | null
  transactionId?: unknown
  orderId?: unknown
}

export type LinePayPaymentDetailsResult = {
  returnCode: string
  returnMessage: string | null
  info: Array<Record<string, unknown>>
}

const blockedDetailKeysPattern =
  /channelSecret|channelId|TradeInfo|TradeSha|HashKey|HashIV|phone|email|address|creditCard|cardNumber|paymentForm/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getString(value: unknown) {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  return null
}

function mapRequestStatus(returnCode: string): LinePayPaymentRequestStatus {
  if (returnCode === '0000') return 'authentication_pending'
  if (returnCode === '0110') return 'authentication_completed'
  if (returnCode === '0121') return 'authentication_canceled_or_expired'
  if (returnCode === '0122') return 'payment_failed'
  if (returnCode === '0123') return 'payment_completed'
  return 'unknown'
}

function sanitizeDetailValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeDetailValue)
  }

  if (!isRecord(value)) {
    return value
  }

  return Object.entries(value).reduce<Record<string, unknown>>((result, [key, entry]) => {
    if (blockedDetailKeysPattern.test(key)) {
      return result
    }

    result[key] = key === 'transactionId' ? getString(entry) : sanitizeDetailValue(entry)
    return result
  }, {})
}

function parseStatusResponse(responseJson: unknown, transactionId: string): LinePayPaymentRequestStatusResult {
  if (!isRecord(responseJson)) {
    throw new Error('invalid_line_pay_status_client_response')
  }

  const returnCode = getString(responseJson.returnCode)

  if (!returnCode) {
    throw new Error('invalid_line_pay_status_client_response')
  }

  return {
    returnCode,
    returnMessage: getString(responseJson.returnMessage),
    transactionId,
    status: mapRequestStatus(returnCode),
  }
}

function parsePaymentDetailsResponse(responseJson: unknown): LinePayPaymentDetailsResult {
  if (!isRecord(responseJson)) {
    throw new Error('invalid_line_pay_payment_details_response')
  }

  const returnCode = getString(responseJson.returnCode)

  if (!returnCode) {
    throw new Error('invalid_line_pay_payment_details_response')
  }

  if (returnCode !== '0000') {
    throw new Error('line_pay_payment_details_failed')
  }

  if (!Array.isArray(responseJson.info)) {
    throw new Error('invalid_line_pay_payment_details_response')
  }

  return {
    returnCode,
    returnMessage: getString(responseJson.returnMessage),
    info: responseJson.info.map((item) =>
      isRecord(item) ? (sanitizeDetailValue(item) as Record<string, unknown>) : {},
    ),
  }
}

function buildGetHeaders(input: {
  channelId: string
  channelSecret: string
  apiPath: string
  queryString?: string
  nonce: string
}) {
  return buildLinePayRequestHeaders({
    channelId: input.channelId,
    channelSecret: input.channelSecret,
    method: 'GET',
    apiPath: input.apiPath,
    queryString: input.queryString ?? '',
    nonce: input.nonce,
  })
}

async function readJsonResponse(
  response: LinePayStatusFetchResponse,
  errorCode: 'invalid_line_pay_status_client_response' | 'invalid_line_pay_payment_details_response',
) {
  if (!response || typeof response.json !== 'function') {
    throw new Error(errorCode)
  }

  try {
    return await response.json()
  } catch {
    throw new Error(errorCode)
  }
}

export async function checkLinePayPaymentRequestStatus(
  input: CheckLinePayPaymentRequestStatusInput,
): Promise<LinePayPaymentRequestStatusResult> {
  if (typeof input.fetchFn !== 'function') {
    throw new Error('missing_line_pay_fetch')
  }

  const environment = normalizeLinePayEnvironment(input.environment)
  const transactionId = validateLinePayTransactionId(input.transactionId)
  const apiPath = `${LINE_PAY_PAYMENT_REQUEST_STATUS_PATH_PREFIX}/${transactionId}/check`
  const headers = buildGetHeaders({
    channelId: input.channelId,
    channelSecret: input.channelSecret,
    apiPath,
    nonce: input.nonce,
  })
  const response = await input.fetchFn(`${getLinePayBaseUrl(environment)}${apiPath}`, {
    method: 'GET',
    headers,
  })
  const responseJson = await readJsonResponse(response, 'invalid_line_pay_status_client_response')

  return parseStatusResponse(responseJson, transactionId)
}

export async function getLinePayPaymentDetails(
  input: GetLinePayPaymentDetailsInput,
): Promise<LinePayPaymentDetailsResult> {
  if (typeof input.fetchFn !== 'function') {
    throw new Error('missing_line_pay_fetch')
  }

  const environment = normalizeLinePayEnvironment(input.environment)
  const transactionId =
    input.transactionId === undefined || input.transactionId === null
      ? null
      : validateLinePayTransactionId(input.transactionId)
  const orderId =
    input.orderId === undefined || input.orderId === null ? null : normalizeLinePayOrderId(input.orderId)

  if (!transactionId && !orderId) {
    throw new Error('missing_line_pay_payment_lookup_key')
  }

  const query = new URLSearchParams()

  if (transactionId) {
    query.set('transactionId', transactionId)
  }

  if (orderId) {
    query.set('orderId', orderId)
  }

  const queryString = query.toString()
  const headers = buildGetHeaders({
    channelId: input.channelId,
    channelSecret: input.channelSecret,
    apiPath: LINE_PAY_PAYMENT_DETAILS_PATH,
    queryString,
    nonce: input.nonce,
  })
  const response = await input.fetchFn(`${getLinePayBaseUrl(environment)}${LINE_PAY_PAYMENT_DETAILS_PATH}?${queryString}`, {
    method: 'GET',
    headers,
  })
  const responseJson = await readJsonResponse(response, 'invalid_line_pay_payment_details_response')

  return parsePaymentDetailsResponse(responseJson)
}
