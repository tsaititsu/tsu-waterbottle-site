import { createHash, createHmac, randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import {
  buildLinePayRequestPayload,
  getLinePayServerConfig,
  stringifyLinePayJsonBody,
  type LinePayServerEnv,
} from '../../../../lib/linePay'
import type {
  ExecuteInitializedProductOrderLinePayRequestInput,
  ExecuteInitializedProductOrderLinePayRequestResult,
} from '../../../../lib/linePay/productOrderRequestExecution'
import { spiritualProducts } from '../../../../lib/spiritualProducts'
import type { InitializeProductOrderLinePayCheckoutResult } from '../../../../lib/supabase/linePayCheckoutInitialization'
import {
  LINE_PAY_CAPABILITY_COOKIE_OPTIONS,
  linePayCapabilityCookieName,
} from './capabilityToken'

type AuthorizedLinePayContext = {
  userId: string
  client: unknown
}

type InitializeLinePayCheckout = (
  input: {
    client: unknown
    userId: string
    environment: 'sandbox' | 'production'
    orderNo: string
    merchantOrderNo: string
    customerName: string
    customerEmail: string | null
    customerPhone: string
    note: string | null
    items: Array<{ productSlug: string; quantity: number }>
    shippingInfo: {
      recipientName: string
      recipientPhone: string
      recipientEmail: string | null
      shippingMethod: 'manual'
      postalCode: string | null
      address: string
    }
    idempotencyKey: string
    requestBodySha256: string
    confirmTokenHash: string
    cancelTokenHash: string
    capabilityExpiresAt: string
  },
) => Promise<InitializeProductOrderLinePayCheckoutResult>

type ExecuteLinePayCheckout = (
  input: Omit<
    ExecuteInitializedProductOrderLinePayRequestInput,
    'database' | 'requestPayment'
  > & {
    client: unknown
    channelId: string
    channelSecret: string
    transportEnv: LinePayServerEnv
  },
) => Promise<ExecuteInitializedProductOrderLinePayRequestResult>

export type ProductOrderLinePayStartDependencies = {
  authorize: (
    request: Request,
  ) => Promise<AuthorizedLinePayContext | null>
  initialize: InitializeLinePayCheckout
  execute: ExecuteLinePayCheckout
  now?: () => Date
  createUuid?: () => string
  createToken?: (purpose: 'confirm' | 'cancel') => string
}

type StartBody = {
  idempotencyKey?: unknown
  customerInfo?: unknown
  items?: unknown
}

type CustomerInfo = {
  customerName: string
  customerEmail: string | null
  customerPhone: string
  recipientName: string
  recipientEmail: string | null
  recipientPhone: string
  postalCode: string | null
  address: string
  note: string | null
}

const productBySlug = new Map(
  spiritualProducts.map((product) => [product.slug, product]),
)

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(
  value: unknown,
  maxLength: number,
  options: { optional?: boolean } = {},
) {
  if (value === null || value === undefined) {
    return options.optional ? null : undefined
  }
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  if (!normalized) return options.optional ? null : undefined
  return normalized.length <= maxLength ? normalized : undefined
}

function parseCustomerInfo(value: unknown): CustomerInfo | null {
  if (!isRecord(value)) return null

  const customerName = text(value.customerName, 200)
  const customerPhone = text(value.customerPhone, 64)
  const recipientName = text(value.recipientName, 200)
  const recipientPhone = text(value.recipientPhone, 64)
  const address = text(value.address, 500)
  const customerEmail = text(value.customerEmail, 320, { optional: true })
  const recipientEmail = text(value.recipientEmail, 320, { optional: true })
  const postalCode = text(value.postalCode, 32, { optional: true })
  const note = text(value.note, 1000, { optional: true })

  if (
    !customerName
    || !customerPhone
    || !recipientName
    || !recipientPhone
    || !address
    || customerEmail === undefined
    || recipientEmail === undefined
    || postalCode === undefined
    || note === undefined
  ) {
    return null
  }

  return {
    customerName,
    customerEmail,
    customerPhone,
    recipientName,
    recipientEmail,
    recipientPhone,
    postalCode,
    address,
    note,
  }
}

function parseItems(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    return null
  }

  const seen = new Set<string>()
  const items: Array<{
    productSlug: string
    productName: string
    quantity: number
    unitPriceTwd: number
  }> = []

  for (const entry of value) {
    if (!isRecord(entry)) return null
    const productSlug = text(entry.productSlug, 200)
    const quantity = entry.quantity
    const product = productSlug ? productBySlug.get(productSlug) : undefined

    if (
      !product
      || seen.has(product.slug)
      || !Number.isSafeInteger(quantity)
      || Number(quantity) <= 0
      || Number(quantity) > 2147483647
    ) {
      return null
    }

    seen.add(product.slug)
    items.push({
      productSlug: product.slug,
      productName: product.name,
      quantity: Number(quantity),
      unitPriceTwd: product.priceTwd,
    })
  }

  return items
}

