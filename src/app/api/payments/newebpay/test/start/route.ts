import { NextResponse } from 'next/server'
import { getNewebPayConfig } from '@/lib/newebpay/config'
import { createCoursePaymentMpgForm, generateMerchantOrderNo } from '@/lib/newebpay/mpg'
import { getSupabaseAdmin, hasSupabaseAdminConfig } from '@/lib/supabase/admin'
import { getUserIdFromRequest } from '@/lib/supabase/auth'

const testPayment = {
  itemType: 'newebpay_test',
  itemId: 'test_1_twd',
  itemName: '藍新金流 1 元測試商品',
  amount: 1,
}

export async function POST(request: Request) {
  if (process.env.NEWEBPAY_ENABLE_TEST_PAYMENT !== 'true') {
    return NextResponse.json(
      {
        ok: false,
        error: '測試付款功能未啟用。',
      },
      { status: 404 },
    )
  }

  if (!hasSupabaseAdminConfig()) {
    return NextResponse.json({ ok: false, message: 'Supabase 管理端尚未設定' }, { status: 500 })
  }

  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ ok: false, message: '尚未登入' }, { status: 401 })
  }

  try {
    const config = getNewebPayConfig()
    const merchantOrderNo = generateMerchantOrderNo('NPTEST')
    const supabase = getSupabaseAdmin()

    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        provider: 'newebpay',
        item_type: testPayment.itemType,
        item_id: testPayment.itemId,
        item_name: testPayment.itemName,
        amount_twd: testPayment.amount,
        currency: 'TWD',
        status: 'pending',
        merchant_order_no: merchantOrderNo,
        raw_payload: {
          source: 'newebpay_test_start',
          note: '1 TWD NewebPay test payment. This must not unlock courses.',
        },
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
    }

    const mpgForm = createCoursePaymentMpgForm(
      {
        merchantOrderNo,
        amount: testPayment.amount,
        itemDesc: testPayment.itemName,
        notifyUrl: `${config.siteUrl}/api/payments/newebpay/notify`,
        returnUrl: `${config.siteUrl}/api/payments/newebpay/return`,
        clientBackUrl: `${config.siteUrl}/payment/newebpay/test`,
      },
      config,
    )

    return NextResponse.json({
      ok: true,
      paymentId: payment.id,
      merchantOrderNo,
      form: mpgForm,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '建立測試付款失敗'
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
