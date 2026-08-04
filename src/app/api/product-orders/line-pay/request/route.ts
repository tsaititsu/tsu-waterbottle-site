import {
  createLinePayNonce,
  requestLinePayPayment,
} from '@/lib/linePay'
import { executeInitializedProductOrderLinePayRequest } from '@/lib/linePay/productOrderRequestExecution'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getUserIdFromRequest } from '@/lib/supabase/auth'
import {
  initializeProductOrderLinePayCheckout,
  type LinePayCheckoutInitializationRpcClient,
} from '@/lib/supabase/linePayCheckoutInitialization'
import {
  createLinePayRequestDatabase,
  type LinePayRequestRpcClient,
} from '@/lib/supabase/linePayDatabaseContracts'
import { handleProductOrderLinePayStart } from '../startHandler'

export const dynamic = 'force-dynamic'

type ProductOrderLinePayRpcClient =
  & LinePayCheckoutInitializationRpcClient
  & LinePayRequestRpcClient

function requireRpcClient(value: unknown): ProductOrderLinePayRpcClient {
  if (
    typeof value !== 'object'
    || value === null
    || !('rpc' in value)
    || typeof value.rpc !== 'function'
  ) {
    throw new Error('line_pay_product_order_rpc_client_invalid')
  }
  return value as ProductOrderLinePayRpcClient
}

export async function POST(request: Request) {
  return handleProductOrderLinePayStart({
    request,
    env: process.env,
    dependencies: {
      authorize: async (startRequest) => {
        const userId = await getUserIdFromRequest(startRequest)
        if (!userId) return null
        return { userId, client: requireRpcClient(getSupabaseAdmin()) }
      },
      initialize: ({ client, userId, environment, ...checkoutInput }) =>
        initializeProductOrderLinePayCheckout(
          checkoutInput,
          { authenticatedUserId: userId, environment },
          requireRpcClient(client),
        ),
      execute: async ({
        client,
        channelId,
        channelSecret,
        transportEnv,
        ...executionInput
      }) =>
        executeInitializedProductOrderLinePayRequest({
          ...executionInput,
          database: createLinePayRequestDatabase(requireRpcClient(client)),
          requestPayment: () =>
            requestLinePayPayment({
              environment: executionInput.environment,
              channelId,
              channelSecret,
              nonce: createLinePayNonce(),
              payloadInput: executionInput.payloadInput,
              fetchFn: fetch,
              transportEnv,
            }),
        }),
    },
  })
}