function trustedCallbackUrl(
  value: string,
  expectedPath: string,
  requestUrl: URL,
) {
  const url = new URL(value)
  if (
    url.protocol !== 'https:'
    || url.origin !== requestUrl.origin
    || url.pathname !== expectedPath
    || url.port !== ''
    || url.username !== ''
    || url.password !== ''
    || url.search !== ''
    || url.hash !== ''
  ) {
    throw new Error('invalid_line_pay_callback_url')
  }
  return url.toString()
}

export function trustedLinePayPaymentUrl(
  value: string,
  environment: 'sandbox' | 'production',
) {
  const url = new URL(value)
  const expectedHostname =
    environment === 'sandbox'
      ? 'sandbox-web-pay.line.me'
      : 'web-pay.line.me'
  if (
    url.protocol !== 'https:'
    || url.hostname !== expectedHostname
    || url.port !== ''
    || url.username !== ''
    || url.password !== ''
    || !url.pathname.startsWith('/web/')
  ) {
    throw new Error('invalid_line_pay_payment_url')
  }
  return url.toString()
}

function errorResponse(error: string, status: number) {
  return NextResponse.json(
    { ok: false, error },
    { status, headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function handleProductOrderLinePayStart(input: {
  request: Request
  env: LinePayServerEnv
  dependencies: ProductOrderLinePayStartDependencies
}) {
  if (input.request.method !== 'POST') {
    return errorResponse('method_not_allowed', 405)
  }

  let config: ReturnType<typeof getLinePayServerConfig>
  try {
    config = getLinePayServerConfig(input.env)
  } catch {
    return errorResponse('line_pay_config_invalid', 500)
  }
  if (!config.enabled) return errorResponse('line_pay_disabled', 404)

  let authorization: AuthorizedLinePayContext | null = null
  try {
    authorization = await input.dependencies.authorize(input.request)
  } catch {
    authorization = null
  }
  if (!authorization) return errorResponse('line_pay_login_required', 401)

  const body = (await input.request.json().catch(() => null)) as StartBody | null
  const idempotencyKey = text(body?.idempotencyKey, 200)
  const customerInfo = parseCustomerInfo(body?.customerInfo)
  const items = parseItems(body?.items)
  if (
    !idempotencyKey
    || idempotencyKey.length < 16
    || /\s/.test(idempotencyKey)
    || !customerInfo
    || !items
  ) {
    return errorResponse('invalid_line_pay_checkout', 400)
  }

  const requestUrl = new URL(input.request.url)
  let confirmUrl: string
  let cancelUrl: string
  try {
    confirmUrl = trustedCallbackUrl(
      config.confirmUrl,
      '/api/product-orders/line-pay/confirm',
      requestUrl,
    )
    cancelUrl = trustedCallbackUrl(
      config.cancelUrl,
      '/api/product-orders/line-pay/cancel',
      requestUrl,
    )
  } catch {
    return errorResponse('line_pay_config_invalid', 500)
  }

  const now = input.dependencies.now?.() ?? new Date()
  const createUuid = input.dependencies.createUuid ?? randomUUID
  const checkoutId = sha256(
    `line-pay-cart:${config.environment}:${authorization.userId}:${idempotencyKey}`,
  ).slice(0, 32)
  const orderNo = `PO_LINEPAY_${checkoutId}`
  const merchantOrderNo = `LP_CART_${checkoutId}`
  const claimId = createUuid()
  const requestId = `line-pay-cart:${createUuid()}`
  const createToken = input.dependencies.createToken
    ?? ((purpose: 'confirm' | 'cancel') =>
      createHmac('sha256', config.channelSecret)
        .update(
          `line-pay-cart-capability:${config.environment}:${authorization.userId}:${idempotencyKey}:${purpose}`,
        )
        .digest('base64url'))
  const confirmToken = createToken('confirm')
  const cancelToken = createToken('cancel')
  const capabilityExpiresAt = new Date(
    now.getTime() + 30 * 60 * 1000,
  ).toISOString()
  const totalAmountTwd = items.reduce(
    (total, item) => total + item.unitPriceTwd * item.quantity,
    0,
  )
  const payloadInput = {
    orderId: merchantOrderNo,
    amount: totalAmountTwd,
    currency: 'TWD' as const,
    products: items.map((item) => ({
      name: item.productName,
      quantity: item.quantity,
      price: item.unitPriceTwd,
    })),
    confirmUrl,
    cancelUrl,
  }
  const requestBodySha256 = sha256(
    stringifyLinePayJsonBody(buildLinePayRequestPayload(payloadInput)),
  )

  let initialized: InitializeProductOrderLinePayCheckoutResult
  try {
    initialized = await input.dependencies.initialize({
      client: authorization.client,
      userId: authorization.userId,
      environment: config.environment,
      orderNo,
      merchantOrderNo,
      customerName: customerInfo.customerName,
      customerEmail: customerInfo.customerEmail,
      customerPhone: customerInfo.customerPhone,
      note: customerInfo.note,
      items: items.map((item) => ({
        productSlug: item.productSlug,
        quantity: item.quantity,
      })),
      shippingInfo: {
        recipientName: customerInfo.recipientName,
        recipientPhone: customerInfo.recipientPhone,
        recipientEmail: customerInfo.recipientEmail,
        shippingMethod: 'manual',
        postalCode: customerInfo.postalCode,
        address: customerInfo.address,
      },
      idempotencyKey,
      requestBodySha256,
      confirmTokenHash: sha256(confirmToken),
      cancelTokenHash: sha256(cancelToken),
      capabilityExpiresAt,
    })
  } catch {
    return errorResponse('line_pay_checkout_initialization_failed', 502)
  }

  let result: ExecuteInitializedProductOrderLinePayRequestResult
  try {
    result = await input.dependencies.execute({
      client: authorization.client,
      environment: config.environment,
      attemptId: initialized.attempt_id,
      paymentId: initialized.payment_id,
      productOrderId: initialized.product_order_id,
      idempotencyKey,
      requestBodySha256,
      merchantOrderNo,
      claimId,
      claimExpiresAt: new Date(now.getTime() + 2 * 60 * 1000).toISOString(),
      requestId,
      payloadInput,
      channelId: config.channelId,
      channelSecret: config.channelSecret,
      transportEnv: input.env,
    })
  } catch {
    return errorResponse('line_pay_checkout_request_failed', 502)
  }

  if (result.status !== 'payment_url_ready') {
    return errorResponse('line_pay_checkout_not_ready', 409)
  }

  let paymentUrlWeb: string
  try {
    paymentUrlWeb = trustedLinePayPaymentUrl(
      result.paymentUrlWeb,
      config.environment,
    )
  } catch {
    return errorResponse('line_pay_payment_url_invalid', 502)
  }

  const response = NextResponse.json(
    { ok: true, paymentUrl: { web: paymentUrlWeb } },
    { headers: { 'Cache-Control': 'no-store' } },
  )
  response.cookies.set(
    linePayCapabilityCookieName('confirm'),
    confirmToken,
    LINE_PAY_CAPABILITY_COOKIE_OPTIONS,
  )
  response.cookies.set(
    linePayCapabilityCookieName('cancel'),
    cancelToken,
    LINE_PAY_CAPABILITY_COOKIE_OPTIONS,
  )
  return response
}
