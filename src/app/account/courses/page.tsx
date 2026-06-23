'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { LoginModal } from '@/components/LoginModal'
import { PageHero } from '@/components/PageHero'
import {
  courseCatalog,
  formatCoursePrice,
  getCourseLockedReason,
  type CourseId,
} from '@/lib/courses'
import {
  getAuthAccessToken,
  getMockUser,
  subscribeAuthChange,
  type UserProfile,
} from '@/lib/mockAuth'

function statusText(courseId: CourseId, purchasedCourseIds: CourseId[]) {
  if (purchasedCourseIds.includes(courseId)) return '已購買'

  const lockedReason = getCourseLockedReason(courseId, purchasedCourseIds)
  if (lockedReason) return lockedReason

  return '可購買'
}

export default function AccountCoursesPage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [purchasedCourseIds, setPurchasedCourseIds] = useState<CourseId[]>([])
  const [loginOpen, setLoginOpen] = useState(false)

  const loadPurchases = useCallback(async () => {
    const nextUser = getMockUser()
    setUser(nextUser)
    setLoginOpen(!nextUser)

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
  }, [])

  useEffect(() => {
    void loadPurchases()
    return subscribeAuthChange(() => {
      void loadPurchases()
    })
  }, [loadPurchases])

  return (
    <>
      <PageHero
        eyebrow="Member Courses"
        title="我的課程"
        description="查看已購買課程、可購買課程與尚未解鎖的下一階段。"
      />
      <section className="bg-white py-12 md:py-16">
        <div className="section-shell grid gap-5">
          {courseCatalog.map((course) => {
            const purchased = purchasedCourseIds.includes(course.id)
            const lockedReason = getCourseLockedReason(course.id, purchasedCourseIds)
            const status = statusText(course.id, purchasedCourseIds)

            return (
              <article key={course.id} className="grid gap-4 rounded-2xl border border-borderSoft bg-white p-6 shadow-soft md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="text-sm font-semibold text-darkGold">第 {course.level} 階段</p>
                  <h2 className="mt-2 font-serifTC text-2xl font-semibold text-deepPurple">
                    {course.title}｜{course.subtitle}
                  </h2>
                  <p className="mt-3 leading-7 text-textMuted">{course.description}</p>
                  <p className="mt-3 text-sm font-semibold text-darkGold">狀態：{status}</p>
                </div>

                <div className="grid gap-3 md:w-[190px]">
                  <p className="text-lg font-semibold text-textDark">{formatCoursePrice(course.price)}</p>
                  {purchased ? (
                    <Link className="focus-ring rounded-lg bg-deepPurple px-4 py-3 text-center font-semibold text-white" href={`/courses/${course.id}/learn`}>
                      進入課程
                    </Link>
                  ) : lockedReason ? (
                    <button type="button" className="rounded-lg bg-[#eee8f4] px-4 py-3 font-semibold text-textMuted" disabled>
                      {lockedReason}
                    </button>
                  ) : (
                    <Link className="focus-ring rounded-lg bg-deepPurple px-4 py-3 text-center font-semibold text-white" href="/courses">
                      前往購買
                    </Link>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </section>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={() => {
        setLoginOpen(false)
        void loadPurchases()
      }} />
    </>
  )
}
