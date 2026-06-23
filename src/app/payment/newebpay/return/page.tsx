import Link from 'next/link'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseAdmin, hasSupabaseAdminConfig } from '@/lib/supabase/admin'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

type ReturnPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

type PaymentRow = {
  id: string
  item_name: string
  item_type: string
  amount_twd: number
  status: string
  failure_reason: string | null
  merchant_order_no: string | null
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

function ResultCard({
  title,
  message,
  detail,
  actionHref,
  actionLabel,
}: {
  title: string
  message: string
  detail?: string | null
  actionHref: string
  actionLabel: string
}) {
  return (
    <section className="bg-softPurple py-16 md:py-24">
      <div className="section-shell max-w-2xl rounded-[28px] border border-borderSoft bg-white p-8 text-center shadow-soft">
        <p className="text-sm font-semibold text-darkGold">NewebPay</p>
        <h1 className="mt-3 font-serifTC text-3xl font-semibold text-deepPurple">{title}</h1>
        <p className="mt-4 leading-7 text-textMuted">{message}</p>
        {detail ? <p className="mt-4 rounded-lg bg-softPurple px-4 py-3 text-sm font-semibold text-deepPurple">{detail}</p> : null}
        <Link className="focus-ring mt-7 inline-flex rounded-lg bg-deepPurple px-6 py-3 font-semibold text-white" href={actionHref}>
          {actionLabel}
        </Link>
      </div>
    </section>
  )
}

function renderPaymentStatus(payment: PaymentRow) {
  const isCoursePayment = payment.item_type === 'course'

  if (payment.status === 'paid') {
    return (
      <ResultCard
        title="付款成功"
        message={isCoursePayment ? '你的課程已開通，可以到「我的課程」查看。' : '1 元藍新測試付款已完成，這筆測試不會開通課程。'}
        detail={`${payment.item_name}｜NT$${payment.amount_twd.toLocaleString('zh-TW')}`}
        actionHref={isCoursePayment ? '/account/courses' : '/payment/newebpay/test'}
        actionLabel={isCoursePayment ? '查看我的課程' : '返回測試頁'}
      />
    )
  }

  if (payment.status === 'failed') {
    return (
      <ResultCard
        title="付款失敗"
        message={isCoursePayment ? '這筆付款沒有完成，請重新回到課程頁購買。' : '這筆 1 元測試付款沒有完成，請回到測試頁重新測試。'}
        detail={payment.failure_reason}
        actionHref={isCoursePayment ? '/courses' : '/payment/newebpay/test'}
        actionLabel={isCoursePayment ? '返回課程頁' : '返回測試頁'}
      />
    )
  }

  return (
    <ResultCard
      title="付款確認中"
      message={isCoursePayment ? '系統正在等待藍新金流通知。若你已完成付款，通常稍後就會開通。' : '系統正在等待藍新金流通知。若你已完成付款，通常稍後就會更新測試付款狀態。'}
      detail={`${payment.item_name}｜目前狀態：${payment.status}`}
      actionHref={isCoursePayment ? '/account/courses' : '/payment/newebpay/test'}
      actionLabel={isCoursePayment ? '查看我的課程' : '返回測試頁'}
    />
  )
}

export default async function NewebPayReturnPage({ searchParams }: ReturnPageProps) {
  const resolvedSearchParams = await searchParams
  const merchantOrderNo = getSingleParam(resolvedSearchParams.merchantOrderNo)
  const status = getSingleParam(resolvedSearchParams.status)

  if (!merchantOrderNo) {
    return (
      <ResultCard
        title="付款狀態確認中"
        message={status === 'unknown' ? '暫時無法判讀藍新回傳資料，請重新登入後到會員中心查看課程。' : '請重新登入後到會員中心查看課程。'}
        actionHref="/account/courses"
        actionLabel="查看我的課程"
      />
    )
  }

  if (!hasSupabaseAdminConfig()) {
    return (
      <ResultCard
        title="查無付款紀錄"
        message="付款查詢設定尚未完成，請回到課程頁重新確認。"
        actionHref="/courses"
        actionLabel="返回課程頁"
      />
    )
  }

  const supabase = await getServerSupabaseClient()
  if (!supabase) {
    return (
      <ResultCard
        title="請重新登入"
        message="請重新登入後到會員中心查看課程。"
        actionHref="/account/courses"
        actionLabel="查看我的課程"
      />
    )
  }

  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData.user

  if (userError || !user) {
    return (
      <ResultCard
        title="請重新登入"
        message="請重新登入後到會員中心查看課程。"
        actionHref="/account/courses"
        actionLabel="查看我的課程"
      />
    )
  }

  const admin = getSupabaseAdmin()
  const { data: payment, error } = await admin
    .from('payments')
    .select('id,item_name,item_type,amount_twd,status,failure_reason,merchant_order_no')
    .eq('merchant_order_no', merchantOrderNo)
    .eq('user_id', user.id)
    .eq('provider', 'newebpay')
    .in('item_type', ['course', 'newebpay_test'])
    .maybeSingle<PaymentRow>()

  if (error || !payment) {
    return (
      <ResultCard
        title="查無付款紀錄"
        message="請回到課程頁重新確認。"
        detail={error?.message}
        actionHref="/courses"
        actionLabel="返回課程頁"
      />
    )
  }

  return renderPaymentStatus(payment)
}
