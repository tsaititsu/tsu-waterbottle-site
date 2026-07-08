import {
  buildNewebPayClientFormFields,
  type NewebPayClientFormField,
} from '../../../../lib/newebpay/clientForm'

export const APPLE_PAY_TEST_PAGE_TITLE = 'Apple Pay 1 元測試'
export const APPLE_PAY_TEST_BUTTON_LABEL = '前往 Apple Pay 測試付款'
export const APPLE_PAY_TEST_LOADING_LABEL = '建立 Apple Pay 測試付款中...'

export type ApplePayTestPaymentRequestBody = {
  itemKey: 'newebpay_live_smoke_test_1'
  source: 'manual_test'
  paymentMode: 'apple_pay_test'
}

export type ApplePayTestFormInput = {
  action: string
  method: 'POST'
  fields: NewebPayClientFormField[]
}

export type ApplePayTestCreatePayment = (body: ApplePayTestPaymentRequestBody) => Promise<unknown>
export type ApplePayTestSubmitForm = (input: ApplePayTestFormInput) => Promise<void> | void

export type StartApplePayTestCheckoutResult =
  | {
      ok: true
      provider: 'newebpay'
      amount: 1
      merchantOrderNo: string
      action: string
      method: 'POST'
    }
  | {
      ok: false
      provider: 'newebpay'
      error:
        | 'apple_pay_test_create_failed'
        | 'apple_pay_test_form_fields_missing'
        | 'apple_pay_test_submit_failed'
    }

export type StartApplePayTestCheckoutError = Extract<StartApplePayTestCheckoutResult, { ok: false }>['error']

export function buildApplePayTestPaymentRequestBody(): ApplePayTestPaymentRequestBody {
  return {
    itemKey: 'newebpay_live_smoke_test_1',
    source: 'manual_test',
    paymentMode: 'apple_pay_test',
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getStringField(value: unknown, key: string) {
  if (!isRecord(value)) return null
  const field = value[key]
  if (typeof field !== 'string' && typeof field !== 'number') return null
  const text = String(field).trim()
  return text || null
}

function getNumberField(value: unknown, key: string) {
  if (!isRecord(value)) return null
  const field = value[key]
  return typeof field === 'number' && Number.isFinite(field) ? field : null
}

export function getApplePayTestCheckoutErrorMessage(error: StartApplePayTestCheckoutError) {
  switch (error) {
    case 'apple_pay_test_create_failed':
      return 'Apple Pay 測試付款資料建立失敗，請確認測試模式已開啟。'
    case 'apple_pay_test_form_fields_missing':
      return 'Apple Pay 測試付款表單資料不完整，請稍後再試。'
    case 'apple_pay_test_submit_failed':
      return '無法前往藍新 Apple Pay 測試付款頁，請稍後再試。'
  }
}

export async function startApplePayTestCheckout(input: {
  createPayment: ApplePayTestCreatePayment
  submitForm: ApplePayTestSubmitForm
}): Promise<StartApplePayTestCheckoutResult> {
  let paymentResponse: unknown

  try {
    paymentResponse = await input.createPayment(buildApplePayTestPaymentRequestBody())
  } catch {
    return {
      ok: false,
      provider: 'newebpay',
      error: 'apple_pay_test_create_failed',
    }
  }

  if (!isRecord(paymentResponse) || paymentResponse.ok !== true) {
    return {
      ok: false,
      provider: 'newebpay',
      error: 'apple_pay_test_create_failed',
    }
  }

  const action = getStringField(paymentResponse, 'action')
  const merchantOrderNo = getStringField(paymentResponse, 'merchantOrderNo')
  const amount = getNumberField(paymentResponse, 'amount')
  const method = getStringField(paymentResponse, 'method')
  const fieldResult = isRecord(paymentResponse.fields)
    ? buildNewebPayClientFormFields(paymentResponse.fields)
    : { ok: false as const }

  if (!action || !merchantOrderNo || amount !== 1 || method !== 'POST' || !fieldResult.ok) {
    return {
      ok: false,
      provider: 'newebpay',
      error: 'apple_pay_test_form_fields_missing',
    }
  }

  try {
    await input.submitForm({
      action,
      method: 'POST',
      fields: fieldResult.fields,
    })
  } catch {
    return {
      ok: false,
      provider: 'newebpay',
      error: 'apple_pay_test_submit_failed',
    }
  }

  return {
    ok: true,
    provider: 'newebpay',
    amount: 1,
    merchantOrderNo,
    action,
    method: 'POST',
  }
}
