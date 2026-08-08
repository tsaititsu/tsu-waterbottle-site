import Link from 'next/link'
import { LINE_PAY_PRODUCTION_ONE_DOLLAR_ENTRY_DEFINITIONS } from '@/lib/linePay/productionOneDollarEntry'

export default function LinePayProductionEntryTestGuide() {
  return (
    <section
      aria-labelledby="line-pay-production-entry-tests"
      className="rounded-2xl border border-[#87d9a8] bg-[#f1fff6] p-5 shadow-soft md:p-6"
    >
      <h2
        className="font-serifTC text-2xl font-semibold text-[#16763b]"
        id="line-pay-production-entry-tests"
      >
        LINE Pay Production 實際入口 NT$1 驗收
      </h2>
      <p className="mt-2 text-sm leading-7 text-textMuted">
        請從下列實際付款選單進入。管理員登入且臨時測試開關有效時，LINE Pay
        按鈕會顯示「管理員 LINE Pay 入口測試付款 NT$1」。測試不會建立正式報告、出貨訂單或預約。
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {LINE_PAY_PRODUCTION_ONE_DOLLAR_ENTRY_DEFINITIONS.map((entry) => (
          <article
            className="rounded-2xl border border-[#bce9ce] bg-white p-5"
            key={entry.href}
          >
            <h3 className="font-serifTC text-xl font-semibold text-deepPurple">
              {entry.label}
            </h3>
            <p className="mt-2 text-sm leading-7 text-textMuted">
              {entry.instruction}
            </p>
            <Link
              className="focus-ring mt-4 inline-flex rounded-lg bg-[#06c755] px-4 py-2 text-sm font-semibold text-white"
              href={entry.href}
            >
              前往實際入口
            </Link>
          </article>
        ))}
      </div>
    </section>
  )
}
