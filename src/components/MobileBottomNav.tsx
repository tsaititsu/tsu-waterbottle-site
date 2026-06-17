'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Home, MoonStar, Sparkles, UserRound } from 'lucide-react'

const items = [
  { label: '首頁', href: '/', icon: Home },
  { label: '命盤', href: '/ai-chart', icon: MoonStar },
  { label: '占卜', href: '/ai-divination', icon: Sparkles },
  { label: '課程', href: '/courses', icon: BookOpen },
  { label: '我的', href: '/account', icon: UserRound }
]

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-borderSoft bg-white/95 px-2 py-2 shadow-soft backdrop-blur md:hidden">
      <div className="grid grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-1 rounded-lg py-2 text-xs ${active ? 'text-deepPurple' : 'text-textMuted'}`}>
              <Icon size={19} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
