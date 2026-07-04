import { getSupabaseAdmin } from './admin'

export type MarkCoursePaidInput = {
  paymentId: string
  userId: string
  courseId: string
  paidAt?: string | null
}

export type MarkCoursePaidResult =
  | { result: 'inserted'; userId: string; courseId: string }
  | { result: 'updated'; userId: string; courseId: string }
  | { result: 'already_paid'; userId: string; courseId: string }

export type CoursePurchaseSyncRow = {
  id: string
  status: string
}

export type CoursePaidInsertPayload = {
  user_id: string
  course_id: string
  payment_id: string
  status: 'paid'
  purchased_at: string
}

export type CoursePaidUpdatePayload = {
  payment_id: string
  status: 'paid'
  purchased_at: string
}

export type MarkCoursePaidDecision = 'insert' | 'update' | 'already_paid'

function assertRequiredText(value: string, fieldName: string) {
  if (!value.trim()) {
    throw new Error(`${fieldName} 不可空白`)
  }
}

function resolvePurchasedAt(paidAt: string | null | undefined, now: string) {
  return paidAt?.trim() || now
}

export function getMarkCoursePaidDecision(
  purchase: Pick<CoursePurchaseSyncRow, 'status'> | null,
): MarkCoursePaidDecision {
  if (!purchase) return 'insert'
  if (purchase.status === 'paid') return 'already_paid'
  return 'update'
}

export function buildCoursePaidInsertPayload(
  input: MarkCoursePaidInput,
  now = new Date().toISOString(),
): CoursePaidInsertPayload {
  assertRequiredText(input.paymentId, 'paymentId')
  assertRequiredText(input.userId, 'userId')
  assertRequiredText(input.courseId, 'courseId')

  return {
    user_id: input.userId,
    course_id: input.courseId,
    payment_id: input.paymentId,
    status: 'paid',
    purchased_at: resolvePurchasedAt(input.paidAt, now),
  }
}

export function buildCoursePaidUpdatePayload(
  input: MarkCoursePaidInput,
  now = new Date().toISOString(),
): CoursePaidUpdatePayload {
  assertRequiredText(input.paymentId, 'paymentId')
  assertRequiredText(input.userId, 'userId')
  assertRequiredText(input.courseId, 'courseId')

  return {
    payment_id: input.paymentId,
    status: 'paid',
    purchased_at: resolvePurchasedAt(input.paidAt, now),
  }
}

export async function markCoursePaidByPayment(input: MarkCoursePaidInput): Promise<MarkCoursePaidResult> {
  assertRequiredText(input.paymentId, 'paymentId')
  assertRequiredText(input.userId, 'userId')
  assertRequiredText(input.courseId, 'courseId')

  const supabase = getSupabaseAdmin()
  const { data: existingPurchase, error: selectError } = await supabase
    .from('course_purchases')
    .select('id,status')
    .eq('user_id', input.userId)
    .eq('course_id', input.courseId)
    .maybeSingle()

  if (selectError) {
    throw new Error(selectError.message)
  }

  const decision = getMarkCoursePaidDecision(existingPurchase as CoursePurchaseSyncRow | null)

  if (decision === 'already_paid') {
    return {
      result: 'already_paid',
      userId: input.userId,
      courseId: input.courseId,
    }
  }

  if (decision === 'insert') {
    const { error: insertError } = await supabase
      .from('course_purchases')
      .insert(buildCoursePaidInsertPayload(input))

    if (insertError) {
      throw new Error(insertError.message)
    }

    return {
      result: 'inserted',
      userId: input.userId,
      courseId: input.courseId,
    }
  }

  const { error: updateError } = await supabase
    .from('course_purchases')
    .update(buildCoursePaidUpdatePayload(input))
    .eq('user_id', input.userId)
    .eq('course_id', input.courseId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  return {
    result: 'updated',
    userId: input.userId,
    courseId: input.courseId,
  }
}
