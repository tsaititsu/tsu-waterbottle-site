import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const drawPreview = readFileSync(
  join(root, 'src/components/divination/DivinationDrawPreview.tsx'),
  'utf8',
)
const questionForm = readFileSync(
  join(root, 'src/components/divination/DivinationQuestionForm.tsx'),
  'utf8',
)
const resultPage = readFileSync(
  join(root, 'src/app/ai-divination/result/[readingId]/DivinationResultPageClient.tsx'),
  'utf8',
)
const accountPage = readFileSync(
  join(root, 'src/app/account/divinations/page.tsx'),
  'utf8',
)

const notice =
  '目前正在 LINE 內建瀏覽器。為提高付款與返回解讀頁的穩定性，建議點右上角「⋯」，選擇「以預設瀏覽器開啟」後再付款。'

assert.equal(drawPreview.includes('isLineInAppBrowser(window.navigator.userAgent)'), true)
assert.equal(drawPreview.includes('window.matchMedia("(max-width: 767px)")'), true)
assert.equal(drawPreview.includes('isMobileLineInAppBrowser && paymentRequired && isPersistedReading'), true)
assert.equal(drawPreview.includes('data-testid="line-in-app-browser-payment-notice"'), true)
assert.equal(drawPreview.includes(notice), true)
assert.equal(notice.includes('LINE Pay'), false)

// 手動與自動付款區都使用相同提示；抽牌前、結果頁與會員紀錄不顯示。
assert.equal(
  drawPreview.match(/LineInAppBrowserPaymentNotice visible=\{showLineInAppBrowserPaymentNotice\}/g)?.length,
  2,
)
assert.equal(questionForm.includes(notice), false)
assert.equal(resultPage.includes(notice), false)
assert.equal(accountPage.includes(notice), false)

// 正式付款選單與管理員測試按鈕都保留，提示不會阻擋 click。
assert.equal(drawPreview.includes('PaymentMethodSelector'), true)
assert.equal(drawPreview.includes('使用所選方式付款 NT$${paymentRequired.amountTwd}'), true)
assert.equal(drawPreview.includes('管理員 Apple Pay 測試付款 NT$1'), true)
assert.equal(drawPreview.includes('onClick={() => handleNewebPayDivinationCheckout()}'), true)
assert.equal(
  drawPreview.includes('onClick={() => handleNewebPayDivinationCheckout({ adminOneDollarTest: true })}'),
  true,
)

const checkoutStart = drawPreview.indexOf('async function handleNewebPayDivinationCheckout')
const checkoutEnd = drawPreview.indexOf('\n  async function confirmCard', checkoutStart)
const checkoutSource = drawPreview.slice(checkoutStart, checkoutEnd)

assert.equal(checkoutSource.includes('? "credit"'), true)
assert.equal(checkoutSource.includes('toStandardNewebPayCheckoutMode(newebPayPaymentMethod)'), true)
assert.equal(checkoutSource.includes('requestServiceLinePayCheckout'), true)
assert.equal(checkoutSource.includes('readingId,'), true)
assert.equal(checkoutSource.includes('cardId: pendingCard.id'), true)
assert.equal(checkoutSource.includes('position: pendingPosition'), true)
assert.equal(checkoutSource.includes('lineInAppBrowser'), false)

console.log('✓ divination LINE in-app browser payment notice checks passed')
