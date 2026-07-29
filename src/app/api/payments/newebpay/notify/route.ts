import { after, NextResponse } from 'next/server'
import { completePaidAiChartReport } from '@/lib/ai-chart/reportCompletion'
import {
  startPaidAiChartReportCompletionInBackground,
} from '@/lib/ai-chart/reportCompletionBackground'
import { getNewebPayConfig } from '@/lib/newebpay/config'
import { verifyTradeSha } from '@/lib/newebpay/crypto'
import {
  isNewebPayTradeInfoDecryptError,
  parseNewebPayNotifyPayload,
  persistNewebPayNotifyQueryFallback,
  persistNewebPayNotifyPaymentResult,
  syncNewebPayAiChartAfterPayment,
  syncNewebPayBookingAfterPayment,
  syncNewebPayCourseAfterPayment,
  syncNewebPayDivinationAfterPayment,
  syncNewebPayProductOrderAfterPayment,
} from '@/lib/newebpay/notify'
import { queryNewebPayTrade } from '@/lib/newebpay/query'
import { markBookingPaidById } from '@/lib/supabase/bookingPayments'
import { markCoursePaidByPayment } from '@/lib/supabase/coursePurchases'
import { getPaymentByMerchantOrderNo, markPaymentPaidByMerchantOrderNo } from '@/lib/supabase/payments'

export const runtime = 'nodejs'

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function notifyError(_input: {
  error: unknown
  status: string
  merchantId: string
  tradeInfo: string
  tradeSha: string
  formKeys: string[]
}) {
  void _input
  console.warn('NewebPay notify rejected')

  return NextResponse.json({ ok: false, error: 'invalid_notify' })
}

function notifyPaymentUpdateError(_error: unknown, _result: {
  merchantOrderNo: string
  status: string
  tradeNo?: string
  amount?: number
  paymentType?: string
  paymentMethod?: string
}) {
  void _error
  void _result
  console.warn('NewebPay notify payment update failed')

  return NextResponse.json({ ok: false, error: 'payment_update_failed' })
}

async function syncBookingAfterPayment(input: {
  merchantOrderNo: string
  paymentResult: string
  payment: Parameters<typeof syncNewebPayBookingAfterPayment>[0]['payment']
}) {
  const bookingSync = await syncNewebPayBookingAfterPayment({
    payment: input.payment,
    markBookingPaid: markBookingPaidById,
  })

  if (bookingSync.bookingSync === 'skipped_no_booking') {
    console.info('NewebPay booking sync skipped')
    return bookingSync.bookingSync
  }

  if (bookingSync.bookingSync === 'failed') {
    console.warn('NewebPay booking sync failed')
    return bookingSync.bookingSync
  }

  console.info('NewebPay booking sync completed')
  return bookingSync.bookingSync
}

async function syncCourseAfterPayment(input: {
  merchantOrderNo: string
  paymentResult: string
  payment: Parameters<typeof syncNewebPayCourseAfterPayment>[0]['payment']
}) {
  const courseSync = await syncNewebPayCourseAfterPayment({
    payment: input.payment,
    markCoursePaid: markCoursePaidByPayment,
  })

  if (courseSync.courseSync === 'skipped_not_course') {
    return courseSync.courseSync
  }

  if (courseSync.courseSync === 'skipped_missing_course_context') {
    console.info('NewebPay course sync skipped')
    return courseSync.courseSync
  }

  if (courseSync.courseSync === 'failed') {
    console.warn('NewebPay course sync failed')
    return courseSync.courseSync
  }

  console.info('NewebPay course sync completed')
  return courseSync.courseSync
}

async function syncDivinationAfterPayment(input: {
  merchantOrderNo: string
  paymentResult: string
  payment: Parameters<typeof syncNewebPayDivinationAfterPayment>[0]['payment']
}) {
  const divinationSync = await syncNewebPayDivinationAfterPayment({
    payment: input.payment,
    merchantOrderNo: input.merchantOrderNo,
  })

  if (divinationSync.divinationSync === 'skipped_not_divination') {
    return divinationSync.divinationSync
  }

  if (divinationSync.divinationSync === 'skipped_missing_divination_context') {
    console.info('NewebPay divination sync skipped')
    return divinationSync.divinationSync
  }

  if (divinationSync.divinationSync === 'failed') {
    console.warn('NewebPay divination sync failed')
    return divinationSync.divinationSync
  }

  console.info('NewebPay divination sync completed')
  return divinationSync.divinationSync
}

