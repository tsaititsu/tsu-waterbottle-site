import {
  confirmLinePayPayment,
  createLinePayNonce,
} from '@/lib/linePay'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createLinePayExecutorClient } from '@/lib/supabase/linePayExecutor'
import {
  createProductOrderLinePayCapabilityDatabase,
  readProductOrderLinePayCapabilityContext,
  type ProductOrderLinePayCapabilityContextClient,
  type ProductOrderLinePayCapabilityRpcClient,
} from '@/lib/supabase/linePayCapabilityRuntime'
import { handlePublicProductOrderLinePayCapabilityCallback } from './callbackHandler'
import {
  LINE_PAY_CAPABILITY_COOKIE_OPTIONS,
  linePayCapabilityCookieName,
} from './capabilityToken'
import {
  redirectLinePayHandlerResponseToCart,
  resolveLinePayCancelCartRedirectStatus,
  resolveLinePayConfirmCartRedirectStatus,
} from './redirect'

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
    throw new Error('line_pay_capability_client_invalid')
  }
  return value as CapabilityClient
}

function requireCapabilityRpcClient(
  value: unknown,
): ProductOrderLinePayCapabilityRpcClient {
  if (
    typeof value !== 'object'
    || value === null
    || !('rpc' in value)
    || typeof value.rpc !== 'function'
  ) {
    throw new Error('line_pay_executor_client_invalid')
  }
  return value as ProductOrderLinePayCapabilityRpcClient
}

export async function executePublicProductOrderLinePayCallbackRoute(
  purpose: 'confirm' | 'cancel',
  request: Request,
) {
  const client = requireCapabilityClient(getSupabaseAdmin())
  const executorClient = purpose === 'confirm'
    ? requireCapabilityRpcClient(createLinePayExecutorClient(process.env))
    : undefined
  const response = await handlePublicProductOrderLinePayCapabilityCallback({
    purpose,
    request,
    env: process.env,
    readContext: (merchantOrderNo) =>
      readProductOrderLinePayCapabilityContext(merchantOrderNo, client),
    database: createProductOrderLinePayCapabilityDatabase(
      client,
      executorClient,
    ),
    confirmPayment: (input) =>
      confirmLinePayPayment({
        ...input,
        nonce: createLinePayNonce(),
        fetchFn: fetch,
        transportEnv: process.env,
      }),
  })

  const redirect = await redirectLinePayHandlerResponseToCart({
    request,
    response,
    resolveStatus:
      purpose === 'confirm'
        ? resolveLinePayConfirmCartRedirectStatus
        : resolveLinePayCancelCartRedirectStatus,
  })
  for (const callbackPurpose of ['confirm', 'cancel'] as const) {
    redirect.cookies.set(
      linePayCapabilityCookieName(callbackPurpose),
      '',
      {
        ...LINE_PAY_CAPABILITY_COOKIE_OPTIONS,
        maxAge: 0,
      },
    )
  }
  return redirect
}
