import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(
  join(process.cwd(), 'src/components/divination/DivinationDrawPreview.tsx'),
  'utf8',
)

assert.equal(source.includes('信用卡線上付款 NT$${paymentRequired.amountTwd}'), true)
assert.equal(source.includes('管理員 Apple Pay 測試付款 NT$1'), true)
assert.equal(
  source.includes('const [isAdminOneDollarTestAvailable, setIsAdminOneDollarTestAvailable] = useState(false)'),
  true,
)
assert.equal(source.includes('/api/admin/divination-one-dollar-test'), true)
assert.equal(source.includes('getAuthAccessToken()'), true)
assert.equal(source.includes('subscribeAuthChange'), true)
assert.equal(source.includes('isAdminOneDollarTestAvailable ?'), true)
assert.equal(source.includes('divinationOneDollarTest: true'), true)

const checkoutStart = source.indexOf('async function handleNewebPayDivinationCheckout')
const checkoutEnd = source.indexOf('\n  async function confirmCard', checkoutStart)
const checkoutSource = source.slice(checkoutStart, checkoutEnd > checkoutStart ? checkoutEnd : undefined)

assert.equal(checkoutSource.includes('paymentMode: "credit"'), true)
assert.equal(checkoutSource.includes('mockPaid'), false)
assert.equal(checkoutSource.includes('LINEPAY'), false)
assert.equal(checkoutSource.includes('VACC'), false)
assert.equal(checkoutSource.includes('APPLEPAY'), false)
assert.equal(checkoutSource.includes('ANDROIDPAY'), false)
assert.equal(checkoutSource.includes('SAMSUNGPAY'), false)

console.log('✓ divination admin NT$1 前端入口測試通過')
