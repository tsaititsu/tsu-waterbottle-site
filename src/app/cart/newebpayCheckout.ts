import {
  buildNewebPayClientFormFields,
  type NewebPayClientFormField,
} from '../../lib/newebpay/clientForm'

export const CART_NEWEBPAY_BUTTON_LABEL = '信用卡付款'
export const CART_NEWEBPAY_READY_MESSAGE = '將前往藍新金流信用卡一次付清頁。'
export const CART_NEWEBPAY_LOADING_MESSAGE = '正在建立信用卡付款資料...'

export type CartNewebPayCheckoutItem = {
  id: string
  itemName: string
  amount: number
  quantity: number
}

export type CartNewebPayCustomerInfo = {
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

export type CartNewebPayCreateProductOrderInput = {
  customerName: string
  customerPhone: string
  customerEmail: string | null
  paymentMethod: 'newebpay'
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

export type CartNewebPayPaymentRequestBody = {
  productOrderId: string
  paymentMode: 'credit'
}

export type CartNewebPayFormInput = {
  action: string
  method: 'POST'
  fields: NewebPayClientFormField[]
}

export type StartNewebPayCartCheckoutInput = {
  cartItems: CartNewebPayCheckoutItem[]
  customerInfo: CartNewebPayCustomerInfo
  createProductOrder: (input: CartNewebPayCreateProductOrderInput) => Promise<unknown>
  createNewebPayPayment: (body: CartNewebPayPaymentRequestBody) => Promise<unknown>
  submitNewebPayForm: (input: CartNewebPayFormInput) => Promise<void> | void
}

export type StartNewebPayCartCheckoutResult =
  | {
      ok: true
      provider: 'newebpay'
      productOrderId: string
      merchantOrderNo: string | null
      action: string
      method: 'POST'
      amount: number | null
      itemKey: string | null
    }
  | {
      ok: false
      provider: 'newebpay'
      error:
        | 'newebpay_cart_empty'
        | 'newebpay_customer_info_missing'
        | 'newebpay_create_order_failed'
        | 'newebpay_product_order_id_missing'
        | 'newebpay_payment_create_failed'
        | 'newebpay_form_fields_missing'
        | 'newebpay_form_submit_failed'
    }

export type StartNewebPayCartCheckoutError = Extract<StartNewebPayCartCheckoutResult, { ok: false }>['error']

export type CartNewebPayButtonState = {
  visible: boolean
  disabled: boolean
  label: typeof CART_NEWEBPAY_BUTTON_LABEL
  message: typeof CART_NEWEBPAY_READY_MESSAGE | typeof CART_NEWEBPAY_LOADING_MESSAGE
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

function getNumberField(value: unknown, key: string) {
  if (!isRecord(value)) return null
  const field = value[key]
  return typeof field === 'number' && Number.isFinite(field) ? field : null
}

function buildCreateProductOrderInput(
  cartItems: CartNewebPayCheckoutItem[],
  customerInfo: CartNewebPayCustomerInfo,
): CartNewebPayCreateProductOrderInput | null {
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
    paymentMethod: 'newebpay',
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

export function getCartNewebPayButtonState(isCheckingOut = false): CartNewebPayButtonState {
  return {
    visible: true,
    disabled: isCheckingOut,
    label: CART_NEWEBPAY_BUTTON_LABEL,
    message: isCheckingOut ? CART_NEWEBPAY_LOADING_MESSAGE : CART_NEWEBPAY_READY_MESSAGE,
  }
}

export function getNewebPayCartCheckoutErrorMessage(error: StartNewebPayCartCheckoutError) {
  switch (error) {
    case 'newebpay_cart_empty':
      return '購物車目前沒有可付款的開運商品。'
    case 'newebpay_customer_info_missing':
      return '請完整填寫收件資料並勾選購買須知後，再使用信用卡付款。'
    case 'newebpay_create_order_failed':
      return '商品訂單建立失敗，請稍後再試。'
    case 'newebpay_product_order_id_missing':
      return '商品訂單資料不完整，請稍後再試。'
    case 'newebpay_payment_create_failed':
      return '信用卡付款資料建立失敗，請稍後再試。'
    case 'newebpay_form_fields_missing':
      return '信用卡付款表單資料不完整，請稍後再試。'
    case 'newebpay_form_submit_failed':
      return '無法前往藍新金流付款頁，請稍後再試。'
  }
}

export async function startNewebPayCartCheckout({
  cartItems,
  customerInfo,
  createProductOrder,
  createNewebPayPayment,
  submitNewebPayForm,
}: StartNewebPayCartCheckoutInput): Promise<StartNewebPayCartCheckoutResult> {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return {
      ok: false,
      provider: 'newebpay',
      error: 'newebpay_cart_empty',
    }
  }

  const createOrderInput = buildCreateProductOrderInput(cartItems, customerInfo)
  if (!createOrderInput) {
    return {
      ok: false,
      provider: 'newebpay',
      error: 'newebpay_customer_info_missing',
    }
  }

  let createdOrder: unknown
  try {
    createdOrder = await createProductOrder(createOrderInput)
  } catch {
    return {
      ok: false,
      provider: 'newebpay',
      error: 'newebpay_create_order_failed',
    }
  }

  if (isRecord(createdOrder) && createdOrder.ok === false) {
    return {
      ok: false,
      provider: 'newebpay',
      error: 'newebpay_create_order_failed',
    }
  }

  const productOrderId = getStringField(createdOrder, 'productOrderId') ?? getStringField(createdOrder, 'orderId')
  if (!productOrderId) {
    return {
      ok: false,
      provider: 'newebpay',
      error: 'newebpay_product_order_id_missing',
    }
  }

  let paymentResponse: unknown
  try {
    paymentResponse = await createNewebPayPayment({
      productOrderId,
      paymentMode: 'credit',
    })
  } catch {
    return {
      ok: false,
      provider: 'newebpay',
      error: 'newebpay_payment_create_failed',
    }
  }

  if (isRecord(paymentResponse) && paymentResponse.ok === false) {
    return {
      ok: false,
      provider: 'newebpay',
      error: 'newebpay_payment_create_failed',
    }
  }

  const action = getStringField(paymentResponse, 'action')
  const fieldsResult = buildNewebPayClientFormFields(isRecord(paymentResponse) ? paymentResponse.fields : null)
  if (!action || !fieldsResult.ok) {
    return {
      ok: false,
      provider: 'newebpay',
      error: 'newebpay_form_fields_missing',
    }
  }

  try {
    await submitNewebPayForm({
      action,
      method: 'POST',
      fields: fieldsResult.fields,
    })
  } catch {
    return {
      ok: false,
      provider: 'newebpay',
      error: 'newebpay_form_submit_failed',
    }
  }

  return {
    ok: true,
    provider: 'newebpay',
    productOrderId,
    merchantOrderNo: getStringField(paymentResponse, 'merchantOrderNo'),
    action,
    method: 'POST',
    amount: getNumberField(paymentResponse, 'amount'),
    itemKey: getStringField(paymentResponse, 'itemKey'),
  }
}
