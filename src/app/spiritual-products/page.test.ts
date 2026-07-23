import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(join(process.cwd(), 'src/app/spiritual-products/page.tsx'), 'utf8')

assert.equal(source.includes('const handleAddToCart = () => {\n    addItem({'), true)
assert.equal(source.includes("type: 'spiritual_product'"), true)
assert.equal(source.includes('id: product.slug'), true)
assert.equal(source.includes('itemName: product.name'), true)
assert.equal(source.includes('amount: product.priceTwd'), true)
assert.equal(source.includes('quantity: 1'), true)
assert.equal(source.includes('setAdded(true)'), true)
assert.equal(source.includes('window.setTimeout(() => setAdded(false), 1800)'), true)
assert.equal(source.includes("{added ? '已加入購物車' : '加入購物車'}"), true)
assert.equal(source.includes('<ShoppingCart size={18} />'), true)

for (const removed of [
  'PurchaseNoticeContent',
  'RefundPolicyContent',
  'hasAcceptedNotice',
  'noticeError',
  '<details',
  'type="checkbox"',
  '開運商品須知',
  '請先閱讀並勾選',
  '我已詳細閱讀並同意',
  '點我查看',
]) {
  assert.equal(source.includes(removed), false, `${removed} must be absent from the product page`)
}

console.log('✓ spiritual product page direct-cart contracts passed')
