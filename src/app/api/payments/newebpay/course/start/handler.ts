import { NextResponse } from 'next/server'
import {
  canBuyCourse,
  getCourseById,
  getCourseLockedReason,
  isCourseId,
  type CourseId,
} from '../../../../../../lib/courses'
import {
  buildCoursePaymentInsertPayload,
  buildNewebPayMerchantOrderUrl,
} from '../../../../../../lib/newebpay/coursePayment'
import type {
  CoursePaymentPayload,
  NewebPayConfig,
  NewebPayMpgForm,
} from '../../../../../../lib/newebpay/types'

type CoursePaymentInsertPayload = ReturnType<typeof buildCoursePaymentInsertPayload>

export type CourseStartDependencies = {
  isCourseSalesOpen: () => boolean
  hasSupabaseAdminConfig: () => boolean
  getUserIdFromRequest: (request: Request) => Promise<string | null>
  getPurchasedCourseIds: (userId: string) => Promise<CourseId[]>
  getNewebPayConfig: () => NewebPayConfig
  generateMerchantOrderNo: (prefix?: string) => string
  insertPayment: (payload: CoursePaymentInsertPayload) => Promise<{ id: string }>
  createCoursePaymentMpgForm: (payload: CoursePaymentPayload, config: NewebPayConfig) => NewebPayMpgForm
}

export async function handleCourseStartRequest(request: Request, dependencies: CourseStartDependencies) {
  // This server-side check must run before auth, database, payment, or MPG work.
  if (!dependencies.isCourseSalesOpen()) {
    return NextResponse.json(
      { ok: false, error: 'course_sales_disabled', message: '課程即將開課，目前尚未開放購買' },
      { status: 403 },
    )
  }

  if (!dependencies.hasSupabaseAdminConfig()) {
    return NextResponse.json({ ok: false, message: 'Supabase 管理端尚未設定' }, { status: 500 })
  }

  const userId = await dependencies.getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ ok: false, message: '尚未登入' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as { courseId?: unknown } | null
  if (!isCourseId(body?.courseId)) {
    return NextResponse.json({ ok: false, message: '課程不存在' }, { status: 400 })
  }

  const courseId = body.courseId
  const course = getCourseById(courseId)
  if (!course) {
    return NextResponse.json({ ok: false, message: '課程不存在' }, { status: 400 })
  }

  try {
    const purchasedCourseIds = await dependencies.getPurchasedCourseIds(userId)

    if (purchasedCourseIds.includes(courseId)) {
      return NextResponse.json({ ok: false, message: '已購買此課程' }, { status: 409 })
    }

    if (!canBuyCourse(courseId, purchasedCourseIds)) {
      return NextResponse.json(
        { ok: false, message: getCourseLockedReason(courseId, purchasedCourseIds) ?? '尚未符合購買資格' },
        { status: 403 },
      )
    }

    const config = dependencies.getNewebPayConfig()
    const merchantOrderNo = dependencies.generateMerchantOrderNo('COURSE')
    const itemDesc = `${course.title}｜${course.subtitle}`
    const payment = await dependencies.insertPayment(
      buildCoursePaymentInsertPayload({
        userId,
        courseId: course.id,
        courseTitle: course.title,
        amount: course.price,
        merchantOrderNo,
        itemDesc,
      }),
    )

    const mpgForm = dependencies.createCoursePaymentMpgForm(
      {
        merchantOrderNo,
        amount: course.price,
        itemDesc,
        notifyUrl: buildNewebPayMerchantOrderUrl(config.siteUrl, '/api/payments/newebpay/notify', merchantOrderNo),
        returnUrl: buildNewebPayMerchantOrderUrl(config.siteUrl, '/api/payments/newebpay/return', merchantOrderNo),
        clientBackUrl: `${config.siteUrl}/account/courses`,
        instFlag: '3,6',
      },
      config,
    )

    return NextResponse.json({
      ok: true,
      paymentId: payment.id,
      courseId: course.id,
      merchantOrderNo,
      form: mpgForm,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '建立課程付款失敗'
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
