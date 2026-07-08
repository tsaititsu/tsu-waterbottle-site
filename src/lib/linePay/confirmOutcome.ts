import { validateLinePayTransactionId } from './confirmPayload'
import { normalizeLinePayOrderId } from './orderId'
import type { LinePayPaymentDetailsResult, LinePayPaymentRequestStatusResult } from './statusClient'

export type LinePayConfirmOutcome =
  | 'confirmed_paid'
  | 'needs_status_check'
  | 'needs_payment_details_check'
  | 'authentication_pending'
  | 'authentication_completed_needs_confirm'
  | 'authentication_canceled_or_expired'
  | 'payment_failed'
  | 'payment_completed'
  | 'confirm_failed'
  | 'confirm_ambiguous'
  | 'mismatch'
  | 'invalid_input'

export type LinePayConfirmExpected = {
  transactionId: unknown
  orderId: unknown
  amount: number
  currency: string
}

export type LinePayConfirmResultInput = {
  returnCode?: unknown
  returnMessage?: unknown
  transactionId?: unknown
  orderId?: unknown
  amount?: unknown
  currency?: unknown
  payInfo?: unknown
  packages?: unknown
  info?: unknown
}

export type LinePayConfirmErrorInput = {
  code?: unknown
  message?: unknown
}

export type ResolveLinePayConfirmOutcomeInput = {
  confirmResult?: LinePayConfirmResultInput | null
  confirmError?: LinePayConfirmErrorInput | Error | string | null
  requestStatusResult?: LinePayPaymentRequestStatusResult | null
  paymentDetailsResult?: LinePayPaymentDetailsResult | null
  expected: LinePayConfirmExpected
}

export type LinePayConfirmOutcomeDecision = {
  outcome: LinePayConfirmOutcome
  shouldMarkPaid: boolean
  shouldQueryStatus: boolean
  shouldQueryPaymentDetails: boolean
  reason: string
  safeToRetryConfirm: boolean
}

type NormalizedExpected = {
  transactionId: string
  orderId: string
  amount: number
  currency: 'TWD'
}

function decision(input: LinePayConfirmOutcomeDecision): LinePayConfirmOutcomeDecision {
  return input
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getString(value: unknown) {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  return null
}

function getPositiveInteger(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

function normalizeExpected(expected: LinePayConfirmExpected): NormalizedExpected | null {
  try {
    const transactionId = validateLinePayTransactionId(expected.transactionId)
    const orderId = normalizeLinePayOrderId(expected.orderId)

    if (!Number.isInteger(expected.amount) || expected.amount <= 0 || expected.currency !== 'TWD') {
      return null
    }

    return {
      transactionId,
      orderId,
      amount: expected.amount,
      currency: 'TWD',
    }
  } catch {
    return null
  }
}

function sumAmounts(values: unknown[]) {
  let total = 0
  let hasAmount = false

  for (const value of values) {
    const amount = extractAmount(value)

    if (amount === null) {
      return null
    }

    hasAmount = true
    total += amount
  }

  return hasAmount ? total : null
}

function extractPackageProductsAmount(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.products)) {
    return null
  }

  let total = 0

  for (const product of value.products) {
    if (!isRecord(product)) return null

    const price = typeof product.price === 'number' && Number.isInteger(product.price) && product.price >= 0
      ? product.price
      : null
    const quantity = typeof product.quantity === 'number' && Number.isInteger(product.quantity) && product.quantity > 0
      ? product.quantity
      : null

    if (price === null || quantity === null) {
      return null
    }

    total += price * quantity
  }

  return total
}

function extractAmount(value: unknown): number | null {
  if (!isRecord(value)) return null

  const directAmount = getPositiveInteger(value.amount)

  if (directAmount !== null) {
    return directAmount
  }

  if (Array.isArray(value.payInfo)) {
    return sumAmounts(value.payInfo)
  }

  if (Array.isArray(value.packages)) {
    const packageAmounts = value.packages.map((item) => {
      const packageAmount = isRecord(item) ? getPositiveInteger(item.amount) : null
      return packageAmount ?? extractPackageProductsAmount(item)
    })

    return packageAmounts.every((amount) => amount !== null)
      ? packageAmounts.reduce((total, amount) => total + (amount ?? 0), 0)
      : null
  }

  if (isRecord(value.info)) {
    return extractAmount(value.info)
  }

  return null
}

