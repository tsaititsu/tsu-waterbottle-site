import { NextResponse } from 'next/server'
import type { ProductOrderLinePayRecoverConfirmationInput } from '@/lib/supabase/linePayCapabilityRuntime'
import {
  isLinePaySandboxE2eRouteEnabled,
  linePaySandboxE2eMerchantOrderNoForCommit,
  type LinePaySandboxE2eStartEnvironment,
} from '../start/handler'

export const LINE_PAY_SANDBOX_PAID_RECOVERY_CONFIRMATION =
  'RECOVER_LINE_PAY_SANDBOX_PAID_TRANSACTION_ONCE'

type RecoveryContext = Readonly<{
  paymentId: string
  productOrderId: string
  attemptId: string
  environment: 'sandbox' | 'production'
  status: string
  requestState: string
  amountTwd: number
  currency: 'TWD'
  merchantOrderNo: string
  transactionId: string
}>

type RecoveryAssociations = Readonly<{
  capabilityId: string
  callbackEventId: string
}>

type ProviderVerification = Readonly<{
  paid: boolean
  evidenceSha256: string | null
}>

type RecoveryResult = Readonly<{
  resultCode: 'completed' | 'already_completed'
  transactionId: string
}>

type RecoveryBody = {
  confirmation?: unknown
  sourceCommitSha?: unknown
}

function hiddenResponse() {
  return NextResponse.json(
    { ok: false, error: 'not_found' },
    { status: 404, headers: { 'Cache-Control': 'no-store' } },
  )
}

function stableError(error: string, status = 502) {
  return NextResponse.json(
    { ok: false, error },
    { status, headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function handleLinePaySandboxPaidRecovery(input: {
  request: Request
  env: LinePaySandboxE2eStartEnvironment
  authorize: (request: Request) => Promise<boolean>
  readContext: (merchantOrderNo: string) => Promise<RecoveryContext | null>
  readAssociations: (context: RecoveryContext) => Promise<RecoveryAssociations>
  verifyProviderPaid: (context: RecoveryContext) => Promise<ProviderVerification>
  recover: (input: ProductOrderLinePayRecoverConfirmationInput) => Promise<RecoveryResult>
  createRequestId: () => string
}) {
  if (!isLinePaySandboxE2eRouteEnabled(input.env)) return hiddenResponse()

  const body = await input.request.json().catch(() => null) as RecoveryBody | null
  if (
    body?.confirmation !== LINE_PAY_SANDBOX_PAID_RECOVERY_CONFIRMATION
    || typeof body.sourceCommitSha !== 'string'
    || !/^[0-9a-f]{40}$/i.test(body.sourceCommitSha)
  ) {
    return stableError('invalid_recovery_request', 400)
  }

  let authorized = false
  try {
    authorized = await input.authorize(input.request)
  } catch {
    authorized = false
  }
  if (!authorized) return hiddenResponse()

  try {
    const merchantOrderNo = linePaySandboxE2eMerchantOrderNoForCommit(
      body.sourceCommitSha,
    )
    const context = await input.readContext(merchantOrderNo)
    if (
      !context
      || context.environment !== 'sandbox'
      || context.merchantOrderNo !== merchantOrderNo
      || context.amountTwd !== 50
      || context.currency !== 'TWD'
      || context.status !== 'pending'
      || context.requestState !== 'reconciliation_required'
    ) {
      return stableError('line_pay_sandbox_recovery_state_invalid', 409)
    }

    const provider = await input.verifyProviderPaid(context)
    if (!provider.paid || !/^[0-9a-f]{64}$/.test(provider.evidenceSha256 ?? '')) {
      return stableError('line_pay_sandbox_provider_paid_not_verified', 409)
    }

    const associations = await input.readAssociations(context)
    const result = await input.recover({
      environment: 'sandbox',
      paymentId: context.paymentId,
      productOrderId: context.productOrderId,
      attemptId: context.attemptId,
      merchantOrderNo: context.merchantOrderNo,
      transactionId: context.transactionId,
      amountTwd: context.amountTwd,
      currency: context.currency,
      capabilityId: associations.capabilityId,
      callbackEventId: associations.callbackEventId,
      confirmResultSha256: provider.evidenceSha256!,
      requestId: input.createRequestId(),
    })

    return NextResponse.json(
      {
        ok: true,
        providerPaid: true,
        localCompletion: result.resultCode,
        secondCharge: false,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return stableError('line_pay_sandbox_paid_recovery_failed')
  }
}
