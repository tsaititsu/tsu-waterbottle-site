import { DivinationEntryModule } from '@/components/DivinationEntryModule'
import { DivinationDrawPreview } from '@/components/divination/DivinationDrawPreview'
import { DivinationQuestionForm } from '@/components/divination/DivinationQuestionForm'
import { PageHero } from '@/components/PageHero'
import { shouldHideAiDivinationServices } from '@/lib/siteVisibility'
import { redirect } from 'next/navigation'

export default function AiDivinationPage() {
  if (shouldHideAiDivinationServices()) {
    redirect('/')
  }

  return (
    <>
      <PageHero
        eyebrow="紫微牌卡"
        title="紫微牌卡占卜"
        description="目前占卜功能保留在獨立系統，正式網站先提供安全入口。"
      />
      <section className="bg-white py-12 md:py-16">
        <div className="section-shell grid gap-8">
          <DivinationEntryModule />
          <section className="grid gap-4">
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-darkGold">本機開發預覽</p>
              <p className="mt-2 leading-7 text-textMuted">
                以下為正式網站內建占卜流程預覽，尚未連接付款、抽牌與 AI 解讀。
              </p>
            </div>
            <DivinationQuestionForm />
          </section>
          <section className="grid gap-4">
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-darkGold">抽牌流程預覽</p>
              <p className="mt-2 leading-7 text-textMuted">
                以下為正式網站內建抽牌流程預覽，尚未連接付款、牌義與 AI 解讀。
              </p>
            </div>
            <DivinationDrawPreview />
          </section>
        </div>
      </section>
    </>
  )
}
