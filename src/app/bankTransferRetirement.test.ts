import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const readSource = (file: string) => readFileSync(join(root, file), 'utf8')
const bankTransferPage = readSource('src/app/bank-transfer/page.tsx')
const bankTransferSubmitPage = readSource('src/app/bank-transfer/submit/page.tsx')
const footer = readSource('src/components/Footer.tsx')
const terms = readSource('src/app/terms/page.tsx')
const refundPolicy = readSource('src/app/refund-policy/page.tsx')
const consumerRights = readSource('src/app/consumer-rights/page.tsx')
const productOrderHandler = readSource('src/app/api/product-orders/create/handler.ts')

for (const source of [bankTransferPage, bankTransferSubmitPage]) {
  assert.equal(source.startsWith("'use client'"), false)
  assert.equal(source.includes("import { redirect } from 'next/navigation'"), true)
  assert.equal(source.includes("redirect('/contact')"), true)
  assert.equal(source.includes('LoginModal'), false)
  assert.equal(source.includes('useSearchParams'), false)
  assert.equal(source.includes('/api/bank-transfer/submit'), false)
}

const retiredAccountValues = [
  ['008', '1359'].join(''),
  ['014', '6512'].join(''),
  ['008', '1359', '014', '6512'].join(''),
]

for (const source of [bankTransferPage, bankTransferSubmitPage]) {
  for (const retiredValue of [
    '中華郵政',
    '銀行代碼',
    '戶名',
    '匯款後五碼',
    ...retiredAccountValues,
  ]) {
    assert.equal(source.includes(retiredValue), false, retiredValue)
  }
}

assert.equal(footer.includes("href: '/bank-transfer'"), false)
assert.equal(footer.includes('銀行匯款說明'), false)

for (const [name, source] of [
  ['terms', terms],
  ['refund policy', refundPolicy],
  ['consumer rights', consumerRights],
] as const) {
  for (const retiredInstruction of ['銀行匯款', '匯款回報表單', '已匯款＋姓名＋購買項目']) {
    assert.equal(source.includes(retiredInstruction), false, `${name}: ${retiredInstruction}`)
  }
}

assert.equal(terms.includes('第三方金流與網站當下提供的線上付款方式'), true)
assert.equal(refundPolicy.includes('訂單編號、付款時間、服務名稱與申請原因'), true)
assert.equal(consumerRights.includes('線上付款成功後'), true)
assert.equal(consumerRights.includes('付款或服務未正常完成時，請聯繫客服'), true)

// 新商品訂單只能從線上付款入口建立；底層歷史型別仍保留舊值相容性。
assert.equal(productOrderHandler.includes("if (value === 'newebpay') return value"), true)
assert.equal(productOrderHandler.includes("value === 'bank_transfer'"), false)

console.log('✓ public bank transfer routes, links, copy, and new-order entry points are retired')
