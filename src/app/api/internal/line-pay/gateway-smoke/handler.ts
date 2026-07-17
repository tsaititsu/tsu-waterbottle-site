import { NextResponse } from 'next/server'
import {
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
  } catch {
    return NextResponse.json(
      { ok: false, error: 'gateway_smoke_failed' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
