import type { CourseNewebPayPaymentMode } from './types'

const standardModes = new Set<CourseNewebPayPaymentMode>([
  'credit',
  'apple_pay',
  'atm',
])

const courseModes = new Set<CourseNewebPayPaymentMode>([
  ...standardModes,
  'installment_3',
  'installment_6',
])

function getRawPaymentMode(
  rawPayload: Record<string, unknown> | null,
): CourseNewebPayPaymentMode | null {
  const value = rawPayload?.paymentMode
  return typeof value === 'string'
    ? value as CourseNewebPayPaymentMode
    : null
}

export function resolveNewebPayRedirectPaymentMode(input: {
  itemType: string
  rawPayload: Record<string, unknown> | null
}): CourseNewebPayPaymentMode {
  const paymentMode = getRawPaymentMode(input.rawPayload)

  if (input.itemType === 'course' && paymentMode && courseModes.has(paymentMode)) {
    return paymentMode
  }

  if (
    input.itemType === 'newebpay_test'
    && paymentMode
    && standardModes.has(paymentMode)
  ) {
    return paymentMode
  }

  return 'credit'
}
