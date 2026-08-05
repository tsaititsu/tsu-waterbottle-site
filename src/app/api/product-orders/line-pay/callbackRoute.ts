import { after } from 'next/server'
import {
  confirmLinePayPayment,
  createLinePayNonce,
} from '@/lib/linePay'
import { completePaidAiChartReport } from '@/lib/ai-chart/reportCompletion'
import { startPaidAiChartReportCompletionInBackground } from '@/lib/ai-chart/reportCompletionBackground'
import { isSafeLinePayReturnPath } from '@/lib/linePay/serviceCheckout'
import {
  syncNewebPayAiChartAfterPayment,
  syncNewebPayBookingAfterPayment,
  syncNewebPayCourseAfterPayment,
  syncNewebPayDivinationAfterPayment,
  syncNewebPayProductOrderAfterPayment,
} from '@/lib/newebpay/notify'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { markBookingPaidById } from '@/lib/supabase/bookingPayments'
import { markCoursePaidByPayment } from '@/lib/supabase/coursePurchases'
import {
  getPaymentById,
  mapPaymentPaidContext,
  type PaymentRecord,
} from '@/lib/supabase/payments'
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
  redirectLinePayHandlerResponse,
  resolveLinePayCancelCartRedirectStatus,
  resolveLinePayConfirmCartRedirectStatus,
} from './redirect'

function getLinePayReturnPath(payment: PaymentRecord | null) {
  const linePay = payment?.rawPayload?.linePay
  if (typeof linePay !== 'object' || linePay === null || Array.isArray(linePay)) {
    return '/cart'
  }
  const returnPath = (linePay as Record<string, unknown>).returnPath
  return isSafeLinePayReturnPath(returnPath) ? returnPath : '/cart'
}

async function syncPaidLinePayTarget(payment: PaymentRecord) {
  const context = mapPaymentPaidContext(payment)
  const merchantOrderNo = payment.merchantOrderNo ?? ''
  await Promise.all([
    syncNewebPayBookingAfterPayment({
      payment: context,
      markBookingPaid: markBookingPaidById,
    }),
    syncNewebPayCourseAfterPayment({
      payment: context,
      markCoursePaid: markCoursePaidByPayment,
    }),
    syncNewebPayDivinationAfterPayment({
      payment: context,
      merchantOrderNo,
    }),
    syncNewebPayAiChartAfterPayment({
      payment: context,
      merchantOrderNo,
      startPaidAiChartReportCompletionInBackground: ({ reportId }) =>
        startPaidAiChartReportCompletionInBackground(
          { reportId },
          {
            completePaidAiChartReport,
            schedule: (task) => after(task),
          },
        ),
    }),
    syncNewebPayProductOrderAfterPayment({ payment: context }),
  ])
}

async function readResponsePayment(response: Response) {
  const payload = await response.clone().json().catch(() => null) as {
    ok?: unknown
    paymentId?: unknown
  } | null
  if (payload?.ok !== true || typeof payload.paymentId !== 'string') return null
  return getPaymentById(payload.paymentId).catch(() => null)
}

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

  const payment = await readResponsePayment(response)
  if (purpose === 'confirm' && payment?.status === 'paid') {
    try {
      await syncPaidLinePayTarget(payment)
    } catch {
      console.warn('LINE Pay paid target sync failed')
    }
  }

  const redirect = await redirectLinePayHandlerResponse({
    request,
    response,
    returnPath: getLinePayReturnPath(payment),
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
