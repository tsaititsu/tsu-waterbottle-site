import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(
  join(process.cwd(), 'src/components/divination/DivinationDrawPreview.tsx'),
  'utf8',
)

assert.equal(source.includes('PaymentMethodSelector'), true)
assert.equal(source.includes('使用所選方式付款 NT$${paymentRequired.amountTwd}'), true)
assert.equal(source.includes('LinePayEntryOneDollarTestButton'), true)
assert.equal(source.includes('useLinePayEntryOneDollarTest'), true)
assert.equal(source.includes('getAuthAccessToken()'), true)
assert.equal(source.includes('isLinePayEntryOneDollarTestAvailable'), true)
assert.equal(source.includes('adminOneDollarTest: true'), true)
assert.equal(source.includes('cardId: pendingCard.id'), true)
assert.equal(source.includes('position: pendingPosition'), true)
assert.equal(source.includes('管理員 Apple Pay 測試付款 NT$1'), false)
assert.equal(source.includes('/api/admin/divination-one-dollar-test'), false)
assert.equal(source.includes('divinationOneDollarTest: true'), false)

const checkoutStart = source.indexOf('async function handleNewebPayDivinationCheckout')
const checkoutEnd = source.indexOf('\n  async function confirmCard', checkoutStart)
const checkoutSource = source.slice(checkoutStart, checkoutEnd > checkoutStart ? checkoutEnd : undefined)

assert.equal(checkoutSource.includes('toStandardNewebPayCheckoutMode(newebPayPaymentMethod)'), true)
assert.equal(checkoutSource.includes('isAdminOneDollarTest'), true)
assert.equal(checkoutSource.includes('adminOneDollarTest: true'), true)
assert.equal(checkoutSource.includes('cardId: pendingCard.id'), true)
assert.equal(checkoutSource.includes('position: pendingPosition'), true)
assert.equal(checkoutSource.includes('mockPaid'), false)
assert.equal(checkoutSource.includes('LINEPAY'), false)
assert.equal(checkoutSource.includes('VACC'), false)
assert.equal(checkoutSource.includes('APPLEPAY'), false)
assert.equal(checkoutSource.includes('ANDROIDPAY'), false)
assert.equal(checkoutSource.includes('SAMSUNGPAY'), false)

console.log('✓ divination admin NT$1 前端入口測試通過')
