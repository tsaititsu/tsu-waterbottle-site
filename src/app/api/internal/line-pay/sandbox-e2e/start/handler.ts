import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import {
  buildLinePayRequestPayload,
  getLinePayServerConfig,
  stringifyLinePayJsonBody,
  type LinePayServerEnv,
} from '../../../../../../lib/linePay'
import type { InitializeProductOrderLinePayCheckoutResult } from '../../../../../../lib/supabase/linePayCheckoutInitialization'
import { LinePaySandboxE2eInitializationError } from '../../../../../../lib/supabase/linePaySandboxE2eInitialization'
import type {
  ExecuteInitializedProductOrderLinePayRequestInput,
  ExecuteInitializedProductOrderLinePayRequestResult,
} from '../../../../../../lib/linePay/productOrderRequestExecution'
import {
  LINE_PAY_SANDBOX_E2E_CAPABILITY_COOKIE_OPTIONS,
  linePaySandboxE2eCapabilityCookieName,
} from '../capabilityToken'

export const LINE_PAY_SANDBOX_E2E_CONFIRMATION =
  'RUN_LINE_PAY_SANDBOX_E2E_NT50_ONCE'
export const LINE_PAY_SANDBOX_E2E_AMOUNT_TWD = 50

export type LinePaySandboxE2eStartEnvironment = LinePayServerEnv & {
  VERCEL_ENV?: string
  VERCEL_GIT_COMMIT_SHA?: string
  LINE_PAY_TRANSPORT?: string
  LINE_PAY_SANDBOX_E2E_ENABLED?: string
}

type AuthorizedSandboxE2eContext = {
  userId: string
  client: unknown
}

type InitializeSandboxE2e = (
  input: {
    client: unknown
    userId: string
    environment: 'sandbox'
    amountTwd: 50
    orderNo: string
    merchantOrderNo: string
    idempotencyKey: string
    requestBodySha256: string
    confirmTokenHash: string
    cancelTokenHash: string
    capabilityExpiresAt: string
  },
) => Promise<InitializeProductOrderLinePayCheckoutResult>

type ExecuteSandboxE2e = (
  input: Omit<
    ExecuteInitializedProductOrderLinePayRequestInput,
    'database' | 'requestPayment'
  > & {
    client: unknown
    channelId: string
    channelSecret: string
    transportEnv: LinePaySandboxE2eStartEnvironment
  },
) => Promise<ExecuteInitializedProductOrderLinePayRequestResult>

type StartBody = {
  confirmation?: unknown
}

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

export function isLinePaySandboxE2eRouteEnabled(
  env: LinePaySandboxE2eStartEnvironment,
) {
  return (
    env.VERCEL_ENV?.trim().toLowerCase() === 'preview'
    && env.NEXT_PUBLIC_ENABLE_LINE_PAY?.trim().toLowerCase() === 'true'
    && env.LINE_PAY_ENV?.trim().toLowerCase() === 'sandbox'
    && env.LINE_PAY_TRANSPORT?.trim().toLowerCase() === 'gateway'
    && env.LINE_PAY_SANDBOX_E2E_ENABLED?.trim().toLowerCase() === 'true'
    && /^[0-9a-f]{40}$/i.test(env.VERCEL_GIT_COMMIT_SHA?.trim() ?? '')
  )
}

function internalCallbackBase(configuredUrl: string, pathname: string) {
  const url = new URL(configuredUrl)
  url.pathname = pathname
  url.search = ''
  url.hash = ''
  return url
}

function sandboxPaymentUrl(value: string) {
  const url = new URL(value)
  if (
    url.protocol !== 'https:'
    || url.hostname !== 'sandbox-web-pay.line.me'
    || url.port !== ''
    || url.username !== ''
    || url.password !== ''
  ) {
    throw new Error('invalid_line_pay_sandbox_payment_url')
  }
  return url.toString()
}

