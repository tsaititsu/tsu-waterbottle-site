import assert from 'node:assert/strict'
import {
  applyProductApplePayOneDollarTestToCartItem,
  buildProductApplePayOneDollarTestMetadata,
  buildProductApplePayOneDollarTestSnapshot,
  getProductApplePayOneDollarTestPrice,
  isProductApplePayOneDollarTestEnabled,
  TEMP_ENABLE_PRODUCT_APPLE_PAY_ONE_DOLLAR_TEST,
  TEMP_PRODUCT_APPLE_PAY_TEST_PAYMENT_MODE,
  TEMP_PRODUCT_APPLE_PAY_TEST_PRICE,
  validateProductApplePayOneDollarTestSingleItem,
} from './productApplePayOneDollarTest'
import type { SpiritualProduct } from '../spiritualProducts'

const product: SpiritualProduct = {
  slug: 'ren-yuan-fu',
  name: '人緣符',
  category: '符咒商品',
  priceTwd: 1500,
  validity: '半年內',
  image: '/products/spiritual/ren-yuan-fu.jpg',
  description: '測試商品',
}

assert.equal(TEMP_ENABLE_PRODUCT_APPLE_PAY_ONE_DOLLAR_TEST, true)
assert.equal(TEMP_PRODUCT_APPLE_PAY_TEST_PRICE, 1)
assert.equal(TEMP_PRODUCT_APPLE_PAY_TEST_PAYMENT_MODE, 'product_order_apple_pay_test')
assert.equal(isProductApplePayOneDollarTestEnabled(), true)
assert.equal(getProductApplePayOneDollarTestPrice(1500), 1)

const cartItem = applyProductApplePayOneDollarTestToCartItem({
  id: 'ren-yuan-fu',
  type: 'spiritual_product',
  amount: 1500,
  quantity: 1,
})

assert.equal(cartItem.amount, 1)
assert.equal(cartItem.originalAmountTwd, 1500)

assert.equal(
  validateProductApplePayOneDollarTestSingleItem([
    {
      type: 'spiritual_product',
      amount: 1,
      quantity: 1,
    },
  ]),
  true,
)
assert.equal(
  validateProductApplePayOneDollarTestSingleItem([
    {
      type: 'spiritual_product',
      amount: 1,
      quantity: 2,
    },
  ]),
  false,
)
assert.equal(
  validateProductApplePayOneDollarTestSingleItem([
    {
      type: 'spiritual_product',
      amount: 1,
      quantity: 1,
    },
    {
      type: 'spiritual_product',
      amount: 1,
      quantity: 1,
    },
  ]),
  false,
)

const snapshot = buildProductApplePayOneDollarTestSnapshot({
  product,
  productSnapshot: {
    slug: product.slug,
    name: product.name,
    priceTwd: product.priceTwd,
  },
  quantity: 1,
})

assert.equal(snapshot.priceTwd, 1)
assert.equal(snapshot.test_payment, true)
assert.equal(snapshot.product_apple_pay_one_dollar_test, true)
assert.equal(snapshot.original_price, 1500)
assert.equal(snapshot.original_total_amount, 1500)
assert.equal(snapshot.test_price, 1)

assert.deepEqual(buildProductApplePayOneDollarTestMetadata({ originalPrice: 1500, originalTotalAmount: 1500 }), {
  test_payment: true,
  product_apple_pay_one_dollar_test: true,
  original_price: 1500,
  original_total_amount: 1500,
  test_price: 1,
})

const serialized = JSON.stringify({ cartItem, snapshot })
for (const forbidden of [
  'HashKey',
  'HashIV',
  'MerchantID',
  'TradeInfo',
  'TradeSha',
  'LINEPAY',
  'VACC',
  'ANDROIDPAY',
  'SAMSUNGPAY',
  'line_pay',
]) {
  assert.equal(serialized.includes(forbidden), false, forbidden)
}
