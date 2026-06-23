import { NextResponse } from 'next/server'
import { canBuyCourse, getCourseById, getCourseLockedReason, isCourseId, type CourseId } from '@/lib/courses'
import { getNewebPayConfig } from '@/lib/newebpay/config'
import { createCoursePaymentMpgForm, generateMerchantOrderNo } from '@/lib/newebpay/mpg'
import { getSupabaseAdmin, hasSupabaseAdminConfig } from '@/lib/supabase/admin'
import { getUserIdFromRequest } from '@/lib/supabase/auth'

type PurchaseRow = {
  course_id: string
}

async function getPurchasedCourseIds(userId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('course_purchases')
    .select('course_id')
    .eq('user_id', userId)
    .eq('status', 'paid')

  if (error) throw new Error(error.message)

  return (data ?? [])
    .map((purchase: PurchaseRow) => purchase.course_id)
    .filter(isCourseId) as CourseId[]
}

export async function POST(request: Request) {
  if (!hasSupabaseAdminConfig()) {
    return NextResponse.json({ ok: false, message: 'Supabase 管理端尚未設定' }, { status: 500 })
  }

  const userId = await getUserIdFromRequest(request)
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
    const purchasedCourseIds = await getPurchasedCourseIds(userId)

    if (purchasedCourseIds.includes(courseId)) {
      return NextResponse.json({ ok: false, message: '已購買此課程' }, { status: 409 })
    }

    if (!canBuyCourse(courseId, purchasedCourseIds)) {
      return NextResponse.json(
        { ok: false, message: getCourseLockedReason(courseId, purchasedCourseIds) ?? '尚未符合購買資格' },
        { status: 403 },
      )
    }

    const config = getNewebPayConfig()
    const merchantOrderNo = generateMerchantOrderNo('COURSE')
    const itemDesc = `${course.title}｜${course.subtitle}`
    const supabase = getSupabaseAdmin()

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        provider: 'newebpay',
        item_type: 'course',
        item_id: course.id,
        item_name: course.title,
        amount_twd: course.price,
        currency: 'TWD',
        status: 'pending',
        merchant_order_no: merchantOrderNo,
        raw_payload: {
          courseId: course.id,
          itemDesc,
          source: 'newebpay_course_start',
        },
      })
      .select('id')
      .single()

    if (paymentError) {
      return NextResponse.json({ ok: false, message: paymentError.message }, { status: 500 })
    }

    const mpgForm = createCoursePaymentMpgForm(
      {
        merchantOrderNo,
        amount: course.price,
        itemDesc,
        notifyUrl: `${config.siteUrl}/api/payments/newebpay/notify`,
        returnUrl: `${config.siteUrl}/api/payments/newebpay/return`,
        clientBackUrl: `${config.siteUrl}/account/courses`,
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
