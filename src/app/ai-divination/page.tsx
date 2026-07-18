import type { Metadata } from 'next'
import { Suspense } from 'react'
import { DivinationEntryModule } from '@/components/DivinationEntryModule'
import { DivinationSearchParamsBridge } from '@/components/divination/DivinationSearchParamsBridge'
import { PageHero } from '@/components/PageHero'
import { shouldHideAiDivinationServices } from '@/lib/siteVisibility'
import { redirect } from 'next/navigation'
import { createPublicMetadata, PUBLIC_PAGE_METADATA } from '@/lib/seo/publicMetadata'
import { AI_DIVINATION_SERVICE_JSON_LD, serializeJsonLd } from '@/lib/seo/serviceJsonLd'

export const metadata: Metadata = createPublicMetadata(PUBLIC_PAGE_METADATA.aiDivination)

export default function AiDivinationPage() {
  if (shouldHideAiDivinationServices()) {
    redirect('/')
  }

  return (
    <>
      <script
        id="ai-divination-service-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(AI_DIVINATION_SERVICE_JSON_LD) }}
      />
      <PageHero
        eyebrow="紫微牌卡"
        title="紫微牌卡占卜"
        description="輸入你的問題，抽一張紫微牌卡，AI 立即為你深度解讀。抽牌免費，AI 解讀每次 NT$50。"
      />
      <section className="bg-white py-12 md:py-16">
        <div className="section-shell grid gap-8">
          <DivinationEntryModule />
          <Suspense fallback={null}>
            <DivinationSearchParamsBridge />
          </Suspense>
        </div>
      </section>
    </>
  )
}
