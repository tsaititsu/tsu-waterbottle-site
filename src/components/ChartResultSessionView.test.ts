import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(join(process.cwd(), 'src/components/ChartResultSessionView.tsx'), 'utf8')
const createRequestStart = source.indexOf("fetch('/api/ai-chart/reports/create'")
const paymentRequestStart = source.indexOf("fetch('/api/payments/newebpay/create'")
const prepareStart = source.indexOf('const preparePaidInterpretation')

assert.notEqual(createRequestStart, -1)
assert.notEqual(paymentRequestStart, -1)
assert.notEqual(prepareStart, -1)

const createRequestSource = source.slice(createRequestStart, paymentRequestStart)
const paymentRequestSource = source.slice(paymentRequestStart)
const prepareRequestSource = source.slice(prepareStart, createRequestStart)

assert.match(source, /import \{ getAuthAccessToken, getMockUser, subscribeAuthChange \} from '@\/lib\/mockAuth'/)
assert.equal(source.includes("import { LoginModal } from './LoginModal'"), true)
assert.equal(source.includes('const accessToken = await getAuthAccessToken()'), true)
assert.match(source, /if \(!isCurrentRequest\(\)\) \{\s*return\s*\}\s*if \(!accessToken\)/)
assert.equal(createRequestSource.includes('Authorization: `Bearer ${accessToken}`'), true)
assert.equal(paymentRequestSource.includes('Authorization: `Bearer ${accessToken}`'), true)
assert.match(createRequestSource, /birthInput:\s*\{/)
assert.match(createRequestSource, /solarDate:\s*requestChartInput\.solarDate/)
assert.match(createRequestSource, /timeIndex:\s*requestChartInput\.timeIndex/)
assert.match(createRequestSource, /gender:\s*requestChartInput\.gender/)
assert.match(createRequestSource, /name:\s*requestChartInput\.name/)
assert.match(createRequestSource, /fixLeap:\s*requestChartInput\.fixLeap/)
assert.equal(createRequestSource.includes('birthInput: chartInput'), false)
assert.equal(createRequestSource.includes('chartPayload'), false)
assert.equal(createRequestSource.includes('chartContext'), false)
assert.equal(createRequestSource.includes('messages'), false)
assert.equal(createRequestSource.includes('responseSchema'), false)
assert.equal(createRequestSource.includes('selectedCategory'), false)
assert.equal(createRequestSource.includes('birthOrder'), false)
assert.equal(createRequestSource.includes('userId'), false)
assert.equal(createRequestSource.includes('user_id'), false)
assert.equal(createRequestSource.includes('localUserId'), false)
assert.equal(createRequestSource.includes('paid:'), false)
assert.equal(createRequestSource.includes('success:'), false)
assert.equal(paymentRequestSource.includes('userId'), false)
assert.equal(paymentRequestSource.includes('user_id'), false)
assert.equal(paymentRequestSource.includes('paid:'), false)
assert.equal(paymentRequestSource.includes('success:'), false)
assert.equal(source.includes('<LoginModal'), true)
assert.equal(source.includes('void createPendingReportForCheckout()'), true)
assert.match(source, /createAsyncIdentityGuard/)
assert.match(source, /subscribeAuthChange/)
assert.match(source, /const requestToken = checkoutGuard\.begin\(currentIdentity\(\)\)/)
assert.match(source, /checkoutGuard\.isCurrent\(requestToken, currentIdentity\(\)\)/)
assert.ok(
  source.lastIndexOf('if (!isCurrentRequest()) return') <
    source.indexOf('submitNewebPayForm({'),
  'a stale identity or changed chart must be rejected before submitting the payment form',
)
assert.doesNotMatch(
  source,
  /checkoutGuard\.invalidate\(\)\s*checkoutInFlightRef\.current = false/,
)
assert.equal(
  source.match(/checkoutInFlightRef\.current = false/g)?.length,
  2,
  'checkout mutex may only unlock before a request starts or in that request finally block',
)
assert.match(
  source,
  /finally \{\s*checkoutInFlightRef\.current = false\s*setIsCreatingPendingReport\(false\)\s*\}/,
)
assert.equal(source.includes('result-pay-'), false)
assert.equal(source.includes("from '@/lib/mockPayment'"), false)
assert.equal(prepareRequestSource.includes('localStorage'), false)
assert.equal(source.includes('localStorage'), false)
assert.equal(source.includes('sessionStorage'), false)
assert.equal(source.includes('getAiChartDraftSession()'), true)
assert.equal(source.includes('setAiChartDraftSession(nextSession)'), true)
assert.equal(source.indexOf('const accessToken = await getAuthAccessToken()') < createRequestStart, true)
assert.equal(source.includes('useLinePayProductionOneDollarEntryTest'), true)
assert.equal(source.includes('requestLinePayProductionOneDollarEntryCheckout'), true)
assert.equal(source.includes("entrySource: 'ai_chart_report'"), true)
assert.equal(source.includes('linePayEntryTestBlocked'), true)
assert.equal(source.includes('linePayEntryTestButtonLabel'), true)
assert.ok(
  source.indexOf("entrySource: 'ai_chart_report'") < createRequestStart,
  'the admin NT$1 entry check must not create a real AI chart report',
)

console.log('✓ AI chart report checkout sends an explicit birth input and preserves payment ownership auth')
