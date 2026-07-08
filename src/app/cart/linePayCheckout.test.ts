import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CART_LINE_PAY_BUTTON_LABEL,
  CART_LINE_PAY_UNAVAILABLE_MESSAGE,
  getCartLinePayButtonState,
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
  assert.equal(getCartLinePayButtonState('true').disabled, true)
})

test('unavailable message is a safe skeleton notice', () => {
  assert.equal(CART_LINE_PAY_UNAVAILABLE_MESSAGE, 'LINE Pay 測試中，暫未開放付款。')
})

test('cart page renders disabled LINE Pay button only through skeleton state', () => {
  const source = readCartPageSource()

  assert.equal(source.includes('getCartLinePayButtonState'), true)
  assert.equal(source.includes('disabled={linePayButtonState.disabled}'), true)
  assert.equal(source.includes('{linePayButtonState.label}'), true)
})

test('cart page does not call LINE Pay request route', () => {
  const source = readCartPageSource()

  assert.equal(source.includes('/api/product-orders/line-pay/request'), false)
})

test('cart page does not call fetch for LINE Pay skeleton', () => {
  const source = readCartPageSource()

  assert.equal(source.includes('fetch('), false)
})

test('cart page does not redirect to paymentUrl', () => {
  const source = readCartPageSource()

  assert.equal(source.includes('paymentUrl'), false)
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
    'paymentUrl',
    'phone',
    'email',
    'address',
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden)
  }
})
