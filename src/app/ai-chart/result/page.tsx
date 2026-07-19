import '@/features/ziwei-chart/original-chart.css'
import './result-chart.css'
import { ChartResultSessionView } from '@/components/ChartResultSessionView'
import { PageHero } from '@/components/PageHero'

export default function AiChartSessionResultPage() {
  return (
    <>
      <PageHero
        eyebrow="AI Zi Wei Chart"
        title="紫微命盤分析"
        description="先確認完整命盤，再選擇是否進行 AI 命盤分析。"
      />
      <section className="bg-white py-12 md:py-16">
        <div className="section-shell grid max-w-[1800px] gap-8">
          <ChartResultSessionView />
        </div>
      </section>
    </>
  )
}
