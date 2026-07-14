import type { Metadata } from 'next'
import { ChartBirthForm } from '@/components/ChartBirthForm'
import { PageHero } from '@/components/PageHero'
import { createPublicMetadata, PUBLIC_PAGE_METADATA } from '@/lib/seo/publicMetadata'

export const metadata: Metadata = createPublicMetadata(PUBLIC_PAGE_METADATA.aiChart)

type AiChartPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export default async function AiChartPage({ searchParams }: AiChartPageProps) {
  const resolvedSearchParams = await searchParams
  const resetKey = getSingleParam(resolvedSearchParams.reset)

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
          <ChartBirthForm resetKey={resetKey} />
        </div>
      </section>
    </>
  )
}
