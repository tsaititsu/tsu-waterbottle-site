'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getMockUser, logoutMockUser, subscribeAuthChange, type UserProfile } from '@/lib/mockAuth'
import { LoginModal } from './LoginModal'
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
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [user, setUser] = useState<UserProfile | null>(null)

  useEffect(() => {
    const sync = () => setUser(getMockUser())
    sync()
    return subscribeAuthChange(sync)
  }, [])

  const openAccount = () => {
    if (!user) {
      setLoginOpen(true)
      return
    }
    router.push('/account')
  }

  return (
    <>
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

          <div className="hidden items-center gap-2 lg:flex">
            {user ? (
              <>
                <button className="focus-ring rounded-lg border border-borderSoft px-4 py-2 text-sm" onClick={openAccount}>
                  會員中心
                </button>
                <button className="focus-ring rounded-lg bg-deepPurple px-4 py-2 text-sm font-semibold text-white" onClick={logoutMockUser}>
                  登出
                </button>
              </>
            ) : (
              <>
                <button className="focus-ring rounded-lg bg-lineGreen px-4 py-2 text-sm font-semibold text-white" onClick={() => setLoginOpen(true)}>
                  LINE 登入
                </button>
                <button className="focus-ring rounded-lg border border-[#D9D9E3] bg-white px-4 py-2 text-sm font-semibold" onClick={() => setLoginOpen(true)}>
                  Google Email 登入
                </button>
              </>
            )}
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
              <button className="mt-2 rounded-lg bg-lineGreen px-4 py-3 font-semibold text-white" onClick={() => setLoginOpen(true)}>
                LINE 登入
              </button>
              <button className="rounded-lg border border-borderSoft px-4 py-3 font-semibold" onClick={() => setLoginOpen(true)}>
                Google Email 登入
              </button>
            </div>
          </div>
        )}
      </header>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={() => setMenuOpen(false)} />
    </>
  )
}
