import assert from 'node:assert/strict'
import {
  buildNewebPayApplePayTestContext,
  buildNewebPayApplePayTestPendingPaymentMetadata,
  isNewebPayApplePayTestModeEnabled,
  NEWEBPAY_APPLE_PAY_TEST_ITEM_DESC,
  NEWEBPAY_APPLE_PAY_TEST_ITEM_KEY,
  NEWEBPAY_APPLE_PAY_TEST_MODE,
  NEWEBPAY_APPLE_PAY_TEST_SOURCE,
} from './applePayTestPayment'
import { ONE_DOLLAR_TEST_CONFIRMATION_VALUE } from './oneDollarTestMode'

const enabledEnv = {
  ENABLE_NEWEBPAY_APPLE_PAY_TEST_MODE: 'true',
  ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_MODE: 'true',
  NEWEBPAY_ENV: 'test',
}

assert.equal(isNewebPayApplePayTestModeEnabled({}), false)
assert.equal(
  isNewebPayApplePayTestModeEnabled({
    ENABLE_NEWEBPAY_APPLE_PAY_TEST_MODE: 'true',
    ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_MODE: 'false',
    NEWEBPAY_ENV: 'test',
  }),
  false,
)
assert.equal(
  isNewebPayApplePayTestModeEnabled({
    ENABLE_NEWEBPAY_APPLE_PAY_TEST_MODE: 'false',
    ENABLE_NEWEBPAY_ONE_DOLLAR_TEST_MODE: 'true',
    NEWEBPAY_ENV: 'test',
  }),
  false,
)
assert.equal(isNewebPayApplePayTestModeEnabled(enabledEnv), true)
assert.equal(
  isNewebPayApplePayTestModeEnabled({
    ...enabledEnv,
    NEWEBPAY_ENV: 'production',
  }),
  false,
)
assert.equal(
  isNewebPayApplePayTestModeEnabled({
    ...enabledEnv,
    NEWEBPAY_ENV: 'production',
    NEWEBPAY_ONE_DOLLAR_TEST_PRODUCTION_CONFIRMATION: ONE_DOLLAR_TEST_CONFIRMATION_VALUE,
  }),
  true,
)

assert.throws(() => buildNewebPayApplePayTestContext({}), /apple_pay_test_disabled/)

const context = buildNewebPayApplePayTestContext(enabledEnv)

assert.equal(context.itemKey, NEWEBPAY_APPLE_PAY_TEST_ITEM_KEY)
assert.equal(context.source, NEWEBPAY_APPLE_PAY_TEST_SOURCE)
assert.equal(context.paymentMode, NEWEBPAY_APPLE_PAY_TEST_MODE)
assert.equal(context.amount, 1)
assert.equal(context.itemDesc, `${NEWEBPAY_APPLE_PAY_TEST_ITEM_DESC}｜1元測試付款`)
assert.equal(context.metadata.test_payment, true)
assert.equal(context.metadata.one_dollar_test_mode, true)
assert.equal(context.metadata.apple_pay_test, true)
assert.equal(context.metadata.original_amount, 1)
assert.equal(context.metadata.test_source, 'apple_pay_test')

const metadata = buildNewebPayApplePayTestPendingPaymentMetadata({
  context,
  merchantOrderNo: 'WB20260708120000APPL',
})

assert.equal(metadata.itemType, 'newebpay_smoke_test')
assert.equal(metadata.itemId, NEWEBPAY_APPLE_PAY_TEST_ITEM_KEY)
assert.equal(metadata.bookingId, null)
assert.equal(metadata.rawPayload.itemKey, NEWEBPAY_APPLE_PAY_TEST_ITEM_KEY)
assert.equal(metadata.rawPayload.source, NEWEBPAY_APPLE_PAY_TEST_SOURCE)
assert.equal(metadata.rawPayload.paymentMode, NEWEBPAY_APPLE_PAY_TEST_MODE)
assert.equal(metadata.rawPayload.amount, 1)
assert.equal(metadata.rawPayload.itemDesc, `${NEWEBPAY_APPLE_PAY_TEST_ITEM_DESC}｜1元測試付款`)
assert.equal(metadata.rawPayload.merchantOrderNo, 'WB20260708120000APPL')
assert.equal(metadata.rawPayload.test_payment, true)
assert.equal(metadata.rawPayload.one_dollar_test_mode, true)
assert.equal(metadata.rawPayload.apple_pay_test, true)
assert.equal(metadata.rawPayload.original_amount, 1)
assert.equal(metadata.rawPayload.test_source, 'apple_pay_test')

const serialized = JSON.stringify(metadata)

assert.equal(serialized.includes('HashKey'), false)
assert.equal(serialized.includes('HashIV'), false)
assert.equal(serialized.includes('MerchantID'), false)
assert.equal(serialized.includes('TradeInfo'), false)
assert.equal(serialized.includes('TradeSha'), false)
assert.equal(serialized.includes('product_order'), false)
assert.equal(serialized.includes('course_purchase'), false)
assert.equal(serialized.includes('divination_reading'), false)
