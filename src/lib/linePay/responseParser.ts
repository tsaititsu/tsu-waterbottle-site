export type ParsedLinePayRequestResponse = {
  returnCode: string
  returnMessage: string | null
  transactionId: string
  paymentUrlWeb: string
  paymentUrlApp: string | null
}

export type ParsedLinePayConfirmResponse = {
  returnCode: string
  returnMessage: string | null
  transactionId: string | null
  orderId: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getString(value: unknown) {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  return null
}

function getOptionalString(value: unknown) {
  return getString(value)
}

function getRequiredReturnCode(response: Record<string, unknown>, invalidError: string, failedError: string) {
  const returnCode = getString(response.returnCode)

  if (!returnCode) {
    throw new Error(invalidError)
  }

  if (returnCode !== '0000') {
    throw new Error(failedError)
  }

  return returnCode
}

export function parseLinePayRequestResponse(response: unknown): ParsedLinePayRequestResponse {
  if (!isRecord(response)) {
    throw new Error('invalid_line_pay_request_response')
  }

  const returnCode = getRequiredReturnCode(
    response,
    'invalid_line_pay_request_response',
    'line_pay_request_failed',
  )
  const info = response.info

  if (!isRecord(info)) {
    throw new Error('invalid_line_pay_request_response')
  }

  const transactionId = getString(info.transactionId)
  const paymentUrl = info.paymentUrl

  if (!transactionId || !isRecord(paymentUrl)) {
    throw new Error('invalid_line_pay_request_response')
  }

  const paymentUrlWeb = getString(paymentUrl.web)
  const paymentUrlApp = getOptionalString(paymentUrl.app)

  if (!paymentUrlWeb) {
    throw new Error('invalid_line_pay_request_response')
  }

  return {
    returnCode,
    returnMessage: getOptionalString(response.returnMessage),
    transactionId,
    paymentUrlWeb,
    paymentUrlApp,
  }
}

export function parseLinePayConfirmResponse(response: unknown): ParsedLinePayConfirmResponse {
  if (!isRecord(response)) {
    throw new Error('invalid_line_pay_confirm_response')
  }

  const returnCode = getRequiredReturnCode(
    response,
    'invalid_line_pay_confirm_response',
    'line_pay_confirm_failed',
  )
  const info = response.info

  if (info !== undefined && info !== null && !isRecord(info)) {
    throw new Error('invalid_line_pay_confirm_response')
  }

  return {
    returnCode,
    returnMessage: getOptionalString(response.returnMessage),
    transactionId: isRecord(info) ? getOptionalString(info.transactionId) : null,
    orderId: isRecord(info) ? getOptionalString(info.orderId) : null,
  }
}
