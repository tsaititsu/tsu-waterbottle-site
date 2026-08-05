export const STANDARD_CHECKOUT_PAYMENT_METHODS = [
  'credit_card',
  'apple_pay',
  'line_pay',
  'newebpay_atm',
] as const

export const COURSE_INSTALLMENT_PAYMENT_METHODS = [
  'credit_card_installment_3',
  'credit_card_installment_6',
] as const

export type StandardCheckoutPaymentMethod =
  (typeof STANDARD_CHECKOUT_PAYMENT_METHODS)[number]
export type CourseInstallmentPaymentMethod =
  (typeof COURSE_INSTALLMENT_PAYMENT_METHODS)[number]
export type CheckoutPaymentMethod =
  | StandardCheckoutPaymentMethod
  | CourseInstallmentPaymentMethod

export type CheckoutPaymentMethodOption = Readonly<{
  value: CheckoutPaymentMethod
  label: string
  description: string
  provider: 'newebpay' | 'line_pay'
}>

const PAYMENT_METHOD_OPTIONS: Readonly<
  Record<CheckoutPaymentMethod, CheckoutPaymentMethodOption>
> = Object.freeze({
  credit_card: Object.freeze({
    value: 'credit_card',
    label: '信用卡一次付清',
    description: '前往藍新金流安全付款頁，以信用卡一次付清。',
    provider: 'newebpay',
  }),
  apple_pay: Object.freeze({
    value: 'apple_pay',
    label: 'Apple Pay',
    description: '使用支援 Apple Pay 的 Apple 裝置與 Safari 完成付款。',
    provider: 'newebpay',
  }),
  line_pay: Object.freeze({
    value: 'line_pay',
    label: 'LINE Pay',
    description: '使用本站獨立串接的 LINE Pay 安全付款頁。',
    provider: 'line_pay',
  }),
  newebpay_atm: Object.freeze({
    value: 'newebpay_atm',
    label: 'ATM 虛擬帳號',
    description: '由藍新產生本次訂單專用帳號，入帳後由系統自動確認。',
    provider: 'newebpay',
  }),
  credit_card_installment_3: Object.freeze({
    value: 'credit_card_installment_3',
    label: '信用卡分期｜3 期',
    description: '僅供紫微課程使用；實際可分期銀行以藍新付款頁為準。',
    provider: 'newebpay',
  }),
  credit_card_installment_6: Object.freeze({
    value: 'credit_card_installment_6',
    label: '信用卡分期｜6 期',
    description: '僅供紫微課程使用；實際可分期銀行以藍新付款頁為準。',
    provider: 'newebpay',
  }),
})

export function getCheckoutPaymentMethodOptions(input: {
  includeCourseInstallments?: boolean
  includeLinePay?: boolean
  includeNewebPay?: boolean
} = {}): CheckoutPaymentMethodOption[] {
  const methods: CheckoutPaymentMethod[] = [
    ...STANDARD_CHECKOUT_PAYMENT_METHODS,
    ...(input.includeCourseInstallments
      ? COURSE_INSTALLMENT_PAYMENT_METHODS
      : []),
  ]

  return methods
    .filter((method) => {
      const option = PAYMENT_METHOD_OPTIONS[method]
      if (option.provider === 'line_pay') return input.includeLinePay !== false
      return input.includeNewebPay !== false
    })
    .map((method) => PAYMENT_METHOD_OPTIONS[method])
}

export function isCheckoutPaymentMethod(
  value: unknown,
): value is CheckoutPaymentMethod {
  return (
    typeof value === 'string'
    && Object.prototype.hasOwnProperty.call(PAYMENT_METHOD_OPTIONS, value)
  )
}

export function isLinePayCheckoutMethod(
  method: CheckoutPaymentMethod,
): method is 'line_pay' {
  return method === 'line_pay'
}

export type StandardNewebPayCheckoutMode = 'credit' | 'apple_pay' | 'atm'
export type CourseNewebPayCheckoutMode =
  | StandardNewebPayCheckoutMode
  | 'installment_3'
  | 'installment_6'

export function toStandardNewebPayCheckoutMode(
  method: Exclude<StandardCheckoutPaymentMethod, 'line_pay'>,
): StandardNewebPayCheckoutMode {
  if (method === 'credit_card') return 'credit'
  if (method === 'apple_pay') return 'apple_pay'
  return 'atm'
}

export function toCourseNewebPayCheckoutMode(
  method: Exclude<CheckoutPaymentMethod, 'line_pay'>,
): CourseNewebPayCheckoutMode {
  if (method === 'credit_card_installment_3') return 'installment_3'
  if (method === 'credit_card_installment_6') return 'installment_6'
  return toStandardNewebPayCheckoutMode(method)
}
