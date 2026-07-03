import Link from 'next/link'

type ReturnPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

type ReturnSummary = {
  merchantOrderNo: string
  status: string
  tradeNo: string
  paymentType: string
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

function getReturnSummary(searchParams: Record<string, string | string[] | undefined>): ReturnSummary {
  return {
    merchantOrderNo: getSingleParam(searchParams.MerchantOrderNo) || getSingleParam(searchParams.merchantOrderNo),
    status: getSingleParam(searchParams.Status) || getSingleParam(searchParams.status),
    tradeNo: getSingleParam(searchParams.TradeNo) || getSingleParam(searchParams.tradeNo),
    paymentType: getSingleParam(searchParams.PaymentType) || getSingleParam(searchParams.paymentType),
  }
}

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value) return null

  return (
    <div className="rounded-xl bg-white px-4 py-3 text-left">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-textMuted">{label}</p>
      <p className="mt-1 break-words font-semibold text-deepPurple">{value}</p>
    </div>
  )
}

export default async function NewebPayReturnPage({ searchParams }: ReturnPageProps) {
  const resolvedSearchParams = await searchParams
  const summary = getReturnSummary(resolvedSearchParams)
  const hasSummary = Boolean(summary.merchantOrderNo || summary.status || summary.tradeNo || summary.paymentType)

  // ReturnURL only means the user was redirected back to this site.
  // A real paid state must come from NotifyURL after TradeSha verification and TradeInfo decryption.
  return (
    <section className="bg-softPurple py-16 md:py-24">
      <div className="section-shell max-w-2xl rounded-[28px] border border-borderSoft bg-white p-6 text-center shadow-soft md:p-8">
        <p className="text-sm font-semibold text-darkGold">NewebPay</p>
        <h1 className="mt-3 font-serifTC text-3xl font-semibold text-deepPurple">付款結果確認中</h1>
        <p className="mt-4 leading-7 text-textMuted">
          我們已收到藍新金流導回資訊，實際付款結果會以系統背景通知為準。
          如果畫面尚未更新，請稍後重新整理，或回到預約頁查看狀態。
        </p>

        {hasSummary ? (
          <div className="mt-7 grid gap-3 rounded-2xl border border-borderSoft bg-softPurple p-4">
            <DetailRow label="MerchantOrderNo" value={summary.merchantOrderNo} />
            <DetailRow label="Status" value={summary.status} />
            <DetailRow label="TradeNo" value={summary.tradeNo} />
            <DetailRow label="PaymentType" value={summary.paymentType} />
          </div>
        ) : null}

        <p className="mt-6 rounded-xl bg-softPurple px-4 py-3 text-sm leading-6 text-textMuted">
          ReturnURL 只代表你已回到網站，不會單獨作為付款成功依據。付款是否成功，會以藍新背景通知驗證後的結果為準。
        </p>

        <Link className="focus-ring mt-7 inline-flex rounded-lg bg-deepPurple px-6 py-3 font-semibold text-white" href="/booking">
          返回預約頁
        </Link>
      </div>
    </section>
  )
}
