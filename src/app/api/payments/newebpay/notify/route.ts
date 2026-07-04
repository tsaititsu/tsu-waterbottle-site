import { NextResponse } from 'next/server'
import { getNewebPayConfig } from '@/lib/newebpay/config'
import {
  buildNewebPayNotifyErrorMetadata,
  parseNewebPayNotifyPayload,
  persistNewebPayNotifyPaymentResult,
} from '@/lib/newebpay/notify'
import { markPaymentPaidByMerchantOrderNo } from '@/lib/supabase/payments'

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

export async function POST(request: Request) {
  const formData = await request.formData()
  const formKeys = Array.from(formData.keys())
  const status = getFormString(formData, 'Status')
  const merchantId = getFormString(formData, 'MerchantID')
  const version = getFormString(formData, 'Version')
  const tradeInfo = getFormString(formData, 'TradeInfo')
  const tradeSha = getFormString(formData, 'TradeSha')

  try {
    if (!status || !merchantId || !tradeInfo || !tradeSha) {
      throw new Error('Missing required notify fields')
    }

    const config = getNewebPayConfig()
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
