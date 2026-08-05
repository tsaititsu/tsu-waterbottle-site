import type { CourseNewebPayPaymentMode } from './types'

export type CoursePaymentRawPayload = {
  itemType: 'course'
  courseId: string
  amount: number
  merchantOrderNo: string
  source: 'course'
  paymentMode: CourseNewebPayPaymentMode
  itemDesc: string
}

export type CoursePaymentInsertPayload = {
  user_id: string
  provider: 'newebpay'
  item_type: 'course'
  item_id: string
  item_name: string
  amount_twd: number
  currency: 'TWD'
  status: 'pending'
  merchant_order_no: string
  raw_payload: CoursePaymentRawPayload
}

export function buildNewebPayMerchantOrderUrl(siteUrl: string, pathname: string, merchantOrderNo: string) {
  const url = new URL(pathname, `${siteUrl}/`)
  url.searchParams.set('merchantOrderNo', merchantOrderNo)
  return url.toString()
}

export function buildCoursePaymentRawPayload(input: {
  courseId: string
  amount: number
  merchantOrderNo: string
  itemDesc: string
  paymentMode: CourseNewebPayPaymentMode
}): CoursePaymentRawPayload {
  return {
    itemType: 'course',
    courseId: input.courseId,
    amount: input.amount,
    merchantOrderNo: input.merchantOrderNo,
    source: 'course',
    paymentMode: input.paymentMode,
    itemDesc: input.itemDesc,
  }
}

export function buildCoursePaymentInsertPayload(input: {
  userId: string
  courseId: string
  courseTitle: string
  amount: number
  merchantOrderNo: string
  itemDesc: string
  paymentMode: CourseNewebPayPaymentMode
}): CoursePaymentInsertPayload {
  return {
    user_id: input.userId,
    provider: 'newebpay',
    item_type: 'course',
    item_id: input.courseId,
    item_name: input.courseTitle,
    amount_twd: input.amount,
    currency: 'TWD',
    status: 'pending',
    merchant_order_no: input.merchantOrderNo,
    raw_payload: buildCoursePaymentRawPayload({
      courseId: input.courseId,
      amount: input.amount,
      merchantOrderNo: input.merchantOrderNo,
      itemDesc: input.itemDesc,
      paymentMode: input.paymentMode,
    }),
  }
}
