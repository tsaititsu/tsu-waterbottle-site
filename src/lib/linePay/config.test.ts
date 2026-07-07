import assert from 'node:assert/strict'
import {
  LINE_PAY_PRODUCTION_BASE_URL,
  LINE_PAY_SANDBOX_BASE_URL,
  createLinePayNonce,
  getLinePayBaseUrl,
  normalizeLinePayEnvironment,
  stringifyLinePayJsonBody,
} from './config'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

test('empty environment defaults to sandbox', () => {
  assert.equal(normalizeLinePayEnvironment(), 'sandbox')
  assert.equal(normalizeLinePayEnvironment(null), 'sandbox')
  assert.equal(normalizeLinePayEnvironment(''), 'sandbox')
  assert.equal(normalizeLinePayEnvironment('   '), 'sandbox')
})

test('sandbox aliases normalize to sandbox', () => {
  assert.equal(normalizeLinePayEnvironment('sandbox'), 'sandbox')
  assert.equal(normalizeLinePayEnvironment('test'), 'sandbox')
  assert.equal(normalizeLinePayEnvironment('development'), 'sandbox')
  assert.equal(normalizeLinePayEnvironment(' SANDBOX '), 'sandbox')
})

test('production aliases normalize to production', () => {
  assert.equal(normalizeLinePayEnvironment('production'), 'production')
  assert.equal(normalizeLinePayEnvironment('prod'), 'production')
  assert.equal(normalizeLinePayEnvironment('formal'), 'production')
  assert.equal(normalizeLinePayEnvironment(' PRODUCTION '), 'production')
})

test('invalid environment throws a safe error', () => {
  assert.throws(() => normalizeLinePayEnvironment('staging'), /invalid_line_pay_environment/)
})

test('sandbox base URL is returned for sandbox environment', () => {
  assert.equal(getLinePayBaseUrl('sandbox'), LINE_PAY_SANDBOX_BASE_URL)
  assert.equal(getLinePayBaseUrl('sandbox'), 'https://sandbox-api-pay.line.me')
})

test('production base URL is returned for production environment', () => {
  assert.equal(getLinePayBaseUrl('production'), LINE_PAY_PRODUCTION_BASE_URL)
  assert.equal(getLinePayBaseUrl('production'), 'https://api-pay.line.me')
})

test('nonce is a non-empty string', () => {
  const nonce = createLinePayNonce()

  assert.equal(typeof nonce, 'string')
  assert.match(nonce, /^[0-9a-f-]{36}$/i)
})

test('stringify object matches JSON.stringify', () => {
  const body = {
    amount: 100,
    currency: 'TWD',
    orderId: 'ORDER-1',
  }

  assert.equal(stringifyLinePayJsonBody(body), JSON.stringify(body))
})

test('stringify undefined returns empty string', () => {
  assert.equal(stringifyLinePayJsonBody(undefined), '')
})

test('stringify null returns JSON null', () => {
  assert.equal(stringifyLinePayJsonBody(null), 'null')
})
