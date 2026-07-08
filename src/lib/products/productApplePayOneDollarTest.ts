import type { SpiritualProduct } from '../spiritualProducts'

// TEMPORARY 22J-29: this must be reverted after the Apple Pay NT$1 live test.
export const TEMP_ENABLE_PRODUCT_APPLE_PAY_ONE_DOLLAR_TEST = true
export const TEMP_PRODUCT_APPLE_PAY_TEST_PRICE = 1
export const TEMP_PRODUCT_APPLE_PAY_TEST_PAYMENT_MODE = 'product_order_apple_pay_test'
export const TEMP_PRODUCT_APPLE_PAY_TEST_NOTICE =
  '目前為 Apple Pay 1 元測試模式，商品付款金額暫時為 NT$1，測試完成後將恢復正式價格。'

export type ProductApplePayOneDollarTestPaymentMode = typeof TEMP_PRODUCT_APPLE_PAY_TEST_PAYMENT_MODE

export type ProductApplePayOneDollarTestCartItem = {
  type?: string
  amount: number
  quantity: number
}

export function isProductApplePayOneDollarTestEnabled() {
  return TEMP_ENABLE_PRODUCT_APPLE_PAY_ONE_DOLLAR_TEST
}

export function getProductApplePayOneDollarTestPrice(originalPrice: number) {
  if (!isProductApplePayOneDollarTestEnabled()) return originalPrice
  return TEMP_PRODUCT_APPLE_PAY_TEST_PRICE
}

export function buildProductApplePayOneDollarTestSnapshot(input: {
  product: SpiritualProduct
  productSnapshot: Record<string, unknown>
  quantity: number
}) {
  if (!isProductApplePayOneDollarTestEnabled()) return input.productSnapshot

  const originalPrice = input.product.priceTwd
  const originalTotalAmount = originalPrice * input.quantity

  return {
    ...input.productSnapshot,
    priceTwd: TEMP_PRODUCT_APPLE_PAY_TEST_PRICE,
    test_payment: true,
    product_apple_pay_one_dollar_test: true,
    original_price: originalPrice,
    original_total_amount: originalTotalAmount,
    test_price: TEMP_PRODUCT_APPLE_PAY_TEST_PRICE,
  }
}

export function applyProductApplePayOneDollarTestToCartItem<T extends ProductApplePayOneDollarTestCartItem>(
  item: T,
): T & { originalAmountTwd?: number } {
  if (!isProductApplePayOneDollarTestEnabled() || item.type !== 'spiritual_product') {
    return item
  }

  return {
    ...item,
    amount: TEMP_PRODUCT_APPLE_PAY_TEST_PRICE,
    originalAmountTwd: item.amount,
  }
}

export function validateProductApplePayOneDollarTestSingleItem(items: ProductApplePayOneDollarTestCartItem[]) {
  if (!isProductApplePayOneDollarTestEnabled()) return true
  const productItems = items.filter((item) => item.type === undefined || item.type === 'spiritual_product')
  return productItems.length === 1 && productItems[0]?.quantity === 1
}

export function buildProductApplePayOneDollarTestMetadata(input: {
  originalPrice: number
  originalTotalAmount: number
}) {
  return {
    test_payment: true,
    product_apple_pay_one_dollar_test: true,
    original_price: input.originalPrice,
    original_total_amount: input.originalTotalAmount,
    test_price: TEMP_PRODUCT_APPLE_PAY_TEST_PRICE,
  }
}