function extractCurrency(value: unknown): string | null {
  if (!isRecord(value)) return null

  return (
    getString(value.currency) ??
    (isRecord(value.info) ? extractCurrency(value.info) : null) ??
    (Array.isArray(value.packages) && isRecord(value.packages[0])
      ? getString(value.packages[0].currency)
      : null)
  )
}

function validatePaidRecord(value: unknown, expected: NormalizedExpected) {
  if (!isRecord(value)) {
    return false
  }

  const transactionId = getString(value.transactionId)
  const orderId = getString(value.orderId)
  const amount = extractAmount(value)
  const currency = extractCurrency(value)

  return (
    transactionId === expected.transactionId &&
    orderId === expected.orderId &&
    amount === expected.amount &&
    currency === expected.currency
  )
}

function isConfirmExceptionCode(code: string | null) {
  return code === '1172' || code === '1198'
}

function normalizeConfirmErrorCode(error: ResolveLinePayConfirmOutcomeInput['confirmError']) {
  if (!error) return null

  if (typeof error === 'string') {
    return error.trim()
  }

  if (error instanceof Error) {
    return error.message.toLowerCase().includes('timeout') ? 'timeout' : null
  }

  if (isRecord(error)) {
    return getString(error.code)?.trim() ?? null
  }

  return null
}

function isTimeoutOrNetworkError(error: ResolveLinePayConfirmOutcomeInput['confirmError']) {
  if (!error) return false

  const code = normalizeConfirmErrorCode(error)?.toLowerCase()
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : isRecord(error)
          ? getString(error.message) ?? ''
          : ''
  const text = `${code ?? ''} ${message}`.toLowerCase()

  return text.includes('timeout') || text.includes('network')
}

function findPaymentDetail(info: unknown[], expected: NormalizedExpected) {
  const matched = info.find((item) => {
    if (!isRecord(item)) return false

    return getString(item.transactionId) === expected.transactionId || getString(item.orderId) === expected.orderId
  })

  if (matched) return matched
  return info.length === 1 ? info[0] : null
}

function resolvePaymentDetails(details: LinePayPaymentDetailsResult, expected: NormalizedExpected) {
  if (details.returnCode !== '0000' || !Array.isArray(details.info) || details.info.length === 0) {
    return decision({
      outcome: 'needs_payment_details_check',
      shouldMarkPaid: false,
      shouldQueryStatus: false,
      shouldQueryPaymentDetails: true,
      reason: 'payment_details_not_found',
      safeToRetryConfirm: false,
    })
  }

  const detail = findPaymentDetail(details.info, expected)

  if (!detail) {
    return decision({
      outcome: 'needs_payment_details_check',
      shouldMarkPaid: false,
      shouldQueryStatus: false,
      shouldQueryPaymentDetails: true,
      reason: 'payment_details_not_found',
      safeToRetryConfirm: false,
    })
  }

  if (!validatePaidRecord(detail, expected)) {
    return decision({
      outcome: 'mismatch',
      shouldMarkPaid: false,
      shouldQueryStatus: false,
      shouldQueryPaymentDetails: false,
      reason: 'payment_details_mismatch',
      safeToRetryConfirm: false,
    })
  }

  return decision({
    outcome: 'payment_completed',
    shouldMarkPaid: true,
    shouldQueryStatus: false,
    shouldQueryPaymentDetails: false,
    reason: 'payment_details_verified',
    safeToRetryConfirm: false,
  })
}

