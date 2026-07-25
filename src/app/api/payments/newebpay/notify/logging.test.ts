import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(join(process.cwd(), 'src/app/api/payments/newebpay/notify/route.ts'), 'utf8')
const consoleCalls = source.match(/console\.(?:info|warn|error)\([\s\S]*?\)/g) ?? []

assert.ok(consoleCalls.length > 0)
for (const call of consoleCalls) {
  for (const forbidden of [
    'merchantOrderNo',
    'tradeNo',
    'amount',
    'paymentId',
    'bookingId',
    'itemId',
    'customer',
    'paymentMethod',
    'paymentType',
    'tradeInfo',
    'tradeSha',
    'error:',
  ]) {
    assert.equal(call.includes(forbidden), false, `payment notify log must not contain ${forbidden}`)
  }
}

console.log('NewebPay notify redacted logging contract passed')
