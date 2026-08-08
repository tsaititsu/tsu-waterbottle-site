import { createHash, createHmac, randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import {
  buildLinePayRequestPayload,
  getLinePayServerConfig,
  stringifyLinePayJsonBody,
  type LinePayServerEnv,
} from '../../../../../../lib/linePay'
import {
  LinePayProductOrderRequestExecutionError,
  type ExecuteInitializedProductOrderLinePayRequestInput,
  type ExecuteInitializedProductOrderLinePayRequestResult,
} from '../../../../../../lib/linePay/productOrderRequestExecution'
import type { InitializeProductOrderLinePayCheckoutResult } from '../../../../../../lib/supabase/linePayCheckoutInitialization'
import { LinePaySandboxE2eInitializationError } from '../../../../../../lib/supabase/linePaySandboxE2eInitialization'
import {
  LINE_PAY_CAPABILITY_COOKIE_OPTIONS,
  linePayCapabilityCookieName,
} from '../../../../product-orders/line-pay/capabilityToken'
import {
  LINE_PAY_PRODUCTION_ONE_DOLLAR_CONFIRMATION as SHARED_LINE_PAY_PRODUCTION_ONE_DOLLAR_CONFIRMATION,
  getLinePayProductionOneDollarEntryLabel,
  isLinePayProductionOneDollarEntrySource,
  type LinePayProductionOneDollarEntrySource,
} from '../../../../../../lib/linePay/productionOneDollarEntry'

export const LINE_PAY_PRODUCTION_ONE_DOLLAR_CONFIRMATION =
  SHARED_LINE_PAY_PRODUCTION_ONE_DOLLAR_CONFIRMATION
export const LINE_PAY_PRODUCTION_ONE_DOLLAR_AMOUNT_TWD = 1
const LINE_PAY_PRODUCTION_ONE_DOLLAR_MIN_WINDOW_MS = 5 * 60 * 1000
const LINE_PAY_PRODUCTION_ONE_DOLLAR_MAX_WINDOW_MS = 24 * 60 * 60 * 1000

export type LinePayProductionOneDollarEnvironment = LinePayServerEnv & {
  VERCEL_ENV?: string
  VERCEL_GIT_COMMIT_SHA?: string
  LINE_PAY_TRANSPORT?: string
  LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_ENABLED?: string
  LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_CONFIRMATION?: string
  LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_EXPIRES_AT?: string
}

type AuthorizedProductionOneDollarContext = {
  userId: string
  client: unknown
}

type InitializeProductionOneDollar = (
  input: {
    client: unknown
    userId: string
    environment: 'production'
    entrySource: LinePayProductionOneDollarEntrySource
    amountTwd: 1
    orderNo: string
    merchantOrderNo: string
    idempotencyKey: string
    requestBodySha256: string
    confirmTokenHash: string
    cancelTokenHash: string
    capabilityExpiresAt: string
  },
) => Promise<InitializeProductOrderLinePayCheckoutResult>

type ExecuteProductionOneDollar = (
  input: Omit<
    ExecuteInitializedProductOrderLinePayRequestInput,
    'database' | 'requestPayment'
  > & {
    client: unknown
    channelId: string
    channelSecret: string
    transportEnv: LinePayProductionOneDollarEnvironment
  },
) => Promise<ExecuteInitializedProductOrderLinePayRequestResult>

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function hiddenResponse() {
  return NextResponse.json(
    { ok: false, error: 'not_found' },
    { status: 404, headers: { 'Cache-Control': 'no-store' } },
  )
}

function errorResponse(error: string, status: number) {
  return NextResponse.json(
    { ok: false, error },
    { status, headers: { 'Cache-Control': 'no-store' } },
  )
}

export function isLinePayProductionOneDollarRouteEnabled(
  env: LinePayProductionOneDollarEnvironment,
  now = new Date(),
) {
  const expiresAt = env.LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_EXPIRES_AT?.trim()
  const expiresAtMs = expiresAt ? Date.parse(expiresAt) : Number.NaN
  const remainingWindowMs = expiresAtMs - now.getTime()

  return (
    env.VERCEL_ENV?.trim().toLowerCase() === 'production'
    && env.NEXT_PUBLIC_ENABLE_LINE_PAY?.trim().toLowerCase() === 'true'
    && env.LINE_PAY_ENV?.trim().toLowerCase() === 'production'
    && env.LINE_PAY_TRANSPORT?.trim().toLowerCase() === 'gateway'
    && env.LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_ENABLED?.trim().toLowerCase()
      === 'true'
    && env.LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_CONFIRMATION?.trim()
      === LINE_PAY_PRODUCTION_ONE_DOLLAR_CONFIRMATION
    && Number.isFinite(expiresAtMs)
    && new Date(expiresAtMs).toISOString() === expiresAt
    && remainingWindowMs > LINE_PAY_PRODUCTION_ONE_DOLLAR_MIN_WINDOW_MS
    && remainingWindowMs <= LINE_PAY_PRODUCTION_ONE_DOLLAR_MAX_WINDOW_MS
    && /^[0-9a-f]{40}$/i.test(env.VERCEL_GIT_COMMIT_SHA?.trim() ?? '')
  )
}

function trustedProductionCallbackUrl(
  value: string,
  expectedPath: string,
  request: Request,
) {
  const callbackUrl = new URL(value)
  const requestUrl = new URL(request.url)
  if (
    callbackUrl.protocol !== 'https:'
    || callbackUrl.origin !== requestUrl.origin
    || callbackUrl.pathname !== expectedPath
    || callbackUrl.port !== ''
    || callbackUrl.username !== ''
    || callbackUrl.password !== ''
    || callbackUrl.search !== ''
    || callbackUrl.hash !== ''
  ) {
    throw new Error('line_pay_production_one_dollar_callback_invalid')
  }
  return callbackUrl.toString()
}

function trustedProductionPaymentUrl(value: string) {
  const url = new URL(value)
  if (
    url.protocol !== 'https:'
    || url.hostname !== 'web-pay.line.me'
    || url.port !== ''
    || url.username !== ''
    || url.password !== ''
    || !url.pathname.startsWith('/web/')
  ) {
    throw new Error('line_pay_production_one_dollar_payment_url_invalid')
  }
  return url.toString()
}

export async function handleLinePayProductionOneDollarStart(input: {
  request: Request
  env: LinePayProductionOneDollarEnvironment
  authorize: (
    request: Request,
  ) => Promise<AuthorizedProductionOneDollarContext | null>
  initialize: InitializeProductionOneDollar
  execute: ExecuteProductionOneDollar
  now?: () => Date
  createUuid?: () => string
  createToken?: (purpose: 'confirm' | 'cancel') => string
}) {
  const now = input.now?.() ?? new Date()
  if (!isLinePayProductionOneDollarRouteEnabled(input.env, now)) {
    return hiddenResponse()
  }

  const body = (await input.request.json().catch(() => null)) as {
    confirmation?: unknown
    entrySource?: unknown
  } | null
  if (body?.confirmation !== LINE_PAY_PRODUCTION_ONE_DOLLAR_CONFIRMATION) {
    return errorResponse('invalid_confirmation', 400)
  }
  const entrySource = body.entrySource === undefined ? 'admin' : body.entrySource
  if (!isLinePayProductionOneDollarEntrySource(entrySource)) {
    return errorResponse('invalid_entry_source', 400)
  }

  let authorization: AuthorizedProductionOneDollarContext | null = null
  try {
    authorization = await input.authorize(input.request)
  } catch {
    authorization = null
  }
  if (!authorization) return hiddenResponse()

  let config: ReturnType<typeof getLinePayServerConfig>
  let confirmUrl: string
  let cancelUrl: string
  try {
    config = getLinePayServerConfig(input.env)
    if (!config.enabled || config.environment !== 'production') {
      return hiddenResponse()
    }
    confirmUrl = trustedProductionCallbackUrl(
      config.confirmUrl,
      '/api/product-orders/line-pay/confirm',
      input.request,
    )
    cancelUrl = trustedProductionCallbackUrl(
      config.cancelUrl,
      '/api/product-orders/line-pay/cancel',
      input.request,
    )
  } catch {
    return errorResponse('line_pay_production_one_dollar_config_failed', 502)
  }

  const createUuid = input.createUuid ?? randomUUID
  const commitSha = input.env.VERCEL_GIT_COMMIT_SHA!.trim().toLowerCase()
  const identity = sha256(
    `line-pay-production-one-dollar:${commitSha}:${authorization.userId}:${entrySource}`,
  ).slice(0, 32)
  const orderNo = `LPONE-${identity}`
  const merchantOrderNo = `LP_ONE_${identity}`
  const idempotencyKey =
    `line-pay-production-one-dollar:${commitSha}:${authorization.userId}:${entrySource}`
  const claimId = createUuid()
  const requestId = `line-pay-production-one-dollar:${createUuid()}`
  const capabilityExpiresAt =
    input.env.LINE_PAY_PRODUCTION_ONE_DOLLAR_TEST_EXPIRES_AT!.trim()
  const createToken = input.createToken
    ?? ((purpose: 'confirm' | 'cancel') =>
      createHmac('sha256', config.channelSecret)
        .update(
          `line-pay-production-one-dollar-capability:${commitSha}:${authorization.userId}:${entrySource}:${purpose}`,
        )
        .digest('base64url'))
  const confirmToken = createToken('confirm')
  const cancelToken = createToken('cancel')
  const productName = entrySource === 'admin'
    ? 'LINE Pay Production NT$1 測試（不出貨）'
    : `LINE Pay NT$1 入口測試｜${getLinePayProductionOneDollarEntryLabel(entrySource)}（不出貨／不提供服務）`
  const payloadInput = {
    orderId: merchantOrderNo,
    amount: LINE_PAY_PRODUCTION_ONE_DOLLAR_AMOUNT_TWD,
    currency: 'TWD' as const,
    products: [{
      name: productName,
      quantity: 1,
      price: LINE_PAY_PRODUCTION_ONE_DOLLAR_AMOUNT_TWD,
    }],
    confirmUrl,
    cancelUrl,
  }
  const requestBodySha256 = sha256(
    stringifyLinePayJsonBody(buildLinePayRequestPayload(payloadInput)),
  )

  let initialized: InitializeProductOrderLinePayCheckoutResult
  try {
    initialized = await input.initialize({
      client: authorization.client,
      userId: authorization.userId,
      environment: 'production',
      entrySource,
      amountTwd: LINE_PAY_PRODUCTION_ONE_DOLLAR_AMOUNT_TWD,
      orderNo,
      merchantOrderNo,
      idempotencyKey,
      requestBodySha256,
      confirmTokenHash: sha256(confirmToken),
      cancelTokenHash: sha256(cancelToken),
      capabilityExpiresAt,
    })
  } catch (error) {
    if (error instanceof LinePaySandboxE2eInitializationError) {
      return NextResponse.json(
        {
          ok: false,
          error: 'line_pay_production_one_dollar_initialization_failed',
          initializationReason: error.reason,
        },
        { status: 502, headers: { 'Cache-Control': 'no-store' } },
      )
    }
    return errorResponse(
      'line_pay_production_one_dollar_initialization_failed',
      502,
    )
  }

  let result: ExecuteInitializedProductOrderLinePayRequestResult
  try {
    result = await input.execute({
      client: authorization.client,
      environment: 'production',
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
  } catch (error) {
    if (error instanceof LinePayProductOrderRequestExecutionError) {
      return NextResponse.json(
        {
          ok: false,
          error: 'line_pay_production_one_dollar_execution_failed',
          executionReason: error.code,
        },
        { status: 502, headers: { 'Cache-Control': 'no-store' } },
      )
    }
    return errorResponse('line_pay_production_one_dollar_execution_failed', 502)
  }

  if (result.status !== 'payment_url_ready') {
    return errorResponse('line_pay_production_one_dollar_not_ready', 409)
  }

  try {
    const paymentUrl = trustedProductionPaymentUrl(result.paymentUrlWeb)
    const response = NextResponse.json(
      {
        ok: true,
        environment: 'production',
        entrySource,
        amountTwd: LINE_PAY_PRODUCTION_ONE_DOLLAR_AMOUNT_TWD,
        currency: 'TWD',
        paymentUrl,
      },
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
  } catch {
    return errorResponse(
      'line_pay_production_one_dollar_payment_url_failed',
      502,
    )
  }
}
