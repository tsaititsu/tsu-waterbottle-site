import { NextResponse } from 'next/server'
import { courseIds, isCourseId, type CourseId } from '@/lib/courses'
import { getSupabaseAdmin, hasSupabaseAdminConfig } from '@/lib/supabase/admin'
import { getUserIdFromRequest } from '@/lib/supabase/auth'

export async function GET(request: Request) {
  if (!hasSupabaseAdminConfig()) {
    return NextResponse.json({ ok: false, message: 'Supabase 管理端尚未設定' }, { status: 500 })
  }

  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ ok: false, message: '尚未登入' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('course_purchases')
    .select('course_id')
    .eq('user_id', userId)
    .eq('status', 'paid')
    .in('course_id', courseIds)

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
  }

  const courseIdsPurchased = (data ?? [])
    .map((purchase) => purchase.course_id)
    .filter(isCourseId) as CourseId[]

  return NextResponse.json({ courseIds: courseIdsPurchased })
}
