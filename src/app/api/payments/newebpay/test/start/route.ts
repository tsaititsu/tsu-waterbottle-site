import { NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/auth/admin'
import { generateMerchantOrderNo } from '@/lib/newebpay/mpg'

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

  try {
    const auth = await requireAdminUser(request)
    if ('error' in auth) return auth.error

    const merchantOrderNo = generateMerchantOrderNo('NPTEST')

    const { data: payment, error } = await auth.supabase
      .from('payments')
      .insert({
        user_id: auth.user.id,
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
      console.error('NewebPay test payment insert failed')
      return NextResponse.json({ ok: false, message: '建立測試付款失敗。' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      paymentId: payment.id,
    })
  } catch {
    console.error('Unexpected NewebPay test payment creation failure')
    return NextResponse.json({ ok: false, message: '建立測試付款失敗。' }, { status: 500 })
  }
}
