import Link from 'next/link'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getNewebPayConfig } from '@/lib/newebpay/config'
import { createCoursePaymentMpgForm } from '@/lib/newebpay/mpg'
import { getSupabaseAdmin, hasSupabaseAdminConfig } from '@/lib/supabase/admin'
import { NewebPayAutoSubmitForm } from './NewebPayAutoSubmitForm'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

type RedirectPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

type PaymentRow = {
  id: string
  user_id: string
  provider: string
  item_type: string
  item_id: string | null
  item_name: string
  amount_twd: number
  status: string
  merchant_order_no: string | null
}

function isSupportedNewebPayItemType(itemType: string) {
  return itemType === 'course' || itemType === 'newebpay_test'
}

async function getServerSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null

  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
    },
  })
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <section className="bg-softPurple py-16 md:py-24">
      <div className="section-shell max-w-2xl rounded-[28px] border border-borderSoft bg-white p-8 text-center shadow-soft">
        <h1 className="font-serifTC text-3xl font-semibold text-deepPurple">{title}</h1>
        <p className="mt-4 leading-7 text-textMuted">{message}</p>
        <Link className="focus-ring mt-7 inline-flex rounded-lg bg-deepPurple px-6 py-3 font-semibold text-white" href="/courses">
          返回課程頁
        </Link>
      </div>
    </section>
  )
}

export default async function NewebPayRedirectPage({ searchParams }: RedirectPageProps) {
  const resolvedSearchParams = await searchParams
  const paymentId = getSingleParam(resolvedSearchParams.paymentId)

  if (!paymentId) {
    return <ErrorState title="缺少付款資訊" message="找不到 paymentId，請回到課程頁重新建立付款。" />
  }

  if (!hasSupabaseAdminConfig()) {
    return <ErrorState title="付款設定尚未完成" message="Supabase 管理端尚未設定完整，暫時無法前往藍新付款頁。" />
  }

  const supabase = await getServerSupabaseClient()
  if (!supabase) {
    return <ErrorState title="尚未登入" message="請先登入後再進行課程付款。" />
  }

  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData.user

  if (userError || !user) {
    return <ErrorState title="尚未登入" message="請先登入後再進行課程付款。" />
  }

  const admin = getSupabaseAdmin()
  const { data: payment, error: paymentError } = await admin
    .from('payments')
    .select('id,user_id,provider,item_type,item_id,item_name,amount_twd,status,merchant_order_no')
    .eq('id', paymentId)
    .eq('user_id', user.id)
    .maybeSingle<PaymentRow>()

  if (paymentError) {
    return <ErrorState title="付款資料讀取失敗" message={paymentError.message} />
  }

  if (!payment) {
    return <ErrorState title="找不到付款資料" message="找不到這筆付款，或這筆付款不屬於目前登入的會員。" />
  }

  if (payment.provider !== 'newebpay') {
    return <ErrorState title="付款方式不正確" message="這筆付款不是藍新金流付款。" />
  }

  if (!isSupportedNewebPayItemType(payment.item_type)) {
    return <ErrorState title="付款項目不正確" message="這筆付款不是可支援的藍新付款項目。" />
  }

  if (payment.status !== 'pending') {
    return <ErrorState title="付款狀態不正確" message="這筆付款不是待付款狀態，請回到課程頁確認目前課程狀態。" />
  }

  if (!payment.merchant_order_no) {
    return <ErrorState title="缺少藍新訂單編號" message="這筆付款缺少 merchant_order_no，請回到課程頁重新建立付款。" />
  }

  let form
  try {
    const config = getNewebPayConfig()
    form = createCoursePaymentMpgForm(
      {
        merchantOrderNo: payment.merchant_order_no,
        amount: payment.amount_twd,
        itemDesc: payment.item_name,
        email: user.email,
        notifyUrl: `${config.siteUrl}/api/payments/newebpay/notify`,
        returnUrl: `${config.siteUrl}/api/payments/newebpay/return`,
        clientBackUrl: payment.item_type === 'course' ? `${config.siteUrl}/account/courses` : `${config.siteUrl}/payment/newebpay/test`,
      },
      config,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : '藍新環境變數尚未設定完整。'
    return <ErrorState title="藍新付款設定錯誤" message={message} />
  }

  return (
    <section className="bg-softPurple py-16 md:py-24">
      <div className="section-shell max-w-2xl rounded-[28px] border border-borderSoft bg-white p-8 text-center shadow-soft">
        <p className="text-sm font-semibold text-darkGold">NewebPay</p>
        <h1 className="mt-3 font-serifTC text-3xl font-semibold text-deepPurple">正在前往藍新付款頁</h1>
        <p className="mt-4 leading-7 text-textMuted">請稍候，系統會自動將你導向藍新金流安全付款頁。</p>
        <NewebPayAutoSubmitForm form={form} />
      </div>
    </section>
  )
}
