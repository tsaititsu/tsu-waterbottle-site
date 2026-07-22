import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CART_NEWEBPAY_APPLE_PAY_BUTTON_LABEL,
  CART_NEWEBPAY_APPLE_PAY_LOADING_MESSAGE,
  CART_NEWEBPAY_APPLE_PAY_READY_MESSAGE,
  CART_NEWEBPAY_BUTTON_LABEL,
  CART_NEWEBPAY_LOADING_MESSAGE,
  CART_NEWEBPAY_READY_MESSAGE,
  getCartNewebPayButtonState,
  getNewebPayCartCheckoutErrorMessage,
  startNewebPayCartCheckout,
  type CartNewebPayCheckoutItem,
  type CartNewebPayCreateProductOrderInput,
  type CartNewebPayCustomerInfo,
  type CartNewebPayFormInput,
  type CartNewebPayPaymentRequestBody,
} from './newebpayCheckout'

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

function readCartPageSource() {
  return readFileSync(join(process.cwd(), 'src/app/cart/page.tsx'), 'utf8')
}

function readNewebPayCheckoutSource() {
  return readFileSync(join(process.cwd(), 'src/app/cart/newebpayCheckout.ts'), 'utf8')
}

const cartItems: CartNewebPayCheckoutItem[] = [
  {
    id: 'ren-yuan-fu',
    itemName: '人緣符',
    amount: 1500,
    quantity: 1,
  },
]

const customerInfo: CartNewebPayCustomerInfo = {
  customerName: '測試客人',
  customerPhone: '0912345678',
  customerEmail: 'test@example.com',
  recipientName: '測試收件人',
  recipientPhone: '0912345678',
  recipientEmail: 'receiver@example.com',
  postalCode: '100',
  address: '台北市測試區測試路 1 號',
  note: '測試備註',
}

const neWebPayFields = {
  MerchantID: 'MS123456789',
  TradeInfo: 'encrypted-trade-info',
  TradeSha: 'A'.repeat(64),
  Version: '2.3',
}

function createOrderOk(calls: CartNewebPayCreateProductOrderInput[] = []) {
  return async (input: CartNewebPayCreateProductOrderInput) => {
    calls.push(input)
    return {
      ok: true,
      productOrderId: 'product-order-1',
    }
  }
}

function createNewebPayPaymentOk(calls: CartNewebPayPaymentRequestBody[] = []) {
  return async (body: CartNewebPayPaymentRequestBody) => {
    calls.push(body)
    return {
      ok: true,
      provider: 'newebpay',
      merchantOrderNo: 'WB20260708123456PROD',
      itemKey: 'spiritual_product_order',
      amount: 1500,
      action: 'https://ccore.newebpay.com/MPG/mpg_gateway',
      method: 'POST',
      fields: neWebPayFields,
    }
  }
}

function submitFormOk(calls: CartNewebPayFormInput[] = []) {
  return async (form: CartNewebPayFormInput) => {
    calls.push(form)
  }
}

test('button label is credit card payment and not LINE Pay', () => {
  assert.equal(CART_NEWEBPAY_BUTTON_LABEL, '信用卡付款')
  assert.equal(CART_NEWEBPAY_APPLE_PAY_BUTTON_LABEL, 'Apple Pay 付款（iPhone / Safari）')
  assert.equal(CART_NEWEBPAY_BUTTON_LABEL.includes('LINE Pay'), false)
  assert.equal(CART_NEWEBPAY_BUTTON_LABEL.includes('分期'), false)
  assert.equal(CART_NEWEBPAY_APPLE_PAY_BUTTON_LABEL.includes('測試'), false)
  assert.equal(CART_NEWEBPAY_APPLE_PAY_BUTTON_LABEL.includes('NT$1'), false)
})

test('button state is visible and loading state is disabled', () => {
  assert.deepEqual(getCartNewebPayButtonState(false), {
    visible: true,
    disabled: false,
    label: CART_NEWEBPAY_BUTTON_LABEL,
    message: CART_NEWEBPAY_READY_MESSAGE,
  })
  assert.deepEqual(getCartNewebPayButtonState(true), {
    visible: true,
    disabled: true,
    label: CART_NEWEBPAY_BUTTON_LABEL,
    message: CART_NEWEBPAY_LOADING_MESSAGE,
  })
  assert.deepEqual(getCartNewebPayButtonState(false, 'product_order_apple_pay'), {
    visible: true,
    disabled: false,
    label: CART_NEWEBPAY_APPLE_PAY_BUTTON_LABEL,
    message: CART_NEWEBPAY_APPLE_PAY_READY_MESSAGE,
  })
  assert.deepEqual(getCartNewebPayButtonState(true, 'product_order_apple_pay'), {
    visible: true,
    disabled: true,
    label: CART_NEWEBPAY_APPLE_PAY_BUTTON_LABEL,
    message: CART_NEWEBPAY_APPLE_PAY_LOADING_MESSAGE,
  })
})

