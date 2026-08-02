import { NextResponse } from 'next/server'
import {
  handleProductOrderLinePayCapabilityCallback,
} from '../../../product-orders/line-pay/capabilityHandler'
import { readLinePaySandboxE2eCapabilityCookie } from './capabilityToken'
import {
  isLinePaySandboxE2eRouteEnabled,
  type LinePaySandboxE2eStartEnvironment,
} from './start/handler'

type CapabilityCallbackInput = Parameters<
  typeof handleProductOrderLinePayCapabilityCallback
>[0]

function requestWithServerCapability(
  request: Request,
  purpose: 'confirm' | 'cancel',
) {
  const url = new URL(request.url)
  if (url.searchParams.has('capability')) return request

  const capability = readLinePaySandboxE2eCapabilityCookie(request, purpose)
  if (!capability) return request

  url.searchParams.set('capability', capability)
  return new Request(url, request)
}

export async function handleLinePaySandboxE2eCapabilityCallback(
  input: Omit<CapabilityCallbackInput, 'env'> & {
    env: LinePaySandboxE2eStartEnvironment
  },
) {
  if (!isLinePaySandboxE2eRouteEnabled(input.env)) {
    return NextResponse.json(
      { ok: false, error: 'not_found' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  return handleProductOrderLinePayCapabilityCallback({
    ...input,
    request: requestWithServerCapability(input.request, input.purpose),
  })
}
