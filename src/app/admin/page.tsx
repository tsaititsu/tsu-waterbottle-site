'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BarChart3, Boxes, CalendarClock, CreditCard, Landmark, ScrollText } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getMockUser, subscribeAuthChange, type UserProfile } from '@/lib/mockAuth'

const adminNavItems = [
  { label: '總覽', description: '查看後台摘要與待辦提醒', icon: BarChart3 },
  { label: '開運商品', description: '管理商品資料、圖片與上下架狀態', icon: Boxes },
  { label: '訂單管理', description: '查看商品與服務訂單狀態', icon: CreditCard },
  { label: '占卜紀錄', description: '檢視占卜服務紀錄與客戶查詢', icon: ScrollText },
  { label: '匯款回報', description: '人工核對銀行匯款回報資料', icon: Landmark },
  { label: '預約時段', description: '手動開放或關閉論命可預約時段', icon: CalendarClock, href: '/admin/booking-slots' },
]

const overviewCards = [
  { label: '今日待處理', value: '0', hint: '靜態示意，尚未接資料庫' },
  { label: '待確認匯款', value: '0', hint: '之後可串 bank_transfer_submissions' },
  { label: '開運商品數', value: '11', hint: '目前來自靜態商品資料' },
]

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  useEffect(() => {
    const sync = () => {
      const nextUser = getMockUser()
      setUser(nextUser)
      setIsCheckingAuth(false)

      if (!nextUser) {
        router.replace('/')
      }
    }

    sync()
    return subscribeAuthChange(sync)
  }, [router])

  if (isCheckingAuth) {
    return (
      <main className="bg-[#faf7ff] py-16">
        <div className="section-shell">
          <div className="rounded-2xl border border-borderSoft bg-white p-8 text-textMuted shadow-soft">
            正在確認登入狀態...
          </div>
        </div>
      </main>
    )
  }

  if (!user) return null

  return (
    <main className="bg-[#faf7ff] py-10 md:py-14">
      <div className="section-shell grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-borderSoft bg-white p-5 shadow-soft">
          <Link href="/" className="text-sm font-semibold text-darkGold hover:text-deepPurple">
            回前台
          </Link>
          <h1 className="mt-4 font-serifTC text-2xl font-semibold text-deepPurple">後台管理</h1>
          <p className="mt-2 text-sm leading-6 text-textMuted">
            目前為新網站後台骨架，先做靜態畫面與登入保護，尚未接資料庫與正式 admin 權限。
          </p>

          <nav className="mt-6 grid gap-2">
            {adminNavItems.map((item, index) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.label}
                  href={item.href ?? `#admin-section-${index}`}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-textDark transition hover:bg-softPurple hover:text-deepPurple"
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </aside>

        <section className="grid gap-6">
          <div className="rounded-2xl border border-borderSoft bg-white p-6 shadow-soft md:p-8">
            <p className="text-sm font-semibold text-darkGold">Admin Preview</p>
            <h2 className="mt-2 font-serifTC text-3xl font-semibold text-deepPurple">總覽</h2>
            <p className="mt-3 leading-8 text-textMuted">
              你好，{user.displayName || '管理者'}。這裡先保留後台入口與資訊架構，之後可逐步接上商品管理、訂單管理與匯款審核資料。
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {overviewCards.map((card) => (
              <article key={card.label} className="rounded-2xl border border-borderSoft bg-white p-5 shadow-soft">
                <p className="text-sm font-semibold text-textMuted">{card.label}</p>
                <p className="mt-2 font-serifTC text-3xl font-semibold text-deepPurple">{card.value}</p>
                <p className="mt-2 text-sm leading-6 text-textMuted">{card.hint}</p>
              </article>
            ))}
          </div>

          <div className="grid gap-4">
            {adminNavItems.map((item, index) => {
              const Icon = item.icon
              return (
                <section
                  key={item.label}
                  id={`admin-section-${index}`}
                  className="rounded-2xl border border-borderSoft bg-white p-6 shadow-soft"
                >
                  <div className="flex items-start gap-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-softPurple text-deepPurple">
                      <Icon size={22} />
                    </div>
                    <div>
                      <h3 className="font-serifTC text-2xl font-semibold text-deepPurple">{item.label}</h3>
                      <p className="mt-2 leading-7 text-textMuted">{item.description}</p>
                      <p className="mt-3 rounded-xl bg-[#fff7e5] px-4 py-3 text-sm font-semibold text-darkGold">
                        靜態骨架：下一階段再接資料來源與操作功能。
                      </p>
                    </div>
                  </div>
                </section>
              )
            })}
          </div>
        </section>
      </div>
    </main>
  )
}