test('checkout errors map to friendly messages', () => {
  assert.equal(getNewebPayCartCheckoutErrorMessage('newebpay_cart_empty'), '購物車目前沒有可付款的開運商品。')
  assert.equal(getNewebPayCartCheckoutErrorMessage('newebpay_create_order_failed'), '商品訂單建立失敗，請稍後再試。')
  assert.equal(getNewebPayCartCheckoutErrorMessage('newebpay_payment_create_failed'), '付款資料建立失敗，請稍後再試。')
})

test('empty cart returns newebpay_cart_empty', async () => {
  const result = await startNewebPayCartCheckout({
    cartItems: [],
    customerInfo,
    createProductOrder: createOrderOk(),
    createNewebPayPayment: createNewebPayPaymentOk(),
    submitNewebPayForm: submitFormOk(),
  })

  assert.deepEqual(result, {
    ok: false,
    provider: 'newebpay',
    error: 'newebpay_cart_empty',
  })
})

test('missing customer info returns newebpay_customer_info_missing', async () => {
  const result = await startNewebPayCartCheckout({
    cartItems,
    customerInfo: {
      ...customerInfo,
      recipientPhone: '',
    },
    createProductOrder: createOrderOk(),
    createNewebPayPayment: createNewebPayPaymentOk(),
    submitNewebPayForm: submitFormOk(),
  })

  assert.deepEqual(result, {
    ok: false,
    provider: 'newebpay',
    error: 'newebpay_customer_info_missing',
  })
})

test('createProductOrder is called before creating NewebPay payment', async () => {
  const createCalls: CartNewebPayCreateProductOrderInput[] = []
  const paymentCalls: CartNewebPayPaymentRequestBody[] = []

  await startNewebPayCartCheckout({
    cartItems,
    customerInfo,
    createProductOrder: createOrderOk(createCalls),
    createNewebPayPayment: createNewebPayPaymentOk(paymentCalls),
    submitNewebPayForm: submitFormOk(),
  })

  assert.equal(createCalls.length, 1)
  assert.equal(createCalls[0].paymentMethod, 'newebpay')
  assert.deepEqual(createCalls[0].items, [
    {
      productSlug: 'ren-yuan-fu',
      quantity: 1,
    },
  ])
  assert.equal(createCalls[0].shippingInfo.shippingMethod, 'manual')
  assert.equal(paymentCalls.length, 1)
})

test('createProductOrder failure does not create NewebPay payment', async () => {
  const paymentCalls: CartNewebPayPaymentRequestBody[] = []
  const result = await startNewebPayCartCheckout({
    cartItems,
    customerInfo,
    createProductOrder: async () => {
      throw new Error('create failed')
    },
    createNewebPayPayment: createNewebPayPaymentOk(paymentCalls),
    submitNewebPayForm: submitFormOk(),
  })

  assert.deepEqual(result, {
    ok: false,
    provider: 'newebpay',
    error: 'newebpay_create_order_failed',
  })
  assert.deepEqual(paymentCalls, [])
})

test('createProductOrder missing productOrderId returns newebpay_product_order_id_missing', async () => {
  const result = await startNewebPayCartCheckout({
    cartItems,
    customerInfo,
    createProductOrder: async () => ({ ok: true }),
    createNewebPayPayment: createNewebPayPaymentOk(),
    submitNewebPayForm: submitFormOk(),
  })

  assert.deepEqual(result, {
    ok: false,
    provider: 'newebpay',
    error: 'newebpay_product_order_id_missing',
  })
})

test('createProductOrder orderId response can be used as productOrderId', async () => {
  const paymentCalls: CartNewebPayPaymentRequestBody[] = []

  const result = await startNewebPayCartCheckout({
    cartItems,
    customerInfo,
    createProductOrder: async () => ({
      ok: true,
      orderId: 'product-order-from-route',
    }),
    createNewebPayPayment: createNewebPayPaymentOk(paymentCalls),
    submitNewebPayForm: submitFormOk(),
  })

  assert.equal(result.ok, true)
  if (!result.ok) throw new Error(`unexpected failure: ${JSON.stringify(result)}`)
  assert.equal(result.productOrderId, 'product-order-from-route')
  assert.deepEqual(paymentCalls, [
    {
      productOrderId: 'product-order-from-route',
      paymentMode: 'credit',
    },
  ])
})

