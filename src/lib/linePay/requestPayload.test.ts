import assert from 'node:assert/strict'
import { buildLinePayRequestPayload, type LinePayRequestPayloadInput } from './requestPayload'

const validInput: LinePayRequestPayloadInput = {
  orderId: 'LP20260707153000A1B2',
  amount: 1500,
  currency: 'TWD',
  packageId: 'PKG20260707153000A1B2',
  products: [
    {
      name: '人緣符',
      quantity: 1,
      price: 1500,
    },
  ],
  confirmUrl: 'https://example.com/api/payments/line-pay/confirm',
  cancelUrl: 'https://example.com/payment/cancel',
}

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

function buildPayload(overrides: Partial<LinePayRequestPayloadInput> = {}) {
  return buildLinePayRequestPayload({
    ...validInput,
    ...overrides,
  })
}

test('builds a TWD request payload', () => {
  const payload = buildPayload()

  assert.deepEqual(payload, {
    amount: 1500,
    currency: 'TWD',
    orderId: 'LP20260707153000A1B2',
    packages: [
      {
        id: 'PKG20260707153000A1B2',
        amount: 1500,
        products: [
          {
            name: '人緣符',
            quantity: 1,
            price: 1500,
          },
        ],
      },
    ],
    redirectUrls: {
      confirmUrl: 'https://example.com/api/payments/line-pay/confirm',
      cancelUrl: 'https://example.com/payment/cancel',
    },
  })
})

test('currency defaults to TWD', () => {
  const payload = buildPayload({ currency: undefined })

  assert.equal(payload.currency, 'TWD')
})

test('packageId defaults to orderId', () => {
  const payload = buildPayload({ packageId: undefined })

  assert.equal(payload.packages[0]?.id, validInput.orderId)
})

test('product subtotal must equal amount', () => {
  assert.throws(
    () =>
      buildPayload({
        amount: 1600,
      }),
    /invalid_line_pay_products/,
  )
})

test('empty orderId throws safe order id error', () => {
  assert.throws(() => buildPayload({ orderId: '  ' }), /invalid_line_pay_order_id/)
})

test('non-positive amount throws safe amount error', () => {
  assert.throws(() => buildPayload({ amount: 0 }), /invalid_line_pay_amount/)
  assert.throws(() => buildPayload({ amount: -1 }), /invalid_line_pay_amount/)
})

test('non-TWD currency throws safe currency error', () => {
  assert.throws(() => buildPayload({ currency: 'USD' }), /invalid_line_pay_currency/)
})

test('empty products throw safe products error', () => {
  assert.throws(() => buildPayload({ products: [] }), /invalid_line_pay_products/)
})

test('invalid product quantity throws safe products error', () => {
  assert.throws(
    () =>
      buildPayload({
        products: [{ name: '人緣符', quantity: 0, price: 1500 }],
      }),
    /invalid_line_pay_products/,
  )
})

test('invalid product price throws safe products error', () => {
  assert.throws(
    () =>
      buildPayload({
        products: [{ name: '人緣符', quantity: 1, price: -1 }],
      }),
    /invalid_line_pay_products/,
  )
})

test('empty product name throws safe products error', () => {
  assert.throws(
    () =>
      buildPayload({
        products: [{ name: '  ', quantity: 1, price: 1500 }],
      }),
    /invalid_line_pay_products/,
  )
})

test('invalid confirmUrl throws safe redirect URL error', () => {
  assert.throws(() => buildPayload({ confirmUrl: 'not-a-url' }), /invalid_line_pay_redirect_url/)
})

test('invalid cancelUrl throws safe redirect URL error', () => {
  assert.throws(() => buildPayload({ cancelUrl: 'ftp://example.com/cancel' }), /invalid_line_pay_redirect_url/)
})

test('payload does not include channelSecret, signature, or headers', () => {
  const payloadText = JSON.stringify(buildPayload())

  assert.equal(payloadText.includes('channelSecret'), false)
  assert.equal(payloadText.includes('signature'), false)
  assert.equal(payloadText.includes('headers'), false)
  assert.equal(payloadText.includes('X-LINE-Authorization'), false)
})

test('payload does not include phone, email, or address', () => {
  const payloadText = JSON.stringify(buildPayload())

  assert.equal(payloadText.includes('phone'), false)
  assert.equal(payloadText.includes('email'), false)
  assert.equal(payloadText.includes('address'), false)
})

test('payload does not include NewebPay TradeInfo or TradeSha', () => {
  const payloadText = JSON.stringify(buildPayload())

  assert.equal(payloadText.includes('TradeInfo'), false)
  assert.equal(payloadText.includes('TradeSha'), false)
})
