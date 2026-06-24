'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
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

const courseServiceRows = [
  { label: '課程型態', value: '預錄課程、線上直播或混合制，依各課程實際安排為準。' },
  { label: '上課方式', value: '直播課程以 Zoom 進行；預錄課程於會員中心觀看。' },
  { label: '是否預約制', value: '是。直播或實作相關時段需依網站公告或客服協助預約；預錄內容不需預約。' },
  { label: '最長可預約時間', value: '可預約未來 90 天內之課程或實作時段。' },
  { label: '是否訂閱制', value: '否。' },
  { label: '是否儲值式', value: '否。' },
  { label: '觀看期限', value: '購買後可永久觀看已開放之預錄課程內容。' },
  { label: '購買後取得', value: '會員中心課程觀看權限與對應課程內容。' },
]

function getCoursePaymentErrorMessage(status: number, fallback?: string) {
  if (status === 401) return '請先登入會員後再購買課程'
  if (status === 403) return '請先完成前一階段課程購買'
  if (status === 409) return '你已經購買過這門課程'
  if (status >= 500) return '建立付款單失敗，請稍後再試'
  return fallback ?? '建立付款單失敗，請稍後再試'
}

const courseServiceDetails: Record<
  CourseId,
  {
    rows: { label: string; value: string }[]
  }
> = {
  basic: {
    rows: courseServiceRows,
  },
  advanced: {
    rows: courseServiceRows,
  },
  master: {
    rows: courseServiceRows,
  },
}

export default function CoursesPage() {
  const router = useRouter()
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
      const response = await fetch('/api/payments/newebpay/course/start', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ courseId: course.id }),
      })
      const data = (await response.json().catch(() => null)) as { paymentId?: string; message?: string } | null

      if (!response.ok) {
        if (response.status === 401) setLoginOpen(true)
        if (response.status === 409) void loadPurchases()

        setPurchaseState({
          message: getCoursePaymentErrorMessage(response.status, data?.message),
          courseId: course.id,
        })
        return
      }

      if (!data?.paymentId) {
        setPurchaseState({ message: '建立付款單失敗，請稍後再試', courseId: course.id })
        return
      }

      router.push(`/payment/newebpay/redirect?paymentId=${encodeURIComponent(data.paymentId)}`)
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
                      {isPurchasing ? '建立付款單中...' : `立即購買 ${formatCoursePrice(course.price)}`}
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
      <section className="bg-softPurple py-12 md:py-16">
        <div className="section-shell">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-darkGold">Course Notice</p>
            <h2 className="mt-3 font-serifTC text-3xl font-semibold text-deepPurple">課程服務說明</h2>
            <p className="mt-3 leading-8 text-textMuted">
              以下資訊供購買前確認。各課程實際直播、實作或預錄內容安排，依網站公告與會員中心已開放內容為準。
            </p>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {courses.map((course) => (
              <article key={course.id} className="rounded-2xl border border-borderSoft bg-white p-6 shadow-soft">
                <p className="text-sm font-semibold text-darkGold">第 {course.level} 階段</p>
                <h3 className="mt-2 font-serifTC text-2xl font-semibold text-deepPurple">{course.title}</h3>
                <p className="mt-1 font-semibold text-textDark">{course.subtitle}</p>
                <dl className="mt-5 grid gap-3 text-sm">
                  {courseServiceDetails[course.id].rows.map((row) => (
                    <div key={row.label} className="grid gap-1 rounded-xl bg-softPurple px-4 py-3">
                      <dt className="font-semibold text-deepPurple">{row.label}</dt>
                      <dd className="leading-6 text-textMuted">{row.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-5">
                  <p className="font-semibold text-deepPurple">課程內容</p>
                  <ul className="mt-3 grid gap-2 text-sm text-textMuted">
                    {course.contents.map((content) => (
                      <li key={content} className="rounded-lg border border-borderSoft px-3 py-2">
                        {content}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={() => {
        setLoginOpen(false)
        void loadPurchases()
      }} />
    </>
  )
}
