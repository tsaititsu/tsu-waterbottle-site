import assert from 'node:assert/strict'
import { resolveNewebPayRedirectPaymentMode } from './redirectPaymentMode'

for (const paymentMode of ['credit', 'apple_pay', 'atm'] as const) {
  assert.equal(
    resolveNewebPayRedirectPaymentMode({
      itemType: 'newebpay_test',
      rawPayload: { paymentMode },
    }),
    paymentMode,
  )
}

for (const paymentMode of ['installment_3', 'installment_6'] as const) {
  assert.equal(
    resolveNewebPayRedirectPaymentMode({
      itemType: 'newebpay_test',
      rawPayload: { paymentMode },
    }),
    'credit',
    '管理員 NT$1 測試不得啟用分期',
  )
  assert.equal(
    resolveNewebPayRedirectPaymentMode({
      itemType: 'course',
      rawPayload: { paymentMode },
    }),
    paymentMode,
    '課程正式付款保留 3／6 期',
  )
}

assert.equal(
  resolveNewebPayRedirectPaymentMode({
    itemType: 'newebpay_test',
    rawPayload: { paymentMode: 'line_pay' },
  }),
  'credit',
)

console.log('NewebPay redirect 通道與分期隔離契約通過')
