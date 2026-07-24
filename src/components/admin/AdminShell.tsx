import Link from 'next/link'
import type { ReactNode } from 'react'
import AdminNavigation from './AdminNavigation'

export default function AdminShell({
  children,
  pathname,
}: {
  children: ReactNode
  pathname: string
}) {
  return (
    <div className="min-h-screen bg-[#faf7ff] py-6 md:py-10">
      <div className="section-shell">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-borderSoft bg-white px-5 py-4 shadow-soft">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-darkGold">Admin Foundation V1</p>
            <p className="mt-1 font-serifTC text-xl font-semibold text-deepPurple">營運後台</p>
          </div>
          <Link
            className="focus-ring rounded-lg border border-borderSoft bg-white px-4 py-2 text-sm font-semibold text-deepPurple hover:bg-softPurple"
            href="/"
          >
            返回前台
          </Link>
        </header>
        <div className="grid min-w-0 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <AdminNavigation pathname={pathname} />
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  )
}
