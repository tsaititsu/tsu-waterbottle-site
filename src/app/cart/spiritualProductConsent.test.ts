import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(join(process.cwd(), 'src/app/cart/page.tsx'), 'utf8')

for (const required of [
  'spiritualProductsAccepted',
  '開運商品購買須知',
  '開運商品退換貨政策',
  'type="checkbox"',
  'if (!spiritualProductsAccepted)',
  '請先勾選同意開運商品購買須知與退換貨政策，再選擇付款方式。',
]) {
  assert.equal(source.includes(required), true, `${required} must remain in the cart consent flow`)
}

assert.equal(source.includes('checked={spiritualProductsAccepted}'), true)
assert.equal(source.includes('setSpiritualProductsAccepted(event.target.checked)'), true)
assert.equal(source.includes('useState(true)'), false)

console.log('✓ cart spiritual-product consent contracts passed')
