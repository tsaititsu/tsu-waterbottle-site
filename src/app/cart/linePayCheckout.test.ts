import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildLinePayReturnMessage,
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
  type CartLinePayStartBody,
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

test('cart page renders the LINE Pay payment option behind the feature flag', () => {
  const source = readCartPageSource()

  assert.equal(source.includes('buildLinePayReturnMessage'), true)
  assert.equal(source.includes("params.get('linePay')"), true)
  assert.equal(source.includes('getCartLinePayButtonState'), true)
  assert.equal(source.includes('PaymentMethodSelector'), true)
  assert.equal(source.includes('includeLinePay: linePayButtonState.visible'), true)
  assert.equal(source.includes('linePayButtonState.visible'), true)
  assert.equal(source.includes('handleLinePayCheckoutClick'), true)
})

test('cart page routes LINE Pay checkout through the existing request endpoint', () => {
  const source = readCartPageSource()

  assert.equal(source.includes('/api/product-orders/line-pay/request'), true)
  assert.equal(readLinePayCheckoutSource().includes('/api/payments/newebpay/create'), false)
})

test('cart admin NT$1 entry test never creates a real cart order', () => {
  const source = readCartPageSource()
  const testEntryIndex = source.indexOf("entrySource: 'cart'")
  const realCheckoutIndex = source.indexOf('startLinePayCartCheckout({')

  assert.equal(source.includes('useLinePayProductionOneDollarEntryTest'), true)
  assert.equal(source.includes('requestLinePayProductionOneDollarEntryCheckout'), true)
  assert.equal(source.includes('linePayEntryTestBlocked'), true)
  assert.equal(source.includes('linePayEntryTestButtonLabel'), true)
  assert.ok(testEntryIndex >= 0)
  assert.ok(testEntryIndex < realCheckoutIndex)
})

test('cart page sends one atomic LINE Pay checkout request', () => {
  const source = readCartPageSource()

  assert.equal(source.includes("fetch('/api/product-orders/line-pay/request'"), true)
  assert.equal(source.includes("paymentMethod: 'line_pay'"), false)
  assert.equal(source.includes('startLinePayPayment'), true)
  assert.equal(source.includes('idempotencyKey'), true)
  assert.equal(source.includes('getAuthAccessToken()'), true)
})

test('cart page redirects only through the payment URL supplied to the checkout adapter', () => {
  const source = readCartPageSource()

  assert.equal(source.includes('window.location.assign(paymentUrlWeb)'), true)
  assert.equal(source.includes('window.location.assign(data'), false)
})

test('cart page keeps an independent LINE Pay checkout loading guard', () => {
  const source = readCartPageSource()

  assert.equal(source.includes('linePayCheckoutPendingRef.current || isCheckoutPending'), true)
  assert.equal(source.includes('linePayCheckoutPendingRef.current'), true)
  assert.equal(source.includes('setIsLinePayCheckingOut(true)'), true)
  assert.equal(source.includes('setIsLinePayCheckingOut(false)'), true)
})

test('cart page authenticates and sends the atomic checkout body', () => {
  const source = readCartPageSource()

  assert.equal(source.includes('Authorization: `Bearer ${accessToken}`'), true)
  assert.equal(source.includes('body: JSON.stringify(body)'), true)
  assert.equal(source.includes('productOrderId: body.productOrderId'), false)
})

test('cart page reads linePay query for return message only', () => {
  const source = readCartPageSource()

  assert.equal(source.includes("params.get('linePay')"), true)
  assert.equal(source.includes('buildLinePayReturnMessage'), true)
  assert.equal(source.includes('confirmLinePayPayment'), false)
  assert.equal(source.includes('linePayConfirmer'), false)
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
  assert.equal(getLinePayCartCheckoutErrorMessage('line_pay_login_required'), '請先登入會員，再使用 LINE Pay 付款。')
})