test('createNewebPayPayment body only includes productOrderId and credit mode', async () => {
  const paymentCalls: CartNewebPayPaymentRequestBody[] = []

  await startNewebPayCartCheckout({
    cartItems,
    customerInfo,
    createProductOrder: createOrderOk(),
    createNewebPayPayment: createNewebPayPaymentOk(paymentCalls),
    submitNewebPayForm: submitFormOk(),
  })

  assert.deepEqual(paymentCalls, [
    {
      productOrderId: 'product-order-1',
      paymentMode: 'credit',
    },
  ])
  assert.deepEqual(Object.keys(paymentCalls[0]).sort(), ['paymentMode', 'productOrderId'])
  assert.equal(JSON.stringify(paymentCalls).includes('linepay'), false)
  assert.equal(JSON.stringify(paymentCalls).includes('atm'), false)
  assert.equal(JSON.stringify(paymentCalls).includes('wallet'), false)
})

test('Apple Pay checkout requests product order Apple Pay mode with formal amount', async () => {
  const paymentCalls: CartNewebPayPaymentRequestBody[] = []
  const submitCalls: CartNewebPayFormInput[] = []

  const result = await startNewebPayCartCheckout({
    cartItems,
    customerInfo,
    paymentMode: 'product_order_apple_pay',
    createProductOrder: createOrderOk(),
    createNewebPayPayment: createNewebPayPaymentOk(paymentCalls),
    submitNewebPayForm: submitFormOk(submitCalls),
  })

  assert.equal(result.ok, true)
  if (!result.ok) throw new Error(`unexpected failure: ${JSON.stringify(result)}`)
  assert.equal(result.amount, 1500)
  assert.deepEqual(paymentCalls, [
    {
      productOrderId: 'product-order-1',
      paymentMode: 'product_order_apple_pay',
    },
  ])
  assert.deepEqual(Object.keys(paymentCalls[0]).sort(), ['paymentMode', 'productOrderId'])
  assert.equal(JSON.stringify(paymentCalls).includes('linepay'), false)
  assert.equal(JSON.stringify(paymentCalls).includes('atm'), false)
  assert.equal(JSON.stringify(paymentCalls).includes('wallet'), false)
  assert.equal(submitCalls.length, 1)
})

test('createNewebPayPayment failure does not submit form', async () => {
  const submitCalls: CartNewebPayFormInput[] = []
  const result = await startNewebPayCartCheckout({
    cartItems,
    customerInfo,
    createProductOrder: createOrderOk(),
    createNewebPayPayment: async () => {
      throw new Error('payment failed')
    },
    submitNewebPayForm: submitFormOk(submitCalls),
  })

  assert.deepEqual(result, {
    ok: false,
    provider: 'newebpay',
    error: 'newebpay_payment_create_failed',
  })
  assert.deepEqual(submitCalls, [])
})

test('missing form fields returns newebpay_form_fields_missing', async () => {
  const result = await startNewebPayCartCheckout({
    cartItems,
    customerInfo,
    createProductOrder: createOrderOk(),
    createNewebPayPayment: async () => ({
      ok: true,
      action: 'https://ccore.newebpay.com/MPG/mpg_gateway',
      fields: {
        MerchantID: 'MS123456789',
        Version: '2.3',
      },
    }),
    submitNewebPayForm: submitFormOk(),
  })

  assert.deepEqual(result, {
    ok: false,
    provider: 'newebpay',
    error: 'newebpay_form_fields_missing',
  })
})

test('successful checkout submits NewebPay form and returns safe result', async () => {
  const submitCalls: CartNewebPayFormInput[] = []
  const result = await startNewebPayCartCheckout({
    cartItems,
    customerInfo,
    createProductOrder: createOrderOk(),
    createNewebPayPayment: createNewebPayPaymentOk(),
    submitNewebPayForm: submitFormOk(submitCalls),
  })

  assert.equal(result.ok, true)
  if (!result.ok) throw new Error(`unexpected failure: ${JSON.stringify(result)}`)
  assert.equal(result.provider, 'newebpay')
  assert.equal(result.productOrderId, 'product-order-1')
  assert.equal(result.merchantOrderNo, 'WB20260708123456PROD')
  assert.equal(result.action, 'https://ccore.newebpay.com/MPG/mpg_gateway')
  assert.equal(result.method, 'POST')
  assert.equal(result.amount, 1500)
  assert.equal(result.itemKey, 'spiritual_product_order')
  assert.equal(submitCalls.length, 1)
  assert.equal(submitCalls[0].action, 'https://ccore.newebpay.com/MPG/mpg_gateway')
  assert.equal(submitCalls[0].method, 'POST')
  assert.deepEqual(submitCalls[0].fields, [
    { name: 'MerchantID', value: 'MS123456789' },
    { name: 'TradeInfo', value: 'encrypted-trade-info' },
    { name: 'TradeSha', value: 'A'.repeat(64) },
    { name: 'Version', value: '2.3' },
  ])
})