export async function handleLinePaySandboxE2eStart(input: {
  request: Request
  env: LinePaySandboxE2eStartEnvironment
  authorize: (
    request: Request,
  ) => Promise<AuthorizedSandboxE2eContext | null>
  initialize: InitializeSandboxE2e
  execute: ExecuteSandboxE2e
  now?: () => Date
  createUuid?: () => string
  createToken?: () => string
}) {
  if (!isLinePaySandboxE2eRouteEnabled(input.env)) return hiddenResponse()

  const body = (await input.request.json().catch(() => null)) as StartBody | null
  if (body?.confirmation !== LINE_PAY_SANDBOX_E2E_CONFIRMATION) {
    return errorResponse('invalid_confirmation', 400)
  }

  let authorization: AuthorizedSandboxE2eContext | null = null
  try {
    authorization = await input.authorize(input.request)
  } catch {
    authorization = null
  }
  if (!authorization) return hiddenResponse()

  const now = input.now?.() ?? new Date()
  const createUuid = input.createUuid ?? randomUUID
  const createToken =
    input.createToken ?? (() => randomBytes(32).toString('base64url'))
  const commitSha = input.env.VERCEL_GIT_COMMIT_SHA!.trim().toLowerCase()
  const runKey = sha256(`line-pay-sandbox-e2e:${commitSha}`).slice(0, 32)
  const orderNo = `LPE2E-${runKey}`
  const merchantOrderNo = `LP_E2E_${runKey}`
  const idempotencyKey = `line-pay-sandbox-e2e:${commitSha}`
  const claimId = createUuid()
  const requestId = `line-pay-sandbox-e2e:${createUuid()}`
  const capabilityExpiresAt = new Date(
    now.getTime() + 30 * 60 * 1000,
  ).toISOString()

  let config: ReturnType<typeof getLinePayServerConfig>
  try {
    config = getLinePayServerConfig(input.env)
  } catch {
    return errorResponse('line_pay_sandbox_e2e_config_failed', 502)
  }
  if (!config.enabled || config.environment !== 'sandbox') {
    return hiddenResponse()
  }

  const confirmToken = createToken()
  const cancelToken = createToken()

  const payloadInput = {
    orderId: merchantOrderNo,
    amount: LINE_PAY_SANDBOX_E2E_AMOUNT_TWD,
    currency: 'TWD' as const,
    products: [
      {
        name: 'LINE Pay Sandbox E2E 測試',
        quantity: 1,
        price: LINE_PAY_SANDBOX_E2E_AMOUNT_TWD,
      },
    ],
    // LINE Pay constructs the callback query itself with orderId and
    // transactionId. Keep the registered callback URL free of custom query
    // parameters; the browser returns the one-time capability in an HttpOnly
    // SameSite cookie instead.
    confirmUrl: internalCallbackBase(
      config.confirmUrl,
      '/api/internal/line-pay/sandbox-e2e/confirm',
    ).toString(),
    cancelUrl: internalCallbackBase(
      config.cancelUrl,
      '/api/internal/line-pay/sandbox-e2e/cancel',
    ).toString(),
  }
  const requestBodySha256 = sha256(
    stringifyLinePayJsonBody(buildLinePayRequestPayload(payloadInput)),
  )

  let initialized: InitializeProductOrderLinePayCheckoutResult
  try {
    initialized = await input.initialize({
      client: authorization.client,
      userId: authorization.userId,
      environment: 'sandbox',
      amountTwd: LINE_PAY_SANDBOX_E2E_AMOUNT_TWD,
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
          error: 'line_pay_sandbox_e2e_initialization_failed',
          initializationReason: error.reason,
        },
        { status: 502, headers: { 'Cache-Control': 'no-store' } },
      )
    }
    return errorResponse('line_pay_sandbox_e2e_initialization_failed', 502)
  }

  let result: ExecuteInitializedProductOrderLinePayRequestResult
  try {
    result = await input.execute({
      client: authorization.client,
      environment: 'sandbox',
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
    return errorResponse('line_pay_sandbox_e2e_execution_failed', 502)
  }

  if (result.status !== 'payment_url_ready') {
    return errorResponse('line_pay_sandbox_e2e_not_ready', 409)
  }

  try {
    const paymentUrl = sandboxPaymentUrl(result.paymentUrlWeb)
    const response = NextResponse.json(
      {
        ok: true,
        environment: 'sandbox',
        amountTwd: LINE_PAY_SANDBOX_E2E_AMOUNT_TWD,
        currency: 'TWD',
        paymentUrl,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
    response.cookies.set(
      linePaySandboxE2eCapabilityCookieName('confirm'),
      confirmToken,
      LINE_PAY_SANDBOX_E2E_CAPABILITY_COOKIE_OPTIONS,
    )
    response.cookies.set(
      linePaySandboxE2eCapabilityCookieName('cancel'),
      cancelToken,
      LINE_PAY_SANDBOX_E2E_CAPABILITY_COOKIE_OPTIONS,
    )
    return response
  } catch {
    return errorResponse('line_pay_sandbox_e2e_payment_url_failed', 502)
  }
}
