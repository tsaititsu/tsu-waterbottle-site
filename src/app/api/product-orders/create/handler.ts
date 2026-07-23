import { NextResponse } from 'next/server'
import { spiritualProducts, type SpiritualProduct } from '../../../../lib/spiritualProducts'
import {
  createProductOrder,
  type CreateProductOrderInput,
  type CreateProductOrderResult,
  type ProductOrderItemInput,
  type ProductOrderPaymentMethod,
  type ProductShippingInfoInput,
} from '../../../../lib/supabase/productOrders'

export type CreateProductOrderRequest = {
  customerName?: unknown
  customerEmail?: unknown
  customerPhone?: unknown
  paymentMethod?: unknown
  items?: unknown
  shippingInfo?: unknown
  note?: unknown
}

type CreateProductOrderDependency = typeof createProductOrder

const MAX_CUSTOMER_TEXT_LENGTH = 120
const MAX_NOTE_LENGTH = 500
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const productBySlug = new Map(spiritualProducts.map((product) => [product.slug, product]))

function normalizeRequiredText(value: unknown, maxLength = MAX_CUSTOMER_TEXT_LENGTH) {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed || trimmed.length > maxLength) return null

  return trimmed
}

function normalizeOptionalText(value: unknown, maxLength = MAX_CUSTOMER_TEXT_LENGTH) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > maxLength) return null

  return trimmed
}

function parseOptionalEmail(value: unknown) {
  if (value === undefined || value === null) {
    return {
      valid: true,
      email: null,
    }
  }

  if (typeof value !== 'string') {
    return {
      valid: false,
      email: null,
    }
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return {
      valid: true,
      email: null,
    }
  }

  return {
    valid: EMAIL_PATTERN.test(trimmed),
    email: EMAIL_PATTERN.test(trimmed) ? trimmed : null,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getPaymentMethod(value: unknown): ProductOrderPaymentMethod | null {
  if (value === 'newebpay') return value
  return null
}

function buildProductSnapshot(product: SpiritualProduct): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {
    slug: product.slug,
    name: product.name,
    category: product.category,
    priceTwd: product.priceTwd,
    validity: product.validity,
    image: product.image,
    description: product.description,
  }

  if (product.images) snapshot.images = product.images
  if (product.usage) snapshot.usage = product.usage
  if (product.note) snapshot.note = product.note

  return snapshot
}

function parseItems(value: unknown): ProductOrderItemInput[] | null {
  if (!Array.isArray(value) || value.length === 0) return null

  const items: ProductOrderItemInput[] = []

  for (const entry of value) {
    if (!isRecord(entry)) return null

    const productSlug = normalizeRequiredText(entry.productSlug)
    const quantity = entry.quantity

    if (!productSlug || typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
      return null
    }

    const product = productBySlug.get(productSlug)
    if (!product) return null

    items.push({
      productSlug: product.slug,
      productName: product.name,
      unitPriceTwd: product.priceTwd,
      quantity,
      productSnapshot: buildProductSnapshot(product),
    })
  }

  return items
}

function parseCustomer(body: CreateProductOrderRequest) {
  const customerName = normalizeRequiredText(body.customerName)
  const customerPhone = normalizeRequiredText(body.customerPhone)
  const customerEmail = parseOptionalEmail(body.customerEmail)

  if (!customerName || !customerPhone) return null
  if (!customerEmail.valid) return null

  return {
    customerName,
    customerEmail: customerEmail.email,
    customerPhone,
  }
}

function parseShippingInfo(value: unknown): ProductShippingInfoInput | null {
  if (!isRecord(value)) return null
  if (value.shippingMethod !== 'manual') return null

  const recipientName = normalizeRequiredText(value.recipientName)
  const recipientPhone = normalizeRequiredText(value.recipientPhone)
  const address = normalizeRequiredText(value.address, 300)
  const recipientEmail = parseOptionalEmail(value.recipientEmail)

  if (!recipientName || !recipientPhone || !address) return null
  if (!recipientEmail.valid) return null

  return {
    recipientName,
    recipientPhone,
    recipientEmail: recipientEmail.email,
    shippingMethod: 'manual',
    postalCode: normalizeOptionalText(value.postalCode, 20),
    address,
    storeType: null,
    storeId: null,
    storeName: null,
    storeAddress: null,
    storePhone: null,
  }
}

function createValidationError(error: string) {
  return NextResponse.json(
    {
      ok: false,
      error,
    },
    { status: 400 },
  )
}

function createOrderSuccessResponse(order: CreateProductOrderResult, paymentMethod: ProductOrderPaymentMethod) {
  return NextResponse.json({
    ok: true,
    orderId: order.orderId,
    orderNo: order.orderNo,
    totalAmountTwd: order.totalAmountTwd,
    paymentMethod,
    paymentStatus: 'pending',
    orderStatus: 'pending_payment',
    shippingStatus: 'not_shipped',
  })
}

function createOrderFailedResponse(_error: unknown) {
  console.error('建立 product order 失敗', {
    error: 'product_order_create_failed',
  })

  return NextResponse.json(
    {
      ok: false,
      error: 'product_order_create_failed',
    },
    { status: 500 },
  )
}

export async function handleCreateProductOrderRequest(
  body: CreateProductOrderRequest | null,
  deps: {
    createProductOrder?: CreateProductOrderDependency
  } = {},
): Promise<Response> {
  if (!body) {
    return createValidationError('invalid_product_order_items')
  }

  const paymentMethod = getPaymentMethod(body.paymentMethod)
  if (!paymentMethod) {
    return createValidationError('invalid_product_payment_method')
  }

  const customer = parseCustomer(body)
  if (!customer) {
    return createValidationError('invalid_product_order_customer')
  }

  const items = parseItems(body.items)
  if (!items) {
    return createValidationError('invalid_product_order_items')
  }

  const shippingInfo = parseShippingInfo(body.shippingInfo)
  if (!shippingInfo) {
    return createValidationError('invalid_product_shipping_info')
  }

  const note = normalizeOptionalText(body.note, MAX_NOTE_LENGTH)
  if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') {
    return createValidationError('invalid_product_order_customer')
  }

  const createOrder = deps.createProductOrder ?? createProductOrder
  const input: CreateProductOrderInput = {
    ...customer,
    paymentMethod,
    items,
    shippingInfo,
    note,
  }

  try {
    const order = await createOrder(input)
    return createOrderSuccessResponse(order, paymentMethod)
  } catch (error) {
    return createOrderFailedResponse(error)
  }
}
