import { requireAdminUser } from '@/lib/auth/admin'
import {
  createLinePayNonce,
  requestLinePayPayment,
} from '@/lib/linePay'
import { executeInitializedProductOrderLinePayRequest } from '@/lib/linePay/productOrderRequestExecution'
import {
  createLinePayRequestDatabase,
  type LinePayRequestRpcClient,
} from '@/lib/supabase/linePayDatabaseContracts'
import type { LinePayCheckoutInitializationRpcClient } from '@/lib/supabase/linePayCheckoutInitialization'
import { initializeLinePaySandboxE2eCheckout } from '@/lib/supabase/linePaySandboxE2eInitialization'
import { handleLinePaySandboxE2eStart } from './handler'

export const dynamic = 'force-dynamic'

type SandboxE2eRpcClient =
  & LinePayCheckoutInitializationRpcClient
  & LinePayRequestRpcClient

function requireRpcClient(value: unknown): SandboxE2eRpcClient {
  if (
    typeof value !== 'object'
    || value === null
    || !('rpc' in value)
    || typeof value.rpc !== 'function'
  ) {
    throw new Error('line_pay_sandbox_e2e_rpc_client_invalid')
  }
  return value as SandboxE2eRpcClient
}

export async function POST(request: Request) {
  return handleLinePaySandboxE2eStart({
    request,
    env: process.env,
    authorize: async (startRequest) => {
      const auth = await requireAdminUser(startRequest)
      if ('error' in auth) return null
      return { userId: auth.user.id, client: auth.supabase }
    },
    initialize: (input) =>
      initializeLinePaySandboxE2eCheckout({
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
