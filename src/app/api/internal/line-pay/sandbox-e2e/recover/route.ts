import { createHash, randomUUID } from 'node:crypto'
import { requireAdminUser } from '@/lib/auth/admin'
import {
  createLinePayNonce,
  getLinePayPaymentDetails,
  getLinePayServerConfig,
  resolveLinePayConfirmOutcome,
} from '@/lib/linePay'
import { createLinePayExecutorClient } from '@/lib/supabase/linePayExecutor'
import {
  createProductOrderLinePayCapabilityDatabase,
  readProductOrderLinePayCapabilityContext,
  readProductOrderLinePayRecoveryAssociations,
  type ProductOrderLinePayCapabilityContextClient,
  type ProductOrderLinePayCapabilityRpcClient,
} from '@/lib/supabase/linePayCapabilityRuntime'
import { handleLinePaySandboxPaidRecovery } from './handler'

export const dynamic = 'force-dynamic'

type RecoveryClient = ProductOrderLinePayCapabilityContextClient
  & ProductOrderLinePayCapabilityRpcClient

function requireRecoveryClient(value: unknown): RecoveryClient {
  if (
    typeof value !== 'object'
    || value === null
    || !('from' in value)
    || typeof value.from !== 'function'
    || !('rpc' in value)
    || typeof value.rpc !== 'function'
  ) {
    throw new Error('line_pay_sandbox_recovery_client_invalid')
  }
  return value as RecoveryClient
}

export async function POST(request: Request) {
  let client: RecoveryClient | null = null
  let executorDatabase: ReturnType<typeof createProductOrderLinePayCapabilityDatabase> | null = null

  return handleLinePaySandboxPaidRecovery({
    request,
    env: process.env,
    authorize: async (recoveryRequest) => {
      const auth = await requireAdminUser(recoveryRequest)
      if ('error' in auth) return false
      client = requireRecoveryClient(auth.supabase)
      executorDatabase = createProductOrderLinePayCapabilityDatabase(
        client,
        createLinePayExecutorClient(process.env),
      )
      return true
    },
    readContext: async (merchantOrderNo) => {
      if (!client) throw new Error('line_pay_sandbox_recovery_not_authorized')
      return readProductOrderLinePayCapabilityContext(merchantOrderNo, client)
    },
    readAssociations: async (context) => {
      if (!client) throw new Error('line_pay_sandbox_recovery_not_authorized')
      return readProductOrderLinePayRecoveryAssociations({
        environment: 'sandbox',
        paymentId: context.paymentId,
        productOrderId: context.productOrderId,
        attemptId: context.attemptId,
      }, client)
    },
    verifyProviderPaid: async (context) => {
      const config = getLinePayServerConfig(process.env)
      if (!config.enabled || config.environment !== 'sandbox') {
        return Object.freeze({ paid: false, evidenceSha256: null })
      }
      const details = await getLinePayPaymentDetails({
        environment: 'sandbox',
        channelId: config.channelId,
        channelSecret: config.channelSecret,
        nonce: createLinePayNonce(),
        transactionId: context.transactionId,
        orderId: context.merchantOrderNo,
        fetchFn: fetch,
        transportEnv: process.env,
      })
      const outcome = resolveLinePayConfirmOutcome({
        paymentDetailsResult: details,
        expected: {
          transactionId: context.transactionId,
          orderId: context.merchantOrderNo,
          amount: context.amountTwd,
          currency: context.currency,
        },
      })
      if (
        outcome.outcome !== 'payment_completed'
        || !outcome.shouldMarkPaid
        || outcome.safeToRetryConfirm
      ) {
        return Object.freeze({ paid: false, evidenceSha256: null })
      }
      return Object.freeze({
        paid: true,
        evidenceSha256: createHash('sha256')
          .update(JSON.stringify(details))
          .digest('hex'),
      })
    },
    recover: async (recoveryInput) => {
      if (!executorDatabase) {
        throw new Error('line_pay_sandbox_recovery_not_authorized')
      }
      return executorDatabase.recoverConfirmation(recoveryInput)
    },
    createRequestId: () => `line-pay-paid-recovery:${randomUUID()}`,
  })
}
