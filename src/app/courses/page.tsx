'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { LoginModal } from '@/components/LoginModal'
import { PageHero } from '@/components/PageHero'
import {
  canBuyCourse,
  courseCatalog,
  formatCoursePrice,
  getCourseLockedReason,
  type CourseId,
  type CourseInfo,
} from '@/lib/courses'
import {
  getAuthAccessToken,
  getMockUser,
  subscribeAuthChange,
  type UserProfile,
} from '@/lib/mockAuth'

type PurchaseState = {
  message: string
  courseId: CourseId | null
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<CourseInfo[]>(courseCatalog)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [purchasedCourseIds, setPurchasedCourseIds] = useState<CourseId[]>([])
  const [loginOpen, setLoginOpen] = useState(false)
  const [purchasingCourseId, setPurchasingCourseId] = useState<CourseId | null>(null)
  const [purchaseState, setPurchaseState] = useState<PurchaseState>({ message: '', courseId: null })

  const loadPurchases = useCallback(async () => {
    const nextUser = getMockUser()
    setUser(nextUser)

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
    let cancelled = false

    async function loadCourses() {
      const response = await fetch('/api/courses', { cache: 'no-store' })
      if (!response.ok) return

      const data = (await response.json()) as { courses?: CourseInfo[] }
      if (!cancelled && data.courses?.length) setCourses(data.courses)
    }

    void loadCourses()
    void loadPurchases()

    const unsubscribe = subscribeAuthChange(() => {
      void loadPurchases()
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [loadPurchases])

  const purchaseCourse = async (course: CourseInfo) => {
    setPurchaseState({ message: '', courseId: null })

    if (!user) {
      setLoginOpen(true)
      return
    }

    if (purchasedCourseIds.includes(course.id)) return

    const lockedReason = getCourseLockedReason(course.id, purchasedCourseIds)
    if (lockedReason) {
      setPurchaseState({ message: lockedReason, courseId: course.id })
      return
    }

    const accessToken = await getAuthAccessToken()
    if (!accessToken) {
      setLoginOpen(true)
      return
    }

    setPurchasingCourseId(course.id)

    try {
      const response = await fetch('/api/courses/purchase', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ courseId: course.id }),
      })
      const data = (await response.json()) as { message?: string }

      if (!response.ok) {
        setPurchaseState({ message: data.message ?? '課程購買失敗，請稍後再試。', courseId: course.id })
        return
      }

      await loadPurchases()
      setPurchaseState({ message: `${course.title} 已完成 mock 付款並建立購買紀錄。`, courseId: course.id })
    } finally {
      setPurchasingCourseId(null)
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Courses"
        title="紫微斗數三階段課程"
        description="依序從基礎觀念、四宮實戰到飛化與占卜應用，完成前一階段後解鎖下一階段。"
      />
      <section className="bg-white py-12 md:py-16">
        <div className="section-shell grid gap-6 lg:grid-cols-3">
          {courses.map((course) => {
            const purchased = purchasedCourseIds.includes(course.id)
            const lockedReason = user ? getCourseLockedReason(course.id, purchasedCourseIds) : null
            const canBuy = user && !purchased && canBuyCourse(course.id, purchasedCourseIds)
            const isPurchasing = purchasingCourseId === course.id

            return (
              <article key={course.id} className="flex h-full flex-col rounded-2xl border border-borderSoft bg-white p-6 shadow-soft">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-darkGold">第 {course.level} 階段</p>
                    <h2 className="mt-2 font-serifTC text-2xl font-semibold text-deepPurple">{course.title}</h2>
                    <p className="mt-1 font-semibold text-textDark">{course.subtitle}</p>
                  </div>
                  <span className="rounded-full bg-lightGold px-3 py-1 text-sm font-semibold text-darkGold">
                    {formatCoursePrice(course.price)}
                  </span>
                </div>

                <p className="mt-4 leading-7 text-textMuted">{course.description}</p>

                <ul className="mt-5 grid gap-2 text-sm text-textDark">
                  {course.contents.map((content) => (
                    <li key={content} className="rounded-lg bg-softPurple px-3 py-2">
                      {content}
                    </li>
                  ))}
                </ul>

                <p className="mt-5 text-sm font-semibold text-darkGold">
                  購買條件：{course.prerequisiteCourseId ? `需先購買${course.prerequisiteCourseId === 'basic' ? '初級班' : '進階班'}` : '登入會員即可購買'}
                </p>

                <div className="mt-auto pt-6">
                  {!user ? (
                    <button
                      type="button"
                      className="focus-ring w-full rounded-lg bg-deepPurple px-4 py-3 font-semibold text-white"
                      onClick={() => setLoginOpen(true)}
                    >
                      請先登入
                    </button>
                  ) : purchased ? (
                    <div className="grid gap-3">
                      <button type="button" className="w-full rounded-lg bg-lightGold px-4 py-3 font-semibold text-darkGold" disabled>
                        已購買
                      </button>
                      <Link className="focus-ring w-full rounded-lg bg-deepPurple px-4 py-3 text-center font-semibold text-white" href={`/courses/${course.id}/learn`}>
                        進入課程
                      </Link>
                    </div>
                  ) : lockedReason ? (
                    <button type="button" className="w-full rounded-lg bg-[#eee8f4] px-4 py-3 font-semibold text-textMuted" disabled>
                      {lockedReason}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="focus-ring w-full rounded-lg bg-deepPurple px-4 py-3 font-semibold text-white disabled:opacity-70"
                      disabled={!canBuy || isPurchasing}
                      onClick={() => void purchaseCourse(course)}
                    >
                      {isPurchasing ? '處理中...' : `立即購買 ${formatCoursePrice(course.price)}`}
                    </button>
                  )}

                  {purchaseState.courseId === course.id && purchaseState.message ? (
                    <p className="mt-3 rounded-lg bg-softPurple px-4 py-3 text-sm font-semibold text-deepPurple">{purchaseState.message}</p>
                  ) : null}
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
