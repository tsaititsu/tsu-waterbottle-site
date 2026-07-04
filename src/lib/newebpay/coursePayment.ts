export type CoursePaymentRawPayload = {
  itemType: 'course'
  courseId: string
  amount: number
  merchantOrderNo: string
  source: 'course'
  paymentMode: 'credit'
  itemDesc: string
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
}): CoursePaymentRawPayload {
  return {
    itemType: 'course',
    courseId: input.courseId,
    amount: input.amount,
    merchantOrderNo: input.merchantOrderNo,
    source: 'course',
    paymentMode: 'credit',
    itemDesc: input.itemDesc,
  }
}
