import { CoursePreview } from '@/components/CoursePreview'
import { CustomerFeedback } from '@/components/CustomerFeedback'
import { HeroSection } from '@/components/HeroSection'
import { PricingSection } from '@/components/PricingSection'
import { ProcessSteps } from '@/components/ProcessSteps'
import { ServiceCards } from '@/components/ServiceCards'

export default function Home() {
  return (
    <>
      <HeroSection />
      <ServiceCards />
      <CustomerFeedback />
      <ProcessSteps />
      <PricingSection />
      <CoursePreview />
    </>
  )
}
