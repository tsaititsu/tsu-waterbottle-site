import { createHash, randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import {
  getLinePayServerConfig,
  type LinePayServerEnv,
} from '../../../../lib/linePay'
import type { ParsedLinePayConfirmResponse } from '../../../../lib/linePay/responseParser'

export type ProductOrderLinePayCapabilityPaymentContext = {
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
}

export type ProductOrderLinePayCapabilityDatabase = {
  claimCapability: (input: {
    tokenHash: string
    environment: 'sandbox' | 'production'
    purpose: 'confirm' | 'cancel'
    paymentId: string
    productOrderId: string
    attemptId: string
    claimId: string
    claimExpiresAt: string
  }) => Promise<{
    resultCode: 'claimed' | 'already_claimed' | 'already_consumed' | 'claim_busy'
    capabilityId: string
    callbackEventId: string
  }>
  claimConfirmation: (input: {
    environment: 'sandbox' | 'production'
    paymentId: string
    productOrderId: string
    attemptId: string
    capabilityId: string
    callbackEventId: string
    callbackClaimId: string
    transactionId: string
    requestId: string
  }) => Promise<{
    resultCode: 'claimed' | 'already_claimed' | 'already_paid'
  }>
  recordConfirmationEvidence: (input: {
    environment: 'sandbox' | 'production'
    callbackEventId: string
    callbackClaimId: string
    providerResultSha256: string
    safeResultCode: '0000'
    requestId: string
  }) => Promise<{ resultCode: 'recorded' | 'already_recorded' }>
  completeConfirmation: (input: {
    environment: 'sandbox' | 'production'
    paymentId: string
    productOrderId: string
    attemptId: string
    merchantOrderNo: string
    transactionId: string
    amountTwd: number
    currency: 'TWD'
    capabilityId: string
    callbackEventId: string
    callbackClaimId: string
    confirmResultSha256: string
    requestId: string
    auditEvidence: {
      result_code: 'verified'
      evidence_sha256: string
    }
  }) => Promise<{
    resultCode: 'completed' | 'already_completed'
    transactionId: string
  }>
  cancelPayment: (input: {
    environment: 'sandbox' | 'production'
    paymentId: string
    productOrderId: string
    attemptId: string
    capabilityId: string
    callbackEventId: string
    callbackClaimId: string
    requestId: string
    reasonCode: 'payment_canceled' | 'cancel_after_paid'
  }) => Promise<{
    resultCode: 'canceled' | 'already_canceled' | 'already_paid'
    requestState: string
  }>
  markReconciliation: (input: {
    environment: 'sandbox' | 'production'
    paymentId: string
    productOrderId: string
    attemptId: string
    reasonCode: string
    requestId: string
  }) => Promise<{ resultCode: 'marked' | 'already_marked'; requestState: string }>
}

type ConfirmPayment = (input: {
  environment: 'sandbox' | 'production'
  channelId: string
  channelSecret: string
  transactionId: string
  payloadInput: { amount: number; currency: 'TWD' }
}) => Promise<ParsedLinePayConfirmResponse>

export type LinePayCapabilityCallbackDiagnosticStage =
  | 'callback_order_id_invalid'
  | 'callback_capability_invalid'
  | 'callback_transaction_id_invalid'
  | 'callback_context_mismatch'
  | 'capability_claim_failed'

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function response(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

function safeParam(url: URL, name: string, maxLength: number) {
  const value = url.searchParams.get(name)?.trim() ?? ''
  if (!value || value.length > maxLength || /[\u0000-\u001f\u007f]/u.test(value)) {
    return null
  }
  return value
}

function reportDiagnosticStage(
  observer:
    | ((stage: LinePayCapabilityCallbackDiagnosticStage) => void)
    | undefined,
  stage: LinePayCapabilityCallbackDiagnosticStage,
) {
  try {
    observer?.(stage)
  } catch {
    // Preview diagnostics must never alter payment callback behavior.
  }
}

function successPayload(
  context: ProductOrderLinePayCapabilityPaymentContext,
) {
  return {
    ok: true,
    confirmed: true,
    markedPaid: true,
    paymentId: context.paymentId,
    productOrderId: context.productOrderId,
    transactionId: context.transactionId,
  }
}

async function bestEffortReconciliation(
  database: ProductOrderLinePayCapabilityDatabase,
  context: ProductOrderLinePayCapabilityPaymentContext,
  requestId: string,
  reasonCode: string,
) {
  try {
    await database.markReconciliation({
      environment: context.environment,
      paymentId: context.paymentId,
      productOrderId: context.productOrderId,
      attemptId: context.attemptId,
      reasonCode,
      requestId,
    })
    return true
  } catch {
    return false
  }
}

export async function handleProductOrderLinePayCapabilityCallback(input: {
  purpose: 'confirm' | 'cancel'
  request: Request
  env: LinePayServerEnv
  readContext: (
    merchantOrderNo: string,
  ) => Promise<ProductOrderLinePayCapabilityPaymentContext | null>
  database: ProductOrderLinePayCapabilityDatabase
  confirmPayment: ConfirmPayment
  now?: () => Date
  createUuid?: () => string
  onDiagnosticStage?: (stage: LinePayCapabilityCallbackDiagnosticStage) => void
}) {
  let config
  try {
    config = getLinePayServerConfig(input.env)
  } catch {
    return response({ ok: false, error: 'line_pay_config_invalid' }, 500)
  }
  if (!config.enabled) {
    return response({ ok: false, error: 'line_pay_disabled' }, 404)
  }

  const url = new URL(input.request.url)
  const merchantOrderNo = safeParam(url, 'orderId', 100)
  const capabilityToken = safeParam(url, 'capability', 512)
  const callbackTransactionId =
    input.purpose === 'confirm'
      ? safeParam(url, 'transactionId', 128)
      : null
  if (!merchantOrderNo) {
    reportDiagnosticStage(input.onDiagnosticStage, 'callback_order_id_invalid')
    return response({ ok: false, error: 'invalid_line_pay_callback' }, 400)
  }
  if (!capabilityToken) {
    reportDiagnosticStage(input.onDiagnosticStage, 'callback_capability_invalid')
    return response({ ok: false, error: 'invalid_line_pay_callback' }, 400)
  }
  if (input.purpose === 'confirm' && !callbackTransactionId) {
    reportDiagnosticStage(
      input.onDiagnosticStage,
      'callback_transaction_id_invalid',
    )
    return response({ ok: false, error: 'invalid_line_pay_callback' }, 400)
  }

  let context: ProductOrderLinePayCapabilityPaymentContext | null
  try {
    context = await input.readContext(merchantOrderNo)
  } catch {
    return response({ ok: false, error: 'line_pay_callback_lookup_failed' }, 500)
  }
  if (!context) {
    return response({ ok: false, error: 'line_pay_callback_not_found' }, 404)
  }
  if (
    context.environment !== config.environment
    || context.merchantOrderNo !== merchantOrderNo
    || context.currency !== 'TWD'
    || !Number.isInteger(context.amountTwd)
    || context.amountTwd <= 0
    || (input.purpose === 'confirm'
      && callbackTransactionId !== context.transactionId)
  ) {
    reportDiagnosticStage(input.onDiagnosticStage, 'callback_context_mismatch')
    return response({ ok: false, error: 'invalid_line_pay_callback' }, 400)
  }

  const now = input.now?.() ?? new Date()
  const createUuid = input.createUuid ?? randomUUID
  const claimId = createUuid()
  const requestId = `line-pay-callback:${createUuid()}`
  let capability: Awaited<
    ReturnType<ProductOrderLinePayCapabilityDatabase['claimCapability']>
  >
  try {
    capability = await input.database.claimCapability({
      tokenHash: sha256(capabilityToken),
      environment: context.environment,
      purpose: input.purpose,
      paymentId: context.paymentId,
      productOrderId: context.productOrderId,
      attemptId: context.attemptId,
      claimId,
      claimExpiresAt: new Date(now.getTime() + 2 * 60 * 1000).toISOString(),
    })
  } catch {
    reportDiagnosticStage(input.onDiagnosticStage, 'capability_claim_failed')
    return response({ ok: false, error: 'invalid_line_pay_callback' }, 400)
  }

  if (capability.resultCode === 'claim_busy') {
    return response({ ok: false, error: 'line_pay_callback_in_progress' }, 409)
  }
  if (capability.resultCode === 'already_consumed') {
    if (input.purpose === 'confirm' && context.status === 'paid') {
      return response(successPayload(context))
    }
    if (input.purpose === 'cancel' && context.requestState === 'canceled') {
      return response({
        ok: true,
        canceled: true,
        paymentId: context.paymentId,
        productOrderId: context.productOrderId,
      })
    }
    return response({ ok: false, error: 'line_pay_callback_consumed' }, 409)
  }

  if (input.purpose === 'cancel') {
    try {
      const canceled = await input.database.cancelPayment({
        environment: context.environment,
        paymentId: context.paymentId,
        productOrderId: context.productOrderId,
        attemptId: context.attemptId,
        capabilityId: capability.capabilityId,
        callbackEventId: capability.callbackEventId,
        callbackClaimId: claimId,
        requestId,
        reasonCode:
          context.status === 'paid' ? 'cancel_after_paid' : 'payment_canceled',
      })
      return response({
        ok: canceled.resultCode !== 'already_paid',
        canceled: canceled.resultCode !== 'already_paid',
        paymentId: context.paymentId,
        productOrderId: context.productOrderId,
      })
    } catch {
      return response({ ok: false, error: 'line_pay_cancel_failed' }, 500)
    }
  }

  try {
    const claimed = await input.database.claimConfirmation({
      environment: context.environment,
      paymentId: context.paymentId,
      productOrderId: context.productOrderId,
      attemptId: context.attemptId,
      capabilityId: capability.capabilityId,
      callbackEventId: capability.callbackEventId,
      callbackClaimId: claimId,
      transactionId: context.transactionId,
      requestId,
    })
    if (claimed.resultCode === 'already_paid') {
      return response(successPayload(context))
    }
  } catch {
    return response({ ok: false, error: 'line_pay_confirmation_claim_failed' }, 409)
  }

  let providerResult: ParsedLinePayConfirmResponse
  try {
    providerResult = await input.confirmPayment({
      environment: context.environment,
      channelId: config.channelId,
      channelSecret: config.channelSecret,
      transactionId: context.transactionId,
      payloadInput: { amount: context.amountTwd, currency: 'TWD' },
    })
  } catch {
    await bestEffortReconciliation(
      input.database,
      context,
      requestId,
      'confirmation_upstream_result_unknown',
    )
    return response(
      { ok: false, error: 'line_pay_confirmation_reconciliation_required' },
      502,
    )
  }

  if (
    providerResult.returnCode !== '0000'
    || (providerResult.transactionId !== null
      && providerResult.transactionId !== context.transactionId)
    || (providerResult.orderId !== null
      && providerResult.orderId !== context.merchantOrderNo)
  ) {
    await bestEffortReconciliation(
      input.database,
      context,
      requestId,
      'confirmation_provider_contract_mismatch',
    )
    return response(
      { ok: false, error: 'line_pay_confirmation_reconciliation_required' },
      502,
    )
  }

  const confirmResultSha256 = sha256(
    JSON.stringify({
      returnCode: providerResult.returnCode,
      returnMessage: providerResult.returnMessage,
      transactionId: providerResult.transactionId,
      orderId: providerResult.orderId,
    }),
  )
  try {
    await input.database.recordConfirmationEvidence({
      environment: context.environment,
      callbackEventId: capability.callbackEventId,
      callbackClaimId: claimId,
      providerResultSha256: confirmResultSha256,
      safeResultCode: '0000',
      requestId,
    })
    const completed = await input.database.completeConfirmation({
      environment: context.environment,
      paymentId: context.paymentId,
      productOrderId: context.productOrderId,
      attemptId: context.attemptId,
      merchantOrderNo: context.merchantOrderNo,
      transactionId: context.transactionId,
      amountTwd: context.amountTwd,
      currency: 'TWD',
      capabilityId: capability.capabilityId,
      callbackEventId: capability.callbackEventId,
      callbackClaimId: claimId,
      confirmResultSha256,
      requestId,
      auditEvidence: {
        result_code: 'verified',
        evidence_sha256: confirmResultSha256,
      },
    })
    if (completed.transactionId !== context.transactionId) {
      throw new Error('line_pay_confirmation_transaction_mismatch')
    }
  } catch {
    await bestEffortReconciliation(
      input.database,
      context,
      requestId,
      'confirmation_completion_failed',
    )
    return response(
      { ok: false, error: 'line_pay_confirmation_reconciliation_required' },
      502,
    )
  }

  return response(successPayload(context))
}
