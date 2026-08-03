export const CART_LINE_PAY_BUTTON_LABEL = 'LINE Pay'
export const CART_LINE_PAY_READY_MESSAGE = '將前往 LINE Pay 完成付款。'
export const CART_LINE_PAY_LOADING_MESSAGE = '正在建立 LINE Pay 付款資料...'

export type CartLinePayReturnStatus =
  | 'success'
  | 'canceled'
  | 'pending'
  | 'reconciliation'
  | 'failed'
  | 'error'

export type CartLinePayReturnMessage = {
  visible: boolean
  tone: 'success' | 'warning' | 'info' | 'error'
  title: string
  message: string
}

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

export type StartLinePayCartCheckoutError = Extract<StartLinePayCartCheckoutResult, { ok: false }>['error']

export type CartLinePayButtonState = {
  visible: boolean
  disabled: boolean
  label: typeof CART_LINE_PAY_BUTTON_LABEL
  message: typeof CART_LINE_PAY_READY_MESSAGE | typeof CART_LINE_PAY_LOADING_MESSAGE
}

const hiddenLinePayReturnMessage: CartLinePayReturnMessage = {
  visible: false,
  tone: 'info',
  title: '',
  message: '',
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
  isCheckingOut = false,
): CartLinePayButtonState {
  return {
    visible: flagValue === 'true',
    disabled: isCheckingOut,
    label: CART_LINE_PAY_BUTTON_LABEL,
    message: isCheckingOut ? CART_LINE_PAY_LOADING_MESSAGE : CART_LINE_PAY_READY_MESSAGE,
  }
}

export function buildLinePayReturnMessage(linePayStatus: unknown): CartLinePayReturnMessage {
  if (typeof linePayStatus !== 'string') return hiddenLinePayReturnMessage

  switch (linePayStatus.trim()) {
    case 'success':
      return {
        visible: true,
        tone: 'success',
        title: 'LINE Pay 付款已完成',
        message: 'LINE Pay 付款已完成，我們正在整理訂單資訊。',
      }
    case 'canceled':
      return {
        visible: true,
        tone: 'warning',
        title: 'LINE Pay 付款已取消',
        message: '你已取消 LINE Pay 付款，訂單尚未付款。',
      }
    case 'pending':
      return {
        visible: true,
        tone: 'info',
        title: 'LINE Pay 付款確認中',
        message: 'LINE Pay 付款狀態確認中，請稍後再查看訂單狀態。',
      }
    case 'reconciliation':
      return {
        visible: true,
        tone: 'warning',
        title: 'LINE Pay 付款已收到，訂單確認中。',
        message: '請勿再次付款。',
      }
    case 'failed':
      return {
        visible: true,
        tone: 'warning',
        title: 'LINE Pay 付款未完成',
        message: 'LINE Pay 付款未完成，請重新付款或改用其他付款方式。',
      }
    case 'error':
      return {
        visible: true,
        tone: 'error',
        title: 'LINE Pay 付款確認發生問題',
        message: 'LINE Pay 付款確認發生問題，請聯繫客服協助確認。',
      }
    default:
      return hiddenLinePayReturnMessage
  }
}

export function getLinePayCartCheckoutErrorMessage(error: StartLinePayCartCheckoutError) {
  switch (error) {
    case 'line_pay_cart_empty':
      return '購物車目前沒有可付款的開運商品。'
    case 'line_pay_customer_info_missing':
      return '請完整填寫收件資料並勾選購買須知後，再使用 LINE Pay 付款。'
    case 'line_pay_create_order_failed':
      return '商品訂單建立失敗，請稍後再試。'
    case 'line_pay_product_order_id_missing':
      return '商品訂單資料不完整，請稍後再試。'
    case 'line_pay_request_failed':
      return 'LINE Pay 付款資料建立失敗，請稍後再試。'
    case 'line_pay_payment_url_missing':
      return 'LINE Pay 付款連結建立失敗，請稍後再試。'
    case 'line_pay_redirect_failed':
      return '無法前往 LINE Pay 付款頁，請稍後再試。'
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
