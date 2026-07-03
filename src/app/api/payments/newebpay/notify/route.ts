import { NextResponse } from 'next/server'
import { getNewebPayConfig } from '@/lib/newebpay/config'
import { parseNewebPayNotifyPayload } from '@/lib/newebpay/notify'

export const runtime = 'nodejs'

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function notifyError(error: string, status: string, merchantId: string) {
  console.warn('NewebPay notify rejected', {
    error,
    status,
    merchantId,
  })

  return NextResponse.json({ ok: false, error: 'invalid_notify' })
}

export async function POST(request: Request) {
  const formData = await request.formData()
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

    // TODO: When payment persistence is wired, make MerchantOrderNo updates idempotent.
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid NewebPay notify payload'
    return notifyError(message, status, merchantId)
  }
}
