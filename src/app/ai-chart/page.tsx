import { ChartBirthForm } from '@/components/ChartBirthForm'
import { PageHero } from '@/components/PageHero'

const serviceRows = [
  ['服務名稱', '紫微命盤完整分析'],
  ['價格', 'NT$100 / 份'],
  ['服務內容', '完整解析命盤個性分析'],
  ['交付方式', '付款後於網站產生命盤分析結果'],
  ['是否預約制', '否'],
  ['是否訂閱制', '否'],
  ['是否儲值式', '否'],
]

export default function AiChartPage() {
  return (
    <>
      <PageHero
        eyebrow="紫微命盤"
        title="紫微命盤分析"
        description="填寫出生資料，完成分析後會建立命盤分析紀錄並保存到會員中心。"
        contentClassName="section-shell max-w-[1400px]"
        centered
        sectionClassName="pt-8 pb-4 md:pt-10 md:pb-6"
      />
      <section className="bg-white pt-3 pb-10 md:pt-4 md:pb-12">
        <div className="section-shell grid max-w-[1800px] gap-8">
          <section className="rounded-2xl border border-borderSoft bg-softPurple p-6 md:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-darkGold">Service Notice</p>
            <h2 className="mt-3 font-serifTC text-3xl font-semibold text-deepPurple">AI 命盤分析服務說明</h2>
            <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {serviceRows.map(([label, value]) => (
                <div key={label} className="rounded-xl bg-white px-4 py-3">
                  <p className="font-semibold text-deepPurple">{label}</p>
                  <p className="mt-1 leading-6 text-textMuted">{value}</p>
                </div>
              ))}
            </div>
          </section>
          <ChartBirthForm />
        </div>
      </section>
    </>
  )
}
