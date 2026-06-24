import Link from 'next/link'
import { PageHero } from '@/components/PageHero'

const lineSupportUrl = 'https://lin.ee/6Tpje1P'

const bankRows = [
  ['銀行名稱', '中華郵政'],
  ['銀行代碼', '700'],
  ['分行／郵局', '田尾郵局'],
  ['戶名', '蔡題簇'],
  ['局號', '0081359'],
  ['帳號', '0146512'],
  ['轉帳帳號', '00813590146512'],
]

export default function BankTransferPage() {
  return (
    <>
      <PageHero
        eyebrow="Bank Transfer"
        title="銀行匯款付款說明"
        description="如您選擇銀行匯款，請依照下方帳戶資訊完成轉帳。匯款完成後，請填寫匯款回報表單，並加入水瓶先生官方 LINE 回覆「已匯款＋姓名＋購買項目」，客服確認款項後將協助開通服務或確認預約。"
      />
      <section className="bg-white py-12 md:py-16">
        <div className="section-shell grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-borderSoft bg-softPurple p-6 shadow-soft md:p-8">
            <p className="text-sm font-semibold text-darkGold">匯款帳戶</p>
            <h2 className="mt-2 font-serifTC text-3xl font-semibold text-deepPurple">中華郵政匯款資訊</h2>
            <div className="mt-6 grid gap-3">
              {bankRows.map(([label, value]) => (
                <div className="grid gap-2 rounded-xl bg-white px-4 py-3 md:grid-cols-[140px_1fr]" key={label}>
                  <p className="font-semibold text-deepPurple">{label}</p>
                  <p className="font-semibold text-textDark">{value}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 rounded-xl border border-lightGold bg-white px-4 py-3 text-sm font-semibold leading-7 text-darkGold">
              郵局帳號為「局號＋帳號」，轉帳時請輸入完整 14 碼：00813590146512。
            </p>
          </section>

          <aside className="rounded-2xl border border-borderSoft bg-white p-6 shadow-soft md:p-8">
            <h2 className="font-serifTC text-2xl font-semibold text-deepPurple">匯款後請完成回報</h2>
            <p className="mt-4 leading-8 text-textMuted">
              請填寫「您的匯款帳號後五碼」，不是本工作室收款帳號後五碼。送出後資料會進入人工確認，不會自動開通課程、確認預約或產生 AI 報告。
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <Link className="focus-ring rounded-lg bg-deepPurple px-5 py-3 text-center font-semibold text-white" href="/bank-transfer/submit">
                填寫匯款回報
              </Link>
              <a
                className="focus-ring rounded-lg bg-[#06c755] px-5 py-3 text-center font-semibold text-white"
                href={lineSupportUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                加入官方 LINE
              </a>
            </div>
          </aside>
        </div>
      </section>
    </>
  )
}
