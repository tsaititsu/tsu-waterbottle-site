import type { ReactNode } from 'react'
import AdminStatusBadge from './AdminStatusBadge'

type AdminPageHeaderProps = {
  eyebrow?: string
  title: string
  description: string
  status?: 'readonly' | 'tool' | 'unavailable'
  notice?: ReactNode
}

export default function AdminPageHeader({
  eyebrow = '後台管理',
  title,
  description,
  status = 'readonly',
  notice,
}: AdminPageHeaderProps) {
  const statusLabel = status === 'readonly' ? '唯讀' : status === 'tool' ? '既有營運工具' : '尚未啟用'

  return (
    <header className="rounded-2xl border border-borderSoft bg-white p-6 shadow-soft md:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-semibold text-darkGold">{eyebrow}</p>
        <AdminStatusBadge tone={status}>{statusLabel}</AdminStatusBadge>
      </div>
      <h1 className="mt-3 font-serifTC text-3xl font-semibold text-deepPurple md:text-4xl">{title}</h1>
      <p className="mt-3 max-w-3xl leading-8 text-textMuted">{description}</p>
      {notice ? <div className="mt-5 rounded-xl border border-[#ead9a6] bg-[#fffaf0] p-4 text-sm leading-7 text-[#6d5214]">{notice}</div> : null}
    </header>
  )
}
