'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Home, MoonStar, Sparkles, UserRound } from 'lucide-react'
import type { GoogleAnalyticsCtaDestination } from '@/lib/analytics/googleAnalytics'
import { shouldHideCoursesServices } from '@/lib/siteVisibility'
import { TrackedPublicCtaLink } from './analytics/TrackedPublicCtaLink'

const items = [
  { label: '首頁', href: '/', icon: Home },
  { label: '命盤', href: '/ai-chart', icon: MoonStar },
  { label: '占卜', href: '/ai-divination', icon: Sparkles },
  { label: '課程', href: '/courses', icon: BookOpen },
  { label: '我的', href: '/account', icon: UserRound }
]

const mobileCtaDestinationByHref: Partial<Record<string, GoogleAnalyticsCtaDestination>> = {
  '/ai-chart': 'ai_chart',
  '/ai-divination': 'ai_divination',
  '/courses': 'courses',
}

const visibleItems = items.filter((item) => {
  if (item.label === '課程' && shouldHideCoursesServices()) return false
  return true
})

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="手機主要導覽"
      className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-40 border-t border-borderSoft bg-white/95 px-2 pt-2 shadow-soft backdrop-blur md:hidden"
    >
      <div className={`grid ${shouldHideCoursesServices() ? 'grid-cols-4' : 'grid-cols-5'}`}>
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
  )
}
