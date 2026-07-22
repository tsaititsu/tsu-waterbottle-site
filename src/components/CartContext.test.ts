import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(join(process.cwd(), 'src/components/CartContext.tsx'), 'utf8')

for (const required of [
  "const CART_STORAGE_KEY = 'waterbottle-offline-cart'",
  "'spiritual_product'",
  'addItem: (item: AddCartItemInput) => void',
  'quantity: next[index].quantity + quantity',
  "window.localStorage.getItem(CART_STORAGE_KEY)",
  "window.localStorage.setItem(CART_STORAGE_KEY",
]) {
  assert.equal(source.includes(required), true, `${required} must remain in CartContext`)
}

assert.equal(source.includes('fetch('), false)
assert.equal(source.includes('/api/product-orders/create'), false)
assert.equal(source.includes('/api/payments/'), false)

console.log('✓ CartContext storage and add-item contracts passed')