async function syncAiChartAfterPayment(input: {
  merchantOrderNo: string
  paymentResult: string
  payment: Parameters<typeof syncNewebPayAiChartAfterPayment>[0]['payment']
}) {
  const aiChartSync = await syncNewebPayAiChartAfterPayment({
    payment: input.payment,
    merchantOrderNo: input.merchantOrderNo,
    startPaidAiChartReportCompletionInBackground: ({ reportId }) =>
      startPaidAiChartReportCompletionInBackground(
        { reportId },
        {
          completePaidAiChartReport,
          schedule: (task) => after(task),
        },
      ),
  })

  if (aiChartSync.aiChartSync === 'skipped_not_ai_chart') {
    return aiChartSync.aiChartSync
  }

  if (aiChartSync.aiChartSync === 'skipped_missing_ai_chart_context') {
    console.info('NewebPay AI chart sync skipped')
    return aiChartSync.aiChartSync
  }

  if (aiChartSync.aiChartSync === 'failed') {
    console.warn('NewebPay AI chart sync failed')
    return aiChartSync.aiChartSync
  }

  if (aiChartSync.aiChartSync === 'invalid_state') {
    console.warn('NewebPay AI chart sync invalid state')
    return aiChartSync.aiChartSync
  }

  console.info('NewebPay AI chart sync completed')
  return aiChartSync.aiChartSync
}

async function syncProductOrderAfterPayment(input: {
  merchantOrderNo: string
  paymentResult: string
  payment: Parameters<typeof syncNewebPayProductOrderAfterPayment>[0]['payment']
}) {
  const productOrderSync = await syncNewebPayProductOrderAfterPayment({
    payment: input.payment,
  })

  if (productOrderSync.productOrderSync === 'skipped_not_product_order') {
    return productOrderSync.productOrderSync
  }

  if (productOrderSync.productOrderSync === 'skipped_missing_product_order_context') {
    console.info('NewebPay product order sync skipped')
    return productOrderSync.productOrderSync
  }

  if (productOrderSync.productOrderSync === 'failed') {
    console.warn('NewebPay product order sync failed')
    return productOrderSync.productOrderSync
  }

  if (
    productOrderSync.productOrderSync === 'payment_mismatch' ||
    productOrderSync.productOrderSync === 'invalid_state'
  ) {
    console.warn('NewebPay product order sync needs review')
    return productOrderSync.productOrderSync
  }

  console.info('NewebPay product order sync completed')
  return productOrderSync.productOrderSync
}

function getNotifyQueryMerchantOrderNo(request: Request) {
  const value = new URL(request.url).searchParams.get('merchantOrderNo')?.trim()
  return value || null
}

