import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(join(process.cwd(), 'src/app/apple-pay-test/page.tsx'), 'utf8')

assert.equal(source.includes('Apple Pay 1 元商品測試'), true)
assert.equal(source.includes('href="/spiritual-products"'), true)
assert.equal(source.includes('href="/cart"'), true)
assert.equal(source.includes('index: false'), true)
assert.equal(source.includes('follow: false'), true)
assert.equal(source.includes('notFound'), false)
assert.equal(source.includes('NEXT_PUBLIC_ENABLE_NEWEBPAY_APPLE_PAY_TEST_ENTRY'), false)
assert.equal(source.includes('HashKey'), false)
assert.equal(source.includes('HashIV'), false)
assert.equal(source.includes('TradeInfo'), false)
assert.equal(source.includes('TradeSha'), false)
