import { NextResponse } from 'next/server'
import { canBuyCourse, getCourseLockedReason, isCourseId, type CourseId } from '@/lib/courses'
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

    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('course_purchases').insert({
      user_id: userId,
      course_id: courseId,
      payment_id: null,
      status: 'paid',
    })

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ ok: false, message: '已購買此課程' }, { status: 409 })
      }

      return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, courseId })
  } catch (error) {
    const message = error instanceof Error ? error.message : '購買課程失敗'
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
