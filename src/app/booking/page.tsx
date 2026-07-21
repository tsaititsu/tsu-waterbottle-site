import type { Metadata } from 'next'
import { BookingPageShell } from '@/components/BookingPageShell'
import { PageHero } from '@/components/PageHero'
import { shouldHideConsultationServices } from '@/lib/siteVisibility'
import { redirect } from 'next/navigation'
import { createPublicMetadata, PUBLIC_PAGE_METADATA } from '@/lib/seo/publicMetadata'
import { BOOKING_SERVICE_JSON_LD, serializeJsonLd } from '@/lib/seo/serviceJsonLd'

export const metadata: Metadata = createPublicMetadata(PUBLIC_PAGE_METADATA.booking)

export default function BookingPage() {
  if (shouldHideConsultationServices()) {
    redirect('/')
  }

  return (
    <>
      <script
        id="booking-service-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(BOOKING_SERVICE_JSON_LD) }}
      />
      <PageHero
        eyebrow="真人預約"
        title="水瓶先生論命預約"
        description="由老師一對一協助你看懂命盤、感情、事業、財運與流年方向。"
      />
      <section className="bg-white py-12 md:py-16">
        <div className="section-shell">
          <BookingPageShell />
        </div>
      </section>
    </>
  )
}