function canUseQueryFallback(input: {
  error: unknown
  merchantOrderNo: string | null
  merchantId: string
  tradeInfo: string
  tradeSha: string
  expectedMerchantId: string
  hashKey: string
  hashIv: string
}) {
  return Boolean(
    input.merchantOrderNo &&
      isNewebPayTradeInfoDecryptError(input.error) &&
      input.merchantId === input.expectedMerchantId &&
      verifyTradeSha(input.tradeInfo, input.tradeSha, input.hashKey, input.hashIv),
  )
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const formKeys = Array.from(formData.keys())
  const queryMerchantOrderNo = getNotifyQueryMerchantOrderNo(request)
  const status = getFormString(formData, 'Status')
  const merchantId = getFormString(formData, 'MerchantID')
  const version = getFormString(formData, 'Version')
  const tradeInfo = getFormString(formData, 'TradeInfo')
  const tradeSha = getFormString(formData, 'TradeSha')
  let config: ReturnType<typeof getNewebPayConfig> | null = null

  try {
    if (!status || !merchantId || !tradeInfo || !tradeSha) {
      throw new Error('Missing required notify fields')
    }

    config = getNewebPayConfig()
    const result = parseNewebPayNotifyPayload({
      status,
      merchantId,
      version,
      tradeInfo,
      tradeSha,
      expectedMerchantId: config.merchantId,
      hashKey: config.hashKey,
      hashIv: config.hashIv,
    })

    console.info('NewebPay notify received')

    try {
      const paymentPersistence = await persistNewebPayNotifyPaymentResult(
        result,
        getPaymentByMerchantOrderNo,
        markPaymentPaidByMerchantOrderNo,
      )

      if ('ignored' in paymentPersistence) {
        console.info('NewebPay notify ignored for non-success status')

        return NextResponse.json({ ok: true, ignored: true })
      }

      if (!paymentPersistence.ok) {
        console.warn('NewebPay notify payment validation failed')

        return NextResponse.json({ ok: false, error: paymentPersistence.error })
      }

      console.info('NewebPay notify payment marked paid')

      const bookingSync = await syncBookingAfterPayment({
        merchantOrderNo: result.merchantOrderNo,
        paymentResult: paymentPersistence.result,
        payment: paymentPersistence.payment,
      })
      const courseSync = await syncCourseAfterPayment({
        merchantOrderNo: result.merchantOrderNo,
        paymentResult: paymentPersistence.result,
        payment: paymentPersistence.payment,
      })
      const divinationSync = await syncDivinationAfterPayment({
        merchantOrderNo: result.merchantOrderNo,
        paymentResult: paymentPersistence.result,
        payment: paymentPersistence.payment,
      })
      const aiChartSync = await syncAiChartAfterPayment({
        merchantOrderNo: result.merchantOrderNo,
        paymentResult: paymentPersistence.result,
        payment: paymentPersistence.payment,
      })
      const productOrderSync = await syncProductOrderAfterPayment({
        merchantOrderNo: result.merchantOrderNo,
        paymentResult: paymentPersistence.result,
        payment: paymentPersistence.payment,
      })

      return NextResponse.json({
        ok: true,
        paymentStatus: 'paid',
        result: paymentPersistence.result,
        bookingSync,
        courseSync,
        divinationSync,
        aiChartSync,
        productOrderSync,
      })
    } catch (error) {
      return notifyPaymentUpdateError(error, result)
    }
  } catch (error) {
    if (
      config &&
      canUseQueryFallback({
        error,
        merchantOrderNo: queryMerchantOrderNo,
        merchantId,
        tradeInfo,
        tradeSha,
        expectedMerchantId: config.merchantId,
        hashKey: config.hashKey,
        hashIv: config.hashIv,
      })
    ) {
      console.warn('NewebPay notify decrypt failed; using query fallback')

      try {
        const fallbackResult = await persistNewebPayNotifyQueryFallback({
          merchantOrderNo: queryMerchantOrderNo as string,
          config,
          getPaymentByMerchantOrderNo,
          queryNewebPayTrade,
          markPaymentPaid: markPaymentPaidByMerchantOrderNo,
        })

        if ('ignored' in fallbackResult) {
          console.info('NewebPay notify query fallback ignored')

          return NextResponse.json({ ok: true, ignored: true, reason: fallbackResult.reason })
        }

        if (!fallbackResult.ok) {
          console.warn('NewebPay notify query fallback payment not found')

          return NextResponse.json({ ok: false, error: 'payment_not_found' })
        }

        console.info('NewebPay notify query fallback marked paid')

        const bookingSync = await syncBookingAfterPayment({
          merchantOrderNo: queryMerchantOrderNo as string,
          paymentResult: fallbackResult.result,
          payment: fallbackResult.payment,
        })
        const courseSync = await syncCourseAfterPayment({
          merchantOrderNo: queryMerchantOrderNo as string,
          paymentResult: fallbackResult.result,
          payment: fallbackResult.payment,
        })
        const divinationSync = await syncDivinationAfterPayment({
          merchantOrderNo: fallbackResult.query.merchantOrderNo,
          paymentResult: fallbackResult.result,
          payment: fallbackResult.payment,
        })
        const aiChartSync = await syncAiChartAfterPayment({
          merchantOrderNo: fallbackResult.query.merchantOrderNo,
          paymentResult: fallbackResult.result,
          payment: fallbackResult.payment,
        })
        const productOrderSync = await syncProductOrderAfterPayment({
          merchantOrderNo: fallbackResult.query.merchantOrderNo,
          paymentResult: fallbackResult.result,
          payment: fallbackResult.payment,
        })

        return NextResponse.json({
          ok: true,
          paymentStatus: 'paid',
          result: fallbackResult.result,
          bookingSync,
          courseSync,
          divinationSync,
          aiChartSync,
          productOrderSync,
        })
      } catch {
        console.warn('NewebPay notify query fallback failed')

        return NextResponse.json({ ok: false, error: 'query_fallback_failed' })
      }
    }

    return notifyError({
      error,
      status,
      merchantId,
      tradeInfo,
      tradeSha,
      formKeys,
    })
  }
}
