import assert from 'node:assert/strict'
import {
  getCheckoutPaymentMethodOptions,
  isCheckoutPaymentMethod,
  toCourseNewebPayCheckoutMode,
  toStandardNewebPayCheckoutMode,
} from './paymentMethods'

assert.deepEqual(
  getCheckoutPaymentMethodOptions().map((option) => option.value),
  ['credit_card', 'apple_pay', 'line_pay', 'newebpay_atm'],
)
assert.deepEqual(
  getCheckoutPaymentMethodOptions({ includeNewebPay: false }).map(
    (option) => option.value,
  ),
  ['line_pay'],
)
assert.deepEqual(
  getCheckoutPaymentMethodOptions({ includeLinePay: false }).map(
    (option) => option.value,
  ),
  ['credit_card', 'apple_pay', 'newebpay_atm'],
)
assert.deepEqual(
  getCheckoutPaymentMethodOptions({ includeCourseInstallments: true }).map(
    (option) => option.value,
  ),
  [
    'credit_card',
    'apple_pay',
    'line_pay',
    'newebpay_atm',
    'credit_card_installment_3',
    'credit_card_installment_6',
  ],
)
assert.equal(isCheckoutPaymentMethod('newebpay_atm'), true)
assert.equal(isCheckoutPaymentMethod('bank_transfer'), false)
assert.equal(isCheckoutPaymentMethod('web_atm'), false)
assert.equal(isCheckoutPaymentMethod('newebpay_line_pay'), false)
assert.equal(toStandardNewebPayCheckoutMode('credit_card'), 'credit')
assert.equal(toStandardNewebPayCheckoutMode('apple_pay'), 'apple_pay')
assert.equal(toStandardNewebPayCheckoutMode('newebpay_atm'), 'atm')
assert.equal(toCourseNewebPayCheckoutMode('credit_card_installment_3'), 'installment_3')
assert.equal(toCourseNewebPayCheckoutMode('credit_card_installment_6'), 'installment_6')

console.log('Payment method tests passed')
