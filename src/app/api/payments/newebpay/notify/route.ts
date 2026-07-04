import { NextResponse } from 'next/server'
import { getNewebPayConfig } from '@/lib/newebpay/config'
import { verifyTradeSha } from '@/lib/newebpay/crypto'
import {
  buildNewebPayNotifyErrorMetadata,
  isNewebPayTradeInfoDecryptError,
  parseNewebPayNotifyPayload,
  persistNewebPayNotifyQueryFallback,
  persistNewebPayNotifyPaymentResult,
} from '@/lib/newebpay/notify'
import { queryNewebPayTrade } from '@/lib/newebpay/query'
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
      const paymentPersistence = await persistNewebPayNotifyPaymentResult(result, markPaymentPaidByMerchantOrderNo)

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
        console.warn('NewebPay notify payment not found', {
          merchantOrderNo: result.merchantOrderNo,
          status: result.status,
          tradeNo: result.tradeNo,
          amount: result.amount,
          paymentType: result.paymentType,
          paymentMethod: result.paymentMethod,
          result: paymentPersistence.result,
        })

        return NextResponse.json({ ok: false, error: 'payment_not_found' })
      }

      console.info('NewebPay notify payment marked paid', {
        merchantOrderNo: result.merchantOrderNo,
        status: result.status,
        tradeNo: result.tradeNo,
        amount: result.amount,
        paymentType: result.paymentType,
        paymentMethod: result.paymentMethod,
        result: paymentPersistence.result,
      })

      return NextResponse.json({
        ok: true,
        paymentStatus: 'paid',
        result: paymentPersistence.result,
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
        })

        return NextResponse.json({
          ok: true,
          paymentStatus: 'paid',
          result: fallbackResult.result,
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
