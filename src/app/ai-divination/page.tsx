import { DivinationEntryModule } from '@/components/DivinationEntryModule'
import { PageHero } from '@/components/PageHero'

const serviceRows = [
  ['服務名稱', '紫微牌卡占卜單次'],
  ['價格', 'NT$50 / 次'],
  ['服務內容', '針對單一問題提供牌卡指引與文字解析'],
  ['交付方式', '付款後於網站產生占卜結果'],
  ['是否預約制', '否'],
  ['是否訂閱制', '否'],
  ['是否儲值式', '否'],
]

export default function AiDivinationPage() {
  return (
    <>
      <PageHero
        eyebrow="紫微牌卡"
        title="紫微牌卡占卜"
        description="目前占卜功能保留在獨立系統，正式網站先提供安全入口。"
      />
      <section className="bg-white py-12 md:py-16">
        <div className="section-shell grid gap-8">
          <section className="rounded-2xl border border-borderSoft bg-softPurple p-6 md:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-darkGold">Service Notice</p>
            <h2 className="mt-3 font-serifTC text-3xl font-semibold text-deepPurple">AI 占卜服務說明</h2>
            <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {serviceRows.map(([label, value]) => (
                <div key={label} className="rounded-xl bg-white px-4 py-3">
                  <p className="font-semibold text-deepPurple">{label}</p>
                  <p className="mt-1 leading-6 text-textMuted">{value}</p>
                </div>
              ))}
            </div>
          </section>
          <DivinationEntryModule />
        </div>
      </section>
    </>
  )
}
