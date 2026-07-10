import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { ZiweiChartPreview } from './ZiweiChartPreview'
import { shouldHideConsultationServices, shouldHideCoursesServices } from '@/lib/siteVisibility'

export function HeroSection() {
  const hideConsultation = shouldHideConsultationServices()
  const hideCourses = shouldHideCoursesServices()
  const showBookingCta = !hideConsultation

  return (
    <section className="hero-cosmos overflow-hidden">
      <div className="hero-section-shell section-shell grid min-h-[610px] min-w-0 max-w-full items-center gap-10 py-12 md:grid-cols-[0.95fr_1.05fr] md:py-16">
        <div className="relative z-10 min-w-0 max-w-full">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-lightGold bg-white/80 px-4 py-2 text-sm font-semibold text-darkGold shadow-soft backdrop-blur">
            <Sparkles size={16} />
            WATERBOTTLE 紫微命理
          </div>
          <h1 className="min-w-0 max-w-full break-words font-serifTC text-[30px] font-semibold leading-[1.2] text-deepPurple sm:max-w-2xl sm:text-[42px] sm:leading-[1.25] md:text-[52px] md:leading-[1.32]">
            <span className="block max-w-full whitespace-normal">
              <span className="block sm:inline">紫微命盤分析 ×</span>{' '}
              <span className="block sm:inline">紫微牌卡占卜</span>
            </span>
            {!hideConsultation || !hideCourses ? <span className="mt-2 block max-w-full whitespace-normal">{!hideConsultation ? '水瓶先生論命' : '紫微課程'}</span> : null}
          </h1>
          <p className="mt-6 min-w-0 max-w-xl whitespace-normal text-base leading-7 text-textMuted sm:text-lg sm:leading-8">
            用簡單直覺的方式，看懂自己的命盤、問題與未來方向。
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link className="focus-ring rounded-lg bg-deepPurple px-8 py-3.5 text-center font-semibold text-white shadow-soft" href="/ai-chart">
              立即開始分析
            </Link>
            {showBookingCta ? (
              <Link
                className="focus-ring rounded-lg border border-gold bg-white/85 px-8 py-3.5 text-center font-semibold text-darkGold backdrop-blur"
                href="/booking"
              >
                預約水瓶先生論命
              </Link>
            ) : null}
          </div>
        </div>
        <div className="relative z-10 min-w-0 max-w-full">
          <ZiweiChartPreview />
        </div>
      </div>
    </section>
  )
}
