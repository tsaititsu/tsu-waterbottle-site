export const LINE_PAY_PRODUCTION_ONE_DOLLAR_CONFIRMATION =
  'RUN_LINE_PAY_PRODUCTION_NT1_ONCE'

export const LINE_PAY_PRODUCTION_ONE_DOLLAR_ENTRY_DEFINITIONS = [
  {
    source: 'ai_chart_report',
    label: 'AI 命盤分析',
    href: '/ai-chart',
    instruction: '完成命盤資料後，在報告付款選單選擇 LINE Pay。',
  },
  {
    source: 'ai_divination',
    label: 'AI 紫微牌卡占卜',
    href: '/ai-divination',
    instruction: '完成抽牌與同意確認後，在付款選單選擇 LINE Pay。',
  },
  {
    source: 'cart',
    label: '購物車',
    href: '/cart',
    instruction: '購物車內需先有商品，再於付款選單選擇 LINE Pay。',
  },
  {
    source: 'booking',
    label: '水瓶先生論命',
    href: '/booking',
    instruction: '填妥預約資料與條款確認後，在付款選單選擇 LINE Pay。',
  },
] as const

export type LinePayProductionOneDollarEntrySource =
  (typeof LINE_PAY_PRODUCTION_ONE_DOLLAR_ENTRY_DEFINITIONS)[number]['source']

export function isLinePayProductionOneDollarEntrySource(
  value: unknown,
): value is LinePayProductionOneDollarEntrySource {
  return (
    typeof value === 'string'
    && LINE_PAY_PRODUCTION_ONE_DOLLAR_ENTRY_DEFINITIONS.some(
      (entry) => entry.source === value,
    )
  )
}

export function getLinePayProductionOneDollarEntryLabel(
  source: LinePayProductionOneDollarEntrySource,
) {
  return LINE_PAY_PRODUCTION_ONE_DOLLAR_ENTRY_DEFINITIONS.find(
    (entry) => entry.source === source,
  )!.label
}

export function trustedProductionLinePayWebUrl(value: unknown) {
  if (typeof value !== 'string') return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (
    url.protocol !== 'https:'
    || url.hostname !== 'web-pay.line.me'
    || url.port !== ''
    || url.username !== ''
    || url.password !== ''
    || !url.pathname.startsWith('/web/')
  ) {
    return null
  }
  return url.toString()
}
