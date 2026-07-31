import { NextResponse } from 'next/server'
import {
  confirmLinePayPayment,
  createLinePayNonce,
} from '@/lib/linePay'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  createProductOrderLinePayCapabilityDatabase,
  readProductOrderLinePayCapabilityContext,
  type ProductOrderLinePayCapabilityContextClient,
  type ProductOrderLinePayCapabilityRpcClient,
} from '@/lib/supabase/linePayCapabilityRuntime'
import {
  redirectLinePayHandlerResponseToCart,
  resolveLinePayCancelCartRedirectStatus,
  resolveLinePayConfirmCartRedirectStatus,
} from '../../../product-orders/line-pay/redirect'
import { handleLinePaySandboxE2eCapabilityCallback } from './callbackHandler'
import { isLinePaySandboxE2eRouteEnabled } from './start/handler'

type CapabilityClient =
  & ProductOrderLinePayCapabilityContextClient
  & ProductOrderLinePayCapabilityRpcClient

function requireCapabilityClient(value: unknown): CapabilityClient {
  if (
    typeof value !== 'object'
    || value === null
    || !('from' in value)
    || typeof value.from !== 'function'
    || !('rpc' in value)
    || typeof value.rpc !== 'function'
  ) {
    throw new Error('line_pay_sandbox_e2e_capability_client_invalid')
  }
  return value as CapabilityClient
}

function hiddenResponse() {
  return NextResponse.json(
    { ok: false, error: 'not_found' },
    { status: 404, headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function executeLinePaySandboxE2eCallbackRoute(
  purpose: 'confirm' | 'cancel',
  request: Request,
) {
  if (!isLinePaySandboxE2eRouteEnabled(process.env)) return hiddenResponse()

  const client = requireCapabilityClient(getSupabaseAdmin())
  const response = await handleLinePaySandboxE2eCapabilityCallback({
    purpose,
    request,
    env: process.env,
    readContext: (merchantOrderNo) =>
      readProductOrderLinePayCapabilityContext(merchantOrderNo, client),
    database: createProductOrderLinePayCapabilityDatabase(client),
    confirmPayment: (input) =>
      confirmLinePayPayment({
        ...input,
        nonce: createLinePayNonce(),
        fetchFn: fetch,
        transportEnv: process.env,
      }),
  })

  return redirectLinePayHandlerResponseToCart({
    request,
    response,
    resolveStatus:
      purpose === 'confirm'
        ? resolveLinePayConfirmCartRedirectStatus
        : resolveLinePayCancelCartRedirectStatus,
  })
}
