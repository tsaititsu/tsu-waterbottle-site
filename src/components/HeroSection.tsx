import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { ZiweiChartPreview } from './ZiweiChartPreview'

export function HeroSection() {
  return (
    <section className="hero-cosmos overflow-hidden">
      <div className="section-shell grid min-h-[610px] items-center gap-10 py-12 md:grid-cols-[0.95fr_1.05fr] md:py-16">
        <div className="relative z-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-lightGold bg-white/80 px-4 py-2 text-sm font-semibold text-darkGold shadow-soft backdrop-blur">
            <Sparkles size={16} />
            WATERBOTTLE 紫微命理
          </div>
          <h1 className="max-w-2xl font-serifTC text-[34px] font-semibold leading-[1.32] text-deepPurple sm:text-[42px] md:text-[52px]">
            <span className="block whitespace-nowrap">紫微命盤分析 × 紫微牌卡占卜</span>
            <span className="mt-2 block whitespace-nowrap">水瓶先生論命 × 紫微課程</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-textMuted">
            用簡單直覺的方式，看懂自己的命盤、問題與未來方向。
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link className="focus-ring rounded-lg bg-deepPurple px-8 py-3.5 text-center font-semibold text-white shadow-soft" href="/ai-chart">
              立即開始分析
            </Link>
            <Link className="focus-ring rounded-lg border border-gold bg-white/85 px-8 py-3.5 text-center font-semibold text-darkGold backdrop-blur" href="/booking">
              預約水瓶先生論命
            </Link>
          </div>
        </div>
        <div className="relative z-10">
          <ZiweiChartPreview />
        </div>
      </div>
    </section>
  )
}
