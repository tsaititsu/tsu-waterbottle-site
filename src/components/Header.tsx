'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, CalendarCheck, FileText, LogOut, Menu, ShoppingCart, Sparkles, UserRound, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  getMockUser,
  loginWithProvider,
  logoutMockUser,
  subscribeAuthChange,
  type UserProfile
} from '@/lib/mockAuth'
import { LogoMark } from './LogoMark'
import { useCart } from './CartContext'

const navItems = [
  { label: '首頁', href: '/' },
  { label: '紫微命盤分析', href: '/ai-chart' },
  { label: '紫微牌卡占卜', href: '/ai-divination' },
  { label: '水瓶先生論命', href: '/booking' },
  { label: '紫微課程', href: '/courses' },
  { label: '關於我們', href: '/#about' }
]

export function Header() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement | null>(null)
  const [loginMessage, setLoginMessage] = useState('')
  const [loadingProvider, setLoadingProvider] = useState<'line' | 'google' | ''>('')
  const [user, setUser] = useState<UserProfile | null>(null)
  const { totalQuantity } = useCart()

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
  }

  const accountMenu = user ? (
    <div className="absolute right-0 top-[calc(100%+14px)] z-50 w-[340px] overflow-hidden rounded-[20px] bg-[#050505] text-white shadow-2xl ring-1 ring-white/10">
      <div className="bg-[#1c1c1f] px-7 py-6">
        <p className="text-lg font-semibold">{user.displayName || 'WATERBOTTLE 會員'}</p>
        {user.googleEmail ? <p className="mt-1 text-sm text-white/60">{user.googleEmail}</p> : null}
      </div>
      <nav className="grid py-3 text-lg font-semibold">
        <Link href="/account" className="flex items-center gap-5 px-7 py-4 transition hover:bg-white/10">
          <UserRound size={22} />
          會員中心
        </Link>
        <Link href="/account/courses" className="flex items-center gap-5 px-7 py-4 transition hover:bg-white/10">
          <BookOpen size={22} />
          我的課程
        </Link>
        <Link href="/account/bookings" className="flex items-center gap-5 px-7 py-4 transition hover:bg-white/10">
          <CalendarCheck size={22} />
          我的預約
        </Link>
        <Link href="/ai-chart" className="flex items-center gap-5 px-7 py-4 transition hover:bg-white/10">
          <FileText size={22} />
          命盤紀錄
        </Link>
        <Link href="/ai-divination" className="flex items-center gap-5 px-7 py-4 transition hover:bg-white/10">
          <Sparkles size={22} />
          紫微牌卡占卜
        </Link>
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
      <Link href="/account" className="rounded-xl border border-[#e8dff2] px-4 py-3 text-center font-semibold">
        會員中心
      </Link>
      <Link href="/account/courses" className="rounded-xl border border-[#e8dff2] px-4 py-3 text-center font-semibold">
        我的課程
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
    <header className="sticky top-0 z-40 border-b border-borderSoft/70 bg-white/94 shadow-[0_8px_30px_rgba(31,27,46,0.04)] backdrop-blur">
      <div className="mx-auto flex h-[88px] w-[min(1480px,calc(100%-40px))] items-center justify-between gap-8">
        <Link href="/" aria-label="回到首頁">
          <LogoMark />
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-12 text-lg font-semibold text-textDark lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              className={`relative py-2 ${pathname === item.href ? 'text-deepPurple' : 'hover:text-purpleMain'}`}
              href={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <span className="inline-flex rounded-full border border-[#f0d8a6] bg-[#fff9eb] px-4 py-2 text-xs font-semibold tracking-wide text-darkGold">
            歡迎使用 LINE Pay
          </span>

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

        <button
          className="focus-ring grid h-10 w-10 place-items-center rounded-lg border border-borderSoft lg:hidden"
          aria-label="開啟選單"
          onClick={() => setMenuOpen((value) => !value)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-borderSoft bg-white lg:hidden">
          <div className="section-shell grid gap-2 py-4">
            {navItems.map((item) => (
              <Link key={item.href} className="rounded-lg px-3 py-3 text-sm font-medium hover:bg-softPurple" href={item.href} onClick={() => setMenuOpen(false)}>
                {item.label}
              </Link>
            ))}
            <Link href="/cart" className="rounded-lg px-3 py-3 text-sm font-medium hover:bg-softPurple" onClick={() => setMenuOpen(false)}>
              購物車
            </Link>
            {mobileAuthActions}
          </div>
        </div>
      )}
    </header>
  )
}
