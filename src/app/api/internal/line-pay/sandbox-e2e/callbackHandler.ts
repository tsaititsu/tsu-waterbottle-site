import { NextResponse } from 'next/server'
import {
  handleProductOrderLinePayCapabilityCallback,
} from '../../../product-orders/line-pay/capabilityHandler'
import {
  isLinePaySandboxE2eRouteEnabled,
  type LinePaySandboxE2eStartEnvironment,
} from './start/handler'

type CapabilityCallbackInput = Parameters<
  typeof handleProductOrderLinePayCapabilityCallback
>[0]

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

  return handleProductOrderLinePayCapabilityCallback(input)
}
