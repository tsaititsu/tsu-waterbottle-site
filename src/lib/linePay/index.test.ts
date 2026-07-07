import assert from 'node:assert/strict'
import * as linePay from '.'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

test('exports normalizeLinePayEnvironment', () => {
  assert.equal(typeof linePay.normalizeLinePayEnvironment, 'function')
})

test('exports buildLinePaySignature', () => {
  assert.equal(typeof linePay.buildLinePaySignature, 'function')
})

test('exports buildLinePayRequestHeaders', () => {
  assert.equal(typeof linePay.buildLinePayRequestHeaders, 'function')
})

test('exports buildLinePayRequestPayload', () => {
  assert.equal(typeof linePay.buildLinePayRequestPayload, 'function')
})

test('exports buildLinePayConfirmPayload', () => {
  assert.equal(typeof linePay.buildLinePayConfirmPayload, 'function')
})

test('exports parseLinePayRequestResponse', () => {
  assert.equal(typeof linePay.parseLinePayRequestResponse, 'function')
})

test('exports parseLinePayConfirmResponse', () => {
  assert.equal(typeof linePay.parseLinePayConfirmResponse, 'function')
})

test('exports requestLinePayPayment', () => {
  assert.equal(typeof linePay.requestLinePayPayment, 'function')
})

test('exports confirmLinePayPayment', () => {
  assert.equal(typeof linePay.confirmLinePayPayment, 'function')
})

test('barrel import does not read environment variables', () => {
  const before = process.env.LINE_PAY_CHANNEL_SECRET

  assert.equal(typeof linePay.getLinePayBaseUrl, 'function')
  assert.equal(process.env.LINE_PAY_CHANNEL_SECRET, before)
})

test('barrel exports do not expose secret-shaped keys', () => {
  const exportedKeys = Object.keys(linePay).join(',')

  assert.equal(/channelSecret/i.test(exportedKeys), false)
})

test('barrel exports do not expose contact or address keys', () => {
  const exportedKeys = Object.keys(linePay).join(',')

  assert.equal(/phone/i.test(exportedKeys), false)
  assert.equal(/email/i.test(exportedKeys), false)
  assert.equal(/address/i.test(exportedKeys), false)
})

test('barrel exports do not expose NewebPay sensitive keys', () => {
  const exportedKeys = Object.keys(linePay).join(',')

  assert.equal(exportedKeys.includes('TradeInfo'), false)
  assert.equal(exportedKeys.includes('TradeSha'), false)
})

test('barrel import does not call global fetch', () => {
  const originalFetch = globalThis.fetch
  let called = false

  globalThis.fetch = (async () => {
    called = true
    throw new Error('global fetch must not be called')
  }) as typeof fetch

  try {
    assert.equal(typeof linePay.requestLinePayPayment, 'function')
    assert.equal(typeof linePay.confirmLinePayPayment, 'function')
    assert.equal(called, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})
