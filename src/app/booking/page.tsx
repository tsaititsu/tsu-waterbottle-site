import type { Metadata } from 'next'
import { BookingForm } from '@/components/BookingForm'
import { PageHero } from '@/components/PageHero'
import { AddConsultationToCartButton } from '@/components/AddConsultationToCartButton'
import { shouldHideConsultationServices } from '@/lib/siteVisibility'
import { redirect } from 'next/navigation'
import { createPublicMetadata, PUBLIC_PAGE_METADATA } from '@/lib/seo/publicMetadata'

export const metadata: Metadata = createPublicMetadata(PUBLIC_PAGE_METADATA.booking)

type BookingPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export default async function BookingPage({ searchParams }: BookingPageProps) {
  if (shouldHideConsultationServices()) {
    redirect('/')
  }

  const resolvedSearchParams = await searchParams
  const resetKey = getSingleParam(resolvedSearchParams.reset)

  return (
    <>
      <PageHero
        eyebrow="真人預約"
        title="水瓶先生論命預約"
        description="由老師一對一協助你看懂命盤、感情、事業、財運與流年方向。"
      />
      <section className="bg-white py-12 md:py-16">
        <div className="section-shell grid gap-8">
          <AddConsultationToCartButton />
          <BookingForm resetKey={resetKey} />
        </div>
      </section>
    </>
  )
}
