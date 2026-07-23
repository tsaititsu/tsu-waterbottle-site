import Link from 'next/link'
import AdminStatusBadge from './AdminStatusBadge'

const readOnlyItems = [
  { href: '/admin', label: '能力總覽' },
  { href: '/admin/bookings', label: '預約紀錄' },
  { href: '/admin/product-orders', label: '商品訂單' },
  { href: '/admin/members', label: '會員名錄' },
  { href: '/admin/bank-transfers', label: '歷史匯款回報' },
]

const toolItems = [{ href: '/admin/booking-slots', label: '預約時段工具' }]

const unavailableItems = [
  '金流營運中心',
  'AI 命盤營運中心',
  '占卜營運中心',
  '退款／取消／補單',
  'Webhook 重送與對帳',
  '會員角色管理',
  '稽核紀錄',
]

function current(pathname: string, href: string) {
  return href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

function NavigationLinks({ idPrefix, pathname }: { idPrefix: string; pathname: string }) {
  const readonlyHeadingId = `${idPrefix}-readonly-navigation`
  const toolHeadingId = `${idPrefix}-tool-navigation`
  const unavailableHeadingId = `${idPrefix}-unavailable-navigation`

  return (
    <div className="grid gap-6">
      <section aria-labelledby={readonlyHeadingId}>
        <div className="flex items-center justify-between gap-3">
          <h2 id={readonlyHeadingId} className="text-xs font-bold uppercase tracking-[0.16em] text-textMuted">
            唯讀紀錄
          </h2>
          <AdminStatusBadge tone="readonly">唯讀</AdminStatusBadge>
        </div>
        <ul className="mt-3 grid gap-1">
          {readOnlyItems.map((item) => (
            <li key={item.href}>
              <Link
                aria-current={current(pathname, item.href) ? 'page' : undefined}
                className={`focus-ring block rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  current(pathname, item.href)
                    ? 'bg-deepPurple text-white'
                    : 'text-textDark hover:bg-softPurple hover:text-deepPurple'
                }`}
                href={item.href}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby={toolHeadingId}>
        <div className="flex items-center justify-between gap-3">
          <h2 id={toolHeadingId} className="text-xs font-bold uppercase tracking-[0.16em] text-textMuted">
            既有營運工具
          </h2>
          <AdminStatusBadge tone="tool">含資料寫入</AdminStatusBadge>
        </div>
        <ul className="mt-3 grid gap-1">
          {toolItems.map((item) => (
            <li key={item.href}>
              <Link
                aria-current={current(pathname, item.href) ? 'page' : undefined}
                className={`focus-ring block rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  current(pathname, item.href)
                    ? 'bg-[#7d5a00] text-white'
                    : 'text-textDark hover:bg-[#fff4d9]'
                }`}
                href={item.href}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby={unavailableHeadingId}>
        <div className="flex items-center justify-between gap-3">
          <h2 id={unavailableHeadingId} className="text-xs font-bold uppercase tracking-[0.16em] text-textMuted">
            尚未啟用
          </h2>
          <AdminStatusBadge tone="unavailable">無操作入口</AdminStatusBadge>
        </div>
        <ul className="mt-3 grid gap-2">
          {unavailableItems.map((item) => (
            <li
              className="rounded-xl border border-dashed border-borderSoft px-3 py-2 text-sm text-textMuted"
              data-admin-module-state="unavailable"
              key={item}
            >
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

export default function AdminNavigation({ pathname }: { pathname: string }) {
  return (
    <>
      <aside aria-label="後台導覽" className="hidden rounded-2xl border border-borderSoft bg-white p-5 shadow-soft lg:block">
        <NavigationLinks idPrefix="admin-desktop" pathname={pathname} />
      </aside>
      <details className="rounded-2xl border border-borderSoft bg-white p-4 shadow-soft lg:hidden">
        <summary className="focus-ring cursor-pointer rounded-lg font-semibold text-deepPurple">
          開啟後台導覽
        </summary>
        <nav aria-label="手機版後台導覽" className="mt-5">
          <NavigationLinks idPrefix="admin-mobile" pathname={pathname} />
        </nav>
      </details>
    </>
  )
}