test('atomic checkout sends cart data once and redirects to the server-approved URL', async () => {
  const startCalls: CartLinePayStartBody[] = []
  const redirects: string[] = []
  const result = await startLinePayCartCheckout({
    cartItems,
    customerInfo,
    idempotencyKey: 'cart-line-pay:attempt-0001',
    startLinePayPayment: async (body) => {
      startCalls.push(body)
      return {
        ok: true,
        paymentUrl: {
          web: 'https://sandbox-web-pay.line.me/web/payment/wait?id=synthetic',
        },
      }
    },
    redirectToPaymentUrl: redirectOk(redirects),
  })

  assert.equal(result.ok, true)
  assert.equal(startCalls.length, 1)
  assert.deepEqual(startCalls[0].items, [
    { productSlug: 'ren-yuan-fu', quantity: 1 },
  ])
  assert.equal('amount' in startCalls[0].items[0], false)
  assert.deepEqual(redirects, [
    'https://sandbox-web-pay.line.me/web/payment/wait?id=synthetic',
  ])
})

test('no linePay query hides return message', () => {
  assert.deepEqual(buildLinePayReturnMessage(null), {
    visible: false,
    tone: 'info',
    title: '',
    message: '',
  })
})

test('linePay=success shows completed message', () => {
  const result = buildLinePayReturnMessage('success')

  assert.equal(result.visible, true)
  assert.equal(result.tone, 'success')
  assert.equal(result.message, 'LINE Pay 付款已完成，我們正在整理訂單資訊。')
})

test('linePay=canceled shows canceled message', () => {
  const result = buildLinePayReturnMessage('canceled')

  assert.equal(result.visible, true)
  assert.equal(result.tone, 'warning')
  assert.equal(result.message, '你已取消 LINE Pay 付款，訂單尚未付款。')
})

test('linePay=pending shows pending message', () => {
  const result = buildLinePayReturnMessage('pending')

  assert.equal(result.visible, true)
  assert.equal(result.tone, 'info')
  assert.equal(result.message, 'LINE Pay 付款狀態確認中，請稍後再查看訂單狀態。')
})

test('linePay=reconciliation says payment was received and forbids paying again', () => {
  const result = buildLinePayReturnMessage('reconciliation')

  assert.equal(result.visible, true)
  assert.equal(result.tone, 'warning')
  assert.equal(result.title, 'LINE Pay 付款已收到，訂單確認中。')
  assert.equal(result.message, '請勿再次付款。')
  assert.equal(JSON.stringify(result).includes('付款失敗'), false)
  assert.equal(JSON.stringify(result).includes('重新付款'), false)
  assert.equal(JSON.stringify(result).includes('重新結帳'), false)
})

test('linePay=failed shows failed message', () => {
  const result = buildLinePayReturnMessage('failed')

  assert.equal(result.visible, true)
  assert.equal(result.tone, 'warning')
  assert.equal(result.message, 'LINE Pay 付款未完成，請重新付款或改用其他付款方式。')
})

test('linePay=error shows support message', () => {
  const result = buildLinePayReturnMessage('error')

  assert.equal(result.visible, true)
  assert.equal(result.tone, 'error')
  assert.equal(result.message, 'LINE Pay 付款確認發生問題，請聯繫客服協助確認。')
})

test('unsupported linePay query hides return message', () => {
  assert.equal(buildLinePayReturnMessage('unknown').visible, false)
})

test('return messages do not expose transaction or secret details', () => {
  const text = JSON.stringify([
    buildLinePayReturnMessage('success'),
    buildLinePayReturnMessage('canceled'),
    buildLinePayReturnMessage('pending'),
    buildLinePayReturnMessage('reconciliation'),
    buildLinePayReturnMessage('failed'),
    buildLinePayReturnMessage('error'),
  ])

  for (const forbidden of [
    'transactionId',
    'channelSecret',
    'channelId',
    'env',
    'TradeInfo',
    'TradeSha',
    'phone',
    'email',
    'address',
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden)
  }
})

test('return message helper does not call payment APIs or mark paid', () => {
  const source = String(buildLinePayReturnMessage)
  const lowerSource = source.toLowerCase()

  assert.equal(source.includes('fetch('), false)
  assert.equal(source.includes('/api/product-orders/line-pay/request'), false)
  assert.equal(lowerSource.includes('linepaypayment'), false)
  assert.equal(lowerSource.includes('newebpay'), false)
  assert.equal(lowerSource.includes('markpaid'), false)
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
  if (!result.ok) throw new Error(`unexpected failure: ${JSON.stringify(result)}`)
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
  if (!result.ok) throw new Error(`unexpected failure: ${JSON.stringify(result)}`)
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
