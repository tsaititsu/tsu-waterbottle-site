import { NextResponse } from 'next/server'
import {
  LinePayTransportError,
  probeLinePayGatewayAuthentication,
  type LinePayGatewaySmokeResult,
  type LinePayTransportEnv,
  type LinePayTransportFetch,
} from '../../../../../lib/linePay/transport'

type SmokeEnvironment = LinePayTransportEnv & {
  LINE_PAY_GATEWAY_SMOKE_ENABLED?: string
}

type AuthorizeSmokeRequest = (request: Request) => Promise<boolean>

type RunGatewaySmoke = (input: {
  transportEnv: LinePayTransportEnv
  fetchFn: LinePayTransportFetch
}) => Promise<LinePayGatewaySmokeResult>

function getSafeSmokeFailureReason(error: unknown) {
  if (!(error instanceof LinePayTransportError)) return null

  if (error.code === 'line_pay_gateway_unavailable') return 'gateway_unavailable'
  if (error.code === 'line_pay_gateway_timeout') return 'gateway_timeout'
  if (error.code === 'invalid_line_pay_gateway_response') return 'gateway_response_invalid'
  if (error.code === 'line_pay_gateway_smoke_failed') return 'gateway_response_unexpected'
  if (
    error.code === 'missing_line_pay_gateway_config' ||
    error.code === 'invalid_line_pay_gateway_url' ||
    error.code === 'invalid_line_pay_gateway_timeout' ||
    error.code === 'line_pay_preview_requires_gateway' ||
    error.code === 'invalid_line_pay_transport'
  ) {
    return 'gateway_config_invalid'
  }

  return null
}

function notFoundResponse() {
  return NextResponse.json(
    { ok: false, error: 'not_found' },
    { status: 404, headers: { 'Cache-Control': 'no-store' } },
  )
}

function isSmokeRouteEnabled(env: SmokeEnvironment) {
  return (
    env.VERCEL_ENV?.trim().toLowerCase() === 'preview' &&
    env.LINE_PAY_TRANSPORT?.trim().toLowerCase() === 'gateway' &&
    env.LINE_PAY_GATEWAY_SMOKE_ENABLED?.trim().toLowerCase() === 'true'
  )
}

export async function handleLinePayGatewaySmoke(input: {
  request: Request
  env: SmokeEnvironment
  authorize: AuthorizeSmokeRequest
  runSmoke?: RunGatewaySmoke
  fetchFn?: LinePayTransportFetch
}) {
  if (!isSmokeRouteEnabled(input.env)) return notFoundResponse()

  let authorized = false
  try {
    authorized = await input.authorize(input.request)
  } catch {
    authorized = false
  }
  if (!authorized) return notFoundResponse()

  try {
    const result = await (input.runSmoke ?? probeLinePayGatewayAuthentication)({
      transportEnv: input.env,
      fetchFn: input.fetchFn ?? fetch,
    })

    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const reason = getSafeSmokeFailureReason(error)
    return NextResponse.json(
      {
        ok: false,
        error: 'gateway_smoke_failed',
        ...(reason ? { reason } : {}),
      },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
