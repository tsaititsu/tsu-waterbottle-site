import {
  buildNewebPayOneDollarTestContext,
  isNewebPayOneDollarTestModeEnabled,
  NEWEBPAY_ONE_DOLLAR_TEST_AMOUNT,
  type NewebPayOneDollarTestEnv,
} from './oneDollarTestMode'

export const NEWEBPAY_APPLE_PAY_TEST_ITEM_KEY = 'newebpay_live_smoke_test_1'
export const NEWEBPAY_APPLE_PAY_TEST_SOURCE = 'manual_test'
export const NEWEBPAY_APPLE_PAY_TEST_MODE = 'apple_pay_test'
export const NEWEBPAY_APPLE_PAY_TEST_ITEM_DESC = 'Apple Pay 1 元測試付款'

export type NewebPayApplePayTestPaymentMode = typeof NEWEBPAY_APPLE_PAY_TEST_MODE

export type NewebPayApplePayTestContext = {
  itemKey: typeof NEWEBPAY_APPLE_PAY_TEST_ITEM_KEY
  source: typeof NEWEBPAY_APPLE_PAY_TEST_SOURCE
  paymentMode: NewebPayApplePayTestPaymentMode
  amount: typeof NEWEBPAY_ONE_DOLLAR_TEST_AMOUNT
  itemDesc: typeof NEWEBPAY_APPLE_PAY_TEST_ITEM_DESC | string
  metadata: Record<string, unknown>
}

export type NewebPayApplePayTestPendingPaymentMetadata = {
  itemType: 'newebpay_smoke_test'
  itemId: typeof NEWEBPAY_APPLE_PAY_TEST_ITEM_KEY
  bookingId: null
  rawPayload: Record<string, unknown>
}

export function isNewebPayApplePayTestModeEnabled(env: NewebPayOneDollarTestEnv) {
  return (
    env.ENABLE_NEWEBPAY_APPLE_PAY_TEST_MODE?.trim() === 'true' &&
    isNewebPayOneDollarTestModeEnabled(env)
  )
}

export function buildNewebPayApplePayTestContext(env: NewebPayOneDollarTestEnv): NewebPayApplePayTestContext {
  if (!isNewebPayApplePayTestModeEnabled(env)) {
    throw new Error('apple_pay_test_disabled')
  }

  const oneDollarContext = buildNewebPayOneDollarTestContext({
    env,
    source: NEWEBPAY_APPLE_PAY_TEST_MODE,
    originalAmount: NEWEBPAY_ONE_DOLLAR_TEST_AMOUNT,
    itemDesc: NEWEBPAY_APPLE_PAY_TEST_ITEM_DESC,
    metadata: {
      one_dollar_test_mode: true,
      apple_pay_test: true,
      original_amount: NEWEBPAY_ONE_DOLLAR_TEST_AMOUNT,
      test_source: NEWEBPAY_APPLE_PAY_TEST_MODE,
    },
  })

  return {
    itemKey: NEWEBPAY_APPLE_PAY_TEST_ITEM_KEY,
    source: NEWEBPAY_APPLE_PAY_TEST_SOURCE,
    paymentMode: NEWEBPAY_APPLE_PAY_TEST_MODE,
    amount: NEWEBPAY_ONE_DOLLAR_TEST_AMOUNT,
    itemDesc: oneDollarContext.itemDesc,
    metadata: {
      ...oneDollarContext.metadata,
      one_dollar_test_mode: true,
      apple_pay_test: true,
      original_amount: NEWEBPAY_ONE_DOLLAR_TEST_AMOUNT,
      test_source: NEWEBPAY_APPLE_PAY_TEST_MODE,
    },
  }
}

export function buildNewebPayApplePayTestPendingPaymentMetadata(input: {
  context: NewebPayApplePayTestContext
  merchantOrderNo: string
}): NewebPayApplePayTestPendingPaymentMetadata {
  return {
    itemType: 'newebpay_smoke_test',
    itemId: NEWEBPAY_APPLE_PAY_TEST_ITEM_KEY,
    bookingId: null,
    rawPayload: {
      itemKey: input.context.itemKey,
      source: input.context.source,
      paymentMode: input.context.paymentMode,
      amount: input.context.amount,
      itemDesc: input.context.itemDesc,
      merchantOrderNo: input.merchantOrderNo,
      ...input.context.metadata,
    },
  }
}
