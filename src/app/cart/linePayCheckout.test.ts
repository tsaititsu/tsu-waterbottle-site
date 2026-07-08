import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CART_LINE_PAY_BUTTON_LABEL,
  CART_LINE_PAY_LOADING_MESSAGE,
  CART_LINE_PAY_READY_MESSAGE,
  getLinePayCartCheckoutErrorMessage,
  getCartLinePayButtonState,
  startLinePayCartCheckout,
  type CartLinePayCheckoutItem,
  type CartLinePayCreateProductOrderInput,
  type CartLinePayCustomerInfo,
  type CartLinePayRequestBody,
} from './linePayCheckout'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

function readCartPageSource() {
  return readFileSync(join(process.cwd(), 'src/app/cart/page.tsx'), 'utf8')
}

function readLinePayCheckoutSource() {
  return readFileSync(join(process.cwd(), 'src/app/cart/linePayCheckout.ts'), 'utf8')
}

const cartItems: CartLinePayCheckoutItem[] = [
  {
    id: 'ren-yuan-fu',
    itemName: '人緣符',
    amount: 1500,
    quantity: 1,
  },
]

const customerInfo: CartLinePayCustomerInfo = {
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

function createOrderOk(calls: CartLinePayCreateProductOrderInput[] = []) {
  return async (input: CartLinePayCreateProductOrderInput) => {
    calls.push(input)
    return {
      ok: true,
      productOrderId: 'product-order-1',
    }
  }
}

function requestLinePayOk(calls: CartLinePayRequestBody[] = []) {
  return async (body: CartLinePayRequestBody) => {
    calls.push(body)
    return {
      ok: true,
      provider: 'line_pay',
      paymentId: 'payment-line-pay-1',
      orderId: 'LP_product_order_product-order-1_20260707153000',
      transactionId: '2026070700000000001',
      paymentUrl: {
        web: 'https://line-pay.example.com/web',
      },
    }
  }
}

function redirectOk(calls: string[] = []) {
  return async (paymentUrlWeb: string) => {
    calls.push(paymentUrlWeb)
  }
}

test('feature flag off hides LINE Pay button state', () => {
  assert.equal(getCartLinePayButtonState('false').visible, false)
  assert.equal(getCartLinePayButtonState(undefined).visible, false)
})

test('feature flag on shows LINE Pay button state', () => {
  assert.equal(getCartLinePayButtonState('true').visible, true)
})

test('button label uses official LINE Pay spacing and casing', () => {
  assert.equal(CART_LINE_PAY_BUTTON_LABEL, 'LINE Pay')
  assert.equal(CART_LINE_PAY_BUTTON_LABEL.includes('LinePay'), false)
  assert.equal(CART_LINE_PAY_BUTTON_LABEL.includes('LINEPAY'), false)
})

test('LINE Pay button state is disabled', () => {
  assert.equal(getCartLinePayButtonState('true', true).disabled, true)
})

test('LINE Pay button state is enabled when flag is on and not loading', () => {
  assert.equal(getCartLinePayButtonState('true', false).disabled, false)
})

test('ready and loading messages are safe checkout notices', () => {
  assert.equal(CART_LINE_PAY_READY_MESSAGE, '將前往 LINE Pay 完成付款。')
  assert.equal(CART_LINE_PAY_LOADING_MESSAGE, '正在建立 LINE Pay 付款資料...')
  assert.equal(getCartLinePayButtonState('true', false).message, CART_LINE_PAY_READY_MESSAGE)
  assert.equal(getCartLinePayButtonState('true', true).message, CART_LINE_PAY_LOADING_MESSAGE)
})

test('cart page renders LINE Pay button through checkout state', () => {
  const source = readCartPageSource()

  assert.equal(source.includes('getCartLinePayButtonState'), true)
  assert.equal(source.includes('disabled={linePayButtonState.disabled}'), true)
  assert.equal(source.includes('{linePayButtonState.label}'), true)
  assert.equal(source.includes('handleLinePayCheckoutClick'), true)
})

test('cart page calls LINE Pay request route through click handler only', () => {
  const source = readCartPageSource()

  assert.equal(source.includes('/api/product-orders/line-pay/request'), true)
  assert.equal(source.includes('/api/payments/newebpay/create'), false)
})

test('cart page uses fetch for product order and LINE Pay request APIs', () => {
  const source = readCartPageSource()

  assert.equal(source.includes("fetch('/api/product-orders/create'"), true)
  assert.equal(source.includes("fetch('/api/product-orders/line-pay/request'"), true)
})

test('cart page redirects with paymentUrlWeb only', () => {
  const source = readCartPageSource()

  assert.equal(source.includes('window.location.assign(paymentUrlWeb)'), true)
  assert.equal(source.includes('window.location.assign(data'), false)
})

test('cart page prevents duplicate LINE Pay checkout while loading', () => {
  const source = readCartPageSource()

  assert.equal(source.includes('if (isLinePayCheckingOut) return'), true)
  assert.equal(source.includes('setIsLinePayCheckingOut(true)'), true)
})

test('cart page sends LINE Pay request body with productOrderId only', () => {
  const source = readCartPageSource()

  assert.equal(source.includes('productOrderId: body.productOrderId'), true)
  assert.equal(source.includes('...body'), false)
})

test('LINE Pay skeleton does not expose secrets or payment internals', () => {
  const text = `${readLinePayCheckoutSource()}\n${String(getCartLinePayButtonState)}`

  for (const forbidden of [
    'channelSecret',
    'channelId',
    'LINE_PAY_CHANNEL_SECRET',
    'LINE_PAY_CHANNEL_ID',
    'TradeInfo',
    'TradeSha',
    '/api/product-orders/line-pay/request',
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden)
  }
})

test('empty cart returns line_pay_cart_empty', async () => {
  const result = await startLinePayCartCheckout({
    cartItems: [],
    customerInfo,
    createProductOrder: createOrderOk(),
    requestLinePayPayment: requestLinePayOk(),
    redirectToPaymentUrl: redirectOk(),
  })

  assert.deepEqual(result, {
    ok: false,
    provider: 'line_pay',
    error: 'line_pay_cart_empty',
  })
})

test('missing customer info returns line_pay_customer_info_missing', async () => {
  const result = await startLinePayCartCheckout({
    cartItems,
    customerInfo: {
      ...customerInfo,
      recipientName: '',
    },
    createProductOrder: createOrderOk(),
    requestLinePayPayment: requestLinePayOk(),
    redirectToPaymentUrl: redirectOk(),
  })

  assert.deepEqual(result, {
    ok: false,
    provider: 'line_pay',
    error: 'line_pay_customer_info_missing',
  })
})

test('checkout errors map to friendly messages', () => {
  assert.equal(getLinePayCartCheckoutErrorMessage('line_pay_create_order_failed'), '商品訂單建立失敗，請稍後再試。')
  assert.equal(getLinePayCartCheckoutErrorMessage('line_pay_request_failed'), 'LINE Pay 付款資料建立失敗，請稍後再試。')
  assert.equal(getLinePayCartCheckoutErrorMessage('line_pay_payment_url_missing'), 'LINE Pay 付款連結建立失敗，請稍後再試。')
})

test('createProductOrder is called with product order input', async () => {
  const createCalls: CartLinePayCreateProductOrderInput[] = []

  await startLinePayCartCheckout({
    cartItems,
    customerInfo,
    createProductOrder: createOrderOk(createCalls),
    requestLinePayPayment: requestLinePayOk(),
    redirectToPaymentUrl: redirectOk(),
  })

  assert.equal(createCalls.length, 1)
  assert.equal(createCalls[0].paymentMethod, 'line_pay')
  assert.deepEqual(createCalls[0].items, [
    {
      productSlug: 'ren-yuan-fu',
      quantity: 1,
    },
  ])
  assert.equal(createCalls[0].shippingInfo.shippingMethod, 'manual')
})

test('createProductOrder throw returns line_pay_create_order_failed', async () => {
  const result = await startLinePayCartCheckout({
    cartItems,
    customerInfo,
    createProductOrder: async () => {
      throw new Error('create failed')
    },
    requestLinePayPayment: requestLinePayOk(),
    redirectToPaymentUrl: redirectOk(),
  })

  assert.deepEqual(result, {
    ok: false,
    provider: 'line_pay',
    error: 'line_pay_create_order_failed',
  })
})

test('createProductOrder missing productOrderId returns line_pay_product_order_id_missing', async () => {
  const result = await startLinePayCartCheckout({
    cartItems,
    customerInfo,
    createProductOrder: async () => ({ ok: true }),
    requestLinePayPayment: requestLinePayOk(),
    redirectToPaymentUrl: redirectOk(),
  })

  assert.deepEqual(result, {
    ok: false,
    provider: 'line_pay',
    error: 'line_pay_product_order_id_missing',
  })
})

test('createProductOrder orderId response can be used as productOrderId', async () => {
  const requestCalls: CartLinePayRequestBody[] = []
  const result = await startLinePayCartCheckout({
    cartItems,
    customerInfo,
    createProductOrder: async () => ({
      ok: true,
      orderId: 'product-order-from-route',
    }),
    requestLinePayPayment: requestLinePayOk(requestCalls),
    redirectToPaymentUrl: redirectOk(),
  })

  assert.equal(result.ok, true)
  if (!result.ok) throw new Error(result.error)
  assert.equal(result.productOrderId, 'product-order-from-route')
  assert.deepEqual(requestCalls, [
    {
      productOrderId: 'product-order-from-route',
    },
  ])
})

test('requestLinePayPayment is called with productOrderId only', async () => {
  const requestCalls: CartLinePayRequestBody[] = []

  await startLinePayCartCheckout({
    cartItems,
    customerInfo,
    createProductOrder: createOrderOk(),
    requestLinePayPayment: requestLinePayOk(requestCalls),
    redirectToPaymentUrl: redirectOk(),
  })

  assert.deepEqual(requestCalls, [
    {
      productOrderId: 'product-order-1',
    },
  ])
})

test('requestLinePayPayment throw returns line_pay_request_failed', async () => {
  const result = await startLinePayCartCheckout({
    cartItems,
    customerInfo,
    createProductOrder: createOrderOk(),
    requestLinePayPayment: async () => {
      throw new Error('request failed')
    },
    redirectToPaymentUrl: redirectOk(),
  })

  assert.deepEqual(result, {
    ok: false,
    provider: 'line_pay',
    error: 'line_pay_request_failed',
  })
})

test('missing paymentUrl.web returns line_pay_payment_url_missing', async () => {
  const result = await startLinePayCartCheckout({
    cartItems,
    customerInfo,
    createProductOrder: createOrderOk(),
    requestLinePayPayment: async () => ({
      ok: true,
      paymentUrl: {},
    }),
    redirectToPaymentUrl: redirectOk(),
  })

  assert.deepEqual(result, {
    ok: false,
    provider: 'line_pay',
    error: 'line_pay_payment_url_missing',
  })
})

test('transactionId remains string and success returns LINE Pay result', async () => {
  const result = await startLinePayCartCheckout({
    cartItems,
    customerInfo,
    createProductOrder: createOrderOk(),
    requestLinePayPayment: requestLinePayOk(),
    redirectToPaymentUrl: redirectOk(),
  })

  assert.equal(result.ok, true)
  if (!result.ok) throw new Error(result.error)
  assert.equal(result.provider, 'line_pay')
  assert.equal(result.productOrderId, 'product-order-1')
  assert.equal(result.paymentId, 'payment-line-pay-1')
  assert.equal(result.orderId, 'LP_product_order_product-order-1_20260707153000')
  assert.equal(result.transactionId, '2026070700000000001')
  assert.equal(typeof result.transactionId, 'string')
  assert.equal(result.paymentUrlWeb, 'https://line-pay.example.com/web')
})

test('redirectToPaymentUrl is called with paymentUrl.web only', async () => {
  const redirects: string[] = []

  await startLinePayCartCheckout({
    cartItems,
    customerInfo,
    createProductOrder: createOrderOk(),
    requestLinePayPayment: requestLinePayOk(),
    redirectToPaymentUrl: redirectOk(redirects),
  })

  assert.deepEqual(redirects, ['https://line-pay.example.com/web'])
})

test('redirectToPaymentUrl throw returns line_pay_redirect_failed', async () => {
  const result = await startLinePayCartCheckout({
    cartItems,
    customerInfo,
    createProductOrder: createOrderOk(),
    requestLinePayPayment: requestLinePayOk(),
    redirectToPaymentUrl: async () => {
      throw new Error('redirect failed')
    },
  })

  assert.deepEqual(result, {
    ok: false,
    provider: 'line_pay',
    error: 'line_pay_redirect_failed',
  })
})

test('helper does not call global fetch', async () => {
  const originalFetch = globalThis.fetch
  let called = false

  globalThis.fetch = (async () => {
    called = true
    throw new Error('global fetch must not be called')
  }) as typeof fetch

  try {
    await startLinePayCartCheckout({
      cartItems,
      customerInfo,
      createProductOrder: createOrderOk(),
      requestLinePayPayment: requestLinePayOk(),
      redirectToPaymentUrl: redirectOk(),
    })
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(called, false)
})

test('helper source does not call window location, NewebPay, or direct payment route', () => {
  const source = readLinePayCheckoutSource()
  const lowerSource = source.toLowerCase()

  assert.equal(source.includes('window.location'), false)
  assert.equal(lowerSource.includes('newebpay'), false)
  assert.equal(source.includes('/api/product-orders/line-pay/request'), false)
})

test('success result does not expose contact fields, secrets, or full LINE Pay request payload', async () => {
  const result = await startLinePayCartCheckout({
    cartItems,
    customerInfo,
    createProductOrder: createOrderOk(),
    requestLinePayPayment: requestLinePayOk(),
    redirectToPaymentUrl: redirectOk(),
  })
  const text = JSON.stringify(result)

  for (const forbidden of [
    'channelSecret',
    'channelId',
    'LINE_PAY_CHANNEL_SECRET',
    'LINE_PAY_CHANNEL_ID',
    'TradeInfo',
    'TradeSha',
    'phone',
    'email',
    'address',
    'packages',
    'products',
    'redirectUrls',
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden)
  }
})
