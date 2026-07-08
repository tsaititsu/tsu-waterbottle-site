export const CART_LINE_PAY_BUTTON_LABEL = 'LINE Pay'
export const CART_LINE_PAY_UNAVAILABLE_MESSAGE = 'LINE Pay 測試中，暫未開放付款。'

export type CartLinePayCheckoutItem = {
  id: string
  itemName: string
  amount: number
  quantity: number
}

export type CartLinePayCustomerInfo = {
  customerName?: string | null
  customerPhone?: string | null
  customerEmail?: string | null
  recipientName?: string | null
  recipientPhone?: string | null
  recipientEmail?: string | null
  postalCode?: string | null
  address?: string | null
  note?: string | null
}

export type CartLinePayCreateProductOrderInput = {
  customerName: string
  customerPhone: string
  customerEmail: string | null
  paymentMethod: 'line_pay'
  items: Array<{
    productSlug: string
    quantity: number
  }>
  shippingInfo: {
    recipientName: string
    recipientPhone: string
    recipientEmail: string | null
    shippingMethod: 'manual'
    postalCode: string | null
    address: string
  }
  note: string | null
}

export type CartLinePayRequestBody = {
  productOrderId: string
}

export type StartLinePayCartCheckoutInput = {
  cartItems: CartLinePayCheckoutItem[]
  customerInfo: CartLinePayCustomerInfo
  createProductOrder: (input: CartLinePayCreateProductOrderInput) => Promise<unknown>
  requestLinePayPayment: (body: CartLinePayRequestBody) => Promise<unknown>
  redirectToPaymentUrl: (paymentUrlWeb: string) => Promise<void> | void
}

export type StartLinePayCartCheckoutResult =
  | {
      ok: true
      provider: 'line_pay'
      productOrderId: string
      paymentId: string | null
      orderId: string | null
      transactionId: string | null
      paymentUrlWeb: string
    }
  | {
      ok: false
      provider: 'line_pay'
      error:
        | 'line_pay_cart_empty'
        | 'line_pay_customer_info_missing'
        | 'line_pay_create_order_failed'
        | 'line_pay_product_order_id_missing'
        | 'line_pay_request_failed'
        | 'line_pay_payment_url_missing'
        | 'line_pay_redirect_failed'
    }

export type CartLinePayButtonState = {
  visible: boolean
  disabled: true
  label: typeof CART_LINE_PAY_BUTTON_LABEL
  message: typeof CART_LINE_PAY_UNAVAILABLE_MESSAGE
}

function normalizeRequiredText(value: string | null | undefined) {
  const trimmed = String(value ?? '').trim()
  return trimmed || null
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = String(value ?? '').trim()
  return trimmed || null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getStringField(value: unknown, key: string) {
  if (!isRecord(value)) return null
  const field = value[key]
  if (typeof field !== 'string' && typeof field !== 'number') return null
  const text = String(field).trim()
  return text || null
}

function buildCreateProductOrderInput(
  cartItems: CartLinePayCheckoutItem[],
  customerInfo: CartLinePayCustomerInfo,
): CartLinePayCreateProductOrderInput | null {
  const customerName = normalizeRequiredText(customerInfo.customerName)
  const customerPhone = normalizeRequiredText(customerInfo.customerPhone)
  const recipientName = normalizeRequiredText(customerInfo.recipientName)
  const recipientPhone = normalizeRequiredText(customerInfo.recipientPhone)
  const address = normalizeRequiredText(customerInfo.address)

  if (!customerName || !customerPhone || !recipientName || !recipientPhone || !address) {
    return null
  }

  return {
    customerName,
    customerPhone,
    customerEmail: normalizeOptionalText(customerInfo.customerEmail),
    paymentMethod: 'line_pay',
    items: cartItems.map((item) => ({
      productSlug: item.id,
      quantity: item.quantity,
    })),
    shippingInfo: {
      recipientName,
      recipientPhone,
      recipientEmail: normalizeOptionalText(customerInfo.recipientEmail),
      shippingMethod: 'manual',
      postalCode: normalizeOptionalText(customerInfo.postalCode),
      address,
    },
    note: normalizeOptionalText(customerInfo.note),
  }
}

export function getCartLinePayButtonState(
  flagValue: string | undefined = process.env.NEXT_PUBLIC_ENABLE_LINE_PAY,
): CartLinePayButtonState {
  return {
    visible: flagValue === 'true',
    disabled: true,
    label: CART_LINE_PAY_BUTTON_LABEL,
    message: CART_LINE_PAY_UNAVAILABLE_MESSAGE,
  }
}

export async function startLinePayCartCheckout({
  cartItems,
  customerInfo,
  createProductOrder,
  requestLinePayPayment,
  redirectToPaymentUrl,
}: StartLinePayCartCheckoutInput): Promise<StartLinePayCartCheckoutResult> {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return {
      ok: false,
      provider: 'line_pay',
      error: 'line_pay_cart_empty',
    }
  }

  const createOrderInput = buildCreateProductOrderInput(cartItems, customerInfo)
  if (!createOrderInput) {
    return {
      ok: false,
      provider: 'line_pay',
      error: 'line_pay_customer_info_missing',
    }
  }

  let createdOrder: unknown
  try {
    createdOrder = await createProductOrder(createOrderInput)
  } catch {
    return {
      ok: false,
      provider: 'line_pay',
      error: 'line_pay_create_order_failed',
    }
  }

  if (isRecord(createdOrder) && createdOrder.ok === false) {
    return {
      ok: false,
      provider: 'line_pay',
      error: 'line_pay_create_order_failed',
    }
  }

  const productOrderId = getStringField(createdOrder, 'productOrderId') ?? getStringField(createdOrder, 'orderId')
  if (!productOrderId) {
    return {
      ok: false,
      provider: 'line_pay',
      error: 'line_pay_product_order_id_missing',
    }
  }

  let linePayResponse: unknown
  try {
    linePayResponse = await requestLinePayPayment({ productOrderId })
  } catch {
    return {
      ok: false,
      provider: 'line_pay',
      error: 'line_pay_request_failed',
    }
  }

  if (isRecord(linePayResponse) && linePayResponse.ok === false) {
    return {
      ok: false,
      provider: 'line_pay',
      error: 'line_pay_request_failed',
    }
  }

  const paymentUrl = isRecord(linePayResponse) ? linePayResponse.paymentUrl : null
  const paymentUrlWeb = getStringField(paymentUrl, 'web')
  if (!paymentUrlWeb) {
    return {
      ok: false,
      provider: 'line_pay',
      error: 'line_pay_payment_url_missing',
    }
  }

  try {
    await redirectToPaymentUrl(paymentUrlWeb)
  } catch {
    return {
      ok: false,
      provider: 'line_pay',
      error: 'line_pay_redirect_failed',
    }
  }

  return {
    ok: true,
    provider: 'line_pay',
    productOrderId,
    paymentId: getStringField(linePayResponse, 'paymentId'),
    orderId: getStringField(linePayResponse, 'orderId'),
    transactionId: getStringField(linePayResponse, 'transactionId'),
    paymentUrlWeb,
  }
}
