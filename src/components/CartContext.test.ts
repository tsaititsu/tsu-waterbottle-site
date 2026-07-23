import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getCartItemsWithUpdatedQuantity } from './cartQuantity'
import type { CartItem } from './CartContext'

const source = readFileSync(join(process.cwd(), 'src/components/CartContext.tsx'), 'utf8')
const cartPageSource = readFileSync(join(process.cwd(), 'src/app/cart/page.tsx'), 'utf8')

for (const required of [
  "const CART_STORAGE_KEY = 'waterbottle-offline-cart'",
  "'spiritual_product'",
  'addItem: (item: AddCartItemInput) => void',
  'updateItemQuantity: (id: string, type: CartItemType, quantity: number) => void',
  'quantity: next[index].quantity + quantity',
  'getCartItemsWithUpdatedQuantity(current, id, type, quantity)',
  "window.localStorage.getItem(CART_STORAGE_KEY)",
  "window.localStorage.setItem(CART_STORAGE_KEY",
]) {
  assert.equal(source.includes(required), true, `${required} must remain in CartContext`)
}

assert.equal(source.includes('fetch('), false)
assert.equal(source.includes('/api/product-orders/create'), false)
assert.equal(source.includes('/api/payments/'), false)

const cartItems: CartItem[] = [
  {
    id: 'fortune-paper',
    type: 'spiritual_product',
    itemName: '測試符紙',
    amount: 1500,
    quantity: 10,
    status: 'unpaid',
  },
]

const quantityEleven = getCartItemsWithUpdatedQuantity(cartItems, 'fortune-paper', 'spiritual_product', 11)
assert.equal(quantityEleven[0]?.quantity, 11, 'quantity must increase from 10 to 11 without a business cap')

const quantityTwentyFive = getCartItemsWithUpdatedQuantity(quantityEleven, 'fortune-paper', 'spiritual_product', 25)
assert.equal(quantityTwentyFive[0]?.quantity, 25, 'quantity must support values above 10')

const quantityOne = getCartItemsWithUpdatedQuantity(quantityTwentyFive, 'fortune-paper', 'spiritual_product', 1)
const rejectedZero = getCartItemsWithUpdatedQuantity(quantityOne, 'fortune-paper', 'spiritual_product', 0)
assert.strictEqual(rejectedZero, quantityOne, 'quantity below 1 must be rejected without removing the item')
assert.equal(rejectedZero.length, 1)
assert.equal(rejectedZero[0]?.quantity, 1)

const wrongType = getCartItemsWithUpdatedQuantity(quantityOne, 'fortune-paper', 'course', 2)
assert.strictEqual(wrongType, quantityOne, 'quantity updates must match both item id and type')

for (const required of [
  'updateItemQuantity(item.id, item.type, item.quantity - 1)',
  'updateItemQuantity(item.id, item.type, item.quantity + 1)',
  'disabled={item.quantity === 1}',
  'aria-label={`減少「${item.itemName}」數量`}',
  'aria-label={`增加「${item.itemName}」數量`}',
  'onClick={() => removeItem(item.id)}',
]) {
  assert.equal(cartPageSource.includes(required), true, `${required} must remain in the cart quantity controls`)
}

assert.equal(
  cartPageSource.includes('<th className="py-3 pr-4">單價</th>'),
  true,
  'the item price column must be labeled 單價',
)
assert.equal(
  cartPageSource.includes('<th className="py-3 pr-4">金額</th>'),
  false,
  'the item price column must no longer be labeled 金額',
)
assert.equal(
  cartPageSource.match(/className="focus-ring flex size-10 /g)?.length,
  2,
  'both quantity buttons must provide a 40px touch target',
)

for (const forbidden of [
  'MAX_CART_QUANTITY',
  'Math.min',
  'max="10"',
  '10 件上限',
  '99 件上限',
]) {
  assert.equal(source.includes(forbidden), false, `${forbidden} must not impose a cart quantity cap`)
  assert.equal(cartPageSource.includes(forbidden), false, `${forbidden} must not appear in the cart UI`)
}

console.log('✓ CartContext storage, add-item, and uncapped quantity contracts passed')
