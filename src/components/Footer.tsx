import Link from 'next/link'
import { LogoMark } from './LogoMark'
import type { GoogleAnalyticsCtaDestination } from '@/lib/analytics/googleAnalytics'
import { PUBLIC_BUSINESS_INFO } from '@/lib/publicBusinessInfo'
import { shouldHideConsultationServices, shouldHideCoursesServices } from '@/lib/siteVisibility'
import { TrackedPublicCtaLink } from './analytics/TrackedPublicCtaLink'

const serviceLinks = [
  { href: '/ai-chart', label: '紫微命盤分析', destination: 'ai_chart' },
  { href: '/ai-divination', label: '紫微牌卡占卜', destination: 'ai_divination' },
  { href: '/booking', label: '水瓶先生論命預約', destination: 'booking' },
  { href: '/courses', label: '紫微斗數課程', destination: 'courses' },
] as const satisfies readonly {
  href: string
  label: string
  destination: GoogleAnalyticsCtaDestination
}[]

const consumerLinks = [
  { href: '/terms', label: '服務條款' },
  { href: '/privacy', label: '隱私權政策' },
  { href: '/refund-policy', label: '退款政策' },
  { href: '/consumer-rights', label: '消費者權益' },
  { href: '/bank-transfer', label: '銀行匯款說明' },
  { href: '/contact', label: '聯絡我們' },
]

const visibleServiceLinks = serviceLinks.filter((link) => {
  if (link.label === '水瓶先生論命預約' && shouldHideConsultationServices()) return false
  if (link.label === '紫微斗數課程' && shouldHideCoursesServices()) return false
  return true
})

export function Footer() {
  return (
    <footer className="border-t border-[#eadff5] bg-[#fbf8ff]">
      <div className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-14">
        <div className="grid gap-9 lg:grid-cols-[1.55fr_0.75fr_0.75fr]">
          <section id="about-us" className="scroll-mt-28">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl border border-[#eadff5] bg-white p-2 shadow-soft">
                <LogoMark compact />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-darkGold">Waterbottle</p>
                <h2 className="mt-1 font-serifTC text-2xl font-semibold text-deepPurple">水瓶先生工作室</h2>
              </div>
            </div>
            <p className="mt-5 max-w-xl text-sm leading-7 text-textMuted">
              用簡單直覺的方式，看懂自己的命盤、問題與未來方向。
            </p>

            <div className="mt-6 grid gap-2 text-sm leading-6 text-textMuted">
              <p>實體服務地點：{PUBLIC_BUSINESS_INFO.serviceAddressLabel}</p>
              <p>實體服務：採預約制，不接受未預約來訪</p>
              <p>實體預約時段：{PUBLIC_BUSINESS_INFO.appointmentHoursLabel}</p>
              <p>客服時間：{PUBLIC_BUSINESS_INFO.customerServiceHoursLabel}</p>
              <p>
                客服信箱：
                <a className="break-all font-semibold text-deepPurple underline decoration-deepPurple/25 underline-offset-4 transition hover:text-darkGold hover:decoration-darkGold" href={`mailto:${PUBLIC_BUSINESS_INFO.email}`}>
                  {PUBLIC_BUSINESS_INFO.email}
                </a>
              </p>
              <p>
                客服 LINE：
                <TrackedPublicCtaLink
                  className="font-semibold text-deepPurple underline decoration-deepPurple/25 underline-offset-4 transition hover:text-[#06c755] hover:decoration-[#06c755]"
                  destination="line_official_account"
                  href={PUBLIC_BUSINESS_INFO.lineUrl}
                  placement="footer_line"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  加入 LINE 官方帳號
                </TrackedPublicCtaLink>
              </p>
              <p>營業人名稱：{PUBLIC_BUSINESS_INFO.legalName}</p>
              <p>統一編號：{PUBLIC_BUSINESS_INFO.taxId}</p>
              <p>商業登記地址（非實體服務地點）：{PUBLIC_BUSINESS_INFO.registrationAddress}</p>
              <p>{PUBLIC_BUSINESS_INFO.registrationAddressNote}</p>
            </div>
          </section>

        <nav aria-label="服務連結">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-darkGold">服務</h3>
          <div className="mt-5 grid gap-3 text-sm text-textMuted">
            {visibleServiceLinks.map((link) => (
              <TrackedPublicCtaLink
                className="transition hover:text-deepPurple"
                destination={link.destination}
                href={link.href}
                key={link.href}
                placement="footer_service"
              >
                {link.label}
              </TrackedPublicCtaLink>
            ))}
          </div>
        </nav>

          <nav aria-label="消費資訊連結">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-darkGold">消費資訊</h3>
            <div className="mt-5 grid gap-3 text-sm text-textMuted">
              {consumerLinks.map((link) => (
                <Link className="transition hover:text-deepPurple" href={link.href} key={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>

        <div className="mt-10 border-t border-[#eadff5] pt-6 text-xs leading-6 text-textMuted md:flex md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} 水瓶先生工作室. All rights reserved.</p>
          <p className="mt-2 md:mt-0">紫微斗數與占卜內容供自我探索參考，不取代專業意見。</p>
        </div>
      </div>
    </footer>
  )
}
