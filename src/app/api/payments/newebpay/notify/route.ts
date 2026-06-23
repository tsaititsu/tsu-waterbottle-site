import { NextResponse } from 'next/server'
import { isCourseId } from '@/lib/courses'
import { decryptTradeInfo, verifyTradeSha } from '@/lib/newebpay/mpg'
import { getSupabaseAdmin, hasSupabaseAdminConfig } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

type JsonRecord = Record<string, unknown>

type PaymentRow = {
  id: string
  user_id: string | null
  provider: string
  item_type: string
  item_id: string | null
  amount_twd: number
  status: string
  merchant_order_no: string | null
}

function jsonError(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status })
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getString(value: unknown) {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

function parseAmount(value: unknown) {
  const amount = Number(getString(value))
  return Number.isFinite(amount) ? amount : null
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function getDecryptedRoot(decryptedTradeInfo: unknown) {
  return isRecord(decryptedTradeInfo) ? decryptedTradeInfo : null
}

function getResultRecord(root: JsonRecord) {
  return isRecord(root.Result) ? root.Result : root
}

function isSuccessfulStatus(status: string) {
  return status.toUpperCase() === 'SUCCESS'
}

function createNotifyPayload(root: JsonRecord, metadata: JsonRecord) {
  return {
    stage: 'notify_received',
    receivedAt: new Date().toISOString(),
    metadata,
    decrypted: root,
  }
}

async function updatePaymentFailure(paymentId: string, failureReason: string, rawPayload: JsonRecord) {
  const supabase = getSupabaseAdmin()
  await supabase
    .from('payments')
    .update({
      status: 'failed',
      failure_reason: failureReason,
      notify_received_at: new Date().toISOString(),
      raw_payload: rawPayload,
    })
    .eq('id', paymentId)
    .neq('status', 'paid')
}

async function getCoursePurchase(userId: string, courseId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('course_purchases')
    .select('id')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

async function ensureCoursePurchase(payment: PaymentRow) {
  if (!payment.user_id || !payment.item_id) throw new Error('payment missing user_id or item_id')

  const existingPurchase = await getCoursePurchase(payment.user_id, payment.item_id)
  if (existingPurchase) return true

  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('course_purchases').insert({
    user_id: payment.user_id,
    course_id: payment.item_id,
    payment_id: payment.id,
    status: 'paid',
    purchased_at: new Date().toISOString(),
  })

  if (error && error.code !== '23505') throw new Error(error.message)
  return false
}

export async function POST(request: Request) {
  if (!hasSupabaseAdminConfig()) {
    return jsonError('Supabase 管理端尚未設定', 500)
  }

  const formData = await request.formData()
  const encryptedTradeInfo = getFormString(formData, 'TradeInfo')
  const tradeSha = getFormString(formData, 'TradeSha')

  if (!encryptedTradeInfo || !tradeSha) {
    return jsonError('Missing TradeInfo or TradeSha')
  }

  let tradeShaValid = false
  try {
    tradeShaValid = verifyTradeSha(encryptedTradeInfo, tradeSha)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TradeSha verification failed'
    return jsonError(message, 400)
  }

  if (!tradeShaValid) {
    return jsonError('Invalid TradeSha', 400)
  }

  let decryptedTradeInfo: unknown
  try {
    decryptedTradeInfo = decryptTradeInfo(encryptedTradeInfo)
  } catch {
    return jsonError('Unable to decrypt TradeInfo', 400)
  }

  const root = getDecryptedRoot(decryptedTradeInfo)
  if (!root) {
    return jsonError('Invalid decrypted TradeInfo', 400)
  }

  const result = getResultRecord(root)
  const status = getString(root.Status || formData.get('Status'))
  const merchantOrderNo = getString(result.MerchantOrderNo)
  const amount = parseAmount(result.Amt)
  const tradeNo = getString(result.TradeNo)
  const payTime = getString(result.PayTime)
  const paymentType = getString(result.PaymentType)
  const rawPayload = createNotifyPayload(root, {
    formStatus: getFormString(formData, 'Status'),
    formMerchantID: getFormString(formData, 'MerchantID'),
    formVersion: getFormString(formData, 'Version'),
    merchantOrderNo,
    tradeNo,
    payTime,
    paymentType,
  })

  if (!merchantOrderNo) {
    return jsonError('Missing MerchantOrderNo')
  }

  if (amount === null) {
    return jsonError('Invalid payment amount')
  }

  const supabase = getSupabaseAdmin()
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('id,user_id,provider,item_type,item_id,amount_twd,status,merchant_order_no')
    .eq('merchant_order_no', merchantOrderNo)
    .eq('provider', 'newebpay')
    .eq('item_type', 'course')
    .maybeSingle<PaymentRow>()

  if (paymentError) {
    return jsonError(paymentError.message, 500)
  }

  if (!payment) {
    return jsonError('Payment not found', 404)
  }

  const validationErrors: string[] = []
  if (payment.provider !== 'newebpay') validationErrors.push('invalid provider')
  if (payment.item_type !== 'course') validationErrors.push('invalid item_type')
  if (!payment.item_id || !isCourseId(payment.item_id)) validationErrors.push('invalid item_id')
  if (payment.status !== 'pending' && payment.status !== 'paid') validationErrors.push('invalid payment status')
  if (payment.amount_twd !== amount) validationErrors.push('amount mismatch')
  if (payment.amount_twd !== 9800) validationErrors.push('invalid course amount')
  if (payment.merchant_order_no !== merchantOrderNo) validationErrors.push('merchant_order_no mismatch')
  if (!payment.user_id) validationErrors.push('missing user_id')

  if (validationErrors.length > 0) {
    await updatePaymentFailure(payment.id, validationErrors.join(', '), rawPayload)
    return jsonError(validationErrors.join(', '))
  }

  if (!isSuccessfulStatus(status)) {
    const failureReason = status || getString(root.Message) || 'NewebPay payment failed'
    await updatePaymentFailure(payment.id, failureReason, rawPayload)
    return NextResponse.json({ ok: false, error: failureReason }, { status: 400 })
  }

  if (payment.status === 'paid') {
    const existingPurchase = await getCoursePurchase(payment.user_id as string, payment.item_id as string)
    if (existingPurchase) {
      return NextResponse.json({ ok: true, idempotent: true })
    }
  }

  const { error: updateError } = await supabase
    .from('payments')
    .update({
      status: 'paid',
      paid_at: payTime ? new Date(payTime).toISOString() : new Date().toISOString(),
      provider_payment_id: tradeNo || null,
      provider_trade_no: tradeNo || null,
      notify_received_at: new Date().toISOString(),
      raw_payload: rawPayload,
      failure_reason: null,
    })
    .eq('id', payment.id)
    .in('status', ['pending', 'paid'])

  if (updateError) {
    return jsonError(updateError.message, 500)
  }

  const wasAlreadyPurchased = await ensureCoursePurchase(payment)
  return NextResponse.json(wasAlreadyPurchased ? { ok: true, idempotent: true } : { ok: true })
}
