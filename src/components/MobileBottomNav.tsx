'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, CalendarCheck, Home, MoonStar, Sparkles, UserRound } from 'lucide-react'
import type { GoogleAnalyticsCtaDestination } from '@/lib/analytics/googleAnalytics'
import {
  shouldHideConsultationServices,
  shouldHideCoursesServices,
} from '@/lib/siteVisibility'
import { TrackedPublicCtaLink } from './analytics/TrackedPublicCtaLink'
import {
  getMobileBottomNavigationItemKeys,
  type MobileBottomNavigationItemKey,
} from './mobileBottomNavigationItems'

const itemsByKey = {
  home: { label: '首頁', href: '/', icon: Home },
  'ai-chart': { label: '命盤', href: '/ai-chart', icon: MoonStar },
  'ai-divination': { label: '占卜', href: '/ai-divination', icon: Sparkles },
  booking: { label: '預約', href: '/booking', icon: CalendarCheck },
  courses: { label: '課程', href: '/courses', icon: BookOpen },
  account: { label: '我的', href: '/account', icon: UserRound },
} satisfies Record<
  MobileBottomNavigationItemKey,
  { label: string; href: string; icon: typeof Home }
>

const mobileCtaDestinationByHref: Partial<Record<string, GoogleAnalyticsCtaDestination>> = {
  '/ai-chart': 'ai_chart',
  '/ai-divination': 'ai_divination',
  '/booking': 'booking',
  '/courses': 'courses',
}

export function MobileBottomNav() {
  const pathname = usePathname()
  const visibleItems = getMobileBottomNavigationItemKeys({
    hideConsultationServices: shouldHideConsultationServices(),
    hideCoursesServices: shouldHideCoursesServices(),
  }).map((key) => itemsByKey[key])
  const gridColumnsClassName = visibleItems.length === 4 ? 'grid-cols-4' : 'grid-cols-5'

  return (
    <>
      <div
        aria-hidden="true"
        className="mobile-bottom-nav-spacer h-[calc(var(--mobile-bottom-nav-height)+env(safe-area-inset-bottom,0px))] md:hidden"
      />
      <nav
        aria-label="手機主要導覽"
        className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-40 border-t border-borderSoft bg-white/95 px-2 pt-2 shadow-soft backdrop-blur md:hidden"
      >
        <div className={`grid ${gridColumnsClassName}`}>
          {visibleItems.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href
            const destination = mobileCtaDestinationByHref[item.href]
            const className = `flex flex-col items-center gap-1 rounded-lg py-2 text-xs ${active ? 'text-deepPurple' : 'text-textMuted'}`
            const contents = (
              <>
                <Icon size={19} />
                <span>{item.label}</span>
              </>
            )

            return destination ? (
              <TrackedPublicCtaLink
                key={item.href}
                className={className}
                destination={destination}
                href={item.href}
                placement="mobile_bottom_nav"
              >
                {contents}
              </TrackedPublicCtaLink>
            ) : (
              <Link key={item.href} href={item.href} className={className}>
                {contents}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
