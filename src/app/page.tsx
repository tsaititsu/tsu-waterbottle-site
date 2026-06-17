import { CoursePreview } from '@/components/CoursePreview'
import { HeroSection } from '@/components/HeroSection'
import { MemberBenefits } from '@/components/MemberBenefits'
import { PricingSection } from '@/components/PricingSection'
import { ProcessSteps } from '@/components/ProcessSteps'
import { ServiceCards } from '@/components/ServiceCards'

export default function Home() {
  return (
    <>
      <HeroSection />
      <ServiceCards />
      <ProcessSteps />
      <PricingSection />
      <CoursePreview />
      <MemberBenefits />
    </>
  )
}
