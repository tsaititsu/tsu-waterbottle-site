import {
  canBuyCourse,
  getCourseById,
  isCourseId,
  isCourseSalesOpen,
  type CourseId,
} from '@/lib/courses'
import { isAdminEmail } from '@/lib/auth/admin'
import { ziweiCards } from '@/lib/divination/cards'
import {
  createLinePayNonce,
  requestLinePayPayment,
} from '@/lib/linePay'
import { executeInitializedProductOrderLinePayRequest } from '@/lib/linePay/productOrderRequestExecution'
import { getLinePayServiceReturnPath } from '@/lib/linePay/serviceCheckout'
import { AI_CHART_REPORT_AMOUNT_TWD } from '@/lib/newebpay/aiChartPayment'
import { AI_DIVINATION_AMOUNT_TWD } from '@/lib/newebpay/divinationPayment'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  getAiChartReportForUser,
  getAiChartReportPaymentContext,
  linkAiChartReportPendingPayment,
} from '@/lib/supabase/aiChartReports'
import { getUserWithEmailFromRequest } from '@/lib/supabase/auth'
import {
  getDivinationReadingPaymentContext,
  linkDivinationReadingPendingPayment,
  updateDivinationReadingDrawSelection,
  validateDivinationReadingPayment,
} from '@/lib/supabase/divinationReadings'
import type { LinePayCheckoutInitializationRpcClient } from '@/lib/supabase/linePayCheckoutInitialization'
import {
  createLinePayRequestDatabase,
  type LinePayRequestRpcClient,
} from '@/lib/supabase/linePayDatabaseContracts'
import { initializeServiceLinePayCheckout } from '@/lib/supabase/linePayServiceCheckoutInitialization'
import { handleServiceLinePayStart } from './handler'

export const dynamic = 'force-dynamic'

type ServiceLinePayRpcClient =
  & LinePayCheckoutInitializationRpcClient
  & LinePayRequestRpcClient

function requireRpcClient(value: unknown): ServiceLinePayRpcClient {
  if (
    typeof value !== 'object'
    || value === null
    || !('rpc' in value)
    || typeof value.rpc !== 'function'
  ) {
    throw new Error('line_pay_service_rpc_client_invalid')
  }
  return value as ServiceLinePayRpcClient
}

async function getPurchasedCourseIds(userId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('course_purchases')
    .select('course_id')
    .eq('user_id', userId)
    .eq('status', 'paid')
  if (error) throw new Error('course_purchase_lookup_failed')
  return (data ?? [])
    .map((row) => (row as { course_id?: unknown }).course_id)
    .filter(isCourseId) as CourseId[]
}

export async function POST(request: Request) {
  return handleServiceLinePayStart({
    request,
    env: process.env,
    dependencies: {
      authorize: async (startRequest) => {
        const user = await getUserWithEmailFromRequest(startRequest)
        if (!user) return null
        return {
          userId: user.id,
          client: requireRpcClient(getSupabaseAdmin()),
          isAdmin: isAdminEmail(user.email, process.env.ADMIN_EMAILS),
        }
      },
      resolveTarget: async ({ userId, source, sourceId, cardId, position }) => {
        if (source === 'ai_chart_report') {
          const ownedReport = await getAiChartReportForUser(sourceId, userId)
          const report = ownedReport
            ? await getAiChartReportPaymentContext(sourceId)
            : null
          if (
            !report
            || report.paymentStatus !== 'pending'
            || report.paymentId
            || report.merchantOrderNo
            || report.amountTwd !== AI_CHART_REPORT_AMOUNT_TWD
          ) {
            return null
          }
          return {
            source,
            sourceId,
            itemType: source,
            itemName: ownedReport?.productName || 'AI 命盤分析',
            amountTwd: AI_CHART_REPORT_AMOUNT_TWD,
            bookingId: null,
            returnPath: getLinePayServiceReturnPath(source, sourceId),
          }
        }

        if (source === 'ai_divination') {
          const reading = await getDivinationReadingPaymentContext(sourceId)
          const validation = validateDivinationReadingPayment(reading)
          if (!validation.ok || !reading || reading.userId !== userId) return null

          const resolvedCardId = cardId || reading.cardId
          const resolvedPosition = position || reading.position
          const card = ziweiCards.find((candidate) => candidate.id === resolvedCardId)
          if (!card || (resolvedPosition !== 'upright' && resolvedPosition !== 'reversed')) {
            return null
          }
          const update = await updateDivinationReadingDrawSelection({
            readingId: sourceId,
            cardId: card.id,
            cardName: card.name,
            position: resolvedPosition,
          })
          if (update.result !== 'updated') return null

          return {
            source,
            sourceId,
            itemType: source,
            itemName: '紫微牌卡占卜單次',
            amountTwd: AI_DIVINATION_AMOUNT_TWD,
            bookingId: null,
            returnPath: getLinePayServiceReturnPath(source, sourceId),
          }
        }

        if (source === 'booking') {
          const { data, error } = await getSupabaseAdmin()
            .from('bookings')
            .select('id,user_id,plan_name,amount_twd,status,payment_status')
            .eq('id', sourceId)
            .eq('user_id', userId)
            .maybeSingle()
          if (error) throw new Error('booking_lookup_failed')
          const booking = data as {
            id: string
            user_id: string
            plan_name: string
            amount_twd: number
            status: string
            payment_status: string
          } | null
          if (
            !booking
            || booking.status !== 'pending_payment'
            || booking.payment_status !== 'pending'
            || !Number.isSafeInteger(booking.amount_twd)
            || booking.amount_twd <= 0
          ) {
            return null
          }
          return {
            source,
            sourceId,
            itemType: source,
            itemName: booking.plan_name || '水瓶先生論命',
            amountTwd: booking.amount_twd,
            bookingId: booking.id,
            returnPath: getLinePayServiceReturnPath(source, sourceId),
          }
        }

        if (!isCourseSalesOpen() || !isCourseId(sourceId)) return null
        const course = getCourseById(sourceId)
        if (!course) return null
        const purchased = await getPurchasedCourseIds(userId)
        if (purchased.includes(course.id) || !canBuyCourse(course.id, purchased)) {
          return null
        }
        return {
          source,
          sourceId,
          itemType: source,
          itemName: `${course.title}｜${course.subtitle}`,
          amountTwd: course.price,
          bookingId: null,
          returnPath: getLinePayServiceReturnPath(source, sourceId),
        }
      },
      initialize: ({ client, userId, environment, ...checkoutInput }) =>
        initializeServiceLinePayCheckout(
          checkoutInput,
          { authenticatedUserId: userId, environment },
          requireRpcClient(client),
        ),
      linkTarget: async ({ target, paymentId, merchantOrderNo }) => {
        if (target.source === 'ai_chart_report') {
          const result = await linkAiChartReportPendingPayment({
            reportId: target.sourceId,
            paymentId,
            merchantOrderNo,
          })
          if (result.result === 'linked' || result.result === 'already_linked') {
            return result.result
          }
          throw new Error('line_pay_chart_link_failed')
        }
        if (target.source === 'ai_divination') {
          const result = await linkDivinationReadingPendingPayment({
            readingId: target.sourceId,
            paymentId,
            merchantOrderNo,
          })
          if (result.result === 'linked' || result.result === 'already_linked') {
            return result.result
          }
          throw new Error('line_pay_divination_link_failed')
        }
        return 'not_required'
      },
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
