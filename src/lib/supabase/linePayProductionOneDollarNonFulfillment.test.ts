import assert from 'node:assert/strict'
import { test } from 'node:test'
import { LINE_PAY_PRODUCTION_ONE_DOLLAR_NON_FULFILLMENT_RPC } from './linePayProductionOneDollarNonFulfillment'

test('uses one atomic initializer instead of a second marker RPC', () => {
  assert.equal(
    LINE_PAY_PRODUCTION_ONE_DOLLAR_NON_FULFILLMENT_RPC,
    'initialize_line_pay_production_nt1_non_fulfillment_checkout',
  )
})
