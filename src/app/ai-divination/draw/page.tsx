import { DivinationDrawStepPage } from '@/components/divination/DivinationDrawStepPage'
import { PageHero } from '@/components/PageHero'
import { shouldHideAiDivinationServices } from '@/lib/siteVisibility'
import { redirect } from 'next/navigation'

export default function AiDivinationDrawPage() {
  if (shouldHideAiDivinationServices()) {
    redirect('/')
  }

  return (
    <>
      <PageHero
        eyebrow="紫微牌卡"
        title="紫微牌卡抽牌"
        description="依照你選擇的抽牌方式，完成抽牌後再進入 AI 解讀。"
      />
      <section className="bg-white py-12 md:py-16">
        <div className="section-shell">
          <DivinationDrawStepPage />
        </div>
      </section>
    </>
  )
}
