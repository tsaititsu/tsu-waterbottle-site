import { NextResponse } from 'next/server'
import { getNewebPayConfig } from '@/lib/newebpay/config'
import { verifyTradeSha } from '@/lib/newebpay/crypto'
import {
  buildNewebPayNotifyErrorMetadata,
  isNewebPayTradeInfoDecryptError,
  parseNewebPayNotifyPayload,
  persistNewebPayNotifyQueryFallback,
  persistNewebPayNotifyPaymentResult,
  syncNewebPayBookingAfterPayment,
  syncNewebPayCourseAfterPayment,
  syncNewebPayDivinationAfterPayment,
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

function notifyError(input: {
  error: unknown
  status: string
  merchantId: string
  tradeInfo: string
  tradeSha: string
  formKeys: string[]
}) {
  console.warn('NewebPay notify rejected', buildNewebPayNotifyErrorMetadata(input))

  return NextResponse.json({ ok: false, error: 'invalid_notify' })
}

function notifyPaymentUpdateError(error: unknown, result: {
  merchantOrderNo: string
  status: string
  tradeNo?: string
  amount?: number
  paymentType?: string
  paymentMethod?: string
}) {
  console.warn('NewebPay notify payment update failed', {
    merchantOrderNo: result.merchantOrderNo,
    status: result.status,
    tradeNo: result.tradeNo,
    amount: result.amount,
    paymentType: result.paymentType,
    paymentMethod: result.paymentMethod,
    error: error instanceof Error ? error.message : 'unknown_error',
  })

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
    console.info('NewebPay booking sync skipped', {
      merchantOrderNo: input.merchantOrderNo,
      paymentResult: input.paymentResult,
      paymentId: input.payment.id,
      bookingSync: bookingSync.bookingSync,
    })
    return bookingSync.bookingSync
  }

  if (bookingSync.bookingSync === 'failed') {
    console.warn('NewebPay booking sync failed', {
      merchantOrderNo: input.merchantOrderNo,
      paymentResult: input.paymentResult,
      paymentId: input.payment.id,
      bookingId: bookingSync.bookingId,
      bookingSync: bookingSync.bookingSync,
      error: bookingSync.error,
    })
    return bookingSync.bookingSync
  }

  console.info('NewebPay booking sync completed', {
    merchantOrderNo: input.merchantOrderNo,
    paymentResult: input.paymentResult,
    paymentId: input.payment.id,
    bookingId: bookingSync.bookingId,
    bookingSync: bookingSync.bookingSync,
  })
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
    console.info('NewebPay course sync skipped', {
      merchantOrderNo: input.merchantOrderNo,
      paymentResult: input.paymentResult,
      paymentId: input.payment.id,
      itemType: input.payment.itemType,
      itemId: input.payment.itemId,
      hasUserId: Boolean(input.payment.userId),
      courseSync: courseSync.courseSync,
    })
    return courseSync.courseSync
  }

  if (courseSync.courseSync === 'failed') {
    console.warn('NewebPay course sync failed', {
      merchantOrderNo: input.merchantOrderNo,
      paymentResult: input.paymentResult,
      paymentId: input.payment.id,
      itemType: input.payment.itemType,
      itemId: input.payment.itemId,
      hasUserId: Boolean(input.payment.userId),
      courseSync: courseSync.courseSync,
      error: courseSync.error,
    })
    return courseSync.courseSync
  }

  console.info('NewebPay course sync completed', {
    merchantOrderNo: input.merchantOrderNo,
    paymentResult: input.paymentResult,
    paymentId: input.payment.id,
    itemType: input.payment.itemType,
    itemId: courseSync.courseId,
    hasUserId: true,
    courseSync: courseSync.courseSync,
  })
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
    console.info('NewebPay divination sync skipped', {
      merchantOrderNo: input.merchantOrderNo,
      paymentResult: input.paymentResult,
      paymentId: input.payment.id,
      itemType: input.payment.itemType,
      itemId: input.payment.itemId,
      divinationSync: divinationSync.divinationSync,
    })
    return divinationSync.divinationSync
  }

  if (divinationSync.divinationSync === 'failed') {
    console.warn('NewebPay divination sync failed', {
      merchantOrderNo: input.merchantOrderNo,
      paymentResult: input.paymentResult,
      paymentId: input.payment.id,
      itemType: input.payment.itemType,
      itemId: input.payment.itemId,
      divinationSync: divinationSync.divinationSync,
      error: divinationSync.error,
    })
    return divinationSync.divinationSync
  }

  console.info('NewebPay divination sync completed', {
    merchantOrderNo: input.merchantOrderNo,
    paymentResult: input.paymentResult,
    paymentId: input.payment.id,
    itemType: input.payment.itemType,
    itemId: divinationSync.readingId,
    divinationSync: divinationSync.divinationSync,
  })
  return divinationSync.divinationSync
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

    console.info('NewebPay notify received', {
      merchantOrderNo: result.merchantOrderNo,
      status: result.status,
      tradeNo: result.tradeNo,
      amount: result.amount,
      paymentType: result.paymentType,
      paymentMethod: result.paymentMethod,
    })

    try {
      const paymentPersistence = await persistNewebPayNotifyPaymentResult(
        result,
        getPaymentByMerchantOrderNo,
        markPaymentPaidByMerchantOrderNo,
      )

      if ('ignored' in paymentPersistence) {
        console.info('NewebPay notify ignored for non-success status', {
          merchantOrderNo: result.merchantOrderNo,
          status: result.status,
          tradeNo: result.tradeNo,
          amount: result.amount,
          paymentType: result.paymentType,
          paymentMethod: result.paymentMethod,
        })

        return NextResponse.json({ ok: true, ignored: true })
      }

      if (!paymentPersistence.ok) {
        console.warn('NewebPay notify payment validation failed', {
          merchantOrderNo: result.merchantOrderNo,
          status: result.status,
          tradeNo: result.tradeNo,
          amount: result.amount,
          paymentType: result.paymentType,
          paymentMethod: result.paymentMethod,
          result: paymentPersistence.result,
          error: paymentPersistence.error,
          localAmount: paymentPersistence.localAmount ?? null,
          providerAmount: paymentPersistence.providerAmount ?? result.amount ?? null,
          paymentStatus: paymentPersistence.paymentStatus ?? null,
        })

        return NextResponse.json({ ok: false, error: paymentPersistence.error })
      }

      console.info('NewebPay notify payment marked paid', {
        merchantOrderNo: result.merchantOrderNo,
        status: result.status,
        tradeNo: result.tradeNo,
        amount: result.amount,
        paymentType: result.paymentType,
        paymentMethod: result.paymentMethod,
        result: paymentPersistence.result,
        paymentId: paymentPersistence.payment.id,
        bookingId: paymentPersistence.payment.bookingId,
      })

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

      return NextResponse.json({
        ok: true,
        paymentStatus: 'paid',
        result: paymentPersistence.result,
        bookingSync,
        courseSync,
        divinationSync,
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
      console.warn('NewebPay notify decrypt failed; using query fallback', {
        merchantOrderNo: queryMerchantOrderNo,
        outerStatus: status,
        decryptFailed: true,
        fallbackQueryUsed: true,
      })

      try {
        const fallbackResult = await persistNewebPayNotifyQueryFallback({
          merchantOrderNo: queryMerchantOrderNo as string,
          config,
          getPaymentByMerchantOrderNo,
          queryNewebPayTrade,
          markPaymentPaid: markPaymentPaidByMerchantOrderNo,
        })

        if ('ignored' in fallbackResult) {
          console.info('NewebPay notify query fallback ignored', {
            merchantOrderNo: queryMerchantOrderNo,
            outerStatus: status,
            decryptFailed: true,
            fallbackQueryUsed: true,
            reason: fallbackResult.reason,
            queryTradeStatus: fallbackResult.query?.tradeStatus,
            queryPaymentType: fallbackResult.query?.paymentType,
            queryPaymentMethod: fallbackResult.query?.paymentMethod,
          })

          return NextResponse.json({ ok: true, ignored: true, reason: fallbackResult.reason })
        }

        if (!fallbackResult.ok) {
          console.warn('NewebPay notify query fallback payment not found', {
            merchantOrderNo: queryMerchantOrderNo,
            outerStatus: status,
            decryptFailed: true,
            fallbackQueryUsed: true,
            result: fallbackResult.result,
          })

          return NextResponse.json({ ok: false, error: 'payment_not_found' })
        }

        console.info('NewebPay notify query fallback marked paid', {
          merchantOrderNo: queryMerchantOrderNo,
          outerStatus: status,
          decryptFailed: true,
          fallbackQueryUsed: true,
          queryTradeStatus: fallbackResult.query.tradeStatus,
          queryPaymentType: fallbackResult.query.paymentType,
          queryPaymentMethod: fallbackResult.query.paymentMethod,
          result: fallbackResult.result,
          paymentId: fallbackResult.payment.id,
          bookingId: fallbackResult.payment.bookingId,
        })

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

        return NextResponse.json({
          ok: true,
          paymentStatus: 'paid',
          result: fallbackResult.result,
          bookingSync,
          courseSync,
          divinationSync,
        })
      } catch (fallbackError) {
        console.warn('NewebPay notify query fallback failed', {
          merchantOrderNo: queryMerchantOrderNo,
          outerStatus: status,
          decryptFailed: true,
          fallbackQueryUsed: true,
          error: fallbackError instanceof Error ? fallbackError.message : 'unknown_error',
        })

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
