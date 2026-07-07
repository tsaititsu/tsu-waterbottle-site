import assert from 'node:assert/strict'
import { buildLinePayConfirmPayload, validateLinePayTransactionId } from './confirmPayload'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

test('numeric string transactionId is accepted', () => {
  assert.equal(validateLinePayTransactionId('2026070700000000001'), '2026070700000000001')
})

test('number-like transactionId input is converted to string', () => {
  assert.equal(validateLinePayTransactionId(12345), '12345')
})

test('transactionId is not converted to number', () => {
  const transactionId = '2026070700000000001'

  assert.equal(validateLinePayTransactionId(transactionId), transactionId)
  assert.equal(typeof validateLinePayTransactionId(transactionId), 'string')
})

test('empty transactionId throws safe transaction id error', () => {
  assert.throws(() => validateLinePayTransactionId('  '), /invalid_line_pay_transaction_id/)
  assert.throws(() => validateLinePayTransactionId(null), /invalid_line_pay_transaction_id/)
  assert.throws(() => validateLinePayTransactionId(undefined), /invalid_line_pay_transaction_id/)
})

test('non-numeric transactionId throws safe transaction id error', () => {
  assert.throws(() => validateLinePayTransactionId('20260707ABC'), /invalid_line_pay_transaction_id/)
})

test('confirm payload is built with amount and TWD currency', () => {
  assert.deepEqual(buildLinePayConfirmPayload({ amount: 1500, currency: 'TWD' }), {
    amount: 1500,
    currency: 'TWD',
  })
})

test('confirm payload currency defaults to TWD', () => {
  assert.deepEqual(buildLinePayConfirmPayload({ amount: 1500 }), {
    amount: 1500,
    currency: 'TWD',
  })
})

test('non-TWD currency throws safe currency error', () => {
  assert.throws(() => buildLinePayConfirmPayload({ amount: 1500, currency: 'USD' }), /invalid_line_pay_currency/)
})

test('non-positive amount throws safe amount error', () => {
  assert.throws(() => buildLinePayConfirmPayload({ amount: 0 }), /invalid_line_pay_amount/)
  assert.throws(() => buildLinePayConfirmPayload({ amount: -1 }), /invalid_line_pay_amount/)
})

test('decimal amount throws safe amount error', () => {
  assert.throws(() => buildLinePayConfirmPayload({ amount: 1500.5 }), /invalid_line_pay_amount/)
})

test('payload does not include channelSecret', () => {
  const payloadText = JSON.stringify(buildLinePayConfirmPayload({ amount: 1500 }))

  assert.equal(payloadText.includes('channelSecret'), false)
})

test('payload does not include signature or headers', () => {
  const payloadText = JSON.stringify(buildLinePayConfirmPayload({ amount: 1500 }))

  assert.equal(payloadText.includes('signature'), false)
  assert.equal(payloadText.includes('headers'), false)
  assert.equal(payloadText.includes('X-LINE-Authorization'), false)
})

test('payload does not include phone, email, or address', () => {
  const payloadText = JSON.stringify(buildLinePayConfirmPayload({ amount: 1500 }))

  assert.equal(payloadText.includes('phone'), false)
  assert.equal(payloadText.includes('email'), false)
  assert.equal(payloadText.includes('address'), false)
})

test('payload does not include NewebPay TradeInfo or TradeSha', () => {
  const payloadText = JSON.stringify(buildLinePayConfirmPayload({ amount: 1500 }))

  assert.equal(payloadText.includes('TradeInfo'), false)
  assert.equal(payloadText.includes('TradeSha'), false)
})
