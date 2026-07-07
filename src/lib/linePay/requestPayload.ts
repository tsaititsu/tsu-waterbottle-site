export type LinePayCurrency = 'TWD'

export type LinePayRequestProductInput = {
  name: string
  quantity: number
  price: number
}

export type LinePayRequestPayloadInput = {
  orderId: string
  amount: number
  currency?: LinePayCurrency | string
  packageId?: string
  products: LinePayRequestProductInput[]
  confirmUrl: string
  cancelUrl: string
}

export type LinePayRequestPayload = {
  amount: number
  currency: LinePayCurrency
  orderId: string
  packages: Array<{
    id: string
    amount: number
    products: LinePayRequestProductInput[]
  }>
  redirectUrls: {
    confirmUrl: string
    cancelUrl: string
  }
}

function isPositiveInteger(value: number) {
  return Number.isInteger(value) && value > 0
}

function isNonNegativeInteger(value: number) {
  return Number.isInteger(value) && value >= 0
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function validateProducts(products: LinePayRequestProductInput[], amount: number) {
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error('invalid_line_pay_products')
  }

  const subtotal = products.reduce((sum, product) => {
    const name = product.name.trim()

    if (!name || !isPositiveInteger(product.quantity) || !isNonNegativeInteger(product.price)) {
      throw new Error('invalid_line_pay_products')
    }

    return sum + product.quantity * product.price
  }, 0)

  if (subtotal !== amount) {
    throw new Error('invalid_line_pay_products')
  }
}

export function buildLinePayRequestPayload(input: LinePayRequestPayloadInput): LinePayRequestPayload {
  const orderId = input.orderId.trim()
  const currency = input.currency ?? 'TWD'
  const packageId = input.packageId?.trim() || orderId
  const confirmUrl = input.confirmUrl.trim()
  const cancelUrl = input.cancelUrl.trim()

  if (!orderId) {
    throw new Error('invalid_line_pay_order_id')
  }

  if (!isPositiveInteger(input.amount)) {
    throw new Error('invalid_line_pay_amount')
  }

  if (currency !== 'TWD') {
    throw new Error('invalid_line_pay_currency')
  }

  validateProducts(input.products, input.amount)

  if (!confirmUrl || !isHttpUrl(confirmUrl) || !cancelUrl || !isHttpUrl(cancelUrl)) {
    throw new Error('invalid_line_pay_redirect_url')
  }

  return {
    amount: input.amount,
    currency,
    orderId,
    packages: [
      {
        id: packageId,
        amount: input.amount,
        products: input.products.map((product) => ({
          name: product.name.trim(),
          quantity: product.quantity,
          price: product.price,
        })),
      },
    ],
    redirectUrls: {
      confirmUrl,
      cancelUrl,
    },
  }
}
