'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { LoginModal } from '@/components/LoginModal'
import { PageHero } from '@/components/PageHero'
import { accountStats } from '@/lib/mockData'
import { getAuthAccessToken, getMockUser, subscribeAuthChange, type UserProfile } from '@/lib/mockAuth'
import type { CourseId } from '@/lib/courses'
import { shouldHideConsultationServices, shouldHideCoursesServices } from '@/lib/siteVisibility'

export default function AccountPage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [purchasedCourseIds, setPurchasedCourseIds] = useState<CourseId[]>([])
  const hideConsultationServices = shouldHideConsultationServices()
  const hideCoursesServices = shouldHideCoursesServices()

  useEffect(() => {
    async function loadCoursePurchases(nextUser: UserProfile | null) {
      if (!nextUser || hideCoursesServices) {
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
        description={hideConsultationServices || hideCoursesServices ? '集中保存命盤、AI分析報告與占卜紀錄。' : '集中保存命盤、AI分析報告、占卜紀錄、真人預約與課程。'}
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
            {accountStats
              .filter((stat) => {
                if (stat.title === '付款紀錄') return false
                if (stat.title === '我的課程' && hideCoursesServices) return false
                if (stat.title === '真人預約' && hideConsultationServices) return false
                return true
              })
              .map((stat) => (
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
              <div>
                <h2 className="font-serifTC text-2xl font-semibold text-deepPurple">我的占卜紀錄</h2>
                <p className="mt-2 text-sm text-textMuted">查看已完成的紫微牌卡解讀。</p>
              </div>
              <Link
                className="focus-ring w-fit rounded-lg bg-deepPurple px-4 py-2 text-sm font-semibold text-white"
                href="/account/divinations"
              >
                查看我的占卜紀錄
              </Link>
            </div>
          </div>

        </div>
      </section>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={() => setLoginOpen(false)} />
    </>
  )
}
