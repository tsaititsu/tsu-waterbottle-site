import { isCourseId, isCourseSalesOpen, type CourseId } from '@/lib/courses'
import { getNewebPayConfig } from '@/lib/newebpay/config'
import { createCoursePaymentMpgForm, generateMerchantOrderNo } from '@/lib/newebpay/mpg'
import { getSupabaseAdmin, hasSupabaseAdminConfig } from '@/lib/supabase/admin'
import { getUserIdFromRequest } from '@/lib/supabase/auth'
import { handleCourseStartRequest, type CourseStartDependencies } from './handler'

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

async function insertPayment(payload: Parameters<CourseStartDependencies['insertPayment']>[0]) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('payments').insert(payload).select('id').single()

  if (error) throw new Error(error.message)
  if (!data?.id) throw new Error('建立付款單失敗')

  return { id: data.id as string }
}

const defaultDependencies: CourseStartDependencies = {
  isCourseSalesOpen,
  hasSupabaseAdminConfig,
  getUserIdFromRequest,
  getPurchasedCourseIds,
  getNewebPayConfig,
  generateMerchantOrderNo,
  insertPayment,
  createCoursePaymentMpgForm,
}

export async function POST(request: Request) {
  return handleCourseStartRequest(request, defaultDependencies)
}