test('submitNewebPayForm throw returns newebpay_form_submit_failed', async () => {
  const result = await startNewebPayCartCheckout({
    cartItems,
    customerInfo,
    createProductOrder: createOrderOk(),
    createNewebPayPayment: createNewebPayPaymentOk(),
    submitNewebPayForm: async () => {
      throw new Error('submit failed')
    },
  })

  assert.deepEqual(result, {
    ok: false,
    provider: 'newebpay',
    error: 'newebpay_form_submit_failed',
  })
})

test('helper does not call global fetch or window location', async () => {
  const originalFetch = globalThis.fetch
  let called = false

  globalThis.fetch = (async () => {
    called = true
    throw new Error('global fetch must not be called')
  }) as typeof fetch

  try {
    await startNewebPayCartCheckout({
      cartItems,
      customerInfo,
      createProductOrder: createOrderOk(),
      createNewebPayPayment: createNewebPayPaymentOk(),
      submitNewebPayForm: submitFormOk(),
    })
  } finally {
    globalThis.fetch = originalFetch
  }

  const source = readNewebPayCheckoutSource()
  assert.equal(called, false)
  assert.equal(source.includes('fetch('), false)
  assert.equal(source.includes('window.location'), false)
  assert.equal(source.includes('document.createElement'), false)
})

test('helper source does not enable linepay, atm, or wallet payments', () => {
  const source = readNewebPayCheckoutSource()

  for (const forbidden of [
    'LINEPAY',
    'linepay',
    'VACC',
    'WEBATM',
    'ANDROIDPAY',
    'SAMSUNGPAY',
    "provider: 'line_pay'",
    'InstFlag',
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden)
  }
})

test('form submit input does not receive HashKey, HashIV, or decrypted TradeInfo content', async () => {
  const submitCalls: CartNewebPayFormInput[] = []

  await startNewebPayCartCheckout({
    cartItems,
    customerInfo,
    createProductOrder: createOrderOk(),
    createNewebPayPayment: createNewebPayPaymentOk(),
    submitNewebPayForm: submitFormOk(submitCalls),
  })

  const text = JSON.stringify(submitCalls)
  for (const forbidden of [
    'HashKey',
    'HashIV',
    'MerchantOrderNo=',
    'Amt=',
    'ItemDesc=',
    'CREDIT=1',
    'InstFlag=0',
    'LINEPAY=1',
    'VACC=1',
    'APPLEPAY=1',
    'ANDROIDPAY=1',
    'SAMSUNGPAY=1',
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden)
  }
})

test('success result does not expose contact fields, secrets, or raw TradeInfo', async () => {
  const result = await startNewebPayCartCheckout({
    cartItems,
    customerInfo,
    createProductOrder: createOrderOk(),
    createNewebPayPayment: createNewebPayPaymentOk(),
    submitNewebPayForm: submitFormOk(),
  })
  const text = JSON.stringify(result)

  for (const forbidden of [
    'HashKey',
    'HashIV',
    'TradeInfo',
    'TradeSha',
    'phone',
    'email',
    'address',
    'LINEPAY',
    'VACC',
    'APPLEPAY',
    'ANDROIDPAY',
    'SAMSUNGPAY',
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden)
  }
})

