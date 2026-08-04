import { requireAdminUser } from '@/lib/auth/admin'
import {
  createLinePayNonce,
  requestLinePayPayment,
} from '@/lib/linePay'
import { executeInitializedProductOrderLinePayRequest } from '@/lib/linePay/productOrderRequestExecution'
import type { LinePayCheckoutInitializationRpcClient } from '@/lib/supabase/linePayCheckoutInitialization'
import {
  createLinePayRequestDatabase,
  type LinePayRequestRpcClient,
} from '@/lib/supabase/linePayDatabaseContracts'
import { initializeLinePayOneDollarTestCheckout } from '@/lib/supabase/linePaySandboxE2eInitialization'
import { handleLinePayProductionOneDollarStart } from './handler'

export const dynamic = 'force-dynamic'

type ProductionOneDollarRpcClient =
  & LinePayCheckoutInitializationRpcClient
  & LinePayRequestRpcClient

function requireRpcClient(value: unknown): ProductionOneDollarRpcClient {
  if (
    typeof value !== 'object'
    || value === null
    || !('rpc' in value)
    || typeof value.rpc !== 'function'
  ) {
    throw new Error('line_pay_production_one_dollar_rpc_client_invalid')
  }
  return value as ProductionOneDollarRpcClient
}

export async function POST(request: Request) {
  return handleLinePayProductionOneDollarStart({
    request,
    env: process.env,
    authorize: async (startRequest) => {
      const auth = await requireAdminUser(startRequest)
      if ('error' in auth) return null
      return { userId: auth.user.id, client: auth.supabase }
    },
    initialize: (input) =>
      initializeLinePayOneDollarTestCheckout({
        ...input,
        client: requireRpcClient(input.client),
      }),
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
  })
}
