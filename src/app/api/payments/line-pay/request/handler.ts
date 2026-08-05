import { createHash, createHmac, randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import {
  buildLinePayRequestPayload,
  getLinePayServerConfig,
  stringifyLinePayJsonBody,
  type LinePayServerEnv,
} from '@/lib/linePay'
import type {
  ExecuteInitializedProductOrderLinePayRequestInput,
  ExecuteInitializedProductOrderLinePayRequestResult,
} from '@/lib/linePay/productOrderRequestExecution'
import {
  LINE_PAY_PRODUCTION_ONE_DOLLAR_AMOUNT_TWD,
  isLinePayProductionOneDollarRouteEnabled,
} from '@/lib/linePay/productionOneDollarTest'
import {
  isLinePayServiceSource,
  isValidLinePayServiceSourceId,
  type LinePayServiceSource,
  type LinePayServiceTarget,
} from '@/lib/linePay/serviceCheckout'
import type { InitializeProductOrderLinePayCheckoutResult } from '@/lib/supabase/linePayCheckoutInitialization'
import {
  LINE_PAY_CAPABILITY_COOKIE_OPTIONS,
  linePayCapabilityCookieName,
} from '../../../product-orders/line-pay/capabilityToken'
import { trustedLinePayPaymentUrl } from '../../../product-orders/line-pay/startHandler'

type AuthorizedContext = {
  userId: string
  client: unknown
  isAdmin: boolean
}

export type ServiceLinePayStartBody = {
  idempotencyKey?: unknown
  source?: unknown
  sourceId?: unknown
  cardId?: unknown
  position?: unknown
  adminOneDollarTest?: unknown
}

type InitializeServiceCheckout = (input: {
  client: unknown
  userId: string
  environment: 'sandbox' | 'production'
  orderNo: string
  merchantOrderNo: string
  target: LinePayServiceTarget
  idempotencyKey: string
  requestBodySha256: string
  confirmTokenHash: string
  cancelTokenHash: string
  capabilityExpiresAt: string
}) => Promise<InitializeProductOrderLinePayCheckoutResult>

type ExecuteServiceCheckout = (
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

export type ServiceLinePayStartDependencies = {
  authorize: (request: Request) => Promise<AuthorizedContext | null>
  resolveTarget: (input: {
    userId: string
    source: LinePayServiceSource
    sourceId: string
    cardId: string | null
    position: string | null
  }) => Promise<LinePayServiceTarget | null>
  initialize: InitializeServiceCheckout
  linkTarget: (input: {
    target: LinePayServiceTarget
    paymentId: string
    merchantOrderNo: string
  }) => Promise<'linked' | 'already_linked' | 'not_required'>
  execute: ExecuteServiceCheckout
  now?: () => Date
  createUuid?: () => string
  createToken?: (purpose: 'confirm' | 'cancel') => string
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function normalizedText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (!normalized || normalized.length > maxLength) return null
  return normalized
}

function optionalText(value: unknown, maxLength: number) {
  if (value === null || value === undefined || value === '') return null
  return normalizedText(value, maxLength)
}

function errorResponse(error: string, status: number) {
  return NextResponse.json(
    { ok: false, error },
    { status, headers: { 'Cache-Control': 'no-store' } },
  )
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

export async function handleServiceLinePayStart(input: {
  request: Request
  env: LinePayServerEnv
  dependencies: ServiceLinePayStartDependencies
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

  let authorization: AuthorizedContext | null
  try {
    authorization = await input.dependencies.authorize(input.request)
  } catch {
    authorization = null
  }
  if (!authorization) return errorResponse('line_pay_login_required', 401)

  const body = (await input.request.json().catch(() => null)) as ServiceLinePayStartBody | null
  const source = body?.source
  const sourceId = normalizedText(body?.sourceId, 100)
  const idempotencyKey = normalizedText(body?.idempotencyKey, 200)
  const cardId = optionalText(body?.cardId, 100)
  const position = optionalText(body?.position, 32)
  const adminOneDollarTest = body?.adminOneDollarTest === true
  if (
    !isLinePayServiceSource(source)
    || !sourceId
    || !isValidLinePayServiceSourceId(source, sourceId)
    || !idempotencyKey
    || idempotencyKey.length < 16
    || /\s/.test(idempotencyKey)
    || ((body?.cardId !== undefined && body.cardId !== null && !cardId)
      || (body?.position !== undefined && body.position !== null && !position))
    || (
      body?.adminOneDollarTest !== undefined
      && typeof body.adminOneDollarTest !== 'boolean'
    )
  ) {
    return errorResponse('invalid_line_pay_service_checkout', 400)
  }

  const now = input.dependencies.now?.() ?? new Date()
  if (
    adminOneDollarTest
    && (
      source === 'course'
      || !authorization.isAdmin
      || !isLinePayProductionOneDollarRouteEnabled(input.env, now)
    )
  ) {
    return errorResponse('not_found', 404)
  }

  let target: LinePayServiceTarget | null
  if (adminOneDollarTest && source === 'booking') {
    let existingBooking: LinePayServiceTarget | null
    try {
      existingBooking = await input.dependencies.resolveTarget({
        userId: authorization.userId,
        source,
        sourceId,
        cardId: null,
        position: null,
      })
    } catch {
      return errorResponse('line_pay_service_lookup_failed', 500)
    }
    if (existingBooking) {
      return errorResponse('line_pay_service_not_payable', 409)
    }

    // The UUID is deliberately absent from bookings. The paid callback can
    // therefore exercise booking-source reconciliation without reserving or
    // confirming a real consultation slot.
    target = {
      source,
      sourceId,
      itemType: source,
      itemName: '水瓶先生論命入口（不建立正式預約）',
      amountTwd: LINE_PAY_PRODUCTION_ONE_DOLLAR_AMOUNT_TWD,
      bookingId: sourceId,
      returnPath: '/account/bookings',
    }
  } else {
    try {
      target = await input.dependencies.resolveTarget({
        userId: authorization.userId,
        source,
        sourceId,
        cardId,
        position,
      })
    } catch {
      return errorResponse('line_pay_service_lookup_failed', 500)
    }
  }
  if (!target) return errorResponse('line_pay_service_not_payable', 409)
  if (
    target.source !== source
    || target.sourceId !== sourceId
    || !Number.isSafeInteger(target.amountTwd)
    || target.amountTwd <= 0
  ) {
    return errorResponse('line_pay_service_contract_invalid', 500)
  }

  const checkoutTarget: LinePayServiceTarget = adminOneDollarTest
    ? {
        ...target,
        itemName: `管理員 NT$1 驗收｜${target.itemName}`.slice(0, 500),
        amountTwd: LINE_PAY_PRODUCTION_ONE_DOLLAR_AMOUNT_TWD,
      }
    : target
  const checkoutIdempotencyKey = adminOneDollarTest
    ? `${idempotencyKey}:admin-nt1`
    : idempotencyKey
  if (checkoutIdempotencyKey.length > 200) {
    return errorResponse('invalid_line_pay_service_checkout', 400)
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

  const createUuid = input.dependencies.createUuid ?? randomUUID
  const checkoutId = sha256(
    `line-pay-service:${config.environment}:${authorization.userId}:${source}:${sourceId}:${checkoutIdempotencyKey}`,
  ).slice(0, 32)
  const orderNo = `PO_LPSVC_${checkoutId}`
  const merchantOrderNo = `LP_SVC_${checkoutId}`
  const claimId = createUuid()
  const requestId = `line-pay-service:${createUuid()}`
  const createToken = input.dependencies.createToken
    ?? ((purpose: 'confirm' | 'cancel') =>
      createHmac('sha256', config.channelSecret)
        .update(
          `line-pay-service-capability:${config.environment}:${authorization.userId}:${source}:${sourceId}:${checkoutIdempotencyKey}:${purpose}`,
        )
        .digest('base64url'))
  const confirmToken = createToken('confirm')
  const cancelToken = createToken('cancel')
  const capabilityExpiresAt = adminOneDollarTest
    ? input.env.LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_EXPIRES_AT!.trim()
    : new Date(now.getTime() + 30 * 60 * 1000).toISOString()
  const payloadInput = {
    orderId: merchantOrderNo,
    amount: checkoutTarget.amountTwd,
    currency: 'TWD' as const,
    products: [{
      name: checkoutTarget.itemName,
      quantity: 1,
      price: checkoutTarget.amountTwd,
    }],
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
      target: checkoutTarget,
      idempotencyKey: checkoutIdempotencyKey,
      requestBodySha256,
      confirmTokenHash: sha256(confirmToken),
      cancelTokenHash: sha256(cancelToken),
      capabilityExpiresAt,
    })
  } catch {
    return errorResponse('line_pay_service_initialization_failed', 502)
  }

  let result: ExecuteInitializedProductOrderLinePayRequestResult
  try {
    result = await input.dependencies.execute({
      client: authorization.client,
      environment: config.environment,
      attemptId: initialized.attempt_id,
      paymentId: initialized.payment_id,
      productOrderId: initialized.product_order_id,
      idempotencyKey: checkoutIdempotencyKey,
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
    return errorResponse('line_pay_service_request_failed', 502)
  }
  if (result.status !== 'payment_url_ready') {
    return errorResponse('line_pay_service_not_ready', 409)
  }

  // The provider request must be ready before the domain record is linked.
  // A failed/unknown upstream request can then be retried without leaving a
  // reading or report permanently attached to an unusable payment.
  try {
    await input.dependencies.linkTarget({
      target: checkoutTarget,
      paymentId: initialized.payment_id,
      merchantOrderNo,
    })
  } catch {
    return errorResponse('line_pay_service_link_failed', 502)
  }

  let paymentUrlWeb: string
  try {
    paymentUrlWeb = trustedLinePayPaymentUrl(result.paymentUrlWeb, config.environment)
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
