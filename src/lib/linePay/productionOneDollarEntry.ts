export const LINE_PAY_PRODUCTION_ONE_DOLLAR_CONFIRMATION =
  'RUN_LINE_PAY_PRODUCTION_NT1_ONCE'

export const LINE_PAY_PRODUCTION_ONE_DOLLAR_ENTRY_SOURCES = [
  'admin',
  'ai_chart_report',
  'ai_divination',
  'cart',
  'booking',
] as const

export type LinePayProductionOneDollarEntrySource =
  (typeof LINE_PAY_PRODUCTION_ONE_DOLLAR_ENTRY_SOURCES)[number]

const ENTRY_LABELS: Readonly<
  Record<LinePayProductionOneDollarEntrySource, string>
> = Object.freeze({
  admin: '後台共用',
  ai_chart_report: 'AI 命盤分析',
  ai_divination: 'AI 紫微牌卡占卜',
  cart: '購物車',
  booking: '水瓶先生論命',
})

export function isLinePayProductionOneDollarEntrySource(
  value: unknown,
): value is LinePayProductionOneDollarEntrySource {
  return (
    typeof value === 'string'
    && (LINE_PAY_PRODUCTION_ONE_DOLLAR_ENTRY_SOURCES as readonly string[])
      .includes(value)
  )
}

export function getLinePayProductionOneDollarEntryLabel(
  source: LinePayProductionOneDollarEntrySource,
) {
  return ENTRY_LABELS[source]
}