function resolveRequestStatus(
  requestStatusResult: LinePayPaymentRequestStatusResult,
  paymentDetailsResult: LinePayPaymentDetailsResult | null | undefined,
  expected: NormalizedExpected,
) {
  if (requestStatusResult.status === 'authentication_pending') {
    return decision({
      outcome: 'authentication_pending',
      shouldMarkPaid: false,
      shouldQueryStatus: true,
      shouldQueryPaymentDetails: false,
      reason: 'request_status_not_paid',
      safeToRetryConfirm: false,
    })
  }

  if (requestStatusResult.status === 'authentication_completed') {
    return decision({
      outcome: 'authentication_completed_needs_confirm',
      shouldMarkPaid: false,
      shouldQueryStatus: false,
      shouldQueryPaymentDetails: false,
      reason: 'request_status_ready_for_confirm',
      safeToRetryConfirm: true,
    })
  }

  if (requestStatusResult.status === 'authentication_canceled_or_expired') {
    return decision({
      outcome: 'authentication_canceled_or_expired',
      shouldMarkPaid: false,
      shouldQueryStatus: false,
      shouldQueryPaymentDetails: false,
      reason: 'request_status_not_paid',
      safeToRetryConfirm: false,
    })
  }

  if (requestStatusResult.status === 'payment_failed') {
    return decision({
      outcome: 'payment_failed',
      shouldMarkPaid: false,
      shouldQueryStatus: false,
      shouldQueryPaymentDetails: false,
      reason: 'request_status_not_paid',
      safeToRetryConfirm: false,
    })
  }

  if (requestStatusResult.status === 'payment_completed') {
    if (!paymentDetailsResult) {
      return decision({
        outcome: 'needs_payment_details_check',
        shouldMarkPaid: false,
        shouldQueryStatus: false,
        shouldQueryPaymentDetails: true,
        reason: 'request_status_payment_completed_requires_details',
        safeToRetryConfirm: false,
      })
    }

    return resolvePaymentDetails(paymentDetailsResult, expected)
  }

  return decision({
    outcome: 'confirm_ambiguous',
    shouldMarkPaid: false,
    shouldQueryStatus: true,
    shouldQueryPaymentDetails: true,
    reason: 'request_status_unknown',
    safeToRetryConfirm: false,
  })
}

export function resolveLinePayConfirmOutcome(
  input: ResolveLinePayConfirmOutcomeInput,
): LinePayConfirmOutcomeDecision {
  const expected = normalizeExpected(input.expected)

  if (!expected) {
    return decision({
      outcome: 'invalid_input',
      shouldMarkPaid: false,
      shouldQueryStatus: false,
      shouldQueryPaymentDetails: false,
      reason: 'invalid_line_pay_confirm_expected',
      safeToRetryConfirm: false,
    })
  }

  const confirmResultReturnCode = getString(input.confirmResult?.returnCode)

  if (confirmResultReturnCode === '0000') {
    if (!validatePaidRecord(input.confirmResult, expected)) {
      return decision({
        outcome: 'mismatch',
        shouldMarkPaid: false,
        shouldQueryStatus: false,
        shouldQueryPaymentDetails: false,
        reason: 'confirm_success_but_payload_mismatch',
        safeToRetryConfirm: false,
      })
    }

    return decision({
      outcome: 'confirmed_paid',
      shouldMarkPaid: true,
      shouldQueryStatus: false,
      shouldQueryPaymentDetails: false,
      reason: 'confirm_success',
      safeToRetryConfirm: false,
    })
  }

  if (isConfirmExceptionCode(confirmResultReturnCode)) {
    return decision({
      outcome: 'needs_payment_details_check',
      shouldMarkPaid: false,
      shouldQueryStatus: true,
      shouldQueryPaymentDetails: true,
      reason: 'confirm_exception_requires_status_query',
      safeToRetryConfirm: false,
    })
  }

  const confirmErrorCode = normalizeConfirmErrorCode(input.confirmError)

  if (isConfirmExceptionCode(confirmErrorCode)) {
    return decision({
      outcome: 'needs_payment_details_check',
      shouldMarkPaid: false,
      shouldQueryStatus: true,
      shouldQueryPaymentDetails: true,
      reason: 'confirm_exception_requires_status_query',
      safeToRetryConfirm: false,
    })
  }

  if (isTimeoutOrNetworkError(input.confirmError)) {
    return decision({
      outcome: 'confirm_ambiguous',
      shouldMarkPaid: false,
      shouldQueryStatus: true,
      shouldQueryPaymentDetails: true,
      reason: 'confirm_timeout_requires_status_query',
      safeToRetryConfirm: false,
    })
  }

  if (input.requestStatusResult) {
    return resolveRequestStatus(input.requestStatusResult, input.paymentDetailsResult, expected)
  }

  if (input.paymentDetailsResult) {
    return resolvePaymentDetails(input.paymentDetailsResult, expected)
  }

  if (confirmResultReturnCode) {
    return decision({
      outcome: 'confirm_failed',
      shouldMarkPaid: false,
      shouldQueryStatus: false,
      shouldQueryPaymentDetails: false,
      reason: 'line_pay_confirm_failed',
      safeToRetryConfirm: false,
    })
  }

  return decision({
    outcome: 'confirm_ambiguous',
    shouldMarkPaid: false,
    shouldQueryStatus: true,
    shouldQueryPaymentDetails: true,
    reason: 'confirm_outcome_missing',
    safeToRetryConfirm: false,
  })
}
