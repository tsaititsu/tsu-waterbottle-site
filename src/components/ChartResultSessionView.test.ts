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

assert.equal(source.includes("import { getAuthAccessToken } from '@/lib/mockAuth'"), true)
assert.equal(source.includes("import { LoginModal } from './LoginModal'"), true)
assert.equal(source.includes('const accessToken = await getAuthAccessToken()'), true)
assert.match(source, /if \(!accessToken\) \{\s*setLoginOpen\(true\)\s*return\s*\}/)
assert.equal(createRequestSource.includes('Authorization: `Bearer ${accessToken}`'), true)
assert.equal(paymentRequestSource.includes('Authorization: `Bearer ${accessToken}`'), true)
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
assert.equal(source.includes('result-pay-'), false)
assert.equal(source.includes("from '@/lib/mockPayment'"), false)
assert.equal(prepareRequestSource.includes('localStorage'), false)
assert.equal(source.indexOf('const accessToken = await getAuthAccessToken()') < createRequestStart, true)

console.log('✓ AI chart report checkout requires a Bearer session and sends no client owner')
