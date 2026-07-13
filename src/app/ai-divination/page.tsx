import { DivinationEntryModule } from '@/components/DivinationEntryModule'
import { DivinationLocalPreview } from '@/components/divination/DivinationLocalPreview'
import { PageHero } from '@/components/PageHero'
import { shouldHideAiDivinationServices } from '@/lib/siteVisibility'
import { redirect } from 'next/navigation'

type AiDivinationPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export default async function AiDivinationPage({ searchParams }: AiDivinationPageProps) {
  if (shouldHideAiDivinationServices()) {
    redirect('/')
  }

  const resolvedSearchParams = await searchParams
  const resetKey = getSingleParam(resolvedSearchParams.reset)
  const followUpKey = getSingleParam(resolvedSearchParams.followUp)

  return (
    <>
      <PageHero
        eyebrow="紫微牌卡"
        title="紫微牌卡占卜"
        description="輸入你的問題，抽一張紫微牌卡，AI 立即為你深度解讀。抽牌免費，AI 解讀每次 NT$50。"
      />
      <section className="bg-white py-12 md:py-16">
        <div className="section-shell grid gap-8">
          <DivinationEntryModule />
          <DivinationLocalPreview resetKey={resetKey} followUpKey={followUpKey} />
        </div>
      </section>
    </>
  )
}
