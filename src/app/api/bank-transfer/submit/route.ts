import { NextResponse } from 'next/server'
import { getSupabaseAdmin, hasSupabaseAdminConfig } from '@/lib/supabase/admin'
import { getUserIdFromRequest } from '@/lib/supabase/auth'

type BankTransferSubmitBody = {
  itemType?: unknown
  itemId?: unknown
  itemName?: unknown
  amountTwd?: unknown
  payerName?: unknown
  payerPhone?: unknown
  payerEmail?: unknown
  lineDisplayName?: unknown
  bankAccountLast5?: unknown
  transferTime?: unknown
  note?: unknown
}

const last5Pattern = /^\d{5}$/

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asOptionalString(value: unknown) {
  const text = asTrimmedString(value)
  return text || null
}

function parseAmount(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.floor(value) : 0
  if (typeof value === 'string') {
    const normalized = Number(value.replace(/,/g, '').trim())
    return Number.isFinite(normalized) ? Math.floor(normalized) : 0
  }
  return 0
}

function parseTransferTime(value: unknown) {
  const text = asTrimmedString(value)
  if (!text) return null

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

export async function POST(request: Request) {
  if (!hasSupabaseAdminConfig()) {
    return NextResponse.json({ ok: false, message: 'Supabase 管理端尚未設定' }, { status: 500 })
  }

  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ ok: false, message: '尚未登入' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as BankTransferSubmitBody | null
  if (!body) {
    return NextResponse.json({ ok: false, message: '請提供匯款回報資料' }, { status: 400 })
  }

  const itemType = asTrimmedString(body.itemType)
  const itemId = asOptionalString(body.itemId)
  const itemName = asTrimmedString(body.itemName)
  const amountTwd = parseAmount(body.amountTwd)
  const payerName = asTrimmedString(body.payerName)
  const payerPhone = asTrimmedString(body.payerPhone)
  const payerEmail = asOptionalString(body.payerEmail)
  const lineDisplayName = asOptionalString(body.lineDisplayName)
  const bankAccountLast5 = asTrimmedString(body.bankAccountLast5)
  const transferTime = parseTransferTime(body.transferTime)
  const note = asOptionalString(body.note)

  if (!itemType || !itemName || !payerName || !payerPhone || amountTwd <= 0) {
    return NextResponse.json({ ok: false, message: '請填寫必填欄位' }, { status: 400 })
  }

  if (!last5Pattern.test(bankAccountLast5)) {
    return NextResponse.json({ ok: false, message: '匯款帳號後五碼必須是 5 位數字' }, { status: 400 })
  }

  if (transferTime === undefined) {
    return NextResponse.json({ ok: false, message: '匯款時間格式不正確' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  let existingQuery = supabase
    .from('bank_transfer_submissions')
    .select('id, status')
    .eq('user_id', userId)
    .eq('item_type', itemType)
    .in('status', ['pending_review', 'confirmed'])
    .order('created_at', { ascending: false })
    .limit(1)

  existingQuery =
    itemId === null
      ? existingQuery.is('item_id', null)
      : existingQuery.eq('item_id', itemId)

  const { data: existingSubmission, error: existingError } = await existingQuery.maybeSingle()

  if (existingError) {
    return NextResponse.json({ ok: false, message: existingError.message }, { status: 500 })
  }

  if (existingSubmission) {
    return NextResponse.json(
      {
        ok: true,
        message: '已有待確認或已完成的匯款回報，請勿重複送出。',
        submission: existingSubmission,
      },
      { status: 200 },
    )
  }

  const { data, error } = await supabase
    .from('bank_transfer_submissions')
    .insert({
      user_id: userId,
      item_type: itemType,
      item_id: itemId,
      item_name: itemName,
      amount_twd: amountTwd,
      payer_name: payerName,
      payer_phone: payerPhone,
      payer_email: payerEmail,
      line_display_name: lineDisplayName,
      bank_account_last5: bankAccountLast5,
      transfer_time: transferTime,
      note,
      status: 'pending_review',
    })
    .select('id, status')
    .single()

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, submission: data })
}
