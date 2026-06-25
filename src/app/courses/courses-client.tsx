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

function getCoursePaymentErrorMessage(status: number, fallback?: string) {
  if (status === 401) return '請先登入會員後再購買課程'
  if (status === 403) return '請先完成前一階段課程購買'
  if (status === 409) return '你已經購買過這門課程'
  if (status >= 500) return '建立付款單失敗，請稍後再試'
  return fallback ?? '建立付款單失敗，請稍後再試'
}

function CoursePurchaseNotice({
  courseId,
  accepted,
  onAcceptedChange,
}: {
  courseId: CourseId
  accepted: boolean
  onAcceptedChange: (courseId: CourseId, accepted: boolean) => void
}) {
  const inputId = `course-terms-accepted-${courseId}`

  return (
    <div className="rounded-xl border border-borderSoft bg-softPurple p-4">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span className="font-serifTC text-lg font-semibold text-deepPurple">紫微課程購買須知</span>
          <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-darkGold shadow-sm transition group-open:bg-lightGold">
            點我查看
          </span>
        </summary>
        <div className="mt-4 space-y-4 text-sm leading-7 text-textMuted">
          <div>
            <h3 className="font-serifTC text-base font-semibold text-deepPurple">紫微課程服務說明</h3>
            <p className="mt-1">本課程為線上課程商品，購買後可於水瓶先生網站會員中心觀看已開放之課程內容。</p>
          </div>

          <div>
            <h4 className="font-semibold text-deepPurple">課程型態</h4>
            <p className="mt-1">本課程以預錄課程為主，部分課程日後可能增加補充內容或實作示範，實際開放內容依課程頁面公告為準。</p>
          </div>

          <div>
            <h4 className="font-semibold text-deepPurple">觀看方式</h4>
            <p className="mt-1">購買成功後，請登入會員中心觀看課程內容。課程影片與教材皆以水瓶先生網站內觀看為主，不需要另外預約。</p>
          </div>

          <div>
            <h4 className="font-semibold text-deepPurple">觀看期限</h4>
            <p className="mt-1">購買後可長期觀看已開放之預錄課程內容；若後續有新增內容，依各課程實際開放安排為準。</p>
          </div>

          <div>
            <h4 className="font-semibold text-deepPurple">購買提醒</h4>
            <p className="mt-1">購買前請先確認課程名稱、課程內容、價格與購買條件。部分進階課程需先購買前一階段課程，才能解鎖購買。</p>
          </div>

          <div>
            <h4 className="font-semibold text-deepPurple">服務性質</h4>
            <p className="mt-1">課程內容為紫微斗數教學與命理學習用途，僅供學習與參考，不保證任何特定結果，也不具醫療、法律、投資或其他專業建議效果。</p>
          </div>
        </div>
      </details>

      <div className="mt-4 rounded-lg bg-white px-3 py-3">
        <div className="flex items-start gap-3">
          <input
            id={inputId}
            type="checkbox"
            checked={accepted}
            onChange={(event) => onAcceptedChange(courseId, event.target.checked)}
            className="mt-1 size-4 rounded border-borderSoft text-deepPurple focus:ring-deepPurple"
          />
          <label htmlFor={inputId} className="text-sm leading-7 text-textMuted">
            我已詳細閱讀並同意《紫微課程服務說明》、
            <Link className="font-semibold text-deepPurple underline-offset-4 hover:underline" href="/refund-policy">
              退款政策
            </Link>
            、
            <Link className="font-semibold text-deepPurple underline-offset-4 hover:underline" href="/terms">
              服務條款
            </Link>
            ，並了解課程為線上課程商品，購買後可於水瓶先生網站會員中心觀看。
          </label>
        </div>
      </div>
    </div>
  )
}

export default function CoursesPageClient() {
  const router = useRouter()
  const [courses, setCourses] = useState<CourseInfo[]>(courseCatalog)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [purchasedCourseIds, setPurchasedCourseIds] = useState<CourseId[]>([])
  const [loginOpen, setLoginOpen] = useState(false)
  const [purchasingCourseId, setPurchasingCourseId] = useState<CourseId | null>(null)
  const [purchaseState, setPurchaseState] = useState<PurchaseState>({ message: '', courseId: null })
  const [acceptedCourseTerms, setAcceptedCourseTerms] = useState<Partial<Record<CourseId, boolean>>>({})

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

    if (!acceptedCourseTerms[course.id]) {
      setPurchaseState({
        message: '請先勾選同意紫微課程服務說明、退款政策與服務條款。',
        courseId: course.id,
      })
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
                  <div className="mb-4">
                    <CoursePurchaseNotice
                      courseId={course.id}
                      accepted={Boolean(acceptedCourseTerms[course.id])}
                      onAcceptedChange={(courseId, accepted) =>
                        setAcceptedCourseTerms((current) => ({ ...current, [courseId]: accepted }))
                      }
                    />
                  </div>

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
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={() => {
        setLoginOpen(false)
        void loadPurchases()
      }} />
    </>
  )
}
