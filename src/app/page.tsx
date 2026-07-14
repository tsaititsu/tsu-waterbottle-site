import type { Metadata } from 'next'
import { CoursePreview } from '@/components/CoursePreview'
import { CustomerFeedback } from '@/components/CustomerFeedback'
import { HeroSection } from '@/components/HeroSection'
import { PricingSection } from '@/components/PricingSection'
import { ProcessSteps } from '@/components/ProcessSteps'
import { ServiceCards } from '@/components/ServiceCards'
import { HOMEPAGE_JSON_LD, serializeJsonLd } from '@/lib/seo/homepageJsonLd'
import { createPublicMetadata, PUBLIC_PAGE_METADATA } from '@/lib/seo/publicMetadata'

export const metadata: Metadata = createPublicMetadata(PUBLIC_PAGE_METADATA.home)

export default function Home() {
  return (
    <>
      <script
        id="homepage-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(HOMEPAGE_JSON_LD) }}
      />
      <HeroSection />
      <ServiceCards />
      <CustomerFeedback />
      <ProcessSteps />
      <PricingSection />
      <CoursePreview />
    </>
  )
}
