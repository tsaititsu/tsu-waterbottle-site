import { ChartBirthForm } from '@/components/ChartBirthForm'
import { PageHero } from '@/components/PageHero'

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
        <div className="section-shell max-w-[1800px]">
          <ChartBirthForm />
        </div>
      </section>
    </>
  )
}
