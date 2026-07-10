import Link from 'next/link'

export default function NewebPayResultPage() {
  // ReturnURL only means the user was redirected back to this site.
  // A real paid state must come from NotifyURL after verification.
  return (
    <section className="bg-softPurple py-16 md:py-24">
      <div className="section-shell max-w-2xl rounded-[28px] border border-borderSoft bg-white p-6 text-center shadow-soft md:p-8">
        <p className="text-sm font-semibold text-darkGold">NewebPay</p>
        <h1 className="mt-3 font-serifTC text-3xl font-semibold text-deepPurple">付款結果確認中</h1>
        <p className="mt-4 leading-7 text-textMuted">
          我們已收到藍新金流導回資訊，實際付款結果會以系統背景通知為準。
          如果畫面尚未更新，請稍後重新整理，或回到網站查看狀態。
        </p>

        <p className="mt-6 rounded-xl bg-softPurple px-4 py-3 text-sm leading-6 text-textMuted">
          回到網站只代表付款頁已結束，不會單獨作為付款成功依據。付款是否成功，會以背景通知驗證後的結果為準。
        </p>

        <Link className="focus-ring mt-7 inline-flex rounded-lg bg-deepPurple px-6 py-3 font-semibold text-white" href="/">
          返回網站
        </Link>
      </div>
    </section>
  )
}
