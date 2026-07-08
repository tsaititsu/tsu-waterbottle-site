import assert from 'node:assert/strict'
import {
  buildApplePayTestPaymentRequestBody,
  getApplePayTestCheckoutErrorMessage,
  startApplePayTestCheckout,
  type ApplePayTestFormInput,
  type ApplePayTestPaymentRequestBody,
} from './applePayTestCheckout'

const tests: Array<{ name: string; fn: () => void | Promise<void> }> = []

function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn })
}

async function runTests() {
  for (const { name, fn } of tests) {
    try {
      await fn()
      console.log(`✓ ${name}`)
    } catch (error) {
      console.error(`✗ ${name}`)
      throw error
    }
  }
}

const formFields = {
  MerchantID: 'MS123456789',
  TradeInfo: 'encrypted-trade-info',
  TradeSha: 'A'.repeat(64),
  Version: '2.3',
}

test('request body only contains Apple Pay test fields', () => {
  assert.deepEqual(buildApplePayTestPaymentRequestBody(), {
    itemKey: 'newebpay_live_smoke_test_1',
    source: 'manual_test',
    paymentMode: 'apple_pay_test',
  })
})

test('checkout errors map to friendly messages', () => {
  assert.equal(
    getApplePayTestCheckoutErrorMessage('apple_pay_test_create_failed'),
    'Apple Pay 測試付款資料建立失敗，請確認測試模式已開啟。',
  )
})

test('successful checkout creates Apple Pay test payment and submits NewebPay form', async () => {
  const createCalls: ApplePayTestPaymentRequestBody[] = []
  const formCalls: ApplePayTestFormInput[] = []

  const result = await startApplePayTestCheckout({
    createPayment: async (body) => {
      createCalls.push(body)
      return {
        ok: true,
        provider: 'newebpay',
        amount: 1,
        merchantOrderNo: 'WB20260708120000APPL',
        action: 'https://ccore.newebpay.com/MPG/mpg_gateway',
        method: 'POST',
        fields: formFields,
      }
    },
    submitForm: async (form) => {
      formCalls.push(form)
    },
  })

  assert.equal(result.ok, true)
  if (!result.ok) throw new Error(result.error)
  assert.equal(result.provider, 'newebpay')
  assert.equal(result.amount, 1)
  assert.equal(result.merchantOrderNo, 'WB20260708120000APPL')
  assert.deepEqual(createCalls, [
    {
      itemKey: 'newebpay_live_smoke_test_1',
      source: 'manual_test',
      paymentMode: 'apple_pay_test',
    },
  ])
  assert.equal(Object.keys(createCalls[0]).includes('productOrderId'), false)
  assert.equal(Object.keys(createCalls[0]).includes('courseId'), false)
  assert.equal(Object.keys(createCalls[0]).includes('readingId'), false)
  assert.equal(Object.keys(createCalls[0]).includes('reportId'), false)
  assert.equal(formCalls.length, 1)
  assert.equal(formCalls[0].action, 'https://ccore.newebpay.com/MPG/mpg_gateway')
  assert.equal(formCalls[0].method, 'POST')
  assert.deepEqual(
    formCalls[0].fields.map((field) => field.name),
    ['MerchantID', 'TradeInfo', 'TradeSha', 'Version'],
  )

  const serializedSuccess = JSON.stringify(result)
  assert.equal(serializedSuccess.includes('HashKey'), false)
  assert.equal(serializedSuccess.includes('HashIV'), false)
  assert.equal(serializedSuccess.includes('LINEPAY'), false)
  assert.equal(serializedSuccess.includes('VACC'), false)
  assert.equal(serializedSuccess.includes('ANDROIDPAY'), false)
  assert.equal(serializedSuccess.includes('SAMSUNGPAY'), false)
})

test('create failure does not submit form', async () => {
  const createFailed = await startApplePayTestCheckout({
    createPayment: async () => ({ ok: false, error: 'apple_pay_test_disabled' }),
    submitForm: async () => {
      throw new Error('should not submit')
    },
  })

  assert.deepEqual(createFailed, {
    ok: false,
    provider: 'newebpay',
    error: 'apple_pay_test_create_failed',
  })
})

test('missing Form Post fields returns form_fields_missing', async () => {
  const missingFields = await startApplePayTestCheckout({
    createPayment: async () => ({
      ok: true,
      amount: 1,
      merchantOrderNo: 'WB20260708120000APPL',
      action: 'https://ccore.newebpay.com/MPG/mpg_gateway',
      method: 'POST',
      fields: {
        MerchantID: 'MS123456789',
      },
    }),
    submitForm: async () => {
      throw new Error('should not submit')
    },
  })

  assert.deepEqual(missingFields, {
    ok: false,
    provider: 'newebpay',
    error: 'apple_pay_test_form_fields_missing',
  })
})

test('submit failure returns submit_failed', async () => {
  const submitFailed = await startApplePayTestCheckout({
    createPayment: async () => ({
      ok: true,
      amount: 1,
      merchantOrderNo: 'WB20260708120000APPL',
      action: 'https://ccore.newebpay.com/MPG/mpg_gateway',
      method: 'POST',
      fields: formFields,
    }),
    submitForm: async () => {
      throw new Error('submit failed')
    },
  })

  assert.deepEqual(submitFailed, {
    ok: false,
    provider: 'newebpay',
    error: 'apple_pay_test_submit_failed',
  })
})

void runTests()
