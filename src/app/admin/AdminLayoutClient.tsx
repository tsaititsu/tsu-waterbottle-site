'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { LoginModal } from '@/components/LoginModal'
import { sanitizeAuthReturnPath } from '@/lib/auth/returnTo'
import { getAuthAccessToken, getMockUser, subscribeAuthChange } from '@/lib/mockAuth'

type AdminAccessState = 'checking' | 'unauthenticated' | 'forbidden' | 'authorized'

/**
 * 後台守門：所有 /admin/* 頁面都必須通過 server-side 的 admin 驗證
 * （GET /api/admin/session）才會渲染後台 UI。
 * 非 admin 只會看到「沒有管理權限」，不會看到任何後台操作介面。
 */
export default function AdminLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [accessState, setAccessState] = useState<AdminAccessState>('checking')
  const [loginOpen, setLoginOpen] = useState(false)
  const [returnTo, setReturnTo] = useState(() => sanitizeAuthReturnPath(pathname))

  useEffect(() => {
    setReturnTo(sanitizeAuthReturnPath(`${pathname}${window.location.search}`))
  }, [pathname])

  useEffect(() => {
    let cancelled = false

    const verifyAdminAccess = async () => {
      const user = getMockUser()

      if (!user) {
        if (!cancelled) setAccessState('unauthenticated')
        return
      }

      try {
        const accessToken = await getAuthAccessToken()

        if (!accessToken) {
          if (!cancelled) setAccessState('unauthenticated')
          return
        }

        const response = await fetch('/api/admin/session', {
          cache: 'no-store',
          headers: { authorization: `Bearer ${accessToken}` },
        })

        if (cancelled) return

        if (response.ok) {
          setAccessState('authorized')
        } else if (response.status === 401) {
          setAccessState('unauthenticated')
        } else {
          setAccessState('forbidden')
        }
      } catch {
        if (!cancelled) setAccessState('forbidden')
      }
    }

    void verifyAdminAccess()
    const unsubscribe = subscribeAuthChange(() => {
      void verifyAdminAccess()
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  if (accessState === 'authorized') {
    return <>{children}</>
  }

  if (accessState === 'forbidden') {
    return (
      <main className="bg-[#faf7ff] py-16">
        <div className="section-shell">
          <div className="rounded-2xl border border-borderSoft bg-white p-8 shadow-soft">
            <h1 className="font-serifTC text-2xl font-semibold text-deepPurple">沒有管理權限</h1>
            <p className="mt-3 leading-7 text-textMuted">
              此帳號沒有後台管理權限。若你認為這是錯誤，請聯繫網站管理者。
            </p>
            <Link className="focus-ring mt-6 inline-flex rounded-lg bg-deepPurple px-5 py-3 font-semibold text-white" href="/">
              返回首頁
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (accessState === 'unauthenticated') {
    return (
      <main className="bg-[#faf7ff] py-16">
        <div className="section-shell">
          <div className="rounded-2xl border border-borderSoft bg-white p-8 shadow-soft">
            <h1 className="font-serifTC text-2xl font-semibold text-deepPurple">請先登入管理員帳號</h1>
            <p className="mt-3 leading-7 text-textMuted">登入完成後會返回目前的後台頁面</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                className="focus-ring rounded-lg bg-deepPurple px-5 py-3 font-semibold text-white"
                onClick={() => setLoginOpen(true)}
                type="button"
              >
                登入管理員帳號
              </button>
              <Link
                className="focus-ring inline-flex rounded-lg border border-borderSoft bg-white px-5 py-3 font-semibold text-deepPurple"
                href="/"
              >
                返回首頁
              </Link>
            </div>
          </div>
        </div>
        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} returnTo={returnTo} />
      </main>
    )
  }

  return (
    <main className="bg-[#faf7ff] py-16">
      <div className="section-shell">
        <div className="rounded-2xl border border-borderSoft bg-white p-8 text-textMuted shadow-soft">
          正在確認管理權限...
        </div>
      </div>
    </main>
  )
}
