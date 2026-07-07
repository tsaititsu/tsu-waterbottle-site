export type LinePayConfirmCurrency = 'TWD'

export type LinePayConfirmPayloadInput = {
  amount: number
  currency?: LinePayConfirmCurrency | string
}

export type LinePayConfirmPayload = {
  amount: number
  currency: LinePayConfirmCurrency
}

function isPositiveInteger(value: number) {
  return Number.isInteger(value) && value > 0
}

export function validateLinePayTransactionId(transactionId: unknown) {
  const value = String(transactionId ?? '').trim()

  if (!value || !/^\d+$/.test(value)) {
    throw new Error('invalid_line_pay_transaction_id')
  }

  return value
}

export function buildLinePayConfirmPayload(input: LinePayConfirmPayloadInput): LinePayConfirmPayload {
  const currency = input.currency ?? 'TWD'

  if (!isPositiveInteger(input.amount)) {
    throw new Error('invalid_line_pay_amount')
  }

  if (currency !== 'TWD') {
    throw new Error('invalid_line_pay_currency')
  }

  return {
    amount: input.amount,
    currency,
  }
}
