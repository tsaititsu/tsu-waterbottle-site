'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { LoginModal } from '@/components/LoginModal'
import { PageHero } from '@/components/PageHero'
import { accountStats } from '@/lib/mockData'
import { getAuthAccessToken, getMockUser, subscribeAuthChange, type UserProfile } from '@/lib/mockAuth'
import { getPaymentRecords, type PaymentRecord } from '@/lib/mockPayment'
import type { CourseId } from '@/lib/courses'

export default function AccountPage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loginOpen, setLoginOpen] = useState(false)
  const [purchasedCourseIds, setPurchasedCourseIds] = useState<CourseId[]>([])

  useEffect(() => {
    async function loadCoursePurchases(nextUser: UserProfile | null) {
      if (!nextUser) {
        setPurchasedCourseIds([])
        return
      }

      const accessToken = await getAuthAccessToken()
      if (!accessToken) {
        setPurchasedCourseIds([])
        return
      }

      const response = await fetch('/api/account/course-purchases', {
        headers: { authorization: `Bearer ${accessToken}` },
      })

      if (!response.ok) {
        setPurchasedCourseIds([])
        return
      }

      const data = (await response.json()) as { courseIds?: CourseId[] }
      setPurchasedCourseIds(data.courseIds ?? [])
    }

    const sync = () => {
      const nextUser = getMockUser()
      setUser(nextUser)
      setPayments(getPaymentRecords())
      setLoginOpen(!nextUser)
      void loadCoursePurchases(nextUser)
    }

    sync()
    return subscribeAuthChange(sync)
  }, [])

  return (
    <>
      <PageHero
        eyebrow="Member Center"
        title="會員中心"
        description="集中保存命盤、AI分析報告、占卜紀錄、真人預約、課程與付款紀錄。"
      />
      <section className="bg-white py-12 md:py-16">
        <div className="section-shell grid gap-8">
          <div className="rounded-2xl border border-borderSoft bg-softPurple p-6 shadow-soft">
            <p className="text-sm font-semibold text-darkGold">個人資料</p>
            <h2 className="mt-2 font-serifTC text-2xl font-semibold text-deepPurple">
              {user?.displayName ?? '尚未登入'}
            </h2>
            <p className="mt-2 text-textMuted">
              {user?.provider === 'google' ? user.googleEmail : user?.provider === 'line' ? user.lineUserId : '請登入以保存資料'}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accountStats.map((stat) => (
              <article key={stat.title} className="rounded-2xl border border-borderSoft bg-white p-5 shadow-soft">
                <h3 className="font-serifTC text-xl font-semibold text-deepPurple">{stat.title}</h3>
                <p className="mt-3 text-textMuted">
                  {stat.title === '我的課程' ? `已購買 ${purchasedCourseIds.length} / 3 門課` : stat.value}
                </p>
                {stat.title === '我的課程' ? (
                  <Link className="focus-ring mt-4 inline-flex rounded-lg border border-deepPurple bg-white px-4 py-2 text-sm font-semibold text-deepPurple" href="/account/courses">
                    查看我的課程
                  </Link>
                ) : null}
              </article>
            ))}
          </div>

          <div className="rounded-2xl border border-borderSoft bg-white p-6 shadow-soft">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-serifTC text-2xl font-semibold text-deepPurple">付款紀錄</h2>
              <Link className="focus-ring w-fit rounded-lg border border-deepPurple bg-white px-4 py-2 text-sm font-semibold text-deepPurple" href="/account/bookings">
                查看我的預約
              </Link>
            </div>
            <div className="mt-5 grid gap-3">
              {payments.length === 0 ? (
                <p className="text-textMuted">目前尚無付款紀錄。完成 mock 付款後會顯示在這裡。</p>
              ) : (
                payments.map((payment) => (
                  <div key={payment.id} className="grid gap-2 rounded-xl border border-borderSoft bg-softPurple p-4 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                    <div>
                      <p className="font-semibold text-deepPurple">{payment.itemName}</p>
                      <p className="text-sm text-textMuted">{new Date(payment.createdAt).toLocaleString('zh-TW')}</p>
                    </div>
                    <p className="font-semibold text-textDark">NT${payment.amount.toLocaleString()}</p>
                    <span className="w-fit rounded-full bg-lightGold px-3 py-1 text-xs font-semibold text-darkGold">已付款</span>
                    {payment.itemType === 'ai-chart' && payment.resultId && (
                      <Link className="focus-ring w-fit rounded-lg bg-deepPurple px-4 py-2 text-sm font-semibold text-white" href={`/ai-chart/result/${payment.resultId}`}>
                        查看結果
                      </Link>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={() => setLoginOpen(false)} />
    </>
  )
}
