import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(
  join(process.cwd(), 'src/app/api/payments/newebpay/notify/route.ts'),
  'utf8',
)
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

assert.ok(
  source.includes(
    "import { completePaidAiChartReport } from '@/lib/ai-chart/reportCompletion'",
  ),
  'payment notify route must inject the real AI chart report completion handler',
)
assert.ok(
  source.includes(
    "from '@/lib/ai-chart/reportCompletionBackground'",
  ),
  'payment notify route must use the AI chart background completion scheduler',
)
assert.ok(
  source.includes('startPaidAiChartReportCompletionInBackground: ({ reportId }) =>'),
  'AI chart payment sync must start report completion from the route boundary',
)
assert.ok(
  source.includes('{ completePaidAiChartReport }'),
  'AI chart background completion must receive the server completion handler',
)

console.log('NewebPay notify redacted logging contract passed')
