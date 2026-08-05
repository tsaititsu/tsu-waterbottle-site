import assert from 'node:assert/strict'
import {
  getLinePayServiceReturnPath,
  isLinePayServiceSource,
  isSafeLinePayReturnPath,
  isValidLinePayServiceSourceId,
} from './serviceCheckout'

const id = '51000000-0000-4000-8000-000000000001'

assert.equal(isLinePayServiceSource('booking'), true)
assert.equal(isLinePayServiceSource('course'), true)
assert.equal(isLinePayServiceSource('product_order'), false)
assert.equal(isValidLinePayServiceSourceId('booking', id), true)
assert.equal(isValidLinePayServiceSourceId('booking', '../booking'), false)
assert.equal(isValidLinePayServiceSourceId('course', 'basic'), true)
assert.equal(isValidLinePayServiceSourceId('course', 'vip'), false)
assert.equal(getLinePayServiceReturnPath('ai_chart_report', id), `/ai-chart/result/${id}`)
assert.equal(getLinePayServiceReturnPath('ai_divination', id), `/ai-divination/result/${id}`)
assert.equal(getLinePayServiceReturnPath('booking', id), '/account/bookings')
assert.equal(getLinePayServiceReturnPath('course', 'basic'), '/account/courses')
assert.equal(isSafeLinePayReturnPath(`/ai-chart/result/${id}`), true)
assert.equal(isSafeLinePayReturnPath(`/ai-divination/result/${id}`), true)
assert.equal(isSafeLinePayReturnPath('//evil.example'), false)
assert.equal(isSafeLinePayReturnPath('/ai-chart/result/../admin'), false)

console.log('LINE Pay service checkout contract tests passed')
