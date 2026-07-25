import assert from 'node:assert/strict'
import { readExactRecord } from './exactRecord'

assert.deepEqual(
  readExactRecord({ id: 'record-1', status: 'paid' }, ['id', 'status'], 'payment_row'),
  { id: 'record-1', status: 'paid' },
)
assert.throws(
  () => readExactRecord({ id: 'record-1' }, ['id', 'status'], 'payment_row'),
  /payment_row_contract_mismatch/,
)
assert.throws(
  () =>
    readExactRecord(
      { id: 'record-1', status: 'paid', customer_email: 'private@example.com' },
      ['id', 'status'],
      'payment_row',
    ),
  /payment_row_contract_mismatch/,
)
assert.throws(
  () => readExactRecord(null, ['id'], 'payment_row'),
  /payment_row_contract_mismatch/,
)

console.log('exact record key contract passed')
