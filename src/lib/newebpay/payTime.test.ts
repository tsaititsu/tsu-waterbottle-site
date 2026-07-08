import assert from 'node:assert/strict'
import { parseNewebPayTaipeiPayTime } from './payTime'

assert.equal(parseNewebPayTaipeiPayTime(null), null)
assert.equal(parseNewebPayTaipeiPayTime(undefined), null)
assert.equal(parseNewebPayTaipeiPayTime(''), null)
assert.equal(parseNewebPayTaipeiPayTime('   '), null)

assert.equal(
  parseNewebPayTaipeiPayTime('2026-07-08 23:31:18'),
  '2026-07-08T15:31:18.000Z',
)

assert.equal(
  parseNewebPayTaipeiPayTime('2026-07-09 00:05:00'),
  '2026-07-08T16:05:00.000Z',
)

assert.equal(
  parseNewebPayTaipeiPayTime('2026/07/08 23:31:18'),
  '2026-07-08T15:31:18.000Z',
)

assert.equal(
  parseNewebPayTaipeiPayTime('2026-07-08T23:31:18'),
  '2026-07-08T15:31:18.000Z',
)

assert.equal(
  parseNewebPayTaipeiPayTime('2026-07-08T23:31:18+08:00'),
  '2026-07-08T15:31:18.000Z',
)

assert.equal(
  parseNewebPayTaipeiPayTime('2026-07-08T15:31:18.000Z'),
  '2026-07-08T15:31:18.000Z',
)

assert.equal(parseNewebPayTaipeiPayTime('2026-02-30 12:00:00'), null)
assert.equal(parseNewebPayTaipeiPayTime('not-a-pay-time'), null)

console.log('NewebPay PayTime tests passed')
