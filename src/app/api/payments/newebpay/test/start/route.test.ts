import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const route = readFileSync(
  join(root, 'src/app/api/payments/newebpay/test/start/route.ts'),
  'utf8',
)
const handler = readFileSync(
  join(root, 'src/app/api/payments/newebpay/test/start/handler.ts'),
  'utf8',
)
const page = readFileSync(
  join(root, 'src/app/payment/newebpay/test/page.tsx'),
  'utf8',
)

assert.match(route, /handleStartNewebPayAdminOneDollarTest/)
assert.match(route, /return handleStartNewebPayAdminOneDollarTest\(request\)/)
assert.match(handler, /import \{[\s\S]*requireAdminUser/)
assert.match(handler, /const authorization = await authorize\(request\)/)
assert.match(handler, /if \('error' in authorization\) return authorization\.error/)
const requestHandler = handler.slice(
  handler.indexOf('export async function handleStartNewebPayAdminOneDollarTest'),
)
assert.ok(
  requestHandler.indexOf('await authorize(request)')
    < requestHandler.indexOf('await insertPayment('),
  'admin authorization must complete before the first payment database query',
)
assert.match(handler, /userId: authorization\.user\.id/)
assert.match(handler, /amountTwd: 1/)
assert.match(handler, /do_not_fulfill: true/)
assert.doesNotMatch(handler, /getUserIdFromRequest|error\.message/)
assert.doesNotMatch(handler, /getNewebPayConfig|createCoursePaymentMpgForm/)
assert.doesNotMatch(handler, /merchantOrderNo,\s*\n\s*form:/)

assert.match(page, /管理員限定/)
assert.match(page, /body: JSON\.stringify\(\{ channel: 'credit' \}\)/)
assert.match(page, /status === 403/)
assert.match(page, /沒有管理員測試付款權限/)

console.log('NewebPay admin-only test payment route contract passed')