test('cart page renders only credit card and Apple Pay payment options', () => {
  const source = readCartPageSource()
  const optionsStart = source.indexOf('const cartPaymentMethodOptions')
  const optionsEnd = source.indexOf('\n]\n\ntype PostOfficeShippingInfo', optionsStart)
  const optionsSource = source.slice(optionsStart, optionsEnd)

  assert.equal(source.includes('cartPaymentMethodOptions'), true)
  assert.equal(source.includes('<select'), true)
  assert.equal(source.includes('付款方式'), true)
  assert.equal(optionsStart >= 0, true)
  assert.equal(optionsEnd > optionsStart, true)
  assert.equal(optionsSource.match(/    value: '/g)?.length, 2)
  assert.equal(optionsSource.includes("value: 'credit'"), true)
  assert.equal(optionsSource.includes("value: 'product_order_apple_pay'"), true)
  assert.equal(optionsSource.includes("label: '信用卡付款'"), true)
  assert.equal(optionsSource.includes("label: 'Apple Pay 付款（iPhone / Safari）'"), true)
  assert.equal(optionsSource.includes('郵局匯款'), false)
  assert.equal(optionsSource.includes("value: 'post_office'"), false)
  assert.equal(optionsSource.includes("ctaLabel: '前往信用卡付款'"), true)
  assert.equal(optionsSource.includes("ctaLabel: '前往 Apple Pay 付款'"), true)
  assert.equal(source.includes('href="/bank-transfer"'), false)
  assert.equal(source.includes('前往結帳'), false)
  assert.equal(source.includes('前往付款'), false)
})

test('cart page selector wires NewebPay choices to product order and NewebPay create APIs', () => {
  const source = readCartPageSource()

  assert.equal(source.includes('handleNewebPayCheckoutClick'), true)
  assert.equal(source.includes('selectedPaymentMethodOption.ctaLabel'), true)
  assert.equal(source.includes("fetch('/api/product-orders/create'"), true)
  assert.equal(source.includes("fetch('/api/payments/newebpay/create'"), true)
  assert.equal(source.includes("itemKey: 'spiritual_product_order'"), true)
  assert.equal(source.includes("source: 'product_order'"), true)
  assert.equal(source.includes('paymentMode: body.paymentMode'), true)
  assert.equal(source.includes('orderId: body.productOrderId'), true)
})

test('cart page posts only NewebPay credit parameters and submits payment form', () => {
  const source = readCartPageSource()

  assert.equal(source.includes('submitCartNewebPayForm'), true)
  assert.equal(source.includes('window.location.assign(data'), false)
  assert.equal(source.includes("paymentMethod: 'newebpay'"), true)
  assert.equal(source.includes("paymentMode: body.paymentMode"), true)
  assert.equal(source.includes("value: 'credit'"), true)
  assert.equal(source.includes('handleNewebPayCheckoutClick(selectedPaymentMethod)'), true)
  assert.equal(source.includes("value: 'product_order_apple_pay'"), true)
  assert.equal(source.includes("paymentMethod: 'line_pay'"), false)
  assert.equal(source.includes("paymentMode: 'linepay'"), false)
  assert.equal(source.includes("paymentMode: 'atm'"), false)
  assert.equal(source.includes('APPLEPAY'), false)
  assert.equal(source.includes('ANDROIDPAY'), false)
  assert.equal(source.includes('SAMSUNGPAY'), false)
  assert.equal(source.includes('VACC'), false)
  assert.equal(source.includes('LINEPAY'), false)
  assert.equal(source.includes('測試 NT$1'), false)
  assert.equal(source.includes('1 元測試'), false)
  assert.equal(source.includes('/apple-pay-test'), false)
})

test('cart page prevents duplicate NewebPay checkout while loading', () => {
  const source = readCartPageSource()

  assert.equal(source.includes('if (isNewebPayCheckingOut) return'), true)
  assert.equal(source.includes('setIsNewebPayCheckingOut(true)'), true)
  assert.equal(source.includes('disabled={isNewebPayCheckingOut}'), true)
})

test('post office shipping data remains intact after transfer payment retirement', () => {
  const source = readCartPageSource()

  assert.equal(source.includes('type PostOfficeShippingInfo'), true)
  assert.equal(source.includes('postOfficeShippingInfo'), true)
  assert.equal(source.includes('postOfficeShippingStorageKey'), true)
  assert.equal(source.includes('emptyPostOfficeShippingInfo'), true)
  assert.equal(source.includes('getValidatedShippingInfo'), true)
  assert.equal(source.includes('savePostOfficeShippingInfo'), true)
  assert.equal(source.includes("shipping_method: 'post_office'"), true)
  assert.equal(source.includes('郵局寄送資料'), true)
  assert.equal(source.includes('收件人姓名'), true)
  assert.equal(source.includes('收件人電話'), true)
  assert.equal(source.includes('郵遞區號'), true)
  assert.equal(source.includes('縣市'), true)
  assert.equal(source.includes('區域'), true)
  assert.equal(source.includes('詳細地址'), true)
  assert.equal(source.includes('備註'), true)
})

runTests().catch((error) => {
  console.error(error)
  process.exit(1)
})
