'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarCheck, FileText, LogOut, Menu, Sparkles, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  getMockUser,
  loginWithProvider,
  logoutMockUser,
  subscribeAuthChange,
  type UserProfile
} from '@/lib/mockAuth'
import { LogoMark } from './LogoMark'

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
  const [loginMessage, setLoginMessage] = useState('')
  const [loadingProvider, setLoadingProvider] = useState<'line' | 'google' | ''>('')
  const [user, setUser] = useState<UserProfile | null>(null)

  useEffect(() => {
    const sync = () => setUser(getMockUser())
    sync()
    return subscribeAuthChange(sync)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
    setAccountMenuOpen(false)
  }, [pathname])

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
    <div className="absolute right-0 top-[calc(100%+14px)] z-50 w-[330px] overflow-hidden rounded-xl bg-[#050505] text-white shadow-2xl ring-1 ring-white/10">
      <div className="bg-[#1c1c1f] px-6 py-5">
        <p className="text-lg font-semibold">{user.displayName || 'WATERBOTTLE 會員'}</p>
        {user.googleEmail ? <p className="mt-1 text-sm text-white/60">{user.googleEmail}</p> : null}
      </div>
      <nav className="grid py-3 text-[17px] font-semibold">
        <Link href="/account" className="flex items-center gap-4 px-6 py-4 transition hover:bg-white/10">
          <UserRound size={22} />
          會員中心
        </Link>
        <Link href="/account/bookings" className="flex items-center gap-4 px-6 py-4 transition hover:bg-white/10">
          <CalendarCheck size={22} />
          我的預約
        </Link>
        <Link href="/ai-chart" className="flex items-center gap-4 px-6 py-4 transition hover:bg-white/10">
          <FileText size={22} />
          命盤紀錄
        </Link>
        <Link href="/ai-divination" className="flex items-center gap-4 px-6 py-4 transition hover:bg-white/10">
          <Sparkles size={22} />
          紫微牌卡占卜
        </Link>
      </nav>
      <button
        type="button"
        onClick={handleLogout}
        className="flex w-full items-center gap-4 border-t border-white/15 bg-[#1c1c1f] px-6 py-5 text-left text-[17px] font-semibold transition hover:bg-white/10"
      >
        <LogOut size={22} />
        登出
      </button>
    </div>
  ) : (
    <div className="absolute right-0 top-[calc(100%+14px)] z-50 w-[330px] overflow-hidden rounded-xl bg-[#050505] text-white shadow-2xl ring-1 ring-white/10">
      <div className="bg-[#1c1c1f] px-6 py-5">
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

        <div className="relative hidden lg:block">
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
            {mobileAuthActions}
          </div>
        </div>
      )}
    </header>
  )
}
