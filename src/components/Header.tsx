'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BookOpen, CalendarCheck, FileText, LogOut, Menu, ScrollText, ShoppingCart, Sparkles, UserRound, X } from 'lucide-react'
import { type MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { GoogleAnalyticsCtaDestination } from '@/lib/analytics/googleAnalytics'
import {
  getMockUser,
  loginWithProvider,
  logoutMockUser,
  subscribeAuthChange,
  type UserProfile
} from '@/lib/mockAuth'
import {
  shouldHideAiDivinationServices,
  shouldHideConsultationServices,
  shouldHideCoursesServices
} from '@/lib/siteVisibility'
import { LogoMark } from './LogoMark'
import { useCart } from './CartContext'
import { TrackedPublicCtaLink } from './analytics/TrackedPublicCtaLink'

const navItems = [
  { label: '首頁', href: '/' },
  { label: '紫微命盤分析', href: '/ai-chart' },
  { label: '紫微牌卡占卜', href: '/ai-divination' },
  { label: '開運商品', href: '/spiritual-products' },
  { label: '水瓶先生論命', href: '/booking' },
  { label: '紫微課程', href: '/courses' },
  { label: '關於我們', href: '/#about-us' }
]

const headerCtaDestinationByHref: Partial<Record<string, GoogleAnalyticsCtaDestination>> = {
  '/ai-chart': 'ai_chart',
  '/ai-divination': 'ai_divination',
  '/spiritual-products': 'spiritual_products',
  '/booking': 'booking',
  '/courses': 'courses',
}

const visibleNavItems = navItems.filter((item) => {
  if (item.label === '紫微牌卡占卜' && shouldHideAiDivinationServices()) return false
  if (item.label === '水瓶先生論命' && shouldHideConsultationServices()) return false
  if (item.label === '紫微課程' && shouldHideCoursesServices()) return false
  return true
})

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement | null>(null)
  const [loginMessage, setLoginMessage] = useState('')
  const [loadingProvider, setLoadingProvider] = useState<'line' | 'google' | ''>('')
  const [user, setUser] = useState<UserProfile | null>(null)
  const { totalQuantity } = useCart()
  const hideAiDivinationServices = shouldHideAiDivinationServices()
  const hideConsultationServices = shouldHideConsultationServices()
  const hideCoursesServices = shouldHideCoursesServices()

  useEffect(() => {
    const sync = () => setUser(getMockUser())
    sync()
    return subscribeAuthChange(sync)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
    setAccountMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) {
      delete document.documentElement.dataset.mobileMenuOpen
      return
    }

    const previousBodyOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.documentElement.dataset.mobileMenuOpen = 'true'
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      delete document.documentElement.dataset.mobileMenuOpen
      document.body.style.overflow = previousBodyOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!accountMenuOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (accountMenuRef.current?.contains(event.target as Node)) return
      setAccountMenuOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [accountMenuOpen])

  const handleProviderLogin = async (provider: 'line' | 'google') => {
    setLoginMessage('')
    setLoadingProvider(provider)

    try {
      await loginWithProvider(provider)
    } catch (error) {
      setLoadingProvider('')
      setLoginMessage(error instanceof Error ? error.message : '登入暫時失敗，請稍後再試。')
    }
  }

  const handleLogout = () => {
    logoutMockUser()
    setAccountMenuOpen(false)
    setMenuOpen(false)
    router.push('/')
  }

  const accountMenu = user ? (
    <div className="absolute right-0 top-[calc(100%+14px)] z-50 w-[340px] overflow-hidden rounded-[20px] bg-[#050505] text-white shadow-2xl ring-1 ring-white/10">
      <div className="bg-[#1c1c1f] px-7 py-6">
        <p className="text-lg font-semibold">{user.displayName || 'WATERBOTTLE 會員'}</p>
        {user.googleEmail ? <p className="mt-1 text-sm text-white/60">{user.googleEmail}</p> : null}
      </div>
      <nav className="grid py-3 text-lg font-semibold">
        <Link href="/account" onClick={() => setAccountMenuOpen(false)} className="flex items-center gap-5 px-7 py-4 transition hover:bg-white/10">
          <UserRound size={22} />
          會員中心
        </Link>
        {!hideCoursesServices ? (
          <Link href="/account/courses" onClick={() => setAccountMenuOpen(false)} className="flex items-center gap-5 px-7 py-4 transition hover:bg-white/10">
            <BookOpen size={22} />
            我的課程
          </Link>
        ) : null}
        {!hideConsultationServices ? (
          <Link href="/account/bookings" onClick={() => setAccountMenuOpen(false)} className="flex items-center gap-5 px-7 py-4 transition hover:bg-white/10">
            <CalendarCheck size={22} />
            我的預約
          </Link>
        ) : null}
        <Link href="/ai-chart" onClick={() => setAccountMenuOpen(false)} className="flex items-center gap-5 px-7 py-4 transition hover:bg-white/10">
          <FileText size={22} />
          命盤紀錄
        </Link>
        <Link href="/account/divinations" onClick={() => setAccountMenuOpen(false)} className="flex items-center gap-5 px-7 py-4 transition hover:bg-white/10">
          <ScrollText size={22} />
          我的占卜紀錄
        </Link>
        {!hideAiDivinationServices ? (
          <Link href="/ai-divination" onClick={() => setAccountMenuOpen(false)} className="flex items-center gap-5 px-7 py-4 transition hover:bg-white/10">
            <Sparkles size={22} />
            紫微牌卡占卜
          </Link>
        ) : null}
      </nav>
      <button
        type="button"
        onClick={handleLogout}
        className="flex w-full items-center gap-5 border-t border-white/15 bg-[#1c1c1f] px-7 py-5 text-left text-lg font-semibold transition hover:bg-white/10"
      >
        <LogOut size={22} />
        登出
      </button>
    </div>
  ) : (
    <div className="absolute right-0 top-[calc(100%+14px)] z-50 w-[340px] overflow-hidden rounded-[20px] bg-[#050505] text-white shadow-2xl ring-1 ring-white/10">
      <div className="bg-[#1c1c1f] px-7 py-6">
        <p className="text-lg font-semibold">會員登入</p>
        <p className="mt-1 text-sm leading-relaxed text-white/60">登入後可保存命盤、預約與課程紀錄。</p>
      </div>
      <div className="grid gap-3 p-5">
        <button
          type="button"
          onClick={() => handleProviderLogin('google')}
          disabled={loadingProvider !== ''}
          className="flex h-12 items-center justify-center gap-3 rounded-md bg-[#303036] text-base font-semibold transition hover:bg-[#3b3b42] disabled:cursor-not-allowed disabled:opacity-70"
        >
          <span className="text-xl font-bold text-[#4285f4]">G</span>
          {loadingProvider === 'google' ? '前往 Google...' : '使用 Google 帳號'}
        </button>
        <button
          type="button"
          onClick={() => handleProviderLogin('line')}
          disabled={loadingProvider !== ''}
          className="flex h-12 items-center justify-center gap-3 rounded-md bg-[#303036] text-base font-semibold transition hover:bg-[#3b3b42] disabled:cursor-not-allowed disabled:opacity-70"
        >
          <span className="rounded bg-[#06c755] px-2 py-1 text-xs font-bold text-white">LINE</span>
          {loadingProvider === 'line' ? '準備中...' : '使用 LINE 帳號'}
        </button>
        {loginMessage ? <p className="rounded-md bg-white/10 px-3 py-2 text-sm text-white/75">{loginMessage}</p> : null}
      </div>
    </div>
  )

  const mobileAuthActions = user ? (
    <div className="grid gap-3">
      <Link href="/account" onClick={() => setMenuOpen(false)} className="rounded-xl border border-[#e8dff2] px-4 py-3 text-center font-semibold">
        會員中心
      </Link>
      {!hideCoursesServices ? (
        <Link href="/account/courses" onClick={() => setMenuOpen(false)} className="rounded-xl border border-[#e8dff2] px-4 py-3 text-center font-semibold">
          我的課程
        </Link>
      ) : null}
      <Link href="/account/divinations" onClick={() => setMenuOpen(false)} className="rounded-xl border border-[#e8dff2] px-4 py-3 text-center font-semibold">
        我的占卜紀錄
      </Link>
      <button type="button" onClick={handleLogout} className="rounded-xl bg-[#3d0d74] px-4 py-3 font-semibold text-white">
        登出
      </button>
    </div>
  ) : (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={() => handleProviderLogin('line')}
        disabled={loadingProvider !== ''}
        className="rounded-xl bg-[#06c755] px-4 py-3 font-semibold text-white disabled:opacity-70"
      >
        LINE 登入
      </button>
      <button
        type="button"
        onClick={() => handleProviderLogin('google')}
        disabled={loadingProvider !== ''}
        className="rounded-xl border border-[#e8dff2] px-4 py-3 font-semibold disabled:opacity-70"
      >
        Google 登入
      </button>
      {loginMessage ? <p className="rounded-xl bg-[#f7f1fb] px-4 py-3 text-sm font-semibold text-[#3d0d74]">{loginMessage}</p> : null}
    </div>
  )

  return (
    <>
      <header className="site-header sticky top-0 z-50 border-b border-borderSoft/70 bg-white/94 shadow-[0_8px_30px_rgba(31,27,46,0.04)] backdrop-blur">
        <div className="mx-auto flex h-[var(--mobile-header-height)] w-[min(1480px,calc(100%-28px))] items-center justify-between gap-4 lg:h-[var(--desktop-header-height)] lg:w-[min(1480px,calc(100%-40px))] lg:gap-8">
          <Link href="/" aria-label="回到首頁">
            <LogoMark />
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-12 text-lg font-semibold text-textDark lg:flex">
            {visibleNavItems.map((item) => {
              const destination = headerCtaDestinationByHref[item.href]
              const className = `relative py-2 ${pathname === item.href ? 'text-deepPurple' : 'hover:text-purpleMain'}`
              const handleClick = (event: ReactMouseEvent<HTMLAnchorElement>) => {
                if (item.href !== '/ai-chart' && item.href !== '/booking' && item.href !== '/ai-divination') return
                event.preventDefault()
                router.push(`${item.href}?reset=${Date.now()}`)
              }

              return destination ? (
                <TrackedPublicCtaLink
                  key={item.href}
                  className={className}
                  destination={destination}
                  href={item.href}
                  onClick={handleClick}
                  placement="header_desktop"
                >
                  {item.label}
                </TrackedPublicCtaLink>
              ) : (
                <Link key={item.href} className={className} href={item.href} onClick={handleClick}>
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div ref={accountMenuRef} className="relative hidden items-center gap-3 lg:flex">
            <Link
              href="/cart"
              aria-label="購物車"
              className="relative grid h-12 w-12 place-items-center rounded-full bg-[#0d0d11] text-white transition hover:scale-105"
            >
              <ShoppingCart size={22} strokeWidth={2.4} />
              {totalQuantity > 0 ? (
                <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#ff3d3d] px-1.5 text-xs font-semibold text-white">
                  {totalQuantity}
                </span>
              ) : null}
            </Link>

            <button
              type="button"
              onClick={() => setAccountMenuOpen((open) => !open)}
              className="grid h-12 w-12 place-items-center rounded-full bg-[#08080a] text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition hover:scale-105"
              aria-label="會員選單"
              aria-expanded={accountMenuOpen}
            >
              <UserRound size={24} strokeWidth={2.6} />
            </button>
            {accountMenuOpen ? accountMenu : null}
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <Link
              href="/cart"
              aria-label={totalQuantity > 0 ? `購物車，共 ${totalQuantity} 件商品` : '購物車'}
              className="focus-ring relative grid h-11 w-11 place-items-center rounded-lg border border-borderSoft bg-white text-textDark"
              onClick={() => setMenuOpen(false)}
            >
              <ShoppingCart size={21} strokeWidth={2.4} />
              {totalQuantity > 0 ? (
                <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#ff3d3d] px-1.5 text-xs font-semibold text-white">
                  {totalQuantity}
                </span>
              ) : null}
            </Link>

            <button
              type="button"
              className="focus-ring grid h-11 w-11 place-items-center rounded-lg border border-borderSoft bg-white"
              aria-label={menuOpen ? '關閉選單' : '開啟選單'}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMenuOpen((value) => !value)}
            >
              {menuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>
      </header>

      {menuOpen
        ? createPortal(
            <div className="mobile-menu-overlay fixed inset-0 z-[45] pointer-events-auto lg:hidden">
              <button
                type="button"
                aria-label="關閉選單"
                className="mobile-menu-backdrop absolute inset-0 z-0 bg-black/25"
                onClick={() => setMenuOpen(false)}
              />
              <div
                id="mobile-navigation"
                role="dialog"
                aria-modal="true"
                aria-label="網站選單"
                className="mobile-menu-panel grid gap-2 border-t border-borderSoft bg-white px-4 pt-4 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                {visibleNavItems.map((item) => {
                  const destination = headerCtaDestinationByHref[item.href]
                  const handleClick = (event: ReactMouseEvent<HTMLAnchorElement>) => {
                    setMenuOpen(false)
                    if (item.href !== '/ai-chart' && item.href !== '/booking' && item.href !== '/ai-divination') return
                    event.preventDefault()
                    router.push(`${item.href}?reset=${Date.now()}`)
                  }

                  return destination ? (
                    <TrackedPublicCtaLink
                      key={item.href}
                      className="rounded-lg px-3 py-3 text-sm font-medium hover:bg-softPurple"
                      destination={destination}
                      href={item.href}
                      onClick={handleClick}
                      placement="header_mobile"
                    >
                      {item.label}
                    </TrackedPublicCtaLink>
                  ) : (
                    <Link
                      key={item.href}
                      className="rounded-lg px-3 py-3 text-sm font-medium hover:bg-softPurple"
                      href={item.href}
                      onClick={handleClick}
                    >
                      {item.label}
                    </Link>
                  )
                })}
                {mobileAuthActions}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
