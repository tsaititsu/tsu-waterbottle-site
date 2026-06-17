import { DivinationEntryModule } from '@/components/DivinationEntryModule'
import { PageHero } from '@/components/PageHero'

export default function AiDivinationPage() {
  return (
    <>
      <PageHero
        eyebrow="紫微牌卡"
        title="紫微牌卡占卜"
        description="目前占卜功能保留在獨立系統，正式網站先提供安全入口。"
      />
      <section className="bg-white py-12 md:py-16">
        <div className="section-shell">
          <DivinationEntryModule />
        </div>
      </section>
    </>
  )
}
