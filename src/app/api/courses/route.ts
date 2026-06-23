import { NextResponse } from 'next/server'
import { courseCatalog, isCourseId, type CourseInfo } from '@/lib/courses'
import { getSupabaseAdmin, hasSupabaseAdminConfig } from '@/lib/supabase/admin'

type CourseRow = {
  id: string
  title: string
  subtitle: string | null
  description: string | null
  price: number
  level: number
  prerequisite_course_id: string | null
  is_active: boolean | null
}

function mergeCourseRow(row: CourseRow): CourseInfo | null {
  if (!isCourseId(row.id)) return null

  const fallback = courseCatalog.find((course) => course.id === row.id)
  if (!fallback) return null

  return {
    ...fallback,
    title: row.title,
    subtitle: row.subtitle ?? fallback.subtitle,
    description: row.description ?? fallback.description,
    price: row.price,
    level: row.level,
    prerequisiteCourseId: isCourseId(row.prerequisite_course_id) ? row.prerequisite_course_id : null,
  }
}

export async function GET() {
  if (!hasSupabaseAdminConfig()) {
    return NextResponse.json({ courses: courseCatalog })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('courses')
    .select('id, title, subtitle, description, price, level, prerequisite_course_id, is_active')
    .eq('is_active', true)
    .order('level', { ascending: true })

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
  }

  const courses = (data ?? []).map((row) => mergeCourseRow(row as CourseRow)).filter(Boolean)
  return NextResponse.json({ courses })
}
