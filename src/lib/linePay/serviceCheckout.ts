export const LINE_PAY_SERVICE_SOURCES = [
  'ai_chart_report',
  'ai_divination',
  'booking',
  'course',
] as const

export type LinePayServiceSource =
  (typeof LINE_PAY_SERVICE_SOURCES)[number]

export type LinePayServiceTarget = Readonly<{
  source: LinePayServiceSource
  sourceId: string
  itemType: LinePayServiceSource
  itemName: string
  amountTwd: number
  bookingId: string | null
  returnPath: string
}>

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const COURSE_ID_PATTERN = /^(basic|advanced|master)$/

export function isLinePayServiceSource(
  value: unknown,
): value is LinePayServiceSource {
  return (
    typeof value === 'string'
    && LINE_PAY_SERVICE_SOURCES.includes(value as LinePayServiceSource)
  )
}

export function isValidLinePayServiceSourceId(
  source: LinePayServiceSource,
  value: unknown,
) {
  if (typeof value !== 'string') return false
  const normalized = value.trim()
  return source === 'course'
    ? COURSE_ID_PATTERN.test(normalized)
    : UUID_PATTERN.test(normalized)
}

export function getLinePayServiceReturnPath(
  source: LinePayServiceSource,
  sourceId: string,
) {
  if (source === 'ai_chart_report') return `/ai-chart/result/${sourceId}`
  if (source === 'ai_divination') return `/ai-divination/result/${sourceId}`
  if (source === 'booking') return '/account/bookings'
  return '/account/courses'
}

export function isSafeLinePayReturnPath(value: unknown): value is string {
  if (typeof value !== 'string') return false
  if (value === '/cart' || value === '/account/bookings' || value === '/account/courses') {
    return true
  }
  return (
    /^\/ai-chart\/result\/[0-9a-f-]{36}$/i.test(value)
    || /^\/ai-divination\/result\/[0-9a-f-]{36}$/i.test(value)
  )
}
