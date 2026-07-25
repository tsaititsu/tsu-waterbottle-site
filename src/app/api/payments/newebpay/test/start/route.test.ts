import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const route = readFileSync(
  join(root, 'src/app/api/payments/newebpay/test/start/route.ts'),
  'utf8',
)
const page = readFileSync(
  join(root, 'src/app/payment/newebpay/test/page.tsx'),
  'utf8',
)

assert.match(route, /import \{ requireAdminUser \}/)
assert.match(route, /const auth = await requireAdminUser\(request\)/)
assert.match(route, /if \('error' in auth\) return auth\.error/)
assert.ok(
  route.indexOf('await requireAdminUser(request)') < route.indexOf(".from('payments')"),
  'admin authorization must complete before the first payment database query',
)
assert.match(route, /user_id: auth\.user\.id/)
assert.doesNotMatch(route, /getUserIdFromRequest|getSupabaseAdmin|error\.message/)
assert.doesNotMatch(route, /getNewebPayConfig|createCoursePaymentMpgForm/)
assert.doesNotMatch(route, /merchantOrderNo,\s*\n\s*form:/)

assert.match(page, /管理員限定/)
assert.match(page, /status === 403/)
assert.match(page, /沒有管理員測試付款權限/)

console.log('NewebPay admin-only test payment route contract passed')
