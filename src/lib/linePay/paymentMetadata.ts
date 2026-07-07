import { validateLinePayTransactionId } from './confirmPayload'

export type LinePayPaymentMetadata = {
  linePay: {
    transactionId?: string
    paymentUrl?: {
      web?: string
      app?: string
    }
    request?: {
      returnCode: string
      returnMessage?: string
    }
    confirm?: {
      returnCode: string
      returnMessage?: string
      orderId?: string
    }
  }
}

export type BuildLinePayRequestPaymentMetadataInput = {
  transactionId: unknown
  paymentUrlWeb: string
  paymentUrlApp?: unknown
  returnCode: unknown
  returnMessage?: unknown
}

export type BuildLinePayConfirmPaymentMetadataInput = {
  transactionId?: unknown
  orderId?: unknown
  returnCode: unknown
  returnMessage?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getRequiredString(value: unknown, errorCode: string) {
  const text = String(value ?? '').trim()

  if (!text) {
    throw new Error(errorCode)
  }

  return text
}

function getOptionalString(value: unknown) {
  if (value === undefined || value === null) return undefined

  const text = String(value).trim()
  return text || undefined
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const blockedMetadataKeyPattern = /channelSecret|TradeInfo|TradeSha|HashKey|HashIV|signature|headers/i

function sanitizeMetadataValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMetadataValue(item))
  }

  if (!isRecord(value)) return {}

  const next: Record<string, unknown> = {}

  for (const [key, item] of Object.entries(value)) {
    if (blockedMetadataKeyPattern.test(key)) continue
    next[key] = isRecord(item) || Array.isArray(item) ? sanitizeMetadataValue(item) : item
  }

  return next
}

function sanitizeMetadata(value: unknown): Record<string, unknown> {
  const sanitized = sanitizeMetadataValue(value)
  return isRecord(sanitized) ? sanitized : {}
}

export function buildLinePayRequestPaymentMetadata(
  input: BuildLinePayRequestPaymentMetadataInput,
): LinePayPaymentMetadata {
  const transactionId = validateLinePayTransactionId(input.transactionId)
  const paymentUrlWeb = getRequiredString(input.paymentUrlWeb, 'invalid_line_pay_metadata_payment_url')
  const paymentUrlApp = getOptionalString(input.paymentUrlApp)
  const returnCode = getRequiredString(input.returnCode, 'invalid_line_pay_metadata_return_code')
  const returnMessage = getOptionalString(input.returnMessage)

  if (!isHttpUrl(paymentUrlWeb)) {
    throw new Error('invalid_line_pay_metadata_payment_url')
  }

  if (paymentUrlApp !== undefined && typeof input.paymentUrlApp !== 'string') {
    throw new Error('invalid_line_pay_metadata_payment_url')
  }

  return {
    linePay: {
      transactionId,
      paymentUrl: {
        web: paymentUrlWeb,
        ...(paymentUrlApp ? { app: paymentUrlApp } : {}),
      },
      request: {
        returnCode,
        ...(returnMessage ? { returnMessage } : {}),
      },
    },
  }
}

export function buildLinePayConfirmPaymentMetadata(
  input: BuildLinePayConfirmPaymentMetadataInput,
): LinePayPaymentMetadata {
  const transactionId =
    input.transactionId === undefined || input.transactionId === null
      ? undefined
      : validateLinePayTransactionId(input.transactionId)
  const orderId = getOptionalString(input.orderId)
  const returnCode = getRequiredString(input.returnCode, 'invalid_line_pay_metadata_return_code')
  const returnMessage = getOptionalString(input.returnMessage)

  return {
    linePay: {
      ...(transactionId ? { transactionId } : {}),
      confirm: {
        returnCode,
        ...(returnMessage ? { returnMessage } : {}),
        ...(orderId ? { orderId } : {}),
      },
    },
  }
}

export function mergeLinePayPaymentMetadata(existingMetadata: unknown, linePayMetadata: LinePayPaymentMetadata) {
  const existing = sanitizeMetadata(existingMetadata)
  const existingLinePay = isRecord(existing.linePay) ? existing.linePay : {}
  const nextLinePay = linePayMetadata.linePay

  return {
    ...existing,
    linePay: {
      ...existingLinePay,
      ...nextLinePay,
      paymentUrl: {
        ...(isRecord(existingLinePay.paymentUrl) ? existingLinePay.paymentUrl : {}),
        ...(nextLinePay.paymentUrl ?? {}),
      },
      request: {
        ...(isRecord(existingLinePay.request) ? existingLinePay.request : {}),
        ...(nextLinePay.request ?? {}),
      },
      confirm: {
        ...(isRecord(existingLinePay.confirm) ? existingLinePay.confirm : {}),
        ...(nextLinePay.confirm ?? {}),
      },
    },
  }
}
